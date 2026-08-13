import { Node } from 'cc';
import { AnimatedSprite } from './AnimatedSprite';
import { AudioService } from './AudioService';
import { CarSystem } from './CarSystem';
import { CoinPlaneSystem } from './CoinPlaneSystem';
import { EconomyService } from './EconomyService';
import { GameEffectSystem } from './GameEffectSystem';
import { type Direction } from './Direction';
import { GuideSystem, type TutorialGuideStage } from './GuideSystem';
import { NpcFlowSystem } from './NpcFlowSystem';
import { NpcQueueSystem } from './NpcQueueSystem';
import { NpcTradeService } from './NpcTradeService';
import { NpcVisualController } from './NpcVisualController';
import { PlayerCarryVisualController } from './PlayerCarryVisualController';
import { TreeSystem, type TreeLevel, type TreeSlot } from './TreeSystem';
import { TreeWoodDropSystem } from './TreeWoodDropSystem';
import { WoodCollectionSystem } from './WoodCollectionSystem';

export interface GameplayActionConfig {
    actors: Node | null;
    playerNode: Node | null;
    woodCollectDelay: number;
    sellWoodFlyDuration: number;
    coinCollectDelay: number;
    woodPerNpcTrade: number;
    carBaseWoodGain: number;
    carLevelWoodGain: number;
    carUnlockCost: number;
    carUpgrade2Cost: number;
    carUpgrade3Cost: number;
    coinAudioName: string;
    sellAudioName: string;
    cutTreeAudioName: string;
}

export interface GameplayActionCallbacks {
    setTutorialGuideStage(stage: TutorialGuideStage): void;
    activateTreeWoodGuideIfWaiting(): void;
    destroyStartPlaneIfInitialWoodGone(): void;
}

export class GameplayActionSystem {
    constructor(
        private readonly getConfig: () => GameplayActionConfig,
        private readonly economy: EconomyService,
        private readonly guideSystem: GuideSystem,
        private readonly audioService: AudioService,
        private readonly effectSystem: GameEffectSystem,
        private readonly playerCarry: PlayerCarryVisualController,
        private readonly woodCollection: WoodCollectionSystem,
        private readonly npcQueue: NpcQueueSystem<AnimatedSprite>,
        private readonly npcFlow: NpcFlowSystem<AnimatedSprite>,
        private readonly npcTrade: NpcTradeService,
        private readonly npcVisual: NpcVisualController<AnimatedSprite>,
        private readonly coinPlane: CoinPlaneSystem,
        private readonly treeSystem: TreeSystem,
        private readonly treeWoodDrops: TreeWoodDropSystem,
        private readonly carSystem: CarSystem<AnimatedSprite>,
        private readonly callbacks: GameplayActionCallbacks,
    ) {}

    public collectWood(woods: Node[]) {
        const config = this.getConfig();
        const playerNode = config.playerNode;
        if (!playerNode?.isValid) {
            return;
        }

        const collectable = this.woodCollection.collect(woods);
        const collectedInitialWood = collectable.some((item) => item.isInitial);
        const collectedTreeWood = collectable.some((item) => !item.isInitial);

        collectable.forEach(({ wood, isInitial }, i) => {
            if (!isInitial) {
                this.treeWoodDrops.removeWood(wood);
            }
            this.effectSystem.flyNode(wood, playerNode, config.woodCollectDelay * i, () => {
                wood.destroy();
                this.addHeldWood();
                this.audioService.playEffect(config.coinAudioName);
                if (isInitial) {
                    this.woodCollection.completeInitialWoodCollection(wood);
                    this.callbacks.destroyStartPlaneIfInitialWoodGone();
                }
            }, config.sellWoodFlyDuration);
        });
        if (collectedInitialWood && this.guideSystem.isStage('initialWood')) {
            this.callbacks.setTutorialGuideStage('initialSell');
        } else if (collectedTreeWood && this.guideSystem.isStage('treeWood')) {
            this.callbacks.setTutorialGuideStage('treeSell');
        }
    }

    public sellOneWood() {
        const npc = this.npcQueue.front();
        if (!npc || !npc.node.isValid) {
            return;
        }
        const fallbackWoodIndex = Math.max(0, this.economy.wood - 1);
        const fallbackHadBothCarryTypes = this.economy.wood > 0 && this.economy.coins > 0;
        if (this.economy.spendWood() <= 0) {
            return;
        }
        const delivery = this.npcTrade.deliverWood(this.getConfig().woodPerNpcTrade);
        if (!delivery) {
            this.economy.addWood();
            return;
        }
        const wood = this.playerCarry.takeWoodForSale(`SoldWood${Date.now()}`, fallbackWoodIndex, fallbackHadBothCarryTypes);
        this.audioService.playEffect(this.getConfig().sellAudioName);
        this.flyWoodToNpc(wood, npc, delivery.slotIndex, () => {
            this.npcVisual.addHeldWood(npc, wood, delivery.slotIndex);
            this.updateNpcBubble();
            if (delivery.completesTrade) {
                this.finishNpcTrade();
            }
        }, this.getConfig().sellWoodFlyDuration);
    }

    public collectPlaneCoins() {
        const config = this.getConfig();
        const playerNode = config.playerNode;
        if (!playerNode?.isValid) {
            return;
        }

        const collectableCoins = this.coinPlane.collectCoins();
        if (collectableCoins.length > 0) {
            this.audioService.playEffect(config.coinAudioName);
        }
        collectableCoins.forEach((coin, i) => {
            if (!coin.isValid) {
                return;
            }
            this.effectSystem.flyNode(coin, playerNode, i * config.coinCollectDelay, () => {
                coin.destroy();
                this.addHeldCoin();
            });
        });
        if (this.guideSystem.isStage('firstCoins')) {
            this.setGuideStageAfterCoinCollect(collectableCoins.length);
        }
    }

    public cutTree(tree: TreeSlot, carLevel: TreeLevel) {
        const config = this.getConfig();
        if (!this.treeSystem.cut(tree)) {
            return;
        }
        this.audioService.playEffect(config.cutTreeAudioName);
        const gain = config.carBaseWoodGain + carLevel * config.carLevelWoodGain;
        this.treeWoodDrops.spawnFromTree(tree, gain, (wood) => {
            this.woodCollection.addDroppedWood(wood);
            this.callbacks.activateTreeWoodGuideIfWaiting();
        });
    }

    public spawnInitialWood(count: number) {
        this.woodCollection.spawnInitialWood(count);
        this.callbacks.destroyStartPlaneIfInitialWoodGone();
    }

    public spawnCoinsOnPlane(count: number, sourceNode?: Node) {
        const config = this.getConfig();
        const result = this.coinPlane.spawn(count, sourceNode);
        if (result.spawnedCount > 0) {
            this.audioService.playEffect(config.coinAudioName);
        }
        return result.duration;
    }

    public spendCoins(amount: number) {
        const spent = this.economy.spendCoins(amount);
        this.playerCarry.removeCoins(spent);
    }

    public unlockCar(index = 0) {
        return this.carSystem.unlock(index);
    }

    public upgradeCar(index: number, level: 2 | 3) {
        return this.carSystem.upgrade(index, level);
    }

    private addHeldWood() {
        const heldWood = this.economy.addWood();
        this.playerCarry.addWood(heldWood);
    }

    private addHeldCoin() {
        const heldCoins = this.economy.addCoins();
        this.playerCarry.addCoin(heldCoins);
    }

    private finishNpcTrade() {
        this.npcTrade.resetProgress();
        this.npcFlow.walkFirstAway(() => {
            this.npcTrade.clearResolving();
        });
        if (this.guideSystem.isAnyStage(['initialSell', 'treeSell'])) {
            this.callbacks.setTutorialGuideStage('firstCoins');
        }
    }

    private updateNpcBubble() {
        const requirement = this.npcTrade.normalizeRequirement(this.getConfig().woodPerNpcTrade);
        this.npcVisual.updateFrontBubble(
            this.npcQueue.front(),
            this.npcTrade.isComplete(requirement),
            this.npcTrade.remaining(requirement),
            requirement,
        );
    }

    private flyWoodToNpc(wood: Node, npc: AnimatedSprite, slotIndex: number, done: () => void, duration = this.getConfig().sellWoodFlyDuration) {
        if (!wood.isValid || !npc.node.isValid) {
            done();
            return;
        }
        const direction = this.npcVisual.getCarryDirection(npc.node);
        const target = this.npcVisual.getCarryItemActorsPosition(npc.node, slotIndex, direction);
        wood.setParent(this.getConfig().actors ?? wood.parent, true);
        this.playerCarry.applyWoodVisualForDirection(wood, direction as Direction);
        this.effectSystem.flyToPosition(wood, target, 0, done, 1, duration);
    }

    private setGuideStageAfterCoinCollect(collectedCoinCount: number) {
        const projectedCoins = this.economy.projectCoins(collectedCoinCount);
        const config = this.getConfig();
        if (this.carSystem.hasUnlockTarget(projectedCoins >= config.carUnlockCost)) {
            this.callbacks.setTutorialGuideStage('carUnlock');
            return;
        }
        if (this.carSystem.hasUpgradeTarget(2, projectedCoins >= config.carUpgrade2Cost)) {
            this.callbacks.setTutorialGuideStage('upgrade2');
            return;
        }
        if (this.carSystem.hasUpgradeTarget(3, projectedCoins >= config.carUpgrade3Cost)) {
            this.callbacks.setTutorialGuideStage('upgrade3');
            return;
        }
        this.callbacks.setTutorialGuideStage('waitTreeWood');
    }
}
