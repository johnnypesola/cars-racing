const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Create Express app for health checks
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', players: Object.keys(players).length });
});

// Start Express server
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  console.log(`🚗 Cars Racing Server running on port ${PORT}`);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Helper function to safely serialize player data (without WebSocket references)
function serializePlayer(player) {
  return {
    id: player.id,
    x: player.x,
    y: player.y,
    angle: player.angle,
    velocityX: player.velocityX || 0,
    velocityY: player.velocityY || 0
  };
}

// Game state
const players = {}; // Store all connected players

// WebSocket connection handler
wss.on('connection', (ws) => {
  const playerId = uuidv4();

  console.log(`🎮 Player ${playerId} connected`);

  // Initialize player data
  players[playerId] = {
    id: playerId,
    ws: ws,
    x: 345 + Math.random() * 100 - 50, // Random spawn near center
    y: 50 + Math.random() * 100 - 50,
    angle: 90,
    velocityX: 0,
    velocityY: 0,
    connected: true,
    lastUpdate: Date.now()
  };

  // Send initial player data to the new player
  const initMessage = {
    type: 'init',
    playerId: playerId,
    player: serializePlayer(players[playerId]),
    allPlayers: Object.values(players).filter(p => p.id !== playerId).map(p => serializePlayer(p))
  };
  
  console.log('Sending init message:', JSON.stringify(initMessage, null, 2));
  ws.send(JSON.stringify(initMessage));

  // Notify other players about new player
  broadcastToOthers(playerId, {
    type: 'playerJoined',
    player: serializePlayer(players[playerId])
  });

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handlePlayerMessage(playerId, message);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    console.log(`👋 Player ${playerId} disconnected`);
    
    // Notify other players
    broadcastToOthers(playerId, {
      type: 'playerLeft',
      playerId: playerId
    });

    // Remove player from game state
    delete players[playerId];
  });

  // Handle connection errors
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for player ${playerId}:`, error);
  });
});

// Handle player messages
function handlePlayerMessage(playerId, message) {
  const player = players[playerId];
  if (!player) return;

  switch (message.type) {
    case 'playerUpdate':
      // Update player position and state
      player.x = message.x;
      player.y = message.y;
      player.angle = message.angle;
      player.velocityX = message.velocityX || 0;
      player.velocityY = message.velocityY || 0;
      player.lastUpdate = Date.now();

      // Broadcast update to other players
      broadcastToOthers(playerId, {
        type: 'playerUpdate',
        player: serializePlayer(player)
      });
      break;

    case 'collision':
      // Handle collision events
      break;

    default:
      console.log(`Unknown message type: ${message.type}`);
  }
}

// Broadcast message to all players except the sender
function broadcastToOthers(senderId, message) {
  Object.values(players).forEach(player => {
    if (player.id !== senderId && player.ws.readyState === WebSocket.OPEN) {
      try {
        player.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to player ${player.id}:`, error);
      }
    }
  });
}

// Broadcast message to all players
// function broadcastToAll(message) {
//   Object.values(players).forEach(player => {
//     if (player.ws.readyState === WebSocket.OPEN) {
//       try {
//         player.ws.send(JSON.stringify(message));
//       } catch (error) {
//         console.error(`Error sending message to player ${player.id}:`, error);
//       }
//     }
//   });
// }

// Clean up disconnected players
setInterval(() => {
  const now = Date.now();
  Object.entries(players).forEach(([playerId, player]) => {
    // Remove players that haven't updated in 30 seconds
    if (now - player.lastUpdate > 30000) {
      console.log(`🧹 Cleaning up inactive player ${playerId}`);
      
      broadcastToOthers(playerId, {
        type: 'playerLeft',
        playerId: playerId
      });
      
      delete players[playerId];
    }
  });
}, 10000); // Check every 10 seconds

console.log(`🎮 WebSocket server listening on port ${PORT}`);
console.log(`🌐 WebSocket URL: ws://localhost:${PORT}`);
