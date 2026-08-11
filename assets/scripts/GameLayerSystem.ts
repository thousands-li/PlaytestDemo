import { Node } from 'cc';
import { GameUiFactory } from './GameUiFactory';
import { SceneNodeResolver } from './SceneNodeResolver';

export interface GameLayerConfig {
    gameRootNode: Node | null;
    worldNode: Node | null;
    actorsNode: Node | null;
    uiNode: Node | null;
    overlayNode: Node | null;
    designWidth: number;
    designHeight: number;
}

export interface GameLayers {
    root: Node;
    world: Node;
    actors: Node;
    ui: Node;
    overlay: Node;
}

export class GameLayerSystem {
    public constructor(
        private readonly getConfig: () => GameLayerConfig,
        private readonly sceneNodes: SceneNodeResolver,
        private readonly uiFactory: GameUiFactory,
    ) {}

    public build(owner: Node): GameLayers {
        const config = this.getConfig();
        const root = this.sceneNodes.resolve(config.gameRootNode, owner, 'GameRoot');
        const world = this.sceneNodes.resolve(config.worldNode, root, 'World');
        const actors = this.sceneNodes.resolve(config.actorsNode, root, 'Actors');
        const ui = this.sceneNodes.resolve(config.uiNode, root, 'UI');
        const overlay = this.sceneNodes.resolve(config.overlayNode, root, 'Overlay');

        this.uiFactory.ensureTransform(root, config.designWidth, config.designHeight).setContentSize(config.designWidth, config.designHeight);
        this.uiFactory.ensureTransform(ui, config.designWidth, config.designHeight).setContentSize(config.designWidth, config.designHeight);
        this.uiFactory.ensureTransform(overlay, config.designWidth, config.designHeight).setContentSize(config.designWidth, config.designHeight);
        this.sceneNodes.syncLayer(root, owner.layer);

        return { root, world, actors, ui, overlay };
    }
}
