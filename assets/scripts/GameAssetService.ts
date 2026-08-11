import { AudioClip, resources, SpriteFrame } from 'cc';

export class GameAssetService {
    private readonly spriteFrames = new Map<string, SpriteFrame>();
    private readonly audioClips = new Map<string, AudioClip>();

    public async loadSpriteFrames(paths: string[], onProgress?: (progress: number) => void) {
        const images = this.uniquePaths(paths);
        if (images.length <= 0) {
            onProgress?.(1);
            return;
        }

        let loaded = 0;
        await Promise.all(images.map(async (image) => {
            const frame = await this.loadSpriteFrame(image);
            if (frame) {
                this.spriteFrames.set(image, frame);
            }
            loaded += 1;
            onProgress?.(loaded / images.length);
        }));
    }

    public async loadAudioClips(names: string[], folder: string, onProgress?: (progress: number) => void) {
        const audioNames = this.uniquePaths(names);
        if (audioNames.length <= 0) {
            onProgress?.(1);
            return;
        }

        let loaded = 0;
        await Promise.all(audioNames.map(async (audioName) => {
            const clip = await this.loadAudioClip(`${folder}/${audioName}`);
            if (clip) {
                this.audioClips.set(audioName, clip);
            }
            loaded += 1;
            onProgress?.(loaded / audioNames.length);
        }));
    }

    public getSpriteFrame(path: string) {
        return this.spriteFrames.get(path) ?? null;
    }

    public getAudioClip(name: string) {
        return this.audioClips.get(name) ?? null;
    }

    public collectFrames(prefix: string, frameCount: number) {
        const frames: SpriteFrame[] = [];
        for (let i = 0; i < frameCount; i += 1) {
            const frame = this.spriteFrames.get(`${prefix}${this.formatFrameIndex(i)}`);
            if (frame) {
                frames.push(frame);
            }
        }
        return frames;
    }

    public collectFramesFromPaths(paths: string[]) {
        return paths
            .map((path) => this.spriteFrames.get(path))
            .filter(Boolean) as SpriteFrame[];
    }

    public getSpriteFrameAspect(path: string, fallbackWidth: number, fallbackHeight: number) {
        const rect = this.spriteFrames.get(path)?.rect;
        if (rect && rect.height > 0) {
            return rect.width / rect.height;
        }
        return fallbackWidth / Math.max(1, fallbackHeight);
    }

    public framePaths(prefix: string, dirs: readonly string[], frameCount: number) {
        const out: string[] = [];
        for (const dir of dirs) {
            for (let i = 0; i < frameCount; i += 1) {
                out.push(`${prefix}${dir}${dir ? '_' : ''}${this.formatFrameIndex(i)}`);
            }
        }
        return out;
    }

    public parseCsvNames(csv: string) {
        return csv
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean);
    }

    public uniquePaths(paths: string[]) {
        const seen: Record<string, boolean> = Object.create(null);
        const out: string[] = [];
        for (const rawPath of paths) {
            const path = rawPath.trim();
            if (!path || seen[path]) {
                continue;
            }
            seen[path] = true;
            out.push(path);
        }
        return out;
    }

    private formatFrameIndex(index: number) {
        return `00000${index}`.slice(-5);
    }

    private async loadSpriteFrame(path: string): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            let settled = false;
            const finish = (frame: SpriteFrame | null) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                resolve(frame);
            };
            const timer = setTimeout(() => {
                console.warn(`SpriteFrame load timeout: ${path}`);
                finish(null);
            }, 2500);
            resources.load(`${path}/spriteFrame`, SpriteFrame, (err, frame) => {
                if (err) {
                    console.warn(`SpriteFrame load failed: ${path}`, err.message);
                    finish(null);
                    return;
                }
                finish(frame);
            });
        });
    }

    private async loadAudioClip(path: string): Promise<AudioClip | null> {
        return new Promise((resolve) => {
            let settled = false;
            const finish = (clip: AudioClip | null) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                resolve(clip);
            };
            const timer = setTimeout(() => {
                console.warn(`Audio load timeout: ${path}`);
                finish(null);
            }, 3000);
            resources.load(path, AudioClip, (err, clip) => {
                if (err) {
                    console.warn(`Audio load failed: ${path}`, err.message);
                    finish(null);
                    return;
                }
                finish(clip);
            });
        });
    }
}
