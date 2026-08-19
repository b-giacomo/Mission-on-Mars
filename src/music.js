// Files in \music
export const sounds = {
    menu: new Audio('./music/menu.mp3'),
    gameplay: new Audio('./music/gameplay.mp3'),
    victory: new Audio('./music/victory.mp3'),
    gameover: new Audio('./music/gameover.mp3')
};

sounds.menu.loop = true;
sounds.gameplay.loop = true;

let currentTrack = null;

export function playMusic(trackName) {
    if (currentTrack) {
        currentTrack.pause();
        currentTrack.currentTime = 0;
    }
    
    if (sounds[trackName]) {
        currentTrack = sounds[trackName];
        currentTrack.play().catch(e => console.warn("Audio blocked by the browser:", e));
    }
}