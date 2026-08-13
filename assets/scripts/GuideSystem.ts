import { Node, UITransform, Vec2, Vec3 } from 'cc';

export type TutorialGuideStage =
    | 'initialWood'
    | 'initialSell'
    | 'firstCoins'
    | 'carUnlock'
    | 'upgrade2'
    | 'upgrade3'
    | 'waitTreeWood'
    | 'treeWood'
    | 'treeSell'
    | 'complete';

type GuideZoneName =
    | 'start'
    | 'sell'
    | 'coin'
    | 'car'
    | 'car2'
    | 'car3'
    | 'upgrade2'
    | 'upgrade2Car2'
    | 'upgrade2Car3'
    | 'upgrade3'
    | 'upgrade3Car2'
    | 'upgrade3Car3';

export interface GuideSystemConfig {
    arrowOffsetY: number;
    arrowFloatAmplitude: number;
    arrowFloatSpeed: number;
    playerArrowDistance: number;
    playerArrowPositionSmooth: number;
    playerArrowRotationSmooth: number;
    targetArrowHeight: number;
    targetArrowRotationZ: number;
    targetArrowJellyStretch: number;
    targetArrowJellySquash: number;
}

export interface GuideSystemTargets {
    uiNode: Node | null;
    playerNode: Node | null;
    getZoneTarget(name: GuideZoneName): Node | null;
    getWoodTarget(initialOnly: boolean): Node | null;
    getCoinTarget(): Node | null;
    getInitialWoodNodes(): Node[];
}

interface UiBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

const PLAYER_ARROW_MIN_SCALE = 0.25;
const PLAYER_ARROW_MAX_SCALE = 1;
const PLAYER_ARROW_FULL_SCALE_DISTANCE_FACTOR = 4;

function setGuideArrowNodesVisible(playerArrow: Node | null, targetArrow: Node | null, visible: boolean) {
    if (playerArrow && playerArrow.isValid) {
        playerArrow.active = visible;
    }
    if (targetArrow && targetArrow.isValid) {
        targetArrow.active = visible;
    }
}

export class GuideSystem {
    private playerArrow: Node | null = null;
    private targetArrow: Node | null = null;
    private stage: TutorialGuideStage = 'initialWood';
    private guideTarget: Node | null = null;
    private elapsed = 0;
    private playerArrowAngle = 0;
    private playerArrowScale = PLAYER_ARROW_MAX_SCALE;
    private playerArrowReady = false;
    private readonly playerArrowPosition = new Vec3();

    public bind(playerArrow: Node, targetArrow: Node) {
        this.playerArrow = playerArrow;
        this.targetArrow = targetArrow;
        this.setVisible(false);
    }

    public update(dt: number, isPlaying: boolean, targets: GuideSystemTargets, config: GuideSystemConfig) {
        this.elapsed += dt;
        this.guideTarget = this.getTarget(targets);
        const targetPos = this.getTargetPosition(targets, config);
        if (!isPlaying || !targetPos) {
            this.setVisible(false);
            return;
        }

        this.setVisible(true);
        this.updateTargetArrow(targetPos, config);
        this.updatePlayerArrow(targetPos, dt, targets, config);
    }

    public setStage(stage: TutorialGuideStage, targets?: GuideSystemTargets) {
        if (this.stage === 'complete' && stage !== 'complete') {
            return;
        }
        this.stage = stage;
        this.guideTarget = targets ? this.getTarget(targets) : null;
        this.playerArrowReady = false;
        this.playerArrowScale = PLAYER_ARROW_MAX_SCALE;
        if (!this.guideTarget || stage === 'waitTreeWood' || stage === 'complete') {
            this.setVisible(false);
        }
    }

    public activateTreeWoodIfWaiting(targets?: GuideSystemTargets) {
        if (this.stage === 'waitTreeWood') {
            this.setStage('treeWood', targets);
        }
    }

    public isStage(stage: TutorialGuideStage) {
        return this.stage === stage;
    }

    public isAnyStage(stages: TutorialGuideStage[]) {
        return stages.indexOf(this.stage) >= 0;
    }

    public setVisible(visible: boolean) {
        setGuideArrowNodesVisible(this.playerArrow, this.targetArrow, visible);
    }

    private updateTargetArrow(targetPos: Vec3, config: GuideSystemConfig) {
        if (!this.targetArrow || !this.targetArrow.isValid) {
            return;
        }

        const floatSpeed = Math.max(1, config.arrowFloatSpeed);
        const wave = this.elapsed * 1000 / floatSpeed;
        const y = targetPos.y + config.arrowOffsetY + Math.sin(wave) * config.arrowFloatAmplitude;
        const jelly = Math.sin(wave * 1.85);
        const scaleX = 1 - jelly * config.targetArrowJellySquash;
        const scaleY = 1 + jelly * config.targetArrowJellyStretch;

        this.targetArrow.setPosition(targetPos.x, y, 0);
        this.targetArrow.setRotationFromEuler(0, 0, config.targetArrowRotationZ);
        this.targetArrow.setScale(scaleX, scaleY, 1);
    }

    private updatePlayerArrow(targetPos: Vec3, dt: number, targets: GuideSystemTargets, config: GuideSystemConfig) {
        if (!this.playerArrow || !this.playerArrow.isValid) {
            return;
        }

        const playerNode = targets.playerNode;
        if (!playerNode || !playerNode.isValid) {
            this.playerArrow.active = false;
            return;
        }

        const playerPos = this.getGuideLocalPosition(playerNode, targets);
        const dir = new Vec2(targetPos.x - playerPos.x, targetPos.y - playerPos.y);
        const distance = dir.length();
        if (distance <= 8) {
            this.playerArrow.active = false;
            return;
        }

        dir.multiplyScalar(1 / distance);
        const desiredPos = new Vec3(
            playerPos.x + dir.x * config.playerArrowDistance,
            playerPos.y + dir.y * config.playerArrowDistance,
            0,
        );
        const desiredAngle = Math.atan2(dir.y, dir.x) * 180 / Math.PI - 90;
        const desiredScale = this.getPlayerArrowScale(distance, config);

        if (!this.playerArrowReady) {
            this.playerArrowPosition.set(desiredPos.x, desiredPos.y, desiredPos.z);
            this.playerArrowAngle = desiredAngle;
            this.playerArrowScale = desiredScale;
            this.playerArrowReady = true;
        } else {
            const positionT = this.smoothFactor(config.playerArrowPositionSmooth, dt);
            this.playerArrowPosition.set(
                this.playerArrowPosition.x + (desiredPos.x - this.playerArrowPosition.x) * positionT,
                this.playerArrowPosition.y + (desiredPos.y - this.playerArrowPosition.y) * positionT,
                0,
            );
            this.playerArrowAngle = this.smoothAngle(this.playerArrowAngle, desiredAngle, config.playerArrowRotationSmooth, dt);
            this.playerArrowScale += (desiredScale - this.playerArrowScale) * positionT;
        }

        this.playerArrow.active = true;
        this.playerArrow.setPosition(this.playerArrowPosition);
        this.playerArrow.setRotationFromEuler(0, 0, this.playerArrowAngle);
        this.playerArrow.setScale(this.playerArrowScale, this.playerArrowScale, 1);
    }

    private getTarget(targets: GuideSystemTargets) {
        switch (this.stage) {
            case 'initialWood':
                return targets.getWoodTarget(true) ?? targets.getZoneTarget('start');
            case 'initialSell':
            case 'treeSell':
                return targets.getZoneTarget('sell');
            case 'firstCoins':
                return targets.getCoinTarget() ?? targets.getZoneTarget('coin');
            case 'carUnlock':
                return this.getFirstActiveZoneTarget(targets, ['car', 'car2', 'car3']);
            case 'upgrade2':
                return this.getFirstActiveZoneTarget(targets, ['upgrade2', 'upgrade2Car2', 'upgrade2Car3']);
            case 'upgrade3':
                return this.getFirstActiveZoneTarget(targets, ['upgrade3', 'upgrade3Car2', 'upgrade3Car3']);
            case 'treeWood':
                return targets.getWoodTarget(false);
            default:
                return null;
        }
    }

    private getFirstActiveZoneTarget(targets: GuideSystemTargets, names: GuideZoneName[]) {
        return names
            .map((name) => targets.getZoneTarget(name))
            .find((node) => node?.isValid && node.active) ?? null;
    }

    private getTargetPosition(targets: GuideSystemTargets, config: GuideSystemConfig) {
        if (this.stage === 'initialWood') {
            const pilePosition = this.getInitialWoodPileGuidePosition(targets, config);
            if (pilePosition) {
                return pilePosition;
            }
        }

        const target = this.guideTarget;
        if (!target || !target.isValid || !target.active) {
            return null;
        }
        return this.getGuideLocalPosition(target, targets);
    }

    private getInitialWoodPileGuidePosition(targets: GuideSystemTargets, config: GuideSystemConfig) {
        const initialWoods = targets.getInitialWoodNodes().filter((wood) => wood.isValid);
        if (initialWoods.length <= 0) {
            return null;
        }

        let bounds: UiBounds | null = null;
        initialWoods.forEach((wood) => {
            const woodBounds = this.getNodeGuideBounds(wood, targets);
            if (!woodBounds) {
                return;
            }
            bounds = bounds
                ? {
                    minX: Math.min(bounds.minX, woodBounds.minX),
                    maxX: Math.max(bounds.maxX, woodBounds.maxX),
                    minY: Math.min(bounds.minY, woodBounds.minY),
                    maxY: Math.max(bounds.maxY, woodBounds.maxY),
                }
                : woodBounds;
        });

        if (!bounds) {
            return null;
        }

        const arrowGap = config.targetArrowHeight * 0.5 + config.arrowFloatAmplitude;
        return new Vec3(
            (bounds.minX + bounds.maxX) * 0.5,
            bounds.maxY + arrowGap - config.arrowOffsetY,
            0,
        );
    }

    private getNodeGuideBounds(node: Node, targets: GuideSystemTargets): UiBounds | null {
        const center = this.getGuideLocalPosition(node, targets);
        const transform = node.getComponent(UITransform);
        if (!transform) {
            return {
                minX: center.x,
                maxX: center.x,
                minY: center.y,
                maxY: center.y,
            };
        }

        const guideNode = this.getGuideCoordinateNode(targets);
        const guideScale = guideNode?.worldScale ?? Vec3.ONE;
        const nodeScale = node.worldScale;
        const widthScale = Math.abs(nodeScale.x) / Math.max(Math.abs(guideScale.x), 0.0001);
        const heightScale = Math.abs(nodeScale.y) / Math.max(Math.abs(guideScale.y), 0.0001);
        const halfWidth = transform.contentSize.width * widthScale * 0.5;
        const halfHeight = transform.contentSize.height * heightScale * 0.5;

        return {
            minX: center.x - halfWidth,
            maxX: center.x + halfWidth,
            minY: center.y - halfHeight,
            maxY: center.y + halfHeight,
        };
    }

    private getGuideLocalPosition(node: Node, targets: GuideSystemTargets) {
        const transform = this.getGuideCoordinateNode(targets)?.getComponent(UITransform);
        if (!transform) {
            return node.position.clone();
        }
        return transform.convertToNodeSpaceAR(node.worldPosition);
    }

    private getGuideCoordinateNode(targets: GuideSystemTargets) {
        const playerArrowParent = this.playerArrow?.isValid ? this.playerArrow.parent : null;
        if (playerArrowParent?.isValid) {
            return playerArrowParent;
        }
        const targetArrowParent = this.targetArrow?.isValid ? this.targetArrow.parent : null;
        if (targetArrowParent?.isValid) {
            return targetArrowParent;
        }
        return targets.uiNode;
    }

    private getPlayerArrowScale(distance: number, config: GuideSystemConfig) {
        const fullScaleDistance = Math.max(
            config.playerArrowDistance * PLAYER_ARROW_FULL_SCALE_DISTANCE_FACTOR,
            config.playerArrowDistance + 1,
        );
        const progress = this.smoothStep(this.clamp01(distance / fullScaleDistance));
        return PLAYER_ARROW_MIN_SCALE + (PLAYER_ARROW_MAX_SCALE - PLAYER_ARROW_MIN_SCALE) * progress;
    }

    private smoothStep(value: number) {
        return value * value * (3 - 2 * value);
    }

    private clamp01(value: number) {
        return Math.min(1, Math.max(0, value));
    }

    private smoothFactor(speed: number, dt: number) {
        if (dt <= 0 || speed <= 0) {
            return 1;
        }
        return 1 - Math.exp(-speed * dt);
    }

    private smoothAngle(current: number, target: number, speed: number, dt: number) {
        const delta = ((((target - current) % 360) + 540) % 360) - 180;
        return current + delta * this.smoothFactor(speed, dt);
    }
}
