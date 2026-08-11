import { Color, Label, LabelOutline, Node, UIOpacity, UITransform, Vec3 } from 'cc';

interface PromptInstance {
    node: Node;
    target: Node;
    age: number;
    duration: number;
    offsetY: number;
    startScale: number;
    endScale: number;
}

export interface PromptEffectConfig {
    actors: Node | null;
    promptDuration: number;
    promptOffsetY: number;
    promptStartScale: number;
    promptEndScale: number;
    promptWidth: number;
    promptHeight: number;
    promptFontSize: number;
    promptOutlineWidth: number;
}

export interface PromptEffectCallbacks {
    makeNode(name: string, parent: Node, x?: number, y?: number): Node;
    ensureTransform(node: Node, width: number, height: number): UITransform;
}

export class PromptEffectSystem {
    private readonly prompts: PromptInstance[] = [];

    public constructor(
        private readonly getConfig: () => PromptEffectConfig,
        private readonly callbacks: PromptEffectCallbacks,
    ) {}

    public spawn(text: string, target: Node | null) {
        const config = this.getConfig();
        const actors = config.actors;
        if (!actors?.isValid || !target?.isValid) {
            return;
        }

        const position = this.getTargetActorsPosition(target, actors, config.promptOffsetY);
        const node = this.callbacks.makeNode(`Prompt${Date.now()}`, actors, position.x, position.y);
        this.callbacks.ensureTransform(node, config.promptWidth, config.promptHeight)
            .setContentSize(config.promptWidth, config.promptHeight);

        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = config.promptFontSize;
        label.lineHeight = config.promptFontSize;
        label.color = new Color(255, 0, 0, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        const outline = node.addComponent(LabelOutline);
        outline.color = Color.WHITE;
        outline.width = config.promptOutlineWidth;

        const opacity = node.addComponent(UIOpacity);
        opacity.opacity = 255;

        node.setScale(config.promptStartScale, config.promptStartScale, 1);
        this.prompts.push({
            node,
            target,
            age: 0,
            duration: Math.max(0.01, config.promptDuration),
            offsetY: config.promptOffsetY,
            startScale: Math.max(0.01, config.promptStartScale),
            endScale: Math.max(0.01, config.promptEndScale),
        });
    }

    public update(dt: number) {
        const config = this.getConfig();
        const actors = config.actors;
        if (!actors?.isValid) {
            this.destroyAll();
            return;
        }

        for (let i = this.prompts.length - 1; i >= 0; i -= 1) {
            const prompt = this.prompts[i];
            if (!prompt.node.isValid || !prompt.target.isValid) {
                this.destroyPrompt(i);
                continue;
            }

            prompt.age += dt;
            if (prompt.age >= prompt.duration) {
                this.destroyPrompt(i);
                continue;
            }

            const t = this.clamp01(prompt.age / prompt.duration);
            const position = this.getTargetActorsPosition(prompt.target, actors, prompt.offsetY);
            prompt.node.setPosition(position);

            const scaleT = this.easeOutBack(this.clamp01(t / 0.72));
            const scale = this.lerp(prompt.startScale, prompt.endScale, scaleT);
            prompt.node.setScale(scale, scale, 1);

            const opacity = prompt.node.getComponent(UIOpacity);
            if (opacity) {
                opacity.opacity = Math.floor(255 * (1 - this.clamp01((t - 0.68) / 0.32)));
            }
            prompt.node.setSiblingIndex(prompt.node.parent!.children.length - 1);
        }
    }

    private destroyAll() {
        for (let i = this.prompts.length - 1; i >= 0; i -= 1) {
            this.destroyPrompt(i);
        }
    }

    private destroyPrompt(index: number) {
        const [prompt] = this.prompts.splice(index, 1);
        if (prompt?.node.isValid) {
            prompt.node.destroy();
        }
    }

    private getTargetActorsPosition(target: Node, actors: Node, offsetY: number) {
        if (target.parent === actors) {
            return new Vec3(target.position.x, target.position.y + offsetY, 0);
        }
        const local = actors.getComponent(UITransform)?.convertToNodeSpaceAR(target.worldPosition) ?? target.position;
        return new Vec3(local.x, local.y + offsetY, 0);
    }

    private easeOutBack(t: number) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    private lerp(a: number, b: number, t: number) {
        return a + (b - a) * t;
    }

    private clamp01(value: number) {
        return Math.min(1, Math.max(0, value));
    }
}
