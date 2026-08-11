import { Label } from 'cc';

export class EconomyService {
    private woodCount = 0;
    private coinCount = 0;
    private coinLabel: Label | null = null;
    private woodLabel: Label | null = null;

    public get wood() {
        return this.woodCount;
    }

    public get coins() {
        return this.coinCount;
    }

    public bindCounters(coinLabel: Label, woodLabel: Label) {
        this.coinLabel = coinLabel;
        this.woodLabel = woodLabel;
        this.updateCounters();
    }

    public addWood(amount = 1) {
        this.woodCount += this.normalizeAmount(amount);
        this.updateCounters();
        return this.woodCount;
    }

    public addCoins(amount = 1) {
        this.coinCount += this.normalizeAmount(amount);
        this.updateCounters();
        return this.coinCount;
    }

    public spendWood(amount = 1) {
        const count = this.normalizeAmount(amount);
        if (count <= 0 || this.woodCount < count) {
            return 0;
        }

        this.woodCount -= count;
        this.updateCounters();
        return count;
    }

    public spendCoins(amount: number) {
        const count = this.normalizeAmount(amount);
        if (count <= 0) {
            this.updateCounters();
            return 0;
        }

        if (this.coinCount < count) {
            return 0;
        }

        this.coinCount -= count;
        this.updateCounters();
        return count;
    }

    public hasWood(amount = 1) {
        return this.woodCount >= this.normalizeAmount(amount);
    }

    public hasCoins(amount: number) {
        return this.coinCount >= this.normalizeAmount(amount);
    }

    public projectCoins(incoming: number) {
        return this.coinCount + this.normalizeAmount(incoming);
    }

    private updateCounters() {
        if (this.coinLabel) {
            this.coinLabel.string = this.coinCount.toString();
        }
        if (this.woodLabel) {
            this.woodLabel.string = this.woodCount.toString();
        }
    }

    private normalizeAmount(amount: number) {
        return Math.max(0, Math.floor(amount));
    }
}
