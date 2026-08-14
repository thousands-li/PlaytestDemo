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
    carUnlockPlaneScale: number;
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
    buildTreeRoute(): { trees: Node[]; levels: import('./TreeSystem').TreeLevel[] } | null;
    rebuildTrees(nodes: Node[], levels?: import('./TreeSystem').TreeLevel[]): void;
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

        for (let index = 0; index < 3; index += 1) {
            this.buildUpgradePlane(index, 2, config);
            this.buildUpgradePlane(index, 3, config);
        }

        this.buildTrees(config);
        return { startPlaneNode: start, startPickupAnchor: startAnchor };
    }

    private buildUpgradePlane(index: number, level: 2 | 3, config: WorldSceneBuilderConfig) {
        const suffix = index === 0 ? '' : `Car${index + 1}`;
        const nodeName = `UpgradePlane${level}${suffix}`;
        const zoneName = `upgrade${level}${suffix}`;
        const configuredNode = index === 0
            ? (level === 2 ? config.upgrade2ZoneNode : config.upgrade3ZoneNode)
            : null;
        const plane = this.resolvePlaneNode(configuredNode, config, nodeName);
        if (!plane) {
            return;
        }
        const width = level === 2 ? 150 : 165;
        const height = level === 2 ? 92 : 100;
        const cost = level === 2 ? config.carUpgrade2Cost : config.carUpgrade3Cost;
        const radius = level === 2 ? config.upgrade2ZoneRadius : config.upgrade3ZoneRadius;
        this.uiFactory.setSpriteFrameAndSize(plane, config.platformImagePath, width, height);
        plane.setScale(1, 1, 1);
        plane.setSiblingIndex(plane.parent?.children.length ?? 0);
        this.uiFactory.addOrUpdateLabel(`UpgradeCost${level}`, plane, cost.toString(), 0, -2, 28, Color.WHITE);
        this.callbacks.addZone(zoneName, plane, radius);
        plane.active = false;
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
        const plane = this.resolvePlaneNode(configNode, config, nodeName);
        if (!plane?.isValid) {
            console.warn(`${nodeName} is missing in the scene.`);
            return null;
        }
        this.uiFactory.setupSpriteNode(plane, config.platformImagePath, 150, 92);
        const scale = Math.max(0.01, config.carUnlockPlaneScale);
        plane.setScale(scale, scale, 1);
        plane.setSiblingIndex(plane.parent?.children.length ?? 0);
        this.uiFactory.addOrUpdateLabel('CarCost', plane, config.carUnlockCost.toString(), 0, -2, 28, Color.WHITE);
        this.callbacks.addZone(zoneName, plane, config.carZoneRadius);
        plane.active = active;
        return plane;
    }

    private resolvePlaneNode(configNode: Node | null, config: WorldSceneBuilderConfig, nodeName: string) {
        if (!config.world?.isValid) {
            return null;
        }
        const existing = (configNode?.isValid ? configNode : null)
            ?? this.callbacks.findChildDeep(config.world, nodeName)
            ?? (config.actors?.isValid ? this.callbacks.findChildDeep(config.actors, nodeName) : null);
        return this.callbacks.resolveSceneNode(existing, config.world, nodeName);
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
        const routeTrees = this.callbacks.buildTreeRoute();
        if (routeTrees) {
            this.callbacks.rebuildTrees(routeTrees.trees, routeTrees.levels);
            return;
        }
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
