import { Node, tween, Vec3 } from 'cc';
import type { MovementObstacle } from './MovementObstacle';

export type TreeLevel = 1 | 2 | 3;

export interface TreeSlot {
    node: Node;
    visual: Node;
    shadow: Node | null;
    stump: Node | null;
    alive: boolean;
    level: TreeLevel;
    visualBasePosition: Vec3;
}

export interface TreeSystemConfig {
    treeLevelCsv: string;
    treeLevel1ImagePath: string;
    treeLevel2ImagePath: string;
    treeLevel3ImagePath: string;
    stumpSmallImagePath: string;
    stumpLargeImagePath: string;
    blockedTreeShakeOffsetX: number;
    blockedTreeShakeOffsetY: number;
    blockedTreeShakeHalfDuration: number;
    obstacleOffsetX: number;
    obstacleOffsetY: number;
    obstacleRadiusX: number;
    obstacleRadiusY: number;
}

export interface TreeSystemCallbacks {
    findChildDeep(parent: Node, name: string): Node | null;
    setupSpriteNode(node: Node, framePath: string, width: number, height: number): void;
}

export class TreeSystem {
    private trees: TreeSlot[] = [];
    private readonly shakeTweens = new Map<Node, any>();

    public constructor(
        private readonly getConfig: () => TreeSystemConfig,
        private readonly callbacks: TreeSystemCallbacks,
    ) {}

    public rebuild(nodes: Node[], explicitLevels: TreeLevel[] = []) {
        const config = this.getConfig();
        const levels = this.getTreeLevels(config.treeLevelCsv);
        this.stopAllShakes();
        this.trees = [];

        nodes.forEach((treeRoot, index) => {
            treeRoot.active = true;
            const level = explicitLevels[index] ?? levels[index] ?? levels[levels.length - 1] ?? 1;
            const treeVisual = treeRoot.getChildByName('TreeVisual') ?? treeRoot;
            const shadow = treeRoot.getChildByName('Shadow') ?? this.callbacks.findChildDeep(treeRoot, 'Shadow');
            const stump = treeRoot.getChildByName('TreeStump') ?? this.callbacks.findChildDeep(treeRoot, 'TreeStump');

            // Prefabs with a Shadow node already own their visual sizes and sprite frames.
            if (!shadow) {
                this.callbacks.setupSpriteNode(treeVisual, this.getTreeImagePath(level, config), 118, 140);
            }
            if (stump) {
                if (!shadow) {
                    this.callbacks.setupSpriteNode(stump, level === 3 ? config.stumpLargeImagePath : config.stumpSmallImagePath, 72, 48);
                }
                stump.active = false;
            }

            if (shadow) {
                shadow.active = true;
            }
            treeVisual.active = true;
            this.trees.push({
                node: treeRoot,
                visual: treeVisual,
                shadow,
                stump,
                alive: true,
                level,
                visualBasePosition: treeVisual.position.clone(),
            });
        });
    }

    public getLevel(index: number) {
        const levels = this.getTreeLevels(this.getConfig().treeLevelCsv);
        return levels[index] ?? levels[levels.length - 1] ?? 1;
    }

    public findCuttable(maxLevel: TreeLevel) {
        const next = this.findNextAlive();
        return next && next.level <= maxLevel ? next : null;
    }

    public findCuttableBatch(maxLevel: TreeLevel, limit: number) {
        const batch: TreeSlot[] = [];
        const maxCount = Math.max(1, Math.floor(limit));
        for (const tree of this.trees) {
            if (!tree.alive) {
                continue;
            }
            if (tree.level > maxLevel) {
                break;
            }
            batch.push(tree);
            if (batch.length >= maxCount) {
                break;
            }
        }
        return batch;
    }

    public findNextAlive() {
        return this.trees.find((tree) => tree.alive) ?? null;
    }

    public getRouteTrees() {
        return this.trees;
    }

    public getMovementObstacles(): MovementObstacle[] {
        const config = this.getConfig();
        const radiusX = Math.max(0, config.obstacleRadiusX);
        const radiusY = Math.max(0, config.obstacleRadiusY);
        const obstacles: MovementObstacle[] = [];
        if (radiusX <= 0 || radiusY <= 0) {
            return obstacles;
        }

        this.trees.forEach((tree) => {
            if (!tree.alive || !tree.node.isValid || !tree.node.activeInHierarchy) {
                return;
            }
            obstacles.push({
                node: tree.node,
                offsetX: config.obstacleOffsetX,
                offsetY: config.obstacleOffsetY,
                radiusX,
                radiusY,
            });
        });
        return obstacles;
    }

    public cut(tree: TreeSlot) {
        if (!tree.alive) {
            return false;
        }

        this.stopShake(tree);
        tree.alive = false;
        tree.visual.active = false;
        if (tree.shadow) {
            tree.shadow.active = false;
        }
        if (tree.stump) {
            tree.stump.active = true;
        }
        return true;
    }

    public startShake(tree: TreeSlot) {
        if (!tree.alive || !tree.visual?.isValid || this.shakeTweens.has(tree.visual)) {
            return;
        }

        const config = this.getConfig();
        const halfDuration = Math.max(0.01, config.blockedTreeShakeHalfDuration);
        const base = tree.visualBasePosition.clone();
        const left = base.clone().add(new Vec3(-config.blockedTreeShakeOffsetX, -config.blockedTreeShakeOffsetY, 0));
        const right = base.clone().add(new Vec3(config.blockedTreeShakeOffsetX, config.blockedTreeShakeOffsetY, 0));
        tree.visual.setPosition(base);
        const shake = tween(tree.visual)
            .to(halfDuration, { position: left })
            .to(halfDuration, { position: right })
            .to(halfDuration, { position: base })
            .call(() => {
                if (this.shakeTweens.get(tree.visual) === shake) {
                    this.shakeTweens.delete(tree.visual);
                }
                if (tree.visual?.isValid) {
                    tree.visual.setPosition(tree.visualBasePosition);
                }
            });
        this.shakeTweens.set(tree.visual, shake);
        shake.start();
    }

    public stopShake(tree: TreeSlot) {
        const shake = this.shakeTweens.get(tree.visual);
        if (shake) {
            shake.stop();
            this.shakeTweens.delete(tree.visual);
        }
        if (tree.visual?.isValid) {
            tree.visual.setPosition(tree.visualBasePosition);
        }
    }

    private stopAllShakes() {
        this.shakeTweens.forEach((shake) => shake.stop());
        this.shakeTweens.clear();
    }

    private getTreeLevels(csv: string) {
        return csv
            .split(',')
            .map((item) => {
                const level = Number(item.trim());
                return this.clamp(level, 1, 3) as TreeLevel;
            });
    }

    private getTreeImagePath(level: TreeLevel, config: TreeSystemConfig) {
        if (level === 1) {
            return config.treeLevel1ImagePath;
        }
        if (level === 2) {
            return config.treeLevel2ImagePath;
        }
        return config.treeLevel3ImagePath;
    }

    private clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value));
    }
}
