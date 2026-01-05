/* =========================================================
   setup.js
   - Canvas Initialization
   - Context Setup
   ========================================================= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const TAU = Math.PI * 2;
