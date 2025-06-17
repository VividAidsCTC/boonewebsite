// Global variables for rocks and fish system
let rockInstances = [];
let fishInstances = [];
let allInstancedMeshes = [];

// Performance-optimized configuration
const INSTANCES_PER_ROCK_MODEL = 25; // Reduced from 50
const INSTANCES_PER_FISH_MODEL = 15; // Reduced from 50
const SPAWN_RADIUS = 150; // Reduced from 200
const MAX_RENDER_DISTANCE = 100; // Culling distance
const LOD_DISTANCE_NEAR = 30;
const LOD_DISTANCE_FAR = 60;

// Model configurations
const ASSET_CONFIG = {
    rocks: [
        {
            name: 'rock1',
            url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/rock1.glb',
            scale: { min: 0.8, max: 1.5 }, // Reduced variation
            yOffset: -1,
            priority: 1 // Load order
        },
        {
            name: 'rock2', 
            url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/rock2.glb',
            scale: { min: 1.0, max: 1.8 },
            yOffset: -1,
            priority: 2
        }
        // Removed rock3 for performance - can re-add later if needed
    ],
    fish: [
        {
            name: 'fish1',
            url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/fish1.glb',
            scale: { min: 0.3, max: 0.7 },
            yOffset: 5,
            swimHeight: { min: 3, max: 12 },
            priority: 1
        }
        // Removed fish2 for performance - can re-add later if needed
    ]
};

// Simplified fish shader (reduced complexity)
const fishVertexShader = `
    attribute vec3 instancePosition;
    attribute vec4 instanceRotation;
    attribute vec3 instanceScale;
    attribute vec2 animationData; // swimSpeed, phaseOffset only
    
    uniform float time;
    uniform float globalSwimSpeed;
    
    varying vec3 vNormal;
    
    vec3 applyQuaternion(vec3 v, vec4 q) {
        return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
    }
    
    void main() {
        vec3 pos = position;
        
        float swimSpeed = animationData.x;
        float phaseOffset = animationData.y;
        
        // Simplified swimming motion
        float t = time * globalSwimSpeed * swimSpeed + phaseOffset;
        float swimOffset = sin(t) * 2.0;
        
        pos.x += swimOffset * 0.5;
        pos.y += cos(t * 1.5) * 0.3;
        
        vec3 scaledPos = pos * instanceScale;
        vec3 rotatedPos = applyQuaternion(scaledPos, instanceRotation);
        vec3 worldPos = rotatedPos + instancePosition;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
        vNormal = normalize(normalMatrix * normal);
    }
`;

const fishFragmentShader = `
    uniform vec3 diffuse;
    varying vec3 vNormal;
    
    void main() {
        float dotNL = max(dot(normalize(vNormal), vec3(0.5, 1.0, 0.3)), 0.2);
        gl_FragColor = vec4(diffuse * dotNL, 0.9);
    }
`;

// Performance monitoring
let lastFrameTime = performance.now();
let frameCount = 0;
let avgFPS = 60;

function logAssets(message) {
    console.log('[Assets] ' + message);
}

// Simplified materials
function createRockMaterial() {
    return new THREE.MeshBasicMaterial({
        color: 0x555555,
        fog: false // Disable fog for performance
    });
}

function createFishMaterial(color = 0x4488bb) {
    return new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            globalSwimSpeed: { value: 0.5 }, // Slower default
            diffuse: { value: new THREE.Color(color) }
        },
        vertexShader: fishVertexShader,
        fragmentShader: fishFragmentShader,
        transparent: false, // Disable transparency for performance
        fog: false
    });
}

// Optimized positioning with better distribution
function getRandomPosition(yOffset = 0, heightRange = null) {
    // Use square distribution for better performance
    const x = (Math.random() - 0.5) * SPAWN_RADIUS * 2;
    const z = (Math.random() - 0.5) * SPAWN_RADIUS * 2;
    
    let y = yOffset;
    if (heightRange) {
        y += Math.random() * (heightRange.max - heightRange.min) + heightRange.min;
    }
    
    return { x, y, z };
}

// Simplified rock instance data
function setupRockInstanceData(geometry, count) {
    const instancePositions = new Float32Array(count * 3);
    const instanceRotations = new Float32Array(count * 4);
    const instanceScales = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
        const pos = getRandomPosition(-1);
        instancePositions[i * 3] = pos.x;
        instancePositions[i * 3 + 1] = pos.y;
        instancePositions[i * 3 + 2] = pos.z;
        
        const rotation = Math.random() * Math.PI * 2;
        instanceRotations[i * 4] = 0;
        instanceRotations[i * 4 + 1] = Math.sin(rotation / 2);
        instanceRotations[i * 4 + 2] = 0;
        instanceRotations[i * 4 + 3] = Math.cos(rotation / 2);
        
        const scale = 1.0 + Math.random() * 0.5; // Less variation
        instanceScales[i * 3] = scale;
        instanceScales[i * 3 + 1] = scale;
        instanceScales[i * 3 + 2] = scale;
    }
    
    geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
    geometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(instanceRotations, 4));
    geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScales, 3));
}

// Simplified fish instance data
function setupFishInstanceData(geometry, count, config) {
    const instancePositions = new Float32Array(count * 3);
    const instanceRotations = new Float32Array(count * 4);
    const instanceScales = new Float32Array(count * 3);
    const animationData = new Float32Array(count * 2); // Reduced from 4+2
    
    for (let i = 0; i < count; i++) {
        const pos = getRandomPosition(config.yOffset, config.swimHeight);
        instancePositions[i * 3] = pos.x;
        instancePositions[i * 3 + 1] = pos.y;
        instancePositions[i * 3 + 2] = pos.z;
        
        const rotation = Math.random() * Math.PI * 2;
        instanceRotations[i * 4] = 0;
        instanceRotations[i * 4 + 1] = Math.sin(rotation / 2);
        instanceRotations[i * 4 + 2] = 0;
        instanceRotations[i * 4 + 3] = Math.cos(rotation / 2);
        
        const scale = config.scale.min + Math.random() * (config.scale.max - config.scale.min);
        instanceScales[i * 3] = scale;
        instanceScales[i * 3 + 1] = scale;
        instanceScales[i * 3 + 2] = scale;
        
        // Simplified animation data
        animationData[i * 2] = 0.5 + Math.random() * 0.5; // swimSpeed
        animationData[i * 2 + 1] = Math.random() * Math.PI * 2; // phaseOffset
    }
    
    geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
    geometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(instanceRotations, 4));
    geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScales, 3));
    geometry.setAttribute('animationData', new THREE.InstancedBufferAttribute(animationData, 2));
}

// Optimized geometry processing with UV cleanup
function optimizeGeometry(geometry) {
    // Clean up UV sets that cause warnings
    geometry.deleteAttribute('uv1');  // Remove secondary UV sets
    geometry.deleteAttribute('uv2');
    geometry.deleteAttribute('uv3');
    
    // Remove other unnecessary attributes
    geometry.deleteAttribute('color');
    geometry.deleteAttribute('tangent');
    
    // Keep only essential attributes: position, normal, uv
    const essentialAttributes = ['position', 'normal', 'uv'];
    const attributesToRemove = [];
    
    for (const attributeName in geometry.attributes) {
        if (!essentialAttributes.includes(attributeName)) {
            attributesToRemove.push(attributeName);
        }
    }
    
    attributesToRemove.forEach(attr => {
        geometry.deleteAttribute(attr);
    });
    
    // Reduce geometry complexity for performance
    if (geometry.index) {
        const indexAttribute = geometry.getIndex();
        
        // Simple decimation - keep every other triangle for distant objects
        if (indexAttribute.count > 600) {
            const newIndices = [];
            for (let i = 0; i < indexAttribute.count; i += 6) { // Skip every other triangle
                if (i + 2 < indexAttribute.count) {
                    newIndices.push(indexAttribute.getX(i));
                    newIndices.push(indexAttribute.getX(i + 1));
                    newIndices.push(indexAttribute.getX(i + 2));
                }
            }
            geometry.setIndex(newIndices);
            logAssets(`Decimated geometry: ${indexAttribute.count} → ${newIndices.length} indices`);
        }
    }
    
    // Recompute normals if needed
    if (!geometry.getAttribute('normal')) {
        geometry.computeVertexNormals();
    }
    
    return geometry;
}

async function loadAssetModel(assetConfig, isRock = true) {
    return new Promise((resolve, reject) => {
        if (typeof THREE.GLTFLoader === 'undefined') {
            logAssets(`GLTFLoader not available for ${assetConfig.name}`);
            reject(new Error('GLTFLoader not available'));
            return;
        }
        
        const loader = new THREE.GLTFLoader();
        logAssets(`Loading ${assetConfig.name}...`);
        
        loader.load(
            assetConfig.url,
            function(gltf) {
                let geometry = null;
                let originalMaterial = null;
                
                // Extract geometry and clean up materials
                gltf.scene.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        if (!geometry) {
                            geometry = child.geometry.clone();
                            originalMaterial = child.material;
                        }
                        
                        // Clean up complex materials that cause warnings
                        if (child.material) {
                            // Remove problematic texture references
                            child.material.metalnessMap = null;
                            child.material.roughnessMap = null;
                            child.material.normalMap = null;
                            child.material.aoMap = null;
                            child.material.emissiveMap = null;
                        }
                    }
                });
                
                if (!geometry) {
                    logAssets(`No geometry found in ${assetConfig.name}`);
                    reject(new Error('No geometry found'));
                    return;
                }
                
                // Optimize geometry and clean up UV issues
                geometry = optimizeGeometry(geometry);
                
                // Create simple, performance-optimized materials
                let material;
                if (isRock) {
                    material = createRockMaterial();
                } else {
                    // Use original material color if available
                    let color = 0x4488bb;
                    if (originalMaterial && originalMaterial.color) {
                        color = originalMaterial.color.getHex();
                    }
                    material = createFishMaterial(color);
                }
                
                const instanceCount = isRock ? INSTANCES_PER_ROCK_MODEL : INSTANCES_PER_FISH_MODEL;
                const instancedMesh = new THREE.InstancedMesh(geometry, material, instanceCount);
                
                // Disable shadows for performance
                instancedMesh.castShadow = false;
                instancedMesh.receiveShadow = false;
                
                // Setup frustum culling
                instancedMesh.frustumCulled = true;
                
                if (isRock) {
                    setupRockInstanceData(geometry, instanceCount);
                } else {
                    setupFishInstanceData(geometry, instanceCount, assetConfig);
                }
                
                if (typeof scene !== 'undefined') {
                    scene.add(instancedMesh);
                    allInstancedMeshes.push(instancedMesh);
                    
                    if (isRock) {
                        rockInstances.push({
                            name: assetConfig.name,
                            mesh: instancedMesh,
                            config: assetConfig
                        });
                    } else {
                        fishInstances.push({
                            name: assetConfig.name,
                            mesh: instancedMesh,
                            config: assetConfig
                        });
                    }
                }
                
                logAssets(`Created ${instanceCount} instances of ${assetConfig.name}`);
                resolve(instancedMesh);
            },
            function(progress) {
                // Suppress progress logging to reduce console spam
            },
            function(error) {
                logAssets(`Error loading ${assetConfig.name}: ${error.message}`);
                reject(error);
            }
        );
    });
}

// Load assets sequentially to avoid overwhelming the system
async function loadAllAssets() {
    logAssets('Loading assets sequentially for better performance...');
    
    try {
        // Load rocks first (higher priority, less complex)
        for (const rockConfig of ASSET_CONFIG.rocks) {
            await loadAssetModel(rockConfig, true);
            // Small delay to prevent blocking
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Then load fish
        for (const fishConfig of ASSET_CONFIG.fish) {
            await loadAssetModel(fishConfig, false);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const totalInstances = 
            (rockInstances.length * INSTANCES_PER_ROCK_MODEL) + 
            (fishInstances.length * INSTANCES_PER_FISH_MODEL);
            
        logAssets(`All assets loaded! Total instances: ${totalInstances}`);
        startAssetAnimation();
        
    } catch (error) {
        logAssets(`Error loading assets: ${error.message}`);
    }
}

// Performance-conscious update function
let updateCounter = 0;
function updateAssets(deltaTime) {
    updateCounter++;
    
    // Update fish animations less frequently
    if (updateCounter % 2 === 0) { // Every other frame
        fishInstances.forEach(fishInstance => {
            if (fishInstance.mesh.material.uniforms) {
                fishInstance.mesh.material.uniforms.time.value += deltaTime;
            }
        });
    }
    
    // Performance monitoring
    if (updateCounter % 60 === 0) { // Every 60 frames
        const currentTime = performance.now();
        const deltaFrameTime = currentTime - lastFrameTime;
        avgFPS = 1000 / (deltaFrameTime / 60);
        lastFrameTime = currentTime;
        
        // Adaptive performance scaling
        if (avgFPS < 30) {
            // Reduce fish animation speed if performance is poor
            fishInstances.forEach(fish => {
                if (fish.mesh.material.uniforms) {
                    fish.mesh.material.uniforms.globalSwimSpeed.value = 0.3;
                }
            });
        }
    }
}

function startAssetAnimation() {
    logAssets('Asset animation system started with performance optimizations');
}

function initializeRocksAndFish() {
    logAssets('Initializing optimized Rocks and Fish system...');
    
    if (typeof scene === 'undefined') {
        setTimeout(initializeRocksAndFish, 1000);
        return;
    }
    
    loadAllAssets();
}

// Delayed initialization to ensure main scene is ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initializeRocksAndFish, 3000); // Increased delay
});

function updateRocksAndFish(deltaTime = 0.016) { // 60fps target
    updateAssets(deltaTime);
}

// Simplified export
window.RocksAndFishSystem = {
    getRockInstances: () => rockInstances,
    getFishInstances: () => fishInstances,
    getTotalInstances: () => 
        (rockInstances.length * INSTANCES_PER_ROCK_MODEL) + 
        (fishInstances.length * INSTANCES_PER_FISH_MODEL),
    update: updateRocksAndFish,
    getPerformanceInfo: () => ({ avgFPS, totalMeshes: allInstancedMeshes.length })
};

// Performance-conscious callback registration
if (typeof window.AssetUpdateCallbacks === 'undefined') {
    window.AssetUpdateCallbacks = [];
}
window.AssetUpdateCallbacks.push(updateRocksAndFish);
