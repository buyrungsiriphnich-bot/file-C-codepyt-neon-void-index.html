/* ===========================================================
   boss.js — the Void Sentinel, one per fifth wave
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;
  const { rand, clamp, TAU } = NV.math;
  const WORLD = NV.WORLD;

  const HOME_Y = 132;
  const PATTERNS = ["radial", "aimed", "spiral"];

  class Boss {
    constructor(wave) {
      this.wave = wave;
      this.x = WORLD.width / 2;
      this.y = -120;
      this.baseX = WORLD.width / 2;
      this.radius = 66;
      this.maxHp = 210 + wave * 46;
      this.hp = this.maxHp;
      this.color = NV.COLORS.magenta;
      this.score = 400 + wave * 90;
      this.contactDamage = 1;
      this.dead = false;
      this.escaped = false;
      this.isBoss = true;
      this.t = 0;
      this.flash = 0;
      this.entering = true;
      this.patternIndex = 0;
      this.patternTimer = 1.4;
      this.shotsLeft = 0;
      this.shotTimer = 0;
      this.spin = 0;
      this.drift = rand(0, TAU);
    }

    get hpRatio() {
      return clamp(this.hp / this.maxHp, 0, 1);
    }

    update(dt, game) {
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt * 3.5);
      this.spin += dt * 0.8;

      if (this.entering) {
        this.y += 90 * dt;
        if (this.y >= HOME_Y) {
          this.y = HOME_Y;
          this.entering = false;
        }
      } else {
        this.x = this.baseX + Math.sin(this.t * 0.6 + this.drift) * (WORLD.width * 0.28);
      }

      this.updateWeapon(dt, game);
    }

    updateWeapon(dt, game) {
      this.patternTimer -= dt;

      if (this.shotsLeft > 0) {
        this.shotTimer -= dt;
        if (this.shotTimer <= 0) {
          this.shotTimer = 0.14;
          this.shotsLeft -= 1;
          this.fireAimed(game, 3, 0.2);
        }
        return;
      }

      if (this.patternTimer > 0) return;

      const pattern = PATTERNS[this.patternIndex % PATTERNS.length];
      this.patternIndex += 1;

      if (pattern === "radial") {
        this.fireRadial(game, 14);
        this.patternTimer = 1.9;
      } else if (pattern === "aimed") {
        this.shotsLeft = 3;
        this.shotTimer = 0;
        this.patternTimer = 2.4;
      } else {
        this.fireSpiral(game);
        this.patternTimer = 1.5;
      }
    }

    fireRadial(game, count) {
      const offset = rand(0, TAU);
      for (let i = 0; i < count; i += 1) {
        const angle = offset + (i / count) * TAU;
        this.spawnBullet(game, angle, 215, 6, NV.COLORS.magenta);
      }
      game.audio.enemyShoot();
      game.effects.ring(this.x, this.y, { color: NV.COLORS.magenta, to: 120, life: 0.5, width: 3 });
    }

    fireSpiral(game) {
      const arms = 6;
      for (let i = 0; i < arms; i += 1) {
        const angle = this.spin * 2.2 + (i / arms) * TAU;
        this.spawnBullet(game, angle, 245, 5, NV.COLORS.amber);
      }
      game.audio.enemyShoot();
    }

    fireAimed(game, count, spread) {
      const target = game.player;
      const direction = NV.aimAt(this.x, this.y, target.x, target.y);
      const base = Math.atan2(direction.y, direction.x);
      for (let i = 0; i < count; i += 1) {
        const angle = base + (i - (count - 1) / 2) * spread;
        this.spawnBullet(game, angle, 300, 5, NV.COLORS.danger);
      }
      game.audio.enemyShoot();
    }

    spawnBullet(game, angle, speed, radius, color) {
      game.enemyBullets.push(
        new NV.Bullet({
          x: this.x + Math.cos(angle) * this.radius * 0.7,
          y: this.y + Math.sin(angle) * this.radius * 0.7,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius,
          color,
          friendly: false,
        })
      );
    }

    hit(amount) {
      if (this.entering) return false;
      this.hp -= amount;
      this.flash = 1;
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        return true;
      }
      return false;
    }

    draw(ctx, time) {
      ctx.save();
      ctx.translate(this.x, this.y);

      ctx.globalCompositeOperation = "lighter";
      const aura = ctx.createRadialGradient(0, 0, this.radius * 0.4, 0, 0, this.radius * 2.1);
      aura.addColorStop(0, "rgba(255,46,166,0.32)");
      aura.addColorStop(1, "rgba(255,46,166,0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 2.1, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      ctx.strokeStyle = this.flash > 0.4 ? "#ffffff" : NV.COLORS.magenta;
      ctx.lineWidth = 3;
      ctx.shadowColor = NV.COLORS.magenta;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.28, this.spin, this.spin + 2.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.28, this.spin + Math.PI, this.spin + Math.PI + 2.1);
      ctx.stroke();

      const points = 8;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i += 1) {
        const radius = i % 2 === 0 ? this.radius : this.radius * 0.52;
        const angle = -this.spin * 0.6 + (i / (points * 2)) * TAU;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = this.flash > 0.4 ? "rgba(255,255,255,0.9)" : "rgba(14,6,20,0.95)";
      ctx.fill();
      ctx.strokeStyle = this.flash > 0.4 ? "#ffffff" : NV.COLORS.amber;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const eyeGlow = 0.7 + Math.sin(time * 5) * 0.3;
      ctx.fillStyle = `rgba(255, 46, 166, ${eyeGlow})`;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = NV.COLORS.ice;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.12, 0, TAU);
      ctx.fill();

      ctx.restore();
    }
  }

  NV.Boss = Boss;
})(window);
