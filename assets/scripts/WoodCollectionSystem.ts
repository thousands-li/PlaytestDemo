import { Node, Vec2, Vec3 } from 'cc';

export interface CollectableWood {
    wood: Node;
    isInitial: boolean;
}

export interface WoodCollectionConfig {
    actors: Node | null;
    startNode: Node | null;
    woodImagePath: string;
    treeWoodPickupRadius: number;
    startWoodColumns: number;
    startWoodOffsetX: number;
    startWoodOffsetY: number;
    startWoodGapX: number;
    startWoodGapY: number;
    startWoodLayerGapX: number;
    startWoodLayerGapY: number;
    startWoodWidth: number;
    startWoodHeight: number;
}

export interface WoodCollectionCallbacks {
    makeNode(name: string, parent: Node, x?: number, y?: number): Node;
    addSprite(name: string, framePath: string, parent: Node, x: number, y: number, width: number, height: number): Node;
    sortActors(): void;
}

export class WoodCollectionSystem {
    private woodNodes: Node[] = [];
    private initialWoodNodes = new Set<Node>();
    private startWoodPileNode: Node | null = null;

    public constructor(
        private readonly getConfig: () => WoodCollectionConfig,
        private readonly callbacks: WoodCollectionCallbacks,
    ) {}

    public spawnInitialWood(count: number) {
        const config = this.getConfig();
        const startPosition = config.startNode?.position ?? Vec3.ZERO;
        const pile = this.getStartWoodPileNode(startPosition, config);

        this.initialWoodNodes.clear();
        pile.removeAllChildren();
        this.startWoodPileNode = pile;

        const woodCount = Math.max(0, Math.floor(count));
        for (let i = 0; i < woodCount; i += 1) {
            const offset = this.getStartWoodOffset(i, woodCount, config);
            const wood = this.callbacks.addSprite(
                `StartWood${i}`,
                config.woodImagePath,
                pile,
                offset.x,
                offset.y,
                config.startWoodWidth,
                config.startWoodHeight,
            );
            this.woodNodes.push(wood);
            this.initialWoodNodes.add(wood);
        }

        this.arrangeStartWoodPile();
    }

    public addDroppedWood(wood: Node) {
        if (wood.isValid && this.woodNodes.indexOf(wood) < 0) {
            this.woodNodes.push(wood);
        }
    }

    public getCollectableWood(playerPos: Vec3, startZoneHit: boolean, isFloating: (node: Node) => boolean) {
        const config = this.getConfig();
        const initialWoodHit = startZoneHit;
        return this.woodNodes.filter((wood) => {
            if (!wood.isValid || isFloating(wood)) {
                return false;
            }
            if (this.initialWoodNodes.has(wood)) {
                return initialWoodHit;
            }
            return Vec3.distance(playerPos, wood.worldPosition) <= config.treeWoodPickupRadius * this.getNodeWorldRadiusScale(wood);
        });
    }

    public collect(woods: Node[]) {
        const collectSet = new Set(woods.filter((wood) => wood.isValid && this.woodNodes.indexOf(wood) >= 0));
        const collectable: CollectableWood[] = [];
        collectSet.forEach((wood) => {
            collectable.push({
                wood,
                isInitial: this.initialWoodNodes.has(wood),
            });
        });
        this.woodNodes = this.woodNodes.filter((wood) => wood.isValid && !collectSet.has(wood));
        return collectable;
    }

    public completeInitialWoodCollection(wood: Node) {
        this.initialWoodNodes.delete(wood);
        return !this.hasInitialWood();
    }

    public hasInitialWood() {
        return this.initialWoodNodes.size > 0;
    }

    public getGuideTarget(initialOnly: boolean, isFloating: (node: Node) => boolean) {
        return this.woodNodes.find((wood) => {
            if (!wood.isValid || isFloating(wood)) {
                return false;
            }
            return initialOnly ? this.initialWoodNodes.has(wood) : !this.initialWoodNodes.has(wood);
        }) ?? null;
    }

    public getInitialGuideNodes(isFloating: (node: Node) => boolean) {
        return this.woodNodes.filter((wood) => (
            wood.isValid
            && this.initialWoodNodes.has(wood)
            && !isFloating(wood)
        ));
    }

    private arrangeStartWoodPile() {
        const config = this.getConfig();
        const startPosition = config.startNode?.position ?? Vec3.ZERO;
        const pile = this.getStartWoodPileNode(startPosition, config);
        const startWoods = this.woodNodes.filter((wood) => this.initialWoodNodes.has(wood));

        startWoods.forEach((wood, index) => {
            if (!wood.isValid) {
                return;
            }
            if (wood.parent !== pile) {
                wood.setParent(pile, true);
            }
            const offset = this.getStartWoodOffset(index, startWoods.length, config);
            wood.setPosition(offset.x, offset.y, 0);
            wood.setScale(1, 1, 1);
        });
        this.sortStartWoodPile(startWoods, config);
        this.callbacks.sortActors();
    }

    private getStartWoodPileNode(position: Vec3, config: WoodCollectionConfig) {
        if (!this.startWoodPileNode || !this.startWoodPileNode.isValid) {
            if (!config.actors?.isValid) {
                throw new Error('Wood collection actors layer is not available.');
            }
            this.startWoodPileNode = this.callbacks.makeNode('StartWoodPile', config.actors, position.x, position.y);
        }
        this.startWoodPileNode.setPosition(position.x, position.y, 0);
        return this.startWoodPileNode;
    }

    private sortStartWoodPile(startWoods: Node[], config: WoodCollectionConfig) {
        startWoods
            .map((wood, index) => {
                const slot = this.getStartWoodPileSlot(index, config);
                return {
                    wood,
                    order: slot.layer * 100 + slot.slot,
                };
            })
            .sort((a, b) => a.order - b.order)
            .forEach(({ wood }, siblingIndex) => {
                if (wood.isValid) {
                    wood.setSiblingIndex(siblingIndex);
                }
            });
    }

    private getStartWoodOffset(index: number, totalCount: number, config: WoodCollectionConfig) {
        const raw = this.getStartWoodRawOffset(index, config);
        const center = this.getStartWoodStackAnchorCenter(totalCount, config);
        return new Vec3(
            config.startWoodOffsetX + raw.x - center.x,
            config.startWoodOffsetY + raw.y - center.y,
            0,
        );
    }

    private getStartWoodRawOffset(index: number, config: WoodCollectionConfig) {
        const slot = this.getStartWoodPileSlot(index, config);
        return new Vec2(
            slot.slot * config.startWoodGapX,
            slot.slot * config.startWoodGapY + slot.layer * config.startWoodLayerGapY,
        );
    }

    private getStartWoodPileSlot(index: number, config: WoodCollectionConfig) {
        const baseCount = this.getStartWoodBaseCount(config);
        const remaining = Math.max(0, Math.floor(index));
        const layer = Math.floor(remaining / baseCount);

        return {
            layer,
            slot: remaining % baseCount,
            layerCount: baseCount,
        };
    }

    private getStartWoodBaseCount(config: WoodCollectionConfig) {
        return Math.max(1, Math.floor(config.startWoodColumns));
    }

    private getStartWoodStackAnchorCenter(totalCount: number, config: WoodCollectionConfig) {
        const count = Math.max(1, Math.floor(totalCount));
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (let i = 0; i < count; i += 1) {
            const raw = this.getStartWoodRawOffset(i, config);
            minX = Math.min(minX, raw.x);
            maxX = Math.max(maxX, raw.x);
            minY = Math.min(minY, raw.y);
            maxY = Math.max(maxY, raw.y);
        }

        return new Vec2((minX + maxX) * 0.5, (minY + maxY) * 0.5);
    }

    private getNodeWorldRadiusScale(node: Node) {
        const scale = node.worldScale;
        return Math.max(Math.abs(scale.x), Math.abs(scale.y), 0.0001);
    }
}
