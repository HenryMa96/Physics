import { Vector2 } from "./math.js";

export class Edge
{
    public p1: Vector2;
    public p2: Vector2;
    public dir: Vector2;

    constructor(p1: Vector2, p2: Vector2)
    {
        this.p1 = p1.copy();
        this.p2 = p2.copy();

        if (this.p1.equals(this.p2))
            this.dir = new Vector2(0, 0);
        else
            this.dir = p2.subV(p1).normalized();
    }

    get length()
    {
        return this.p2.subV(this.p1).length;
    }

    get normal()
    {
        return this.dir.normal;
    }

    get midPoint()
    {
        return new Vector2((this.p1.x + this.p2.x) / 2.0, (this.p1.y + this.p2.y) / 2.0);
    }
}