import { Button, Color, Label, Node, tween, Vec3 } from 'cc';
import { GameUiFactory } from './GameUiFactory';

export interface OverlaySystemConfig {
    overlay: Node | null;
    designWidth: number;
    designHeight: number;
    loadingText: string;
    playNowImagePath: string;
    startTitleText: string;
    startTipText: string;
    startButtonPulseScale: number;
    endTitleText: string;
    endSubText: string;
    endButtonPulseScale: number;
    endPanelStartScale: number;
    endPanelPopScale: number;
    endPanelPopDuration: number;
    endPanelSettleDuration: number;
}

export class OverlaySystem {
    private loadingLabel: Label | null = null;
    private loadingBar: Node | null = null;

    constructor(
        private readonly getConfig: () => OverlaySystemConfig,
        private readonly uiFactory: GameUiFactory,
    ) {}

    clear() {
        const overlay = this.getConfig().overlay;
        if (!overlay?.isValid) {
            return;
        }
        overlay.removeAllChildren();
        overlay.active = false;
    }

    showLoading() {
        const config = this.getConfig();
        const overlay = this.prepareOverlay(config);
        if (!overlay) {
            return;
        }
        const panel = this.uiFactory.drawRoundRect('LoadingPanel', overlay, 0, 0, 360, 92, 10, new Color(35, 42, 50, 220));
        this.loadingLabel = this.uiFactory.addLabel('LoadingLabel', panel, config.loadingText, 0, 18, 24, new Color(240, 245, 255, 255));
        this.loadingBar = this.uiFactory.drawRoundRect('LoadingBar', panel, 0, -22, 260, 16, 8, new Color(93, 188, 68, 255));
        this.loadingBar.setScale(0.08, 1, 1);
    }

    setLoadingText(text: string) {
        if (this.loadingLabel) {
            this.loadingLabel.string = text;
        }
    }

    setLoadingProgress(value: number) {
        this.loadingBar?.setScale(Math.max(0.08, value), 1, 1);
    }

    showStart(onStart: () => void) {
        const config = this.getConfig();
        const overlay = this.prepareOverlay(config);
        if (!overlay) {
            return;
        }
        overlay.removeAllChildren();
        this.uiFactory.drawRoundRect('StartDim', overlay, 0, 0, config.designWidth, config.designHeight, 0, new Color(0, 0, 0, 115));
        const panel = this.uiFactory.drawRoundRect('StartPanel', overlay, 0, -18, 420, 210, 16, new Color(35, 47, 53, 225));
        this.uiFactory.addLabel('StartTitle', panel, config.startTitleText, 0, 62, 40, new Color(255, 255, 255, 255));
        this.uiFactory.addLabel('StartTip', panel, config.startTipText, 0, 20, 22, new Color(235, 246, 228, 255));
        const play = this.uiFactory.addSprite('StartPlayNow', config.playNowImagePath, panel, 0, -55, 240, 88);
        play.addComponent(Button);
        play.on(Node.EventType.TOUCH_END, onStart);
        this.uiFactory.pulse(play, config.startButtonPulseScale);
    }

    showEnd(onOpenStore: () => void) {
        const config = this.getConfig();
        const overlay = this.prepareOverlay(config);
        if (!overlay) {
            return;
        }
        overlay.removeAllChildren();
        this.uiFactory.drawRoundRect('EndDim', overlay, 0, 0, config.designWidth, config.designHeight, 0, new Color(0, 0, 0, 145));
        const btn = this.uiFactory.addSprite('EndPlayNow', config.playNowImagePath, overlay, 0, 0, 300, 112);
        btn.addComponent(Button);
        btn.on(Node.EventType.TOUCH_END, onOpenStore);
        btn.setScale(config.endPanelStartScale, config.endPanelStartScale, 1);
        tween(btn)
            .to(config.endPanelPopDuration, { scale: new Vec3(config.endPanelPopScale, config.endPanelPopScale, 1) })
            .to(config.endPanelSettleDuration, { scale: Vec3.ONE })
            .call(() => this.uiFactory.pulse(btn, config.endButtonPulseScale))
            .start();
    }

    private prepareOverlay(config: OverlaySystemConfig) {
        const overlay = config.overlay;
        if (!overlay?.isValid) {
            return null;
        }
        overlay.active = true;
        if (overlay.parent) {
            overlay.setSiblingIndex(overlay.parent.children.length - 1);
        }
        return overlay;
    }
}
