import { AudioClip, AudioSource, Node } from 'cc';

export interface AudioServiceCallbacks {
    getAudioClip(name: string): AudioClip | null;
}

export class AudioService {
    private audioSource: AudioSource | null = null;

    constructor(private readonly callbacks: AudioServiceCallbacks) {}

    bind(node: Node) {
        this.audioSource = node.getComponent(AudioSource) ?? node.addComponent(AudioSource);
    }

    playMusic(name: string) {
        const clip = this.callbacks.getAudioClip(name);
        if (!clip || !this.audioSource) {
            return;
        }
        this.audioSource.clip = clip;
        this.audioSource.loop = true;
        this.audioSource.volume = 0.42;
        this.audioSource.play();
    }

    playEffect(name: string) {
        const clip = this.callbacks.getAudioClip(name);
        if (!clip || !this.audioSource) {
            return;
        }
        this.audioSource.playOneShot(clip, 0.78);
    }
}
