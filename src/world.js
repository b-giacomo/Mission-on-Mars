import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene } from './setup.js';
import { roverGroup } from './rover.js';
import { state, dom } from './ui.js';

const gltfLoader = new GLTFLoader();

// 1. Terrain Generation

export function getTerrainHeight(x, z) {
    const distToCenter = Math.sqrt(x*x + z*z);
    const distToBase = Math.sqrt(x*x + (z + 20)**2); 
    const distToEscape = Math.sqrt(x*x + (z - 90)**2); 

    // Flatten the terrain around key points
    if (distToCenter <= 12 || distToBase <= 15 || distToEscape <= 15) return 0; 

    // Composite waves for hills and craters
    let y = Math.sin(x * 0.015) * Math.cos(z * 0.015) * 12.0; 
    y += Math.sin(x * 0.08) * Math.cos(z * 0.08) * 3.0;    
    y += Math.sin(x * 0.25) * Math.cos(z * 0.25) * 1.0;   
    // Prevent valleys from going too deep under the models   
    if (y < -3) y = -3;

    // Apply a stepped/terraced look to the terrain
    return Math.floor(y / 0.8) * 0.8; 
}

// Create a highly subdivided plane to allow vertex manipulation based on getTerrainHeight
export const floorGeo = new THREE.PlaneGeometry(250, 250, 128, 128);
floorGeo.rotateX(-Math.PI / 2); 

const positionAttribute = floorGeo.attributes.position;
for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const z = positionAttribute.getZ(i);
    // Displace each vertex vertically based on our math function
    positionAttribute.setY(i, getTerrainHeight(x, z));
}
// Recalculate lighting normals after displacing vertices
floorGeo.computeVertexNormals(); 

// Flat shading gives the terrain a stylized, low-poly aesthetic
const floorMat = new THREE.MeshStandardMaterial({ color: 0xa84828, roughness: 0.95, metalness: 0.05, flatShading: true });
export const floor = new THREE.Mesh(floorGeo, floorMat);
floor.receiveShadow = true;
scene.add(floor);

const moundMaterial = new THREE.MeshStandardMaterial({ color: 0x8a3822, roughness: 0.9, metalness: 0.05 });
moundMaterial.flatShading = true;

// 2. Deposit station (Base)

const textureLoader = new THREE.TextureLoader();
const baseColor = textureLoader.load('./textures/base_metal_diff.jpg');
const baseNormal = textureLoader.load('./textures/base_metal_nor.jpg');
const baseRough = textureLoader.load('./textures/base_metal_rough.jpg');

// Tile the texture properly across the geometry
baseColor.wrapS = baseColor.wrapT = THREE.RepeatWrapping;
baseNormal.wrapS = baseNormal.wrapT = THREE.RepeatWrapping;
baseRough.wrapS = baseRough.wrapT = THREE.RepeatWrapping;
baseColor.repeat.set(4, 4); baseNormal.repeat.set(4, 4); baseRough.repeat.set(4, 4);

const baseMat = new THREE.MeshStandardMaterial({
    map: baseColor, normalMap: baseNormal, roughnessMap: baseRough, metalness: 0.8
});

export const depositStationGroup = new THREE.Group();
depositStationGroup.position.set(0, getTerrainHeight(0, -20), -20);
scene.add(depositStationGroup);

const platform = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 1, 32), baseMat);
platform.position.y = 0.5; platform.receiveShadow = true;
depositStationGroup.add(platform);

const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 3.5, 16), baseMat);
tower.position.y = 2.5; tower.castShadow = true; tower.receiveShadow = true;
tower.raycast = () => {};
depositStationGroup.add(tower);

// The glowing hopper where batteries are deposited
const hopper = new THREE.Mesh(new THREE.TorusGeometry(2, 0.4, 16, 32), new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.6 }));
hopper.position.y = 4.3; hopper.rotation.x = Math.PI / 2;
hopper.raycast = () => {};
depositStationGroup.add(hopper);

const hopperLight = new THREE.PointLight(0xffaa00, 3, 15);
hopperLight.position.y = 5.0; depositStationGroup.add(hopperLight);

// Export world coordinates of the hopper for the battery physics
export const hopperWorldPos = new THREE.Vector3(0, hopper.position.y + depositStationGroup.position.y, -20);

// 3. Procedural obstacles
export const obstacles = [];

// Base invisible barrier to prevent driving directly into the deposit station
obstacles.push({
    position: new THREE.Vector3(0, 0, -20),
    radius: 3.0 
});

const giantCubeGeo = new THREE.BoxGeometry(2, 2, 2); 

// Procedurally generate 110 obstacle clusters
for (let i = 0; i < 110; i++) { 
    const moundGroup = new THREE.Group();
    const obsType = Math.random();
    let maxRadius = 0;
    
    // Polar coordinates for random distribution
    const angle = Math.random() * Math.PI * 2;
    const distance = 15 + Math.random() * 105; 
    const cx = Math.cos(angle) * distance;
    const cz = Math.sin(angle) * distance;

    // Keep key areas clear
    if (Math.sqrt(cx*cx + (cz + 20)**2) < 20 || Math.sqrt(cx*cx + (cz - 90)**2) < 20) {
        continue;
    }

    const groundY = getTerrainHeight(cx, cz);

    // Randomize obstacle formations
    if (obsType < 0.25) {
        // Vertical Pillar
        const height = 3 + Math.floor(Math.random() * 4); 
        for (let j = 0; j < height; j++) {
            const block = new THREE.Mesh(giantCubeGeo, moundMaterial);
            block.scale.set(1.5, 1.5, 1.5);
            block.position.set(0, j * 3 + 1.5, 0); 
            block.castShadow = true; block.receiveShadow = true;
            moundGroup.add(block);
        }
        maxRadius = 1.8;
    } else if (obsType < 0.50) {
        // Messy Cluster
        const numBlocks = 5 + Math.floor(Math.random() * 5);
        for (let j = 0; j < numBlocks; j++) {
            const block = new THREE.Mesh(giantCubeGeo, moundMaterial);
            const sX = 1 + Math.random() * 2.5; 
            const sZ = 1 + Math.random() * 2.5;
            const sY = 1 + Math.random() * 1.5;
            block.scale.set(sX, sY, sZ);
            const oX = (Math.random() - 0.5) * 6; 
            const oZ = (Math.random() - 0.5) * 6;
            block.position.set(oX, sY, oZ); 
            block.castShadow = true; block.receiveShadow = true;
            moundGroup.add(block);
            
            const distFromCenter = Math.sqrt(oX * oX + oZ * oZ);
            const r = Math.max(sX, sZ) * 1.2 + distFromCenter;
            if (r > maxRadius) maxRadius = r;
        }
    } else if (obsType < 0.75) {
        // Monolith / Archway
        const block1 = new THREE.Mesh(giantCubeGeo, moundMaterial);
        block1.scale.set(2.5, 3.5, 2.5); block1.position.set(0, 3.5, 0); 
        block1.castShadow = true; block1.receiveShadow = true; moundGroup.add(block1);
        const block2 = new THREE.Mesh(giantCubeGeo, moundMaterial);
        block2.scale.set(1.5, 1.5, 1.5); block2.position.set(3, 1.5, 0); 
        block2.castShadow = true; block2.receiveShadow = true; moundGroup.add(block2);
        const block3 = new THREE.Mesh(giantCubeGeo, moundMaterial);
        block3.scale.set(1.5, 1.5, 1.5); block3.position.set(-3, 1.5, 0); 
        block3.castShadow = true; block3.receiveShadow = true; moundGroup.add(block3);
        maxRadius = 4.2;
    } else {
        // Wall formation
        const isXAligned = Math.random() > 0.5;
        const length = 6 + Math.floor(Math.random() * 6); 
        const height = 3 + Math.floor(Math.random() * 3); 
        const thickness = 1 + Math.floor(Math.random() * 2);

        for (let j = 0; j < length; j++) {
            for (let h = 0; h < height; h++) {
                for (let t = 0; t < thickness; t++) {
                    if (Math.random() < 0.15) continue; 
                    const block = new THREE.Mesh(giantCubeGeo, moundMaterial);
                    const oX = isXAligned ? (j - length/2) * 2 : (t - thickness/2) * 2;
                    const oZ = isXAligned ? (t - thickness/2) * 2 : (j - length/2) * 2;
                    block.position.set(oX, h * 2 + 1, oZ);
                    block.castShadow = true; block.receiveShadow = true;
                    moundGroup.add(block);
                }
            }
        }
        moundGroup.position.set(cx, groundY, cz); scene.add(moundGroup);

        // Add multiple collision points along the wall
        for (let j = 0; j < length; j += 1.5) {
            const oX = isXAligned ? (j - length/2) * 2 : 0;
            const oZ = isXAligned ? 0 : (j - length/2) * 2;
            obstacles.push({ position: new THREE.Vector3(cx + oX, groundY, cz + oZ), radius: 1.2 });
        }
        continue; 
    }

    moundGroup.position.set(cx, groundY, cz);
    scene.add(moundGroup);

    obstacles.push({ position: moundGroup.position, radius: maxRadius * 0.85 }); 
}

// 4. Battery spawning logic

export const batteries = [];

export function generateBatteries() {
    let minRadius = 30;
    let maxRadius = 110;

    if (state.difficulty === 'easy') {
        state.totalBatteries = 3; // Easy
        maxRadius = 60;
    } else if (state.difficulty === 'hard') {
        state.totalBatteries = 8; // Hard
        maxRadius = 115;
    } else {
        state.totalBatteries = 5; // Normal
    }

    for (let i = 0; i < state.totalBatteries; i++) {
        const batteryGroup = new THREE.Group();
        let validPosition = false; let cx, cz;
        let attempts = 0; 
        
        // Brute-force validation loop
        while (!validPosition && attempts < 100) {
            attempts++;
            const angle = Math.random() * Math.PI * 2;
            const distance = minRadius + Math.random() * (maxRadius - minRadius); 
            cx = Math.cos(angle) * distance; cz = Math.sin(angle) * distance;
            validPosition = true;
            
            // Prevent spawning inside obstacles
            for (let obs of obstacles) {
                if (Math.sqrt((cx - obs.position.x)**2 + (cz - obs.position.z)**2) < obs.radius + 3.0) {
                    validPosition = false; break;
                }
            }

            // Prevent batteries from clumping together
            if (validPosition) {
                for (let b of batteries) {
                    if (Math.sqrt((cx - b.mesh.position.x)**2 + (cz - b.mesh.position.z)**2) < 40.0) {
                        validPosition = false; break;
                    }
                }
            }
        }
        
        const groundY = getTerrainHeight(cx, cz);
        batteryGroup.position.set(cx, groundY, cz); 
        scene.add(batteryGroup);

        // Add a localized orange glow to make batteries visible in the dark
        const bLight = new THREE.PointLight(0xffaa00, 1.5, 10);
        bLight.position.set(0, 0.8, 0);
        batteryGroup.add(bLight);

        // Load GLTF 
        gltfLoader.load('./models/battery/battery.glb', (gltf) => {
            const batteryModel = gltf.scene;
            batteryModel.scale.set(0.6, 0.6, 0.6); 
            batteryModel.traverse(child => { if (child.isMesh) child.castShadow = true; });
            batteryGroup.add(batteryModel);
        });

        batteries.push({ mesh: batteryGroup, collected: false, isAttached: false, isDepositing: false });
    }
}

// 5. Extraction pad
export const extractionPointGroup = new THREE.Group();
extractionPointGroup.visible = false;
scene.add(extractionPointGroup);

const extBase = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 10, 0.5, 32), baseMat);
extBase.position.y = 0.25;
extBase.receiveShadow = true;
extractionPointGroup.add(extBase);

const extOuterRing = new THREE.Mesh(
    new THREE.TorusGeometry(9.5, 0.15, 16, 64), 
    new THREE.MeshStandardMaterial({ color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 0.8 })
);
extOuterRing.position.y = 0.5;
extOuterRing.rotation.x = Math.PI / 2;
extractionPointGroup.add(extOuterRing);

const extPad = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 0.5, 32), baseMat);
extPad.position.y = 0.75; 
extPad.receiveShadow = true;
extractionPointGroup.add(extPad);

const extInnerRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.5, 0.2, 16, 64), 
    new THREE.MeshStandardMaterial({ color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 1.5 })
);
extInnerRing.position.y = 1.0;
extInnerRing.rotation.x = Math.PI / 2;
extractionPointGroup.add(extInnerRing);

// Setup for luminous beacons on the corners
for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + (Math.PI / 4);
    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(Math.cos(angle) * 8.5, 0, Math.sin(angle) * 8.5);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 1.5, 8), baseMat);
    pillar.position.y = 0.75;
    pillar.castShadow = true;
    beaconGroup.add(pillar);

    const lightBulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 16, 16), 
        new THREE.MeshStandardMaterial({ color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 2.0 })
    );
    lightBulb.position.y = 1.5;
    beaconGroup.add(lightBulb);

    extractionPointGroup.add(beaconGroup);
}

// Main directional beam for the pad
const extLight = new THREE.PointLight(0x00ffaa, 8, 30);
extLight.position.set(0, 4, 0);
extractionPointGroup.add(extLight);

    // --- "UFO"' light ---
    const beamGeo = new THREE.CylinderGeometry(6, 9, 300, 32, 1, true); 
    const beamMat = new THREE.MeshBasicMaterial({
        color: 0x00ffaa,
        transparent: true,
        opacity: 0.0, 
        blending: THREE.AdditiveBlending, 
        side: THREE.DoubleSide,
        depthWrite: false 
    });
    export const ufoBeam = new THREE.Mesh(beamGeo, beamMat);
    
    
    ufoBeam.position.y = 150; 
    ufoBeam.raycast = () => {};
    extractionPointGroup.add(ufoBeam);

// 6. Alien swarm spawning

export const aliens = [];
export let aliensSpawned = false;

/* let alienTemplate = null;

 Pre-load the alien model to ensure immediate spawning
gltfLoader.load('./models/alien/alien.glb', (gltf) => {
    alienTemplate = gltf.scene;
    alienTemplate.scale.set(1.5, 1.5, 1.5);
    alienTemplate.traverse(child => { if (child.isMesh) child.castShadow = true; });
});
*/

// --- HIERARCHICAL ALIEN MODEL ---

const blockyArmorMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,       // body
    roughness: 0.9,
    metalness: 0.2,
    flatShading: true     
});

const blockyAccentMat = new THREE.MeshStandardMaterial({
    color: 0x8b0000,       //dark read
    roughness: 0.9,
    flatShading: true
});

const blockyWingMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff,       // wings
    transparent: true,
    opacity: 0.4,
    flatShading: true,
    side: THREE.DoubleSide
});

const blockyEyeMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,       // red eyes and heart
    emissive: 0xff0000,
    emissiveIntensity: 2.5,
    flatShading: true
});

export function createHierarchicalAlien() {
    const alienRoot = new THREE.Group();
    alienRoot.scale.set(1.5, 1.5, 1.5);

    // 1. ROOT NODE: thorax
    const thorax = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 2.0), blockyArmorMat);
    thorax.position.y = 2.5;
    thorax.castShadow = true;
    alienRoot.add(thorax);

    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 1.6), blockyArmorMat);
    topPlate.position.set(0, 0.65, 0);
    topPlate.castShadow = true;
    thorax.add(topPlate);

    for(let i=0; i<3; i++) {
        const spike = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), blockyAccentMat);
        spike.position.set(0, 0.8, 0.5 - i * 0.5);
        spike.rotation.x = Math.PI / 8;
        thorax.add(spike);
    }

    const core = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 2.1), blockyEyeMat);
    thorax.add(core);

    const abdomen1 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.2), blockyArmorMat);
    abdomen1.position.set(0, -0.1, -1.6);
    abdomen1.castShadow = true;
    thorax.add(abdomen1);

    const abdomen2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.8), blockyArmorMat);
    abdomen2.position.set(0, -0.2, -2.6);
    abdomen2.castShadow = true;
    thorax.add(abdomen2);

    // 2. CHILD: head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.2, 1.3);
    thorax.add(headGroup);

    const headBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), blockyArmorMat);
    headBase.castShadow = true;
    headGroup.add(headBase);

    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.15), blockyEyeMat);
    eyeL.position.set(-0.25, 0.1, 0.4);
    headGroup.add(eyeL);

    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.15), blockyEyeMat);
    eyeR.position.set(0.25, 0.1, 0.4);
    headGroup.add(eyeR);

    const jawL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.3), blockyAccentMat);
    jawL.position.set(-0.2, -0.4, 0.3);
    jawL.rotation.z = -Math.PI / 8;
    headGroup.add(jawL);

    const jawR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 0.3), blockyAccentMat);
    jawR.position.set(0.2, -0.4, 0.3);
    jawR.rotation.z = Math.PI / 8;
    headGroup.add(jawR);

    headBase.userData.isHead = true;
    eyeL.userData.isHead = true;
    eyeR.userData.isHead = true;
    jawL.userData.isHead = true;
    jawR.userData.isHead = true;

    // 3. CHILDREN: wings
    const leftWingPivot = new THREE.Group();
    leftWingPivot.position.set(-0.7, 0.7, 0);
    thorax.add(leftWingPivot);

    const rightWingPivot = new THREE.Group();
    rightWingPivot.position.set(0.7, 0.7, 0);
    thorax.add(rightWingPivot);

    const wingGeoMain = new THREE.BoxGeometry(3.5, 0.05, 1.0);
    const wingGeoSub = new THREE.BoxGeometry(2.5, 0.05, 0.8);

    const leftWingMain = new THREE.Mesh(wingGeoMain, blockyWingMat);
    leftWingMain.position.set(-1.7, 0, 0);
    const leftWingSub = new THREE.Mesh(wingGeoSub, blockyWingMat);
    leftWingSub.position.set(-1.2, -0.1, 0.8);
    leftWingPivot.add(leftWingMain);
    leftWingPivot.add(leftWingSub);

    const rightWingMain = new THREE.Mesh(wingGeoMain, blockyWingMat);
    rightWingMain.position.set(1.7, 0, 0);
    const rightWingSub = new THREE.Mesh(wingGeoSub, blockyWingMat);
    rightWingSub.position.set(1.2, -0.1, 0.8);
    rightWingPivot.add(rightWingMain);
    rightWingPivot.add(rightWingSub);

    // 4. CHILDREN: arms and blades
    const leftShoulder = new THREE.Group();
    leftShoulder.position.set(-0.9, 0, 0.7);
    thorax.add(leftShoulder);

    const rightShoulder = new THREE.Group();
    rightShoulder.position.set(0.9, 0, 0.7);
    thorax.add(rightShoulder);

    const armGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
    
    const leftArm = new THREE.Mesh(armGeo, blockyArmorMat);
    leftArm.position.set(-0.2, -0.5, 0.4);
    leftArm.rotation.x = -Math.PI / 4;
    leftArm.castShadow = true;
    leftShoulder.add(leftArm);
    
    const leftBladeMain = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 0.5), blockyAccentMat);
    leftBladeMain.position.set(0, -0.8, 0.3);
    leftBladeMain.rotation.x = -Math.PI / 3;
    const leftBladeSub = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.3), blockyAccentMat);
    leftBladeSub.position.set(0, -0.2, 0.4);
    leftBladeMain.add(leftBladeSub);
    leftArm.add(leftBladeMain);

    const rightArm = new THREE.Mesh(armGeo, blockyArmorMat);
    rightArm.position.set(0.2, -0.5, 0.4);
    rightArm.rotation.x = -Math.PI / 4;
    rightArm.castShadow = true;
    rightShoulder.add(rightArm);
    
    const rightBladeMain = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 0.5), blockyAccentMat);
    rightBladeMain.position.set(0, -0.8, 0.3);
    rightBladeMain.rotation.x = -Math.PI / 3;
    const rightBladeSub = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.3), blockyAccentMat);
    rightBladeSub.position.set(0, -0.2, 0.4);
    rightBladeMain.add(rightBladeSub);
    rightArm.add(rightBladeMain);

    // 5. CHILDREN: legs
    const leftLegs = new THREE.Group();
    const rightLegs = new THREE.Group();
    thorax.add(leftLegs);
    thorax.add(rightLegs);

    const thighGeo = new THREE.BoxGeometry(0.8, 0.25, 0.3);
    const calfGeo = new THREE.BoxGeometry(0.25, 1.2, 0.25);

    for(let i = 0; i < 3; i++) {
        const zOffset = 0.5 - i * 0.8; 
        
        const lLegRoot = new THREE.Group();
        lLegRoot.position.set(-0.7, -0.2, zOffset);
        
        const lThigh = new THREE.Mesh(thighGeo, blockyArmorMat);
        lThigh.position.set(-0.3, 0, 0);
        lThigh.rotation.z = Math.PI / 8;
        lThigh.castShadow = true;
        
        const lCalf = new THREE.Mesh(calfGeo, blockyArmorMat);
        lCalf.position.set(-0.6, -0.6, 0);
        lCalf.castShadow = true;
        
        lLegRoot.add(lThigh);
        lLegRoot.add(lCalf);
        leftLegs.add(lLegRoot);

        const rLegRoot = new THREE.Group();
        rLegRoot.position.set(0.7, -0.2, zOffset);
        
        const rThigh = new THREE.Mesh(thighGeo, blockyArmorMat);
        rThigh.position.set(0.3, 0, 0);
        rThigh.rotation.z = -Math.PI / 8;
        rThigh.castShadow = true;
        
        const rCalf = new THREE.Mesh(calfGeo, blockyArmorMat);
        rCalf.position.set(0.6, -0.6, 0);
        rCalf.castShadow = true;
        
        rLegRoot.add(rThigh);
        rLegRoot.add(rCalf);
        rightLegs.add(rLegRoot);
    }

    return {
        mesh: alienRoot, 
        body: thorax,      
        head: headGroup,
        core: core,            
        leftShoulder: leftShoulder, 
        rightShoulder: rightShoulder,
        leftWing: leftWingPivot,
        rightWing: rightWingPivot,
        leftLegs: leftLegs,      
        rightLegs: rightLegs
    };
}

// Triggers the endgame sequence: reveals the extraction pad and spawns the alien swarm.

export function spawnAliens() {
    aliensSpawned = true;
    
    // Setup Extraction Point location
    const extX = 0;
    const extZ = 90;
    const extY = 0; 
    
    extractionPointGroup.position.set(extX, extY, extZ);
    extractionPointGroup.visible = true;

    // Update HUD and Radar to track the extraction pad
    dom.radarLabel.textContent = "EXTRACTION ZONE";
    dom.radarLabel.style.color = "#00ffaa";
    dom.radarArrow.style.color = "#00ffaa";
    dom.radarArrow.style.textShadow = "0 0 10px #00ffaa";
    dom.radarRing.style.borderColor = "rgba(0, 255, 170, 0.3)";
    dom.radarRing.style.background = "radial-gradient(circle, rgba(0, 255, 170, 0.1) 0%, transparent 70%)";

    // Set difficulty scaling for the swarm
    let alienCount = 15;
    let baseSpeed = 0.16;

    if (state.difficulty === 'easy') {
        alienCount = 8;
        baseSpeed = 0.15;
    } else if (state.difficulty === 'hard') {
        alienCount = 20;
        baseSpeed = 0.18;
    }

    // Spawn aliens in a perimeter around the player
    for (let i = 0; i < alienCount; i++) {
            const alienData = createHierarchicalAlien();

            const spawnAngle = Math.random() * Math.PI * 2;
            const spawnDist = 40 + Math.random() * 40;
            const ax = roverGroup.position.x + Math.cos(spawnAngle) * spawnDist;
            const az = roverGroup.position.z + Math.sin(spawnAngle) * spawnDist;
            const aY = getTerrainHeight(ax, az);
            
            alienData.mesh.position.set(ax, aY + 1.0, az);
            scene.add(alienData.mesh);
            
            aliens.push({ 
                mesh: alienData.mesh, 
                body: alienData.body,
                leftShoulder: alienData.leftShoulder,
                rightShoulder: alienData.rightShoulder,
                leftWing: alienData.leftWing,
                rightWing: alienData.rightWing,
                leftLegs: alienData.leftLegs,  
                rightLegs: alienData.rightLegs,
                speed: baseSpeed + (Math.random() * 0.08) 
            });
        }

    // Inform player of the new objective
    dom.missionStatus.textContent = "Sun restored! Avoid aliens and reach the green Extraction Pad!";
    dom.missionStatus.style.color = "#00ffaa";
}

// --- Sandstorm ---

let sandParticles;

export function initSandstorm() {
    const particleCount = 600;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 150;     
        positions[i + 1] = Math.random() * 30;          
        positions[i + 2] = (Math.random() - 0.5) * 150; 
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffbb88,
        size: 0.6,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
    });

    sandParticles = new THREE.Points(geometry, material);
    scene.add(sandParticles);
}

export function updateSandstorm() {
    if (!sandParticles) return;
    const positions = sandParticles.geometry.attributes.position.array;
    
    // wind effect
    for (let i = 0; i < positions.length; i += 3) {
        positions[i] -= 0.8;      // left shift
        positions[i + 1] -= 0.1;  // vertical fall
        if (positions[i] < -75) positions[i] = 75;
        if (positions[i + 1] < 0) positions[i + 1] = 30;
    }
    sandParticles.geometry.attributes.position.needsUpdate = true;
}