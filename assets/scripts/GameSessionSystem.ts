import { AudioService } from './AudioService';
import { OverlaySystem } from './OverlaySystem';
import { StoreLinkService } from './StoreLinkService';

export type GamePhase = 'loading' | 'start' | 'playing' | 'ended';

export interface GameSessionConfig {
    uiAudioName: string;
}

export interface GameSessionCallbacks {
    onEnd(): void;
}

export class GameSessionSystem {
    private phase: GamePhase = 'loading';

    public constructor(
        private readonly getConfig: () => GameSessionConfig,
        private readonly overlaySystem: OverlaySystem,
        private readonly audioService: AudioService,
        private readonly storeLinks: StoreLinkService,
        private readonly callbacks: GameSessionCallbacks,
    ) {}

    public get isPlaying() {
        return this.phase === 'playing';
    }

    public get isEnded() {
        return this.phase === 'ended';
    }

    public showLoading() {
        this.phase = 'loading';
        this.overlaySystem.showLoading();
    }

    public setLoadingText(text: string) {
        this.overlaySystem.setLoadingText(text);
    }

    public showStart() {
        this.overlaySystem.showStart(() => this.startGame());
        this.phase = 'start';
    }

    public showEnd() {
        if (this.phase === 'ended') {
            return;
        }
        this.phase = 'ended';
        this.callbacks.onEnd();
        this.audioService.playEffect(this.getConfig().uiAudioName);
        this.overlaySystem.showEnd(() => this.storeLinks.open());
    }

    private startGame() {
        if (this.phase !== 'start') {
            return;
        }
        this.overlaySystem.clear();
        this.phase = 'playing';
    }
}
