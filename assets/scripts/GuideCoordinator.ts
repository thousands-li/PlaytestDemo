import { Node } from 'cc';
import { GuideSystem, type GuideSystemConfig, type GuideSystemTargets, type TutorialGuideStage } from './GuideSystem';

type GuideZoneName = Parameters<GuideSystemTargets['getZoneTarget']>[0];

export interface GuideCoordinatorConfig extends GuideSystemConfig {
    isPlaying: boolean;
    uiNode: Node | null;
    playerNode: Node | null;
}

export interface GuideCoordinatorCallbacks {
    getZoneTarget(name: GuideZoneName): Node | null;
    getWoodTarget(initialOnly: boolean): Node | null;
    getCoinTarget(): Node | null;
    getInitialWoodNodes(): Node[];
}

export class GuideCoordinator {
    public constructor(
        private readonly getConfig: () => GuideCoordinatorConfig,
        private readonly guideSystem: GuideSystem,
        private readonly callbacks: GuideCoordinatorCallbacks,
    ) {}

    public bind(playerArrow: Node, targetArrow: Node) {
        this.guideSystem.bind(playerArrow, targetArrow);
    }

    public update(dt: number) {
        const config = this.getConfig();
        this.guideSystem.update(dt, config.isPlaying, this.createTargets(config), config);
    }

    public setStage(stage: TutorialGuideStage) {
        this.guideSystem.setStage(stage, this.createTargets(this.getConfig()));
    }

    public activateTreeWoodIfWaiting() {
        this.guideSystem.activateTreeWoodIfWaiting(this.createTargets(this.getConfig()));
    }

    public isStage(stage: TutorialGuideStage) {
        return this.guideSystem.isStage(stage);
    }

    private createTargets(config: GuideCoordinatorConfig): GuideSystemTargets {
        return {
            uiNode: config.uiNode,
            playerNode: config.playerNode,
            getZoneTarget: (name) => this.callbacks.getZoneTarget(name),
            getWoodTarget: (initialOnly) => this.callbacks.getWoodTarget(initialOnly),
            getCoinTarget: () => this.callbacks.getCoinTarget(),
            getInitialWoodNodes: () => this.callbacks.getInitialWoodNodes(),
        };
    }
}
