# Mariodin Mash - Multiplayer Physics Game

A physics-based multiplayer free-for-all battle game built with Three.js, Socket.IO, and Express.

## Game Overview

Mariodin Mash is a multiplayer physics game where players battle in a 3D environment. The game features:

- Real-time multiplayer gameplay
- Physics-based movement and combat
- Lobby system for creating and joining games
- PowerUps and special abilities

## Development Setup

1. Clone the repository:
```
git clone https://github.com/runesaredead/Mash1.git
cd Mash1
```

2. Install dependencies:
```
npm install
```

3. Start the development server:
```
npm run dev
```

4. Open your browser and navigate to `http://localhost:3001`

## Deployment

The game is configured to be deployable on Render.com or similar platforms.

### Render Deployment Instructions

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Use the following settings:
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment: Node
   - Environment Variables: None required by default, PORT is automatically set by Render

## Troubleshooting

If you encounter the "Unable to connect to the server" error when playing the deployed version:
1. Check that both the client and server are deployed correctly
2. Verify that there are no CORS issues
3. Confirm that Socket.IO is properly connecting using the correct server URL

## License

MIT 