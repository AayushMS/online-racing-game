// packages/client/src/game/InputHandler.ts

export interface GameInput {
  steer: number;
  throttle: number;
  brake: number;
  useItem: boolean;
}

export class InputHandler {
  private keys: Set<string> = new Set();
  private _useItemPressed = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === 'Space') this._useItemPressed = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  getInput(): GameInput {
    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const right = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const gas = this.keys.has('ArrowUp') || this.keys.has('KeyW');
    const brake = this.keys.has('ArrowDown') || this.keys.has('KeyS');

    const useItem = this._useItemPressed;
    this._useItemPressed = false;

    return {
      steer: left ? -1 : right ? 1 : 0,
      throttle: gas ? 1 : 0,
      brake: brake ? 1 : 0,
      useItem,
    };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
