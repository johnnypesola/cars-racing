import { CollisionManager } from './collision-manager';
import { MultiplayerManager } from './multiplayer-manager';

export default class CarsScene extends Phaser.Scene {
  private car: Phaser.Physics.Matter.Image | undefined;
  private car2: Phaser.Physics.Matter.Image | undefined;
  private background: Phaser.GameObjects.Image | undefined;
  private keys: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private graphics: Phaser.GameObjects.Graphics | undefined;
  private skidmarks: [Phaser.Curves.Path[]] | undefined;
  private collisionManager: CollisionManager | undefined;
  private collisionGraphics: Phaser.GameObjects.Graphics | undefined;
  private showDebug = false;
  private lastCollisionArea: string | null = null;
  private wasInCollision = false;
  private multiplayerManager: MultiplayerManager | undefined;
  private connectionStatusText: Phaser.GameObjects.Text | undefined;
  private playerCountText: Phaser.GameObjects.Text | undefined;

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

  getCollisionAreaCenter(area: any) {
    const centerX = area.points.reduce((sum: number, p: any) => sum + p.x, 0) / area.points.length;
    const centerY = area.points.reduce((sum: number, p: any) => sum + p.y, 0) / area.points.length;
    return { x: centerX, y: centerY };
  }

  calculatePushDirection(carX: number, carY: number, collisionCenter: { x: number, y: number }) {
    // Calculate direction vector from collision center to car
    const dx = carX - collisionCenter.x;
    const dy = carY - collisionCenter.y;
    
    // Normalize the direction vector
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) {
      // If car is exactly at center, push in random direction
      return { x: Math.random() - 0.5, y: Math.random() - 0.5 };
    }
    
    return {
      x: dx / distance,
      y: dy / distance
    };
  }

  /**
   * Calculate the collision surface normal for proper reflection
   */
  getCollisionNormal(carX: number, carY: number, collisionArea: any): { x: number; y: number } {
    const areaPoints = collisionArea.points;
    let closestDistance = Infinity;
    let surfaceNormal = { x: 0, y: -1 }; // Default upward normal
    
    // Find the closest edge to determine the surface normal
    for (let i = 0; i < areaPoints.length; i++) {
      const j = (i + 1) % areaPoints.length;
      const p1 = areaPoints[i];
      const p2 = areaPoints[j];
      
      // Calculate distance from car to this edge
      const distance = this.distancePointToLineSegment(carX, carY, p1.x, p1.y, p2.x, p2.y);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        
        // Calculate edge vector
        const edgeX = p2.x - p1.x;
        const edgeY = p2.y - p1.y;
        const edgeLength = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
        
        if (edgeLength > 0) {
          // Normal is perpendicular to edge
          const normalX = -edgeY / edgeLength;
          const normalY = edgeX / edgeLength;
          
          // Determine which direction the normal should point (outward from polygon)
          const areaCenterX = areaPoints.reduce((sum: number, p: any) => sum + p.x, 0) / areaPoints.length;
          const areaCenterY = areaPoints.reduce((sum: number, p: any) => sum + p.y, 0) / areaPoints.length;
          
          // Vector from area center to car
          const toCenterX = carX - areaCenterX;
          const toCenterY = carY - areaCenterY;
          
          // If normal points toward car, use it; otherwise flip it
          if (normalX * toCenterX + normalY * toCenterY > 0) {
            surfaceNormal = { x: normalX, y: normalY };
          } else {
            surfaceNormal = { x: -normalX, y: -normalY };
          }
        }
      }
    }
    
    return surfaceNormal;
  }

  /**
   * Calculate distance from point to line segment
   */
  distancePointToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }
    
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    const projectionX = x1 + t * dx;
    const projectionY = y1 + t * dy;
    
    return Math.sqrt((px - projectionX) * (px - projectionX) + (py - projectionY) * (py - projectionY));
  }

  /**
   * Reflect velocity vector against surface normal
   */
  reflectVelocity(velX: number, velY: number, normalX: number, normalY: number): { x: number; y: number } {
    // Formula: reflected = velocity - 2 * (velocity · normal) * normal
    const dotProduct = velX * normalX + velY * normalY;
    return {
      x: velX - 2 * dotProduct * normalX,
      y: velY - 2 * dotProduct * normalY
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

    // Initialize collision manager and graphics
    this.collisionManager = new CollisionManager(this);
    this.collisionGraphics = this.add.graphics();
    this.collisionGraphics.setDepth(10);

    // Load collision map data
    const collisionData = this.cache.json.get('collisionMap');
    if (collisionData) {
      this.collisionManager.loadCollisionMap(collisionData);
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
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // 50% transparent black background
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
    
    // Apply normal acceleration without timer blocking
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
    
    // Apply friction when no input (but don't override collision bounces)
    if (!this.keys?.up.isDown && !this.keys?.down.isDown && !this.wasInCollision) {
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

    // Collision detection with houses
    if (this.car && this.collisionManager) {
      const carX = this.car.x;
      const carY = this.car.y;
      const carRadius = 12; // Reduced hitbox width by 3 pixels on each side
      
      const collision = this.collisionManager.isCircleInCollisionArea(carX, carY, carRadius);
      
      if (collision && !this.wasInCollision) {
        // Car just entered a collision area - trigger bounce
        console.log(`Car hit ${collision.name || collision.id}`);
        
        // Get current car velocity to determine bounce direction
        const currentVel = this.car.getVelocity();
        const velX = currentVel?.x || 0;
        const velY = currentVel?.y || 0;
        const velMagnitude = Math.sqrt(velX * velX + velY * velY);
        
        if (velMagnitude > 0.5) { // Only bounce if moving with some speed
          // Calculate the surface normal of the collision
          const surfaceNormal = this.getCollisionNormal(carX, carY, collision);
          
          // Reflect the velocity against the surface normal
          const reflectedVel = this.reflectVelocity(velX, velY, surfaceNormal.x, surfaceNormal.y);
          
          // Apply reflected velocity with some energy loss (bounce dampening)
          const bounceFactor = 0.08; // Reduced from 0.25 to 0.08 (another 2/3 reduction)
          this.car.setVelocity(
            reflectedVel.x * bounceFactor,
            reflectedVel.y * bounceFactor
          );
          
          // Also reflect the forward velocity direction based on car's angle vs surface normal
          const carAngle = this.car.angle * (Math.PI / 180); // Convert to radians
          const carForwardX = Math.cos(carAngle);
          const carForwardY = Math.sin(carAngle);
          
          // Calculate how much the car's forward direction aligns with the surface normal
          const forwardDotNormal = carForwardX * surfaceNormal.x + carForwardY * surfaceNormal.y;
          
          // Also reduce the car's momentum based on impact angle
          const impactStrength = Math.abs(forwardDotNormal);
          
          // Apply counter-thrust to reduce forward momentum (reduced strength)
          const counterThrustStrength = impactStrength * 0.002; // Reduced from 0.007 to 0.002
          this.car?.thrust(-counterThrustStrength);
          
          // Small push along surface normal to prevent getting stuck (reduced)
          const pushAmount = 1; // Reduced from 2 to 1
          this.car.setPosition(
            carX + surfaceNormal.x * pushAmount,
            carY + surfaceNormal.y * pushAmount
          );
        } else {
          // Even if moving slowly, apply strong friction to stop momentum
          const currentVel = this.car.getVelocity();
          this.car?.setVelocity((currentVel?.x || 0) * 0.3, (currentVel?.y || 0) * 0.3);
        }
        
        this.wasInCollision = true;
        this.lastCollisionArea = collision.id;
      } else if (!collision && this.wasInCollision) {
        // Car left collision area
        this.wasInCollision = false;
        this.lastCollisionArea = null;
      }
    }

    // Debug visualization
    if (this.showDebug && this.collisionManager && this.collisionGraphics) {
      this.collisionManager.drawDebug(this.collisionGraphics);
    } else if (this.collisionGraphics) {
      this.collisionGraphics.clear();
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

    // Send collision events
    if (this.wasInCollision && this.lastCollisionArea) {
      this.multiplayerManager.sendCollision({
        areaId: this.lastCollisionArea,
        position: { x: this.car.x, y: this.car.y }
      });
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
}
