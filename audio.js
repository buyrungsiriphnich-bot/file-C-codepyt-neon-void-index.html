/* ===========================================================
   audio.js — tiny WebAudio synth (no external assets)
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noiseBuffer = null;
      this.muted = false;
      this.volume = 0.5;
    }

    /** Must be called from a user gesture (click/keydown) to unlock audio. */
    unlock() {
      if (!this.ctx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.ctx.destination);
        this.noiseBuffer = this.createNoiseBuffer();
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    }

    createNoiseBuffer() {
      const length = Math.floor(this.ctx.sampleRate * 0.7);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    }

    setMuted(muted) {
      this.muted = muted;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
      }
    }

    get ready() {
      return Boolean(this.ctx) && this.ctx.state === "running" && !this.muted;
    }

    /* ---------- primitives ---------- */

    tone({ freq, freqEnd, type = "square", duration = 0.12, gain = 0.08, delay = 0 }) {
      if (!this.ready) return;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (freqEnd && freqEnd !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
      }
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(gain, now + Math.min(0.012, duration * 0.4));
      env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(env).connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    noise({ duration = 0.3, gain = 0.2, cutoff = 1400, sweep = 220, delay = 0 }) {
      if (!this.ready) return;
      const now = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(cutoff, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, sweep), now + duration);
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(gain, now);
      env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      src.connect(filter).connect(env).connect(this.master);
      src.start(now);
      src.stop(now + duration + 0.02);
    }

    /* ---------- game sounds ---------- */

    shoot() {
      this.tone({ freq: 1180, freqEnd: 640, type: "square", duration: 0.055, gain: 0.026 });
    }

    enemyShoot() {
      this.tone({ freq: 320, freqEnd: 200, type: "sawtooth", duration: 0.1, gain: 0.02 });
    }

    hit() {
      this.tone({ freq: 420, freqEnd: 210, type: "triangle", duration: 0.06, gain: 0.045 });
    }

    explode(size = 1) {
      const amount = NV.math.clamp(size, 0.5, 2.4);
      this.noise({ duration: 0.16 + amount * 0.16, gain: 0.11 * amount, cutoff: 1800, sweep: 180 });
      this.tone({ freq: 160 * amount, freqEnd: 40, type: "sine", duration: 0.28 * amount, gain: 0.09 * amount });
    }

    powerup() {
      this.tone({ freq: 620, type: "triangle", duration: 0.09, gain: 0.07 });
      this.tone({ freq: 930, type: "triangle", duration: 0.09, gain: 0.07, delay: 0.08 });
      this.tone({ freq: 1240, type: "triangle", duration: 0.14, gain: 0.06, delay: 0.16 });
    }

    playerHit() {
      this.tone({ freq: 240, freqEnd: 60, type: "sawtooth", duration: 0.4, gain: 0.11 });
      this.noise({ duration: 0.3, gain: 0.15, cutoff: 900, sweep: 100 });
    }

    shieldBreak() {
      this.tone({ freq: 900, freqEnd: 1500, type: "sine", duration: 0.18, gain: 0.09 });
      this.noise({ duration: 0.2, gain: 0.07, cutoff: 3200, sweep: 600 });
    }

    waveClear() {
      const notes = [523, 659, 784];
      notes.forEach((freq, index) => {
        this.tone({ freq, type: "triangle", duration: 0.16, gain: 0.055, delay: index * 0.09 });
      });
    }

    bossAlarm() {
      [0, 0.22].forEach((delay) => {
        this.tone({ freq: 180, freqEnd: 320, type: "sawtooth", duration: 0.2, gain: 0.085, delay });
      });
    }

    gameOver() {
      const notes = [392, 311, 233, 155];
      notes.forEach((freq, index) => {
        this.tone({ freq, freqEnd: freq * 0.85, type: "triangle", duration: 0.34, gain: 0.085, delay: index * 0.16 });
      });
      this.noise({ duration: 0.8, gain: 0.09, cutoff: 1200, sweep: 60 });
    }
  }

  NV.SoundEngine = SoundEngine;
})(window);
