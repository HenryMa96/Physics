import { Joint } from "./joint.js";
import { Vector2 } from "./math.js";
import { Type } from "./rigidbody.js";
import { Settings } from "./settings.js";
import * as Util from "./util.js";
export class LineJoint extends Joint {
    constructor(bodyA, bodyB, anchorA = bodyA.position, anchorB = bodyB.position, dir, frequency = 20000, dampingRatio = 1.0, mass = 10000) {
        super(bodyA, bodyB);
        this.impulseSum = 0.0;
        if (bodyA.type == Type.Static && bodyB.type == Type.Static)
            throw "Can't make line constraint between static bodies";
        if (bodyB.type == Type.Static)
            throw "Please make line constraint by using the bodyA as a static body";
        this.localAnchorA = this.bodyA.globalToLocal.mulVector2(anchorA, 1);
        this.localAnchorB = this.bodyB.globalToLocal.mulVector2(anchorB, 1);
        let u = anchorB.sub(anchorA);
        this.t = new Vector2(-u.y, u.x).normalized();
        if (dir == undefined) {
            let u = anchorB.sub(anchorA);
            this.t = new Vector2(-u.y, u.x).normalized();
        }
        else {
            this.t = new Vector2(-dir.y, dir.x).normalized();
        }
        if (mass <= 0)
            mass = bodyB.mass;
        if (frequency <= 0)
            frequency = 0.01;
        dampingRatio = Util.clamp(dampingRatio, 0.0, 1.0);
        let omega = 2 * Math.PI * frequency;
        let d = 2 * mass * dampingRatio * omega; // Damping coefficient
        let k = mass * omega * omega; // Spring constant
        let h = Settings.dt;
        this.beta = h * k / (d + h * k);
        this.gamma = 1 / ((d + h * k) * h);
    }
    prepare() {
        // Calculate Jacobian J and effective mass M
        // J = [-t^t, -(ra + u)×t, t^t, rb×t]
        // M = (J · M^-1 · J^t)^-1
        this.ra = this.bodyA.localToGlobal.mulVector2(this.localAnchorA, 0);
        this.rb = this.bodyB.localToGlobal.mulVector2(this.localAnchorB, 0);
        let pa = this.bodyA.position.add(this.ra);
        let pb = this.bodyB.position.add(this.rb);
        this.u = pb.sub(pa).normalized();
        let k = this.bodyB.inverseMass + this.rb.cross(this.t) * this.bodyB.inverseInertia
            - (this.bodyA.inverseMass + this.ra.add(this.u).cross(this.t) * this.bodyA.inverseInertia)
            + this.gamma;
        this.m = 1.0 / k;
        let error = this.u.dot(this.t);
        if (Settings.positionCorrection)
            this.bias = error * this.beta * Settings.inv_dt;
        else
            this.bias = 0.0;
        if (Settings.warmStarting)
            this.applyImpulse(this.impulseSum);
    }
    solve() {
        // Calculate corrective impulse: Pc
        // Pc = J^t · λ (λ: lagrangian multiplier)
        // λ = (J · M^-1 · J^t)^-1 ⋅ -(J·v+b)
        let jv = this.t.dot(this.bodyB.linearVelocity) + this.rb.cross(this.t) * this.bodyB.angularVelocity
            - (this.t.dot(this.bodyA.linearVelocity) + this.rb.add(this.u).cross(this.t) * this.bodyA.angularVelocity);
        let lambda = this.m * -(jv + this.bias + this.impulseSum * this.gamma);
        this.applyImpulse(lambda);
        if (Settings.warmStarting)
            this.impulseSum += lambda;
    }
    applyImpulse(lambda) {
        // V2 = V2' + M^-1 ⋅ Pc
        // Pc = J^t ⋅ λ
        this.bodyA.linearVelocity = this.bodyA.linearVelocity.sub(this.t.mul(lambda * this.bodyA.inverseMass));
        this.bodyA.angularVelocity = this.bodyA.angularVelocity - this.ra.add(this.u).cross(this.t) * this.bodyA.inverseInertia;
        this.bodyB.linearVelocity = this.bodyB.linearVelocity.add(this.t.mul(lambda * this.bodyB.inverseMass));
        this.bodyB.angularVelocity = this.bodyB.angularVelocity + this.rb.cross(this.t) * this.bodyB.inverseInertia;
    }
}