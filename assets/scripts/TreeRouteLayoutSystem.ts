import { instantiate, Mat4, Node, Prefab, UITransform, Vec3 } from 'cc';
import type { TreeLevel } from './TreeSystem';

export interface TreeRouteLayoutConfig {
    layoutRoot: Node | null;
    actors: Node | null;
    treeStart: Node | null;
    forwardPoint: Node | null;
    rowPoint: Node | null;
    treesParent: Node | null;
    treePrefabs: (Prefab | null)[];
    cars: (Node | null)[];
    carPlanes: (Node | null)[];
    upgradePlanes: (Node | null)[];
    woodDropPoints: (Node | null)[];
    carGroupOrder: number[];
    carLateralOffsets: number[];
    levelRowCounts: number[];
    rowCount: number;
    columnCount: number;
    columnsPerCar: number;
    treeSpacing: number;
    rowSpacing: number;
    carStartOffset: number;
    woodDropOffsetX: number;
    woodDropOffsetY: number;
}

export interface TreeRouteLayoutResult {
    trees: Node[];
    levels: TreeLevel[];
}

export interface TreeRouteLayoutCallbacks {
    getTreeLevel(index: number): TreeLevel;
    syncLayer(node: Node, layer: number): void;
    setRouteDirections(forward: Vec3, row: Vec3): void;
}

const ROUTE_STUMP_SORT_BAND = 0;
const ROUTE_PLANE_SORT_BAND = 1;

export class TreeRouteLayoutSystem {
    private readonly worldPosition = new Vec3();
    private readonly rootWorldMatrix = new Mat4();

    public constructor(
        private readonly getConfig: () => TreeRouteLayoutConfig,
        private readonly callbacks: TreeRouteLayoutCallbacks,
    ) {}

    public build() {
        const config = this.getConfig();
        const root = config.layoutRoot;
        const actors = config.actors;
        const treeStart = config.treeStart;
        const forwardPoint = config.forwardPoint;
        const rowPoint = config.rowPoint;
        const treesParent = config.treesParent;
        if (!root?.isValid || !actors?.isValid || !treeStart?.isValid || !forwardPoint?.isValid || !rowPoint?.isValid || !treesParent?.isValid) {
            return null;
        }

        const configuredLevelRows = config.levelRowCounts.map((count) => Math.max(0, Math.floor(count)));
        const configuredRowCount = configuredLevelRows.reduce((sum, count) => sum + count, 0);
        const rowCount = configuredRowCount > 0
            ? configuredRowCount
            : Math.max(1, Math.floor(config.rowCount));
        const columnCount = Math.max(1, Math.floor(config.columnCount));
        const columnsPerCar = Math.max(1, Math.floor(config.columnsPerCar));
        const forward = forwardPoint.position.clone().subtract(treeStart.position);
        forward.z = 0;
        if (forward.lengthSqr() <= 0.0001) {
            console.warn('TreeRouteLayoutSystem requires ForwardPoint to be separated from TreeStart.');
            return null;
        }

        forward.normalize();
        const side = rowPoint.position.clone().subtract(treeStart.position);
        side.z = 0;
        if (side.lengthSqr() <= 0.0001) {
            console.warn('TreeRouteLayoutSystem requires RowPoint to be separated from TreeStart.');
            return null;
        }

        side.normalize();
        if (Math.abs(side.x * forward.y - side.y * forward.x) <= 0.0001) {
            console.warn('TreeRouteLayoutSystem requires RowPoint and ForwardPoint to define different directions.');
            return null;
        }

        this.callbacks.setRouteDirections(forward, side);
        const routeNodes = this.getRouteNodes(config);
        this.clearGeneratedTrees(actors, routeNodes);
        this.clearGeneratedTrees(treesParent, new Set<Node>());

        const trees: Node[] = [];
        const levels: TreeLevel[] = [];
        const start = treeStart.position.clone();
        for (let row = 0; row < rowCount; row += 1) {
            for (let column = 0; column < columnCount; column += 1) {
                const index = row * columnCount + column;
                const level = configuredRowCount > 0
                    ? this.getLevelForRow(row, configuredLevelRows)
                    : this.callbacks.getTreeLevel(index);
                const prefab = config.treePrefabs[level - 1];
                if (!prefab) {
                    console.warn(`Tree prefab for level ${level} is missing.`);
                    continue;
                }

                const tree = instantiate(prefab);
                tree.name = `Tree${index}`;
                treesParent.addChild(tree);
                this.callbacks.syncLayer(tree, treesParent.layer);
                tree.setPosition(this.getGridPosition(
                    start,
                    side,
                    forward,
                    column,
                    row,
                    config.treeSpacing,
                    config.rowSpacing,
                ));
                tree.setParent(actors, true);
                this.callbacks.syncLayer(tree, actors.layer);
                tree.active = true;
                trees.push(tree);
                levels.push(level);
            }
        }

        this.placeCars(config, root, actors, start, side, forward, columnCount, columnsPerCar);
        this.placeUpgradePlanes(config, actors);
        this.placeWoodDropPoints(config, root, actors);
        root.active = true;
        return { trees, levels } satisfies TreeRouteLayoutResult;
    }

    public getSortYOverride(node: Node) {
        return this.isRouteNode(node)
            ? this.getDepthY(node, this.getCarNodes(this.getConfig()), this.getRoutePlaneNodes(this.getConfig()))
            : null;
    }

    public getSortBandOverride(node: Node) {
        if (!this.isRouteNode(node)) {
            return null;
        }
        if (this.isActiveTreeStump(node)) {
            return ROUTE_STUMP_SORT_BAND;
        }
        if (this.getRoutePlaneNodes(this.getConfig()).has(node)) {
            return ROUTE_PLANE_SORT_BAND;
        }
        return null;
    }

    private clearGeneratedTrees(parent: Node, preservedNodes: Set<Node>) {
        parent.children.slice().forEach((child) => {
            if (preservedNodes.has(child)) {
                return;
            }
            if (this.isGeneratedTree(child)) {
                child.removeFromParent();
                child.destroy();
            }
        });
    }

    private placeCars(
        config: TreeRouteLayoutConfig,
        root: Node,
        actors: Node,
        start: Vec3,
        side: Vec3,
        forward: Vec3,
        columnCount: number,
        columnsPerCar: number,
    ) {
        config.cars.forEach((car, index) => {
            if (!car?.isValid) {
                return;
            }
            if (car.parent !== actors) {
                car.setParent(actors, true);
            }
            const configuredGroup = Math.floor(config.carGroupOrder[index] ?? index);
            const maxGroupIndex = Math.max(0, Math.ceil(columnCount / columnsPerCar) - 1);
            const groupIndex = configuredGroup >= 0 && configuredGroup <= maxGroupIndex
                ? configuredGroup
                : index;
            const firstColumn = groupIndex * columnsPerCar;
            if (firstColumn >= columnCount) {
                return;
            }
            const groupSize = Math.min(columnsPerCar, columnCount - firstColumn);
            const centerColumn = firstColumn + (groupSize - 1) * 0.5;
            const lateralOffset = config.carLateralOffsets[index] ?? 0;
            const position = start.clone()
                .add(side.clone().multiplyScalar(centerColumn * config.treeSpacing + lateralOffset))
                .subtract(forward.clone().multiplyScalar(config.carStartOffset));
            car.setPosition(this.toActorsPosition(position, root, actors));

            const plane = config.carPlanes[index];
            if (plane?.isValid) {
                this.moveToActorsLayer(plane, actors);
                plane.setWorldPosition(car.worldPosition);
            }
        });
    }

    private placeUpgradePlanes(config: TreeRouteLayoutConfig, actors: Node) {
        const primaryPlane = config.carPlanes[0];
        if (!primaryPlane?.isValid) {
            return;
        }
        config.upgradePlanes.forEach((plane) => {
            if (plane?.isValid) {
                this.moveToActorsLayer(plane, actors);
                plane.setWorldPosition(primaryPlane.worldPosition);
            }
        });
    }

    private moveToActorsLayer(node: Node, actors: Node) {
        if (node.parent !== actors) {
            node.setParent(actors, true);
        }
        this.callbacks.syncLayer(node, actors.layer);
    }

    private getDepthY(node: Node, carNodes: Set<Node>, routePlaneNodes: Set<Node>) {
        const groundAnchor = this.getVisibleGroundAnchor(node);
        if (groundAnchor?.isValid) {
            return node.position.y + groundAnchor.position.y * Math.abs(node.scale.y);
        }

        if (carNodes.has(node)) {
            const transform = node.getComponent(UITransform);
            if (transform) {
                return node.position.y - transform.contentSize.height * transform.anchorPoint.y * Math.abs(node.scale.y);
            }
        }

        if (routePlaneNodes.has(node)) {
            const transform = node.getComponent(UITransform);
            if (transform) {
                return node.position.y
                    - transform.contentSize.height * transform.anchorPoint.y * Math.abs(node.scale.y);
            }
        }

        return node.position.y;
    }

    private isRouteNode(node: Node) {
        const config = this.getConfig();
        return this.isGeneratedTree(node)
            || config.cars.some((car) => car === node)
            || config.carPlanes.some((plane) => plane === node)
            || config.upgradePlanes.some((plane) => plane === node)
            || config.woodDropPoints.some((point) => point === node);
    }

    private getVisibleGroundAnchor(node: Node) {
        const anchors = [node.getChildByName('Shadow'), node.getChildByName('TreeStump')];
        return anchors.find((anchor) => anchor?.isValid && anchor.active) ?? anchors.find((anchor) => anchor?.isValid) ?? null;
    }

    private isActiveTreeStump(node: Node) {
        const stump = node.getChildByName('TreeStump');
        return !!stump?.isValid && stump.active;
    }

    private getRouteNodes(config: TreeRouteLayoutConfig) {
        return new Set([
            ...this.getCarNodes(config),
            ...this.getRoutePlaneNodes(config),
            ...config.woodDropPoints.filter((point): point is Node => !!point?.isValid),
        ]);
    }

    private getCarNodes(config: TreeRouteLayoutConfig) {
        return new Set(config.cars.filter((car): car is Node => !!car?.isValid));
    }

    private getRoutePlaneNodes(config: TreeRouteLayoutConfig) {
        return new Set([
            ...config.carPlanes,
            ...config.upgradePlanes,
        ].filter((plane): plane is Node => !!plane?.isValid));
    }

    private isGeneratedTree(node: Node) {
        return /^Tree\d+$/.test(node.name);
    }

    private getLevelForRow(row: number, levelRowCounts: number[]): TreeLevel {
        let endRow = 0;
        for (let index = 0; index < levelRowCounts.length; index += 1) {
            endRow += levelRowCounts[index];
            if (row < endRow) {
                return Math.min(3, index + 1) as TreeLevel;
            }
        }
        return 3;
    }

    private getGridPosition(
        start: Vec3,
        side: Vec3,
        forward: Vec3,
        column: number,
        row: number,
        treeSpacing: number,
        rowSpacing: number,
    ) {
        return start.clone()
            .add(side.clone().multiplyScalar(column * treeSpacing))
            .add(forward.clone().multiplyScalar(row * rowSpacing));
    }

    private placeWoodDropPoints(config: TreeRouteLayoutConfig, _root: Node, actors: Node) {
        config.woodDropPoints.forEach((point, flatIndex) => {
            if (!point?.isValid) {
                return;
            }
            const carIndex = Math.floor(flatIndex / 3);
            const level = flatIndex % 3 + 1;
            const anchor = level === 1
                ? config.upgradePlanes[carIndex]
                : config.upgradePlanes[3 + carIndex];
            if (!anchor?.isValid) {
                return;
            }
            this.moveToActorsLayer(point, actors);
            const anchorPosition = actors.getComponent(UITransform)?.convertToNodeSpaceAR(anchor.worldPosition)
                ?? anchor.position.clone();
            point.setPosition(
                anchorPosition.x + config.woodDropOffsetX,
                anchorPosition.y + config.woodDropOffsetY,
                0,
            );
            point.active = false;
        });
    }

    private toActorsPosition(localPosition: Vec3, root: Node, actors: Node) {
        root.getWorldMatrix(this.rootWorldMatrix);
        Vec3.transformMat4(this.worldPosition, localPosition, this.rootWorldMatrix);
        return actors.inverseTransformPoint(new Vec3(), this.worldPosition);
    }
}
