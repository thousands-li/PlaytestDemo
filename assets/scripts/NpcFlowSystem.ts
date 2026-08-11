import { Node, tween, UITransform, Vec2, Vec3 } from 'cc';
import type { Direction } from './Direction';
import { type NpcQueueActor, NpcQueueSystem } from './NpcQueueSystem';

export interface NpcVisibleRect {
    left: number;
    right: number;
    bottom: number;
    top: number;
}

export interface NpcFlowConfig {
    npcEntryNode: Node | null;
    npcExitNode: Node | null;
    coinPlaneNode: Node | null;
    coinsPerTrade: number;
    showCompleteCheckBubble: boolean;
    leaveDuration: number;
    enterDuration: number;
    reflowDuration: number;
    leaveOffscreenPadding: number;
    enterOffscreenPadding: number;
    renderHeight: number;
    templateScaleY: number;
}

export interface NpcFlowCallbacks<T extends NpcQueueActor> {
    createNpc(position: Vec3, waiting: boolean): T;
    applyQueueBubble(npc: T, index: number): void;
    setBubbleState(npc: T, state: 'check' | 'smile'): void;
    clearBubble(npcNode: Node): void;
    cleanup(npcNode: Node): void;
    setCarryDirection(npc: T, direction: Direction): void;
    spawnCoinsOnPlane(count: number, sourceNode?: Node): number;
    getVisibleRect(padding: number): NpcVisibleRect;
    scheduleOnce(done: () => void, delay: number): void;
}

interface LeaveRouteStep {
    position: Vec3;
    clip: 'walk315' | 'walk225';
    giveCoinsAfterArrival?: boolean;
}

export class NpcFlowSystem<T extends NpcQueueActor> {
    constructor(
        private readonly getConfig: () => NpcFlowConfig,
        private readonly queue: NpcQueueSystem<T>,
        private readonly callbacks: NpcFlowCallbacks<T>,
    ) {}

    walkFirstAway(done?: () => void) {
        const config = this.getConfig();
        const npc = this.queue.shiftFrontToDeparting();
        if (!npc) {
            done?.();
            return;
        }

        let coinsGiven = config.coinsPerTrade <= 0;
        let coinFlowComplete = config.coinsPerTrade <= 0;
        let completed = false;
        const completeIfReady = () => {
            if (completed || !coinFlowComplete) {
                return;
            }
            completed = true;
            done?.();
        };
        const giveCoins = () => {
            if (coinsGiven) {
                completeIfReady();
                return;
            }
            coinsGiven = true;
            const coinFlowDuration = this.callbacks.spawnCoinsOnPlane(config.coinsPerTrade, npc.node);
            if (coinFlowDuration <= 0) {
                this.callbacks.setBubbleState(npc, 'smile');
                coinFlowComplete = true;
                completeIfReady();
                return;
            }
            this.callbacks.scheduleOnce(() => {
                this.callbacks.setBubbleState(npc, 'smile');
                coinFlowComplete = true;
                completeIfReady();
            }, coinFlowDuration);
        };

        if (config.showCompleteCheckBubble) {
            this.callbacks.setBubbleState(npc, 'check');
        } else {
            this.callbacks.clearBubble(npc.node);
        }
        if (coinFlowComplete) {
            this.callbacks.setBubbleState(npc, 'smile');
        }

        const nextNpc = this.queue.front();
        if (nextNpc) {
            this.callbacks.applyQueueBubble(nextNpc, 0);
            this.reflow();
        }

        const startPosition = npc.node.position.clone();
        const exitPosition = config.npcExitNode?.position.clone() ?? this.getLeaveForwardPosition(startPosition);
        const coinDropPosition = this.getCoinDropPosition(startPosition, exitPosition, config);
        const offscreenPosition = this.getOffscreenExitPosition(coinDropPosition, exitPosition, config);
        const route: LeaveRouteStep[] = [
            { position: coinDropPosition, clip: 'walk315', giveCoinsAfterArrival: true },
            { position: exitPosition, clip: 'walk225' },
            { position: offscreenPosition, clip: 'walk225' },
        ];
        const totalDistance = route.reduce((sum, step, index) => {
            const from = index === 0 ? startPosition : route[index - 1].position;
            return sum + Vec3.distance(from, step.position);
        }, 0);

        let leaveTween = tween(npc.node);
        let fromPosition = startPosition;
        route.forEach((step) => {
            const distance = Vec3.distance(fromPosition, step.position);
            if (distance > 0.5 && totalDistance > 0.5) {
                const duration = Math.max(0.01, config.leaveDuration * distance / totalDistance);
                const targetPosition = step.position.clone();
                leaveTween = leaveTween
                    .call(() => {
                        npc.play(step.clip);
                        this.callbacks.setCarryDirection(npc, step.clip === 'walk225' ? '225' : '315');
                    })
                    .to(duration, { position: targetPosition });
                fromPosition = targetPosition;
            }
            if (step.giveCoinsAfterArrival) {
                leaveTween = leaveTween.call(giveCoins);
            }
        });

        leaveTween
            .call(() => {
                giveCoins();
                this.queue.removeDeparting(npc);
                this.callbacks.cleanup(npc.node);
                npc.node.destroy();
                this.spawnAtQueueTail();
            })
            .start();
    }

    spawnAtQueueTail() {
        const queueIndex = this.queue.queuedLength();
        const targetPosition = this.getQueueTargetPosition(queueIndex);
        const spawnPosition = this.getOffscreenEntryPosition(targetPosition, queueIndex);
        const npc = this.callbacks.createNpc(spawnPosition, true);
        this.queue.pushQueued(npc);
        this.walkToQueuePosition(npc, targetPosition, queueIndex);
    }

    walkToQueuePosition(npc: T, targetPosition: Vec3, queueIndex: number) {
        if (!npc.node.isValid) {
            return;
        }
        const distance = Vec3.distance(npc.node.position, targetPosition);
        if (distance <= 0.5) {
            npc.play('idle');
            this.callbacks.applyQueueBubble(npc, queueIndex);
            return;
        }
        npc.play('walk315');
        tween(npc.node)
            .to(Math.max(0.01, this.getConfig().enterDuration), { position: targetPosition.clone() })
            .call(() => {
                if (!npc.node.isValid) {
                    return;
                }
                npc.play('idle');
                this.callbacks.applyQueueBubble(npc, queueIndex);
            })
            .start();
    }

    reflow(done?: () => void) {
        const npcs = this.queue.validQueuedActors();
        if (npcs.length === 0) {
            done?.();
            return;
        }
        let remaining = npcs.length;
        const finishOne = () => {
            remaining -= 1;
            if (remaining <= 0) {
                done?.();
            }
        };
        const reflowDuration = this.getConfig().reflowDuration;
        npcs.forEach((npc, index) => {
            const targetPosition = this.getQueueTargetPosition(index);
            npc.play(Vec3.distance(npc.node.position, targetPosition) > 0.5 ? 'walk315' : 'idle');
            tween(npc.node).to(reflowDuration, { position: targetPosition.clone() }).call(() => {
                npc.play('idle');
                this.callbacks.applyQueueBubble(npc, index);
                finishOne();
            }).start();
        });
    }

    getQueueTargetPosition(index: number) {
        return this.queue.getQueueTargetPosition(index, this.getConfig().npcEntryNode?.position);
    }

    private getOffscreenEntryPosition(targetPosition: Vec3, queueIndex: number) {
        const config = this.getConfig();
        const expandedVisibleRect = this.callbacks.getVisibleRect(config.enterOffscreenPadding);
        const preferredPosition = config.npcEntryNode?.position.clone();
        if (preferredPosition && !this.isPointInsideRect(preferredPosition, expandedVisibleRect)) {
            return preferredPosition;
        }

        const direction = this.getEntryDirection(targetPosition, queueIndex, preferredPosition);
        return this.projectPointOutsideRect(targetPosition, direction, expandedVisibleRect, config.enterOffscreenPadding);
    }

    private getEntryDirection(targetPosition: Vec3, queueIndex: number, preferredPosition?: Vec3) {
        const previousQueuePosition = this.queue.getPreviousQueuePosition(queueIndex);
        const direction = previousQueuePosition
            ? new Vec2(targetPosition.x - previousQueuePosition.x, targetPosition.y - previousQueuePosition.y)
            : new Vec2();

        if (direction.lengthSqr() <= 0.001 && preferredPosition) {
            direction.set(preferredPosition.x - targetPosition.x, preferredPosition.y - targetPosition.y);
        }
        if (direction.lengthSqr() <= 0.001) {
            direction.set(1, -0.75);
        }
        direction.normalize();
        return direction;
    }

    private projectPointOutsideRect(origin: Vec3, direction: Vec2, rect: NpcVisibleRect, fallbackDistance: number) {
        const distances: number[] = [];
        if (direction.x > 0.001) {
            distances.push((rect.right - origin.x) / direction.x);
        } else if (direction.x < -0.001) {
            distances.push((rect.left - origin.x) / direction.x);
        }
        if (direction.y > 0.001) {
            distances.push((rect.top - origin.y) / direction.y);
        } else if (direction.y < -0.001) {
            distances.push((rect.bottom - origin.y) / direction.y);
        }

        const distanceToLeaveRect = distances
            .filter((distance) => distance >= 0)
            .sort((a, b) => a - b)[0] ?? Math.max(0, fallbackDistance);
        const travelDistance = distanceToLeaveRect + 1;
        return new Vec3(
            origin.x + direction.x * travelDistance,
            origin.y + direction.y * travelDistance,
            origin.z,
        );
    }

    private getCoinDropPosition(currentPosition: Vec3, exitPosition: Vec3, config: NpcFlowConfig) {
        const coinPlane = config.coinPlaneNode;
        if (!coinPlane?.isValid) {
            return this.getLeaveTurnPosition(currentPosition, exitPosition);
        }
        const transform = coinPlane.getComponent(UITransform);
        const bottomOffset = (transform?.contentSize.height ?? 96) * 0.5;
        const npcFootOffset = config.renderHeight * Math.max(config.templateScaleY, 0.1) * 0.2;
        return new Vec3(coinPlane.position.x, coinPlane.position.y - bottomOffset - npcFootOffset, currentPosition.z);
    }

    private getLeaveForwardPosition(currentPosition: Vec3) {
        const forwardVector = this.getLeaveForwardVector();
        return new Vec3(
            currentPosition.x + forwardVector.x,
            currentPosition.y + forwardVector.y,
            currentPosition.z,
        );
    }

    private getLeaveTurnPosition(currentPosition: Vec3, exitPosition: Vec3) {
        const forwardVector = this.getLeaveForwardVector();
        if (Math.abs(forwardVector.y) > 0.001) {
            const stepCountToExitY = (exitPosition.y - currentPosition.y) / forwardVector.y;
            if (stepCountToExitY > 1) {
                return new Vec3(
                    currentPosition.x + forwardVector.x * stepCountToExitY,
                    exitPosition.y,
                    currentPosition.z,
                );
            }
        }
        return this.getLeaveForwardPosition(currentPosition);
    }

    private getLeaveForwardVector() {
        return this.queue.getLeaveForwardVector(new Vec3(-90, 40, 0));
    }

    private getOffscreenExitPosition(routeStart: Vec3, exitPosition: Vec3, config: NpcFlowConfig) {
        const direction = new Vec2(exitPosition.x - routeStart.x, exitPosition.y - routeStart.y);
        if (direction.lengthSqr() <= 0.001) {
            direction.set(-1, 0);
        } else {
            direction.normalize();
        }

        const rect = this.callbacks.getVisibleRect(config.leaveOffscreenPadding);
        if (!this.isPointInsideRect(exitPosition, rect)) {
            return exitPosition.clone();
        }

        const distances: number[] = [];
        if (direction.x > 0.001) {
            distances.push((rect.right - exitPosition.x) / direction.x);
        } else if (direction.x < -0.001) {
            distances.push((rect.left - exitPosition.x) / direction.x);
        }
        if (direction.y > 0.001) {
            distances.push((rect.top - exitPosition.y) / direction.y);
        } else if (direction.y < -0.001) {
            distances.push((rect.bottom - exitPosition.y) / direction.y);
        }

        const distanceToLeaveRect = distances
            .filter((distance) => distance >= 0)
            .sort((a, b) => a - b)[0] ?? config.leaveOffscreenPadding;
        const travelDistance = distanceToLeaveRect + 1;
        return new Vec3(
            exitPosition.x + direction.x * travelDistance,
            exitPosition.y + direction.y * travelDistance,
            exitPosition.z,
        );
    }

    private isPointInsideRect(point: Vec3, rect: NpcVisibleRect) {
        return point.x >= rect.left && point.x <= rect.right && point.y >= rect.bottom && point.y <= rect.top;
    }
}
