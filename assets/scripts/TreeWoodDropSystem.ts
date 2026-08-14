import { Node, tween, UITransform, Vec3 } from 'cc';
import type { TreeLevel, TreeSlot } from './TreeSystem';

interface TreeWoodStackSlot {
    x: number;
    y: number;
    scale: number;
    height: number;
    sortOrder: number;
    variantIndex: number;
}

interface TreeWoodPlacement {
    pileKey: string;
    slotIndex: number;
    stackLevel: number;
}

interface TreeWoodDisplaySize {
    width: number;
    height: number;
}

export interface TreeWoodDropConfig {
    actors: Node | null;
    pileLevel1Node: Node | null;
    pileLevel2Node: Node | null;
    pileLevel3Node: Node | null;
    pileNodesByCarAndLevel: (Node | null)[];
    pileAnchorNodesByCarAndLevel: (Node | null)[];
    startFallbackNode: Node | null;
    woodImagePath: string;
    settledWoodImagePathsCsv: string;
    flyingWoodImagePathsCsv: string;
    spawnOffsetY: number;
    carOffsetX: number;
    carOffsetY: number;
    columns: number;
    rows: number;
    offsetX: number;
    offsetY: number;
    gapX: number;
    gapY: number;
    layerGapY: number;
    dropHopY: number;
    dropStartScale: number;
    dropPopScale: number;
    dropDuration: number;
    flyDelay: number;
    woodWidth: number;
    woodHeight: number;
}

export interface TreeWoodDropCallbacks {
    makeNode(name: string, parent: Node, x?: number, y?: number): Node;
    addSprite(name: string, framePath: string, parent: Node, x: number, y: number, width: number, height: number): Node;
    setSpriteFrameAndSize(node: Node, framePath: string, width: number, height: number): void;
    getSpriteFrameAspect(path: string, fallbackWidth: number, fallbackHeight: number): number;
    addFloating(node: Node): void;
    removeFloating(node: Node): void;
    sortActors(): void;
}

export class TreeWoodDropSystem {
    private markerRoot: Node | null = null;
    private readonly pileNodes = new Map<string, Node>();
    private readonly markerNodes = new Map<string, Node>();
    private readonly stackSlots = new Map<string, TreeWoodStackSlot[]>();
    private readonly woodPlacements = new Map<Node, TreeWoodPlacement>();
    private readonly nextSlotIndexes = new Map<string, number>();

    public constructor(
        private readonly getConfig: () => TreeWoodDropConfig,
        private readonly callbacks: TreeWoodDropCallbacks,
    ) {}

    public getImagePaths() {
        const config = this.getConfig();
        return this.uniquePaths([
            config.woodImagePath,
            ...this.parseCsv(config.settledWoodImagePathsCsv),
            ...this.parseCsv(config.flyingWoodImagePathsCsv),
        ]);
    }

    public prepareSceneMarkers() {
        const config = this.getConfig();
        this.getConfiguredPileMarkers(config).forEach((marker) => {
            if (marker?.isValid) {
                marker.active = false;
            }
        });
        for (let carIndex = 0; carIndex < 3; carIndex += 1) {
            for (let level = 1; level <= 3; level += 1) {
                const anchor = config.pileAnchorNodesByCarAndLevel[this.getPileMarkerIndex(carIndex, level as TreeLevel)];
                if (anchor?.isValid) {
                    this.getOrCreateMarkerAtAnchor(carIndex, level as TreeLevel, anchor, config);
                }
            }
        }
    }

    public spawnFromTree(tree: TreeSlot, carIndex: number, carLevel: TreeLevel, count: number, done: (wood: Node) => void) {
        const config = this.getConfig();
        const actors = config.actors;
        if (!tree.node.isValid || !actors?.isValid) {
            return;
        }

        const gain = Math.max(0, Math.floor(count));
        const pileKey = this.getPileKey(carIndex, carLevel);
        const marker = this.getPileMarker(tree, carIndex, carLevel, pileKey, config);
        const pile = this.getPileNode(pileKey, marker, config);
        const slots = this.getStackSlots(pileKey, config);
        const settledPaths = this.getSettledWoodImagePaths(config);
        const flyingPaths = this.getFlyingWoodImagePaths(config, settledPaths);

        for (let i = 0; i < gain; i += 1) {
            const slotIndex = this.pickStackSlot(pileKey, slots);
            const slot = slots[slotIndex];
            const stackLevel = slot.height;
            const variantIndex = this.getWoodVariantIndex(slot, stackLevel, Math.max(settledPaths.length, flyingPaths.length));
            slot.height += 1;
            const stackOffset = this.getStackOffset(slot, stackLevel, config);

            const targetPosition = new Vec3(
                config.offsetX + slot.x + stackOffset.x,
                config.offsetY + slot.y + stackOffset.y,
                0,
            );
            const targetScale = new Vec3(slot.scale, slot.scale, 1);
            const targetActorsPosition = new Vec3(pile.position.x + targetPosition.x, pile.position.y + targetPosition.y, 0);
            const flyingImagePath = flyingPaths[variantIndex % flyingPaths.length];
            const settledImagePath = settledPaths[variantIndex % settledPaths.length];
            const flyingSize = this.getWoodDisplaySize(flyingImagePath, config);
            const settledSize = this.getWoodDisplaySize(settledImagePath, config);
            const wood = this.callbacks.addSprite(
                `TreeWood${Date.now()}${i}`,
                flyingImagePath,
                actors,
                tree.node.position.x,
                tree.node.position.y + config.spawnOffsetY,
                flyingSize.width,
                flyingSize.height,
            );
            this.dropToPile(
                wood,
                pile,
                targetActorsPosition,
                targetPosition,
                targetScale,
                settledImagePath,
                settledSize,
                i * config.flyDelay,
                { pileKey, slotIndex, stackLevel },
                () => done(wood),
                config,
            );
        }
    }

    public removeWood(wood: Node) {
        const placement = this.woodPlacements.get(wood);
        if (!placement) {
            return;
        }

        this.woodPlacements.delete(wood);
        this.rebuildStackHeights(placement.pileKey);
        this.sortPile(placement.pileKey);
    }

    public refreshPilePosition(carIndex: number, level: TreeLevel) {
        const config = this.getConfig();
        if (!config.actors?.isValid) {
            return;
        }

        const marker = this.getConfiguredPileMarker(carIndex, level, config);
        if (marker?.isValid) {
            marker.active = false;
        }

        const pileKey = this.getPileKey(carIndex, level);
        const pile = this.pileNodes.get(pileKey);
        if (!pile?.isValid || !marker?.isValid) {
            return;
        }

        pile.setPosition(this.getActorsPosition(marker, config));
        this.sortPile(pileKey);
        this.callbacks.sortActors();
    }

    private getPileMarker(
        tree: TreeSlot,
        carIndex: number,
        level: TreeLevel,
        pileKey: string,
        config: TreeWoodDropConfig,
    ) {
        const configuredMarker = this.getConfiguredPileMarker(carIndex, level, config);
        if (configuredMarker?.isValid) {
            configuredMarker.active = false;
            return configuredMarker;
        }

        const existingMarker = this.markerNodes.get(pileKey);
        if (existingMarker?.isValid) {
            return existingMarker;
        }

        const fallbackBase = tree.node.position ?? config.startFallbackNode?.position ?? Vec3.ZERO;
        const marker = this.callbacks.makeNode(
            `TreeWoodPileMarker${pileKey}`,
            config.actors!,
            fallbackBase.x + config.carOffsetX,
            fallbackBase.y + config.carOffsetY,
        );
        marker.active = false;
        this.markerNodes.set(pileKey, marker);
        return marker;
    }

    private getConfiguredPileMarker(carIndex: number, level: TreeLevel, config: TreeWoodDropConfig) {
        const marker = config.pileNodesByCarAndLevel[this.getPileMarkerIndex(carIndex, level)];
        if (marker?.isValid) {
            const anchor = config.pileAnchorNodesByCarAndLevel[this.getPileMarkerIndex(carIndex, level)];
            if (anchor?.isValid && config.actors?.isValid) {
                if (marker.parent !== config.actors) {
                    marker.setParent(config.actors, true);
                }
                marker.setPosition(this.getMarkerPositionFromAnchor(anchor, config));
            }
            return marker;
        }
        const anchor = config.pileAnchorNodesByCarAndLevel[this.getPileMarkerIndex(carIndex, level)];
        if (anchor?.isValid) {
            return this.getOrCreateMarkerAtAnchor(carIndex, level, anchor, config);
        }
        if (carIndex !== 0) {
            return null;
        }
        if (level === 1) {
            return config.pileLevel1Node;
        }
        if (level === 2) {
            return config.pileLevel2Node;
        }
        return config.pileLevel3Node;
    }

    private getConfiguredPileMarkers(config: TreeWoodDropConfig) {
        return [
            ...config.pileNodesByCarAndLevel,
            config.pileLevel1Node,
            config.pileLevel2Node,
            config.pileLevel3Node,
        ];
    }

    private getPileNode(pileKey: string, marker: Node, config: TreeWoodDropConfig) {
        const markerPosition = this.getActorsPosition(marker, config);
        const existingPile = this.pileNodes.get(pileKey);
        if (existingPile?.isValid) {
            existingPile.setPosition(markerPosition);
            return existingPile;
        }

        const pile = this.callbacks.makeNode(`TreeWoodPile${pileKey}`, config.actors!, markerPosition.x, markerPosition.y);
        this.pileNodes.set(pileKey, pile);
        return pile;
    }

    private getActorsPosition(node: Node, config: TreeWoodDropConfig) {
        if (node.parent === config.actors) {
            return node.position.clone();
        }
        return config.actors?.getComponent(UITransform)?.convertToNodeSpaceAR(node.worldPosition)
            ?? node.position.clone();
    }

    private getStackSlots(pileKey: string, config: TreeWoodDropConfig) {
        const slots = this.stackSlots.get(pileKey);
        if (slots && slots.length > 0) {
            return slots;
        }

        const builtSlots = this.buildStackSlots(config);
        this.stackSlots.set(pileKey, builtSlots);
        this.nextSlotIndexes.set(pileKey, 0);
        return builtSlots;
    }

    private buildStackSlots(config: TreeWoodDropConfig) {
        const columns = Math.max(1, Math.floor(config.columns));
        const rows = Math.max(1, Math.floor(config.rows));
        const slots: TreeWoodStackSlot[] = [];
        const centerColumn = (columns - 1) * 0.5;
        const centerRow = (rows - 1) * 0.5;
        const columnStep = Math.max(config.gapX, config.woodWidth * 0.46);
        const rowStep = Math.max(config.gapY, config.woodHeight * 0.34);

        for (let row = 0; row < rows; row += 1) {
            const rowOffset = row - centerRow;
            for (let column = 0; column < columns; column += 1) {
                const columnOffset = column - centerColumn;
                const variantIndex = this.getReferenceVariantIndex(row, column);
                const bias = this.getVariantBias(variantIndex, config);
                const jitter = this.getSlotJitter(row, column, config);
                slots.push({
                    x: columnOffset * columnStep + rowOffset * columnStep * 0.28 + bias.x + jitter.x,
                    y: rowOffset * rowStep + bias.y + jitter.y,
                    scale: this.getSlotScale(row, column, rows, variantIndex),
                    height: 0,
                    sortOrder: row * columns + column,
                    variantIndex,
                });
            }
        }

        return slots;
    }

    private pickStackSlot(pileKey: string, slots: TreeWoodStackSlot[]) {
        let bestIndex = 0;
        let bestHeight = Number.POSITIVE_INFINITY;
        const startIndex = this.nextSlotIndexes.get(pileKey) ?? 0;
        for (let offset = 0; offset < slots.length; offset += 1) {
            const index = (startIndex + offset) % slots.length;
            const height = slots[index].height;
            if (height < bestHeight) {
                bestIndex = index;
                bestHeight = height;
            }
        }

        this.nextSlotIndexes.set(pileKey, (bestIndex + 1) % slots.length);
        return bestIndex;
    }

    private dropToPile(
        wood: Node,
        pile: Node,
        targetActorsPosition: Vec3,
        targetPosition: Vec3,
        targetScale: Vec3,
        settledImagePath: string,
        settledSize: TreeWoodDisplaySize,
        delay: number,
        placement: TreeWoodPlacement,
        done: () => void,
        config: TreeWoodDropConfig,
    ) {
        const start = wood.position.clone();
        const peak = new Vec3(
            (start.x + targetActorsPosition.x) * 0.5,
            Math.max(start.y, targetActorsPosition.y) + config.dropHopY,
            0,
        );
        const duration = Math.max(0.01, config.dropDuration);
        const firstDuration = duration * 0.58;
        const secondDuration = duration - firstDuration;
        const startScale = Math.max(0.01, config.dropStartScale);
        const popScale = Math.max(startScale, config.dropPopScale);
        wood.setScale(startScale, startScale, 1);
        this.callbacks.addFloating(wood);

        tween(wood)
            .delay(delay)
            .to(firstDuration, {
                position: peak,
                scale: new Vec3(popScale, popScale, 1),
            }, { easing: 'quadOut' })
            .to(secondDuration, {
                position: targetActorsPosition.clone(),
                scale: targetScale,
            }, { easing: 'quadIn' })
            .to(0.06, { scale: new Vec3(targetScale.x * 1.06, targetScale.y * 0.94, 1) })
            .to(0.08, { scale: targetScale })
            .call(() => {
                this.callbacks.removeFloating(wood);
                if (!wood.isValid) {
                    return;
                }
                this.callbacks.setSpriteFrameAndSize(wood, settledImagePath, settledSize.width, settledSize.height);
                wood.setParent(pile, true);
                wood.setPosition(targetPosition);
                wood.setScale(targetScale);
                this.woodPlacements.set(wood, placement);
                this.sortPile(placement.pileKey);
                this.callbacks.sortActors();
                done();
            })
            .start();
    }

    private sortPile(pileKey: string) {
        const pile = this.pileNodes.get(pileKey);
        const slots = this.stackSlots.get(pileKey);
        if (!pile?.isValid || !slots) {
            return;
        }

        pile.children
            .slice()
            .sort((a, b) => {
                const placementA = this.woodPlacements.get(a);
                const placementB = this.woodPlacements.get(b);
                if (!placementA || !placementB) {
                    return 0;
                }
                const slotA = slots[placementA.slotIndex];
                const slotB = slots[placementB.slotIndex];
                const orderA = slotA?.sortOrder ?? placementA.slotIndex;
                const orderB = slotB?.sortOrder ?? placementB.slotIndex;
                const layeredOrderA = placementA.stackLevel * slots.length + orderA;
                const layeredOrderB = placementB.stackLevel * slots.length + orderB;
                if (layeredOrderA !== layeredOrderB) {
                    return layeredOrderA - layeredOrderB;
                }
                return orderA - orderB;
            })
            .forEach((wood, index) => wood.setSiblingIndex(index));
    }

    private rebuildStackHeights(pileKey: string) {
        const slots = this.stackSlots.get(pileKey);
        if (!slots) {
            return;
        }

        slots.forEach((slot) => {
            slot.height = 0;
        });
        Array.from(this.woodPlacements.entries()).forEach(([wood, placement]) => {
            if (!wood.isValid) {
                this.woodPlacements.delete(wood);
                return;
            }
            if (placement.pileKey !== pileKey) {
                return;
            }
            const slot = slots[placement.slotIndex];
            if (slot) {
                slot.height = Math.max(slot.height, placement.stackLevel + 1);
            }
        });
    }

    private getSettledWoodImagePaths(config: TreeWoodDropConfig) {
        const paths = this.parseCsv(config.settledWoodImagePathsCsv);
        return paths.length > 0 ? paths : [config.woodImagePath];
    }

    private getOrCreateMarkerAtAnchor(carIndex: number, level: TreeLevel, anchor: Node, config: TreeWoodDropConfig) {
        const pileKey = this.getPileKey(carIndex, level);
        const existing = this.markerNodes.get(pileKey);
        if (existing?.isValid) {
            existing.setPosition(this.getMarkerPositionFromAnchor(anchor, config));
            return existing;
        }
        const position = this.getMarkerPositionFromAnchor(anchor, config);
        const marker = this.callbacks.makeNode(`TreeWoodPileMarker${pileKey}`, this.getMarkerRoot(config), position.x, position.y);
        marker.active = false;
        this.markerNodes.set(pileKey, marker);
        return marker;
    }

    private getMarkerRoot(config: TreeWoodDropConfig) {
        if (this.markerRoot?.isValid) {
            return this.markerRoot;
        }
        this.markerRoot = this.callbacks.makeNode('WoodDropPoints', config.actors!);
        this.markerRoot.setPosition(Vec3.ZERO);
        return this.markerRoot;
    }

    private getMarkerPositionFromAnchor(anchor: Node, config: TreeWoodDropConfig) {
        const base = this.getActorsPosition(anchor, config);
        return base.add(new Vec3(config.carOffsetX, config.carOffsetY, 0));
    }

    private getPileKey(carIndex: number, level: TreeLevel) {
        return `Car${Math.max(0, Math.floor(carIndex)) + 1}Lv${level}`;
    }

    private getPileMarkerIndex(carIndex: number, level: TreeLevel) {
        return Math.max(0, Math.floor(carIndex)) * 3 + level - 1;
    }

    private getFlyingWoodImagePaths(config: TreeWoodDropConfig, settledPaths: string[]) {
        const paths = this.parseCsv(config.flyingWoodImagePathsCsv);
        return paths.length > 0 ? paths : settledPaths;
    }

    private getWoodDisplaySize(framePath: string, config: TreeWoodDropConfig): TreeWoodDisplaySize {
        const maxWidth = Math.max(1, config.woodWidth);
        const maxHeight = Math.max(1, config.woodHeight);
        const aspect = Math.max(0.01, this.callbacks.getSpriteFrameAspect(framePath, maxWidth, maxHeight));
        const boxAspect = maxWidth / maxHeight;
        if (aspect >= boxAspect) {
            return {
                width: maxWidth,
                height: Math.max(1, maxWidth / aspect),
            };
        }
        return {
            width: Math.max(1, maxHeight * aspect),
            height: maxHeight,
        };
    }

    private parseCsv(csv: string) {
        return csv
            .split(',')
            .map((path) => path.trim())
            .filter(Boolean);
    }

    private uniquePaths(paths: string[]) {
        const seen: Record<string, boolean> = Object.create(null);
        return paths.filter((path) => {
            if (!path || seen[path]) {
                return false;
            }
            seen[path] = true;
            return true;
        });
    }

    private lerp(a: number, b: number, t: number) {
        return a + (b - a) * t;
    }

    private getReferenceVariantIndex(row: number, column: number) {
        const patterns = [
            [0, 0, 0, 0, 0],
            [1, 0, 3, 0, 1],
            [2, 1, 2, 3, 2],
            [3, 2, 1, 2, 3],
        ];
        const pattern = patterns[row % patterns.length];
        return pattern[column % pattern.length];
    }

    private getWoodVariantIndex(slot: TreeWoodStackSlot, stackLevel: number, variantCount: number) {
        const safeCount = Math.max(1, variantCount);
        return (slot.variantIndex + stackLevel) % safeCount;
    }

    private getStackOffset(slot: TreeWoodStackSlot, stackLevel: number, config: TreeWoodDropConfig) {
        if (stackLevel <= 0) {
            return Vec3.ZERO.clone();
        }

        const direction = slot.sortOrder % 2 === 0 ? -1 : 1;
        const lift = Math.max(config.layerGapY, config.woodHeight * 0.14);
        const drift = Math.min(config.woodWidth * 0.11, 16);
        const stagger = stackLevel % 2 === 0 ? 0 : Math.min(config.woodHeight * 0.04, 5);
        return new Vec3(direction * drift * stackLevel, lift * stackLevel + stagger, 0);
    }

    private getVariantBias(variantIndex: number, config: TreeWoodDropConfig) {
        switch (variantIndex) {
            case 1:
                return new Vec3(-config.woodWidth * 0.05, config.woodHeight * 0.04, 0);
            case 2:
                return new Vec3(0, config.woodHeight * 0.11, 0);
            case 3:
                return new Vec3(config.woodWidth * 0.05, config.woodHeight * 0.04, 0);
            default:
                return new Vec3(0, -config.woodHeight * 0.04, 0);
        }
    }

    private getSlotJitter(row: number, column: number, config: TreeWoodDropConfig) {
        const seed = row * 17 + column * 31;
        const x = ((seed % 7) - 3) * config.woodWidth * 0.015;
        const y = (((seed * 3) % 5) - 2) * config.woodHeight * 0.012;
        return new Vec3(x, y, 0);
    }

    private getSlotScale(row: number, column: number, rows: number, variantIndex: number) {
        const depth = rows <= 1 ? 0.5 : row / (rows - 1);
        const variantScale = variantIndex === 2 ? -0.04 : 0;
        const columnScale = (row + column) % 2 === 0 ? -0.015 : 0.015;
        return this.lerp(0.98, 1.06, depth) + variantScale + columnScale;
    }
}
