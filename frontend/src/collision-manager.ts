export interface CollisionArea {
  id: string;
  type: 'rectangle' | 'polygon';
  points: { x: number; y: number }[];
  name?: string;
}

export interface CollisionMapData {
  backgroundImage: string;
  backgroundScale: number;
  collisionAreas: CollisionArea[];
}

export class CollisionManager {
  private collisionAreas: CollisionArea[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Load collision data from JSON
   */
  loadCollisionMap(collisionData: CollisionMapData): void {
    this.collisionAreas = collisionData.collisionAreas;
  }

  /**
   * Check if a point is inside any collision area
   */
  isPointInCollisionArea(x: number, y: number): CollisionArea | null {
    for (const area of this.collisionAreas) {
      if (this.isPointInPolygon(x, y, area.points)) {
        return area;
      }
    }
    return null;
  }

  /**
   * Check if a circular object (like a car) overlaps with any collision area
   */
  isCircleInCollisionArea(x: number, y: number, radius: number): CollisionArea | null {
    for (const area of this.collisionAreas) {
      if (this.isCircleInPolygon(x, y, radius, area.points)) {
        return area;
      }
    }
    return null;
  }

  /**
   * Get all collision areas data
   */
  getCollisionAreas(): CollisionArea[] {
    return this.collisionAreas;
  }

  /**
   * Clear all collision areas
   */
  clearCollisionAreas(): void {
    this.collisionAreas = [];
  }

  /**
   * Point-in-polygon test using ray casting algorithm
   */
  private isPointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  /**
   * Check if a circle overlaps with a polygon
   */
  private isCircleInPolygon(cx: number, cy: number, radius: number, polygon: { x: number; y: number }[]): boolean {
    // Check if center is inside polygon
    if (this.isPointInPolygon(cx, cy, polygon)) {
      return true;
    }

    // Check if circle intersects any edge of the polygon
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      const p1 = polygon[i];
      const p2 = polygon[j];
      
      const distance = this.distancePointToLineSegment(cx, cy, p1.x, p1.y, p2.x, p2.y);
      if (distance <= radius) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate distance from a point to a line segment
   */
  private distancePointToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      // Line segment is actually a point
      return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }
    
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    const projection = {
      x: x1 + t * dx,
      y: y1 + t * dy
    };
    
    return Math.sqrt((px - projection.x) * (px - projection.x) + (py - projection.y) * (py - projection.y));
  }

  /**
   * Get detailed collision information including penetration depth and normal
   */
  getCollisionInfo(cx: number, cy: number, radius: number): { area: CollisionArea; penetration: number; normal: { x: number; y: number } } | null {
    for (const area of this.collisionAreas) {
      if (this.isCircleInPolygon(cx, cy, radius, area.points)) {
        // Calculate the closest point on the polygon to the circle center
        let closestDistance = Infinity;
        let closestPoint = { x: 0, y: 0 };
        
        for (let i = 0; i < area.points.length; i++) {
          const j = (i + 1) % area.points.length;
          const p1 = area.points[i];
          const p2 = area.points[j];
          
          const distance = this.distancePointToLineSegment(cx, cy, p1.x, p1.y, p2.x, p2.y);
          if (distance < closestDistance) {
            closestDistance = distance;
            // Calculate closest point on line segment
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lengthSquared = dx * dx + dy * dy;
            const t = Math.max(0, Math.min(1, ((cx - p1.x) * dx + (cy - p1.y) * dy) / lengthSquared));
            closestPoint = {
              x: p1.x + t * dx,
              y: p1.y + t * dy
            };
          }
        }
        
        // Calculate penetration depth and normal
        const penetration = Math.max(0, radius - closestDistance);
        const normalLength = Math.sqrt((cx - closestPoint.x) ** 2 + (cy - closestPoint.y) ** 2);
        const normal = normalLength > 0 ? {
          x: (cx - closestPoint.x) / normalLength,
          y: (cy - closestPoint.y) / normalLength
        } : { x: 0, y: -1 };
        
        return { area, penetration, normal };
      }
    }
    return null;
  }

  /**
   * Debug visualization - draw collision areas
   */
  drawDebug(graphics: Phaser.GameObjects.Graphics): void {
    graphics.clear();
    
    this.collisionAreas.forEach((area, index) => {
      const hue = (index * 60) % 360;
      const color = Phaser.Display.Color.HSVToRGB(hue / 360, 0.8, 0.8).color;
      
      graphics.lineStyle(2, color, 0.8);
      graphics.fillStyle(color, 0.2);

      if (area.points.length > 0) {
        graphics.beginPath();
        graphics.moveTo(area.points[0].x, area.points[0].y);
        
        for (let i = 1; i < area.points.length; i++) {
          graphics.lineTo(area.points[i].x, area.points[i].y);
        }
        
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
      }
    });
  }
}
