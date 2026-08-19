import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';

import { scene, camera, renderer, controls, ambientLight, sunLight, maxAmbientIntensity, maxSunIntensity } from './setup.js';
import { state, keys, dom } from './ui.js';
import { roverGroup, chassisGroup, magnetGroup, loadedWheels, loadedForks, armBase, lowerPivot, upperPivot, cannonHead, firePoint } from './rover.js';
import { floor, obstacles, batteries, aliens, aliensSpawned, spawnAliens, extractionPointGroup, getTerrainHeight, depositStationGroup, hopperWorldPos, generateBatteries, initSandstorm, updateSandstorm, ufoBeam } from './world.js';
import { playMusic } from './music.js';
import { emitDust, updateDust } from './particles.js';

initSandstorm();

// Initialize level items on play
dom.playBtn.addEventListener('click', () => {
    generateBatteries();
    document.getElementById('total-count').textContent = state.totalBatteries;
});

// --- Constants ---
const moveSpeed = 0.60;  
const turnSpeed = 0.1; 
const raycaster = new THREE.Raycaster();
const rayOrigin = new THREE.Vector3();
const magnetWorldPos = new THREE.Vector3();

// --- Combat Phase Constants ---
let combatPhase = false;
let turretPitch = 0;
const shootRaycaster = new THREE.Raycaster();

let lastShotTime = 0;

const laserSound = new Audio('./music/laser.mp3');
laserSound.volume = 0.4;

const roarSound = new Audio('./music/alien_sound.mp3');
const deathSound = new Audio('./music/alien_death.mp3');

let lastRoarTime = 0;

const crosshair = document.createElement('div');
crosshair.style.cssText = 'position:fixed; top:50%; left:50%; width:30px; height:30px; border:2px solid #00ffff; border-radius:50%; transform:translate(-50%, -50%); display:none; z-index:1000; pointer-events:none;';
const dot = document.createElement('div');
dot.style.cssText = 'position:absolute; top:50%; left:50%; width:4px; height:4px; background:#ff0000; border-radius:50%; transform:translate(-50%, -50%);';
crosshair.appendChild(dot);
document.body.appendChild(crosshair);

// Reload cannon
const cooldownUI = document.createElement('div');
cooldownUI.style.cssText = 'position:fixed; top:calc(50% + 35px); left:50%; width:24px; height:24px; transform:translate(-50%, -50%); border-radius:50%; display:none; z-index:1000; pointer-events:none; border: 2px solid #222; box-shadow: 0 0 8px #00ffd5; transition: border-color 0.2s, box-shadow 0.2s;';
document.body.appendChild(cooldownUI);

// FPS Mouse logic
document.addEventListener('mousemove', (e) => {
    if (combatPhase && !state.isGameOver && !state.missionWon && document.pointerLockElement === document.body) {
        roverGroup.rotation.y -= e.movementX * 0.002;
        
        turretPitch -= e.movementY * 0.002;
        turretPitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, turretPitch));
    }
});

// Left click to shoot or to re-lock the mouse
document.addEventListener('mousedown', (e) => {
    if (combatPhase && !state.isGameOver && !state.missionWon) {
        if (document.pointerLockElement !== document.body) {
            document.body.requestPointerLock();
        } else if (e.button === 0) {
            shootLaser();
        }
    }
});

// --- Combat Shooting Logic ---
function shootLaser() {
    if (state.isGameOver || state.missionWon) return;

    let cooldown = 1500; // Normal
    if (state.difficulty === 'easy') cooldown = 1000;    
    else if (state.difficulty === 'hard') cooldown = 2000; // Hard

    const currentTime = performance.now();
    if (currentTime - lastShotTime < cooldown) {
        return; 
    }
    lastShotTime = currentTime; 

    laserSound.currentTime = 0; 
    laserSound.play().catch(e => console.log("Laser audio error:", e));

    const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
    const startPos = new THREE.Vector3();
    
    firePoint.getWorldPosition(startPos);

    // Raycaster ahot from the center of the screen
    shootRaycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    let endPos = new THREE.Vector3();
    endPos.copy(startPos).add(shootRaycaster.ray.direction.clone().multiplyScalar(100));

    const alienMeshes = aliens.map(a => a.mesh);
    const intersects = shootRaycaster.intersectObjects(alienMeshes, true);

    if (intersects.length > 0) {
        endPos.copy(intersects[0].point); // stop the ray 
        
        const hitMesh = intersects[0].object;
        let alienIdx = aliens.findIndex(a => {
            let p = hitMesh;
            while(p) { if(p === a.mesh) return true; p = p.parent; } return false;
        });
        
        if (alienIdx > -1) {
            // Check if the specific mesh we hit is the HEAD
            if (hitMesh.userData.isHead) {
                // Alien killed
                scene.remove(aliens[alienIdx].mesh);
                aliens.splice(alienIdx, 1);
                const dSound = deathSound.cloneNode();
                dSound.volume = 0.8; 
                dSound.play().catch(e => console.log("error death audio:", e));
                
                dom.missionStatus.innerHTML = `<span style="color:#ffaa00">DEFEND THE ROVER! ALIENS REMAINING: ${aliens.length}</span>`;
                
                if (aliens.length === 0) {
                    dom.missionStatus.innerHTML = `<span style="color:#00ffd5">AREA CLEARED! PROCEED TO EXTRACTION PAD.</span>`;
                }
            } else {
                // Armor hit (Body, Wings, Arms)
                dom.radarLabel.textContent = "ARMOR HIT! AIM FOR THE RED HEAD!";
                dom.radarLabel.style.color = "#ffaa00";
                setTimeout(() => {
                    if (combatPhase) {
                        dom.radarLabel.textContent = "COMBAT MODE";
                        dom.radarLabel.style.color = "#ff0000";
                    }
                }, 1000);
            }
        }
    }

    // Laser
    const geometry = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
    const laserLine = new THREE.Line(geometry, material);
    scene.add(laserLine);
    
    setTimeout(() => scene.remove(laserLine), 100);
}

// main animation loop, called every frame by the browser
function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time);
    
    // 1. Cinematics and idle state

    if (!state.gameStarted || state.isGameOver || state.missionWon) {
        const orbitSpeed = time * 0.0005;
        camera.position.x = roverGroup.position.x + Math.cos(orbitSpeed) * 15;
        camera.position.z = roverGroup.position.z + Math.sin(orbitSpeed) * 15;
        camera.position.y = roverGroup.position.y + 6;
        camera.lookAt(roverGroup.position);

        // --- Endgame cinematic (lift-off) ---
        if (state.missionWon) {
            let elapsed = performance.now() - window.winStartTime;

            if (elapsed < 2500) {
                // PHASE 1
                roverGroup.position.x = THREE.MathUtils.lerp(roverGroup.position.x, extractionPointGroup.position.x, 0.04);
                roverGroup.position.z = THREE.MathUtils.lerp(roverGroup.position.z, extractionPointGroup.position.z, 0.04);
            } 
            else {
                // PHASE 2: Lift off
                if (elapsed > 2500 && elapsed < 2600) {
                    dom.missionStatus.textContent = "Extraction Successful! Initiating lift-off...";
                }
                roverGroup.position.y += 0.15; 
                roverGroup.rotation.y += 0.05; 
                
                // --- UFO beam ---
                if (ufoBeam.material.opacity < 0.5) {
                    ufoBeam.material.opacity += 0.01; 
                }
            }
        }

        renderer.render(scene, camera);
        return;
    }
    
    // 2. player movement and physics

    let isMoving = false;
    let wheelDirection = 0;
    const previousPosition = roverGroup.position.clone();

    let currentSpeed = moveSpeed;
    let currentSlope = -chassisGroup.rotation.x; 

    // slope resistance
    if (keys.w && currentSlope > 0.05) {
        let slopeResistance = Math.min(currentSlope * 1.8, 0.85); 
        currentSpeed *= (1.0 - slopeResistance);
    } else if (keys.s && currentSlope < -0.05) {
        let slopeResistance = Math.min(Math.abs(currentSlope) * 1.8, 0.85);
        currentSpeed *= (1.0 - slopeResistance);
    } else if (keys.w && currentSlope < -0.05) {
        currentSpeed *= 1.25;
    }

    // translations and rotations
    if (keys.w) { 
        roverGroup.translateZ(currentSpeed); 
        isMoving = true; wheelDirection = 1; 
    }
    if (keys.s) { 
        roverGroup.translateZ(-currentSpeed); 
        isMoving = true; wheelDirection = -1;
    }
    if (keys.a) { 
        roverGroup.rotation.y += turnSpeed; 
    }
    if (keys.d) { 
        roverGroup.rotation.y -= turnSpeed; 
    }

    // Steering for front wheels
    let targetSteering = 0;
    if (keys.a) targetSteering = Math.PI / 6;  // Steer left
    if (keys.d) targetSteering = -Math.PI / 6; // Steer right

    // Apply rotation to the actual wheels (base rotation is 90 degrees or Math.PI / 2)
    if (loadedWheels['frontLeft'] && loadedWheels['frontRight']) {
        const baseRotation = Math.PI / 2;
        loadedWheels['frontLeft'].rotation.y = THREE.MathUtils.lerp(loadedWheels['frontLeft'].rotation.y, baseRotation + targetSteering, 0.15);
        loadedWheels['frontRight'].rotation.y = THREE.MathUtils.lerp(loadedWheels['frontRight'].rotation.y, baseRotation + targetSteering, 0.15);
    }

    // --- Collision and Detection ---

    let collided = false;
    const mapLimit = 122; // map boundaries
    if (Math.abs(roverGroup.position.x) > mapLimit || Math.abs(roverGroup.position.z) > mapLimit) collided = true;

    // obstacles overlaps
    if (!collided) {
        for (let obs of obstacles) {
            // distance check
            if (Math.sqrt((roverGroup.position.x - obs.position.x)**2 + (roverGroup.position.z - obs.position.z)**2) < obs.radius + 1.2) {
                collided = true; break;
            }
        }
    }

    if (collided) roverGroup.position.copy(previousPosition);

    // 3. Battery logic and Magnet interactions

    magnetGroup.getWorldPosition(magnetWorldPos);
    let holdingBattery = false;

    // dist from the magnt to the center
    const magDx = magnetWorldPos.x - hopperWorldPos.x;
    const magDz = magnetWorldPos.z - hopperWorldPos.z;
    const magDist = Math.sqrt(magDx * magDx + magDz * magDz);
    
    // magnet try to enter the ring
    if (magDist > 1.2 && magDist < 2.8 && magnetWorldPos.y < hopperWorldPos.y + 1.2) {
        // reject the arm
        upperPivot.rotation.x -= 0.04; 
        lowerPivot.rotation.x -= 0.02;
        
        // Synchronization
        if (dom.jointUpperInput) dom.jointUpperInput.value = upperPivot.rotation.x;
        if (dom.jointLowerInput) dom.jointLowerInput.value = lowerPivot.rotation.x;
    }

    batteries.forEach(b => {
        if (b.collected) return; 

        // --- Deposit animation ---
        if (b.isDepositing) {
            // battery into the hopper
            b.mesh.position.x = THREE.MathUtils.lerp(b.mesh.position.x, hopperWorldPos.x, 0.2);
            b.mesh.position.z = THREE.MathUtils.lerp(b.mesh.position.z, hopperWorldPos.z, 0.2);
            
            b.mesh.position.y -= 0.08; 

            if (b.mesh.position.y < hopperWorldPos.y - 2.5) {
                b.collected = true; 
                scene.remove(b.mesh);
                state.collectedBatteries++;
                dom.collectedCountSpan.textContent = state.collectedBatteries;

                // Update lights
                const progress = state.collectedBatteries / state.totalBatteries;
                ambientLight.intensity = 0.05 + (maxAmbientIntensity * progress);
                sunLight.intensity = maxSunIntensity * progress;
                // Lerp fog and sky color from dark red to brighter 
                const r = THREE.MathUtils.lerp(0x0a, 0xd4, progress);
                const g = THREE.MathUtils.lerp(0x04, 0x7a, progress);
                const blue = THREE.MathUtils.lerp(0x02, 0x55, progress);
                scene.background.setHex((Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(blue));
                scene.fog.color.setHex((Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(blue));

                // Trigger the aliens AND COMBAT PHASE
                if (state.collectedBatteries === state.totalBatteries && !combatPhase) {
                    spawnAliens();
                    combatPhase = true;
                    controls.enabled = false; 
                    crosshair.style.display = 'block'; 
                    cooldownUI.style.display = 'block';
                    document.body.requestPointerLock(); 
                    
                    state.magnetActive = false; 

                    armBase.visible = false;
                    
                    dom.missionStatus.innerHTML = `<span style="color:#ffaa00">DEFEND THE ROVER! ALIENS REMAINING: ${aliens.length}</span>`;
                    dom.radarLabel.textContent = "COMBAT MODE";
                    dom.radarLabel.style.color = "#ff0000";
                }
            }
            return; 
        }

        // --- Magnet's physics ---
        const distToMagnet = magnetWorldPos.distanceTo(b.mesh.position);

        if (state.magnetActive && b.isAttached) {
            // battery glued
            holdingBattery = true;
            b.mesh.position.copy(magnetWorldPos);
            b.mesh.position.y -= 0.5; 
        } 
        else if (state.magnetActive && distToMagnet < 2.5 && !holdingBattery) {
            // pull battery towards magnet
            b.mesh.position.lerp(magnetWorldPos, 0.15); 
            if (distToMagnet < 1.0) {
                b.isAttached = true; 
                holdingBattery = true;
            }
        } 
        else {
            // drop battery
            b.isAttached = false; 
            
            const groundY = getTerrainHeight(b.mesh.position.x, b.mesh.position.z);
            const dx = b.mesh.position.x - hopperWorldPos.x;
            const dz = b.mesh.position.z - hopperWorldPos.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);
            
            // 1. deposit
            if (horizontalDist < 1.4 && b.mesh.position.y < hopperWorldPos.y + 1.5 && b.mesh.position.y > hopperWorldPos.y - 0.5) {
                b.isDepositing = true;
            } 
            else {
                // gravitational fall
                if (b.mesh.position.y > groundY + 0.4) {
                    b.mesh.position.y -= 0.15;
                    
                    // 2. Collision with the ring
                    if (b.mesh.position.y < hopperWorldPos.y + 0.8 && b.mesh.position.y > hopperWorldPos.y - 0.8 && horizontalDist < 2.6) {
                        const pushForce = 0.25; // bouncy
                        
                        // direction
                        if (horizontalDist < 2.0) {
                            // internal
                            b.mesh.position.x -= (dx / horizontalDist) * pushForce;
                            b.mesh.position.z -= (dz / horizontalDist) * pushForce;
                        } else {
                            // external
                            b.mesh.position.x += (dx / horizontalDist) * pushForce;
                            b.mesh.position.z += (dz / horizontalDist) * pushForce;
                        }
                    }
                } else {
                    b.mesh.position.y = groundY + 0.4;
                }
            }
        }
    });

    // --- Radar ---
    let targetPos = null;
    if (state.collectedBatteries < state.totalBatteries) {
        if (holdingBattery) {
            // Point to base
            targetPos = depositStationGroup.position;
            dom.radarLabel.textContent = "RETURN TO BASE";
            dom.radarLabel.style.color = "#ffaa00";
            dom.radarArrow.style.color = "#ffaa00";
        } else {
            // Closest battery
            let closestBattery = null;
            let minDistance = Infinity;
            batteries.forEach(b => {
                if (!b.collected) {
                    let dist = roverGroup.position.distanceTo(b.mesh.position);
                    if (dist < minDistance) { minDistance = dist; closestBattery = b; }
                }
            });
            if (closestBattery) targetPos = closestBattery.mesh.position;
            dom.radarLabel.textContent = "BATTERY DETECTED";
            dom.radarLabel.style.color = "#ff3333";
            dom.radarArrow.style.color = "#ff3333";
        }
    } else {
        // Point to extraction
        targetPos = extractionPointGroup.position;
    }

    // Update radar
    if (targetPos) {
        let dx = targetPos.x - roverGroup.position.x;
        let dz = targetPos.z - roverGroup.position.z;
        dom.radarDistance.textContent = Math.floor(Math.sqrt(dx*dx + dz*dz)) + "m";
        let targetAngle = Math.atan2(dx, dz);
        let camAngle = controls.getAzimuthalAngle();
        let rotation = (camAngle - targetAngle) * (180 / Math.PI) + 180;
        dom.radarArrow.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
    }

    // 5. Alien AI and Damage logic
    if (aliensSpawned) {
        aliens.forEach((alien, index) => {
            const dx = roverGroup.position.x - alien.mesh.position.x;
            const dz = roverGroup.position.z - alien.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

           if (dist > 0) {
                let moveX = 0, moveZ = 0;
                let avoidingWall = false;

                // 1. closest obstacles
                let closestObs = null;
                let minObsDist = Infinity;
                const alienRadius = 1.5;
                const safeZone = alienRadius + 3.0; 

                for (let obs of obstacles) {
                    const ox = alien.mesh.position.x - obs.position.x;
                    const oz = alien.mesh.position.z - obs.position.z;
                    const odist = Math.sqrt(ox * ox + oz * oz);
                    if (odist < (obs.radius + safeZone) && odist < minObsDist) {
                        minObsDist = odist;
                        closestObs = { obs, ox, oz, odist };
                    }
                }

                // 2. movement logic
                if (closestObs) {
                    avoidingWall = true;
                    const { ox, oz, odist } = closestObs;
                    
                    let tanX = -oz;
                    let tanZ = ox;
                    // better path
                    if (tanX * dx + tanZ * dz < 0) { tanX = oz; tanZ = -ox; } 
                    
                    const tLen = Math.sqrt(tanX * tanX + tanZ * tanZ);
                    if (tLen > 0) { tanX /= tLen; tanZ /= tLen; }

                    // sliding
                    moveX = (tanX * alien.speed) + (ox / odist) * alien.speed * 0.3;
                    moveZ = (tanZ * alien.speed) + (oz / odist) * alien.speed * 0.3;
                } else {
                    moveX = (dx / dist) * alien.speed;
                    moveZ = (dz / dist) * alien.speed;

                    // encirclement
                    const flankDir = (index % 2 === 0) ? 1 : -1;
                    const flankForce = (dist < 15) ? 0.8 : 0.2;
                    moveX += (dz / dist) * flankDir * alien.speed * flankForce;
                    moveZ += (-dx / dist) * flankDir * alien.speed * flankForce;
                }

                // 3. Separation
                aliens.forEach((otherAlien, otherIndex) => {
                    if (index !== otherIndex) {
                        const odx = alien.mesh.position.x - otherAlien.mesh.position.x;
                        const odz = alien.mesh.position.z - otherAlien.mesh.position.z;
                        const odist = Math.sqrt(odx * odx + odz * odz);
                        if (odist < 3.5 && odist > 0) {
                            moveX += (odx / odist) * 0.08;
                            moveZ += (odz / odist) * 0.08;
                        }
                    }
                });

                // 4. Braking
                if (!avoidingWall && dist < 4.0) {
                    const moveDot = (moveX * dx + moveZ * dz) / dist; 
                    if (moveDot > 0) {
                        moveX -= (dx / dist) * moveDot;
                        moveZ -= (dz / dist) * moveDot;
                    }
                }

                // Movement and Rotation
                alien.mesh.position.x += moveX;
                alien.mesh.position.z += moveZ;
                alien.mesh.lookAt(roverGroup.position.x, alien.mesh.position.y, roverGroup.position.z);
            }
            
            // --- Terrain ---
            const terrainY = getTerrainHeight(alien.mesh.position.x, alien.mesh.position.z);
            alien.mesh.position.y = terrainY + 1.0; 

            // --- Dark Sentinel ---
            if (alien.body) {
                // Hovering animation
                alien.body.position.y = 2.5 + Math.sin(time * 0.003 + alien.mesh.position.x) * 0.6;
                
                // Rotation of the kernel
                if (alien.core) {
                    alien.core.rotation.y = time * 0.002;
                    alien.core.rotation.x = time * 0.001;
                    alien.core.scale.setScalar(1.0 + Math.sin(time * 0.008) * 0.1);
                }

                if (dist < 4.2) {
                    const attackMove = Math.sin(time * 0.04) * 0.8;
                    if (alien.leftShoulder) alien.leftShoulder.rotation.x = attackMove;
                    if (alien.rightShoulder) alien.rightShoulder.rotation.x = attackMove;
                } else {
                    const pincerMovement = Math.sin(time * 0.005 + alien.mesh.position.z) * 0.3;
                    if (alien.leftShoulder) alien.leftShoulder.rotation.x = pincerMovement;
                    if (alien.rightShoulder) alien.rightShoulder.rotation.x = pincerMovement;
                }

                // wings
                const flapAngle = Math.sin(time * 0.015 + alien.mesh.position.x) * 0.8; 
                const pitchAngle = Math.cos(time * 0.015 + alien.mesh.position.x) * 0.2; 
                if (alien.leftWing) alien.leftWing.rotation.set(pitchAngle, 0, flapAngle);
                if (alien.rightWing) alien.rightWing.rotation.set(pitchAngle, 0, -flapAngle);
            }

            // --- DAMAGE LOGIC ---
            if (dist < 4.2) {
                state.playerHealth -= 0.6; 
                dom.healthValSpan.textContent = Math.max(0, Math.floor(state.playerHealth));
                
                if (state.playerHealth <= 0 && !state.isGameOver) {
                    state.isGameOver = true;
                    document.exitPointerLock(); 
                    crosshair.style.display = 'none'; 
                    cooldownUI.style.display = 'none';
                    
                    playMusic('gameover');
                    dom.gameoverScreen.classList.remove('hidden');
                    dom.missionHud.classList.add('hidden');
                    dom.lightHud.classList.add('hidden');
                    dom.radarHud.classList.add('hidden');
                }
            }
        });

        //  6. Win

        if (combatPhase && aliens.length === 0 && roverGroup.position.distanceTo(extractionPointGroup.position) < 6.5 && !state.missionWon) {
            document.exitPointerLock();
            crosshair.style.display = 'none';
            cooldownUI.style.display = 'none';
            state.missionWon = true; 
            armBase.visible = true;
            window.winStartTime = performance.now(); 
            
            playMusic('victory'); 
            
            dom.missionStatus.textContent = "Extraction Pad Reached! Aligning rover...";
            dom.missionStatus.style.color = "#00ffd5";
            dom.radarHud.classList.add('hidden');

            // Build and trigger the victory UI screen after cinematic ends
            setTimeout(() => {
                const victoryScreen = document.createElement('div');
                victoryScreen.style.position = 'absolute';
                victoryScreen.style.top = '0';
                victoryScreen.style.left = '0';
                victoryScreen.style.width = '100vw';
                victoryScreen.style.height = '100vh';
                victoryScreen.style.backgroundColor = 'rgba(0, 5, 10, 0.9)'; 
                victoryScreen.style.display = 'flex';
                victoryScreen.style.flexDirection = 'column';
                victoryScreen.style.justifyContent = 'center';
                victoryScreen.style.alignItems = 'center';
                victoryScreen.style.fontFamily = 'monospace';
                victoryScreen.style.zIndex = '9999';
                victoryScreen.style.opacity = '0'; 
                victoryScreen.style.transition = 'opacity 2s ease-in-out';
                
                victoryScreen.innerHTML = `
                    <h1 style="font-size: 5rem; color: #00ffd5; text-shadow: 0 0 25px #00ffd5; text-align: center; margin: 0; text-transform: uppercase;">
                        Mission Accomplished
                    </h1>
                    <h2 style="font-size: 2.5rem; color: #ffaa00; text-shadow: 0 0 15px #ffaa00; margin-top: 15px; text-align: center;">
                        Rover Recovered. You escaped Mars!
                    </h2>
                    <p style="color: #ffffff; font-size: 1.2rem; margin-top: 20px; text-align: center; max-width: 650px; line-height: 1.5; text-shadow: 0 0 5px #ffffff;">
                        You successfully gathered all energy cores, powered up the extraction base, and survived the alien swarm. Outstanding job, Commander.
                    </p>
                    <button id="victory-restart" style="margin-top: 40px; padding: 15px 40px; font-size: 1.5rem; background-color: #00ffd5; color: #000; font-weight: bold; border: none; border-radius: 5px; cursor: pointer; box-shadow: 0 0 15px #00ffd5; text-transform: uppercase; transition: transform 0.2s;">
                        Play Again
                    </button>
                `;
                
                document.body.appendChild(victoryScreen);
                setTimeout(() => { victoryScreen.style.opacity = '1'; }, 50);

                const restartBtn = document.getElementById('victory-restart');
                restartBtn.addEventListener('mouseover', () => restartBtn.style.transform = 'scale(1.1)');
                restartBtn.addEventListener('mouseout', () => restartBtn.style.transform = 'scale(1)');
                restartBtn.addEventListener('click', () => window.location.reload());
            }, 8500);
        }
    }

 // 7. Suspension and Terrain adaptation
    
    const wheelData = [
        { name: 'frontLeft', forkName: 'frontLeft', offsetX: -2.65, offsetZ: 1.8 },
        { name: 'frontRight', forkName: 'frontRight', offsetX: 2.65, offsetZ: 1.8 },
        { name: 'backLeft', forkName: 'backLeft', offsetX: -2.65, offsetZ: -1.8 },
        { name: 'backRight', forkName: 'backRight', offsetX: 2.65, offsetZ: -1.8 }
    ];
    
    let totalHeight = 0;
    const groundHeights = {}; 

    chassisGroup.updateWorldMatrix(true, false);

    wheelData.forEach(data => {
        const wheel = loadedWheels[data.name];
        const fork = loadedForks[data.forkName];
        if (wheel && fork) {

            const anchor = new THREE.Vector3(data.offsetX, 0, data.offsetZ);
            anchor.applyAxisAngle(new THREE.Vector3(0, 1, 0), roverGroup.rotation.y);
            anchor.add(roverGroup.position);
            
            rayOrigin.copy(anchor); 
            rayOrigin.y += 15; 
            raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));

            const intersects = raycaster.intersectObjects([floor, depositStationGroup, extractionPointGroup], true);
            
            if (intersects.length > 0) {
                const groundY = intersects[0].point.y;
                groundHeights[data.name] = groundY;
                totalHeight += groundY;
                
                const wheelRadius = 0.45; 
                
                const targetWorldPos = new THREE.Vector3(anchor.x, groundY + wheelRadius, anchor.z);
                
                chassisGroup.worldToLocal(targetWorldPos);
                
                const targetWheelY = targetWorldPos.y;
                
                // Soft movement
                wheel.position.y = THREE.MathUtils.lerp(wheel.position.y, targetWheelY, 0.2);

                // fork dynamics
                const forkTopY = -0.4;
                const forkBottomY = wheel.position.y;
                const distance = Math.abs(forkTopY - forkBottomY);

                fork.scale.y = THREE.MathUtils.lerp(fork.scale.y, Math.max(0.1, distance), 0.3);
                fork.position.y = (forkTopY + forkBottomY) / 2; 
            }
        }
    });

    // Pitch and Roll
    if (Object.keys(groundHeights).length === 4) {
        const frontY = (groundHeights.frontLeft + groundHeights.frontRight) / 2;
        const backY = (groundHeights.backLeft + groundHeights.backRight) / 2;
        const leftY = (groundHeights.frontLeft + groundHeights.backLeft) / 2;
        const rightY = (groundHeights.frontRight + groundHeights.backRight) / 2;

        let targetPitch = Math.atan2(frontY - backY, 3.6);

        let targetRoll = Math.atan2(rightY - leftY, 5.3);

        if (keys.w) targetPitch -= 0.04;
        if (keys.s) targetPitch += 0.04;
        if (keys.a) targetRoll += 0.03;
        if (keys.d) targetRoll -= 0.03;

        targetPitch = THREE.MathUtils.clamp(targetPitch, -0.5, 0.5);
        targetRoll = THREE.MathUtils.clamp(targetRoll, -0.5, 0.5);

        chassisGroup.rotation.x = THREE.MathUtils.lerp(chassisGroup.rotation.x, -targetPitch, 0.1);
        chassisGroup.rotation.z = THREE.MathUtils.lerp(chassisGroup.rotation.z, targetRoll, 0.1);
    }

    // --- Vibrationa and Particles ---
    let targetChassisY = 1.5;
    if (isMoving && !collided) {
        targetChassisY += Math.sin(time * 0.04) * 0.02; 
        
        const rotationAmount = (currentSpeed * 0.6) * wheelDirection; 
        Object.values(loadedWheels).forEach(w => { if (w) w.rotateZ(-rotationAmount); });

        if (loadedWheels['backLeft'] && loadedWheels['backRight']) {
            const blPos = new THREE.Vector3();
            const brPos = new THREE.Vector3();
            loadedWheels['backLeft'].getWorldPosition(blPos);
            loadedWheels['backRight'].getWorldPosition(brPos);
            
            blPos.y -= 0.3; brPos.y -= 0.3; 
            emitDust(blPos, Math.abs(currentSpeed));
            emitDust(brPos, Math.abs(currentSpeed));
        }
    }

    chassisGroup.position.y = THREE.MathUtils.lerp(chassisGroup.position.y, targetChassisY, 0.1);
    roverGroup.position.y = THREE.MathUtils.lerp(roverGroup.position.y, (totalHeight / 4) + 1.2, 0.1);
    
    // 8. Camera update and Render

    if (combatPhase) {
        // --- FPS ---
        const fpvOffset = new THREE.Vector3(0, 3.2, 4.0); 
        fpvOffset.applyQuaternion(roverGroup.quaternion); 
        const fpvPos = roverGroup.position.clone().add(fpvOffset);  
        
        camera.position.lerp(fpvPos, 0.4); 
        
        const totalYaw = roverGroup.rotation.y; 
        const lookX = camera.position.x + Math.sin(totalYaw) * Math.cos(turretPitch);
        const lookY = camera.position.y + Math.sin(turretPitch);
        const lookZ = camera.position.z + Math.cos(totalYaw) * Math.cos(turretPitch);
        
        camera.lookAt(lookX, lookY, lookZ);

        if (cannonHead) {
            cannonHead.rotation.x = -turretPitch; 
        }
        let cooldown = 1500;
        if (state.difficulty === 'easy') cooldown = 1000;
        else if (state.difficulty === 'hard') cooldown = 2000;

        const currentTime = performance.now();
        const elapsed = currentTime - lastShotTime;
        
        if (elapsed < cooldown) {
            const percent = (elapsed / cooldown) * 100;
            cooldownUI.style.background = `conic-gradient(#ffaa00 ${percent}%, rgba(0,0,0,0.6) ${percent}%)`;
            cooldownUI.style.boxShadow = "0 0 8px #ffaa00";
            cooldownUI.style.borderColor = "#ffaa00";
        } else {
            cooldownUI.style.background = `conic-gradient(#00ffd5 100%, rgba(0,0,0,0.6) 0%)`;
            cooldownUI.style.boxShadow = "0 0 10px #00ffd5";
            cooldownUI.style.borderColor = "#00ffd5";
        }
        const now = performance.now();
        if (now - lastRoarTime > 2000) {
            if (Math.random() < 0.4 && aliens.length > 0) {
                const rSound = roarSound.cloneNode();
                rSound.volume = 0.3 + (Math.random() * 0.4); 
                rSound.play().catch(e => console.log("Roar audio error:", e));
            }
            lastRoarTime = now; 
        }
    } else {
        // --- THIRD PERSON VIEW ---
        const deltaPosition = new THREE.Vector3().subVectors(roverGroup.position, previousPosition);
        camera.position.add(deltaPosition);
        controls.target.copy(roverGroup.position);
        controls.update(); 
    }
    
    updateDust();
    
    updateSandstorm();

    renderer.render(scene, camera);
}

// Start Loop
animate();