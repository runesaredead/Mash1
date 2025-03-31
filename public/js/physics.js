// Physics controller
class PhysicsController {
    constructor(game) {
        this.game = game;
        
        // Physics constants
        this.gravity = 9.8;
        this.friction = 0.9;
        this.airFriction = 0.99;
        this.playerRadius = 0.55;
        this.hammerRadius = 0.75;
        
        // Raycaster for ground checking
        this.raycaster = new THREE.Raycaster();
        this.downDirection = new THREE.Vector3(0, -1, 0);
    }
    
    // Check if entity is on ground
    isOnGround(position, height = 2) {
        this.raycaster.set(
            new THREE.Vector3(position.x, position.y, position.z),
            this.downDirection
        );
        
        // Check intersection with ground
        const intersects = this.raycaster.intersectObject(this.game.ground);
        
        // If intersection distance is less than height/2 + small buffer, entity is on ground
        return intersects.length > 0 && intersects[0].distance < (height / 2) + 0.1;
    }
    
    // Apply gravity to entity
    applyGravity(entity, deltaTime) {
        if (!entity.onGround) {
            entity.velocity.y -= this.gravity * deltaTime;
        }
    }
    
    // Apply friction to entity
    applyFriction(entity) {
        if (entity.onGround) {
            entity.velocity.x *= this.friction;
            entity.velocity.z *= this.friction;
        } else {
            entity.velocity.x *= this.airFriction;
            entity.velocity.z *= this.airFriction;
        }
    }
    
    // Update entity position based on velocity
    updatePosition(entity, deltaTime) {
        entity.position.x += entity.velocity.x * deltaTime;
        entity.position.y += entity.velocity.y * deltaTime;
        entity.position.z += entity.velocity.z * deltaTime;
        
        // Check ground collision
        if (entity.position.y < entity.height / 2) {
            entity.position.y = entity.height / 2;
            entity.velocity.y = 0;
            entity.onGround = true;
            
            if (entity.isJumping) {
                entity.isJumping = false;
            }
        }
    }
    
    // Check collision between two entities (sphere-sphere)
    checkCollision(entity1, entity2) {
        const dx = entity1.position.x - entity2.position.x;
        const dy = entity1.position.y - entity2.position.y;
        const dz = entity1.position.z - entity2.position.z;
        
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minDistance = entity1.radius + entity2.radius;
        
        return distance < minDistance;
    }
    
    // Resolve collision between two entities
    resolveCollision(entity1, entity2) {
        const dx = entity2.position.x - entity1.position.x;
        const dy = entity2.position.y - entity1.position.y;
        const dz = entity2.position.z - entity1.position.z;
        
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minDistance = entity1.radius + entity2.radius;
        
        if (distance < minDistance) {
            // Calculate overlap
            const overlap = minDistance - distance;
            
            // Normalize direction
            const nx = dx / distance;
            const ny = dy / distance;
            const nz = dz / distance;
            
            // Move entities apart based on their mass ratio
            const totalMass = entity1.mass + entity2.mass;
            const entity1Ratio = entity2.mass / totalMass;
            const entity2Ratio = entity1.mass / totalMass;
            
            entity1.position.x -= nx * overlap * entity1Ratio;
            entity1.position.y -= ny * overlap * entity1Ratio;
            entity1.position.z -= nz * overlap * entity1Ratio;
            
            entity2.position.x += nx * overlap * entity2Ratio;
            entity2.position.y += ny * overlap * entity2Ratio;
            entity2.position.z += nz * overlap * entity2Ratio;
            
            // Calculate relative velocity
            const rvx = entity2.velocity.x - entity1.velocity.x;
            const rvy = entity2.velocity.y - entity1.velocity.y;
            const rvz = entity2.velocity.z - entity1.velocity.z;
            
            // Calculate velocity along normal
            const velocityAlongNormal = rvx * nx + rvy * ny + rvz * nz;
            
            // Do not resolve if velocities are separating
            if (velocityAlongNormal > 0) return;
            
            // Calculate restitution (bounciness)
            const restitution = 0.3;
            
            // Calculate impulse scalar
            const impulseMagnitude = -(1 + restitution) * velocityAlongNormal / 
                                    (1 / entity1.mass + 1 / entity2.mass);
            
            // Apply impulse
            const impulseX = impulseMagnitude * nx;
            const impulseY = impulseMagnitude * ny;
            const impulseZ = impulseMagnitude * nz;
            
            entity1.velocity.x -= impulseX / entity1.mass;
            entity1.velocity.y -= impulseY / entity1.mass;
            entity1.velocity.z -= impulseZ / entity1.mass;
            
            entity2.velocity.x += impulseX / entity2.mass;
            entity2.velocity.y += impulseY / entity2.mass;
            entity2.velocity.z += impulseZ / entity2.mass;
        }
    }
    
    // Check collision between entity and obstacle (sphere-box)
    checkObstacleCollision(entity, obstacle) {
        // Get box dimensions
        const halfWidth = obstacle.size.width / 2;
        const halfHeight = obstacle.size.height / 2;
        const halfDepth = obstacle.size.depth / 2;
        
        // Get box min and max points
        const minX = obstacle.position.x - halfWidth;
        const maxX = obstacle.position.x + halfWidth;
        const minY = obstacle.position.y - halfHeight;
        const maxY = obstacle.position.y + halfHeight;
        const minZ = obstacle.position.z - halfDepth;
        const maxZ = obstacle.position.z + halfDepth;
        
        // Find closest point on box to sphere center
        const closestX = Math.max(minX, Math.min(entity.position.x, maxX));
        const closestY = Math.max(minY, Math.min(entity.position.y, maxY));
        const closestZ = Math.max(minZ, Math.min(entity.position.z, maxZ));
        
        // Calculate distance from closest point to sphere center
        const dx = entity.position.x - closestX;
        const dy = entity.position.y - closestY;
        const dz = entity.position.z - closestZ;
        
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // Check if distance is less than sphere radius
        return distance < entity.radius;
    }
    
    // Resolve collision between entity and obstacle
    resolveObstacleCollision(entity, obstacle) {
        // Get box dimensions
        const halfWidth = obstacle.size.width / 2;
        const halfHeight = obstacle.size.height / 2;
        const halfDepth = obstacle.size.depth / 2;
        
        // Get box min and max points
        const minX = obstacle.position.x - halfWidth;
        const maxX = obstacle.position.x + halfWidth;
        const minY = obstacle.position.y - halfHeight;
        const maxY = obstacle.position.y + halfHeight;
        const minZ = obstacle.position.z - halfDepth;
        const maxZ = obstacle.position.z + halfDepth;
        
        // Find closest point on box to sphere center
        const closestX = Math.max(minX, Math.min(entity.position.x, maxX));
        const closestY = Math.max(minY, Math.min(entity.position.y, maxY));
        const closestZ = Math.max(minZ, Math.min(entity.position.z, maxZ));
        
        // Calculate distance vector from closest point to sphere center
        const dx = entity.position.x - closestX;
        const dy = entity.position.y - closestY;
        const dz = entity.position.z - closestZ;
        
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance < entity.radius) {
            // Calculate normal vector
            const nx = dx / distance;
            const ny = dy / distance;
            const nz = dz / distance;
            
            // Calculate overlap
            const overlap = entity.radius - distance;
            
            // Move entity out of obstacle
            entity.position.x += nx * overlap;
            entity.position.y += ny * overlap;
            entity.position.z += nz * overlap;
            
            // Reflect velocity with damping
            const restitution = 0.3;
            const dampingFactor = 0.8;
            
            // Calculate velocity dot normal
            const velocityDotNormal = 
                entity.velocity.x * nx + 
                entity.velocity.y * ny + 
                entity.velocity.z * nz;
            
            // Apply reflection
            entity.velocity.x = dampingFactor * (entity.velocity.x - (1 + restitution) * velocityDotNormal * nx);
            entity.velocity.y = dampingFactor * (entity.velocity.y - (1 + restitution) * velocityDotNormal * ny);
            entity.velocity.z = dampingFactor * (entity.velocity.z - (1 + restitution) * velocityDotNormal * nz);
            
            // Set entity on ground if collision is primarily from above
            if (ny > 0.7) {
                entity.onGround = true;
                entity.isJumping = false;
            }
        }
    }
} 