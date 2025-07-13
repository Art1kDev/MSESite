// Main game class
class RubyDung {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        this.fpsCounter = document.getElementById('fps-counter');
        
        if (!this.gl) {
            alert('WebGL not supported in your browser');
            return;
        }
        
        // Game state
        this.running = true;
        this.lastTime = 0;
        this.frames = 0;
        this.lastFpsUpdate = 0;
        
        // Initialize game components
        this.init();
        
        // Start game loop
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    init() {
        // Setup canvas size
        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas.bind(this));
        
        // Setup WebGL
        this.setupWebGL();
        
        // Create level and player
        this.level = new Level(256, 256, 64);
        this.levelRenderer = new LevelRenderer(this.level, this.gl);
        this.player = new Player(this.level);
        
        // Setup input
        this.setupInput();
        
        // Load texture
        this.loadTexture();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Update projection matrix
        if (this.levelRenderer) {
            this.levelRenderer.updateProjectionMatrix(this.canvas.width, this.canvas.height);
        }
    }
    
    setupWebGL() {
        const gl = this.gl;
        
        gl.clearColor(0.5, 0.8, 1.0, 1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
    }
    
    setupInput() {
        // Mouse movement
        this.canvas.addEventListener('mousemove', (e) => {
            if (!document.pointerLockElement) {
                return;
            }
            
            const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
            const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
            
            this.player.turn(movementX, movementY);
        });
        
        // Pointer lock
        this.canvas.addEventListener('click', () => {
            this.canvas.requestPointerLock = this.canvas.requestPointerLock || 
                                           this.canvas.mozRequestPointerLock || 
                                           this.canvas.webkitRequestPointerLock;
            this.canvas.requestPointerLock();
        });
        
        // Keyboard input
        this.keys = {};
        document.addEventListener('keydown', (e) => {
            this.keys[e.keyCode] = true;
            
            // Reset position on R key
            if (e.keyCode === 82) { // R
                this.player.resetPosition();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.keyCode] = false;
        });
    }
    
    loadTexture() {
        // Create a placeholder texture (in a real game, you'd load an actual texture)
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // Fill texture with a simple pattern for testing
        const size = 16;
        const pixels = new Uint8Array(size * size * 4);
        for (let i = 0; i < size * size; i++) {
            const x = i % size;
            const y = Math.floor(i / size);
            
            // Grass (green) on top half, rock (gray) on bottom half
            if (y < size / 2) {
                pixels[i * 4] = 34;    // R
                pixels[i * 4 + 1] = 139; // G
                pixels[i * 4 + 2] = 34;  // B
                pixels[i * 4 + 3] = 255; // A
            } else {
                pixels[i * 4] = 128;    // R
                pixels[i * 4 + 1] = 128; // G
                pixels[i * 4 + 2] = 128; // B
                pixels[i * 4 + 3] = 255; // A
            }
        }
        
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        
        this.texture = texture;
    }
    
    gameLoop(timestamp) {
        if (!this.running) return;
        
        // Calculate delta time
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        // Update FPS counter
        this.frames++;
        if (timestamp - this.lastFpsUpdate >= 1000) {
            this.fpsCounter.textContent = `FPS: ${this.frames}`;
            this.frames = 0;
            this.lastFpsUpdate = timestamp;
        }
        
        // Update game state
        this.tick();
        
        // Render
        this.render();
        
        // Continue loop
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    tick() {
        // Handle player movement
        let forward = 0;
        let vertical = 0;
        
        // W or Up arrow
        if (this.keys[87] || this.keys[38]) forward--;
        // S or Down arrow
        if (this.keys[83] || this.keys[40]) forward++;
        // A or Left arrow
        if (this.keys[65] || this.keys[37]) vertical--;
        // D or Right arrow
        if (this.keys[68] || this.keys[39]) vertical++;
        // Space for jump
        if (this.keys[32] && this.player.onGround) {
            this.player.motionY = 0.12;
        }
        
        this.player.moveRelative(vertical, forward, this.player.onGround ? 0.02 : 0.005);
        
        // Update player
        this.player.tick();
    }
    
    render() {
        const gl = this.gl;
        
        // Clear screen
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Render level
        this.levelRenderer.render(this.player);
    }
}

// Player class
class Player {
    constructor(level) {
        this.level = level;
        this.resetPosition();
        
        // Movement properties
        this.motionX = 0;
        this.motionY = 0;
        this.motionZ = 0;
        this.onGround = false;
        
        // Rotation
        this.xRotation = 0;
        this.yRotation = 0;
    }
    
    resetPosition() {
        const x = Math.random() * this.level.width;
        const y = this.level.depth + 3;
        const z = Math.random() * this.level.height;
        this.setPosition(x, y, z);
    }
    
    setPosition(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.prevX = x;
        this.prevY = y;
        this.prevZ = z;
        
        const width = 0.3;
        const height = 0.9;
        this.boundingBox = new AABB(
            x - width, y - height, z - width,
            x + width, y + height, z + width
        );
    }
    
    turn(x, y) {
        this.yRotation += x * 0.15;
        this.xRotation -= y * 0.15;
        
        // Clamp pitch
        this.xRotation = Math.max(-90, Math.min(90, this.xRotation));
    }
    
    tick() {
        // Store previous position
        this.prevX = this.x;
        this.prevY = this.y;
        this.prevZ = this.z;
        
        // Apply gravity
        this.motionY -= 0.005;
        
        // Move player
        this.move(this.motionX, this.motionY, this.motionZ);
        
        // Apply friction
        this.motionX *= 0.91;
        this.motionY *= 0.98;
        this.motionZ *= 0.91;
        
        // Extra friction on ground
        if (this.onGround) {
            this.motionX *= 0.8;
            this.motionZ *= 0.8;
        }
    }
    
    move(x, y, z) {
        const prevX = x;
        const prevY = y;
        const prevZ = z;
        
        // Get surrounding tiles
        const aABBs = this.level.getCubes(this.boundingBox.expand(x, y, z));
        
        // Check for Y collision
        for (const abb of aABBs) {
            y = abb.clipYCollide(this.boundingBox, y);
        }
        this.boundingBox.move(0, y, 0);
        
        // Check for X collision
        for (const aABB of aABBs) {
            x = aABB.clipXCollide(this.boundingBox, x);
        }
        this.boundingBox.move(x, 0, 0);
        
        // Check for Z collision
        for (const aABB of aABBs) {
            z = aABB.clipZCollide(this.boundingBox, z);
        }
        this.boundingBox.move(0, 0, z);
        
        // Update on ground state
        this.onGround = prevY !== y && prevY < 0;
        
        // Stop motion on collision
        if (prevX !== x) this.motionX = 0;
        if (prevY !== y) this.motionY = 0;
        if (prevZ !== z) this.motionZ = 0;
        
        // Update position from bounding box
        this.x = (this.boundingBox.minX + this.boundingBox.maxX) / 2;
        this.y = this.boundingBox.minY + 1.62;
        this.z = (this.boundingBox.minZ + this.boundingBox.maxZ) / 2;
    }
    
    moveRelative(x, z, speed) {
        const distance = x * x + z * z;
        if (distance < 0.01) return;
        
        const normalizedDistance = speed / Math.sqrt(distance);
        x *= normalizedDistance;
        z *= normalizedDistance;
        
        const sin = Math.sin(this.yRotation * Math.PI / 180);
        const cos = Math.cos(this.yRotation * Math.PI / 180);
        
        this.motionX += x * cos - z * sin;
        this.motionZ += z * cos + x * sin;
    }
}

// AABB (Axis-Aligned Bounding Box) class
class AABB {
    constructor(minX, minY, minZ, maxX, maxY, maxZ) {
        this.minX = minX;
        this.minY = minY;
        this.minZ = minZ;
        this.maxX = maxX;
        this.maxY = maxY;
        this.maxZ = maxZ;
        this.epsilon = 0.0;
    }
    
    clone() {
        return new AABB(this.minX, this.minY, this.minZ, this.maxX, this.maxY, this.maxZ);
    }
    
    expand(x, y, z) {
        let minX = this.minX;
        let minY = this.minY;
        let minZ = this.minZ;
        let maxX = this.maxX;
        let maxY = this.maxY;
        let maxZ = this.maxZ;
        
        if (x < 0) minX += x; else maxX += x;
        if (y < 0) minY += y; else maxY += y;
        if (z < 0) minZ += z; else maxZ += z;
        
        return new AABB(minX, minY, minZ, maxX, maxY, maxZ);
    }
    
    grow(x, y, z) {
        return new AABB(
            this.minX - x, this.minY - y, this.minZ - z,
            this.maxX + x, this.maxY + y, this.maxZ + z
        );
    }
    
    clipXCollide(other, x) {
        if (other.maxY <= this.minY || other.minY >= this.maxY) return x;
        if (other.maxZ <= this.minZ || other.minZ >= this.maxZ) return x;
        
        if (x > 0 && other.maxX <= this.minX) {
            const max = this.minX - other.maxX - this.epsilon;
            if (max < x) x = max;
        }
        
        if (x < 0 && other.minX >= this.maxX) {
            const max = this.maxX - other.minX + this.epsilon;
            if (max > x) x = max;
        }
        
        return x;
    }
    
    clipYCollide(other, y) {
        if (other.maxX <= this.minX || other.minX >= this.maxX) return y;
        if (other.maxZ <= this.minZ || other.minZ >= this.maxZ) return y;
        
        if (y > 0 && other.maxY <= this.minY) {
            const max = this.minY - other.maxY - this.epsilon;
            if (max < y) y = max;
        }
        
        if (y < 0 && other.minY >= this.maxY) {
            const max = this.maxY - other.minY + this.epsilon;
            if (max > y) y = max;
        }
        
        return y;
    }
    
    clipZCollide(other, z) {
        if (other.maxX <= this.minX || other.minX >= this.maxX) return z;
        if (other.maxY <= this.minY || other.minY >= this.maxY) return z;
        
        if (z > 0 && other.maxZ <= this.minZ) {
            const max = this.minZ - other.maxZ - this.epsilon;
            if (max < z) z = max;
        }
        
        if (z < 0 && other.minZ >= this.maxZ) {
            const max = this.maxZ - other.minZ + this.epsilon;
            if (max > z) z = max;
        }
        
        return z;
    }
    
    intersects(other) {
        if (other.maxX <= this.minX || other.minX >= this.maxX) return false;
        if (other.maxY <= this.minY || other.minY >= this.maxY) return false;
        return !(other.maxZ <= this.minZ) && !(other.minZ >= this.maxZ);
    }
    
    move(x, y, z) {
        this.minX += x;
        this.minY += y;
        this.minZ += z;
        this.maxX += x;
        this.maxY += y;
        this.maxZ += z;
    }
    
    offset(x, y, z) {
        return new AABB(
            this.minX + x, this.minY + y, this.minZ + z,
            this.maxX + x, this.maxY + y, this.maxZ + z
        );
    }
}

// Level class
class Level {
    constructor(width, height, depth) {
        this.width = width;
        this.height = height;
        this.depth = depth;
        
        this.blocks = new Uint8Array(width * height * depth);
        this.lightDepths = new Int32Array(width * height);
        
        // Fill level with tiles
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < depth; y++) {
                for (let z = 0; z < height; z++) {
                    const index = (y * this.height + z) * this.width + x;
                    this.blocks[index] = 1;
                }
            }
        }
        
        // Generate caves
        for (let i = 0; i < 10000; i++) {
            const caveSize = Math.floor(Math.random() * 7) + 1;
            
            const caveX = Math.floor(Math.random() * width);
            const caveY = Math.floor(Math.random() * depth);
            const caveZ = Math.floor(Math.random() * height);
            
            for (let radius = 0; radius < caveSize; radius++) {
                for (let sphere = 0; sphere < 1000; sphere++) {
                    const offsetX = Math.floor(Math.random() * radius * 2 - radius);
                    const offsetY = Math.floor(Math.random() * radius * 2 - radius);
                    const offsetZ = Math.floor(Math.random() * radius * 2 - radius);
                    
                    const distance = offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ;
                    if (distance > radius * radius) continue;
                    
                    const tileX = caveX + offsetX;
                    const tileY = caveY + offsetY;
                    const tileZ = caveZ + offsetZ;
                    
                    const index = (tileY * this.height + tileZ) * this.width + tileX;
                    
                    if (index >= 0 && index < this.blocks.length) {
                        if (tileX > 0 && tileY > 0 && tileZ > 0 &&
                            tileX < this.width - 1 && tileY < this.depth && tileZ < this.height - 1) {
                            this.blocks[index] = 0;
                        }
                    }
                }
            }
        }
        
        this.calcLightDepths(0, 0, width, height);
    }
    
    calcLightDepths(minX, minZ, maxX, maxZ) {
        for (let x = minX; x < minX + maxX; x++) {
            for (let z = minZ; z < minZ + maxZ; z++) {
                let depth = this.depth - 1;
                while (depth > 0 && !this.isLightBlocker(x, depth, z)) {
                    depth--;
                }
                this.lightDepths[x + z * this.width] = depth;
            }
        }
    }
    
    isTile(x, y, z) {
        if (x < 0 || y < 0 || z < 0 || x >= this.width || y >= this.depth || z >= this.height) {
            return false;
        }
        return this.blocks[(y * this.height + z) * this.width + x] !== 0;
    }
    
    isSolidTile(x, y, z) {
        return this.isTile(x, y, z);
    }
    
    isLightBlocker(x, y, z) {
        return this.isSolidTile(x, y, z);
    }
    
    getBrightness(x, y, z) {
        const dark = 0.8;
        const light = 1.0;
        
        if (x < 0 || y < 0 || z < 0 || x >= this.width || y >= this.depth || z >= this.height) {
            return light;
        }
        
        if (y < this.lightDepths[x + z * this.width]) {
            return dark;
        }
        
        return light;
    }
    
    getCubes(boundingBox) {
        const boundingBoxList = [];
        
        let minX = Math.floor(boundingBox.minX) - 1;
        let maxX = Math.ceil(boundingBox.maxX) + 1;
        let minY = Math.floor(boundingBox.minY) - 1;
        let maxY = Math.ceil(boundingBox.maxY) + 1;
        let minZ = Math.floor(boundingBox.minZ) - 1;
        let maxZ = Math.ceil(boundingBox.maxZ) + 1;
        
        minX = Math.max(0, minX);
        minY = Math.max(0, minY);
        minZ = Math.max(0, minZ);
        
        maxX = Math.min(this.width, maxX);
        maxY = Math.min(this.depth, maxY);
        maxZ = Math.min(this.height, maxZ);
        
        for (let x = minX; x < maxX; x++) {
            for (let y = minY; y < maxY; y++) {
                for (let z = minZ; z < maxZ; z++) {
                    if (this.isSolidTile(x, y, z)) {
                        boundingBoxList.push(new AABB(x, y, z, x + 1, y + 1, z + 1));
                    }
                }
            }
        }
        
        return boundingBoxList;
    }
}

// LevelRenderer class
class LevelRenderer {
    constructor(level, gl) {
        this.level = level;
        this.gl = gl;
        this.chunkSize = 8;
        
        this.chunkAmountX = Math.ceil(level.width / this.chunkSize);
        this.chunkAmountY = Math.ceil(level.depth / this.chunkSize);
        this.chunkAmountZ = Math.ceil(level.height / this.chunkSize);
        
        this.chunks = [];
        
        for (let x = 0; x < this.chunkAmountX; x++) {
            for (let y = 0; y < this.chunkAmountY; y++) {
                for (let z = 0; z < this.chunkAmountZ; z++) {
                    const minChunkX = x * this.chunkSize;
                    const minChunkY = y * this.chunkSize;
                    const minChunkZ = z * this.chunkSize;
                    
                    let maxChunkX = (x + 1) * this.chunkSize;
                    let maxChunkY = (y + 1) * this.chunkSize;
                    let maxChunkZ = (z + 1) * this.chunkSize;
                    
                    maxChunkX = Math.min(level.width, maxChunkX);
                    maxChunkY = Math.min(level.depth, maxChunkY);
                    maxChunkZ = Math.min(level.height, maxChunkZ);
                    
                    const chunk = new Chunk(level, minChunkX, minChunkY, minChunkZ, maxChunkX, maxChunkY, maxChunkZ, gl);
                    this.chunks[(x + y * this.chunkAmountX) * this.chunkAmountZ + z] = chunk;
                }
            }
        }
        
        // Initialize shaders
        this.initShaders();
    }
    
    initShaders() {
        const gl = this.gl;
        
        // Vertex shader
        const vsSource = `
            attribute vec3 aPosition;
            attribute vec2 aTexCoord;
            attribute vec3 aColor;
            
            uniform mat4 uProjectionMatrix;
            uniform mat4 uModelViewMatrix;
            
            varying vec2 vTexCoord;
            varying vec3 vColor;
            
            void main() {
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
                vTexCoord = aTexCoord;
                vColor = aColor;
            }
        `;
        
        // Fragment shader
        const fsSource = `
            precision mediump float;
            
            varying vec2 vTexCoord;
            varying vec3 vColor;
            
            uniform sampler2D uSampler;
            
            void main() {
                gl_FragColor = texture2D(uSampler, vTexCoord) * vec4(vColor, 1.0);
            }
        `;
        
        // Compile shaders
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
        
        // Create shader program
        this.shaderProgram = gl.createProgram();
        gl.attachShader(this.shaderProgram, vertexShader);
        gl.attachShader(this.shaderProgram, fragmentShader);
        gl.linkProgram(this.shaderProgram);
        
        if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) {
            console.error('Shader program link error:', gl.getProgramInfoLog(this.shaderProgram));
            return;
        }
        
        // Get attribute and uniform locations
        this.attribLocations = {
            position: gl.getAttribLocation(this.shaderProgram, 'aPosition'),
            texCoord: gl.getAttribLocation(this.shaderProgram, 'aTexCoord'),
            color: gl.getAttribLocation(this.shaderProgram, 'aColor')
        };
        
        this.uniformLocations = {
            projectionMatrix: gl.getUniformLocation(this.shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(this.shaderProgram, 'uModelViewMatrix'),
            sampler: gl.getUniformLocation(this.shaderProgram, 'uSampler')
        };
        
        // Create projection matrix
        this.projectionMatrix = new Float32Array(16);
        this.updateProjectionMatrix(this.gl.canvas.width, this.gl.canvas.height);
    }
    
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    updateProjectionMatrix(width, height) {
        const aspect = width / height;
        const fov = 70 * Math.PI / 180;
        const zNear = 0.05;
        const zFar = 1000;
        
        // Perspective matrix
        const f = 1.0 / Math.tan(fov / 2);
        const rangeInv = 1.0 / (zNear - zFar);
        
        this.projectionMatrix[0] = f / aspect;
        this.projectionMatrix[1] = 0;
        this.projectionMatrix[2] = 0;
        this.projectionMatrix[3] = 0;
        
        this.projectionMatrix[4] = 0;
        this.projectionMatrix[5] = f;
        this.projectionMatrix[6] = 0;
        this.projectionMatrix[7] = 0;
        
        this.projectionMatrix[8] = 0;
        this.projectionMatrix[9] = 0;
        this.projectionMatrix[10] = (zNear + zFar) * rangeInv;
        this.projectionMatrix[11] = -1;
        
        this.projectionMatrix[12] = 0;
        this.projectionMatrix[13] = 0;
        this.projectionMatrix[14] = zNear * zFar * rangeInv * 2;
        this.projectionMatrix[15] = 0;
    }
    
    render(player) {
        const gl = this.gl;
        
        // Use shader program
        gl.useProgram(this.shaderProgram);
        
        // Set projection matrix
        gl.uniformMatrix4fv(this.uniformLocations.projectionMatrix, false, this.projectionMatrix);
        
        // Create model-view matrix from player position and rotation
        const modelViewMatrix = new Float32Array(16);
        this.createModelViewMatrix(modelViewMatrix, player);
        
        // Set model-view matrix
        gl.uniformMatrix4fv(this.uniformLocations.modelViewMatrix, false, modelViewMatrix);
        
        // Set texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.gl.texture);
        gl.uniform1i(this.uniformLocations.sampler, 0);
        
        // Enable attributes
        gl.enableVertexAttribArray(this.attribLocations.position);
        gl.enableVertexAttribArray(this.attribLocations.texCoord);
        gl.enableVertexAttribArray(this.attribLocations.color);
        
        // Render all chunks
        for (const chunk of this.chunks) {
            chunk.render(0); // Render normal layer
        }
    }
    
    createModelViewMatrix(matrix, player) {
        // Initialize as identity matrix
        for (let i = 0; i < 16; i++) {
            matrix[i] = i % 5 === 0 ? 1 : 0; // Diagonal elements = 1
        }
        
        // Translate to player position
        matrix[12] = -player.x;
        matrix[13] = -player.y;
        matrix[14] = -player.z;
        
        // Rotate around Y axis (yaw)
        const cosY = Math.cos(player.yRotation * Math.PI / 180);
        const sinY = Math.sin(player.yRotation * Math.PI / 180);
        
        const temp00 = matrix[0] * cosY + matrix[2] * sinY;
        const temp01 = matrix[1] * cosY + matrix[3] * sinY;
        const temp02 = matrix[2] * cosY - matrix[0] * sinY;
        const temp03 = matrix[3] * cosY - matrix[1] * sinY;
        
        matrix[0] = temp00;
        matrix[1] = temp01;
        matrix[2] = temp02;
        matrix[3] = temp03;
        
        // Rotate around X axis (pitch)
        const cosX = Math.cos(player.xRotation * Math.PI / 180);
        const sinX = Math.sin(player.xRotation * Math.PI / 180);
        
        const temp10 = matrix[4] * cosX - matrix[8] * sinX;
        const temp11 = matrix[5] * cosX - matrix[9] * sinX;
        const temp12 = matrix[6] * cosX - matrix[10] * sinX;
        const temp13 = matrix[7] * cosX - matrix[11] * sinX;
        
        matrix[8] = matrix[4] * sinX + matrix[8] * cosX;
        matrix[9] = matrix[5] * sinX + matrix[9] * cosX;
        matrix[10] = matrix[6] * sinX + matrix[10] * cosX;
        matrix[11] = matrix[7] * sinX + matrix[11] * cosX;
        
        matrix[4] = temp10;
        matrix[5] = temp11;
        matrix[6] = temp12;
        matrix[7] = temp13;
        
        // Adjust for eye height
        matrix[13] -= 0.3;
    }
}

// Chunk class
class Chunk {
    constructor(level, minX, minY, minZ, maxX, maxY, maxZ, gl) {
        this.level = level;
        this.gl = gl;
        
        this.minX = minX;
        this.minY = minY;
        this.minZ = minZ;
        this.maxX = maxX;
        this.maxY = maxY;
        this.maxZ = maxZ;
        
        this.boundingBox = new AABB(minX, minY, minZ, maxX, maxY, maxZ);
        
        // Initialize buffers for rendering
        this.initBuffers();
    }
    
    initBuffers() {
        const gl = this.gl;
        
        // Create vertex buffer
        this.vertexBuffer = gl.createBuffer();
        
        // Create texture coordinate buffer
        this.texCoordBuffer = gl.createBuffer();
        
        // Create color buffer
        this.colorBuffer = gl.createBuffer();
        
        // Create index buffer
        this.indexBuffer = gl.createBuffer();
        
        // Generate geometry
        this.generateGeometry();
    }
    
    generateGeometry() {
        const vertices = [];
        const texCoords = [];
        const colors = [];
        const indices = [];
        
        const dark = 0.8;
        const light = 1.0;
        
        let vertexCount = 0;
        
        for (let x = this.minX; x < this.maxX; x++) {
            for (let y = this.minY; y < this.maxY; y++) {
                for (let z = this.minZ; z < this.maxZ; z++) {
                    if (!this.level.isTile(x, y, z)) continue;
                    
                    const brightness = y > this.level.depth - 7 && 
                                     this.level.getBrightness(x, y, z) === light ? light : dark;
                    
                    const minU = 0;
                    const maxU = 1;
                    const minV = 0;
                    const maxV = 1;
                    
                    const minX = x;
                    const maxX = x + 1;
                    const minY = y;
                    const maxY = y + 1;
                    const minZ = z;
                    const maxZ = z + 1;
                    
                    // Bottom face
                    if (!this.level.isSolidTile(x, y - 1, z)) {
                        const faceBrightness = this.level.getBrightness(x, y - 1, z) * dark;
                        
                        vertices.push(
                            minX, minY, maxZ,
                            minX, minY, minZ,
                            maxX, minY, minZ,
                            maxX, minY, maxZ
                        );
                        
                        texCoords.push(
                            minU, maxV,
                            minU, minV,
                            maxU, minV,
                            maxU, maxV
                        );
                        
                        for (let i = 0; i < 4; i++) {
                            colors.push(faceBrightness, faceBrightness, faceBrightness);
                        }
                        
                        indices.push(
                            vertexCount, vertexCount + 1, vertexCount + 2,
                            vertexCount, vertexCount + 2, vertexCount + 3
                        );
                        
                        vertexCount += 4;
                    }
                    
                    // Top face
                    if (!this.level.isSolidTile(x, y + 1, z)) {
                        const faceBrightness = this.level.getBrightness(x, y + 1, z) * dark;
                        
                        vertices.push(
                            maxX, maxY, maxZ,
                            maxX, maxY, minZ,
                            minX, maxY, minZ,
                            minX, maxY, maxZ
                        );
                        
                        texCoords.push(
                            maxU, maxV,
                            maxU, minV,
                            minU, minV,
                            minU, maxV
                        );
                        
                        for (let i = 0; i < 4; i++) {
                            colors.push(faceBrightness, faceBrightness, faceBrightness);
                        }
                        
                        indices.push(
                            vertexCount, vertexCount + 1, vertexCount + 2,
                            vertexCount, vertexCount + 2, vertexCount + 3
                        );
                        
                        vertexCount += 4;
                    }
                    
                    // Front face (Z-)
                    if (!this.level.isSolidTile(x, y, z - 1)) {
                        const faceBrightness = this.level.getBrightness(x, y, z - 1) * dark;
                        
                        vertices.push(
                            minX, maxY, minZ,
                            maxX, maxY, minZ,
                            maxX, minY, minZ,
                            minX, minY, minZ
                        );
                        
                        texCoords.push(
                            maxU, minV,
                            minU, minV,
                            minU, maxV,
                            maxU, maxV
                        );
                        
                        for (let i = 0; i < 4; i++) {
                            colors.push(faceBrightness, faceBrightness, faceBrightness);
                        }
                        
                        indices.push(
                            vertexCount, vertexCount + 1, vertexCount + 2,
                            vertexCount, vertexCount + 2, vertexCount + 3
                        );
                        
                        vertexCount += 4;
                    }
                    
                    // Back face (Z+)
                    if (!this.level.isSolidTile(x, y, z + 1)) {
                        const faceBrightness = this.level.getBrightness(x, y, z + 1) * dark;
                        
                        vertices.push(
                            minX, maxY, maxZ,
                            minX, minY, maxZ,
                            maxX, minY, maxZ,
                            maxX, maxY, maxZ
                        );
                        
                        texCoords.push(
                            minU, minV,
                            minU, maxV,
                            maxU, maxV,
                            maxU, minV
                        );
                        
                        for (let i = 0; i < 4; i++) {
                            colors.push(faceBrightness, faceBrightness, faceBrightness);
                        }
                        
                        indices.push(
                            vertexCount, vertexCount + 1, vertexCount + 2,
                            vertexCount, vertexCount + 2, vertexCount + 3
                        );
                        
                        vertexCount += 4;
                    }
                    
                    // Left face (X-)
                    if (!this.level.isSolidTile(x - 1, y, z)) {
                        const faceBrightness = this.level.getBrightness(x - 1, y, z) * dark;
                        
                        vertices.push(
                            minX, maxY, maxZ,
                            minX, maxY, minZ,
                            minX, minY, minZ,
                            minX, minY, maxZ
                        );
                        
                        texCoords.push(
                            maxU, minV,
                            minU, minV,
                            minU, maxV,
                            maxU, maxV
                        );
                        
                        for (let i = 0; i < 4; i++) {
                            colors.push(faceBrightness, faceBrightness, faceBrightness);
                        }
                        
                        indices.push(
                            vertexCount, vertexCount + 1, vertexCount + 2,
                            vertexCount, vertexCount + 2, vertexCount + 3
                        );
                        
                        vertexCount += 4;
                    }
                    
                    // Right face (X+)
                    if (!this.level.isSolidTile(x + 1, y, z)) {
                        const faceBrightness = this.level.getBrightness(x + 1, y, z) * dark;
                        
                        vertices.push(
                            maxX, minY, maxZ,
                            maxX, minY, minZ,
                            maxX, maxY, minZ,
                            maxX, maxY, maxZ
                        );
                        
                        texCoords.push(
                            minU, maxV,
                            maxU, maxV,
                            maxU, minV,
                            minU, minV
                        );
                        
                        for (let i = 0; i < 4; i++) {
                            colors.push(faceBrightness, faceBrightness, faceBrightness);
                        }
                        
                        indices.push(
                            vertexCount, vertexCount + 1, vertexCount + 2,
                            vertexCount, vertexCount + 2, vertexCount + 3
                        );
                        
                        vertexCount += 4;
                    }
                }
            }
        }
        
        // Store data in buffers
        const gl = this.gl;
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        
        this.indexCount = indices.length;
    }
    
    render(layer) {
        const gl = this.gl;
        
        // Bind vertex buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(this.levelRenderer.attribLocations.position, 3, gl.FLOAT, false, 0, 0);
        
        // Bind texture coordinate buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.vertexAttribPointer(this.levelRenderer.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
        
        // Bind color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.vertexAttribPointer(this.levelRenderer.attribLocations.color, 3, gl.FLOAT, false, 0, 0);
        
        // Bind index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        
        // Draw elements
        gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }
}

// Start the game when the page loads
window.onload = function() {
    new RubyDung();
};
