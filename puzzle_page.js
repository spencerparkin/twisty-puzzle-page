// puzzle_page.js

var gl = undefined;
var puzzle = undefined;
var puzzle_sequence_generator = new PuzzleSequenceMoveGenerator();
var puzzle_shader = undefined;
var puzzle_texture_list = [];
var frames_per_second = 60.0;
var blendFactor = 1.0;

function vec3_create(data) {
    let vec = vec3.create();
    if(data)
        vec3.set(vec, data.x, data.y, data.z);
    else
        vec3.set(vec, 0.0, 0.0, 0.0);
    return vec;
}

function mat4_rotate_about_center(result, center, axis, angle) {
    let neg_center = vec3.create();
    vec3.negate(neg_center, center);

    let translation_matrix = mat4.create();
    mat4.fromTranslation(translation_matrix, center);

    let inv_translation_matrix = mat4.create();
    mat4.fromTranslation(inv_translation_matrix, neg_center);

    let rotation_matrix = mat4.create();
    mat4.fromRotation(rotation_matrix, angle, axis);

    mat4.multiply(result, rotation_matrix, inv_translation_matrix);
    mat4.multiply(result, translation_matrix, result);
}

class PuzzleMesh extends StaticTriangleMesh {
    constructor(mesh_data) {
        super();
        this.generate(mesh_data.triangle_list, mesh_data.vertex_list, mesh_data.uv_list);
        this.texture_number = mesh_data.texture_number;
        this.color = vec3_create(mesh_data.color);
        this.center = vec3_create(mesh_data.center);
        this.permutation_transform = mat4.create(); // Takes the mesh from the solved state to the scrambled state.
        this.animation_center = vec3_create({x: 0.0, y: 0.0, z: 0.0});
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

        let color_loc = gl.getUniformLocation(puzzle_shader.program, 'color');
        gl.uniform3fv(color_loc, this.color);
        
        if(this.texture_number !== undefined) {
            let i = this.texture_number % puzzle_texture_list.length;
            let puzzle_texture = puzzle_texture_list[i];
            let sampler_loc = gl.getUniformLocation(puzzle_shader.program, 'texture');        
            puzzle_texture.bind(sampler_loc);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, undefined);
        }
        
        let highlightFactor_loc = gl.getUniformLocation(puzzle_shader.program, 'highlightFactor');
        let highlightFactor = this.highlight ? 0.5 : 0.0;
        gl.uniform1f(highlightFactor_loc, highlightFactor);

        let permutation_transform_matrix_loc = gl.getUniformLocation(puzzle_shader.program, 'permutation_transform_matrix');
        gl.uniformMatrix4fv(permutation_transform_matrix_loc, false, this.permutation_transform);

        let animation_transform = mat4.create();
        if(this.animation_angle != 0.0)
            mat4_rotate_about_center(animation_transform, this.animation_center, this.animation_axis, this.animation_angle);

        let animation_transform_matrix_loc = gl.getUniformLocation(puzzle_shader.program, 'animation_transform_matrix');
        gl.uniformMatrix4fv(animation_transform_matrix_loc, false, animation_transform);

        let vertex_loc = gl.getAttribLocation(puzzle_shader.program, 'vertex');
        let uv_loc = gl.getAttribLocation(puzzle_shader.program, 'vertexUVs');
        
        super.render(vertex_loc, uv_loc);
    }

    is_captured_by_generator(generator) {
        let transformed_center = vec3.create();
        vec3.transformMat4(transformed_center, this.center, this.permutation_transform);
        return generator.contains_point(transformed_center);
    }
    
    straddled_by_generator(generator) {
        let found_inside = false;
        let found_outside = false;
        for(let i = 0; i < this.vertex_list.length; i++) {
            let vertex = vec3_create(this.vertex_list[i]);
            vec3.transformMat4(vertex, vertex, this.permutation_transform);
            if(generator.contains_point(vertex))
                found_inside = true;
            else
                found_outside = true;
            if(found_inside && found_outside)
                return true;
        }
        return false;
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
        this.center = vec3_create(generator_data.center);
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
    
    contains_point(point) {
        let vec = vec3.create();
        for(let i = 0; i < this.plane_list.length; i++) {
            let plane = this.plane_list[i];
            vec3.subtract(vec, point, plane.center);
            let distance = vec3.dot(vec, plane.unit_normal);
            if(distance >= 0.0)
                return false;
        }
        return true;
    }
}

class PuzzleMove {
    constructor(generator, inverse, override_angle=undefined) {
        this.generator = generator;
        this.inverse = inverse;
        this.override_angle = override_angle;
    }

    apply() {
        if(puzzle.bandages) {
            if(puzzle.generator_constrained(this.generator))
                return;
        }
        
        let angle = this.override_angle ? this.override_angle : this.generator.angle;
        
        let permutation_transform = mat4.create();
        mat4_rotate_about_center(permutation_transform, this.generator.center, this.generator.axis, this.inverse ? angle : -angle);

        // The puzzle must not be animating at this moment for this to work.
        puzzle.for_captured_meshes(this.generator, mesh => {
            mat4.multiply(mesh.permutation_transform, permutation_transform, mesh.permutation_transform);
            vec3.copy(mesh.animation_center, this.generator.center);
            vec3.copy(mesh.animation_axis, this.generator.axis);
            mesh.animation_angle = this.inverse ? -angle : angle;
        });
    }
    
    clone() {
        return new PuzzleMove(this.generator, this.inverse, this.override_angle);
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
        this.bandages = false;
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
                        this.bandages = puzzle_data.bandages || false;
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
        gl.useProgram(puzzle_shader.program);

        let blendFactor_loc = gl.getUniformLocation(puzzle_shader.program, 'blendFactor');
        gl.uniform1f(blendFactor_loc, blendFactor);

        let canvas = $('#puzzle_canvas')[0];
        let transform_matrix = calc_transform_matrix(canvas);
        let transform_matrix_loc = gl.getUniformLocation(puzzle_shader.program, 'transform_matrix');
        gl.uniformMatrix4fv(transform_matrix_loc, false, transform_matrix);

        for(let i = 0; i < this.mesh_list.length; i++) {
            let mesh = this.mesh_list[i];
            mesh.render();
        }
    }

    create_move_for_viewer_axis(axis) {
        vec3.normalize(axis, axis);
        let inv_orient_matrix = mat4.create();
        mat4.invert(inv_orient_matrix, this.orient_matrix);
        vec3.transformMat4(axis, axis, inv_orient_matrix);
        
        let generator = this.generator_list.reduce((gen_a, gen_b) => {
            let dot_a = vec3.dot(gen_a.axis, axis);
            let dot_b = vec3.dot(gen_b.axis, axis);
            return (Math.abs(dot_a - 1.0) < Math.abs(dot_b - 1.0)) ? gen_a : gen_b;
        });
        
        return new PuzzleMove(generator, false);
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

    generator_constrained(generator) {
        for(let i = 0; i < this.mesh_list.length; i++) {
            let mesh = this.mesh_list[i];
            if(mesh.straddled_by_generator(generator))
                return true;
        }
        return false;
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
    
    scramble() {
        // TODO: Note that some puzzles are not trivial to scramble.  You sometimes have to stick
        //       to scrambling a sub-group of the puzzle before you make random moves in the entire group.
        // TODO: This doesn't perform the CurvyCopter's special move.
        let k = -1;
        for(let i = 0; i < 100; i++) {
            let j;
            do {
                j = Math.round(Math.random() * (this.generator_list.length - 1));
            } while(j === k);
            k = j;
            let generator = this.generator_list[j];
            let inverse = Math.random() > 0.5 ? true : false;
            this.move_queue.push(new PuzzleMove(generator, inverse));
        }
    }
}

function puzzle_animate_callback() {
    if(puzzle.advance_animation()) {

        frames_per_second = 60.0;   // TODO: Accurately compute this.

        render_scene();
    }
}

function canvas_mouse_wheel_move(event) {
    event.preventDefault();

    let generator = puzzle.get_selected_generator();
    if(generator) {
        if((puzzle.name == 'CurvyCopter' || puzzle.name == 'CurvyCopterPlus' || puzzle.name == 'HelicopterCube' || puzzle.name == 'FlowerCopter') && (shift_key_down || ctrl_key_down) && generator.special_case_data) {
            curvy_copter_special_move(event, generator);
        } else {
            let move = undefined;
    
            if(event.deltaY < 0) {
                move = new PuzzleMove(generator, false);
            } else if(event.deltaY > 0) {
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
    
    puzzle.move_queue.push(new PuzzleMove(generator_a, false, angle * scale));
    puzzle.move_queue.push(new PuzzleMove(generator_b, false, angle * scale));
    
    puzzle.move_queue.push(new PuzzleMove(generator, (event.deltaY > 0) ? true : false));
    
    puzzle.move_queue.push(new PuzzleMove(generator_a, false, -angle * scale));
    puzzle.move_queue.push(new PuzzleMove(generator_b, false, -angle * scale));
}

var dragging = false;

function canvas_mouse_move(event) {
    if(dragging) {
        let scale = Math.PI / 200.0;

        let x_angle_delta = scale * event.movementY;
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

function canvas_mouse_double_click(event) {
    if(confirm('Would you like to scramble the puzzle?')) {
        puzzle.scramble();
    }
}

function calc_transform_matrix(canvas) {
    let aspect_ratio = canvas.width / canvas.height;

    let proj_matrix = mat4.create();
    mat4.perspective(proj_matrix, 60.0 * Math.PI / 180.0, aspect_ratio, 1.0, null);

    let eye = vec3.create();
    vec3.set(eye, 0.0, 0.0, 5.0);

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
                    menu_item_icon.src = 'menu/' + menu_item + '.png';
                    menu_item_icon.classList.add('puzzle_icon');
                    menu_item_icon.addEventListener('click', () => {
                        menu_item_clicked(menu_item);
                    });
                    menu_item_icon.addEventListener('mouseover', () => {
                        menu_item_mouse_over(menu_item_icon, menu_item, i);
                    });
                    menu_item_icon.addEventListener('mouseout', () => {
                        menu_item_mouse_out();
                    });
                    puzzle_menu_div.appendChild(menu_item_icon);
                }
                puzzle_menu_div.addEventListener('mousemove', menu_mouse_move);
                puzzle_menu_div.addEventListener('mouseover', menu_mouse_over);
                puzzle_menu_div.addEventListener('mouseout', menu_mouse_out);
                setInterval(menu_animate, 10);
                menu_update();
                resolve('RubiksCube');
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
var puzzle_menu_item_hover = undefined;

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

function menu_item_mouse_over(menu_item_icon, menu_item, i) {
    let label = document.getElementById('puzzle_menu_label');
    label.style.display = 'block';
    label.innerHTML = menu_item;
    label.style.left = menu_item_icon.x + 'px';
    puzzle_menu_item_hover = menu_item_icon;
}

function menu_item_mouse_out() {
    let label = document.getElementById('puzzle_menu_label');
    label.style.display = 'none';
    puzzle_menu_item_hover = undefined;
}

function menu_update() {
    let puzzle_menu_div = document.getElementById('puzzle_menu');
    let label = document.getElementById('puzzle_menu_label');
    
    puzzle_menu_div.style.opacity = puzzle_menu_deploy;
    label.style.opacity = puzzle_menu_deploy;
    
    if(puzzle_menu_item_hover)
        label.style.left = puzzle_menu_item_hover.x + 'px'; 
    
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

function lerp_value(value_a, value_b, alpha, eps=1e-10) {
    let value = value_a + alpha * (value_b - value_a);
    if(Math.abs(value - value_b) < eps)
        value = value_b;
    return value;
}

function menu_animate() {
    if(puzzle_menu_scroll != puzzle_menu_scroll_target || puzzle_menu_deploy != puzzle_menu_deploy_target) {
        puzzle_menu_scroll = lerp_value(puzzle_menu_scroll, puzzle_menu_scroll_target, 0.05);
        puzzle_menu_deploy = lerp_value(puzzle_menu_deploy, puzzle_menu_deploy_target, 0.05);
        menu_update();
    }
}

function menu_item_clicked(menu_item) {
    $('#loading_gif').show();
    puzzle.name = menu_item;
    puzzle.promise().then(() => {
        render_scene();
        $('#loading_gif').hide();
    });
}

function sequence_input_key_down(event) {
    if(event.key === 'Enter') {
        let sequence_input = document.getElementById('puzzle_prompt_input');
        let sequence_text = sequence_input.value;
        let move_sequence = puzzle_sequence_generator.generate_move_sequence(sequence_text, puzzle);
        puzzle.move_queue = puzzle.move_queue.concat(move_sequence);
    }
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
            puzzle_shader = new ShaderProgram('shaders/puzzle_vert_shader.txt', 'shaders/puzzle_frag_shader.txt');
            
            let promise_list = [
                puzzle.promise(),
                puzzle_shader.promise()
            ];
            
            for(let i = 0; i < 19; i++) {
                let puzzle_texture = new Texture('images/face_texture_' + i.toString() + '.jpg');
                puzzle_texture_list.push(puzzle_texture);
                promise_list.push(puzzle_texture.promise());
            }

            $('#loading_gif').show();
            Promise.all(promise_list).then(() => {
                $('#loading_gif').hide();

                $(window).bind('resize', function() {
                    render_scene();
                    menu_update();
                });
    
                let canvas = $('#puzzle_canvas')[0];
    
                canvas.addEventListener('wheel', canvas_mouse_wheel_move);
                canvas.addEventListener('mousemove', canvas_mouse_move);
                canvas.addEventListener('mousedown', canvas_mouse_down);
                canvas.addEventListener('mouseup', canvas_mouse_up);
                canvas.addEventListener('dblclick', canvas_mouse_double_click);
    
                render_scene();
    
                setInterval(puzzle_animate_callback, 10);
                
                let sequence_input = document.getElementById('puzzle_prompt_input');
                sequence_input.addEventListener('keydown', sequence_input_key_down);
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