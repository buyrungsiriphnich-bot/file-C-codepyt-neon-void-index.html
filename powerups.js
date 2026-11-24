/* ===========================================================
   powerups.js — pickups that upgrade the interceptor
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;
  const { rand, clamp, TAU } = NV.math;
  const T = NV.TUNING;
  const WORLD = NV.WORLD;

  const TYPES = {
    spread: { color: NV.COLORS.cyan, label: "SPREAD", weight: 30 },
    rapid: { color: NV.COLORS.lime, label: "RAPID", weight: 28 },
    shield: { color: NV.COLORS.amber, label: "SHIELD", weight: 26 },
    heal: { color: NV.COLORS.magenta, label: "REPAIR", weight: 16 },
  };

  const WEIGHTED_POOL = [];
  for (const [key, config] of Object.entries(TYPES)) {
    for (let i = 0; i < config.weight; i += 1) WEIGHTED_POOL.push(key);
  }

  class Powerup {
    constructor(type, x, y) {
      this.type = type;
      this.config = TYPES[type];
      this.x = x;
      this.y = y;
      this.radius = T.powerupRadius;
      this.baseX = x;
      this.life = T.powerupLifetime;
      this.t = rand(0, TAU);
      this.dead = false;
      this.collected = false;
    }

    update(dt, game) {
      this.t += dt;
      this.life -= dt;
      if (this.life <= 0) {
        this.dead = true;
        return;
      }

      const player = game.player;
      const distance = Math.hypot(player.x - this.x, player.y - this.y);
      if (distance < 150 && player.alive) {
        const pull = 340 * dt;
        this.x += ((player.x - this.x) / distance) * pull;
        this.y += ((player.y - this.y) / distance) * pull;
      } else {
        this.y += T.powerupFallSpeed * dt;
        this.baseX += Math.sin(this.t * 1.6) * 16 * dt;
        this.x = this.baseX;
      }

      if (this.y > WORLD.height + 30) this.dead = true;
    }

    apply(player, game) {
      this.collected = true;
      this.dead = true;

      if (this.type === "spread") player.addSpread();
      else if (this.type === "rapid") player.addRapid();
      else if (this.type === "shield") player.addShield();
      else player.heal();

      game.audio.powerup();
      game.effects.ring(this.x, this.y, { color: this.config.color, to: 84, life: 0.45, width: 3 });
      game.effects.burst(this.x, this.y, { count: 16, color: this.config.color, speed: 200, life: 0.55 });
      game.effects.text(this.x, this.y - 24, this.config.label, { color: this.config.color, size: 17, life: 0.9 });
      game.hud.flashPickup(this.config.label, this.config.color);
    }

    draw(ctx, time) {
      const fade = this.life < 2.5 ? 0.35 + Math.abs(Math.sin(time * 8)) * 0.65 : 1;
      const bob = Math.sin(this.t * 3) * 3;

      ctx.save();
      ctx.translate(this.x, this.y + bob);
      ctx.globalAlpha = fade;

      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, this.radius * 2.6);
      glow.addColorStop(0, this.hexColor(0.5));
      glow.addColorStop(1, this.hexColor(0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 2.6, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      ctx.rotate(Math.sin(this.t) * 0.15);
      ctx.strokeStyle = this.config.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * TAU - Math.PI / 2;
        const px = Math.cos(angle) * this.radius;
        const py = Math.sin(angle) * this.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(8,12,24,0.85)";
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.config.color;
      this.drawGlyph(ctx);
      ctx.restore();
    }

    hexColor(alpha) {
      const hex = this.config.color.replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    drawGlyph(ctx) {
      const size = this.radius * 0.55;
      ctx.beginPath();
      if (this.type === "spread") {
        ctx.moveTo(-size, size * 0.7);
        ctx.lineTo(-size, -size * 0.2);
        ctx.moveTo(0, size);
        ctx.lineTo(0, -size * 0.7);
        ctx.moveTo(size, size * 0.7);
        ctx.lineTo(size, -size * 0.2);
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = this.config.color;
        ctx.stroke();
        return;
      }
      if (this.type === "rapid") {
        ctx.moveTo(-size * 0.4, -size);
        ctx.lineTo(size * 0.5, -size * 0.15);
        ctx.lineTo(0, -size * 0.05);
        ctx.lineTo(size * 0.45, size);
        ctx.lineTo(-size * 0.5, size * 0.05);
        ctx.lineTo(0, -size * 0.1);
        ctx.closePath();
        ctx.fill();
        return;
      }
      if (this.type === "shield") {
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.8, -size * 0.45);
        ctx.lineTo(size * 0.8, size * 0.25);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.8, size * 0.25);
        ctx.lineTo(-size * 0.8, -size * 0.45);
        ctx.closePath();
        ctx.fill();
        return;
      }
      const arm = size * 0.34;
      ctx.rect(-arm, -size, arm * 2, size * 2);
      ctx.rect(-size, -arm, size * 2, arm * 2);
      ctx.fill();
    }
  }

  /** Rolls a drop type (or null when nothing drops). */
  function rollDrop(chance) {
    if (Math.random() > chance) return null;
    return WEIGHTED_POOL[Math.floor(Math.random() * WEIGHTED_POOL.length)];
  }

  NV.Powerup = Powerup;
  NV.rollDrop = rollDrop;
  NV.POWERUP_TYPES = TYPES;
})(window);
