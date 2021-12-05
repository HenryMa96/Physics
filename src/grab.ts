import { Joint } from "./joint.js";
import { Matrix2, Vector2 } from "./math.js";
import { RigidBody } from "./rigidbody.js";
import { Settings } from "./settings.js";
import * as Util from "./util.js";

export class GrabJoint extends Joint
{
    public localAnchor: Vector2;
    public length;
    public target: Vector2;
    private r!: Vector2;

    private m!: Matrix2;
    private bias!: Vector2;
    private impulseSum: Vector2 = new Vector2(0, 0);

    private beta;
    private gamma; // Softness

    constructor(body: RigidBody, anchor: Vector2, target: Vector2, frequency = 0.8, dampingRatio = 0.6, mass = -1)
    {
        super(body, body);
        this.localAnchor = body.globalToLocal.mulVector2(anchor, 1);
        this.target = target;
        this.length = 0;

        if (mass <= 0) mass = body.mass;
        if (frequency <= 0) frequency = 0.01;
        dampingRatio = Util.clamp(dampingRatio, 0.0, 1.0);

        let omega = 2 * Math.PI * frequency;
        let d = 2 * mass * dampingRatio * omega; // Damping coefficient
        let k = mass * omega * omega; // Spring constant
        let h = Settings.fixedDeltaTime;

        this.beta = h * k / (d + h * k);
        this.gamma = 1 / ((d + h * k) * h);
    }

    override prepare(delta: number): void
    {
        // Calculate Jacobian J and effective mass M
        // J = [I, skew(r)]
        // M = (J · M^-1 · J^t)^-1

        this.r = this.bodyA.localToGlobal.mulVector2(this.localAnchor, 0);
        let p = this.bodyA.position.addV(this.r);

        let k = new Matrix2();

        k.m00 = this.bodyA.inverseMass + this.bodyA.inverseInertia * this.r.y * this.r.y + this.gamma;
        k.m01 = -this.bodyA.inverseInertia * this.r.y * this.r.x;
        k.m10 = -this.bodyA.inverseInertia * this.r.x * this.r.y;
        k.m11 = this.bodyA.inverseMass + this.bodyA.inverseInertia * this.r.x * this.r.x + this.gamma;

        this.m = k.inverted();

        let error = p.subV(this.target);

        if (Settings.positionCorrection)
            this.bias = error.mulS(this.beta / delta);
        else
            this.bias = new Vector2(0, 0);

        if (Settings.warmStarting)
            this.applyImpulse(this.impulseSum);
    }

    override solve(): void
    {
        // Calculate corrective impulse: Pc
        // Pc = J^t · λ (λ: lagrangian multiplier)
        // λ = (J · M^-1 · J^t)^-1 ⋅ -(J·v+b)

        let jv: Vector2 = this.bodyA.linearVelocity.addV(Util.cross(this.bodyA.angularVelocity, this.r));

        let lambda = this.m.mulVector(jv.addV(this.bias).addV(this.impulseSum.mulS(this.gamma)).inverted());

        this.applyImpulse(lambda);

        if (Settings.warmStarting)
            this.impulseSum = this.impulseSum.addV(lambda);
    }

    protected override applyImpulse(lambda: Vector2): void
    {
        // V2 = V2' + M^-1 ⋅ Pc
        // Pc = J^t ⋅ λ
        
        this.bodyA.linearVelocity = this.bodyA.linearVelocity.addV(lambda.mulS(this.bodyA.inverseMass));
        this.bodyA.angularVelocity = this.bodyA.angularVelocity + this.bodyA.inverseInertia * this.r.cross(lambda);
    }
}