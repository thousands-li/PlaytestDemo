import { Node, Sprite, SpriteFrame } from 'cc';

export class AnimatedSprite {
    public node: Node;
    private sprite: Sprite;
    private clips = new Map<string, SpriteFrame[]>();
    private clipName = '';
    private frameIndex = 0;
    private elapsed = 0;

    constructor(node: Node, sprite: Sprite) {
        this.node = node;
        this.sprite = sprite;
    }

    addClip(name: string, frames: SpriteFrame[]) {
        this.clips.set(name, frames);
        if (!this.clipName && frames.length > 0) {
            this.play(name);
        }
    }

    play(name: string) {
        const frames = this.clips.get(name);
        if (!frames || frames.length === 0) {
            return false;
        }
        if (this.clipName === name) {
            this.sprite.spriteFrame = frames[this.frameIndex] ?? frames[0];
            return true;
        }
        this.clipName = name;
        this.frameIndex = 0;
        this.elapsed = 0;
        this.sprite.spriteFrame = frames[0];
        return true;
    }

    frameCount(name: string) {
        return this.clips.get(name)?.length ?? 0;
    }

    update(dt: number, fps = 10) {
        const frames = this.clips.get(this.clipName);
        if (!frames || frames.length <= 1) {
            return;
        }
        this.elapsed += dt;
        const frameTime = 1 / fps;
        while (this.elapsed >= frameTime) {
            this.elapsed -= frameTime;
            this.frameIndex = (this.frameIndex + 1) % frames.length;
            this.sprite.spriteFrame = frames[this.frameIndex];
        }
    }
}
