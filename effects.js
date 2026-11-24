/* ===========================================================
   effects.js — particles, shockwave rings, floating text, shake
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;
  const { rand, clamp, easeOutCubic, TAU } = NV.math;

  const MAX_PARTICLES = 720;

  class Effects {
    constructor() {
      this.particles = [];
      this.rings = [];
      this.texts = [];
      this.shakeAmount = 0;
    }

    clear() {
      this.particles.length = 0;
      this.rings.length = 0;
      this.texts.length = 0;
      this.shakeAmount = 0;
    }

    burst(x, y, options = {}) {
      const {
        count = 14,
        color = NV.COLORS.cyan,
        speed = 220,
        speedVar = 0.6,
        size = 2.6,
        life = 0.6,
        angle = null,
        spread = TAU,
        drag = 2.4,
      } = options;

      const budget = Math.min(count, MAX_PARTICLES - this.particles.length);
      for (let i = 0; i < budget; i += 1) {
        const theta = angle === null ? rand(0, TAU) : angle + rand(-spread / 2, spread / 2);
        const magnitude = speed * (1 - speedVar + Math.random() * speedVar);
        const lifespan = life * rand(0.7, 1.2);
        this.particles.push({
          x,
          y,
          vx: Math.cos(theta) * magnitude,
          vy: Math.sin(theta) * magnitude,
          life: lifespan,
          maxLife: lifespan,
          size: size * rand(0.6, 1.4),
          color,
          drag,
        });
      }
    }

    ring(x, y, options = {}) {
      const { color = NV.COLORS.cyan, from = 6, to = 70, life = 0.45, width = 3 } = options;
      this.rings.push({ x, y, color, radius: from, from, to, life, maxLife: life, width });
    }

    text(x, y, value, options = {}) {
      const { color = NV.COLORS.amber, size = 20, life = 0.9 } = options;
      this.texts.push({ x, y, value, color, size, life, maxLife: life });
    }

    shake(amount) {
      this.shakeAmount = Math.max(this.shakeAmount, amount);
    }

    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i -= 1) {
        const particle = this.particles[i];
        particle.life -= dt;
        if (particle.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        const damping = Math.exp(-particle.drag * dt);
        particle.vx *= damping;
        particle.vy *= damping;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
      }

      for (let i = this.rings.length - 1; i >= 0; i -= 1) {
        const ring = this.rings[i];
        ring.life -= dt;
        if (ring.life <= 0) {
          this.rings.splice(i, 1);
          continue;
        }
        const progress = 1 - ring.life / ring.maxLife;
        ring.radius = ring.from + (ring.to - ring.from) * easeOutCubic(progress);
      }

      for (let i = this.texts.length - 1; i >= 0; i -= 1) {
        const text = this.texts[i];
        text.life -= dt;
        if (text.life <= 0) {
          this.texts.splice(i, 1);
          continue;
        }
        text.y -= 46 * dt;
      }

      if (this.shakeAmount > 0) {
        this.shakeAmount = Math.max(0, this.shakeAmount - dt * 34);
      }
    }

    /** Random camera offset used by screen shake. */
    get offset() {
      if (this.shakeAmount <= 0.01) return { x: 0, y: 0 };
      return { x: rand(-this.shakeAmount, this.shakeAmount), y: rand(-this.shakeAmount, this.shakeAmount) };
    }

    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (const particle of this.particles) {
        const alpha = clamp(particle.life / particle.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        const size = particle.size * (0.4 + alpha * 0.6);
        ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
      }

      ctx.lineCap = "round";
      for (const ring of this.rings) {
        const alpha = clamp(ring.life / ring.maxLife, 0, 1);
        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = ring.width * alpha + 0.6;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, TAU);
        ctx.stroke();
      }

      ctx.restore();

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const text of this.texts) {
        const alpha = clamp(text.life / text.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = text.color;
        ctx.font = `700 ${text.size}px ${NV.FONT_MONO}`;
        ctx.fillText(text.value, text.x, text.y);
      }
      ctx.restore();
    }
  }

  NV.Effects = Effects;
})(window);
