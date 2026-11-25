/* ===========================================================
   bullets.js — projectiles for the player and the swarm
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;
  const { TAU } = NV.math;
  const WORLD = NV.WORLD;

  class Bullet {
    constructor(options) {
      this.x = options.x;
      this.y = options.y;
      this.vx = options.vx || 0;
      this.vy = options.vy || 0;
      this.radius = options.radius || 4;
      this.damage = options.damage || 10;
      this.color = options.color || NV.COLORS.cyan;
      this.friendly = Boolean(options.friendly);
      this.dead = false;
      this.trail = options.trail !== false;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const pad = 60;
      if (this.y < -pad || this.y > WORLD.height + pad || this.x < -pad || this.x > WORLD.width + pad) {
        this.dead = true;
      }
    }

    draw(ctx) {
      if (this.friendly) {
        const angle = Math.atan2(this.vy, this.vx);
        const length = 16;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle + Math.PI / 2);
        ctx.fillStyle = this.color;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.25;
        ctx.fillRect(-this.radius, -length, this.radius * 2, length * 1.4);
        ctx.globalAlpha = 1;
        ctx.fillRect(-this.radius * 0.55, -length, this.radius * 1.1, length);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-this.radius * 0.25, -length * 0.7, this.radius * 0.5, length * 0.5);
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = this.color;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 2.1, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.45, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Direction vector from (x,y) toward (tx,ty). */
  function aimAt(x, y, tx, ty) {
    const dx = tx - x;
    const dy = ty - y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  }

  NV.Bullet = Bullet;
  NV.aimAt = aimAt;
})(window);
