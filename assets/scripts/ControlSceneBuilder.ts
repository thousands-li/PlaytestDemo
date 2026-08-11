import { Node, Sprite, UITransform } from 'cc';
import { GameUiFactory } from './GameUiFactory';

export interface ControlSceneBuilderConfig {
    root: Node | null;
    ui: Node | null;
    actors: Node | null;
    joystickBaseNode: Node | null;
    joystickKnobNode: Node | null;
    guideArrowNode: Node | null;
    joystickBaseImagePath: string;
    joystickKnobImagePath: string;
    arrowImagePath: string;
    targetArrowImagePath: string;
    playerArrowWidth: number;
    playerArrowHeight: number;
    targetArrowWidth: number;
    targetArrowHeight: number;
}

export interface ControlSceneBuilderCallbacks {
    resolveSceneNode(configNode: Node | null, parent: Node, name: string): Node;
    bindJoystick(base: Node, knob: Node): void;
    bindGuide(playerArrow: Node, targetArrow: Node): void;
    setInitialGuideStage(): void;
}

export class ControlSceneBuilder {
    constructor(
        private readonly getConfig: () => ControlSceneBuilderConfig,
        private readonly uiFactory: GameUiFactory,
        private readonly callbacks: ControlSceneBuilderCallbacks,
    ) {}

    build() {
        const config = this.getConfig();
        if (!config.ui?.isValid) {
            return;
        }

        this.buildJoystick(config);
        this.buildGuideArrow(config);
    }

    private buildJoystick(config: ControlSceneBuilderConfig) {
        const joystickBase = this.callbacks.resolveSceneNode(config.joystickBaseNode, config.ui!, 'JoystickBase');
        this.uiFactory.setupSpriteNode(joystickBase, config.joystickBaseImagePath, 160, 160);
        const joystickKnob = this.callbacks.resolveSceneNode(config.joystickKnobNode, config.ui!, 'JoystickKnob');
        this.uiFactory.setupSpriteNode(joystickKnob, config.joystickKnobImagePath, 72, 72);
        this.callbacks.bindJoystick(joystickBase, joystickKnob);
    }

    private buildGuideArrow(config: ControlSceneBuilderConfig) {
        const guideParent = config.root?.isValid ? config.root : config.ui!;
        const guideRoot = this.callbacks.resolveSceneNode(config.guideArrowNode, guideParent, 'GuideArrow');
        if (guideRoot.parent !== guideParent) {
            guideRoot.setParent(guideParent);
        }
        guideRoot.layer = guideParent.layer;
        this.placeGuideRootBeforeActors(guideRoot, config);
        guideRoot.removeAllChildren();
        guideRoot.active = true;
        guideRoot.setPosition(0, 0, 0);
        guideRoot.setScale(1, 1, 1);
        guideRoot.setRotationFromEuler(0, 0, 0);
        this.matchGuideRootSizeToUi(guideRoot, config);

        const rootSprite = guideRoot.getComponent(Sprite);
        if (rootSprite) {
            rootSprite.enabled = false;
        }

        const playerGuideArrow = this.uiFactory.addSprite(
            'GuidePlayerArrow',
            config.arrowImagePath,
            guideRoot,
            0,
            0,
            config.playerArrowWidth,
            config.playerArrowHeight,
        );
        const targetGuideArrow = this.uiFactory.addSprite(
            'GuideTargetArrow',
            config.targetArrowImagePath,
            guideRoot,
            0,
            0,
            config.targetArrowWidth,
            config.targetArrowHeight,
        );
        this.callbacks.bindGuide(playerGuideArrow, targetGuideArrow);
        this.callbacks.setInitialGuideStage();
    }

    private placeGuideRootBeforeActors(guideRoot: Node, config: ControlSceneBuilderConfig) {
        const actors = config.actors;
        if (!actors?.isValid || actors.parent !== guideRoot.parent) {
            return;
        }

        const guideIndex = guideRoot.getSiblingIndex();
        const actorIndex = actors.getSiblingIndex();
        const targetIndex = guideIndex >= 0 && guideIndex < actorIndex
            ? actorIndex - 1
            : actorIndex;
        guideRoot.setSiblingIndex(Math.max(0, targetIndex));
    }

    private matchGuideRootSizeToUi(guideRoot: Node, config: ControlSceneBuilderConfig) {
        const uiTransform = config.ui?.getComponent(UITransform);
        const width = Math.max(1, uiTransform?.contentSize.width ?? 1);
        const height = Math.max(1, uiTransform?.contentSize.height ?? 1);
        this.uiFactory.ensureTransform(guideRoot, width, height).setContentSize(width, height);
    }
}
