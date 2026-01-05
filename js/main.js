/* =========================================================
   main.js
   - Entry Point
   ========================================================= */

function loop(ts) {
    const dt = ts - state.lastTs;
    state.lastTs = ts;

    if (!state.paused) {
        // Debug: Time Scale
        const scale = window.timeScale || 1;
        update(dt * scale);
    }
    render();

    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
