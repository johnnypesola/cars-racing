let carVelocity = 0;

export default class CarsScene extends Phaser.Scene {
  private car: Phaser.Physics.Matter.Image | undefined;
  private car2: Phaser.Physics.Matter.Image | undefined;
  private background: Phaser.GameObjects.Image | undefined;
  private keys: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private graphics: Phaser.GameObjects.Graphics | undefined;
  private skidmarks: [Phaser.Curves.Path[]] | undefined;

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

    this.keys?.space.on("down", () => {
      const { left, right } = this.getCarTiresPos();
      const leftTirePath = new Phaser.Curves.Path(left.x, left.y);
      const rightTirePath = new Phaser.Curves.Path(right.x, right.y);
      if (!this.skidmarks) this.skidmarks = [[]];
      this.skidmarks?.push([leftTirePath, rightTirePath]);
    });

    this.keys?.space.on("up", () => {
      carVelocity *= 0.4;
    });

    this.car?.setOnCollide((e) => {
      const vel = this.car?.getVelocity();
      carVelocity = Math.max(vel?.x ?? 0, vel?.y ?? 0) / 2;
    });
  }
  update() {
    // Rotation
    const turnModifier = this.keys?.space.isDown ? 72 : 46;
    if (carVelocity > 0.2 || carVelocity < -0.1) {
      if (this.keys?.left.isDown) {
        this.car?.setAngularVelocity(-turnModifier * 0.001);
      } else if (this.keys?.right.isDown) {
        this.car?.setAngularVelocity(turnModifier * 0.001);
      } else {
        this.car?.setAngularVelocity(0);
      }
    }

    // Velocity
    if (this.keys?.up.isDown) {
      if (this.keys.space.isDown) {
        this.car?.thrust(0.00015);
      } else if (carVelocity <= 3) {
        carVelocity += 0.02;
      }
    } else if (this.keys?.down.isDown) {
      if (carVelocity >= -1) {
        carVelocity -= 0.02;
      }
    } else if (this.keys?.space.isDown) {
      if (carVelocity !== 0) {
        // carVelocity *= 0.8;
      }
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

    // Set X and Y Speed of Velocity
    const angle = this.car?.angle ?? 0;

    if (!this.keys?.space.isDown) {
      this.car?.setVelocityX(carVelocity * Math.cos(angle * 0.01745));
      this.car?.setVelocityY(carVelocity * Math.sin(angle * 0.01745));
    }
    const color = Phaser.Display.Color.GetColor(0, 0, 0);
    this.graphics?.clear();
    this.graphics?.lineStyle(2, color, 0.2);

    if (this.graphics) {
      this.skidmarks?.forEach((paths) => {
        paths[0]?.draw(this.graphics!)
        paths[1]?.draw(this.graphics!)
      });
    }
  }
}
