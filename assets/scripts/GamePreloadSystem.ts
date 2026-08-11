import { DIRECTION_NAMES } from './Direction';
import { GameAssetService } from './GameAssetService';

export interface GamePreloadConfig {
    backgroundImagePath: string;
    logoImagePath: string;
    playNowImagePath: string;
    arrowImagePath: string;
    targetArrowImagePath: string;
    counterPanelImagePath: string;
    platformImagePath: string;
    purchasePlatformHighlightImagePath: string;
    sellPlatformImagePath: string;
    sellPlatformHighlightImagePath: string;
    treeLevel1ImagePath: string;
    treeLevel2ImagePath: string;
    treeLevel3ImagePath: string;
    stumpSmallImagePath: string;
    stumpLargeImagePath: string;
    coinImagePath: string;
    woodImagePath: string;
    joystickBaseImagePath: string;
    joystickKnobImagePath: string;
    playerFootRingImagePath: string;
    playerIdleFramePrefix: string;
    playerWalkFramePrefix: string;
    npcIdleFramePrefix: string;
    npcWalkInFramePrefix: string;
    npcWalkOutFramePrefix: string;
    carLevel1FramePrefix: string;
    carLevel2FramePrefix: string;
    carLevel3FramePrefix: string;
    animationFrameCount: number;
    levelUpEffectFolder: string;
    levelUpEffectFramesCsv: string;
    bgmAudioName: string;
    coinAudioName: string;
    cutTreeAudioName: string;
    sellAudioName: string;
    carAudioName: string;
    uiAudioName: string;
    errorAudioName: string;
    audioFolder: string;
}

export interface GamePreloadCallbacks {
    getPlayerWoodImagePaths(): string[];
    getTreeWoodDropImagePaths(): string[];
    getPlayerCoinImagePaths(): string[];
    getNpcBubbleImagePaths(): string[];
    setLoadingProgress(progress: number): void;
}

export class GamePreloadSystem {
    public constructor(
        private readonly getConfig: () => GamePreloadConfig,
        private readonly assets: GameAssetService,
        private readonly callbacks: GamePreloadCallbacks,
    ) {}

    public async load() {
        const config = this.getConfig();
        await this.assets.loadSpriteFrames(
            [...this.collectStaticImages(config), ...this.collectFrameImages(config)],
            (progress) => this.callbacks.setLoadingProgress(0.1 + 0.7 * progress),
        );

        await this.assets.loadAudioClips(
            [
                config.bgmAudioName,
                config.coinAudioName,
                config.cutTreeAudioName,
                config.sellAudioName,
                config.carAudioName,
                config.uiAudioName,
                config.errorAudioName,
            ],
            config.audioFolder,
            (progress) => this.callbacks.setLoadingProgress(0.8 + 0.18 * progress),
        );
    }

    private collectStaticImages(config: GamePreloadConfig) {
        return [
            config.backgroundImagePath,
            config.logoImagePath,
            config.playNowImagePath,
            config.arrowImagePath,
            config.targetArrowImagePath,
            config.counterPanelImagePath,
            config.platformImagePath,
            config.purchasePlatformHighlightImagePath,
            config.sellPlatformImagePath,
            config.sellPlatformHighlightImagePath,
            config.treeLevel1ImagePath,
            config.treeLevel2ImagePath,
            config.treeLevel3ImagePath,
            config.stumpSmallImagePath,
            config.stumpLargeImagePath,
            config.coinImagePath,
            config.woodImagePath,
            ...this.callbacks.getPlayerWoodImagePaths(),
            ...this.callbacks.getTreeWoodDropImagePaths(),
            ...this.callbacks.getPlayerCoinImagePaths(),
            ...this.callbacks.getNpcBubbleImagePaths(),
            config.joystickBaseImagePath,
            config.joystickKnobImagePath,
            config.playerFootRingImagePath,
        ];
    }

    private collectFrameImages(config: GamePreloadConfig) {
        return [
            ...this.assets.framePaths(config.playerIdleFramePrefix, DIRECTION_NAMES, config.animationFrameCount),
            ...this.assets.framePaths(config.playerWalkFramePrefix, DIRECTION_NAMES, config.animationFrameCount),
            ...this.assets.framePaths(config.npcIdleFramePrefix, [''], config.animationFrameCount),
            ...this.assets.framePaths(config.npcWalkInFramePrefix, [''], config.animationFrameCount),
            ...this.assets.framePaths(config.npcWalkOutFramePrefix, [''], config.animationFrameCount),
            ...this.assets.framePaths(config.carLevel1FramePrefix, [''], config.animationFrameCount),
            ...this.assets.framePaths(config.carLevel2FramePrefix, [''], config.animationFrameCount),
            ...this.assets.framePaths(config.carLevel3FramePrefix, [''], config.animationFrameCount),
            ...this.assets.parseCsvNames(config.levelUpEffectFramesCsv).map((name) => `${config.levelUpEffectFolder}/${name}`),
        ];
    }
}
