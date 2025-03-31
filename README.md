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

#### Alternative Deployment Using render.yaml

This project includes a `render.yaml` configuration file, which allows you to deploy directly from the Render dashboard:

1. Log into your Render account
2. Go to "Blueprints" in the dashboard
3. Click "New Blueprint Instance"
4. Connect to your GitHub repository
5. Render will automatically detect the render.yaml file and configure the service

### Troubleshooting Render Deployment Issues

If you encounter 502 Bad Gateway errors:
1. Check the Render logs for any startup errors
2. Ensure the Node.js version is compatible (Render uses Node 14 by default)
3. Verify that your app is properly listening on the PORT environment variable
4. Make sure there are no errors in server.js that might prevent startup

## Socket.IO Connection Troubleshooting

If the client can't connect to the server:
1. Check browser console for any connection errors
2. Verify that the Socket.IO URL is correct (should use the same origin when deployed)
3. Check that CORS is properly configured on the server
4. Ensure websockets are enabled in your Render service settings

## License

MIT 