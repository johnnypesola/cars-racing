export interface PlayerData {
  id: string;
  x: number;
  y: number;
  angle: number;
  velocityX?: number;
  velocityY?: number;
}

export interface MultiplayerMessage {
  type: 'init' | 'playerUpdate' | 'playerJoined' | 'playerLeft' | 'collision';
  playerId?: string;
  player?: PlayerData;
  allPlayers?: PlayerData[];
  x?: number;
  y?: number;
  angle?: number;
  velocityX?: number;
  velocityY?: number;
  collision?: any;
}

export class MultiplayerManager {
  private ws: WebSocket | null = null;
  private scene: Phaser.Scene;
  private localPlayerId: string | null = null;
  private remotePlayers: Map<string, Phaser.Physics.Matter.Image> = new Map();
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Connect to the multiplayer server
   */
  connect(serverUrl: string = 'ws://localhost:8080'): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.connectionStatus === 'connected' || this.connectionStatus === 'connecting') {
        resolve(true);
        return;
      }

      this.connectionStatus = 'connecting';
      console.log('🔌 Connecting to multiplayer server...');

      try {
        this.ws = new WebSocket(serverUrl);

        this.ws.onopen = () => {
          console.log('✅ Connected to multiplayer server!');
          this.connectionStatus = 'connected';
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: MultiplayerMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing server message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('🔌 Disconnected from multiplayer server');
          this.connectionStatus = 'disconnected';
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.connectionStatus = 'disconnected';
          reject(error);
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (this.connectionStatus === 'connecting') {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 5000);

      } catch (error) {
        this.connectionStatus = 'disconnected';
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect to the server
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect().catch(() => {
        this.reconnectDelay *= 2; // Exponential backoff
      });
    }, this.reconnectDelay);
  }

  /**
   * Handle incoming messages from the server
   */
  private handleMessage(message: MultiplayerMessage) {
    switch (message.type) {
      case 'init':
        this.localPlayerId = message.playerId!;
        console.log(`🎮 Assigned player ID: ${this.localPlayerId}`);
        
        // Add existing players to the scene
        if (message.allPlayers) {
          message.allPlayers.forEach(player => {
            if (player.id !== this.localPlayerId) {
              this.addRemotePlayer(player);
            }
          });
        }
        break;

      case 'playerJoined':
        if (message.player && message.player.id !== this.localPlayerId) {
          console.log(`👋 Player ${message.player.id} joined the game`);
          this.addRemotePlayer(message.player);
        }
        break;

      case 'playerLeft':
        if (message.playerId && message.playerId !== this.localPlayerId) {
          console.log(`👋 Player ${message.playerId} left the game`);
          this.removeRemotePlayer(message.playerId);
        }
        break;

      case 'playerUpdate':
        if (message.player && message.player.id !== this.localPlayerId) {
          this.updateRemotePlayer(message.player);
        }
        break;
    }
  }

  /**
   * Add a remote player to the scene
   */
  private addRemotePlayer(playerData: PlayerData) {
    if (this.remotePlayers.has(playerData.id)) {
      return; // Player already exists
    }

    // Create remote player car
    const remoteCar = this.scene.matter.add.image(
      playerData.x, 
      playerData.y, 
      'car'
    ) as Phaser.Physics.Matter.Image;

    remoteCar.setScale(0.09);
    remoteCar.setAngle(playerData.angle);
    remoteCar.setDepth(1); // Behind local player
    
    // Make it static so it doesn't interfere with physics
    remoteCar.setStatic(true);

    this.remotePlayers.set(playerData.id, remoteCar);
  }

  /**
   * Update a remote player's position
   */
  private updateRemotePlayer(playerData: PlayerData) {
    const remoteCar = this.remotePlayers.get(playerData.id);
    if (remoteCar) {
      // Smooth interpolation for better visual experience
      this.scene.tweens.add({
        targets: remoteCar,
        x: playerData.x,
        y: playerData.y,
        angle: playerData.angle,
        duration: 50, // Very short interpolation
        ease: 'Linear'
      });
    }
  }

  /**
   * Remove a remote player from the scene
   */
  private removeRemotePlayer(playerId: string) {
    const remoteCar = this.remotePlayers.get(playerId);
    if (remoteCar) {
      remoteCar.destroy();
      this.remotePlayers.delete(playerId);
    }
  }

  /**
   * Send player update to server
   */
  sendPlayerUpdate(x: number, y: number, angle: number, velocityX?: number, velocityY?: number) {
    if (this.ws && this.connectionStatus === 'connected') {
      const message: MultiplayerMessage = {
        type: 'playerUpdate',
        x,
        y,
        angle,
        velocityX,
        velocityY
      };

      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending player update:', error);
      }
    }
  }

  /**
   * Send collision event to server
   */
  sendCollision(collision: any) {
    if (this.ws && this.connectionStatus === 'connected') {
      const message: MultiplayerMessage = {
        type: 'collision',
        collision
      };

      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending collision event:', error);
      }
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): string {
    return this.connectionStatus;
  }

  /**
   * Get local player ID
   */
  getLocalPlayerId(): string | null {
    return this.localPlayerId;
  }

  /**
   * Get number of connected players
   */
  getPlayerCount(): number {
    return this.remotePlayers.size + (this.localPlayerId ? 1 : 0);
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionStatus = 'disconnected';
    this.localPlayerId = null;
    
    // Clean up remote players
    this.remotePlayers.forEach(remoteCar => remoteCar.destroy());
    this.remotePlayers.clear();
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.disconnect();
  }
}
