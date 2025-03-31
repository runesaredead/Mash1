// Input controller
class InputController {
    constructor(game) {
        this.game = game;
        
        // Movement state
        this.movement = {
            forward: 0,
            right: 0,
            running: false
        };
        
        // Action state
        this.jump = false;
        this.throw = false;
        this.throwDirection = { x: 0, y: 0, z: -1 };
        this.throwPower = 1;
        
        // Melee attack state
        this.melee = false;
        this.meleeLastTime = 0;
        this.meleeCooldown = 500; // 500ms cooldown between melee attacks
        this.meleeSwinging = false; // Track if hammer is currently in swing animation
        this.meleeSwingStartTime = 0; // Time when the current swing started
        this.meleeSwingDuration = 300; // How long the swing animation lasts
        this.fpvHammerRestPosition = null; // Store the resting position of the hammer
        
        // Track staggered state UI
        this.staggerMessageShown = false;
        
        // Throw direction locking
        this.isAiming = false;
        this.lockedThrowDirection = null;
        this.aimStartTime = 0;
        this.aimTimeout = 0; // Lock direction immediately when mouse is pressed
        this.lastThrowTime = 0;
        
        // Always use camera-based throwing (remove manual throw mode)
        this.throwMode = 'camera';
        
        // Track whether input changed since last update
        this.inputChanged = false;
        
        // Mouse look variables
        this.mouseSensitivity = 0.002;
        this.mouseX = 0;
        this.mouseY = 0;
        this.pitchObject = new THREE.Object3D();
        this.yawObject = new THREE.Object3D();
        
        // Setup camera for FPS controls
        this.yawObject.add(this.pitchObject);
        this.pitchObject.position.y = game.cameraOffset * 0.7; // Lower height to be inside the body
        this.pitchObject.add(game.camera);
        this.game.scene.add(this.yawObject);
        
        // Create first-person hammer view
        this.fpvHammer = null;
        this.createFPVHammer();
        
        // Setup event listeners
        this.setupKeyboardControls();
        this.setupMouseControls();
    }
    
    setupKeyboardControls() {
        // Key state
        this.keys = {};
        
        // Keyboard event listeners
        document.addEventListener('keydown', (event) => this.onKeyDown(event), false);
        document.addEventListener('keyup', (event) => this.onKeyUp(event), false);
    }
    
    setupMouseControls() {
        // Mouse event listeners
        document.addEventListener('mousemove', (event) => this.onMouseMove(event), false);
        document.addEventListener('mousedown', (event) => this.onMouseDown(event), false);
        document.addEventListener('mouseup', (event) => this.onMouseUp(event), false);
        
        // Prevent context menu on right-click
        this.game.renderer.domElement.addEventListener('contextmenu', (event) => this.onContextMenu(event), false);
        
        // Pointer lock change event listener
        document.addEventListener('pointerlockchange', () => this.onPointerLockChange(), false);
    }
    
    onKeyDown(event) {
        // Skip if in text input
        if (event.target.tagName === 'INPUT') return;
        
        this.keys[event.code] = true;
        
        // Track arrow keys for directional throwing (removed manual throw toggle)
        if (event.code === 'ArrowUp') this.throwDirectionKeys.up = true;
        if (event.code === 'ArrowDown') this.throwDirectionKeys.down = true;
        if (event.code === 'ArrowLeft') this.throwDirectionKeys.left = true;
        if (event.code === 'ArrowRight') this.throwDirectionKeys.right = true;
        
        this.updateMovement();
    }
    
    onKeyUp(event) {
        this.keys[event.code] = false;
        
        // Track arrow keys for directional throwing
        if (event.code === 'ArrowUp') this.throwDirectionKeys.up = false;
        if (event.code === 'ArrowDown') this.throwDirectionKeys.down = false;
        if (event.code === 'ArrowLeft') this.throwDirectionKeys.left = false;
        if (event.code === 'ArrowRight') this.throwDirectionKeys.right = false;
        
        this.updateMovement();
    }
    
    updateMovement() {
        const oldForward = this.movement.forward;
        const oldRight = this.movement.right;
        const oldRunning = this.movement.running;
        
        // WASD movement - Fix W/S direction by flipping the values
        this.movement.forward = 0;
        if (this.keys['KeyW']) this.movement.forward -= 1; // Flip to negative for forward
        if (this.keys['KeyS']) this.movement.forward += 1; // Flip to positive for backward
        
        this.movement.right = 0;
        if (this.keys['KeyD']) this.movement.right += 1;
        if (this.keys['KeyA']) this.movement.right -= 1;
        
        // Shift for sprint
        this.movement.running = !!this.keys['ShiftLeft'];
        
        // Space for jump
        if (this.keys['Space'] && !this.jump) {
            this.jump = true;
            this.inputChanged = true;
        }
        
        // Check if movement changed
        if (
            oldForward !== this.movement.forward ||
            oldRight !== this.movement.right ||
            oldRunning !== this.movement.running
        ) {
            this.inputChanged = true;
        }
    }
    
    onMouseMove(event) {
        if (document.pointerLockElement === this.game.renderer.domElement) {
            // Calculate mouse movement with sensitivity
            this.mouseX = event.movementX || 0;
            this.mouseY = event.movementY || 0;
            
            // Rotate yaw (left/right)
            this.yawObject.rotation.y -= this.mouseX * this.mouseSensitivity;
            
            // Rotate pitch (up/down) with limits to prevent going upside down
            // More strict limits than before
            this.pitchObject.rotation.x -= this.mouseY * this.mouseSensitivity;
            this.pitchObject.rotation.x = Math.max(
                -Math.PI / 2.5, 
                Math.min(Math.PI / 2.5, this.pitchObject.rotation.x)
            );
            
            // Update game camera rotation
            this.game.camera.rotation.x = this.pitchObject.rotation.x;
            this.game.camera.rotation.y = this.yawObject.rotation.y;
            
            // Set throw direction based on camera
            this.updateThrowDirection();
            
            this.inputChanged = true;
        }
    }
    
    onMouseDown(event) {
        if (document.pointerLockElement === this.game.renderer.domElement) {
            if (event.button === 0) { // Left click
                // Start aiming when mouse button is pressed
                this.isAiming = true;
                this.aimStartTime = Date.now();
                
                // Force update to get the most current camera direction right before throwing
                // Always use the camera direction at the exact moment of the click
                const direction = new THREE.Vector3(0, 0, -1);
                const cameraWorldQuaternion = new THREE.Quaternion();
                this.game.camera.getWorldQuaternion(cameraWorldQuaternion);
                direction.applyQuaternion(cameraWorldQuaternion);
                
                const cameraPosition = new THREE.Vector3();
                this.game.camera.getWorldPosition(cameraPosition);
                
                // Store fresh camera direction and origin
                this.throwDirection = {
                    x: direction.x,
                    y: direction.y,
                    z: direction.z
                };
                
                this.throwOrigin = {
                    x: cameraPosition.x,
                    y: cameraPosition.y,
                    z: cameraPosition.z
                };
                
                // Lock this direction
                this.lockedThrowDirection = { ...this.throwDirection };
                this.lastThrowOrigin = { ...this.throwOrigin };
                
                // Set throw action
                this.throw = true;
                this.inputChanged = true;
                this.lastThrowTime = Date.now();
                
                // Debug log to confirm direction
                console.log('Throw direction locked:', this.lockedThrowDirection);
            } else if (event.button === 2) { // Right click - melee attack
                const now = Date.now();
                // Check cooldown
                if (now - this.meleeLastTime > this.meleeCooldown) {
                    this.melee = true;
                    this.meleeLastTime = now;
                    this.inputChanged = true;
                }
            }
        } else {
            // Request pointer lock if clicked on game
            if (event.target === this.game.renderer.domElement) {
                this.game.renderer.domElement.requestPointerLock();
            }
        }
    }
    
    onMouseUp(event) {
        // Reset aim state
        if (event.button === 0) {
            this.isAiming = false;
            this.lockedThrowDirection = null;
        }
        
        // Reset throw power if right click
        if (event.button === 2) {
            this.throwPower = 1;
        }
    }
    
    onPointerLockChange() {
        if (document.pointerLockElement !== this.game.renderer.domElement) {
            // If game is running, show pause menu
            if (this.game.gameStarted) {
                this.game.uiController.showPauseMenu();
            }
        } else {
            // Hide pause menu if game is resumed
            if (this.game.gameStarted) {
                this.game.uiController.hidePauseMenu();
            }
        }
    }
    
    updateThrowDirection() {
        // Always use fresh camera-based direction regardless of aiming state
        // Reset the direction vector each time
        const direction = new THREE.Vector3(0, 0, -1);
        
        // Get the camera's world quaternion for consistent direction calculation
        const cameraWorldQuaternion = new THREE.Quaternion();
        this.game.camera.getWorldQuaternion(cameraWorldQuaternion);
        
        // Apply quaternion to get precise direction
        direction.applyQuaternion(cameraWorldQuaternion);
        
        // Get exact camera world position
        const cameraPosition = new THREE.Vector3();
        this.game.camera.getWorldPosition(cameraPosition);
        
        // Store values in plain objects to ensure they can be serialized for network transmission
        this.throwDirection = {
            x: direction.x,
            y: direction.y,
            z: direction.z
        };
        
        this.throwOrigin = {
            x: cameraPosition.x,
            y: cameraPosition.y,
            z: cameraPosition.z
        };
        
        // Now update the locked direction as well to always match current camera direction
        if (this.isAiming) {
            this.lockedThrowDirection = { ...this.throwDirection };
            this.lastThrowOrigin = { ...this.throwOrigin };
        }
    }
    
    updatePlayerPosition() {
        // Only update if we have a valid player
        if (this.game.localPlayerId && this.game.players[this.game.localPlayerId]) {
            const player = this.game.players[this.game.localPlayerId];
            
            // Update yaw object position to match player position precisely
            this.yawObject.position.set(
                player.position.x,
                player.position.y,
                player.position.z
            );
            
            // Update player rotation to match camera yaw (horizontal rotation only)
            player.rotation.y = this.yawObject.rotation.y;
            
            // Ensure the camera local position is reset each update
            this.game.camera.position.set(0, 0, 0);
            this.game.camera.rotation.set(this.pitchObject.rotation.x, 0, 0);
            
            // Check for staggered state and update UI if needed
            if (player.isStaggered) {
                if (this.game.uiController && !this.staggerMessageShown) {
                    this.game.uiController.showTemporaryMessage('STUNNED!', 500);
                    this.staggerMessageShown = true;
                }
            } else if (this.staggerMessageShown) {
                this.staggerMessageShown = false;
            }
            
            // Update throw direction immediately after camera position update
            // This ensures throw direction is always in sync with camera
            this.updateThrowDirection();
        }
    }
    
    reset() {
        // Reset all input state
        this.keys = {};
        this.movement = { forward: 0, right: 0, running: false };
        this.jump = false;
        this.throw = false;
        this.melee = false;
        this.inputChanged = false;
        this.throwDirectionKeys = { up: false, down: false, left: false, right: false };
        this.staggerMessageShown = false;
        
        // Reset camera rotation
        this.pitchObject.rotation.x = 0;
        this.yawObject.rotation.y = 0;
    }
    
    update(deltaTime) {
        // Always update throw direction at the start of each update
        this.updateThrowDirection();
        
        // Make sure we continually send input updates when moving
        // This ensures smooth, continuous movement
        if (this.movement.forward !== 0 || this.movement.right !== 0) {
            this.inputChanged = true;
        }
        
        // If the player initiated a melee attack, make sure we send it
        if (this.melee) {
            this.inputChanged = true;
            
            // Show melee attack visual feedback
            this.showMeleeVisualFeedback();
        }
        
        // Update FPS hammer view
        this.updateFPVHammer(deltaTime);
        
        // If throw action is active, ensure we're using camera direction
        if (this.throw) {
            this.updateThrowDirection();
        }
    }
    
    createFPVHammer() {
        // Clone the hammer geometry from objects controller
        if (this.game.objectsController && this.game.objectsController.hammerGeometry) {
            this.fpvHammer = this.game.objectsController.hammerGeometry.clone();
            
            // Position for first-person view (lower right corner of screen)
            this.fpvHammer.position.set(0.4, -0.3, -0.7);
            this.fpvHammer.rotation.set(0, -Math.PI / 4, 0); // Adjust rotation for FPV
            this.fpvHammer.scale.set(0.4, 0.4, 0.4); // Make it smaller
            
            // Store the resting position and rotation
            this.fpvHammerRestPosition = {
                x: 0.4,
                y: -0.3,
                z: -0.7,
                rotX: 0,
                rotY: -Math.PI / 4,
                rotZ: 0
            };
            
            // Add slight bobbing animation
            this.fpvHammer.userData.bobTime = 0;
            
            // Initially hide the hammer
            this.fpvHammer.visible = false;
            
            // Add to camera
            this.game.camera.add(this.fpvHammer);
        }
    }
    
    updateFPVHammer(deltaTime) {
        if (!this.fpvHammer) return;
        
        // Check if player has hammers
        const player = this.game.players[this.game.localPlayerId];
        if (player && player.hammers > 0) {
            this.fpvHammer.visible = true;
            
            // Handle melee swing animation start
            if (this.melee && !this.meleeSwinging) {
                // Store current position for smooth transition back
                this.fpvHammerPreSwingPosition = {
                    x: this.fpvHammer.position.x,
                    y: this.fpvHammer.position.y,
                    z: this.fpvHammer.position.z,
                    rotX: this.fpvHammer.rotation.x,
                    rotY: this.fpvHammer.rotation.y,
                    rotZ: this.fpvHammer.rotation.z
                };
                
                // Mark as swinging and start animation
                this.meleeSwinging = true;
                this.meleeSwingStartTime = Date.now();
                this.meleeSwingDuration = 300; // 300ms for the swing animation
                
                // End of swing after duration
                setTimeout(() => {
                    // Don't immediately stop swinging - transition back smoothly
                    this.meleeReturnStartTime = Date.now();
                    this.meleeReturnDuration = 150; // 150ms for return animation
                    
                    // After return animation, fully reset
                setTimeout(() => {
                    this.meleeSwinging = false;
                    this.melee = false;
                        this.meleeReturning = false;
                    }, this.meleeReturnDuration);
                    
                    // Flag that we're in return phase
                    this.meleeReturning = true;
                }, this.meleeSwingDuration);
            }
            
            // Animate the hammer based on state
            if (this.meleeSwinging) {
                if (this.meleeReturning) {
                    // Handle return to idle animation
                    const elapsed = Date.now() - this.meleeReturnStartTime;
                    const progress = Math.min(elapsed / this.meleeReturnDuration, 1);
                    
                    // Smoothly interpolate back to resting position
                    // End of swing is stored in post-swing position
                    const swingEndPos = {
                        x: this.fpvHammer.position.x,
                        y: this.fpvHammer.position.y,
                        z: this.fpvHammer.position.z,
                        rotX: this.fpvHammer.rotation.x,
                        rotY: this.fpvHammer.rotation.y,
                        rotZ: this.fpvHammer.rotation.z
                    };
                    
                    // Lerp from swing end position to rest position
                    this.fpvHammer.position.set(
                        this.lerp(swingEndPos.x, this.fpvHammerRestPosition.x, progress),
                        this.lerp(swingEndPos.y, this.fpvHammerRestPosition.y, progress),
                        this.lerp(swingEndPos.z, this.fpvHammerRestPosition.z, progress)
                    );
                    
                    // Lerp rotation back to rest
                    this.fpvHammer.rotation.set(
                        this.lerp(swingEndPos.rotX, this.fpvHammerRestPosition.rotX, progress),
                        this.lerp(swingEndPos.rotY, this.fpvHammerRestPosition.rotY, progress),
                        this.lerp(swingEndPos.rotZ, this.fpvHammerRestPosition.rotZ, progress)
                    );
                } else {
                    // Regular swing animation
                    // Calculate swing progress (0 to 1)
                    const elapsed = Date.now() - this.meleeSwingStartTime;
                    const progress = Math.min(elapsed / this.meleeSwingDuration, 1);
                    
                    // Create a natural swing arc movement
                    // First half of animation - wind up
                    // Second half - follow through
                    if (progress < 0.5) {
                        // Wind up phase (0 to 0.5 progress)
                        const windupProgress = progress * 2; // Scale to 0-1 range
                        
                        // Move hammer back and to the right slightly
                        this.fpvHammer.position.set(
                            this.fpvHammerRestPosition.x + 0.1 * windupProgress, 
                            this.fpvHammerRestPosition.y + 0.05 * windupProgress,
                            this.fpvHammerRestPosition.z + 0.1 * windupProgress
                        );
                        
                        // Rotate hammer back for windup
                        this.fpvHammer.rotation.set(
                            this.fpvHammerRestPosition.rotX - 0.2 * windupProgress,
                            this.fpvHammerRestPosition.rotY + 0.3 * windupProgress,
                            this.fpvHammerRestPosition.rotZ - 0.3 * windupProgress
                        );
                    } else {
                        // Swing phase (0.5 to 1 progress)
                        const swingProgress = (progress - 0.5) * 2; // Scale to 0-1 range
                        
                        // Move hammer forward in a natural arc
                        this.fpvHammer.position.set(
                            this.fpvHammerRestPosition.x - 0.2 * swingProgress, 
                            this.fpvHammerRestPosition.y - 0.1 * Math.sin(swingProgress * Math.PI), // Arc motion
                            this.fpvHammerRestPosition.z - 0.3 * swingProgress
                        );
                        
                        // Rotate hammer through the swing
                        this.fpvHammer.rotation.set(
                            this.fpvHammerRestPosition.rotX + 0.3 * swingProgress,
                            this.fpvHammerRestPosition.rotY - 0.5 * swingProgress,
                            this.fpvHammerRestPosition.rotZ + 0.5 * swingProgress
                        );
                    }
                }
            } else {
                // Normal hammer idle and movement animation
                
                // Calculate breathing animation
                this.fpvHammer.userData.bobTime += deltaTime * 0.3; // Very slow animation for breathing
                const breathOffset = Math.sin(this.fpvHammer.userData.bobTime * 0.5) * 0.002; // Extremely subtle
                
                // Get player movement for movement-based bobbing
                let movementBob = 0;
                let movementSway = 0;
                
                // Only apply movement bobbing when player is moving
                if (Math.abs(this.movement.forward) > 0 || Math.abs(this.movement.right) > 0) {
                    // Calculate a movement cycle based on time
                    const movementCycle = Date.now() % 1000 / 1000; // 0 to 1 over 1 second
                    
                    // Calculate vertical bobbing - subtle up and down twice per cycle
                    movementBob = Math.sin(movementCycle * Math.PI * 2) * 0.004;
                    
                    // Calculate side-to-side sway - once per cycle
                    movementSway = Math.cos(movementCycle * Math.PI) * 0.003;
                    
                    // Increase amplitude if running
                    if (this.movement.running) {
                        movementBob *= 1.5;
                        movementSway *= 1.5;
                    }
                }
                
                // Apply very subtle combination of breathing and movement effects
                this.fpvHammer.position.set(
                    this.fpvHammerRestPosition.x + movementSway,
                    this.fpvHammerRestPosition.y + breathOffset + movementBob,
                    this.fpvHammerRestPosition.z
                );
                
                // Apply very gentle rotations - combination of breathing and movement
                const rotBreathOffset = Math.sin(this.fpvHammer.userData.bobTime * 0.3) * 0.001; // Extremely subtle rotation
                
                this.fpvHammer.rotation.set(
                    this.fpvHammerRestPosition.rotX + rotBreathOffset + (movementBob * 2), // Tilt slightly with movement
                    this.fpvHammerRestPosition.rotY,
                    this.fpvHammerRestPosition.rotZ + (movementSway * 2) // Slight rotation with side sway
                );
            }
        } else {
            this.fpvHammer.visible = false;
        }
    }
    
    // Helper function for linear interpolation
    lerp(start, end, t) {
        return start * (1 - t) + end * t;
    }
    
    showMeleeVisualFeedback() {
        // Get player for directional information
        const player = this.game.players[this.game.localPlayerId];
        if (!player) return;
        
        // Get a fresh direction vector directly from the camera
        // Create a forward vector in local camera space
        const forward = new THREE.Vector3(0, 0, -1);
        
        // Convert camera-local direction to world space
        forward.applyMatrix4(this.game.camera.matrixWorld);
        
        // Convert to a direction vector by subtracting camera position
        const cameraPosition = new THREE.Vector3();
        this.game.camera.getWorldPosition(cameraPosition);
        
        // Calculate direction from camera into world
        const direction = new THREE.Vector3().subVectors(forward, cameraPosition).normalize();
        
        // Store the direction in the player object for the game engine to use
        player.lastMeleeDirection = {
            x: direction.x,
            y: direction.y,
            z: direction.z
        };
        
        // Set the player's melee flag for gameplay functionality
        if (this.game.players[this.game.localPlayerId]) {
            this.game.players[this.game.localPlayerId].meleeActive = true;
            
            // Reset the melee flag after the animation completes
            setTimeout(() => {
                if (this.game.players[this.game.localPlayerId]) {
                    this.game.players[this.game.localPlayerId].meleeActive = false;
                }
            }, this.meleeSwingDuration);
        }
        
        // We don't call animateMeleeSwing for the local player anymore
        // This prevents the third-person hammer from appearing in first-person view
    }
    
    onContextMenu(event) {
        // Prevent the browser's context menu from appearing on right-click
        event.preventDefault();
        return false;
    }
} 