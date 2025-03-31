class GameEngine {
    constructor() {
        this.players = {};
        this.hammers = [];
        this.obstacles = [];
        this.powerups = []; // Array to store active powerups
        this.mapSize = { width: 160, height: 120 }; // Increased from 120x80 to 160x120
        this.gravity = 9.8;
        this.lastUpdateTime = Date.now();
        this.lastHammerDropTime = Date.now(); // Track when we last dropped hammers from the sky
        this.hammerDropInterval = 20000; // Drop hammers every 20 seconds
        this.hammerDropCount = 1; // Number of hammers to drop each time
        this.enableSkyHammers = false; // Disable hammers falling from sky
        
        // Powerup related properties
        this.lastPowerupSpawnTime = Date.now();
        this.powerupSpawnInterval = 60000; // Spawn powerups every 30 seconds
        this.powerupDuration = 30000; // 30 seconds of speed boost
    }

    generateMap() {
        // Clear previous obstacles
        this.obstacles = [];
        this.hammers = [];
        
        // Add boundary walls - much taller now and marked as opaque
        this.obstacles.push({ 
            type: 'wall', 
            position: { x: -this.mapSize.width/2, y: 0, z: 0 }, 
            size: { width: 1, height: 160, depth: this.mapSize.height }, // Doubled height from 80 to 160
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0, // Fully opaque
            isWall: true // Mark as a wall for wall jump detection
        });
        this.obstacles.push({ 
            type: 'wall', 
            position: { x: this.mapSize.width/2, y: 0, z: 0 }, 
            size: { width: 1, height: 160, depth: this.mapSize.height }, // Doubled height from 80 to 160
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0, // Fully opaque
            isWall: true // Mark as a wall for wall jump detection
        });
        this.obstacles.push({ 
            type: 'wall', 
            position: { x: 0, y: 0, z: -this.mapSize.height/2 }, 
            size: { width: this.mapSize.width, height: 160, depth: 1 }, // Doubled height from 80 to 160
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0, // Fully opaque
            isWall: true // Mark as a wall for wall jump detection
        });
        this.obstacles.push({ 
            type: 'wall', 
            position: { x: 0, y: 0, z: this.mapSize.height/2 }, 
            size: { width: this.mapSize.width, height: 160, depth: 1 }, // Doubled height from 80 to 160
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0, // Fully opaque
            isWall: true // Mark as a wall for wall jump detection
        });

        // Add balconies around the perimeter
        this.createBalcony();
        
        // Add trampolines to the far corners and random locations
        this.createTrampolines();
        
        // Add simple platforms and cover
        this.createSimplePlatforms();
        
        // Add ground fences for cover
        this.createGroundFences();
        
        return this.obstacles;
    }
    
    createSimplePlatforms() {
        // Central elevated platform - higher now
        this.obstacles.push({
            type: 'obstacle',
            position: { x: 0, y: 15, z: 0 },
            size: { width: 20, height: 1, depth: 20 },
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0,
            color: 0x777777
        });
        
        // Add a trampoline on the central platform
        this.addTrampolineOnPlatform(0, 15.5, 0);
        
        // Second balcony height reference
        const secondBalconyHeight = 45;
        
        // Mid-height platforms in quadrants - only include those below second balcony
        const platformPositions = [
            { x: -30, z: -30, y: 35 }
            // Removed platforms above second balcony height (55, 75, 95)
        ];
        
        platformPositions.forEach(pos => {
            // Add platform
            this.obstacles.push({
                type: 'obstacle',
                position: { x: pos.x, y: pos.y, z: pos.z },
                size: { width: 15, height: 1, depth: 15 },
                rotation: { x: 0, y: 0, z: 0 },
                isSolid: true,
                opacity: 1.0,
                color: 0x777777
            });
            
            // Add trampoline on this platform (all remaining platforms are below the height limit)
            this.addTrampolineOnPlatform(pos.x, pos.y + 0.5, pos.z);
        });
        
        // Stepping stones - only include those below second balcony
        const stepPositions = [
            { x: 15, z: 15, y: 28 },
            { x: -15, z: 15, y: 42 }
            // Removed stepping stones above second balcony height (65, 85)
        ];
        
        stepPositions.forEach(pos => {
            this.obstacles.push({
                type: 'obstacle',
                position: { x: pos.x, y: pos.y, z: pos.z },
                size: { width: 8, height: 1, depth: 8 },
                rotation: { x: 0, y: 0, z: 0 },
                isSolid: true,
                opacity: 1.0,
                color: 0x888888
            });
            
            // Add smaller trampolines on stepping stones (all remaining ones are below the height limit)
            this.addTrampolineOnPlatform(pos.x, pos.y + 0.5, pos.z, 5);
        });
    }
    
    createGroundFences() {
        // Create thin fence-like structures on the ground for cover
        const fenceHeight = 3;
        const fenceWidth = 0.5;
        const fenceLength = 15;
        
        // Scattered fences in perpendicular orientations only
        // Using explicit dimension swapping instead of rotation
        const fencePositions = [
            // Horizontal fences (x-axis aligned) - long width, short depth
            { x: -25, z: 10, orientation: 'horizontal' },
            { x: 25, z: -15, orientation: 'horizontal' },
            { x: -10, z: -35, orientation: 'horizontal' },
            { x: 15, z: 35, orientation: 'horizontal' },
            { x: -20, z: -20, orientation: 'horizontal' }, 
            { x: 20, z: 20, orientation: 'horizontal' },
            
            // Vertical fences (z-axis aligned) - short width, long depth
            { x: 10, z: -25, orientation: 'vertical' },
            { x: -15, z: 25, orientation: 'vertical' },
            { x: 35, z: 10, orientation: 'vertical' },
            { x: -35, z: -10, orientation: 'vertical' },
            { x: -20, z: 20, orientation: 'vertical' },
            { x: 20, z: -20, orientation: 'vertical' }
        ];
        
        fencePositions.forEach(pos => {
            // Instead of using rotation, explicitly set the dimensions based on orientation
            // Always use rotation 0 but adjust width/depth according to orientation
            const isHorizontal = pos.orientation === 'horizontal';
            
            this.obstacles.push({
                type: 'fence',
                position: { x: pos.x, y: fenceHeight/2, z: pos.z },
                size: { 
                    // For horizontal: width is long (along x), depth is short (along z)
                    // For vertical: width is short (along x), depth is long (along z)
                    width: isHorizontal ? fenceLength : fenceWidth,
                    height: fenceHeight, 
                    depth: isHorizontal ? fenceWidth : fenceLength 
                },
                // No rotation - using dimensions to determine orientation
                rotation: { x: 0, y: 0, z: 0 },
                isSolid: true,
                opacity: 1.0,
                color: 0x8B4513, // Brown wooden fence color
                isFence: true
            });
        });
    }
    
    // Helper method to add a standardized trampoline on a platform
    addTrampolineOnPlatform(x, y, z, size = 6) {
        this.obstacles.push({
            type: 'trampoline',
            position: { x: x, y: y + 1.0, z: z }, // Raised significantly above platform (changed from 0.3)
            size: { width: size, height: 0.5, depth: size },
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0,
            color: 0x0000FF, // Blue color for trampolines
            isTrampoline: true,
            bounceFactor: 4.0, // Standard bounce factor
            bounceVelocity: 30.0, // Increased bounce velocity (was 20.0)
            lastBounceTime: 0 // To prevent repeated bounces in short timeframe
        });
    }
    
    createBalcony() {
        // First balcony (lower)
        const balconyHeight1 = 15; // Height of the first balcony
        const balconyWidth = 10; // Width of the balcony platform
        const balconyY1 = balconyHeight1; // Y position of the first balcony
        const innerWidth = this.mapSize.width - 2*balconyWidth;
        const innerHeight = this.mapSize.height - 2*balconyWidth;
        
        // North balcony section - lower level
        this.obstacles.push({
            type: 'obstacle',
            position: { x: 0, y: balconyY1, z: -this.mapSize.height/2 + balconyWidth/2 },
            size: { width: innerWidth, height: 1, depth: balconyWidth },
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0,
            color: 0x8B4513 // Brown color for wooden balcony
        });
        
        // South balcony section - lower level
        this.obstacles.push({
            type: 'obstacle',
            position: { x: 0, y: balconyY1, z: this.mapSize.height/2 - balconyWidth/2 },
            size: { width: innerWidth, height: 1, depth: balconyWidth },
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0,
            color: 0x8B4513
        });
        
        // East balcony section - lower level
        this.obstacles.push({
            type: 'obstacle',
            position: { x: this.mapSize.width/2 - balconyWidth/2, y: balconyY1, z: 0 },
            size: { width: balconyWidth, height: 1, depth: innerHeight },
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0,
            color: 0x8B4513
        });
        
        // West balcony section - lower level
        this.obstacles.push({
            type: 'obstacle',
            position: { x: -this.mapSize.width/2 + balconyWidth/2, y: balconyY1, z: 0 },
            size: { width: balconyWidth, height: 1, depth: innerHeight },
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0,
            color: 0x8B4513
        });
        
        // Second balcony (higher)
        const balconyHeight2 = 45; // Height of the second balcony
        const balconyY2 = balconyHeight2; // Y position of the second balcony
        
        // North balcony section - higher level
        this.obstacles.push({
            type: 'obstacle',
            position: { x: 0, y: balconyY2, z: -this.mapSize.height/2 + balconyWidth/2 },
            size: { width: innerWidth, height: 1, depth: balconyWidth },
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0,
            color: 0x8B4513 // Brown color for wooden balcony
        });
        
        // South balcony section - higher level
        this.obstacles.push({
            type: 'obstacle',
            position: { x: 0, y: balconyY2, z: this.mapSize.height/2 - balconyWidth/2 },
            size: { width: innerWidth, height: 1, depth: balconyWidth },
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0,
            color: 0x8B4513
        });
        
        // East balcony section - higher level
        this.obstacles.push({
            type: 'obstacle',
            position: { x: this.mapSize.width/2 - balconyWidth/2, y: balconyY2, z: 0 },
            size: { width: balconyWidth, height: 1, depth: innerHeight },
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0,
            color: 0x8B4513
        });
        
        // West balcony section - higher level
        this.obstacles.push({
            type: 'obstacle',
            position: { x: -this.mapSize.width/2 + balconyWidth/2, y: balconyY2, z: 0 },
            size: { width: balconyWidth, height: 1, depth: innerHeight },
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0,
            color: 0x8B4513
        });
    }
    
    createTrampolines() {
        // Define trampoline dimensions
        const trampolineSize = 8; // Larger trampoline (increased from 7)
        const trampolineHeight = 0.5;
        const cornerOffset = 5; // Closer to the walls
        
        // Create trampolines in each corner
        const corners = [
            { x: -this.mapSize.width/2 + cornerOffset, z: -this.mapSize.height/2 + cornerOffset },
            { x: this.mapSize.width/2 - cornerOffset, z: -this.mapSize.height/2 + cornerOffset },
            { x: -this.mapSize.width/2 + cornerOffset, z: this.mapSize.height/2 - cornerOffset },
            { x: this.mapSize.width/2 - cornerOffset, z: this.mapSize.height/2 - cornerOffset }
        ];
        
        corners.forEach(pos => {
            // Add the trampoline base with standardized properties
            this.obstacles.push({
                type: 'trampoline',
                position: { x: pos.x, y: 1.3, z: pos.z }, // Raised above ground level
                size: { width: trampolineSize, height: trampolineHeight, depth: trampolineSize },
                rotation: { x: 0, y: 0, z: 0 },
                isSolid: true,
                opacity: 1.0,
                color: 0x0000FF, // Blue color for trampolines
                isTrampoline: true,
                bounceFactor: 4.0, // Standard bounce factor
                bounceVelocity: 30.0, // Increased bounce velocity (was 20.0)
                lastBounceTime: 0 // To prevent repeated bounces in short timeframe
            });
        });
        
        // Add fixed trampolines instead of random ones (reduced from previous 4-6)
        const fixedTrampolines = [
            { x: -this.mapSize.width/4, z: 0 },
            { x: this.mapSize.width/4, z: 0 },
            { x: 0, z: -this.mapSize.height/4 },
            { x: 0, z: this.mapSize.height/4 }
        ];
        
        fixedTrampolines.forEach(pos => {
            this.obstacles.push({
                type: 'trampoline',
                position: { x: pos.x, y: 1.3, z: pos.z }, // Raised above ground level
                size: { width: trampolineSize, height: trampolineHeight, depth: trampolineSize },
                rotation: { x: 0, y: 0, z: 0 },
                isSolid: true,
                opacity: 1.0,
                color: 0x0000FF, // Blue color for trampolines
                isTrampoline: true,
                bounceFactor: 4.0, // Standard bounce factor
                bounceVelocity: 30.0, // Increased bounce velocity (was 20.0)
                lastBounceTime: 0 // To prevent repeated bounces in short timeframe
            });
        });
    }
    
    placeBalconyHammers() {
        const balconyHeight = 15;
        const balconyWidth = 10;
        const hammerY = balconyHeight + 1; // Height for hammers
        
        // Place hammers at corners and midpoints of the balcony
        const hammerPositions = [
            // Corners
            { x: -this.mapSize.width/2 + balconyWidth/2, z: -this.mapSize.height/2 + balconyWidth/2 },
            { x: this.mapSize.width/2 - balconyWidth/2, z: -this.mapSize.height/2 + balconyWidth/2 },
            { x: -this.mapSize.width/2 + balconyWidth/2, z: this.mapSize.height/2 - balconyWidth/2 },
            { x: this.mapSize.width/2 - balconyWidth/2, z: this.mapSize.height/2 - balconyWidth/2 },
            
            // Midpoints
            { x: 0, z: -this.mapSize.height/2 + balconyWidth/2 },
            { x: 0, z: this.mapSize.height/2 - balconyWidth/2 },
            { x: -this.mapSize.width/2 + balconyWidth/2, z: 0 },
            { x: this.mapSize.width/2 - balconyWidth/2, z: 0 },
            
            // Quarter points
            { x: -this.mapSize.width/4, z: -this.mapSize.height/2 + balconyWidth/2 },
            { x: this.mapSize.width/4, z: -this.mapSize.height/2 + balconyWidth/2 },
            { x: -this.mapSize.width/4, z: this.mapSize.height/2 - balconyWidth/2 },
            { x: this.mapSize.width/4, z: this.mapSize.height/2 - balconyWidth/2 },
            { x: -this.mapSize.width/2 + balconyWidth/2, z: -this.mapSize.height/4 },
            { x: -this.mapSize.width/2 + balconyWidth/2, z: this.mapSize.height/4 },
            { x: this.mapSize.width/2 - balconyWidth/2, z: -this.mapSize.height/4 },
            { x: this.mapSize.width/2 - balconyWidth/2, z: this.mapSize.height/4 }
        ];
        
        // Add hammer at each position
        hammerPositions.forEach(pos => {
            this.hammers.push({
                id: `balcony_hammer_${this.hammers.length}`,
                position: { x: pos.x, y: hammerY, z: pos.z },
                rotation: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                thrown: false,
                thrownBy: null,
                thrownTime: 0,
                power: 0
            });
        });
    }
    
    createDefinedObstacles() {
        // Create a small number of well-defined, distinct obstacles in the arena
        
        // Central platform
        this.obstacles.push({
            type: 'obstacle',
            position: { x: 0, y: 3, z: 0 },
            size: { width: 15, height: 6, depth: 15 },
            rotation: { x: 0, y: 0, z: 0 },
            isSolid: true,
            opacity: 1.0,
            color: 0x777777
        });
        
        // Four columns near center
        const columnPositions = [
            { x: -20, z: -20 },
            { x: 20, z: -20 },
            { x: -20, z: 20 },
            { x: 20, z: 20 }
        ];
        
        columnPositions.forEach(pos => {
            this.obstacles.push({
                type: 'obstacle',
                position: { x: pos.x, y: 7, z: pos.z },
                size: { width: 6, height: 14, depth: 6 },
                rotation: { x: 0, y: 0, z: 0 },
                isSolid: true,
                opacity: 1.0,
                color: 0x888888
            });
        });
        
        // Low walls for cover
        const lowWallPositions = [
            { x: -25, z: 0, rot: 0 },
            { x: 25, z: 0, rot: 0 },
            { x: 0, z: -25, rot: Math.PI/2 },
            { x: 0, z: 25, rot: Math.PI/2 }
        ];
        
        lowWallPositions.forEach(pos => {
            this.obstacles.push({
                type: 'obstacle',
                position: { x: pos.x, y: 1.5, z: pos.z },
                size: { width: 20, height: 3, depth: 2 },
                rotation: { x: 0, y: pos.rot, z: 0 },
                isSolid: true,
                opacity: 1.0,
                color: 0x555555
            });
        });
        
        // Diagonal half-height walls
        const diagonalWallPositions = [
            { x: -35, z: -35, rot: Math.PI/4 },
            { x: 35, z: -35, rot: -Math.PI/4 },
            { x: -35, z: 35, rot: -Math.PI/4 },
            { x: 35, z: 35, rot: Math.PI/4 }
        ];
        
        diagonalWallPositions.forEach(pos => {
            this.obstacles.push({
                type: 'obstacle',
                position: { x: pos.x, y: 3, z: pos.z },
                size: { width: 15, height: 6, depth: 2 },
                rotation: { x: 0, y: pos.rot, z: 0 },
                isSolid: true,
                opacity: 1.0,
                color: 0x666666
            });
        });
        
        // Add some ramps
        const rampPositions = [
            { x: -10, z: 30, rot: Math.PI },
            { x: 10, z: -30, rot: 0 }
        ];
        
        rampPositions.forEach(pos => {
            this.obstacles.push({
                type: 'obstacle',
                position: { x: pos.x, y: 3, z: pos.z },
                size: { width: 8, height: 1, depth: 16 },
                rotation: { x: Math.PI/12, y: pos.rot, z: 0 }, // Slight angle for the ramp
                isSolid: true,
                opacity: 1.0,
                color: 0x777777
            });
        });
    }

    createPlayer(id, name) {
        const spawnPoint = this.getRandomSpawnPoint();
        
        // Create new player with physics properties
        this.players[id] = {
            id,
            name: name || `Player_${id.substring(0, 5)}`,
            position: { ...spawnPoint, y: 1 },
            velocity: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            size: { width: 1, height: 2, depth: 1 },
            radius: 0.5,
            mass: 10,
            health: 3,
            hammers: 3,
            lastThrow: 0,
            lastHit: 0,
            lastMelee: 0,
            meleeActive: false,
            pendingMelee: false,
            lastHitTime: 0,
            isAlive: true,
            isJumping: false,
            onGround: true,
            isStaggered: false,
            lastStaggerTime: 0,
            lastHitBy: null,
            staggerTime: 0,
            dashPerformed: false,
            hasSuperSpeed: false, // New powerup property
            superSpeedUntil: 0    // Timestamp when powerup expires
        };
        
        return this.players[id];
    }

    getRandomSpawnPoint() {
        let validSpawn = false;
        let spawnPoint = { x: 0, z: 0 };
        
        // Minimum distance from other players
        const minPlayerDistance = 40; // Increased minimum distance between spawns from 30 to 40
        
        // Try to find a spawn point that doesn't collide with obstacles and is far from other players
        let attempts = 0;
        while (!validSpawn && attempts < 50) { // Increased maximum attempts from 40 to 50
            spawnPoint.x = (Math.random() * (this.mapSize.width - 15)) - (this.mapSize.width/2 - 7.5);
            spawnPoint.z = (Math.random() * (this.mapSize.height - 15)) - (this.mapSize.height/2 - 7.5);
            
            validSpawn = true;
            
            // Check collision with obstacles
            for (const obstacle of this.obstacles) {
                const dist = Math.sqrt(
                    Math.pow(spawnPoint.x - obstacle.position.x, 2) + 
                    Math.pow(spawnPoint.z - obstacle.position.z, 2)
                );
                
                const minDist = 
                    Math.max(obstacle.size.width, obstacle.size.depth) / 2 + 3; // Increased clearance from 2 to 3
                
                if (dist < minDist) {
                    validSpawn = false;
                    break;
                }
            }
            
            // If still valid, check distance from other players
            if (validSpawn) {
                for (const id in this.players) {
                    const player = this.players[id];
                    const dist = Math.sqrt(
                        Math.pow(spawnPoint.x - player.position.x, 2) + 
                        Math.pow(spawnPoint.z - player.position.z, 2)
                    );
                    
                    // Ensure minimum distance from other players
                    if (dist < minPlayerDistance) {
                        validSpawn = false;
                        break;
                    }
                }
            }
            
            attempts++;
        }
        
        // If we couldn't find a valid spawn after many attempts, reduce requirements
        if (!validSpawn) {
            attempts = 0;
            const reducedPlayerDistance = 20; // Fallback to shorter distance if necessary (increased from 15)
            
            while (!validSpawn && attempts < 20) {
                spawnPoint.x = (Math.random() * (this.mapSize.width - 15)) - (this.mapSize.width/2 - 7.5);
                spawnPoint.z = (Math.random() * (this.mapSize.height - 15)) - (this.mapSize.height/2 - 7.5);
                
                validSpawn = true;
                
                // Check collision with obstacles with reduced requirements
                for (const obstacle of this.obstacles) {
                    const dist = Math.sqrt(
                        Math.pow(spawnPoint.x - obstacle.position.x, 2) + 
                        Math.pow(spawnPoint.z - obstacle.position.z, 2)
                    );
                    
                    const minDist = 
                        Math.max(obstacle.size.width, obstacle.size.depth) / 2 + 2;
                    
                    if (dist < minDist) {
                        validSpawn = false;
                        break;
                    }
                }
                
                // Check distance from other players with reduced requirements
                if (validSpawn) {
                    for (const id in this.players) {
                        const player = this.players[id];
                        const dist = Math.sqrt(
                            Math.pow(spawnPoint.x - player.position.x, 2) + 
                            Math.pow(spawnPoint.z - player.position.z, 2)
                        );
                        
                        if (dist < reducedPlayerDistance) {
                            validSpawn = false;
                            break;
                        }
                    }
                }
                
                attempts++;
            }
            
            // Last resort if still can't find valid spawn
            if (!validSpawn) {
                spawnPoint.x = (Math.random() * (this.mapSize.width - 15)) - (this.mapSize.width/2 - 7.5);
                spawnPoint.z = (Math.random() * (this.mapSize.height - 15)) - (this.mapSize.height/2 - 7.5);
            }
        }
        
        return spawnPoint;
    }

    throwHammer(playerId, direction, power = 1, originOverride = null) {
        const player = this.players[playerId];
        if (!player || !player.isAlive || player.hammers <= 0) return null;
        
        // Validate direction
        if (!direction || typeof direction.x !== 'number' || typeof direction.y !== 'number' || typeof direction.z !== 'number') {
            console.error('Invalid throw direction:', direction);
            return null;
        }
        
        // Make a deep copy of the direction to avoid reference issues
        const directionCopy = {
            x: direction.x,
            y: direction.y,
            z: direction.z
        };
        
        // Check cooldown (500ms between throws)
        const now = Date.now();
        if (now - player.lastThrow < 500) return null;
        
        player.lastThrow = now;
        player.hammers--;
        
        // Normalize direction vector (handle potential zero issues)
        const magnitude = Math.sqrt(
            directionCopy.x * directionCopy.x + 
            directionCopy.y * directionCopy.y + 
            directionCopy.z * directionCopy.z
        );
        
        // Prevent division by zero
        if (magnitude === 0) {
            directionCopy.z = -1; // Default direction if zero vector
            const normalized = { x: 0, y: 0, z: -1 };
        } else {
            var normalized = {
                x: directionCopy.x / magnitude,
                y: directionCopy.y / magnitude,
                z: directionCopy.z / magnitude
            };
        }
        
        // Calculate perpendicular vector for rotation (same logic as before)
        let perpVector;
        
        if (Math.abs(normalized.y) > 0.8) {
            perpVector = { x: 1, y: 0, z: 0 };
        } else {
            perpVector = {
                x: -normalized.z,
                y: 0,
                z: normalized.x
            };
        }
        
        // Normalize perpendicular vector
        const perpMagnitude = Math.sqrt(
            perpVector.x * perpVector.x + 
            perpVector.y * perpVector.y + 
            perpVector.z * perpVector.z
        );
        
        if (perpMagnitude > 0) {
            perpVector.x /= perpMagnitude;
            perpVector.y /= perpMagnitude;
            perpVector.z /= perpMagnitude;
        }
        
        // Create hammer with physics properties
        let hammerSpeed = 30 * power;
        
        // Apply super speed boost to hammer throw if player has it
        if (player.hasSuperSpeed) {
            hammerSpeed *= 2; // Double the throw speed
        }
        
        // Deep copy the origin override if provided
        let startPosition;
        if (originOverride && typeof originOverride.x === 'number' && 
            typeof originOverride.y === 'number' && typeof originOverride.z === 'number') {
            startPosition = {
                x: originOverride.x,
                y: originOverride.y,
                z: originOverride.z
            };
        } else {
            startPosition = {
                x: player.position.x,
                y: player.position.y + 1.3,
                z: player.position.z
            };
        }
        
        // Generate a deterministic ID based on timestamp and player ID
        const hammerId = `hammer_${now}_${playerId.substring(0, 5)}`;
        
        const hammer = {
            id: hammerId,
            position: {
                x: startPosition.x,
                y: startPosition.y,
                z: startPosition.z
            },
            velocity: {
                x: normalized.x * hammerSpeed,
                y: normalized.y * hammerSpeed,
                z: normalized.z * hammerSpeed
            },
            rotation: { x: 0, y: 0, z: 0 },
            rotationSpeed: {
                x: perpVector.x * 25,
                y: perpVector.y * 25,
                z: perpVector.z * 25
            },
            ownerId: playerId,
            throwTime: now,
            bounces: 0,
            maxBounces: 10,
            active: true,
            originalDirection: {...normalized}, // Store original direction for debugging
            originalOrigin: {...startPosition}  // Store original position for debugging
        };
        
        this.hammers.push(hammer);
        return hammer;
    }

    update(deltaTime) {
        // Convert to seconds for physics calculations
        const dt = deltaTime / 1000;
        
        // Process pending throws first to ensure consistent behavior
        for (const id in this.players) {
            const player = this.players[id];
            if (!player.isAlive) continue;
            
            // Process any pending hammer throws
            if (player.pendingThrow) {
                this.throwHammer(
                    id, 
                    player.pendingThrow.direction, 
                    player.pendingThrow.power, 
                    player.pendingThrow.origin
                );
                // Clear pending throw after processing
                player.pendingThrow = null;
            }
            
            // Process any pending melee actions
            if (player.pendingMelee) {
                // Set melee as active
                const now = Date.now();
                if (now - player.lastMelee > 500) { // 500ms cooldown
                    player.meleeActive = true;
                    player.lastMelee = now;
                    
                    // Reset melee after animation completes
                    setTimeout(() => {
                        if (player) {
                            player.meleeActive = false;
                            player.pendingMelee = false;
                        }
                    }, 300); // Match duration of swing animation
                }
                
                // Clear pending melee flag
                player.pendingMelee = false;
            }
        }
        
        // Check for melee hits between players
        this.handleMeleeHits();
        
        // Update players
        for (const id in this.players) {
            const player = this.players[id];
            if (!player.isAlive) continue;
            
            // Store previous position for edge detection
            const prevPosition = { ...player.position };
            
            // ANTI-STACKING: Special check for bot players that are somehow floating
            // Force bots that are floating without good reason back to the ground
            if (player.isBot && player.position.y > 1.1 && !player.isJumping && 
                player.velocity.y < 0.5 && player.velocity.y > -0.5) {
                
                // Bot is unnaturally floating, force it to ground level
                const standingOnObstacle = this.checkPlayerStandingOnObstacle(player);
                if (!standingOnObstacle) {
                    // Not on an obstacle, force to ground
                    player.position.y = 1.0;
                    player.velocity.y = 0;
                    player.onGround = true;
                    
                    // Apply random horizontal movement to break potential stacking
                    const angle = Math.random() * Math.PI * 2;
                    player.velocity.x += Math.cos(angle) * 5;
                    player.velocity.z += Math.sin(angle) * 5;
                }
            }
            
            // Check if player is standing on any obstacle before applying gravity
            const standingOnObstacle = this.checkPlayerStandingOnObstacle(player);
            const wasOnGround = player.onGround;
            player.onGround = player.onGround || standingOnObstacle;
            
            // Apply gravity if not on ground
            if (!player.onGround) {
                player.velocity.y -= this.gravity * dt;
            }
            
            // Cap horizontal velocity to prevent excessive speed
            const maxVelocity = 35.0; // Maximum allowed velocity - significantly increased
            const currentVelocity = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.z * player.velocity.z);
            if (currentVelocity > maxVelocity) {
                const scale = maxVelocity / currentVelocity;
                player.velocity.x *= scale;
                player.velocity.z *= scale;
            }
            
            // Cap vertical velocity to prevent flying out of map
            if (player.velocity.y > 100) { // Increased from 15 to 100 to allow much higher bounces
                player.velocity.y = 100;
            } else if (player.velocity.y < -20) {
                player.velocity.y = -20;
            }
            
            // Update position based on velocity
            player.position.x += player.velocity.x * dt;
            player.position.y += player.velocity.y * dt;
            player.position.z += player.velocity.z * dt;
            
            // Check ground collision
            if (player.position.y <= 1) {
                player.position.y = 1;
                player.velocity.y = 0;
                player.onGround = true;
                player.isJumping = false;
            }
            
            // Check collisions with obstacles - applies to both human players and bots
            this.handlePlayerObstacleCollisions(player);
            
            // Check for walking off ledges
            if (wasOnGround && !player.isJumping) {
                // Only check for ledge falling if player has moved in X or Z directions
                const hasMovedHorizontally = 
                    Math.abs(player.position.x - prevPosition.x) > 0.01 || 
                    Math.abs(player.position.z - prevPosition.z) > 0.01;
                
                if (hasMovedHorizontally) {
                    // Check if player is still on ground after movement
                    const stillOnGround = this.checkPlayerStandingOnObstacle(player) || player.position.y <= 1;
                    
                    if (!stillOnGround) {
                        // Player has walked off a ledge - start falling
                        player.onGround = false;
                        
                        // Add a very small downward initial velocity to start the fall
                        if (player.velocity.y >= 0) {
                            player.velocity.y = -0.1;
                        }
                    }
                }
            }
            
            // Apply friction
            if (player.onGround) {
                player.velocity.x *= 0.9; // Even lower friction for very fast movement
                player.velocity.z *= 0.9;
            } else {
                player.velocity.x *= 0.98; // Very low air friction
                player.velocity.z *= 0.98;
            }
            
            // ANTI-STACKING: Extra check to prevent bots from jumping too frequently
            if (player.isBot && player.onGround && player.isJumping) {
                player.isJumping = false;
            }
            
            // Collect hammers that have been on the ground for more than 3 seconds
            const now = Date.now();
            for (let i = 0; i < this.hammers.length; i++) {
                const hammer = this.hammers[i];
                if (!hammer.active && now - hammer.landTime > 3000) {
                    // Check if player is close to the hammer
                    const dist = Math.sqrt(
                        Math.pow(player.position.x - hammer.position.x, 2) +
                        Math.pow(player.position.z - hammer.position.z, 2)
                    );
                    
                    // Only pickup if player has less than 3 hammers
                    if (dist < 2 && player.hammers < 3) {
                        player.hammers++;
                        this.hammers.splice(i, 1);
                        i--;
                    }
                }
            }
        }
        
        // Handle player-player collisions
        this.handlePlayerPlayerCollisions();
        
        // ANTI-STACKING: Apply vertical separation for bots to prevent stacking
        this.preventBotStacking();
        
        // Update hammers
        for (let i = 0; i < this.hammers.length; i++) {
            const hammer = this.hammers[i];
            
            // Skip inactive hammers
            if (!hammer.active) continue;
            
            // Apply gravity
            hammer.velocity.y -= this.gravity * dt;
            
            // Update position
            hammer.position.x += hammer.velocity.x * dt;
            hammer.position.y += hammer.velocity.y * dt;
            hammer.position.z += hammer.velocity.z * dt;
            
            // Update rotation
            hammer.rotation.x += hammer.rotationSpeed.x * dt;
            hammer.rotation.y += hammer.rotationSpeed.y * dt;
            hammer.rotation.z += hammer.rotationSpeed.z * dt;
            
            // Check if hammer hit the ground
            if (hammer.position.y <= 0.5) {
                hammer.position.y = 0.5;
                
                // Bounce with energy loss
                if (hammer.bounces < hammer.maxBounces) {
                    hammer.velocity.y = -hammer.velocity.y * 0.6; // 60% of energy preserved
                    hammer.velocity.x *= 0.8;
                    hammer.velocity.z *= 0.8;
                    hammer.bounces++;
                } else {
                    // Hammer stops after max bounces
                    hammer.velocity.x = 0;
                    hammer.velocity.y = 0;
                    hammer.velocity.z = 0;
                    hammer.active = false;
                    hammer.landTime = Date.now();
                }
            }
            
            // Check collisions with obstacles
            this.handleHammerObstacleCollisions(hammer);
            
            // Check collisions with players
            this.handleHammerPlayerCollisions(hammer);
            
            // Remove hammers that have been inactive for too long (reduced from 30 seconds to 15 seconds)
            if (!hammer.active && Date.now() - hammer.landTime > 15000) {
                this.hammers.splice(i, 1);
                i--;
            }
        }
        
        // Check for hammer-to-hammer collisions
        this.handleHammerHammerCollisions();
        
        // Check if we should drop hammers from the sky
        const currentTime = Date.now();
        if (this.enableSkyHammers && currentTime - this.lastHammerDropTime > this.hammerDropInterval) {
            this.dropHammersFromSky();
            this.lastHammerDropTime = currentTime;
        }
        
        // Handle powerup spawning
        const now = Date.now();
        let updateResult = {};
        let powerupsSpawned = [];
        let powerupsCollected = [];
        
        if (now - this.lastPowerupSpawnTime > this.powerupSpawnInterval) {
            const powerup = this.spawnSpeedPowerup();
            if (powerup) {
                this.lastPowerupSpawnTime = now;
                powerupsSpawned.push(powerup);
                console.log(`Spawned new speed powerup at position: ${powerup.position.x.toFixed(2)}, ${powerup.position.y.toFixed(2)}, ${powerup.position.z.toFixed(2)}`);
            }
        }
        
        // Handle powerup collision and expiration
        this.handlePowerups(powerupsCollected);
        
        // Log when powerups are collected
        if (powerupsCollected.length > 0) {
            for (const pickup of powerupsCollected) {
                console.log(`Player ${pickup.playerId} collected powerup: ${pickup.type}`);
                const player = this.players[pickup.playerId];
                if (player) {
                    console.log(`Super speed activated for player until: ${new Date(player.superSpeedUntil).toISOString()}`);
                }
            }
        }
        
        // Log when players have super speed
        for (const playerId in this.players) {
            const player = this.players[playerId];
            if (player.hasSuperSpeed) {
                // Log every few seconds to avoid spamming console
                if (now % 3000 < 50) {
                    console.log(`Player ${playerId} has super speed active, expiring in ${((player.superSpeedUntil - now)/1000).toFixed(1)} seconds`);
                }
            }
        }
        
        // Check if hammers need to be dropped from the sky
        // and add them to our update results if so
        if (this.enableSkyHammers && now - this.lastHammerDropTime > this.hammerDropInterval) {
            const dropResult = this.dropHammersFromSky();
            if (dropResult) {
                updateResult = {
                    message: dropResult.message,
                    count: dropResult.count
                };
            }
            
            this.lastHammerDropTime = now;
        }
        
        // Add powerup events to the update result if any occurred
        if (powerupsSpawned.length > 0 || powerupsCollected.length > 0) {
            updateResult.powerups = {
                spawned: powerupsSpawned.length > 0 ? powerupsSpawned : null,
                collected: powerupsCollected.length > 0 ? powerupsCollected : null
            };
        }
        
        return updateResult;
    }

    handlePlayerObstacleCollisions(player) {
        for (const obstacle of this.obstacles) {
            // Special case for trampolines - we don't want to block movement, handled separately in checkPlayerStandingOnObstacle
            if (obstacle.isTrampoline) continue;
            
            // Use a significantly larger hitbox expansion to create a strict no-clipping zone
            const hitboxExpansion = 0.7; // Increased from 0.5 to 0.7 (70% larger hitbox)
            const playerMinX = player.position.x - (player.size.width/2 + hitboxExpansion);
            const playerMaxX = player.position.x + (player.size.width/2 + hitboxExpansion);
            const playerMinY = player.position.y - (player.size.height/2 + hitboxExpansion);
            const playerMaxY = player.position.y + (player.size.height/2 + hitboxExpansion);
            const playerMinZ = player.position.z - (player.size.depth/2 + hitboxExpansion);
            const playerMaxZ = player.position.z + (player.size.depth/2 + hitboxExpansion);
            
            // Add significant buffer to obstacles with rotation
            let rotationBuffer = 0.7; // Increased from 0.5 to 0.7 for all obstacles
            if (obstacle.rotation && (Math.abs(obstacle.rotation.x) > 0.01 || 
                                    Math.abs(obstacle.rotation.z) > 0.01)) {
                rotationBuffer = 0.9; // Increased from 0.7 to 0.9 for tilted obstacles
            }
            
            const obstacleMinX = obstacle.position.x - (obstacle.size.width/2 + rotationBuffer);
            const obstacleMaxX = obstacle.position.x + (obstacle.size.width/2 + rotationBuffer);
            const obstacleMinY = obstacle.position.y - (obstacle.size.height/2 + rotationBuffer);
            const obstacleMaxY = obstacle.position.y + (obstacle.size.height/2 + rotationBuffer);
            const obstacleMinZ = obstacle.position.z - (obstacle.size.depth/2 + rotationBuffer);
            const obstacleMaxZ = obstacle.position.z + (obstacle.size.depth/2 + rotationBuffer);
            
            // First, predict the player's next position based on current velocity
            // This helps prevent fast-moving players from phasing through obstacles
            const dt = 0.016; // Assume ~60fps for prediction
            const predictedX = player.position.x + player.velocity.x * dt * 2; // Look 2 frames ahead
            const predictedY = player.position.y + player.velocity.y * dt * 2;
            const predictedZ = player.position.z + player.velocity.z * dt * 2;
            
            // Create a bounding box for the predicted position
            const predictedMinX = predictedX - (player.size.width/2 + hitboxExpansion);
            const predictedMaxX = predictedX + (player.size.width/2 + hitboxExpansion);
            const predictedMinY = predictedY - (player.size.height/2 + hitboxExpansion);
            const predictedMaxY = predictedY + (player.size.height/2 + hitboxExpansion);
            const predictedMinZ = predictedZ - (player.size.depth/2 + hitboxExpansion);
            const predictedMaxZ = predictedZ + (player.size.depth/2 + hitboxExpansion);
            
            // Check if current position or predicted position will overlap with obstacle
            const currentCollision = 
                playerMaxX > obstacleMinX && playerMinX < obstacleMaxX &&
                playerMaxY > obstacleMinY && playerMinY < obstacleMaxY &&
                playerMaxZ > obstacleMinZ && playerMinZ < obstacleMaxZ;
                
            const predictedCollision = 
                predictedMaxX > obstacleMinX && predictedMinX < obstacleMaxX &&
                predictedMaxY > obstacleMinY && predictedMinY < obstacleMaxY &&
                predictedMaxZ > obstacleMinZ && predictedMinZ < obstacleMaxZ;
            
            if (currentCollision || predictedCollision) {
                // Enhanced collision resolution
                // First, revert to previous position if it's a predicted collision only
                if (!currentCollision && predictedCollision) {
                    // Slow the player down in the direction of collision
                    const toObstacleX = obstacle.position.x - player.position.x;
                    const toObstacleY = obstacle.position.y - player.position.y;
                    const toObstacleZ = obstacle.position.z - player.position.z;
                    
                    const mag = Math.sqrt(toObstacleX * toObstacleX + toObstacleY * toObstacleY + toObstacleZ * toObstacleZ);
                    if (mag > 0) {
                        const normalX = toObstacleX / mag;
                        const normalY = toObstacleY / mag;
                        const normalZ = toObstacleZ / mag;
                        
                        const dot = player.velocity.x * normalX + player.velocity.y * normalY + player.velocity.z * normalZ;
                        if (dot > 0) {
                            player.velocity.x -= normalX * dot * 0.8;
                            player.velocity.y -= normalY * dot * 0.8;
                            player.velocity.z -= normalZ * dot * 0.8;
                        }
                    }
                }
                
                if (currentCollision) {
                    // For actual collisions, find the overlap in each axis
                    const overlapX = Math.min(playerMaxX - obstacleMinX, obstacleMaxX - playerMinX);
                    const overlapY = Math.min(playerMaxY - obstacleMinY, obstacleMaxY - playerMinY);
                    const overlapZ = Math.min(playerMaxZ - obstacleMinZ, obstacleMaxZ - playerMinZ);
                    
                    // Add a much larger buffer to the resolution to completely prevent clipping
                    const resolutionBuffer = 1.5; // Increased from 1.25 to 1.5 (50% extra push-out)
                    
                    // Check if player is on top of the obstacle
                    const isOnTop = player.position.y > obstacle.position.y + (obstacle.size.height / 2) - 0.2 && 
                                    player.velocity.y <= 0;
                    
                    // Special handling for ramps/inclines
                    const isIncline = obstacle.rotation && 
                                     (Math.abs(obstacle.rotation.x) > 0.01 || Math.abs(obstacle.rotation.z) > 0.01);
                    
                    // For inclines, if player is moving horizontally, prioritize upward movement
                    if (isIncline) {
                        // Calculate horizontal movement direction
                        const isMovingHorizontally = Math.abs(player.velocity.x) > 0.1 || Math.abs(player.velocity.z) > 0.1;
                        
                        if (isMovingHorizontally && overlapY < Math.max(overlapX, overlapZ) * 1.5) {
                            // Prioritize vertical resolution (sliding up the ramp)
                            const inclineBuffer = 1.1; // Increased from 1.05 to 1.1
                            
                            // Player is below the obstacle (moving up the incline)
                            if (player.position.y < obstacle.position.y) {
                                player.position.y -= overlapY * inclineBuffer;
                                player.velocity.y = 0;
                            } 
                            // Player is above the obstacle (moving down the incline)
                            else {
                                player.position.y += overlapY * inclineBuffer;
                                
                                // Set on ground if going down the incline
                                player.velocity.y = 0;
                                player.onGround = true;
                                player.isJumping = false;
                            }
                            
                            // Continue to next obstacle to avoid further resolution on this one
                            continue;
                        }
                    }
                    
                    // Resolve by the smallest overlap, with aggressive push-out
                    if (overlapX < overlapY && overlapX < overlapZ) {
                        // X-axis collision
                        if (player.position.x > obstacle.position.x) {
                            player.position.x += overlapX * resolutionBuffer;
                        } else {
                            player.position.x -= overlapX * resolutionBuffer;
                        }
                        player.velocity.x = -player.velocity.x * 0.1; // Reduced bounce even further
                    } else if (overlapY < overlapX && overlapY < overlapZ) {
                        // Y-axis collision
                        if (player.position.y > obstacle.position.y) {
                            // Player is above the obstacle
                            player.position.y += overlapY * resolutionBuffer;
                            
                            // If player is on top of the obstacle and moving downward, set onGround to true
                            if (isOnTop) {
                                player.velocity.y = 0;
                                player.onGround = true;
                                player.isJumping = false;
                            } else {
                                player.onGround = false;
                            }
                        } else {
                            // Player is below the obstacle
                            player.position.y -= overlapY * resolutionBuffer;
                            player.velocity.y = 0;
                        }
                    } else {
                        // Z-axis collision
                        if (player.position.z > obstacle.position.z) {
                            player.position.z += overlapZ * resolutionBuffer;
                        } else {
                            player.position.z -= overlapZ * resolutionBuffer;
                        }
                        player.velocity.z = -player.velocity.z * 0.1; // Reduced bounce even further
                    }
                    
                    // Double-check: Make sure player and obstacle don't overlap at all after resolution
                    const playerBoundsAfter = {
                        minX: player.position.x - player.size.width/2,
                        maxX: player.position.x + player.size.width/2,
                        minY: player.position.y - player.size.height/2,
                        maxY: player.position.y + player.size.height/2,
                        minZ: player.position.z - player.size.depth/2,
                        maxZ: player.position.z + player.size.depth/2
                    };
                    
                    const obstacleBounds = {
                        minX: obstacle.position.x - obstacle.size.width/2,
                        maxX: obstacle.position.x + obstacle.size.width/2,
                        minY: obstacle.position.y - obstacle.size.height/2,
                        maxY: obstacle.position.y + obstacle.size.height/2,
                        minZ: obstacle.position.z - obstacle.size.depth/2,
                        maxZ: obstacle.position.z + obstacle.size.depth/2
                    };
                    
                    // Final position check - if still overlapping, push out on the most significant axis
                    if (playerBoundsAfter.maxX > obstacleBounds.minX && playerBoundsAfter.minX < obstacleBounds.maxX &&
                        playerBoundsAfter.maxY > obstacleBounds.minY && playerBoundsAfter.minY < obstacleBounds.maxY &&
                        playerBoundsAfter.maxZ > obstacleBounds.minZ && playerBoundsAfter.minZ < obstacleBounds.maxZ) {
                        
                        // Find the smallest push needed to separate
                        const pushX1 = obstacleBounds.minX - playerBoundsAfter.maxX; // push left
                        const pushX2 = obstacleBounds.maxX - playerBoundsAfter.minX; // push right
                        const pushY1 = obstacleBounds.minY - playerBoundsAfter.maxY; // push down
                        const pushY2 = obstacleBounds.maxY - playerBoundsAfter.minY; // push up
                        const pushZ1 = obstacleBounds.minZ - playerBoundsAfter.maxZ; // push back
                        const pushZ2 = obstacleBounds.maxZ - playerBoundsAfter.minZ; // push forward
                        
                        // Find the smallest push distance (in absolute terms)
                        const pushes = [
                            { axis: 'x', dir: -1, value: Math.abs(pushX1) },
                            { axis: 'x', dir: 1, value: Math.abs(pushX2) },
                            { axis: 'y', dir: -1, value: Math.abs(pushY1) },
                            { axis: 'y', dir: 1, value: Math.abs(pushY2) },
                            { axis: 'z', dir: -1, value: Math.abs(pushZ1) },
                            { axis: 'z', dir: 1, value: Math.abs(pushZ2) }
                        ].sort((a, b) => a.value - b.value);
                        
                        // Apply the smallest push plus extra margin
                        const smallestPush = pushes[0];
                        const safetyMargin = 0.25; // Increased from 0.1 to 0.25
                        
                        if (smallestPush.axis === 'x') {
                            player.position.x += smallestPush.dir * (smallestPush.value + safetyMargin);
                            player.velocity.x = 0; // Just stop momentum completely
                        } else if (smallestPush.axis === 'y') {
                            player.position.y += smallestPush.dir * (smallestPush.value + safetyMargin);
                            player.velocity.y = 0;
                            if (smallestPush.dir === 1) { // Pushed up
                                player.onGround = true;
                                player.isJumping = false;
                            }
                        } else { // z-axis
                            player.position.z += smallestPush.dir * (smallestPush.value + safetyMargin);
                            player.velocity.z = 0; // Just stop momentum completely
                        }
                    }
                }
            }
        }
    }

    handleHammerObstacleCollisions(hammer) {
        for (const obstacle of this.obstacles) {
            // All obstacles should be solid
            if (obstacle.isSolid === false) continue;
            
            // Improved sphere-AABB collision for hammer with larger radius
            const hammerRadius = 0.75; // Updated to match physics controller value
            
            // Larger buffer for obstacles to create hard edges
            let rotationBuffer = 0.3; // Base buffer for all obstacles
            if (obstacle.rotation && (Math.abs(obstacle.rotation.x) > 0.01 || 
                                    Math.abs(obstacle.rotation.z) > 0.01)) {
                rotationBuffer = 0.5; // 50% buffer for tilted obstacles
            }
            
            const obstacleMinX = obstacle.position.x - (obstacle.size.width/2 + rotationBuffer);
            const obstacleMaxX = obstacle.position.x + (obstacle.size.width/2 + rotationBuffer);
            const obstacleMinY = obstacle.position.y - (obstacle.size.height/2 + rotationBuffer);
            const obstacleMaxY = obstacle.position.y + (obstacle.size.height/2 + rotationBuffer);
            const obstacleMinZ = obstacle.position.z - (obstacle.size.depth/2 + rotationBuffer);
            const obstacleMaxZ = obstacle.position.z + (obstacle.size.depth/2 + rotationBuffer);
            
            // Find closest point on obstacle to hammer center
            const closestX = Math.max(obstacleMinX, Math.min(hammer.position.x, obstacleMaxX));
            const closestY = Math.max(obstacleMinY, Math.min(hammer.position.y, obstacleMaxY));
            const closestZ = Math.max(obstacleMinZ, Math.min(hammer.position.z, obstacleMaxZ));
            
            // Calculate distance between hammer center and closest point
            const distanceX = hammer.position.x - closestX;
            const distanceY = hammer.position.y - closestY;
            const distanceZ = hammer.position.z - closestZ;
            const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY + distanceZ * distanceZ);
            
            if (distance < hammerRadius) {
                // Collision detected, calculate normal vector
                const normal = { 
                    x: distanceX / distance || 0, 
                    y: distanceY / distance || 0, 
                    z: distanceZ / distance || 0 
                };
                
                // Stronger push-out to ensure no clipping
                const pushFactor = 1.5; // Increased from 1.2 to 1.5 (50% extra push)
                hammer.position.x = closestX + normal.x * hammerRadius * pushFactor;
                hammer.position.y = closestY + normal.y * hammerRadius * pushFactor;
                hammer.position.z = closestZ + normal.z * hammerRadius * pushFactor;
                
                // Calculate reflection vector for harder bounces
                const dot = hammer.velocity.x * normal.x + hammer.velocity.y * normal.y + hammer.velocity.z * normal.z;
                
                // More predictable bounce with less energy loss
                const bounceFactor = 0.95; // 95% energy preserved for harder bounces
                hammer.velocity.x = (hammer.velocity.x - 2 * dot * normal.x) * bounceFactor;
                hammer.velocity.y = (hammer.velocity.y - 2 * dot * normal.y) * bounceFactor;
                hammer.velocity.z = (hammer.velocity.z - 2 * dot * normal.z) * bounceFactor;
                
                // Reduce random variation for more predictable, harder bounces
                const randomVariation = 0.05; // Reduced from 0.1 to 0.05
                hammer.velocity.x += (Math.random() * 2 - 1) * randomVariation;
                hammer.velocity.z += (Math.random() * 2 - 1) * randomVariation;
                
                hammer.bounces++;
                
                // Double-check distance after resolution to ensure no clipping
                const newDistanceX = hammer.position.x - closestX;
                const newDistanceY = hammer.position.y - closestY;
                const newDistanceZ = hammer.position.z - closestZ;
                const newDistance = Math.sqrt(newDistanceX * newDistanceX + newDistanceY * newDistanceY + newDistanceZ * newDistanceZ);
                
                // If still too close, push out further
                if (newDistance < hammerRadius) {
                    const safetyMargin = 0.1; // Extra safety margin
                    const additionalPush = (hammerRadius - newDistance) + safetyMargin;
                    
                    hammer.position.x += (newDistanceX / newDistance) * additionalPush;
                    hammer.position.y += (newDistanceY / newDistance) * additionalPush;
                    hammer.position.z += (newDistanceZ / newDistance) * additionalPush;
                }
                
                // Create flipping rotation based on new velocity direction
                const newVelocityMag = Math.sqrt(
                    hammer.velocity.x * hammer.velocity.x + 
                    hammer.velocity.y * hammer.velocity.y + 
                    hammer.velocity.z * hammer.velocity.z
                );
                
                if (newVelocityMag > 0) {
                    // Calculate normalized direction vector
                    const newDir = {
                        x: hammer.velocity.x / newVelocityMag,
                        y: hammer.velocity.y / newVelocityMag,
                        z: hammer.velocity.z / newVelocityMag
                    };
                    
                    // Calculate perpendicular vector for rotation
                    let perpVector;
                    
                    // If we're moving mostly vertically, use a different perpendicular vector
                    if (Math.abs(newDir.y) > 0.8) {
                        // For vertical movement, rotate around world X axis
                        perpVector = {
                            x: 1,
                            y: 0,
                            z: 0
                        };
                    } else {
                        // For horizontal movement, calculate a perpendicular vector in the horizontal plane
                        perpVector = {
                            x: -newDir.z,
                            y: 0,
                            z: newDir.x
                        };
                    }
                    
                    // Normalize perpendicular vector
                    const perpMagnitude = Math.sqrt(
                        perpVector.x * perpVector.x + 
                        perpVector.y * perpVector.y + 
                        perpVector.z * perpVector.z
                    );
                    
                    if (perpMagnitude > 0) {
                        perpVector.x /= perpMagnitude;
                        perpVector.y /= perpMagnitude;
                        perpVector.z /= perpMagnitude;
                    }
                    
                    // Update rotation speed to ensure consistent flipping - increased rotation for better visual effect
                    hammer.rotationSpeed = { 
                        x: perpVector.x * 30, // Increased from 25 to 30 for more dramatic spins
                        y: perpVector.y * 30, 
                        z: perpVector.z * 30
                    };
                }

                    // If hammer stops, slow down rotation
                if (newVelocityMag < 1) {
                    hammer.rotationSpeed.x *= 0.3;
                    hammer.rotationSpeed.y *= 0.3;
                    hammer.rotationSpeed.z *= 0.3;
                }
                
                // Increase the max bounces for hammers
                if (hammer.bounces >= hammer.maxBounces) {
                    hammer.active = false;
                    hammer.landTime = Date.now();
                }
            }
        }
    }

    handleHammerPlayerCollisions(hammer) {
        // Skip if hammer is not active or is recently thrown (to prevent hitting thrower)
        if (!hammer.active || Date.now() - hammer.throwTime < 300) return;
        
        for (const id in this.players) {
            const player = this.players[id];
            // Skip if player is not alive or is the hammer owner
            if (!player.isAlive || id === hammer.ownerId) continue;
            
            // Skip if player was recently hit (invulnerability period)
            if (Date.now() - player.lastHitTime < 1000) continue;
            
            // Expand the player hitbox vertically to better match the visual model
            const hitboxExpansion = 0.2; // Add expansion to better match the visual model
            const playerMinX = player.position.x - (player.size.width/2);
            const playerMaxX = player.position.x + (player.size.width/2);
            // Adjust the Y boundaries to extend higher to match the visual model
            const playerMinY = player.position.y - (player.size.height/2);
            const playerMaxY = player.position.y + (player.size.height/2 + hitboxExpansion); // Expand upward
            const playerMinZ = player.position.z - (player.size.depth/2);
            const playerMaxZ = player.position.z + (player.size.depth/2);
            
            // For the hammer, use its actual size to match the visual model
            const hammerRadius = 0.7; // Slightly increased from 0.6 for better collision detection
            
            // Check if hammer's center is inside the player AABB
            // We expand the player AABB by the hammer radius for sphere-AABB collision
            if (hammer.position.x + hammerRadius > playerMinX && 
                hammer.position.x - hammerRadius < playerMaxX &&
                hammer.position.y + hammerRadius > playerMinY && 
                hammer.position.y - hammerRadius < playerMaxY &&
                hammer.position.z + hammerRadius > playerMinZ && 
                hammer.position.z - hammerRadius < playerMaxZ) {
                
                // Hit player
                player.health--;
                player.lastHitTime = Date.now();
                player.lastHitBy = hammer.ownerId;
                player.staggerTime = Date.now(); // Set stagger start time
                
                // Calculate hit direction based on hammer's position relative to player center
                const hitDirX = hammer.position.x - player.position.x;
                const hitDirY = hammer.position.y - player.position.y;
                const hitDirZ = hammer.position.z - player.position.z;
                
                // Normalize the hit direction
                const hitDirMagnitude = Math.sqrt(hitDirX * hitDirX + hitDirY * hitDirY + hitDirZ * hitDirZ);
                const knockbackDir = {
                    x: hitDirMagnitude > 0 ? hitDirX / hitDirMagnitude : 0,
                    y: 0.3, // Slight upward force
                    z: hitDirMagnitude > 0 ? hitDirZ / hitDirMagnitude : 0
                };
                
                // Apply knockback with reduced force
                const knockbackPower = 7; // Reduced from 15 to 7
                player.velocity.x += knockbackDir.x * knockbackPower;
                player.velocity.y += knockbackDir.y * knockbackPower;
                player.velocity.z += knockbackDir.z * knockbackPower;
                
                player.onGround = false;
                
                // Make the hammer inactive but don't automatically return it to thrower
                hammer.active = false;
                hammer.landTime = Date.now();
                // Removed auto hammer return on hit
                
                // If player dies, handle that
                if (player.health <= 0) {
                    this.handlePlayerDeath(id, hammer.ownerId);
                    
                    // Award hammer to attacker if they exist and have less than 3 hammers
                    if (hammer.ownerId && this.players[hammer.ownerId]) {
                        const attackerPlayer = this.players[hammer.ownerId];
                        if (attackerPlayer && attackerPlayer.hammers < 3) {
                            attackerPlayer.hammers++;
                        }
                    }
                }
            }
        }
    }

    // Bot AI logic
    updateBot(botId, players, deltaTime) {
        const bot = this.players[botId];
        if (!bot || !bot.isAlive) return;
        
        // Basic state machine for bot behavior
        const now = Date.now();
        
        // Initialize bot's previous velocity if it doesn't exist
        if (!bot.prevVelocity) {
            bot.prevVelocity = { x: 0, z: 0 };
        }
        
        // Initialize bot's target hammer if it doesn't exist
        if (!bot.targetHammerId) {
            bot.targetHammerId = null;
        }
        
        // Assign each bot a personal zone if they don't have one yet
        if (!bot.personalZone) {
            // Divide the map into sections and assign a zone
            const sectionX = Math.floor(Math.random() * 4); // 0-3
            const sectionZ = Math.floor(Math.random() * 4); // 0-3
            
            // Randomize position within section to avoid grid-like positioning
            const zoneX = -this.mapSize.width/2 + 10 + sectionX * (this.mapSize.width - 20)/4 + Math.random() * ((this.mapSize.width - 20)/4 - 10);
            const zoneZ = -this.mapSize.height/2 + 10 + sectionZ * (this.mapSize.height - 20)/4 + Math.random() * ((this.mapSize.height - 20)/4 - 10);
            
            bot.personalZone = { x: zoneX, z: zoneZ };
            
            // Also create a patrolling route around this zone
            const patrolRadius = 10 + Math.random() * 15;
            bot.patrolRoute = [];
            
            // Create 3-5 patrol points in a circle around the zone
            const numPoints = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < numPoints; i++) {
                const angle = (i / numPoints) * Math.PI * 2;
                bot.patrolRoute.push({
                    x: bot.personalZone.x + Math.cos(angle) * patrolRadius,
                    z: bot.personalZone.z + Math.sin(angle) * patrolRadius
                });
            }
            
            // Current patrol point index
            bot.currentPatrolPoint = 0;
        }
        
        // Find nearest player, hammer, and collect other bots
        let nearestPlayer = null;
        let nearestPlayerDist = Infinity;
        let nearestHammer = null;
        let nearestHammerDist = Infinity;
        let nearbyBots = [];
        let otherPlayers = [];
        
        // Store all available hammers for targeting
        const availableHammers = [];
        
        // Check everyone in the game
        for (const id in players) {
            if (id === botId) continue;
            
            const player = players[id];
            if (!player.isAlive) continue;
            
            // Calculate distance to this entity
            const dist = Math.sqrt(
                Math.pow(bot.position.x - player.position.x, 2) +
                Math.pow(bot.position.z - player.position.z, 2)
            );
            
            // Track all other players
            otherPlayers.push({
                player: player,
                distance: dist
            });
            
            // Check if this is another bot
            if (player.isBot) {
                // Collect all bots within range for collision avoidance
                if (dist < 30) {
                    nearbyBots.push({
                        id: id,
                        position: player.position,
                        distance: dist,
                        isAggressive: player.meleeActive || player.dashPerformed
                    });
                }
            }
            
            // Track nearest player (bot or human)
            if (dist < nearestPlayerDist) {
                nearestPlayerDist = dist;
                nearestPlayer = player;
            }
        }
        
        // Scan for hammers
        for (const hammer of this.hammers) {
            if (!hammer.active) continue;
            
            // Skip hammers currently in motion
            if (hammer.velocity.x !== 0 || hammer.velocity.z !== 0) continue;
            
                    const dist = Math.sqrt(
                        Math.pow(bot.position.x - hammer.position.x, 2) +
                        Math.pow(bot.position.z - hammer.position.z, 2)
                    );
                    
                    if (dist < nearestHammerDist) {
                        nearestHammerDist = dist;
                        nearestHammer = hammer;
            }
            
            availableHammers.push({
                hammer: hammer,
                id: hammer.id,
                distance: dist
            });
                }
                
                // Sort hammers by distance
                availableHammers.sort((a, b) => a.distance - b.distance);
                
        // Bot strategy and movement
        let targetVelocity = { x: 0, z: 0 };
        
        // Helper function to check for obstacles
        const checkForObstacles = (targetX, targetZ) => {
            // Direction from current position to target
            const dirX = targetX - bot.position.x;
            const dirZ = targetZ - bot.position.z;
            const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);
            
            // If target is too close, no need to check
            if (dist < 1) return { hasObstacle: false, canJumpOver: false, isEdge: false };
            
            // Normalize direction
            const normDirX = dirX / dist;
            const normDirZ = dirZ / dist;
            
            // Check a point ahead in the path
            const checkDist = Math.min(dist, 5); // Check up to 5 units ahead
            const checkPoint = {
                x: bot.position.x + normDirX * checkDist,
                z: bot.position.z + normDirZ * checkDist
            };
            
            // Check if any obstacle is in the path
            for (const obstacle of this.obstacles) {
                // Skip trampolines - we can walk on those
                if (obstacle.type === 'trampoline') continue;
                
                // Basic bounding box collision check
                const bufferSize = 1.0;
                const obstacleMinX = obstacle.position.x - (obstacle.size.width/2 + bufferSize);
                const obstacleMaxX = obstacle.position.x + (obstacle.size.width/2 + bufferSize);
                const obstacleMinZ = obstacle.position.z - (obstacle.size.depth/2 + bufferSize);
                const obstacleMaxZ = obstacle.position.z + (obstacle.size.depth/2 + bufferSize);
                const obstacleTopY = obstacle.position.y + obstacle.size.height/2;
                const obstacleBottomY = obstacle.position.y - obstacle.size.height/2;
                
                // If obstacle is above us but not too high, we can jump over it
                const canJumpOver = obstacleTopY - bot.position.y < 2;
                
                // Check if our projected path intersects with obstacle
                if (checkPoint.x >= obstacleMinX && checkPoint.x <= obstacleMaxX &&
                    checkPoint.z >= obstacleMinZ && checkPoint.z <= obstacleMaxZ) {
                    return { hasObstacle: true, canJumpOver, isEdge: false };
                }
            }
            
            return { hasObstacle: false, canJumpOver: false, isEdge: false };
        };
        
        // Calculate the move speed based on the bot's situation
        const calculateMoveSpeed = () => {
            const baseSpeed = 11; // Reduced from 12 to 11 for slightly less frantic movement
            return baseSpeed;
        };
        
        // ONLY allow jumping in specific cases
        const shouldJump = (reason) => {
            // Only jump if on the ground
            if (!bot.onGround) return false;
            
            // Jump if we need to get over an obstacle
            if (reason === 'obstacle') return true;
            
            // Jump if attacking and close to target (decreased chance)
            if (reason === 'attack' && Math.random() < 0.08) return true; // Reduced from 0.15 to 0.08
            
            // Jump occasionally during exploration (to appear more active)
            if (reason === 'explore' && Math.random() < 0.02) return true; // Reduced from 0.05 to 0.02
            
            // Jump if pursuing a player and they're jumping
            if (reason === 'pursue' && nearestPlayer && nearestPlayer.isJumping && Math.random() < 0.4) return true; // Reduced from 0.6 to 0.4
            
            // Never jump randomly otherwise
            return false;
        };
        
        // STATE MACHINE APPROACH
        let botState = 'patrol';
        
        // Attack if has hammers and a player is nearby - increased detection range
        if (bot.hammers > 0 && nearestPlayer && nearestPlayerDist < 50) { // Increased from 30 to 50
            botState = 'attack';
        } 
        // Attack even without hammers using melee if very close
        else if (bot.hammers === 0 && nearestPlayer && nearestPlayerDist < 15) {
            botState = 'attack';
        }
        // Go for hammer if needed and it's reasonably close
        else if (bot.hammers === 0 && nearestHammer && nearestHammerDist < 90) { // Increased from 70 to 90
            botState = 'getHammer';
        } 
        // Go for hammer if needed (regardless of distance) - increased probability
        else if (bot.hammers === 0 && nearestHammer && Math.random() < 0.9) { // Increased from 0.8 to 0.9
            botState = 'getHammer';
        }
        // Otherwise patrol assigned zone
        else {
            // Default to patrol but with chance to explore instead
            botState = Math.random() < 0.3 ? 'explore' : 'patrol'; // Reduced patrol likelihood from 0.6 to 0.7
        }
        
        // Add randomness to behavior switching to make bots more dynamic
        // Chance to switch between states for more activity
        if (botState === 'patrol' && Math.random() < 0.05) { // 5% chance to switch from patrol to explore
            botState = 'explore';
        } else if (botState === 'explore' && Math.random() < 0.05) { // 5% chance to switch from explore to patrol
            botState = 'patrol';
        }
        
        // Activity timer to prevent getting stuck in one state too long
        if (!bot.lastStateChange) {
            bot.lastStateChange = now;
            bot.currentState = botState;
        }
        
        // Force state change after 8 seconds in same state (unless avoiding or attacking)
        if (botState !== 'avoid' && botState !== 'attack' && 
            bot.currentState === botState && now - bot.lastStateChange > 8000) {
            botState = bot.currentState === 'patrol' ? 'explore' : 'patrol';
            bot.lastStateChange = now;
            bot.currentState = botState;
        }
        
        // If state has changed, update tracking
        if (bot.currentState !== botState) {
            bot.lastStateChange = now;
            bot.currentState = botState;
        }
        
        // Check if any bot is too close and must be avoided
        const tooCloseBots = nearbyBots.filter(nearbyBot => nearbyBot.distance < 12); // Reduced from 15 to 12 to stay closer to other bots
        
        // Bot avoidance is HIGHEST priority - it overrides all other behaviors
        // But now we'll make it only override if not in attack mode and close to a player
        if (tooCloseBots.length > 0 && !(botState === 'attack' && nearestPlayerDist < 20)) {
            botState = 'avoid';
        }
        
        // Action based on state
        switch (botState) {
            case 'attack':
                // Attack the nearest player
                if (nearestPlayer) {
            // Calculate direction to player
            const direction = {
                x: nearestPlayer.position.x - bot.position.x,
                y: nearestPlayer.position.y + 0.8 - bot.position.y, // Aim more precisely (changed from +1)
                z: nearestPlayer.position.z - bot.position.z
            };
            
                    // Add minimal randomness for less twitchy aiming but still accurate
                    direction.x += (Math.random() * 2 - 1) * 0.5; // Reduced from *1 to *0.5
                    direction.y += (Math.random() * 0.05); // Reduced from 0.1 to 0.05
                    direction.z += (Math.random() * 2 - 1) * 0.5; // Reduced from *1 to *0.5
                    
                    // Decide on melee vs throw
                    const meleeRange = 10; // Increased from 8 to 10
                    
                    // Use melee if very close
                    if (nearestPlayerDist < meleeRange && now - bot.lastMelee > 800) { // Reduced cooldown from 1000 to 800ms
                // Set up melee attack
                bot.meleeActive = true;
                bot.lastMelee = now;
                
                        // Get direction to target
                const toTarget = {
                    x: nearestPlayer.position.x - bot.position.x,
                            y: 0,
                    z: nearestPlayer.position.z - bot.position.z
                };
                
                        // Normalize
                const magnitude = Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z);
                if (magnitude > 0) {
                    toTarget.x /= magnitude;
                    toTarget.z /= magnitude;
                }
                
                        // Store for hit detection
                bot.lastMeleeDirection = {
                    x: toTarget.x,
                    y: 0,
                    z: toTarget.z
                };
                
                        // Add a dash effect for more aggressive melee (30% chance instead of 50%)
                        if (Math.random() < 0.3) {
                            bot.dashPerformed = true;
                            bot.dashDirection = {...bot.lastMeleeDirection};
                            bot.dashStart = now;
                            bot.dashDuration = 200; // 200ms dash
                        }
                
                        // Reset after animation
                setTimeout(() => {
                            if (bot) bot.meleeActive = false;
                }, 300);
                
                        // Move toward target during attack with higher speed but less twitchy
                        targetVelocity.x = toTarget.x * 10; // Reduced from 12 to 10
                        targetVelocity.z = toTarget.z * 10; // Reduced from 12 to 10
                        
                        // Maybe jump for effect (reduced chance)
                        if (shouldJump('attack')) {
                    bot.velocity.y = 6; // Increased from 5 to 6
                    bot.onGround = false;
                    bot.isJumping = true;
                }
            } else {
                // Throw hammer with higher power but more consistent
                this.throwHammer(botId, direction, 1.0 + Math.random() * 0.3); // Reduced randomness from 0.5 to 0.3
                
                        // Move sideways after throwing
                        const sidewaysDir = {
                            x: -direction.z, // Perpendicular to throw direction
                            z: direction.x
                        };
                        
                        // Normalize
                        const magnitude = Math.sqrt(sidewaysDir.x * sidewaysDir.x + sidewaysDir.z * sidewaysDir.z);
                        if (magnitude > 0) {
                            sidewaysDir.x /= magnitude;
                            sidewaysDir.z /= magnitude;
                        }
                        
                        // Apply sideways movement (strafing)
                        const moveSpeed = calculateMoveSpeed();
                        targetVelocity.x = sidewaysDir.x * moveSpeed * (Math.random() > 0.5 ? 1 : -1);
                        targetVelocity.z = sidewaysDir.z * moveSpeed * (Math.random() > 0.5 ? 1 : -1);
                        
                        // Check if player is jumping and jump too to aim better
                        if (nearestPlayer.isJumping && shouldJump('pursue')) {
                            bot.velocity.y = 6;
                            bot.onGround = false;
                            bot.isJumping = true;
                        }
                    }
                }
                break;
                
            case 'getHammer':
                // Go for the nearest hammer
                if (nearestHammer) {
            // Calculate direction to hammer
            const direction = {
                x: nearestHammer.position.x - bot.position.x,
                z: nearestHammer.position.z - bot.position.z
            };
            
                    // Normalize
            const magnitude = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
            if (magnitude > 0) {
                direction.x /= magnitude;
                direction.z /= magnitude;
            }
            
                    // Store target hammer ID
                    bot.targetHammerId = nearestHammer.id;
                    
                    // Check for obstacles
            const obstacleCheck = checkForObstacles(nearestHammer.position.x, nearestHammer.position.z);
            
                    // Move toward hammer with increased speed
                    const moveSpeed = calculateMoveSpeed() * 1.3; // Increased from default to 1.3x faster
                    targetVelocity.x = direction.x * moveSpeed;
                    targetVelocity.z = direction.z * moveSpeed;
                    
                    // Jump only if there's an obstacle to get over
                    if (obstacleCheck.hasObstacle && obstacleCheck.canJumpOver && shouldJump('obstacle')) {
                        bot.velocity.y = 10;
                bot.onGround = false;
                bot.isJumping = true;
            }
                }
                break;
                
            case 'avoid':
                // Calculate average direction away from all too-close bots
                let avoidX = 0;
                let avoidZ = 0;
                
                for (const nearbyBot of tooCloseBots) {
                    const dx = bot.position.x - nearbyBot.position.x;
                    const dz = bot.position.z - nearbyBot.position.z;
                    const dist = Math.max(0.1, nearbyBot.distance);
                    
                    // Weight is much stronger at close distances, using inverse square law
                    const weight = 3.0 / (dist * dist); // Increased weight factor from 1.0 to 3.0
                    
                    avoidX += dx * weight;
                    avoidZ += dz * weight;
                }
                
                // Normalize avoidance direction
                const avoidMagnitude = Math.sqrt(avoidX * avoidX + avoidZ * avoidZ);
                if (avoidMagnitude > 0) {
                    avoidX /= avoidMagnitude;
                    avoidZ /= avoidMagnitude;
                }
                
                // Very strong movement away from other bots
                const moveSpeed = calculateMoveSpeed() * 2.0; // Increased from 1.5 to 2.0
                targetVelocity.x = avoidX * moveSpeed;
                targetVelocity.z = avoidZ * moveSpeed;
                
                // Add random perpendicular component to avoid gridlock situations
                const perpX = -avoidZ;
                const perpZ = avoidX;
                const randomStrength = Math.random() * 0.4; // Up to 40% perpendicular movement
                
                targetVelocity.x += perpX * moveSpeed * randomStrength * (Math.random() > 0.5 ? 1 : -1);
                targetVelocity.z += perpZ * moveSpeed * randomStrength * (Math.random() > 0.5 ? 1 : -1);
                
                // Prevent jumping during avoidance to maintain predictable movement
                break;
                
            case 'patrol':
                // Check if we've been patrolling too long without updates (bot might be stuck)
                if (!bot.lastPatrolUpdate) {
                    bot.lastPatrolUpdate = now;
                }
                
                // If patrol has been active for over 5 seconds without reaching a point, change it
                if (now - bot.lastPatrolUpdate > 5000) {
                    bot.patrolRoute = null;
                    bot.lastPatrolUpdate = now;
                }
                
                // Move along patrol route
                if (!bot.patrolRoute || bot.patrolRoute.length === 0) {
                    // Create a new patrol route if needed
                    bot.patrolRoute = [];
                    const patrolRadius = 15 + Math.random() * 20; // Increased from 10+15 to 15+20 for wider coverage
                    const numPoints = 3 + Math.floor(Math.random() * 3);
                    
                    for (let i = 0; i < numPoints; i++) {
                        const angle = (i / numPoints) * Math.PI * 2;
                        bot.patrolRoute.push({
                            x: bot.personalZone.x + Math.cos(angle) * patrolRadius,
                            z: bot.personalZone.z + Math.sin(angle) * patrolRadius
                        });
                    }
                    
                    bot.currentPatrolPoint = 0;
                }
                
                // Current target point
                const targetPoint = bot.patrolRoute[bot.currentPatrolPoint];
                
                // Direction to target point
                const dx = targetPoint.x - bot.position.x;
                const dz = targetPoint.z - bot.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                
                // If close enough to current patrol point, move to next
                if (dist < 3) {
                    bot.currentPatrolPoint = (bot.currentPatrolPoint + 1) % bot.patrolRoute.length;
                    bot.lastPatrolUpdate = now; // Reset timer when reaching a point
                } else {
                    // Move toward target point with increased speed
                    const moveSpeed = calculateMoveSpeed() * 0.9; // Increased from 0.8 to 0.9
                    targetVelocity.x = (dx / dist) * moveSpeed;
                    targetVelocity.z = (dz / dist) * moveSpeed;
                    
                    // Check for obstacles
                    const obstacleCheck = checkForObstacles(targetPoint.x, targetPoint.z);
                    
                    // Jump only if there's an obstacle to get over
                    if (obstacleCheck.hasObstacle && obstacleCheck.canJumpOver && shouldJump('obstacle')) {
                        bot.velocity.y = 10;
                        bot.onGround = false;
                        bot.isJumping = true;
                    }
                }
                break;
                
            case 'explore':
                // If no exploration target or the bot is close to it already, pick a new one
                if (!bot.exploreTarget || 
                    (Math.abs(bot.position.x - bot.exploreTarget.x) < 3 && 
                     Math.abs(bot.position.z - bot.exploreTarget.z) < 3)) {
                    
                    // Pick a random point on the map to explore, biased toward areas with players
                    let targetX, targetZ;
                    
                    // 50% chance to target areas with players (reduced from 70%)
                    if (otherPlayers.length > 0 && Math.random() < 0.5) { // Reduced from 0.7 to 0.5
                        // Pick a random player to head toward, weighted by distance (prefer closer ones)
                        otherPlayers.sort((a, b) => a.distance - b.distance);
                        
                        // Choose from the first 3 closest players or all if fewer
                        const candidateCount = Math.min(3, otherPlayers.length);
                        const targetIndex = Math.floor(Math.random() * candidateCount);
                        const targetPlayer = otherPlayers[targetIndex].player;
                        
                        // Don't go directly to player position, but somewhere in that general area
                        const offset = 25 + Math.random() * 25; // Slightly larger offset for less swarming
                        const angle = Math.random() * Math.PI * 2;
                        
                        targetX = targetPlayer.position.x + Math.cos(angle) * offset;
                        targetZ = targetPlayer.position.z + Math.sin(angle) * offset;
                    } else {
                        // Random point on the map
                        targetX = Math.random() * this.mapSize.width - this.mapSize.width/2;
                        targetZ = Math.random() * this.mapSize.height - this.mapSize.height/2;
                    }
                    
                    // Create a new exploration target
                    bot.exploreTarget = { x: targetX, z: targetZ };
                    
                    // Occasional jump when starting a new exploration (reduced chance)
                    if (Math.random() < 0.15 && shouldJump('explore')) { // Reduced from 0.3 to 0.15
                        bot.velocity.y = 8; // Reduced from 10 to 8
                        bot.onGround = false;
                        bot.isJumping = true;
                    }
                }
                
                // Direction to exploration target
                const exDx = bot.exploreTarget.x - bot.position.x;
                const exDz = bot.exploreTarget.z - bot.position.z;
                const exDist = Math.sqrt(exDx * exDx + exDz * exDz);
                
                // Move toward exploration target with less randomness
                const exploreMoveSpeed = calculateMoveSpeed() * 0.9; // Reduced from 0.95 to 0.9
                
                // Add minimal wobble to make movement less twitchy but still natural
                const wobbleAmount = 0.1; // Reduced from 0.2 to 0.1
                const wobbleX = (Math.random() * 2 - 1) * wobbleAmount;
                const wobbleZ = (Math.random() * 2 - 1) * wobbleAmount;
                
                targetVelocity.x = ((exDx / exDist) + wobbleX) * exploreMoveSpeed;
                targetVelocity.z = ((exDz / exDist) + wobbleZ) * exploreMoveSpeed;
                
                // Check for obstacles
                const exploreObstacleCheck = checkForObstacles(bot.exploreTarget.x, bot.exploreTarget.z);
                
                // Jump if needed to get over obstacles
                if (exploreObstacleCheck.hasObstacle && exploreObstacleCheck.canJumpOver && shouldJump('obstacle')) {
                    bot.velocity.y = 10;
                    bot.onGround = false;
                    bot.isJumping = true;
                }
                
                // Occasional jump while exploring (separate from shouldJump to make it more common)
                if (bot.onGround && Math.random() < 0.005) { // 0.5% chance per update
                    bot.velocity.y = 10;
                    bot.onGround = false;
                    bot.isJumping = true;
                }
                
                break;
        }
        
        // Ensure bots stay within map bounds
        const margin = 5;
        const mapMinX = -this.mapSize.width/2 + margin;
        const mapMaxX = this.mapSize.width/2 - margin;
        const mapMinZ = -this.mapSize.height/2 + margin;
        const mapMaxZ = this.mapSize.height/2 - margin;
        
        // If about to go out of bounds, reverse direction
        const projectedX = bot.position.x + targetVelocity.x * deltaTime;
        const projectedZ = bot.position.z + targetVelocity.z * deltaTime;
        
        if (projectedX < mapMinX || projectedX > mapMaxX) {
            targetVelocity.x = -targetVelocity.x;
        }
        
        if (projectedZ < mapMinZ || projectedZ > mapMaxZ) {
            targetVelocity.z = -targetVelocity.z;
        }
        
        // Smooth bot movement with higher smoothing factor for less twitchy movement
        const smoothingFactor = 0.15; // Reduced from 0.25 to 0.15 for smoother, less twitchy movement
        
        bot.velocity.x = bot.prevVelocity.x + (targetVelocity.x - bot.prevVelocity.x) * smoothingFactor;
        bot.velocity.z = bot.prevVelocity.z + (targetVelocity.z - bot.prevVelocity.z) * smoothingFactor;
        
        // Store current velocity as previous for next update
        bot.prevVelocity = { x: bot.velocity.x, z: bot.velocity.z };
    }

    getState() {
        return {
            players: this.players,
            hammers: this.hammers,
            obstacles: this.obstacles,
            powerups: this.powerups,
            mapSize: this.mapSize
        };
    }

    // New method to check if player is standing on any obstacle
    checkPlayerStandingOnObstacle(player) {
        // Small threshold to detect if player is slightly above an obstacle
        const feetPosition = player.position.y - player.size.height/2 + 0.1;
        const checkDistance = 0.3; // Increased from 0.2 to better handle walking up slopes
        
        // Get player's horizontal bounds for checking
        const playerMinX = player.position.x - player.size.width/2;
        const playerMaxX = player.position.x + player.size.width/2;
        const playerMinZ = player.position.z - player.size.depth/2;
        const playerMaxZ = player.position.z + player.size.depth/2;
                
        // Track if we're standing on anything
        let standingOnSomething = false;
        
        // Track the highest obstacle the player is standing on (for ramps)
        let highestObstacleY = -Infinity;
        
        // Track if player is standing on a trampoline
        let trampolineFound = false;
        
        for (const obstacle of this.obstacles) {
            // Get obstacle top Y position, considering rotation
            const obstacleTopY = obstacle.position.y + obstacle.size.height/2;
            
            // Skip obstacles that are too far above or below the player
            if (Math.abs(feetPosition - obstacleTopY) > 1.0) {
                continue;
            }
            
            // Calculate obstacle bounds
            const obstacleMinX = obstacle.position.x - obstacle.size.width/2;
            const obstacleMaxX = obstacle.position.x + obstacle.size.width/2;
            const obstacleMinZ = obstacle.position.z - obstacle.size.depth/2;
            const obstacleMaxZ = obstacle.position.z + obstacle.size.depth/2;
                
            // Check if player is within horizontal bounds of the obstacle
            if (playerMaxX > obstacleMinX && playerMinX < obstacleMaxX &&
                playerMaxZ > obstacleMinZ && playerMinZ < obstacleMaxZ) {
                
                // Special handling for trampolines
                if (obstacle.isTrampoline && Math.abs(feetPosition - obstacleTopY) <= checkDistance * 3) { // Increased detection threshold
                    trampolineFound = true;
                    
                    // Check for downward velocity or player landing
                    if (player.velocity.y <= 0.1) {
                        // Check bounce cooldown to prevent excessive bounces
                        const now = Date.now();
                        if (!obstacle.lastBounceTime || now - obstacle.lastBounceTime > 300) { // 300ms cooldown
                            // Use fixed bounce velocity if provided, otherwise calculate
                            let bounceVelocity = obstacle.bounceVelocity || 20.0;
                            
                            // Update player physics
                            player.velocity.y = bounceVelocity;
                            player.onGround = false;
                            player.isJumping = true;
                            
                            // Trigger bounce animation on the obstacle if it has the function
                            if (obstacle.mesh && obstacle.triggerBounce) {
                                obstacle.triggerBounce();
                            }
                            
                            // Update last bounce time
                            obstacle.lastBounceTime = now;
                            
                            // Log bounce event (reduced to only show key information)
                            console.log("TRAMPOLINE BOUNCE", {
                                playerPos: {
                                    x: Math.round(player.position.x * 100) / 100,
                                    y: Math.round(player.position.y * 100) / 100,
                                    z: Math.round(player.position.z * 100) / 100
                                },
                                bounceVelocity
                            });
                        }
                    }
                    continue; // Skip the rest of the processing for this obstacle
                }
                
                // Special handling for inclines/ramps (obstacles with X or Z rotation)
                if (obstacle.rotation && (Math.abs(obstacle.rotation.x) > 0.01 || Math.abs(obstacle.rotation.z) > 0.01)) {
                    // For simplicity, we use a more generous vertical threshold for inclines
                    const rampCheckDistance = 0.5; // More generous for ramps
                    
                    // Use relative position from center to handle arbitrary inclines
                    const relX = player.position.x - obstacle.position.x;
                    const relZ = player.position.z - obstacle.position.z;
                    
                    // Calculate approximate height at player's position
                    // based on ramp angle - simplified calculation assuming small angles
                    let heightOffset = 0;
                    
                    // X rotation affects Z position (forward/backward ramp)
                    if (Math.abs(obstacle.rotation.x) > 0.01) {
                        heightOffset += Math.sin(obstacle.rotation.x) * relZ;
                    }
                    
                    // Z rotation affects X position (side-to-side ramp)
                    if (Math.abs(obstacle.rotation.z) > 0.01) {
                        heightOffset -= Math.sin(obstacle.rotation.z) * relX;
                    }
                    
                    // Calculate adjusted obstacle top Y at player's position
                    const adjustedObstacleY = obstacleTopY + heightOffset;
                    
                    // Check if player is on the inclined surface
                    if (Math.abs(feetPosition - adjustedObstacleY) <= rampCheckDistance) {
                        if (adjustedObstacleY > highestObstacleY) {
                            highestObstacleY = adjustedObstacleY;
                        }
                        standingOnSomething = true;
                    }
                }
                // Regular flat obstacle
                else if (Math.abs(feetPosition - obstacleTopY) <= checkDistance) {
                    if (obstacleTopY > highestObstacleY) {
                        highestObstacleY = obstacleTopY;
                    }
                    standingOnSomething = true;
                }
            }
        }
        
        // If standing on something (but not a trampoline), adjust player's height to match the surface
        if (standingOnSomething && highestObstacleY > -Infinity && !trampolineFound) {
            // If player's feet are below the obstacle top, move them up
            if (feetPosition < highestObstacleY) {
                player.position.y = highestObstacleY + player.size.height/2 - 0.1;
                
                // If moving up a slope, maintain horizontal momentum but zero vertical velocity
                if (player.velocity.y < 0) {
                    player.velocity.y = 0;
                }
            }
        }
        
        // Return true if standing on any non-trampoline obstacle
        return standingOnSomething;
    }

    // Updated method to handle player-player collisions with hard edges and accurate hitboxes
    handlePlayerPlayerCollisions() {
        const playerIds = Object.keys(this.players);
        
        // Compare each player with every other player
        for (let i = 0; i < playerIds.length; i++) {
            const player1 = this.players[playerIds[i]];
            if (!player1.isAlive) continue;
            
            for (let j = i + 1; j < playerIds.length; j++) {
                const player2 = this.players[playerIds[j]];
                if (!player2.isAlive) continue;
                
                // Calculate distance between player centers
                const dx = player2.position.x - player1.position.x;
                const dy = player2.position.y - player1.position.y;
                const dz = player2.position.z - player1.position.z;
                
                // ANTI-STACKING: If both are bots, first check if one is above the other
                const bothBots = player1.isBot && player2.isBot;
                
                if (bothBots) {
                    // Check if horizontally close (potential for stacking)
                    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
                    
                    if (horizontalDist < 2.0) {
                        // Close horizontally, check if one is above the other
                        if (Math.abs(dy) > 0.5) {
                            // Vertical stacking detected - teleport the upper bot away
                            const upperBot = player1.position.y > player2.position.y ? player1 : player2;
                            const lowerBot = upperBot === player1 ? player2 : player1;
                            
                            // Never allow a bot to be "grounded" on another bot
                            upperBot.onGround = false;
                            
                            // Choose a random direction to teleport
                            const angle = Math.random() * Math.PI * 2;
                            const pushDist = 10 + Math.random() * 5; // 10-15 units away
                            
                            // Teleport the bot horizontally
                            upperBot.position.x = lowerBot.position.x + Math.cos(angle) * pushDist;
                            upperBot.position.z = lowerBot.position.z + Math.sin(angle) * pushDist;
                            
                            // Force it to ground level
                            upperBot.position.y = 1.0;
                            
                            // Apply velocity in same direction for momentum
                            upperBot.velocity.x = Math.cos(angle) * 10;
                            upperBot.velocity.z = Math.sin(angle) * 10;
                            upperBot.velocity.y = 3; // Small upward bounce
                            
                            // Keep within map bounds
                            upperBot.position.x = Math.max(-this.mapSize.width/2 + 5, Math.min(this.mapSize.width/2 - 5, upperBot.position.x));
                            upperBot.position.z = Math.max(-this.mapSize.height/2 + 5, Math.min(this.mapSize.height/2 - 5, upperBot.position.z));
                            
                            // Skip normal collision handling since we've manually resolved it
                            continue;
                        }
                    }
                }
                
                // Use exact player dimensions for collision detection with a small buffer
                // to match visual model more accurately
                const hitboxExpansion = 0.3; // Increased from 0.1 to 0.3 (30% additional space for reliable collision)

                // Calculate player bounding boxes with accurate dimensions
                const player1Width = player1.size.width + hitboxExpansion;
                const player1Height = player1.size.height + hitboxExpansion;
                const player1Depth = player1.size.depth + hitboxExpansion;
                
                const player2Width = player2.size.width + hitboxExpansion;
                const player2Height = player2.size.height + hitboxExpansion;
                const player2Depth = player2.size.depth + hitboxExpansion;
                
                // Calculate half-dimensions for AABB collision check
                const player1HalfWidth = player1Width / 2;
                const player1HalfHeight = player1Height / 2;
                const player1HalfDepth = player1Depth / 2;
                
                const player2HalfWidth = player2Width / 2;
                const player2HalfHeight = player2Height / 2;
                const player2HalfDepth = player2Depth / 2;
                
                // Check if player bounding boxes overlap (AABB collision)
                const overlapX = Math.abs(dx) < (player1HalfWidth + player2HalfWidth);
                const overlapY = Math.abs(dy) < (player1HalfHeight + player2HalfHeight);
                const overlapZ = Math.abs(dz) < (player1HalfDepth + player2HalfDepth);
                
                if (overlapX && overlapY && overlapZ) {
                    // Check if both players are bots to handle bot-bot collisions more aggressively
                    const bothBots = player1.isBot && player2.isBot;
                    
                    // Calculate overlap amounts in each axis
                    const overlapAmountX = (player1HalfWidth + player2HalfWidth) - Math.abs(dx);
                    const overlapAmountY = (player1HalfHeight + player2HalfHeight) - Math.abs(dy);
                    const overlapAmountZ = (player1HalfDepth + player2HalfDepth) - Math.abs(dz);
                    
                    // Determine axis with smallest overlap for minimal collision resolution
                    let resolveX = false;
                    let resolveY = false;
                    let resolveZ = false;
                    
                    // For bot-bot collisions, strongly discourage Y-axis (vertical stacking) resolution
                    if (bothBots) {
                        // Always prioritize horizontal resolution for bots to completely prevent stacking
                        if (overlapAmountX <= overlapAmountZ) {
                            resolveX = true;
                        } else {
                            resolveZ = true;
                        }
                        
                        // NEVER resolve along Y axis for bot-bot collisions - completely disable vertical stacking
                        resolveY = false;
                    } else {
                        // Regular collision resolution for player-player or player-bot
                        if (overlapAmountX <= overlapAmountY && overlapAmountX <= overlapAmountZ) {
                            resolveX = true;
                        } else if (overlapAmountY <= overlapAmountX && overlapAmountY <= overlapAmountZ) {
                            resolveY = true;
                        } else {
                            resolveZ = true;
                        }
                    }
                    
                    // Add extra buffer to ensure no clipping
                    const pushBuffer = bothBots ? 1.8 : 1.2; // Much stronger push for bot-bot collisions (80% vs 20% extra)
                    
                    // Normalize direction for consistent resolution
                    const normalX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
                    const normalY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
                    const normalZ = dz === 0 ? 0 : (dz > 0 ? 1 : -1);
                    
                    // Calculate push amounts for each player (split equally)
                    const totalPushX = resolveX ? overlapAmountX * pushBuffer * 0.5 : 0;
                    const totalPushY = resolveY ? overlapAmountY * pushBuffer * 0.5 : 0;
                    const totalPushZ = resolveZ ? overlapAmountZ * pushBuffer * 0.5 : 0;
                    
                    // Apply push to both players in opposite directions
                    if (resolveX) {
                        player1.position.x -= normalX * totalPushX;
                        player2.position.x += normalX * totalPushX;
                        
                        // Apply velocity changes to create a slight bounce effect
                        if (Math.sign(player1.velocity.x) === Math.sign(normalX)) {
                            player1.velocity.x *= -0.3; // Reverse with damping
                        }
                        if (Math.sign(player2.velocity.x) === -Math.sign(normalX)) {
                            player2.velocity.x *= -0.3; // Reverse with damping
                        }
                        
                        // Add random horizontal nudge for bot-bot collisions to break symmetry
                        if (bothBots) {
                            const nudgeFactor = 1.0 + Math.random() * 1.0; // Random 1.0 to 2.0 factor - stronger
                            const nudgeDir = Math.random() > 0.5 ? 1 : -1;
                            player1.velocity.z += nudgeDir * nudgeFactor;
                            player2.velocity.z -= nudgeDir * nudgeFactor;
                        }
                    } else if (resolveY) {
                        // ANTI-STACKING: Special case for bot on top of another entity
                        if (bothBots) {
                            // If both bots, this shouldn't happen due to our checks above,
                            // but as a failsafe, apply a strong horizontal force instead
                            const angle = Math.random() * Math.PI * 2;
                            const pushStrength = 15;
                            
                            // Figure out which bot is on top
                            if (dy > 0) { // player2 is above player1
                                player2.velocity.x += Math.cos(angle) * pushStrength;
                                player2.velocity.z += Math.sin(angle) * pushStrength;
                                player2.velocity.y = 3; // Small upward boost
                                player2.onGround = false; // Don't let them be grounded on each other
                            } else { // player1 is above player2
                                player1.velocity.x += Math.cos(angle) * pushStrength;
                                player1.velocity.z += Math.sin(angle) * pushStrength;
                                player1.velocity.y = 3; // Small upward boost
                                player1.onGround = false; // Don't let them be grounded on each other
                            }
                        } else {
                            // Normal Y resolution for non-bot collisions
                            player1.position.y -= normalY * totalPushY;
                            player2.position.y += normalY * totalPushY;
                            
                            // For Y-axis collisions, handle special case of landing on another player
                            if (normalY > 0) {
                                // player1 is below player2
                                if (player1.velocity.y > 0 && player2.velocity.y < 0) {
                                    player1.velocity.y = 0;
                                }
                                
                                // For bot-player collisions, never set bot onGround when on top of player
                                if (player2.velocity.y < 0) {
                                    if (!player2.isBot) {
                                        player2.velocity.y = 0;
                                        player2.onGround = true; // Standing on player1
                                    } else {
                                        // Bot trying to stand on player - add lateral force
                                        player2.velocity.y = 2; // Small bounce up
                                        const lateralDir = Math.random() > 0.5 ? 1 : -1;
                                        player2.velocity.x += lateralDir * 5;
                                        player2.velocity.z += (lateralDir * -1) * 5;
                                    }
                                }
                            } else {
                                // player2 is below player1
                                if (player2.velocity.y > 0 && player1.velocity.y < 0) {
                                    player2.velocity.y = 0;
                                }
                                
                                // For bot-player collisions, never set bot onGround when on top of player
                                if (player1.velocity.y < 0) {
                                    if (!player1.isBot) {
                                        player1.velocity.y = 0;
                                        player1.onGround = true; // Standing on player2
                                    } else {
                                        // Bot trying to stand on player - add lateral force
                                        player1.velocity.y = 2; // Small bounce up
                                        const lateralDir = Math.random() > 0.5 ? 1 : -1;
                                        player1.velocity.x += lateralDir * 5;
                                        player1.velocity.z += (lateralDir * -1) * 5;
                                    }
                                }
                            }
                        }
                    } else if (resolveZ) {
                        player1.position.z -= normalZ * totalPushZ;
                        player2.position.z += normalZ * totalPushZ;
                        
                        // Apply velocity changes to create a slight bounce effect
                        if (Math.sign(player1.velocity.z) === Math.sign(normalZ)) {
                            player1.velocity.z *= -0.3; // Reverse with damping
                        }
                        if (Math.sign(player2.velocity.z) === -Math.sign(normalZ)) {
                            player2.velocity.z *= -0.3; // Reverse with damping
                        }
                        
                        // Add random horizontal nudge for bot-bot collisions to break symmetry
                        if (bothBots) {
                            const nudgeFactor = 1.0 + Math.random() * 1.0; // Random 1.0 to 2.0 factor - stronger
                            const nudgeDir = Math.random() > 0.5 ? 1 : -1;
                            player1.velocity.x += nudgeDir * nudgeFactor;
                            player2.velocity.x -= nudgeDir * nudgeFactor;
                        }
                    }
                    
                    // For bot-bot collisions, apply an additional repulsion force
                    if (bothBots) {
                        // Calculate repulsion direction (normalized)
                        const repulsionMagnitude = Math.sqrt(dx*dx + dz*dz);
                        if (repulsionMagnitude > 0) {
                            const repulsionX = dx / repulsionMagnitude;
                            const repulsionZ = dz / repulsionMagnitude;
                            
                            // Apply stronger repulsion force to push bots away from each other
                            const repulsionForce = 5.0; // Increased from 3.0 to 5.0
                            player1.velocity.x -= repulsionX * repulsionForce;
                            player1.velocity.z -= repulsionZ * repulsionForce;
                            player2.velocity.x += repulsionX * repulsionForce;
                            player2.velocity.z += repulsionZ * repulsionForce;
                            
                            // ANTI-STACKING: Apply small upward velocity to both bots to break potential stacking
                            player1.velocity.y = Math.max(player1.velocity.y, 0.5);
                            player2.velocity.y = Math.max(player2.velocity.y, 0.5);
                        }
                    }
                    
                    // Double check to ensure no remaining overlap after resolution
                    const newDx = player2.position.x - player1.position.x;
                    const newDy = player2.position.y - player1.position.y;
                    const newDz = player2.position.z - player1.position.z;
                    
                    const newOverlapX = Math.abs(newDx) < (player1HalfWidth + player2HalfWidth);
                    const newOverlapY = Math.abs(newDy) < (player1HalfHeight + player2HalfHeight);
                    const newOverlapZ = Math.abs(newDz) < (player1HalfDepth + player2HalfDepth);
                    
                    // If still overlapping after main resolution, apply additional safety push
                    if (newOverlapX && newOverlapY && newOverlapZ) {
                        // Calculate new overlap amounts
                        const newOverlapAmountX = (player1HalfWidth + player2HalfWidth) - Math.abs(newDx);
                        const newOverlapAmountY = (player1HalfHeight + player2HalfHeight) - Math.abs(newDy);
                        const newOverlapAmountZ = (player1HalfDepth + player2HalfDepth) - Math.abs(newDz);
                        
                        // For bot-bot collisions, prioritize horizontal resolution and apply stronger push
                        if (bothBots) {
                            // For bot-bot, NEVER resolve vertically - always push them apart horizontally
                            if (newOverlapAmountX <= newOverlapAmountZ) {
                                const safetyPush = newOverlapAmountX + 0.5; // Add a much larger buffer for bots
                                const newNormalX = newDx === 0 ? 0 : (newDx > 0 ? 1 : -1);
                                player1.position.x -= newNormalX * safetyPush * 0.5;
                                player2.position.x += newNormalX * safetyPush * 0.5;
                                
                                // Extra push velocity
                                player1.velocity.x -= newNormalX * 5;
                                player2.velocity.x += newNormalX * 5;
                            } else {
                                const safetyPush = newOverlapAmountZ + 0.5;
                                const newNormalZ = newDz === 0 ? 0 : (newDz > 0 ? 1 : -1);
                                player1.position.z -= newNormalZ * safetyPush * 0.5;
                                player2.position.z += newNormalZ * safetyPush * 0.5;
                                
                                // Extra push velocity
                                player1.velocity.z -= newNormalZ * 5;
                                player2.velocity.z += newNormalZ * 5;
                            }
                            
                            // Final anti-stacking check: if bots are still too close horizontally but vertically aligned,
                            // apply a strong velocity to separate them
                            const horizontalDist = Math.sqrt(newDx*newDx + newDz*newDz);
                            if (horizontalDist < 1.5 && Math.abs(newDy) > 0.5) {
                                // They're vertically stacked but very close horizontally
                                // Apply an extreme horizontal separation force to break them apart
                                const separationAngle = Math.random() * Math.PI * 2;
                                const separationForce = 20;
                                
                                player1.velocity.x += Math.cos(separationAngle) * separationForce;
                                player1.velocity.z += Math.sin(separationAngle) * separationForce;
                                player2.velocity.x -= Math.cos(separationAngle) * separationForce;
                                player2.velocity.z -= Math.sin(separationAngle) * separationForce;
                            }
                        } else {
                            // Regular safety push for player-player or player-bot
                            if (newOverlapAmountX <= newOverlapAmountY && newOverlapAmountX <= newOverlapAmountZ) {
                                const safetyPush = newOverlapAmountX + 0.05; // Add a small buffer
                                const newNormalX = newDx === 0 ? 0 : (newDx > 0 ? 1 : -1);
                                player1.position.x -= newNormalX * safetyPush * 0.5;
                                player2.position.x += newNormalX * safetyPush * 0.5;
                            } else if (newOverlapAmountY <= newOverlapAmountX && newOverlapAmountY <= newOverlapAmountZ) {
                                const safetyPush = newOverlapAmountY + 0.05;
                                const newNormalY = newDy === 0 ? 0 : (newDy > 0 ? 1 : -1);
                                player1.position.y -= newNormalY * safetyPush * 0.5;
                                player2.position.y += newNormalY * safetyPush * 0.5;
                            } else {
                                const safetyPush = newOverlapAmountZ + 0.05;
                                const newNormalZ = newDz === 0 ? 0 : (newDz > 0 ? 1 : -1);
                                player1.position.z -= newNormalZ * safetyPush * 0.5;
                                player2.position.z += newNormalZ * safetyPush * 0.5;
                            }
                        }
                    }
                }
            }
        }
    }

    // Updated method to check and process melee hits between players with accurate hitboxes
    handleMeleeHits() {
        const playerIds = Object.keys(this.players);
        
        // Check each player with active melee
        for (let i = 0; i < playerIds.length; i++) {
            const attacker = this.players[playerIds[i]];
            if (!attacker.isAlive || !attacker.meleeActive) continue;
            
            // Skip if this player already performed a dash for this melee
            if (attacker.dashPerformed) continue;
            
            // Use camera-based direction if available (from input controller)
            let attackDirX, attackDirY, attackDirZ;
            
            if (attacker.lastMeleeDirection) {
                // Use the stored direction from input controller
                attackDirX = attacker.lastMeleeDirection.x;
                attackDirY = attacker.lastMeleeDirection.y;
                attackDirZ = attacker.lastMeleeDirection.z;
            } else {
                // Fallback to rotation-based direction
                const attackAngle = attacker.rotation.y;
                attackDirX = Math.sin(attackAngle);
                attackDirY = 0; // No vertical component in fallback
                attackDirZ = -Math.cos(attackAngle); // Negate Z to fix backward dash
            }
            
            // Apply dash movement (reduced speed)
            const dashSpeed = 25;
            attacker.velocity.x = attackDirX * dashSpeed;
            attacker.velocity.y = 0.2; // Slight upward component
            attacker.velocity.z = attackDirZ * dashSpeed;
            
            // Add ground check and stop dash after a short duration
            attacker.dashPerformed = true;
            setTimeout(() => {
                if (attacker) {
                    // Apply braking force
                    attacker.velocity.x *= 0.2;
                    attacker.velocity.z *= 0.2;
                }
            }, 150);
            
            // Reset dash flag after cooldown
            setTimeout(() => {
                if (attacker) {
                    attacker.dashPerformed = false;
                }
            }, 300);
            
            // Find potential targets in front of the player
            // Use exact hitbox dimensions for accurate melee hit detection
            const meleeRange = 2.0; // Keep the standard melee range
            let closestTarget = null;
            let closestDistance = Infinity;
            
            // Define the melee attack hitbox in front of the attacker
            // This creates a more accurate forward-focused melee hitbox
            const meleeHitboxWidth = 1.5;  // Width of melee hitbox
            const meleeHitboxHeight = 1.5; // Height of melee hitbox
            const meleeHitboxDepth = meleeRange; // Depth is the melee range
            
            // Calculate melee hitbox center point (in front of the attacker)
            const meleeHitboxCenterX = attacker.position.x + (attackDirX * (meleeRange/2));
            const meleeHitboxCenterY = attacker.position.y + (attackDirY * (meleeRange/2));
            const meleeHitboxCenterZ = attacker.position.z + (attackDirZ * (meleeRange/2));
            
            // Check each potential target
            for (let j = 0; j < playerIds.length; j++) {
                if (i === j) continue; // Skip self
                
                const target = this.players[playerIds[j]];
                if (!target.isAlive) continue;
                
                // Calculate vector from attacker to target
                const dx = target.position.x - attacker.position.x;
                const dy = target.position.y - attacker.position.y;
                const dz = target.position.z - attacker.position.z;
                
                // Check if target is roughly in front of attacker using dot product
                const dot = dx * attackDirX + dz * attackDirZ;
                if (dot <= 0) continue; // Target is behind attacker
                
                // Exact AABB collision check between melee hitbox and target hitbox
                // Define the melee attack box coordinates
                const meleeMinX = meleeHitboxCenterX - (meleeHitboxWidth/2);
                const meleeMaxX = meleeHitboxCenterX + (meleeHitboxWidth/2);
                const meleeMinY = meleeHitboxCenterY - (meleeHitboxHeight/2);
                const meleeMaxY = meleeHitboxCenterY + (meleeHitboxHeight/2);
                const meleeMinZ = meleeHitboxCenterZ - (meleeHitboxDepth/2);
                const meleeMaxZ = meleeHitboxCenterZ + (meleeHitboxDepth/2);
                
                // Define the target player box coordinates
                const targetMinX = target.position.x - (target.size.width/2);
                const targetMaxX = target.position.x + (target.size.width/2);
                const targetMinY = target.position.y - (target.size.height/2);
                const targetMaxY = target.position.y + (target.size.height/2);
                const targetMinZ = target.position.z - (target.size.depth/2);
                const targetMaxZ = target.position.z + (target.size.depth/2);
                
                // Check for AABB intersection
                const collision = (
                    meleeMaxX > targetMinX && meleeMinX < targetMaxX &&
                    meleeMaxY > targetMinY && meleeMinY < targetMaxY &&
                    meleeMaxZ > targetMinZ && meleeMinZ < targetMaxZ
                );
                
                if (collision) {
                    // Calculate horizontal distance for finding closest target
                    const horizontalDistSq = dx*dx + dz*dz;
                    
                    // This is a valid target - check if it's the closest
                    if (horizontalDistSq < closestDistance) {
                        closestDistance = horizontalDistSq;
                        closestTarget = target;
                    }
                }
            }
            
            // If we found a target, apply damage and effects
            if (closestTarget) {
                // Target is in range and in the forward arc - apply hit
                closestTarget.health--;
                closestTarget.lastHitTime = Date.now();
                closestTarget.lastHitBy = attacker.id;
                closestTarget.staggerTime = Date.now(); // Set stagger start time
                closestTarget.isStaggered = true;
                
                // Set staggered for a limited time (500ms)
                setTimeout(() => {
                    if (closestTarget) {
                        closestTarget.isStaggered = false;
                    }
                }, 500);
                
                // Calculate direction to target for better aim-assist
                const toTargetX = closestTarget.position.x - attacker.position.x;
                const toTargetZ = closestTarget.position.z - attacker.position.z;
                const toTargetDist = Math.sqrt(toTargetX * toTargetX + toTargetZ * toTargetZ);
                
                if (toTargetDist > 0) {
                    // Modify dash direction to "home in" on the target slightly
                    const homingStrength = 0.4; // How much to adjust velocity (0-1)
                    const normalizedToTargetX = toTargetX / toTargetDist;
                    const normalizedToTargetZ = toTargetZ / toTargetDist;
                    
                    // Blend between original direction and direction to target
                    attacker.velocity.x = (attackDirX * (1 - homingStrength) + normalizedToTargetX * homingStrength) * dashSpeed;
                    attacker.velocity.z = (attackDirZ * (1 - homingStrength) + normalizedToTargetZ * homingStrength) * dashSpeed;
                }
                
                // Apply knockback to hit target
                const knockbackPower = 8;
                closestTarget.velocity.x = toTargetX / toTargetDist * knockbackPower;
                closestTarget.velocity.y = 5; // Upward component
                closestTarget.velocity.z = toTargetZ / toTargetDist * knockbackPower;
                
                // If target dies, handle that
                if (closestTarget.health <= 0) {
                    this.handlePlayerDeath(closestTarget.id, attacker.id);
                    
                    // Award hammer to attacker only if under the 3 hammer limit
                    if (attacker.hammers < 3) {
                        attacker.hammers++;
                    }
                }
            }
            
            // We only process one dash per frame for each player
        }
    }

    dropHammersFromSky() {
        // Only drop hammers if there are active players
        const activePlayers = Object.values(this.players).filter(player => player.isAlive);
        if (activePlayers.length === 0) return;
        
        for (let i = 0; i < this.hammerDropCount; i++) {
            // Get a random position within the map bounds, but high up in the sky
            const spawnPoint = this.getRandomSpawnPoint();
            
            // Create the hammer
            const hammerDirection = {
                x: Math.random() * 0.4 - 0.2, // Small random horizontal direction
                y: -1, // Downward
                z: Math.random() * 0.4 - 0.2  // Small random horizontal direction
            };
            
            const dropHammer = {
                id: `sky_hammer_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                position: { 
                    x: spawnPoint.x, 
                    y: 30, // Start high in the sky
                    z: spawnPoint.z 
                },
                velocity: {
                    x: hammerDirection.x * 2,
                    y: hammerDirection.y * 5, // Faster downward velocity
                    z: hammerDirection.z * 2
                },
                rotation: { x: 0, y: 0, z: 0 },
                rotationSpeed: { 
                    x: Math.random() * 10, 
                    y: Math.random() * 10, 
                    z: Math.random() * 10 
                },
                ownerId: null,
                throwTime: Date.now(),
                bounces: 0,
                maxBounces: 5,
                active: true,
                fromSky: true // Mark as a sky hammer for potential special effects
            };
            
            this.hammers.push(dropHammer);
        }
        
        // Broadcast a message to all players
        return {
            message: "Hammers are falling from the sky!",
            count: this.hammerDropCount
        };
    }

    // Handle player death
    handlePlayerDeath(playerId, killerId) {
        const player = this.players[playerId];
        if (!player || !player.isAlive) return; // Already dead
        
        // Mark player as dead
        player.isAlive = false;
        player.deathTime = Date.now();
        
        // Drop any hammers the player was holding
        for (let i = 0; i < player.hammers; i++) {
            const dropDirection = {
                x: Math.random() * 2 - 1,
                y: Math.random() * 0.5 + 0.5,
                z: Math.random() * 2 - 1
            };
            
            const dropHammer = {
                id: `hammer_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                position: { ...player.position },
                velocity: {
                    x: dropDirection.x * 5,
                    y: dropDirection.y * 5,
                    z: dropDirection.z * 5
                },
                rotation: { x: 0, y: 0, z: 0 },
                rotationSpeed: { 
                    x: Math.random() * 10, 
                    y: Math.random() * 10, 
                    z: Math.random() * 10 
                },
                ownerId: null,
                throwTime: Date.now(),
                bounces: 0,
                maxBounces: 5,
                active: true
            };
            
            this.hammers.push(dropHammer);
        }
        
        // Clear player's hammers
        player.hammers = 0;
    }

    handleHammerHammerCollisions() {
        const hammersLength = this.hammers.length;
        
        // Check each pair of active hammers for collision
        for (let i = 0; i < hammersLength; i++) {
            const hammer1 = this.hammers[i];
            
            // Skip inactive hammers
            if (!hammer1.active) continue;
            
            for (let j = i + 1; j < hammersLength; j++) {
                const hammer2 = this.hammers[j];
                
                // Skip inactive hammers
                if (!hammer2.active) continue;
                
                // Skip if both hammers are from the same owner and were thrown at nearly the same time
                if (hammer1.ownerId === hammer2.ownerId && 
                    Math.abs(hammer1.throwTime - hammer2.throwTime) < 100) {
                    continue;
                }
                
                // Calculate distance between hammer centers
                const dx = hammer1.position.x - hammer2.position.x;
                const dy = hammer1.position.y - hammer2.position.y;
                const dz = hammer1.position.z - hammer2.position.z;
                const distanceSquared = dx * dx + dy * dy + dz * dz;
                
                // Use physics hammer radius for collision detection
                const hammerRadius = 0.75;
                const minDistance = hammerRadius * 2; // Sum of both hammer radii
                const minDistanceSquared = minDistance * minDistance;
                
                // Check for collision
                if (distanceSquared < minDistanceSquared) {
                    // Calculate actual distance
                    const distance = Math.sqrt(distanceSquared);
                    
                    // Normalize direction vector
                    const nx = dx / distance;
                    const ny = dy / distance;
                    const nz = dz / distance;
                    
                    // Move hammers apart to prevent clipping
                    const overlap = minDistance - distance;
                    const pushFactor = overlap / 2; // Half the overlap for each hammer
                    
                    hammer1.position.x += nx * pushFactor;
                    hammer1.position.y += ny * pushFactor;
                    hammer1.position.z += nz * pushFactor;
                    
                    hammer2.position.x -= nx * pushFactor;
                    hammer2.position.y -= ny * pushFactor;
                    hammer2.position.z -= nz * pushFactor;
                    
                    // Calculate velocity along the normal
                    const v1n = hammer1.velocity.x * nx + hammer1.velocity.y * ny + hammer1.velocity.z * nz;
                    const v2n = hammer2.velocity.x * nx + hammer2.velocity.y * ny + hammer2.velocity.z * nz;
                    
                    // Skip if hammers are moving away from each other
                    if (v1n - v2n <= 0) continue;
                    
                    // Calculate restitution (bounciness) - high value for pronounced ricochet
                    const restitution = 1.0; // Perfect elasticity for dramatic rebounds
                    
                    // Calculate impulse scalar
                    const m1 = 1; // Mass of hammer1
                    const m2 = 1; // Mass of hammer2
                    const impulse = (-(1 + restitution) * (v1n - v2n)) / (1/m1 + 1/m2);
                    
                    // Apply impulse
                    hammer1.velocity.x -= (impulse / m1) * nx;
                    hammer1.velocity.y -= (impulse / m1) * ny;
                    hammer1.velocity.z -= (impulse / m1) * nz;
                    
                    hammer2.velocity.x += (impulse / m2) * nx;
                    hammer2.velocity.y += (impulse / m2) * ny;
                    hammer2.velocity.z += (impulse / m2) * nz;
                    
                    // Add slightly random spin to make the ricochet look more dynamic
                    const spinFactor = 40; // Higher for more dramatic spin
                    
                    hammer1.rotationSpeed = {
                        x: (Math.random() * 2 - 1) * spinFactor,
                        y: (Math.random() * 2 - 1) * spinFactor,
                        z: (Math.random() * 2 - 1) * spinFactor
                    };
                    
                    hammer2.rotationSpeed = {
                        x: (Math.random() * 2 - 1) * spinFactor,
                        y: (Math.random() * 2 - 1) * spinFactor,
                        z: (Math.random() * 2 - 1) * spinFactor
                    };
                    
                    // Increment bounce count
                    hammer1.bounces++;
                    hammer2.bounces++;
                    
                    // Add a small boost to velocity for more dramatic rebounds
                    const velocityBoost = 1.1; // 10% boost
                    hammer1.velocity.x *= velocityBoost;
                    hammer1.velocity.y *= velocityBoost;
                    hammer1.velocity.z *= velocityBoost;
                    
                    hammer2.velocity.x *= velocityBoost;
                    hammer2.velocity.y *= velocityBoost;
                    hammer2.velocity.z *= velocityBoost;
                }
            }
        }
    }

    preventBotStacking() {
        // Get all bots
        const bots = [];
        const playerIds = Object.keys(this.players);
        
        // Collect all bot players
        for (const id of playerIds) {
            const player = this.players[id];
            if (player.isBot && player.isAlive) {
                bots.push(player);
            }
        }
        
        // No need to process if we have 0 or 1 bot
        if (bots.length <= 1) return;
        
        // Horizontal distance threshold for separation - slightly increased to allow closer proximity
        const horizontalStackThreshold = 5.0; // Reduced from 6.0 to 5.0 for less separation forcing
        
        // Flag to track if any major separation was applied
        let majorSeparationApplied = false;
        
        // Check each bot against every other bot
        for (let i = 0; i < bots.length; i++) {
            const botA = bots[i];
            
            for (let j = i + 1; j < bots.length; j++) {
                const botB = bots[j];
                
                // Calculate horizontal distance between bots
                const dx = botB.position.x - botA.position.x;
                const dz = botB.position.z - botA.position.z;
                const horizDist = Math.sqrt(dx * dx + dz * dz);
                
                // Only apply separation if both bots aren't attacking the same player
                // This allows "pack" behavior for multiple bots attacking the same target
                const botAAttacking = botA.currentState === 'attack';
                const botBAttacking = botB.currentState === 'attack';
                
                // If bots are too close horizontally and not both attacking
                if (horizDist < horizontalStackThreshold && !(botAAttacking && botBAttacking)) {
                    // Calculate vertical distance
                    const dy = botB.position.y - botA.position.y;
                    const vertDist = Math.abs(dy);
                    
                    // For vertical stacking (one bot on top of another or nearly so)
                    if (vertDist > 0.5) { // Increased from 0.3 to 0.5 to reduce unnecessary unstacking
                        // Determine which bot is higher
                        const lowerBot = botA.position.y < botB.position.y ? botA : botB;
                        const upperBot = lowerBot === botA ? botB : botA;
                        
                        // Emergency teleport - move the upper bot away but less aggressively
                        const angle = Math.random() * Math.PI * 2;
                        
                        // Much smaller teleport distance for less jarring movements
                        const forceDist = 15 + Math.random() * 10; // Reduced from 30-45 to 15-25
                        
                        // Calculate new position with less dramatic change
                        upperBot.position.x = upperBot.position.x + Math.cos(angle) * forceDist;
                        upperBot.position.z = upperBot.position.z + Math.sin(angle) * forceDist;
                        
                        // Ensure the new position is within map bounds
                        upperBot.position.x = Math.max(-this.mapSize.width/2 + 5, Math.min(this.mapSize.width/2 - 5, upperBot.position.x));
                        upperBot.position.z = Math.max(-this.mapSize.height/2 + 5, Math.min(this.mapSize.height/2 - 5, upperBot.position.z));
                        
                        // Reset position to ground level
                        upperBot.position.y = 1.0;
                        
                        // Clear velocity but with less drastic change
                        upperBot.velocity.x *= 0.2; // Dampen rather than zero out
                        upperBot.velocity.z *= 0.2; // Dampen rather than zero out
                        upperBot.velocity.y = 0;
                        upperBot.prevVelocity = { x: upperBot.velocity.x, z: upperBot.velocity.z };
                        
                        // Flag that we separated bots
                        majorSeparationApplied = true;
                        
                        // Reset patrol target to avoid immediately heading back
                        if (upperBot.personalZone) {
                            // Move personal zone to match new position
                            upperBot.personalZone.x = upperBot.position.x;
                            upperBot.personalZone.z = upperBot.position.z;
                            
                            // Clear patrol route to generate a new one
                            upperBot.patrolRoute = null;
                        }
                    }
                    // For horizontal proximity (bots too close but not stacked)
                    else {
                        // Calculate normalized direction vector between bots
                        const dist = Math.max(0.1, horizDist);
                        const dirX = dx / dist;
                        const dirZ = dz / dist;
                        
                        // Gentler separation forces for less twitchy movement
                        const repulsionFactor = (botAAttacking || botBAttacking) ? 
                            1.5 * (horizontalStackThreshold - dist) / horizontalStackThreshold : // Reduced from 3.0 to 1.5
                            3.0 * (horizontalStackThreshold - dist) / horizontalStackThreshold;  // Reduced from 5.0 to 3.0
                        
                        // Apply gentler separation with less randomization
                        // Move botB away from botA
                        botB.position.x += (dirX + (Math.random() * 0.2 - 0.1)) * repulsionFactor; // Reduced random component
                        botB.position.z += (dirZ + (Math.random() * 0.2 - 0.1)) * repulsionFactor; // Reduced random component
                        
                        // Move botA away from botB
                        botA.position.x -= (dirX + (Math.random() * 0.2 - 0.1)) * repulsionFactor; // Reduced random component
                        botA.position.z -= (dirZ + (Math.random() * 0.2 - 0.1)) * repulsionFactor; // Reduced random component
                        
                        // Ensure both bots stay within map bounds
                        botB.position.x = Math.max(-this.mapSize.width/2 + 5, Math.min(this.mapSize.width/2 - 5, botB.position.x));
                        botB.position.z = Math.max(-this.mapSize.height/2 + 5, Math.min(this.mapSize.height/2 - 5, botB.position.z));
                        
                        botA.position.x = Math.max(-this.mapSize.width/2 + 5, Math.min(this.mapSize.width/2 - 5, botA.position.x));
                        botA.position.z = Math.max(-this.mapSize.height/2 + 5, Math.min(this.mapSize.height/2 - 5, botA.position.z));
                        
                        // Gentler velocity adjustments
                        const velocityMultiplier = (botAAttacking || botBAttacking) ? 6 : 8; // Reduced from 10/14 to 6/8
                        
                        // Apply velocities with some blending to avoid sudden changes
                        botB.velocity.x = botB.velocity.x * 0.4 + dirX * velocityMultiplier * 0.6; // Blend old and new
                        botB.velocity.z = botB.velocity.z * 0.4 + dirZ * velocityMultiplier * 0.6; // Blend old and new
                        
                        botA.velocity.x = botA.velocity.x * 0.4 - dirX * velocityMultiplier * 0.6; // Blend old and new
                        botA.velocity.z = botA.velocity.z * 0.4 - dirZ * velocityMultiplier * 0.6; // Blend old and new
                        
                        // Update previous velocities to match (avoids smoothing issues)
                        botB.prevVelocity = { x: botB.velocity.x * 0.8, z: botB.velocity.z * 0.8 }; // Dampened for smoothness
                        botA.prevVelocity = { x: botA.velocity.x * 0.8, z: botA.velocity.z * 0.8 }; // Dampened for smoothness
                    }
                }
            }
        }
        
        // If we've applied major separation, ensure all bots have different zones
        if (majorSeparationApplied) {
            this.redistributeBotZones();
        }
    }
    
    // Helper method to redistribute bot zones
    redistributeBotZones() {
        const bots = [];
        
        // Collect all bots
        for (const id in this.players) {
            const player = this.players[id];
            if (player.isBot && player.isAlive) {
                bots.push(player);
            }
        }
        
        // Subdivide the map into quadrants and give each bot a zone
        const quadrantWidth = this.mapSize.width / 2 - 10;
        const quadrantHeight = this.mapSize.height / 2 - 10;
        
        // Ensure we have at most 4 bots per quadrant to avoid overcrowding
        const quadrants = [
            { x: -quadrantWidth/2, z: -quadrantHeight/2, bots: [] }, // Bottom left
            { x:  quadrantWidth/2, z: -quadrantHeight/2, bots: [] }, // Bottom right
            { x: -quadrantWidth/2, z:  quadrantHeight/2, bots: [] }, // Top left
            { x:  quadrantWidth/2, z:  quadrantHeight/2, bots: [] }  // Top right
        ];
        
        // Distribute bots evenly across quadrants
        for (let i = 0; i < bots.length; i++) {
            const quadrantIndex = i % quadrants.length;
            const quadrant = quadrants[quadrantIndex];
            
            // Calculate personal zone within quadrant (with randomness)
            const zoneX = quadrant.x + (Math.random() * 0.6 + 0.2) * quadrantWidth;
            const zoneZ = quadrant.z + (Math.random() * 0.6 + 0.2) * quadrantHeight;
            
            // Update bot's personal zone
            bots[i].personalZone = { x: zoneX, z: zoneZ };
            
            // Clear patrol route to force recalculation
            bots[i].patrolRoute = null;
            
            // Add bot to quadrant for tracking
            quadrant.bots.push(bots[i]);
        }
    }

    // Create and spawn speed powerups on platforms
    spawnSpeedPowerup() {
        // Find all suitable platform obstacles
        const platforms = this.obstacles.filter(obs => 
            obs.type === 'obstacle' && 
            obs.isSolid && 
            obs.position.y > 5 && // Only on elevated platforms
            obs.size.width >= 6 && 
            obs.size.depth >= 6
        );
        
        if (platforms.length === 0) return;
        
        // Select a random platform
        const platform = platforms[Math.floor(Math.random() * platforms.length)];
        
        // Create a new powerup
        const powerupId = `powerup_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const powerup = {
            id: powerupId,
            type: 'speed',
            position: {
                x: platform.position.x + (Math.random() * 2 - 1) * (platform.size.width / 4), // Random position on platform
                y: platform.position.y + (platform.size.height / 2) + 1.5, // More height above platform for better visibility (was 1)
                z: platform.position.z + (Math.random() * 2 - 1) * (platform.size.depth / 4)
            },
            rotation: { x: 0, y: 0, z: 0 },
            size: { radius: 1.2 }, // Increased radius for easier collision (was 0.8)
            createdAt: Date.now(),
            active: true
        };
        
        // Add to powerups array
        this.powerups.push(powerup);
        
        // Log platform and powerup position for debugging
        console.log(`Spawning powerup on platform at y=${platform.position.y.toFixed(2)}, powerup at y=${powerup.position.y.toFixed(2)}`);
        
        // Return powerup for event handling
        return powerup;
    }

    // Handle powerup collision detection and powerup expiration
    handlePowerups(powerupsCollected) {
        const now = Date.now();
        
        // Check for powerup collisions with players
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];
            
            // Skip inactive powerups
            if (!powerup.active) continue;
            
            // Check collision with each player
            for (const playerId in this.players) {
                const player = this.players[playerId];
                
                // Skip dead players
                if (!player.isAlive) continue;
                
                // Calculate distance between powerup and player
                const dx = powerup.position.x - player.position.x;
                const dy = powerup.position.y - player.position.y;
                const dz = powerup.position.z - player.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // Use a larger collision radius for better pickup experience
                const playerRadius = player.radius || 0.5;
                const powerupRadius = powerup.size.radius || 0.8;
                const collisionThreshold = playerRadius + powerupRadius + 0.5; // Added extra padding for easier pickup
                
                // If player is close enough to powerup, apply effect
                if (distance < collisionThreshold) {
                    console.log(`Powerup collected by player ${playerId}! Distance: ${distance.toFixed(2)}, Threshold: ${collisionThreshold.toFixed(2)}`);
                    
                    // Apply speedup effect to player
                    player.hasSuperSpeed = true;
                    player.superSpeedUntil = now + this.powerupDuration;
                    
                    // Record this powerup collection for event handling
                    powerupsCollected.push({
                        playerId: playerId,
                        type: powerup.type,
                        id: powerup.id
                    });
                    
                    // Remove powerup
                    powerup.active = false;
                    this.powerups.splice(i, 1);
                    break;
                }
            }
        }
        
        // Check for expired player speed boosts
        for (const playerId in this.players) {
            const player = this.players[playerId];
            if (player.hasSuperSpeed && player.superSpeedUntil < now) {
                player.hasSuperSpeed = false;
            }
        }
    }
}

module.exports = GameEngine; 