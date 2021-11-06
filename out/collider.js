import { Entity } from "./entity.js";
import { Vector2 } from "./math.js";
import * as Util from "./util.js";
export var Shape;
(function (Shape) {
    Shape[Shape["Circle"] = 0] = "Circle";
    Shape[Shape["Polygon"] = 1] = "Polygon";
})(Shape || (Shape = {}));
export var Type;
(function (Type) {
    Type[Type["Ground"] = 0] = "Ground";
    Type[Type["Normal"] = 1] = "Normal";
})(Type || (Type = {}));
// Rigid body collider
export class Collider extends Entity {
    constructor(shape, type) {
        super();
        this.shape = shape;
        this._linearVelocity = new Vector2(0, 0);
        this._angularVelocity = 0;
        this._friction = 1.0;
        this._beta = 0.5;
        this._restitution = 0.7;
        this.type = type;
        if (this.type == Type.Ground) {
            this.mass = Number.MAX_VALUE;
            this.inertia = Number.MAX_VALUE;
        }
    }
    get mass() {
        return this._mass;
    }
    set mass(m) {
        this._mass = Util.clamp(m, 0, Number.MAX_VALUE);
        this._invMass = this._mass == 0 ? 0 : 1.0 / this._mass;
    }
    get inverseMass() {
        return this._invMass;
    }
    get inertia() {
        return this._inertia;
    }
    set inertia(i) {
        this._inertia = Util.clamp(i, 0, Number.MAX_VALUE);
        this._invInertia = this._inertia == 0 ? 0 : 1.0 / i;
    }
    get inverseInertia() {
        return this._invInertia;
    }
    get centerOfMass() {
        return this._cm;
    }
    set centerOfMass(cm) {
        this._cm = cm;
    }
    get friction() {
        return this._friction;
    }
    set friction(f) {
        this._friction = Util.clamp(f, 0, 1);
    }
    get contactBeta() {
        return this._beta;
    }
    set contactBeta(b) {
        this._beta = Util.clamp(b, 0, 1);
    }
    get restitution() {
        return this._restitution;
    }
    set restitution(r) {
        this._restitution = Util.clamp(r, 0, 1);
    }
    get linearVelocity() {
        return this._linearVelocity;
    }
    set linearVelocity(v) {
        this._linearVelocity.x = v.x;
        this._linearVelocity.y = v.y;
    }
    get angularVelocity() {
        return this._angularVelocity;
    }
    set angularVelocity(w) {
        this._angularVelocity = w;
    }
    update(delta) {
        this._position.x += this._linearVelocity.x * delta;
        this._position.y += this._linearVelocity.y * delta;
        this._rotation += this._angularVelocity * delta;
    }
    addVelocity(vt) {
        this._linearVelocity.x += vt.x;
        this._linearVelocity.y += vt.y;
    }
    addAngularVelocity(wt) {
        this._angularVelocity += wt;
    }
}
