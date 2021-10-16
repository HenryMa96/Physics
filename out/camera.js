import { Matrix3, Vector2 } from "./math.js";
export class Camera {
    constructor() {
        this._translation = new Vector2(0, 0);
        this._rotation = 0;
        this._scale = new Vector2(1, 1);
    }
    translate(t) {
        this._translation.x += t.x;
        this._translation.y += t.y;
    }
    rotate(r) {
        this._rotation += r;
    }
    scale(s) {
        this._scale.x *= s.x;
        this._scale.y *= s.y;
    }
    getTransform() {
        return new Matrix3().translate(this._translation.x, this._translation.y)
            .rotate(this._rotation)
            .scale(this._scale.x, this._scale.y);
    }
    getCameraTransform() {
        return new Matrix3().translate(-this._translation.x, -this._translation.y)
            .rotate(-this._rotation)
            .scale(this._scale.x, this._scale.y);
    }
}
