// Ensure THREE is available
if (typeof THREE === 'undefined') {
    console.log('THREE not found in global scope, loading it inside game.js');
    // Add a script element to load THREE
    const threeScript = document.createElement('script');
    threeScript.src = 'https://unpkg.com/three@0.128.0/build/three.min.js';
    threeScript.onload = () => console.log('THREE.js loaded via dynamic script');
    threeScript.onerror = (e) => console.error('Failed to load THREE.js dynamically', e);
    document.head.appendChild(threeScript);
}

// Main game class
class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;
        this.players = {};
        this.hammers = [];
        this.obstacles = [];
        this.powerups = [];
        this.mapSize = { width: 40, height: 40 };
        this.lastUpdate = Date.now();
        this.playerHeight = 2;
        this.cameraOffset = 1.3; // Adjusted height to be inside the player body
        
        // References to key objects
        this.objectModels = {};
        this.playerMeshes = {};
        this.hammerMeshes = {};
        this.sounds = {};
        
        // Game state
        this.inputController = null;
        this.networkController = null;
        this.uiController = null;
        this.physicsController = null;
        this.objectsController = null;
        
        // Initialize the game
        this.init();
    }
    
    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
        
        // Create camera - positioned at origin initially
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Create renderer - ultra simplified
        this.renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: false,
            precision: 'lowp' // Use low precision for better performance
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(0.6); // Reduce to 60% of device pixel ratio
        
        // Use very basic shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        
        // Add renderer to DOM
        document.getElementById('game-container').appendChild(this.renderer.domElement);
        
        // Setup FXAA for edge smoothing (very performance-friendly)
        this.setupFXAA();
        
        // Create clock for animation
        this.clock = new THREE.Clock();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Create lighting
        this.createLighting();
        
        // Create ground
        this.createGround();
        
        // Initialize controllers
        this.objectsController = new ObjectsController(this);
        this.inputController = new InputController(this);
        this.networkController = new NetworkController(this);
        this.uiController = new UIController(this);
        this.physicsController = new PhysicsController(this);
        
        // Initialize last update time
        this.lastUpdate = Date.now();
        
        // Start animation loop
        this.animate();
    }
    
    // Setup FXAA post-processing for edge smoothing
    setupFXAA() {
        // Create effect composer
        this.composer = new THREE.EffectComposer(this.renderer);
        
        // Add render pass
        const renderPass = new THREE.RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        // Add FXAA pass (very lightweight anti-aliasing)
        const fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
        
        // Set resolution inverse based on pixel ratio
        const pixelRatio = this.renderer.getPixelRatio();
        fxaaPass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
        fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
        
        // Make this the last pass
        fxaaPass.renderToScreen = true;
        
        this.composer.addPass(fxaaPass);
    }
    
    createLighting() {
        // Very bright ambient light for flat lighting (no ray tracing)
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.3);
        this.scene.add(ambientLight);
        
        // Simple directional light with basic shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(100, 200, 100);
        
        // Minimal shadow setup - very simple and performant
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 512; // Very low resolution
        directionalLight.shadow.mapSize.height = 512; // Very low resolution
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        
        this.scene.add(directionalLight);
    }
    
    createGround() {
        // Create simplified floor
        const groundSize = 180;
        const floorGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
        const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x556b2f }); // Basic material
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
        this.ground = floor;
        
        // Simplified grid with fewer lines
        const gridHelper = new THREE.GridHelper(groundSize, 18, 0x000000, 0x000000);
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
    }
    
    updateLocalPlayer(deltaTime) {
        // Update local player if available
        if (this.localPlayerId && this.players[this.localPlayerId]) {
            const player = this.players[this.localPlayerId];
            
            // Special handling for dead players
            if (!player.isAlive) {
                // Force health to zero for display purposes
                player.health = 0;
                
                // Update UI with zero health
                this.uiController.updatePlayerUI(player);
                return;
            }
            
            // Update input controller
            this.inputController.update(deltaTime);
            
            // Update camera position using the InputController
            this.inputController.updatePlayerPosition();
            
            // Update UI
            this.uiController.updatePlayerUI(player);
            
            // Prepare inputs to send to server
            const inputData = {
                movement: this.inputController.movement,
                jump: this.inputController.jump,
                throw: this.inputController.throw,
                melee: this.inputController.melee,
                cameraRotation: {
                    y: this.inputController.yawObject.rotation.y
                }
            };
            
            // Add throw direction if needed
            if (this.inputController.throw || this.inputController.melee) {
                // Always ensure we get the locked direction that was set at mouse click
                // This is critical to maintain camera-based throwing accuracy
                if (this.inputController.lockedThrowDirection) {
                    inputData.throwDirection = { ...this.inputController.lockedThrowDirection };
                } else {
                    // Fallback to current camera direction if no locked direction is available
                    const direction = new THREE.Vector3(0, 0, -1);
                    const cameraWorldQuaternion = new THREE.Quaternion();
                    this.camera.getWorldQuaternion(cameraWorldQuaternion);
                    direction.applyQuaternion(cameraWorldQuaternion);
                    
                    inputData.throwDirection = {
                        x: direction.x,
                        y: direction.y,
                        z: direction.z
                    };
                }
                
                // Include origin for server-side prediction
                if (this.inputController.lastThrowOrigin) {
                    inputData.throwOrigin = { ...this.inputController.lastThrowOrigin };
                } else if (this.inputController.throwOrigin) {
                    inputData.throwOrigin = { ...this.inputController.throwOrigin };
                }
            }
            
            // Send player input to server
            if (this.inputController.inputChanged) {
                this.networkController.sendPlayerInput(inputData);
                
                // Reset one-time inputs
                this.inputController.jump = false;
                this.inputController.throw = false;
                this.inputController.melee = false;
                this.inputController.inputChanged = false;
            }
        }
    }
    
    updateGameObjects() {
        // Update player meshes
        for (const id in this.players) {
            const player = this.players[id];
            const mesh = this.playerMeshes[id];
            
            if (mesh && player) {
                mesh.position.copy(player.position);
                mesh.rotation.copy(player.rotation);
                
                // Check for player death
                if (!player.isAlive && !mesh.userData.deathProcessed) {
                    // Mark death as processed
                    mesh.userData.deathProcessed = true;
                    
                    // Set health to 0 when player dies
                    player.health = 0;
                    
                    // Force update health bars through both systems
                    if (id === this.localPlayerId && this.uiController) {
                        this.uiController.updatePlayerUI(player);
                    }
                    
                    // Force zero health bar through the objects controller
                    if (this.objectsController) {
                        this.objectsController.forceZeroHealthBar(id);
                    }
                    
                    // Create ragdoll effect for player death
                    if (this.objectsController) {
                        // Calculate direction based on last hit
                        const direction = { x: 0, y: 1, z: 0 }; // Default upward
                        
                        if (player.lastHitBy && this.players[player.lastHitBy]) {
                            // Calculate direction from attacker to victim
                            const attacker = this.players[player.lastHitBy];
                            const dx = player.position.x - attacker.position.x;
                            const dz = player.position.z - attacker.position.z;
                            const dist = Math.sqrt(dx * dx + dz * dz);
                            
                            if (dist > 0) {
                                direction.x = dx / dist;
                                direction.z = dz / dist;
                            }
                        }
                        
                        // Create ragdoll at player position
                        this.objectsController.createRagdoll(player.position, direction);
                    }
                    
                    // If this is the local player, show death notification
                    if (id === this.localPlayerId && this.uiController) {
                        // Fade screen to red briefly
                        const screenFlash = document.createElement('div');
                        screenFlash.style.position = 'absolute';
                        screenFlash.style.top = '0';
                        screenFlash.style.left = '0';
                        screenFlash.style.width = '100%';
                        screenFlash.style.height = '100%';
                        screenFlash.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
                        screenFlash.style.pointerEvents = 'none';
                        screenFlash.style.transition = 'opacity 1.5s';
                        screenFlash.style.zIndex = '999';
                        document.getElementById('ui-container').appendChild(screenFlash);
                        
                        // Fade out
                        setTimeout(() => {
                            screenFlash.style.opacity = '0';
                            setTimeout(() => {
                                screenFlash.remove();
                            }, 1500);
                        }, 100);
                    }
                }
                
                // Update player animations based on state
                if (mesh.userData.mixer) {
                    mesh.userData.mixer.update(this.clock.getDelta());
                    
                    // Check if player was recently hit for stagger animation
                    const wasRecentlyHit = player.lastHitTime && (Date.now() - player.lastHitTime < 500);
                    
                    if (wasRecentlyHit && mesh.userData.actions.stagger) {
                        if (mesh.userData.currentAnimation !== 'stagger') {
                            this.playAnimation(mesh, 'stagger');
                            
                            // Create blood spray effect
                            if (this.objectsController && player.isAlive) {
                                this.objectsController.createBloodSpray(player.position);
                            }
                        }
                    } else if (player.isJumping && mesh.userData.actions.jump) {
                        if (mesh.userData.currentAnimation !== 'jump') {
                            this.playAnimation(mesh, 'jump');
                        }
                    } else if (!player.onGround && mesh.userData.actions.fall) {
                        if (mesh.userData.currentAnimation !== 'fall') {
                            this.playAnimation(mesh, 'fall');
                        }
                    } else if (
                        player.velocity.x * player.velocity.x + 
                        player.velocity.z * player.velocity.z > 0.5
                    ) {
                        if (mesh.userData.currentAnimation !== 'run') {
                            this.playAnimation(mesh, 'run');
                        }
                    } else if (player.meleeActive && mesh.userData.actions.attack) {
                        // Play melee attack animation
                        if (mesh.userData.currentAnimation !== 'attack') {
                            this.playAnimation(mesh, 'attack');
                        }
                    } else {
                        if (mesh.userData.currentAnimation !== 'idle') {
                            this.playAnimation(mesh, 'idle');
                        }
                    }
                } else {
                    // If no animation mixer, check if player was recently hit for stagger and blood effect
                    const wasRecentlyHit = player.lastHitTime && (Date.now() - player.lastHitTime < 500);
                    if (wasRecentlyHit && player.isAlive && this.objectsController) {
                        // Create stagger visual effect (simple animation without mixer)
                        if (!mesh.userData.staggerEffect) {
                            mesh.userData.staggerEffect = true;
                            mesh.userData.staggerStart = Date.now();
                            
                            // Create blood spray effect
                            this.objectsController.createBloodSpray(player.position);
                            
                            // Apply visual shake to the player mesh
                            const applyStaggerEffect = () => {
                                const elapsed = Date.now() - mesh.userData.staggerStart;
                                if (elapsed < 500) {
                                    // Apply random shake
                                    mesh.position.x += (Math.random() - 0.5) * 0.1;
                                    mesh.position.z += (Math.random() - 0.5) * 0.1;
                                    requestAnimationFrame(applyStaggerEffect);
                                } else {
                                    mesh.userData.staggerEffect = false;
                                }
                            };
                            
                            applyStaggerEffect();
                        }
                    }
                }
                
                // Update health bar
                this.objectsController.updatePlayerHealthBar(mesh, player.health);
                
                // Update player visibility based on alive status
                mesh.visible = player.isAlive;
            }
        }
        
        // Update hammer meshes
        for (let i = 0; i < this.hammers.length; i++) {
            const hammer = this.hammers[i];
            const mesh = this.hammerMeshes[hammer.id];
            
            if (mesh && hammer) {
                mesh.position.copy(hammer.position);
                
                // Apply the rotations while preserving initial orientation
                if (mesh.userData.initialRotation) {
                    mesh.rotation.set(
                        mesh.userData.initialRotation.x + Number(hammer.rotation.x || 0),
                        mesh.userData.initialRotation.y + Number(hammer.rotation.y || 0),
                        mesh.userData.initialRotation.z + Number(hammer.rotation.z || 0)
                    );
                } else {
                    // Fallback for hammers without initial orientation data
                    mesh.rotation.set(
                        Number(hammer.rotation.x || 0),
                        Number(hammer.rotation.y || 0),
                        Number(hammer.rotation.z || 0)
                    );
                }
                
                // For active hammers, apply a smoother continuous rotation
                if (hammer.active) {
                    // Store rotation speed if not set already
                    if (!mesh.userData.rotationSpeed) {
                        mesh.userData.rotationSpeed = {
                            x: 0.05 + Math.random() * 0.03, // Slightly random speed
                            y: 0.03 + Math.random() * 0.02,
                            z: 0.01 + Math.random() * 0.02
                        };
                    }
                    
                    // Apply smoother rotation with consistent speed
                    mesh.rotateOnAxis(new THREE.Vector3(1, 0, 0), mesh.userData.rotationSpeed.x);
                    mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), mesh.userData.rotationSpeed.y);
                }
            }
        }
        
        // Update powerups
        if (this.objectsController) {
            this.objectsController.updatePowerups(this.clock.getDelta());
        }
    }
    
    playAnimation(mesh, animationName) {
        if (mesh.userData.actions && mesh.userData.actions[animationName]) {
            if (mesh.userData.currentAction) {
                mesh.userData.currentAction.fadeOut(0.2);
            }
            
            mesh.userData.currentAction = mesh.userData.actions[animationName];
            mesh.userData.currentAction.reset().fadeIn(0.2).play();
            mesh.userData.currentAnimation = animationName;
        }
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update FXAA resolution when window is resized
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
            
            // Find FXAA pass and update resolution
            this.composer.passes.forEach(pass => {
                if (pass.material && pass.material.uniforms && pass.material.uniforms['resolution']) {
                    const pixelRatio = this.renderer.getPixelRatio();
                    pass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
                    pass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
                }
            });
        }
    }
    
    startGame(gameData) {
        this.gameStarted = true;
        
        // Clear previous game objects
        this.clearGameObjects();
        
        // Store local player ID
        this.localPlayerId = this.networkController.socket.id;
        
        // Setup game from server data
        if (gameData.obstacles) {
            // Create obstacles
            for (const obstacle of gameData.obstacles) {
                this.objectsController.createObstacle(obstacle);
            }
            this.obstacles = gameData.obstacles;
        }
        
        // Lock pointer for camera control
        this.renderer.domElement.requestPointerLock();
    }
    
    updateGameState(gameState) {
        // Update players
        this.players = gameState.players;
        
        // Check if local player exists and create mesh if needed
        for (const id in this.players) {
            if (!this.playerMeshes[id]) {
                this.objectsController.createPlayerMesh(id, this.players[id]);
            }
        }
        
        // Update/create/remove hammers
        const hammerIds = gameState.hammers.map(h => h.id);
        
        // Remove hammers that no longer exist
        for (const hammerId in this.hammerMeshes) {
            if (!hammerIds.includes(hammerId)) {
                // Remove hammer mesh
                if (this.hammerMeshes[hammerId]) {
                    this.scene.remove(this.hammerMeshes[hammerId]);
                    delete this.hammerMeshes[hammerId];
                }
            }
        }
        
        // Also check our local hammers array and clean up any that aren't in the gameState
        for (let i = this.hammers.length - 1; i >= 0; i--) {
            const hammer = this.hammers[i];
            if (!hammerIds.includes(hammer.id)) {
                // Remove hammer from array
                this.hammers.splice(i, 1);
            }
        }
        
        // Update/create hammers
        for (const hammer of gameState.hammers) {
            const existingIndex = this.hammers.findIndex(h => h.id === hammer.id);
            if (existingIndex >= 0) {
                // Update existing hammer
                this.hammers[existingIndex] = hammer;
            } else {
                // Create new hammer
                this.hammers.push(hammer);
                this.objectsController.createHammerMesh(hammer);
            }
        }
        
        // Update/create/remove powerups
        if (gameState.powerups) {
            const powerupIds = gameState.powerups.map(p => p.id);
            
            // Remove powerups that no longer exist
            if (this.powerupMeshes) {
                for (const powerupId in this.powerupMeshes) {
                    if (!powerupIds.includes(powerupId)) {
                        // Remove powerup mesh
                        if (this.powerupMeshes[powerupId]) {
                            this.scene.remove(this.powerupMeshes[powerupId]);
                            delete this.powerupMeshes[powerupId];
                        }
                    }
                }
            }
            
            // Also check our local powerups array and clean up any that aren't in the gameState
            for (let i = this.powerups.length - 1; i >= 0; i--) {
                const powerup = this.powerups[i];
                if (!powerupIds.includes(powerup.id)) {
                    // Remove powerup from array
                    this.powerups.splice(i, 1);
                }
            }
            
            // Update/create powerups
            for (const powerup of gameState.powerups) {
                const existingIndex = this.powerups.findIndex(p => p.id === powerup.id);
                if (existingIndex >= 0) {
                    // Update existing powerup
                    this.powerups[existingIndex] = powerup;
                } else {
                    // Create new powerup
                    this.powerups.push(powerup);
                    this.objectsController.createPowerup(powerup);
                }
            }
        }
    }
    
    clearGameObjects() {
        // Remove all player meshes
        for (const id in this.playerMeshes) {
            this.scene.remove(this.playerMeshes[id]);
        }
        this.playerMeshes = {};
        
        // Remove all hammer meshes
        for (const id in this.hammerMeshes) {
            this.scene.remove(this.hammerMeshes[id]);
        }
        this.hammerMeshes = {};
        
        // Remove all powerup meshes
        if (this.powerupMeshes) {
            for (const id in this.powerupMeshes) {
                this.scene.remove(this.powerupMeshes[id]);
            }
            this.powerupMeshes = {};
        }
        
        // Remove all obstacles
        for (const obstacle of this.obstacles) {
            const mesh = obstacle.mesh;
            if (mesh) {
                this.scene.remove(mesh);
            }
        }
        this.obstacles = [];
        
        // Reset game state
        this.players = {};
        this.hammers = [];
        this.powerups = [];
    }
    
    endGame(data) {
        this.gameStarted = false;
        
        // Show game over screen
        this.uiController.showGameOver(data);
        
        // Exit pointer lock
        document.exitPointerLock();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Calculate delta time
        const now = Date.now();
        const deltaTime = now - this.lastUpdate;
        this.lastUpdate = now;
        
        // Skip if too long between frames (e.g. tab was inactive)
        if (deltaTime > 1000) return;
        
        // Reduce render frequency significantly when not focused or game not started
        const isDocumentFocused = document.hasFocus();
        if (!isDocumentFocused && !this.gameStarted) {
            // Render at much lower frequency when tab is not focused
            if (now % 8 !== 0) return; // Only render every 8th frame (1/8 framerate)
        } else if (!this.gameStarted) {
            // Reduce framerate in menu screens
            if (now % 2 !== 0) return; // Half framerate
        }
        
        // Update local player
        if (this.gameStarted) {
            this.updateLocalPlayer(deltaTime);
            this.updateGameObjects();
        }
        
        // Render using FXAA composer instead of renderer directly
        if (this.composer) {
            this.composer.render();
        } else {
            // Fallback to direct rendering if composer not available
            this.renderer.render(this.scene, this.camera);
        }
    }

    render() {
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Wait for other scripts to load before initializing
window.addEventListener('load', () => {
    // Wait for THREE to be defined
    if (typeof THREE === 'undefined') {
        console.log('Waiting for THREE.js to load...');
        const checkForThree = setInterval(() => {
            console.log('Checking for THREE.js...');
            if (typeof THREE !== 'undefined') {
                console.log('THREE.js loaded, initializing game');
                clearInterval(checkForThree);
                window.game = new Game();
            }
        }, 100);
        
        // If THREE doesn't load after 5 seconds, alert the user
        setTimeout(() => {
            if (typeof THREE === 'undefined') {
                console.error('THREE.js failed to load after waiting 5 seconds');
                alert('Failed to load 3D graphics library. Please refresh the page.');
                clearInterval(checkForThree);
            }
        }, 5000);
    } else {
        console.log('THREE.js already loaded, initializing game');
        window.game = new Game();
    }
}); 