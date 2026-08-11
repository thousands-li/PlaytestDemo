import {
    EventKeyboard,
    EventTouch,
    input,
    Input,
    KeyCode,
    Node,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';

export interface InputControllerConfig {
    targetNode: Node | null;
    designWidth: number;
    designHeight: number;
    joystickRadius: number;
    joystickFullScreenTouch: boolean;
    joystickTouchRadius: number;
    isPlaying: boolean;
}

export class InputController {
    private joystickBase: Node | null = null;
    private joystickKnob: Node | null = null;
    private readonly movement = new Vec2();
    private readonly keyboard = new Set<KeyCode>();
    private touchActive = false;
    private joystickTouchId: number | null = null;
    private boundTouchNode: Node | null = null;
    private bound = false;

    public constructor(private readonly getConfig: () => InputControllerConfig) {}

    public bind() {
        if (this.bound) {
            return;
        }

        input.on(Input.EventType.KEY_DOWN, this.onKeyDown);
        input.on(Input.EventType.KEY_UP, this.onKeyUp);

        const targetNode = this.getConfig().targetNode;
        if (targetNode?.isValid) {
            targetNode.on(Node.EventType.TOUCH_START, this.onTouchStart);
            targetNode.on(Node.EventType.TOUCH_MOVE, this.onTouchMove);
            targetNode.on(Node.EventType.TOUCH_END, this.onTouchEnd);
            targetNode.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd);
            this.boundTouchNode = targetNode;
        }

        this.bound = true;
    }

    public unbind() {
        if (!this.bound) {
            return;
        }

        input.off(Input.EventType.KEY_DOWN, this.onKeyDown);
        input.off(Input.EventType.KEY_UP, this.onKeyUp);
        if (this.boundTouchNode?.isValid) {
            this.boundTouchNode.off(Node.EventType.TOUCH_START, this.onTouchStart);
            this.boundTouchNode.off(Node.EventType.TOUCH_MOVE, this.onTouchMove);
            this.boundTouchNode.off(Node.EventType.TOUCH_END, this.onTouchEnd);
            this.boundTouchNode.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd);
        }
        this.boundTouchNode = null;
        this.bound = false;
    }

    public bindJoystick(base: Node, knob: Node) {
        this.joystickBase = base;
        this.joystickKnob = knob;
        knob.setPosition(base.position);
        this.setJoystickVisible(!this.getConfig().joystickFullScreenTouch);
    }

    public getJoystickMovementLengthSqr() {
        if (!this.getConfig().isPlaying) {
            return 0;
        }
        return this.movement.lengthSqr();
    }

    public getMoveDirection() {
        if (!this.getConfig().isPlaying) {
            return new Vec2();
        }
        const dir = this.movement.clone();
        if (this.keyboard.has(KeyCode.KEY_A) || this.keyboard.has(KeyCode.ARROW_LEFT)) {
            dir.x -= 1;
        }
        if (this.keyboard.has(KeyCode.KEY_D) || this.keyboard.has(KeyCode.ARROW_RIGHT)) {
            dir.x += 1;
        }
        if (this.keyboard.has(KeyCode.KEY_W) || this.keyboard.has(KeyCode.ARROW_UP)) {
            dir.y += 1;
        }
        if (this.keyboard.has(KeyCode.KEY_S) || this.keyboard.has(KeyCode.ARROW_DOWN)) {
            dir.y -= 1;
        }
        return dir;
    }

    public clearMovement() {
        this.keyboard.clear();
        this.touchActive = false;
        this.joystickTouchId = null;
        this.movement.set(0, 0);
        if (this.joystickBase && this.joystickKnob) {
            this.joystickKnob.setPosition(this.joystickBase.position);
        }
        const config = this.getConfig();
        this.setJoystickVisible(config.isPlaying && !config.joystickFullScreenTouch);
    }

    private readonly onKeyDown = (event: EventKeyboard) => {
        if (!this.getConfig().isPlaying) {
            return;
        }
        this.keyboard.add(event.keyCode);
    };

    private readonly onKeyUp = (event: EventKeyboard) => {
        this.keyboard.delete(event.keyCode);
    };

    private readonly onTouchStart = (event: EventTouch) => {
        const config = this.getConfig();
        if (!config.isPlaying || this.touchActive || !this.joystickBase || !this.joystickKnob) {
            return;
        }

        const local = this.touchToLocal(event, config);
        if (config.joystickFullScreenTouch) {
            this.startJoystickAt(local, event);
            return;
        }

        if (Vec3.distance(local, this.joystickBase.position) <= config.joystickTouchRadius) {
            this.startJoystickAt(local, event);
        }
    };

    private readonly onTouchMove = (event: EventTouch) => {
        if (!this.getConfig().isPlaying) {
            this.clearMovement();
            return;
        }
        if (!this.touchActive || !this.isCurrentJoystickTouch(event)) {
            return;
        }
        this.updateJoystick(this.touchToLocal(event, this.getConfig()));
    };

    private readonly onTouchEnd = (event?: EventTouch) => {
        if (!this.touchActive || !this.isCurrentJoystickTouch(event)) {
            return;
        }

        this.touchActive = false;
        this.joystickTouchId = null;
        this.movement.set(0, 0);
        if (this.joystickBase && this.joystickKnob) {
            this.joystickKnob.setPosition(this.joystickBase.position);
        }
        const config = this.getConfig();
        this.setJoystickVisible(config.isPlaying && !config.joystickFullScreenTouch);
    };

    private startJoystickAt(local: Vec3, event: EventTouch) {
        if (!this.joystickBase || !this.joystickKnob) {
            return;
        }

        this.touchActive = true;
        this.joystickTouchId = this.getTouchId(event);
        if (this.getConfig().joystickFullScreenTouch) {
            this.joystickBase.setPosition(local);
            this.joystickKnob.setPosition(local);
            this.setJoystickVisible(true);
        }
        this.updateJoystick(local);
    }

    private setJoystickVisible(visible: boolean) {
        if (this.joystickBase) {
            this.joystickBase.active = visible;
        }
        if (this.joystickKnob) {
            this.joystickKnob.active = visible;
        }
    }

    private isCurrentJoystickTouch(event?: EventTouch) {
        if (!event || this.joystickTouchId === null) {
            return true;
        }
        return this.getTouchId(event) === this.joystickTouchId;
    }

    private getTouchId(event: EventTouch) {
        return (event as unknown as { getID?: () => number }).getID?.() ?? null;
    }

    private updateJoystick(local: Vec3) {
        if (!this.joystickBase || !this.joystickKnob) {
            return;
        }

        const radius = Math.max(0.0001, this.getConfig().joystickRadius);
        const center = this.joystickBase.position;
        const delta = new Vec2(local.x - center.x, local.y - center.y);
        const len = delta.length();
        if (len > radius) {
            delta.multiplyScalar(radius / len);
        }
        this.joystickKnob.setPosition(center.x + delta.x, center.y + delta.y, 0);
        this.movement.set(delta.x / radius, delta.y / radius);
    }

    private touchToLocal(event: EventTouch, config: InputControllerConfig) {
        const loc = event.getUILocation();
        const transform = config.targetNode?.getComponent(UITransform);
        if (!transform) {
            return new Vec3(loc.x - config.designWidth / 2, loc.y - config.designHeight / 2, 0);
        }
        return transform.convertToNodeSpaceAR(new Vec3(loc.x, loc.y, 0));
    }
}
