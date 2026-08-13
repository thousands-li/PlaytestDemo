import { Node } from 'cc';

export interface GameplayFlowConfig {
    playerNode: Node | null;
    playerSellFootInsetRatio: number;
    playerSellFootHalfWidthRatio: number;
    collectWoodCooldown: number;
    sellWoodCooldown: number;
    collectCoinCooldown: number;
    carUnlockCost: number;
    carUpgrade2Cost: number;
    carUpgrade3Cost: number;
    endAfterFinalUpgrade: boolean;
    endOverlayDelay: number;
}

export interface GameplayFlowCallbacks {
    playerFootHitZone(name: string, playerNode: Node, footInsetRatio: number, footHalfWidthRatio: number): boolean;
    zoneHit(name: string, playerNode: Node): boolean;
    updateZoneHighlight(name: string, highlighted: boolean): void;
    getCollectableWood(playerNode: Node): Node[];
    collectWood(woods: Node[]): void;
    canSellWoodToNpc(sellZoneHit: boolean): boolean;
    sellOneWood(): void;
    coinPlaneHasCoins(): boolean;
    collectPlaneCoins(): void;
    canUnlockCar(index: number): boolean;
    spendCoins(amount: number): void;
    unlockCar(index: number): boolean;
    canUpgradeCar(index: number, level: 2 | 3): boolean;
    upgradeCar(index: number, level: 2 | 3): boolean;
    areAllCarsFullyUpgraded(): boolean;
    showNotEnoughCoinsPrompt(target: Node): void;
    scheduleEndOverlay(delay: number): void;
}

export class GameplayFlowSystem {
    private sellCooldown = 0;
    private collectCooldown = 0;
    private readonly purchaseZoneHits = new Map<string, boolean>();

    constructor(
        private readonly getConfig: () => GameplayFlowConfig,
        private readonly callbacks: GameplayFlowCallbacks,
    ) {}

    update(dt: number) {
        this.sellCooldown = Math.max(0, this.sellCooldown - dt);
        this.collectCooldown = Math.max(0, this.collectCooldown - dt);
    }

    checkZones() {
        const config = this.getConfig();
        const playerNode = config.playerNode;
        if (!playerNode?.isValid) {
            return;
        }

        const sellZoneHit = this.callbacks.playerFootHitZone(
            'sell',
            playerNode,
            config.playerSellFootInsetRatio,
            config.playerSellFootHalfWidthRatio,
        );
        this.callbacks.updateZoneHighlight('sell', sellZoneHit);

        const carZoneNames = ['car', 'car2', 'car3'];
        const upgrade2ZoneNames = ['upgrade2', 'upgrade2Car2', 'upgrade2Car3'];
        const upgrade3ZoneNames = ['upgrade3', 'upgrade3Car2', 'upgrade3Car3'];
        const carZoneHits = carZoneNames.map((name) => this.callbacks.zoneHit(name, playerNode));
        const upgrade2ZoneHits = upgrade2ZoneNames.map((name) => this.callbacks.zoneHit(name, playerNode));
        const upgrade3ZoneHits = upgrade3ZoneNames.map((name) => this.callbacks.zoneHit(name, playerNode));
        carZoneNames.forEach((name, index) => this.callbacks.updateZoneHighlight(name, carZoneHits[index]));
        upgrade2ZoneNames.forEach((name, index) => this.callbacks.updateZoneHighlight(name, upgrade2ZoneHits[index]));
        upgrade3ZoneNames.forEach((name, index) => this.callbacks.updateZoneHighlight(name, upgrade3ZoneHits[index]));

        if (this.collectCooldown <= 0) {
            const collectableWood = this.callbacks.getCollectableWood(playerNode);
            if (collectableWood.length > 0) {
                this.collectCooldown = config.collectWoodCooldown;
                this.callbacks.collectWood(collectableWood);
            }
        }

        if (this.sellCooldown <= 0 && this.callbacks.canSellWoodToNpc(sellZoneHit)) {
            this.sellCooldown = config.sellWoodCooldown;
            this.callbacks.sellOneWood();
        }

        if (this.callbacks.zoneHit('coin', playerNode) && this.callbacks.coinPlaneHasCoins() && this.collectCooldown <= 0) {
            this.collectCooldown = config.collectCoinCooldown;
            this.callbacks.collectPlaneCoins();
        }

        carZoneNames.forEach((name, index) => {
            this.checkPurchaseZone(
                name,
                carZoneHits[index],
                config.carUnlockCost,
                () => this.callbacks.canUnlockCar(index),
                () => this.callbacks.unlockCar(index),
                playerNode,
            );
        });
        upgrade2ZoneNames.forEach((name, index) => {
            this.checkPurchaseZone(
                name,
                upgrade2ZoneHits[index],
                config.carUpgrade2Cost,
                () => this.callbacks.canUpgradeCar(index, 2),
                () => this.callbacks.upgradeCar(index, 2),
                playerNode,
            );
        });
        let completedFinalUpgrade = false;
        upgrade3ZoneNames.forEach((name, index) => {
            completedFinalUpgrade = this.checkPurchaseZone(
                name,
                upgrade3ZoneHits[index],
                config.carUpgrade3Cost,
                () => this.callbacks.canUpgradeCar(index, 3),
                () => this.callbacks.upgradeCar(index, 3),
                playerNode,
            ) || completedFinalUpgrade;
        });
        if (completedFinalUpgrade && config.endAfterFinalUpgrade && this.callbacks.areAllCarsFullyUpgraded()) {
            this.callbacks.scheduleEndOverlay(config.endOverlayDelay);
        }
    }

    private checkPurchaseZone(
        name: string,
        hit: boolean,
        cost: number,
        canPurchase: () => boolean,
        purchase: () => boolean,
        playerNode: Node,
    ) {
        if (!hit) {
            this.purchaseZoneHits.set(name, false);
            return false;
        }

        if (canPurchase()) {
            const purchased = purchase();
            if (!purchased) {
                this.purchaseZoneHits.set(name, true);
                return false;
            }
            this.callbacks.spendCoins(cost);
            this.purchaseZoneHits.set(name, true);
            return true;
        }

        if (!this.purchaseZoneHits.get(name)) {
            this.callbacks.showNotEnoughCoinsPrompt(playerNode);
        }
        this.purchaseZoneHits.set(name, true);
        return false;
    }
}
