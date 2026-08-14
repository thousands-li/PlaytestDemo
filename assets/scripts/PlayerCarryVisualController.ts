import { Node, Vec3 } from 'cc';
import { DIRECTION_NAMES, getDirectionVector, type Direction } from './Direction';

export const PLAYER_CARRY_BACKPACK_NAME = 'CarryBackpack';

type CarryItemType = 'wood' | 'coin';

interface CarryWoodVisual {
    path: string;
    width: number;
    height: number;
}

const CARRY_SORT_FRONT_BIAS_Y = -0.5;
const CARRY_SORT_BACK_BIAS_Y = 0.5;

export interface PlayerCarryVisualConfig {
    actors: Node | null;
    playerNode: Node | null;
    currentDirection: Direction;
    showHeldCarryItems: boolean;
    woodCount: number;
    coinCount: number;
    woodOffsetX: number;
    woodStartY: number;
    woodGapY: number;
    woodWideGapY: number;
    woodDiagonalGapY: number;
    woodCarryWidth: number;
    woodCarryHeight: number;
    woodCarryWideWidth: number;
    woodCarryWideHeight: number;
    woodCarryDiagonalWidth: number;
    woodCarryDiagonalHeight: number;
    coinOffsetX: number;
    coinStartY: number;
    coinGapY: number;
    carryBackDistance: number;
    carryBackYScale: number;
    carryItemGap: number;
    coinImagePath: string;
    carryWoodImagePath: string;
    carryWoodWideImagePath: string;
    carryWoodDiagonalAImagePath: string;
    carryWoodDiagonalBImagePath: string;
}

export interface PlayerCarryVisualCallbacks {
    resolveBackpackNode(parent: Node, name: string): Node;
    addSprite(name: string, framePath: string, parent: Node, x: number, y: number, width: number, height: number): Node;
    setSpriteFrameAndSize(node: Node, framePath: string, width: number, height: number): void;
    getSpriteFrameAspect(path: string, fallbackWidth: number, fallbackHeight: number): number;
}

export class PlayerCarryVisualController {
    private backpackNode: Node | null = null;
    private woodNodes: Node[] = [];
    private coinNodes: Node[] = [];

    public constructor(
        private readonly getConfig: () => PlayerCarryVisualConfig,
        private readonly callbacks: PlayerCarryVisualCallbacks,
    ) {}

    public rebuildBackpack() {
        const config = this.getConfig();
        if (!config.actors?.isValid) {
            return null;
        }

        this.backpackNode = this.callbacks.resolveBackpackNode(config.actors, PLAYER_CARRY_BACKPACK_NAME);
        this.backpackNode.removeAllChildren();
        this.backpackNode.active = config.showHeldCarryItems;
        this.woodNodes = [];
        this.coinNodes = [];
        this.updateBackpackPosition();
        return this.backpackNode;
    }

    public updateBackpackPosition() {
        const config = this.getConfig();
        const backpack = this.getBackpackNode(config);
        const playerNode = config.playerNode;
        if (!backpack || !playerNode?.isValid) {
            return;
        }

        backpack.active = config.showHeldCarryItems;
        const offset = this.getBackOffset(config.currentDirection, config);
        backpack.setPosition(playerNode.position.x + offset.x, playerNode.position.y + offset.y, 0);
        this.layoutItems();
    }

    public addWood(displayCount: number) {
        const config = this.getConfig();
        const backpack = this.getBackpackNode(config);
        if (!config.showHeldCarryItems || !backpack) {
            return null;
        }

        const position = this.getItemLocalPosition('wood', this.woodNodes.length, config);
        const visual = this.getWoodVisual(config.currentDirection, config);
        const wood = this.callbacks.addSprite(
            `HeldWood${displayCount}`,
            visual.path,
            backpack,
            position.x,
            position.y,
            visual.width,
            visual.height,
        );
        this.woodNodes.push(wood);
        this.layoutItems();
        return wood;
    }

    public addCoin(displayCount: number) {
        const config = this.getConfig();
        const backpack = this.getBackpackNode(config);
        if (!config.showHeldCarryItems || !backpack) {
            return null;
        }

        const position = this.getItemLocalPosition('coin', this.coinNodes.length, config);
        const coin = this.callbacks.addSprite(`HeldCoin${displayCount}`, config.coinImagePath, backpack, position.x, position.y, 52, 52);
        this.coinNodes.push(coin);
        this.layoutItems();
        return coin;
    }

    public takeWoodForSale(fallbackName: string, fallbackIndex: number, fallbackHasBothTypes?: boolean) {
        this.woodNodes = this.woodNodes.filter((node) => node.isValid);
        const wood = this.woodNodes.pop();
        if (wood?.isValid) {
            this.layoutItems();
            return wood;
        }

        const config = this.getConfig();
        const actors = config.actors;
        if (!actors?.isValid) {
            throw new Error('Player carry actors layer is not available.');
        }

        const visual = this.getWoodVisual(config.currentDirection, config);
        const position = this.getItemActorsPosition('wood', fallbackIndex, config.currentDirection, config, fallbackHasBothTypes);
        const fallbackWood = this.callbacks.addSprite(
            fallbackName,
            visual.path,
            actors,
            position.x,
            position.y,
            visual.width,
            visual.height,
        );
        this.layoutItems();
        return fallbackWood;
    }

    public removeCoins(count: number) {
        this.coinNodes = this.coinNodes.filter((node) => node.isValid);
        const spentCount = Math.max(0, Math.floor(count));
        for (let i = 0; i < spentCount; i += 1) {
            const coin = this.coinNodes.pop();
            coin?.destroy();
        }
        this.layoutItems();
    }

    public applyWoodVisualForDirection(node: Node, direction: Direction) {
        const visual = this.getWoodVisual(direction, this.getConfig());
        node.setRotationFromEuler(0, 0, 0);
        this.callbacks.setSpriteFrameAndSize(node, visual.path, visual.width, visual.height);
    }

    public isBackpackNode(node: Node) {
        return this.backpackNode === node;
    }

    public getBackpackSortBiasY() {
        return this.shouldRenderBackpackAbovePlayer(this.getConfig().currentDirection)
            ? CARRY_SORT_FRONT_BIAS_Y
            : CARRY_SORT_BACK_BIAS_Y;
    }

    public getWoodImagePaths() {
        const config = this.getConfig();
        return [
            config.carryWoodImagePath,
            config.carryWoodWideImagePath,
            config.carryWoodDiagonalAImagePath,
            config.carryWoodDiagonalBImagePath,
        ];
    }

    public getCoinImagePaths() {
        return DIRECTION_NAMES.map((direction) => this.getCoinImagePath(direction));
    }

    private getBackpackNode(config = this.getConfig()) {
        if (this.backpackNode?.isValid) {
            return this.backpackNode;
        }
        if (!config.actors?.isValid) {
            return null;
        }
        return this.rebuildBackpack();
    }

    private layoutItems() {
        const config = this.getConfig();
        const backpack = this.getBackpackNode(config);
        if (!backpack?.isValid) {
            return;
        }

        this.woodNodes = this.woodNodes.filter((node) => node.isValid);
        this.coinNodes = this.coinNodes.filter((node) => node.isValid);
        backpack.active = config.showHeldCarryItems && (this.woodNodes.length > 0 || this.coinNodes.length > 0);
        const hasBothVisibleTypes = this.woodNodes.length > 0 && this.coinNodes.length > 0;
        this.woodNodes.forEach((wood, index) => {
            this.applyWoodVisualForDirection(wood, config.currentDirection);
            wood.setPosition(this.getItemLocalPosition('wood', index, config, hasBothVisibleTypes));
        });
        this.coinNodes.forEach((coin, index) => {
            this.callbacks.setSpriteFrameAndSize(coin, this.getCoinImagePath(config.currentDirection), 52, 52);
            coin.setPosition(this.getItemLocalPosition('coin', index, config, hasBothVisibleTypes));
        });
        this.sortCarryItems();
    }

    private getItemActorsPosition(
        type: CarryItemType,
        index: number,
        direction: Direction,
        config: PlayerCarryVisualConfig,
        hasBothTypes?: boolean,
    ) {
        const playerNode = config.playerNode;
        const backOffset = this.getBackOffset(direction, config);
        const localPosition = this.getItemLocalPosition(type, index, config, hasBothTypes);
        return new Vec3(
            (playerNode?.position.x ?? 0) + backOffset.x + localPosition.x,
            (playerNode?.position.y ?? 0) + backOffset.y + localPosition.y,
            0,
        );
    }

    private getItemLocalPosition(type: CarryItemType, index: number, config: PlayerCarryVisualConfig, hasBothTypes = this.hasBothTypes(config)) {
        const distanceOffset = this.getCarryItemDistanceOffset(type, hasBothTypes, config.currentDirection, config);
        const extraX = type === 'wood' ? config.woodOffsetX : config.coinOffsetX;
        const startY = type === 'wood' ? config.woodStartY : config.coinStartY;
        const gapY = type === 'wood' ? this.getWoodGapY(config.currentDirection, config) : config.coinGapY;
        return new Vec3(distanceOffset.x + extraX, distanceOffset.y + startY + index * gapY, 0);
    }

    private getBackOffset(direction: Direction, config: PlayerCarryVisualConfig) {
        const front = getDirectionVector(direction);
        return new Vec3(
            -front.x * config.carryBackDistance,
            -front.y * config.carryBackDistance * config.carryBackYScale,
            0,
        );
    }

    private hasBothTypes(config: PlayerCarryVisualConfig) {
        return config.woodCount > 0 && config.coinCount > 0;
    }

    private getCarryItemDistanceOffset(type: CarryItemType, hasBothTypes: boolean, direction: Direction, config: PlayerCarryVisualConfig) {
        if (!hasBothTypes || type === 'wood') {
            return Vec3.ZERO;
        }
        const backAxis = this.getCarryBackAxis(direction, config);
        return new Vec3(
            backAxis.x * config.carryItemGap,
            Math.abs(backAxis.y) * config.carryItemGap,
            0,
        );
    }

    private sortCarryItems() {
        if (this.shouldRenderCoinsAboveWood(this.getConfig().currentDirection)) {
            this.woodNodes.forEach((wood, index) => {
                wood.setSiblingIndex(index);
            });
            this.coinNodes.forEach((coin, index) => {
                coin.setSiblingIndex(this.woodNodes.length + index);
            });
            return;
        }

        this.coinNodes.forEach((coin, index) => {
            coin.setSiblingIndex(index);
        });
        this.woodNodes.forEach((wood, index) => {
            wood.setSiblingIndex(this.coinNodes.length + index);
        });
    }

    private shouldRenderCoinsAboveWood(direction: Direction) {
        return direction === '000' || direction === '045' || direction === '315';
    }

    private shouldRenderBackpackAbovePlayer(direction: Direction) {
        return direction === '000'
            || direction === '045'
            || direction === '090'
            || direction === '270'
            || direction === '315';
    }

    private getCarryBackAxis(direction: Direction, config: PlayerCarryVisualConfig) {
        const front = getDirectionVector(direction);
        const axis = new Vec3(-front.x, -front.y * config.carryBackYScale, 0);
        const length = Math.max(Math.sqrt(axis.x * axis.x + axis.y * axis.y), 0.0001);
        axis.multiplyScalar(1 / length);
        return axis;
    }

    private getWoodGapY(direction: Direction, config: PlayerCarryVisualConfig) {
        const configuredGap = (() => {
            switch (direction) {
                case '000':
                case '180':
                    return config.woodWideGapY;
                case '045':
                case '135':
                case '225':
                case '315':
                    return config.woodDiagonalGapY;
                case '090':
                case '270':
                default:
                    return config.woodGapY;
            }
        })();
        const visual = this.getWoodVisual(direction, config);
        return Math.min(configuredGap, visual.height * 0.95);
    }

    private getWoodVisual(direction: Direction, config: PlayerCarryVisualConfig): CarryWoodVisual {
        switch (direction) {
            case '000':
            case '180':
                return this.getWoodVisualInBox(
                    config.carryWoodWideImagePath,
                    config.woodCarryWideWidth,
                    config.woodCarryWideHeight,
                );
            case '090':
            case '270':
                return this.getWoodVisualInBox(
                    config.carryWoodImagePath,
                    config.woodCarryWidth,
                    config.woodCarryHeight,
                );
            case '045':
            case '225':
                return this.getWoodVisualInBox(
                    config.carryWoodDiagonalAImagePath,
                    config.woodCarryDiagonalWidth,
                    config.woodCarryDiagonalHeight,
                );
            case '135':
            case '315':
            default:
                return this.getWoodVisualInBox(
                    config.carryWoodDiagonalBImagePath,
                    config.woodCarryDiagonalWidth,
                    config.woodCarryDiagonalHeight,
                );
        }
    }

    private getWoodVisualInBox(path: string, fallbackWidth: number, fallbackHeight: number) {
        const aspect = Math.max(0.01, this.callbacks.getSpriteFrameAspect(path, fallbackWidth, fallbackHeight));
        const maxWidth = Math.max(1, fallbackWidth);
        const maxHeight = Math.max(1, fallbackHeight);
        if (aspect >= maxWidth / maxHeight) {
            return {
                path,
                width: maxWidth,
                height: maxWidth / aspect,
            };
        }
        return {
            path,
            width: maxHeight * aspect,
            height: maxHeight,
        };
    }

    private getCoinImagePath(direction: Direction) {
        return `images/ui/Coins/Coins_${direction}`;
    }
}
