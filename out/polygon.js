import { Collider, Shape, Type } from "./collider.js";
import { Vector2 } from "./math.js";
import * as Util from "./util.js";
const MASS = 2; // kg
const W = 100; // cm
const H = 100; // cm
export class Polygon extends Collider {
    constructor(vertices, type = Type.Normal, resetPosition = true) {
        super(Shape.Polygon, type);
        this.vertices = vertices;
        if (this.type == Type.Normal) {
            this.mass = MASS;
            this.inertia = Util.calculateBoxInertia(W, H, MASS);
        }
        this.centerOfMass = new Vector2(0, 0);
        for (let i = 0; i < this.count; i++) {
            this.centerOfMass.x += this.vertices[i].x;
            this.centerOfMass.y += this.vertices[i].y;
        }
        this.centerOfMass.x /= this.count;
        this.centerOfMass.y /= this.count;
        for (let i = 0; i < this.count; i++) {
            this.vertices[i].x -= this.centerOfMass.x;
            this.vertices[i].y -= this.centerOfMass.y;
        }
        if (!resetPosition)
            this.translate(this.centerOfMass);
        this.centerOfMass.x = 0;
        this.centerOfMass.y = 0;
    }
    update(delta) {
        super.update(delta);
    }
    get count() {
        return this.vertices.length;
    }
    get globalVertices() {
        const transform = this.localToGlobal;
        let res = [];
        for (let i = 0; i < this.count; i++)
            res.push(transform.mulVector(this.vertices[i], 1));
        return res;
    }
}
