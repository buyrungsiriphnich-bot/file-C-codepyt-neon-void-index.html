/* ===========================================================
   player.js — the interceptor: movement, weapons, damage
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;
  const { clamp, lerp, smooth, TAU } = NV.math;
  const T = NV.TUNING;
  const WORLD = NV.WORLD;

  const SHIP_PATH = [
    [0, -22], [6, -6], [20, 8], [8, 6], [5, 13],
    [0, 9], [-5, 13], [-8, 6], [-20, 8], [-6, -6],
  ];

  const MIN_Y = 160;
  const SIDE_MARGIN = 30;
  const BOTTOM_MARGIN = 34;

  class Player {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = WORLD.width / 2;
      this.y = WORLD.height - 90;
      this.vx = 0;
      this.vy = 0;
      this.hp = T.playerHp;
      this.shield = 0;
      this.radius = T.playerRadius;
      this.invuln = 0;
      this.spreadTime = 0;
      this.rapidTime = 0;
      this.fireTimer = 0;
      this.thrustTimer = 0;
      this.tilt = 0;
      this.time = 0;
      this.alive = true;
    }

    get fireDelay() {
      return this.rapidTime > 0 ? T.fireDelayRapid : T.fireDelayBase;
    }

    update(dt, game) {
      this.time += dt;
      this.invuln = Math.max(0, this.invuln - dt);
      this.spreadTime = Math.max(0, this.spreadTime - dt);
      this.rapidTime = Math.max(0, this.rapidTime - dt);

      this.move(dt, game);

      this.x = clamp(this.x, SIDE_MARGIN, WORLD.width - SIDE_MARGIN);
      this.y = clamp(this.y, MIN_Y, WORLD.height - BOTTOM_MARGIN);

      this.tilt = lerp(this.tilt, clamp(this.vx / 900, -0.24, 0.24), smooth(10, dt));

      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.shoot(game);
        this.fireTimer = this.fireDelay;
      }

      this.emitThrust(dt, game);
    }

    move(dt, game) {
      const axis = game.input.axis;
      const pointer = game.input.pointer;
      const usingKeyboard = axis.x !== 0 || axis.y !== 0;

      if (usingKeyboard) {
        this.vx += axis.x * T.playerAccel * dt;
        this.vy += axis.y * T.playerAccel * dt;
        const speed = Math.hypot(this.vx, this.vy);
        const limit = T.playerSpeed;
        if (speed > limit) {
          this.vx = (this.vx / speed) * limit;
          this.vy = (this.vy / speed) * limit;
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        return;
      }

      if (pointer.active) {
        const follow = smooth(T.pointerSmoothing, dt);
        const nextX = this.x + (pointer.x - this.x) * follow;
        const nextY = this.y + (pointer.y - this.y) * follow;
        const safeDt = Math.max(dt, 0.0001);
        this.vx = (nextX - this.x) / safeDt;
        this.vy = (nextY - this.y) / safeDt;
        this.x = nextX;
        this.y = nextY;
        return;
      }

      const damping = Math.exp(-T.playerFriction * dt);
      this.vx *= damping;
      this.vy *= damping;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    shoot(game) {
      const angles = this.spreadTime > 0 ? [-0.2, 0, 0.2] : [0];
      for (const offset of angles) {
        const angle = -Math.PI / 2 + offset;
        game.playerBullets.push(
          new NV.Bullet({
            x: this.x + offset * 34,
            y: this.y - 16,
            vx: Math.cos(angle) * T.bulletSpeed,
            vy: Math.sin(angle) * T.bulletSpeed,
            radius: 4,
            damage: T.bulletDamage,
            color: NV.COLORS.cyan,
            friendly: true,
          })
        );
      }
      game.audio.shoot();
    }

    emitThrust(dt, game) {
      this.thrustTimer -= dt;
      if (this.thrustTimer > 0) return;
      this.thrustTimer = 0.045;
      game.effects.burst(this.x - Math.sin(this.tilt) * 16, this.y + 12, {
        count: 2,
        color: this.rapidTime > 0 ? NV.COLORS.lime : NV.COLORS.cyan,
        speed: 70,
        speedVar: 0.8,
        life: 0.24,
        size: 2.4,
        angle: Math.PI / 2,
        spread: 0.7,
      });
    }

    /** Applies one hit. Returns true when the player survived. */
    takeHit(game) {
      if (this.invuln > 0 || !this.alive) return true;

      if (this.shield > 0) {
        this.shield -= 1;
        this.invuln = 0.9;
        game.damageFlash = 0.45;
        game.audio.shieldBreak();
        game.effects.ring(this.x, this.y, { color: NV.COLORS.amber, to: 90, life: 0.5, width: 3 });
        game.effects.burst(this.x, this.y, { count: 18, color: NV.COLORS.amber, speed: 260, life: 0.5 });
        game.effects.shake(6);
        return true;
      }

      this.hp -= 1;
      this.invuln = T.invulnTime;
      game.damageFlash = 1;
      game.audio.playerHit();
      game.effects.burst(this.x, this.y, { count: 26, color: NV.COLORS.danger, speed: 320, life: 0.8 });
      game.effects.ring(this.x, this.y, { color: NV.COLORS.danger, to: 120, life: 0.6, width: 4 });
      game.effects.shake(14);

      if (this.hp <= 0) {
        this.alive = false;
        return false;
      }
      return true;
    }

    addShield() {
      this.shield = Math.min(T.maxShield, this.shield + 1);
    }

    addSpread() {
      this.spreadTime = T.spreadShotTime;
    }

    addRapid() {
      this.rapidTime = T.rapidShotTime;
    }

    heal() {
      this.hp = Math.min(T.playerHp, this.hp + 1);
    }

    draw(ctx, time) {
      if (!this.alive) return;

      const blinking = this.invuln > 0 && Math.floor(time * 16) % 2 === 0;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.tilt);

      if (blinking) ctx.globalAlpha = 0.4;

      // engine plume
      const flicker = 0.7 + Math.sin(time * 30) * 0.3;
      ctx.globalCompositeOperation = "lighter";
      const plume = ctx.createLinearGradient(0, 8, 0, 30 * flicker);
      plume.addColorStop(0, this.rapidTime > 0 ? "rgba(141,255,92,0.85)" : "rgba(34,232,255,0.85)");
      plume.addColorStop(1, "rgba(34,232,255,0)");
      ctx.fillStyle = plume;
      ctx.beginPath();
      ctx.moveTo(-5, 8);
      ctx.lineTo(0, 26 * flicker);
      ctx.lineTo(5, 8);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      // hull
      ctx.beginPath();
      SHIP_PATH.forEach(([px, py], index) => {
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = "#08151f";
      ctx.fill();
      ctx.lineJoin = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.invuln > 0 ? NV.COLORS.amber : NV.COLORS.cyan;
      ctx.shadowColor = NV.COLORS.cyan;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // cockpit
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(3.5, 2);
      ctx.lineTo(0, 6);
      ctx.lineTo(-3.5, 2);
      ctx.closePath();
      ctx.fillStyle = NV.COLORS.ice;
      ctx.globalAlpha = blinking ? 0.4 : 0.9;
      ctx.fill();
      ctx.globalAlpha = blinking ? 0.4 : 1;

      // wing accents
      ctx.strokeStyle = NV.COLORS.magenta;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-13, 7);
      ctx.lineTo(-6, 0);
      ctx.moveTo(13, 7);
      ctx.lineTo(6, 0);
      ctx.stroke();

      ctx.restore();

      if (this.shield > 0) this.drawShield(ctx, time);
    }

    drawShield(ctx, time) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.55 + Math.sin(time * 6) * 0.15;
      ctx.strokeStyle = NV.COLORS.amber;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, TAU);
      ctx.stroke();

      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2.5;
      for (let i = 0; i < this.shield; i += 1) {
        const start = time * 1.6 + (i * TAU) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, 30, start, start + 0.7);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  NV.Player = Player;
})(window);
