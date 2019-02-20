// puzzle_page.js

var gl = undefined;
var puzzle = undefined;
var shader_program = undefined;
var frames_per_second = 60.0;

function vec3_create(data) {
    let vec = vec3.create();
    vec3.set(vec, data.x, data.y, data.z);
    return vec;
}

class PuzzleMesh extends StaticTriangleMesh {
    constructor(mesh_data) {
        super();
        this.generate(mesh_data.triangle_list, mesh_data.vertex_list);
        this.color = vec3_create(mesh_data.color);
        this.center = vec3_create(mesh_data.center);
        this.permutation_transform = mat4.create(); // Takes the mesh from the solved state to the scrambled state.
        this.animation_axis = vec3_create({x: 1.0, y: 0.0, z: 0.0});
        this.animation_angle = 0.0;
        this.highlight = false;
    }

    is_animating() {
        return (this.animation_angle == 0.0) ? false : true;
    }

    advance_animation() {
        let radians_per_second = Math.PI;
        let angle_delta = radians_per_second / frames_per_second;
        if(this.animation_angle > angle_delta) {
            this.animation_angle -= angle_delta;
        } else if(this.animation_angle < -angle_delta) {
            this.animation_angle += angle_delta;
        } else {
            this.animation_angle = 0.0;
        }
    }

    render() {

        let color_loc = gl.getUniformLocation(shader_program.program, 'color');

        if(this.highlight) {
            let highlight_color = vec3.create();
            vec3.set(highlight_color, 1.0, 1.0, 1.0);
            vec3.add(highlight_color, this.color, highlight_color);
            vec3.scale(highlight_color, highlight_color, 0.5);
            gl.uniform3fv(color_loc, highlight_color);
        } else {
            gl.uniform3fv(color_loc, this.color);
        }

        let permutation_transform_matrix_loc = gl.getUniformLocation(shader_program.program, 'permutation_transform_matrix');
        gl.uniformMatrix4fv(permutation_transform_matrix_loc, false, this.permutation_transform);

        let animation_transform = mat4.create();
        if(this.animation_angle != 0.0)
            mat4.fromRotation(animation_transform, this.animation_angle, this.animation_axis);

        let animation_transform_matrix_loc = gl.getUniformLocation(shader_program.program, 'animation_transform_matrix');
        gl.uniformMatrix4fv(animation_transform_matrix_loc, false, animation_transform);

        let vertex_loc = gl.getUniformLocation(shader_program.program, 'vertex');
        
        super.render(vertex_loc);
    }

    is_captured_by_generator(generator) {
        let vec = vec3.create();
        let transformed_center = vec3.create();
        for(let i = 0; i < generator.plane_list.length; i++) {
            let plane = generator.plane_list[i];
            vec3.transformMat4(transformed_center, this.center, this.permutation_transform);
            vec3.subtract(vec, transformed_center, plane.center);
            let distance = vec3.dot(vec, plane.unit_normal);
            if(distance >= 0.0)
                return false;
        }
        return true;
    }

    is_solved() {
        let eps = 1e-7;
        let identity = mat4.create();
        for(let i = 0; i < 16; i++) {
            if(Math.abs(identity[i] - this.transform_matrix[i]) >= eps)
                return false;
        }
        return true;
    }
}

class PuzzleGenerator {
    constructor(generator_data) {
        this.pick_point = vec3_create(generator_data.pick_point);
        this.axis = vec3_create(generator_data.axis);
        this.angle = generator_data.angle;
        this.plane_list = [];
        for(let i = 0; i < generator_data.plane_list.length; i++) {
            let plane_data = generator_data.plane_list[i];
            let center = vec3_create(plane_data.center);
            let unit_normal = vec3_create(plane_data.unit_normal);
            let plane = {'center': center, 'unit_normal': unit_normal}
            this.plane_list.push(plane);
        }
        this.special_case_data = 'special_case_data' in generator_data ? generator_data.special_case_data : undefined;
    }

    release() {
    }
}

class PuzzleMove {
    constructor(generator, inverse, override_angle=undefined) {
        this.generator = generator;
        this.inverse = inverse;
        this.override_angle = override_angle;
    }

    apply() {
        let angle = this.override_angle ? this.override_angle : this.generator.angle;
        
        let permutation_transform = mat4.create();
        mat4.fromRotation(permutation_transform, this.inverse ? -angle : angle, this.generator.axis);

        // The puzzle must not be animating at this moment for this to work.
        puzzle.for_captured_meshes(this.generator, mesh => {
            mat4.multiply(mesh.permutation_transform, permutation_transform, mesh.permutation_transform);
            vec3.copy(mesh.animation_axis, this.generator.axis);
            mesh.animation_angle = this.inverse ? angle : -angle;
        });
    }
}

class Puzzle {
    constructor(puzzle_name) {
        this.name = puzzle_name;
        this.mesh_list = [];
        this.generator_list = [];
        this.orient_matrix = mat4.create();
        this.selected_generator = -1;
        this.move_queue = [];
    }
    
    release() {
        for(let i = 0; i < this.generator_list.length; i++) {
            let generator = this.generator_list[i];
            generator.release();
        }
        this.generator_list = [];

        for(let i = 0; i < this.mesh_list.length; i++) {
            let mesh = this.mesh_list[i];
            mesh.release();
        }
        this.mesh_list = [];

        this.move_queue = [];
    }
    
    promise() {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: 'puzzles/' + this.name + '.json',
                dataType: 'json',
                success: puzzle_data => {
                    if('error' in puzzle_data) {
                        alert(puzzle_data['error']);
                        reject();
                    } else {
                        this.release();
                        let mesh_list = puzzle_data['mesh_list'];
                        for(let i = 0; i < mesh_list.length; i++) {
                            let mesh_data = mesh_list[i];
                            let mesh = new PuzzleMesh(mesh_data);
                            this.mesh_list.push(mesh);
                        }
                        let generator_list = puzzle_data['generator_mesh_list'];
                        for(let i = 0; i < generator_list.length; i++) {
                            let generator_data = generator_list[i];
                            let generator = new PuzzleGenerator(generator_data);
                            this.generator_list.push(generator);
                        }
                        resolve();
                    }
                },
                failure: error => {
                    alert(error);
                    reject();
                }
            });
        });
    }
    
    render() {
        gl.useProgram(shader_program.program);

        let canvas = $('#puzzle_canvas')[0];
        let transform_matrix = calc_transform_matrix(canvas);
        let transform_matrix_loc = gl.getUniformLocation(shader_program.program, 'transform_matrix');
        gl.uniformMatrix4fv(transform_matrix_loc, false, transform_matrix);

        for(let i = 0; i < this.mesh_list.length; i++) {
            let mesh = this.mesh_list[i];
            mesh.render();
        }
    }

    pick_generator(projected_mouse_point) {
        let canvas = $('#puzzle_canvas')[0];
        let transform_matrix = calc_transform_matrix(canvas);

        let min_distance = 0.3;
        let j = -1;
        for(let i = 0; i < this.generator_list.length; i++) {
            let generator = this.generator_list[i];

            let projected_center = vec3.create();
            vec3.transformMat4(projected_center, generator.pick_point, transform_matrix);

            projected_center[2] = 0.0;

            let distance = vec3.distance(projected_center, projected_mouse_point);
            if(distance < min_distance) {
                min_distance = distance;
                j = i;
            }
        }

        if(this.selected_generator != j) {
            this.selected_generator = j;
            this.highlight_captured_meshes();
            return true;
        } else {
            return false;
        }
    }

    highlight_captured_meshes() {
        for(let i = 0; i < this.mesh_list.length; i++) {
            let mesh = this.mesh_list[i];
            mesh.highlight = false;
        }

        let generator = this.get_selected_generator();
        if(generator) {
            this.for_captured_meshes(generator, mesh => {
                mesh.highlight = true;
            });
        }
    }

    for_captured_meshes(generator, func) {
        for(let i = 0; i < this.mesh_list.length; i++) {
            let mesh = this.mesh_list[i];
            if(mesh.is_captured_by_generator(generator)) {
                func(mesh);
            }
        }
    }

    get_selected_generator() {
        if(this.selected_generator >= 0)
            return this.generator_list[this.selected_generator];
        return undefined;
    }

    is_solved() {
        // This might not actually be accurate, because there may be
        // more than one solved state of the puzzle, each indistinguishable
        // from the other.  All solved states would form the kernel of a homomorphism.
        let unsolved_mesh = this.mesh_list.find(mesh => {
            return !mesh.is_solved();
        });
        return unsolved_mesh ? false : true;
    }

    is_animating() {
        let animating_mesh = this.mesh_list.find(mesh => {
            return mesh.is_animating();
        });
        return animating_mesh ? true : false;
    }

    advance_animation() {
        if(this.is_animating()) {
            this.mesh_list.forEach(mesh => {
                mesh.advance_animation();
            });
            return true;
        } else if(this.move_queue.length > 0) {
            let move = this.move_queue.shift();
            move.apply();
            // TODO: If flagged for history, the move should be put on a history list for undo/redo purposes.
            return true;
        } else {
            return false;
        }
    }
}

function interval_callback() {
    if(puzzle.advance_animation()) {

        frames_per_second = 60.0;   // TODO: Accurately compute this.

        render_scene();
    }
}

function canvas_mouse_wheel_move(event) {
    event.preventDefault();

    let generator = puzzle.get_selected_generator();
    if(generator) {
        if(puzzle.name == 'CurvyCopter' && (shift_key_down || ctrl_key_down)) {
            curvy_copter_special_move(event, generator);
        } else {
            let move = undefined;
    
            if(event.deltaY > 0) {
                move = new PuzzleMove(generator, false);
            } else if(event.deltaY < 0) {
                move = new PuzzleMove(generator, true);
            }
    
            if(move)
                puzzle.move_queue.push(move);
        }
    }
}

function curvy_copter_special_move(event, generator) {
    if(event.deltaY === 0)
        return;
    
    let scale = undefined;
    let special_move = undefined;
    if(shift_key_down) {
        special_move = generator.special_case_data.special_move_a;
        scale = 1.0;
    } else if(ctrl_key_down) {
        special_move = generator.special_case_data.special_move_b;
        scale = -1.0;
    }
    
    let n = vec3_create({x: 1.0, y: 1.0, z: 0.0});
    let a = vec3_create({x: 1.0, y: 0.0, z: 1.0});
    let b = vec3_create({x: 0.0, y: 1.0, z: 1.0});
    
    vec3.normalize(n, n);
    
    let a_projected = vec3.create();
    let b_projected = vec3.create();
    
    vec3.scale(a_projected, n, vec3.dot(a, n));
    vec3.scale(b_projected, n, vec3.dot(b, n));
    
    let a_rejected = vec3.create();
    let b_rejected = vec3.create();
    
    vec3.subtract(a_rejected, a, a_projected);
    vec3.subtract(b_rejected, b, b_projected);
    
    let vec_a = vec3.create();
    let vec_b = vec3.create();
    
    vec3.normalize(vec_a, a_rejected);
    vec3.normalize(vec_b, b_rejected);
    
    let angle = Math.acos(vec3.dot(vec_a, vec_b));
    
    let generator_a = puzzle.generator_list[special_move.generator_mesh_a];
    let generator_b = puzzle.generator_list[special_move.generator_mesh_b];
    
    puzzle.move_queue.push(new PuzzleMove(generator_a, false, -angle * scale));
    puzzle.move_queue.push(new PuzzleMove(generator_b, false, -angle * scale));
    
    puzzle.move_queue.push(new PuzzleMove(generator, (event.deltaY < 0) ? true : false));
    
    puzzle.move_queue.push(new PuzzleMove(generator_a, false, angle * scale));
    puzzle.move_queue.push(new PuzzleMove(generator_b, false, angle * scale));
}

var dragging = false;

function canvas_mouse_move(event) {
    if(dragging) {
        let scale = Math.PI / 100.0;

        let x_angle_delta = -scale * event.movementY;
        let y_angle_delta = scale * event.movementX;

        let x_axis = vec3.create();
        vec3.set(x_axis, 1.0, 0.0, 0.0);

        let y_axis = vec3.create();
        vec3.set(y_axis, 0.0, 1.0, 0.0);

        let x_axis_rotation = mat4.create();
        mat4.fromRotation(x_axis_rotation, x_angle_delta, x_axis);

        let y_axis_rotation = mat4.create();
        mat4.fromRotation(y_axis_rotation, y_angle_delta, y_axis);

        mat4.mul(puzzle.orient_matrix, x_axis_rotation, puzzle.orient_matrix);
        mat4.mul(puzzle.orient_matrix, y_axis_rotation, puzzle.orient_matrix);

        render_scene();
    } else {
        let canvas = $('#puzzle_canvas')[0];

        let x = -1.0 + 2.0 * event.offsetX / canvas.width;
        let y = -1.0 + 2.0 * (1.0 - event.offsetY / canvas.height);

        let projected_mouse_point = vec3.create();
        vec3.set(projected_mouse_point, x, y, 0.0);

        if(puzzle.pick_generator(projected_mouse_point))
            render_scene();
    }
}

function canvas_mouse_down(event) {
    dragging = true;
}

function canvas_mouse_up(event) {
    dragging = false;
}

function calc_transform_matrix(canvas) {
    let aspect_ratio = canvas.width / canvas.height;

    let proj_matrix = mat4.create();
    mat4.perspective(proj_matrix, 60.0 * Math.PI / 180.0, aspect_ratio, 1.0, null);

    let eye = vec3.create();
    vec3.set(eye, 0.0, 0.0, -5.0);

    let center = vec3.create();
    vec3.set(center, 0.0, 0.0, 0.0);

    let up = vec3.create();
    vec3.set(up, 0.0, 1.0, 0.0);

    let view_matrix = mat4.create();
    mat4.lookAt(view_matrix, eye, center, up);

    let transform_matrix = mat4.create();
    mat4.multiply(transform_matrix, view_matrix, puzzle.orient_matrix);
    mat4.multiply(transform_matrix, proj_matrix, transform_matrix);

    return transform_matrix;
}

function render_scene() {
    let canvas = $('#puzzle_canvas')[0];
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    puzzle.render();
}

function promise_puzzle_menu() {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: 'puzzle_menu',
            dataType: 'json',
            success: puzzle_menu => {
                let puzzle_menu_div = document.getElementById('puzzle_menu');
                for(let i = 0; i < puzzle_menu.length; i++) {
                    let menu_item = puzzle_menu[i];
                    let menu_item_icon = document.createElement('img');
                    menu_item_icon.src = 'menu/' + menu_item + '.jpg';
                    menu_item_icon.classList.add('puzzle_icon');
                    menu_item_icon.addEventListener('click', () => {
                        menu_item_clicked(menu_item);
                    });
                    puzzle_menu_div.appendChild(menu_item_icon);
                }
                puzzle_menu_div.addEventListener('mousemove', menu_mouse_move);
                puzzle_menu_div.addEventListener('mouseover', menu_mouse_over);
                puzzle_menu_div.addEventListener('mouseout', menu_mouse_out);
                setInterval(menu_animate, 10);
                menu_update();
                resolve(puzzle_menu[0]);
            },
            failure: error => {
                alert(error);
                reject();
            }
        });
    });
}

var puzzle_menu_scroll_target = 0.0;
var puzzle_menu_scroll = 0.0;
var puzzle_menu_deploy_target = 0.0;
var puzzle_menu_deploy = 0.0;

function menu_mouse_move(event) {
    let puzzle_menu_div = document.getElementById('puzzle_menu');
    
    if(event.pageX < puzzle_menu_div.offsetHeight) {
        puzzle_menu_scroll_target = 0.0;
    } else if(event.pageX > puzzle_menu_div.offsetWidth - puzzle_menu_div.offsetHeight) {
        puzzle_menu_scroll_target = 1.0;
    } else {
        puzzle_menu_scroll_target = event.pageX / puzzle_menu_div.offsetWidth;
    }
}

function menu_mouse_over(event) {
    puzzle_menu_deploy_target = 1.0;
}

function menu_mouse_out(event) {
    puzzle_menu_deploy_target = 0.0;
}

function menu_update() {
    let puzzle_menu_div = document.getElementById('puzzle_menu');
    
    puzzle_menu_div.style.opacity = puzzle_menu_deploy;
    
    let menu_width = puzzle_menu_div.offsetWidth;
    let icon_width = puzzle_menu_div.children[0].offsetWidth;
    let total_icon_width = icon_width * puzzle_menu_div.children.length;
    let left = 0.0;
    
    if(total_icon_width < menu_width) {
        puzzle_menu_scroll = 0.5;
    }
    
    left = (menu_width - total_icon_width) * puzzle_menu_scroll;
    
    for(let i = 0; i < puzzle_menu_div.children.length; i++) {
        let menu_item_icon = puzzle_menu_div.children[i];
        
        // It's really confusing to me that they all need to be set to this.
        menu_item_icon.style.left = left.toString() + 'px';
    }
}

function menu_animate() {
    if(puzzle_menu_scroll != puzzle_menu_scroll_target || puzzle_menu_deploy != puzzle_menu_deploy_target) {
        let lerp = 0.05;
        puzzle_menu_scroll = puzzle_menu_scroll + lerp * (puzzle_menu_scroll_target - puzzle_menu_scroll);
        puzzle_menu_deploy = puzzle_menu_deploy + lerp * (puzzle_menu_deploy_target - puzzle_menu_deploy);
        menu_update();
    }
}

function menu_item_clicked(menu_item) {
    puzzle.name = menu_item;
    puzzle.promise().then(() => {
        render_scene();
    });
}

function document_ready() {
    try {
        let canvas = $('#puzzle_canvas')[0];
        
        gl = canvas.getContext('webgl2');
        if(!gl) {
            throw 'WebGL is not available.';
        }
        
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
	    gl.enable(gl.DEPTH_TEST);
	    gl.enable(gl.BLEND);
	    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	    gl.enable(gl.CULL_FACE);
	    gl.cullFace(gl.BACK);
	    
	    promise_puzzle_menu().then(initial_puzzle => {
	    
            puzzle = new Puzzle(initial_puzzle);
            
            shader_program = new ShaderProgram('shaders/puzzle_vert_shader.txt', 'shaders/puzzle_frag_shader.txt');
            
            Promise.all([
                shader_program.promise(),
                puzzle.promise()
            ]).then(() => {
                
                $(window).bind('resize', function() {
                    render_scene();
                    menu_update();
                });
    
                let canvas = $('#puzzle_canvas')[0];
    
                canvas.addEventListener('wheel', canvas_mouse_wheel_move);
                canvas.addEventListener('mousemove', canvas_mouse_move);
                canvas.addEventListener('mousedown', canvas_mouse_down);
                canvas.addEventListener('mouseup', canvas_mouse_up);
    
                render_scene();
    
                setInterval(interval_callback, 10);
            });
        });
        
    } catch(error) {
        alert('Error: ' + error.toString());
    }
}

$(document).ready(document_ready);

var shift_key_down = false;
var ctrl_key_down = false;
$(document).on('keyup keydown', event => {
    shift_key_down = event.shiftKey;
    ctrl_key_down = event.ctrlKey;
});