import { Color, LabelOutline, Node, UIOpacity } from 'cc';
import { GameUiFactory } from './GameUiFactory';

export interface WorldSceneBuilderConfig {
    world: Node | null;
    actors: Node | null;
    backgroundNode: Node | null;
    startZoneNode: Node | null;
    startPickupAnchor: Node | null;
    sellZoneNode: Node | null;
    coinZoneNode: Node | null;
    carZoneNode: Node | null;
    carZone2Node: Node | null;
    carZone3Node: Node | null;
    upgrade2ZoneNode: Node | null;
    upgrade3ZoneNode: Node | null;
    treeSceneNodes: Node[];
    backgroundImagePath: string;
    platformImagePath: string;
    sellPlatformImagePath: string;
    carUnlockCost: number;
    carUpgrade2Cost: number;
    carUpgrade3Cost: number;
    startZoneRadius: number;
    sellZoneRadius: number;
    coinZoneRadius: number;
    carZoneRadius: number;
    carPlane2OffsetX: number;
    carPlane2OffsetY: number;
    carPlane3OffsetX: number;
    carPlane3OffsetY: number;
    upgrade2ZoneRadius: number;
    upgrade3ZoneRadius: number;
    startGlowOpacity: number;
    showUpgradePrompt: boolean;
    upgradePromptText: string;
    upgradePromptOffsetX: number;
    upgradePromptOffsetY: number;
    upgradePromptWidth: number;
    upgradePromptFontSize: number;
    upgradePromptOutlineWidth: number;
}

export interface WorldSceneBuildResult {
    startPlaneNode: Node | null;
    startPickupAnchor: Node | null;
}

export interface WorldSceneBuilderCallbacks {
    resolveSceneNode(configNode: Node | null, parent: Node, name: string): Node;
    findChildDeep(parent: Node, name: string): Node | null;
    findNumberedChildren(parent: Node, prefix: string): Node[];
    addZone(name: string, node: Node, radius: number, matchNodeBounds?: boolean): void;
    rebuildTrees(nodes: Node[]): void;
}

export class WorldSceneBuilder {
    constructor(
        private readonly getConfig: () => WorldSceneBuilderConfig,
        private readonly uiFactory: GameUiFactory,
        private readonly callbacks: WorldSceneBuilderCallbacks,
    ) {}

    build(): WorldSceneBuildResult {
        const config = this.getConfig();
        if (!config.world?.isValid) {
            return { startPlaneNode: null, startPickupAnchor: null };
        }

        this.uiFactory.setupSpriteNode(
            this.callbacks.resolveSceneNode(config.backgroundNode, config.world, 'Background'),
            config.backgroundImagePath,
            1500,
            1500,
        );

        const start = this.callbacks.resolveSceneNode(config.startZoneNode, config.world, 'StartPlane');
        const startOpacity = start.getComponent(UIOpacity);
        if (startOpacity) {
            startOpacity.opacity = 255;
        }
        this.uiFactory.setupSpriteNode(start, config.platformImagePath, 190, 120);
        this.buildStartGlow(start, config);

        const startAnchor = this.callbacks.resolveSceneNode(config.startPickupAnchor, config.world, 'StartPickupAnchor');
        startAnchor.setPosition(start.position);
        startAnchor.active = true;
        this.callbacks.addZone('start', startAnchor, config.startZoneRadius);

        const sell = this.callbacks.resolveSceneNode(config.sellZoneNode, config.world, 'SellZone');
        this.uiFactory.setupSpriteNode(sell, config.sellPlatformImagePath, 195, 110);
        this.callbacks.addZone('sell', sell, config.sellZoneRadius, true);

        const coinPlane = this.callbacks.resolveSceneNode(config.coinZoneNode, config.world, 'CoinPlane');
        this.uiFactory.setupSpriteNode(coinPlane, config.platformImagePath, 150, 96);
        this.callbacks.addZone('coin', coinPlane, config.coinZoneRadius);

        this.buildCarPlane(config.carZoneNode, 'CarPlane', 'car', true, config);
        this.buildCarPlane(config.carZone2Node, 'CarPlane2', 'car2', false, config);
        this.buildCarPlane(config.carZone3Node, 'CarPlane3', 'car3', false, config);

        const upgrade2 = this.callbacks.resolveSceneNode(config.upgrade2ZoneNode, config.world, 'UpgradePlane2');
        this.uiFactory.setupSpriteNode(upgrade2, config.platformImagePath, 150, 92);
        this.uiFactory.addOrUpdateLabel('UpgradeCost2', upgrade2, config.carUpgrade2Cost.toString(), 0, -2, 28, Color.WHITE);
        this.callbacks.addZone('upgrade2', upgrade2, config.upgrade2ZoneRadius);
        upgrade2.active = false;

        const upgrade3 = this.callbacks.resolveSceneNode(config.upgrade3ZoneNode, config.world, 'UpgradePlane3');
        this.uiFactory.setupSpriteNode(upgrade3, config.platformImagePath, 165, 100);
        this.uiFactory.addOrUpdateLabel('UpgradeCost3', upgrade3, config.carUpgrade3Cost.toString(), 0, -2, 28, Color.WHITE);
        this.callbacks.addZone('upgrade3', upgrade3, config.upgrade3ZoneRadius);
        upgrade3.active = false;

        this.buildTrees(config);
        return { startPlaneNode: start, startPickupAnchor: startAnchor };
    }

    private buildStartGlow(start: Node, config: WorldSceneBuilderConfig) {
        const startGlow = start.getChildByName('StartGlow');
        if (startGlow?.isValid) {
            startGlow.removeFromParent();
            startGlow.destroy();
        }
        if (config.startGlowOpacity > 0) {
            this.uiFactory.drawRoundRect(
                'StartGlow',
                start,
                0,
                0,
                180,
                110,
                16,
                new Color(115, 210, 255, this.clamp(config.startGlowOpacity, 0, 255)),
            );
        }
    }

    private buildCarPlane(
        configNode: Node | null,
        nodeName: string,
        zoneName: string,
        active: boolean,
        config: WorldSceneBuilderConfig,
    ) {
        const plane = configNode ?? this.callbacks.findChildDeep(config.world!, nodeName);
        if (!plane?.isValid) {
            console.warn(`${nodeName} is missing in the scene. Add it under World instead of creating it at runtime.`);
            return null;
        }
        this.uiFactory.setupSpriteNode(plane, config.platformImagePath, 150, 92);
        this.uiFactory.addOrUpdateLabel('CarCost', plane, config.carUnlockCost.toString(), 0, -2, 28, Color.WHITE);
        this.callbacks.addZone(zoneName, plane, config.carZoneRadius);
        plane.active = active;
        return plane;
    }

    private buildUpgradePrompt(plane: Node, config: WorldSceneBuilderConfig) {
        const existingPrompt = plane.getChildByName('UpgradePrompt');
        if (!config.showUpgradePrompt) {
            if (existingPrompt?.isValid) {
                existingPrompt.removeFromParent();
                existingPrompt.destroy();
            }
            return;
        }

        const prompt = existingPrompt ?? this.uiFactory.makeNode('UpgradePrompt', plane);
        prompt.setPosition(config.upgradePromptOffsetX, config.upgradePromptOffsetY, 0);
        this.uiFactory.ensureTransform(prompt, config.upgradePromptWidth, config.upgradePromptFontSize * 2 + 16)
            .setContentSize(config.upgradePromptWidth, config.upgradePromptFontSize * 2 + 16);

        const label = this.uiFactory.getOrCreateLabel(prompt, config.upgradePromptText, config.upgradePromptFontSize, new Color(255, 42, 42, 255));
        label.fontSize = config.upgradePromptFontSize;
        label.lineHeight = config.upgradePromptFontSize;

        const outline = prompt.getComponent(LabelOutline) ?? prompt.addComponent(LabelOutline);
        outline.color = Color.WHITE;
        outline.width = config.upgradePromptOutlineWidth;
    }

    private buildTrees(config: WorldSceneBuilderConfig) {
        if (!config.actors?.isValid) {
            this.callbacks.rebuildTrees(config.treeSceneNodes);
            return;
        }
        const nodes = config.treeSceneNodes.length > 0
            ? config.treeSceneNodes
            : this.callbacks.findNumberedChildren(config.actors, 'Tree');
        this.callbacks.rebuildTrees(nodes);
    }

    private clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value));
    }
}
