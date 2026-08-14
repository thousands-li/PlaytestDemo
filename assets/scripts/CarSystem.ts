import { Mat4, Node, tween, Vec3 } from 'cc';
import type { MovementObstacle } from './MovementObstacle';
import type { TreeLevel, TreeSlot } from './TreeSystem';

export interface CarActor {
    node: Node;
    play(name: string): boolean;
    update(dt: number, fps?: number): void;
}

export interface CarSystemConfig {
    actors: Node | null;
    configuredCarNodes: (Node | null)[];
    carPlaneNodes: (Node | null)[];
    upgrade2Nodes: (Node | null)[];
    upgrade3Nodes: (Node | null)[];
    previewFramePath: string;
    isEnded: boolean;
    treeOffsetX: number;
    treeOffsetY: number;
    moveToTreeDuration: number;
    cutDelay: number;
    returnDuration: number;
    workInterval: number;
    retryInterval: number;
    routeDirectionX: number;
    routeDirectionY: number;
    routeRowDirectionX: number;
    routeRowDirectionY: number;
    routeHalfWidth: number;
    cutBatchSize: number;
    upgradePlaneBackOffset: number;
    blockedTreeBackOffset: number;
    blockedTreeLateralOffset: number;
    blockedWiggleDistance: number;
    blockedWiggleHalfDuration: number;
    blockedWiggleInterval: number;
    obstacleOffsetX: number;
    obstacleOffsetY: number;
    obstacleRadiusX: number;
    obstacleRadiusY: number;
}

export interface CarSystemCallbacks<T extends CarActor> {
    findChildDeep(parent: Node, name: string): Node | null;
    setupSpriteNode(node: Node, framePath: string, width: number, height: number): void;
    createActor(node: Node): T;
    getRouteTrees(): TreeSlot[];
    cutTree(tree: TreeSlot, carLevel: TreeLevel, carIndex: number): void;
    startTreeShake(tree: TreeSlot, direction: Vec3): void;
    stopTreeShake(tree: TreeSlot): void;
    spawnUpgradeEffect(position: Vec3): void;
    showNeedUpgradePrompt(target: Node): void;
    playCarAudio(): void;
    playUiAudio(): void;
    showWaitTreeWoodGuide(): void;
    refreshWoodDropPoint(carIndex: number, level: TreeLevel): void;
    scheduleOnce(done: () => void, delay: number): void;
}

interface RouteWork {
    front: TreeSlot | null;
    batch: TreeSlot[];
    blockedBatch: TreeSlot[];
}

interface CarUnit<T extends CarActor> {
    index: number;
    actor: T | null;
    node: Node | null;
    level: TreeLevel;
    unlocked: boolean;
    busy: boolean;
    blockedTrees: TreeSlot[];
    blockedTween: any;
    blockedBasePosition: Vec3 | null;
    blockedPulseId: number;
    routeOrigin: Vec3 | null;
}

const MAX_CARS = 3;

export class CarSystem<T extends CarActor> {
    private readonly units: CarUnit<T>[] = Array.from({ length: MAX_CARS }, (_, index) => this.createUnit(index));
    private readonly nodeWorldMatrix = new Mat4();

    public constructor(
        private readonly getConfig: () => CarSystemConfig,
        private readonly callbacks: CarSystemCallbacks<T>,
    ) {}

    public get unlocked() {
        return this.units.some((unit) => unit.unlocked);
    }

    public get level() {
        return this.getFirstBlockedUnit()?.level ?? this.getFirstUnlockedUnit()?.level ?? 1;
    }

    public get node() {
        return this.getFirstBlockedUnit()?.node ?? this.getFirstUnlockedUnit()?.node ?? null;
    }

    public prepareSceneNode() {
        const config = this.getConfig();
        let firstCar: Node | null = null;

        this.units.forEach((unit) => {
            const car = this.resolveExistingCarNode(unit, config);
            if (!car) {
                return;
            }

            unit.node = car;
            this.callbacks.setupSpriteNode(car, config.previewFramePath, 150, 110);
            car.active = false;
            if (!firstCar) {
                firstCar = car;
            }
        });

        return firstCar;
    }

    public updateAnimation(dt: number, fps: number) {
        this.units.forEach((unit) => unit.actor?.update(dt, fps));
    }

    public canUnlock(index: number, hasCoins: boolean) {
        const unit = this.getUnit(index);
        const plane = this.getCarPlaneNode(this.getConfig(), index);
        return !!unit
            && !unit.unlocked
            && hasCoins
            && !!plane?.isValid
            && plane.active;
    }

    public hasUnlockTarget(hasCoins: boolean) {
        return this.units.some((unit) => this.canUnlock(unit.index, hasCoins));
    }

    public canUpgradeTo(index: number, level: 2 | 3, hasCoins: boolean) {
        const plane = this.getUpgradePlaneNode(this.getConfig(), index, level);
        return !!this.getUpgradeTargetUnit(index, level)
            && hasCoins
            && !!plane?.isValid
            && plane.active;
    }

    public hasUpgradeTarget(level: 2 | 3, hasCoins: boolean) {
        return this.units.some((unit) => this.canUpgradeTo(unit.index, level, hasCoins));
    }

    public areAllCarsFullyUpgraded() {
        return this.units.every((unit) => unit.unlocked && unit.level >= 3);
    }

    public getMovementObstacles(): MovementObstacle[] {
        const config = this.getConfig();
        const radiusX = Math.max(0, config.obstacleRadiusX);
        const radiusY = Math.max(0, config.obstacleRadiusY);
        if (radiusX <= 0 || radiusY <= 0) {
            return [];
        }

        const obstacles: MovementObstacle[] = [];
        this.units.forEach((unit) => {
            if (!unit.unlocked || !unit.node?.isValid || !unit.node.activeInHierarchy) {
                return;
            }
            obstacles.push({
                node: unit.node,
                shape: 'rectangle',
                offsetX: config.obstacleOffsetX,
                offsetY: config.obstacleOffsetY,
                radiusX,
                radiusY,
            });
        });
        return obstacles;
    }

    public unlock(index = 0) {
        const config = this.getConfig();
        const unit = this.getUnit(index);
        if (!unit || !config.actors?.isValid || unit.unlocked) {
            return false;
        }

        unit.unlocked = true;
        unit.level = 1;
        unit.busy = false;
        unit.blockedTrees = [];
        unit.blockedBasePosition = null;
        unit.routeOrigin = null;
        unit.blockedPulseId += 1;
        this.callbacks.playCarAudio();

        const plane = this.getCarPlaneNode(config, index);
        const planeWorldPosition = plane?.isValid ? plane.worldPosition.clone() : null;
        if (plane?.isValid) {
            plane.active = false;
        }

        const configuredCar = this.getConfiguredCarNode(config, index);
        const scenePosition = configuredCar?.isValid
            ? configuredCar.position.clone()
            : (unit.node?.isValid ? unit.node.position.clone() : null);
        const carNode = configuredCar ?? this.resolveExistingCarNode(unit, config);
        if (!carNode?.isValid) {
            console.warn(`${this.getCarNodeName(index)} is missing in the scene. Add it under Actors instead of creating it at runtime.`);
            unit.unlocked = false;
            return false;
        }
        this.callbacks.setupSpriteNode(carNode, config.previewFramePath, 150, 110);
        if (planeWorldPosition) {
            carNode.setWorldPosition(planeWorldPosition);
        } else {
            carNode.setPosition(scenePosition ?? Vec3.ZERO);
        }
        carNode.active = true;
        unit.node = carNode;
        unit.routeOrigin = carNode.position.clone();

        unit.actor = this.callbacks.createActor(carNode);
        this.playLevelVisual(unit, 1);
        this.scheduleWork(unit);

        this.refreshBlockedUpgradePlanes(config);
        this.callbacks.showWaitTreeWoodGuide();
        return true;
    }

    public upgrade(index: number, level: 2 | 3) {
        const unit = this.getUpgradeTargetUnit(index, level);
        if (!unit?.unlocked) {
            return false;
        }

        unit.level = level;
        this.callbacks.playUiAudio();
        this.callbacks.spawnUpgradeEffect(unit.node?.position ?? Vec3.ZERO);
        this.playLevelVisual(unit, level);

        this.callbacks.showWaitTreeWoodGuide();
        if (unit.blockedTrees.some((tree) => tree.alive && tree.level <= unit.level)) {
            this.releaseBlockedTrees(unit);
        } else if (unit.blockedTrees.some((tree) => tree.alive && tree.level > unit.level)) {
            this.refreshBlockedUpgradePlanes(this.getConfig());
        } else {
            this.stopBlockedLoop(unit);
            this.scheduleWork(unit);
        }
        return true;
    }

    public scheduleWork(unitOrIndex?: CarUnit<T> | number) {
        const config = this.getConfig();
        const unit = this.resolveUnit(unitOrIndex) ?? this.getFirstUnlockedUnit();
        if (!unit?.node?.isValid || unit.busy || unit.blockedTrees.length > 0 || config.isEnded) {
            return;
        }

        const next = this.getNextRouteWork(unit, config);
        if (next.batch.length > 0) {
            this.moveToBatch(unit, next.batch, config);
            return;
        }

        if (next.front) {
            this.moveToBlockedTree(unit, next.front, config);
            return;
        }

        if (config.retryInterval > 0) {
            this.callbacks.scheduleOnce(() => this.scheduleWork(unit), config.retryInterval);
        }
    }

    private createUnit(index: number): CarUnit<T> {
        return {
            index,
            actor: null,
            node: null,
            level: 1,
            unlocked: false,
            busy: false,
            blockedTrees: [],
            blockedTween: null,
            blockedBasePosition: null,
            blockedPulseId: 0,
            routeOrigin: null,
        };
    }

    private resolveUnit(unitOrIndex?: CarUnit<T> | number) {
        if (typeof unitOrIndex === 'number') {
            return this.getUnit(unitOrIndex);
        }
        return unitOrIndex ?? null;
    }

    private getUnit(index: number) {
        return this.units[index] ?? null;
    }

    private getFirstUnlockedUnit() {
        return this.units.find((unit) => unit.unlocked) ?? null;
    }

    private getFirstBlockedUnit() {
        return this.units.find((unit) => unit.unlocked && this.hasLiveBlockedTrees(unit)) ?? null;
    }

    private getUpgradeTargetUnit(index: number, level: 2 | 3) {
        const unit = this.getUnit(index);
        const requiredCurrentLevel = (level - 1) as TreeLevel;
        return unit
            && unit.unlocked
            && unit.level === requiredCurrentLevel
            && this.hasLiveBlockedTrees(unit)
            ? unit
            : null;
    }

    private resolveExistingCarNode(unit: CarUnit<T>, config: CarSystemConfig) {
        return this.getConfiguredCarNode(config, unit.index)
            ?? (config.actors ? this.callbacks.findChildDeep(config.actors, this.getCarNodeName(unit.index)) : null);
    }

    private getConfiguredCarNode(config: CarSystemConfig, index: number) {
        return config.configuredCarNodes[index] ?? null;
    }

    private getCarPlaneNode(config: CarSystemConfig, index: number) {
        return config.carPlaneNodes[index] ?? null;
    }

    private getUpgradePlaneNode(config: CarSystemConfig, index: number, level: 2 | 3) {
        return (level === 2 ? config.upgrade2Nodes : config.upgrade3Nodes)[index] ?? null;
    }

    private getCarNodeName(index: number) {
        return index === 0 ? 'Car' : `Car${index + 1}`;
    }

    private playLevelVisual(unit: CarUnit<T>, level: TreeLevel) {
        if (!unit.actor && unit.node?.isValid) {
            unit.actor = this.callbacks.createActor(unit.node);
        }
        const clipName = `car${level}`;
        if (!unit.actor?.play(clipName)) {
            console.warn(`Car level visual clip missing: ${clipName}`);
        }
    }

    private moveToBatch(unit: CarUnit<T>, batch: TreeSlot[], config: CarSystemConfig) {
        const target = batch[0];
        if (!target?.node.isValid) {
            this.callbacks.scheduleOnce(() => this.scheduleWork(unit), config.retryInterval);
            return;
        }

        this.prepareNextUpgradePlane(unit, config);
        this.moveToPosition(unit, this.getTreeWorkPosition(unit, target, config), config, () => {
            this.cutBatchAndContinue(unit, batch, config);
        });
    }

    private moveToBlockedTree(unit: CarUnit<T>, tree: TreeSlot, config: CarSystemConfig) {
        if (!tree.node.isValid) {
            this.callbacks.scheduleOnce(() => this.scheduleWork(unit), config.retryInterval);
            return;
        }

        const workPosition = tree.level <= unit.level
            ? this.getTreeWorkPosition(unit, tree, config)
            : this.getBlockedTreeWaitPosition(unit, tree, config);
        this.moveToPosition(unit, workPosition, config, () => {
            if (!tree.alive) {
                this.callbacks.scheduleOnce(() => this.scheduleWork(unit), config.retryInterval);
                return;
            }
            if (tree.level <= unit.level) {
                this.cutBatchAndContinue(unit, this.getNextRouteWork(unit, config).batch, config);
                return;
            }
            const next = this.getNextRouteWork(unit, config);
            const blockedBatch = next.blockedBatch.length > 0 ? next.blockedBatch : [tree];
            this.startBlockedLoop(unit, blockedBatch, workPosition, config);
        });
    }

    private moveToPosition(unit: CarUnit<T>, position: Vec3, config: CarSystemConfig, done: () => void) {
        if (!unit.node?.isValid) {
            return;
        }
        unit.busy = true;

        const distance = Vec3.distance(unit.node.position, position);
        if (distance <= 1) {
            unit.node.setPosition(position);
            unit.busy = false;
            done();
            return;
        }

        tween(unit.node)
            .to(Math.max(0.01, config.moveToTreeDuration), { position })
            .call(() => {
                unit.busy = false;
                done();
            })
            .start();
    }

    private cutBatchAndContinue(unit: CarUnit<T>, batch: TreeSlot[], config: CarSystemConfig) {
        const cuttable = batch.filter((tree) => tree.alive && tree.level <= unit.level);
        if (cuttable.length <= 0) {
            this.callbacks.scheduleOnce(() => this.scheduleWork(unit), config.retryInterval);
            return;
        }

        this.prepareNextUpgradePlane(unit, config);
        unit.busy = true;
        cuttable.forEach((tree) => {
            this.callbacks.stopTreeShake(tree);
            this.callbacks.cutTree(tree, unit.level, unit.index);
        });
        this.callbacks.scheduleOnce(() => {
            unit.busy = false;
            this.scheduleWork(unit);
        }, Math.max(0, config.cutDelay));
    }

    private startBlockedLoop(unit: CarUnit<T>, trees: TreeSlot[], workPosition: Vec3, config: CarSystemConfig) {
        if (!unit.node?.isValid) {
            return;
        }

        const blockedBatch = trees
            .filter((tree) => tree.alive && tree.node.isValid && tree.level > unit.level)
            .slice(0, Math.max(1, Math.floor(config.cutBatchSize)));
        if (blockedBatch.length <= 0) {
            this.callbacks.scheduleOnce(() => this.scheduleWork(unit), config.retryInterval);
            return;
        }

        unit.blockedTrees = blockedBatch;
        this.callbacks.showWaitTreeWoodGuide();
        this.revealAdditionalCarPlanes(config);
        this.refreshBlockedUpgradePlanes(config);

        unit.blockedBasePosition = workPosition.clone();
        unit.node.setPosition(workPosition);
        this.stopBlockedTweenOnly(unit);
        unit.blockedPulseId += 1;
        this.playBlockedPulse(unit, unit.blockedPulseId);
    }

    private playBlockedPulse(unit: CarUnit<T>, pulseId: number) {
        const config = this.getConfig();
        if (pulseId !== unit.blockedPulseId || !unit.node?.isValid || config.isEnded) {
            return;
        }

        const blockedBatch = unit.blockedTrees
            .filter((tree) => tree.alive && tree.node.isValid && tree.level > unit.level)
            .slice(0, Math.max(1, Math.floor(config.cutBatchSize)));
        if (blockedBatch.length <= 0) {
            this.releaseBlockedTrees(unit);
            return;
        }

        unit.blockedTrees = blockedBatch;
        this.callbacks.showNeedUpgradePrompt(unit.node);

        const direction = this.getRouteDirection(config);
        const distance = Math.max(1, config.blockedWiggleDistance);
        const halfDuration = Math.max(0.01, config.blockedWiggleHalfDuration);
        const base = unit.blockedBasePosition?.clone() ?? unit.node.position.clone();
        const forward = base.clone().add(new Vec3(direction.x * distance, direction.y * distance, 0));
        unit.node.setPosition(base);
        this.stopBlockedTweenOnly(unit);
        const pulse = tween(unit.node)
            .to(halfDuration, { position: forward })
            .call(() => {
                blockedBatch.forEach((tree) => this.callbacks.startTreeShake(tree, direction));
            })
            .to(halfDuration, { position: base })
            .call(() => {
                if (unit.blockedTween === pulse) {
                    unit.blockedTween = null;
                }
                if (unit.node?.isValid) {
                    unit.node.setPosition(base);
                }
                const interval = Math.max(0.01, this.getConfig().blockedWiggleInterval);
                this.callbacks.scheduleOnce(() => this.playBlockedPulse(unit, pulseId), interval);
            });
        unit.blockedTween = pulse;
        pulse.start();
    }

    private releaseBlockedTrees(unit: CarUnit<T>) {
        this.stopBlockedLoop(unit);

        const config = this.getConfig();
        const next = this.getNextRouteWork(unit, config);
        if (next.batch.length > 0) {
            this.moveToBatch(unit, next.batch, config);
            return;
        }

        this.scheduleWork(unit);
    }

    private stopBlockedLoop(unit: CarUnit<T>) {
        const trees = unit.blockedTrees;
        unit.blockedPulseId += 1;
        this.stopBlockedTweenOnly(unit);
        trees.forEach((tree) => this.callbacks.stopTreeShake(tree));
        if (unit.node?.isValid && unit.blockedBasePosition) {
            unit.node.setPosition(unit.blockedBasePosition);
        }
        unit.blockedBasePosition = null;
        unit.blockedTrees = [];
        this.refreshBlockedUpgradePlanes(this.getConfig());
    }

    private stopBlockedTweenOnly(unit: CarUnit<T>) {
        if (unit.blockedTween) {
            unit.blockedTween.stop();
            unit.blockedTween = null;
        }
    }

    private hasLiveBlockedTrees(unit: CarUnit<T>) {
        return unit.blockedTrees.some((tree) => tree.alive && tree.node.isValid && tree.level > unit.level);
    }

    private hideUpgradePlanes(config: CarSystemConfig) {
        [...config.upgrade2Nodes, ...config.upgrade3Nodes].forEach((plane) => {
            if (plane?.isValid) {
                plane.active = false;
            }
        });
    }

    private refreshBlockedUpgradePlanes(config: CarSystemConfig) {
        this.hideUpgradePlanes(config);
        this.units.forEach((unit) => {
            if (!unit.unlocked || !this.hasLiveBlockedTrees(unit)) {
                return;
            }
            const nextLevel = unit.level === 1 ? 2 : unit.level === 2 ? 3 : null;
            if (!nextLevel) {
                return;
            }
            const plane = this.getUpgradePlaneNode(config, unit.index, nextLevel);
            if (plane?.isValid) {
                plane.active = true;
                this.placeUpgradePlaneBehindPosition(plane, unit, unit.node.worldPosition, config);
            }
        });
    }

    private prepareNextUpgradePlane(unit: CarUnit<T>, config: CarSystemConfig) {
        if (!unit.node?.isValid) {
            return;
        }
        const nextLevel = unit.level === 1 ? 2 : unit.level === 2 ? 3 : null;
        if (!nextLevel) {
            return;
        }
        const plane = this.getUpgradePlaneNode(config, unit.index, nextLevel);
        const nextBlockedTree = this.findNextBlockedTree(unit, config);
        if (!plane?.isValid || !nextBlockedTree?.node.isValid) {
            return;
        }
        const futurePosition = this.getBlockedTreeWaitPosition(unit, nextBlockedTree, config);
        const futureWorldPosition = this.getWorldPositionLikeNode(unit.node, futurePosition);
        this.placeUpgradePlaneBehindPosition(plane, unit, futureWorldPosition, config);
    }

    private placeUpgradePlaneBehindPosition(plane: Node, unit: CarUnit<T>, worldPosition: Vec3, config: CarSystemConfig) {
        const direction = this.getRouteDirection(config);
        const routeScale = Math.max(
            Math.abs(unit.node?.parent?.worldScale.x ?? 1),
            Math.abs(unit.node?.parent?.worldScale.y ?? 1),
        );
        const distance = Math.max(0, config.upgradePlaneBackOffset) * routeScale;
        const target = worldPosition.clone().subtract(new Vec3(
            direction.x * distance,
            direction.y * distance,
            0,
        ));
        plane.setWorldPosition(target);
        plane.setSiblingIndex(plane.parent?.children.length ?? 0);
        this.callbacks.refreshWoodDropPoint(unit.index, (unit.level as TreeLevel));
    }

    private findNextBlockedTree(unit: CarUnit<T>, config: CarSystemConfig) {
        const direction = this.getRouteDirection(config);
        const rowDirection = this.getRouteRowDirection(config, direction);
        const origin = unit.routeOrigin ?? unit.node?.position.clone() ?? Vec3.ZERO.clone();
        const currentProgress = unit.node?.isValid
            ? this.getRouteProgress(unit.node.position, origin, direction, rowDirection)
            : 0;
        return this.callbacks.getRouteTrees()
            .filter((tree) => {
                if (!tree.alive || !tree.node.isValid || tree.level <= unit.level || !this.isTreeOnRoute(tree, config, origin, direction)) {
                    return false;
                }
                return this.getRouteProgress(tree.node.position, origin, direction, rowDirection) >= currentProgress - 1;
            })
            .sort((a, b) => (
                this.getRouteProgress(a.node.position, origin, direction, rowDirection)
                - this.getRouteProgress(b.node.position, origin, direction, rowDirection)
            ))[0] ?? null;
    }

    private getWorldPositionLikeNode(sourceNode: Node, localPosition: Vec3) {
        if (!sourceNode.parent?.isValid) {
            return localPosition.clone();
        }
        sourceNode.parent.getWorldMatrix(this.nodeWorldMatrix);
        return Vec3.transformMat4(new Vec3(), localPosition, this.nodeWorldMatrix);
    }

    private revealAdditionalCarPlanes(config: CarSystemConfig) {
        this.units.slice(1).forEach((unit) => {
            const plane = this.getCarPlaneNode(config, unit.index);
            if (!unit.unlocked && plane?.isValid) {
                plane.active = true;
            }
        });
    }

    private getNextRouteWork(unit: CarUnit<T>, config: CarSystemConfig): RouteWork {
        const direction = this.getRouteDirection(config);
        const rowDirection = this.getRouteRowDirection(config, direction);
        const origin = unit.routeOrigin ?? unit.node?.position.clone() ?? Vec3.ZERO.clone();
        const currentProgress = unit.node?.isValid
            ? this.getRouteProgress(unit.node.position, origin, direction, rowDirection)
            : 0;
        const routeTrees = this.callbacks.getRouteTrees()
            .filter((tree) => {
                if (!tree.alive || !tree.node.isValid || !this.isTreeOnRoute(tree, config, origin, direction)) {
                    return false;
                }
                return this.getRouteProgress(tree.node.position, origin, direction, rowDirection) >= currentProgress - 1;
            })
            .sort((a, b) => (
                this.getRouteProgress(a.node.position, origin, direction, rowDirection)
                - this.getRouteProgress(b.node.position, origin, direction, rowDirection)
            ));
        const front = routeTrees[0] ?? null;
        if (!front || front.level > unit.level) {
            return { front, batch: [] as TreeSlot[], blockedBatch: routeTrees.slice(0, Math.max(1, Math.floor(config.cutBatchSize))) };
        }

        const batch: TreeSlot[] = [];
        const limit = Math.max(1, Math.floor(config.cutBatchSize));
        for (const tree of routeTrees) {
            if (tree.level > unit.level) {
                break;
            }
            batch.push(tree);
            if (batch.length >= limit) {
                break;
            }
        }
        return { front, batch, blockedBatch: [] as TreeSlot[] };
    }

    private getTreeWorkPosition(unit: CarUnit<T>, tree: TreeSlot, config: CarSystemConfig) {
        const direction = this.getRouteDirection(config);
        const rowDirection = this.getRouteRowDirection(config, direction);
        const origin = unit.routeOrigin ?? unit.node?.position.clone() ?? Vec3.ZERO.clone();
        const offset = this.getRouteLocalOffset(new Vec3(config.treeOffsetX, config.treeOffsetY, 0), direction, rowDirection);
        const routeOffset = Math.min(offset.route, -70);
        const treeProgress = this.getRouteProgress(tree.node.position, origin, direction, rowDirection);
        const currentProgress = unit.node?.isValid
            ? this.getRouteProgress(unit.node.position, origin, direction, rowDirection)
            : 0;
        const routePosition = this.getRoutePosition(Math.max(currentProgress, treeProgress + routeOffset), origin, direction);
        return routePosition.add(new Vec3(rowDirection.x * offset.row, rowDirection.y * offset.row, 0));
    }

    private getBlockedTreeWaitPosition(unit: CarUnit<T>, tree: TreeSlot, config: CarSystemConfig) {
        const direction = this.getRouteDirection(config);
        const rowDirection = this.getRouteRowDirection(config, direction);
        const backOffset = Math.max(0, config.blockedTreeBackOffset);
        const lateralOffset = config.blockedTreeLateralOffset;
        return this.getTreeWorkPosition(unit, tree, config)
            .subtract(new Vec3(direction.x * backOffset, direction.y * backOffset, 0))
            .add(new Vec3(rowDirection.x * lateralOffset, rowDirection.y * lateralOffset, 0));
    }

    private isTreeOnRoute(tree: TreeSlot, config: CarSystemConfig, origin: Vec3, direction: Vec3) {
        const halfWidth = Math.max(0, config.routeHalfWidth);
        if (halfWidth <= 0) {
            return true;
        }

        const dx = tree.node.position.x - origin.x;
        const dy = tree.node.position.y - origin.y;
        const cross = Math.abs(dx * direction.y - dy * direction.x);
        return cross <= halfWidth;
    }

    private getRouteDirection(config: CarSystemConfig) {
        const length = Math.hypot(config.routeDirectionX, config.routeDirectionY);
        if (length <= 0.0001) {
            return new Vec3(1, 0, 0);
        }
        return new Vec3(config.routeDirectionX / length, config.routeDirectionY / length, 0);
    }

    private getRouteRowDirection(config: CarSystemConfig, routeDirection: Vec3) {
        const length = Math.hypot(config.routeRowDirectionX, config.routeRowDirectionY);
        if (length <= 0.0001) {
            return new Vec3(routeDirection.y, -routeDirection.x, 0);
        }
        return new Vec3(config.routeRowDirectionX / length, config.routeRowDirectionY / length, 0);
    }

    private getRouteProgress(position: Vec3, origin: Vec3, direction: Vec3, rowDirection: Vec3) {
        const basisCross = rowDirection.x * direction.y - rowDirection.y * direction.x;
        const dx = position.x - origin.x;
        const dy = position.y - origin.y;
        if (Math.abs(basisCross) <= 0.0001) {
            return dx * direction.x + dy * direction.y;
        }
        return (rowDirection.x * dy - rowDirection.y * dx) / basisCross;
    }

    private getRouteLocalOffset(offset: Vec3, direction: Vec3, rowDirection: Vec3) {
        const basisCross = rowDirection.x * direction.y - rowDirection.y * direction.x;
        if (Math.abs(basisCross) <= 0.0001) {
            return {
                route: offset.x * direction.x + offset.y * direction.y,
                row: 0,
            };
        }

        return {
            route: (rowDirection.x * offset.y - rowDirection.y * offset.x) / basisCross,
            row: (direction.y * offset.x - direction.x * offset.y) / basisCross,
        };
    }

    private getRoutePosition(progress: number, origin: Vec3, direction: Vec3) {
        return new Vec3(
            origin.x + direction.x * progress,
            origin.y + direction.y * progress,
            origin.z,
        );
    }

}
