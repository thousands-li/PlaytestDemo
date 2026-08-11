import { Node, UITransform, Vec3 } from 'cc';

interface InteractionZone {
    name: string;
    node: Node;
    radius: number;
    active: boolean;
    matchNodeBounds: boolean;
}

export class InteractionZoneSystem {
    private zones = new Map<string, InteractionZone>();

    add(name: string, node: Node, radius: number, matchNodeBounds = false) {
        this.zones.set(name, { name, node, radius, active: true, matchNodeBounds });
    }

    getNode(name: string) {
        return this.zones.get(name)?.node ?? null;
    }

    hit(name: string, pos: Vec3) {
        const zone = this.zones.get(name);
        if (!zone || !zone.active || !zone.node.isValid || !zone.node.active) {
            return false;
        }

        const transform = zone.node.getComponent(UITransform);
        if (zone.matchNodeBounds && transform && transform.contentSize.width > 0 && transform.contentSize.height > 0) {
            const localPos = transform.convertToNodeSpaceAR(pos);
            const anchor = transform.anchorPoint;
            const left = -transform.contentSize.width * anchor.x;
            const right = transform.contentSize.width * (1 - anchor.x);
            const bottom = -transform.contentSize.height * anchor.y;
            const top = transform.contentSize.height * (1 - anchor.y);
            return localPos.x >= left && localPos.x <= right && localPos.y >= bottom && localPos.y <= top;
        }

        return Vec3.distance(pos, zone.node.worldPosition) < zone.radius * this.getNodeWorldRadiusScale(zone.node);
    }

    playerFootHit(name: string, playerNode: Node, footInsetRatio: number, footHalfWidthRatio: number) {
        const transform = playerNode.getComponent(UITransform);
        if (!transform) {
            return this.hit(name, playerNode.worldPosition);
        }

        const size = transform.contentSize;
        const anchor = transform.anchorPoint;
        const footY = -size.height * anchor.y + size.height * footInsetRatio;
        const footHalfWidth = size.width * footHalfWidthRatio;
        return [
            new Vec3(0, footY, 0),
            new Vec3(-footHalfWidth, footY, 0),
            new Vec3(footHalfWidth, footY, 0),
        ].some((localPos) => this.hit(name, transform.convertToWorldSpaceAR(localPos)));
    }

    private getNodeWorldRadiusScale(node: Node) {
        const scale = node.worldScale;
        return Math.max(Math.abs(scale.x), Math.abs(scale.y), 0.0001);
    }
}
