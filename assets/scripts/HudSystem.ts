import { Button, Color, Label, LabelOutline, Node, UITransform, Vec3, view } from 'cc';
import { GameUiFactory } from './GameUiFactory';

const COUNTER_PANEL_REFERENCE_WIDTH = 252;
const COUNTER_PANEL_REFERENCE_HEIGHT = 152;
const COUNTER_SLOT_CONTENT_WIDTH = 151;
const COUNTER_SLOT_CONTENT_HEIGHT = 44;
const COUNTER_SLOT_FONT_RATIO = 0.86;

export interface HudSystemConfig {
    ui: Node | null;
    logoNode: Node | null;
    playNowNode: Node | null;
    topPlayNowNode: Node | null;
    resourceCounterPanelNode: Node | null;
    coinCounterLabelNode: Node | null;
    woodCounterLabelNode: Node | null;
    logoImagePath: string;
    playNowImagePath: string;
    playNowPulseScale: number;
    counterPanelImagePath: string;
    counterBgWidth: number;
    counterBgHeight: number;
    counterPanelMarginRight: number;
    counterPanelMarginTop: number;
    counterLabelOffsetX: number;
    coinCounterLabelOffsetY: number;
    woodCounterLabelOffsetY: number;
    counterFontSize: number;
    showDragToMoveTip: boolean;
    dragToMoveTipText: string;
    dragToMoveTipX: number;
    dragToMoveTipY: number;
    dragToMoveTipWidth: number;
    dragToMoveTipFontSize: number;
    dragToMoveTipOutlineWidth: number;
    hideDragTipAfterInitialWood: boolean;
    isPlaying: boolean;
    isEnded: boolean;
    isInitialWoodGuide: boolean;
}

export interface HudSystemCallbacks {
    resolveSceneNode(configNode: Node | null, parent: Node, name: string): Node;
    findChildDeep(parent: Node, name: string): Node | null;
    bindCounters(coinLabel: Label, woodLabel: Label): void;
    openStore(): void;
    setResourceCounterPanelNode(node: Node): void;
}

export class HudSystem {
    private counterPanel: Node | null = null;
    private dragToMoveTipNode: Node | null = null;
    private logoNode: Node | null = null;
    private playNowNode: Node | null = null;
    private topPlayNowNode: Node | null = null;
    private logoAnchor: { left: number; top: number } | null = null;
    private topPlayNowAnchor: { right: number; top: number } | null = null;
    private playNowBaseScale: Vec3 | null = null;
    private playNowPulse: { stop(): void } | null = null;
    private readonly handlePlayNowTouch = () => this.callbacks.openStore();

    constructor(
        private readonly getConfig: () => HudSystemConfig,
        private readonly uiFactory: GameUiFactory,
        private readonly callbacks: HudSystemCallbacks,
    ) {}

    build() {
        const config = this.getConfig();
        if (!config.ui) {
            return;
        }

        const logo = this.resolveExistingHudNode(config.logoNode, config.ui, 'Logo');
        if (logo) {
            this.logoNode = this.uiFactory.setupSpriteNode(logo, config.logoImagePath, 245, 116);
            this.logoAnchor = this.captureTopLeftAnchor(this.logoNode, config.ui);
            this.layoutLogo();
        }

        this.buildScenePlayNow(config);

        const cta = this.resolveExistingHudNode(config.topPlayNowNode, config.ui, 'TopPlayNow');
        if (cta) {
            this.topPlayNowNode = this.uiFactory.setupSpriteNode(cta, config.playNowImagePath, 185, 70);
            this.topPlayNowAnchor = this.captureTopRightAnchor(this.topPlayNowNode, config.ui);
            this.bindPlayNowButton(this.topPlayNowNode);
            this.layoutTopPlayNow();
            this.updateTopPlayNowVisibility();
        }

        const counterPanel = this.callbacks.resolveSceneNode(
            config.resourceCounterPanelNode
                ?? this.callbacks.findChildDeep(config.ui, 'ResourceCounterPanel')
                ?? this.callbacks.findChildDeep(config.ui, 'CoinCounterBg'),
            config.ui,
            'ResourceCounterPanel',
        );
        counterPanel.name = 'ResourceCounterPanel';
        counterPanel.setParent(config.ui, false);
        this.counterPanel = counterPanel;
        this.callbacks.setResourceCounterPanelNode(counterPanel);
        this.uiFactory.setupSpriteNodePreserveAspect(counterPanel, config.counterPanelImagePath, config.counterBgWidth, config.counterBgHeight);
        this.hideLegacyCounterNodes(config.ui, counterPanel);
        this.layoutResourceCounterPanel();

        const coinLabelNode = this.callbacks.resolveSceneNode(
            config.coinCounterLabelNode ?? this.callbacks.findChildDeep(config.ui, 'CoinCounter'),
            counterPanel,
            'CoinCounter',
        );
        coinLabelNode.setParent(counterPanel, false);
        coinLabelNode.setPosition(config.counterLabelOffsetX, config.coinCounterLabelOffsetY, 0);
        const coinLabel = this.setupCounterLabel(coinLabelNode, '0', counterPanel);

        const woodLabelNode = this.callbacks.resolveSceneNode(
            config.woodCounterLabelNode ?? this.callbacks.findChildDeep(config.ui, 'WoodCounter'),
            counterPanel,
            'WoodCounter',
        );
        woodLabelNode.setParent(counterPanel, false);
        woodLabelNode.setPosition(config.counterLabelOffsetX, config.woodCounterLabelOffsetY, 0);
        const woodLabel = this.setupCounterLabel(woodLabelNode, '0', counterPanel);
        this.callbacks.bindCounters(coinLabel, woodLabel);

        this.buildDragToMoveTip();
    }

    update() {
        this.layoutLogo();
        this.layoutTopPlayNow();
        this.updateTopPlayNowVisibility();
        this.layoutResourceCounterPanel();
        this.updateDragToMoveTip();
    }

    private resolveExistingHudNode(configNode: Node | null, ui: Node, name: string) {
        const node = configNode?.isValid ? configNode : this.callbacks.findChildDeep(ui, name);
        if (node && node.parent !== ui) {
            node.setParent(ui, false);
        }
        return node;
    }

    private buildScenePlayNow(config: HudSystemConfig) {
        if (!config.ui) {
            return;
        }

        const node = this.resolveExistingHudNode(config.playNowNode, config.ui, 'playnow_en');
        if (!node) {
            return;
        }

        const previousNode = this.playNowNode;
        this.playNowNode = this.uiFactory.setupSpriteNode(node, config.playNowImagePath, 200, 68);
        this.playNowNode.active = true;
        this.bindPlayNowButton(this.playNowNode);

        if (previousNode !== this.playNowNode) {
            this.playNowPulse?.stop();
            this.playNowPulse = null;
            this.playNowBaseScale = this.playNowNode.scale.clone();
        }

        this.playNowNode.setScale(this.playNowBaseScale ?? this.playNowNode.scale);
        this.playNowPulse?.stop();
        this.playNowPulse = this.uiFactory.pulse(this.playNowNode, Math.max(1, config.playNowPulseScale));
    }

    private bindPlayNowButton(node: Node) {
        const button = node.getComponent(Button) ?? node.addComponent(Button);
        button.interactable = true;
        node.off(Node.EventType.TOUCH_END, this.handlePlayNowTouch);
        node.on(Node.EventType.TOUCH_END, this.handlePlayNowTouch);
    }

    private captureTopLeftAnchor(node: Node, ui: Node) {
        const nodeTransform = node.getComponent(UITransform);
        const uiTransform = ui.getComponent(UITransform);
        if (!nodeTransform || !uiTransform) {
            return null;
        }

        const nodeSize = nodeTransform.contentSize;
        const uiSize = uiTransform.contentSize;
        return {
            left: node.position.x + uiSize.width / 2 - nodeSize.width / 2,
            top: uiSize.height / 2 - node.position.y - nodeSize.height / 2,
        };
    }

    private captureTopRightAnchor(node: Node, ui: Node) {
        const nodeTransform = node.getComponent(UITransform);
        const uiTransform = ui.getComponent(UITransform);
        if (!nodeTransform || !uiTransform) {
            return null;
        }

        const nodeSize = nodeTransform.contentSize;
        const uiSize = uiTransform.contentSize;
        return {
            right: uiSize.width / 2 - node.position.x - nodeSize.width / 2,
            top: uiSize.height / 2 - node.position.y - nodeSize.height / 2,
        };
    }

    private layoutLogo() {
        if (!this.logoNode?.isValid || !this.logoAnchor) {
            return;
        }

        const transform = this.logoNode.getComponent(UITransform);
        const visibleSize = view.getVisibleSize();
        const width = transform?.contentSize.width ?? 0;
        const height = transform?.contentSize.height ?? 0;
        this.logoNode.setPosition(
            -visibleSize.width / 2 + this.logoAnchor.left + width / 2,
            visibleSize.height / 2 - this.logoAnchor.top - height / 2,
            0,
        );
    }

    private layoutTopPlayNow() {
        if (!this.topPlayNowNode?.isValid || !this.topPlayNowAnchor) {
            return;
        }

        const transform = this.topPlayNowNode.getComponent(UITransform);
        const visibleSize = view.getVisibleSize();
        const width = transform?.contentSize.width ?? 0;
        const height = transform?.contentSize.height ?? 0;
        this.topPlayNowNode.setPosition(
            visibleSize.width / 2 - this.topPlayNowAnchor.right - width / 2,
            visibleSize.height / 2 - this.topPlayNowAnchor.top - height / 2,
            0,
        );
    }

    private updateTopPlayNowVisibility() {
        if (!this.topPlayNowNode?.isValid) {
            return;
        }

        this.topPlayNowNode.active = this.getConfig().isEnded;
    }

    private setupCounterLabel(node: Node, text: string, panel: Node) {
        const config = this.getConfig();
        const labelSize = this.getCounterLabelSize(panel, config);
        const fontSize = Math.max(18, Math.min(config.counterFontSize, Math.floor(labelSize.height * COUNTER_SLOT_FONT_RATIO)));
        const label = this.uiFactory.getOrCreateLabel(node, text, fontSize, Color.WHITE);
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setContentSize(labelSize.width, labelSize.height);
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 2;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        return label;
    }

    private getCounterLabelSize(panel: Node, config: HudSystemConfig) {
        const panelSize = panel.getComponent(UITransform)?.contentSize;
        const panelWidth = panelSize?.width || config.counterBgWidth;
        const panelHeight = panelSize?.height || config.counterBgHeight;
        return {
            width: Math.max(80, COUNTER_SLOT_CONTENT_WIDTH * (panelWidth / COUNTER_PANEL_REFERENCE_WIDTH)),
            height: Math.max(28, COUNTER_SLOT_CONTENT_HEIGHT * (panelHeight / COUNTER_PANEL_REFERENCE_HEIGHT)),
        };
    }

    private buildDragToMoveTip() {
        const config = this.getConfig();
        if (!config.ui) {
            return;
        }

        const tip = this.callbacks.resolveSceneNode(this.callbacks.findChildDeep(config.ui, 'DragToMoveTip'), config.ui, 'DragToMoveTip');
        tip.setParent(config.ui, false);
        tip.setPosition(config.dragToMoveTipX, config.dragToMoveTipY, 0);
        this.uiFactory.ensureTransform(tip, config.dragToMoveTipWidth, config.dragToMoveTipFontSize + 18)
            .setContentSize(config.dragToMoveTipWidth, config.dragToMoveTipFontSize + 18);

        const label = this.uiFactory.getOrCreateLabel(tip, config.dragToMoveTipText, config.dragToMoveTipFontSize, Color.WHITE);
        label.fontSize = config.dragToMoveTipFontSize;
        label.lineHeight = config.dragToMoveTipFontSize + 8;

        const outline = tip.getComponent(LabelOutline) ?? tip.addComponent(LabelOutline);
        outline.color = new Color(0, 0, 0, 230);
        outline.width = config.dragToMoveTipOutlineWidth;

        this.dragToMoveTipNode = tip;
        this.updateDragToMoveTip();
    }

    private updateDragToMoveTip() {
        const config = this.getConfig();
        if (!this.dragToMoveTipNode?.isValid) {
            return;
        }
        this.dragToMoveTipNode.setPosition(config.dragToMoveTipX, config.dragToMoveTipY, 0);
        this.dragToMoveTipNode.active = this.shouldShowDragToMoveTip(config);
    }

    private shouldShowDragToMoveTip(config: HudSystemConfig) {
        if (!config.showDragToMoveTip || !config.isPlaying) {
            return false;
        }
        return !config.hideDragTipAfterInitialWood || config.isInitialWoodGuide;
    }

    private layoutResourceCounterPanel() {
        const config = this.getConfig();
        const panel = this.counterPanel?.isValid ? this.counterPanel : config.resourceCounterPanelNode;
        if (!panel || !panel.isValid || !config.ui?.isValid) {
            return;
        }

        if (panel.parent !== config.ui) {
            panel.setParent(config.ui, false);
        }

        const panelTransform = panel.getComponent(UITransform);
        const uiTransform = config.ui.getComponent(UITransform);
        const visibleSize = uiTransform?.contentSize ?? view.getVisibleSize();
        const panelWidth = panelTransform?.contentSize.width || config.counterBgWidth;
        const panelHeight = panelTransform?.contentSize.height || config.counterBgHeight;

        panel.setPosition(
            visibleSize.width / 2 - config.counterPanelMarginRight - panelWidth / 2,
            visibleSize.height / 2 - config.counterPanelMarginTop - panelHeight / 2,
            0,
        );
    }

    private hideLegacyCounterNodes(ui: Node, counterPanel: Node) {
        const legacyNames = ['CoinCounterBg', 'WoodCounterBg', 'CoinCounterIcon', 'WoodCounterIcon'];
        for (const name of legacyNames) {
            const node = this.callbacks.findChildDeep(ui, name);
            if (node && node !== counterPanel) {
                node.active = false;
            }
        }
    }
}
