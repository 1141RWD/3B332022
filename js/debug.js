/* =========================================================
   debug.js
   - Debug Console for Testing
   ========================================================= */

(function () {
    // create UI
    const debugContainer = document.createElement('div');
    debugContainer.id = 'debug-console';
    debugContainer.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        width: 320px;
        background: rgba(0, 0, 0, 0.85);
        color: #0f0;
        padding: 15px;
        border: 1px solid #0f0;
        border-radius: 8px;
        font-family: monospace;
        z-index: 9999;
        display: none;
        box-shadow: 0 0 15px rgba(0, 255, 0, 0.2);
    `;

    const title = document.createElement('h3');
    title.innerText = "DEBUG CONSOLE (~ to toggle)";
    title.style.margin = "0 0 12px 0";
    title.style.fontSize = "16px";
    title.style.textAlign = "center";
    title.style.color = "#fff";
    title.style.borderBottom = "1px solid #333";
    title.style.paddingBottom = "8px";
    debugContainer.appendChild(title);

    // Helpers
    function createRow() {
        const div = document.createElement('div');
        div.style.marginBottom = "8px";
        div.style.display = "flex";
        div.style.gap = "8px";
        div.style.justifyContent = "space-between";
        div.style.alignItems = "center";
        return div;
    }

    function createBtn(text, onClick) {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.cssText = `
            background: #222;
            color: #fff;
            border: 1px solid #555;
            padding: 6px 10px;
            cursor: pointer;
            flex: 1;
            font-size: 13px;
            border-radius: 4px;
            transition: all 0.2s;
        `;
        btn.onmouseover = () => btn.style.background = "#444";
        btn.onmouseout = () => btn.style.background = "#222";
        btn.onclick = onClick;
        return btn;
    }

    function createInput(placeholder) {
        const input = document.createElement('input');
        input.type = "number";
        input.placeholder = placeholder;
        input.style.cssText = `
            width: 80px;
            background: #111;
            color: #fff;
            border: 1px solid #444;
            padding: 6px;
            border-radius: 4px;
        `;
        return input;
    }

    // --- Features ---

    // 1. HP Control
    const rowHP = createRow();
    const inputHP = createInput("HP Value");
    const btnSetHP = createBtn("Set HP", () => {
        const val = parseInt(inputHP.value);
        if (state.player && !isNaN(val)) {
            state.player.hp = val;
            state.player.maxHP = Math.max(state.player.maxHP, val);
            console.log(`[DEBUG] Set HP to ${val}`);
        }
    });
    rowHP.appendChild(inputHP);
    rowHP.appendChild(btnSetHP);
    debugContainer.appendChild(rowHP);

    // 2. Spawners
    const rowSpawn = createRow();
    rowSpawn.appendChild(createBtn("Spawn Boss", () => {
        if (typeof spawnFinalBoss === 'function') {
            spawnFinalBoss();
            state.timer.remaining = 0; // Force timer end logic often checks this
            console.log("[DEBUG] Spawned Boss");
        }
    }));
    rowSpawn.appendChild(createBtn("Spawn Elite", () => {
        if (typeof spawnElite === 'function') {
            spawnElite();
            console.log("[DEBUG] Spawned Elite");
        }
    }));
    debugContainer.appendChild(rowSpawn);

    // 3. Level Up & Kill All
    const rowAction = createRow();
    rowAction.appendChild(createBtn("Level Up", () => {
        if (state.player && typeof gainExp === 'function') {
            gainExp(state.player.expToNext);
            console.log("[DEBUG] Level Up");
        }
    }));
    rowAction.appendChild(createBtn("Nuke (Kill All)", () => {
        // 1. Kill normal enemies
        if (state.enemies) {
            state.enemies.forEach(e => e.hp = 0);
        }
        // 2. Kill Elite
        if (state.elite) {
            state.elite.hp = 0;
        }
        // 3. Kill Boss
        if (state.boss) {
            state.boss.hp = 0;
        }
        // 4. Clear Projectiles
        if (state.enemyBullets) state.enemyBullets.length = 0;
        if (state.enemyLasers) state.enemyLasers.length = 0;

        console.log("[DEBUG] NUKED EVERYTHING!");
    }));
    debugContainer.appendChild(rowAction);

    // 4. God Mode
    const rowGod = createRow();
    let godMode = false;
    const btnGod = createBtn("God Mode: OFF", () => {
        godMode = !godMode;
        btnGod.innerText = godMode ? "God Mode: ON" : "God Mode: OFF";
        btnGod.style.color = godMode ? "#ff0" : "#fff";
        btnGod.style.borderColor = godMode ? "#ff0" : "#555";

        if (state.player) {
            if (godMode) {
                // Backup original reduction if not already backed up
                if (state.player._origDr === undefined) {
                    state.player._origDr = state.player.damageReduction;
                }
                state.player.damageReduction = 1; // 100% reduction
            } else {
                state.player.damageReduction = state.player._origDr !== undefined ? state.player._origDr : 0;
            }
        }
    });
    rowGod.appendChild(btnGod);
    debugContainer.appendChild(rowGod);

    // 5. Add Weapon
    const rowWeapon = createRow();
    rowWeapon.appendChild(createBtn("Spread", () => window.setWeapon && window.setWeapon("spread")));
    rowWeapon.appendChild(createBtn("Laser", () => window.setWeapon && window.setWeapon("laser")));
    rowWeapon.appendChild(createBtn("Explosive", () => window.setWeapon && window.setWeapon("explosive")));
    debugContainer.appendChild(rowWeapon);

    // 6. Time Scale
    const rowTime = createRow();
    rowTime.appendChild(createBtn("Time: 1x", () => { window.timeScale = 1; console.log("[DEBUG] Time Scale: 1x"); }));
    rowTime.appendChild(createBtn("Time: 5x", () => { window.timeScale = 5; console.log("[DEBUG] Time Scale: 5x"); }));
    rowTime.appendChild(createBtn("Time: 10x", () => { window.timeScale = 10; console.log("[DEBUG] Time Scale: 10x"); }));
    debugContainer.appendChild(rowTime);


    document.body.appendChild(debugContainer);

    // Toggle Listener
    window.addEventListener('keydown', (e) => {
        if (e.key === '`' || e.key === '~' || e.code === "Backquote") {
            // e.preventDefault(); // Might interfere with typing if user needs to type ~ elsewhere, but fine for game
            if (debugContainer.style.display === 'none') {
                debugContainer.style.display = 'block';
            } else {
                debugContainer.style.display = 'none';
            }
        }
    });

    console.log("[DEBUG] Debug Console Loaded. Press '~' to toggle.");

})();
