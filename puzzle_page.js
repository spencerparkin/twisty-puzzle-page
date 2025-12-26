// puzzle_page.js

var gl = undefined;
var puzzle = undefined;
var puzzle_menu = new PuzzleMenu();
var puzzle_sequence_generator = new PuzzleSequenceMoveGenerator();
var puzzle_shader = undefined;
var puzzle_texture_list = [];
var frames_per_second = 60.0;
var blendFactor = 0.0;
var viewModel = undefined;

// TODO: Should be able to support decal layer textures for each puzzle.  These overlay any default or override textures, and are used for logos.
// TODO: Add lighting checkbox.  Not sure if we'll ever care to light the puzzle, actually.
// TODO: Add label freeze feature.  Axis labels should still render at the location of the axes, but the labels should change dynamically as you rotate the puzzle.

// Note that knockout's dependency graph requires computed members to
// call one or more observable functions.  This is how knockout builds
// its dependency graph.
var ViewModel = function() {
    this.sequence_text = ko.observable('');
    this.apply_textures = ko.observable(false);
    this.show_reflection = ko.observable(false);
    this.show_axis_labels = ko.observable(false);
    this.freeze_axis_labels = ko.observable(false);
    this.move_queue = ko.observableArray([]);
    this.undo_move_list = ko.observableArray([]);
    this.redo_move_list = ko.observableArray([]);
    
    this.executeSequenceClicked = function() {
        let move_sequence = puzzle_sequence_generator.generate_move_sequence(this.sequence_text(), puzzle);
        for(let i = 0; i < move_sequence.length; i++)
            this.move_queue.push(move_sequence[i].clone());
        this.clear_redo_list();
    }

    this.helpClicked = function() {
        window.open('puzzle_help.html', '_blank');
    }
    
    this.undoClicked = function() {
        let move = this.undo_move_list.pop();
        move.invert();
        move.for_what = 'future';
        this.move_queue.push(move);
    }
    
    this.redoClicked = function() {
        let move = this.redo_move_list.shift();
        move.invert();
        move.for_what = 'history';
        this.move_queue.push(move);
    }
    
    this.process_move_queue = function() {
        if(this.move_queue().length > 0) {
            
            let move = this.move_queue.shift();
            if(move.apply()) {
                if(move.for_what == 'history')
                    this.undo_move_list.push(move);
                else if(move.for_what == 'future')
                    this.redo_move_list.unshift(move);
            }
                
            return true;
        } else {
            return false;
        }
    }
    
    this.clear_redo_list = function() {
        while(this.redo_move_list().length > 0)
            this.redo_move_list.pop();
    }
    
    this.clear_undo_list = function() {
        while(this.undo_move_list().length > 0)
            this.undo_move_list.pop();
    }
    
    this.clear_move_queue = function() {
        while(this.move_queue().length > 0)
            this.move_queue.pop();
    }
    
    this.clear_all = function() {
        this.clear_redo_list();
        this.clear_undo_list();
        this.clear_move_queue();
    }
    
    this.grab_saved_state_map = function() {
        let saved_state_map = {};
        let saved_state_map_str = localStorage.getItem(puzzle.name);
        if(saved_state_map_str)
            saved_state_map = JSON.parse(saved_state_map_str);
        return saved_state_map;
    }
    
    this.saveClicked = function() {
        name = prompt('Save current puzzle state under what name?', '');
        if(name) {
            let saved_state_map = this.grab_saved_state_map();
            if(!(name in saved_state_map) || confirm('Overwrite existing state?')) {
                // TODO: Also save undo/redo history?
                saved_state_map[name] = puzzle.get_permutation_state();
                saved_state_map_str = JSON.stringify(saved_state_map);
                localStorage.setItem(puzzle.name, saved_state_map_str);
            }
        }
    }
    
    this.restoreClicked = function() {
        name = prompt('Load puzzle state using what name?', '');
        if(name !== 'null') {
            let saved_state_map = this.grab_saved_state_map();
            if(!(name in saved_state_map)) {
                alert('There is no puzzle state under the name "' + name + '" for the puzzle type in question.');
            } else {
                try {
                    puzzle.set_permutation_state(saved_state_map[name]);
                    render_scene();
                } catch(error) {
                    alert('Error: ' + error);
                }
            }
        }
    }
}

function random_int(min_int, max_int) {
    // This might not be perfectly uniform as it may be less likely to get min_int or max_int than anything inbetween.
    return Math.round(min_int + Math.random() * (max_int - min_int));
}

function shuffle_list(given_list) {
    for(let i = 0; i < given_list.length - 1; i++) {
        let j = random_int(i, given_list.length - 1);
        let t = given_list[i];
        given_list[i] = given_list[j];
        given_list[j] = t;
    }
}

function union_sets(set_list) {
    let result_set = new Set();
    for(let i = 0; i < set_list.length; i++) {
        let set = set_list[i];
        set.forEach(element => {
            if(!result_set.has(element))
                result_set.add(element);
        });
    }
    return result_set;
}

function intersect_sets(set_list) {
    let result_set = new Set();
    if(set_list.length > 0) {
        let set = set_list[0];
        set.forEach(element => {
            for(var i = 1; i < set_list.length; i++)
                if(!set_list[i].has(element))
                    break;
            if(i === set_list.length)
                result_set.add(element);
        });
    }
    return result_set;
}

function subtract_sets(set_list) {
    let result_set = new Set();
    if(set_list.length > 0) {
        let set = set_list[0];
        set.forEach(element => {
            for(var i = 1; i < set_list.length; i++)
                if(set_list[i].has(element))
                    break;
            if(i === set_list.length)
                result_set.add(element);
        });
    }
    return result_set;
}

function vec3_create(data) {
    let vec = vec3.create();
    if(data)
        vec3.set(vec, data.x, data.y, data.z);
    else
        vec = undefined;
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

function screen_space_to_projection_space(projection_point, screen_point) {
    let canvas = $('#puzzle_canvas')[0];
    projection_point[0] = -1.0 + 2.0 * screen_point[0] / canvas.width;
    projection_point[1] = -1.0 + 2.0 * (1.0 - screen_point[1] / canvas.height);
    projection_point[2] = screen_point[2];
}

function projection_space_to_screen_space(screen_point, projection_point) {
    let canvas = $('#puzzle_canvas')[0];
    screen_point[0] = ((projection_point[0] + 1.0) / 2.0) * canvas.width;
    screen_point[1] = (1.0 - (projection_point[1] + 1.0) / 2.0) * canvas.height;
    screen_point[2] = projection_point[2];
}

class PuzzleMesh extends StaticTriangleMesh {
    constructor(mesh_data) {
        super();
        this.border_length_list = [];
        this.border_vertex_buffer_list = [];
        this.generate(mesh_data.triangle_list, mesh_data.vertex_list, mesh_data.uv_list, mesh_data.normal_list, mesh_data.border_loop_list);
        this.texture_number = mesh_data.texture_number;
        this.color = vec3_create(mesh_data.color);
        this.alpha = mesh_data.alpha;
        this.center = vec3_create(mesh_data.center);
        this.permutation_transform = mat4.create(); // Takes the mesh from the solved state to the scrambled state.
        this.animation_center = vec3_create({x: 0.0, y: 0.0, z: 0.0});
        this.animation_axis = vec3_create({x: 1.0, y: 0.0, z: 0.0});
        this.animation_angle = 0.0;
        this.highlight = false;
        this.special_case_data = mesh_data.special_case_data;
        this.average_normal = vec3_create({x: 0.0, y: 0.0, z: 0.0});
        for(let i = 0; i < mesh_data.normal_list.length; i++)
            vec3.add(this.average_normal, this.average_normal, vec3_create(mesh_data.normal_list[i]));
        vec3.normalize(this.average_normal, this.average_normal);
    }

    release() {
        super.release();
        
        this.border_vertex_buffer_list.forEach(border_vertex_buffer => {
            gl.deleteBuffer(border_vertex_buffer);
        });
        
        this.border_vertex_buffer_list = [];
        this.border_length_list = [];
    }

    generate(triangle_list, vertex_list, uv_list, normal_list, border_loop_list) {
        super.generate(triangle_list, vertex_list, uv_list, normal_list);
        
        border_loop_list.forEach(border_loop => {
            if(border_loop.length > 2) {
                let border_vertex_list = [];
                for(let i = 0; i < border_loop.length; i++) {
                    let vertex = vertex_list[border_loop[i]];
                    border_vertex_list.push(vertex.x);
                    border_vertex_list.push(vertex.y);
                    border_vertex_list.push(vertex.z);
                }
                
                let border_vertex_buffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, border_vertex_buffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(border_vertex_list), gl.STATIC_DRAW);
                this.border_vertex_buffer_list.push(border_vertex_buffer);
                this.border_length_list.push(border_loop.length);
            }
        });
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

    render(custom_texture_list) {

        if(this.alpha === 0.0)
            return;

        let blendFactor_loc = gl.getUniformLocation(puzzle_shader.program, 'blendFactor');
        gl.uniform1f(blendFactor_loc, blendFactor);

        let color_loc = gl.getUniformLocation(puzzle_shader.program, 'color');
        gl.uniform3fv(color_loc, this.color);
        
        if(this.texture_number !== undefined && this.texture_number >= 0) {
            let puzzle_texture;
            if(custom_texture_list.length > 0) {
                puzzle_texture = custom_texture_list[this.texture_number % custom_texture_list.length];
            } else {
                puzzle_texture = puzzle_texture_list[this.texture_number % puzzle_texture_list.length];
            }
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
        let normal_loc = gl.getAttribLocation(puzzle_shader.program, 'vertexNormals');
        
        // Go render the face.
        super.render(vertex_loc, uv_loc, normal_loc);
        
        // Now go render the face borders.
        gl.uniform3fv(color_loc, vec3_create({'x': 0.0, 'y': 0.0, 'z': 0.0}));
        gl.uniform1f(blendFactor_loc, 0.0);
        gl.uniform1f(highlightFactor_loc, 0.0);
        gl.enableVertexAttribArray(vertex_loc);
        gl.disableVertexAttribArray(uv_loc);
        gl.disableVertexAttribArray(normal_loc);
        this.border_vertex_buffer_list.forEach((border_vertex_buffer, i) => {            
            gl.bindBuffer(gl.ARRAY_BUFFER, border_vertex_buffer);
            gl.vertexAttribPointer(vertex_loc, 3, gl.FLOAT, false, 0, 0);
            gl.lineWidth(2.0);      // This apparently is not honored.
            gl.drawArrays(gl.LINE_LOOP, 0, this.border_length_list[i]);
        });
    }

    is_captured_by_generator(generator) {
        let transformed_center = vec3.create();
        vec3.transformMat4(transformed_center, this.center, this.permutation_transform);
        let side = generator.calc_side(transformed_center);
        return side === 'inside';
    }
    
    straddles_generator(generator, eps=1e-7) {
        let found_inside = false;
        let found_outside = false;
        for(let i = 0; i < this.vertex_list.length; i++) {
            let vertex = vec3_create(this.vertex_list[i]);
            vec3.transformMat4(vertex, vertex, this.permutation_transform);
            let side = generator.calc_side(vertex, eps);
            if(side === 'inside')
                found_inside = true;
            else if(side === 'outside')
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
        this.capture_tree_root = generator_data.capture_tree_root;
        this.center = vec3_create(generator_data.center);
        this.axis = vec3_create(generator_data.axis);
        this.angle = generator_data.angle;
        this.min_capture_count = generator_data.min_capture_count;
        this.max_capture_count = generator_data.max_capture_count;
        this.plane_list = [];
        for(let i = 0; i < generator_data.plane_list.length; i++) {
            let plane_data = generator_data.plane_list[i];
            let center = vec3_create(plane_data.center);
            let unit_normal = vec3_create(plane_data.unit_normal);
            let plane = {'center': center, 'unit_normal': unit_normal}
            this.plane_list.push(plane);
        }
        this.special_case_data = 'special_case_data' in generator_data ? generator_data.special_case_data : undefined;
        this.fixed_label = generator_data.fixed_label;
        this.dynamic_label = undefined;
        this.frozen_world_point = vec3.create();
        $('<div id="puzzle_label_' + generator_data.fixed_label + '" class="puzzle_label">' + generator_data.fixed_label + '</div>').appendTo('#puzzle_axis_labels_container');
        let axis_label = $('#puzzle_label_' + this.fixed_label)[0];
        axis_label.addEventListener('wheel', this.axis_label_mouse_wheel_moved.bind(this));
        axis_label.addEventListener('click', this.axis_label_clicked.bind(this));
    }

    release() {
    }
    
    axis_label_mouse_wheel_moved(event) {
        canvas_mouse_wheel_move(event);
    }
    
    axis_label_clicked(event) {
        let sequence_text = viewModel.sequence_text();
        let label = this.fixed_label;
        if(shift_key_down)
            label += "'";
        if(!sequence_text)
            viewModel.sequence_text(label);
        else
            viewModel.sequence_text(sequence_text + ',' + label);
    }
    
    show_axis_label(visible) {
        let axis_label = $('#puzzle_label_' + this.fixed_label);
        if(visible)
            axis_label.fadeIn('slow');
        else
            axis_label.fadeOut('slow');
    }
    
    update_axis_label_for_rendering(transform_matrix) {
        if(this.pick_point) {
            let projected_point = vec3.create();
            vec3.transformMat4(projected_point, this.pick_point, transform_matrix);
            projected_point[2] = 0.0;
            
            let screen_point = vec3.create();
            projection_space_to_screen_space(screen_point, projected_point);
            
            let axis_label = $('#puzzle_label_' + this.fixed_label)[0];
            axis_label.style.left = Math.round(screen_point[0] - axis_label.offsetWidth / 2.0) + 'px';
            axis_label.style.top = Math.round(screen_point[1] - axis_label.offsetHeight / 2.0) + 'px';
            
            if(!viewModel.freeze_axis_labels()) {
                axis_label.innerHTML = this.fixed_label;
            } else {
                axis_label.innerHTML = this.dynamic_label;
            }
        }
    }
    
    freeze_axis_label(transform_matrix) {
        if(this.pick_point)
            vec3.transformMat4(this.frozen_world_point, this.pick_point, transform_matrix);
    }
    
    unfreeze_axis_label() {
        this.frozen_world_point = vec3.create();
        this.dynamic_label = undefined;
    }
    
    calc_side(point, eps=1e-7) {
        let vec = vec3.create();
        let largest_distance = -99999.0;
        for(let i = 0; i < this.plane_list.length; i++) {
            let plane = this.plane_list[i];
            vec3.subtract(vec, point, plane.center);
            let distance = vec3.dot(vec, plane.unit_normal);
            if(distance > largest_distance)
                largest_distance = distance;
        }
        if(largest_distance < -eps)
            return 'inside';
        if(largest_distance > eps)
            return 'outside';
        return 'neither';
    }
}

class PuzzleMove {
    constructor(generator, inverse, override_angle=undefined, for_what=undefined) {
        this.generator = generator;
        this.inverse = inverse;
        this.override_angle = override_angle;
        this.for_what = for_what;
    }

    apply() {
        if(puzzle.bandages) {
            if(puzzle.move_constrained(this))
                return false;
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
        
        return true;
    }
    
    invert() {
        this.inverse = !this.inverse;
    }
    
    clone() {
        return new PuzzleMove(this.generator, this.inverse, this.override_angle, this.for_what);
    }
}

class Puzzle {
    constructor(puzzle_name) {
        this.name = puzzle_name;
        this.mesh_list = [];
        this.generator_list = [];
        this.orient_matrix = mat4.create();
        this.selected_generator = -1;
        this.bandages = false;
        this.custom_texture_list = [];
    }
    
    get_permutation_state() {
        let permutation_list = [];
        for(let i = 0; i < this.mesh_list.length; i++) {
            let mesh = this.mesh_list[i];
            let matrix_array = [];
            for(let j = 0; j < 16; j++)
                matrix_array.push(mesh.permutation_transform[j]);
            permutation_list.push(matrix_array);
        }
        return permutation_list;
    }
    
    set_permutation_state(permutation_list) {
        for(let i = 0; i < this.mesh_list.length; i++) {
            let mesh = this.mesh_list[i];
            let matrix_array = permutation_list[i];
            for(let j = 0; j < 16; j++)
                mesh.permutation_transform[j] = matrix_array[j];
        }
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
        
        for(let i = 0; i < this.custom_texture_list.length; i++) {
            let texture = this.custom_texture_list[i];
            texture.release();
        }
        this.custom_texture_list = [];
        
        $('#puzzle_axis_labels_container').empty();
    }
    
    promise() {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: 'puzzle',
                data: {'name': this.name},
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
                        let custom_texture_promise_list = [];
                        let custom_texture_path_list = puzzle_data['custom_texture_path_list'];
                        if(Array.isArray(custom_texture_path_list)) {
                            for(let i = 0; i < custom_texture_path_list.length; i++) {
                                this.custom_texture_list.push(new Texture(custom_texture_path_list[i]));
                                custom_texture_promise_list.push(this.custom_texture_list[i].promise());
                            }
                        }
                        Promise.all(custom_texture_promise_list).then(resolve);
                    }
                },
                error: function(request, status, error) {
                    alert('Error: ' + error);
                    reject();
                }
            });
        });
    }
    
    render(reflect) {
        gl.useProgram(puzzle_shader.program);

        let canvas = $('#puzzle_canvas')[0];
        let transform_matrix = calc_transform_matrix(canvas, reflect);
        let transform_matrix_loc = gl.getUniformLocation(puzzle_shader.program, 'transform_matrix');
        gl.uniformMatrix4fv(transform_matrix_loc, false, transform_matrix);

        for(let i = 0; i < this.mesh_list.length; i++) {
            let mesh = this.mesh_list[i];
            mesh.render(this.custom_texture_list);
        }
        
        if(!reflect && viewModel.show_axis_labels())
            this.update_axis_labels_for_rendering(transform_matrix);
    }

    update_axis_label_visibility() {
        let visible = viewModel.show_axis_labels();
        for(let i = 0; i < this.generator_list.length; i++)
            this.generator_list[i].show_axis_label(visible);
    }

    _find_best_dynamic_label_assignment(label_map, unassigned_generator_list) {
        let smallest_distance = 9999999.0;
        let found_label = undefined;
        let found_generator = undefined;
        for(let i = 0; i < unassigned_generator_list.length; i++) {
            let generator = unassigned_generator_list[i];
            let point = vec3.create();
            vec3.transformMat4(point, generator.pick_point, this.orient_matrix);
            for(let label in label_map) {
                let frozen_world_point = label_map[label];
                let distance = vec3.distance(point, frozen_world_point);
                if(distance < smallest_distance) {
                    smallest_distance = distance;
                    found_label = label;
                    found_generator = generator;
                }
            }
        }
        delete label_map[found_label];
        let i = unassigned_generator_list.indexOf(found_generator);
        unassigned_generator_list.splice(i, 1);
        found_generator.dynamic_label = found_label;
    }

    update_axis_labels_for_rendering(transform_matrix) {
        if(viewModel.freeze_axis_labels()) { 
            let label_map = {};
            let unassigned_generator_list = [];
            for(let i = 0; i < this.generator_list.length; i++) {
                let generator = this.generator_list[i];
                if(generator.pick_point) {
                    label_map[generator.fixed_label] = generator.frozen_world_point;
                    unassigned_generator_list.push(generator);
                }
            }
            while(Object.keys(label_map).length > 0 && unassigned_generator_list.length > 0)
                this._find_best_dynamic_label_assignment(label_map, unassigned_generator_list);
        }
        for(let i = 0; i < this.generator_list.length; i++)
            this.generator_list[i].update_axis_label_for_rendering(transform_matrix);
    }

    freeze_axis_labels() {
        for(let i = 0; i < this.generator_list.length; i++)
            this.generator_list[i].freeze_axis_label(this.orient_matrix);
    }
    
    unfreeze_axis_labels() {
        for(let i = 0; i < this.generator_list.length; i++)
            this.generator_list[i].unfreeze_axis_label();
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
        
        return new PuzzleMove(generator, false, undefined, 'history');
    }
    
    create_move_for_notation(label) {
        for(let i = 0; i < this.generator_list.length; i++) {
            let generator = this.generator_list[i];
            let found = false;
            if(viewModel.freeze_axis_labels() && generator.dynamic_label === label)
                found = true;
            if(!viewModel.freeze_axis_labels() && generator.fixed_label === label)
                found = true;
            if(found)
                return new PuzzleMove(generator, false, undefined, 'history');
        }
        return undefined;
    }

    pick_generator(projected_mouse_point) {
        let canvas = $('#puzzle_canvas')[0];
        let transform_matrix = calc_transform_matrix(canvas);

        let min_distance = 0.3;
        let j = -1;
        for(let i = 0; i < this.generator_list.length; i++) {
            let generator = this.generator_list[i];
            if(generator.pick_point) {
                let projected_center = vec3.create();
                vec3.transformMat4(projected_center, generator.pick_point, transform_matrix);
    
                projected_center[2] = 0.0;
    
                let distance = vec3.distance(projected_center, projected_mouse_point);
                if(distance < min_distance) {
                    min_distance = distance;
                    j = i;
                }
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
            if(this.bandages) {
                let move = new PuzzleMove(generator, false, undefined, undefined);
                let move_inverse = new PuzzleMove(generator, true, undefined, undefined);
                if(this.move_constrained(move) && this.move_constrained(move_inverse))
                    return;
            }
            
            this.for_captured_meshes(generator, mesh => {
                mesh.highlight = true;
            });
        }
    }

    for_captured_meshes(generator, func) {
        if(generator.capture_tree_root) {
            let captured_mesh_set = this.execute_capture_tree(generator.capture_tree_root);
            captured_mesh_set.forEach(func);
        } else if(this.name === 'WormHoleII') {
            this._for_wormhole_capture_meshes(generator, func);
        } else {
            this._for_captured_meshes_internal(generator, func);
        }
    }
    
    _for_wormhole_capture_meshes(generator, func) {
        let captured_mesh_set = new Set();
        this._for_captured_meshes_internal(generator, mesh => {
            captured_mesh_set.add(mesh);
        });
        let capture_core_too = false;
        captured_mesh_set.forEach(mesh => {
            if(mesh.triangle_list.length === 1)
                capture_core_too = true;
        });
        if(capture_core_too) {
            let i = this.generator_list.length - 3;
            let core_generator_list = [this.generator_list[i], this.generator_list[i + 1], this.generator_list[i + 2]];
            let core_generator = core_generator_list.reduce((best_generator, cur_generator) => {
                let cur_dot = Math.abs(vec3.dot(generator.axis, cur_generator.axis));
                let best_dot = Math.abs(vec3.dot(generator.axis, best_generator.axis));
                if(Math.abs(cur_dot - 1.0) < Math.abs(best_dot - 1.0))
                    return cur_generator;
                return best_generator;
            });
            this._for_captured_meshes_internal(core_generator, mesh => {
                captured_mesh_set.add(mesh);
            });
        }
        captured_mesh_set.forEach(func);
    }
    
    _for_captured_meshes_internal(generator, func) {
        for(let i = 0; i < this.mesh_list.length; i++) {
            let mesh = this.mesh_list[i];
            if(mesh.is_captured_by_generator(generator)) {
                func(mesh);
            }
        }
    }

    execute_capture_tree(capture_tree_node) {
        let captured_mesh_set = new Set();
        if(capture_tree_node.op) {
            let child_captured_mesh_set_list = [];
            for(let i = 0; i < capture_tree_node.children.length; i++)
                child_captured_mesh_set_list.push(this.execute_capture_tree(capture_tree_node.children[i]));
            if(capture_tree_node.op === 'union') {
                captured_mesh_set = union_sets(child_captured_mesh_set_list);
            } else if(capture_tree_node.op === 'intersection') {
                captured_mesh_set = intersect_sets(child_captured_mesh_set_list);
            } else if(capture_tree_node.op === 'subtract') {
                captured_mesh_set = subtract_sets(child_captured_mesh_set_list);
            }
        } else if(typeof capture_tree_node.mesh === 'number') {
            let generator = this.generator_list[capture_tree_node.mesh];
            this._for_captured_meshes_internal(generator, mesh => {
                captured_mesh_set.add(mesh);
            });
        }
        return captured_mesh_set;
    }

    get_selected_generator() {
        if(this.selected_generator >= 0)
            return this.generator_list[this.selected_generator];
        return undefined;
    }

    move_constrained(move) {
        if(this.name === 'LatchCube') {
            if(move.for_what === 'future')
                return false;
            let eps = 1e-4;
            let black_count = 0;
            let white_count = 0;
            this.mesh_list.filter(mesh => {
                let normal = vec3.create();
                // We can get away with treating the normal as a point, because there is no translation in this case.
                // Also, we don't need the inverse transpose, because all permutations are orthogonal.
                vec3.transformMat4(normal, mesh.average_normal, mesh.permutation_transform);
                return Math.abs(vec3.dot(normal, move.generator.axis) - 1.0) < eps;
            }).forEach(mesh => {
                if(mesh.special_case_data.arrow === 'black')
                    black_count++;
                if(mesh.special_case_data.arrow === 'white')
                    white_count++;
            });
            if(black_count > 0 && white_count > 0)
                return true;
            if(black_count > 0 && !move.inverse)
                return true;
            if(white_count > 0 && move.inverse)
                return true;
        } else {
            let eps = 1e-7;
            if(this.name === 'PentacleCube')
                eps = 1e-1;
            else if(this.name === 'Bagua')
                eps = 1e-3;
            for(let i = 0; i < this.mesh_list.length; i++) {
                let mesh = this.mesh_list[i];
                if(mesh.straddles_generator(move.generator, eps))
                    return true;
            }
            if(typeof move.generator.min_capture_count === 'number' || typeof move.generator.max_capture_count === 'number') {
                let count = 0;
                this.for_captured_meshes(move.generator, () => {count++;});
                if(typeof move.generator.min_capture_count === 'number' && count < move.generator.min_capture_count)
                    return true;
                if(typeof move.generator.max_capture_count === 'number' && count > move.generator.max_capture_count)
                    return true;
            }
        }
        return false;
    }

    is_solved() {
        // This is not actually accurate in most cases, because there may be
        // more than one solved state of the puzzle, each indistinguishable
        // from the other.  All solved states would form the kernel of a homomorphism.
        // Also, consider the same rotation applied to all parts of the puzzle.
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
        } else {
            return viewModel.process_move_queue(); 
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
            } while(j === k || !this.generator_list[j].pick_point);
            k = j;
            let generator = this.generator_list[j];
            let inverse = Math.random() > 0.5 ? true : false;
            viewModel.move_queue.push(new PuzzleMove(generator, inverse, undefined, undefined));
        }
    }
}

function puzzle_animate_callback() {
    if(puzzle.advance_animation()) {

        frames_per_second = 60.0;   // TODO: Accurately compute this.

        render_scene();
    }
    
    puzzle_menu.update();
}

function puzzle_menu_item_chosen_callback(puzzle_name) {
    $('#loading_gif').show();
    puzzle.name = puzzle_name;
    puzzle.promise().then(() => {
        $('#loading_gif').hide();
        shuffle_list(puzzle_texture_list);
        viewModel.clear_all();
        viewModel.freeze_axis_labels(false);
        puzzle.update_axis_label_visibility();
        render_scene();
    });   
}

function canvas_mouse_wheel_move(event) {
    event.preventDefault();
    if(event.deltaY < 0) {
        handle_user_move(false);
    } else if(event.deltaY > 0) {
        handle_user_move(true);
    }
}

function handle_user_move(inverse) {
    let generator = puzzle.get_selected_generator();
    if(generator) {
        if((puzzle.name == 'CurvyCopter' || puzzle.name == 'CurvyCopterPlus' || puzzle.name == 'HelicopterCube' || puzzle.name == 'FlowerCopter') && (shift_key_down || ctrl_key_down) && generator.special_case_data) {
            curvy_copter_special_move(event, generator);
        } else {
            let move = new PuzzleMove(generator, inverse, undefined, 'history');
            viewModel.move_queue.push(move);
            viewModel.clear_redo_list();
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
    
    viewModel.move_queue.push(new PuzzleMove(generator_a, false, angle * scale, 'history'));
    viewModel.move_queue.push(new PuzzleMove(generator_b, false, angle * scale, 'history'));
    
    viewModel.move_queue.push(new PuzzleMove(generator, (event.deltaY > 0) ? true : false, undefined, 'history'));
    
    viewModel.move_queue.push(new PuzzleMove(generator_a, false, -angle * scale, 'history'));
    viewModel.move_queue.push(new PuzzleMove(generator_b, false, -angle * scale, 'history'));
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
        let mouse_point = vec3.create();
        vec3.set(mouse_point, event.offsetX, event.offsetY, 0.0);
        
        let projected_mouse_point = vec3.create();
        screen_space_to_projection_space(projected_mouse_point, mouse_point);

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
    dragging = false;
    event.preventDefault();
}

function calc_transform_matrix(canvas, reflect=false) {
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

    let reflection_matrix = mat4.create();
    if(reflect) {
        reflection_matrix[10] = -1.0;
    }

    let transform_matrix = mat4.create();
    mat4.multiply(transform_matrix, reflection_matrix, puzzle.orient_matrix);
    mat4.multiply(transform_matrix, view_matrix, transform_matrix);
    mat4.multiply(transform_matrix, proj_matrix, transform_matrix);

    return transform_matrix;
}

function render_scene() {
    let canvas = $('#puzzle_canvas')[0];
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    gl.cullFace(gl.BACK);
    puzzle.render(false);
    
    if(viewModel.show_reflection()) {
        gl.viewport(3 * canvas.width / 4, 0, canvas.width / 4, canvas.height / 4);
        gl.cullFace(gl.FRONT);
        puzzle.render(true);
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
	    gl.disable(gl.CULL_FACE);   // For shape-shifting puzzles, we need to render back-faces.
	    
	    $('#loading_gif').show();
	    
	    puzzle_menu.promise().then(initial_puzzle => {
	    
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
            
            Promise.all(promise_list).then(() => {
                $('#loading_gif').hide();
                
                puzzle_menu.callback = puzzle_menu_item_chosen_callback;
                
                shuffle_list(puzzle_texture_list);

                $(window).bind('resize', function() {
                    render_scene();
                });
    
                let canvas = $('#puzzle_canvas')[0];
    
                canvas.addEventListener('wheel', canvas_mouse_wheel_move);
                canvas.addEventListener('mousemove', canvas_mouse_move);
                canvas.addEventListener('mousedown', canvas_mouse_down);
                canvas.addEventListener('mouseup', canvas_mouse_up);
                canvas.addEventListener('dblclick', canvas_mouse_double_click);
    
                setInterval(puzzle_animate_callback, 10);
                
                viewModel = new ViewModel();
                ko.applyBindings(viewModel);
                
                viewModel.apply_textures.subscribe(function(newValue) {
                    blendFactor = newValue ? 1.0 : 0.0;
                    render_scene();
                });
                
                viewModel.show_reflection.subscribe(function(newValue) {
                    render_scene();
                });
                
                viewModel.show_axis_labels.subscribe(function(newValue) {
                    puzzle.update_axis_label_visibility();
                    render_scene();
                });
                
                viewModel.freeze_axis_labels.subscribe(function(newValue) {
                    if(newValue)
                        puzzle.freeze_axis_labels();
                    else
                        puzzle.unfreeze_axis_labels();
                    render_scene();
                });
                
                render_scene();
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

$(document).on('keypress', event => {
    let key = event.which;
    if(key === 'A'.charCodeAt(0) || key === 'a'.charCodeAt(0)) {
        handle_user_move(true);
    } else if(key === 'F'.charCodeAt(0) || key === 'f'.charCodeAt(0)) {
        handle_user_move(false);
    }
});