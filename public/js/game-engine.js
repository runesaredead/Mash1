handleMeleeHits() {
    // Process melee attacks and hit detection
    for (const attackerId in this.players) {
        const attacker = this.players[attackerId];
        
        // Skip if not in melee attack state or already performed dash
        if (!attacker.meleeState.attacking || attacker.meleeState.dashPerformed) continue;
        
        // Mark that dash has been performed for this attack
        attacker.meleeState.dashPerformed = true;
        
        // Calculate forward direction
        const attackAngle = attacker.rotation.y;
        const attackDirX = Math.sin(attackAngle);
        const attackDirZ = -Math.cos(attackAngle); // Negative because -Z is forward in our coordinate system
        
        // Apply dash velocity - forward direction
        const dashSpeed = 10;
        attacker.velocity.x = attackDirX * dashSpeed;
        attacker.velocity.z = attackDirZ * dashSpeed;
        
        // Give slight upward velocity for dash effect
        attacker.velocity.y = 1;
        
        // Add a timeout to stop the dash and bring player back to ground
        setTimeout(() => {
            // Slow down the dash gradually
            if (this.players[attackerId]) {
                this.players[attackerId].velocity.x *= 0.3;
                this.players[attackerId].velocity.z *= 0.3;
                // Apply downward force to bring player back to ground
                this.players[attackerId].velocity.y = -2;
            }
        }, 200);
        
        // Find valid targets in front of attacker (within a narrower forward arc)
        let closestTarget = null;
        let closestDistance = Infinity;
        
        for (const targetId in this.players) {
            if (targetId === attackerId) continue; // Skip self
            
            const target = this.players[targetId];
            
            // Calculate horizontal distance
            const dx = target.position.x - attacker.position.x;
            const dz = target.position.z - attacker.position.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);
            
            // Skip if too far away
            const dashRange = 4; // Maximum dash attack range
            if (horizontalDist > dashRange) continue;
            
            // Check if target is within vertical range
            const dy = Math.abs(target.position.y - attacker.position.y);
            if (dy > 2) continue; // Not within vertical attack range
            
            // Calculate the angle between attacker's forward direction and direction to target
            const dirToTargetX = dx / horizontalDist;
            const dirToTargetZ = dz / horizontalDist;
            
            // Dot product to find the cosine of the angle
            const dotProduct = attackDirX * dirToTargetX + attackDirZ * dirToTargetZ;
            
            // Consider only targets within a forward arc (about 40 degrees to either side)
            const minDotProduct = Math.cos(Math.PI / 4.5); // ~40 degrees
            if (dotProduct < minDotProduct) continue; // Target not in front
            
            // This is a valid target, check if it's the closest
            if (horizontalDist < closestDistance) {
                closestTarget = target;
                closestDistance = horizontalDist;
            }
        }
        
        // Apply effects to the closest valid target
        if (closestTarget) {
            // Apply damage
            this.applyDamage(closestTarget.id, 25);
            
            // Apply stagger effect
            closestTarget.staggered = true;
            closestTarget.staggerTime = 500; // Staggered for 500ms
            
            // Apply knockback effect
            const knockbackStrength = 8;
            closestTarget.velocity.x = attackDirX * knockbackStrength;
            closestTarget.velocity.z = attackDirZ * knockbackStrength;
            closestTarget.velocity.y = 3; // Upward force
            
            // Adjust attacker's velocity to home in on the target slightly
            attacker.velocity.x = attackDirX * dashSpeed * 0.8 + (closestTarget.position.x - attacker.position.x) * 0.2;
            attacker.velocity.z = attackDirZ * dashSpeed * 0.8 + (closestTarget.position.z - attacker.position.z) * 0.2;
            
            // Drop hammer on death
            if (closestTarget.health <= 0) {
                this.dropHammer(closestTarget.position.x, closestTarget.position.y, closestTarget.position.z);
            }
        }
    }
} 