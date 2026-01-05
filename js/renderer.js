/* =========================================================
   renderer.js
   - Rendering System (Canvas Draw Calls)
   ========================================================= */

function getCardRects() {
    const count = state.currentCards.length;
    const w = 200;
    const h = 280;
    const gap = 40;
    const totalW = w * count + gap * (count - 1);
    const startX = canvas.width / 2 - totalW / 2;
    const y = canvas.height / 2 - h / 2;

    return state.currentCards.map((_, i) => ({
        x: startX + i * (w + gap),
        y,
        w,
        h,
    }));
}

function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawResultButton(r, text, key) {
    const hover = state.uiHover === key;
    const pressed = state.uiPressed === key;

    const scale = pressed ? 0.95 : hover ? 1.08 : 1;
    const alpha = hover ? 0.35 : 0.15;

    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-r.w / 2, -r.h / 2);

    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    drawRoundedRect(0, 0, r.w, r.h, 14);
    ctx.fill();

    ctx.strokeStyle = hover ? "gold" : "white";
    ctx.lineWidth = hover ? 3 : 1.5;
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = hover ? "26px Microsoft JhengHei" : "24px Microsoft JhengHei";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, r.w / 2, r.h / 2);

    ctx.restore();
}

function renderElite() {
    const e = state.elite;
    if (!e) return;

    // 計算動畫與狀態
    const time = performance.now() * 0.002;
    const angleToPlayer = Math.atan2(state.player.y - e.y, state.player.x - e.x);
    const isHit = (e.hitCooldown > 0); // 假設 elite 也有 hitCooldown 邏輯 (需確認 entities 強制寫入或通用)

    ctx.save();
    ctx.translate(e.x, e.y);

    // 震動特效 (如果受傷)
    if (isHit) {
        ctx.translate(rand(-2, 2), rand(-2, 2));
    }

    // 1. 底部光環 (旋轉)
    ctx.save();
    ctx.rotate(time);
    ctx.shadowBlur = 20;
    ctx.shadowColor = "rgba(255, 100, 50, 0.5)";
    ctx.strokeStyle = "rgba(255, 80, 0, 0.6)";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, e.r + 15, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // 2. 本體裝甲 (八角形)
    ctx.save();
    ctx.rotate(-time * 0.5);
    ctx.fillStyle = isHit ? "#fff" : "#222";
    ctx.strokeStyle = "orange";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const theta = i * (TAU / 8);
        const r = e.r + 5;
        const x = Math.cos(theta) * r;
        const y = Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3. 重型雙砲塔 (跟隨玩家)
    ctx.save();
    ctx.rotate(angleToPlayer);

    // 繪製底座
    ctx.fillStyle = "#444";
    ctx.fillRect(-15, -15, 30, 30);

    // 繪製砲管 (左 & 右)
    const barrelW = 12;
    const barrelL = 35;
    const offset = 18;

    ctx.fillStyle = "#111";
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;

    // 左砲
    ctx.fillRect(5, -offset - barrelW / 2, barrelL, barrelW);
    ctx.strokeRect(5, -offset - barrelW / 2, barrelL, barrelW);

    // 右砲
    ctx.fillRect(5, offset - barrelW / 2, barrelL, barrelW);
    ctx.strokeRect(5, offset - barrelW / 2, barrelL, barrelW);

    // 蓄力發光 (如果正在蓄力)
    if (e.charging) {
        ctx.fillStyle = `rgba(255, 50, 50, ${Math.random() * 0.5 + 0.5})`;
        ctx.shadowBlur = 15;
        ctx.shadowColor = "red";

        ctx.beginPath();
        ctx.arc(5 + barrelL, -offset, 6, 0, TAU);
        ctx.arc(5 + barrelL, offset, 6, 0, TAU);
        ctx.fill();
    }

    ctx.restore();

    // 4. 核心 (Core)
    ctx.beginPath();
    ctx.fillStyle = isHit ? "#fff" : "rgba(255, 100, 50, 1)";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "orange";
    ctx.arc(0, 0, e.r * 0.4, 0, TAU);
    ctx.fill();

    // 核心紋路
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -5); ctx.lineTo(5, 5);
    ctx.moveTo(5, -5); ctx.lineTo(-5, 5);
    ctx.stroke();

    ctx.restore();
}

function drawEliteHP() {
    const e = state.elite;
    if (!e) return;

    const w = 400;
    const h = 12;
    const x = canvas.width / 2 - w / 2;
    const y = 80;

    ctx.save();
    // Skew
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.translate(cx, cy);
    ctx.transform(1, 0, -0.2, 1, 0, 0);
    ctx.translate(-cx, -cy);

    // Bg
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x, y, w, h);

    // Fill
    const ratio = e.hp / e.maxHP;
    if (ratio > 0) {
        const grad = ctx.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, "#ff8800");
        grad.addColorStop(1, "#ffcc00");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w * ratio, h);
    }

    // Border
    ctx.strokeStyle = "rgba(255, 150, 0, 0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Text
    ctx.transform(1, 0, 0.2, 1, 0, 0); // Unskew text
    ctx.fillStyle = "#ffaa00";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.shadowBlur = 5;
    ctx.shadowColor = "orange";
    ctx.fillText("⚠ ELITE UNIT ⚠", cx, y - 8);

    ctx.restore();
}

function renderBoss() {
    const b = state.boss;
    if (!b) return;

    const time = performance.now() * 0.001;

    // === 計算震動 ===
    let shakeX = 0;
    let shakeY = 0;

    if (b.shakeTime > 0) {
        const t = b.shakeTime / 120;
        shakeX = rand(-1, 1) * b.shakePower * t;
        shakeY = rand(-1, 1) * b.shakePower * t;
    }

    ctx.save();
    ctx.translate(b.x + shakeX, b.y + shakeY);

    const halfW = BOSS_DATA.width / 2;
    const halfH = BOSS_DATA.height / 2;

    // =========================
    // 1. 核心 (Reactor Core) - 永遠存在，但在最底層或露出時才明顯
    // =========================
    ctx.save();
    // 核心旋轉環
    ctx.rotate(time * 0.5);
    ctx.shadowBlur = 30;
    ctx.shadowColor = "rgba(255, 50, 50, 0.6)";

    // Core Outer Ring
    ctx.strokeStyle = "#500";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, BOSS_DATA.coreRadius + 10, 0, TAU);
    ctx.stroke();

    // Core Inner pulsing
    const pulse = Math.sin(time * 5) * 0.1 + 0.9;
    ctx.fillStyle = "rgba(255, 30, 30, 1)";
    ctx.beginPath();
    ctx.arc(0, 0, BOSS_DATA.coreRadius * pulse, 0, TAU);
    ctx.fill();

    // Core detail lines
    ctx.strokeStyle = "rgba(255, 150, 150, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
        ctx.moveTo(0, -BOSS_DATA.coreRadius);
        ctx.lineTo(0, BOSS_DATA.coreRadius);
        ctx.rotate(TAU / 8);
    }
    ctx.stroke();
    ctx.restore();


    // =========================
    // 2. 外殼 (Armor Shell)
    // =========================
    if (b.shellStage < 2) {
        // Hull Base
        ctx.fillStyle = "#1a1a24"; // Dark Blue-Grey
        ctx.strokeStyle = "#333344";
        ctx.lineWidth = 4;

        ctx.beginPath();
        // 稍微切角的矩形 (Tech shape)
        const chamfer = 20;
        ctx.moveTo(-halfW + chamfer, -halfH);
        ctx.lineTo(halfW - chamfer, -halfH);
        ctx.lineTo(halfW, -halfH + chamfer);
        ctx.lineTo(halfW, halfH - chamfer);
        ctx.lineTo(halfW - chamfer, halfH);
        ctx.lineTo(-halfW + chamfer, halfH);
        ctx.lineTo(-halfW, halfH - chamfer);
        ctx.lineTo(-halfW, -halfH + chamfer);
        ctx.closePath();

        ctx.fill();
        ctx.stroke();

        // Hull Details (Panel lines)
        ctx.strokeStyle = "rgba(100, 100, 120, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        // 橫線
        ctx.moveTo(-halfW, 0); ctx.lineTo(halfW, 0);
        // 豎線
        ctx.moveTo(-halfW * 0.5, -halfH); ctx.lineTo(-halfW * 0.5, halfH);
        ctx.moveTo(halfW * 0.5, -halfH); ctx.lineTo(halfW * 0.5, halfH);
        ctx.stroke();

        // Warning Lights
        ctx.fillStyle = (Math.floor(time * 5) % 2 === 0) ? "red" : "#500";
        ctx.beginPath();
        ctx.arc(-halfW + 20, -halfH + 20, 4, 0, TAU);
        ctx.arc(halfW - 20, -halfH + 20, 4, 0, TAU);
        ctx.arc(-halfW + 20, halfH - 20, 4, 0, TAU);
        ctx.arc(halfW - 20, halfH - 20, 4, 0, TAU);
        ctx.fill();
    }

    // =========================
    // 3. 裂痕 (Energy Leaks)
    // =========================
    if (b.shellStage === 1 && b.cracks && b.cracks.length) {
        const ratio = b.hp / b.maxHP;
        const t = Math.min(1, Math.max(0, (0.8 - ratio) / 0.3));
        const visibleCount = Math.floor(b.cracks.length * t);

        // Glowing cracks
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#0ff"; // Blue energy leaks for armor
        ctx.strokeStyle = "rgba(100, 255, 255, 0.8)";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";

        for (let i = 0; i < visibleCount; i++) {
            const c = b.cracks[i];
            if (!c) continue;

            if (c.main) {
                // 主裂痕
                ctx.beginPath();
                ctx.moveTo(c.main.x1, c.main.y1);
                ctx.lineTo(c.main.x2, c.main.y2);
                ctx.stroke();

                // 分支
                if (c.branches) {
                    ctx.lineWidth = 1;
                    for (const br of c.branches) {
                        ctx.beginPath();
                        ctx.moveTo(br.x1, br.y1);
                        ctx.lineTo(br.x2, br.y2);
                        ctx.stroke();
                    }
                    ctx.lineWidth = 2;
                }
            }
            else if ("x1" in c) {
                // Compatibility
                ctx.beginPath();
                ctx.moveTo(c.x1, c.y1);
                ctx.lineTo(c.x2, c.y2);
                ctx.stroke();
            }
        }
    }

    // Shield Grid Effect overlay (if intact)
    if (b.shellStage === 0) {
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = "rgba(100, 100, 255, 0.05)";
        ctx.fillRect(-halfW, -halfH, BOSS_DATA.width, BOSS_DATA.height);
        ctx.restore();
    }

    ctx.restore(); // 關整個 Boss transform
}

function drawBossHP() {
    const b = state.boss;
    if (!b) return;

    const w = canvas.width * 0.8;
    const h = 24;
    const x = canvas.width / 2 - w / 2;
    const y = 40;

    // Boss Name / Warning
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = "red";
    ctx.fillStyle = "red";
    ctx.font = "bold 24px Microsoft JhengHei";
    ctx.textAlign = "center";
    ctx.fillText("☠ FINAL BOSS - ANNIHILATOR ☠", canvas.width / 2, y - 10);
    ctx.restore();

    ctx.save();
    // Skew
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.translate(cx, cy);
    ctx.transform(1, 0, -0.1, 1, 0, 0);
    ctx.translate(-cx, -cy);

    // Bg
    ctx.fillStyle = "rgba(20, 0, 0, 0.8)";
    ctx.fillRect(x, y, w, h);

    // Grid pattern on Bg
    ctx.fillStyle = "rgba(50, 0, 0, 0.5)";
    for (let i = 0; i < w; i += 20) {
        ctx.fillRect(x + i, y, 2, h);
    }

    // Fill
    const ratio = b.hp / b.maxHP;
    if (ratio > 0) {
        const grad = ctx.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, "#800");
        grad.addColorStop(0.5, "#f00");
        grad.addColorStop(1, "#800");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w * ratio, h);

        // Shine
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(x, y, w * ratio, h / 2);
    }

    // Border
    ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    // Decorative brackets
    ctx.fillStyle = "red";
    ctx.fillRect(x - 10, y - 5, 4, h + 10);
    ctx.fillRect(x + w + 6, y - 5, 4, h + 10);

    ctx.restore();
}

function renderPauseMenu() {
    // 1. 背景遮罩 (Sci-fi Grid Overlay)
    ctx.save();
    ctx.fillStyle = "rgba(10, 15, 20, 0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 畫網格
    ctx.strokeStyle = "rgba(0, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    const offset = (performance.now() * 0.02) % gridSize; // 微動效果

    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    for (let y = offset; y <= canvas.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
    ctx.restore();


    // 2. 標題 (Glitch Neon Title)
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 - 140;

    // Glitch shadow
    ctx.font = "bold 64px 'Courier New', monospace";
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
    ctx.fillText("SYSTEM PAUSED", cx - 2, cy);
    ctx.fillStyle = "rgba(0, 255, 255, 0.5)";
    ctx.fillText("SYSTEM PAUSED", cx + 2, cy);

    // Main text
    ctx.shadowBlur = 20;
    ctx.shadowColor = "cyan";
    ctx.fillStyle = "#fff";
    ctx.fillText("SYSTEM PAUSED", cx, cy);
    ctx.restore();


    // 3. 按鈕 (Custom Sci-fi Buttons)
    const { resumeRect, restartRect, homeRect } = getPauseRects();
    const buttons = [
        { rect: resumeRect, text: "RESUME", key: "resume" },
        { rect: restartRect, text: "RESTART", key: "restart" },
        { rect: homeRect, text: "MAIN MENU", key: "home" }
    ];

    buttons.forEach(btn => {
        const isHover = (state.uiHover === btn.key);
        const r = btn.rect;

        ctx.save();
        // 互動效果
        const glow = isHover ? 15 : 0;
        const borderCol = isHover ? "#0ff" : "rgba(0, 255, 255, 0.3)";
        const textCol = isHover ? "#fff" : "rgba(0, 255, 255, 0.8)";
        const bgCol = isHover ? "rgba(0, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.6)";

        // 按鈕背景 (切角)
        ctx.fillStyle = bgCol;
        ctx.beginPath();
        const cut = 10;
        ctx.moveTo(r.x + cut, r.y);
        ctx.lineTo(r.x + r.w, r.y);
        ctx.lineTo(r.x + r.w, r.y + r.h - cut);
        ctx.lineTo(r.x + r.w - cut, r.y + r.h);
        ctx.lineTo(r.x, r.y + r.h);
        ctx.lineTo(r.x, r.y + cut);
        ctx.closePath();
        ctx.fill();

        // 邊框
        ctx.strokeStyle = borderCol;
        ctx.lineWidth = 2;
        ctx.shadowBlur = glow;
        ctx.shadowColor = "#0ff";
        ctx.stroke();

        // 文字
        ctx.fillStyle = textCol;
        ctx.font = "bold 24px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowBlur = isHover ? 10 : 0;
        ctx.fillText(btn.text, r.x + r.w / 2, r.y + r.h / 2 + 2);

        // 裝飾線
        if (isHover) {
            ctx.fillStyle = "#0ff";
            ctx.fillRect(r.x - 5, r.y + r.h / 2 - 10, 3, 20);
            ctx.fillRect(r.x + r.w + 2, r.y + r.h / 2 - 10, 3, 20);
        }

        ctx.restore();
    });
}

function drawPauseButton(r, text) {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    drawRoundedRect(r.x, r.y, r.w, r.h, 14);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "28px Microsoft JhengHei";
    ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 10);
}

function renderResultScreen() {
    // 1. Determine Theme
    const isVictory = (state.mode === "victory");
    const themeCol = isVictory ? "#0f0" : "#f00"; // Green / Red
    const darkCol = isVictory ? "rgba(0, 50, 0, 0.9)" : "rgba(50, 0, 0, 0.9)";
    const titleText = isVictory ? "MISSION ACCOMPLISHED" : "CRITICAL FAILURE";

    // 2. Background
    ctx.save();
    ctx.fillStyle = "rgba(10, 12, 15, 0.92)"; // Deep dark bg
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = isVictory ? "rgba(0, 255, 0, 0.05)" : "rgba(255, 0, 0, 0.05)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    const offset = (performance.now() * 0.02) % gridSize;

    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = offset; y <= canvas.height; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();

    // 3. Title
    const cx = canvas.width / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // --- Death Screen Effects ---
    if (!isVictory) {
        // 1. Static Noise (Signal Lost)
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = `rgba(255, 0, 0, ${Math.random() * 0.15})`;
        for (let i = 0; i < 20; i++) {
            const h = Math.random() * 5 + 2;
            ctx.fillRect(0, Math.random() * canvas.height, canvas.width, h);
        }
        ctx.restore();

        // 2. Glitch Text Effect
        const offX = (Math.random() - 0.5) * 10;
        const offY = (Math.random() - 0.5) * 5;

        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255, 0, 0, 0.7)";
        ctx.font = "bold 64px 'Courier New', monospace";
        ctx.fillText(titleText, cx + offX, 140 + offY);

        ctx.fillStyle = "rgba(0, 255, 255, 0.5)";
        ctx.fillText(titleText, cx - offX, 140 - offY);

        // 3. "CONNECTION TERMINATED" Subtitle
        ctx.fillStyle = "rgba(255, 50, 50, 0.8)";
        ctx.font = "20px 'Courier New', monospace";
        ctx.letterSpacing = "4px";
        ctx.fillText("- SIGNAL LOST -", cx, 180);
    }

    // Main Title (Green for Victory, Red for Defeat without glitch if victory)
    ctx.shadowBlur = 30;
    ctx.shadowColor = themeCol;
    ctx.fillStyle = themeCol;
    ctx.font = "bold 64px 'Courier New', monospace";
    if (isVictory) {
        ctx.fillText(titleText, cx, 140);
    } else {
        // Redraw main text on top of glitches for Defeat
        ctx.fillStyle = "#fff";
        ctx.fillText(titleText, cx, 140);
    }
    ctx.shadowBlur = 0;

    // 4. Mission Report Panel
    const panelW = 420;
    const panelH = 240;
    const px = cx - panelW / 2;
    const py = 200;

    // Panel Bg
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath();
    ctx.moveTo(px + 20, py);
    ctx.lineTo(px + panelW, py);
    ctx.lineTo(px + panelW, py + panelH - 20);
    ctx.lineTo(px + panelW - 20, py + panelH);
    ctx.lineTo(px, py + panelH);
    ctx.lineTo(px, py + 20);
    ctx.closePath();
    ctx.fill();

    // Panel Border
    ctx.strokeStyle = themeCol;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Stats
    ctx.font = "bold 18px 'Courier New', monospace";
    const lx = px + 40;
    const rx = px + panelW - 40;
    const yStart = py + 50;
    const spacing = 45;

    const stats = [
        { label: "SURVIVAL TIME", val: formatTime(state.stats.surviveTime) },
        { label: "ENEMIES NEUTRALIZED", val: state.stats.killEnemy },
        { label: "ELITES DEFEATED", val: state.stats.killElite },
        { label: "BOSS ELIMINATED", val: state.stats.killBoss }
    ];

    stats.forEach((item, i) => {
        const y = yStart + i * spacing;

        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.fillText(item.label, lx, y);

        ctx.textAlign = "right";
        ctx.fillStyle = "#fff";
        ctx.fillText(item.val, rx, y);

        // Line
        if (i < stats.length - 1) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
            ctx.fillRect(lx, y + 15, panelW - 80, 1);
        }
    });

    // 5. Buttons
    const { restartRect, homeRect } = getResultRects();
    const buttons = [
        { rect: restartRect, text: "REINITIALIZE", key: "restart" },
        { rect: homeRect, text: "ABORT MISSION", key: "home" }
    ];

    buttons.forEach(btn => {
        const isHover = (state.uiHover === btn.key);
        const r = btn.rect;

        // Button Style
        const borderCol = isHover ? "#fff" : themeCol;
        const textCol = isHover ? "#000" : themeCol;
        const bgCol = isHover ? themeCol : "rgba(0, 0, 0, 0.8)";

        // Rect
        ctx.fillStyle = bgCol;
        ctx.fillRect(r.x, r.y, r.w, r.h);

        // Border
        ctx.lineWidth = 2;
        ctx.strokeStyle = borderCol;
        ctx.strokeRect(r.x, r.y, r.w, r.h);

        // Text
        ctx.fillStyle = textCol;
        ctx.font = "bold 20px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(btn.text, r.x + r.w / 2, r.y + r.h / 2 + 2);

        // Glow effect
        if (isHover) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = themeCol;
            ctx.strokeRect(r.x, r.y, r.w, r.h);
            ctx.shadowBlur = 0;
        }
    });

    ctx.restore();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // === 背景 (Cyber Void) ===
    const bgTime = performance.now() * 0.001; // sec (Renamed to avoid conflict)

    // 1. Deep Space Gradient
    const bgGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width
    );
    bgGrad.addColorStop(0, "#0b1026"); // Deep Blue/Purple center
    bgGrad.addColorStop(1, "#000000"); // Black edges
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Starfield (Deterministic & Parallax)
    ctx.save();
    ctx.fillStyle = "#fff";
    // Generate pseudo-random stars based on index
    for (let i = 0; i < 80; i++) {
        // Simple deterministic random positions
        const x = (i * 113 + bgTime * 10) % canvas.width;
        const y = (i * 241 + (i % 2 === 0 ? bgTime * 5 : -bgTime * 2)) % canvas.height;
        const size = (i % 3) + 1;

        ctx.globalAlpha = 0.2 + 0.3 * Math.sin(bgTime * 2 + i); // Twinkle
        ctx.fillRect(Math.abs(x), Math.abs(y), size, size);
    }
    ctx.restore();

    // 3. Cyber Grid (Moving)
    ctx.save();
    ctx.strokeStyle = "rgba(0, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();

    const gridSize = 80;
    const gridOffX = (bgTime * 15) % gridSize;
    const gridOffY = (bgTime * 15) % gridSize;

    // Vertical lines
    for (let x = -gridSize; x < canvas.width + gridSize; x += gridSize) {
        ctx.moveTo(x - gridOffX, 0);
        ctx.lineTo(x - gridOffX, canvas.height);
    }
    // Horizontal lines
    for (let y = -gridSize; y < canvas.height + gridSize; y += gridSize) {
        ctx.moveTo(0, y - gridOffY);
        ctx.lineTo(canvas.width, y - gridOffY);
    }
    ctx.stroke();
    ctx.restore();

    // 4. Vignette (Atmosphere)
    const vignette = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.5,
        canvas.width / 2, canvas.height / 2, canvas.height * 1.0
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,10,20,0.5)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 爆炸範圍特效 (Shockwave & Fireball)
    for (const ex of state.explosions) {
        const t = ex.time / ex.duration; // 0~1
        const easeOut = 1 - (1 - t) * (1 - t);

        ctx.save();
        ctx.translate(ex.x, ex.y);

        // 1. 衝擊波 (Shockwave Ring) - 快速擴散
        const maxR = ex.radius;
        const ringR = maxR * easeOut;
        if (t < 0.8) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 - t})`;
            ctx.lineWidth = 15 * (1 - t);
            ctx.arc(0, 0, ringR, 0, TAU);
            ctx.stroke();
        }

        // 2. 火球本體 (Fireball)
        if (t < 0.9) {
            const fireR = maxR * 0.8 * (1 - t * 0.5); // 稍微縮小
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, fireR);
            grad.addColorStop(0, "rgba(255, 255, 200, 1)"); // 核心白
            grad.addColorStop(0.3, "rgba(255, 150, 0, 0.9)"); // 中層橘
            grad.addColorStop(0.7, "rgba(100, 0, 0, 0.7)"); // 外層暗紅
            grad.addColorStop(1, "rgba(50, 50, 50, 0)"); // 邊緣煙霧

            ctx.fillStyle = grad;
            ctx.globalCompositeOperation = "lighter";
            ctx.beginPath();
            ctx.arc(0, 0, fireR, 0, TAU);
            ctx.fill();
        }

        ctx.restore();
    }

    // 雷射
    for (const l of state.lasers) {
        ctx.save();
        ctx.lineWidth = l.width;
        ctx.lineCap = "round";

        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(120, 220, 255, 1)";
        ctx.strokeStyle = "rgba(120, 220, 255, 0.95)";

        // ⭐ 使用被阻擋後的視覺長度
        const len = l.visualLength ?? l.length;

        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x + Math.cos(l.ang) * len, l.y + Math.sin(l.ang) * len);
        ctx.stroke();
        ctx.restore();
    }

    // ⭐ 粒子特效 (要在雷射之上)
    ctx.save();
    if (state.particles) {
        for (const p of state.particles) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.globalAlpha = p.life / 200; // 簡單淡出
            ctx.fillStyle = p.color;

            const s = p.size;
            ctx.fillRect(-s / 2, -s / 2, s, s);

            // 額外發光
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;

            ctx.restore();
        }
    }
    ctx.restore();

    // 子彈
    for (const b of state.bullets) {
        ctx.save();
        ctx.translate(b.x, b.y);

        // 計算子彈朝向
        const angle = Math.atan2(b.vy, b.vx);
        ctx.rotate(angle);

        // 樣式設定
        if (b.typeKey === "explosive") {
            // 爆炸彈：不穩定熔岩核心 (Unstable Magma Core)
            const time = performance.now() * 0.02;
            const pulse = 1 + Math.sin(time) * 0.1;

            // 1. 內部岩漿輝光
            ctx.shadowBlur = 20;
            ctx.shadowColor = "rgba(255, 50, 0, 0.9)";

            // 2. 核心漸層
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r * pulse);
            grad.addColorStop(0, "rgba(255, 255, 200, 1)");
            grad.addColorStop(0.4, "rgba(255, 120, 0, 1)");
            grad.addColorStop(1, "rgba(100, 20, 0, 1)");

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, b.r * pulse, 0, TAU);
            ctx.fill();

            // 3. 漂浮碎塊 (不穩定的外殼)
            ctx.fillStyle = "rgba(20, 20, 20, 0.8)";
            ctx.shadowBlur = 0;
            const crustCount = 3;
            for (let k = 0; k < crustCount; k++) {
                ctx.save();
                ctx.rotate(time * (k % 2 === 0 ? 1 : -1) + k * (TAU / crustCount));
                ctx.fillRect(b.r * 0.6, -2, 4, 4);
                ctx.restore();
            }

        } else {
            // 普通/散彈：青色能量箭形
            ctx.shadowBlur = 10;
            ctx.shadowColor = "rgba(100, 255, 255, 0.8)";

            // 畫一個長條膠囊狀
            const tailLen = 12; // 拖尾長度
            const width = b.r * 2; // 寬度

            // 漸層拖尾
            const grad = ctx.createLinearGradient(-tailLen, 0, width, 0);
            grad.addColorStop(0, "rgba(100, 255, 255, 0)");
            grad.addColorStop(0.5, "rgba(100, 255, 255, 0.8)");
            grad.addColorStop(1, "rgba(200, 255, 255, 1)");

            ctx.fillStyle = grad;
            ctx.beginPath();
            // 類似水滴/子彈形狀：左邊尖或是圓，右邊頭部圓
            // 由於 rotate 了，右邊是前進方向 (0度)
            ctx.moveTo(width, 0);
            ctx.lineTo(-tailLen, -width / 2);
            ctx.lineTo(-tailLen, width / 2);
            ctx.closePath();

            // 比較簡單的畫法：畫兩條線或直接畫 path
            // 重畫：頭部圓形 + 尾巴
            ctx.beginPath();
            ctx.arc(0, 0, b.r, 0, TAU);
            ctx.rect(-tailLen, -b.r, tailLen, b.r * 2);
            ctx.fill();

            // 高亮彈頭
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(2, 0, b.r * 0.6, 0, TAU);
            ctx.fill();
        }

        ctx.restore();
    }

    // 掉落物 (Supply Drops)
    for (const d of state.drops) {
        // 浮動動畫
        const floatY = Math.sin(performance.now() * 0.005 + d.x * 0.1) * 3;

        ctx.save();
        ctx.translate(d.x, d.y + floatY);

        const s = d.size;
        const halfS = s / 2;

        // 1. 光暈背景
        ctx.shadowBlur = 15;
        ctx.shadowColor = d.color;
        ctx.fillStyle = d.color; // 半透明填充
        ctx.globalAlpha = 0.8;
        ctx.fillRect(-halfS, -halfS, s, s);
        ctx.globalAlpha = 1;

        // 2. 科技邊框 (四角括號)
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        const corner = 6;

        ctx.beginPath();
        // 左上
        ctx.moveTo(-halfS, -halfS + corner); ctx.lineTo(-halfS, -halfS); ctx.lineTo(-halfS + corner, -halfS);
        // 右上
        ctx.moveTo(halfS - corner, -halfS); ctx.lineTo(halfS, -halfS); ctx.lineTo(halfS, -halfS + corner);
        // 右下
        ctx.moveTo(halfS, halfS - corner); ctx.lineTo(halfS, halfS); ctx.lineTo(halfS - corner, halfS);
        // 左下
        ctx.moveTo(-halfS + corner, halfS); ctx.lineTo(-halfS, halfS); ctx.lineTo(-halfS, halfS - corner);
        ctx.stroke();

        // 3. 類型標示
        let letter = "?";
        if (d.typeKey === "spread") letter = "S";
        if (d.typeKey === "explosive") letter = "B";
        if (d.typeKey === "laser") letter = "L";

        ctx.fillStyle = "#fff";
        ctx.shadowBlur = 0;
        ctx.font = "bold 20px Microsoft JhengHei";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letter, 0, 1); // 微調 y

        ctx.restore();
    }


    // 敵人
    for (const e of state.enemies) {
        const angle = Math.atan2(state.player.y - e.y, state.player.x - e.x);
        const isHit = e.hitCooldown > 0;

        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(angle);

        // 發光
        ctx.shadowBlur = isHit ? 20 : 10;
        ctx.shadowColor = e.color;

        ctx.fillStyle = isHit ? "#fff" : e.color;
        ctx.strokeStyle = isHit ? "#fff" : "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2;

        if (e.typeKey === 'fast') {
            // Speed (Dart Shape)
            ctx.beginPath();
            ctx.moveTo(e.r + 4, 0);
            ctx.lineTo(-e.r, -e.r + 2);
            ctx.lineTo(-e.r + 4, 0);
            ctx.lineTo(-e.r, e.r - 2);
            ctx.closePath();
            ctx.fill();
            // Engine glare
            ctx.beginPath();
            ctx.fillStyle = "#fff";
            ctx.arc(-e.r, 0, 3, 0, TAU);
            ctx.fill();

        } else if (e.typeKey === 'tank') {
            // Tank (Heavy Shielded Box)
            const s = e.r - 2;
            ctx.beginPath();
            ctx.rect(-s, -s, s * 2, s * 2);
            ctx.fill();
            ctx.stroke();

            // X Armor
            ctx.beginPath();
            ctx.moveTo(-s, -s);
            ctx.lineTo(s, s);
            ctx.moveTo(s, -s);
            ctx.lineTo(-s, s);
            ctx.strokeStyle = "rgba(0,0,0,0.3)";
            ctx.stroke();

        } else {
            // Basic (Diamond Droid)
            ctx.beginPath();
            ctx.moveTo(e.r, 0);
            ctx.lineTo(0, -e.r * 0.8);
            ctx.lineTo(-e.r * 0.6, 0);
            ctx.lineTo(0, e.r * 0.8);
            ctx.closePath();
            ctx.fill();

            // Core
            ctx.beginPath();
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.arc(0, 0, 4, 0, TAU);
            ctx.fill();
        }

        ctx.restore();

        // 血條
        const barW = e.r * 2;
        const barH = 5;
        const x = e.x - barW / 2;
        const y = e.y - e.r - 12;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(x, y, barW, barH);
        ctx.fillStyle = "rgba(80,255,120,0.9)";
        ctx.fillRect(x, y, barW * (e.hp / e.maxHP), barH);
    }

    if (state.elite) {
        renderElite();
    }

    if (state.boss) {
        renderBoss();
    }


    // 玩家
    // 玩家 (Sci-fi Style Redesign)
    const p = state.player;
    const time = performance.now() * 0.003; // 用來做旋轉動畫

    ctx.save();
    ctx.translate(p.x, p.y);

    // 1. 發光光暈 (Outer Glow)
    ctx.shadowBlur = 25;
    ctx.shadowColor = "rgba(100, 255, 218, 0.6)";

    // 2. 外部旋轉環 (Rotating Ring)
    ctx.save();
    ctx.rotate(time);
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(100, 255, 218, 0.4)";
    // 畫三個弧形構成的斷環
    for (let i = 0; i < 3; i++) {
        ctx.arc(0, 0, p.r + 6, i * (TAU / 3), i * (TAU / 3) + 1.2);
        ctx.stroke();
    }
    ctx.restore();

    // 3. 反向旋轉內環 (Inner Tech Ring)
    ctx.save();
    ctx.rotate(-time * 1.5);
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.setLineDash([5, 8]); // 虛線效果
    ctx.arc(0, 0, p.r - 2, 0, TAU);
    ctx.stroke();
    ctx.restore();

    // 4. 核心本體 (Core Gradient)
    ctx.beginPath();
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r);
    grad.addColorStop(0, "rgba(200, 255, 255, 1)");
    grad.addColorStop(0.6, "rgba(0, 200, 180, 1)");
    grad.addColorStop(1, "rgba(0, 100, 90, 1)");
    ctx.fillStyle = grad;
    ctx.arc(0, 0, p.r - 4, 0, TAU);
    ctx.fill();

    // 5. 強調邊框
    ctx.shadowBlur = 0; // 邊框不模糊
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(200, 255, 255, 0.9)";
    ctx.stroke();

    // 6. 面向指示器 (Directional Pointer & Weapon Mount)
    const aimAng = angleToMouse();
    ctx.rotate(aimAng); // 旋轉整個座標系朝向滑鼠

    // 繪製一個三角形箭頭/槍口
    ctx.beginPath();
    ctx.fillStyle = "rgba(220, 255, 255, 1)";
    ctx.moveTo(p.r + 2, 0);
    ctx.lineTo(p.r - 6, -6);
    ctx.lineTo(p.r - 6, 6);
    ctx.fill();

    // 槍口發光點
    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#0ff";
    ctx.arc(p.r + 4, 0, 3, 0, TAU);
    ctx.fill();

    ctx.restore();

    // UI
    drawUI();

    if (state.mode === "card") {
        renderCardUI();
    }

    if (state.mode === "eliteWarning") {
        renderSciFiWarning("WARNING", "ELITE APPROACHING", "#ffaa00");
    }

    if (state.mode === "bossWarning") {
        renderSciFiWarning("CRITICAL WARNING", "FINAL BOSS DETECTED", "#ff0000");
    }

    if (state.mode === "gameover") {
        renderResultScreen("GAME OVER");
        return;
    }

    if (state.mode === "victory") {
        renderResultScreen("MISSION COMPLETE");
        return;
    }


    // === 繪製敵人雷射 ===
    for (const l of state.enemyLasers) {
        ctx.save();
        ctx.lineWidth = l.width;
        ctx.lineCap = "round";

        // 發光特效
        ctx.shadowBlur = 20;
        ctx.shadowColor = l.color; // 跟隨雷射顏色

        ctx.strokeStyle = l.color;

        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(
            l.x + Math.cos(l.angle) * l.length,
            l.y + Math.sin(l.angle) * l.length
        );
        ctx.stroke();

        // 額外畫一層高亮白芯，增加質感
        ctx.globalCompositeOperation = "lighter";
        ctx.lineWidth = l.width * 0.4;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.stroke();

        ctx.restore();
    }

    // === 敵人子彈 ===
    for (const b of state.enemyBullets) {
        ctx.save();
        ctx.translate(b.x, b.y);

        // 1. 光暈 (Glow)
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(255, 60, 60, 0.8)";

        // 2. 本體 (Energy Sphere) - 使用徑向漸層模擬能量球
        // 視覺半徑稍微畫大一點，讓光暈更明顯
        const visibleR = b.r * 1.8;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, visibleR);
        grad.addColorStop(0, "rgba(255, 255, 220, 1)");  // 核心白
        grad.addColorStop(0.3, "rgba(255, 100, 50, 1)"); // 中層橘紅
        grad.addColorStop(0.7, "rgba(200, 20, 20, 0.4)");// 外層深紅半透明
        grad.addColorStop(1, "rgba(200, 0, 0, 0)");      // 邊緣透明

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, visibleR, 0, TAU);
        ctx.fill();

        // 3. 極亮核心 (Bright Core)
        ctx.fillStyle = "#fff";
        ctx.shadowBlur = 5;
        ctx.shadowColor = "#fff";
        ctx.beginPath();
        ctx.arc(0, 0, b.r * 0.4, 0, TAU);
        ctx.fill();

        ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    for (const w of state.bossWarnings) {
        w.blink += 1;
        const alpha = Math.sin(w.blink * 0.2) * 0.4 + 0.6;

        ctx.lineWidth = 5;
        ctx.strokeStyle = `rgba(255,50,50,${alpha})`;
        ctx.fillStyle = `rgba(255,50,50,${0.12 * alpha})`;

        if (w.type === "core") {
            // 巨大核心雷射提示：畫一條超粗的預告線（從 boss 朝左）
            const b = state.boss;
            if (!b) continue;

            const x1 = b.x;
            const y1 = b.y;
            const x2 = 0;
            const y2 = b.y;

            ctx.save();
            ctx.lineCap = "round";
            ctx.lineWidth = 64;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.restore();

        } else if (w.type === "clamp") {
            // 指針夾擊提示：畫兩條扇形預告線（不必完全一致，但方向要對）
            const b = state.boss;
            if (!b) continue;

            const core = getBossCorePos(b);
            const ox = core.x;
            const oy = core.y;

            const center = Math.PI;
            const startGap = 1.15;

            const a1 = center - startGap / 2;
            const a2 = center + startGap / 2;

            ctx.save();
            ctx.lineCap = "round";
            ctx.lineWidth = 10;

            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(ox + Math.cos(a1) * canvas.width, oy + Math.sin(a1) * canvas.width);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.lineTo(ox + Math.cos(a2) * canvas.width, oy + Math.sin(a2) * canvas.width);
            ctx.stroke();

            ctx.restore();
        }

        // 小小的「!」提示
        ctx.fillStyle = `rgba(255,80,80,${alpha})`;
        ctx.font = "52px Microsoft JhengHei";
        ctx.textAlign = "center";
        ctx.fillText("!", canvas.width / 2, canvas.height / 2);
    }
    ctx.restore();

    // ⭐ 把血條移到最後畫（最上層）
    if (state.elite) {
        drawEliteHP();
    }
    if (state.boss) {
        drawBossHP();
    }

    if (state.mode === "pause") {
        renderPauseMenu();
        return;
    }


}

function renderCardUI() {
    // 背景遮罩
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const rects = getCardRects();
    const mx = state.mouse.x;
    const my = state.mouse.y;
    const p = state.player;

    rects.forEach((r, i) => {
        const card = state.currentCards[i];
        if (!card) return;

        const ui = state.cardUI[i];

        // Hover 判定（用原始矩形，避免縮放後不好點）
        const isHover =
            mx >= r.x &&
            mx <= r.x + r.w &&
            my >= r.y &&
            my <= r.y + r.h;

        // === 動畫目標值 ===
        const targetScale = isHover ? 1.08 : 1;
        const targetLift = isHover ? 18 : 0;
        const targetGlow = isHover ? 1 : 0;

        // === 平滑動畫（核心） ===
        ui.scale = lerp(ui.scale, targetScale, 0.15);
        ui.lift = lerp(ui.lift, targetLift, 0.15);
        ui.glow = lerp(ui.glow, targetGlow, 0.15);

        // === 繪製（套用 transform） ===
        ctx.save();

        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2 - ui.lift;

        ctx.translate(cx, cy);
        ctx.scale(ui.scale, ui.scale);
        ctx.translate(-r.w / 2, -r.h / 2);

        // ⭐ 關鍵：重設文字對齊
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        // 發光陰影
        const hoverIntensity = ui.glow;
        ctx.shadowColor = `rgba(100, 200, 255, ${0.4 + 0.4 * hoverIntensity})`;
        ctx.shadowBlur = 20 * hoverIntensity;

        // 1. 卡牌背景 (Sci-fi Glass Panel)
        const grad = ctx.createLinearGradient(0, 0, 0, r.h);
        grad.addColorStop(0, "rgba(20, 30, 45, 0.95)");
        grad.addColorStop(1, "rgba(10, 15, 20, 0.98)");

        ctx.fillStyle = grad;
        // 稍微圓角
        drawRoundedRect(0, 0, r.w, r.h, 12);
        ctx.fill();

        // 2. 邊框 (Tech Border)
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.3 + 0.5 * hoverIntensity})`;
        // 全框
        drawRoundedRect(0, 0, r.w, r.h, 12);
        ctx.stroke();

        // 科技角標 (Brackets)
        const corner = 15;
        ctx.strokeStyle = `rgba(100, 255, 255, ${0.6 + 0.4 * hoverIntensity})`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0; // 角標不模糊
        ctx.beginPath();
        // Top-Left
        ctx.moveTo(0, corner); ctx.lineTo(0, 0); ctx.lineTo(corner, 0);
        // Bottom-Right
        ctx.moveTo(r.w - corner, r.h); ctx.lineTo(r.w, r.h); ctx.lineTo(r.w, r.h - corner);
        ctx.stroke();


        // === 卡牌內容 ===

        // 標題條 (Header Bar)
        const headerH = 45;
        ctx.fillStyle = `rgba(100, 200, 255, ${0.1 + 0.1 * hoverIntensity})`;
        ctx.fillRect(2, 2, r.w - 4, headerH);

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        // 標題
        ctx.font = "bold 22px Microsoft JhengHei";
        ctx.fillText(card.name, 15, 30);

        // 等級顯示
        let lv = 1;
        if (card.type === "player") {
            if (card.id === "hp_up") lv = p.upgrades.hp + 1;
            if (card.id === "speed_up") lv = p.upgrades.speed + 1;
        }
        if (card.type === "weapon") {
            lv = p.upgrades.weapons[card.weaponKey] + 1;
        }

        ctx.font = "italic 16px Arial";
        ctx.fillStyle = "rgba(100, 255, 255, 0.9)";
        ctx.textAlign = "right";
        ctx.fillText(`LV.${lv}`, r.w - 15, 30);


        // 描述區域
        ctx.textAlign = "left";
        ctx.fillStyle = "#ccc";
        ctx.font = "16px Microsoft JhengHei";
        wrapText(card.desc(lv), 15, 75, r.w - 30, 24);

        // 底部按鈕提示 (Select Button)
        const btnH = 36;
        const btnY = r.h - btnH - 10;
        ctx.fillStyle = hoverIntensity > 0.5 ? "rgba(100, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(10, btnY, r.w - 20, btnH);

        ctx.strokeStyle = `rgba(100, 255, 255, ${0.3 + 0.3 * hoverIntensity})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(10, btnY, r.w - 20, btnH);

        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = "16px Arial";
        ctx.fillText(hoverIntensity > 0.5 ? ">>> SELECT <<<" : "CHOOSE", r.w / 2, btnY + 23);

        ctx.restore();
    });
}

function drawUI() {
    const p = state.player;

    ctx.save();
    ctx.textAlign = "left";   // ⭐ 關鍵
    ctx.textBaseline = "alphabetic";
    ctx.font = "16px Microsoft JhengHei, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";

    // === HUD (Sci-fi Style) ===

    // === HUD (Sci-fi Style) ===

    // Position Calculation
    const hudX = 48;
    const hudY = 86; // 下移以避開 Boss 血條 (約 y=24~60)

    // HP Bar
    const hpBar = { x: hudX, y: hudY, w: 240, h: 20 };
    const hpRatio = Math.max(0, p.hp) / p.maxHP;

    ctx.save();
    // 傾斜變換 (Skew)
    ctx.transform(1, 0, -0.2, 1, 0, 0);

    // HP 背景框
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath();
    ctx.moveTo(hpBar.x, hpBar.y);
    ctx.lineTo(hpBar.x + hpBar.w, hpBar.y);
    ctx.lineTo(hpBar.x + hpBar.w - 10, hpBar.y + hpBar.h);  // 下邊稍微內縮更有型
    ctx.lineTo(hpBar.x - 10, hpBar.y + hpBar.h);
    ctx.closePath();
    ctx.fill();

    // HP 邊框
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 50, 50, 0.5)";
    ctx.stroke();

    // HP 填色 (Gradient)
    if (hpRatio > 0) {
        const grad = ctx.createLinearGradient(hpBar.x, 0, hpBar.x + hpBar.w, 0);
        grad.addColorStop(0, "rgba(255, 50, 50, 0.9)");
        grad.addColorStop(1, "rgba(255, 100, 50, 0.9)");

        ctx.fillStyle = grad;
        const fillW = hpBar.w * hpRatio;

        ctx.beginPath();
        ctx.moveTo(hpBar.x, hpBar.y);
        ctx.lineTo(hpBar.x + fillW, hpBar.y);
        ctx.lineTo(hpBar.x + fillW - 10, hpBar.y + hpBar.h);
        ctx.lineTo(hpBar.x - 10, hpBar.y + hpBar.h);
        ctx.closePath();
        ctx.fill();

        // 高亮條
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(hpBar.x, hpBar.y, fillW, hpBar.h * 0.4);
    }

    // HP 文字
    ctx.transform(1, 0, 0.2, 1, 0, 0); // 反向傾斜回來畫文字，或直接 restore 再畫
    ctx.restore(); // 方便起見直接 restore

    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.font = "italic bold 18px Arial";
    ctx.fillText("HP", hpBar.x, hpBar.y - 5);
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHP}`, hpBar.x + hpBar.w, hpBar.y - 5);
    ctx.restore();


    // EXP Bar (Placed below HP bar)
    const expBar = { x: hudX, y: hudY + 35, w: 240, h: 10 };
    const expRatio = state.player.exp / state.player.expToNext;

    ctx.save();
    ctx.transform(1, 0, -0.2, 1, 0, 0);

    // EXP 背景
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(expBar.x - 5, expBar.y, expBar.w, expBar.h);

    // EXP 邊框
    ctx.strokeStyle = "rgba(50, 200, 255, 0.5)";
    ctx.strokeRect(expBar.x - 5, expBar.y, expBar.w, expBar.h);

    // EXP 填色
    if (expRatio > 0) {
        const grad2 = ctx.createLinearGradient(expBar.x, 0, expBar.x + expBar.w, 0);
        grad2.addColorStop(0, "rgba(0, 150, 255, 0.9)");
        grad2.addColorStop(1, "rgba(100, 255, 255, 0.9)");

        ctx.fillStyle = grad2;
        ctx.fillRect(expBar.x - 5, expBar.y, expBar.w * expRatio, expBar.h);
    }

    ctx.restore();

    // LV & EXP 文字
    ctx.save();
    ctx.fillStyle = "rgba(100, 255, 255, 1)";
    ctx.font = "bold 14px Arial";
    ctx.fillText(`LV.${state.player.level}`, expBar.x, expBar.y - 4);

    ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
    ctx.textAlign = "right";
    ctx.font = "12px Arial";
    // ctx.fillText(`${Math.floor(state.player.exp)} / ${state.player.expToNext}`, expBar.x + expBar.w, expBar.y - 4);
    ctx.restore();

    if (state.paused) {
        //ctx.font = "32px Microsoft JhengHei, sans-serif";
        //ctx.fillStyle = "rgba(255,255,255,0.85)";
        //ctx.fillText("PAUSED", canvas.width / 2 - 70, canvas.height / 2);
    }
    ctx.restore();

    // === Score（左下角） ===
    const scoreVal = state.score.toString().padStart(6, '0');

    ctx.save();
    const sx = 48; // Align with HUD x
    const sy = hudY + 60; // Below EXP bar (consistently top-left)

    // Background Plate
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    // Skew
    ctx.transform(1, 0, -0.2, 1, 0, 0);
    ctx.fillRect(sx, sy, 240, 24);

    // Border
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 255, 255, 0.5)";
    ctx.strokeRect(sx, sy, 240, 24);

    // Text (Unskew for readability)
    ctx.transform(1, 0, 0.2, 1, 0, 0);

    // Label
    ctx.fillStyle = "rgba(0, 255, 255, 0.8)";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "left";
    ctx.fillText("SCORE", sx + 10, sy + 16);

    // Value
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.textAlign = "right";
    ctx.shadowBlur = 5;
    ctx.shadowColor = "cyan";
    ctx.fillText(scoreVal, sx + 200, sy + 18);

    ctx.restore();



    // === 倒計時顯示 (Sci-Fi Digital Clock) ===
    if (!state.elite && !state.boss && state.mode === "play") {
        const timeText = formatTime(state.timer.remaining);
        const isLowTime = state.timer.remaining <= 30;
        const clockColor = isLowTime ? "#ff3333" : "#00ffff";

        ctx.save();
        ctx.translate(canvas.width / 2, 45);

        // Background Plate
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.transform(1, 0, -0.2, 1, 0, 0); // Skew
        ctx.fillRect(-80, -20, 160, 40);

        // Border
        ctx.strokeStyle = clockColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(-80, -20, 160, 40);

        // Unskew for text
        ctx.transform(1, 0, 0.2, 1, 0, 0);

        // Label
        ctx.font = "bold 10px Arial";
        ctx.fillStyle = clockColor;
        ctx.textAlign = "center";
        ctx.fillText("T-MINUS", 0, -12);

        // Time
        ctx.font = "bold 28px 'Courier New', monospace";
        ctx.fillStyle = "#fff";
        ctx.shadowBlur = isLowTime ? 15 : 5;
        ctx.shadowColor = clockColor;
        ctx.fillText(timeText, 0, 12);

        ctx.restore();
    }


}

// Helper: Sci-Fi Warning Screen
function renderSciFiWarning(mainText, subText, color) {
    const time = performance.now() * 0.001;

    // 1. Flash Overlay
    const flash = Math.abs(Math.sin(time * 5)); // Fast flash
    ctx.fillStyle = `rgba(0, 0, 0, ${0.6 + 0.2 * flash})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Scrolling Hazard Stripes (Top & Bottom)
    const stripeH = 60;
    const stripeW = 60;
    const offset = (time * 100) % stripeW;

    ctx.save();
    ctx.beginPath();
    // Top & Bottom rects
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, canvas.width, stripeH);
    ctx.fillRect(0, canvas.height - stripeH, canvas.width, stripeH);

    // Stripes
    ctx.beginPath();
    ctx.fillStyle = color;
    for (let x = -stripeW; x < canvas.width + stripeW; x += stripeW) {
        // Skewed paralellogram
        const drawX = x + offset;
        ctx.moveTo(drawX, 0);
        ctx.lineTo(drawX + 30, 0);
        ctx.lineTo(drawX, stripeH);
        ctx.lineTo(drawX - 30, stripeH);

        // Bottom mirrored
        const botY = canvas.height - stripeH;
        ctx.moveTo(drawX, botY);
        ctx.lineTo(drawX + 30, botY);
        ctx.lineTo(drawX, canvas.height);
        ctx.lineTo(drawX - 30, canvas.height);
    }
    ctx.fill();
    ctx.restore();

    // 3. Glitch Text
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Random glitch offset
    const gx = (Math.random() - 0.5) * 10 * flash;
    const gy = (Math.random() - 0.5) * 5 * flash;

    // Glitch Shadows
    ctx.font = "bold 80px 'Courier New', monospace";
    ctx.fillStyle = `rgba(0, 255, 255, 0.5)`;
    ctx.fillText(mainText, cx + gx, cy - 20 + gy);
    ctx.fillStyle = `rgba(255, 0, 255, 0.5)`;
    ctx.fillText(mainText, cx - gx, cy - 20 - gy);

    // Main Text
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    ctx.fillStyle = "#fff";
    ctx.fillText(mainText, cx, cy - 20);

    // Subtext (Blinking)
    if (Math.floor(time * 4) % 2 === 0) {
        ctx.font = "bold 32px 'Courier New', monospace";
        ctx.fillStyle = color;
        ctx.fillText(`- ${subText} -`, cx, cy + 60);
    }

    ctx.restore();
}
