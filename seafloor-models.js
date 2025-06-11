/**
 * SEAFLOOR MODELS SYSTEM
 * 
 * This file handles loading and distributing 3D models across the seafloor.
 * It works alongside kelptest.js and communicates through global variables.
 * 
 * REQUIREMENTS:
 * - kelptest.js must be loaded first (creates the 'scene' global variable)
 * - Three.js and GLTFLoader must be loaded
 * - This file should be loaded after kelptest.js
 */

console.log('🗿 Seafloor Models System Loading...');

// Global arrays to store loaded models
let loadedRockModels = [];
let loadedCoralModels = [];
let loadedPlantModels = [];
let distributedModels = []; // Track all models we've added to scene
let modelLoader;

// Initialize GLTF loader when available
function initializeModelLoader() {
    if (typeof THREE !== 'undefined' && THREE.GLTFLoader) {
        modelLoader = new THREE.GLTFLoader();
        console.log('✅ GLTF Loader initialized');
        return true;
    } else {
        console.warn('⚠️ Three.js or GLTFLoader not available yet');
        return false;
    }
}

// Model URLs - UPDATE THESE WITH YOUR ACTUAL MODEL FILES
const MODEL_URLS = {
    rocks: [
        // Example rock model URLs - replace with your actual files
        'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/models/rock1.glb',
        'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/models/rock2.glb',

        
        // For testing, you can use free models from:
        // - Sketchfab (with CC license)
        // - Poly Haven (polyhaven.com)
        // - Your own hosted files
    ],
    coral: [
        'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/models/coral1.glb',
        'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/models/coral2.glb',
        'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/models/coral3.glb',
        'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/models/coral4.glb',
    ],
    plants: [
        'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/models/lobster.glb',
    ]
};

// Configuration for how models are distributed
const DISTRIBUTION_CONFIG = {
    rocks: {
        count: 50,
        minScale: 5.0,
        maxScale: 20.0,
        minDistance: 1, // Distance from kelp center (0,0)
        maxDistance: 40,
        clusterSize: 5, // Number of rocks per cluster
        clusterRadius: 8, // Radius of each cluster
        yPosition: -1.2, // How deep to bury (negative = lower)
        allowTilt: true // Can rocks be tilted?
    },
    coral: {
        count: 25,
        minScale: 10,
        maxScale: 20,
        minDistance: 1,
        maxDistance: 35,
        clusterSize: 3, // Coral usually stands alone
        clusterRadius: 0,
        yPosition: -1,
        allowTilt: false // Coral grows upright
    },
    plants: {
        count: 50,
        minScale: 4,
        maxScale: 8,
        minDistance: 1,
        maxDistance: 30,
        clusterSize: 2, // Small groups
        clusterRadius: 5,
        yPosition: -1,
        allowTilt: true // Plants can lean slightly
    }
};

/**
 * MAIN INITIALIZATION FUNCTION
 * Call this to start loading and distributing models
 */
async function initializeSeafloorModels() {
    console.log('🚀 Starting 3D model loading and distribution...');
    
    // Check if scene exists (created by kelptest.js)
    if (typeof scene === 'undefined') {
        console.error('❌ Scene not found! Make sure kelptest.js loaded first.');
        return false;
    }
    
    // Initialize loader
    if (!initializeModelLoader()) {
        console.error('❌ Could not initialize model loader');
        return false;
    }
    
    // Update debug display
    updateDebugDisplay('Loading 3D models...');
    
    try {
        // Load all model types
        await loadAllModels();
        
        console.log('✅ All models loaded, starting distribution...');
        updateDebugDisplay('Distributing models across seafloor...');
        
        // Distribute models across the seafloor
        distributeAllModels();
        
        console.log('🎉 Model distribution complete!');
        updateDebugDisplay(`Models loaded: ${distributedModels.length} total objects`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error in model system:', error);
        updateDebugDisplay('Error loading models - continuing without them');
        return false;
    }
}

/**
 * LOAD ALL MODEL TYPES
 */
async function loadAllModels() {
    const loadPromises = [];
    
    // Load rocks
    if (MODEL_URLS.rocks.length > 0) {
        loadPromises.push(loadModelType(MODEL_URLS.rocks, 'rocks'));
    }
    
    // Load coral
    if (MODEL_URLS.coral.length > 0) {
        loadPromises.push(loadModelType(MODEL_URLS.coral, 'coral'));
    }
    
    // Load plants
    if (MODEL_URLS.plants.length > 0) {
        loadPromises.push(loadModelType(MODEL_URLS.plants, 'plants'));
    }
    
    // Wait for all to complete
    const results = await Promise.allSettled(loadPromises);
    
    console.log('📊 Loading results:', {
        rocks: loadedRockModels.length,
        coral: loadedCoralModels.length,
        plants: loadedPlantModels.length
    });
}

/**
 * LOAD A SPECIFIC TYPE OF MODEL
 */
async function loadModelType(urls, typeName) {
    console.log(`📥 Loading ${typeName} models...`);
    
    const targetArray = typeName === 'rocks' ? loadedRockModels :
                       typeName === 'coral' ? loadedCoralModels :
                       loadedPlantModels;
    
    for (const url of urls) {
        try {
            const model = await loadSingleModel(url);
            if (model) {
                targetArray.push(model);
                console.log(`✅ Loaded ${typeName}: ${url}`);
            }
        } catch (error) {
            console.warn(`⚠️ Failed to load ${typeName} from ${url}:`, error);
            // Continue with other models
        }
    }
    
    console.log(`📦 ${typeName} loading complete: ${targetArray.length} models`);
}

/**
 * LOAD A SINGLE GLTF MODEL
 */
function loadSingleModel(url) {
    return new Promise((resolve, reject) => {
        modelLoader.load(
            url,
            (gltf) => {
                // Model loaded successfully
                const model = gltf.scene;
                
                // Prepare the model for the ocean environment
                prepareModel(model);
                
                resolve(model);
            },
            (progress) => {
                // Loading progress (optional)
                if (progress.total > 0) {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    console.log(`📊 Loading ${url}: ${percent}%`);
                }
            },
            (error) => {
                console.warn(`❌ Failed to load: ${url}`, error);
                resolve(null); // Don't reject, just return null
            }
        );
    });
}

/**
 * PREPARE A MODEL FOR THE OCEAN ENVIRONMENT
 */
function prepareModel(model) {
    model.traverse((child) => {
        if (child.isMesh) {
            // Enable shadows
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Ensure materials work with ocean lighting
            if (child.material) {
                child.material.transparent = false;
                child.material.opacity = 1.0;
                
                // Make sure materials respond to lights
                if (child.material.type === 'MeshBasicMaterial') {
                    // Convert basic materials to phong for better lighting
                    const oldMaterial = child.material;
                    child.material = new THREE.MeshPhongMaterial({
                        color: oldMaterial.color,
                        map: oldMaterial.map
                    });
                }
            }
        }
    });
}

/**
 * DISTRIBUTE ALL LOADED MODELS
 */
function distributeAllModels() {
    if (loadedRockModels.length > 0) {
        distributeModelType(loadedRockModels, DISTRIBUTION_CONFIG.rocks, 'rocks');
    }
    
    if (loadedCoralModels.length > 0) {
        distributeModelType(loadedCoralModels, DISTRIBUTION_CONFIG.coral, 'coral');
    }
    
    if (loadedPlantModels.length > 0) {
        distributeModelType(loadedPlantModels, DISTRIBUTION_CONFIG.plants, 'plants');
    }
    
    console.log(`🌊 Distribution complete! Added ${distributedModels.length} objects to seafloor`);
}

/**
 * DISTRIBUTE A SPECIFIC TYPE OF MODEL
 */
function distributeModelType(modelArray, config, typeName) {
    console.log(`🎯 Distributing ${config.count} ${typeName}...`);
    
    const clustersToCreate = Math.ceil(config.count / config.clusterSize);
    
    for (let cluster = 0; cluster < clustersToCreate; cluster++) {
        // Find a good position for this cluster
        const clusterPos = generateValidPosition(config.minDistance, config.maxDistance);
        
        // Calculate how many models in this cluster
        const modelsInThisCluster = Math.min(
            config.clusterSize, 
            config.count - (cluster * config.clusterSize)
        );
        
        // Create models in this cluster
        for (let i = 0; i < modelsInThisCluster; i++) {
            // Pick random model from array
            const randomModel = modelArray[Math.floor(Math.random() * modelArray.length)];
            
            // Clone the model
            const modelInstance = randomModel.clone();
            
            // Position within cluster
            let finalPosition;
            if (config.clusterRadius > 0) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * config.clusterRadius;
                finalPosition = {
                    x: clusterPos.x + Math.cos(angle) * distance,
                    z: clusterPos.z + Math.sin(angle) * distance
                };
            } else {
                finalPosition = clusterPos;
            }
            
            // Apply transformations
            setupModelInstance(modelInstance, finalPosition, config, typeName);
            
            // Add to scene and track it
            scene.add(modelInstance);
            distributedModels.push({
                mesh: modelInstance,
                type: typeName
            });
        }
    }
    
    console.log(`✅ ${typeName} distribution complete`);
}

/**
 * GENERATE A VALID POSITION (avoiding kelp forest center)
 */
function generateValidPosition(minDistance, maxDistance) {
    let x, z, distance;
    let attempts = 0;
    
    do {
        // Generate random position
        x = (Math.random() - 0.5) * maxDistance * 2;
        z = (Math.random() - 0.5) * maxDistance * 2;
        distance = Math.sqrt(x * x + z * z);
        
        attempts++;
        
        // Prevent infinite loops
        if (attempts > 100) {
            console.warn('⚠️ Could not find valid position, using fallback');
            x = (Math.random() - 0.5) * maxDistance * 1.5;
            z = (Math.random() - 0.5) * maxDistance * 1.5;
            break;
        }
    } while (distance < minDistance || distance > maxDistance);
    
    return { x, z };
}

/**
 * SETUP INDIVIDUAL MODEL INSTANCE
 */
function setupModelInstance(modelInstance, position, config, typeName) {
    // Position
    modelInstance.position.x = position.x;
    modelInstance.position.z = position.z;
    modelInstance.position.y = config.yPosition;
    
    // Scale
    const scale = config.minScale + Math.random() * (config.maxScale - config.minScale);
    modelInstance.scale.setScalar(scale);
    
    // Rotation
    modelInstance.rotation.y = Math.random() * Math.PI * 2; // Random Y rotation
    
    // Type-specific adjustments
    if (config.allowTilt) {
        modelInstance.rotation.x = (Math.random() - 0.5) * 0.3;
        modelInstance.rotation.z = (Math.random() - 0.5) * 0.3;
    }
    
    // Additional burial for rocks
    if (typeName === 'rocks') {
        modelInstance.position.y += (Math.random() - 0.5) * 0.4;
    }
    
    // Add material variation
    addMaterialVariation(modelInstance);
}

/**
 * ADD SLIGHT MATERIAL VARIATIONS
 */
function addMaterialVariation(modelInstance) {
    modelInstance.traverse((child) => {
        if (child.isMesh && child.material && child.material.color) {
            // Slightly vary the color for natural look
            const variation = 0.4 + Math.random() * 1.5; // 85% to 115% of original
            child.material.color.multiplyScalar(variation);
        }
    });
}

/**
 * CLEAR ALL DISTRIBUTED MODELS
 */
function clearAllDistributedModels() {
    console.log(`🗑️ Clearing ${distributedModels.length} distributed models...`);
    
    distributedModels.forEach(item => {
        scene.remove(item.mesh);
        
        // Clean up geometry and materials
        if (item.mesh.geometry) {
            item.mesh.geometry.dispose();
        }
        if (item.mesh.material) {
            if (Array.isArray(item.mesh.material)) {
                item.mesh.material.forEach(mat => mat.dispose());
            } else {
                item.mesh.material.dispose();
            }
        }
    });
    
    distributedModels = [];
    console.log('✅ All models cleared');
}

/**
 * UPDATE MODEL URLS (for runtime changes)
 */
function updateModelUrls(newUrls) {
    Object.assign(MODEL_URLS, newUrls);
    console.log('🔄 Model URLs updated:', MODEL_URLS);
}

/**
 * UPDATE DISTRIBUTION SETTINGS
 */
function updateDistributionConfig(newConfig) {
    // Merge new config with existing
    Object.keys(newConfig).forEach(key => {
        if (DISTRIBUTION_CONFIG[key]) {
            Object.assign(DISTRIBUTION_CONFIG[key], newConfig[key]);
        }
    });
    console.log('⚙️ Distribution config updated:', DISTRIBUTION_CONFIG);
}

/**
 * UPDATE DEBUG DISPLAY
 */
function updateDebugDisplay(message) {
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        debugDiv.innerHTML += message + '<br>';
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
}

/**
 * AUTO-INITIALIZATION
 * Waits for scene to be ready, then starts loading
 */
function tryAutoInitialization() {
    if (typeof scene !== 'undefined' && scene) {
        console.log('🌊 Scene detected, starting model system...');
        // Don't auto-load - wait for user to click button
        updateDebugDisplay('Model system ready - click "Load 3D Models" to start');
    } else {
        console.log('⏳ Waiting for scene to be ready...');
        // Try again in 1 second
        setTimeout(tryAutoInitialization, 1000);
    }
}

// Start trying to initialize after a short delay
setTimeout(tryAutoInitialization, 1000);

/**
 * GLOBAL API
 * Export functions for use by other scripts
 */
window.SeafloorModels = {
    init: initializeSeafloorModels,
    clear: clearAllDistributedModels,
    updateUrls: updateModelUrls,
    updateConfig: updateDistributionConfig,
    
    // Getters for debugging
    getLoadedModels: () => ({
        rocks: loadedRockModels.length,
        coral: loadedCoralModels.length,
        plants: loadedPlantModels.length
    }),
    getDistributedCount: () => distributedModels.length,
    getConfig: () => DISTRIBUTION_CONFIG
};

console.log('🗿 Seafloor Models System Ready');
console.log('💡 Usage: SeafloorModels.init() to start loading models');
console.log('💡 Update MODEL_URLS with your actual model files!');
