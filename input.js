/* ===========================================================
   input.js — keyboard + pointer, mapped into world space
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;
  const { clamp } = NV.math;
  const WORLD = NV.WORLD;

  const MOVE_KEYS = new Set([
    "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    "KeyA", "KeyD", "KeyW", "KeyS",
  ]);

  class Input {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = new Set();
      this.pointer = {
        x: WORLD.width / 2,
        y: WORLD.height - 90,
        active: false,
        touch: false,
      };
      this.keyHandlers = [];

      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleKeyUp = this.handleKeyUp.bind(this);
      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handlePointerDown = this.handlePointerDown.bind(this);
      this.handlePointerUp = this.handlePointerUp.bind(this);
      this.handleBlur = this.handleBlur.bind(this);

      global.addEventListener("keydown", this.handleKeyDown);
      global.addEventListener("keyup", this.handleKeyUp);
      global.addEventListener("blur", this.handleBlur);
      canvas.addEventListener("pointermove", this.handlePointerMove);
      canvas.addEventListener("pointerdown", this.handlePointerDown);
      global.addEventListener("pointerup", this.handlePointerUp);
      global.addEventListener("pointercancel", this.handlePointerUp);
      canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    onKey(handler) {
      this.keyHandlers.push(handler);
    }

    handleKeyDown(event) {
      if (MOVE_KEYS.has(event.code)) {
        event.preventDefault();
        this.keys.add(event.code);
      }
      for (const handler of this.keyHandlers) {
        handler(event);
      }
    }

    handleKeyUp(event) {
      this.keys.delete(event.code);
    }

    handleBlur() {
      this.keys.clear();
      this.pointer.active = false;
    }

    handlePointerDown(event) {
      this.updatePointer(event);
      this.pointer.active = true;
    }

    handlePointerMove(event) {
      this.updatePointer(event);
      this.pointer.active = true;
    }

    handlePointerUp(event) {
      if (event.pointerType === "touch") {
        this.pointer.active = false;
      }
    }

    updatePointer(event) {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scaleX = WORLD.width / rect.width;
      const scaleY = WORLD.height / rect.height;
      const isTouch = event.pointerType === "touch";
      this.pointer.touch = isTouch;
      this.pointer.x = clamp((event.clientX - rect.left) * scaleX, 0, WORLD.width);
      this.pointer.y = clamp(
        (event.clientY - rect.top) * scaleY - (isTouch ? NV.TUNING.pointerTouchOffset : 0),
        0,
        WORLD.height
      );
    }

    /** Normalised movement vector from the keyboard (0,0 when idle). */
    get axis() {
      let x = 0;
      let y = 0;
      if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) x -= 1;
      if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) x += 1;
      if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) y -= 1;
      if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) y += 1;
      return { x, y };
    }

    resetPointerTarget(x, y) {
      this.pointer.x = x;
      this.pointer.y = y;
      this.pointer.active = false;
    }
  }

  NV.Input = Input;
})(window);
