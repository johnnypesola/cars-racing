export interface CollisionArea {
  id: string;
  type: 'rectangle' | 'polygon';
  points: { x: number; y: number }[];
  name?: string;
}

export default class CollisionMapperScene extends Phaser.Scene {
  private background: Phaser.GameObjects.Image | undefined;
  private graphics: Phaser.GameObjects.Graphics | undefined;
  private collisionAreas: CollisionArea[] = [];
  private currentArea: CollisionArea | null = null;
  private isDrawing = false;
  private drawingMode: 'rectangle' | 'polygon' = 'rectangle';
  private startPoint: { x: number; y: number } | null = null;
  private instructions: Phaser.GameObjects.Text | undefined;
  private modeText: Phaser.GameObjects.Text | undefined;
  private areasList: Phaser.GameObjects.Text | undefined;
  private exportButton: Phaser.GameObjects.Rectangle | undefined;
  private clearButton: Phaser.GameObjects.Rectangle | undefined;
  private toggleModeButton: Phaser.GameObjects.Rectangle | undefined;

  constructor() {
    super({ key: 'CollisionMapper' });
  }

  preload() {
    this.load.image("background", "assets/sprites/background1.png");
  }

  create() {
    // Add background - positioned same as in game mode
    this.background = this.add.image(400, 400, "background");
    this.background.setScale(0.8);
    this.background.setInteractive();

    // Create graphics for drawing collision areas
    this.graphics = this.add.graphics();
    this.graphics.setDepth(1);

    // Add instructions
    this.instructions = this.add.text(10, 10, 
      'Click and drag to create rectangles\nClick multiple points for polygons\nRight-click to finish polygon',
      { 
        fontSize: '14px', 
        color: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // 50% transparent black background
        padding: { x: 5, y: 5 }
      }
    );

    // Mode indicator
    this.modeText = this.add.text(10, 80, `Mode: ${this.drawingMode}`, {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // 50% transparent black background
      padding: { x: 5, y: 5 }
    });

    // Areas list
    this.areasList = this.add.text(10, 120, 'Collision Areas: 0', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.5)', // 50% transparent black background
      padding: { x: 5, y: 5 }
    });

    // Create UI buttons
    this.createUIButtons();

    // Set up input handlers
    this.setupInputHandlers();

    this.updateDisplay();
  }

  private createUIButtons() {
    const buttonY = this.game.config.height as number - 60;

    // Toggle mode button
    this.toggleModeButton = this.add.rectangle(100, buttonY, 120, 40, 0x4CAF50);
    this.toggleModeButton.setInteractive();
    this.toggleModeButton.setStrokeStyle(2, 0xffffff);
    const toggleText = this.add.text(100, buttonY, 'Toggle Mode', { 
      fontSize: '12px', 
      color: '#ffffff'
    });
    toggleText.setOrigin(0.5, 0.5);

    // Clear button
    this.clearButton = this.add.rectangle(250, buttonY, 80, 40, 0xf44336);
    this.clearButton.setInteractive();
    this.clearButton.setStrokeStyle(2, 0xffffff);
    const clearText = this.add.text(250, buttonY, 'Clear All', { 
      fontSize: '12px', 
      color: '#ffffff'
    });
    clearText.setOrigin(0.5, 0.5);

    // Export button
    this.exportButton = this.add.rectangle(350, buttonY, 100, 40, 0x2196F3);
    this.exportButton.setInteractive();
    this.exportButton.setStrokeStyle(2, 0xffffff);
    const exportText = this.add.text(350, buttonY, 'Export JSON', { 
      fontSize: '12px', 
      color: '#ffffff'
    });
    exportText.setOrigin(0.5, 0.5);

    // Button event handlers
    this.toggleModeButton.on('pointerdown', () => {
      this.drawingMode = this.drawingMode === 'rectangle' ? 'polygon' : 'rectangle';
      this.modeText!.setText(`Mode: ${this.drawingMode}`);
      this.finishCurrentArea();
    });

    this.clearButton.on('pointerdown', () => {
      this.collisionAreas = [];
      this.currentArea = null;
      this.isDrawing = false;
      this.updateDisplay();
    });

    this.exportButton.on('pointerdown', () => {
      this.exportCollisionData();
    });
  }

  private setupInputHandlers() {
    // Left click handlers
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        // Right click - finish polygon
        if (this.drawingMode === 'polygon' && this.currentArea) {
          this.finishCurrentArea();
        }
        return;
      }

      // Skip if clicking on UI buttons
      if (pointer.y > (this.game.config.height as number) - 80) return;

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      
      if (this.drawingMode === 'rectangle') {
        this.startRectangle(worldPoint.x, worldPoint.y);
      } else {
        this.addPolygonPoint(worldPoint.x, worldPoint.y);
      }
    });

    // Mouse move for rectangle preview
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDrawing && this.drawingMode === 'rectangle' && this.startPoint) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.updateRectanglePreview(worldPoint.x, worldPoint.y);
      }
    });

    // Mouse up for rectangle
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isDrawing && this.drawingMode === 'rectangle') {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.finishRectangle(worldPoint.x, worldPoint.y);
      }
    });
  }

  private startRectangle(x: number, y: number) {
    this.startPoint = { x, y };
    this.isDrawing = true;
    this.currentArea = {
      id: `rect_${Date.now()}`,
      type: 'rectangle',
      points: [{ x, y }]
    };
  }

  private updateRectanglePreview(x: number, y: number) {
    if (!this.startPoint || !this.currentArea) return;

    this.currentArea.points = [
      this.startPoint,
      { x: this.startPoint.x, y },
      { x, y },
      { x, y: this.startPoint.y }
    ];

    this.updateDisplay();
  }

  private finishRectangle(x: number, y: number) {
    if (!this.startPoint || !this.currentArea) return;

    this.currentArea.points = [
      this.startPoint,
      { x: this.startPoint.x, y },
      { x, y },
      { x, y: this.startPoint.y }
    ];

    this.collisionAreas.push(this.currentArea);
    this.currentArea = null;
    this.isDrawing = false;
    this.startPoint = null;
    this.updateDisplay();
  }

  private addPolygonPoint(x: number, y: number) {
    if (!this.currentArea) {
      this.currentArea = {
        id: `poly_${Date.now()}`,
        type: 'polygon',
        points: []
      };
    }

    this.currentArea.points.push({ x, y });
    this.updateDisplay();
  }

  private finishCurrentArea() {
    if (this.currentArea && this.currentArea.points.length > 2) {
      this.collisionAreas.push(this.currentArea);
    }
    this.currentArea = null;
    this.isDrawing = false;
    this.startPoint = null;
    this.updateDisplay();
  }

  private updateDisplay() {
    this.graphics!.clear();

    // Draw completed collision areas
    this.collisionAreas.forEach((area, index) => {
      const hue = (index * 60) % 360;
      const colorValue = Phaser.Display.Color.HSVToRGB(hue / 360, 0.8, 0.8).color;
      
      this.graphics!.lineStyle(2, colorValue, 0.8);
      this.graphics!.fillStyle(colorValue, 0.2);

      if (area.points.length > 0) {
        this.graphics!.beginPath();
        this.graphics!.moveTo(area.points[0].x, area.points[0].y);
        
        for (let i = 1; i < area.points.length; i++) {
          this.graphics!.lineTo(area.points[i].x, area.points[i].y);
        }
        
        this.graphics!.closePath();
        this.graphics!.fillPath();
        this.graphics!.strokePath();

        // Add label
        const centerX = area.points.reduce((sum, p) => sum + p.x, 0) / area.points.length;
        const centerY = area.points.reduce((sum, p) => sum + p.y, 0) / area.points.length;
        
        const labelText = this.add.text(centerX, centerY, `${index + 1}`, {
          fontSize: '12px',
          color: '#ffffff',
          backgroundColor: 'rgba(0, 0, 0, 0.5)', // 50% transparent black background
          padding: { x: 2, y: 2 }
        });
        labelText.setOrigin(0.5, 0.5);
      }
    });

    // Draw current area being created
    if (this.currentArea && this.currentArea.points.length > 0) {
      this.graphics!.lineStyle(2, 0x00ff00, 1);
      this.graphics!.fillStyle(0x00ff00, 0.1);

      this.graphics!.beginPath();
      this.graphics!.moveTo(this.currentArea.points[0].x, this.currentArea.points[0].y);
      
      for (let i = 1; i < this.currentArea.points.length; i++) {
        this.graphics!.lineTo(this.currentArea.points[i].x, this.currentArea.points[i].y);
      }
      
      if (this.currentArea.type === 'rectangle' && this.currentArea.points.length === 4) {
        this.graphics!.closePath();
        this.graphics!.fillPath();
      }
      
      this.graphics!.strokePath();

      // Draw points
      this.currentArea.points.forEach(point => {
        this.graphics!.fillStyle(0xff0000, 1);
        this.graphics!.fillCircle(point.x, point.y, 3);
      });
    }

    // Update areas list
    this.areasList!.setText(`Collision Areas: ${this.collisionAreas.length}`);
  }

  private exportCollisionData() {
    const data = {
      backgroundImage: 'background1.png',
      backgroundScale: 0.8,
      collisionAreas: this.collisionAreas.map((area, index) => ({
        ...area,
        name: area.name || `Area ${index + 1}`
      }))
    };

    const dataStr = JSON.stringify(data, null, 2);
    
    // Create a blob and download link
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'collision-map.json';
    link.click();
    
    URL.revokeObjectURL(url);

    console.log('Collision map exported:', data);
    
    // Also log to console for easy copying
    console.log('Collision data (copy this):', dataStr);
  }

  update() {
    // Update instructions based on current mode
    if (this.drawingMode === 'rectangle') {
      this.instructions!.setText(
        'RECTANGLE MODE:\nClick and drag to create rectangles\nUse Toggle Mode to switch to polygon mode'
      );
    } else {
      this.instructions!.setText(
        'POLYGON MODE:\nClick points to create polygon\nRight-click to finish polygon\nUse Toggle Mode to switch to rectangle mode'
      );
    }
  }
}
