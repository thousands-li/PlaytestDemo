import { Node, Vec3 } from 'cc';

export interface NpcQueueActor {
    node: Node;
    play(name: string): void;
    update(dt: number, fps?: number): void;
}

export class NpcQueueSystem<T extends NpcQueueActor> {
    private queuedActors: T[] = [];
    private departingActors: T[] = [];
    private queuePositions: Vec3[] = [];

    public reset(actors: T[], positions: Vec3[]) {
        this.queuedActors = actors.slice();
        this.departingActors = [];
        this.queuePositions = positions.map((position) => position.clone());
    }

    public updateAnimations(dt: number, fps: number) {
        this.queuedActors.forEach((npc) => npc.update(dt, fps));
        this.departingActors.forEach((npc) => npc.update(dt, fps));
    }

    public front() {
        const npc = this.queuedActors[0] ?? null;
        return npc?.node.isValid ? npc : null;
    }

    public hasFront() {
        return !!this.front();
    }

    public queuedLength() {
        return this.queuedActors.length;
    }

    public validQueuedActors() {
        return this.queuedActors.filter((npc) => npc.node.isValid);
    }

    public pushQueued(npc: T) {
        this.queuedActors.push(npc);
    }

    public shiftFrontToDeparting() {
        const npc = this.queuedActors.shift() ?? null;
        if (npc) {
            this.departingActors.push(npc);
        }
        return npc;
    }

    public removeDeparting(npc: T) {
        const index = this.departingActors.indexOf(npc);
        if (index >= 0) {
            this.departingActors.splice(index, 1);
        }
    }

    public getQueueTargetPosition(index: number, fallback?: Vec3 | null) {
        return this.queuePositions[index]?.clone()
            ?? this.queuePositions[this.queuePositions.length - 1]?.clone()
            ?? fallback?.clone()
            ?? new Vec3();
    }

    public getPreviousQueuePosition(index: number) {
        return index > 0 ? this.queuePositions[index - 1]?.clone() ?? null : null;
    }

    public getLeaveForwardVector(fallback: Vec3) {
        if (this.queuePositions.length >= 2) {
            const front = this.queuePositions[0];
            const next = this.queuePositions[1];
            return new Vec3(
                front.x - next.x,
                front.y - next.y,
                0,
            );
        }

        return fallback.clone();
    }
}
