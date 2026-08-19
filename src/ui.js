// This module handles the global game state, keyboard inputs, DOM element 
// bindings, difficulty selection, and the main menu flow
import { playMusic } from './music.js';

// --- Global game state---

// state object to track the player's progress and game conditions
export const state = {
    gameStarted: false,
    isGameOver: false,
    missionWon: false,
    collectedBatteries: 0,
    playerHealth: 100,
    totalBatteries: 5,
    magnetActive: true,
    difficulty: 'normal' 
};

// current state of movement keys (WASD)
export const keys = { w: false, a: false, s: false, d: false };

// --- Input handling ---
window.addEventListener('keydown', (e) => { 
    const key = e.key.toLowerCase();
    
    if (key === ' ') {
        e.preventDefault(); 

        if (!e.repeat) state.magnetActive = !state.magnetActive;

        dom.missionStatus.innerHTML = state.magnetActive ? 
            "<span style='color:#00ffaa'>MAGNET: ON</span> - Search the batteries!" : 
            "<span style='color:#ff3333'>MAGNET: OFF</span> - Search the batteries!";
        
        } else if (keys.hasOwnProperty(key)) {
        keys[key] = true;
    }
});

window.addEventListener('keyup', (e) => { 
    const key = e.key.toLowerCase();
    // Unregister movement key when released
    if (keys.hasOwnProperty(key)) keys[key] = false; 
});

// --- Dom elements exports ---

// Caching DOM elements here improves performance by avoiding repeated 
// document.getElementById() calls during the game loop
export const dom = {
    // Screen &nHUD overlays
    startScreen: document.getElementById('start-screen'),
    gameoverScreen: document.getElementById('gameover-screen'),
    missionHud: document.getElementById('mission-hud'),
    lightHud: document.getElementById('light-hud'),
    radarHud: document.getElementById('radar-hud'),
    
    // UI Texts
    collectedCountSpan: document.getElementById('collected-count'),
    healthValSpan: document.getElementById('health-val'),
    missionStatus: document.getElementById('mission-status'),
    radarLabel: document.getElementById('radar-label'),
    radarArrow: document.getElementById('radar-arrow'),
    radarDistance: document.getElementById('radar-distance'),
    radarRing: document.querySelector('.radar-ring'),
    
    // Control panel inputs
    colorInput: document.getElementById('hud-color'),
    intensityRange: document.getElementById('hud-intensity'),
    powerBtn: document.getElementById('hud-power'),
    jointBaseInput: document.getElementById('joint-base'),
    jointLowerInput: document.getElementById('joint-lower'),
    jointUpperInput: document.getElementById('joint-upper'),
    
    // Buttons
    playBtn: document.getElementById('play-btn'),
    restartBtn: document.getElementById('restart-btn')
};

// --- Difficulty selection ---

const btnEasy = document.getElementById('btn-easy');
const btnNormal = document.getElementById('btn-normal');
const btnHard = document.getElementById('btn-hard');

function setDifficulty(level, btn, color) {
    state.difficulty = level;
    btnEasy.style.border = '2px solid transparent';
    btnNormal.style.border = '2px solid transparent';
    btnHard.style.border = '2px solid transparent';
    btn.style.border = `2px solid ${color}`;
}

btnEasy.addEventListener('click', () => setDifficulty('easy', btnEasy, '#00ffcc'));
btnNormal.addEventListener('click', () => setDifficulty('normal', btnNormal, '#ffaa00'));
btnHard.addEventListener('click', () => setDifficulty('hard', btnHard, '#ff3333'));

// --- Main menu listeners ---
dom.playBtn.addEventListener('click', () => {
    state.gameStarted = true;
    
    // Hide start screen and show HUDs
    dom.startScreen.classList.add('hidden');
    dom.missionHud.classList.remove('hidden');
    dom.lightHud.classList.remove('hidden');
    dom.radarHud.classList.remove('hidden');
    
    // Start gameplay music
    playMusic('gameplay');
});

dom.restartBtn.addEventListener('click', () => { 
    window.location.reload(); 
});

// --- Audio autoplay workaround ---
let menuMusicStarted = false;

window.addEventListener('click', () => {
    if (!menuMusicStarted && !state.gameStarted) {
        playMusic('menu');
        menuMusicStarted = true;
    }
});