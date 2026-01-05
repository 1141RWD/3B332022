/* =========================================================
   utils.js
   - Math & Helper functions
   ========================================================= */

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
}

function circleRectHit(cx, cy, cr, rx, ry, rw, rh) {
    // clamp
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy <= cr * cr;
}

function pushCircleOut(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    const d = Math.hypot(dx, dy) || 1;
    const overlap = ar + br - d;
    if (overlap > 0) {
        const nx = dx / d;
        const ny = dy / d;
        return {
            x: ax + nx * overlap,
            y: ay + ny * overlap,
        };
    }
    return null;
}

function pushCircleOutOfRect(px, py, pr, rx, ry, rw, rh) {
    const cx = Math.max(rx, Math.min(px, rx + rw));
    const cy = Math.max(ry, Math.min(py, ry + rh));
    const dx = px - cx;
    const dy = py - cy;
    const d = Math.hypot(dx, dy) || 1;
    const overlap = pr - d;
    if (overlap > 0) {
        return {
            x: px + (dx / d) * overlap,
            y: py + (dy / d) * overlap,
        };
    }
    return null;
}

//升級所需經驗
function calcExpToNext(level) {
    // 緩慢但有感成長
    return Math.floor(100 * Math.pow(1.35, level - 1));
}

//文字換行
function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split("");
    let line = "";

    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line, x, y);
            line = words[i];
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}

//Lerp工具函式
function lerp(a, b, t) {
    return a + (b - a) * t;
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

// 點到線段距離
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const vx = x2 - x1, vy = y2 - y1;
    const wx = px - x1, wy = py - y1;

    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(px - x1, py - y1);

    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(px - x2, py - y2);

    const t = c1 / c2;
    const bx = x1 + t * vx;
    const by = y1 + t * vy;
    return Math.hypot(px - bx, py - by);
}

function getBossCorePos(b) {
    return {
        x: b.x + (b.coreOffsetX ?? 0),
        y: b.y + (b.coreOffsetY ?? 0),
    };
}

function getBossAimAngleLeftOnly(b) {
    const p = state.player;
    const core = getBossCorePos(b);

    const targetX = Math.min(p.x, core.x - 40);
    return Math.atan2(p.y - core.y, targetX - core.x);
}

function getPauseRects() {
    const w = 260, h = 60;
    const gap = 18;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const resumeRect = { x: cx - w / 2, y: cy + 40, w, h };
    const restartRect = { x: cx - w / 2, y: cy + 40 + (h + gap) * 1, w, h };
    const homeRect = { x: cx - w / 2, y: cy + 40 + (h + gap) * 2, w, h };

    return { resumeRect, restartRect, homeRect };
}

function getResultRects() {
    const w = 220, h = 60;
    const gap = 30;
    const cx = canvas.width / 2;
    // Panel ends at roughly 440~450px if fixed.
    // Let's use a dynamic Y relative to center to be safe, or fixed if we trust renderer.
    // Renderer uses fixed py=200, panelH=240 -> bottom 440.
    // Let's safe-guard Y.
    const y = Math.max(480, canvas.height / 2 + 140);

    return {
        restartRect: {
            x: cx - w - gap / 2,
            y: y,
            w, h
        },
        homeRect: {
            x: cx + gap / 2,
            y: y,
            w, h
        },
    };
}

function hitRect(mx, my, r) {
    return (
        mx >= r.x &&
        mx <= r.x + r.w &&
        my >= r.y &&
        my <= r.y + r.h
    );
}

function getSprayDropPos(originX, originY, {
    minDist = 60,
    maxDist = 140,
    minAngle = -Math.PI / 3,
    maxAngle = Math.PI / 3,
    baseAngle = Math.PI, // 預設往左
} = {}) {
    const dist = rand(minDist, maxDist);
    const ang = baseAngle + rand(minAngle, maxAngle);

    return {
        x: originX + Math.cos(ang) * dist,
        y: originY + Math.sin(ang) * dist,
    };
}
