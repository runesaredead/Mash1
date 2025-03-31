const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { performance } = require('perf_hooks');
const GameEngine = require('./game-engine.js');

// Create the Express app, HTTP server, and Socket.IO instance
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["*"],
        credentials: true
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Add CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Game state
const gameInstances = {};
const playerToGame = {};

// Lobby system
const lobbies = {};

// Create a new lobby
function createLobby(hostId) {
    const lobbyId = `lobby_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    lobbies[lobbyId] = {
        id: lobbyId,
        hostId: hostId,
        gameMode: 'ffa', // Free For All is our only mode for now
        players: {},
        maxPlayers: 8,
        status: 'waiting',
        gameStarted: false
    };
    
    // Add host to the lobby
    lobbies[lobbyId].players[hostId] = {
        id: hostId,
        isHost: true,
        ready: false,
        name: `Player_${hostId.substring(0, 5)}`
    };
    
    return lobbyId;
}

// Get lobby by player ID
function getLobbyByPlayerId(playerId) {
    for (const lobbyId in lobbies) {
        if (lobbies[lobbyId].players[playerId]) {
            return lobbies[lobbyId];
        }
    }
    return null;
}

// Create a bot player
function createBot(gameId, gameInstance) {
    const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const botName = `Bot_${Math.floor(Math.random() * 100)}`;
    
    gameInstance.engine.createPlayer(botId, botName);
    
    return {
        id: botId,
        name: botName,
        isBot: true
    };
}

// Handle socket connections
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Create or join a lobby
    socket.on('createLobby', () => {
        const lobbyId = createLobby(socket.id);
        socket.join(lobbyId);
        socket.emit('lobbyCreated', { lobbyId, lobby: lobbies[lobbyId] });
        console.log(`Player ${socket.id} created lobby ${lobbyId}`);
    });
    
    // Join existing lobby
    socket.on('joinLobby', (data) => {
        const { lobbyId } = data;
        
        if (!lobbies[lobbyId]) {
            socket.emit('error', { message: 'Lobby not found' });
            return;
        }
        
        const lobby = lobbies[lobbyId];
        
        if (lobby.gameStarted) {
            socket.emit('error', { message: 'Game already started' });
            return;
        }
        
        if (Object.keys(lobby.players).length >= lobby.maxPlayers) {
            socket.emit('error', { message: 'Lobby is full' });
            return;
        }
        
        // Add player to lobby
            lobby.players[socket.id] = {
                id: socket.id,
                isHost: false,
            ready: false,
            name: data.playerName || `Player_${socket.id.substring(0, 5)}`
        };
        
        socket.join(lobbyId);
        socket.emit('joinedLobby', { lobbyId, lobby });
        io.to(lobbyId).emit('lobbyUpdated', { lobby });
        console.log(`Player ${socket.id} joined lobby ${lobbyId}`);
    });
    
    // Get list of available lobbies
    socket.on('getAvailableLobbies', () => {
        // Filter out sensitive information and only send public lobby data
        const availableLobbies = Object.values(lobbies).map(lobby => ({
            id: lobby.id,
            hostId: lobby.hostId,
            gameMode: lobby.gameMode,
            players: lobby.players,
            maxPlayers: lobby.maxPlayers,
            status: lobby.status,
            gameStarted: lobby.gameStarted
        }));
        
        socket.emit('availableLobbies', { lobbies: availableLobbies });
        console.log(`Sent available lobbies to player ${socket.id}`);
    });
    
    // Player toggles ready status
    socket.on('toggleReady', () => {
        const lobby = getLobbyByPlayerId(socket.id);
        if (!lobby) return;
        
        lobby.players[socket.id].ready = !lobby.players[socket.id].ready;
        io.to(lobby.id).emit('lobbyUpdated', { lobby });
    });
    
    // Host starts the game
    socket.on('startGame', () => {
        const lobby = getLobbyByPlayerId(socket.id);
        if (!lobby || lobby.hostId !== socket.id) return;
        
        // Create a new game instance
        const gameId = `game_${Date.now()}`;
        const gameEngine = new GameEngine();
        
        // Generate map
        const obstacles = gameEngine.generateMap();
        
        // Create game instance
        gameInstances[gameId] = {
            id: gameId,
            engine: gameEngine,
            players: {},
            bots: [],
            startTime: Date.now(),
            lastUpdateTime: performance.now(),
            status: 'playing'
        };
        
        // Add real players
        const playerIds = Object.keys(lobby.players);
        playerIds.forEach(id => {
            const player = lobby.players[id];
            gameInstances[gameId].players[id] = {
                id,
                name: player.name,
                isBot: false
            };
            playerToGame[id] = gameId;
            gameEngine.createPlayer(id, player.name);
        });
        
        // Add bots if needed, but stagger their creation to ensure proper spacing
        if (playerIds.length < 10) {
            const botsNeeded = 10 - playerIds.length;
            
            // Create first bot immediately
            const firstBot = createBot(gameId, gameInstances[gameId]);
            gameInstances[gameId].bots.push(firstBot);
            
            // Create remaining bots with a delay to allow physics to stabilize between spawns
            if (botsNeeded > 1) {
                let botsCreated = 1;
                
                const createBotWithDelay = () => {
                    if (botsCreated < botsNeeded && gameInstances[gameId]) {
                const bot = createBot(gameId, gameInstances[gameId]);
                gameInstances[gameId].bots.push(bot);
                        botsCreated++;
                        
                        if (botsCreated < botsNeeded) {
                            setTimeout(createBotWithDelay, 300); // 300ms delay between bot spawns
                        }
                    }
                };
                
                // Start the staggered bot creation
                setTimeout(createBotWithDelay, 300);
            }
        }
            
            // Mark the lobby as started
            lobby.gameStarted = true;
            lobby.status = 'playing';
            
        // Notify all players in the lobby
        io.to(lobby.id).emit('gameStarted', { 
            gameId,
            players: { ...gameInstances[gameId].players },
            bots: gameInstances[gameId].bots,
            obstacles,
            mapSize: gameEngine.mapSize
        });
        
        console.log(`Game ${gameId} started for lobby ${lobby.id}`);
    });
    
    // Handle player input
    socket.on('playerInput', (inputData) => {
        // Find the game this player is in
        const gameId = playerToGame[socket.id];
        if (!gameId || !gameInstances[gameId]) return;
        
        const game = gameInstances[gameId];
        const player = game.engine.players[socket.id];
        
        if (player && player.isAlive) {
            // Update player velocities for movement
            if (inputData.movement) {
                // Forward/backward (z-axis)
                if (typeof inputData.movement.forward === 'number') {
                    // Create rotation quaternion from player's current rotation
                    const rotationX = player.rotation.x || 0;
                    const rotationY = player.rotation.y || 0;
                    const rotationZ = player.rotation.z || 0;
                    
                    // Calculate direction vector based on rotation
                    const directionX = Math.sin(rotationY);
                    const directionZ = Math.cos(rotationY);
                    
                    // Calculate speed based on running state and super speed powerup
                    let speedMultiplier = inputData.movement.running ? 15 : 10;
                    
                    // Apply super speed powerup if active
                    if (player.hasSuperSpeed) {
                        speedMultiplier *= 2; // Double the speed
                    }
                    
                    // Apply movement in rotated direction
                    player.velocity.x = directionX * inputData.movement.forward * speedMultiplier;
                    player.velocity.z = directionZ * inputData.movement.forward * speedMultiplier;
                }
                
                // Strafe left/right (x-axis) - perpendicular to forward direction
                if (typeof inputData.movement.right === 'number') {
                    const rotationY = player.rotation.y || 0;
                    
                    // Calculate perpendicular direction for strafing
                    const strafeX = Math.sin(rotationY + Math.PI/2);
                    const strafeZ = Math.cos(rotationY + Math.PI/2);
                    
                    // Calculate speed based on running state and super speed powerup
                    let speedMultiplier = inputData.movement.running ? 15 : 10;
                    
                    // Apply super speed powerup if active
                    if (player.hasSuperSpeed) {
                        speedMultiplier *= 2; // Double the speed
                    }
                    
                    // Add strafe velocity to existing velocity
                    player.velocity.x += strafeX * inputData.movement.right * speedMultiplier;
                    player.velocity.z += strafeZ * inputData.movement.right * speedMultiplier;
                }
            }
            
            // Handle normal jump from ground
            if (inputData.jump && player.onGround) {
                player.velocity.y = 10; // Jump height
                player.onGround = false;
                player.isJumping = true;
            }
            
            // Handle throw
            if (inputData.throw && inputData.throwDirection) {
                // Queue the throw for next physics update
                player.pendingThrow = {
                    direction: inputData.throwDirection,
                    power: 1,
                    origin: null
                };
            }
            
            // Handle melee attack
            if (inputData.melee) {
                // Queue melee for next physics update
                player.pendingMelee = true;
                
                // Store camera-based direction for melee dash if available
                if (inputData.throwDirection) {
                    player.lastMeleeDirection = inputData.throwDirection;
                }
            }
            
            // Update player rotation
            if (inputData.cameraRotation) {
                player.rotation = { ...inputData.cameraRotation };
            }
        }
    });
    
    // Player disconnected
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        // Check if player was in a lobby
        const lobby = getLobbyByPlayerId(socket.id);
        if (lobby) {
            if (lobby.hostId === socket.id && !lobby.gameStarted) {
                // If host disconnects before game starts, remove the lobby
                io.to(lobby.id).emit('lobbyDisbanded', { reason: 'Host disconnected' });
                delete lobbies[lobby.id];
            } else {
            // Remove player from lobby
            delete lobby.players[socket.id];
            
                // If the game already started, just notify remaining players
                if (lobby.gameStarted) {
                    io.to(lobby.id).emit('playerLeft', { playerId: socket.id });
                } else {
                    // If game hasn't started, update lobby
                    io.to(lobby.id).emit('lobbyUpdated', { lobby });
                    
                    // If host left, assign new host
                    if (lobby.hostId === socket.id) {
                const newHostId = Object.keys(lobby.players)[0];
                        if (newHostId) {
                lobby.hostId = newHostId;
                lobby.players[newHostId].isHost = true;
                            io.to(lobby.id).emit('newHost', { hostId: newHostId });
                        }
                    }
                }
            }
            }
            
        // Check if player was in a game
        const gameId = playerToGame[socket.id];
        if (gameId && gameInstances[gameId]) {
            const gameInstance = gameInstances[gameId];
            
            // Mark player as disconnected in the game
            if (gameInstance.engine.players[socket.id]) {
                gameInstance.engine.players[socket.id].isAlive = false;
                gameInstance.engine.players[socket.id].disconnected = true;
            }
            
            delete gameInstance.players[socket.id];
            delete playerToGame[socket.id];
            
            // If no real players left, end the game
            if (Object.keys(gameInstance.players).length === 0) {
                delete gameInstances[gameId];
            }
        }
    });
});

// Main game loop
function gameLoop() {
    const now = performance.now();
    
    // Update all active game instances
    for (const gameId in gameInstances) {
        const game = gameInstances[gameId];
        
        // Calculate delta time
        const deltaTime = (now - game.lastUpdateTime) / 1000;
        game.lastUpdateTime = now;
        
        // Update game state
        const updateResult = game.engine.update(deltaTime);
        
        // Check if hammers were dropped from the sky and broadcast if so
        if (updateResult && updateResult.message) {
            // Get all player IDs in this game
            const playerIds = Object.keys(game.players);
            
            // Send message to each player
            playerIds.forEach(playerId => {
                const socket = io.sockets.sockets.get(playerId);
                if (socket) {
                    socket.emit('gameEvent', {
                        type: 'hammerDrop',
                        message: updateResult.message,
                        count: updateResult.count
                    });
                }
            });
        }
        
        // Check for powerup-related events and broadcast them
        if (updateResult && updateResult.powerups) {
            const playerIds = Object.keys(game.players);
            
            // Process any new powerups spawned
            if (updateResult.powerups.spawned && updateResult.powerups.spawned.length > 0) {
                playerIds.forEach(playerId => {
                    const socket = io.sockets.sockets.get(playerId);
                    if (socket) {
                        socket.emit('gameEvent', {
                            type: 'powerupSpawned',
                            powerups: updateResult.powerups.spawned
                        });
                    }
                });
            }
            
            // Process any powerup pickups
            if (updateResult.powerups.collected) {
                for (const pickup of updateResult.powerups.collected) {
                    const socket = io.sockets.sockets.get(pickup.playerId);
                    if (socket) {
                        socket.emit('gameEvent', {
                            type: 'powerupCollected',
                            powerupType: pickup.type,
                            message: 'Super Speed activated!'
                        });
                    }
                }
            }
        }
        
        // Get current game state
        const gameState = game.engine.getState();
        
        // Send game state to all players
        const playerIds = Object.keys(game.players);
        if (playerIds.length > 0) {
            playerIds.forEach(playerId => {
                const socket = io.sockets.sockets.get(playerId);
                if (socket) {
                    socket.emit('gameState', gameState);
                }
            });
        }
        
        // Update bots
        game.bots.forEach(bot => {
            game.engine.updateBot(bot.id, game.engine.players, deltaTime);
        });
        
        // Check end game conditions
        let playersAlive = 0;
        let botsAlive = 0;
        let humanPlayersAlive = 0;
        
        for (const playerId in game.engine.players) {
            const player = game.engine.players[playerId];
            if (player.isAlive) {
                playersAlive++;
                // Track if this is a bot or human player
                const isBot = game.bots.some(bot => bot.id === playerId);
                if (isBot) {
                    botsAlive++;
                } else {
                    humanPlayersAlive++;
                }
            }
        }
        
        // Only end the game if:
        // 1. No players are alive (everyone died - no winner)
        // 2. Exactly one player is alive (we have a winner)
        if (playersAlive === 0 || playersAlive === 1) {
            // Find winner
            let winner = null;
            for (const playerId in game.engine.players) {
                const player = game.engine.players[playerId];
                if (player.isAlive) {
                    winner = {
                        id: playerId,
                        name: player.name,
                        isBot: game.bots.some(bot => bot.id === playerId)
                    };
                    break;
                }
            }
            
            // Send game over event
            playerIds.forEach(playerId => {
                const socket = io.sockets.sockets.get(playerId);
                if (socket) {
                    socket.emit('gameOver', { winner });
                }
            });
            
            // Clean up game instance
            playerIds.forEach(id => {
                delete playerToGame[id];
            });
            delete gameInstances[gameId];
        }
    }
}

// Game update loop
setInterval(() => {
    const currentTime = performance.now();
    
    for (const gameId in gameInstances) {
        const gameInstance = gameInstances[gameId];
        const deltaTime = currentTime - gameInstance.lastUpdateTime;
    
        // Update game state
        gameInstance.engine.update(deltaTime);
    
        // Update bots
        gameInstance.bots.forEach(bot => {
            gameInstance.engine.updateBot(bot.id, gameInstance.engine.players, deltaTime);
        });
        
        // Send game state to all players
        const playerIds = Object.keys(gameInstance.players);
        if (playerIds.length > 0) {
            const gameState = gameInstance.engine.getState();
            
            // Emit state to all players in the game
            playerIds.forEach(playerId => {
                const socket = io.sockets.sockets.get(playerId);
                if (socket) {
                    socket.emit('gameState', gameState);
                }
            });
        }
        
        // Check end game conditions
        let playersAlive = 0;
        let botsAlive = 0;
        let humanPlayersAlive = 0;
        
        for (const playerId in gameInstance.engine.players) {
            const player = gameInstance.engine.players[playerId];
            if (player.isAlive) {
                playersAlive++;
                // Track if this is a bot or human player
                const isBot = gameInstance.bots.some(bot => bot.id === playerId);
                if (isBot) {
                    botsAlive++;
                } else {
                    humanPlayersAlive++;
                }
            }
        }
        
        // Only end the game if:
        // 1. No players are alive (everyone died - no winner)
        // 2. Exactly one player is alive (we have a winner)
        if (playersAlive === 0 || playersAlive === 1) {
            // Find winner
            let winner = null;
            for (const playerId in gameInstance.engine.players) {
                const player = gameInstance.engine.players[playerId];
                if (player.isAlive) {
                    winner = {
                        id: playerId,
                        name: player.name,
                        isBot: gameInstance.bots.some(bot => bot.id === playerId)
                    };
                    break;
                }
            }
            
            // Send game over event
            playerIds.forEach(playerId => {
                const socket = io.sockets.sockets.get(playerId);
                if (socket) {
                    socket.emit('gameOver', { winner });
                }
            });
            
            // Clean up game instance
            playerIds.forEach(id => {
                delete playerToGame[id];
            });
            delete gameInstances[gameId];
        }
        
        gameInstance.lastUpdateTime = currentTime;
    }
}, 1000 / 60); // 60 FPS update rate

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Hammer Dodgeball server running on port ${PORT}`);
}); 