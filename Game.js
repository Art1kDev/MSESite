class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.gl = this.canvas.getContext('webgl');
        this.info = document.getElementById('info');
        
        if (!this.gl) {
            alert('WebGL не поддерживается');
            return;
        }
        
        this.running = true;
        this.lastTime = 0;
        this.fps = 0;
        this.worldSize = 32;
        
        this.init();
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    init() {
        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas.bind(this));
        
        this.setupWebGL();
        this.loadTextures();
        this.createWorld();
        this.setupPlayer();
        this.setupControls();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.updateProjectionMatrix();
    }
    
    setupWebGL() {
        const gl = this.gl;
        gl.clearColor(0.53, 0.81, 0.98, 1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        this.createShaders();
    }
    
    createShaders() {
        const gl = this.gl;
        
        const vsSource = `
            attribute vec3 aPosition;
            attribute vec2 aTexCoord;
            uniform mat4 uProjectionMatrix;
            uniform mat4 uModelViewMatrix;
            varying vec2 vTexCoord;
            void main() {
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
                vTexCoord = aTexCoord;
            }
        `;
        
        const fsSource = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uTexture;
            void main() {
                gl_FragColor = texture2D(uTexture, vTexCoord);
            }
        `;
        
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
        
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        
        this.attribLocations = {
            position: gl.getAttribLocation(this.program, 'aPosition'),
            texCoord: gl.getAttribLocation(this.program, 'aTexCoord')
        };
        
        this.uniformLocations = {
            projectionMatrix: gl.getUniformLocation(this.program, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(this.program, 'uModelViewMatrix'),
            texture: gl.getUniformLocation(this.program, 'uTexture')
        };
    }
    
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }
    
    loadTextures() {
        const gl = this.gl;
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        
        const size = 16;
        const pixels = new Uint8Array(size * size * 4);
        for (let i = 0; i < size * size; i++) {
            if (i < size * size / 2) {
                pixels[i * 4] = 34;
                pixels[i * 4 + 1] = 139;
                pixels[i * 4 + 2] = 34;
                pixels[i * 4 + 3] = 255;
            } else {
                pixels[i * 4] = 128;
                pixels[i * 4 + 1] = 128;
                pixels[i * 4 + 2] = 128;
                pixels[i * 4 + 3] = 255;
            }
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
        this.loadTexture('grass', 'grass.png');
        this.loadTexture('stone', 'stone.png');
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    
    loadTexture(name, url) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        const placeholder = new Uint8Array([255, 0, 255, 255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder);
        
        const image = new Image();
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_2D);
        };
        image.src = url;
        
        this[name + 'Texture'] = texture;
    }
    
    createWorld() {
        this.world = {};
        
        for (let x = 0; x < this.worldSize; x++) {
            for (let z = 0; z < this.worldSize; z++) {
                const height = Math.floor(this.worldSize / 2);
                for (let y = 0; y < height; y++) {
                    const type = y === height - 1 ? 'grass' : 'stone';
                    this.setBlock(x, y, z, type);
                }
            }
        }
        
        for (let i = 0; i < 100; i++) {
            const x = Math.floor(Math.random() * this.worldSize);
            const y = Math.floor(Math.random() * this.worldSize / 2) + this.worldSize / 4;
            const z = Math.floor(Math.random() * this.worldSize);
            
            if (this.getBlock(x, y, z)) continue;
            this.setBlock(x, y, z, Math.random() > 0.5 ? 'grass' : 'stone');
        }
        
        this.createWorldMesh();
    }
    
    setBlock(x, y, z, type) {
        this.world[`${x},${y},${z}`] = type;
    }
    
    getBlock(x, y, z) {
        return this.world[`${x},${y},${z}`];
    }
    
    createWorldMesh() {
        const gl = this.gl;
        
        this.vertexBuffer = gl.createBuffer();
        this.texCoordBuffer = gl.createBuffer();
        this.indexBuffer = gl.createBuffer();
        
        const vertices = [];
        const texCoords = [];
        const indices = [];
        let index = 0;
        
        for (const key in this.world) {
            const [x, y, z] = key.split(',').map(Number);
            const type = this.world[key];
            
            const renderTop = !this.getBlock(x, y + 1, z);
            const renderBottom = !this.getBlock(x, y - 1, z);
            const renderFront = !this.getBlock(x, y, z - 1);
            const renderBack = !this.getBlock(x, y, z + 1);
            const renderLeft = !this.getBlock(x - 1, y, z);
            const renderRight = !this.getBlock(x + 1, y, z);
            
            const texU = type === 'grass' ? 0 : 0.5;
            const texV = 0;
            const texSize = 0.5;
            
            const minX = x, maxX = x + 1;
            const minY = y, maxY = y + 1;
            const minZ = z, maxZ = z + 1;
            
            if (renderTop) {
                vertices.push(
                    minX, maxY, minZ,
                    minX, maxY, maxZ,
                    maxX, maxY, maxZ,
                    maxX, maxY, minZ
                );
                
                texCoords.push(
                    texU, texV + texSize,
                    texU, texV,
                    texU + texSize, texV,
                    texU + texSize, texV + texSize
                );
                
                indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
                index += 4;
            }
            
            if (renderBottom) {
                vertices.push(
                    minX, minY, minZ,
                    maxX, minY, minZ,
                    maxX, minY, maxZ,
                    minX, minY, maxZ
                );
                
                texCoords.push(
                    texU, texV + texSize,
                    texU + texSize, texV + texSize,
                    texU + texSize, texV,
                    texU, texV
                );
                
                indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
                index += 4;
            }
            
            if (renderFront) {
                vertices.push(
                    minX, minY, minZ,
                    minX, maxY, minZ,
                    maxX, maxY, minZ,
                    maxX, minY, minZ
                );
                
                texCoords.push(
                    texU, texV + texSize,
                    texU, texV,
                    texU + texSize, texV,
                    texU + texSize, texV + texSize
                );
                
                indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
                index += 4;
            }
            
            if (renderBack) {
                vertices.push(
                    maxX, minY, maxZ,
                    maxX, maxY, maxZ,
                    minX, maxY, maxZ,
                    minX, minY, maxZ
                );
                
                texCoords.push(
                    texU, texV + texSize,
                    texU, texV,
                    texU + texSize, texV,
                    texU + texSize, texV + texSize
                );
                
                indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
                index += 4;
            }
            
            if (renderLeft) {
                vertices.push(
                    minX, minY, maxZ,
                    minX, maxY, maxZ,
                    minX, maxY, minZ,
                    minX, minY, minZ
                );
                
                texCoords.push(
                    texU, texV + texSize,
                    texU, texV,
                    texU + texSize, texV,
                    texU + texSize, texV + texSize
                );
                
                indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
                index += 4;
            }
            
            if (renderRight) {
                vertices.push(
                    maxX, minY, minZ,
                    maxX, maxY, minZ,
                    maxX, maxY, maxZ,
                    maxX, minY, maxZ
                );
                
                texCoords.push(
                    texU, texV + texSize,
                    texU, texV,
                    texU + texSize, texV,
                    texU + texSize, texV + texSize
                );
                
                indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
                index += 4;
            }
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        
        this.indexCount = indices.length;
    }
    
    setupPlayer() {
        this.player = {
            x: this.worldSize / 2,
            y: this.worldSize / 2 + 5,
            z: this.worldSize / 2,
            rotationX: 0,
            rotationY: 0,
            velocityY: 0,
            onGround: false
        };
    }
    
    setupControls() {
        this.keys = {};
        
        document.addEventListener('keydown', (e) => {
            this.keys[e.keyCode] = true;
            if (e.keyCode === 82) this.setupPlayer();
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.keyCode] = false;
        });
        
        this.canvas.addEventListener('click', () => {
            this.canvas.requestPointerLock();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!document.pointerLockElement) return;
            
            const movementX = e.movementX || 0;
            const movementY = e.movementY || 0;
            
            this.player.rotationY -= movementX * 0.002;
            this.player.rotationX -= movementY * 0.002;
            
            this.player.rotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.player.rotationX));
        });
    }
    
    updateProjectionMatrix() {
        const aspect = this.canvas.width / this.canvas.height;
        const fov = 60 * Math.PI / 180;
        
        this.projectionMatrix = new Float32Array(16);
        const f = 1.0 / Math.tan(fov / 2);
        
        this.projectionMatrix[0] = f / aspect;
        this.projectionMatrix[5] = f;
        this.projectionMatrix[10] = -1.2;
        this.projectionMatrix[11] = -1;
        this.projectionMatrix[14] = -0.2;
    }
    
    updatePlayer(deltaTime) {
        const speed = 0.002 * deltaTime;
        const gravity = 0.0005 * deltaTime;
        const jumpForce = 0.015 * deltaTime;
        
        let moveX = 0;
        let moveZ = 0;
        
        if (this.keys[87]) moveZ -= 1;
        if (this.keys[83]) moveZ += 1;
        if (this.keys[65]) moveX -= 1;
        if (this.keys[68]) moveX += 1;
        
        if (moveX !== 0 && moveZ !== 0) {
            moveX *= 0.7071;
            moveZ *= 0.7071;
        }
        
        const sinY = Math.sin(this.player.rotationY);
        const cosY = Math.cos(this.player.rotationY);
        
        const moveXrot = moveX * cosY - moveZ * sinY;
        const moveZrot = moveZ * cosY + moveX * sinY;
        
        this.player.x += moveXrot * speed;
        this.player.z += moveZrot * speed;
        
        if (this.keys[32] && this.player.onGround) {
            this.player.velocityY = jumpForce;
            this.player.onGround = false;
        }
        
        this.player.velocityY -= gravity;
        this.player.y += this.player.velocityY;
        
        if (this.player.y < 0) {
            this.player.y = 0;
            this.player.velocityY = 0;
            this.player.onGround = true;
        }
    }
    
    createModelViewMatrix() {
        const matrix = new Float32Array(16);
        
        for (let i = 0; i < 16; i++) {
            matrix[i] = i % 5 === 0 ? 1 : 0;
        }
        
        const cosX = Math.cos(this.player.rotationX);
        const sinX = Math.sin(this.player.rotationX);
        const cosY = Math.cos(this.player.rotationY);
        const sinY = Math.sin(this.player.rotationY);
        
        matrix[0] = cosY;
        matrix[2] = sinY;
        matrix[4] = sinX * sinY;
        matrix[5] = cosX;
        matrix[6] = -sinX * cosY;
        matrix[8] = -cosX * sinY;
        matrix[9] = sinX;
        matrix[10] = cosX * cosY;
        
        matrix[12] = -this.player.x;
        matrix[13] = -this.player.y;
        matrix[14] = -this.player.z;
        
        return matrix;
    }
    
    render() {
        const gl = this.gl;
        
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.program);
        
        gl.uniformMatrix4fv(this.uniformLocations.projectionMatrix, false, this.projectionMatrix);
        gl.uniformMatrix4fv(this.uniformLocations.modelViewMatrix, false, this.createModelViewMatrix());
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(this.uniformLocations.texture, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(this.attribLocations.position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.attribLocations.position);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.attribLocations.texCoord);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }
    
    gameLoop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        this.fps = Math.round(1000 / deltaTime);
        this.info.textContent = `FPS: ${this.fps} | WASD - движение, SPACE - прыжок, МЫШЬ - обзор`;
        
        this.updatePlayer(deltaTime);
        this.render();
        
        requestAnimationFrame(this.gameLoop.bind(this));
    }
}

window.onload = () => new Game();
