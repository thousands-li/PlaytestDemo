import { instantiate, Node, Prefab, Vec3 } from 'cc';
import type { TreeLevel } from './TreeSystem';

export interface TreeRouteLayoutConfig {
    layoutRoot: Node | null;
    treeStart: Node | null;
    forwardPoint: Node | null;
    rowPoint: Node | null;
    treesParent: Node | null;
    treePrefabs: (Prefab | null)[];
    cars: (Node | null)[];
    carPlanes: (Node | null)[];
    upgradePlanes: (Node | null)[];
    carGroupOrder: number[];
    carLateralOffsets: number[];
    levelRowCounts: number[];
    rowCount: number;
    columnCount: number;
    columnsPerCar: number;
    treeSpacing: number;
    rowSpacing: number;
    carStartOffset: number;
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

export class TreeRouteLayoutSystem {
    public constructor(
        private readonly getConfig: () => TreeRouteLayoutConfig,
        private readonly callbacks: TreeRouteLayoutCallbacks,
    ) {}

    public build() {
        const config = this.getConfig();
        const root = config.layoutRoot;
        const treeStart = config.treeStart;
        const forwardPoint = config.forwardPoint;
        const rowPoint = config.rowPoint;
        const treesParent = config.treesParent;
        if (!root?.isValid || !treeStart?.isValid || !forwardPoint?.isValid || !rowPoint?.isValid || !treesParent?.isValid) {
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
        this.clearTrees(treesParent);
        const planesParent = this.preparePlaneLayer(config, root);

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
                tree.active = true;
                trees.push(tree);
                levels.push(level);
            }
        }

        this.sortTreesByDepth(trees);
        this.placeCars(config, start, side, forward, columnCount, columnsPerCar);
        this.placeUpgradePlanes(config);
        this.refreshLayerOrder(config, treesParent, planesParent);
        root.active = true;
        return { trees, levels } satisfies TreeRouteLayoutResult;
    }

    private clearTrees(parent: Node) {
        parent.children.slice().forEach((child) => {
            child.removeFromParent();
            child.destroy();
        });
    }

    private placeCars(
        config: TreeRouteLayoutConfig,
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
            car.setPosition(position);

            const plane = config.carPlanes[index];
            if (plane?.isValid) {
                plane.setWorldPosition(car.worldPosition);
            }
        });
    }

    private sortTreesByDepth(trees: Node[]) {
        trees
            .slice()
            .sort((a, b) => b.position.y - a.position.y || a.position.x - b.position.x)
            .forEach((tree, index) => tree.setSiblingIndex(index));
    }

    private placeUpgradePlanes(config: TreeRouteLayoutConfig) {
        const primaryPlane = config.carPlanes[0];
        if (!primaryPlane?.isValid) {
            return;
        }
        config.upgradePlanes.forEach((plane) => {
            if (plane?.isValid) {
                plane.setWorldPosition(primaryPlane.worldPosition);
            }
        });
    }

    private preparePlaneLayer(config: TreeRouteLayoutConfig, root: Node) {
        const planes = [...config.carPlanes, ...config.upgradePlanes]
            .filter((plane): plane is Node => !!plane?.isValid);
        const existing = root.getChildByName('RoutePlanes');
        const planesParent = existing?.isValid ? existing : new Node('RoutePlanes');
        if (!existing?.isValid) {
            root.addChild(planesParent);
            const sourceScale = planes[0]?.parent?.worldScale ?? Vec3.ONE;
            const rootScale = root.worldScale;
            planesParent.setScale(
                this.divideScale(sourceScale.x, rootScale.x),
                this.divideScale(sourceScale.y, rootScale.y),
                this.divideScale(sourceScale.z, rootScale.z),
            );
        }
        this.callbacks.syncLayer(planesParent, root.layer);

        planes.forEach((plane) => {
            if (plane.parent !== planesParent) {
                plane.setParent(planesParent, true);
            }
        });
        return planesParent;
    }

    private refreshLayerOrder(config: TreeRouteLayoutConfig, treesParent: Node, planesParent: Node) {
        const root = config.layoutRoot;
        if (!root?.isValid) {
            return;
        }

        treesParent.setSiblingIndex(root.children.length - 1);
        planesParent.setSiblingIndex(root.children.length - 1);
        config.cars.forEach((car) => {
            if (car?.isValid && car.parent === root) {
                car.setSiblingIndex(root.children.length - 1);
            }
        });
    }

    private divideScale(value: number, divisor: number) {
        return Math.abs(divisor) > 0.0001 ? value / divisor : value;
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
}
