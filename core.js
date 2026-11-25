/* ===========================================================
   core.js — namespace, world constants, tuning, math helpers
   =========================================================== */
(function (global) {
  "use strict";

  const NV = (global.NV = global.NV || {});

  /** Logical playfield. Everything in the game is measured in these units. */
  NV.WORLD = Object.freeze({ width: 960, height: 640 });

  NV.COLORS = Object.freeze({
    void: "#05060e",
    cyan: "#22e8ff",
    magenta: "#ff2ea6",
    amber: "#ffc24d",
    lime: "#8dff5c",
    danger: "#ff4757",
    ice: "#eaf6ff",
  });

  /** Canvas font stacks, so type stays consistent across the art. */
  NV.FONT_DISPLAY = '"Bahnschrift", "Segoe UI", system-ui, sans-serif';
  NV.FONT_MONO = '"Consolas", "JetBrains Mono", ui-monospace, monospace';

  /** All gameplay numbers live here so balancing happens in one place. */
  NV.TUNING = Object.freeze({
    playerHp: 5,
    playerRadius: 11,
    playerSpeed: 540,
    playerAccel: 3800,
    playerFriction: 11,
    pointerSmoothing: 22,
    pointerTouchOffset: 54,

    invulnTime: 1.5,
    fireDelayBase: 0.155,
    fireDelayRapid: 0.08,
    bulletSpeed: 10000,
    bulletDamage: 10,

    spreadShotTime: 150,
    rapidShotTime: 130,
    maxShield: 30,

    comboWindow: 2.8,
    comboPerStep: 4,
    maxMultiplier: 6,

    powerupDropChance: 0.14,
    powerupFallSpeed: 78,
    powerupLifetime: 11,
    powerupRadius: 15,

    bossEvery: 5,
    margin: 46,
  });

  NV.STORAGE_KEY = "neonvoid.best";

  /* ---------------------------------------------------------
     Math helpers
     --------------------------------------------------------- */
  const TAU = Math.PI * 2;

  const math = {
    TAU,
    clamp: (value, min, max) => (value < min ? min : value > max ? max : value),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (min, max) => min + Math.random() * (max - min),
    randInt: (min, max) => Math.floor(min + Math.random() * (max - min + 1)),
    pick: (list) => list[Math.floor(Math.random() * list.length)],
    chance: (probability) => Math.random() < probability,
    /** Frame-rate independent smoothing factor for exponential lerps. */
    smooth: (speed, dt) => 1 - Math.exp(-speed * dt),
    dist2: (ax, ay, bx, by) => {
      const dx = ax - bx;
      const dy = ay - by;
      return dx * dx + dy * dy;
    },
    hits: (ax, ay, ar, bx, by, br) => {
      const r = ar + br;
      return math.dist2(ax, ay, bx, by) <= r * r;
    },
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    formatNumber: (value) => Math.round(value).toLocaleString("en-US"),
  };

  NV.math = math;

  /* ---------------------------------------------------------
     Persistence
     --------------------------------------------------------- */
  NV.storage = {
    readBest() {
      try {
        const raw = global.localStorage.getItem(NV.STORAGE_KEY);
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      } catch (error) {
        return 0;
      }
    },
    writeBest(value) {
      try {
        global.localStorage.setItem(NV.STORAGE_KEY, String(Math.round(value)));
      } catch (error) {
        /* storage may be unavailable (private mode / restricted profiles) */
      }
    },
  };
})(window);
