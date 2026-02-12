import { MultiplayerManager } from './multiplayer-manager';

export default class CarsScene extends Phaser.Scene {
  private car: Phaser.Physics.Matter.Image | undefined;
  private car2: Phaser.Physics.Matter.Image | undefined;
  private background: Phaser.GameObjects.Image | undefined;
  private keys: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private graphics: Phaser.GameObjects.Graphics | undefined;
  private skidmarks: [Phaser.Curves.Path[]] | undefined;
  private showDebug = false;
  private multiplayerManager: MultiplayerManager | undefined;
  private connectionStatusText: Phaser.GameObjects.Text | undefined;
  private playerCountText: Phaser.GameObjects.Text | undefined;
  private obstaclePhysicsBodies: MatterJS.BodyType[] = [];
  private obstacleGraphics: Phaser.GameObjects.Graphics[] = [];

  getCarTiresPos() {
    const offset = 5;
    const angle = this.car!.angle;

    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const leftX = this.car!.x + cos * -offset - sin * offset;
    const leftY = this.car!.y + sin * -offset + cos * offset;

    const rightX = this.car!.x + cos * -offset + sin * offset;
    const rightY = this.car!.y + sin * -offset - cos * offset;

    return {
      right: { x: leftX, y: leftY },
      left: { x: rightX, y: rightY },
    };
  }

  preload() {
    this.load.image("car", "assets/sprites/white-car.png");
    this.load.image("background", "assets/sprites/background1.png");
    this.load.json("collisionMap", "assets/collision-map.json");
  }

  create() {
    this.matter.world.setBounds(
      0,
      0,
      this.game.config.width as number,
      this.game.config.height as number
    );

    this.keys = this.input?.keyboard?.createCursorKeys();

    this.graphics = this.add.graphics();
    this.graphics.setDepth(1);

    // Initialize multiplayer
    this.multiplayerManager = new MultiplayerManager(this);
    
    // Try to connect to multiplayer server
    this.multiplayerManager.connect().then(() => {
      console.log('✅ Connected to multiplayer!');
    }).catch((error) => {
      console.log('❌ Multiplayer connection failed:', error.message);
    });

    // Create physics bodies for obstacles from collision map data
    const collisionData = this.cache.json.get('collisionMap');
    if (collisionData) {
      this.createPhysicsObstacles(collisionData);
    }

    this.background = this.add.image(400, 400, "background");
    this.background.setScale(0.8);

    this.car = this.matter.add.image(345, 50, "car", undefined);
    this.car.setDepth(2);

    this.car2 = this.matter.add.image(245, 50, "car", undefined);

    this.car.setScale(0.09);
    this.car.setBounce(0);
    this.car.setAngle(90);
    this.car.setFriction(1);
    this.car.setFrictionAir(0.04);

    this.car2.setScale(0.09);
    this.car2.setBounce(0);
    this.car2.setMass(50);

    // Add debug key for collision visualization
    const debugKey = this.input?.keyboard?.addKey('D');
    debugKey?.on('down', () => {
      this.showDebug = !this.showDebug;
    });

    // Add instruction text
    this.add.text(10, 10, 'Press D to toggle collision debug view', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: { x: 3, y: 3 }
    });

    // Add multiplayer status indicators
    this.connectionStatusText = this.add.text(10, 30, 'Multiplayer: Connecting...', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: { x: 3, y: 3 }
    });

    this.playerCountText = this.add.text(10, 50, 'Players: 1', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: { x: 3, y: 3 }
    });

    this.keys?.space.on("down", () => {
      const { left, right } = this.getCarTiresPos();
      const leftTirePath = new Phaser.Curves.Path(left.x, left.y);
      const rightTirePath = new Phaser.Curves.Path(right.x, right.y);
      if (!this.skidmarks) this.skidmarks = [[]];
      this.skidmarks?.push([leftTirePath, rightTirePath]);
    });

    this.keys?.space.on("up", () => {
      // Apply friction when handbrake is released
      const currentVel = this.car?.getVelocity();
      this.car?.setVelocity((currentVel?.x || 0) * 0.6, (currentVel?.y || 0) * 0.6);
    });

    this.car?.setOnCollide((e) => {
      // Handle general collisions if needed
    });
  }
  update(time: number, delta: number) {
    // Rotation - only allow turning when moving
    const currentVel = this.car?.getVelocity();
    const currentSpeed = Math.sqrt((currentVel?.x || 0) ** 2 + (currentVel?.y || 0) ** 2);
    const turnModifier = this.keys?.space.isDown ? 72 : 46;
    const minSpeedForTurning = 1.0;

    // Acceleration/Deceleration using proper directional forces
    const carAngle = (this.car?.angle ?? 0) * (Math.PI / 180); // Convert to radians
    const forwardX = Math.cos(carAngle);
    const forwardY = Math.sin(carAngle);
    
    // Calculate how much the car is already moving in its forward direction
    const currentVelX = currentVel?.x || 0;
    const currentVelY = currentVel?.y || 0;
    const forwardVelocity = currentVelX * forwardX + currentVelY * forwardY; // Dot product
    
    // Determine steering direction based on movement direction
    const isMovingBackward = forwardVelocity < -0.3; // Moving backward if negative velocity > threshold
    
    if (currentSpeed > minSpeedForTurning) {
      if (this.keys?.left.isDown) {
        // Mirror steering when moving backward
        const steerDirection = isMovingBackward ? 1 : -1;
        this.car?.setAngularVelocity(steerDirection * turnModifier * 0.001 * (delta / 20));
      } else if (this.keys?.right.isDown) {
        // Mirror steering when moving backward
        const steerDirection = isMovingBackward ? -1 : 1;
        this.car?.setAngularVelocity(steerDirection * turnModifier * 0.001 * (delta / 20));
      } else {
        this.car?.setAngularVelocity(0);
      }
    } else {
      this.car?.setAngularVelocity(0);
    }
    
    const forceStrength = 0.0002 * (delta / 20); // Ultra sluggish! Reduced from 0.0004 to 0.0002 (50% reduction again)
    const maxSpeed = 2;
    
    // Apply normal acceleration
    if (this.keys?.up.isDown) {
      if (this.keys.space.isDown) {
        // Handbrake mode - same acceleration as normal (no speed boost)
        this.car?.thrust(forceStrength);
      } else if (Math.abs(forwardVelocity) < maxSpeed) {
        // Apply forward acceleration, accounting for current direction
        this.car?.thrust(forceStrength);
      }
    } else if (this.keys?.down.isDown) {
      // Reverse - apply backward force
      if (Math.abs(forwardVelocity) < maxSpeed) {
        this.car?.thrust(-forceStrength * 0.7);
      }
    }
    
    // Apply friction when no input
    if (!this.keys?.up.isDown && !this.keys?.down.isDown) {
      const friction = 0.95;
      this.car?.setVelocity((currentVel?.x || 0) * friction, (currentVel?.y || 0) * friction);
    }

    // Handbrake logic
    if (this.keys?.space.isDown) {
      if (this.skidmarks && this.game.getFrame() % 7 === 0) {
        const lastSkidmarkIndex = this.skidmarks.length - 1;
        const { left, right } = this.getCarTiresPos();
        const [leftTirePath, rightTirePath] = this.skidmarks[lastSkidmarkIndex];
        leftTirePath.lineTo(left.x, left.y);
        rightTirePath.lineTo(right.x, right.y);
      }
    }

    const color = Phaser.Display.Color.GetColor(0, 0, 0);
    this.graphics?.clear();
    this.graphics?.lineStyle(2, color, 0.2);

    if (this.graphics) {
      this.skidmarks?.forEach((paths) => {
        paths[0]?.draw(this.graphics!);
        paths[1]?.draw(this.graphics!);
      });
    }


    // Multiplayer updates
    this.updateMultiplayer();
  }

  /**
   * Handle multiplayer updates
   */
  private updateMultiplayer() {
    if (!this.multiplayerManager || !this.car) return;

    // Update connection status display
    const status = this.multiplayerManager.getConnectionStatus();
    const statusText = status === 'connected' ? '🟢 Connected' : 
                      status === 'connecting' ? '🟡 Connecting...' : '🔴 Offline';
    this.connectionStatusText?.setText(`Multiplayer: ${statusText}`);

    // Update player count
    const playerCount = this.multiplayerManager.getPlayerCount();
    this.playerCountText?.setText(`Players: ${playerCount}`);

    // Send player position to other players (throttled to ~20fps for network efficiency)
    if (status === 'connected' && this.game.getFrame() % 3 === 0) {
      const currentVel = this.car.getVelocity();
      this.multiplayerManager.sendPlayerUpdate(
        this.car.x,
        this.car.y,
        this.car.angle,
        currentVel?.x || 0,
        currentVel?.y || 0
      );
    }
    
  }

  /**
   * Clean up multiplayer when scene is destroyed
   */
  destroy() {
    if (this.multiplayerManager) {
      this.multiplayerManager.destroy();
    }
  }

  /**
   * Create physics bodies for obstacles from collision map data
   */
  private createPhysicsObstacles(collisionData: any): void {
    console.log('Creating physics obstacles from collision data...');
    
    if (!collisionData.collisionAreas) {
      console.warn('No collision areas found in collision data');
      return;
    }

    collisionData.collisionAreas.forEach((area: any, index: number) => {
      if (!area.points || area.points.length < 3) {
        console.warn(`Skipping area ${area.id} - insufficient points`);
        return;
      }

      try {
        // Calculate bounding box for the polygon
        const minX = Math.min(...area.points.map((p: any) => p.x));
        const maxX = Math.max(...area.points.map((p: any) => p.x));
        const minY = Math.min(...area.points.map((p: any) => p.y));
        const maxY = Math.max(...area.points.map((p: any) => p.y));
        
        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = minX + width / 2;
        const centerY = minY + height / 2;

        // Create a visible graphics object for the obstacle
        const obstacleGraphic = this.add.graphics();
        obstacleGraphic.fillStyle(0x8B4513, 0.7); // Brown color with transparency
        obstacleGraphic.lineStyle(2, 0x654321); // Darker brown border
        obstacleGraphic.fillRect(minX, minY, width, height);
        obstacleGraphic.strokeRect(minX, minY, width, height);
        obstacleGraphic.setDepth(1); // Behind car but above background

        // Store the graphics object for later updates
        this.obstacleGraphics.push(obstacleGraphic);

        // Create a physics body for the same area
        const obstacleBody = this.matter.add.rectangle(centerX, centerY, width, height, {
          isStatic: true,
          restitution: 0.8,  // Back to original moderate restitution
          friction: 0.3,     // Back to original friction
          frictionStatic: 0.5, // Back to original static friction
          label: `obstacle_${area.id}`
        });

        this.obstaclePhysicsBodies.push(obstacleBody);
        this.obstacleGraphics.push(obstacleGraphic);
        
        console.log(`Created physics obstacle: ${area.id} (${width}x${height})`);
      } catch (error) {
        console.error(`Failed to create physics body for area ${area.id}:`, error);
      }
    });

    // Set up collision events
    console.log(`Created ${this.obstaclePhysicsBodies.length} physics obstacles`);

    // Add obstacle count text
    this.add.text(10, 70, `Obstacles: ${this.obstaclePhysicsBodies.length}`, {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: { x: 3, y: 3 }
    });
  }
}
