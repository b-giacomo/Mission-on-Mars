import * as THREE from 'three';
import { scene } from './setup.js';

// --- Particle Pool Setup ---

const particleCount = 150;
// simple BoxGeometry
const dustGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2); 
// Material simulating martian dust
const dustMaterial = new THREE.MeshStandardMaterial({
    color: 0xa84828, 
    transparent: true,
    opacity: 0.8,
    roughness: 1.0,
    depthWrite: false 
});

export const dustParticles = [];

// Pre-allocate the particles and hide them in the scene
for (let i = 0; i < particleCount; i++) {
    const mesh = new THREE.Mesh(dustGeometry, dustMaterial);
    mesh.visible = false;
    scene.add(mesh);
    dustParticles.push({
        mesh: mesh,
        life: 0,
        maxLife: 15 + Math.random() * 15,
        velocity: new THREE.Vector3()
    });
}

let pIndex = 0;

// Emits a single dust particle at the given position
export function emitDust(position, speed) {
    const p = dustParticles[pIndex];
    
    // 1. initial position with a random offset
    p.mesh.position.copy(position);
    p.mesh.position.x += (Math.random() - 0.5) * 0.4;
    p.mesh.position.z += (Math.random() - 0.5) * 0.4;
    p.mesh.position.y += Math.random() * 0.3;

    // 2. velocity based on rover speed and randomness
    p.velocity.set(
        (Math.random() - 0.5) * 0.1,
        0.05 + Math.random() * 0.1 * speed,
        (Math.random() - 0.5) * 0.1
    );

    // 3. reset particle state (visible and fully opaque)
    p.life = p.maxLife;
    p.mesh.visible = true;
    p.mesh.material.opacity = 0.8;
    p.mesh.scale.set(1, 1, 1);

    // 4. move to the next particle in the pool
    pIndex = (pIndex + 1) % particleCount;
}

// Updates the physics and visuals of all active particles
export function updateDust() {
    for (let p of dustParticles) {
        if (p.life > 0) {
            // Decrease lifespan
            p.life--;
            // Apply velocity to position
            p.mesh.position.add(p.velocity);
            p.velocity.y -= 0.005; // Gravity
            
            // random tumbling effect
            p.mesh.rotation.x += 0.1;
            p.mesh.rotation.y += 0.1;

            // Fade
            const lifeRatio = p.life / p.maxLife;
            p.mesh.material.opacity = lifeRatio * 0.8;
            p.mesh.scale.setScalar(lifeRatio);

            // Hide the particle once its life runs out
            if (p.life <= 0) p.mesh.visible = false;
        }
    }
}