// puzzle_page.js

var gl = undefined;
var puzzle = undefined;
var shader_program = undefined;

class PuzzleMesh extends StaticTriangleMesh {
    constructor() {
        super();
        this.color = vec3.create();
        this.transform = mat4.create();
    }
    
    render() {
        let color_loc = gl.getUniformLocation(shader_program.program, 'color');
        gl.uniform3fv(color_loc, this.color);
        
        // TODO: Set transform uniform here when we're ready for that part.
        
        let vertex_loc = gl.getUniformLocation(shader_program.program, 'vertex');
        
        super.render(vertex_loc);
    }
}

class Puzzle {
    constructor(puzzle_name) {
        this.puzzle_name = puzzle_name;
        this.mesh_list = [];
        this.orient_matrix = mat4.create();
    }
    
    release() {
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
                            let mesh = new PuzzleMesh();
                            vec3.set(mesh.color,
                                mesh_data['color']['x'],
                                mesh_data['color']['y'],
                                mesh_data['color']['z']
                            );
                            mesh.generate(mesh_data.triangle_list, mesh_data.vertex_list);
                            this.mesh_list.push(mesh);
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
        for(let i = 0; i < this.mesh_list.length; i++) {
            let mesh = this.mesh_list[i];
            mesh.render();
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

        let x = -1.0 + 2.0 * event.offsetX / canvas.width;
        let y = -1.0 + 2.0 * (1.0 - event.offsetY / canvas.height);

        let transform_matrix = calc_transform_matrix(canvas);

        // Transform pick points into projection space, then measure
        // there against mouse point.

        //...
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
    
    gl.useProgram(shader_program.program);
    
    let transform_matrix = calc_transform_matrix(canvas);
    let transform_matrix_loc = gl.getUniformLocation(shader_program.program, 'transform_matrix');
    gl.uniformMatrix4fv(transform_matrix_loc, false, transform_matrix);
    
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