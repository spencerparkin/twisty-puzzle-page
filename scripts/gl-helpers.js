// gl-helpers.js

class ShaderProgram {
    constructor(vert_shader_source, frag_shader_source) {
        this.vert_shader_source = vert_shader_source;
        this.frag_shader_source = frag_shader_source;
        this.program = undefined;
    }
    
    release() {
        if(this.program) {
            gl.deleteProgram(this.program);
            this.program = undefined;
        }
    }
    
    promise() {
        return new Promise((resolve, reject) => {
            Promise.all([
                this._promise_shader(this.vert_shader_source, gl.VERTEX_SHADER),
                this._promise_shader(this.frag_shader_source, gl.FRAGMENT_SHADER)
            ]).then(results => {
                let vert_shader = results[0];
                let frag_shader = results[1];
                this.release();
                this.program = gl.createProgram();
                gl.attachShader(this.program, vert_shader);
                gl.attachShader(this.program, frag_shader);
                gl.linkProgram(this.program);
                if(!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
                    let error = gl.getProgramInfoLog(this.program);
                    gl.deleteProgram(this.program);
                    alert('Error: ' + error.toString());
                    reject();
                } else {
                    resolve(this);
                }
            });
        });
    }
    
    _promise_shader(source, type) {
        return new Promise((resolve, reject) => {
            $.get(source, text => {
                let shader = gl.createShader(type);
                gl.shaderSource(shader, text);
                gl.compileShader(shader);
                if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    let error = gl.getShaderInfoLog(shader);
                    gl.deleteShader(shader);
                    alert('Error: ' + error.toString());
                    reject();
                } else {
                    resolve(shader);
                }
            });
        });
    }
}

class Texture {
    constructor(source) {
        this.source = source;
        this.tex = undefined;
    }
    
    release() {
        if(this.tex) {
            gl.deleteTexture(this.tex);
            this.tex = undefined;
        }
    }
    
    promise() {
        return new Promise((resolve, reject) => {
            let image = new Image();
            image.onload = () => {
                this.release();
                this.tex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, this.tex);
                this.setup(image);
                resolve();
            }
            image.onerror = error => {
                reject(error);
            }
            image.src = this.source;
        });
    }
    
    setup(image) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }
    
    bind() {
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
    }
}

// TODO: What about texture coordinates?  What about lighting normals?
class StaticTriangleMesh {
    constructor() {
        this.index_buffer = undefined;
        this.vertex_buffer = undefined;
        this.triangle_list = [];
        this.vertex_list = [];
    }
    
    release() {
        if(this.index_buffer) {
            gl.deleteBuffer(this.index_buffer);
            this.index_buffer = undefined;
        }
        if(this.vertex_buffer) {
            gl.deleteBuffer(this.vertex_buffer);
            this.vertex_buffer = undefined;
        }
        this.triangle_list = [];
        this.vertex_list = [];
    }
    
    generate(triangle_list, vertex_list) {
        this.release();
        
        this.triangle_list = triangle_list;
        this.vertex_list = vertex_list;
        
        this.index_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.index_buffer);
        
        let index_list = [];
        for(let i = 0; i < triangle_list.length; i++) {
            for(let j = 0; j < 3; j++) {
                index_list.push(triangle_list[i][j]);
            }
        }
        
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index_list), gl.STATIC_DRAW);
        
        this.vertex_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
        
        let vertex_buffer_list = [];
        for(let i = 0; i < vertex_list.length; i++) {
            let vertex = vertex_list[i];
            vertex_buffer_list.push(vertex['x']);
            vertex_buffer_list.push(vertex['y']);
            vertex_buffer_list.push(vertex['z']);
        }
        
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertex_buffer_list), gl.STATIC_DRAW);
    }
    
    render(vertex_loc) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex_buffer);
        gl.vertexAttribPointer(vertex_loc, 3, gl.FLOAT, false, 8, 0);
        gl.enableVertexAttribArray(vertex_loc);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.index_buffer);
        gl.drawElements(gl.TRIANGLES, this.triangle_list.length * 3, gl.UNSIGNED_SHORT, 0);
    }
}