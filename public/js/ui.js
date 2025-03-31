// UI controller
class UIController {
    constructor(game) {
        this.game = game;
        
        // Cache UI elements
        this.menu = document.getElementById('menu');
        this.lobby = document.getElementById('lobby');
        this.lobbyId = document.getElementById('lobby-id');
        this.playerList = document.getElementById('player-list');
        this.joinLobbyPanel = document.getElementById('join-lobby');
        this.gameOver = document.getElementById('game-over');
        this.winnerInfo = document.getElementById('winner-info');
        this.healthBar = document.getElementById('health-fill');
        this.hammerCount = document.getElementById('hammer-count');
        this.hitIndicator = document.getElementById('hit-indicator');
        this.loader = document.getElementById('loader');
        this.gameContainer = document.getElementById('game-container');
        this.uiContainer = document.getElementById('ui-container');
        
        // Cache buttons
        this.createLobbyBtn = document.getElementById('create-lobby-btn');
        this.joinPartyBtn = document.getElementById('join-party-btn');
        this.leaveLobbyBtn = document.getElementById('leave-lobby-btn');
        this.readyBtn = document.getElementById('ready-btn');
        this.startGameBtn = document.getElementById('start-game-btn');
        this.joinLobbyBtn = document.getElementById('join-lobby-btn');
        this.cancelJoinBtn = document.getElementById('cancel-join-btn');
        this.copyLobbyIdBtn = document.getElementById('copy-lobby-id');
        this.returnMenuBtn = document.getElementById('return-menu-btn');
        this.refreshLobbiesBtn = document.getElementById('refresh-lobbies-btn');
        
        // Cache inputs
        this.lobbyIdInput = document.getElementById('lobby-id-input');
        this.playerNameInput = document.getElementById('player-name-input');
        this.lobbyBrowser = document.getElementById('lobby-browser');
        
        // Setup UI event listeners
        this.setupEventListeners();
        
        // Local state
        this.currentLobby = null;
        this.isReady = false;
        this.isHost = false;
        this.pauseMenuVisible = false;
        this.deathNotificationShown = false;
    }
    
    setupEventListeners() {
        // Main menu buttons
        this.createLobbyBtn.addEventListener('click', () => this.onCreateLobby());
        this.joinPartyBtn.addEventListener('click', () => this.onShowJoinLobby());
        
        // Lobby buttons
        this.leaveLobbyBtn.addEventListener('click', () => this.onLeaveLobby());
        this.readyBtn.addEventListener('click', () => this.onToggleReady());
        this.startGameBtn.addEventListener('click', () => this.onStartGame());
        this.copyLobbyIdBtn.addEventListener('click', () => this.onCopyLobbyId());
        
        // Join lobby buttons
        this.joinLobbyBtn.addEventListener('click', () => this.onJoinLobby());
        this.cancelJoinBtn.addEventListener('click', () => this.onCancelJoin());
        this.refreshLobbiesBtn.addEventListener('click', () => this.refreshLobbies());
        
        // Game over buttons
        this.returnMenuBtn.addEventListener('click', () => this.showMainMenu());
    }
    
    onCreateLobby() {
        console.log('Create Lobby button clicked');
        
        // Show loading indicator
        this.showLoader();
        
        console.log('NetworkController available:', !!this.game.networkController);
        if (this.game.networkController) {
            console.log('NetworkController connected:', this.game.networkController.isConnected);
        }
        
        // Request server to create a new lobby
        this.game.networkController.createLobby();
        console.log('createLobby method called');
    }
    
    onLeaveLobby() {
        // Return to main menu
        this.showMainMenu();
        
        // Disconnect from server
        this.game.networkController.disconnect();
    }
    
    onToggleReady() {
        // Send ready toggle to server
        this.game.networkController.toggleReady();
        
        // Update button text (will be confirmed by server update)
        this.isReady = !this.isReady;
        this.readyBtn.innerText = this.isReady ? 'NOT READY' : 'READY';
    }
    
    onStartGame() {
        // Request server to start the game
        this.game.networkController.startGame();
        
        // Show loading indicator
        this.showLoader();
    }
    
    onJoinLobby() {
        const lobbyId = this.lobbyIdInput.value.trim();
        const playerName = this.playerNameInput.value.trim() || 'Player';
        
        if (lobbyId) {
            // Show loading indicator
            this.showLoader();
            
            // Request server to join the specified lobby
            this.game.networkController.joinLobby(lobbyId, playerName);
        }
    }
    
    onCancelJoin() {
        // Hide join panel
        this.joinLobbyPanel.style.display = 'none';
        
        // Show main menu
        this.menu.style.display = 'block';
    }
    
    onCopyLobbyId() {
        const lobbyId = this.lobbyId.innerText;
        
        // Copy to clipboard
        navigator.clipboard.writeText(lobbyId).then(() => {
            // Change button text temporarily
            const originalText = this.copyLobbyIdBtn.innerText;
            this.copyLobbyIdBtn.innerText = 'Copied!';
            
            // Reset button text after 2 seconds
            setTimeout(() => {
                this.copyLobbyIdBtn.innerText = originalText;
            }, 2000);
        });
    }
    
    onShowJoinLobby() {
        console.log('Join Party button clicked');
        
        // Hide menu
        this.menu.style.display = 'none';
        
        // Show join lobby panel
        this.joinLobbyPanel.style.display = 'block';
        
        // Focus on lobby ID input
        this.lobbyIdInput.focus();
        
        // Refresh the list of available lobbies
        this.refreshLobbies();
    }
    
    refreshLobbies() {
        console.log('Refreshing lobbies list');
        
        // Show loading state in the lobby browser
        this.lobbyBrowser.innerHTML = '<div style="text-align: center; color: #aaa; padding: 10px;">Loading lobbies...</div>';
        
        // Request available lobbies from the server
        this.game.networkController.requestAvailableLobbies();
    }
    
    updateLobbyBrowser(lobbies) {
        console.log('Updating lobby browser with lobbies:', lobbies);
        
        if (!lobbies || lobbies.length === 0) {
            this.lobbyBrowser.innerHTML = '<div style="text-align: center; color: #aaa; padding: 10px;">No active lobbies found.</div>';
            return;
        }
        
        // Clear the browser
        this.lobbyBrowser.innerHTML = '';
        
        // Add each lobby to the browser
        lobbies.forEach(lobby => {
            const lobbyItem = document.createElement('div');
            lobbyItem.className = 'lobby-browser-item';
            lobbyItem.style.padding = '10px';
            lobbyItem.style.margin = '5px 0';
            lobbyItem.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            lobbyItem.style.borderRadius = '3px';
            lobbyItem.style.cursor = 'pointer';
            lobbyItem.style.display = 'flex';
            lobbyItem.style.justifyContent = 'space-between';
            lobbyItem.style.alignItems = 'center';
            
            const playerCount = Object.keys(lobby.players).length;
            
            const lobbyInfo = document.createElement('div');
            lobbyInfo.innerHTML = `
                <div><strong>ID:</strong> ${lobby.id.substring(0, 8)}...</div>
                <div><strong>Players:</strong> ${playerCount}/${lobby.maxPlayers}</div>
                <div><strong>Status:</strong> ${lobby.gameStarted ? 'In Game' : 'Waiting'}</div>
            `;
            
            const joinButton = document.createElement('button');
            joinButton.className = 'menu-button';
            joinButton.style.padding = '5px 10px';
            joinButton.style.fontSize = '14px';
            joinButton.textContent = 'Join';
            joinButton.disabled = lobby.gameStarted;
            joinButton.style.opacity = lobby.gameStarted ? '0.5' : '1';
            
            // Add join handler if not in game
            if (!lobby.gameStarted) {
                joinButton.addEventListener('click', () => {
                    // Populate the input field with the lobby ID
                    this.lobbyIdInput.value = lobby.id;
                    
                    // Join the lobby
                    this.onJoinLobby();
                });
            }
            
            lobbyItem.appendChild(lobbyInfo);
            lobbyItem.appendChild(joinButton);
            
            this.lobbyBrowser.appendChild(lobbyItem);
        });
    }
    
    showLoader() {
        this.loader.style.display = 'block';
    }
    
    hideLoader() {
        this.loader.style.display = 'none';
    }
    
    showLobby(lobbyData) {
        // Hide other UI elements
        this.menu.style.display = 'none';
        this.joinLobbyPanel.style.display = 'none';
        this.gameOver.style.display = 'none';
        this.hideLoader();
        
        // Show lobby
        this.lobby.style.display = 'block';
        
        // Update lobby info
        this.lobbyId.innerText = lobbyData.id;
        
        // Store lobby data
        this.currentLobby = lobbyData;
        
        // Check if player is host
        this.isHost = lobbyData.hostId === this.game.networkController.socket.id;
        
        // Update UI based on host status
        this.startGameBtn.style.display = this.isHost ? 'block' : 'none';
        
        // Update player list
        this.updatePlayerList();
    }
    
    updateLobby(lobbyData) {
        // Update stored lobby data
        this.currentLobby = lobbyData;
        
        // Check if ready status changed
        const playerData = lobbyData.players[this.game.networkController.socket.id];
        if (playerData) {
            this.isReady = playerData.ready;
            this.readyBtn.innerText = this.isReady ? 'NOT READY' : 'READY';
        }
        
        // Update player list
        this.updatePlayerList();
        
        // Check if host changed
        this.isHost = lobbyData.hostId === this.game.networkController.socket.id;
        this.startGameBtn.style.display = this.isHost ? 'block' : 'none';
    }
    
    updatePlayerList() {
        if (!this.currentLobby) return;
        
        // Clear player list
        this.playerList.innerHTML = '';
        
        // Add players to list
        for (const id in this.currentLobby.players) {
            const player = this.currentLobby.players[id];
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';
            
            // Create player name with host badge if needed
            const nameElement = document.createElement('div');
            nameElement.innerText = player.name || `Player ${id.substring(0, 5)}`;
            
            if (player.isHost) {
                const hostBadge = document.createElement('span');
                hostBadge.className = 'host-badge';
                hostBadge.innerText = 'HOST';
                nameElement.appendChild(hostBadge);
            }
            
            // Create ready badge
            const readyElement = document.createElement('div');
            if (player.ready) {
                const readyBadge = document.createElement('span');
                readyBadge.className = 'ready-badge';
                readyBadge.innerText = 'READY';
                readyElement.appendChild(readyBadge);
            } else {
                readyElement.innerText = 'Not Ready';
            }
            
            // Add elements to player item
            playerElement.appendChild(nameElement);
            playerElement.appendChild(readyElement);
            
            // Add player item to list
            this.playerList.appendChild(playerElement);
        }
    }
    
    showMainMenu() {
        // Hide other UI elements
        this.lobby.style.display = 'none';
        this.joinLobbyPanel.style.display = 'none';
        this.gameOver.style.display = 'none';
        this.hideLoader();
        
        // Show main menu
        this.menu.style.display = 'block';
        
        // Reset current lobby
        this.currentLobby = null;
    }
    
    showGameOver(data) {
        // Hide game UI
        this.hammerCount.style.display = 'none';
        this.healthBar.parentElement.style.display = 'none';
        
        // Show game over screen
        this.gameOver.style.display = 'block';
        
        // Update winner info
        if (data.winner) {
            this.winnerInfo.innerHTML = `
                <p><strong>${data.winner.name}</strong> is the winner!</p>
                <p>Congratulations!</p>
            `;
        } else {
            this.winnerInfo.innerHTML = `
                <p>No winner! Everyone lost!</p>
            `;
        }
    }
    
    showPauseMenu() {
        if (!this.game.gameStarted) return;
        
        this.pauseMenuVisible = true;
        
        // Create pause menu if it doesn't exist
        if (!this.pauseMenu) {
            this.pauseMenu = document.createElement('div');
            this.pauseMenu.id = 'pause-menu';
            this.pauseMenu.style.position = 'absolute';
            this.pauseMenu.style.top = '50%';
            this.pauseMenu.style.left = '50%';
            this.pauseMenu.style.transform = 'translate(-50%, -50%)';
            this.pauseMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            this.pauseMenu.style.padding = '30px';
            this.pauseMenu.style.borderRadius = '10px';
            this.pauseMenu.style.border = '2px solid #ff6600';
            this.pauseMenu.style.textAlign = 'center';
            this.pauseMenu.style.pointerEvents = 'auto';
            
            this.pauseMenu.innerHTML = `
                <h2 style="color: #ff6600; margin-top: 0;">PAUSED</h2>
                <p>Click the game to resume</p>
                <button id="quit-game-btn" class="menu-button">QUIT GAME</button>
            `;
            
            this.uiContainer.appendChild(this.pauseMenu);
            
            // Add event listener to quit button
            document.getElementById('quit-game-btn').addEventListener('click', () => {
                this.game.networkController.disconnect();
                this.game.endGame({});
                this.showMainMenu();
            });
        } else {
            this.pauseMenu.style.display = 'block';
        }
    }
    
    hidePauseMenu() {
        if (this.pauseMenu) {
            this.pauseMenu.style.display = 'none';
        }
        this.pauseMenuVisible = false;
    }
    
    updatePlayerUI(player) {
        // Debug the player state
        console.log('Player state:', { 
            id: player.id,
            health: player.health, 
            isAlive: player.isAlive
        });
        
        // Handle player death
        if (!player.isAlive || player.health <= 0) {
            console.log('*** PLAYER IS DEAD - HEALTH BAR SHOULD BE EMPTY ***');
            
            // Make sure health is exactly 0
            player.health = 0;
            
            // Set health bar color and width directly
            try {
                // First, try direct manipulation approach
                this.healthBar.style.width = '0%';
                this.healthBar.style.backgroundColor = '#ff0000';
                
                // Backup approaches in case direct manipulation doesn't work
                if (this.healthBar.parentElement) {
                    // Create a new empty health bar div
                    const newHealthBar = document.createElement('div');
                    newHealthBar.id = 'health-fill';
                    newHealthBar.style.cssText = 'width: 0% !important; height: 100%; background-color: #ff0000;';
                    
                    // Remove the old health bar
                    this.healthBar.parentElement.innerHTML = '';
                    
                    // Add the new one
                    this.healthBar.parentElement.appendChild(newHealthBar);
                    
                    // Update our reference
                    this.healthBar = newHealthBar;
                }
            } catch (e) {
                console.error('Error updating health bar:', e);
            }
            
            // Show death notification
            if (!this.deathNotificationShown) {
                this.showDeathNotification();
            }
            
            // Update hammer count
            if (this.hammerCount) {
                this.hammerCount.innerText = `Hammers: ${player.hammers}`;
            }
            
            return;
        }
        
        // Only update health bar for living players
        const healthPercent = Math.max(0, (player.health / 3) * 100);
        this.healthBar.style.width = `${healthPercent}%`;
        
        // Update health bar color based on health percentage
        if (healthPercent > 60) {
            this.healthBar.style.backgroundColor = '#00ff00'; // Green
        } else if (healthPercent > 30) {
            this.healthBar.style.backgroundColor = '#ffff00'; // Yellow
        } else {
            this.healthBar.style.backgroundColor = '#ff0000'; // Red
        }
        
        // Update hammer count
        this.hammerCount.innerText = `Hammers: ${player.hammers}`;
        
        // Show hit indicator if player was recently hit
        if (player.lastHitTime && Date.now() - player.lastHitTime < 300) {
            this.showHitIndicator();
        }
    }
    
    showDeathNotification() {
        // Set flag to prevent multiple notifications
        this.deathNotificationShown = true;
        
        // Create death notification if it doesn't exist
        if (!this.deathNotification) {
            this.deathNotification = document.createElement('div');
            this.deathNotification.id = 'death-notification';
            this.deathNotification.style.position = 'absolute';
            this.deathNotification.style.top = '40%';
            this.deathNotification.style.left = '50%';
            this.deathNotification.style.transform = 'translate(-50%, -50%)';
            this.deathNotification.style.backgroundColor = 'rgba(150, 0, 0, 0.8)';
            this.deathNotification.style.color = '#ffffff';
            this.deathNotification.style.fontSize = '38px'; // Slightly larger font
            this.deathNotification.style.fontWeight = 'bold';
            this.deathNotification.style.padding = '20px 40px';
            this.deathNotification.style.borderRadius = '10px';
            this.deathNotification.style.border = '2px solid #ff0000';
            this.deathNotification.style.textShadow = '0 0 10px #ff0000';
            this.deathNotification.style.textAlign = 'center';
            this.deathNotification.style.animation = 'fadeInOut 2s ease-in-out';
            this.deathNotification.style.zIndex = '1000';
            
            // Add animation style if not already added
            if (!document.getElementById('death-notification-style')) {
                const style = document.createElement('style');
                style.id = 'death-notification-style';
                style.textContent = `
                    @keyframes fadeInOut {
                        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                        15% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                        30% { transform: translate(-50%, -50%) scale(1); }
                        85% { opacity: 1; }
                        100% { opacity: 0; }
                    }
                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                        100% { transform: scale(1); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            this.deathNotification.innerHTML = `YOU LOSE`;
            this.uiContainer.appendChild(this.deathNotification);
            
            // Add pulsing animation
            const startPulse = () => {
                this.deathNotification.style.animation = 'pulse 0.8s infinite';
            };
            
            // Start pulsing after the initial animation
            setTimeout(startPulse, 2000);
            
            // Remove after game ends or when player respawns
            setTimeout(() => {
                this.uiContainer.removeChild(this.deathNotification);
                this.deathNotification = null;
                // Reset the flag when starting a new game
                this.deathNotificationShown = false;
            }, 5000);
        }
    }
    
    showHitIndicator() {
        // Show hit indicator
        this.hitIndicator.style.opacity = '1';
        
        // Hide after a short time
        setTimeout(() => {
            this.hitIndicator.style.opacity = '0';
        }, 300);
    }
    
    showGameUI() {
        // Show game HUD
        this.hammerCount.style.display = 'block';
        this.healthBar.parentElement.style.display = 'block';
        
        // Hide menu screens
        this.menu.style.display = 'none';
        this.lobby.style.display = 'none';
        this.gameOver.style.display = 'none';
        this.hideLoader();
    }
    
    // Add a notification system for game events
    showNotification(message, duration = 3000) {
        // Check if a notification container already exists
        let notificationContainer = document.getElementById('notification-container');
        
        // Create container if it doesn't exist
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.style.position = 'absolute';
            notificationContainer.style.top = '10%';
            notificationContainer.style.left = '50%';
            notificationContainer.style.transform = 'translateX(-50%)';
            notificationContainer.style.width = 'auto';
            notificationContainer.style.maxWidth = '80%';
            notificationContainer.style.zIndex = '1000';
            notificationContainer.style.pointerEvents = 'none'; // Don't interfere with game input
            document.body.appendChild(notificationContainer);
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'game-notification';
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        notification.style.color = '#fff';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.marginBottom = '10px';
        notification.style.textAlign = 'center';
        notification.style.fontSize = '18px';
        notification.style.fontWeight = 'bold';
        notification.style.animation = 'fadeInOut 3s ease-in-out';
        notification.textContent = message;
        
        // Add to container
        notificationContainer.appendChild(notification);
        
        // Add stylesheet if it doesn't exist
        if (!document.getElementById('notification-style')) {
            const style = document.createElement('style');
            style.id = 'notification-style';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateY(-20px); }
                    10% { opacity: 1; transform: translateY(0); }
                    90% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-20px); }
                }
                
                .game-notification {
                    animation: fadeInOut 3s ease-in-out;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Remove notification after duration
        setTimeout(() => {
            if (notification.parentNode === notificationContainer) {
                notificationContainer.removeChild(notification);
            }
            
            // Remove container if empty
            if (notificationContainer.children.length === 0) {
                if (notificationContainer.parentNode === document.body) {
                    document.body.removeChild(notificationContainer);
                }
            }
        }, duration);
    }
    
    update(deltaTime) {
        if (!this.game.localPlayer) return;
        
        // Update health bar
        const health = this.game.localPlayer.health;
        if (health !== this.lastHealth) {
            const healthPercent = (health / 3) * 100;
            this.healthBar.style.width = healthPercent + '%';
            
            // Change color based on health
            if (healthPercent > 66) {
                this.healthBar.style.backgroundColor = '#00ff00'; // Green
            } else if (healthPercent > 33) {
                this.healthBar.style.backgroundColor = '#ffff00'; // Yellow
            } else {
                this.healthBar.style.backgroundColor = '#ff0000'; // Red
            }
            
            this.lastHealth = health;
        }
        
        // Update hammer count
        const hammerCount = this.game.localPlayer.hammers;
        if (hammerCount !== this.lastHammerCount) {
            this.hammerCount.textContent = `Hammers: ${hammerCount}`;
            this.lastHammerCount = hammerCount;
        }
    }
} 