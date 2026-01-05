/* =========================================================
   config.js
   - Game Constants & Data
   ========================================================= */

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
        length: 800,  // 更長 (原 420)
        width: 24,    // 更粗 (原 6)
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

//卡牌等級
function roman(lv) {
    const map = ["I", "II", "III", "IV", "V"];
    return map[Math.min(lv - 1, 4)];
}

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
