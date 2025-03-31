// Networking controller
class NetworkController {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.isConnected = false;
        this.lastServerUpdate = 0;
        
        // Connect to server
        this.connect();
    }
    
    connect() {
        console.log('NetworkController connecting to server...');
        // Create socket connection
        try {
            // Get the current hostname to determine server URL
            const currentUrl = window.location.hostname;
            const isLocal = currentUrl === 'localhost' || currentUrl === '127.0.0.1';
            
            // Use localhost for local development, window.location.origin for production
            const serverUrl = isLocal ? 'http://localhost:3001' : window.location.origin;
            
            // Connect to the server
            console.log('Connecting to server at:', serverUrl);
            this.socket = io(serverUrl);
            console.log('Socket.io instance created:', !!this.socket);
            
            // Add connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    console.error('Connection timeout. Server may not be running.');
                    alert('Unable to connect to the game server. Please make sure the server is running.');
                    this.game.uiController.hideLoader();
                }
            }, 5000);
            
        } catch (error) {
            console.error('Error creating socket connection:', error);
            alert('Error connecting to server: ' + error.message);
            this.game.uiController.hideLoader();
        }
        
        // Setup socket event listeners
        this.setupSocketListeners();
    }
    
    setupSocketListeners() {
        // Connection events
        this.socket.on('connect', () => this.onConnect());
        this.socket.on('disconnect', () => this.onDisconnect());
        this.socket.on('error', (error) => this.onError(error));
        
        // Lobby events
        this.socket.on('lobbyCreated', (data) => this.onLobbyCreated(data));
        this.socket.on('joinedLobby', (data) => this.onJoinedLobby(data));
        this.socket.on('lobbyUpdated', (data) => this.onLobbyUpdated(data));
        this.socket.on('lobbyDisbanded', (data) => this.onLobbyDisbanded(data));
        this.socket.on('newHost', (data) => this.onNewHost(data));
        this.socket.on('playerLeft', (data) => this.onPlayerLeft(data));
        this.socket.on('availableLobbies', (data) => this.onAvailableLobbies(data));
        
        // Game events
        this.socket.on('gameStarted', (data) => this.onGameStarted(data));
        this.socket.on('gameState', (data) => this.onGameState(data));
        this.socket.on('gameOver', (data) => this.onGameOver(data));
        this.socket.on('gameEvent', (data) => this.onGameEvent(data));
        
        // Error events
        this.socket.on('error', (data) => this.onServerError(data));
    }
    
    onConnect() {
        console.log('Connected to server');
        this.isConnected = true;
        
        // Clear timeout if it exists
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }
    
    onDisconnect() {
        console.log('Disconnected from server');
        this.isConnected = false;
        
        // Show main menu if disconnected during game
        if (this.game.gameStarted) {
            this.game.gameStarted = false;
            this.game.uiController.showMainMenu();
            
            // Show disconnection message
            alert('Disconnected from server.');
        }
    }
    
    onError(error) {
        console.error('Socket error:', error);
    }
    
    onLobbyCreated(data) {
        console.log('Lobby created:', data);
        
        // Update UI to show lobby
        this.game.uiController.showLobby(data.lobby);
    }
    
    onJoinedLobby(data) {
        console.log('Joined lobby:', data);
        
        // Update UI to show lobby
        this.game.uiController.showLobby(data.lobby);
    }
    
    onLobbyUpdated(data) {
        console.log('Lobby updated:', data);
        
        // Update UI with new lobby data
        this.game.uiController.updateLobby(data.lobby);
    }
    
    onLobbyDisbanded(data) {
        console.log('Lobby disbanded:', data.reason);
        
        // Show main menu
        this.game.uiController.showMainMenu();
        
        // Show reason to user
        alert(`Lobby disbanded: ${data.reason}`);
    }
    
    onNewHost(data) {
        console.log('New host:', data.hostId);
        
        // Check if local player is the new host
        if (data.hostId === this.socket.id) {
            alert('You are now the host!');
        }
    }
    
    onPlayerLeft(data) {
        console.log('Player left:', data.playerId);
        
        // Remove player from game if game has started
        if (this.game.gameStarted && this.game.players[data.playerId]) {
            const playerMesh = this.game.playerMeshes[data.playerId];
            if (playerMesh) {
                this.game.scene.remove(playerMesh);
                delete this.game.playerMeshes[data.playerId];
            }
            
            delete this.game.players[data.playerId];
        }
    }
    
    onGameStarted(data) {
        console.log('Game started:', data);
        
        // Start game in client
        this.game.startGame(data);
        
        // Show game UI
        this.game.uiController.showGameUI();
    }
    
    onGameState(data) {
        // Update game state (optimize by only logging occasionally)
        const now = Date.now();
        if (now - this.lastServerUpdate > 1000) {
            console.log('Game state update');
            this.lastServerUpdate = now;
        }
        
        // Update game state
        this.game.updateGameState(data);
        
        // Check for melee actions from other players
        if (data.players) {
            for (const id in data.players) {
                // Skip local player, we handle our own melee and don't want to show third-person effects
                if (id === this.game.localPlayerId) continue;
                
                const player = data.players[id];
                const previousPlayer = this.game.players[id];
                
                // Check if player just activated melee
                if (player.meleeActive && (!previousPlayer || !previousPlayer.meleeActive)) {
                    // Show melee visual from other player
                    this.showRemoteMeleeEffect(id, player);
                }
            }
        }
    }
    
    // Display a melee effect for remote players - simplified
    showRemoteMeleeEffect(playerId, player) {
        // Trigger the third-person hammer swing animation if objects controller exists
        // This is now simplified to just toggle hammer visibility
        if (this.game.objectsController) {
            this.game.objectsController.animateMeleeSwing(playerId);
        }
    }
    
    onGameOver(data) {
        console.log('Game over:', data);
        
        // End game
        this.game.endGame(data);
    }
    
    onGameEvent(data) {
        console.log('Game event:', data);
        
        // Handle different event types
        switch (data.type) {
            case 'hammerDrop':
                // Display notification
                this.game.uiController.showNotification(data.message);
                
                // Optional: Play sound effect if game has sound controller
                if (this.game.soundController) {
                    this.game.soundController.playSound('hammerDrop');
                }
                
                // Optional: Create visual effect to help locate falling hammers
                this.createHammerDropEffect(data.count);
                break;
                
            case 'powerupSpawned':
                // Create powerup visuals for any new powerups
                if (data.powerups && this.game.objectsController) {
                    data.powerups.forEach(powerup => {
                        this.game.objectsController.createPowerup(powerup);
                    });
                    
                    // Show notification about powerup spawn
                    this.game.uiController.showNotification("Super Speed powerup has spawned on a platform!");
                }
                break;
                
            case 'powerupCollected':
                // Show notification for local player only if they collected it
                if (data.message) {
                    this.game.uiController.showNotification(data.message, 3000);
                    
                    // Create speed effect for local player
                    if (this.game.localPlayerId && this.game.players[this.game.localPlayerId]) {
                        this.createSpeedEffect();
                    }
                }
                break;
                
            // Other event types can be handled here
            default:
                console.log(`Unknown game event type: ${data.type}`);
        }
    }
    
    createHammerDropEffect(count) {
        // If we have no objects controller, we can't create effects
        if (!this.game.objectsController) return;
        
        // Create visual indicator for hammer drops - typically would be light beams from sky
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                // Find hammer that was recently spawned from sky
                const skyHammers = this.game.hammers.filter(h => h.fromSky && h.position.y > 5);
                if (skyHammers.length > 0) {
                    const hammer = skyHammers[Math.floor(Math.random() * skyHammers.length)];
                    
                    // Create light beam effect pointing to where hammer will land
                    const position = {
                        x: hammer.position.x,
                        y: 0, // Ground level
                        z: hammer.position.z
                    };
                    
                    // Create spotlight or light beam effect
                    const spotLight = new THREE.SpotLight(0x00ffff, 5, 50, Math.PI / 6, 0.5, 1);
                    spotLight.position.set(position.x, 40, position.z); // Position high above the ground
                    spotLight.target.position.set(position.x, 0, position.z); // Target at ground level
                    this.game.scene.add(spotLight);
                    this.game.scene.add(spotLight.target);
                    
                    // Add a helper to make beam visible
                    const helper = new THREE.SpotLightHelper(spotLight);
                    this.game.scene.add(helper);
                    
                    // Remove after a few seconds
                    setTimeout(() => {
                        this.game.scene.remove(spotLight);
                        this.game.scene.remove(spotLight.target);
                        this.game.scene.remove(helper);
                    }, 3000);
                }
            }, i * 500); // Stagger the effects
        }
    }
    
    // Create visual effect for speed powerup activation
    createSpeedEffect() {
        if (!this.game.objectsController) return;
        
        console.log("Creating speed effect for local player");
        
        // Create particle effect around player
        const player = this.game.players[this.game.localPlayerId];
        if (!player) return;
        
        const position = { 
            x: player.position.x,
            y: player.position.y + 1,
            z: player.position.z
        };
        
        // Create more particles for a more substantial effect
        for (let i = 0; i < 40; i++) { // Increased from 20 to 40
            const angle = Math.random() * Math.PI * 2;
            const radius = 1 + Math.random() * 2.5; // Larger radius
            
            const particlePosition = {
                x: position.x + Math.cos(angle) * radius,
                y: position.y + Math.random() * 2 - 0.5, // More centered vertically
                z: position.z + Math.sin(angle) * radius
            };
            
            const particleSize = 0.4 + Math.random() * 0.4; // Larger particles
            const particleColor = 0xFF5500; // Orange
            
            // Create particle with ObjectsController if available
            if (this.game.objectsController.createParticle) {
                this.game.objectsController.createParticle(
                    particlePosition, 
                    particleSize, 
                    particleColor,
                    1.0, // opacity
                    1.5 + Math.random() * 1.5 // Longer lifetime in seconds
                );
            }
        }
        
        // Add screen effect - orange flash
        const flashDiv = document.createElement('div');
        flashDiv.style.position = 'absolute';
        flashDiv.style.top = '0';
        flashDiv.style.left = '0';
        flashDiv.style.width = '100%';
        flashDiv.style.height = '100%';
        flashDiv.style.backgroundColor = 'rgba(255, 85, 0, 0.3)'; // More visible flash (was 0.2)
        flashDiv.style.pointerEvents = 'none';
        flashDiv.style.transition = 'opacity 1.5s'; // Slower fade (was 1s)
        flashDiv.style.zIndex = '999';
        document.getElementById('ui-container').appendChild(flashDiv);
        
        // Add "SUPER SPEED" text overlay
        const textDiv = document.createElement('div');
        textDiv.style.position = 'absolute';
        textDiv.style.top = '30%';
        textDiv.style.left = '0';
        textDiv.style.width = '100%';
        textDiv.style.textAlign = 'center';
        textDiv.style.color = '#FF5500';
        textDiv.style.fontFamily = 'Arial, sans-serif';
        textDiv.style.fontSize = '48px';
        textDiv.style.fontWeight = 'bold';
        textDiv.style.textShadow = '0 0 10px #FF9900';
        textDiv.style.transform = 'scale(0)';
        textDiv.style.transition = 'transform 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.5)';
        textDiv.style.zIndex = '1000';
        textDiv.innerHTML = 'SUPER SPEED ACTIVATED!';
        document.getElementById('ui-container').appendChild(textDiv);
        
        // Animate text in
        setTimeout(() => {
            textDiv.style.transform = 'scale(1.2)';
            setTimeout(() => {
                textDiv.style.transform = 'scale(1)';
            }, 100);
        }, 100);
        
        // Fade out
        setTimeout(() => {
            flashDiv.style.opacity = '0';
            textDiv.style.opacity = '0';
            textDiv.style.transform = 'scale(1.5)';
            textDiv.style.transition = 'opacity 1s, transform 1s';
            
            setTimeout(() => {
                flashDiv.remove();
                textDiv.remove();
            }, 1500);
        }, 1000);
        
        // Create persistent visual indicator that super speed is active
        this.createSpeedStatusIndicator();
    }
    
    onServerError(data) {
        console.error('Server error:', data.message);
        
        // Show error to user
        alert(`Server error: ${data.message}`);
        
        // Hide loader
        this.game.uiController.hideLoader();
    }
    
    onAvailableLobbies(data) {
        console.log('Received available lobbies:', data.lobbies);
        
        // Update the UI with the available lobbies
        this.game.uiController.updateLobbyBrowser(data.lobbies);
    }
    
    requestAvailableLobbies() {
        console.log('Requesting available lobbies from server');
        
        if (!this.socket || !this.isConnected) {
            console.error('Cannot request lobbies - not connected to server');
            return;
        }
        
        // Send request to server
        this.socket.emit('getAvailableLobbies');
    }
    
    // Client -> Server methods
    
    createLobby() {
        console.log('createLobby method called, isConnected:', this.isConnected);
        
        if (!this.isConnected) {
            console.error('Not connected to server, attempting to connect...');
            // Try to reconnect
            this.connect();
            
            // Set a timeout to retry the operation after a short delay
            setTimeout(() => {
                if (this.isConnected) {
                    console.log('Now connected, retrying createLobby');
                    this.socket.emit('createLobby');
                } else {
                    console.error('Still not connected after retry');
                    // Show an error message to the user
                    alert('Unable to connect to the server. Please check your connection and try again.');
                    this.game.uiController.hideLoader();
                }
            }, 1000);
            return;
        }
        
        console.log('Emitting createLobby event');
        try {
            this.socket.emit('createLobby');
        } catch (error) {
            console.error('Error emitting createLobby event:', error);
            this.game.uiController.hideLoader();
        }
    }
    
    joinLobby(lobbyId, playerName) {
        if (!this.isConnected) {
            console.error('Not connected to server');
            return;
        }
        
        this.socket.emit('joinLobby', { lobbyId, playerName });
    }
    
    toggleReady() {
        if (!this.isConnected) {
            console.error('Not connected to server');
            return;
        }
        
        this.socket.emit('toggleReady');
    }
    
    startGame() {
        if (!this.isConnected) {
            console.error('Not connected to server');
            return;
        }
        
        this.socket.emit('startGame');
    }
    
    sendPlayerInput(inputData) {
        if (!this.isConnected || !this.game.gameStarted) {
            return;
        }
        
        // If throwing a hammer, include the throwOrigin from input controller
        if (inputData.throw) {
            // Always use the locked direction that was set at the moment of the click
            // This ensures the throw direction is exactly what the camera was pointing at when clicked
            if (this.game.inputController.lockedThrowDirection) {
                inputData.throwDirection = { ...this.game.inputController.lockedThrowDirection };
            } 
            // Fallback: if locked direction isn't set for some reason, get current camera direction
            else {
                // Force update throw direction to ensure it's the latest camera direction
                // Get fresh camera direction directly
                const direction = new THREE.Vector3(0, 0, -1);
                const cameraWorldQuaternion = new THREE.Quaternion();
                this.game.camera.getWorldQuaternion(cameraWorldQuaternion);
                direction.applyQuaternion(cameraWorldQuaternion);
                
                inputData.throwDirection = {
                    x: direction.x,
                    y: direction.y,
                    z: direction.z
                };
            }
            
            // Include throw origin
            if (this.game.inputController.lastThrowOrigin) {
                inputData.throwOrigin = { ...this.game.inputController.lastThrowOrigin };
            } else {
                // Get fresh camera position directly
                const cameraPosition = new THREE.Vector3();
                this.game.camera.getWorldPosition(cameraPosition);
                
                inputData.throwOrigin = {
                    x: cameraPosition.x,
                    y: cameraPosition.y,
                    z: cameraPosition.z
                };
            }
            
            // Add timestamp to help server synchronize
            inputData.throwTimestamp = Date.now();
        }
        
        this.socket.emit('playerInput', inputData);
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
    
    // Create a persistent visual indicator for active super speed
    createSpeedStatusIndicator() {
        // Remove existing indicator if it exists
        const existingIndicator = document.getElementById('speed-status-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Create the indicator container
        const indicator = document.createElement('div');
        indicator.id = 'speed-status-indicator';
        indicator.style.position = 'absolute';
        indicator.style.bottom = '80px';
        indicator.style.right = '20px';
        indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        indicator.style.borderRadius = '8px';
        indicator.style.padding = '10px 15px';
        indicator.style.display = 'flex';
        indicator.style.alignItems = 'center';
        indicator.style.zIndex = '998';
        indicator.style.boxShadow = '0 0 10px rgba(255, 85, 0, 0.5)';
        indicator.style.borderLeft = '4px solid #FF5500';
        
        // Create icon
        const icon = document.createElement('div');
        icon.style.width = '24px';
        icon.style.height = '24px';
        icon.style.backgroundColor = '#FF5500';
        icon.style.borderRadius = '50%';
        icon.style.marginRight = '10px';
        icon.style.boxShadow = '0 0 8px #FF8800';
        icon.style.animation = 'pulse 1s infinite alternate';
        
        // Add keyframes for pulsing animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 0.6; transform: scale(0.9); }
                100% { opacity: 1; transform: scale(1.1); }
            }
            @keyframes countdown {
                0% { width: 100%; }
                100% { width: 0%; }
            }
        `;
        document.head.appendChild(style);
        
        // Create text
        const text = document.createElement('div');
        text.style.color = 'white';
        text.style.fontFamily = 'Arial, sans-serif';
        text.style.fontWeight = 'bold';
        text.style.fontSize = '14px';
        text.textContent = 'SUPER SPEED';
        
        // Create progress bar container
        const progressContainer = document.createElement('div');
        progressContainer.style.width = '100%';
        progressContainer.style.height = '4px';
        progressContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        progressContainer.style.borderRadius = '2px';
        progressContainer.style.marginTop = '5px';
        progressContainer.style.overflow = 'hidden';
        
        // Create progress bar
        const progressBar = document.createElement('div');
        progressBar.style.height = '100%';
        progressBar.style.backgroundColor = '#FF5500';
        progressBar.style.width = '100%';
        
        // Get player to calculate remaining time
        const player = this.game.players[this.game.localPlayerId];
        if (player && player.hasSuperSpeed && player.superSpeedUntil) {
            const duration = player.superSpeedUntil - Date.now();
            progressBar.style.animation = `countdown ${duration/1000}s linear forwards`;
            
            // Add timer text
            const timer = document.createElement('div');
            timer.style.color = 'rgba(255, 255, 255, 0.8)';
            timer.style.fontSize = '12px';
            timer.style.marginTop = '5px';
            timer.style.textAlign = 'center';
            timer.textContent = `${Math.ceil(duration/1000)}s`;
            
            // Update timer every second
            const updateTimer = setInterval(() => {
                const now = Date.now();
                const remaining = player.superSpeedUntil - now;
                
                if (remaining > 0) {
                    timer.textContent = `${Math.ceil(remaining/1000)}s`;
                } else {
                    clearInterval(updateTimer);
                    indicator.remove();
                }
            }, 1000);
            
            // Add timer to indicator
            indicator.appendChild(timer);
        }
        
        // Assemble the indicator
        progressContainer.appendChild(progressBar);
        indicator.appendChild(icon);
        indicator.appendChild(text);
        indicator.appendChild(progressContainer);
        
        // Add to UI container
        document.getElementById('ui-container').appendChild(indicator);
        
        // Remove when super speed expires
        if (player && player.hasSuperSpeed && player.superSpeedUntil) {
            const duration = player.superSpeedUntil - Date.now();
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.style.opacity = '0';
                    indicator.style.transition = 'opacity 0.5s';
                    setTimeout(() => {
                        if (indicator.parentNode) {
                            indicator.remove();
                        }
                    }, 500);
                }
            }, duration);
        }
    }
} 