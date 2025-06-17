import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- Module-level state variables ---
let rockInstances = [];
let fishInstances = [];

// --- Performance-optimized configuration ---
const INSTANCES_PER_ROCK_MODEL = 25;
const INSTANCES_PER_FISH_MODEL = 15;
const SPAWN_RADIUS = 150;

// --- Model configurations ---
const ASSET_CONFIG = {
    rocks: [{
        name: 'rock1',
        url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/rock1.glb',
        scale: { min: 0.8, max: 1.5 },
        yOffset: -1,
    }, {
        name: 'rock2',
        url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/rock2.glb',
        scale: { min: 1.0, max: 1.8 },
        yOffset: -1,
    }],
    fish: [{
        name: 'fish1',
        url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/fish1.glb',
        scale: { min: 0.3, max: 0.7 },
        yOffset: 5,
        swimHeight: { min: 3, max: 12 },
    }]
};

// --- Simplified Fish Shaders (using instanceMatrix) ---
const fishVertexShader = `
    // instanceMatrix is provided automatically by InstancedMesh
    attribute vec2 animationData; // swimSpeed, phaseOffset
    
    uniform float time;
    uniform float globalSwimSpeed;
    
    varying vec3 vNormal;
    
    void main() {
        vec3 pos = position;
        
        float swimSpeed = animationData.x;
        float phaseOffset = animationData.y;
        
        // Simplified swimming motion
        float t = time * globalSwimSpeed * swimSpeed + phaseOffset;
        pos.x += sin(t) * 0.5; // Bend the body
        pos.y += cos(t * 1.5) * 0.2; // Gentle up/down bob
        
        // The instanceMatrix already contains position, rotation, and scale
        vec4 modelViewPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * modelViewPosition;
        
        // Correctly transform the normal for lighting
        vNormal = normalize( normalMatrix * mat3(instanceMatrix) * normal );
    }
`;

const fishFragmentShader = `
    uniform vec3 diffuse;
    varying vec3 vNormal;
    
    void main() {
        // Simplified lighting
        float dotNL = max(dot(normalize(vNormal), normalize(vec3(0.5, 1.0, 0.3))), 0.2);
        gl_FragColor = vec4(diffuse * dotNL, 1.0);
    }
`;


/**
 * Loads all configured assets and adds them to the provided scene.
 * @param {THREE.Scene} scene The scene to add the assets to.
 */
async function loadAllAssets(scene) {
    console.log('[Assets] Loading assets sequentially...');
    try {
        for (const rockConfig of ASSET_CONFIG.rocks) {
            await loadAssetModel(scene, rockConfig, true);
        }
        for (const fishConfig of ASSET_CONFIG.fish) {
            await loadAssetModel(scene, fishConfig, false);
        }
        const totalInstances = (rockInstances.length * INSTANCES_PER_ROCK_MODEL) + (fishInstances.length * INSTANCES_PER_FISH_MODEL);
        console.log(`[Assets] All assets loaded! Total instances: ${totalInstances}`);
    } catch (error) {
        console.error(`[Assets] Error loading assets: ${error.message}`);
    }
}

/**
 * Loads a single GLTF model and creates an InstancedMesh from it.
 * @param {THREE.Scene} scene The scene to add the mesh to.
 * @param {object} assetConfig The configuration for the asset.
 * @param {boolean} isRock True if the asset is a rock, false if it's a fish.
 */
async function loadAssetModel(scene, assetConfig, isRock) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(assetConfig.url);
    
    let geometry = null;
    gltf.scene.traverse((child) => {
        if (child.isMesh && !geometry) {
            geometry = child.geometry;
        }
    });

    if (!geometry) {
        console.error(`No geometry found in ${assetConfig.name}, using fallback.`);
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }
    
    let material;
    const instanceCount = isRock ? INSTANCES_PER_ROCK_MODEL : INSTANCES_PER_FISH_MODEL;
    
    if (isRock) {
        // Note: MeshLambertMaterial requires lights in your main scene.
        material = new THREE.MeshLambertMaterial({ color: 0x605550 });
    } else {
        // For fish, we add custom animation attributes to the geometry
        setupFishAnimationData(geometry, instanceCount);
        material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                globalSwimSpeed: { value: 0.5 },
                diffuse: { value: new THREE.Color(0x4488bb) }
            },
            vertexShader: fishVertexShader,
            fragmentShader: fishFragmentShader,
            fog: true // Allow fog to affect fish
        });
    }

    const instancedMesh = new THREE.InstancedMesh(geometry, material, instanceCount);
    
    // Create and apply a transformation matrix for each instance
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < instanceCount; i++) {
        const position = new THREE.Vector3();
        const rotation = new THREE.Quaternion();
        const scale = new THREE.Vector3();

        const x = (Math.random() - 0.5) * SPAWN_RADIUS * 2;
        const z = (Math.random() - 0.5) * SPAWN_RADIUS * 2;
        let y = assetConfig.yOffset;
        if (assetConfig.swimHeight) {
            y += assetConfig.swimHeight.min + Math.random() * (assetConfig.swimHeight.max - assetConfig.swimHeight.min);
        }
        position.set(x, y, z);
        rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
        const scaleVal = assetConfig.scale.min + Math.random() * (assetConfig.scale.max - assetConfig.scale.min);
        scale.set(scaleVal, scaleVal, scaleVal);

        matrix.compose(position, rotation, scale);
        instancedMesh.setMatrixAt(i, matrix);
    }
    // IMPORTANT: Tell Three.js to update the instance matrix buffer
    instancedMesh.instanceMatrix.needsUpdate = true;
    
    scene.add(instancedMesh);

    if (isRock) {
        rockInstances.push({ mesh: instancedMesh });
    } else {
        fishInstances.push({ mesh: instancedMesh });
    }
    console.log(`[Assets] Created ${instanceCount} instances of ${assetConfig.name}`);
}

/**
 * Attaches custom animation data to fish geometry for the shader.
 * @param {THREE.BufferGeometry} geometry The geometry to add attributes to.
 * @param {number} count The number of instances.
 */
function setupFishAnimationData(geometry, count) {
    const animationData = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
        animationData[i * 2 + 0] = 0.5 + Math.random() * 0.5; // swimSpeed
        animationData[i * 2 + 1] = Math.random() * Math.PI * 2; // phaseOffset
    }
    geometry.setAttribute('animationData', new THREE.InstancedBufferAttribute(animationData, 2));
}

// --- PUBLIC API ---

/**
 * Initializes the rock and fish system.
 * @param {THREE.Scene} scene The main Three.js scene object.
 */
export function initializeRocksAndFish(scene) {
    if (!scene) {
        console.error("A THREE.Scene object must be provided to initialize the system.");
        return;
    }
    loadAllAssets(scene);
}

/**
 * Updates the assets. This should be called in your main animation loop.
 * @param {number} deltaTime The time elapsed since the last frame.
 */
export function updateRocksAndFish(deltaTime) {
    // Update fish shader time uniform for swimming animation
    for (const fishInstance of fishInstances) {
        if (fishInstance.mesh.material.uniforms) {
            fishInstance.mesh.material.uniforms.time.value += deltaTime;
        }
    }
}
