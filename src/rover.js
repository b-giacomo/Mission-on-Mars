import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from './setup.js';
import { dom } from './ui.js';

// --- Scene Graph Setup ---

// roverGroup: The main container for the entire rover.
// chassisGroup: Holds the main body, elevated from the ground.
// magnetGroup: The end-effector of the robotic arm.
export const roverGroup = new THREE.Group();
export const chassisGroup = new THREE.Group();
export const magnetGroup = new THREE.Group();
export const loadedWheels = {};
export const loadedForks = {};

scene.add(roverGroup);
// Elevate the chassis to make room for the wheels and suspension
chassisGroup.position.y = 1.5; 
roverGroup.add(chassisGroup);

// --- Loaders & Materials ---

const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

// Textures
const colorMap = textureLoader.load('./textures/corrugated_iron_02_diff_1k.jpg');
const normalMap = textureLoader.load('./textures/corrugated_iron_02_nor_gl_1k.jpg');
const roughnessMap = textureLoader.load('./textures/corrugated_iron_02_rough_1k.jpg');
const metalnessMap = textureLoader.load('./textures/corrugated_iron_02_metal_1k.jpg');
const aoMap = textureLoader.load('./textures/corrugated_iron_02_ao_1k.jpg');

// Define reusable materials for the rover's components
const roverMaterial = new THREE.MeshStandardMaterial({ map: colorMap, normalMap, roughnessMap, metalnessMap, aoMap });
const darkMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, metalness: 0.6 });
const solarPanelMaterial = new THREE.MeshStandardMaterial({ color: 0x050515, roughness: 0.1, metalness: 0.9 });
export const glowingBulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

// --- Chassis Construction ---

// procedural geometry (boxes and cylinders)
const mainBody = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 3.5), roverMaterial);
mainBody.castShadow = true; chassisGroup.add(mainBody);

const frontSlope = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 1.5), roverMaterial);
frontSlope.position.set(0, -0.1, 2.3); frontSlope.rotation.x = Math.PI / 8; chassisGroup.add(frontSlope);

const backPanel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.8, 1), roverMaterial);
backPanel.position.set(0, 0.1, -2.1); chassisGroup.add(backPanel);

// side modules
const leftModule = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 16), roverMaterial);
leftModule.rotation.x = Math.PI / 2; leftModule.position.set(-1.4, 0, 0); chassisGroup.add(leftModule);

const rightModule = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 16), roverMaterial);
rightModule.rotation.x = Math.PI / 2; rightModule.position.set(1.4, 0, 0); chassisGroup.add(rightModule);

// Structural support bars
const leftBar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 3.8), darkMetalMaterial);
leftBar.position.set(-1.4, -0.4, 0); chassisGroup.add(leftBar);

const rightBar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 3.8), darkMetalMaterial);
rightBar.position.set(1.4, -0.4, 0); chassisGroup.add(rightBar);

const frontBar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.15, 0.2), darkMetalMaterial);
frontBar.position.set(0, -0.4, 1.8); chassisGroup.add(frontBar);

const backBar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.15, 0.2), darkMetalMaterial);
backBar.position.set(0, -0.4, -1.8); chassisGroup.add(backBar);

// --- Suspension & Forks ---

// create and position the wheel forks
function addExtensibleFork(name, x, z) {
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0), darkMetalMaterial);
    fork.position.set(x, -0.9, z); chassisGroup.add(fork); loadedForks[name] = fork;
}
addExtensibleFork('frontLeft', -2.3, 1.8); addExtensibleFork('frontRight', 2.3, 1.8);
addExtensibleFork('backLeft', -2.3, -1.8); addExtensibleFork('backRight', 2.3, -1.8);

// --- Instruments & Antennas ---
const solarPanel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.5), solarPanelMaterial);
solarPanel.position.set(0, 0.55, 0.5);
chassisGroup.add(solarPanel);

const antennaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5), darkMetalMaterial);
antennaBase.position.set(-0.8, 1, -1.2); 
chassisGroup.add(antennaBase);

const antennaDish = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.5), roverMaterial);
antennaDish.position.set(0, 0.8, 0); 
antennaDish.rotation.x = Math.PI / 3; 
antennaBase.add(antennaDish);
 
// bumper
const bumperGeo = new THREE.CylinderGeometry(0.15, 0.15, 3.2, 8);
bumperGeo.rotateZ(Math.PI / 2);
const frontBumper = new THREE.Mesh(bumperGeo, darkMetalMaterial);
frontBumper.position.set(0, -0.2, 2.7);
chassisGroup.add(frontBumper);

const bumperGuardL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8), darkMetalMaterial);
bumperGuardL.position.set(-1.0, 0.1, 2.7);
bumperGuardL.rotation.x = Math.PI / 6;
chassisGroup.add(bumperGuardL);

const bumperGuardR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8), darkMetalMaterial);
bumperGuardR.position.set(1.0, 0.1, 2.7);
bumperGuardR.rotation.x = Math.PI / 6;
chassisGroup.add(bumperGuardR);

// --- Weapon system ---

export const cannonHead = new THREE.Group();
cannonHead.position.set(0, 0.2, 2.5); 
chassisGroup.add(cannonHead);

// 1. left cannon
const cannonL = new THREE.Group();
cannonL.position.set(-1.1, 0, 0);
cannonHead.add(cannonL);

const weaponCoreL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.8), roverMaterial);
weaponCoreL.castShadow = true;
cannonL.add(weaponCoreL);

const barrelGeo = new THREE.CylinderGeometry(0.1, 0.12, 1.2, 16);
barrelGeo.rotateX(Math.PI / 2); 

const barrelL = new THREE.Mesh(barrelGeo, darkMetalMaterial);
barrelL.position.set(0, 0, 0.6);
barrelL.castShadow = true;
cannonL.add(barrelL);

// 2. right cannon
const cannonR = new THREE.Group();
cannonR.position.set(1.1, 0, 0); 
cannonHead.add(cannonR);

const weaponCoreR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.8), roverMaterial);
weaponCoreR.castShadow = true;
cannonR.add(weaponCoreR);

const barrelR = new THREE.Mesh(barrelGeo, darkMetalMaterial);
barrelR.position.set(0, 0, 0.6);
barrelR.castShadow = true;
cannonR.add(barrelR);

// 3. gun barrel
const muzzleGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.15, 16);
muzzleGeo.rotateX(Math.PI / 2);
const laserGlowMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.0 });

const muzzleL = new THREE.Mesh(muzzleGeo, laserGlowMat);
muzzleL.position.set(0, 0, 1.25);
cannonL.add(muzzleL);

const muzzleR = new THREE.Mesh(muzzleGeo, laserGlowMat);
muzzleR.position.set(0, 0, 1.25);
cannonR.add(muzzleR);

// 4. central point of shoot
export const firePoint = new THREE.Object3D();
firePoint.position.set(0, 0, 1.25); 
cannonHead.add(firePoint);

// --- Headlight System ---

// Spotlight pointing forward, casting dynamic shadows
export const roverLight = new THREE.SpotLight(0xffecd2, 35, 60, Math.PI / 4, 0.4, 1);
roverLight.castShadow = true;
roverLight.shadow.mapSize.width = 1024; //high resolution shadow map
roverLight.shadow.mapSize.height = 1024;
roverLight.shadow.bias = -0.001; //prevent shadow acne artifacts

// Physical representation of the lightbulb
export const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), glowingBulbMaterial);

// GLTF model for the headlight casing
gltfLoader.load('./models/headlight/headlight.glb', (gltf) => {
    const headlightModel = gltf.scene;
    headlightModel.scale.set(3, 3, 3); 
    headlightModel.position.set(0, -0.3, 3.2); 
    
    // shadows
    headlightModel.traverse(child => { 
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true; } 
    });

    chassisGroup.add(headlightModel);

    // Position the light and its target relative to the headlight model
    roverLight.position.set(0, 0, 0.5); roverLight.target.position.set(0, -0.5, 10); 
    bulbMesh.position.set(0, 0, 0.1); 
    headlightModel.add(bulbMesh); headlightModel.add(roverLight); headlightModel.add(roverLight.target);
});

// --- Wheels integration ---

// single wheel model and clone it for all 4 positions
gltfLoader.load('./models/wheels/wheels.glb', (gltf) => {
    const wheelModel = gltf.scene;
    wheelModel.scale.set(0.5, 0.5, 0.5); 
    
    // shadows
    wheelModel.traverse(child => { 
        if (child.isMesh) { 
            child.castShadow = true; 
            child.receiveShadow = true; 
        } 
    });
    
    function placeWheel(name, x, y, z) {
        const newWheel = wheelModel.clone(); 
        newWheel.position.set(x, y, z); newWheel.rotation.y = Math.PI / 2;
        chassisGroup.add(newWheel); loadedWheels[name] = newWheel; 
    }
    placeWheel('frontLeft', -2.65, -1.4, 1.8); 
    placeWheel('frontRight', 2.65, -1.4, 1.8);
    placeWheel('backLeft', -2.65, -1.4, -1.8); 
    placeWheel('backRight', 2.65, -1.4, -1.8);
});

// --- ROBOTIC ARM ---

// The arm uses a hierarchical structure 
// to simulate Forward Kinematics. Rotating a parent group moves all children naturally
export const armBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 32), roverMaterial);
armBase.position.set(0, 0.65, 1.5);
armBase.castShadow = true; chassisGroup.add(armBase); 

export const lowerPivot = new THREE.Group(); 
lowerPivot.position.y = 0.3; armBase.add(lowerPivot); 

const joint1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6), darkMetalMaterial);
joint1.rotation.z = Math.PI / 2; joint1.castShadow = true; lowerPivot.add(joint1);

const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.5, 0.25), roverMaterial);
lowerArm.position.y = 2.25; lowerArm.castShadow = true; lowerPivot.add(lowerArm); 

export const upperPivot = new THREE.Group(); 
upperPivot.position.y = 2.25; lowerArm.add(upperPivot); 

const joint2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5), darkMetalMaterial);
joint2.rotation.z = Math.PI / 2; joint2.castShadow = true; upperPivot.add(joint2);

const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 0.2), roverMaterial);
upperArm.position.y = 1.75; upperArm.castShadow = true; upperPivot.add(upperArm); 

// --- ELECTROMAGNET (End-Effector) ---

magnetGroup.position.y = 3.5; upperPivot.add(magnetGroup);

const magnetHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 0.25, 16), darkMetalMaterial);
magnetHousing.rotation.x = Math.PI / 2; magnetHousing.castShadow = true; magnetGroup.add(magnetHousing);

const coilGeo = new THREE.TorusGeometry(0.35, 0.08, 16, 32);
const magnetCoil = new THREE.Mesh(coilGeo, new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1.0, roughness: 0.3 }));
magnetCoil.rotation.x = Math.PI / 2; magnetCoil.position.z = 0.05; magnetGroup.add(magnetCoil);

// Emissive material makes the core look like it's glowing
const magnetCoreMaterial = new THREE.MeshStandardMaterial({ color: 0x00d5ff, emissive: 0x0077ff, emissiveIntensity: 2.0 });
const magnetCore = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.28, 16), magnetCoreMaterial);
magnetCore.rotation.x = Math.PI / 2; magnetGroup.add(magnetCore);

// Localized blue light around the active electromagnet
const magnetLight = new THREE.PointLight(0x0055ff, 5.0, 8);
magnetLight.position.set(0, 0, 0.5); 
magnetGroup.add(magnetLight);

// --- HUD BINDINGS (User Interface Interaction) ---

// Connects the HTML DOM elements to the Three.js objects
let lightIsOn = true;

// Change headlight color dynamically
dom.colorInput.addEventListener('input', (e) => { 
    roverLight.color.set(e.target.value);
    glowingBulbMaterial.color.set(e.target.value); 
});

// Change headlight intensity dynamically
dom.intensityRange.addEventListener('input', (e) => { 
    roverLight.intensity = parseFloat(e.target.value); });

dom.powerBtn.addEventListener('click', () => {
    lightIsOn = !lightIsOn;
    roverLight.visible = lightIsOn; bulbMesh.visible = lightIsOn;
    dom.powerBtn.textContent = lightIsOn ? "ON" : "OFF";
    dom.powerBtn.classList.toggle('off', !lightIsOn);
});

// Control the robotic arm kinematics via HTML sliders
dom.jointBaseInput.addEventListener('input', (e) => { armBase.rotation.y = parseFloat(e.target.value); });
dom.jointLowerInput.addEventListener('input', (e) => { lowerPivot.rotation.x = parseFloat(e.target.value); });
dom.jointUpperInput.addEventListener('input', (e) => { upperPivot.rotation.x = parseFloat(e.target.value); });