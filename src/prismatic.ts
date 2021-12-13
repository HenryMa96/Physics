import { Joint } from "./joint.js";
import { Matrix2, Vector2 } from "./math.js";
import { RigidBody, Type } from "./rigidbody.js";
import { Settings } from "./settings.js";
import * as Util from "./util.js";

// Line joint + Angle joint
export class PrismaticJoint extends Joint
{
    public localAnchorA: Vector2;
    public localAnchorB: Vector2;

    private initialAngle: number;
    private t: Vector2;

    private ra!: Vector2;
    private rb!: Vector2;
    private m!: Matrix2;
    private u!: Vector2;
    private bias!: Vector2;
    private impulseSum: Vector2 = new Vector2();

    constructor(
        bodyA: RigidBody, bodyB: RigidBody,
        anchorA: Vector2 = bodyA.position, anchorB: Vector2 = bodyB.position,
        dir?: Vector2,
        frequency = 30, dampingRatio = 1.0, mass = -1
    )
    {
        super(bodyA, bodyB);

        if (bodyA.type == Type.Static && bodyB.type == Type.Static)
            throw "Can't make prismatic constraint between static bodies";
        if (bodyB.type == Type.Static)
            throw "Please make prismatic constraint by using the bodyA as a static body"

        this.localAnchorA = this.bodyA.globalToLocal.mulVector2(anchorA, 1);
        this.localAnchorB = this.bodyB.globalToLocal.mulVector2(anchorB, 1);

        this.initialAngle = bodyB.rotation - bodyA.rotation;

        if (dir == undefined)
        {
            let u = anchorB.sub(anchorA);
            this.t = new Vector2(-u.y, u.x).normalized();
        }
        else
        {
            this.t = new Vector2(-dir.y, dir.x).normalized();
        }

        if (mass <= 0) mass = bodyB.mass;
        if (frequency <= 0) frequency = 0.01;
        dampingRatio = Util.clamp(dampingRatio, 0.0, 1.0);

        let omega = 2 * Math.PI * frequency;
        let d = 2 * mass * dampingRatio * omega; // Damping coefficient
        let k = mass * omega * omega; // Spring constant
        let h = Settings.dt;

        this.beta = h * k / (d + h * k);
        this.gamma = 1.0 / ((d + h * k) * h);
    }

    override prepare(): void
    {
        // Calculate Jacobian J and effective mass M
        // J = [-t^t, -(ra + u)×t, t^t, rb×t] // Line 
        //     [   0,          -1,   0,    1] // Angle
        // M = (J · M^-1 · J^t)^-1

        this.ra = this.bodyA.localToGlobal.mulVector2(this.localAnchorA, 0);
        this.rb = this.bodyB.localToGlobal.mulVector2(this.localAnchorB, 0);

        let pa = this.bodyA.position.add(this.ra);
        let pb = this.bodyB.position.add(this.rb);

        this.u = pb.sub(pa).normalized();

        let sa = this.ra.add(this.u).cross(this.t);
        let sb = this.rb.cross(this.t);

        let k = new Matrix2();
        k.m00 = this.bodyA.inverseMass + sa * sa * this.bodyA.inverseInertia + this.bodyB.inverseMass + sb * sb * this.bodyB.inverseInertia;
        k.m01 = sa * this.bodyA.inverseInertia + sb * this.bodyB.inverseInertia;
        k.m10 = sa * this.bodyA.inverseInertia + sb * this.bodyB.inverseInertia;
        k.m11 = this.bodyA.inverseInertia + this.bodyB.inverseInertia;

        k.m00 += this.gamma;
        k.m11 += this.gamma;

        this.m = k.inverted();

        let error0 = this.u.dot(this.t);
        let error1 = this.bodyB.rotation - this.bodyA.rotation - this.initialAngle;

        if (Settings.positionCorrection)
            this.bias = new Vector2(error0, error1).mul(this.beta * Settings.inv_dt);
        else
            this.bias = new Vector2();

        if (Settings.warmStarting)
            this.applyImpulse(this.impulseSum);
    }

    override solve(): void
    {
        // Calculate corrective impulse: Pc
        // Pc = J^t · λ (λ: lagrangian multiplier)
        // λ = (J · M^-1 · J^t)^-1 ⋅ -(J·v+b)

        let jv0 = this.t.dot(this.bodyB.linearVelocity) + this.rb.cross(this.t) * this.bodyB.angularVelocity
            - (this.t.dot(this.bodyA.linearVelocity) + this.rb.add(this.u).cross(this.t) * this.bodyA.angularVelocity)
            + this.gamma;

        let jv1 = this.bodyB.angularVelocity - this.bodyA.angularVelocity;

        let jv = new Vector2(jv0, jv1);

        let lambda = this.m.mulVector(jv.add(this.bias).add(this.impulseSum.mul(this.gamma)).inverted());

        this.applyImpulse(lambda);

        if (Settings.warmStarting)
            this.impulseSum.add(lambda);
    }

    protected override applyImpulse(lambda: Vector2): void
    {
        // V2 = V2' + M^-1 ⋅ Pc
        // Pc = J^t ⋅ λ

        let lambda0 = lambda.x;
        let lambda1 = lambda.y;

        this.bodyA.linearVelocity = this.bodyA.linearVelocity.sub(this.t.mul(lambda0 * this.bodyA.inverseMass));
        this.bodyA.angularVelocity = this.bodyA.angularVelocity - this.ra.add(this.u).cross(this.t) * this.bodyA.inverseInertia;
        this.bodyB.linearVelocity = this.bodyB.linearVelocity.add(this.t.mul(lambda0 * this.bodyB.inverseMass));
        this.bodyB.angularVelocity = this.bodyB.angularVelocity + this.rb.cross(this.t) * this.bodyB.inverseInertia;

        this.bodyA.angularVelocity = this.bodyA.angularVelocity - lambda1 * this.bodyA.inverseInertia;
        this.bodyB.angularVelocity = this.bodyB.angularVelocity + lambda1 * this.bodyB.inverseInertia;
    }
}