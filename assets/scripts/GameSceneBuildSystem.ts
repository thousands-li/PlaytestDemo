import { Node } from 'cc';
import { AnimatedSprite } from './AnimatedSprite';
import { AudioService } from './AudioService';
import { CameraFollowSystem } from './CameraFollowSystem';
import { CarSystem } from './CarSystem';
import { ControlSceneBuilder } from './ControlSceneBuilder';
import { GameplayActionSystem } from './GameplayActionSystem';
import { HudSystem } from './HudSystem';
import { NpcSceneBuilder } from './NpcSceneBuilder';
import { OverlaySystem } from './OverlaySystem';
import { PlayerFootRingSystem } from './PlayerFootRingSystem';
import { PlayerSceneBuilder } from './PlayerSceneBuilder';
import { SellZoneVisualSystem } from './SellZoneVisualSystem';
import { StartAreaSystem } from './StartAreaSystem';
import { TreeWoodDropSystem } from './TreeWoodDropSystem';
import { WorldSceneBuilder } from './WorldSceneBuilder';

export interface GameSceneBuildConfig {
    initialStartWoodCount: number;
    bgmAudioName: string;
}

export interface GameSceneBuildCallbacks {
    setStartPickupAnchor(node: Node | null): void;
    setPlayer(playerNode: Node, player: AnimatedSprite): void;
    setNpcRoute(entryNode: Node | null, exitNode: Node | null): void;
}

export class GameSceneBuildSystem {
    public constructor(
        private readonly getConfig: () => GameSceneBuildConfig,
        private readonly overlaySystem: OverlaySystem,
        private readonly worldBuilder: WorldSceneBuilder,
        private readonly startArea: StartAreaSystem,
        private readonly sellZoneVisual: SellZoneVisualSystem,
        private readonly playerSceneBuilder: PlayerSceneBuilder,
        private readonly playerFootRing: PlayerFootRingSystem,
        private readonly carSystem: CarSystem<AnimatedSprite>,
        private readonly treeWoodDrops: TreeWoodDropSystem,
        private readonly npcSceneBuilder: NpcSceneBuilder,
        private readonly hudSystem: HudSystem,
        private readonly controlSceneBuilder: ControlSceneBuilder,
        private readonly gameplayActions: GameplayActionSystem,
        private readonly cameraFollow: CameraFollowSystem,
        private readonly audioService: AudioService,
        private readonly callbacks: GameSceneBuildCallbacks,
    ) {}

    public build() {
        const config = this.getConfig();
        this.overlaySystem.clear();
        const worldBuild = this.worldBuilder.build();
        this.treeWoodDrops.prepareSceneMarkers();
        this.startArea.reset(worldBuild.startPlaneNode);
        this.callbacks.setStartPickupAnchor(worldBuild.startPickupAnchor);
        this.sellZoneVisual.reset();
        this.buildPlayer();
        this.playerFootRing.build();
        this.carSystem.prepareSceneNode();
        this.buildNpcQueue();
        this.hudSystem.build();
        this.controlSceneBuilder.build();
        this.gameplayActions.spawnInitialWood(config.initialStartWoodCount);
        this.cameraFollow.update(0, true);
        this.audioService.playMusic(config.bgmAudioName);
    }

    private buildPlayer() {
        const result = this.playerSceneBuilder.build();
        if (!result.playerNode || !result.player) {
            throw new Error('Player scene could not be built.');
        }
        this.callbacks.setPlayer(result.playerNode, result.player);
    }

    private buildNpcQueue() {
        const result = this.npcSceneBuilder.buildQueue();
        this.callbacks.setNpcRoute(result.entryNode, result.exitNode);
    }
}
