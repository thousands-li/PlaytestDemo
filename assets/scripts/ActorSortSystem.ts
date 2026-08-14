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
    getSortBandOverride(node: Node): number | null;
    getSortBiasY(node: Node): number | null;
    getSortYOverride(node: Node): number | null;
}

const DEFAULT_ACTOR_SORT_BAND = 2;

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
        children.sort((a, b) => (
            this.getActorSortBand(a) - this.getActorSortBand(b)
            || this.getActorSortY(b) - this.getActorSortY(a)
        ));
        children.forEach((child, index) => child.setSiblingIndex(index));
    }

    private getActorSortBand(node: Node) {
        return this.callbacks.getSortBandOverride(node) ?? DEFAULT_ACTOR_SORT_BAND;
    }

    private getActorSortY(node: Node) {
        const config = this.getConfig();
        const overrideY = this.callbacks.getSortYOverride(node);
        return (overrideY ?? node.position.y)
            + (this.callbacks.getSortBiasY(node) ?? this.getDefaultSortBiasY(node, config))
            + (this.callbacks.isPlayerFootRingNode(node)
                ? config.playerFootRingSortBiasY
                : 0);
    }

    private getDefaultSortBiasY(node: Node, config: ActorSortConfig) {
        return this.callbacks.isPlayerBackpackNode(node) || this.callbacks.isNpcCarryBackpackNode(node)
            ? config.carryBackpackSortBiasY
            : 0;
    }
}
