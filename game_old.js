/* =========================================================
   game.js (重製版：乾淨骨架 + 可玩核心)
   - WASD 移動
   - 滑鼠瞄準，左鍵射擊
   - 1~4 切換武器：普通 / 散彈 / 雷射 / 爆炸
   - 敵人生成並追蹤玩家
   - 碰撞：子彈打怪、怪碰玩家
   ========================================================= */

// ==========================
// 1) Canvas & 基本設定
// ==========================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const TAU = Math.PI * 2;

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

// ✅ 再把 localStorage 的覆蓋上去
const savedKeyMap = localStorage.getItem("keyMap");
if (savedKeyMap) {
  try {
    Object.assign(keyMap, JSON.parse(savedKeyMap));
  } catch (err) {
    console.warn("keyMap parse failed:", err);
  }
}


// ==========================
// 2) 資料庫：玩家 / 子彈 / 敵人
// ==========================
const PLAYER_DATA = {
  radius: 22,
  baseSpeed: 4.8,
  maxHP: 9999999,

  // 射擊基礎：每幾毫秒能射一次（會被武器覆蓋）
  baseShootCd: 160,
};

const BULLET_TYPES = {
  normal: {
    key: "normal",
    name: "普通",
    speed: 10,
    radius: 5,
    damage: 1,
    lifetime: 900, // ms
    shootCd: 160,
    pierce: 0, // 可穿透次數（0=不穿）
  },

  spread: {
    key: "spread",
    name: "散彈",
    pellets: 6,
    spreadAngle: 0.55, // 弧度，越大越分散
    speed: 9,
    radius: 4,
    damage: 1,
    lifetime: 650,
    shootCd: 320,
    pierce: 0,
  },

  laser: {
    key: "laser",
    name: "雷射",
    // 雷射用「射線」每幀持續傷害，先做簡化版：按下就發射一段時間
    length: 420,
    width: 6,
    dps: 5.5, // 每秒傷害
    duration: 360, // ms 一次雷射維持
    shootCd: 380,
  },

  explosive: {
  key: "explosive",
  name: "爆炸",

  speed: 8,
  radius: 6,

  // 👉 直擊傷害（很痛）
  directDamage: 3.5,

  lifetime: 900,
  shootCd: 420,

  // 👉 爆炸範圍（唯一半徑來源）
  explosionRadius: 70,

  // 👉 爆炸傷害（中心）
  explosionDamage: 2.2,

  // 👉 擴散最低倍率（邊緣）
  minFalloff: 0.4,
},
}

// ==========================
// 掉落物資料
// ==========================
const DROP_TYPES = {
  spread: {
    weaponKey: "spread",
    color: "rgba(255, 200, 80, 1)",
    radius: 14,
    chance: 0.18, // 機率
  },
  laser: {
    weaponKey: "laser",
    color: "rgba(120, 220, 255, 1)",
    radius: 14,
    chance: 0.12,
  },
  explosive: {
    weaponKey: "explosive",
    color: "rgba(255, 120, 120, 1)",
    radius: 14,
    chance: 0.1,
  },
};

const MAX_UPGRADE_LEVEL = 5;

const PLAYER_CARD_POOL = [
  {
    id: "hp_up",
    type: "player",
    name: "生命強化",
    desc: (lv) => `最大生命 +${lv * 2}`,
    canAppear: (p) => p.upgrades.hp < MAX_UPGRADE_LEVEL,
    apply: (p) => {
      p.upgrades.hp += 1;
      p.maxHP += 2;
      p.hp += 2;
    }
  },
  {
    id: "speed_up",
    type: "player",
    name: "機動強化",
    desc: (lv) => `移動速度 +${(lv * 0.3).toFixed(1)}`,
    canAppear: (p) => p.upgrades.speed < MAX_UPGRADE_LEVEL,
    apply: (p) => {
      p.upgrades.speed += 1;
      p.speed += 0.3;
    }
  },
  {
  id: "heal",
  type: "player",
  name: "緊急治療",
  desc: () => "立即回復最大生命的 30%",
  canAppear: (p) => p.hp / p.maxHP < 0.5,
  apply: (p) => {
    const healAmount = Math.floor(p.maxHP * 0.3);
    p.hp = Math.min(p.maxHP, p.hp + healAmount);
    }
  },
  {
  id: "damage_reduction",
  type: "player",
  name: "傷害減免",
  desc: (lv) => `受到傷害 -${Math.min(lv * 8, 40)}%`,
  canAppear: (p) => p.upgrades.damageReduction < 5,
  apply: (p) => {
    p.upgrades.damageReduction += 1;
    p.damageReduction = Math.min(0.4, p.damageReduction + 0.08);
  }
}

];

const WEAPON_CARD_POOL = [
  {
    id: "normal_upgrade",
    type: "weapon",
    weaponKey: "normal",
    name: "普通彈強化",
    canAppear: (p) =>
      p.upgrades.weapons.normal < MAX_UPGRADE_LEVEL,
    desc: (lv) => `普通彈 等級 ${roman(lv)}`,
    apply: (p) => {
      p.upgrades.weapons.normal += 1;

      // 強化內容（示例）
      BULLET_TYPES.normal.damage += 0.4;
      BULLET_TYPES.normal.speed += 0.3;
    }
  },
  {
    id: "spread_upgrade",
    type: "weapon",
    weaponKey: "spread",
    name: "散彈強化",
    canAppear: (p) =>
      p.upgrades.weapons.spread < MAX_UPGRADE_LEVEL,
    desc: (lv) => `散彈 等級 ${roman(lv)}`,
    apply: (p) => {
      p.upgrades.weapons.spread += 1;

      BULLET_TYPES.spread.pellets += 1;
      BULLET_TYPES.spread.damage += 0.2;
    }
  },

  {
  id: "explosive_upgrade",
  type: "weapon",
  weaponKey: "explosive",
  name: "爆炸彈強化",
  canAppear: (p) =>
    p.upgrades.weapons.explosive < MAX_UPGRADE_LEVEL,
  desc: (lv) => `爆炸傷害 & 範圍提升（${roman(lv)}）`,
  apply: (p) => {
    p.upgrades.weapons.explosive += 1;

    BULLET_TYPES.explosive.explosionDamage += 0.6;
    BULLET_TYPES.explosive.explosionRadius += 8;
    }
  },

  {
  id: "laser_upgrade",
  type: "weapon",
  weaponKey: "laser",
  name: "雷射強化",
  canAppear: (p) =>
    p.upgrades.weapons.laser < MAX_UPGRADE_LEVEL,
  desc: (lv) => `雷射輸出與範圍提升（${roman(lv)}）`,
  apply: (p) => {
    p.upgrades.weapons.laser += 1;

    BULLET_TYPES.laser.dps += 1.2;
    BULLET_TYPES.laser.width += 1;
    BULLET_TYPES.laser.duration += 60;
    }
  },

];

const ENEMY_TYPES = {
  basic: {
    key: "basic",
    name: "Basic",
    radius: 18,
    speed: 1.8,
    hp: 3,
    damage: 1,
    score: 10,
    color: "rgba(255, 80, 80, 1)",
    weight: 70,
  },
  fast: {
    key: "fast",
    name: "Fast",
    radius: 14,
    speed: 3.1,
    hp: 2,
    damage: 1,
    score: 14,
    color: "rgba(255, 200, 80, 1)",
    weight: 20,
  },
  tank: {
    key: "tank",
    name: "Tank",
    radius: 26,
    speed: 1.2,
    hp: 8,
    damage: 2,
    score: 25,
    color: "rgba(130, 170, 255, 1)",
    weight: 10,
  },
};

// 依權重抽敵人類型
const ENEMY_POOL = (() => {
  const arr = [];
  for (const k in ENEMY_TYPES) {
    const w = ENEMY_TYPES[k].weight ?? 1;
    for (let i = 0; i < w; i++) arr.push(k);
  }
  return arr;
})();

const ELITE_DATA = {
  radius: 48,
  speed: 1.4,
  maxHP: 120,

  shootCd: 900,
  laserChargeTime: 1200,
  laserDuration: 900,

  bulletSpeed: 4.5,
};

const BOSS_DATA = {
  width: 260,
  height: 420,

  coreRadius: 42,
  maxHP: 800,

  // 行為用計時
  phase: 1,
  attackTimer: 0,

  // 攻擊節奏
  bulletCd: 420,
  laserCharge: 1800,
  laserDuration: 1200,

  normalBullet: {
  speed: 4.2,
  radius: 10,
  damage: 2,
},

};


// ==========================
// 3) 遊戲狀態
// ==========================
const state = {
  time: 0,
  lastTs: performance.now(),
  paused: false,

  score: 0,
  stats: {
    killEnemy: 0,
    killElite: 0,
    killBoss: 0,
    surviveTime: 0, // 秒（最後結算時再算）
  },

  uiHover: null,    // 目前滑鼠指到哪個按鈕
  uiPressed: null, // 目前按下哪個按鈕（可選）

  mouse: { x: canvas.width / 2, y: canvas.height / 2, down: false },
  keys: new Set(),

  player: null,
  bullets: [],
  enemies: [],
  drops: [],
  lasers: [], // 雷射是獨立物件
  explosions: [],
  pendingExplosions: [],
  mode: "play", // play | card
  currentCards: [],
  timer: {
    total: 180,     // 總秒數（3:00）
    remaining: 180, // 剩餘秒數
  },
  elite: null,
  eliteSpawned: false,
  warningTimer: 0,
  boss: null,
  bossSpawned: false,
  enemyLasers: [],
  enemyBullets: [],
  postEliteCardCount: 0,
  bossWarnings: [],
};

function createPlayer() {
  return {
    x: canvas.width / 2,
    y: canvas.height / 2,
    r: PLAYER_DATA.radius,
    speed: PLAYER_DATA.baseSpeed,
    hp: PLAYER_DATA.maxHP,
    maxHP: PLAYER_DATA.maxHP,
    level: 1,
    exp: 0,
    expToNext: 100,
    damageReduction: 0, // 0 ~ 0.4（最多 40%）

    weaponKey: "normal",
    shootCd: PLAYER_DATA.baseShootCd,
    shootTimer: 0,
    weaponTime: 0,        // 剩餘時間（ms）
    weaponDuration: 6000 ,// 每次撿到武器可用多久

    upgrades: {
      hp: 0,       // 血量強化等級
      speed: 0,    // 移動速度強化等級
      damageReduction: 0, 

      weapons: {
        normal: 0, // 普通彈等級 I~V
        spread: 0, // 散彈等級 I~V
        explosive: 0,
        laser: 0,
      }
    },

  };
}

state.player = createPlayer();

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


function setWeapon(key) {
  if (!BULLET_TYPES[key]) return;
  state.player.weaponKey = key;

  // weapon 可能覆蓋射速
  const w = BULLET_TYPES[key];
  state.player.shootCd = w.shootCd ?? PLAYER_DATA.baseShootCd;

  // 切換時稍微重置射擊冷卻避免連發 bug
  state.player.shootTimer = Math.min(state.player.shootTimer, state.player.shootCd);
}

// ==========================
// 5) 生成系統：敵人
// ==========================
let spawnTimer = 0;
let spawnInterval = 1100; // ms，越小越常出（之後可做隨時間變快）

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pickEnemyTypeKey() {
  return ENEMY_POOL[(Math.random() * ENEMY_POOL.length) | 0];
}

function spawnEnemy() {
  const typeKey = pickEnemyTypeKey();
  const t = ENEMY_TYPES[typeKey];

  // 從畫面外圍生成
  const pad = 60;
  const side = (Math.random() * 4) | 0;
  let x, y;
  if (side === 0) { x = rand(-pad, canvas.width + pad); y = -pad; }
  if (side === 1) { x = canvas.width + pad; y = rand(-pad, canvas.height + pad); }
  if (side === 2) { x = rand(-pad, canvas.width + pad); y = canvas.height + pad; }
  if (side === 3) { x = -pad; y = rand(-pad, canvas.height + pad); }

  state.enemies.push({
    typeKey,
    x, y,
    r: t.radius,
    speed: t.speed,
    hp: t.hp,
    maxHP: t.hp,
    damage: t.damage,
    score: t.score,
    color: t.color,
    hitCooldown: 0, // 被打後短暫閃爍
  });
}

function spawnEnemyLaserFromBossCore(b, angle) {
  const core = getBossCorePos(b);

  state.enemyLasers.push({
    x: core.x,
    y: core.y,
    angle: angle,

    length: 900,
    width: 10,
    dps: 1.2,
    duration: 900,
    time: 0,
    color: "red",
  });
}

function spawnEnemyLaser(x, y, angle) {
  state.enemyLasers.push({
    x: x,
    y: y,
    angle: angle,

    length: 800,
    width: 8,
    dps: 1,
    duration: 180,
    time: 0,

    moveAngle: 0,
    color: "rgba(255,0,0,0.95)", // ✅ 補上顏色
  });
}

function laserHitPlayer(laser, dt) {
  const p = state.player;

  // 雷射起點
  const x1 = laser.x;
  const y1 = laser.y;

  // 雷射終點
  const x2 = x1 + Math.cos(laser.angle) * laser.length;
  const y2 = y1 + Math.sin(laser.angle) * laser.length;

  // 玩家到雷射線段距離
  const dist = pointToSegmentDistance(
    p.x,
    p.y,
    x1,
    y1,
    x2,
    y2
  );

  if (dist <= laser.width / 2 + p.r) {
    const damage = laser.dps * (dt / 1000);
    p.hp -= damage * (1 - p.damageReduction);
  }
}



// ==========================
// 6) 發射系統：子彈 / 雷射
// ==========================
function angleToMouse() {
  const p = state.player;
  return Math.atan2(state.mouse.y - p.y, state.mouse.x - p.x);
}

function shoot(dt) {
  const p = state.player;
  p.shootTimer -= dt;
  if (!isShootDown()) return;
  if (p.shootTimer > 0) return;

  const w = BULLET_TYPES[p.weaponKey];
  p.shootTimer = p.shootCd;

  const ang = angleToMouse();

  if (p.weaponKey === "spread") {
    const pellets = w.pellets ?? 5;
    for (let i = 0; i < pellets; i++) {
      const offset = rand(-w.spreadAngle, w.spreadAngle);
      spawnBullet(ang + offset, w);
    }
    return;
  }

  if (p.weaponKey === "laser") {
    state.lasers.push({
      x: p.x,
      y: p.y,
      ang,
      length: w.length,
      width: w.width,
      dps: w.dps,
      timeLeft: w.duration,
    });
    return;
  }

  // normal / explosive
  spawnBullet(ang, w);
}

function spawnBullet(ang, w) {
  const p = state.player;
  const vx = Math.cos(ang) * w.speed;
  const vy = Math.sin(ang) * w.speed;
  state.bullets.push({
    x: p.x,
    y: p.y,
    vx, vy,
    r: w.radius,
    damage: w.damage,
    pierce: w.pierce ?? 0,
    timeLeft: w.lifetime,
    typeKey: w.key,
    exploded: false,
  });
}

// ==========================
// 7) 碰撞工具
// ==========================
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

//卡牌等級
function roman(lv) {
  const map = ["I", "II", "III", "IV", "V"];
  return map[Math.min(lv - 1, 4)];
}

//卡牌版面資料
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

function getBossCorePos(b) {
  return {
    x: b.x + (b.coreOffsetX ?? 0),
    y: b.y + (b.coreOffsetY ?? 0),
  };
}



//圓角矩形繪製
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

/*function isKeyDown(action) {
  const code = keyMap[action];
  if (!code) return false;
  return state.keys.has(code.toLowerCase());
}*/

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;

  if (len2 === 0) return Math.hypot(px - x1, py - y1);

  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const cx = x1 + t * dx;
  const cy = y1 + t * dy;

  return Math.hypot(px - cx, py - cy);
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

  const resumeRect  = { x: cx - w/2, y: cy + 40,                 w, h };
  const restartRect = { x: cx - w/2, y: cy + 40 + (h + gap) * 1, w, h };
  const homeRect    = { x: cx - w/2, y: cy + 40 + (h + gap) * 2, w, h };

  return { resumeRect, restartRect, homeRect };
}


function restartGame() {
  // 玩家（你要重置位置也可以）
  state.player.hp = state.player.maxHP; // ✅ maxHP
  state.player.x = 160;
  state.player.y = canvas.height / 2;

  // 清場
  state.bullets.length = 0;
  state.enemyBullets.length = 0;
  state.enemyLasers.length = 0;
  state.enemies.length = 0;
  state.drops.length = 0;
  state.lasers.length = 0;
  state.explosions.length = 0;
  state.pendingExplosions.length = 0;

  // 菁英 / Boss
  state.elite = null;          // ✅ 不是 length
  state.eliteSpawned = false;
  state.boss = null;
  state.bossSpawned = false;
  state.bossWarnings.length = 0;

  // 計時器（看你要不要也重置）
  state.timer.remaining = state.timer.total;

  // 分數
  state.score = 0;
  state.stats.killEnemy = 0;
  state.stats.killElite = 0;
  state.stats.killBoss = 0;
  state.stats.surviveTime = 0;

  // 模式
  state.mode = "play";
  state.paused = false;
}


function goHome() {
  window.location.href = "index.html";
}

function enterGameOver() {
  // 結算存活時間（你是倒數，所以這樣算）
  state.stats.surviveTime =
    state.timer.total - state.timer.remaining;

  state.mode = "gameover";
  state.paused = true;
}

function enterVictory() {
  state.stats.surviveTime =
    state.timer.total - state.timer.remaining;

  state.mode = "victory";
  state.paused = true;
}

function getResultRects() {
  const w = 260, h = 60;
  const cx = canvas.width / 2;
  const y = canvas.height / 2 + 120;

  return {
    restartRect: { x: cx - w/2, y, w, h },
    homeRect: {
      x: cx - w / 2,
      y: y + 80,   // ⭐ 這樣才對
      w,
      h
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



function trySprayDrop(entity, chance, cooldown, sprayOptions = {}) {
  if (!entity) return;
  if (entity.dropCooldown > 0) return;

  if (Math.random() < chance) {
    // ⭐ 在這裡決定噴射位置
    const pos = getSprayDropPos(
      entity.x,
      entity.y,
      sprayOptions
    );
    trySpawnDrop(pos.x, pos.y);
    entity.dropCooldown = cooldown;
  }
}

function getSprayDropPos(originX, originY, {
  minDist = 60,
  maxDist = 140,
  minAngle = -Math.PI / 3,
  maxAngle =  Math.PI / 3,
  baseAngle = Math.PI, // 預設往左
} = {}) {
  const dist = rand(minDist, maxDist);
  const ang = baseAngle + rand(minAngle, maxAngle);

  return {
    x: originX + Math.cos(ang) * dist,
    y: originY + Math.sin(ang) * dist,
  };
}

function getEliteBarrelMuzzle(e, sideOffset) {
  const p = state.player;

  // 朝向玩家
  const ang = Math.atan2(p.y - e.y, p.x - e.x);

  // 垂直方向（左右砲管偏移）
  const px = Math.cos(ang + Math.PI / 2);
  const py = Math.sin(ang + Math.PI / 2);

  // 砲管起點
  const sx =
    e.x +
    px * sideOffset +
    Math.cos(ang) * (e.r * 0.55);
  const sy =
    e.y +
    py * sideOffset +
    Math.sin(ang) * (e.r * 0.55);

  // 砲口位置
  const len = 28;
  const mx = sx + Math.cos(ang) * len;
  const my = sy + Math.sin(ang) * len;

  return { x: mx, y: my, angle: ang };
}

function updateElite(dt) {
  const p = state.player;
  const e = state.elite;

   // 強制進場（還沒完全進畫面前）
  if (e.y < e.r + 20) {
    e.y += 2.2;
    return;
  }

  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy);

  // === 雷射鎖定中：不能動、不能射 ===
if (e.laserLockTime > 0) {
  e.laserLockTime -= dt;
  if (e.laserLockTime < 0) e.laserLockTime = 0;
  return;
}

  // 移動（蓄力時停下）
  if (!e.charging && d > 1) {
    e.x += (dx / d) * ELITE_DATA.speed;
    e.y += (dy / d) * ELITE_DATA.speed;
  }

  // === 玩家接觸菁英怪傷害 ===
//const p = state.player;
const rr = e.r + p.r;

const push = pushCircleOut(p.x, p.y, p.r, e.x, e.y, e.r);
if (push) {
  p.x = push.x;
  p.y = push.y;
}


if (dist2(e.x, e.y, p.x, p.y) <= rr * rr) {
  if (e.contactCooldown <= 0) {
    const dmg = e.contactDamage * (1 - p.damageReduction);
    p.hp -= dmg;
    e.contactCooldown = 600; // 0.6 秒冷卻
  }
}

if (e.contactCooldown > 0) {
  e.contactCooldown -= dt;
}

  e.shootTimer -= dt;

  // 普通射擊
  if (!e.charging && e.shootTimer <= 0) {
    fireEliteBullet(e);
    e.shootTimer = ELITE_DATA.shootCd;
  }

  // 隨機進入必殺
  if (!e.charging && Math.random() < 0.002) {
    e.charging = true;
    e.laserTimer = ELITE_DATA.laserChargeTime;
  }

  // 蓄力中
  if (e.charging) {
    e.laserTimer -= dt;
    if (e.laserTimer <= 0) {
      fireEliteLaser(e);
      e.charging = false;
      e.laserTimer = ELITE_DATA.laserDuration;
    }
  }
}

function updateBoss(dt) {
  const b = state.boss;
  if (!b) return;

  b.stateTimer -= dt;

  switch (b.attackState) {

    case "idle":
      if (b.stateTimer <= 0) {
        chooseNextBossAttack(b);
      }
      break;

    case "tripleShot":
      updateBossTripleShot(b, dt);
      break;

    case "fanSweep":
      updateBossFanSweep(b, dt);
      break;

    case "laserCharge": {
  // 蓄力狀態
  b.charging = true;

  if (b.stateTimer <= 0) {
    b.charging = false;

    // 清掉警告提示
    state.bossWarnings.length = 0;

    // ⭐ 根據「已決定」的雷射種類執行
    if (b.pendingLaser === "clamp") {
      fireBossFanClampLasers(b);
      b.attackState = "laserVertical";
      b.stateTimer = 2200;
    } else if (b.pendingLaser === "core") {
      fireBossCoreLaser(b);
      b.attackState = "laserCore";
      b.stateTimer = 1600;
    }

    // 用完就清，避免殘留
    b.pendingLaser = null;
  }
  break;
}


    case "laserVertical":
      updateBossVerticalLaser(b, dt);
      break;

    case "laserCore":
      updateBossCoreLaser(b, dt);
      break;
  }

  if (b.shakeTime > 0) {
    b.shakeTime -= dt;
    if (b.shakeTime < 0) b.shakeTime = 0;
  }
}

function updateBossVerticalLaser(b, dt) {
  // 這個狀態期間 Boss 不要亂動（你想要雷射結束才動）
  b.canMove = false;

  // 雷射物件本身會在 updateEnemyLasers() 裡自己倒數/移動/消失
  // 這裡只要等時間到就回 idle
  if (b.stateTimer <= 0) {
    b.canMove = true;
    b.attackState = "idle";
    b.stateTimer = 900; // 下一次攻擊前的喘息時間
  }
}

function updateBossCoreLaser(b, dt) {
  b.canMove = false;

  if (b.stateTimer <= 0) {
    b.canMove = true;
    b.attackState = "idle";
    b.stateTimer = 900;
  }
}

function updateBossTripleShot(b, dt) {
  // 每隔一段時間射一次三連發
  b.attackCooldown -= dt;

  if (b.attackCooldown <= 0) {
    fireBossTripleShot(b);
    b.attackCooldown = 320; // 每 320ms 射一次（你可調 260~420）
  }

  // 狀態時間到就回 idle（留喘息）
  if (b.stateTimer <= 0) {
    b.attackState = "idle";
    b.stateTimer = 700;     // 攻擊間隔喘息
    b.attackCooldown = 0;   // 重置
  }
}

function updateBossFanSweep(b, dt) {
  // 初始化（第一次進 fanSweep）
  if (!b.sweepInit) {
    b.sweepInit = true;
    b.sweepDir = 1;                 // 1 or -1 來回
    b.sweepAngle = getBossAimAngleLeftOnly(b) - 0.7;        // 起始偏左
    b.sweepSpeed = 0.010;            // 掃射角速度（越小越好躲）
    b.sweepSpread = 0.35;            // 每次三發之間角度差
    b.attackCooldown = 0;            // 用同一套冷卻
  }

  // 射擊冷卻
  b.attackCooldown -= dt;
  if (b.attackCooldown <= 0) {
    // 每次噴 3 發，但「每次間隔」要留空隙
    for (let i = -1; i <= 1; i++) {
      const ang = b.sweepAngle + i * b.sweepSpread;
      const core = getBossCorePos(b);

      state.enemyBullets.push({
        x: core.x,
        y: core.y,
        vx: Math.cos(ang) * 4.2,
        vy: Math.sin(ang) * 4.2,
        r: 9,
        damage: 1.2,
      });
    }
    b.attackCooldown = 140; // 子彈間隔：調大更好躲（例如 140~220）
  }

  // 掃射角度來回
  b.sweepAngle += b.sweepSpeed * b.sweepDir * dt;

  // 到邊界就換方向（這裡控制扇形「來回」）
  const centerAng = getBossAimAngleLeftOnly(b);
  const leftBound = centerAng - 0.9;
  const rightBound = centerAng + 0.9;

  if (b.sweepAngle < leftBound) b.sweepDir = 1;
  if (b.sweepAngle > rightBound) b.sweepDir = -1;

  // 狀態結束就回 idle
  if (b.stateTimer <= 0) {
    b.attackState = "idle";
    b.stateTimer = 700;
    b.sweepInit = false;
  }
}

// ==========================
// 8) 更新（Update）
// ==========================
function update(dt) {
  const p = state.player;

  // ---- 玩家移動
  let mx = 0, my = 0;
  if (isDown("moveUp"))    my -= 1;
  if (isDown("moveDown"))  my += 1;
  if (isDown("moveLeft"))  mx -= 1;
  if (isDown("moveRight")) mx += 1;

  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my) || 1;
    mx /= len; my /= len;
    p.x += mx * p.speed;
    p.y += my * p.speed;
  }

  // 邊界限制
  p.x = Math.max(p.r, Math.min(canvas.width - p.r, p.x));
  p.y = Math.max(p.r, Math.min(canvas.height - p.r, p.y));

  // ---- 射擊
  shoot(dt);

  // ---- 更新子彈
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.timeLeft -= dt;

    // 出界或壽命到
    if (
      b.timeLeft <= 0 ||
      b.x < -80 || b.x > canvas.width + 80 ||
      b.y < -80 || b.y > canvas.height + 80
    ) {
      state.bullets.splice(i, 1);
      continue;
    }
  }

  // ---- 更新雷射
  for (let i = state.lasers.length - 1; i >= 0; i--) {
    const l = state.lasers[i];
    l.x = p.x;
    l.y = p.y;
    l.ang = angleToMouse();
    l.timeLeft -= dt;
    if (l.timeLeft <= 0) state.lasers.splice(i, 1);
  }

  // ---- 爆炸特效更新
for (let i = state.explosions.length - 1; i >= 0; i--) {
  const ex = state.explosions[i];
  ex.time += dt;
  if (ex.time >= ex.duration) {
    state.explosions.splice(i, 1);
  }
}

  // ---- 生成敵人（只在 play，且沒有菁英時）
if (state.mode === "play" && !state.elite && !state.boss) {
  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnEnemy();
    spawnInterval = Math.max(420, spawnInterval * 0.997);
  }
}

  // ---- 更新敵人（追蹤玩家）
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];

    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    e.x += Math.cos(ang) * e.speed;
    e.y += Math.sin(ang) * e.speed;

    e.hitCooldown = Math.max(0, e.hitCooldown - dt);

    // 敵人碰到玩家
    const rr = (e.r + p.r);
    if (dist2(e.x, e.y, p.x, p.y) <= rr * rr) {
      const finalDamage = e.damage * (1 - p.damageReduction);
      p.hp -= finalDamage;
      const push = 18;
      e.x -= Math.cos(ang) * push;
      e.y -= Math.sin(ang) * push;

      if (p.hp <= 0) {
        // 死亡重置（先簡單處理）
        enterGameOver();
        return;
      }
    }
  }

  // ---- 撿取掉落物（方塊）
for (let i = state.drops.length - 1; i >= 0; i--) {
  const d = state.drops[i];
  const half = d.size / 2;
  const pr = state.player.r;

  const hit =
    state.player.x > d.x - half - pr &&
    state.player.x < d.x + half + pr &&
    state.player.y > d.y - half - pr &&
    state.player.y < d.y + half + pr;

  if (hit) {
    setWeapon(d.weaponKey);          // 切換武器
    state.player.weaponTime = state.player.weaponDuration;
    state.drops.splice(i, 1);
  }
}

// --- 掉落冷卻倒數 ---
if (state.elite && state.elite.dropCooldown > 0) {
  state.elite.dropCooldown -= dt;
}

if (state.boss && state.boss.dropCooldown > 0) {
  state.boss.dropCooldown -= dt;
}

    // ---- 武器時間倒數
    if (state.player.weaponKey !== "normal") {
        state.player.weaponTime -= dt;
    if (state.player.weaponTime <= 0) {
        setWeapon("normal");
        state.player.weaponTime = 0;
        }
    }
  // ---- 子彈打中敵人
  bulletHitEnemies();

  // ---- 雷射傷害
  laserHitEnemies(dt);

  if (state.pendingExplosions.length > 0) {
  for (const ex of state.pendingExplosions) {
    explodeAt(ex.x, ex.y, ex.weapon);
  }
    state.pendingExplosions.length = 0;
  }

  // === 倒計時 ===
if (state.mode === "play" && state.timer.remaining > 0 &&
  !state.elite &&
  !state.boss) {
  state.timer.remaining -= dt / 1000;
  if (state.timer.remaining < 0) {
    state.timer.remaining = 0;
  }
}

if (!state.eliteSpawned && state.timer.remaining <= state.timer.total / 2) {
  state.eliteSpawned = true;
  triggerEliteWarning();
}

if (!state.bossSpawned && state.timer.remaining <= 0) {
  state.bossSpawned = true;
  triggerBossWarning();
}
if (state.mode === "bossWarning") {
  state.warningTimer -= dt;
  if (state.warningTimer <= 0) {
    spawnFinalBoss();
    state.mode = "play";
  }
  return; // ✅ WARNING 時暫停其他更新（跟 elite 一樣）
}

if (state.elite) {
  updateElite(dt);
}

if (state.boss) {
  updateBoss(dt);
}

// === 玩家接觸 Boss 傷害 ===
if (state.boss) {
  const b = state.boss;
  const p = state.player;

  // 用「玩家圓 + Boss 外殼矩形」
  const rx = b.x - BOSS_DATA.width / 2;
  const ry = b.y - BOSS_DATA.height / 2;
  const rw = BOSS_DATA.width;
  const rh = BOSS_DATA.height;

  if (b.shellStage < 2 &&circleRectHit(p.x, p.y, p.r, rx, ry, rw, rh)) {
    if (!b.contactCooldown || b.contactCooldown <= 0) {
      const dmg = 2.5 * (1 - p.damageReduction); // Boss 接觸傷害
      p.hp -= dmg;
      b.contactCooldown = 500; // ms
    }
     // ⭐ 彈開（重點）
    const push = pushCircleOutOfRect(
      p.x, p.y, p.r,
      rx, ry, rw, rh
    );
    if (push) {
      p.x = push.x;
      p.y = push.y;
    }
  }

  // =========================
  // ② 核心接觸（圓形）
  // =========================
  if (b.shellStage >= 2) {
    const rr = p.r + BOSS_DATA.coreRadius;
    const core = getBossCorePos(b);
    const d2 = dist2(p.x, p.y, core.x, core.y);

    if (d2 <= rr * rr) {
      if (!b.coreContactCooldown || b.coreContactCooldown <= 0) {
        const dmg = 2.2 * (1 - p.damageReduction);
        p.hp -= dmg;
        b.coreContactCooldown = 500;
      }

      // ⭐ 彈開（核心）
      const push = pushCircleOut(
        p.x, p.y, p.r,
        b.x, b.y, BOSS_DATA.coreRadius
      );
      if (push) {
        p.x = push.x;
        p.y = push.y;
      }
    }
  }

  // =========================
  // ③ 冷卻倒數
  // =========================
  if (b.contactCooldown > 0) {
    b.contactCooldown -= dt;
  }
  if (b.coreContactCooldown > 0) {
    b.coreContactCooldown -= dt;
  }
}

if (state.mode === "eliteWarning") {
  state.warningTimer -= dt;
  if (state.warningTimer <= 0) {
    spawnElite();
    state.mode = "play";
  }
  return; // WARNING 時暫停其他更新
}

// === 更新敵人雷射 ===
for (let i = state.enemyLasers.length - 1; i >= 0; i--) {
  const l = state.enemyLasers[i];
  l.time += dt;

  if (l.moveY !== undefined) {
    l.y += l.moveY * dt;
  }

  // ⭐ 新增：角度旋轉（指針扇形用）
  if (l.moveAngle !== undefined) {
    l.angle += l.moveAngle * dt;
  }

  if (l.clampTarget !== undefined && l.moveAngle !== undefined) {
  // 上指針與下指針都用「越過就停」的方式
  if ((l.moveAngle > 0 && l.angle >= l.clampTarget) ||
      (l.moveAngle < 0 && l.angle <= l.clampTarget)) {
    l.angle = l.clampTarget;
    l.moveAngle = 0;
  }
}


  if (l.time >= l.duration) {
    state.enemyLasers.splice(i, 1);
    continue;
  }

  laserHitPlayer(l, dt);
}

// === 更新敵人子彈 ===
for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
  const b = state.enemyBullets[i];
  b.x += b.vx;
  b.y += b.vy;

  if (
    b.x < -50 || b.x > canvas.width + 50 ||
    b.y < -50 || b.y > canvas.height + 50
  ) {
    state.enemyBullets.splice(i, 1);
    continue;
  }

  const rr = b.r + state.player.r;
  if (dist2(b.x, b.y, state.player.x, state.player.y) <= rr * rr) {
    const dmg = b.damage * (1 - state.player.damageReduction);
    state.player.hp -= dmg;
    state.enemyBullets.splice(i, 1);

    if (state.player.hp <= 0) {
      enterGameOver();
      return;
    }
  }
}
}

function trySpawnDrop(x, y) {
  for (const key in DROP_TYPES) {
    const d = DROP_TYPES[key];
    if (Math.random() < d.chance) {

      // ⭐ 移除場上同類型掉落物
      for (let i = state.drops.length - 1; i >= 0; i--) {
        if (state.drops[i].typeKey === key) {
          state.drops.splice(i, 1);
        }
      }

      state.drops.push({
        x,
        y,
        size: 28,              // 正方形邊長
        weaponKey: d.weaponKey,
        typeKey: key,          // ⭐ spread / laser / explosive
        color: d.color,
      });
      break; // 一次只掉一個
    }
  }
}

function gainExp(amount) {
  const p = state.player;
  p.exp += amount;

  while (p.exp >= p.expToNext) {
    p.exp -= p.expToNext;
    p.level += 1;
    p.expToNext = calcExpToNext(p.level);

    // 每 5 級進入卡牌選擇
    if (p.level % 1 === 0) {
      enterCardSelect();
      break; // 卡牌選擇期間不再連續升級
    }
  }
}


function getAvailableCards() {
  const p = state.player;
  return [
    ...PLAYER_CARD_POOL,
    ...WEAPON_CARD_POOL
  ].filter(card => card.canAppear(p));
}

function drawCards(count = 3) {
  const pool = getAvailableCards();
  const result = [];

  while (pool.length > 0 && result.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }

  return result;
}

function enterCardSelect() {
  const cards = drawCards(3);

  // ⭐ 如果真的沒卡可選，直接跳過卡牌階段
  if (cards.length === 0) {
    state.mode = "play";
    state.paused = false;
    return;
  }

  state.mode = "card";
  state.paused = true;
  state.currentCards = cards;
  state.cardUI = state.currentCards.map(() => ({
  scale: 1,
  lift: 0,
  glow: 0,
}));

}

function chooseCard(index) {
  const card = state.currentCards[index];
  if (!card) return;

  // 套用效果
  card.apply(state.player);

  state.currentCards = [];

  // === 還有剩餘抽卡次數 ===
  if (state.postEliteCardCount > 1) {
    state.postEliteCardCount -= 1;
    rollCards();        // ⭐ 再抽一次
    return;             // 留在 card mode
  }

  // === 抽卡結束 ===
  state.postEliteCardCount = 0;
  state.mode = "play";
  state.paused = false;
}


function rollCards() {
  state.currentCards = drawCards(3);

  // 如果真的沒有卡可選，直接回遊戲
  if (state.currentCards.length === 0) {
    state.mode = "play";
    state.paused = false;
    state.postEliteCardCount = 0;
    return;
  }

  state.cardUI = state.currentCards.map(() => ({
    scale: 1,
    lift: 0,
    glow: 0,
  }));
}

function bulletHitEnemies() {
  for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
    // === 子彈先檢查 Boss ===
if (state.boss) {
  const boss = state.boss;

  // =========================
  // 1️⃣ 外殼還在 → 打矩形
  // =========================
  if (boss.shellStage < 2) {
    const rx = boss.x - BOSS_DATA.width / 2;
    const ry = boss.y - BOSS_DATA.height / 2;
    const rw = BOSS_DATA.width;
    const rh = BOSS_DATA.height;

    if (circleRectHit(b.x, b.y, b.r, rx, ry, rw, rh)) {
      const dmg = (b.typeKey === "explosive")
      ? BULLET_TYPES.explosive.directDamage
      : b.damage;

      boss.shellHP -= dmg;
      boss.hp      -= dmg;

      trySprayDrop(boss, 0.30, 1600, {
        minDist: boss.shellStage < 2
        ? BOSS_DATA.width / 2 + 60
        : BOSS_DATA.coreRadius + 30,
      maxDist: 420,
      minAngle: -0.6,
      maxAngle: 0.6,
      baseAngle: Math.PI, // 左側
    });

      if (b.typeKey === "explosive" && !b.exploded) {
        b.exploded = true;
        state.pendingExplosions.push({
          x: b.x,
          y: b.y,
        weapon: BULLET_TYPES.explosive
      });
    }


      // 只有外殼階段才震
      boss.shakeTime = 120;
      boss.shakePower = 6;

      state.bullets.splice(bi, 1);

      const ratio = boss.hp / boss.maxHP;

      // 外殼開始裂（80%）
      if (ratio <= 0.8 && boss.shellStage === 0) {
        boss.shellStage = 1;
        generateShellCracks(boss);
      }

      // 外殼完全碎裂（50%）
      if (ratio <= 0.5 && boss.shellStage === 1) {
        boss.shellStage = 2;

        // 殼碎，停止震動
        boss.shakeTime = 0;
        boss.shakePower = 0;

        // 裂痕清空（殼都沒了就別畫了）
        boss.cracks = [];
      }

      continue;
    }
  }

  // 外殼碎了 → 只打核心
else {
  const rr = b.r + BOSS_DATA.coreRadius;
  if (dist2(b.x, b.y, boss.x, boss.y) <= rr * rr) {

    const dmg = (b.typeKey === "explosive")
      ? BULLET_TYPES.explosive.directDamage
      : b.damage;

    boss.hp -= dmg;

    // ⭐ 你如果也想核心被打會噴掉落物，就放這（下面第2段我會教怎麼噴更遠）
    trySprayDrop(boss, 0.30, 1600, {
      minDist: BOSS_DATA.coreRadius + 80,
      maxDist: 420,
      minAngle: -0.9,
      maxAngle: 0.9,
      baseAngle: Math.PI, // 往左扇形
    });

    state.bullets.splice(bi, 1);
    continue;
  }
}
if (boss.hp <= 0) {
  state.stats.killBoss += 1;
  enterVictory();
  return;
}

}


    // === 子彈先檢查菁英怪 ===
if (state.elite) {
  const e = state.elite;
  const rr = b.r + e.r;

  if (dist2(b.x, b.y, e.x, e.y) <= rr * rr) {

    const dmg = (b.typeKey === "explosive")
    ? BULLET_TYPES.explosive.directDamage
    : b.damage;
    // 傷害
    e.hp -= dmg;

    // 爆炸彈觸發爆炸
    if (b.typeKey === "explosive" && !b.exploded) {
      b.exploded = true;
      state.pendingExplosions.push({
        x: b.x,
        y: b.y,
        weapon: BULLET_TYPES.explosive
      });
    }

    // 移除子彈
    state.bullets.splice(bi, 1);

    // ⭐ 命中時噴掉落物
    trySprayDrop(e, 0.30, 1200, {
      minDist: 40,
      maxDist: 90,
      minAngle: -Math.PI,
      maxAngle: Math.PI,
      baseAngle: 0,
    }); // ⭐ 30%

    // 菁英死亡
    if (e.hp <= 0) {
      killElite();
    }

    continue; // 這顆子彈處理完了
  }
}

    for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
      const e = state.enemies[ei];
      const rr = b.r + e.r;

      if (dist2(b.x, b.y, e.x, e.y) <= rr * rr) {

        // === 傷害處理 ===
        if (b.typeKey === "explosive") {
          e.hp -= BULLET_TYPES.explosive.directDamage;

          // ⭐ 爆炸只排一次，且立刻移除子彈
          if (!b.exploded) {
            b.exploded = true;
            state.pendingExplosions.push({
              x: b.x,
              y: b.y,
              weapon: BULLET_TYPES.explosive
            });
          }

          // 爆炸彈命中即消失（不穿透）
          state.bullets.splice(bi, 1);

        } else {
          // 非爆炸彈
          e.hp -= b.damage;
          e.hitCooldown = 80;

          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            state.bullets.splice(bi, 1);
          }
        }

        // === 敵人死亡 ===
        if (e.hp <= 0) {
          state.score += e.score;
          gainExp(e.score);
          trySpawnDrop(e.x, e.y);
          state.stats.killEnemy += 1;
          state.enemies.splice(ei, 1);
        }

        // ⭐ 命中後，這顆子彈的工作結束
        break;
      }
    }
  }
}


function explodeAt(x, y, w) {
  // === 視覺特效（與判定半徑完全一致）
  state.explosions.push({
    x,
    y,
    radius: w.explosionRadius,
    time: 0,
    duration: 260,
  });

  const maxR = w.explosionRadius;
  const maxR2 = maxR * maxR;

  for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
    const e = state.enemies[ei];
    const d2 = dist2(x, y, e.x, e.y);

    if (d2 <= maxR2) {
      const d = Math.sqrt(d2);

      // 0（中心） → 1（邊緣）
      const t = d / maxR;

      // 傷害衰減（線性）
      const falloff =
        w.minFalloff + (1 - w.minFalloff) * (1 - t);

      const dmg = w.explosionDamage * falloff;

      e.hp -= dmg;
      e.hitCooldown = 120;

      if (e.hp <= 0) {
        state.score += e.score;
        gainExp(e.score);
        trySpawnDrop(e.x, e.y);
        state.enemies.splice(ei, 1);
      }
    }
  }
}

function laserHitEnemies(dt) {
  if (state.lasers.length === 0) return;

  // 簡化：把雷射看成一條線段，敵人中心到線段距離 < (敵人半徑 + 雷射寬度/2) 就受傷
  for (const l of state.lasers) {
    const damageThisFrame = (l.dps * dt) / 1000;

    const x1 = l.x;
    const y1 = l.y;
    const x2 = x1 + Math.cos(l.ang) * l.length;
    const y2 = y1 + Math.sin(l.ang) * l.length;

    for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
      const e = state.enemies[ei];
      const d = pointToSegmentDistance(e.x, e.y, x1, y1, x2, y2);
      if (d <= e.r + l.width / 2) {
        e.hp -= damageThisFrame;
        e.hitCooldown = 40;
        if (e.hp <= 0) {
          state.score += e.score;
          gainExp(e.score);              // ⭐ 補經驗
          trySpawnDrop(e.x, e.y);        // ⭐ 補掉落
          state.stats.killEnemy += 1;
          state.enemies.splice(ei, 1);
        }
      }
    }

    // === 雷射打菁英 ===
    if (state.elite) {
      const e = state.elite;
      const d = pointToSegmentDistance(e.x, e.y, x1, y1, x2, y2);
      if (d <= e.r + l.width / 2) {
        e.hp -= damageThisFrame;
        trySprayDrop(e, 0.30, 1200);
      if (e.hp <= 0) {
        killElite();
      }
    }
  }

  // === 雷射打 Boss（只打核心）===
  if (state.boss && state.boss.shellStage >= 2) {
    const b = state.boss;
    const d = pointToSegmentDistance(b.x, b.y, x1, y1, x2, y2);
    if (d <= BOSS_DATA.coreRadius + l.width / 2) {
      b.hp -= damageThisFrame;
      trySprayDrop(b, 0.30, 1200);
    }
  }
  }
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

function triggerEliteWarning() {
  // 清場
  state.enemies.length = 0;
  state.drops.length = 0;

  state.mode = "eliteWarning";
  state.warningTimer = 1500; // ms
}

function triggerBossWarning() {
  state.mode = "bossWarning";
  state.warningTimer = 1800; // 你想要幾毫秒都行，例如 1.8 秒
}

function spawnElite() {
  const p = state.player;

  state.elite = {
    x: canvas.width / 2,
    y: -100,
    r: ELITE_DATA.radius,

    hp: ELITE_DATA.maxHP,
    maxHP: ELITE_DATA.maxHP,

    shootTimer: 0,
    laserTimer: 0,
    charging: false,

    barrelAngle: 0,

    fireSide: 1,
    laserLockTime: 0, // 雷射鎖定剩餘時間

    contactDamage: 1,
    contactCooldown: 0,

    dropCooldown: 0, 

  };
}

function spawnFinalBoss() {
  // 清場（Boss 戰一定要乾淨）
  state.enemies.length = 0;
  state.drops.length = 0;

  state.boss = {
    x: canvas.width - BOSS_DATA.width / 2,
    y: canvas.height / 2,

    coreOffsetX: 0,
    coreOffsetY: 0,

    hp: BOSS_DATA.maxHP,
    maxHP: BOSS_DATA.maxHP,

    shellHP: BOSS_DATA.maxHP * 0.5,   // ⭐ 外殼血量
    shellStage: 0,              // 0 → 1 → 2

    cracks: [],
    shakeTime: 0,
    shakePower: 0,

    phase: 1,
    // ⭐ 攻擊狀態機
    attackState: "idle", 
    stateTimer: 1200,      // 當前狀態剩餘時間

    // 共用
    attackCooldown: 0,

    // 掃射用
    sweepAngle: 0,
    sweepDir: 1,

    // 雷射用
    charging: false,

    dropCooldown: 0, 
  };

  // Boss 戰期間暫停倒數
  state.paused = false;
}

function fireEliteBullet(e) {
  const barrelOffset = 22;

  // 左右輪流
  e.fireSide = e.fireSide === 1 ? -1 : 1;
  const side = e.fireSide || 1;

  const muzzle = getEliteBarrelMuzzle(e, barrelOffset * side);
  spawnEnemyBullet(muzzle.x, muzzle.y, muzzle.angle);
}

function spawnEnemyBullet(x, y, angle) {
  state.enemyBullets.push({
    x,
    y,
    vx: Math.cos(angle) * ELITE_DATA.bulletSpeed,
    vy: Math.sin(angle) * ELITE_DATA.bulletSpeed,
    r: 6,
    damage: 1,
  });
}

function fireEliteLaser(e) {
  const barrelOffset = 22;

  const left = getEliteBarrelMuzzle(e, -barrelOffset);
  const right = getEliteBarrelMuzzle(e, barrelOffset);

  spawnEnemyLaser(left.x, left.y, left.angle);
  spawnEnemyLaser(right.x, right.y, right.angle);


   // ⭐ 雷射存在多久，菁英就鎖多久
  e.laserLockTime = ELITE_DATA.laserDuration;
}

function killElite() {
  state.stats.killElite += 1;
  // ⭐ 清掉菁英殘留攻擊
  state.enemyLasers.length = 0;
  state.enemyBullets.length = 0;
  state.elite = null;

  state.postEliteCardCount = 2; // 要抽 2 次

  state.mode = "card";
  state.paused = true;

  rollCards(); // ⭐ 第一次抽牌
}

function renderElite() {
  const e = state.elite;
  if (!e) return;

  ctx.save();                // ⭐ 防污染開始
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.lineCap = "butt";

  // 本體
  ctx.fillStyle = "orange";
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
  ctx.fill();

  // 砲管
  const barrelOffset = 22;
  drawBarrel(e, -barrelOffset);
  drawBarrel(e, barrelOffset);

  // 蓄力特效
  if (e.charging) {
  const barrelOffset = 22;
  const left = getEliteBarrelMuzzle(e, -barrelOffset);
  const right = getEliteBarrelMuzzle(e, barrelOffset);

  ctx.fillStyle = "rgba(255,80,80,0.8)";
  ctx.beginPath();
  ctx.arc(left.x, left.y, 6, 0, Math.PI * 2);
  ctx.arc(right.x, right.y, 6, 0, Math.PI * 2);
  ctx.fill();
}
 ctx.restore();  
}

function drawBarrel(e, sideOffset) {
  const p = state.player;

  // 砲管朝向玩家
  const ang = Math.atan2(p.y - e.y, p.x - e.x);

  // 垂直於朝向的方向（用來做左右兩根砲管偏移）
  const px = Math.cos(ang + Math.PI / 2);
  const py = Math.sin(ang + Math.PI / 2);

  // 砲管起點（從菁英圓心往外 + 左右偏移）
  const sx = e.x + px * sideOffset + Math.cos(ang) * (e.r * 0.55);
  const sy = e.y + py * sideOffset + Math.sin(ang) * (e.r * 0.55);

  // 砲管終點
  const len = 28;
  const ex = sx + Math.cos(ang) * len;
  const ey = sy + Math.sin(ang) * len;

  ctx.save();
  ctx.strokeStyle = "rgba(40,40,40,0.95)";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // 砲口小點點
  ctx.fillStyle = "rgba(15,15,15,1)";
  ctx.beginPath();
  ctx.arc(ex, ey, 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawEliteHP() {
  const e = state.elite;
  if (!e) return;

  const w = 300;
  const h = 14;
  const x = canvas.width / 2 - w / 2;
  const y = 70;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x, y, w, h);

  const ratio = e.hp / e.maxHP;
  ctx.fillStyle = "orange";
  ctx.fillRect(x, y, w * ratio, h);

  ctx.strokeStyle = "white";
  ctx.strokeRect(x, y, w, h);
}

function renderBoss() {
  const b = state.boss;
  if (!b) return;

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

  // =========================
  // 外殼（尚未碎裂時）
  // =========================
  if (b.shellStage < 2) {
    ctx.fillStyle = "rgba(40,40,55,1)";
    ctx.fillRect(
      -BOSS_DATA.width / 2,
      -BOSS_DATA.height / 2,
      BOSS_DATA.width,
      BOSS_DATA.height
    );
  }

  // =========================
// 裂痕（血越少越多）
// =========================
if (b.shellStage === 1 && b.cracks && b.cracks.length) {
  const ratio = b.hp / b.maxHP;

  // 80% 開始出現 → 50% 佈滿
  const t = Math.min(1, Math.max(0, (0.8 - ratio) / 0.3));
  const visibleCount = Math.floor(b.cracks.length * t);

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;

  for (let i = 0; i < visibleCount; i++) {
    const c = b.cracks[i];
    if (!c) continue;

    // ✅ 樹枝裂痕格式：{ main:{...}, branches:[...] }
    if (c.main) {
      // 主裂痕
      ctx.beginPath();
      ctx.moveTo(c.main.x1, c.main.y1);
      ctx.lineTo(c.main.x2, c.main.y2);
      ctx.stroke();

      // 分支裂痕
      if (c.branches) {
        for (const br of c.branches) {
          ctx.beginPath();
          ctx.moveTo(br.x1, br.y1);
          ctx.lineTo(br.x2, br.y2);
          ctx.stroke();
        }
      }
    }
    // ✅ 舊裂痕格式：{ x1,y1,x2,y2 }（防止你還沒換 generateShellCracks）
    else if ("x1" in c && "y1" in c && "x2" in c && "y2" in c) {
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();
    }
  }
}
  // =========================
  // 核心（永遠畫）
  // =========================
  ctx.save();
  ctx.shadowColor = "rgba(255,80,80,0.8)";
  ctx.shadowBlur = 30;

  ctx.fillStyle = "rgba(255,90,90,1)";
  ctx.beginPath();
  ctx.arc(0, 0, BOSS_DATA.coreRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // 關核心特效
  ctx.restore(); // 關整個 Boss transform
  
}




function drawBossHP() {
  const b = state.boss;
  if (!b) return;

  const barW = canvas.width * 0.7;
  const barH = 18;
  const x = canvas.width / 2 - barW / 2;
  const y = 24;

  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(x, y, barW, barH);

  const ratio = b.hp / b.maxHP;
  ctx.fillStyle = "rgba(255,80,80,0.95)";
  ctx.fillRect(x, y, barW * ratio, barH);

  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.strokeRect(x, y, barW, barH);

  ctx.textAlign = "center";
  ctx.font = "18px Microsoft JhengHei";
  ctx.fillStyle = "white";
  ctx.fillText("FINAL CORE", canvas.width / 2, y - 6);
}

function fireBossTripleShot(boss) {
  const p = state.player;

  // 砲口：Boss 左側稍微伸出（視覺會像從武器射出）
  const muzzleX = boss.x - BOSS_DATA.width / 2 + 18;
  const muzzleY = boss.y;

  // 指向玩家
  let ang = Math.atan2(p.y - muzzleY, p.x - muzzleX);

  // ⭐ 限制方向：只允許「往左」扇形（避免往右、避免太垂直）
  // 以「正左」為中心：Math.PI
  const center = Math.PI;
  const maxYaw = 0.65; // 允許上下偏轉角（越小越不會射到上下）
  // 把 ang 夾到 [center-maxYaw, center+maxYaw]
  while (ang < -Math.PI) ang += Math.PI * 2;
  while (ang >  Math.PI) ang -= Math.PI * 2;
  ang = Math.max(center - maxYaw, Math.min(center + maxYaw, ang));

  const spread = 0.14;
  const angles = [ang - spread, ang, ang + spread];

  for (const a of angles) {
    state.enemyBullets.push({
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(a) * BOSS_DATA.normalBullet.speed,
      vy: Math.sin(a) * BOSS_DATA.normalBullet.speed,
      r: BOSS_DATA.normalBullet.radius,
      damage: BOSS_DATA.normalBullet.damage,
    });
  }
}


function fireBossFanClampLasers(boss) {
  const core = getBossCorePos(boss);

  const originX = core.x;
  const originY = core.y;
  // 以「正左」為中心，做上下兩道指針
  const center = Math.PI;

  // 初始張角（比較開）
  const startGap = 1.15;     // 上下分開的角度（越大越開）
  // 最終保留縫隙（玩家生路）
  const endGap = 0.35;       // 越小越難躲，建議 0.30~0.45

  // 每毫秒收攏角速度（dt 是 ms）
  const clampSpeed = 0.00032; // 可調：0.00025~0.00045

  // 上指針：從 center-startGap/2 往 center-endGap/2 收
  // 下指針：從 center+startGap/2 往 center+endGap/2 收
  const topStart = center - startGap / 2;
  const botStart = center + startGap / 2;

  const topEnd = center - endGap / 2;
  const botEnd = center + endGap / 2;

  const topDir = topEnd > topStart ? +1 : -1;
  const botDir = botEnd > botStart ? +1 : -1;

  // 用 moveAngle 旋轉，並用 clampTarget 保存目標，更新時會停在那
  state.enemyLasers.push({
    x: originX,
    y: originY,
    angle: topStart,
    length: canvas.width,
    width: 18,
    dps: 3.2,
    duration: 2200,
    time: 0,
    color: "rgba(255,0,0,0.95)",
    moveAngle: clampSpeed * topDir,
    clampTarget: topEnd,
  });

  state.enemyLasers.push({
    x: originX,
    y: originY,
    angle: botStart,
    length: canvas.width,
    width: 18,
    dps: 3.2,
    duration: 2200,
    time: 0,
    color: "rgba(255,0,0,0.95)",
    moveAngle: clampSpeed * botDir,
    clampTarget: botEnd,
  });
}


function fireBossCoreLaser(boss) {
  state.enemyLasers.push({
    x: boss.x,
    y: boss.y,
    angle: Math.PI,
    length: canvas.width,
    width: 60,
    dps: 4.5,
    duration: 1600,
    time: 0,
    color: "rgba(255,0,0,0.95)", 
  });
}

function chooseNextBossAttack(b) {
  const roll = Math.random();

  if (roll < 0.45) {
    // 普通三連發
    b.attackState = "tripleShot";
    b.stateTimer = 1800;
    b.attackCooldown = 0;

  } else if (roll < 0.75) {
    // 扇形掃射
    b.attackState = "fanSweep";
    b.stateTimer = 2600;
    b.sweepDir = 1;

    const base = Math.atan2(
      state.player.y - b.y,
      state.player.x - b.x
    );
    b.sweepAngle = base - 0.8;

  } else {
  b.attackState = "laserCharge";
  b.stateTimer = 1500;
  b.charging = true;

  // 先決定要哪個雷射
  b.pendingLaser = Math.random() < 0.5 ? "clamp" : "core";

  // 再用正確的型別生警告
  spawnBossLaserWarning(b.pendingLaser);
  }
}

function spawnBossLaserWarning(type) {
  state.bossWarnings.length = 0; // 每次只留一個警告，避免疊加
  state.bossWarnings.push({
    type, // "clamp" 或 "core"
    time: 0,
    duration: 1500,
    blink: 0,
  });
}

function generateShellCracks(boss) {
  const w = BOSS_DATA.width;
  const h = BOSS_DATA.height;

  const crackCount = 28;        // 裂痕數量：讓快爆掉時佈滿
  const branchPerCrack = 3;     // 每條主裂痕分支數

  boss.cracks = [];

  const coreR = BOSS_DATA.coreRadius + 10; // 從核心外圍開始，不被蓋住

  // 幫你挑一個「落在矩形邊界附近」的終點
  function randomEdgePoint() {
    const side = Math.floor(rand(0, 4));
    if (side === 0) return { x: rand(-w/2, w/2), y: -h/2 + rand(-8, 8) }; // top
    if (side === 1) return { x: rand(-w/2, w/2), y:  h/2 + rand(-8, 8) }; // bottom
    if (side === 2) return { x: -w/2 + rand(-8, 8), y: rand(-h/2, h/2) }; // left
    return            { x:  w/2 + rand(-8, 8), y: rand(-h/2, h/2) };      // right
  }

  for (let i = 0; i < crackCount; i++) {
    // 主裂痕起點：圍繞核心一圈
    const a = rand(0, Math.PI * 2);
    const x1 = Math.cos(a) * coreR;
    const y1 = Math.sin(a) * coreR;

    // 主裂痕終點：往外殼邊界飛
    const end = randomEdgePoint();
    const x2 = end.x;
    const y2 = end.y;

    // 分支：從主裂痕中間某些點岔出去
    const branches = [];
    for (let k = 0; k < branchPerCrack; k++) {
      const t = rand(0.2, 0.85);
      const mx = x1 + (x2 - x1) * t;
      const my = y1 + (y2 - y1) * t;

      const mainAng = Math.atan2(y2 - y1, x2 - x1);
      const brAng = mainAng + rand(-1.2, 1.2);
      const brLen = rand(18, 55);

      branches.push({
        x1: mx,
        y1: my,
        x2: mx + Math.cos(brAng) * brLen,
        y2: my + Math.sin(brAng) * brLen
      });
    }

    boss.cracks.push({
      main: { x1, y1, x2, y2 },
      branches
    });
  }
}


function renderPauseMenu() {
  // 背景遮罩
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 標題（只畫一次）
  ctx.fillStyle = "white";
  ctx.font = "64px Microsoft JhengHei";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PAUSE", canvas.width / 2, canvas.height / 2 - 120);

  const { resumeRect, restartRect, homeRect } = getPauseRects();

  // ⭐ 改用跟結算畫面一樣的按鈕
  drawResultButton(resumeRect,  "繼續",     "resume");
  drawResultButton(restartRect, "重新開始", "restart");
  drawResultButton(homeRect,    "回首頁",   "home");
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
  ctx.fillText(text, r.x + r.w/2, r.y + r.h/2 + 10);
}

function renderResultScreen(titleText) {
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.textAlign = "center";

  ctx.font = "64px Microsoft JhengHei";
  ctx.fillText(titleText, canvas.width / 2, 160);

  ctx.font = "28px Microsoft JhengHei";
  const y0 = 260;
  const lh = 44;

  ctx.fillText(`存活時間：${formatTime(state.stats.surviveTime)}`, canvas.width / 2, y0);
  ctx.fillText(`擊殺小怪：${state.stats.killEnemy}`, canvas.width / 2, y0 + lh);
  ctx.fillText(`擊殺菁英：${state.stats.killElite}`, canvas.width / 2, y0 + lh * 2);
  ctx.fillText(`擊殺 Boss：${state.stats.killBoss}`, canvas.width / 2, y0 + lh * 3);

  // 按鈕
  const { restartRect, homeRect } = getResultRects();
  drawResultButton(restartRect, "重新開始", "restart");
  drawResultButton(homeRect, "回選單", "home");
}





// ==========================
// 9) 繪製（Render）
// ==========================
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 背景
  ctx.fillStyle = "rgba(18,18,22,1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 爆炸範圍特效（紅色空心圈）
for (const ex of state.explosions) {
  const t = ex.time / ex.duration; // 0~1
  ctx.beginPath();
  ctx.strokeStyle = `rgba(255, 80, 80, ${1 - t})`;
  ctx.lineWidth = 4;
  ctx.arc(ex.x, ex.y, ex.radius * (0.7 + t * 0.3), 0, Math.PI * 2);
  ctx.stroke();
}

  // 雷射
  for (const l of state.lasers) {
    ctx.save();
    ctx.lineWidth = l.width;
    ctx.strokeStyle = "rgba(120, 220, 255, 0.85)";
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(l.x + Math.cos(l.ang) * l.length, l.y + Math.sin(l.ang) * l.length);
    ctx.stroke();
    ctx.restore();
  }

  // 子彈
  for (const b of state.bullets) {
    ctx.beginPath();
    if (b.typeKey === "explosive") ctx.fillStyle = "rgba(255, 160, 80, 1)";
    else ctx.fillStyle = "rgba(230, 230, 240, 1)";
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
  }

  // 掉落物
  for (const d of state.drops) {
    const s = d.size;

    // 方塊本體
    ctx.fillStyle = d.color;
    ctx.fillRect(d.x - s / 2, d.y - s / 2, s, s);

    // 外框
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(d.x - s / 2, d.y - s / 2, s, s);

    // 中央字母
    let letter = "?";
    if (d.typeKey === "spread") letter = "S";
    if (d.typeKey === "explosive") letter = "B";
    if (d.typeKey === "laser") letter = "L";

    ctx.fillStyle = "black";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, d.x, d.y);
  }


  // 敵人
  for (const e of state.enemies) {
    ctx.beginPath();
    ctx.fillStyle = e.hitCooldown > 0 ? "rgba(255,255,255,1)" : e.color;
    ctx.arc(e.x, e.y, e.r, 0, TAU);
    ctx.fill();

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
    drawEliteHP();
  }

  if (state.boss) {
  renderBoss();
  drawBossHP();
}


  // 玩家
  const p = state.player;
  ctx.beginPath();
  ctx.fillStyle = "rgba(120, 255, 170, 1)";
  ctx.arc(p.x, p.y, p.r, 0, TAU);
  ctx.fill();

  // 玩家面向（小方向線）
  const ang = angleToMouse();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(ang) * (p.r + 18), p.y + Math.sin(ang) * (p.r + 18));
  ctx.stroke();

  // UI
  drawUI();

  if (state.mode === "card") {
    renderCardUI();
  }

  if (state.mode === "eliteWarning") {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "red";
  ctx.font = "48px Microsoft JhengHei";
  ctx.textAlign = "center";
  ctx.fillText("⚠ WARNING ⚠", canvas.width / 2, canvas.height / 2);
}

if (state.mode === "bossWarning") {
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "red";
  ctx.font = "56px Microsoft JhengHei";
  ctx.textAlign = "center";
  ctx.fillText("☠ FINAL BOSS ☠", canvas.width / 2, canvas.height / 2 - 10);

  ctx.font = "28px Microsoft JhengHei";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("Prepare yourself!", canvas.width / 2, canvas.height / 2 + 40);
}

if (state.mode === "gameover") {
  renderResultScreen("GAME OVER");
  return;
}

if (state.mode === "victory") {
  renderResultScreen("MISSION COMPLETE");
  return;
}


ctx.save();  
// === 繪製敵人雷射 ===
for (const l of state.enemyLasers) {
  ctx.strokeStyle = l.color;
  ctx.lineWidth = l.width;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(l.x, l.y);
  ctx.lineTo(
    l.x + Math.cos(l.angle) * l.length,
    l.y + Math.sin(l.angle) * l.length
  );
  ctx.stroke();
}
ctx.restore();   

// === 敵人子彈 ===
for (const b of state.enemyBullets) {
  ctx.beginPath();
  ctx.fillStyle = "red";
  ctx.arc(b.x, b.y, b.r, 0, TAU);
  ctx.fill();
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

    const ox = b.x - BOSS_DATA.width / 2 + 22;
    const oy = b.y;

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
    const targetLift  = isHover ? 18   : 0;
    const targetGlow  = isHover ? 1    : 0;

    // === 平滑動畫（核心） ===
    ui.scale = lerp(ui.scale, targetScale, 0.15);
    ui.lift  = lerp(ui.lift,  targetLift,  0.15);
    ui.glow  = lerp(ui.glow,  targetGlow,  0.15);

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
    ctx.shadowColor = `rgba(255,255,200,${0.6 * ui.glow})`;
    ctx.shadowBlur = 28 * ui.glow;

    // 卡牌背景（圓角）
    ctx.fillStyle = "rgba(35,35,50,1)";
    drawRoundedRect(0, 0, r.w, r.h, 22);
    ctx.fill();

    // 邊框
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * ui.glow})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // === 卡牌內容 ===
    ctx.fillStyle = "white";

    // 標題
    ctx.font = "20px Microsoft JhengHei";
    ctx.fillText(card.name, 18, 36);

    // 等級顯示
    let lv = 1;
    if (card.type === "player") {
      if (card.id === "hp_up") lv = p.upgrades.hp + 1;
      if (card.id === "speed_up") lv = p.upgrades.speed + 1;
    }
    if (card.type === "weapon") {
      lv = p.upgrades.weapons[card.weaponKey] + 1;
    }

    ctx.font = "16px Microsoft JhengHei";
    ctx.fillText(`等級 ${roman(lv)}`, 18, 64);

    // 描述
    ctx.font = "14px Microsoft JhengHei";
    wrapText(card.desc(lv), 18, 104, r.w - 36, 20);

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

 // === HP Bar ===
const hpBar = {
  x: 18,
  y: 64,
  w: 220,
  h: 18,
};
ctx.fillStyle = "rgba(0,0,0,0.6)";
ctx.fillRect(hpBar.x, hpBar.y, hpBar.w, hpBar.h);

const hpRatio = Math.max(0, p.hp) / p.maxHP;
ctx.fillStyle = "rgba(255, 90, 90, 0.95)";
ctx.fillRect(hpBar.x, hpBar.y, hpBar.w * hpRatio, hpBar.h);

ctx.strokeStyle = "rgba(255,255,255,0.6)";
ctx.strokeRect(hpBar.x, hpBar.y, hpBar.w, hpBar.h);

ctx.fillStyle = "white";
ctx.fillText("HP", hpBar.x + hpBar.w + 8, hpBar.y + 14);

// === EXP Bar ===
const expBar = {
  x: 18,
  y: 96,
  w: 220,
  h: 14,
};

ctx.fillStyle = "rgba(0,0,0,0.6)";
ctx.fillRect(expBar.x, expBar.y, expBar.w, expBar.h);

const expRatio = state.player.exp / state.player.expToNext;
ctx.fillStyle = "rgba(120, 180, 255, 0.95)";
ctx.fillRect(expBar.x, expBar.y, expBar.w * expRatio, expBar.h);

ctx.strokeStyle = "rgba(255,255,255,0.6)";
ctx.strokeRect(expBar.x, expBar.y, expBar.w, expBar.h);

ctx.fillStyle = "white";
ctx.fillText(
  `Lv.${state.player.level}`,
  expBar.x + expBar.w + 8,
  expBar.y + 12
);

  if (state.paused) {
    //ctx.font = "32px Microsoft JhengHei, sans-serif";
    //ctx.fillStyle = "rgba(255,255,255,0.85)";
    //ctx.fillText("PAUSED", canvas.width / 2 - 70, canvas.height / 2);
  }
  ctx.restore();

  // === Score（左下角） ===
const scoreText = `SCORE ${state.score}`;

ctx.save();
ctx.font = "20px Microsoft JhengHei, sans-serif";
ctx.textAlign = "left";
ctx.fillStyle = "rgba(255,255,255,0.9)";

const padding = 10;
const metrics = ctx.measureText(scoreText);
const boxW = metrics.width + padding * 2;
const boxH = 30;

const x = 18;
const y = canvas.height - 20;

// 背景板
//ctx.fillStyle = "rgba(0,0,0,0.55)";
//ctx.fillRect(x - padding, y - boxH + 6, boxW, boxH);

// 文字
ctx.fillStyle = "white";
ctx.fillText(scoreText, x, y);

ctx.restore();



  // === 倒計時顯示 ===
  ctx.save();
  ctx.fillStyle = "white";
  ctx.font = "26px Microsoft JhengHei";
  ctx.textAlign = "center";

  if (!state.elite && !state.boss  && state.mode === "play") {
    const timeText = formatTime(state.timer.remaining);
    ctx.fillText(timeText, canvas.width / 2, 36);
  }


}

// ==========================
// 10) 主迴圈
// ==========================
function loop(ts) {
  const dt = ts - state.lastTs;
  state.lastTs = ts;

  if (!state.paused) {
    update(dt);
  }
  render();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ==========================
// 11) 重置
// ==========================
function resetGame() {
  state.score = 0;
  state.bullets.length = 0;
  state.enemies.length = 0;
  state.lasers.length = 0;

  spawnTimer = 0;
  spawnInterval = 900;

  state.player = createPlayer();
  // 保留你習慣的初始武器
  setWeapon("normal");
}
