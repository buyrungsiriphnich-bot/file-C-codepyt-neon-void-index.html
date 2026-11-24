/* ===========================================================
   hud.js — DOM HUD, banners, screens (title / pause / game over)
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;
  const { clamp } = NV.math;
  const SHIP_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.6l2.7 8.2 7.3 4.6-7.6 1.5-2.4 6.5-2.4-6.5L2 14.4l7.3-4.6z"/></svg>';

  class Hud {
    constructor() {
      this.stage = document.getElementById("stage");
      this.root = document.getElementById("hud");
      this.scoreEl = document.getElementById("scoreValue");
      this.bestEl = document.getElementById("bestValue");
      this.waveEl = document.getElementById("waveValue");
      this.comboEl = document.getElementById("comboTag");
      this.livesEl = document.getElementById("lives");
      this.bossBar = document.getElementById("bossBar");
      this.bossFill = document.getElementById("bossFill");
      this.bannerEl = document.getElementById("banner");
      this.muteBtn = document.getElementById("muteBtn");
      this.pauseBtn = document.getElementById("pauseBtn");

      this.screens = {
        title: document.getElementById("titleScreen"),
        pause: document.getElementById("pauseScreen"),
        over: document.getElementById("overScreen"),
      };

      this.overScore = document.getElementById("overScore");
      this.overWave = document.getElementById("overWave");
      this.overBest = document.getElementById("overBest");
      this.titleBest = document.getElementById("titleBest");
      this.newRecord = document.getElementById("newRecord");

      this.displayScore = 0;
      this.targetScore = 0;
      this.bannerTimer = 0;
      this.pickupTimer = 0;
      this.livesKey = "";
    }

    /* ---------------- numbers ---------------- */

    setScore(value) {
      this.targetScore = value;
    }

    update(dt) {
      if (Math.abs(this.targetScore - this.displayScore) > 0.5) {
        this.displayScore += (this.targetScore - this.displayScore) * clamp(dt * 14, 0, 1);
        this.scoreEl.textContent = NV.math.formatNumber(this.displayScore);
      } else if (this.displayScore !== this.targetScore) {
        this.displayScore = this.targetScore;
        this.scoreEl.textContent = NV.math.formatNumber(this.displayScore);
      }

      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        if (this.bannerTimer <= 0) this.bannerEl.classList.remove("is-on");
      }

      if (this.pickupTimer > 0) {
        this.pickupTimer -= dt;
        if (this.pickupTimer <= 0) this.pickupEl.classList.remove("is-on");
      }
    }

    setBest(value) {
      const text = NV.math.formatNumber(value);
      this.bestEl.textContent = text;
      this.titleBest.textContent = text;
      this.overBest.textContent = text;
    }

    setWave(value) {
      this.waveEl.textContent = String(value);
    }

    setCombo(multiplier) {
      const on = multiplier > 1;
      this.comboEl.textContent = `×${multiplier}`;
      this.comboEl.classList.toggle("is-on", on);
    }

    /* ---------------- lives ---------------- */

    setLives(hp, maxHp, shield) {
      const key = `${hp}:${maxHp}:${shield}`;
      if (key === this.livesKey) return;
      this.livesKey = key;

      let markup = "";
      for (let i = 0; i < maxHp; i += 1) {
        markup += `<span class="life${i < hp ? "" : " is-lost"}">${SHIP_SVG}</span>`;
      }
      for (let i = 0; i < shield; i += 1) {
        markup += '<span class="shield-pip"></span>';
      }
      this.livesEl.innerHTML = markup;
    }

    /* ---------------- boss bar ---------------- */

    showBoss(ratio) {
      this.bossBar.classList.add("is-visible");
      this.bossFill.style.width = `${clamp(ratio, 0, 1) * 100}%`;
    }

    hideBoss() {
      this.bossBar.classList.remove("is-visible");
    }

    /* ---------------- callouts ---------------- */

    banner(text, options = {}) {
      const { duration = 1.6, danger = false } = options;
      this.bannerEl.textContent = text;
      this.bannerEl.classList.toggle("is-danger", danger);
      this.bannerEl.classList.add("is-on");
      this.bannerTimer = duration;
    }

    flashPickup(label, color) {
      if (!this.pickupEl) this.createPickupEl();
      this.pickupEl.textContent = label;
      this.pickupEl.style.color = color;
      this.pickupEl.style.textShadow = `0 0 18px ${color}`;
      this.pickupEl.classList.add("is-on");
      this.pickupTimer = 1.1;
    }

    createPickupEl() {
      const el = document.createElement("div");
      el.className = "pickup-toast";
      this.root.appendChild(el);
      this.pickupEl = el;
    }

    /* ---------------- screens ---------------- */

    showScreen(name) {
      Object.entries(this.screens).forEach(([key, el]) => {
        el.classList.toggle("is-visible", key === name);
      });

      this.stage.classList.toggle("is-title", name === "title");
      this.stage.classList.toggle("is-paused", name === "pause");
      this.stage.classList.toggle("is-over", name === "over");
      this.root.classList.toggle("is-live", name === null || name === "pause");
    }

    showGameOver(score, wave, best, isRecord) {
      this.overScore.textContent = NV.math.formatNumber(score);
      this.overWave.textContent = String(wave);
      this.overBest.textContent = NV.math.formatNumber(best);
      this.newRecord.classList.toggle("is-on", isRecord);
      this.showScreen("over");
      this.hideBoss();
    }

    setMuted(muted) {
      this.muteBtn.classList.toggle("is-muted", muted);
      this.muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    }

    setPaused(paused) {
      this.pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
    }
  }

  NV.Hud = Hud;
})(window);
