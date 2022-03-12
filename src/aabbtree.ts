import { AABB, detectCollisionAABB, testPointInside, union, createAABB } from "./aabb.js";
import { Vector2 } from "./math.js";
import { RigidBody, Type } from "./rigidbody.js";
import { make_pair_natural, Pair } from "./util.js";

export interface Node
{
    id: number;
    parent?: Node;
    child1?: Node;
    child2?: Node;
    isLeaf: boolean;
    aabb: AABB;
    body?: RigidBody;
}

export class AABBTree
{
    private nodeID = 0;
    public root?: Node = undefined;
    public aabbMargin = 0.05;

    reset(): void
    {
        this.nodeID = 0;
        this.root = undefined;
    }

    add(body: RigidBody): Node
    {
        // Enlarged AABB
        let aabb = createAABB(body, body.type == Type.Static ? 0.0 : this.aabbMargin);

        let newNode: Node =
        {
            id: this.nodeID++,
            aabb: aabb,
            isLeaf: true,
            body: body
        }
        body.node = newNode;

        if (this.root == undefined)
        {
            this.root = newNode;
        }
        else
        {
            let bestSibling = this.root;
            let bestCost = union(this.root.aabb, aabb).area;
            let q: Node[] = [this.root];

            while (q.length != 0)
            {
                let current: Node = q.shift()!;

                let directCost = union(current.aabb, aabb).area;
                let inheritedCost = 0;

                let ancestor = current.parent;
                while (ancestor != undefined)
                {
                    inheritedCost += union(ancestor.aabb, aabb).area - ancestor.aabb.area;
                    ancestor = ancestor.parent;
                }

                let costForCurrent = directCost + inheritedCost;

                if (costForCurrent < bestCost)
                {
                    bestCost = costForCurrent;
                    bestSibling = current;
                }

                let lowerBoundCost = aabb.area + (union(current.aabb, aabb).area - current.aabb.area) + inheritedCost;

                if (lowerBoundCost < bestCost)
                {
                    if (!current.isLeaf)
                    {
                        q.push(current.child1!);
                        q.push(current.child2!);
                    }
                }
            }

            let oldParent: Node = bestSibling.parent!;
            let newParent: Node =
            {
                id: this.nodeID++,
                parent: oldParent,
                aabb: union(aabb, bestSibling.aabb),
                isLeaf: false
            }

            if (oldParent != undefined)
            {
                if (oldParent.child1 == bestSibling)
                {
                    oldParent.child1 = newParent;
                } else
                {
                    oldParent.child2 = newParent;
                }

                newParent.child1 = bestSibling;
                newParent.child2 = newNode;
                bestSibling.parent = newParent;
                newNode.parent = newParent;
            } else
            {
                newParent.child1 = bestSibling;
                newParent.child2 = newNode;
                bestSibling.parent = newParent;
                newNode.parent = newParent;
                this.root = newParent;
            }

            // Refit ancestors
            let ancestor: Node | undefined = newNode.parent;
            while (ancestor != undefined)
            {
                let child1 = ancestor.child1!;
                let child2 = ancestor.child2!;

                ancestor.aabb = union(child1.aabb, child2.aabb);
                ancestor = ancestor.parent;
            }
        }

        return newNode;
    }

    remove(node: Node): void
    {
        let parent = node.parent;
        node.body!.node = undefined;

        if (parent != undefined)
        {
            let sibling = parent.child1 == node ? parent.child2! : parent.child1!;

            if (parent.parent != undefined)
            {
                sibling.parent = parent.parent;
                if (parent.parent.child1 == parent)
                {
                    parent.parent.child1 = sibling;
                }
                else
                {
                    parent.parent.child2 = sibling;
                }
            }
            else
            {
                this.root = sibling;
                sibling.parent = undefined;
            }

            let ancestor = sibling.parent;
            while (ancestor != undefined)
            {
                let child1 = ancestor.child1!;
                let child2 = ancestor.child2!;

                ancestor.aabb = union(child1.aabb, child2.aabb);
                ancestor = ancestor.parent;
            }

        } else
        {
            if (this.root == node)
            {
                this.root = undefined;
            }
        }
    }

    queryPoint(point: Vector2): Node[]
    {
        let res: Node[] = [];

        if (this.root == undefined) return res;

        let q = [this.root];

        while (q.length != 0)
        {
            let current = q.shift()!;

            if (!testPointInside(current.aabb, point))
                continue;

            if (current.isLeaf)
            {
                res.push(current);
            }
            else
            {
                q.push(current.child1!);
                q.push(current.child2!);
            }
        }

        return res;
    }

    queryRegion(region: AABB): Node[]
    {
        let res: Node[] = [];

        if (this.root == undefined) return res;

        let q = [this.root];

        while (q.length != 0)
        {
            let current = q.shift()!;

            if (!detectCollisionAABB(current.aabb, region))
                continue;

            if (current.isLeaf)
            {
                res.push(current);
            }
            else
            {
                q.push(current.child1!);
                q.push(current.child2!);
            }
        }

        return res;
    }

    getCollisionPairs(): Pair<Node, Node>[]
    {
        if (this.root == undefined) return [];

        let res: Pair<Node, Node>[] = [];
        let checked: Set<number> = new Set<number>();

        if (!this.root.isLeaf)
        {
            this.checkCollision(this.root.child1!, this.root.child2!, res, checked);
        }

        return res;
    }

    private checkCollision(a: Node, b: Node, pairs: Pair<Node, Node>[], checked: Set<number>): void
    {
        const key = make_pair_natural(a.id, b.id);
        if (checked.has(key)) return;

        checked.add(key);

        if (a.isLeaf && b.isLeaf)
        {
            if (detectCollisionAABB(a.aabb, b.aabb))
            {
                pairs.push({ p1: a, p2: b });
            }
        }
        else if (!a.isLeaf && !b.isLeaf)
        {
            this.checkCollision(a.child1!, a.child2!, pairs, checked);
            this.checkCollision(b.child1!, b.child2!, pairs, checked);

            if (detectCollisionAABB(a.aabb, b.aabb))
            {
                this.checkCollision(a.child1!, b.child1!, pairs, checked);
                this.checkCollision(a.child1!, b.child2!, pairs, checked);
                this.checkCollision(a.child2!, b.child1!, pairs, checked);
                this.checkCollision(a.child2!, b.child2!, pairs, checked);
            }
        }
        else if (a.isLeaf && !b.isLeaf)
        {
            this.checkCollision(b.child1!, b.child2!, pairs, checked);

            if (detectCollisionAABB(a.aabb, b.aabb))
            {
                this.checkCollision(a, b.child1!, pairs, checked);
                this.checkCollision(a, b.child2!, pairs, checked);
            }
        }
        else if (!a.isLeaf && b.isLeaf)
        {
            this.checkCollision(a.child1!, a.child2!, pairs, checked);

            if (detectCollisionAABB(a.aabb, b.aabb))
            {
                this.checkCollision(b, a.child1!, pairs, checked);
                this.checkCollision(b, a.child2!, pairs, checked);
            }
        }
    }
}