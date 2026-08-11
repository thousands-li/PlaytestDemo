import { Node } from 'cc';

export interface SceneNodeResolverCallbacks {
    makeNode(name: string, parent: Node): Node;
}

export class SceneNodeResolver {
    public constructor(private readonly callbacks: SceneNodeResolverCallbacks) {}

    public resolve(configNode: Node | null, parent: Node, name: string) {
        const node = configNode ?? this.findChildDeep(parent, name) ?? this.callbacks.makeNode(name, parent);
        if (!node.parent) {
            parent.addChild(node);
        }
        return node;
    }

    public findChildDeep(parent: Node, name: string): Node | null {
        const direct = parent.getChildByName(name);
        if (direct) {
            return direct;
        }
        for (const child of parent.children) {
            const found = this.findChildDeep(child, name);
            if (found) {
                return found;
            }
        }
        return null;
    }

    public syncLayer(node: Node, layer: number) {
        node.layer = layer;
        node.children.forEach((child) => this.syncLayer(child, layer));
    }

    public findNumberedChildren(parent: Node, prefix: string) {
        const pattern = new RegExp(`^${prefix}(\\d+)$`);
        return parent.children
            .filter((child) => pattern.test(child.name))
            .sort((a, b) => {
                const aIndex = Number(a.name.match(pattern)?.[1] ?? 0);
                const bIndex = Number(b.name.match(pattern)?.[1] ?? 0);
                return aIndex - bIndex;
            });
    }
}
