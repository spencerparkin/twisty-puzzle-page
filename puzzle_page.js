// puzzle_page.js

var gl = undefined;
var puzzle = undefined;
var shader_program = undefined;

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
        this.transform = mat4.create();
        this.captured = false;
    }
    
    render() {

        let color_loc = gl.getUniformLocation(shader_program.program, 'color');

        if(this.captured) {
            let highlight_color = vec3.create();
            vec3.set(highlight_color, 1.0, 1.0, 1.0);
            vec3.add(highlight_color, this.color, highlight_color);
            vec3.scale(highlight_color, highlight_color, 0.5);
            gl.uniform3fv(color_loc, highlight_color);
        } else {
            gl.uniform3fv(color_loc, this.color);
        }

        // TODO: Set transform uniform here when we're ready for that part.
        
        let vertex_loc = gl.getUniformLocation(shader_program.program, 'vertex');
        
        super.render(vertex_loc);
    }

    is_captured_by_generator(generator) {
        let vec = vec3.create();
        for(let i = 0; i < generator.plane_list.length; i++) {
            let plane = generator.plane_list[i];
            vec3.subtract(vec, this.center, plane.center);
            let distance = vec3.dot(vec, plane.unit_normal);
            if(distance >= 0.0)
                return false;
        }
        return true;
    }
}

class PuzzleGenerator {
    constructor(generator_data) {
        this.pick_point = vec3_create(generator_data.pick_point);
        this.plane_list = [];
        for(let i = 0; i < generator_data.plane_list.length; i++) {
            let plane_data = generator_data.plane_list[i];
            let center = vec3_create(plane_data.center);
            let unit_normal = vec3_create(plane_data.unit_normal);
            let plane = {'center': center, 'unit_normal': unit_normal}
            this.plane_list.push(plane);
        }
    }

    release() {
    }
}

class Puzzle {
    constructor(puzzle_name) {
        this.puzzle_name = puzzle_name;
        this.mesh_list = [];
        this.generator_list = [];
        this.orient_matrix = mat4.create();
        this.selected_generator = -1;
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
    }
    
    promise() {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: 'puzzles/' + this.puzzle_name + '.json',
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

        //console.log('min_distance = ' + min_distance.toString());

        if(this.selected_generator != j) {
            this.selected_generator = j;
            this.determine_captured_meshes();
            return true;
        } else {
            return false;
        }
    }

    determine_captured_meshes() {
        if(this.selected_generator >= 0) {
            // Generator meshes are always convex shapes, so here, the captured
            // meshes are all those whose centers lie on the back of every generator plane.
            let generator = this.generator_list[this.selected_generator];
            for(let i = 0; i < this.mesh_list.length; i++) {
                let mesh = this.mesh_list[i];
                mesh.captured = mesh.is_captured_by_generator(generator);
            }
        } else {
            // No generator is selected, so no meshes are captured.
            for(let i = 0; i < this.mesh_list.length; i++) {
                let mesh = this.mesh_list[i];
                mesh.captured = false;
            }
        }
    }
}

function canvas_mouse_wheel_move(event) {
    //...
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

        let x = -1.0 + 2.0 * (1.0 - event.offsetX / canvas.width);
        let y = -1.0 + 2.0 * event.offsetY / canvas.height;

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
	    
	    puzzle = new Puzzle('RubiksCube');
	    shader_program = new ShaderProgram('shaders/puzzle_vert_shader.txt', 'shaders/puzzle_frag_shader.txt');
	    
	    Promise.all([
	        shader_program.promise(),
	        puzzle.promise()
	    ]).then(() => {
	        $(window).bind('resize', function() {
	            render_scene();
	        });

            let canvas = $('#puzzle_canvas')[0];

            canvas.addEventListener('wheel', canvas_mouse_wheel_move);
            canvas.addEventListener('mousemove', canvas_mouse_move);
            canvas.addEventListener('mousedown', event => {canvas_mouse_down(event);});
            canvas.addEventListener('mouseup', canvas_mouse_up);

	        render_scene();
	    });
        
    } catch(error) {
        alert('Error: ' + error.toString());
    }
}

$(document).ready(document_ready);