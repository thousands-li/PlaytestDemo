import { Node, Sprite, SpriteFrame } from 'cc';

export interface SellZoneVisualConfig {
    platformImagePath: string;
    purchasePlatformHighlightImagePath: string;
    sellPlatformImagePath: string;
    sellPlatformHighlightImagePath: string;
}

export interface SellZoneVisualCallbacks {
    getZoneNode(name: string): Node | null;
    getSpriteFrame(path: string): SpriteFrame | null;
}

export class SellZoneVisualSystem {
    private readonly highlightedZones = new Map<string, boolean>();

    public constructor(
        private readonly getConfig: () => SellZoneVisualConfig,
        private readonly callbacks: SellZoneVisualCallbacks,
    ) {}

    public reset() {
        this.highlightedZones.clear();
        ['sell', 'car', 'car2', 'car3', 'upgrade2', 'upgrade3'].forEach((name) => this.updateZoneHighlight(name, false));
    }

    public updateHighlight(highlighted: boolean) {
        this.updateZoneHighlight('sell', highlighted);
    }

    public updateZoneHighlight(name: string, highlighted: boolean) {
        if (this.highlightedZones.get(name) === highlighted) {
            return;
        }
        const config = this.getConfig();
        const zone = this.callbacks.getZoneNode(name);
        const sprite = zone?.isValid ? zone.getComponent(Sprite) : null;
        const frame = this.callbacks.getSpriteFrame(this.getFramePath(name, highlighted, config));
        if (!sprite || !frame) {
            return;
        }
        sprite.spriteFrame = frame;
        this.highlightedZones.set(name, highlighted);
    }

    private getFramePath(name: string, highlighted: boolean, config: SellZoneVisualConfig) {
        if (name === 'sell') {
            return highlighted ? config.sellPlatformHighlightImagePath : config.sellPlatformImagePath;
        }
        return highlighted ? config.purchasePlatformHighlightImagePath : config.platformImagePath;
    }
}
