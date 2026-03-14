import type { FpsCamera } from '../render/scene';

type KeyState = {
    backward: boolean;
    crouch: boolean;
    forward: boolean;
    jump: boolean;
    left: boolean;
    one: boolean;
    r: boolean;
    right: boolean;
    sprint: boolean;
    three: boolean;
    two: boolean;
};

const createDefaultKeyState = (): KeyState => ({
    backward: false,
    crouch: false,
    forward: false,
    jump: false,
    left: false,
    one: false,
    r: false,
    right: false,
    sprint: false,
    three: false,
    two: false,
});

export class InputController {
    private domElement: HTMLCanvasElement;
    private camera: FpsCamera;
    private keys: KeyState;
    private previousKeys: KeyState;
    private keyPresses: KeyState;
    private keyReleases: KeyState;
    private mouseButtons = new Map<number, boolean>();
    private mouseMovement = { x: 0, y: 0 };
    private enabled = true;
    isPointerLocked = false;

    constructor(domElement: HTMLCanvasElement, camera: FpsCamera) {
        this.domElement = domElement;
        this.camera = camera;

        this.keys = createDefaultKeyState();
        this.previousKeys = createDefaultKeyState();
        this.keyPresses = createDefaultKeyState();
        this.keyReleases = createDefaultKeyState();

        this.lockPointer = this.lockPointer.bind(this);
        this.onPointerLockChange = this.onPointerLockChange.bind(this);
        this.onWindowBlur = this.onWindowBlur.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);

        this.domElement.addEventListener('click', this.lockPointer);
        document.addEventListener('pointerlockchange', this.onPointerLockChange);
        window.addEventListener('blur', this.onWindowBlur);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mouseup', this.onMouseUp);
    }

    lockPointer() {
        this.domElement.requestPointerLock();
    }

    private onPointerLockChange() {
        this.isPointerLocked = document.pointerLockElement === this.domElement;
        if (!this.isPointerLocked) {
            this.resetInputState();
        }
    }

    private onWindowBlur() {
        this.resetInputState();
    }

    private onKeyDown(event: KeyboardEvent) {
        if (!this.enabled) {
            return;
        }
        this.applyKeyEvent(event.code, true);
    }

    private onKeyUp(event: KeyboardEvent) {
        if (!this.enabled) {
            return;
        }
        this.applyKeyEvent(event.code, false);
    }

    private applyKeyEvent(code: string, pressed: boolean) {
        switch (code) {
            case 'KeyW':
            case 'KeyZ':
            case 'ArrowUp':
                this.keys.forward = pressed;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = pressed;
                break;
            case 'KeyA':
            case 'KeyQ':
            case 'ArrowLeft':
                this.keys.left = pressed;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = pressed;
                break;
            case 'Space':
                this.keys.jump = pressed;
                break;
            case 'KeyR':
                this.keys.r = pressed;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.sprint = pressed;
                break;
            case 'KeyC':
            case 'ControlLeft':
                this.keys.crouch = pressed;
                break;
            case 'Digit1':
                this.keys.one = pressed;
                break;
            case 'Digit2':
                this.keys.two = pressed;
                break;
            case 'Digit3':
                this.keys.three = pressed;
                break;
            default:
                break;
        }
    }

    private onMouseMove(event: MouseEvent) {
        if (!this.enabled) {
            return;
        }
        if (!this.isPointerLocked) {
            return;
        }

        this.camera.moveOnMouseMove(event);
        this.mouseMovement.x = event.movementX;
        this.mouseMovement.y = event.movementY;
    }

    private onMouseDown(event: MouseEvent) {
        if (!this.enabled) {
            return;
        }
        this.mouseButtons.set(event.button, true);
    }

    private onMouseUp(event: MouseEvent) {
        if (!this.enabled) {
            return;
        }
        this.mouseButtons.set(event.button, false);
    }

    getKeys(): KeyState {
        return this.keys;
    }

    isKeyDown(key: keyof KeyState): boolean {
        return this.keys[key];
    }

    isMouseButtonPressed(button: number): boolean {
        return this.mouseButtons.get(button) ?? false;
    }

    updateKeyEvents() {
        if (!this.enabled) {
            return;
        }
        const keys: Array<keyof KeyState> = [
            'forward',
            'backward',
            'left',
            'right',
            'jump',
            'sprint',
            'crouch',
            'one',
            'two',
            'three',
            'r',
        ];

        for (const key of keys) {
            this.keyPresses[key] = this.keys[key] && !this.previousKeys[key];
            this.keyReleases[key] = !this.keys[key] && this.previousKeys[key];
        }

        this.previousKeys = { ...this.keys };
    }

    getMouseMovement(): { x: number; y: number } {
        if (!this.enabled) {
            return { x: 0, y: 0 };
        }
        const movement = { ...this.mouseMovement };
        this.mouseMovement = { x: 0, y: 0 };
        return movement;
    }

    setEnabled(enabled: boolean) {
        if (this.enabled === enabled) {
            return;
        }
        this.enabled = enabled;
        if (!enabled) {
            this.resetInputState();
        }
    }

    private resetInputState() {
        this.keys = createDefaultKeyState();
        this.previousKeys = createDefaultKeyState();
        this.keyPresses = createDefaultKeyState();
        this.keyReleases = createDefaultKeyState();
        this.mouseButtons.clear();
        this.mouseMovement = { x: 0, y: 0 };
    }

    debugSetPointerLockState(locked: boolean) {
        this.isPointerLocked = locked;
    }

    debugGetPointerLockState() {
        return this.isPointerLocked;
    }

    dispose() {
        this.domElement.removeEventListener('click', this.lockPointer);
        document.removeEventListener('pointerlockchange', this.onPointerLockChange);
        window.removeEventListener('blur', this.onWindowBlur);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mouseup', this.onMouseUp);
    }
}
