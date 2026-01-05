/* =========================================================
   input.js
   - Keyboard & Mouse Listeners
   ========================================================= */

const defaultKeyMap = {
    moveLeft: "ArrowLeft",
    moveRight: "ArrowRight",
    moveUp: "ArrowUp",
    moveDown: "ArrowDown",
    shoot: "Space",
    pause: "Escape",
};

// ✅ 一定要先宣告 keyMap
let keyMap = { ...defaultKeyMap };

// ✅ 讀取設定函式
function loadKeySettings() {
    const savedKeyMap = localStorage.getItem("keyMap");
    if (savedKeyMap) {
        try {
            // 先重置回預設，再覆蓋設定 (防止舊 key殘留)
            Object.assign(keyMap, defaultKeyMap, JSON.parse(savedKeyMap));
            console.log("Keys loaded:", keyMap);
        } catch (err) {
            console.warn("keyMap parse failed:", err);
        }
    }
}

// 初始讀取
loadKeySettings();

// ==========================
// 4) 輸入系統
// ==========================
window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    state.mouse.x = e.clientX - rect.left;
    state.mouse.y = e.clientY - rect.top;

    // =========================
    // UI Hover 判定
    // =========================
    state.uiHover = null;

    // 👉 暫停畫面
    if (state.mode === "pause") {
        const { resumeRect, restartRect, homeRect } = getPauseRects();
        const mx = state.mouse.x;
        const my = state.mouse.y;

        if (hitRect(mx, my, resumeRect)) state.uiHover = "resume";
        else if (hitRect(mx, my, restartRect)) state.uiHover = "restart";
        else if (hitRect(mx, my, homeRect)) state.uiHover = "home";
    }

    // 👉 結算畫面（gameover / victory）
    if (state.mode === "gameover" || state.mode === "victory") {
        const { restartRect, homeRect } = getResultRects();
        const mx = state.mouse.x;
        const my = state.mouse.y;

        if (hitRect(mx, my, restartRect)) state.uiHover = "restart";
        else if (hitRect(mx, my, homeRect)) state.uiHover = "home";
    }
});
window.addEventListener("mousedown", (e) => {
    // === Pause Menu：點按鈕 ===
    if (state.mode === "pause") {
        const { resumeRect, restartRect, homeRect } = getPauseRects();
        const mx = state.mouse.x, my = state.mouse.y;

        const hit = (r) => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;

        if (hit(resumeRect)) {
            state.mode = "play";
            state.paused = false;
            return;
        }

        if (hit(restartRect)) {
            loadKeySettings(); // ⭐ 強制重新讀取按鍵設定
            restartGame();     // ⭐ 新增
            state.mode = "play";
            state.paused = false;
            return;
        }

        if (hit(homeRect)) {
            goHome();
            return;
        }
        return; // pause 狀態不讓射擊
    }

    if (state.mode === "gameover" || state.mode === "victory") {
        const { restartRect, homeRect } = getResultRects();
        const mx = state.mouse.x, my = state.mouse.y;

        const hit = (r) =>
            mx >= r.x && mx <= r.x + r.w &&
            my >= r.y && my <= r.y + r.h;

        if (hit(restartRect)) {
            loadKeySettings(); // ⭐ 強制重新讀取按鍵設定
            restartGame();
            state.mode = "play";
            state.paused = false;
        }

        if (hit(homeRect)) {
            goHome();
        }
        return;
    }

    if (state.uiHover) {
        state.uiPressed = state.uiHover;
    }


    // 卡牌選擇模式：處理點卡
    if (state.mode === "card") {
        const rects = getCardRects();
        const mx = state.mouse.x;
        const my = state.mouse.y;

        for (let i = 0; i < rects.length; i++) {
            const r = rects[i];
            if (
                mx >= r.x &&
                mx <= r.x + r.w &&
                my >= r.y &&
                my <= r.y + r.h
            ) {
                chooseCard(i);
                return; // 選到就結束，不觸發射擊
            }
        }
        return;
    }

    // 遊戲進行中：才允許射擊
    if (state.mode === "play") {
        state.mouse.down = true;
    }
});

window.addEventListener("mouseup", () => {
    state.mouse.down = false;
    state.uiPressed = null;   // ⭐ 新增這行
});

let escLock = false;

window.addEventListener("keydown", (e) => {
    const code = e.code; // ✅ 用 code

    // 用 keyMap.pause 來判斷暫停鍵
    if (code === keyMap.pause) {
        if (escLock) return;
        escLock = true;

        if (state.mode === "play") {
            state.mode = "pause";
            state.paused = true;
            state.mouse.down = false;
        } else if (state.mode === "pause") {
            state.mode = "play";
            state.paused = false;
        }
        return; // pause 鍵不進 keys
    }

    state.keys.add(code);
});

window.addEventListener("keyup", (e) => {
    const code = e.code;

    if (code === keyMap.pause) {
        escLock = false;
        return;
    }

    state.keys.delete(code);
});

// ===== 輸入判斷（設定鍵位用）=====
function isDown(action) {
    const code = keyMap[action];
    if (!code) return false;
    return state.keys.has(code);
}

function isShootDown() {
    const shootKey = keyMap.shoot;

    if (!shootKey) return false;

    // 滑鼠射擊
    if (shootKey.startsWith("Mouse")) {
        return state.mouse.down;
    }

    // 鍵盤射擊
    return state.keys.has(shootKey);
}
