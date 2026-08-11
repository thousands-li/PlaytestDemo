import { Node, tween, UIOpacity, Vec3 } from 'cc';

export interface StartAreaConfig {
    startPlaneDisappearPopScale: number;
    startPlaneDisappearEndScale: number;
    startPlaneDisappearPopDuration: number;
    startPlaneDisappearFadeDuration: number;
}

export class StartAreaSystem {
    private startPlaneNode: Node | null = null;
    private startPlaneDisappearing = false;

    public constructor(private readonly getConfig: () => StartAreaConfig) {}

    public reset(startPlaneNode: Node | null) {
        this.startPlaneNode = startPlaneNode;
        this.startPlaneDisappearing = false;
    }

    public destroyStartPlaneIfInitialWoodGone(hasInitialWood: boolean) {
        if (hasInitialWood || !this.startPlaneNode || this.startPlaneDisappearing) {
            return;
        }
        const startPlane = this.startPlaneNode;
        this.startPlaneNode = null;
        this.startPlaneDisappearing = true;
        if (startPlane.isValid) {
            this.hideStartPlaneWithAnimation(startPlane);
        }
    }

    private hideStartPlaneWithAnimation(startPlane: Node) {
        const config = this.getConfig();
        const opacity = startPlane.getComponent(UIOpacity) ?? startPlane.addComponent(UIOpacity);
        const originalScale = startPlane.scale.clone();
        const popScale = this.makeScaledVec3(originalScale, config.startPlaneDisappearPopScale);
        const endScale = this.makeScaledVec3(originalScale, config.startPlaneDisappearEndScale);
        const popDuration = Math.max(0.01, config.startPlaneDisappearPopDuration);
        const fadeDuration = Math.max(0.01, config.startPlaneDisappearFadeDuration);
        opacity.opacity = 255;

        tween(startPlane)
            .to(popDuration, { scale: popScale }, { easing: 'quadOut' })
            .to(fadeDuration, { scale: endScale }, { easing: 'quadIn' })
            .call(() => {
                if (startPlane.isValid) {
                    startPlane.destroy();
                }
            })
            .start();

        tween(opacity)
            .delay(popDuration * 0.35)
            .to(popDuration * 0.65 + fadeDuration, { opacity: 0 }, { easing: 'quadIn' })
            .start();
    }

    private makeScaledVec3(value: Vec3, scale: number) {
        return new Vec3(value.x * scale, value.y * scale, value.z);
    }
}
