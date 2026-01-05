/* =========================================================
   state.js
   - Global Game State initialization
   ========================================================= */

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
        weaponDuration: 6000,// 每次撿到武器可用多久

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
