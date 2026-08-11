import { Node, Sprite, SpriteFrame, tween, UITransform, Vec3 } from 'cc';
import { AnimatedSprite } from './AnimatedSprite';

export interface GameEffectConfig {
    actors: Node | null;
    flyDuration: number;
    flyEndScale: number;
    effectFps: number;
    levelUpEffectOffsetY: number;
    levelUpEffectLifetime: number;
    levelUpEffectWidth: number;
    levelUpEffectHeight: number;
    levelUpEffectFolder: string;
    levelUpEffectFramesCsv: string;
}

export interface GameEffectCallbacks {
    makeNode(name: string, parent: Node, x?: number, y?: number): Node;
    ensureTransform(node: Node, width: number, height: number): UITransform;
    parseCsvNames(csv: string): string[];
    collectFramesFromPaths(paths: string[]): SpriteFrame[];
}

export class GameEffectSystem {
    private floatingNodes: Node[] = [];
    private effects: AnimatedSprite[] = [];

    constructor(
        private readonly getConfig: () => GameEffectConfig,
        private readonly callbacks: GameEffectCallbacks,
    ) {}

    update(dt: number) {
        const config = this.getConfig();
        this.effects.forEach((effect) => effect.update(dt, config.effectFps));
    }

    spawnUpgradeEffect(pos: Vec3) {
        const config = this.getConfig();
        if (!config.actors?.isValid) {
            return;
        }
        const node = this.callbacks.makeNode('LevelUpEffect', config.actors, pos.x, pos.y + config.levelUpEffectOffsetY);
        const sprite = node.addComponent(Sprite);
        this.callbacks.ensureTransform(node, config.levelUpEffectWidth, config.levelUpEffectHeight);
        const effect = new AnimatedSprite(node, sprite);
        effect.addClip('run', this.callbacks.collectFramesFromPaths(
            this.callbacks.parseCsvNames(config.levelUpEffectFramesCsv).map((name) => `${config.levelUpEffectFolder}/${name}`),
        ));
        effect.play('run');
        this.effects.push(effect);
        tween(node).delay(config.levelUpEffectLifetime).call(() => {
            const index = this.effects.indexOf(effect);
            if (index >= 0) {
                this.effects.splice(index, 1);
            }
            node.destroy();
        }).start();
    }

    flyNode(node: Node, target: Node, delay: number, done: () => void, duration = this.getConfig().flyDuration) {
        const config = this.getConfig();
        if (!config.actors?.isValid) {
            done();
            return;
        }
        const worldPos = target.worldPosition;
        const localTarget = config.actors.getComponent(UITransform)?.convertToNodeSpaceAR(worldPos) ?? target.position;
        node.setParent(config.actors, true);
        this.flyToPosition(node, localTarget, delay, done, config.flyEndScale, duration);
    }

    flyToPosition(
        node: Node,
        target: Vec3,
        delay: number,
        done: () => void,
        endScale = this.getConfig().flyEndScale,
        duration = this.getConfig().flyDuration,
    ) {
        this.addFloating(node);
        tween(node)
            .delay(delay)
            .to(duration, { position: target, scale: new Vec3(endScale, endScale, 1) })
            .call(() => {
                this.removeFloating(node);
                done();
            })
            .start();
    }

    addFloating(node: Node) {
        this.floatingNodes.push(node);
    }

    removeFloating(node: Node) {
        const index = this.floatingNodes.indexOf(node);
        if (index >= 0) {
            this.floatingNodes.splice(index, 1);
        }
    }

    isFloating(node: Node) {
        return this.floatingNodes.indexOf(node) >= 0;
    }
}
