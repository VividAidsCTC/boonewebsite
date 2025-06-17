// Global variables for rocks and fish system
let rockInstances = [];
let fishInstances = [];
let allInstancedMeshes = [];

// Configuration
const INSTANCES_PER_MODEL = 50;
const SPAWN_RADIUS = 200;

// Model configurations - update these URLs to your GitHub paths
const ASSET_CONFIG = {
    rocks: [
        {
            name: 'rock1',
            url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/rock1.glb',
            scale: { min: 0.5, max: 2.0 },
            yOffset: -1
        },
        {
            name: 'rock2', 
            url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/rock2.glb',
            scale: { min: 0.8, max: 1.5 },
            yOffset: -1
        },
        {
            name: 'rock3',
            url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/rock3.glb',
            scale: { min: 0.3, max: 1.8 },
            yOffset: -1
        }
    ],
    fish: [
        {
            name: 'fish1',
            url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/fish1.glb',
            scale: { min: 0.2, max: 0.6 },
            yOffset: 5,
            swimHeight: { min: 2, max: 15 }
        },
        {
            name: 'fish2',
            url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/fish2.glb',
            scale: { min: 0.3, max: 0.8 },
            yOffset: 8,
            swimHeight: { min: 3, max: 20 }
        }
    ]
};

// Fish animation shader for swimming behavior
const fishVertexShader = `
    #include <common>
    #include <fog_pars_vertex>
    
    attribute vec3 instancePosition;
    attribute vec4 instanceRotation;
    attribute vec3 instanceScale;
    attribute vec4 animationData; // swimSpeed, swimRadius, phaseOffset, heightVariation
    attribute vec2 animationData2; // baseHeight, swimDirection
    
    uniform float time;
    uniform float globalSwimSpeed;
    
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    
    vec3 applyQuaternion(vec3 v, vec4 q) {
        return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
    }
    
    void main() {
        vec3 pos = position;
        
        // Get animation parameters
        float swimSpeed = animationData.x;
        float swimRadius = animationData.y;
        float phaseOffset = animationData.z;
        float heightVariation = animationData.w;
        float baseHeight = animationData2.x;
        float swimDirection = animationData2.y;
        
        // Swimming motion
        float t = time * globalSwimSpeed * swimSpeed + phaseOffset;
        
        // Circular swimming pattern
        float swimX = cos(t + swimDirection) * swimRadius;
        float swimZ = sin(t + swimDirection) * swimRadius;
        
        // Vertical bobbing
        float swimY = sin(t * 2.0) * heightVariation;
        
        // Apply scale, rotation, and position
        vec3 scaledPos = pos * instanceScale;
        vec3 rotatedPos = applyQuaternion(scaledPos, instanceRotation);
        
        // Add swimming animation to instance position
        vec3 animatedInstancePos = instancePosition + vec3(swimX, swimY, swimZ);
        vec3 worldPos = rotatedPos + animatedInstancePos;
        
        vWorldPosition = worldPos;
        
        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        vNormal = normalize(normalMatrix * normal);
        
        #include <fog_vertex>
    }
`;

const fishFragmentShader = `
    #include <common>
    #include <fog_pars_fragment>
    
    uniform vec3 diffuse;
    uniform float opacity;
    
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    
    void main() {
        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
        float dotNL = max(dot(normalize(vNormal), lightDir), 0.0);
        
        // Simple underwater lighting
        vec3 color = diffuse * (0.3 + 0.7 * dotNL);
        
        gl_FragColor = vec4(color, opacity);
        #include <fog_fragment>
    }
`;

// Debug logging function
function logAssets(message) {
    console.log('[Rocks & Fish] ' + message);
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        debugDiv.innerHTML += '[Assets] ' + message + '<br>';
    }
}

// Create materials for different asset types
function createRockMaterial() {
    return new THREE.MeshLambertMaterial({
        color: 0x4a4a4a,
        fog: true
    });
}

function createFishMaterial(color = 0x3366cc) {
    return new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.fog,
            {
                time: { value: 0 },
                globalSwimSpeed: { value: 1.0 },
                diffuse: { value: new THREE.Color(color) },
                opacity: { value: 0.9 }
            }
        ]),
        vertexShader: fishVertexShader,
        fragmentShader: fishFragmentShader,
        transparent: true,
        fog: true
    });
}

// Generate random position within spawn radius
function getRandomPosition(yOffset = 0, heightRange = null) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * SPAWN_RADIUS;
    
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    let y = yOffset;
    if (heightRange) {
        y += Math.random() * (heightRange.max - heightRange.min) + heightRange.min;
    }
    
    return { x, y, z };
}

// Setup instance data for rocks (static)
function setupRockInstanceData(geometry, count) {
    const instancePositions = new Float32Array(count * 3);
    const instanceRotations = new Float32Array(count * 4);
    const instanceScales = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
        // Position
        const pos = getRandomPosition(-1);
        instancePositions[i * 3] = pos.x;
        instancePositions[i * 3 + 1] = pos.y;
        instancePositions[i * 3 + 2] = pos.z;
        
        // Random rotation
        const rotation = Math.random() * Math.PI * 2;
        instanceRotations[i * 4] = 0;
        instanceRotations[i * 4 + 1] = Math.sin(rotation / 2);
        instanceRotations[i * 4 + 2] = 0;
        instanceRotations[i * 4 + 3] = Math.cos(rotation / 2);
        
        // Random scale
        const scale = 0.5 + Math.random() * 1.5;
        instanceScales[i * 3] = scale;
        instanceScales[i * 3 + 1] = scale;
        instanceScales[i * 3 + 2] = scale;
    }
    
    geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
    geometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(instanceRotations, 4));
    geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScales, 3));
}

// Setup instance data for fish (animated)
function setupFishInstanceData(geometry, count, config) {
    const instancePositions = new Float32Array(count * 3);
    const instanceRotations = new Float32Array(count * 4);
    const instanceScales = new Float32Array(count * 3);
    const animationData = new Float32Array(count * 4);
    const animationData2 = new Float32Array(count * 2);
    
    for (let i = 0; i < count; i++) {
        // Position
        const pos = getRandomPosition(config.yOffset, config.swimHeight);
        instancePositions[i * 3] = pos.x;
        instancePositions[i * 3 + 1] = pos.y;
        instancePositions[i * 3 + 2] = pos.z;
        
        // Random rotation
        const rotation = Math.random() * Math.PI * 2;
        instanceRotations[i * 4] = 0;
        instanceRotations[i * 4 + 1] = Math.sin(rotation / 2);
        instanceRotations[i * 4 + 2] = 0;
        instanceRotations[i * 4 + 3] = Math.cos(rotation / 2);
        
        // Random scale
        const scale = config.scale.min + Math.random() * (config.scale.max - config.scale.min);
        instanceScales[i * 3] = scale;
        instanceScales[i * 3 + 1] = scale;
        instanceScales[i * 3 + 2] = scale;
        
        // Animation data
        animationData[i * 4] = 0.5 + Math.random() * 1.0; // swimSpeed
        animationData[i * 4 + 1] = 2 + Math.random() * 8; // swimRadius
        animationData[i * 4 + 2] = Math.random() * Math.PI * 2; // phaseOffset
        animationData[i * 4 + 3] = 0.5 + Math.random() * 1.5; // heightVariation
        
        animationData2[i * 2] = pos.y; // baseHeight
        animationData2[i * 2 + 1] = Math.random() * Math.PI * 2; // swimDirection
    }
    
    geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
    geometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(instanceRotations, 4));
    geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScales, 3));
    geometry.setAttribute('animationData', new THREE.InstancedBufferAttribute(animationData, 4));
    geometry.setAttribute('animationData2', new THREE.InstancedBufferAttribute(animationData2, 2));
}

// Load and create instanced mesh for a single model
function loadAssetModel(assetConfig, isRock = true) {
    return new Promise((resolve, reject) => {
        if (typeof THREE.GLTFLoader === 'undefined') {
            logAssets(`ERROR: GLTFLoader not available for ${assetConfig.name}`);
            reject(new Error('GLTFLoader not available'));
            return;
        }
        
        const loader = new THREE.GLTFLoader();
        
        logAssets(`Loading ${assetConfig.name} from ${assetConfig.url}...`);
        
        loader.load(
            assetConfig.url,
            function(gltf) {
                logAssets(`${assetConfig.name} loaded successfully`);
                
                // Extract geometry from GLTF
                let geometry = null;
                gltf.scene.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        if (!geometry) {
                            geometry = child.geometry.clone();
                        }
                    }
                });
                
                if (!geometry) {
                    logAssets(`No geometry found in ${assetConfig.name}`);
                    reject(new Error('No geometry found'));
                    return;
                }
                
                // Create appropriate material
                const material = isRock ? 
                    createRockMaterial() : 
                    createFishMaterial(0x3366cc + Math.random() * 0x333333);
                
                // Create instanced mesh
                const instancedMesh = new THREE.InstancedMesh(geometry, material, INSTANCES_PER_MODEL);
                
                // Enable shadows
                instancedMesh.castShadow = true;
                instancedMesh.receiveShadow = !isRock; // Fish receive shadows, rocks don't need to
                
                // Setup instance data
                if (isRock) {
                    setupRockInstanceData(geometry, INSTANCES_PER_MODEL);
                } else {
                    setupFishInstanceData(geometry, INSTANCES_PER_MODEL, assetConfig);
                }
                
                // Add to scene
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
                
                logAssets(`Created ${INSTANCES_PER_MODEL} instances of ${assetConfig.name}`);
                resolve(instancedMesh);
            },
            function(progress) {
                if (progress.total > 0) {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    logAssets(`${assetConfig.name} loading: ${percent}%`);
                }
            },
            function(error) {
                logAssets(`ERROR loading ${assetConfig.name}: ${error.message}`);
                reject(error);
            }
        );
    });
}

// Load all rock and fish assets
async function loadAllAssets() {
    logAssets('Starting to load all rock and fish assets...');
    
    const loadPromises = [];
    
    // Load rocks
    for (const rockConfig of ASSET_CONFIG.rocks) {
        loadPromises.push(loadAssetModel(rockConfig, true));
    }
    
    // Load fish
    for (const fishConfig of ASSET_CONFIG.fish) {
        loadPromises.push(loadAssetModel(fishConfig, false));
    }
    
    try {
        await Promise.all(loadPromises);
        logAssets(`Successfully loaded all assets! Total instances: ${allInstancedMeshes.length * INSTANCES_PER_MODEL}`);
        logAssets(`Rocks: ${rockInstances.length} models, Fish: ${fishInstances.length} models`);
        
        // Start animation updates
        startAssetAnimation();
        
    } catch (error) {
        logAssets(`Error loading some assets: ${error.message}`);
    }
}

// Animation update function
function updateAssets(deltaTime) {
    // Update fish animations
    fishInstances.forEach(fishInstance => {
        if (fishInstance.mesh.material.uniforms) {
            fishInstance.mesh.material.uniforms.time.value += deltaTime;
        }
    });
}

// Start the asset animation system
function startAssetAnimation() {
    logAssets('Asset animation system started');
    
    // Hook into existing animation loop if available
    if (typeof window.AssetUpdateCallbacks === 'undefined') {
        window.AssetUpdateCallbacks = [];
    }
    window.AssetUpdateCallbacks.push(updateAssets);
}

// Initialize the rocks and fish system
function initializeRocksAndFish() {
    logAssets('Initializing Rocks and Fish system...');
    
    // Wait for scene to be available
    if (typeof scene === 'undefined') {
        logAssets('Scene not ready, retrying in 1 second...');
        setTimeout(initializeRocksAndFish, 1000);
        return;
    }
    
    // Load all assets
    loadAllAssets();
}

// DOM ready handler
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the main scene to be set up
    setTimeout(initializeRocksAndFish, 2000);
});

// Update function to be called from main animation loop
function updateRocksAndFish(deltaTime = 0.01) {
    updateAssets(deltaTime);
}

// Export system for external access
window.RocksAndFishSystem = {
    getRockInstances: () => rockInstances,
    getFishInstances: () => fishInstances,
    getAllMeshes: () => allInstancedMeshes,
    getTotalInstances: () => allInstancedMeshes.length * INSTANCES_PER_MODEL,
    update: updateRocksAndFish,
    
    // Configuration access
    getConfig: () => ASSET_CONFIG,
    setSwimSpeed: (speed) => {
        fishInstances.forEach(fish => {
            if (fish.mesh.material.uniforms) {
                fish.mesh.material.uniforms.globalSwimSpeed.value = speed;
            }
        });
    }
};

// Hook into main animation if available
if (typeof window.AssetUpdateCallbacks === 'undefined') {
    window.AssetUpdateCallbacks = [];
}
window.AssetUpdateCallbacks.push(updateRocksAndFish);
