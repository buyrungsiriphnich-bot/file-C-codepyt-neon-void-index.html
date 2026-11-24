/* ===========================================================
   enemies.js — the swarm: drones, weavers, tanks
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;
  const { rand, clamp, TAU } = NV.math;
  const WORLD = NV.WORLD;

  const TYPES = {
    drone: {
      hp: 2, radius: 16, speed: 104, score: 10,
      color: NV.COLORS.magenta, contactDamage: 1,
      fireRate: [1.7, 2.6], bulletSpeed: 250, shape: "diamond",
    },
    weaver: {
      hp: 3, radius: 14, speed: 158, score: 16,
      color: NV.COLORS.amber, contactDamage: 1,
      fireRate: [1.5, 2.2], bulletSpeed: 285, shape: "arrow",
    },
    tank: {
      hp: 10, radius: 27, speed: 62, score: 45,
      color: NV.COLORS.danger, contactDamage: 1,
      fireRate: [1.9, 2.6], bulletSpeed: 235, shape: "hex",
    },
  };

  class Enemy {
    constructor(type, options) {
      const config = TYPES[type];
      this.type = type;
      this.config = config;
      this.x = options.x;
      this.originX = options.x;
      this.y = options.y !== undefined ? options.y : -40;
      this.phase = rand(0, TAU);
      this.t = 0;
      this.radius = config.radius;
      this.maxHp = Math.max(1, Math.round(config.hp * (options.hpScale || 1)));
      this.hp = this.maxHp;
      this.color = config.color;
      this.score = config.score;
      this.contactDamage = config.contactDamage;
      this.fireTimer = rand(0.7, 1.6);
      this.burstLeft = 0;
      this.burstTimer = 0;
      this.flash = 0;
      this.dead = false;
      this.escaped = false;
      this.targetY = options.targetY || rand(150, 300);
      this.aimDelay = config.fireRate[0];
      this.aimRange = config.fireRate[1];
    }

    update(dt, game) {
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt * 4);

      if (this.type === "drone") {
        this.y += this.config.speed * dt;
        this.x = this.originX + Math.sin(this.t * 1.9 + this.phase) * 74;
      } else if (this.type === "weaver") {
        this.y += this.config.speed * dt;
        this.x = this.originX + Math.sin(this.t * 3.4 + this.phase) * 132;
      } else {
        if (this.y < this.targetY) {
          this.y += this.config.speed * dt;
        } else {
          this.x = this.originX + Math.sin(this.t * 0.9 + this.phase) * 158;
        }
      }

      this.x = clamp(this.x, this.radius + 12, WORLD.width - this.radius - 12);

      this.updateWeapon(dt, game);

      if (this.y > WORLD.height + 50) {
        this.dead = true;
        this.escaped = true;
      }
    }

    updateWeapon(dt, game) {
      if (this.burstLeft > 0) {
        this.burstTimer -= dt;
        if (this.burstTimer <= 0) {
          this.burstTimer = 0.13;
          this.burstLeft -= 1;
          this.fireAimed(game);
        }
        return;
      }

      this.fireTimer -= dt;
      if (this.fireTimer > 0) return;
      this.fireTimer = rand(this.aimDelay, this.aimRange);

      if (this.type === "drone") {
        this.fireAimed(game);
      } else if (this.type === "weaver") {
        this.fireFan(game, 3, 0.24);
      } else {
        this.burstLeft = 3;
        this.burstTimer = 0;
      }
    }

    fireAimed(game) {
      const target = game.player;
      const direction = NV.aimAt(this.x, this.y + this.radius, target.x, target.y);
      const speed = this.config.bulletSpeed;
      game.enemyBullets.push(
        new NV.Bullet({
          x: this.x,
          y: this.y + this.radius * 0.6,
          vx: direction.x * speed,
          vy: direction.y * speed,
          radius: 5,
          color: this.color,
          friendly: false,
        })
      );
      game.audio.enemyShoot();
    }

    fireFan(game, count, spread) {
      const target = game.player;
      const direction = NV.aimAt(this.x, this.y + this.radius, target.x, target.y);
      const base = Math.atan2(direction.y, direction.x);
      const speed = this.config.bulletSpeed;
      for (let i = 0; i < count; i += 1) {
        const angle = base + (i - (count - 1) / 2) * spread;
        game.enemyBullets.push(
          new NV.Bullet({
            x: this.x,
            y: this.y + this.radius * 0.5,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 4.5,
            color: this.color,
            friendly: false,
          })
        );
      }
      game.audio.enemyShoot();
    }

    /** Returns true when this hit destroyed the enemy. */
    hit(amount) {
      this.hp -= amount;
      this.flash = 1;
      if (this.hp <= 0) {
        this.dead = true;
        return true;
      }
      return false;
    }

    draw(ctx, time) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const pulse = 1 + Math.sin(time * 4 + this.phase) * 0.04;
      ctx.scale(pulse, pulse);

      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = this.color;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 1.7, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      ctx.lineWidth = 2;
      ctx.strokeStyle = this.flash > 0.4 ? "#ffffff" : this.color;
      ctx.fillStyle = this.flash > 0.4 ? "rgba(255,255,255,0.85)" : "rgba(8,12,24,0.92)";
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;

      if (this.type === "drone") {
        this.tracePolygon(ctx, 4, this.radius, Math.PI / 4 + time * 0.9);
      } else if (this.type === "weaver") {
        this.tracePolygon(ctx, 3, this.radius * 1.15, Math.PI / 2 + Math.sin(time * 3 + this.phase) * 0.25);
      } else {
        this.tracePolygon(ctx, 6, this.radius, time * 0.5);
      }

      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = this.color;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.45, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (this.maxHp > 4 && this.hp < this.maxHp) this.drawHealth(ctx);
      ctx.restore();
    }

    tracePolygon(ctx, sides, radius, rotation) {
      ctx.beginPath();
      for (let i = 0; i < sides; i += 1) {
        const angle = rotation + (i / sides) * TAU;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }

    drawHealth(ctx) {
      const ratio = clamp(this.hp / this.maxHp, 0, 1);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, -Math.PI * 0.75, Math.PI * 0.75);
      ctx.stroke();
      ctx.strokeStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, -Math.PI * 0.75, -Math.PI * 0.75 + Math.PI * 1.5 * ratio);
      ctx.stroke();
    }
  }

  NV.Enemy = Enemy;
  NV.ENEMY_TYPES = TYPES;
})(window);
