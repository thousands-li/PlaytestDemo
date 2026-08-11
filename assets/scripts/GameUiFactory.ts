import {
    Color,
    Graphics,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    tween,
    UITransform,
    Vec3,
} from 'cc';

export interface GameUiFactoryCallbacks {
    getSpriteFrame(path: string): SpriteFrame | undefined;
    getPulseHalfDuration(): number;
}

export class GameUiFactory {
    constructor(private readonly callbacks: GameUiFactoryCallbacks) {}

    makeNode(name: string, parent: Node, x = 0, y = 0) {
        const node = new Node(name);
        parent.addChild(node);
        node.layer = parent.layer;
        node.setPosition(x, y, 0);
        return node;
    }

    ensureTransform(node: Node, width: number, height: number) {
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        if (transform.contentSize.width <= 0 || transform.contentSize.height <= 0) {
            transform.setContentSize(width, height);
        }
        return transform;
    }

    setupSpriteNode(node: Node, framePath: string, width: number, height: number) {
        this.ensureTransform(node, width, height);
        const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const frame = this.callbacks.getSpriteFrame(framePath);
        if (frame) {
            sprite.spriteFrame = frame;
        }
        return node;
    }

    setupSpriteNodePreserveAspect(node: Node, framePath: string, width: number, height: number) {
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
        const frame = this.callbacks.getSpriteFrame(framePath);
        let finalWidth = Math.max(1, width);
        let finalHeight = Math.max(1, height);

        if (frame) {
            sprite.spriteFrame = frame;
            const sourceSize = frame.originalSize.width > 0 && frame.originalSize.height > 0
                ? frame.originalSize
                : frame.rect;
            if (sourceSize.width > 0 && sourceSize.height > 0) {
                const scale = Math.min(finalWidth / sourceSize.width, finalHeight / sourceSize.height);
                finalWidth = sourceSize.width * scale;
                finalHeight = sourceSize.height * scale;
            }
        }

        transform.setContentSize(finalWidth, finalHeight);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        return node;
    }

    setSpriteFrameAndSize(node: Node, framePath: string, width: number, height: number) {
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setContentSize(width, height);
        const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const frame = this.callbacks.getSpriteFrame(framePath);
        if (frame) {
            sprite.spriteFrame = frame;
        }
    }

    setupRoundRectNode(node: Node, width: number, height: number, radius: number, color: Color) {
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setContentSize(width, height);
        const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
        graphics.clear();
        graphics.fillColor = color;
        if (radius > 0) {
            graphics.roundRect(-width / 2, -height / 2, width, height, radius);
        } else {
            graphics.rect(-width / 2, -height / 2, width, height);
        }
        graphics.fill();
        return node;
    }

    addSprite(name: string, framePath: string, parent: Node, x: number, y: number, width: number, height: number) {
        const node = this.makeNode(name, parent, x, y);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(width, height);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const frame = this.callbacks.getSpriteFrame(framePath);
        if (frame) {
            sprite.spriteFrame = frame;
        }
        return node;
    }

    addLabel(name: string, parent: Node, text: string, x: number, y: number, size: number, color: Color) {
        const node = this.makeNode(name, parent, x, y);
        node.addComponent(UITransform).setContentSize(260, size + 16);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 8;
        label.color = color;
        return label;
    }

    addOrUpdateLabel(name: string, parent: Node, text: string, x: number, y: number, size: number, color: Color) {
        const node = parent.getChildByName(name);
        if (node) {
            return this.getOrCreateLabel(node, text, size, color);
        }
        return this.addLabel(name, parent, text, x, y, size, color);
    }

    getOrCreateLabel(node: Node, text: string, size: number, color: Color) {
        this.ensureTransform(node, 260, size + 16);
        const existingLabel = node.getComponent(Label);
        const label = existingLabel ?? node.addComponent(Label);
        label.string = text;
        if (!existingLabel) {
            label.fontSize = size;
            label.lineHeight = size + 8;
        }
        label.color = color;
        return label;
    }

    drawRoundRect(name: string, parent: Node, x: number, y: number, width: number, height: number, radius: number, color: Color) {
        const node = this.makeNode(name, parent, x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = color;
        if (radius > 0) {
            graphics.roundRect(-width / 2, -height / 2, width, height, radius);
        } else {
            graphics.rect(-width / 2, -height / 2, width, height);
        }
        graphics.fill();
        return node;
    }

    pulse(node: Node, scale: number) {
        const pulseHalfDuration = this.callbacks.getPulseHalfDuration();
        const baseScale = node.scale.clone();
        const targetScale = new Vec3(baseScale.x * scale, baseScale.y * scale, baseScale.z);
        const pulse = tween(node)
            .repeatForever(
                tween()
                    .to(pulseHalfDuration, { scale: targetScale })
                    .to(pulseHalfDuration, { scale: baseScale }),
            )
            .start();
        return pulse;
    }
}
