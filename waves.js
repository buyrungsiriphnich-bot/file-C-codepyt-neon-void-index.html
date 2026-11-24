/* ===========================================================
   waves.js — spawn director: wave composition and pacing
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;
  const { clamp, rand, randInt } = NV.math;
  const WORLD = NV.WORLD;

  const COLUMNS = 6;
  const COLUMN_PADDING = 90;
  const MAX_ENEMIES_PER_WAVE = 20;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  /** Builds the spawn schedule for a regular (non-boss) wave. */
  function buildWave(wave) {
    const hpScale = 1 + (wave - 1) * 0.13;
    const types = [];

    const droneCount = clamp(4 + Math.ceil(wave * 1.2), 4, 14);
    const weaverCount = wave >= 2 ? clamp(Math.floor(wave * 0.7), 1, 7) : 0;
    const tankCount = wave >= 3 ? clamp(Math.floor((wave - 1) / 2), 1, 3) : 0;

    for (let i = 0; i < droneCount; i += 1) types.push("drone");
    for (let i = 0; i < weaverCount; i += 1) types.push("weaver");
    for (let i = 0; i < tankCount; i += 1) types.push("tank");
    shuffle(types);

    const total = Math.min(types.length, MAX_ENEMIES_PER_WAVE);
    const gap = clamp(5.5 / total, 0.24, 0.52);
    const span = WORLD.width - COLUMN_PADDING * 2;

    return types.slice(0, total).map((type, index) => {
      const column = (index * 3) % COLUMNS;
      const x = COLUMN_PADDING + (column / (COLUMNS - 1)) * span + rand(-24, 24);
      return {
        type,
        x: clamp(x, 60, WORLD.width - 60),
        at: 0.7 + index * gap,
        hpScale,
        targetY: type === "tank" ? rand(170, 300) : rand(150, 330),
      };
    });
  }

  class WaveDirector {
    constructor() {
      this.reset();
    }

    reset() {
      this.wave = 0;
      this.state = "countdown";
      this.timer = 1.6;
      this.queue = [];
      this.elapsed = 0;
    }

    static isBossWave(wave) {
      return wave % NV.TUNING.bossEvery === 0;
    }

    update(dt, game) {
      if (this.state === "countdown") {
        this.timer -= dt;
        if (this.timer <= 0) this.beginWave(game);
        return;
      }

      if (this.state === "spawning") {
        this.elapsed += dt;
        while (this.queue.length > 0 && this.queue[0].at <= this.elapsed) {
          const spawn = this.queue.shift();
          game.enemies.push(
            new NV.Enemy(spawn.type, { x: spawn.x, hpScale: spawn.hpScale, targetY: spawn.targetY })
          );
        }
        if (this.queue.length === 0 && game.enemies.length === 0) this.completeWave(game);
        return;
      }

      if (this.state === "boss" && !game.boss) {
        this.completeWave(game);
      }
    }

    beginWave(game) {
      this.wave += 1;
      const isBoss = WaveDirector.isBossWave(this.wave);
      game.onWaveStart(this.wave, isBoss);

      if (isBoss) {
        game.spawnBoss(this.wave);
        this.state = "boss";
        return;
      }

      this.queue = buildWave(this.wave);
      this.elapsed = 0;
      this.state = "spawning";
    }

    completeWave(game) {
      this.state = "countdown";
      this.timer = randInt(2, 2) + 0.4;
      game.onWaveCleared(this.wave);
    }
  }

  NV.WaveDirector = WaveDirector;
  NV.buildWave = buildWave;
})(window);
