/* ===========================================================
   starfield.js — parallax star layers + baked nebula backdrop
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;
  const { rand } = NV.math;

  const LAYERS = [
    { count: 90, speed: 26, sizeMin: 0.6, sizeMax: 1.2, alpha: 0.35 },
    { count: 52, speed: 62, sizeMin: 1.0, sizeMax: 1.8, alpha: 0.6 },
    { count: 26, speed: 130, sizeMin: 1.4, sizeMax: 2.6, alpha: 0.9 },
  ];

  class Starfield {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.stars = [];
      this.build();
      this.nebula = this.buildNebula();
    }

    build() {
      this.stars = [];
      for (const layer of LAYERS) {
        for (let i = 0; i < layer.count; i += 1) {
          this.stars.push({
            x: rand(0, this.width),
            y: rand(0, this.height),
            size: rand(layer.sizeMin, layer.sizeMax),
            speed: layer.speed * rand(0.85, 1.15),
            alpha: layer.alpha * rand(0.7, 1),
            tint: rand(0, 1),
          });
        }
      }
    }

    /** Nebula clouds are expensive to build, so bake them once. */
    buildNebula() {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(this.width / 2);
      canvas.height = Math.round(this.height / 2);
      const ctx = canvas.getContext("2d");
      const blobs = [
        { x: 0.16, y: 0.12, r: 0.55, color: "34, 232, 255", alpha: 0.15 },
        { x: 0.86, y: 0.72, r: 0.62, color: "255, 46, 166", alpha: 0.13 },
        { x: 0.55, y: 0.99, r: 0.7, color: "34, 232, 255", alpha: 0.06 },
        { x: 0.42, y: 0.45, r: 0.4, color: "141, 255, 92", alpha: 0.03 },
      ];

      for (const blob of blobs) {
        const cx = blob.x * canvas.width;
        const cy = blob.y * canvas.height;
        const radius = blob.r * canvas.width;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, `rgba(${blob.color}, ${blob.alpha})`);
        gradient.addColorStop(0.55, `rgba(${blob.color}, ${blob.alpha * 0.35})`);
        gradient.addColorStop(1, `rgba(${blob.color}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      return canvas;
    }

    update(dt, speedScale = 1) {
      for (const star of this.stars) {
        star.y += star.speed * speedScale * dt;
        if (star.y > this.height + 4) {
          star.y = -4;
          star.x = rand(0, this.width);
        }
      }
    }

    draw(ctx, time = 0) {
      ctx.fillStyle = NV.COLORS.void;
      ctx.fillRect(0, 0, this.width, this.height);

      const drift = Math.sin(time * 0.08) * 6;
      ctx.drawImage(this.nebula, drift - 6, -8, this.width + 12, this.height + 16);

      for (const star of this.stars) {
        const tint = star.tint > 0.82 ? "34, 232, 255" : star.tint < 0.12 ? "255, 46, 166" : "234, 246, 255";
        ctx.fillStyle = `rgba(${tint}, ${star.alpha})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }
    }
  }

  NV.Starfield = Starfield;
})(window);
