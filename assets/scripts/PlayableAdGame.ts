import {
    _decorator,
    Color,
    Component,
    Node,
    Prefab,
    ResolutionPolicy,
    UITransform,
    Vec3,
    view,
} from 'cc';
import { ActorSortSystem, type ActorSortConfig } from './ActorSortSystem';
import { AnimatedSprite } from './AnimatedSprite';
import { AudioService } from './AudioService';
import { CameraFollowSystem, type CameraFollowConfig } from './CameraFollowSystem';
import { CarActorFactory, type CarActorFactoryConfig } from './CarActorFactory';
import { CarSystem, type CarSystemConfig } from './CarSystem';
import { CoinPlaneSystem, type CoinPlaneConfig } from './CoinPlaneSystem';
import { ControlSceneBuilder, type ControlSceneBuilderConfig } from './ControlSceneBuilder';
import { EconomyService } from './EconomyService';
import { type Direction } from './Direction';
import { GameAssetService } from './GameAssetService';
import { GameEffectSystem, type GameEffectConfig } from './GameEffectSystem';
import { GameLayerSystem, type GameLayerConfig } from './GameLayerSystem';
import { GamePreloadSystem, type GamePreloadConfig } from './GamePreloadSystem';
import { GameSceneBuildSystem, type GameSceneBuildConfig } from './GameSceneBuildSystem';
import { GameSessionSystem, type GameSessionConfig } from './GameSessionSystem';
import { GameplayActionSystem, type GameplayActionConfig } from './GameplayActionSystem';
import { GameplayFlowSystem, type GameplayFlowConfig } from './GameplayFlowSystem';
import { GameUiFactory } from './GameUiFactory';
import { GuideCoordinator, type GuideCoordinatorConfig } from './GuideCoordinator';
import { GuideSystem } from './GuideSystem';
import { HudSystem, type HudSystemConfig } from './HudSystem';
import { InputController, type InputControllerConfig } from './InputController';
import { InteractionZoneSystem } from './InteractionZoneSystem';
import { NpcBubbleCoordinator, type NpcBubbleConfig } from './NpcBubbleCoordinator';
import { NpcFlowSystem, type NpcFlowConfig } from './NpcFlowSystem';
import { NpcQueueSystem } from './NpcQueueSystem';
import { NpcSceneBuilder, type NpcSceneBuilderConfig } from './NpcSceneBuilder';
import { NpcTradeService } from './NpcTradeService';
import { NpcVisualController, type NpcVisualConfig } from './NpcVisualController';
import { OverlaySystem, type OverlaySystemConfig } from './OverlaySystem';
import { PlayerFootRingSystem, type PlayerFootRingConfig } from './PlayerFootRingSystem';
import { PlayerCarryVisualController, type PlayerCarryVisualConfig } from './PlayerCarryVisualController';
import { PlayerMovementSystem, type PlayerMovementConfig } from './PlayerMovementSystem';
import { PlayerSceneBuilder, type PlayerSceneBuilderConfig } from './PlayerSceneBuilder';
import { PromptEffectSystem, type PromptEffectConfig } from './PromptEffectSystem';
import { SceneNodeResolver } from './SceneNodeResolver';
import { SellZoneVisualSystem, type SellZoneVisualConfig } from './SellZoneVisualSystem';
import { StartAreaSystem, type StartAreaConfig } from './StartAreaSystem';
import { StoreLinkService, type StoreLinkConfig } from './StoreLinkService';
import { TreeSystem, type TreeSystemConfig } from './TreeSystem';
import { TreeRouteLayoutSystem, type TreeRouteLayoutConfig } from './TreeRouteLayoutSystem';
import { TreeWoodDropSystem, type TreeWoodDropConfig } from './TreeWoodDropSystem';
import { WoodCollectionSystem, type WoodCollectionConfig } from './WoodCollectionSystem';
import { WorldSceneBuilder, type WorldSceneBuilderConfig } from './WorldSceneBuilder';

const { ccclass, property } = _decorator;

const CARRY_BACKPACK_SORT_BIAS_Y = 0.5;
const PLAYER_FOOT_RING_SORT_BIAS_Y = 80;

@ccclass('PlayableAdGame')
export class PlayableAdGame extends Component {
    @property({ displayName: '设计宽度', tooltip: '游戏设计分辨率宽度，会用于 Canvas 尺寸和触摸坐标换算。' })
    public designWidth = 1280;

    @property({ displayName: '设计高度', tooltip: '游戏设计分辨率高度，会用于 Canvas 尺寸和触摸坐标换算。' })
    public designHeight = 720;

    @property({ displayName: '玩家移动速度', tooltip: '玩家每秒移动的像素距离。' })
    public playerSpeed = 220;

    @property({ displayName: 'Player collision foot inset', tooltip: 'Normalized foot height used by movement collision.' })
    public playerCollisionFootInsetRatio = 0.08;

    @property({ displayName: 'Player collision radius X', tooltip: 'Horizontal radius added to movement blockers.' })
    public playerCollisionRadiusX = 22;

    @property({ displayName: 'Player collision radius Y', tooltip: 'Vertical radius added to movement blockers.' })
    public playerCollisionRadiusY = 12;

    @property({ displayName: '移动最小 X', tooltip: '玩家可移动范围的左边界。' })
    public moveMinX = -570;

    @property({ displayName: '移动最大 X', tooltip: '玩家可移动范围的右边界。' })
    public moveMaxX = 570;

    @property({ displayName: '移动最小 Y', tooltip: '玩家可移动范围的下边界。' })
    public moveMinY = -300;

    @property({ displayName: '移动最大 Y', tooltip: '玩家可移动范围的上边界。' })
    public moveMaxY = 300;

    @property({
        type: Node,
        displayName: '行走边界节点',
        tooltip: '可选父节点，内部的 Point0、Point1 等子节点会连成玩家可行走区域。',
    })
    public walkableBoundaryNode: Node | null = null;

    @property({ displayName: '相机跟随', tooltip: '开启后世界层和角色层会跟随玩家移动，UI 保持固定。' })
    public cameraFollowEnabled = true;

    @property({ displayName: '相机视野缩放', tooltip: '大于 1 会拉近视野，小于 1 会显示更大的范围。' })
    public cameraViewScale = 1;

    @property({ displayName: '相机跟随平滑', tooltip: '值越大跟随越快；0 表示立即跟随。' })
    public cameraFollowSmooth = 10;

    @property({ displayName: '相机屏幕偏移 X', tooltip: '正数让玩家显示在屏幕右侧，负数显示在屏幕左侧。' })
    public cameraOffsetX = 0;

    @property({ displayName: '相机屏幕偏移 Y', tooltip: '正数让玩家显示在屏幕上方，负数显示在屏幕下方。' })
    public cameraOffsetY = -42;

    @property({ displayName: '相机范围最小 X', tooltip: '相机可看到的世界范围左边界。' })
    public cameraBoundsMinX = -750;

    @property({ displayName: '相机范围最大 X', tooltip: '相机可看到的世界范围右边界。' })
    public cameraBoundsMaxX = 750;

    @property({ displayName: '相机范围最小 Y', tooltip: '相机可看到的世界范围下边界。' })
    public cameraBoundsMinY = -850;

    @property({ displayName: '相机范围最大 Y', tooltip: '相机可看到的世界范围上边界。' })
    public cameraBoundsMaxY = 650;

    @property({ displayName: '摇杆拖动半径', tooltip: '摇杆手柄最多可以离开底座中心的距离。' })
    public joystickRadius = 90;

    @property({ displayName: '全屏触发摇杆', tooltip: '开启后屏幕任意位置按下都会显示摇杆并控制移动。' })
    public joystickFullScreenTouch = true;

    @property({ displayName: '摇杆触摸范围', tooltip: '手指按下位置距离摇杆中心多少像素内才激活摇杆。' })
    public joystickTouchRadius = 180;

    @property({ displayName: '初始木头数量', tooltip: '开局在起点区域生成的木头数量。' })
    public initialStartWoodCount = 20;

    @property({ displayName: '交付木头需求', tooltip: '卖给一个 NPC 需要交付多少个木头。' })
    public woodPerNpcTrade = 10;

    @property({ displayName: '单次交易金币', tooltip: '完成一次 NPC 交易后在金币区域生成的金币数量。' })
    public coinsPerTrade = 20;

    @property({ displayName: '解锁车金币', tooltip: '解锁伐木车需要消耗的金币数量。' })
    public carUnlockCost = 20;

    @property({ displayName: '二级车金币', tooltip: '把车从 1 级升级到 2 级需要消耗的金币数量。' })
    public carUpgrade2Cost = 40;

    @property({ displayName: '三级车金币', tooltip: '把车从 2 级升级到 3 级需要消耗的金币数量。' })
    public carUpgrade3Cost = 100;

    @property({ displayName: '起点收集冷却', tooltip: '玩家在起点区域收集木头的冷却时间，单位秒。' })
    public collectWoodCooldown = 0.05;

    @property({ displayName: '卖木头冷却', tooltip: '玩家在售卖区域每卖出一个木头的间隔，单位秒。' })
    public sellWoodCooldown = 0.05;

    @property({ displayName: '金币收集冷却', tooltip: '玩家在金币区域收集金币的冷却时间，单位秒。' })
    public collectCoinCooldown = 0.45;

    @property({ displayName: '结算延迟', tooltip: '升到 3 级车后多久弹出结束界面，单位秒。' })
    public endOverlayDelay = 0;

    @property({ displayName: '最终升级结束广告', tooltip: '开启后，车辆升到最终等级时会弹出结束界面。' })
    public endAfterFinalUpgrade = true;

    @property({ displayName: '动态飞行时间', tooltip: '木头、金币等飞向目标的动画时长，单位秒。' })
    public flyDuration = 0.32;

    @property({ displayName: '卖木头飞行时长', tooltip: '玩家交给 NPC 的单根木头飞行动画时长，单位秒。' })
    public sellWoodFlyDuration = 0.12;

    @property({ displayName: '动态飞行缩放', tooltip: '木头、金币飞行动画结束时的缩放比例。' })
    public flyEndScale = 0.8;

    @property({ displayName: '木头收集延迟', tooltip: '起点木头逐个飞向玩家时，每个木头之间的延迟，单位秒。' })
    public woodCollectDelay = 0.05;

    @property({ displayName: '金币收集延迟', tooltip: '金币逐个飞向玩家时，每个金币之间的延迟，单位秒。' })
    public coinCollectDelay = 0.025;

    @property({ displayName: '金币弹出初始缩放', tooltip: '金币生成弹出动画开始时的缩放比例。' })
    public coinPopStartScale = 0.05;

    @property({ displayName: '金币弹出间隔', tooltip: '金币生成弹出动画每个金币之间的延迟，单位秒。' })
    public coinPopDelay = 0.03;

    @property({ displayName: '金币弹出时长', tooltip: '金币从小变大的弹出动画时长，单位秒。' })
    public coinPopDuration = 0.18;

    @property({ displayName: 'NPC 离开时长', tooltip: '交易完成后 NPC 走向出口的时间，单位秒。' })
    public npcLeaveDuration = 3.4;

    @property({ displayName: 'NPC 离屏销毁距离', tooltip: 'NPC 离开时，超过当前相机视野外多少像素后销毁。' })
    public npcLeaveOffscreenPadding = 120;

    @property({ displayName: 'NPC 入场离屏距离', tooltip: '新 NPC 从当前相机视野外多远的位置生成并走入队列。' })
    public npcEnterOffscreenPadding = 140;

    @property({ displayName: 'NPC 入场时长', tooltip: '新 NPC 从屏外走到队尾所需时间，单位秒。' })
    public npcEnterDuration = 1.6;

    @property({ displayName: 'NPC 补位时长', tooltip: 'NPC 队列重新排列到各队列点的时间，单位秒。' })
    public npcReflowDuration = 0.4;

    @property({ displayName: '车辆砍树停顿', tooltip: '车辆到达树旁后停顿多久再返回，单位秒。' })
    public carCutDelay = 0.15;

    @property({ displayName: '砍树掉落偏移 Y', tooltip: '车砍树后木头生成点相对树节点的 Y 偏移。' })
    public treeWoodSpawnOffsetY = 20;

    @property({ displayName: '砍树木头延迟', tooltip: '砍树产出的木头逐个落到车后方时，每个木头之间的延迟，单位秒。' })
    public treeWoodFlyDelay = 0.04;

    @property({ displayName: '车后木头拾取半径', tooltip: '玩家距离砍树产出的木头多少像素内触发拾取。' })
    public treeWoodPickupRadius = 105;

    @property({ displayName: '车后木头偏移 X', tooltip: '砍树产出的木头堆相对车辆中心的 X 偏移。' })
    public treeWoodCarOffsetX = -70;

    @property({ displayName: '车后木头偏移 Y', tooltip: '砍树产出的木头堆相对车辆中心的 Y 偏移。' })
    public treeWoodCarOffsetY = -62;

    @property({ displayName: '车后木头列数', tooltip: '砍树产出的木头堆每行数量。' })
    public treeWoodColumns = 5;

    @property({ displayName: '车后木头行数', tooltip: '车辆砍树后固定木头堆使用的行数。' })
    public treeWoodRows = 3;

    @property({ displayName: '车后木头起始偏移 X', tooltip: '砍树产出的木头相对木头堆中心的起始 X 偏移。' })
    public treeWoodOffsetX = 0;

    @property({ displayName: '车后木头起始偏移 Y', tooltip: '砍树产出的木头相对木头堆中心的起始 Y 偏移。' })
    public treeWoodOffsetY = 0;

    @property({ displayName: '车后木头间距 X', tooltip: '砍树产出的木头横向间距。' })
    public treeWoodGapX = 58;

    @property({ displayName: '车后木头间距 Y', tooltip: '砍树产出的木头纵向间距。' })
    public treeWoodGapY = 34;

    @property({ displayName: '车后木头层偏移 Y', tooltip: '砍树产出的木头堆每层叠放时额外抬高的 Y 偏移。' })
    public treeWoodLayerGapY = 16;

    @property({ displayName: '车后木头弹起高度', tooltip: '砍树产出的木头落到车后方前的上抛高度。' })
    public treeWoodDropHopY = 34;

    @property({ displayName: '车后木头弹出缩放', tooltip: '砍树产出的木头生成动画的初始缩放。' })
    public treeWoodDropStartScale = 0.28;

    @property({ displayName: '车后木头落地放大', tooltip: '砍树产出的木头落地瞬间的放大比例。' })
    public treeWoodDropPopScale = 1.14;

    @property({ displayName: '车后木头落地时长', tooltip: '砍树产出的木头飞到车后方并落地的动画时长。' })
    public treeWoodDropDuration = 0.26;

    @property({ displayName: '车后木头宽度', tooltip: '车辆砍树后掉落到车后方的单根木头显示宽度。' })
    public treeWoodWidth = 118;

    @property({ displayName: '车后木头高度', tooltip: '车辆砍树后掉落到车后方的单根木头显示高度。' })
    public treeWoodHeight = 93;

    @property({ displayName: '升级特效偏移 Y', tooltip: '升级特效相对目标节点的 Y 偏移。' })
    public levelUpEffectOffsetY = 20;

    @property({ displayName: '升级特效时长', tooltip: '升级特效播放多久后销毁，单位秒。' })
    public levelUpEffectLifetime = 0.55;

    @property({ displayName: '升级特效宽度', tooltip: '升级特效节点的显示宽度。' })
    public levelUpEffectWidth = 140;

    @property({ displayName: '升级特效高度', tooltip: '升级特效节点的显示高度。' })
    public levelUpEffectHeight = 90;

    @property({ displayName: '按钮呼吸时长', tooltip: '按钮呼吸动画单程时长，单位秒。' })
    public pulseHalfDuration = 0.55;

    @property({ displayName: '开始按钮呼吸缩放', tooltip: '开始界面 Play Now 按钮呼吸动画的最大缩放比例。' })
    public startButtonPulseScale = 1.05;

    @property({ displayName: '结束按钮呼吸缩放', tooltip: '结束界面 Play Now 按钮呼吸动画的最大缩放比例。' })
    public endButtonPulseScale = 1.06;

    @property({ displayName: '结束面板初始缩放', tooltip: '结束弹窗出现动画开始时的缩放比例。' })
    public endPanelStartScale = 0.2;

    @property({ displayName: '结束面板弹出缩放', tooltip: '结束弹窗出现动画第一段放大的目标缩放比例。' })
    public endPanelPopScale = 1.08;

    @property({ displayName: '结束面板弹出时长', tooltip: '结束弹窗出现动画第一段时长，单位秒。' })
    public endPanelPopDuration = 0.28;

    @property({ displayName: '结束面板回弹时长', tooltip: '结束弹窗从放大状态回到正常大小的时长，单位秒。' })
    public endPanelSettleDuration = 0.12;

    @property({ displayName: '玩家渲染高度', tooltip: '玩家动画帧在角色缩放前的目标显示高度。' })
    public playerRenderHeight = 128;

    @property({ displayName: '玩家角色缩放', tooltip: '运行时应用到玩家身上的整体缩放，用来和 NPC 比例保持一致。' })
    public playerCharacterScale = 0.94;

    @property({ displayName: '玩家脚底光圈路径', tooltip: '玩家脚底光圈的 resources SpriteFrame 路径。' })
    public playerFootRingImagePath = 'images/ui/Undercycle';

    @property({ displayName: '玩家脚底光圈宽度', tooltip: '玩家脚底光圈的显示宽度。' })
    public playerFootRingWidth = 64;

    @property({ displayName: '玩家脚底光圈高度', tooltip: '玩家脚底光圈的显示高度。' })
    public playerFootRingHeight = 46;

    @property({ displayName: '玩家脚底光圈偏移 X', tooltip: '脚底光圈相对玩家节点的水平偏移。' })
    public playerFootRingOffsetX = 0;

    @property({ displayName: '玩家脚底光圈偏移 Y', tooltip: '脚底光圈相对玩家节点的垂直偏移。' })
    public playerFootRingOffsetY = -50;

    @property({ displayName: '显示玩家脚底光圈', tooltip: '是否显示玩家脚底的光圈。' })
    public showPlayerFootRing = true;

    @property({ displayName: 'NPC 角色缩放', tooltip: '运行时应用到所有 NPC 身上的整体缩放，用来匹配玩家和携带木头的比例。' })
    public npcCharacterScale = 1.02;

    @property({ displayName: '玩家移动帧率', tooltip: '玩家移动动画每秒播放帧数。' })
    public playerWalkFps = 10;

    @property({ displayName: '玩家待机帧率', tooltip: '玩家待机动画每秒播放帧数。' })
    public playerIdleFps = 6;

    @property({ displayName: 'NPC 动画帧率', tooltip: 'NPC 动画每秒播放帧数。' })
    public npcFps = 8;

    @property({ displayName: 'NPC 显示高度', tooltip: 'NPC 按帧动画原始宽高比显示时的目标高度，避免被裁剪帧拉伸变形。' })
    public npcRenderHeight = 118;

    @property({ displayName: '车辆动画帧率', tooltip: '车辆动画每秒播放帧数。' })
    public carFps = 10;

    @property({ displayName: '特效动画帧率', tooltip: '升级特效动画每秒播放帧数。' })
    public effectFps = 12;

    @property({ displayName: '动画帧数量', tooltip: '角色和车辆动画每个方向默认加载的帧数量。' })
    public animationFrameCount = 6;

    @property({ type: Node, displayName: '游戏根节点', tooltip: '放置 World、Actors、UI、Overlay 的根节点；不填时按 GameRoot 名称查找。' })
    public gameRootNode: Node | null = null;

    @property({ type: Node, displayName: '世界层', tooltip: '背景和功能区域所在层；拖动其子节点可调整场景布局。' })
    public worldNode: Node | null = null;

    @property({ type: Node, displayName: '角色层', tooltip: '玩家、NPC、树、车、掉落物所在层；脚本会按 Y 坐标排序。' })
    public actorsNode: Node | null = null;

    @property({ type: Node, displayName: 'UI 层', tooltip: 'Logo、按钮、计数器、摇杆、引导箭头所在层。' })
    public uiNode: Node | null = null;

    @property({ type: Node, displayName: '弹窗层', tooltip: '加载、开始、结束弹窗所在层，运行时会清空并生成弹窗内容。' })
    public overlayNode: Node | null = null;

    @property({ type: Node, displayName: '背景节点', tooltip: '背景图片节点；拖动节点调整背景位置，改 UITransform 调整尺寸。' })
    public backgroundNode: Node | null = null;

    @property({ type: Node, displayName: '起点区域节点', tooltip: '起点/木头领取区域；拖动节点调整触发中心。' })
    public startZoneNode: Node | null = null;

    @property({ type: Node, displayName: '售卖区域节点', tooltip: '售卖木头区域；拖动节点调整触发中心。' })
    public sellZoneNode: Node | null = null;

    @property({ type: Node, displayName: '金币区域节点', tooltip: '金币领取区域；拖动节点调整触发中心。' })
    public coinZoneNode: Node | null = null;

    @property({ type: Node, displayName: '解锁车区域节点', tooltip: '解锁车辆区域；拖动节点调整触发中心。' })
    public carZoneNode: Node | null = null;

    @property({ type: Node, displayName: '二号车解锁区节点', tooltip: '第二辆车的解锁区域；车辆被更高等级树阻挡后才显示。' })
    public carZone2Node: Node | null = null;

    @property({ type: Node, displayName: '三号车解锁区节点', tooltip: '第三辆车的解锁区域；车辆被更高等级树阻挡后才显示。' })
    public carZone3Node: Node | null = null;

    @property({ type: Node, displayName: '二级升级区域节点', tooltip: '车辆二级升级区域；运行时默认隐藏，拖动节点调整出现位置。' })
    public upgrade2ZoneNode: Node | null = null;

    @property({ type: Node, displayName: '三级升级区域节点', tooltip: '车辆三级升级区域；运行时默认隐藏，拖动节点调整出现位置。' })
    public upgrade3ZoneNode: Node | null = null;

    @property({ type: Node, displayName: '玩家节点', tooltip: '场景里的玩家节点；拖动它调整玩家出生位置。' })
    public playerSceneNode: Node | null = null;

    @property({ type: Node, displayName: '玩家脚底光圈节点', tooltip: '可选的场景节点，用来显示玩家脚底光圈。' })
    public playerFootRingNode: Node | null = null;

    @property({ type: Node, displayName: '车辆节点', tooltip: '场景里的车辆节点；拖动它调整车辆解锁后的默认位置，运行时未解锁前会隐藏。' })
    public carSceneNode: Node | null = null;

    @property({ type: Node, displayName: '二号车节点', tooltip: '第二辆已解锁车辆使用的可选场景节点。' })
    public carScene2Node: Node | null = null;

    @property({ type: Node, displayName: '三号车节点', tooltip: '第三辆已解锁车辆使用的可选场景节点。' })
    public carScene3Node: Node | null = null;

    @property({ type: Node, displayName: '树路线根节点', tooltip: 'TreeRouteRoot 空节点，统一管理树阵基准点、方向点、树容器和三辆车。' })
    public treeRouteRootNode: Node | null = null;

    @property({ type: Node, displayName: '树阵起点', tooltip: '第 1 排第 1 棵树的位置。' })
    public treeStartNode: Node | null = null;

    @property({ type: Node, displayName: '车辆前进方向点', tooltip: 'TreeStart 指向 ForwardPoint 的方向就是三辆车共同的前进方向。' })
    public treeForwardPointNode: Node | null = null;

    @property({ type: Node, displayName: '树排方向点', tooltip: 'TreeStart 指向 RowPoint 的方向就是每排 12 棵树的排列方向。' })
    public treeRowPointNode: Node | null = null;

    @property({ type: Node, displayName: '自动生成树容器', tooltip: '运行时生成的全部树 Prefab 都放在 Trees 节点下。' })
    public generatedTreesNode: Node | null = null;

    @property({ type: Prefab, displayName: '1 级树 Prefab' })
    public treeLevel1Prefab: Prefab | null = null;

    @property({ type: Prefab, displayName: '2 级树 Prefab' })
    public treeLevel2Prefab: Prefab | null = null;

    @property({ type: Prefab, displayName: '3 级树 Prefab' })
    public treeLevel3Prefab: Prefab | null = null;

    @property({ type: Node, displayName: '1级树木头堆节点', tooltip: '1 级树产出的固定木头堆位置标记，运行时会隐藏该标记节点。' })
    public treeWoodPileLevel1Node: Node | null = null;

    @property({ type: Node, displayName: '2级树木头堆节点', tooltip: '2 级树产出的固定木头堆位置标记，运行时会隐藏该标记节点。' })
    public treeWoodPileLevel2Node: Node | null = null;

    @property({ type: Node, displayName: '3级树木头堆节点', tooltip: '3 级树产出的固定木头堆位置标记，运行时会隐藏该标记节点。' })
    public treeWoodPileLevel3Node: Node | null = null;

    @property({ type: [Node], displayName: '树节点列表', tooltip: '每棵树的父节点；位置、缩放从节点读取，等级从“树等级列表”读取。为空时按 Tree0、Tree1 自动查找。' })
    public treeSceneNodes: Node[] = [];

    @property({ type: [Node], displayName: 'NPC 队列节点', tooltip: '开局 NPC 节点和队列位置；拖动这些节点调整排队位置。为空时按 Npc0、Npc1 自动查找。' })
    public npcSceneNodes: Node[] = [];

    @property({ type: Node, displayName: 'NPC 入口节点', tooltip: '新 NPC 进入队列前的出生位置。' })
    public npcEntryNode: Node | null = null;

    @property({ type: Node, displayName: 'NPC 出口节点', tooltip: '完成交易后第一个 NPC 离开的目标位置。' })
    public npcExitNode: Node | null = null;

    @property({ type: Node, displayName: 'Logo 节点', tooltip: '顶部 Logo 节点；拖动它调整位置。' })
    public logoNode: Node | null = null;

    @property({ type: Node, displayName: '场景 Play Now 按钮', tooltip: '场景里的 Play Now 按钮节点；拖入 UI/playnow_en 可保留可视化编辑位置。' })
    public playNowNode: Node | null = null;

    @property({ type: Node, displayName: '顶部按钮节点', tooltip: '顶部 Play Now 按钮节点；拖动它调整位置。' })
    public topPlayNowNode: Node | null = null;

    @property({ type: Node, displayName: '资源计数面板', tooltip: '右上角整块资源计数 UI 面板，使用 images/ui/UI 这张图片；拖动它调整整组计数器位置。' })
    public resourceCounterPanelNode: Node | null = null;

    @property({ type: Node, displayName: '金币图标节点', tooltip: '金币计数器图标节点；拖动它调整位置。' })
    public coinCounterIconNode: Node | null = null;

    @property({ type: Node, displayName: '金币数字节点', tooltip: '金币计数器文字节点；拖动它调整位置，Label 组件可调字号。' })
    public coinCounterLabelNode: Node | null = null;

    @property({ type: Node, displayName: '木头图标节点', tooltip: '木头计数器图标节点；拖动它调整位置。' })
    public woodCounterIconNode: Node | null = null;

    @property({ type: Node, displayName: '木头数字节点', tooltip: '木头计数器文字节点；拖动它调整位置，Label 组件可调字号。' })
    public woodCounterLabelNode: Node | null = null;

    @property({ type: Node, displayName: '摇杆底座节点', tooltip: '摇杆底座节点；拖动它调整摇杆位置。' })
    public joystickBaseNode: Node | null = null;

    @property({ type: Node, displayName: '摇杆手柄节点', tooltip: '摇杆手柄节点；通常和底座同坐标，运行时会跟随拖动。' })
    public joystickKnobNode: Node | null = null;

    @property({ type: Node, displayName: '引导箭头节点', tooltip: '引导箭头节点；运行时会移动到目标区域上方。' })
    public guideArrowNode: Node | null = null;

    @property({ displayName: '起点触发半径', tooltip: '玩家距离起点区域中心多少像素内触发收集木头。' })
    public startZoneRadius = 125;

    @property({ displayName: '售卖触发半径', tooltip: '玩家距离售卖区域中心多少像素内触发卖木头。' })
    public sellZoneRadius = 120;

    @property({ displayName: '金币触发半径', tooltip: '玩家距离金币区域中心多少像素内触发收集金币。' })
    public coinZoneRadius = 120;

    @property({ displayName: '解锁车触发半径', tooltip: '玩家距离车辆解锁区域中心多少像素内触发解锁。' })
    public carZoneRadius = 110;

    @property({ displayName: '二号车区域偏移 X', tooltip: '二号车解锁区域相对一号车区域的运行时备用 X 偏移。' })
    public carPlane2OffsetX = -260;

    @property({ displayName: '二号车区域偏移 Y', tooltip: '二号车解锁区域相对一号车区域的运行时备用 Y 偏移。' })
    public carPlane2OffsetY = 0;

    @property({ displayName: '三号车区域偏移 X', tooltip: '三号车解锁区域相对一号车区域的运行时备用 X 偏移。' })
    public carPlane3OffsetX = 260;

    @property({ displayName: '三号车区域偏移 Y', tooltip: '三号车解锁区域相对一号车区域的运行时备用 Y 偏移。' })
    public carPlane3OffsetY = -180;

    @property({ displayName: '车辆解锁台缩放', tooltip: '三个 20 金币 CarPlane 的 X/Y 缩放。' })
    public carUnlockPlaneScale = 0.7;

    @property({ displayName: '升级台车后距离', tooltip: '40/100 金币升级台沿车辆前进反方向与受阻车辆保持的距离。' })
    public carUpgradePlaneBackOffset = 170;

    @property({ displayName: '二级升级触发半径', tooltip: '玩家距离二级升级区域中心多少像素内触发升级。' })
    public upgrade2ZoneRadius = 110;

    @property({ displayName: '三级升级触发半径', tooltip: '玩家距离三级升级区域中心多少像素内触发升级。' })
    public upgrade3ZoneRadius = 120;

    @property({ displayName: '树等级列表', tooltip: '按树节点顺序填写等级，用英文逗号分隔，只支持 1、2、3。' })
    public treeLevelCsv = '1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3,3';

    @property({ displayName: '树阵排数', tooltip: '沿车辆前进方向生成多少排树。' })
    public treeRouteRowCount = 13;

    @property({ displayName: '1 级树排数', tooltip: '从车辆方向开始连续生成的 1 级树排数。' })
    public treeLevel1RowCount = 6;

    @property({ displayName: '2 级树排数', tooltip: '接在 1 级树之后生成的 2 级树排数。' })
    public treeLevel2RowCount = 4;

    @property({ displayName: '3 级树排数', tooltip: '接在 2 级树之后生成的 3 级树排数。' })
    public treeLevel3RowCount = 3;

    @property({ displayName: '每排树数量', tooltip: '每一整排横向生成多少棵树。' })
    public treeRouteColumnCount = 12;

    @property({ displayName: '每辆车负责列数', tooltip: '首车负责中间 5-8 列，后续两辆车负责 1-4 和 9-12 列。' })
    public treeRouteColumnsPerCar = 4;

    @property({ displayName: '同排树间距', tooltip: '2D 场景中同一排相邻树的中心距离。' })
    public treeRouteTreeSpacing = 60;

    @property({ displayName: '树排间距', tooltip: '沿车辆前进方向相邻两排树的中心距离。' })
    public treeRouteRowSpacing = 80;

    @property({ displayName: '车辆起步后退距离', tooltip: '车辆初始位置相对第 1 排树中心向后退的距离。' })
    public treeRouteCarStartOffset = 270;

    @property({ displayName: '车辆1横向偏移', tooltip: '车辆1及对应生成点沿 TreeStart 到 RowPoint 方向移动；负值向反方向移动。' })
    public treeRouteCar1LateralOffset = 0;

    @property({ displayName: '车辆2横向偏移', tooltip: '车辆2及对应生成点沿 TreeStart 到 RowPoint 方向移动；负值向反方向移动。' })
    public treeRouteCar2LateralOffset = 0;

    @property({ displayName: '车辆3横向偏移', tooltip: '车辆3及对应生成点沿 TreeStart 到 RowPoint 方向移动；负值向反方向移动。' })
    public treeRouteCar3LateralOffset = 0;

    @property({ displayName: '车辆路线方向 X', tooltip: '车辆砍树路线使用的单位方向向量 X 分量。' })
    public carRouteDirectionX = 0.9238795325;

    @property({ displayName: '车辆路线方向 Y', tooltip: '车辆砍树路线使用的单位方向向量 Y 分量。' })
    public carRouteDirectionY = 0.3826834324;

    @property({ displayName: '车辆路线半宽', tooltip: '树距离车辆路线中心线超过该值时，车辆会忽略这棵树。' })
    public carRouteHalfWidth = 58;

    @property({ displayName: '车辆单次砍树数量', tooltip: '车辆一次砍树流程最多可砍的树数量。' })
    public carCutBatchSize = 4;

    @property({ displayName: '车辆受阻晃动距离', tooltip: '车辆被高等级树挡住时前后晃动的距离。' })
    public carBlockedWiggleDistance = 10;

    @property({ displayName: '车辆受阻半周期', tooltip: '车辆受阻晃动半个来回的时长，单位秒。' })
    public carBlockedWiggleHalfDuration = 0.12;

    @property({ displayName: '车辆受阻攻击间隔', tooltip: '车辆受阻时重复冲撞/攻击树的间隔，单位秒。' })
    public carBlockedWiggleInterval = 1;

    @property({ displayName: '受阻树晃动 X', tooltip: '不可砍树被车辆攻击时的水平晃动偏移。' })
    public blockedTreeShakeOffsetX = 8;

    @property({ displayName: '受阻树晃动 Y', tooltip: '不可砍树被车辆攻击时的垂直晃动偏移。' })
    public blockedTreeShakeOffsetY = 0;

    @property({ displayName: '受阻树晃动半周期', tooltip: '不可砍树单次晃动半个来回的时长，单位秒。' })
    public blockedTreeShakeHalfDuration = 0.08;

    @property({ displayName: 'Tree obstacle offset X', tooltip: 'Movement blocker center offset from each tree node.' })
    public treeObstacleOffsetX = 0;

    @property({ displayName: 'Tree obstacle offset Y', tooltip: 'Movement blocker center offset from each tree node.' })
    public treeObstacleOffsetY = -82;

    @property({ displayName: 'Tree obstacle radius X', tooltip: 'Horizontal radius of each living tree blocker.' })
    public treeObstacleRadiusX = 36;

    @property({ displayName: 'Tree obstacle radius Y', tooltip: 'Vertical radius of each living tree blocker.' })
    public treeObstacleRadiusY = 20;

    @property({ displayName: '每棵树基础产木', tooltip: '车辆砍树时的基础产木数量。实际产量 = 基础产木 + 车辆等级 * 等级加成。' })
    public carBaseWoodGain = 2;

    @property({ displayName: '车辆等级产木加成', tooltip: '车辆每提升 1 级额外增加的产木数量。' })
    public carLevelWoodGain = 1;

    @property({ displayName: '车靠近树偏移 X', tooltip: '车辆砍树时相对目标树的 X 偏移。' })
    public carTreeOffsetX = -70;

    @property({ displayName: '车靠近树偏移 Y', tooltip: '车辆砍树时相对目标树的 Y 偏移。' })
    public carTreeOffsetY = -30;

    @property({ displayName: '车去砍树时间', tooltip: '车辆从当前位置移动到目标树附近的时间，单位秒。' })
    public carMoveToTreeDuration = 0.75;

    @property({ displayName: '车返回时间', tooltip: '车辆砍完树返回原位置的时间，单位秒。' })
    public carReturnDuration = 0.65;

    @property({ displayName: '车工作间隔', tooltip: '车辆完成一次砍树后等待多久再寻找下一棵树，单位秒。' })
    public carWorkInterval = 0.8;

    @property({ displayName: '车空闲重试间隔', tooltip: '没有可砍树时多久重新检查一次，单位秒。' })
    public carRetryInterval = 1;

    @property({ displayName: '初始木头列数', tooltip: '起点木头摆放时每行的数量。' })
    public startWoodColumns = 6;

    @property({ displayName: '初始木头偏移 X', tooltip: '起点木头相对起点区域中心的起始 X 偏移。' })
    public startWoodOffsetX = 4;

    @property({ displayName: '初始木头偏移 Y', tooltip: '起点木头相对起点区域中心的起始 Y 偏移。' })
    public startWoodOffsetY = 8;

    @property({ displayName: '初始木头间距 X', tooltip: '起点木头横向间距。' })
    public startWoodGapX = 12;

    @property({ displayName: '初始木头间距 Y', tooltip: '起点木头纵向间距。' })
    public startWoodGapY = 7;

    @property({ displayName: '初始木头层偏移 X', tooltip: '起点木头堆每叠高一层时额外应用的水平偏移。' })
    public startWoodLayerGapX = -10;

    @property({ displayName: '初始木头层偏移 Y', tooltip: '起点木头堆每叠高一层时额外抬高的垂直距离。' })
    public startWoodLayerGapY = 16;

    @property({ displayName: '初始木头宽度', tooltip: '起点区域单根木头的显示宽度。' })
    public startWoodWidth = 96;

    @property({ displayName: '初始木头高度', tooltip: '起点区域单根木头的显示高度。' })
    public startWoodHeight = 78;

    @property({ displayName: '起点消失弹出缩放', tooltip: '起点区域消失前弹起动画使用的缩放比例。' })
    public startPlaneDisappearPopScale = 1.08;

    @property({ displayName: '起点消失结束缩放', tooltip: '起点区域淡出消失时最终达到的缩放比例。' })
    public startPlaneDisappearEndScale = 1.16;

    @property({ displayName: '起点消失弹出时长', tooltip: '起点区域消失动画第一段弹起的时长，单位秒。' })
    public startPlaneDisappearPopDuration = 0.12;

    @property({ displayName: '起点消失淡出时长', tooltip: '起点区域消失动画淡出部分的时长，单位秒。' })
    public startPlaneDisappearFadeDuration = 0.24;

    @property({ displayName: '起点光效透明度', tooltip: '起点木头堆背后柔光的透明度；设为 0 表示隐藏。' })
    public startGlowOpacity = 0;

    @property({ displayName: '金币列数', tooltip: '金币区域金币摆放时每行的数量。' })
    public coinColumns = 3;

    @property({ displayName: '金币行数', tooltip: '金币区域堆叠金币时使用的行数。' })
    public coinRows = 2;

    @property({ displayName: '金币偏移 X', tooltip: '金币相对金币区域中心的起始 X 偏移。' })
    public coinOffsetX = 0;

    @property({ displayName: '金币偏移 Y', tooltip: '金币相对金币区域中心的起始 Y 偏移。' })
    public coinOffsetY = 2;

    @property({ displayName: '金币间距 X', tooltip: '金币横向间距。' })
    public coinGapX = 44;

    @property({ displayName: '金币间距 Y', tooltip: '金币纵向间距。' })
    public coinGapY = 30;

    @property({ displayName: '金币堆层间距', tooltip: '同一堆金币上下层之间的垂直间距。' })
    public coinStackLayerGapY = 5;

    @property({ displayName: '金币堆弹起高度', tooltip: '金币堆生成弹出动画的上跳高度。' })
    public coinStackPopHopY = 18;

    @property({ displayName: '金币堆弹出缩放', tooltip: '金币堆生成弹出时的放大回弹比例。' })
    public coinStackPopScale = 1.12;

    @property({ displayName: '手持木头偏移 X', tooltip: '木头挂到玩家身上时的 X 偏移。' })
    public heldWoodOffsetX = 0;

    @property({ displayName: '手持木头起始 Y', tooltip: '第一块手持木头相对玩家的 Y 偏移。' })
    public heldWoodStartY = 18;

    @property({ displayName: '手持木头层间距', tooltip: '多块手持木头堆叠时的 Y 间距。' })
    public heldWoodGapY = 7.5;

    @property({ displayName: '横向手持木头间距 Y', tooltip: '玩家朝 000/180 方向时，背后横向木头堆叠的 Y 间距。' })
    public heldWoodWideGapY = 13;

    @property({ displayName: '斜向手持木头间距 Y', tooltip: '玩家朝斜向时，背后斜向木头堆叠的 Y 间距。' })
    public heldWoodDiagonalGapY = 9;

    @property({ displayName: '竖向手持木头宽度', tooltip: '玩家朝 090/270 方向时，背后竖向木头单根显示宽度。' })
    public heldWoodCarryWidth = 13;

    @property({ displayName: '竖向手持木头高度', tooltip: '玩家朝 090/270 方向时，背后竖向木头单根显示高度。' })
    public heldWoodCarryHeight = 78;

    @property({ displayName: '横向手持木头宽度', tooltip: '玩家朝 000/180 方向时，背后横向木头单根显示宽度。' })
    public heldWoodCarryWideWidth = 78;

    @property({ displayName: '横向手持木头高度', tooltip: '玩家朝 000/180 方向时，背后横向木头单根显示高度。' })
    public heldWoodCarryWideHeight = 14;

    @property({ displayName: '斜向手持木头宽度', tooltip: '玩家朝斜向时，背后斜向木头单根显示宽度。' })
    public heldWoodCarryDiagonalWidth = 78;

    @property({ displayName: '斜向手持木头高度', tooltip: '玩家朝斜向时，背后斜向木头单根显示高度。' })
    public heldWoodCarryDiagonalHeight = 63;

    @property({ displayName: '手持金币偏移 X', tooltip: '金币挂到玩家身上时的 X 偏移。' })
    public heldCoinOffsetX = 0;

    @property({ displayName: '手持金币起始 Y', tooltip: '第一枚手持金币相对玩家的 Y 偏移。' })
    public heldCoinStartY = 22;

    @property({ displayName: '手持金币层间距', tooltip: '多枚手持金币堆叠时的 Y 间距。' })
    public heldCoinGapY = 7;

    @property({ displayName: '携带物背后距离', tooltip: '携带物堆相对玩家中心向背后偏移的距离。' })
    public heldCarryBackDistance = 38;

    @property({ displayName: '携带物背后 Y 缩放', tooltip: '携带物跟随玩家方向移动时，背后方向在 Y 轴上的视觉压缩比例。' })
    public heldCarryBackYScale = 0.32;

    @property({ displayName: '携带物分离距离', tooltip: '玩家同时携带木头和金币时，两类物品沿背后方向分开的距离。' })
    public heldCarrySideSplit = 30;

    @property({ displayName: '显示角色携带物', tooltip: '是否把已收集的木头/金币显示在角色身上；关闭后只更新右上角计数器。' })
    public showHeldCarryItems = true;

    @property({ displayName: 'NPC 携带物背后距离', tooltip: 'NPC 携带木头堆相对 NPC 中心向背后偏移的距离。' })
    public npcCarryBackDistance = 34;

    @property({ displayName: 'NPC 携带物背后 Y 缩放', tooltip: 'NPC 携带木头放到背后方向时使用的 Y 轴视觉压缩比例。' })
    public npcCarryBackYScale = 0.32;

    @property({ displayName: 'NPC 携带木头偏移 X', tooltip: 'NPC 身上携带木头的额外 X 偏移。' })
    public npcCarryWoodOffsetX = 0;

    @property({ displayName: 'NPC 携带木头起始 Y', tooltip: 'NPC 身上第一根携带木头的 Y 偏移。' })
    public npcCarryWoodStartY = 14;

    @property({ displayName: 'NPC 携带木头间距 Y', tooltip: 'NPC 身上多根携带木头之间的 Y 间距。' })
    public npcCarryWoodGapY = 7.5;

    @property({ displayName: 'NPC 气泡偏移 X', tooltip: 'NPC 气泡相对 NPC 中心的 X 偏移。' })
    public npcBubbleOffsetX = 8;

    @property({ displayName: 'NPC 气泡偏移 Y', tooltip: 'NPC 气泡相对 NPC 中心的 Y 偏移。' })
    public npcBubbleOffsetY = 102;

    @property({ displayName: 'NPC 气泡宽度', tooltip: 'NPC 气泡框的显示宽度。' })
    public npcBubbleWidth = 72;

    @property({ displayName: 'NPC 气泡高度', tooltip: 'NPC 气泡框的显示高度。' })
    public npcBubbleHeight = 88;

    @property({ displayName: 'NPC 气泡文字 X', tooltip: 'NPC 气泡内剩余木头数量文字的 X 偏移。' })
    public npcBubbleLabelOffsetX = 0;

    @property({ displayName: 'NPC 气泡文字 Y', tooltip: 'NPC 气泡内剩余木头数量文字的 Y 偏移。' })
    public npcBubbleLabelOffsetY = -25;

    @property({ displayName: 'NPC 气泡文字字号', tooltip: 'NPC 气泡内剩余木头数量文字的字号。' })
    public npcBubbleLabelFontSize = 21;

    @property({ displayName: '显示 NPC 完成气泡', tooltip: '开启后，单个 NPC 交易完成时显示绿色完成气泡。' })
    public showNpcCompleteCheckBubble = false;

    @property({ displayName: '箭头上方偏移', tooltip: '引导箭头显示在目标节点上方多少像素。' })
    public arrowOffsetY = 100;

    @property({ displayName: '箭头浮动幅度', tooltip: '引导箭头上下浮动的像素幅度。' })
    public arrowFloatAmplitude = 10;

    @property({ displayName: '箭头浮动速度', tooltip: '引导箭头浮动速度，数值越小浮动越快。' })
    public arrowFloatSpeed = 160;

    @property({ displayName: '玩家箭头距离', tooltip: '玩家到浮动方向引导箭头之间的距离。' })
    public playerArrowDistance = 90;

    @property({ displayName: '玩家箭头宽度', tooltip: '玩家方向引导箭头的显示宽度。' })
    public playerArrowWidth = 78;

    @property({ displayName: '玩家箭头高度', tooltip: '玩家方向引导箭头的显示高度。' })
    public playerArrowHeight = 104;

    @property({ displayName: '玩家箭头位置平滑', tooltip: '玩家方向引导箭头跟随目标方向位置变化的平滑程度。' })
    public playerArrowPositionSmooth = 16;

    @property({ displayName: '玩家箭头旋转平滑', tooltip: '玩家方向引导箭头旋转到目标方向的平滑程度。' })
    public playerArrowRotationSmooth = 18;

    @property({ displayName: '显示拖动提示', tooltip: '首个移动教学阶段是否显示 Drag to Move 提示文字。' })
    public showDragToMoveTip = true;

    @property({ displayName: '拖动提示文字', tooltip: '首次移动提示时显示在虚拟摇杆旁边的文字。' })
    public dragToMoveTipText = 'Drag to Move';

    @property({ displayName: '拖动提示 X', tooltip: '拖动提示文字在 UI 层的 X 坐标。' })
    public dragToMoveTipX = 345;

    @property({ displayName: '拖动提示 Y', tooltip: '拖动提示文字在 UI 层的 Y 坐标。' })
    public dragToMoveTipY = -308;

    @property({ displayName: '拖动提示宽度', tooltip: '拖动提示文字预留的 UI 宽度。' })
    public dragToMoveTipWidth = 360;

    @property({ displayName: '拖动提示字号', tooltip: '拖动提示文字的字号。' })
    public dragToMoveTipFontSize = 34;

    @property({ displayName: '拖动提示描边', tooltip: '拖动提示文字黑色描边的宽度。' })
    public dragToMoveTipOutlineWidth = 4;

    @property({ displayName: '拾取木头后隐藏拖动提示', tooltip: '开启后，玩家完成初始木头拾取阶段时隐藏 Drag to Move 提示。' })
    public hideDragTipAfterInitialWood = true;

    @property({ displayName: '显示升级提示', tooltip: '是否在可用升级区域上方显示红色升级提示文字。' })
    public showUpgradePrompt = false;

    @property({ displayName: '升级提示文字', tooltip: '显示在升级区域上方的提示文字。' })
    public upgradePromptText = 'Need\nUpgrade';

    @property({ displayName: '升级提示偏移 X', tooltip: '升级提示文字相对升级区域中心的 X 偏移。' })
    public upgradePromptOffsetX = 0;

    @property({ displayName: '升级提示偏移 Y', tooltip: '升级提示文字相对升级区域中心的 Y 偏移。' })
    public upgradePromptOffsetY = 92;

    @property({ displayName: '升级提示宽度', tooltip: '升级提示文字预留的 UI 宽度。' })
    public upgradePromptWidth = 230;

    @property({ displayName: '升级提示字号', tooltip: '升级提示文字的字号。' })
    public upgradePromptFontSize = 34;

    @property({ displayName: '升级提示描边', tooltip: '升级提示文字白色描边的宽度。' })
    public upgradePromptOutlineWidth = 3;

    @property({ displayName: '金币不足提示文字', tooltip: '金币不足时触发购买区域后，显示在玩家上方的动态提示文字。' })
    public notEnoughCoinsPromptText = 'Not Enough\nCoins';

    @property({ displayName: '需要升级提示文字', tooltip: '车辆被高等级树阻挡时，显示在车辆上方的动态提示文字。' })
    public needUpgradePromptText = 'Need\nUpgrade';

    @property({ displayName: '浮动提示偏移 Y', tooltip: '动态红色提示文字相对目标节点的世界坐标 Y 偏移。' })
    public floatingPromptOffsetY = 112;

    @property({ displayName: '浮动提示时长', tooltip: '动态红色提示文字存在的时间，单位秒。' })
    public floatingPromptDuration = 0.8;

    @property({ displayName: '浮动提示初始缩放', tooltip: '动态红色提示文字出现动画的初始缩放。' })
    public floatingPromptStartScale = 0.18;

    @property({ displayName: '浮动提示结束缩放', tooltip: '动态红色提示文字出现动画结束时的缩放。' })
    public floatingPromptEndScale = 1;

    @property({ displayName: '浮动提示宽度', tooltip: '动态红色提示文字内容区域的宽度。' })
    public floatingPromptWidth = 380;

    @property({ displayName: '浮动提示高度', tooltip: '动态红色提示文字内容区域的高度。' })
    public floatingPromptHeight = 124;

    @property({ displayName: '浮动提示字号', tooltip: '动态红色提示文字的字号。' })
    public floatingPromptFontSize = 44;

    @property({ displayName: '浮动提示描边', tooltip: '动态红色提示文字白色描边的宽度。' })
    public floatingPromptOutlineWidth = 4;

    @property({ displayName: '目标箭头路径', tooltip: '悬浮目标引导箭头的 resources SpriteFrame 路径。' })
    public targetArrowImagePath = 'images/ui/arrow_3D';

    @property({ displayName: '目标箭头宽度', tooltip: '悬浮目标引导箭头的显示宽度。' })
    public targetArrowWidth = 84;

    @property({ displayName: '目标箭头高度', tooltip: '悬浮目标引导箭头的显示高度。' })
    public targetArrowHeight = 110;

    @property({ displayName: '目标箭头旋转', tooltip: '悬浮目标引导箭头的基础 Z 轴旋转角度。' })
    public targetArrowRotationZ = 0;

    @property({ displayName: '目标箭头果冻拉伸', tooltip: '悬浮目标引导箭头果冻动画中的拉伸幅度。' })
    public targetArrowJellyStretch = 0.12;

    @property({ displayName: '目标箭头果冻压缩', tooltip: '悬浮目标引导箭头果冻动画中的横向压缩幅度。' })
    public targetArrowJellySquash = 0.08;

    @property({ displayName: '资源面板宽度', tooltip: '右上角整块资源计数 UI 面板的宽度，对应 assets/resources/images/ui/UI.png。' })
    public counterBgWidth = 252;

    @property({ displayName: '资源面板高度', tooltip: '右上角整块资源计数 UI 面板的高度，对应 assets/resources/images/ui/UI.png。' })
    public counterBgHeight = 152;

    @property({ displayName: '资源面板右边距', tooltip: '资源计数 UI 到玩家视角右边缘的距离。' })
    public counterPanelMarginRight = 18;

    @property({ displayName: '资源面板上边距', tooltip: '资源计数 UI 到玩家视角上边缘的距离。' })
    public counterPanelMarginTop = 18;

    @property({ displayName: '计数器圆角', tooltip: '备用绘制背景的圆角；当前默认使用 UI.png 整图时不会用到。' })
    public counterBgRadius = 10;

    @property({ displayName: '计数器图标 X', tooltip: '备用独立图标相对背景中心的 X 偏移；当前默认使用 UI.png 整图时不会用到。' })
    public counterIconOffsetX = -103;

    @property({ displayName: '计数器数字 X', tooltip: '金币和木头数字相对资源面板中心的 X 偏移。' })
    public counterLabelOffsetX = 37;

    @property({ displayName: '金币数字 Y', tooltip: '金币数字相对资源面板中心的 Y 偏移。' })
    public coinCounterLabelOffsetY = 34;

    @property({ displayName: '木头数字 Y', tooltip: '木头数字相对资源面板中心的 Y 偏移。' })
    public woodCounterLabelOffsetY = -43;

    @property({ displayName: '金币图标宽度', tooltip: '右上角金币图标显示宽度。' })
    public coinCounterIconWidth = 58;

    @property({ displayName: '金币图标高度', tooltip: '右上角金币图标显示高度。' })
    public coinCounterIconHeight = 58;

    @property({ displayName: '木头图标宽度', tooltip: '右上角木头图标显示宽度。' })
    public woodCounterIconWidth = 74;

    @property({ displayName: '木头图标高度', tooltip: '右上角木头图标显示高度。' })
    public woodCounterIconHeight = 52;

    @property({ displayName: '计数器字号', tooltip: '右上角金币/木头数字字号。' })
    public counterFontSize = 38;

    @property({ displayName: '资源面板路径', tooltip: 'resources 下整块资源计数 UI SpriteFrame 路径，对应 assets/resources/images/ui/UI.png。' })
    public counterPanelImagePath = 'images/ui/UI';

    @property({ displayName: '背景图路径', tooltip: 'resources 下的背景 SpriteFrame 路径，不包含 /spriteFrame。' })
    public backgroundImagePath = 'images/bg';

    @property({ displayName: '通用地台路径', tooltip: 'resources 下通用地台 SpriteFrame 路径。' })
    public platformImagePath = 'images/ui/under_box';

    @property({ displayName: '购买地台高亮路径', tooltip: '玩家进入车辆解锁区或升级区时使用的高亮地台 resources SpriteFrame 路径。' })
    public purchasePlatformHighlightImagePath = 'images/ui/under_box_but';

    @property({ displayName: '售卖地台路径', tooltip: 'resources 下售卖地台 SpriteFrame 路径。' })
    public sellPlatformImagePath = 'images/ui/sell under';

    @property({ displayName: '售卖地台高亮路径', tooltip: '玩家进入售卖区域时使用的高亮地台 resources SpriteFrame 路径。' })
    public sellPlatformHighlightImagePath = 'images/ui/sell under_hightlight';

    @property({ displayName: '玩家售卖脚点内缩比例', tooltip: '把售卖区域检测点从玩家图片底部略微向上移动的比例。' })
    public playerSellFootInsetRatio = 0.08;

    @property({ displayName: '玩家售卖脚点半宽比例', tooltip: '玩家左右脚参与售卖区域检测时使用的水平半宽比例。' })
    public playerSellFootHalfWidthRatio = 0.22;

    @property({ displayName: 'Logo 路径', tooltip: 'resources 下 Logo SpriteFrame 路径。' })
    public logoImagePath = 'images/ui/Lords Mobile_EN_LOGO';

    @property({ displayName: '按钮路径', tooltip: 'resources 下 Play Now 按钮 SpriteFrame 路径。' })
    public playNowImagePath = 'images/ui/playnow_en';

    @property({ displayName: '箭头路径', tooltip: 'resources 下引导箭头 SpriteFrame 路径。' })
    public arrowImagePath = 'images/ui/arrow_2D';

    @property({ displayName: '摇杆底座路径', tooltip: 'resources 下摇杆底座 SpriteFrame 路径。' })
    public joystickBaseImagePath = 'images/ui/yaogan';

    @property({ displayName: '摇杆手柄路径', tooltip: 'resources 下摇杆手柄 SpriteFrame 路径。' })
    public joystickKnobImagePath = 'images/ui/yaogan_2';

    @property({ displayName: '金币图标路径', tooltip: 'resources 下金币 SpriteFrame 路径。' })
    public coinImagePath = 'images/ui/Coins/Coins_000';

    @property({ displayName: '木头图标路径', tooltip: 'resources 下木头 SpriteFrame 路径。' })
    public woodImagePath = 'images/ui/wood/Woood_045&225';

    @property({ displayName: '砍树落地木头路径列表', tooltip: '砍树木头落到木头堆后使用的 resources SpriteFrame 路径列表，用英文逗号分隔。' })
    public treeWoodSettledImagePathsCsv = 'images/ui/wood/Woood_000&180,images/ui/wood/Woood_045&225,images/ui/wood/Woood_090&270,images/ui/wood/Woood_135&315';

    @property({ displayName: '砍树飞行木头路径列表', tooltip: '砍树木头飞向木头堆时使用的 resources SpriteFrame 路径列表，用英文逗号分隔。' })
    public treeWoodFlyingImagePathsCsv = 'images/ui/wood_light/Woood_000&180_HIGHT_LIGHT,images/ui/wood_light/Woood_045&225_HIGHT_LIGHT,images/ui/wood_light/Woood_090&270_HIGHT_LIGHT,images/ui/wood_light/Woood_135&315_HIGHT_LIGHT';

    @property({ displayName: '竖向携带木头路径', tooltip: '玩家朝 090/270 方向时，背后携带木头使用的 SpriteFrame 路径。' })
    public carryWoodImagePath = 'images/ui/wood/Woood_090&270';

    @property({ displayName: '横向携带木头路径', tooltip: '玩家朝 000/180 方向时，背后携带木头使用的 SpriteFrame 路径。' })
    public carryWoodWideImagePath = 'images/ui/wood/Woood_000&180';

    @property({ displayName: '斜向携带木头 A 路径', tooltip: '玩家朝 045/225 方向时，背后携带木头使用的 SpriteFrame 路径。' })
    public carryWoodDiagonalAImagePath = 'images/ui/wood/Woood_045&225';

    @property({ displayName: '斜向携带木头 B 路径', tooltip: '玩家朝 135/315 方向时，背后携带木头使用的 SpriteFrame 路径。' })
    public carryWoodDiagonalBImagePath = 'images/ui/wood/Woood_135&315';

    @property({ displayName: 'NPC 气泡圆框路径', tooltip: 'NPC 气泡圆形框的 resources SpriteFrame 路径。' })
    public npcBubbleCircleImagePath = 'images/ui/Frame_bubble_circle';

    @property({ displayName: 'NPC 气泡进度路径', tooltip: '叠加在 NPC 气泡圆框上，用来显示木头交付进度的 resources SpriteFrame 路径。' })
    public npcBubbleProgressImagePath = 'images/ui/Frame_bubble_down';

    @property({ displayName: 'NPC 气泡木头路径', tooltip: 'NPC 气泡内木头需求图标的 resources SpriteFrame 路径。' })
    public npcBubbleWoodImagePath = 'images/ui/Frame_bubble_woood';

    @property({ displayName: 'NPC 气泡省略号路径', tooltip: 'NPC 等待状态省略号图标的 resources SpriteFrame 路径。' })
    public npcBubblePointImagePath = 'images/ui/Frame_bubble_point';

    @property({ displayName: 'NPC 气泡完成勾路径', tooltip: 'NPC 完成状态勾选图标的 resources SpriteFrame 路径。' })
    public npcBubbleCheckImagePath = 'images/ui/Frame_bubble_gou';

    @property({ displayName: 'NPC 气泡笑脸路径', tooltip: 'NPC 完成状态笑脸图标的 resources SpriteFrame 路径。' })
    public npcBubbleSmileImagePath = 'images/ui/Frame_bubble_smile';

    @property({ displayName: '1级树路径', tooltip: 'resources 下 1 级树 SpriteFrame 路径。' })
    public treeLevel1ImagePath = 'images/ui/tree_lv1';

    @property({ displayName: '2级树路径', tooltip: 'resources 下 2 级树 SpriteFrame 路径。' })
    public treeLevel2ImagePath = 'images/ui/tree_lv2';

    @property({ displayName: '3级树路径', tooltip: 'resources 下 3 级树 SpriteFrame 路径。' })
    public treeLevel3ImagePath = 'images/ui/tree_lv3';

    @property({ displayName: '小树桩路径', tooltip: 'resources 下 1/2 级树桩 SpriteFrame 路径。' })
    public stumpSmallImagePath = 'images/ui/tree stool_lv1';

    @property({ displayName: '大树桩路径', tooltip: 'resources 下 3 级树桩 SpriteFrame 路径。' })
    public stumpLargeImagePath = 'images/ui/tree stool_lv3';

    @property({ displayName: '玩家待机前缀', tooltip: '玩家待机帧路径前缀，脚本会拼接方向和帧序号。' })
    public playerIdleFramePrefix = 'images/characters/ddb/ddb_Sdand_';

    @property({ displayName: '玩家移动前缀', tooltip: '玩家移动帧路径前缀，脚本会拼接方向和帧序号。' })
    public playerWalkFramePrefix = 'images/characters/ddb/ddb_Walk_';

    @property({ displayName: 'NPC 待机前缀', tooltip: 'NPC 待机帧路径前缀，当前使用 315 方向。' })
    public npcIdleFramePrefix = 'images/characters/nm/nm_Stand_315_';

    @property({ displayName: 'NPC 前进前缀', tooltip: 'NPC 入队移动帧路径前缀，当前使用 315 方向。' })
    public npcWalkInFramePrefix = 'images/characters/nm/nm_Walk_315_';

    @property({ displayName: 'NPC 离开前缀', tooltip: 'NPC 离开移动帧路径前缀，当前使用 225 方向。' })
    public npcWalkOutFramePrefix = 'images/characters/nm/nm_Walk_225_';

    @property({ displayName: '1级车前缀', tooltip: '1 级车辆动画帧路径前缀。' })
    public carLevel1FramePrefix = 'images/characters/car/car_lv1_';

    @property({ displayName: '2级车前缀', tooltip: '2 级车辆动画帧路径前缀。' })
    public carLevel2FramePrefix = 'images/characters/car/car_lv2_';

    @property({ displayName: '3级车前缀', tooltip: '3 级车辆动画帧路径前缀。' })
    public carLevel3FramePrefix = 'images/characters/car/car_lv3_';

    @property({ displayName: '升级特效目录', tooltip: '升级特效帧所在 resources 目录。' })
    public levelUpEffectFolder = 'images/effect/levelup';

    @property({ displayName: '升级特效帧名', tooltip: '升级特效帧文件名，用英文逗号分隔，不写扩展名。' })
    public levelUpEffectFramesCsv = '升级_06';

    @property({ displayName: '音频目录', tooltip: '音频所在 resources 目录。' })
    public audioFolder = 'audio';

    @property({ displayName: '背景音乐名', tooltip: '背景音乐资源名，不写扩展名。' })
    public bgmAudioName = 'BGM';

    @property({ displayName: '金币音效名', tooltip: '金币音效资源名，不写扩展名。' })
    public coinAudioName = 'coin';

    @property({ displayName: '砍树音效名', tooltip: '砍树音效资源名，不写扩展名。' })
    public cutTreeAudioName = 'cut tree';

    @property({ displayName: '售卖音效名', tooltip: '售卖音效资源名，不写扩展名。' })
    public sellAudioName = 'sell';

    @property({ displayName: '车辆音效名', tooltip: '车辆音效资源名，不写扩展名。' })
    public carAudioName = 'car';

    @property({ displayName: 'UI 音效名', tooltip: 'UI 点击或收集音效资源名，不写扩展名。' })
    public uiAudioName = 'uiin';

    @property({ displayName: '错误音效名', tooltip: '错误提示音效资源名，不写扩展名。' })
    public errorAudioName = 'error';

    @property({ displayName: '开始标题文字', tooltip: '可选开始弹窗中央显示的标题文字。' })
    public startTitleText = 'Wood Rush';

    @property({ displayName: '开始提示', tooltip: '开始弹窗说明文字。' })
    public startTipText = 'Collect wood, sell it, and upgrade the car.';

    @property({ displayName: '加载文字', tooltip: '加载资源时显示的文字。' })
    public loadingText = 'Loading...';

    @property({ displayName: '构建场景文字', tooltip: '资源加载完成、开始生成场景时显示的文字。' })
    public buildingSceneText = 'Building scene...';

    @property({ displayName: '结束标题', tooltip: '结束弹窗标题文字。' })
    public endTitleText = 'Great Job!';

    @property({ displayName: '结束提示', tooltip: '结束弹窗说明文字。' })
    public endSubText = 'Your lumber line is running.';

    @property({ displayName: 'iOS 跳转链接', tooltip: '点击 Play Now 后 iOS 设备打开的商店链接。' })
    public iosStoreUrl = 'https://itunes.apple.com/id/app/id1071976327?l=id&mt=8';

    @property({ displayName: 'Android 跳转链接', tooltip: '点击 Play Now 后 Android 设备打开的商店链接。' })
    public androidStoreUrl = 'https://play.google.com/store/apps/details?id=com.igg.android.lordsmobile&hl=id';

    private root!: Node;
    private world!: Node;
    private actors!: Node;
    private ui!: Node;
    private overlay!: Node;
    private resolvedCarRouteDirection: Vec3 | null = null;
    private resolvedTreeRowDirection: Vec3 | null = null;
    private readonly assets = new GameAssetService();
    private readonly audioService = new AudioService({
        getAudioClip: (name) => this.assets.getAudioClip(name),
    });
    private readonly actorSort = new ActorSortSystem(
        () => this.createActorSortConfig(),
        {
            isPlayerBackpackNode: (node) => this.playerCarry.isBackpackNode(node),
            isNpcCarryBackpackNode: (node) => this.npcVisual.isCarryBackpackNode(node),
            isPlayerFootRingNode: (node) => this.playerFootRing.isRingNode(node),
        },
    );
    private readonly uiFactory = new GameUiFactory({
        getSpriteFrame: (path) => this.assets.getSpriteFrame(path),
        getPulseHalfDuration: () => this.pulseHalfDuration,
    });
    private readonly sceneNodes = new SceneNodeResolver({
        makeNode: (name, parent) => this.uiFactory.makeNode(name, parent),
    });
    private readonly playerFootRing = new PlayerFootRingSystem(
        () => this.createPlayerFootRingConfig(),
        {
            resolveSceneNode: (configNode, parent, name) => this.sceneNodes.resolve(configNode, parent, name),
            setSpriteFrameAndSize: (node, framePath, width, height) => this.uiFactory.setSpriteFrameAndSize(node, framePath, width, height),
        },
    );
    private readonly gameLayers = new GameLayerSystem(
        () => this.createGameLayerConfig(),
        this.sceneNodes,
        this.uiFactory,
    );
    private readonly effectSystem = new GameEffectSystem(
        () => this.createGameEffectConfig(),
        {
            makeNode: (name, parent, x, y) => this.uiFactory.makeNode(name, parent, x, y),
            ensureTransform: (node, width, height) => this.uiFactory.ensureTransform(node, width, height),
            parseCsvNames: (csv) => this.assets.parseCsvNames(csv),
            collectFramesFromPaths: (paths) => this.assets.collectFramesFromPaths(paths),
        },
    );
    private readonly promptEffects = new PromptEffectSystem(
        () => this.createPromptEffectConfig(),
        {
            makeNode: (name, parent, x, y) => this.uiFactory.makeNode(name, parent, x, y),
            ensureTransform: (node, width, height) => this.uiFactory.ensureTransform(node, width, height),
        },
    );
    private readonly overlaySystem = new OverlaySystem(() => this.createOverlaySystemConfig(), this.uiFactory);
    private readonly preloadSystem = new GamePreloadSystem(
        () => this.createGamePreloadConfig(),
        this.assets,
        {
            getPlayerWoodImagePaths: () => this.playerCarry.getWoodImagePaths(),
            getTreeWoodDropImagePaths: () => this.treeWoodDrops.getImagePaths(),
            getPlayerCoinImagePaths: () => this.playerCarry.getCoinImagePaths(),
            getNpcBubbleImagePaths: () => this.npcVisual.getBubbleImagePaths(),
            setLoadingProgress: (progress) => this.overlaySystem.setLoadingProgress(progress),
        },
    );
    private readonly hudSystem = new HudSystem(
        () => this.createHudSystemConfig(),
        this.uiFactory,
        {
            resolveSceneNode: (configNode, parent, name) => this.sceneNodes.resolve(configNode, parent, name),
            findChildDeep: (parent, name) => this.sceneNodes.findChildDeep(parent, name),
            bindCounters: (coinLabel, woodLabel) => this.economy.bindCounters(coinLabel, woodLabel),
            openStore: () => this.storeLinks.open(),
            setResourceCounterPanelNode: (node) => {
                this.resourceCounterPanelNode = node;
            },
        },
    );
    private readonly economy = new EconomyService();
    private readonly interactionZones = new InteractionZoneSystem();
    private readonly guideSystem = new GuideSystem();
    private readonly guideCoordinator = new GuideCoordinator(
        () => this.createGuideConfig(),
        this.guideSystem,
        {
            getZoneTarget: (name) => this.interactionZones.getNode(name),
            getWoodTarget: (initialOnly) => this.woodCollection.getGuideTarget(initialOnly, (wood) => this.effectSystem.isFloating(wood)),
            getCoinTarget: () => this.coinPlane.getGuideTarget((coin) => !this.effectSystem.isFloating(coin)),
            getInitialWoodNodes: () => this.woodCollection.getInitialGuideNodes((wood) => this.effectSystem.isFloating(wood)),
        },
    );
    private readonly npcTrade = new NpcTradeService();
    private readonly startArea = new StartAreaSystem(() => this.createStartAreaConfig());
    private readonly storeLinks = new StoreLinkService(() => this.createStoreLinkConfig());
    private readonly inputController = new InputController(() => this.createInputControllerConfig());
    private readonly gameSession = new GameSessionSystem(
        () => this.createGameSessionConfig(),
        this.overlaySystem,
        this.audioService,
        this.storeLinks,
        {
            onEnd: () => this.inputController.clearMovement(),
        },
    );
    private readonly sellZoneVisual = new SellZoneVisualSystem(
        () => this.createSellZoneVisualConfig(),
        {
            getZoneNode: (name) => this.interactionZones.getNode(name),
            getSpriteFrame: (path) => this.assets.getSpriteFrame(path),
        },
    );
    private readonly cameraFollow = new CameraFollowSystem(() => this.createCameraFollowConfig());
    private readonly gameplayFlow = new GameplayFlowSystem(
        () => this.createGameplayFlowConfig(),
        {
            playerFootHitZone: (name, playerNode, footInsetRatio, footHalfWidthRatio) => (
                this.interactionZones.playerFootHit(name, playerNode, footInsetRatio, footHalfWidthRatio)
            ),
            zoneHit: (name, playerNode) => this.interactionZones.hit(name, playerNode.worldPosition),
            updateZoneHighlight: (name, highlighted) => this.sellZoneVisual.updateZoneHighlight(name, highlighted),
            getCollectableWood: (playerNode) => {
                const playerPos = playerNode.worldPosition;
                const startZoneHit = this.interactionZones.hit('start', playerPos);
                return this.woodCollection.getCollectableWood(playerPos, startZoneHit, (wood) => this.effectSystem.isFloating(wood));
            },
            collectWood: (woods) => this.gameplayActions.collectWood(woods),
            canSellWoodToNpc: (sellZoneHit) => this.npcTrade.canSell(
                sellZoneHit,
                this.economy.hasWood(),
                this.npcQueue.hasFront(),
                this.woodPerNpcTrade,
            ),
            sellOneWood: () => this.gameplayActions.sellOneWood(),
            coinPlaneHasCoins: () => this.coinPlane.hasCoins(),
            collectPlaneCoins: () => this.gameplayActions.collectPlaneCoins(),
            canUnlockCar: (index) => this.carSystem.canUnlock(index, this.economy.hasCoins(this.carUnlockCost)),
            spendCoins: (amount) => this.gameplayActions.spendCoins(amount),
            unlockCar: (index) => this.gameplayActions.unlockCar(index),
            canUpgradeCar: (index, level) => this.carSystem.canUpgradeTo(
                index,
                level,
                this.economy.hasCoins(level === 2 ? this.carUpgrade2Cost : this.carUpgrade3Cost),
            ),
            upgradeCar: (index, level) => this.gameplayActions.upgradeCar(index, level),
            areAllCarsFullyUpgraded: () => this.carSystem.areAllCarsFullyUpgraded(),
            showNotEnoughCoinsPrompt: (target) => this.promptEffects.spawn(this.notEnoughCoinsPromptText, target),
            scheduleEndOverlay: (delay) => {
                if (delay <= 0) {
                    this.gameSession.showEnd();
                    return;
                }
                this.scheduleOnce(() => this.gameSession.showEnd(), delay);
            },
        },
    );
    private readonly controlSceneBuilder = new ControlSceneBuilder(
        () => this.createControlSceneBuilderConfig(),
        this.uiFactory,
        {
            resolveSceneNode: (configNode, parent, name) => this.sceneNodes.resolve(configNode, parent, name),
            bindJoystick: (base, knob) => this.inputController.bindJoystick(base, knob),
            bindGuide: (playerArrow, targetArrow) => this.guideCoordinator.bind(playerArrow, targetArrow),
            setInitialGuideStage: () => this.guideCoordinator.setStage('initialWood'),
        },
    );
    private readonly worldBuilder = new WorldSceneBuilder(
        () => this.createWorldSceneBuilderConfig(),
        this.uiFactory,
        {
            resolveSceneNode: (configNode, parent, name) => this.sceneNodes.resolve(configNode, parent, name),
            findChildDeep: (parent, name) => this.sceneNodes.findChildDeep(parent, name),
            findNumberedChildren: (parent, prefix) => this.sceneNodes.findNumberedChildren(parent, prefix),
            addZone: (name, node, radius, matchNodeBounds) => this.interactionZones.add(name, node, radius, matchNodeBounds),
            buildTreeRoute: () => this.treeRouteLayout.build(),
            rebuildTrees: (nodes, levels) => this.treeSystem.rebuild(nodes, levels),
        },
    );
    private readonly treeSystem = new TreeSystem(
        () => this.createTreeSystemConfig(),
        {
            findChildDeep: (parent, name) => this.sceneNodes.findChildDeep(parent, name),
            setupSpriteNode: (node, framePath, width, height) => this.uiFactory.setupSpriteNode(node, framePath, width, height),
        },
    );
    private readonly treeRouteLayout = new TreeRouteLayoutSystem(
        () => this.createTreeRouteLayoutConfig(),
        {
            getTreeLevel: (index) => this.treeSystem.getLevel(index),
            syncLayer: (node, layer) => this.sceneNodes.syncLayer(node, layer),
            setRouteDirections: (forward, row) => {
                this.resolvedCarRouteDirection = forward.clone();
                this.resolvedTreeRowDirection = row.clone();
            },
        },
    );
    private readonly treeWoodDrops = new TreeWoodDropSystem(
        () => this.createTreeWoodDropConfig(),
        {
            makeNode: (name, parent, x, y) => this.uiFactory.makeNode(name, parent, x, y),
            addSprite: (name, framePath, parent, x, y, width, height) => this.uiFactory.addSprite(name, framePath, parent, x, y, width, height),
            setSpriteFrameAndSize: (node, framePath, width, height) => this.uiFactory.setSpriteFrameAndSize(node, framePath, width, height),
            getSpriteFrameAspect: (path, fallbackWidth, fallbackHeight) => this.assets.getSpriteFrameAspect(path, fallbackWidth, fallbackHeight),
            addFloating: (node) => this.effectSystem.addFloating(node),
            removeFloating: (node) => this.effectSystem.removeFloating(node),
            sortActors: () => this.actorSort.sort(),
        },
    );
    private readonly woodCollection = new WoodCollectionSystem(
        () => this.createWoodCollectionConfig(),
        {
            makeNode: (name, parent, x, y) => this.uiFactory.makeNode(name, parent, x, y),
            addSprite: (name, framePath, parent, x, y, width, height) => this.uiFactory.addSprite(name, framePath, parent, x, y, width, height),
            sortActors: () => this.actorSort.sort(),
        },
    );
    private readonly carActorFactory = new CarActorFactory(
        () => this.createCarActorFactoryConfig(),
        {
            ensureTransform: (node, width, height) => this.uiFactory.ensureTransform(node, width, height),
            collectFrames: (prefix) => this.assets.collectFrames(prefix, this.animationFrameCount),
        },
    );
    private readonly carSystem = new CarSystem<AnimatedSprite>(
        () => this.createCarSystemConfig(),
        {
            findChildDeep: (parent, name) => this.sceneNodes.findChildDeep(parent, name),
            setupSpriteNode: (node, framePath, width, height) => this.uiFactory.setupSpriteNode(node, framePath, width, height),
            createActor: (node) => this.carActorFactory.create(node),
            getRouteTrees: () => this.treeSystem.getRouteTrees(),
            cutTree: (tree, carLevel) => this.gameplayActions.cutTree(tree, carLevel),
            startTreeShake: (tree) => this.treeSystem.startShake(tree),
            stopTreeShake: (tree) => this.treeSystem.stopShake(tree),
            spawnUpgradeEffect: (position) => this.effectSystem.spawnUpgradeEffect(position),
            showNeedUpgradePrompt: (target) => this.promptEffects.spawn(this.needUpgradePromptText, target),
            playCarAudio: () => this.audioService.playEffect(this.carAudioName),
            playUiAudio: () => this.audioService.playEffect(this.uiAudioName),
            showWaitTreeWoodGuide: () => this.guideCoordinator.setStage('waitTreeWood'),
            scheduleOnce: (done, delay) => this.scheduleOnce(done, delay),
        },
    );
    private readonly coinPlane = new CoinPlaneSystem(
        () => this.createCoinPlaneConfig(),
        {
            makeNode: (name, parent, x, y) => this.uiFactory.makeNode(name, parent, x, y),
            addSprite: (name, framePath, parent, x, y, width, height) => this.uiFactory.addSprite(name, framePath, parent, x, y, width, height),
            flyToPosition: (node, target, delay, done, endScale, duration) => this.effectSystem.flyToPosition(node, target, delay, done, endScale, duration),
            sortActors: () => this.actorSort.sort(),
        },
    );
    private readonly playerCarry = new PlayerCarryVisualController(
        () => this.createPlayerCarryVisualConfig(),
        {
            resolveBackpackNode: (parent, name) => this.sceneNodes.resolve(this.sceneNodes.findChildDeep(parent, name), parent, name),
            addSprite: (name, framePath, parent, x, y, width, height) => this.uiFactory.addSprite(name, framePath, parent, x, y, width, height),
            setSpriteFrameAndSize: (node, framePath, width, height) => this.uiFactory.setSpriteFrameAndSize(node, framePath, width, height),
            getSpriteFrameAspect: (path, fallbackWidth, fallbackHeight) => this.assets.getSpriteFrameAspect(path, fallbackWidth, fallbackHeight),
        },
    );
    private readonly playerSceneBuilder = new PlayerSceneBuilder(
        () => this.createPlayerSceneBuilderConfig(),
        {
            resolveSceneNode: (configNode, parent, name) => this.sceneNodes.resolve(configNode, parent, name),
            getSpriteFrame: (path) => this.assets.getSpriteFrame(path),
            collectFrames: (prefix) => this.assets.collectFrames(prefix, this.animationFrameCount),
            rebuildBackpack: () => this.playerCarry.rebuildBackpack(),
        },
    );
    private readonly npcVisual = new NpcVisualController<AnimatedSprite>(
        () => this.createNpcVisualConfig(),
        {
            makeNode: (name, parent, x, y) => this.uiFactory.makeNode(name, parent, x, y),
            addSprite: (name, framePath, parent, x, y, width, height) => this.uiFactory.addSprite(name, framePath, parent, x, y, width, height),
            addOrUpdateLabel: (name, parent, text, x, y, size, color) => this.uiFactory.addOrUpdateLabel(name, parent, text, x, y, size, color),
            applyCarryWoodVisualForDirection: (node, direction) => this.playerCarry.applyWoodVisualForDirection(node, direction),
            sortActors: () => this.actorSort.sort(),
        },
    );
    private readonly npcBubbles = new NpcBubbleCoordinator(
        () => this.createNpcBubbleConfig(),
        this.npcTrade,
        this.npcVisual,
    );
    private startPickupAnchor: Node | null = null;

    private player!: AnimatedSprite;
    private playerNode!: Node;
    private readonly npcQueue = new NpcQueueSystem<AnimatedSprite>();
    private readonly npcSceneBuilder = new NpcSceneBuilder(
        () => this.createNpcSceneBuilderConfig(),
        this.uiFactory,
        {
            findChildDeep: (parent, name) => this.sceneNodes.findChildDeep(parent, name),
            findNumberedChildren: (parent, prefix) => this.sceneNodes.findNumberedChildren(parent, prefix),
            resetQueue: (npcs, queuePositions) => this.npcQueue.reset(npcs, queuePositions),
            cleanupVisual: (node) => this.npcVisual.cleanup(node),
            setCarryDirectionForNode: (node, direction) => this.npcVisual.setCarryDirectionForNode(node, direction),
            applyQueueBubble: (npc, index) => this.npcBubbles.applyQueueBubble(npc, index),
            collectFrames: (prefix) => this.assets.collectFrames(prefix, this.animationFrameCount),
        },
    );
    private readonly npcFlow = new NpcFlowSystem<AnimatedSprite>(
        () => this.createNpcFlowConfig(),
        this.npcQueue,
        {
            createNpc: (position, waiting) => this.npcSceneBuilder.createNpcAt(position, waiting),
            applyQueueBubble: (npc, index) => this.npcBubbles.applyQueueBubble(npc, index),
            setBubbleState: (npc, state) => this.npcVisual.setBubbleState(npc, state),
            clearBubble: (npcNode) => this.npcVisual.clearBubble(npcNode),
            cleanup: (npcNode) => this.npcVisual.cleanup(npcNode),
            setCarryDirection: (npc, direction) => this.npcVisual.setCarryDirection(npc, direction),
            spawnCoinsOnPlane: (count, sourceNode) => this.gameplayActions.spawnCoinsOnPlane(count, sourceNode),
            getVisibleRect: (padding) => this.cameraFollow.getVisibleRect(padding),
            scheduleOnce: (done, delay) => this.scheduleOnce(done, delay),
        },
    );
    private readonly gameplayActions = new GameplayActionSystem(
        () => this.createGameplayActionConfig(),
        this.economy,
        this.guideSystem,
        this.audioService,
        this.effectSystem,
        this.playerCarry,
        this.woodCollection,
        this.npcQueue,
        this.npcFlow,
        this.npcTrade,
        this.npcVisual,
        this.coinPlane,
        this.treeSystem,
        this.treeWoodDrops,
        this.carSystem,
        {
            setTutorialGuideStage: (stage) => this.guideCoordinator.setStage(stage),
            activateTreeWoodGuideIfWaiting: () => this.guideCoordinator.activateTreeWoodIfWaiting(),
            destroyStartPlaneIfInitialWoodGone: () => this.startArea.destroyStartPlaneIfInitialWoodGone(this.woodCollection.hasInitialWood()),
        },
    );
    private readonly sceneBuildSystem = new GameSceneBuildSystem(
        () => this.createGameSceneBuildConfig(),
        this.overlaySystem,
        this.worldBuilder,
        this.startArea,
        this.sellZoneVisual,
        this.playerSceneBuilder,
        this.playerFootRing,
        this.carSystem,
        this.treeWoodDrops,
        this.npcSceneBuilder,
        this.hudSystem,
        this.controlSceneBuilder,
        this.gameplayActions,
        this.cameraFollow,
        this.audioService,
        {
            setStartPickupAnchor: (node) => {
                this.startPickupAnchor = node;
            },
            setPlayer: (playerNode, player) => {
                this.playerNode = playerNode;
                this.player = player;
            },
            setNpcRoute: (entryNode, exitNode) => {
                this.npcEntryNode = entryNode;
                this.npcExitNode = exitNode;
            },
        },
    );
    private lastDirection: Direction = '315';
    private readonly playerMovement = new PlayerMovementSystem(
        () => this.createPlayerMovementConfig(),
        {
            getMoveDirection: () => this.inputController.getMoveDirection(),
            setDirection: (direction) => {
                this.lastDirection = direction;
            },
        },
    );
    onLoad() {
        view.setDesignResolutionSize(this.designWidth, this.designHeight, ResolutionPolicy.SHOW_ALL);
        this.node.getComponent(UITransform)?.setContentSize(this.designWidth, this.designHeight);
        this.audioService.bind(this.node);
        const layers = this.gameLayers.build(this.node);
        this.root = layers.root;
        this.world = layers.world;
        this.actors = layers.actors;
        this.ui = layers.ui;
        this.overlay = layers.overlay;
        this.inputController.bind();
        void this.bootstrap();
    }

    onDestroy() {
        this.inputController.unbind();
    }

    update(dt: number) {
        this.player?.update(dt, this.inputController.getJoystickMovementLengthSqr() > 0.001 ? this.playerWalkFps : this.playerIdleFps);
        this.npcQueue.updateAnimations(dt, this.npcFps);
        this.carSystem.updateAnimation(dt, this.carFps);
        this.effectSystem.update(dt);
        this.playerFootRing.update();
        this.playerCarry.updateBackpackPosition();
        this.npcVisual.updateCarryBackpackPositions();

        if (this.gameSession.isPlaying) {
            this.gameplayFlow.update(dt);
            this.playerMovement.update(dt);
            this.playerFootRing.update();
            this.playerCarry.updateBackpackPosition();
            this.npcVisual.updateCarryBackpackPositions();
            this.cameraFollow.update(dt);
            this.gameplayFlow.checkZones();
            this.actorSort.sort();
            this.promptEffects.update(dt);
        } else {
            this.cameraFollow.update(dt);
            this.promptEffects.update(dt);
        }

        this.hudSystem.update();
        this.guideCoordinator.update(dt);
    }

    private async bootstrap() {
        this.gameSession.showLoading();
        await this.preloadSystem.load();
        this.gameSession.setLoadingText(this.buildingSceneText);
        this.sceneBuildSystem.build();
        this.gameSession.showStart();
    }

    private createGuideConfig(): GuideCoordinatorConfig {
        return {
            isPlaying: this.gameSession.isPlaying,
            uiNode: this.ui ?? null,
            playerNode: this.playerNode ?? null,
            arrowOffsetY: this.arrowOffsetY,
            arrowFloatAmplitude: this.arrowFloatAmplitude,
            arrowFloatSpeed: this.arrowFloatSpeed,
            playerArrowDistance: this.playerArrowDistance,
            playerArrowPositionSmooth: this.playerArrowPositionSmooth,
            playerArrowRotationSmooth: this.playerArrowRotationSmooth,
            targetArrowHeight: this.targetArrowHeight,
            targetArrowRotationZ: this.targetArrowRotationZ,
            targetArrowJellyStretch: this.targetArrowJellyStretch,
            targetArrowJellySquash: this.targetArrowJellySquash,
        };
    }

    private createInputControllerConfig(): InputControllerConfig {
        return {
            targetNode: this.node,
            designWidth: this.designWidth,
            designHeight: this.designHeight,
            joystickRadius: this.joystickRadius,
            joystickFullScreenTouch: this.joystickFullScreenTouch,
            joystickTouchRadius: this.joystickTouchRadius,
            isPlaying: this.gameSession.isPlaying,
        };
    }

    private createGameLayerConfig(): GameLayerConfig {
        return {
            gameRootNode: this.gameRootNode,
            worldNode: this.worldNode,
            actorsNode: this.actorsNode,
            uiNode: this.uiNode,
            overlayNode: this.overlayNode,
            designWidth: this.designWidth,
            designHeight: this.designHeight,
        };
    }

    private createGamePreloadConfig(): GamePreloadConfig {
        return {
            backgroundImagePath: this.backgroundImagePath,
            logoImagePath: this.logoImagePath,
            playNowImagePath: this.playNowImagePath,
            arrowImagePath: this.arrowImagePath,
            targetArrowImagePath: this.targetArrowImagePath,
            counterPanelImagePath: this.counterPanelImagePath,
            platformImagePath: this.platformImagePath,
            purchasePlatformHighlightImagePath: this.purchasePlatformHighlightImagePath,
            sellPlatformImagePath: this.sellPlatformImagePath,
            sellPlatformHighlightImagePath: this.sellPlatformHighlightImagePath,
            treeLevel1ImagePath: this.treeLevel1ImagePath,
            treeLevel2ImagePath: this.treeLevel2ImagePath,
            treeLevel3ImagePath: this.treeLevel3ImagePath,
            stumpSmallImagePath: this.stumpSmallImagePath,
            stumpLargeImagePath: this.stumpLargeImagePath,
            coinImagePath: this.coinImagePath,
            woodImagePath: this.woodImagePath,
            joystickBaseImagePath: this.joystickBaseImagePath,
            joystickKnobImagePath: this.joystickKnobImagePath,
            playerFootRingImagePath: this.playerFootRingImagePath,
            playerIdleFramePrefix: this.playerIdleFramePrefix,
            playerWalkFramePrefix: this.playerWalkFramePrefix,
            npcIdleFramePrefix: this.npcIdleFramePrefix,
            npcWalkInFramePrefix: this.npcWalkInFramePrefix,
            npcWalkOutFramePrefix: this.npcWalkOutFramePrefix,
            carLevel1FramePrefix: this.carLevel1FramePrefix,
            carLevel2FramePrefix: this.carLevel2FramePrefix,
            carLevel3FramePrefix: this.carLevel3FramePrefix,
            animationFrameCount: this.animationFrameCount,
            levelUpEffectFolder: this.levelUpEffectFolder,
            levelUpEffectFramesCsv: this.levelUpEffectFramesCsv,
            bgmAudioName: this.bgmAudioName,
            coinAudioName: this.coinAudioName,
            cutTreeAudioName: this.cutTreeAudioName,
            sellAudioName: this.sellAudioName,
            carAudioName: this.carAudioName,
            uiAudioName: this.uiAudioName,
            errorAudioName: this.errorAudioName,
            audioFolder: this.audioFolder,
        };
    }

    private createPlayerMovementConfig(): PlayerMovementConfig {
        return {
            playerNode: this.playerNode ?? null,
            playerActor: this.player ?? null,
            currentDirection: this.lastDirection,
            speed: this.playerSpeed,
            minX: this.moveMinX,
            maxX: this.moveMaxX,
            minY: this.moveMinY,
            maxY: this.moveMaxY,
            walkableBoundaryNode: this.getWalkableBoundaryNode(),
            movementObstacles: this.treeSystem.getMovementObstacles(),
            collisionFootInsetRatio: this.playerCollisionFootInsetRatio,
            collisionRadiusX: this.playerCollisionRadiusX,
            collisionRadiusY: this.playerCollisionRadiusY,
        };
    }

    private getWalkableBoundaryNode() {
        if (this.walkableBoundaryNode?.isValid) {
            return this.walkableBoundaryNode;
        }
        return (this.world?.isValid ? this.sceneNodes.findChildDeep(this.world, 'WalkableBoundary') : null)
            ?? (this.actors?.isValid ? this.sceneNodes.findChildDeep(this.actors, 'WalkableBoundary') : null);
    }

    private createGameplayFlowConfig(): GameplayFlowConfig {
        return {
            playerNode: this.playerNode ?? null,
            playerSellFootInsetRatio: this.playerSellFootInsetRatio,
            playerSellFootHalfWidthRatio: this.playerSellFootHalfWidthRatio,
            collectWoodCooldown: this.collectWoodCooldown,
            sellWoodCooldown: this.sellWoodCooldown,
            collectCoinCooldown: this.collectCoinCooldown,
            carUnlockCost: this.carUnlockCost,
            carUpgrade2Cost: this.carUpgrade2Cost,
            carUpgrade3Cost: this.carUpgrade3Cost,
            endAfterFinalUpgrade: this.endAfterFinalUpgrade,
            endOverlayDelay: this.endOverlayDelay,
        };
    }

    private createGameplayActionConfig(): GameplayActionConfig {
        return {
            actors: this.actors ?? null,
            playerNode: this.playerNode ?? null,
            woodCollectDelay: this.woodCollectDelay,
            sellWoodFlyDuration: this.sellWoodFlyDuration,
            coinCollectDelay: this.coinCollectDelay,
            woodPerNpcTrade: this.woodPerNpcTrade,
            carBaseWoodGain: this.carBaseWoodGain,
            carLevelWoodGain: this.carLevelWoodGain,
            carUnlockCost: this.carUnlockCost,
            carUpgrade2Cost: this.carUpgrade2Cost,
            carUpgrade3Cost: this.carUpgrade3Cost,
            coinAudioName: this.coinAudioName,
            sellAudioName: this.sellAudioName,
            cutTreeAudioName: this.cutTreeAudioName,
        };
    }

    private createNpcBubbleConfig(): NpcBubbleConfig {
        return {
            woodPerNpcTrade: this.woodPerNpcTrade,
        };
    }

    private createCarActorFactoryConfig(): CarActorFactoryConfig {
        return {
            carSpriteWidth: 150,
            carSpriteHeight: 110,
            carLevel1FramePrefix: this.carLevel1FramePrefix,
            carLevel2FramePrefix: this.carLevel2FramePrefix,
            carLevel3FramePrefix: this.carLevel3FramePrefix,
        };
    }

    private createSellZoneVisualConfig(): SellZoneVisualConfig {
        return {
            platformImagePath: this.platformImagePath,
            purchasePlatformHighlightImagePath: this.purchasePlatformHighlightImagePath,
            sellPlatformImagePath: this.sellPlatformImagePath,
            sellPlatformHighlightImagePath: this.sellPlatformHighlightImagePath,
        };
    }

    private createPromptEffectConfig(): PromptEffectConfig {
        return {
            actors: this.actors ?? null,
            promptDuration: this.floatingPromptDuration,
            promptOffsetY: this.floatingPromptOffsetY,
            promptStartScale: this.floatingPromptStartScale,
            promptEndScale: this.floatingPromptEndScale,
            promptWidth: this.floatingPromptWidth,
            promptHeight: this.floatingPromptHeight,
            promptFontSize: this.floatingPromptFontSize,
            promptOutlineWidth: this.floatingPromptOutlineWidth,
        };
    }

    private createStartAreaConfig(): StartAreaConfig {
        return {
            startPlaneDisappearPopScale: this.startPlaneDisappearPopScale,
            startPlaneDisappearEndScale: this.startPlaneDisappearEndScale,
            startPlaneDisappearPopDuration: this.startPlaneDisappearPopDuration,
            startPlaneDisappearFadeDuration: this.startPlaneDisappearFadeDuration,
        };
    }

    private createStoreLinkConfig(): StoreLinkConfig {
        return {
            iosStoreUrl: this.iosStoreUrl,
            androidStoreUrl: this.androidStoreUrl,
        };
    }

    private createGameSessionConfig(): GameSessionConfig {
        return {
            uiAudioName: this.uiAudioName,
        };
    }

    private createGameSceneBuildConfig(): GameSceneBuildConfig {
        return {
            initialStartWoodCount: this.initialStartWoodCount,
            bgmAudioName: this.bgmAudioName,
        };
    }

    private createControlSceneBuilderConfig(): ControlSceneBuilderConfig {
        return {
            root: this.root ?? null,
            ui: this.ui ?? null,
            actors: this.actors ?? null,
            joystickBaseNode: this.joystickBaseNode,
            joystickKnobNode: this.joystickKnobNode,
            guideArrowNode: this.guideArrowNode,
            joystickBaseImagePath: this.joystickBaseImagePath,
            joystickKnobImagePath: this.joystickKnobImagePath,
            arrowImagePath: this.arrowImagePath,
            targetArrowImagePath: this.targetArrowImagePath,
            playerArrowWidth: this.playerArrowWidth,
            playerArrowHeight: this.playerArrowHeight,
            targetArrowWidth: this.targetArrowWidth,
            targetArrowHeight: this.targetArrowHeight,
        };
    }

    private createCameraFollowConfig(): CameraFollowConfig {
        return {
            world: this.world ?? null,
            actors: this.actors ?? null,
            playerNode: this.playerNode ?? null,
            designWidth: this.designWidth,
            designHeight: this.designHeight,
            followEnabled: this.cameraFollowEnabled,
            viewScale: this.cameraViewScale,
            followSmooth: this.cameraFollowSmooth,
            offsetX: this.cameraOffsetX,
            offsetY: this.cameraOffsetY,
            boundsMinX: this.cameraBoundsMinX,
            boundsMaxX: this.cameraBoundsMaxX,
            boundsMinY: this.cameraBoundsMinY,
            boundsMaxY: this.cameraBoundsMaxY,
        };
    }

    private createWorldSceneBuilderConfig(): WorldSceneBuilderConfig {
        return {
            world: this.world ?? null,
            actors: this.actors ?? null,
            backgroundNode: this.backgroundNode,
            startZoneNode: this.startZoneNode,
            startPickupAnchor: this.startPickupAnchor,
            sellZoneNode: this.sellZoneNode,
            coinZoneNode: this.coinZoneNode,
            carZoneNode: this.carZoneNode,
            carZone2Node: this.carZone2Node,
            carZone3Node: this.carZone3Node,
            upgrade2ZoneNode: this.upgrade2ZoneNode,
            upgrade3ZoneNode: this.upgrade3ZoneNode,
            treeSceneNodes: this.treeSceneNodes,
            backgroundImagePath: this.backgroundImagePath,
            platformImagePath: this.platformImagePath,
            sellPlatformImagePath: this.sellPlatformImagePath,
            carUnlockCost: this.carUnlockCost,
            carUpgrade2Cost: this.carUpgrade2Cost,
            carUpgrade3Cost: this.carUpgrade3Cost,
            startZoneRadius: this.startZoneRadius,
            sellZoneRadius: this.sellZoneRadius,
            coinZoneRadius: this.coinZoneRadius,
            carZoneRadius: this.carZoneRadius,
            carUnlockPlaneScale: this.carUnlockPlaneScale,
            carPlane2OffsetX: this.carPlane2OffsetX,
            carPlane2OffsetY: this.carPlane2OffsetY,
            carPlane3OffsetX: this.carPlane3OffsetX,
            carPlane3OffsetY: this.carPlane3OffsetY,
            upgrade2ZoneRadius: this.upgrade2ZoneRadius,
            upgrade3ZoneRadius: this.upgrade3ZoneRadius,
            startGlowOpacity: this.startGlowOpacity,
            showUpgradePrompt: this.showUpgradePrompt,
            upgradePromptText: this.upgradePromptText,
            upgradePromptOffsetX: this.upgradePromptOffsetX,
            upgradePromptOffsetY: this.upgradePromptOffsetY,
            upgradePromptWidth: this.upgradePromptWidth,
            upgradePromptFontSize: this.upgradePromptFontSize,
            upgradePromptOutlineWidth: this.upgradePromptOutlineWidth,
        };
    }

    private createGameEffectConfig(): GameEffectConfig {
        return {
            actors: this.actors ?? null,
            flyDuration: this.flyDuration,
            flyEndScale: this.flyEndScale,
            effectFps: this.effectFps,
            levelUpEffectOffsetY: this.levelUpEffectOffsetY,
            levelUpEffectLifetime: this.levelUpEffectLifetime,
            levelUpEffectWidth: this.levelUpEffectWidth,
            levelUpEffectHeight: this.levelUpEffectHeight,
            levelUpEffectFolder: this.levelUpEffectFolder,
            levelUpEffectFramesCsv: this.levelUpEffectFramesCsv,
        };
    }

    private createOverlaySystemConfig(): OverlaySystemConfig {
        return {
            overlay: this.overlay ?? null,
            designWidth: this.designWidth,
            designHeight: this.designHeight,
            loadingText: this.loadingText,
            playNowImagePath: this.playNowImagePath,
            startTitleText: this.startTitleText,
            startTipText: this.startTipText,
            startButtonPulseScale: this.startButtonPulseScale,
            endTitleText: this.endTitleText,
            endSubText: this.endSubText,
            endButtonPulseScale: this.endButtonPulseScale,
            endPanelStartScale: this.endPanelStartScale,
            endPanelPopScale: this.endPanelPopScale,
            endPanelPopDuration: this.endPanelPopDuration,
            endPanelSettleDuration: this.endPanelSettleDuration,
        };
    }

    private createHudSystemConfig(): HudSystemConfig {
        return {
            ui: this.ui ?? null,
            logoNode: this.logoNode,
            playNowNode: this.playNowNode,
            topPlayNowNode: this.topPlayNowNode,
            resourceCounterPanelNode: this.resourceCounterPanelNode,
            coinCounterLabelNode: this.coinCounterLabelNode,
            woodCounterLabelNode: this.woodCounterLabelNode,
            logoImagePath: this.logoImagePath,
            playNowImagePath: this.playNowImagePath,
            playNowPulseScale: this.endButtonPulseScale,
            counterPanelImagePath: this.counterPanelImagePath,
            counterBgWidth: this.counterBgWidth,
            counterBgHeight: this.counterBgHeight,
            counterPanelMarginRight: this.counterPanelMarginRight,
            counterPanelMarginTop: this.counterPanelMarginTop,
            counterLabelOffsetX: this.counterLabelOffsetX,
            coinCounterLabelOffsetY: this.coinCounterLabelOffsetY,
            woodCounterLabelOffsetY: this.woodCounterLabelOffsetY,
            counterFontSize: this.counterFontSize,
            showDragToMoveTip: this.showDragToMoveTip,
            dragToMoveTipText: this.dragToMoveTipText,
            dragToMoveTipX: this.dragToMoveTipX,
            dragToMoveTipY: this.dragToMoveTipY,
            dragToMoveTipWidth: this.dragToMoveTipWidth,
            dragToMoveTipFontSize: this.dragToMoveTipFontSize,
            dragToMoveTipOutlineWidth: this.dragToMoveTipOutlineWidth,
            hideDragTipAfterInitialWood: this.hideDragTipAfterInitialWood,
            isPlaying: this.gameSession.isPlaying,
            isEnded: this.gameSession.isEnded,
            isInitialWoodGuide: this.guideCoordinator.isStage('initialWood'),
        };
    }

    private createCoinPlaneConfig(): CoinPlaneConfig {
        return {
            actors: this.actors ?? null,
            plane: this.interactionZones.getNode('coin'),
            coinImagePath: this.coinImagePath,
            columns: this.coinColumns,
            rows: this.coinRows,
            offsetX: this.coinOffsetX,
            offsetY: this.coinOffsetY,
            gapX: this.coinGapX,
            gapY: this.coinGapY,
            stackLayerGapY: this.coinStackLayerGapY,
            stackPopHopY: this.coinStackPopHopY,
            stackPopScale: this.coinStackPopScale,
            popStartScale: this.coinPopStartScale,
            popDelay: this.coinPopDelay,
            popDuration: this.coinPopDuration,
            flyDuration: this.flyDuration,
            sourceLiftHeight: this.npcRenderHeight,
        };
    }

    private createTreeRouteLayoutConfig(): TreeRouteLayoutConfig {
        return {
            layoutRoot: this.treeRouteRootNode,
            treeStart: this.treeStartNode,
            forwardPoint: this.treeForwardPointNode,
            rowPoint: this.treeRowPointNode,
            treesParent: this.generatedTreesNode,
            treePrefabs: [this.treeLevel1Prefab, this.treeLevel2Prefab, this.treeLevel3Prefab],
            cars: [this.carSceneNode, this.carScene2Node, this.carScene3Node],
            carPlanes: [
                this.interactionZones.getNode('car'),
                this.interactionZones.getNode('car2'),
                this.interactionZones.getNode('car3'),
            ],
            upgradePlanes: [
                this.interactionZones.getNode('upgrade2'),
                this.interactionZones.getNode('upgrade2Car2'),
                this.interactionZones.getNode('upgrade2Car3'),
                this.interactionZones.getNode('upgrade3'),
                this.interactionZones.getNode('upgrade3Car2'),
                this.interactionZones.getNode('upgrade3Car3'),
            ],
            carGroupOrder: [1, 0, 2],
            carLateralOffsets: [
                this.treeRouteCar1LateralOffset,
                this.treeRouteCar2LateralOffset,
                this.treeRouteCar3LateralOffset,
            ],
            levelRowCounts: [this.treeLevel1RowCount, this.treeLevel2RowCount, this.treeLevel3RowCount],
            rowCount: this.treeRouteRowCount,
            columnCount: this.treeRouteColumnCount,
            columnsPerCar: this.treeRouteColumnsPerCar,
            treeSpacing: this.treeRouteTreeSpacing,
            rowSpacing: this.treeRouteRowSpacing,
            carStartOffset: this.treeRouteCarStartOffset,
        };
    }

    private createTreeSystemConfig(): TreeSystemConfig {
        return {
            treeLevelCsv: this.treeLevelCsv,
            treeLevel1ImagePath: this.treeLevel1ImagePath,
            treeLevel2ImagePath: this.treeLevel2ImagePath,
            treeLevel3ImagePath: this.treeLevel3ImagePath,
            stumpSmallImagePath: this.stumpSmallImagePath,
            stumpLargeImagePath: this.stumpLargeImagePath,
            blockedTreeShakeOffsetX: this.blockedTreeShakeOffsetX,
            blockedTreeShakeOffsetY: this.blockedTreeShakeOffsetY,
            blockedTreeShakeHalfDuration: this.blockedTreeShakeHalfDuration,
            obstacleOffsetX: this.treeObstacleOffsetX,
            obstacleOffsetY: this.treeObstacleOffsetY,
            obstacleRadiusX: this.treeObstacleRadiusX,
            obstacleRadiusY: this.treeObstacleRadiusY,
        };
    }

    private createTreeWoodDropConfig(): TreeWoodDropConfig {
        return {
            actors: this.actors ?? null,
            pileLevel1Node: this.treeWoodPileLevel1Node,
            pileLevel2Node: this.treeWoodPileLevel2Node,
            pileLevel3Node: this.treeWoodPileLevel3Node,
            startFallbackNode: this.interactionZones.getNode('start'),
            woodImagePath: this.woodImagePath,
            settledWoodImagePathsCsv: this.treeWoodSettledImagePathsCsv,
            flyingWoodImagePathsCsv: this.treeWoodFlyingImagePathsCsv,
            spawnOffsetY: this.treeWoodSpawnOffsetY,
            carOffsetX: this.treeWoodCarOffsetX,
            carOffsetY: this.treeWoodCarOffsetY,
            columns: this.treeWoodColumns,
            rows: this.treeWoodRows,
            offsetX: this.treeWoodOffsetX,
            offsetY: this.treeWoodOffsetY,
            gapX: this.treeWoodGapX,
            gapY: this.treeWoodGapY,
            layerGapY: this.treeWoodLayerGapY,
            dropHopY: this.treeWoodDropHopY,
            dropStartScale: this.treeWoodDropStartScale,
            dropPopScale: this.treeWoodDropPopScale,
            dropDuration: this.treeWoodDropDuration,
            flyDelay: this.treeWoodFlyDelay,
            woodWidth: this.treeWoodWidth,
            woodHeight: this.treeWoodHeight,
        };
    }

    private createWoodCollectionConfig(): WoodCollectionConfig {
        return {
            actors: this.actors ?? null,
            startNode: this.interactionZones.getNode('start'),
            woodImagePath: this.woodImagePath,
            treeWoodPickupRadius: this.treeWoodPickupRadius,
            startWoodColumns: this.startWoodColumns,
            startWoodOffsetX: this.startWoodOffsetX,
            startWoodOffsetY: this.startWoodOffsetY,
            startWoodGapX: this.startWoodGapX,
            startWoodGapY: this.startWoodGapY,
            startWoodLayerGapX: this.startWoodLayerGapX,
            startWoodLayerGapY: this.startWoodLayerGapY,
            startWoodWidth: this.startWoodWidth,
            startWoodHeight: this.startWoodHeight,
        };
    }

    private createCarSystemConfig(): CarSystemConfig {
        const routeDirection = this.resolvedCarRouteDirection;
        const rowDirection = this.resolvedTreeRowDirection;
        return {
            actors: this.actors ?? null,
            configuredCarNodes: [this.carSceneNode, this.carScene2Node, this.carScene3Node],
            carPlaneNodes: [
                this.interactionZones.getNode('car'),
                this.interactionZones.getNode('car2'),
                this.interactionZones.getNode('car3'),
            ],
            upgrade2Nodes: [
                this.interactionZones.getNode('upgrade2'),
                this.interactionZones.getNode('upgrade2Car2'),
                this.interactionZones.getNode('upgrade2Car3'),
            ],
            upgrade3Nodes: [
                this.interactionZones.getNode('upgrade3'),
                this.interactionZones.getNode('upgrade3Car2'),
                this.interactionZones.getNode('upgrade3Car3'),
            ],
            previewFramePath: `${this.carLevel1FramePrefix}00000`,
            isEnded: this.gameSession.isEnded,
            treeOffsetX: this.carTreeOffsetX,
            treeOffsetY: this.carTreeOffsetY,
            moveToTreeDuration: this.carMoveToTreeDuration,
            cutDelay: this.carCutDelay,
            returnDuration: this.carReturnDuration,
            workInterval: this.carWorkInterval,
            retryInterval: this.carRetryInterval,
            routeDirectionX: routeDirection?.x ?? this.carRouteDirectionX,
            routeDirectionY: routeDirection?.y ?? this.carRouteDirectionY,
            routeRowDirectionX: rowDirection?.x ?? this.carRouteDirectionY,
            routeRowDirectionY: rowDirection?.y ?? -this.carRouteDirectionX,
            routeHalfWidth: this.carRouteHalfWidth,
            cutBatchSize: this.carCutBatchSize,
            upgradePlaneBackOffset: this.carUpgradePlaneBackOffset,
            blockedWiggleDistance: this.carBlockedWiggleDistance,
            blockedWiggleHalfDuration: this.carBlockedWiggleHalfDuration,
            blockedWiggleInterval: this.carBlockedWiggleInterval,
        };
    }

    private createNpcFlowConfig(): NpcFlowConfig {
        return {
            npcEntryNode: this.npcEntryNode,
            npcExitNode: this.npcExitNode,
            coinPlaneNode: this.interactionZones.getNode('coin'),
            coinsPerTrade: this.coinsPerTrade,
            showCompleteCheckBubble: this.showNpcCompleteCheckBubble,
            leaveDuration: this.npcLeaveDuration,
            enterDuration: this.npcEnterDuration,
            reflowDuration: this.npcReflowDuration,
            leaveOffscreenPadding: this.npcLeaveOffscreenPadding,
            enterOffscreenPadding: this.npcEnterOffscreenPadding,
            renderHeight: this.npcRenderHeight,
            templateScaleY: this.npcCharacterScale,
        };
    }

    private createNpcSceneBuilderConfig(): NpcSceneBuilderConfig {
        return {
            actors: this.actors ?? null,
            npcSceneNodes: this.npcSceneNodes,
            npcEntryNode: this.npcEntryNode,
            npcExitNode: this.npcExitNode,
            characterScale: this.npcCharacterScale,
            renderHeight: this.npcRenderHeight,
            idleFramePrefix: this.npcIdleFramePrefix,
            walkInFramePrefix: this.npcWalkInFramePrefix,
            walkOutFramePrefix: this.npcWalkOutFramePrefix,
        };
    }

    private createPlayerSceneBuilderConfig(): PlayerSceneBuilderConfig {
        return {
            actors: this.actors ?? null,
            playerSceneNode: this.playerSceneNode,
            playerIdleFramePrefix: this.playerIdleFramePrefix,
            playerWalkFramePrefix: this.playerWalkFramePrefix,
            playerRenderHeight: this.playerRenderHeight,
            playerCharacterScale: this.playerCharacterScale,
        };
    }

    private createPlayerFootRingConfig(): PlayerFootRingConfig {
        return {
            actors: this.actors ?? null,
            playerNode: this.playerNode ?? null,
            playerFootRingNode: this.playerFootRingNode,
            playerFootRingImagePath: this.playerFootRingImagePath,
            playerFootRingWidth: this.playerFootRingWidth,
            playerFootRingHeight: this.playerFootRingHeight,
            playerFootRingOffsetX: this.playerFootRingOffsetX,
            playerFootRingOffsetY: this.playerFootRingOffsetY,
            showPlayerFootRing: this.showPlayerFootRing,
        };
    }

    private createPlayerCarryVisualConfig(): PlayerCarryVisualConfig {
        return {
            actors: this.actors ?? null,
            playerNode: this.playerNode ?? null,
            currentDirection: this.lastDirection,
            showHeldCarryItems: this.showHeldCarryItems,
            woodCount: this.economy.wood,
            coinCount: this.economy.coins,
            woodOffsetX: this.heldWoodOffsetX,
            woodStartY: this.heldWoodStartY,
            woodGapY: this.heldWoodGapY,
            woodWideGapY: this.heldWoodWideGapY,
            woodDiagonalGapY: this.heldWoodDiagonalGapY,
            woodCarryWidth: this.heldWoodCarryWidth,
            woodCarryHeight: this.heldWoodCarryHeight,
            woodCarryWideWidth: this.heldWoodCarryWideWidth,
            woodCarryWideHeight: this.heldWoodCarryWideHeight,
            woodCarryDiagonalWidth: this.heldWoodCarryDiagonalWidth,
            woodCarryDiagonalHeight: this.heldWoodCarryDiagonalHeight,
            coinOffsetX: this.heldCoinOffsetX,
            coinStartY: this.heldCoinStartY,
            coinGapY: this.heldCoinGapY,
            carryBackDistance: this.heldCarryBackDistance,
            carryBackYScale: this.heldCarryBackYScale,
            carryItemGap: this.heldCarrySideSplit,
            coinImagePath: this.coinImagePath,
            carryWoodImagePath: this.carryWoodImagePath,
            carryWoodWideImagePath: this.carryWoodWideImagePath,
            carryWoodDiagonalAImagePath: this.carryWoodDiagonalAImagePath,
            carryWoodDiagonalBImagePath: this.carryWoodDiagonalBImagePath,
        };
    }

    private createNpcVisualConfig(): NpcVisualConfig {
        return {
            actors: this.actors ?? null,
            showHeldCarryItems: this.showHeldCarryItems,
            showCompleteCheckBubble: this.showNpcCompleteCheckBubble,
            carryBackDistance: this.npcCarryBackDistance,
            carryBackYScale: this.npcCarryBackYScale,
            carryWoodOffsetX: this.npcCarryWoodOffsetX,
            carryWoodStartY: this.npcCarryWoodStartY,
            carryWoodGapY: this.npcCarryWoodGapY,
            bubbleOffsetX: this.npcBubbleOffsetX,
            bubbleOffsetY: this.npcBubbleOffsetY,
            bubbleWidth: this.npcBubbleWidth,
            bubbleHeight: this.npcBubbleHeight,
            bubbleLabelOffsetX: this.npcBubbleLabelOffsetX,
            bubbleLabelOffsetY: this.npcBubbleLabelOffsetY,
            bubbleLabelFontSize: this.npcBubbleLabelFontSize,
            bubbleCircleImagePath: this.npcBubbleCircleImagePath,
            bubbleProgressImagePath: this.npcBubbleProgressImagePath,
            bubbleWoodImagePath: this.npcBubbleWoodImagePath,
            bubblePointImagePath: this.npcBubblePointImagePath,
            bubbleCheckImagePath: this.npcBubbleCheckImagePath,
            bubbleSmileImagePath: this.npcBubbleSmileImagePath,
        };
    }

    private createActorSortConfig(): ActorSortConfig {
        return {
            actors: this.actors ?? null,
            carryBackpackSortBiasY: CARRY_BACKPACK_SORT_BIAS_Y,
            playerFootRingSortBiasY: PLAYER_FOOT_RING_SORT_BIAS_Y,
        };
    }

}
