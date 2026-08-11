import { NpcTradeService } from './NpcTradeService';
import { NpcVisualController, type NpcVisualActor } from './NpcVisualController';

export interface NpcBubbleConfig {
    woodPerNpcTrade: number;
}

export class NpcBubbleCoordinator<T extends NpcVisualActor> {
    public constructor(
        private readonly getConfig: () => NpcBubbleConfig,
        private readonly npcTrade: NpcTradeService,
        private readonly npcVisual: NpcVisualController<T>,
    ) {}

    public applyQueueBubble(npc: T, index: number) {
        const totalRequirement = this.totalWoodRequirement();
        this.npcVisual.applyQueueBubble(npc, index, this.remainingWoodRequirement(totalRequirement), totalRequirement);
    }

    private totalWoodRequirement() {
        return this.npcTrade.normalizeRequirement(this.getConfig().woodPerNpcTrade);
    }

    private remainingWoodRequirement(totalRequirement = this.totalWoodRequirement()) {
        return this.npcTrade.remaining(totalRequirement);
    }
}
