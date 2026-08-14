import { Node, Sprite, SpriteFrame } from 'cc';
import { AnimatedSprite } from './AnimatedSprite';

export interface CarActorFactoryConfig {
    carSpriteWidth: number;
    carSpriteHeight: number;
    carLevel1FramePrefix: string;
    carLevel2FramePrefix: string;
    carLevel3FramePrefix: string;
}

export interface CarActorFactoryCallbacks {
    ensureTransform(node: Node, width: number, height: number): { setContentSize(width: number, height: number): void };
    collectFrames(prefix: string): SpriteFrame[];
}

export class CarActorFactory {
    public constructor(
        private readonly getConfig: () => CarActorFactoryConfig,
        private readonly callbacks: CarActorFactoryCallbacks,
    ) {}

    public create(node: Node) {
        const config = this.getConfig();
        const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
        sprite.enabled = true;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.callbacks.ensureTransform(node, config.carSpriteWidth, config.carSpriteHeight)
            .setContentSize(config.carSpriteWidth, config.carSpriteHeight);

        const level1Frames = this.collectLevelFrames(1, config.carLevel1FramePrefix);
        const level2Frames = this.collectLevelFrames(2, config.carLevel2FramePrefix);
        const level3Frames = this.collectLevelFrames(3, config.carLevel3FramePrefix);
        const car = new AnimatedSprite(node, sprite);
        car.addClip('car1', level1Frames);
        car.addClip('car2', level2Frames);
        car.addClip('car3', level3Frames);
        return car;
    }

    private collectLevelFrames(level: 1 | 2 | 3, configuredPrefix: string) {
        const expectedPrefix = `images/characters/car/car_lv${level}_`;
        const prefix = configuredPrefix.includes(`car_lv${level}_`)
            ? configuredPrefix
            : expectedPrefix;
        const frames = this.callbacks.collectFrames(prefix);
        if (frames.length > 0) {
            return frames;
        }
        if (prefix !== expectedPrefix) {
            return this.callbacks.collectFrames(expectedPrefix);
        }
        return frames;
    }
}
