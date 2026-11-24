/* ===========================================================
   main.js — bootstraps the game and wires the DOM controls
   =========================================================== */
(function (global) {
  "use strict";

  const NV = global.NV;

  const BUTTONS = [
    ["startBtn", (game) => game.start()],
    ["retryBtn", (game) => game.restart()],
    ["resumeBtn", (game) => game.togglePause()],
    ["restartBtn", (game) => game.restart()],
    ["pauseBtn", (game) => game.togglePause()],
    ["muteBtn", (game) => game.toggleMute()],
  ];

  function wire(game) {
    for (const [id, action] of BUTTONS) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener("click", (event) => {
        event.preventDefault();
        action(game);
        // Drop focus so Space/Enter never re-trigger a clicked control mid-run.
        el.blur();
      });
    }
  }

  function boot() {
    const canvas = document.getElementById("game");
    if (!canvas) return;

    const game = new NV.Game(canvas);
    wire(game);
    game.hud.setMuted(game.audio.muted);
    global.neonVoid = game;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
