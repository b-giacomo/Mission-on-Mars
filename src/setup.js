import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Scene setup ---

export const scene = new THREE.Scene();

const nightColor = new THREE.Color(0x0a0402);
scene.background = nightColor.clone();
scene.fog = new THREE.FogExp2(0xd47a55, 0.015);

// --- Camera setup ---

export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 12, -18); 

// --- Render setup ---

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

// --- controls ---

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- Dynamic lights (sun) ---

export const maxAmbientIntensity = 0.45;
export const ambientLight = new THREE.AmbientLight(0xffb896, 0.05); 
scene.add(ambientLight);

export const maxSunIntensity = 2.2;
export const sunLight = new THREE.DirectionalLight(0xffeedd, 0.0); 
sunLight.position.set(80, 40, -60);
sunLight.castShadow = true;

// Optimize shadow map for the large environment
sunLight.shadow.camera.left = -150; 
sunLight.shadow.camera.right = 150;
sunLight.shadow.camera.top = 150; 
sunLight.shadow.camera.bottom = -150;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
sunLight.shadow.bias = -0.001;
sunLight.shadow.mapSize.width = 4096; 
sunLight.shadow.mapSize.height = 4096;
scene.add(sunLight);

// --- Window resize handler ---

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});