import { AABB, detectCollisionAABB, testPointInside, union, createAABB, fix } from "./aabb.js";
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
            // Find the best sibling for the new leaf
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

            // Create a new parent
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

            // Walk back up the tree refitting ancestors' AABB and applying rotations
            let ancestor: Node | undefined = newNode.parent;
            while (ancestor != undefined)
            {
                let child1 = ancestor.child1!;
                let child2 = ancestor.child2!;

                ancestor.aabb = union(child1.aabb, child2.aabb);

                this.rotate(ancestor);

                ancestor = ancestor.parent;
            }
        }

        return newNode;
    }

    private rotate(node: Node)
    {
        if (node.parent == undefined) return;

        let parent = node.parent;
        let sibling = parent.child1 == node ? parent.child2! : parent.child1!;

        let costDiffs: number[] = [];
        let nodeArea = node.aabb.area;

        costDiffs.push(union(sibling.aabb, node.child1!.aabb).area - nodeArea);
        costDiffs.push(union(sibling.aabb, node.child2!.aabb).area - nodeArea);

        if (!sibling.isLeaf)
        {
            let siblingArea = sibling.aabb.area;
            costDiffs.push(union(node.aabb, sibling.child1!.aabb).area - siblingArea);
            costDiffs.push(union(node.aabb, sibling.child2!.aabb).area - siblingArea);
        }

        let bestDiffIndex = 0;
        for (let i = 1; i < costDiffs.length; i++)
        {
            if (costDiffs[i] < costDiffs[bestDiffIndex])
                bestDiffIndex = i;
        }

        if (costDiffs[bestDiffIndex] < 0.0)
        {
            // console.log("Tree rotation: tpye " + bestDiffIndex);

            switch (bestDiffIndex)
            {
                case 0:
                    // this.swap(sibling, node.child2!);

                    if (parent.child1 == sibling)
                        parent.child1 = node.child2;
                    else
                        parent.child2 = node.child2;

                    node.child2!.parent = parent;

                    node.child2 = sibling;
                    sibling.parent = node;
                    node.aabb = union(sibling.aabb, node.child1!.aabb);
                    break;
                case 1:
                    // this.swap(sibling, node.child1!);

                    if (parent.child1 == sibling)
                        parent.child1 = node.child1;
                    else
                        parent.child2 = node.child1;

                    node.child1!.parent = parent;

                    node.child1 = sibling;
                    sibling.parent = node;
                    node.aabb = union(sibling.aabb, node.child2!.aabb);
                    break;
                case 2:
                    // this.swap(node, sibling.child2!);

                    if (parent.child1 == node)
                        parent.child1 = sibling.child2;
                    else
                        parent.child2 = sibling.child2;

                    sibling.child2!.parent = parent;

                    sibling.child2 = node;
                    node.parent = sibling;
                    sibling.aabb = union(node.aabb, sibling.child2!.aabb);
                    break;
                case 3:
                    // this.swap(node, sibling.child1!);

                    if (parent.child1 == node)
                        parent.child1 = sibling.child1;
                    else
                        parent.child2 = sibling.child1;

                    sibling.child1!.parent = parent;

                    sibling.child1 = node;
                    node.parent = sibling;
                    sibling.aabb = union(node.aabb, sibling.child1!.aabb);
                    break;
            }
        }
    }

    private swap(node1: Node, node2: Node): void
    {
        let parent1 = node1.parent!;
        let parent2 = node2.parent!;

        if (parent1 == parent2)
        {
            parent1.child1 = node2;
            parent1.child2 = node1;
            return;
        }

        if (parent1.child1 == node1)
            parent1.child1 = node2;
        else
            parent1.child2 = node2;
        node2.parent = parent1;

        if (parent2.child1 == node2)
            parent2.child1 = node1;
        else
            parent2.child2 = node1;
        node1.parent = parent2;
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

        fix(region);

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

    // BFS tree traversal
    traverse(callback: (node: Node) => void)
    {
        let q = [this.root];

        while (q.length != 0)
        {
            let current = q.shift()!;
            if (current == undefined) break;

            callback(current);

            if (!current.isLeaf)
            {
                q.push(current.child1!);
                q.push(current.child2!);
            }
        }
    }

    get cost(): number
    {
        let cost = 0;

        this.traverse(node =>
        {
            cost += node.aabb.area;
        });

        return cost;
    }
}