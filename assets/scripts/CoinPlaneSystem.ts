import { Node, tween, UITransform, Vec3 } from 'cc';

const COIN_PLANE_SOURCE_WIDTH = 215;
const COIN_PLANE_SOURCE_HEIGHT = 156;
const COIN_PLANE_SOURCE_ANGLE = -34 * Math.PI / 180;
const COIN_PLANE_COLUMN_PACK_PADDING = 1.2;
const COIN_PLANE_ROW_PACK_PADDING = 2.0;

interface CoinPlaneStackSlot {
    x: number;
    y: number;
    scale: number;
    height: number;
    sortOrder: number;
}

interface CoinPlaneCoinPlacement {
    slotIndex: number;
    level: number;
}

export interface CoinPlaneConfig {
    actors: Node | null;
    plane: Node | null;
    coinImagePath: string;
    columns: number;
    rows: number;
    offsetX: number;
    offsetY: number;
    gapX: number;
    gapY: number;
    stackLayerGapY: number;
    stackPopHopY: number;
    stackPopScale: number;
    popStartScale: number;
    popDelay: number;
    popDuration: number;
    flyDuration: number;
    sourceLiftHeight: number;
}

export interface CoinPlaneSpawnResult {
    spawnedCount: number;
    duration: number;
}

export interface CoinPlaneCallbacks {
    makeNode(name: string, parent: Node, x?: number, y?: number): Node;
    addSprite(name: string, framePath: string, parent: Node, x: number, y: number, width: number, height: number): Node;
    flyToPosition(node: Node, target: Vec3, delay: number, done: () => void, endScale?: number, duration?: number): void;
    sortActors(): void;
}

export class CoinPlaneSystem {
    private coinsOnPlane: Node[] = [];
    private pileNode: Node | null = null;
    private stackSlots: CoinPlaneStackSlot[] = [];
    private stackSignature = '';
    private coinPlacements = new Map<Node, CoinPlaneCoinPlacement>();
    private nextSlotIndex = 0;

    public constructor(
        private readonly getConfig: () => CoinPlaneConfig,
        private readonly callbacks: CoinPlaneCallbacks,
    ) {}

    public hasCoins() {
        return this.coinsOnPlane.some((coin) => coin.isValid);
    }

    public spawn(count: number, sourceNode?: Node): CoinPlaneSpawnResult {
        const config = this.getConfig();
        const plane = config.plane;
        if (!plane?.isValid || !config.actors?.isValid) {
            return { spawnedCount: 0, duration: 0 };
        }

        const coinCount = Math.max(0, Math.floor(count));
        if (coinCount <= 0) {
            return { spawnedCount: 0, duration: 0 };
        }

        const pile = this.getPileNode(plane, config);
        const slots = this.ensureStackSlots(plane, config);
        const startIndex = this.coinsOnPlane.length;
        const sourceActorsPosition = sourceNode?.isValid
            ? config.actors.getComponent(UITransform)?.convertToNodeSpaceAR(sourceNode.worldPosition) ?? sourceNode.position.clone()
            : null;

        for (let i = 0; i < coinCount; i += 1) {
            const slotIndex = this.pickStackSlot(slots);
            const slot = slots[slotIndex];
            const level = slot.height;
            slot.height += 1;
            const x = config.offsetX + slot.x;
            const y = config.offsetY + slot.y + level * config.stackLayerGapY;
            const targetScale = new Vec3(slot.scale, slot.scale, 1);
            const targetPosition = new Vec3(x, y, 0);
            const coinName = `PlaneCoin${Date.now()}_${startIndex + i}`;

            if (sourceActorsPosition) {
                this.spawnFlyingCoin(coinName, sourceActorsPosition, sourceNode, pile, slotIndex, level, targetPosition, targetScale, i, config);
                continue;
            }

            this.spawnPoppingCoin(coinName, pile, slotIndex, level, x, y, targetPosition, targetScale, slot.scale, i, config);
        }

        this.sortPile();
        this.callbacks.sortActors();
        return {
            spawnedCount: coinCount,
            duration: (coinCount - 1) * config.popDelay + (sourceActorsPosition ? config.flyDuration : config.popDuration),
        };
    }

    public collectCoins() {
        const collectableCoins = this.coinsOnPlane.filter((coin) => coin.isValid);
        this.coinsOnPlane = [];
        this.coinPlacements.clear();
        this.resetStackSlots();
        return collectableCoins;
    }

    public getGuideTarget(isAvailable: (coin: Node) => boolean) {
        return this.coinsOnPlane.find((coin) => coin.isValid && isAvailable(coin)) ?? null;
    }

    private spawnFlyingCoin(
        coinName: string,
        sourceActorsPosition: Vec3,
        sourceNode: Node | undefined,
        pile: Node,
        slotIndex: number,
        level: number,
        targetPosition: Vec3,
        targetScale: Vec3,
        index: number,
        config: CoinPlaneConfig,
    ) {
        const sourcePosition = new Vec3(
            sourceActorsPosition.x,
            sourceActorsPosition.y + config.sourceLiftHeight * Math.max(sourceNode?.scale.y ?? 1, 0.1) * 0.18,
            0,
        );
        const targetActorsPosition = new Vec3(pile.position.x + targetPosition.x, pile.position.y + targetPosition.y, 0);
        const coin = this.callbacks.addSprite(coinName, config.coinImagePath, config.actors!, sourcePosition.x, sourcePosition.y, 52, 52);
        const startScale = Math.max(config.popStartScale, 0.45) * targetScale.x;
        coin.setScale(startScale, startScale, 1);
        this.callbacks.flyToPosition(coin, targetActorsPosition, index * config.popDelay, () => {
            if (!coin.isValid) {
                return;
            }
            const currentSlot = this.stackSlots[slotIndex];
            if (currentSlot) {
                currentSlot.height = Math.max(currentSlot.height, level + 1);
            }
            coin.setParent(pile, true);
            coin.setPosition(targetPosition);
            coin.setScale(targetScale.x, targetScale.y, targetScale.z);
            this.coinsOnPlane.push(coin);
            this.coinPlacements.set(coin, { slotIndex, level });
            this.sortPile();
            this.callbacks.sortActors();
        }, targetScale.x, config.flyDuration);
    }

    private spawnPoppingCoin(
        coinName: string,
        pile: Node,
        slotIndex: number,
        level: number,
        x: number,
        y: number,
        targetPosition: Vec3,
        targetScale: Vec3,
        slotScale: number,
        index: number,
        config: CoinPlaneConfig,
    ) {
        const coin = this.callbacks.addSprite(coinName, config.coinImagePath, pile, x, y, 52, 52);
        coin.setScale(config.popStartScale * slotScale, config.popStartScale * slotScale, 1);
        coin.setPosition(x, y + config.stackPopHopY, 0);
        this.coinsOnPlane.push(coin);
        this.coinPlacements.set(coin, { slotIndex, level });
        tween(coin)
            .delay(index * config.popDelay)
            .to(config.popDuration * 0.65, {
                position: new Vec3(x, y + config.stackPopHopY * 0.25, 0),
                scale: new Vec3(config.stackPopScale * slotScale, config.stackPopScale * slotScale, 1),
            })
            .to(config.popDuration * 0.35, {
                position: targetPosition,
                scale: targetScale,
            })
            .call(() => this.sortPile())
            .start();
    }

    private getPileNode(plane: Node, config: CoinPlaneConfig) {
        if (!this.pileNode || !this.pileNode.isValid) {
            this.pileNode = this.callbacks.makeNode('CoinPlanePile', config.actors!, plane.position.x, plane.position.y);
        }
        this.pileNode.setPosition(plane.position.x, plane.position.y, 0);
        return this.pileNode;
    }

    private ensureStackSlots(plane: Node, config: CoinPlaneConfig) {
        const transform = plane.getComponent(UITransform);
        const columns = Math.max(1, Math.floor(config.columns));
        const rows = Math.max(1, Math.floor(config.rows));
        const width = Math.max(1, transform?.contentSize.width ?? config.gapX * columns);
        const height = Math.max(1, transform?.contentSize.height ?? config.gapY * rows);
        const signature = `${width.toFixed(2)}:${height.toFixed(2)}:${columns}:${rows}:${config.gapX.toFixed(2)}:${config.gapY.toFixed(2)}`;
        if (this.stackSignature === signature && this.stackSlots.length > 0) {
            return this.stackSlots;
        }

        const previousHeights = this.stackSlots.map((slot) => slot.height);
        this.stackSlots = this.buildStackSlots(width, height, columns, rows, config);
        this.stackSlots.forEach((slot, index) => {
            slot.height = previousHeights[index] ?? 0;
        });
        this.stackSignature = signature;
        if (this.nextSlotIndex >= this.stackSlots.length) {
            this.nextSlotIndex = 0;
        }
        return this.stackSlots;
    }

    private buildStackSlots(width: number, height: number, columns: number, rows: number, config: CoinPlaneConfig): CoinPlaneStackSlot[] {
        const slots: CoinPlaneStackSlot[] = [];
        const rotation = this.getCoinPlaneRotation(width, height);
        const majorAxis = new Vec3(Math.cos(rotation), Math.sin(rotation), 0);
        const depthAxis = new Vec3(Math.sin(rotation), -Math.cos(rotation), 0);
        const columnStep = this.getPackedStep(config.gapX, width, columns, COIN_PLANE_COLUMN_PACK_PADDING);
        const rowStep = this.getPackedStep(config.gapY, height, rows, COIN_PLANE_ROW_PACK_PADDING);

        for (let row = 0; row < rows; row += 1) {
            const depth = rows <= 1 ? 0.5 : row / (rows - 1);
            const rowScale = this.lerp(0.9, 1.02, depth);
            const rowOffset = row - (rows - 1) * 0.5;
            for (let column = 0; column < columns; column += 1) {
                const columnOffset = column - (columns - 1) * 0.5;
                const x = majorAxis.x * columnOffset * columnStep + depthAxis.x * rowOffset * rowStep;
                const y = majorAxis.y * columnOffset * columnStep + depthAxis.y * rowOffset * rowStep;
                slots.push({
                    x,
                    y,
                    scale: rowScale,
                    height: 0,
                    sortOrder: row * columns + column,
                });
            }
        }
        return slots;
    }

    private pickStackSlot(slots: CoinPlaneStackSlot[]) {
        let bestIndex = 0;
        let bestHeight = Number.POSITIVE_INFINITY;
        for (let offset = 0; offset < slots.length; offset += 1) {
            const index = (this.nextSlotIndex + offset) % slots.length;
            const height = slots[index].height;
            if (height < bestHeight) {
                bestIndex = index;
                bestHeight = height;
            }
        }
        this.nextSlotIndex = (bestIndex + 1) % slots.length;
        return bestIndex;
    }

    private sortPile() {
        const pile = this.pileNode;
        if (!pile?.isValid) {
            return;
        }
        pile.children
            .slice()
            .sort((a, b) => {
                const placementA = this.coinPlacements.get(a);
                const placementB = this.coinPlacements.get(b);
                if (!placementA || !placementB) {
                    return 0;
                }
                const slotA = this.stackSlots[placementA.slotIndex];
                const slotB = this.stackSlots[placementB.slotIndex];
                const orderA = slotA?.sortOrder ?? placementA.slotIndex;
                const orderB = slotB?.sortOrder ?? placementB.slotIndex;
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                return placementA.level - placementB.level;
            })
            .forEach((coin, index) => coin.setSiblingIndex(index));
    }

    private resetStackSlots() {
        this.stackSlots.forEach((slot) => {
            slot.height = 0;
        });
        this.nextSlotIndex = 0;
    }

    private lerp(a: number, b: number, t: number) {
        return a + (b - a) * t;
    }

    private getCoinPlaneRotation(width: number, height: number) {
        const sourceScaleX = width / COIN_PLANE_SOURCE_WIDTH;
        const sourceScaleY = height / COIN_PLANE_SOURCE_HEIGHT;
        const visualX = Math.cos(COIN_PLANE_SOURCE_ANGLE) * sourceScaleX;
        const visualY = Math.sin(COIN_PLANE_SOURCE_ANGLE) * sourceScaleY;
        return Math.atan2(visualY, visualX);
    }

    private getPackedStep(configuredGap: number, usableLength: number, slotCount: number, packPadding: number) {
        if (slotCount <= 1) {
            return 0;
        }
        return Math.min(configuredGap, usableLength / (slotCount + packPadding));
    }
}
