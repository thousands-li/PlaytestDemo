import { Node } from 'cc';

export interface ActorSortConfig {
    actors: Node | null;
    carryBackpackSortBiasY: number;
    playerFootRingSortBiasY: number;
}

export interface ActorSortCallbacks {
    isPlayerBackpackNode(node: Node): boolean;
    isNpcCarryBackpackNode(node: Node): boolean;
    isPlayerFootRingNode(node: Node): boolean;
}

export class ActorSortSystem {
    constructor(
        private readonly getConfig: () => ActorSortConfig,
        private readonly callbacks: ActorSortCallbacks,
    ) {}

    sort() {
        const actors = this.getConfig().actors;
        if (!actors?.isValid) {
            return;
        }
        const children = actors.children.slice();
        children.sort((a, b) => this.getActorSortY(b) - this.getActorSortY(a));
        children.forEach((child, index) => child.setSiblingIndex(index));
    }

    private getActorSortY(node: Node) {
        const config = this.getConfig();
        return node.position.y
            + (this.callbacks.isPlayerBackpackNode(node) || this.callbacks.isNpcCarryBackpackNode(node)
                ? config.carryBackpackSortBiasY
                : 0)
            + (this.callbacks.isPlayerFootRingNode(node)
                ? config.playerFootRingSortBiasY
                : 0);
    }
}
