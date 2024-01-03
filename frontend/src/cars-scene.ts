let carVelocity = 0;
let relevantCarAngle = 0;

export default class CarsScene extends Phaser.Scene {
  private car: Phaser.Physics.Matter.Image | undefined;
  private background: Phaser.GameObjects.Image | undefined;
  private keys: Phaser.Types.Input.Keyboard.CursorKeys | undefined;

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

    this.background = this.add.image(400, 400, "background");
    this.background.setScale(0.8)

    this.car = this.matter.add.image(345, 50, "car");

    this.car.setScale(0.09);
    this.car.setAngle(180);
    this.car.setVelocity(0, 0);

    this.keys?.space.on("up", () => {
      carVelocity *= 0.5;
    });
  }
  update() {
    // Rotation
    const turnModifier = this.keys?.space.isDown ? 32 : 24;

    if (this.keys?.left.isDown) {
      this.car?.setAngularVelocity(-turnModifier * (carVelocity / 1000));
    } else if (this.keys?.right.isDown) {
      this.car?.setAngularVelocity(turnModifier * (carVelocity / 1000));
    } else {
      this.car?.setAngularVelocity(0);
    }

    // Velocity
    if (!this.keys?.space.isDown && this.keys?.up.isDown && carVelocity <= 2.2) {
      carVelocity += 0.02;
    }
    if (
      !this.keys?.space.isDown &&
      this.keys?.down.isDown &&
      carVelocity >= -1.2
    ) {
      carVelocity -= 0.01;
    }
    // Handbrake logic
    if (!this.keys?.space.isDown) {
      relevantCarAngle = this.car?.angle ?? 0;
    } else {
      if (carVelocity >= 0) carVelocity -= 0.1;
      if (carVelocity <= 0) carVelocity += 0.1;
    }

    this.car?.setVelocity(carVelocity, 0);

    // Set X and Y Speed of Velocity
    this.car?.setVelocityX(
      carVelocity * Math.cos((relevantCarAngle - 90) * 0.01745)
    );
    this.car?.setVelocityY(
      carVelocity * Math.sin((relevantCarAngle - 90) * 0.01745)
    );
  }
}
