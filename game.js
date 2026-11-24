/* ===========================================================
   game.js — state machine, update loop, collisions, rendering
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;
  const { clamp, rand, TAU } = NV.math;
  const T = NV.TUNING;
  const WORLD = NV.WORLD;

  const STATE = Object.freeze({
    TITLE: "title",
    PLAYING: "playing",
    PAUSED: "paused",
    OVER: "over",
  });

  const MAX_DT = 0.05;
  const WAVE_CLEAR_BONUS = 60;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.audio = new NV.SoundEngine();
      this.input = new NV.Input(canvas);
      this.hud = new NV.Hud();
      this.starfield = new NV.Starfield(WORLD.width, WORLD.height);
      this.effects = new NV.Effects();
      this.waves = new NV.WaveDirector();
      this.player = new NV.Player();

      this.playerBullets = [];
      this.enemyBullets = [];
      this.enemies = [];
      this.powerups = [];
      this.boss = null;

      this.state = STATE.TITLE;
      this.time = 0;
      this.score = 0;
      this.best = NV.storage.readBest();
      this.combo = 0;
      this.comboTimer = 0;
      this.multiplier = 1;
      this.damageFlash = 0;
      this.pendingOver = 0;
      this.lastTime = 0;
      this.scaleX = 1;
      this.scaleY = 1;

      this.resize();
      this.bindEvents();
      this.hud.setBest(this.best);
      this.hud.setWave(1);
      this.hud.showScreen("title");
      this.loop = this.loop.bind(this);
      global.requestAnimationFrame(this.loop);
    }

    bindEvents() {
      global.addEventListener("resize", () => this.resize());
      global.addEventListener("orientationchange", () => this.resize());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && this.state === STATE.PLAYING) this.pause();
      });
      this.input.onKey((event) => this.onKeyDown(event));
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.scaleX = width / WORLD.width;
      this.scaleY = height / WORLD.height;
    }

    onKeyDown(event) {
      if (event.repeat) return;
      const code = event.code;

      if (code === "Enter" || code === "Space") {
        if (this.state === STATE.TITLE || this.state === STATE.OVER) {
          event.preventDefault();
          this.start();
          return;
        }
      }

      if (code === "KeyR") {
        if (this.state === STATE.PAUSED || this.state === STATE.OVER || this.state === STATE.PLAYING) {
          this.restart();
          return;
        }
      }

      if (code === "KeyP" || code === "Escape") {
        if (this.state === STATE.PLAYING || this.state === STATE.PAUSED) {
          event.preventDefault();
          this.togglePause();
        }
        return;
      }

      if (code === "KeyM") {
        this.toggleMute();
      }
    }

    /* ---------------- main loop ---------------- */

    loop(timestamp) {
      global.requestAnimationFrame(this.loop);
      if (!this.lastTime) this.lastTime = timestamp;
      const dt = clamp((timestamp - this.lastTime) / 1000, 0, MAX_DT);
      this.lastTime = timestamp;
      this.tick(dt);
      this.render();
    }

    tick(dt) {
      this.time += dt;
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);

      if (this.state === STATE.PLAYING) {
        this.starfield.update(dt, 1);
        this.updatePlaying(dt);
      } else if (this.state === STATE.OVER) {
        this.starfield.update(dt, 0.35);
        this.effects.update(dt);
      } else {
        this.starfield.update(dt, 0.3);
      }

      this.hud.update(dt);
    }

    updatePlaying(dt) {
      if (this.pendingOver > 0) {
        this.pendingOver -= dt;
        this.effects.update(dt);
        this.updateEntityTimers(dt);
        if (this.pendingOver <= 0) this.finishGameOver();
        return;
      }

      this.player.update(dt, this);
      this.waves.update(dt, this);

      for (const enemy of this.enemies) enemy.update(dt, this);
      if (this.boss) this.boss.update(dt, this);

      this.updateBullets(dt);
      this.resolveCollisions();
      this.collectDeaths();
      this.updatePowerups(dt);
      this.updateCombo(dt);
      this.effects.update(dt);
      this.syncHud();
    }

    /** Keeps bullets/effects alive during the death cinematic. */
    updateEntityTimers(dt) {
      for (const bullet of this.enemyBullets) bullet.update(dt);
      for (const enemy of this.enemies) enemy.update(dt, this);
      if (this.boss) this.boss.update(dt, this);
      this.resolveBulletHitsOnPlayer();
      this.enemyBullets = this.enemyBullets.filter((bullet) => !bullet.dead);
    }

    updateBullets(dt) {
      for (const bullet of this.playerBullets) bullet.update(dt);
      for (const bullet of this.enemyBullets) bullet.update(dt);
    }

    updatePowerups(dt) {
      for (const powerup of this.powerups) {
        powerup.update(dt, this);
        if (powerup.dead) continue;
        if (!this.player.alive) continue;
        const reach = powerup.radius + this.player.radius + 10;
        if (NV.math.hits(powerup.x, powerup.y, powerup.radius, this.player.x, this.player.y, reach)) {
          powerup.apply(this.player, this);
        }
      }
    }

    updateCombo(dt) {
      if (this.comboTimer <= 0) return;
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.multiplier = 1;
        this.hud.setCombo(1);
      }
    }

    /* ---------------- collisions ---------------- */

    resolveCollisions() {
      this.resolvePlayerShots();
      this.resolveBulletHitsOnPlayer();
      this.resolveEnemyContact();
    }

    resolvePlayerShots() {
      for (const bullet of this.playerBullets) {
        if (bullet.dead) continue;

        if (this.boss && !this.boss.entering) {
          if (NV.math.hits(bullet.x, bullet.y, bullet.radius, this.boss.x, this.boss.y, this.boss.radius)) {
            bullet.dead = true;
            this.damageBoss(this.boss, bullet.damage);
            continue;
          }
        }

        for (const enemy of this.enemies) {
          if (enemy.dead) continue;
          if (NV.math.hits(bullet.x, bullet.y, bullet.radius, enemy.x, enemy.y, enemy.radius)) {
            bullet.dead = true;
            this.damageEnemy(enemy, bullet.damage);
            break;
          }
        }
      }
    }

    resolveBulletHitsOnPlayer() {
      if (!this.player.alive) return;
      for (const bullet of this.enemyBullets) {
        if (bullet.dead) continue;
        if (NV.math.hits(bullet.x, bullet.y, bullet.radius, this.player.x, this.player.y, this.player.radius + 4)) {
          bullet.dead = true;
          if (!this.player.takeHit(this)) this.onPlayerDeath();
        }
      }
    }

    resolveEnemyContact() {
      if (!this.player.alive) return;

      if (this.boss && !this.boss.entering) {
        if (NV.math.hits(this.boss.x, this.boss.y, this.boss.radius * 0.8, this.player.x, this.player.y, this.player.radius)) {
          if (!this.player.takeHit(this)) this.onPlayerDeath();
          return;
        }
      }

      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        if (NV.math.hits(enemy.x, enemy.y, enemy.radius * 0.85, this.player.x, this.player.y, this.player.radius)) {
          this.damageEnemy(enemy, 999);
          if (!this.player.takeHit(this)) this.onPlayerDeath();
          return;
        }
      }
    }

    damageEnemy(enemy, amount) {
      const killed = enemy.hit(amount);
      if (!killed) {
        this.audio.hit();
        this.effects.burst(enemy.x, enemy.y, {
          count: 3,
          color: enemy.color,
          speed: 160,
          life: 0.25,
          size: 2,
        });
      }
    }

    damageBoss(boss, amount) {
      const killed = boss.hit(amount);
      this.audio.hit();
      this.effects.burst(boss.x + rand(-30, 30), boss.y + rand(-30, 30), {
        count: 3,
        color: NV.COLORS.amber,
        speed: 180,
        life: 0.28,
        size: 2.2,
      });
      if (killed) this.rewardBoss();
    }

    collectDeaths() {
      for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = this.enemies[i];
        if (!enemy.dead) continue;
        this.enemies.splice(i, 1);
        if (!enemy.escaped) this.rewardKill(enemy);
      }

      this.playerBullets = this.playerBullets.filter((bullet) => !bullet.dead);
      this.enemyBullets = this.enemyBullets.filter((bullet) => !bullet.dead);
      this.powerups = this.powerups.filter((powerup) => !powerup.dead);
    }

    rewardKill(enemy) {
      const size = enemy.type === "tank" ? 1.7 : 1;
      this.audio.explode(size);
      this.effects.burst(enemy.x, enemy.y, { count: 16, color: enemy.color, speed: 260, life: 0.7 });
      this.effects.burst(enemy.x, enemy.y, { count: 8, color: NV.COLORS.ice, speed: 140, life: 0.4, size: 2 });
      this.effects.ring(enemy.x, enemy.y, { color: enemy.color, to: enemy.radius * 4, life: 0.4, width: 2.5 });
      this.effects.shake(enemy.type === "tank" ? 8 : 3);
      this.registerKill(enemy.score, enemy.x, enemy.y);
      this.rollPowerup(enemy.x, enemy.y);
    }

    rewardBoss() {
      const boss = this.boss;
      if (!boss) return;
      this.boss = null;
      this.hud.hideBoss();

      this.audio.explode(2.4);
      this.effects.shake(30);
      this.effects.ring(boss.x, boss.y, { color: NV.COLORS.magenta, to: 420, life: 1, width: 6 });
      this.effects.ring(boss.x, boss.y, { color: NV.COLORS.amber, to: 300, life: 0.8, width: 4 });
      for (let i = 0; i < 4; i += 1) {
        const offsetX = rand(-60, 60);
        const offsetY = rand(-60, 60);
        this.effects.burst(boss.x + offsetX, boss.y + offsetY, {
          count: 22,
          color: i % 2 === 0 ? NV.COLORS.magenta : NV.COLORS.amber,
          speed: 340,
          life: 1,
        });
      }

      this.registerKill(boss.score, boss.x, boss.y);

      const types = ["spread", "rapid", "shield"];
      types.forEach((type, index) => {
        this.powerups.push(new NV.Powerup(type, boss.x + (index - 1) * 60, boss.y + 20));
      });
    }

    rollPowerup(x, y) {
      const type = NV.rollDrop(T.powerupDropChance);
      if (type) this.powerups.push(new NV.Powerup(type, x, y));
    }

    registerKill(baseScore, x, y) {
      this.combo += 1;
      this.comboTimer = T.comboWindow;
      this.multiplier = clamp(1 + Math.floor(this.combo / T.comboPerStep), 1, T.maxMultiplier);
      const gained = baseScore * this.multiplier;
      this.score += gained;
      this.effects.text(x, y - 14, `+${gained}`, {
        color: this.multiplier > 1 ? NV.COLORS.amber : NV.COLORS.ice,
        size: this.multiplier > 1 ? 18 : 15,
      });
      this.hud.setCombo(this.multiplier);
      this.hud.setScore(this.score);
    }

    syncHud() {
      this.hud.setScore(this.score);
      this.hud.setLives(this.player.hp, T.playerHp, this.player.shield);

      if (this.boss) {
        this.hud.showBoss(this.boss.hpRatio);
        this.bossBarShown = true;
      } else if (this.bossBarShown) {
        this.hud.hideBoss();
        this.bossBarShown = false;
      }
    }

    /* ---------------- run control ---------------- */

    start() {
      if (this.state === STATE.PLAYING) return;
      this.audio.unlock();
      this.resetRun();
      this.state = STATE.PLAYING;
      this.hud.showScreen(null);
      this.hud.setPaused(false);
    }

    restart() {
      this.audio.unlock();
      this.resetRun();
      this.state = STATE.PLAYING;
      this.hud.showScreen(null);
      this.hud.setPaused(false);
    }

    resetRun() {
      this.score = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.multiplier = 1;
      this.damageFlash = 0;
      this.pendingOver = 0;
      this.boss = null;
      this.bossBarShown = false;
      this.playerBullets.length = 0;
      this.enemyBullets.length = 0;
      this.enemies.length = 0;
      this.powerups.length = 0;

      this.player.reset();
      this.waves.reset();
      this.effects.clear();
      this.input.resetPointerTarget(this.player.x, this.player.y);

      this.hud.setScore(0);
      this.hud.setCombo(1);
      this.hud.setWave(1);
      this.hud.setBest(this.best);
      this.hud.setLives(this.player.hp, T.playerHp, this.player.shield);
      this.hud.hideBoss();
    }

    pause() {
      if (this.state !== STATE.PLAYING) return;
      this.state = STATE.PAUSED;
      this.hud.showScreen("pause");
      this.hud.setPaused(true);
    }

    togglePause() {
      if (this.state === STATE.PLAYING) {
        this.pause();
      } else if (this.state === STATE.PAUSED) {
        this.state = STATE.PLAYING;
        this.hud.showScreen(null);
        this.hud.setPaused(false);
      }
    }

    toggleMute() {
      this.audio.unlock();
      this.audio.setMuted(!this.audio.muted);
      this.hud.setMuted(this.audio.muted);
    }

    /* ---------------- wave callbacks ---------------- */

    onWaveStart(wave, isBoss) {
      this.hud.setWave(wave);
      if (isBoss) {
        this.audio.bossAlarm();
        this.hud.banner("WARNING", { danger: true, duration: 1.9 });
      } else {
        this.hud.banner(`WAVE ${wave}`, { duration: 1.3 });
      }
    }

    onWaveCleared(wave) {
      const bonus = WAVE_CLEAR_BONUS * wave;
      this.score += bonus;
      this.hud.setScore(this.score);
      this.effects.text(WORLD.width / 2, WORLD.height * 0.42, `WAVE CLEAR +${bonus}`, {
        color: NV.COLORS.lime,
        size: 24,
        life: 1.5,
      });
      this.audio.waveClear();
    }

    spawnBoss(wave) {
      this.boss = new NV.Boss(wave);
      this.bossBarShown = true;
      this.hud.showBoss(1);
    }

    /* ---------------- death ---------------- */

    onPlayerDeath() {
      if (this.pendingOver > 0) return;
      this.pendingOver = 1.3;
      this.damageFlash = 1;
      this.audio.gameOver();
      this.effects.shake(28);
      this.effects.ring(this.player.x, this.player.y, { color: NV.COLORS.danger, to: 320, life: 1, width: 5 });
      this.effects.burst(this.player.x, this.player.y, {
        count: 42, color: NV.COLORS.danger, speed: 420, life: 1.1,
      });
      this.effects.burst(this.player.x, this.player.y, {
        count: 24, color: NV.COLORS.amber, speed: 260, life: 0.8,
      });
    }

    finishGameOver() {
      this.state = STATE.OVER;
      const isRecord = this.score > this.best;
      if (isRecord) {
        this.best = this.score;
        NV.storage.writeBest(this.best);
      }
      this.hud.setBest(this.best);
      this.hud.setCombo(1);
      this.hud.showGameOver(this.score, this.waves.wave, this.best, isRecord);
    }

    /* ---------------- rendering ---------------- */

    render() {
      const ctx = this.ctx;
      ctx.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      this.starfield.draw(ctx, this.time);

      const offset = this.effects.offset;
      ctx.save();
      ctx.translate(offset.x, offset.y);

      for (const powerup of this.powerups) powerup.draw(ctx, this.time);
      for (const enemy of this.enemies) enemy.draw(ctx, this.time);
      if (this.boss) this.boss.draw(ctx, this.time);
      for (const bullet of this.enemyBullets) bullet.draw(ctx);
      for (const bullet of this.playerBullets) bullet.draw(ctx);
      this.player.draw(ctx, this.time);
      this.effects.draw(ctx);

      ctx.restore();
      this.drawDamageVignette(ctx);
    }

    drawDamageVignette(ctx) {
      if (this.damageFlash <= 0.01) return;
      const cx = WORLD.width / 2;
      const cy = WORLD.height / 2;
      const gradient = ctx.createRadialGradient(cx, cy, WORLD.height * 0.2, cx, cy, WORLD.height * 0.8);
      gradient.addColorStop(0, "rgba(255, 71, 87, 0)");
      gradient.addColorStop(1, `rgba(255, 71, 87, ${0.6 * this.damageFlash})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    }
  }

  NV.Game = Game;
  NV.STATE = STATE;
})(window);
