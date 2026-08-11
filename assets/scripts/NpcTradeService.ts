export interface NpcTradeDelivery {
    slotIndex: number;
    completesTrade: boolean;
}

export class NpcTradeService {
    private progressCount = 0;
    private resolvingTrade = false;

    public get progress() {
        return this.progressCount;
    }

    public get resolving() {
        return this.resolvingTrade;
    }

    public canSell(sellZoneHit: boolean, hasWood: boolean, hasActiveNpc: boolean, requirement: number) {
        return sellZoneHit
            && hasWood
            && !this.resolvingTrade
            && hasActiveNpc
            && this.progressCount < this.normalizeRequirement(requirement);
    }

    public deliverWood(requirement: number): NpcTradeDelivery | null {
        const normalizedRequirement = this.normalizeRequirement(requirement);
        if (this.resolvingTrade || this.progressCount >= normalizedRequirement) {
            return null;
        }

        const slotIndex = this.progressCount;
        this.progressCount += 1;
        const completesTrade = this.progressCount >= normalizedRequirement;
        if (completesTrade) {
            this.resolvingTrade = true;
        }

        return { slotIndex, completesTrade };
    }

    public remaining(requirement: number) {
        return Math.max(0, this.normalizeRequirement(requirement) - this.progressCount);
    }

    public isComplete(requirement: number) {
        return this.progressCount >= this.normalizeRequirement(requirement);
    }

    public resetProgress() {
        this.progressCount = 0;
    }

    public clearResolving() {
        this.resolvingTrade = false;
    }

    public normalizeRequirement(requirement: number) {
        return Math.max(1, Math.floor(requirement));
    }
}
