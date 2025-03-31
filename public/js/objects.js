// Objects controller
class ObjectsController {
    constructor(game) {
        this.game = game;
        
        // Initialize geometries for reuse
        this.playerGeometry = new THREE.BoxGeometry(1, 2, 1);
        this.hammerGeometry = new THREE.Group(); // Will be initialized in createHammerGeometry()
        
        // Create basic materials
        this.playerMaterial = new THREE.MeshPhongMaterial({ color: 0x2194ce });
        this.hammerMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xc0c0c0,  // Metallic silver
            metalness: 0.8,
            roughness: 0.2
        });
        this.hammerHandleMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x5c3a21,  // Brown wood
            metalness: 0.0,
            roughness: 0.8
        });
        
        // Initialize geometries
        this.createHammerGeometry();
        
        // Create color map for players
        this.playerColors = [
            0xff0000, // Red
            0x00ff00, // Green
            0x0000ff, // Blue
            0xffff00, // Yellow
            0xff00ff, // Magenta
            0x00ffff, // Cyan
            0xff8000, // Orange
            0x8000ff, // Purple
            0x00ff80, // Lime
            0xff0080  // Pink
        ];
        
        // Store melee hammers for third-person view
        this.meleeHammers = {};
    }
    
    createHammerGeometry() {
        // Create the hammer head (Box) - further simplified with fewer segments
        const headGeometry = new THREE.BoxGeometry(1.2, 0.7, 0.6, 1, 1, 1);
        const head = new THREE.Mesh(headGeometry, this.hammerMaterial);
        head.position.set(0, 0, 0);
        head.castShadow = true; // Only head casts shadows
        
        // Create the hammer handle (Cylinder) - simplified
        const handleGeometry = new THREE.CylinderGeometry(0.12, 0.12, 1.7, 4);
        const handle = new THREE.Mesh(handleGeometry, this.hammerHandleMaterial);
        handle.position.set(0, -0.9, 0);
        handle.castShadow = false;
        
        // Create a small cylinder at the end of the handle
        const endGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 4);
        const end = new THREE.Mesh(endGeometry, this.hammerMaterial);
        end.position.set(0, -1.75, 0);
        end.castShadow = false;
        
        // Add to group
        this.hammerGeometry.add(head);
        this.hammerGeometry.add(handle);
        this.hammerGeometry.add(end);
        
        // Rotate for better orientation
        this.hammerGeometry.rotation.set(Math.PI / 2, 0, 0);
        
        // Set initial rotation
        this.hammerGeometry.userData.initialRotation = {
            x: Math.PI / 2,
            y: 0,
            z: 0
        };
    }
    
    createPlayerMesh(id, player) {
        // Check if mesh already exists
        if (this.game.playerMeshes[id]) {
            return this.game.playerMeshes[id];
        }
        
        // Determine color based on ID
        const colorIndex = parseInt(id.replace(/[^0-9]/g, '')) % this.playerColors.length;
        const color = this.playerColors[colorIndex];
        
        // Create player material with assigned color - simpler material
        const material = new THREE.MeshBasicMaterial({ color });
        
        // Create player body (for now a simple box)
        const body = new THREE.Mesh(this.playerGeometry, material);
        body.castShadow = true;
        body.receiveShadow = false; // Players don't need to receive shadows
        
        // Add body to group for future animation support
        const playerMesh = new THREE.Group();
        playerMesh.add(body);
        
        // Initialize position and rotation
        playerMesh.position.copy(new THREE.Vector3(
            player.position.x,
            player.position.y,
            player.position.z
        ));
        
        playerMesh.rotation.copy(new THREE.Euler(
            player.rotation.x || 0,
            player.rotation.y || 0,
            player.rotation.z || 0
        ));
        
        // Add to scene
        this.game.scene.add(playerMesh);
        
        // Store reference
        this.game.playerMeshes[id] = playerMesh;
        
        // Create health bar
        this.createPlayerHealthBar(playerMesh, player);
        
        return playerMesh;
    }
    
    createPlayerHealthBar(playerMesh, player) {
        // Create container for health bar
        const healthBarContainer = new THREE.Group();
        
        // Create background
        const bgGeometry = new THREE.PlaneGeometry(1.2, 0.2);
        const bgMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            transparent: true,
            opacity: 0.5
        });
        const background = new THREE.Mesh(bgGeometry, bgMaterial);
        
        // Create health fill
        const fillGeometry = new THREE.PlaneGeometry(1.0, 0.1);
        const fillMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const fill = new THREE.Mesh(fillGeometry, fillMaterial);
        fill.position.z = 0.01; // Slightly in front of background
        
        // Add to container
        healthBarContainer.add(background);
        healthBarContainer.add(fill);
        
        // Position above player
        healthBarContainer.position.y = 1.5;
        healthBarContainer.rotation.x = -Math.PI / 2; // Face upward
        
        // Add to player mesh
        playerMesh.add(healthBarContainer);
        
        // Store reference for updates
        playerMesh.userData.healthBar = fill;
        playerMesh.userData.healthBarMaterial = fillMaterial;
    }
    
    updatePlayerHealthBar(playerMesh, health) {
        if (playerMesh.userData.healthBar) {
            // Force handling for zero health by duplicating the condition
            // This way we check for health <= 0 even if something else modifies it
            if (health <= 0 || !playerMesh.visible) {
                // Set health bar to empty
                playerMesh.userData.healthBar.scale.x = 0;
                playerMesh.userData.healthBarMaterial.color.setHex(0xff0000); // Bright red
                
                // Force visible to ensure we can see the empty state
                playerMesh.userData.healthBar.visible = true;
                
                // Create dramatic death effect with blood if not already done
                if (!playerMesh.userData.deathEffectShown) {
                    playerMesh.userData.deathEffectShown = true;
                    
                    // Get position from player mesh
                    const position = playerMesh.position.clone();
                    
                    // Create larger blood effect
                    this.createBloodSpray({
                        x: position.x,
                        y: position.y + 1.0, // Position at center of player
                        z: position.z
                    });
                    
                    // Create more blood spatters around the player
                    for (let i = 0; i < 3; i++) {
                        const offset = {
                            x: (Math.random() - 0.5) * 1.5,
                            y: 0,
                            z: (Math.random() - 0.5) * 1.5
                        };
                        
                        this.createBloodSplatter({
                            x: position.x + offset.x,
                            y: 0.01, // Just above ground
                            z: position.z + offset.z
                        });
                    }
                }
            } else {
                // Update health bar fill width based on health percentage
                const healthPercent = health / 3; // 3 is max health
                playerMesh.userData.healthBar.scale.x = healthPercent;
                
                // Update color based on health (green to yellow to red)
                if (healthPercent > 0.6) {
                    playerMesh.userData.healthBarMaterial.color.setHex(0x00ff00); // Green
                } else if (healthPercent > 0.3) {
                    playerMesh.userData.healthBarMaterial.color.setHex(0xffff00); // Yellow
                } else {
                    playerMesh.userData.healthBarMaterial.color.setHex(0xff0000); // Red
                }
            }
        }
    }
    
    createHammerMesh(hammer) {
        // Check if mesh already exists
        if (this.game.hammerMeshes[hammer.id]) {
            return this.game.hammerMeshes[hammer.id];
        }
        
        // Clone hammer geometry
        const hammerMesh = this.hammerGeometry.clone();
        
        // Store reference to initial rotation
        hammerMesh.userData.initialRotation = { ...this.hammerGeometry.userData.initialRotation };
        
        // Initialize position and rotation
        hammerMesh.position.copy(new THREE.Vector3(
            hammer.position.x,
            hammer.position.y,
            hammer.position.z
        ));
        
        // Set rotation based on hammer data and initial orientation
        hammerMesh.rotation.set(
            hammerMesh.userData.initialRotation.x + (hammer.rotation.x || 0),
            hammerMesh.userData.initialRotation.y + (hammer.rotation.y || 0),
            hammerMesh.userData.initialRotation.z + (hammer.rotation.z || 0)
        );
        
        // Add to scene
        this.game.scene.add(hammerMesh);
        
        // Store reference
        this.game.hammerMeshes[hammer.id] = hammerMesh;
        
        return hammerMesh;
    }
    
    // Method to properly dispose of hammer meshes
    disposeHammerMesh(hammerId) {
        const hammerMesh = this.game.hammerMeshes[hammerId];
        if (!hammerMesh) return;
        
        // Remove from scene
        this.game.scene.remove(hammerMesh);
        
        // Dispose of geometries and materials
        hammerMesh.traverse((child) => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        
        // Remove from hammer meshes
        delete this.game.hammerMeshes[hammerId];
    }
    
    createObstacle(obstacle) {
        let mesh;
        
        // Special handling for trampolines
        if (obstacle.type === 'trampoline') {
            // Create simplified trampoline with fewer objects
            const group = new THREE.Group();
            
            // Create the base/frame
            const baseGeometry = new THREE.BoxGeometry(
                obstacle.size.width,
                obstacle.size.height * 0.5,
                obstacle.size.depth
            );
            
            const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
            
            const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
            baseMesh.position.y = -obstacle.size.height * 0.25;
            baseMesh.castShadow = true;
            baseMesh.receiveShadow = false;
            group.add(baseMesh);
            
            // Create the bouncy surface
            const surfaceGeometry = new THREE.BoxGeometry(
                obstacle.size.width * 0.9,
                obstacle.size.height * 0.2,
                obstacle.size.depth * 0.9
            );
            
            const surfaceMaterial = new THREE.MeshBasicMaterial({ color: 0x0000FF });
            
            const surfaceMesh = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
            surfaceMesh.position.y = obstacle.size.height * 0.1;
            surfaceMesh.castShadow = false;
            group.add(surfaceMesh);
            
            // Position the entire trampoline group
            group.position.copy(new THREE.Vector3(
                obstacle.position.x,
                obstacle.position.y,
                obstacle.position.z
            ));
            
            // Add to scene
            this.game.scene.add(group);
            
            // Store reference
            obstacle.mesh = group;
            mesh = group;
            
            // Add bounce animation
            this.setupTrampolineBounceAnimation(obstacle, surfaceMesh);
        } else {
            // Regular obstacle handling
            // Create obstacle geometry based on size
            const geometry = new THREE.BoxGeometry(
                obstacle.size.width,
                obstacle.size.height,
                obstacle.size.depth
            );
            
            // Create material based on type - simpler materials
            let material;
            if (obstacle.type === 'wall') {
                const isOpaque = obstacle.opacity === 1.0;
                material = new THREE.MeshBasicMaterial({ 
                    color: isOpaque ? 0x444444 : 0x808080,
                    transparent: !isOpaque,
                    opacity: obstacle.opacity !== undefined ? obstacle.opacity : 0.7
                });
            } else {
                if (obstacle.color !== undefined) {
                    material = new THREE.MeshBasicMaterial({ 
                        color: obstacle.color,
                        transparent: obstacle.opacity !== 1.0,
                        opacity: obstacle.opacity !== undefined ? obstacle.opacity : 1.0
                    });
                } else {
                    // Random obstacle color
                    const hue = Math.random();
                    const saturation = 0.5;
                    const lightness = 0.5;
                    
                    const color = new THREE.Color().setHSL(hue, saturation, lightness);
                    material = new THREE.MeshBasicMaterial({ color });
                }
            }
            
            // Create mesh
            mesh = new THREE.Mesh(geometry, material);
            
            // Set position and rotation
            mesh.position.copy(new THREE.Vector3(
                obstacle.position.x,
                obstacle.position.y,
                obstacle.position.z
            ));
            
            mesh.rotation.copy(new THREE.Euler(
                obstacle.rotation.x || 0,
                obstacle.rotation.y || 0,
                obstacle.rotation.z || 0
            ));
            
            // Enable shadows for large obstacles only
            const isLarge = obstacle.size.width > 5 || obstacle.size.height > 5 || obstacle.size.depth > 5;
            mesh.castShadow = isLarge;
            mesh.receiveShadow = false;
            
            // Add to scene
            this.game.scene.add(mesh);
            
            // Store reference
            obstacle.mesh = mesh;
        }
        
        return mesh;
    }
    
    setupTrampolineBounceAnimation(obstacle, surfaceMesh) {
        // Set up initial animation state
        obstacle.lastBounce = 0;
        obstacle.isAnimating = false;
        
        // Function to trigger a bounce animation
        obstacle.triggerBounce = () => {
            // Prevent multiple simultaneous animations
            if (obstacle.isAnimating) return;
            
            obstacle.isAnimating = true;
            obstacle.lastBounce = Date.now();
            
            // Store original surface position
            const originalY = surfaceMesh.position.y;
            
            // Simplified animation - just move down then up
            surfaceMesh.position.y = originalY - 0.2;
            
            // Reset position after a short delay
            setTimeout(() => {
                surfaceMesh.position.y = originalY;
                obstacle.isAnimating = false;
            }, 300);
        };
    }
    
    createBloodSpray(position) {
        // Create particle system for blood with more particles and larger size
        const particleCount = 50; // Increased from 20 to 50
        const particles = new THREE.BufferGeometry();
        
        const positions = [];
        const colors = [];
        const sizes = [];
        
        // Create blood color with variations
        const baseColor = new THREE.Color(0xff0000); // Bright red
        const darkColor = new THREE.Color(0x8b0000); // Dark red
        
        for (let i = 0; i < particleCount; i++) {
            // Random position with more spread
            positions.push(
                position.x + (Math.random() - 0.5) * 1.0, // Increased spread
                position.y + (Math.random() - 0.5) * 1.0 + 0.5, // Higher position
                position.z + (Math.random() - 0.5) * 1.0  // Increased spread
            );
            
            // Random color between bright and dark red
            const mixFactor = Math.random();
            const color = new THREE.Color().lerpColors(baseColor, darkColor, mixFactor);
            colors.push(color.r, color.g, color.b);
            
            // Random sizes for particles
            sizes.push(Math.random() * 0.2 + 0.1); // 0.1 to 0.3
        }
        
        particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        particles.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.2, // Larger base size
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
            depthWrite: false, // Prevents z-fighting
            blending: THREE.AdditiveBlending // More vibrant appearance
        });
        
        const particleSystem = new THREE.Points(particles, particleMaterial);
        
        // Add to scene
        this.game.scene.add(particleSystem);
        
        // Create blood splatter on ground/walls
        this.createBloodSplatter(position);
        
        // Set timeout to remove after animation
        setTimeout(() => {
            this.game.scene.remove(particleSystem);
        }, 15000); // Set to 15 seconds to match other death effects
        
        // Animate with more dynamic movement
        const animate = () => {
            // Update particle positions (fall down and spread)
            const positions = particles.attributes.position.array;
            const velocityFactor = 0.1; // Controls speed of movement
            
            for (let i = 0; i < positions.length; i += 3) {
                // Add gravity and random movement
                positions[i] += (Math.random() - 0.5) * velocityFactor; // X
                positions[i + 1] -= 0.1 + Math.random() * 0.1; // Y (falling with variance)
                positions[i + 2] += (Math.random() - 0.5) * velocityFactor; // Z
                
                // Add some spiral effect
                const xOffset = positions[i] - position.x;
                const zOffset = positions[i + 2] - position.z;
                const angle = Math.atan2(zOffset, xOffset) + 0.02;
                const radius = Math.sqrt(xOffset * xOffset + zOffset * zOffset);
                
                positions[i] = position.x + Math.cos(angle) * radius * 0.98;
                positions[i + 2] = position.z + Math.sin(angle) * radius * 0.98;
            }
            
            particles.attributes.position.needsUpdate = true;
            
            // Fade out
            particleMaterial.opacity -= 0.015; // Slower fade (was 0.02)
            
            if (particleMaterial.opacity > 0) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    // New function to create blood splatter effect on surfaces
    createBloodSplatter(position) {
        // Create random splatter textures on surfaces near the hit
        const splatterCount = Math.floor(Math.random() * 3) + 2; // 2-4 splatters
        
        for (let i = 0; i < splatterCount; i++) {
            // Create a circular splatter
            const size = Math.random() * 0.5 + 0.3; // 0.3-0.8 size
            const geometry = new THREE.CircleGeometry(size, 8);
            
            // Create material with blood color and transparency
            const material = new THREE.MeshBasicMaterial({
                color: 0x8b0000, // Dark red
                transparent: true,
                opacity: Math.random() * 0.5 + 0.3, // 0.3-0.8 opacity
                depthWrite: false
            });
            
            const splatter = new THREE.Mesh(geometry, material);
            
            // Position randomly near the hit point
            // Find nearby surface (for this simple version, just place on ground or walls)
            const distance = Math.random() * 1.5 + 0.5; // 0.5-2.0 units away
            const angle = Math.random() * Math.PI * 2;
            
            // Most go on the ground
            if (Math.random() < 0.7) {
                // Ground splatter
                splatter.position.set(
                    position.x + Math.cos(angle) * distance,
                    0.01, // Just above ground
                    position.z + Math.sin(angle) * distance
                );
                splatter.rotation.x = -Math.PI / 2; // Face up
            } else {
                // Wall splatter - find nearest wall
                const wallDistance = 20; // Arbitrary large distance
                splatter.position.set(
                    position.x + Math.cos(angle) * distance,
                    position.y + Math.random() * 1.0,
                    position.z + Math.sin(angle) * distance
                );
                splatter.rotation.y = angle; // Face random direction
            }
            
            // Add to scene
            this.game.scene.add(splatter);
            
            // Remove after a while
            setTimeout(() => {
                this.game.scene.remove(splatter);
            }, 15000); // Fixed 15 seconds to match ragdoll timeout
        }
    }
    
    createRagdoll(position, velocityDirection) {
        // Create a simple ragdoll with physics
        const bodyParts = [];
        
        // Body
        const bodyGeometry = new THREE.BoxGeometry(0.6, 1, 0.3);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.copy(position);
        body.castShadow = true;
        this.game.scene.add(body);
        
        bodyParts.push({
            mesh: body,
            velocity: {
                x: velocityDirection.x * 3,
                y: velocityDirection.y * 3 + 2, // Up
                z: velocityDirection.z * 3
            },
            angularVelocity: {
                x: (Math.random() - 0.5) * 0.2,
                y: (Math.random() - 0.5) * 0.2,
                z: (Math.random() - 0.5) * 0.2
            }
        });
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
        const headMaterial = new THREE.MeshPhongMaterial({ color: 0xffcccc });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(position.x, position.y + 0.7, position.z);
        head.castShadow = true;
        this.game.scene.add(head);
        
        bodyParts.push({
            mesh: head,
            velocity: {
                x: velocityDirection.x * 4,
                y: velocityDirection.y * 4 + 3, // More up
                z: velocityDirection.z * 4
            },
            angularVelocity: {
                x: (Math.random() - 0.5) * 0.3,
                y: (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.3
            }
        });
        
        // Arms
        const armGeometry = new THREE.BoxGeometry(0.2, 0.7, 0.2);
        const armMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(position.x + 0.4, position.y, position.z);
        leftArm.castShadow = true;
        this.game.scene.add(leftArm);
        
        bodyParts.push({
            mesh: leftArm,
            velocity: {
                x: velocityDirection.x * 3.5 + 1, // More right
                y: velocityDirection.y * 3.5 + 2,
                z: velocityDirection.z * 3.5
            },
            angularVelocity: {
                x: (Math.random() - 0.5) * 0.4,
                y: (Math.random() - 0.5) * 0.4,
                z: (Math.random() - 0.5) * 0.4
            }
        });
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(position.x - 0.4, position.y, position.z);
        rightArm.castShadow = true;
        this.game.scene.add(rightArm);
        
        bodyParts.push({
            mesh: rightArm,
            velocity: {
                x: velocityDirection.x * 3.5 - 1, // More left
                y: velocityDirection.y * 3.5 + 2,
                z: velocityDirection.z * 3.5
            },
            angularVelocity: {
                x: (Math.random() - 0.5) * 0.4,
                y: (Math.random() - 0.5) * 0.4,
                z: (Math.random() - 0.5) * 0.4
            }
        });
        
        // Legs
        const legGeometry = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        const legMaterial = new THREE.MeshPhongMaterial({ color: 0x0000ff });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(position.x + 0.2, position.y - 0.8, position.z);
        leftLeg.castShadow = true;
        this.game.scene.add(leftLeg);
        
        bodyParts.push({
            mesh: leftLeg,
            velocity: {
                x: velocityDirection.x * 3 + 0.5, // Slightly right
                y: velocityDirection.y * 3 + 1.5,
                z: velocityDirection.z * 3
            },
            angularVelocity: {
                x: (Math.random() - 0.5) * 0.3,
                y: (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.3
            }
        });
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(position.x - 0.2, position.y - 0.8, position.z);
        rightLeg.castShadow = true;
        this.game.scene.add(rightLeg);
        
        bodyParts.push({
            mesh: rightLeg,
            velocity: {
                x: velocityDirection.x * 3 - 0.5, // Slightly left
                y: velocityDirection.y * 3 + 1.5,
                z: velocityDirection.z * 3
            },
            angularVelocity: {
                x: (Math.random() - 0.5) * 0.3,
                y: (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.3
            }
        });
        
        // Animate ragdoll physics
        const gravity = 9.8;
        const groundY = 0.1; // Ground level for ragdoll parts
        const bounceFactor = 0.3; // Bounciness
        const dragFactor = 0.98;
        
        // Add a global timeout to remove ragdoll after 15 seconds
        const cleanupTimeout = setTimeout(() => {
            for (const part of bodyParts) {
                this.game.scene.remove(part.mesh);
            }
        }, 15000);
        
        const animateRagdoll = () => {
            let allSleeping = true;
            
            // Update each body part
            for (const part of bodyParts) {
                // Apply gravity
                part.velocity.y -= gravity * 0.016; // Assuming 60fps (1/60)
                
                // Apply drag
                part.velocity.x *= dragFactor;
                part.velocity.y *= dragFactor;
                part.velocity.z *= dragFactor;
                
                part.angularVelocity.x *= dragFactor;
                part.angularVelocity.y *= dragFactor;
                part.angularVelocity.z *= dragFactor;
                
                // Update position
                part.mesh.position.x += part.velocity.x * 0.016;
                part.mesh.position.y += part.velocity.y * 0.016;
                part.mesh.position.z += part.velocity.z * 0.016;
                
                // Update rotation
                part.mesh.rotation.x += part.angularVelocity.x;
                part.mesh.rotation.y += part.angularVelocity.y;
                part.mesh.rotation.z += part.angularVelocity.z;
                
                // Check ground collision
                if (part.mesh.position.y < groundY + part.mesh.geometry.parameters.height / 2) {
                    part.mesh.position.y = groundY + part.mesh.geometry.parameters.height / 2;
                    
                    // Bounce with energy loss
                    if (Math.abs(part.velocity.y) > 0.1) {
                        part.velocity.y = -part.velocity.y * bounceFactor;
                        
                        // Add some random horizontal movement on bounce
                        part.velocity.x += (Math.random() - 0.5) * 0.5;
                        part.velocity.z += (Math.random() - 0.5) * 0.5;
                    } else {
                        part.velocity.y = 0;
                    }
                }
                
                // Check if this part is still moving significantly
                const isMoving = 
                    Math.abs(part.velocity.x) > 0.05 || 
                    Math.abs(part.velocity.y) > 0.05 || 
                    Math.abs(part.velocity.z) > 0.05 || 
                    Math.abs(part.angularVelocity.x) > 0.05 || 
                    Math.abs(part.angularVelocity.y) > 0.05 || 
                    Math.abs(part.angularVelocity.z) > 0.05;
                
                if (isMoving) {
                    allSleeping = false;
                }
            }
            
            // If all parts have nearly stopped moving, end animation
            if (!allSleeping) {
                requestAnimationFrame(animateRagdoll);
            } else {
                // Remove ragdoll after it stops moving
                setTimeout(() => {
                    // Clear the global cleanup timeout since we're cleaning up here
                    clearTimeout(cleanupTimeout);
                    
                    for (const part of bodyParts) {
                        this.game.scene.remove(part.mesh);
                    }
                }, 5000); // Keep it for 5 seconds after it stops moving
            }
        };
        
        animateRagdoll();
    }
    
    // Create a melee hammer for the third-person view
    createMeleeHammer(playerId) {
        const playerMesh = this.game.playerMeshes[playerId];
        if (!playerMesh) return null;
        
        // Check if a melee hammer already exists
        if (this.meleeHammers[playerId]) {
            // Only make visible if not the local player
            if (playerId !== this.game.localPlayerId) {
                this.meleeHammers[playerId].visible = true;
            } else {
                // Keep local player's third-person hammer invisible in first person
                this.meleeHammers[playerId].visible = false;
            }
            return this.meleeHammers[playerId];
        }
        
        // Clone the hammer geometry
        const hammerMesh = this.hammerGeometry.clone();
        
        // Scale down the hammer slightly for melee
        hammerMesh.scale.set(0.9, 0.9, 0.9);
        
        // Position the hammer to the right side of the player
        hammerMesh.position.set(0.7, 0.2, 0);
        
        // Rotate to start in a rest position
        hammerMesh.rotation.set(
            hammerMesh.userData.initialRotation.x, 
            hammerMesh.userData.initialRotation.y, 
            hammerMesh.userData.initialRotation.z - Math.PI/4
        );
        
        // Add to player mesh
        playerMesh.add(hammerMesh);
        
        // Set initial visibility - hide for local player
        hammerMesh.visible = (playerId !== this.game.localPlayerId);
        
        // Store reference
        this.meleeHammers[playerId] = hammerMesh;
        
        return hammerMesh;
    }
    
    // Animate the melee hammer swing with a smooth animation
    animateMeleeSwing(playerId) {
        // Skip for local player
        if (playerId === this.game.localPlayerId) return;
        
        // Get or create the melee hammer
        const hammerMesh = this.createMeleeHammer(playerId);
        if (!hammerMesh) return;
        
        // Get player for directional information
        const player = this.game.players[playerId];
        if (!player) return;
        
        // Make hammer visible during melee
        hammerMesh.visible = true;
        
        // Store the initial rotation
        const initialRotation = {
            x: hammerMesh.userData.initialRotation.x, 
            y: hammerMesh.userData.initialRotation.y, 
            z: hammerMesh.userData.initialRotation.z - Math.PI/4
        };
        
        // Set animation duration
        const duration = 300; // ms
        const startTime = Date.now();
        
        // Perform swing animation
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            if (progress < 1 && hammerMesh && hammerMesh.parent) {
                // Calculate swing animation - simple swing arc
                if (progress < 0.4) {
                    // Wind up phase (0-0.4)
                    const windupProgress = progress / 0.4; // Scale to 0-1
                    
                    // Wind up rotation
                    hammerMesh.rotation.set(
                        initialRotation.x - 0.2 * windupProgress,
                        initialRotation.y + 0.4 * windupProgress,
                        initialRotation.z - 0.3 * windupProgress
                    );
                } else {
                    // Swing phase (0.4-1.0)
                    const swingProgress = (progress - 0.4) / 0.6; // Scale to 0-1
                    
                    // Swing rotation
                    hammerMesh.rotation.set(
                        initialRotation.x + 0.5 * swingProgress,
                        initialRotation.y - 0.5 * swingProgress,
                        initialRotation.z + 0.8 * swingProgress
                    );
                }
                
                // Continue animation
                requestAnimationFrame(animate);
            } else {
                // Animation complete - reset and hide
                hammerMesh.rotation.set(
                    initialRotation.x,
                    initialRotation.y,
                    initialRotation.z
                );
                
                // Hide hammer after completed
                hammerMesh.visible = false;
            }
        };
        
        // Start animation
        animate();
    }
    
    // Create a Halo-style energy sword dash effect for third-person view
    createDashEffect(playerId) {
        // This function is intentionally empty as we're removing the dash animation
        // The core functionality is still preserved in the game engine
    }
    
    // Force zero health bar for a specific player
    forceZeroHealthBar(playerId) {
        // Find player mesh and force health bar to zero
        if (this.game.playerMeshes && this.game.playerMeshes[playerId]) {
            const playerMesh = this.game.playerMeshes[playerId];
            
            if (playerMesh.userData.healthBar) {
                // Ensure the health bar is visible
                playerMesh.userData.healthBar.visible = true;
                
                // Set to zero width
                playerMesh.userData.healthBar.scale.x = 0;
                
                // Set to bright red
                playerMesh.userData.healthBarMaterial.color.setHex(0xff0000);
                
                console.log(`Force set health bar to zero for player ${playerId}`);
            }
        }
    }
    
    // Create a visual for a powerup
    createPowerup(powerup) {
        // Skip if powerup already exists
        if (this.game.powerupMeshes && this.game.powerupMeshes[powerup.id]) {
            return this.game.powerupMeshes[powerup.id];
        }
        
        console.log("Creating visual for powerup:", powerup);
        
        // Create a sphere for the powerup - increase size for better visibility
        const geometry = new THREE.SphereGeometry(1.2, 24, 24); // Increased size and segments
        
        // Create material based on powerup type
        let material;
        
        switch (powerup.type) {
            case 'speed':
                material = new THREE.MeshStandardMaterial({
                    color: 0xFF5500, // Bright orange for speed
                    metalness: 0.8,
                    roughness: 0.1, // More shiny
                    emissive: 0xFF3300,
                    emissiveIntensity: 0.8 // Stronger glow
                });
                break;
            default:
                material = new THREE.MeshStandardMaterial({
                    color: 0x00FFFF,
                    metalness: 0.5,
                    roughness: 0.3
                });
        }
        
        // Create the mesh
        const mesh = new THREE.Mesh(geometry, material);
        
        // Position according to powerup data
        mesh.position.set(
            powerup.position.x,
            powerup.position.y,
            powerup.position.z
        );
        
        // Add glow effect - make it larger and brighter
        const glowGeometry = new THREE.SphereGeometry(1.5, 24, 24); // Larger glow
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF7700,
            transparent: true,
            opacity: 0.6, // More visible
            side: THREE.BackSide
        });
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        mesh.add(glowMesh);
        
        // Add pulsing light for extra visibility
        const light = new THREE.PointLight(0xFF5500, 1.5, 8);
        light.position.set(0, 0, 0);
        mesh.add(light);
        
        // Add to scene
        this.game.scene.add(mesh);
        
        // Initialize animation properties
        mesh.userData.bobHeight = 0.3; // Increased bob height
        mesh.userData.spinSpeed = 0.05; // Faster spin
        mesh.userData.startY = powerup.position.y;
        mesh.userData.bobPhase = Math.random() * Math.PI * 2; // Random starting phase
        mesh.userData.light = light; // Store reference to light for animation
        
        // Store reference to the mesh
        if (!this.game.powerupMeshes) {
            this.game.powerupMeshes = {};
        }
        this.game.powerupMeshes[powerup.id] = mesh;
        
        console.log(`Powerup mesh created at position: ${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)}`);
        
        return mesh;
    }
    
    // Update powerup animations
    updatePowerups(deltaTime) {
        if (!this.game.powerupMeshes) return;
        
        const time = Date.now() / 1000;
        
        for (const id in this.game.powerupMeshes) {
            const mesh = this.game.powerupMeshes[id];
            
            // Bob up and down with higher amplitude
            const bobOffset = Math.sin(time * 2 + mesh.userData.bobPhase) * mesh.userData.bobHeight;
            mesh.position.y = mesh.userData.startY + bobOffset;
            
            // Spin around Y axis faster
            mesh.rotation.y += mesh.userData.spinSpeed;
            
            // Add slight wobble for more dynamic movement
            mesh.rotation.x = Math.sin(time * 1.5) * 0.1;
            mesh.rotation.z = Math.cos(time * 1.2) * 0.1;
            
            // Pulse glow effect with more intensity
            if (mesh.children[0]) {
                const glowPulse = Math.sin(time * 3) * 0.2 + 0.8; // 0.6 to 1.0 range
                mesh.children[0].material.opacity = 0.6 * glowPulse;
                mesh.children[0].scale.set(glowPulse, glowPulse, glowPulse);
            }
            
            // Pulse the light if it exists
            if (mesh.userData.light) {
                mesh.userData.light.intensity = 1.5 + Math.sin(time * 5) * 0.5; // Pulsing between 1.0 and 2.0 intensity
                
                // Random subtle color shifts in the orange-red spectrum
                const hue = 0.05 + Math.sin(time * 0.2) * 0.01; // Slight hue variation around orange
                const saturation = 0.9 + Math.sin(time * 0.7) * 0.1;
                mesh.userData.light.color.setHSL(hue, saturation, 0.5);
            }
        }
    }
} 