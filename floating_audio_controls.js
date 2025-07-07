// Global variables for floating audio controls
let audioButtons = [];
let buttonMeshes = [];
let textSprites = [];
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let hoveredButton = null;
let isInteractionEnabled = true;

// Configuration
const BUTTON_COUNT = 8;
const BUTTON_RADIUS = 8; // Distance in front of camera
const BUTTON_HEIGHT = 1; // Height above camera (adjustable)
const BUTTON_SIZE = 1; // Default size multiplier for custom models
const FLOAT_AMPLITUDE = 0.2; // Less floating
const FLOAT_SPEED = 0.8; // Slower floating
const TRAIL_SPEED = 0.02; // How slowly buttons follow camera (lower = more trailing)
const SCREEN_SPREAD = 25; // How spread out across screen (higher = more spread)

// Track configuration with individual 3D models
const TRACK_CONFIG = [
    {
        name: "Guitar",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/fish/white_mesh.glb",
        scale: 3.0,
        rotation: { x: 0, y: 0, z: 0 },
        offset: { x: 0, y: 0, z: 0 }
    },
    {
        name: "Bass",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/fish/bass.glb",
        scale: 3,
        rotation: { x: 0, y: Math.PI / 4, z: 0 },
        offset: { x: 0, y: 0, z: 0 }
    },
    {
        name: "Drums",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/fish/drum.glb",
        scale: 3,
        rotation: { x: 0, y: 0, z: 0 },
        offset: { x: 0, y: -0.5, z: 0 }
    },
    {
        name: "Vocals",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/fish/vocal.glb",
        scale: 5,
        rotation: { x: 0, y: 0, z: 0 },
        offset: { x: 0, y: 0, z: 0 }
    },
    {
        name: "Piano",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/fish/piano.glb",
        scale: 4,
        rotation: { x: Math.PI / 2, y: Math.PI / 2, z: Math.PI / 2 },
        offset: { x: 0, y: 0, z: 0 }
    },
    {
        name: "Strings",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/fish/string.glb",
        scale: 2.2,
        rotation: { x: Math.PI / 6, y: 0, z: 0 },
        offset: { x: 0, y: 0, z: 0 }
    },
    {
        name: "Synth",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/fish/synths.glb",
        scale: 2.5,
        rotation: { x: Math.PI / 2, y: 0, z: Math.PI / 2 },
        offset: { x: 0, y: 0, z: 0 }
    },
    {
        name: "Effects",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/fish/effects.glb",
        scale: 1.1,
        rotation: { x: 0, y: Math.PI / 8, z: 0 },
        offset: { x: 0, y: 0, z: 0 }
    }
];

// Button states and positioning
let buttonStates = new Array(BUTTON_COUNT).fill(true); // All active by default
let animationTime = 0;
let buttonTargetPositions = []; // Where buttons want to be
let buttonCurrentPositions = []; // Where buttons currently are
let randomOffsets = []; // Random spread for each button
let fadeStartTime = 0; // When fade-in started
let isFadingIn = false; // Whether buttons are currently fading in
let loadedModels = {}; // Cache for loaded 3D models
let loadingModels = {}; // Track which models are currently loading

// Debug logging
function logAudio(message) {
    console.log('[Audio Controls] ' + message);
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        debugDiv.innerHTML += '[Audio] ' + message + '<br>';
    }
}

// Create text texture for button labels
function createTextTexture(text, isActive = true) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = 256;
    canvas.height = 128;
    
    // Background
    context.fillStyle = isActive ? 'rgba(0, 100, 0, 0.8)' : 'rgba(100, 100, 100, 0.6)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border
    context.strokeStyle = isActive ? '#006400' : '#CCCCCC';
    context.lineWidth = 4;
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    
    // Text
    context.fillStyle = isActive ? '#FFFFFF' : '#CCCCCC';
    context.font = 'bold 32px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// Load 3D model for button
async function load3DModel(config, index) {
    const { modelUrl, name } = config;
    
    // Check if already loaded
    if (loadedModels[modelUrl]) {
        logAudio(`Using cached model for ${name}`);
        return loadedModels[modelUrl].clone();
    }
    
    // Check if currently loading
    if (loadingModels[modelUrl]) {
        logAudio(`Waiting for ${name} model to finish loading...`);
        return new Promise((resolve) => {
            const checkLoaded = setInterval(() => {
                if (loadedModels[modelUrl]) {
                    clearInterval(checkLoaded);
                    resolve(loadedModels[modelUrl].clone());
                }
            }, 100);
        });
    }
    
    // Start loading
    loadingModels[modelUrl] = true;
    logAudio(`Loading 3D model for ${name}: ${modelUrl}`);
    
    return new Promise((resolve, reject) => {
        if (typeof THREE.GLTFLoader === 'undefined') {
            logAudio(`GLTFLoader not available for ${name}, using fallback sphere`);
            delete loadingModels[modelUrl];
            resolve(createFallbackButton(config));
            return;
        }
        
        const loader = new THREE.GLTFLoader();
        loader.load(
            modelUrl,
            (gltf) => {
                logAudio(`Successfully loaded 3D model for ${name}`);
                
                // Extract the main mesh from the GLTF scene
                let modelMesh = null;
                gltf.scene.traverse((child) => {
                    if (child.isMesh && !modelMesh) {
                        modelMesh = child.clone();
                        // Ensure the model has proper materials
                        if (!modelMesh.material) {
                            modelMesh.material = new THREE.MeshLambertMaterial({ color: 0x666666 });
                        }
                    }
                });
                
                if (!modelMesh) {
                    logAudio(`No mesh found in ${name} model, using fallback`);
                    modelMesh = createFallbackButton(config);
                }
                
                // Cache the loaded model
                loadedModels[modelUrl] = modelMesh;
                delete loadingModels[modelUrl];
                
                resolve(modelMesh.clone());
            },
            (progress) => {
                if (progress.total > 0) {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    logAudio(`Loading ${name}: ${percent}%`);
                }
            },
            (error) => {
                logAudio(`Error loading ${name} model: ${error.message}, using fallback`);
                delete loadingModels[modelUrl];
                resolve(createFallbackButton(config));
            }
        );
    });
}

// Create fallback button (sphere) when 3D model fails to load
function createFallbackButton(config) {
    const geometry = new THREE.SphereGeometry(BUTTON_SIZE, 16, 12);
    const material = new THREE.MeshLambertMaterial({
        color: 0x666666,
        transparent: true,
        opacity: 0.8
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    logAudio(`Created fallback sphere for ${config.name}`);
    return mesh;
}

// Apply configuration to 3D model
function configureModel(modelMesh, config, index, isActive) {
    // Apply scale
    const scale = config.scale * BUTTON_SIZE;
    modelMesh.scale.setScalar(scale);
    
    // Apply rotation
    if (config.rotation) {
        modelMesh.rotation.set(
            config.rotation.x || 0,
            config.rotation.y || 0,
            config.rotation.z || 0
        );
    }
    
    // Apply offset (will be used in positioning)
    if (config.offset) {
        modelMesh.userData.offset = config.offset;
    }
    
    // Set user data
    modelMesh.userData = {
        ...modelMesh.userData,
        type: 'audioButton',
        index: index,
        trackName: config.name,
        isActive: isActive,
        config: config
    };
    
    // Update material based on active state
    updateModelMaterial(modelMesh, isActive);
    
    return modelMesh;
}

// Update model material based on active state
function updateModelMaterial(modelMesh, isActive) {
    if (modelMesh.material) {
        // Store original color if not already stored
        if (!modelMesh.userData.originalColor && modelMesh.material.color) {
            modelMesh.userData.originalColor = modelMesh.material.color.getHex();
        }
        
        if (isActive) {
            // Active state - use original color or default
            const originalColor = modelMesh.userData.originalColor || 0x666666;
            modelMesh.material.color.setHex(originalColor);
            modelMesh.material.opacity = 0.9;
        } else {
            // Inactive state - make it grayer and more transparent
            modelMesh.material.color.setHex(0x999999);
            modelMesh.material.opacity = 0.5;
        }
        
        // Ensure transparency is enabled
        modelMesh.material.transparent = true;
    }
}

// Create button with 3D model
async function createButtonMesh(index, config) {
    // Load the 3D model
    const modelMesh = await load3DModel(config, index);
    
    // Configure the model
    const configuredModel = configureModel(modelMesh, config, index, buttonStates[index]);
    
    // Create text plane
    const textGeometry = new THREE.PlaneGeometry(3, 1.5);
    const textTexture = createTextTexture(config.name, buttonStates[index]);
    const textMaterial = new THREE.MeshBasicMaterial({
        map: textTexture,
        transparent: true,
        side: THREE.DoubleSide
    });
    
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(0, -2.5, 0); // Below the button, adjusted for potentially larger models
    
    // Group button and text
    const buttonGroup = new THREE.Group();
    buttonGroup.add(configuredModel);
    buttonGroup.add(textMesh);
    
    // Apply any offset from config
    if (config.offset) {
        buttonGroup.position.set(
            config.offset.x || 0,
            config.offset.y || 0,
            config.offset.z || 0
        );
    }
    
    return { group: buttonGroup, button: configuredModel, text: textMesh };
}

// Position buttons randomly spread in front of camera with trailing
function calculateButtonPosition(index, camera) {
    const floatOffset = Math.sin(animationTime + index) * FLOAT_AMPLITUDE;
    
    // Get or create random offset for this button
    if (!randomOffsets[index]) {
        let attempts = 0;
        let validPosition = false;
        let newOffset;
        
        // Try to find a position that's at least 4 units away from other buttons
        while (!validPosition && attempts < 50) {
            newOffset = {
                x: (Math.random() - 0.5) * SCREEN_SPREAD,
                y: (Math.random() - 0.5) * SCREEN_SPREAD * 0.7, // Less vertical spread
                z: (Math.random() - 0.5) * 2 // Small depth variation
            };
            
            // Check distance from other buttons (use larger minimum for visual separation)
            validPosition = true;
            for (let i = 0; i < index; i++) {
                if (randomOffsets[i]) {
                    // Check both 3D distance and 2D screen distance
                    const distance3D = Math.sqrt(
                        Math.pow(newOffset.x - randomOffsets[i].x, 2) +
                        Math.pow(newOffset.y - randomOffsets[i].y, 2) +
                        Math.pow(newOffset.z - randomOffsets[i].z, 2)
                    );
                    
                    // Also check 2D distance (more important for visual separation)
                    const distance2D = Math.sqrt(
                        Math.pow(newOffset.x - randomOffsets[i].x, 2) +
                        Math.pow(newOffset.y - randomOffsets[i].y, 2)
                    );
                    
                    if (distance3D < 8 || distance2D < 6) { // Increased minimum distances for larger models
                        validPosition = false;
                        break;
                    }
                }
            }
            attempts++;
        }
        
        randomOffsets[index] = newOffset;
    }
    
    const offset = randomOffsets[index];
    
    // Position in front of camera (local space) with random spread
    const localX = offset.x;
    const localY = offset.y + floatOffset;
    const localZ = -BUTTON_RADIUS + offset.z; // In front of camera with depth variation
    
    // Get camera's world position and rotation
    const cameraPosition = camera.position.clone();
    const cameraRotation = camera.rotation.clone();
    
    // Create local position vector
    const localPosition = new THREE.Vector3(localX, localY, localZ);
    
    // Rotate the local position by camera's Y rotation only (so buttons stay level)
    localPosition.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation.y);
    
    // Add to camera position to get world position
    const targetWorldPosition = cameraPosition.clone().add(localPosition);
    
    return targetWorldPosition;
}

// Update button positions with trailing effect
function updateButtonPositions(camera) {
    if (!camera || buttonMeshes.length === 0) return;
    
    buttonMeshes.forEach((buttonData, index) => {
        // Calculate where button wants to be
        const targetPosition = calculateButtonPosition(index, camera);
        
        // Initialize current position if needed
        if (!buttonCurrentPositions[index]) {
            buttonCurrentPositions[index] = targetPosition.clone();
        }
        
        // Slowly move current position toward target (trailing effect)
        buttonCurrentPositions[index].lerp(targetPosition, TRAIL_SPEED);
        
        // Set button to current position
        buttonData.group.position.copy(buttonCurrentPositions[index]);
        
        // Make buttons face the camera (optional, can be disabled for specific models)
        if (!buttonData.button.userData.config.noAutoRotate) {
            buttonData.group.lookAt(camera.position);
        }
    });
}

// Update button visual state
function updateButtonVisual(index, isActive) {
    if (index < 0 || index >= buttonMeshes.length) return;
    
    const buttonData = buttonMeshes[index];
    
    // Update 3D model material
    updateModelMaterial(buttonData.button, isActive);
    buttonData.button.userData.isActive = isActive;
    
    // Update text texture
    const newTexture = createTextTexture(TRACK_CONFIG[index].name, isActive);
    buttonData.text.material.map.dispose(); // Clean up old texture
    buttonData.text.material.map = newTexture;
    buttonData.text.material.needsUpdate = true;
    
    logAudio(`Button ${index} (${TRACK_CONFIG[index].name}) set to ${isActive ? 'active' : 'inactive'}`);
}

// Handle button clicks
function onButtonClick(index) {
    buttonStates[index] = !buttonStates[index];
    updateButtonVisual(index, buttonStates[index]);
    
    // TODO: Add audio track control here
    logAudio(`Track ${TRACK_CONFIG[index].name} ${buttonStates[index] ? 'enabled' : 'disabled'}`);
    
    // Emit custom event for audio system
    window.dispatchEvent(new CustomEvent('trackToggle', {
        detail: { 
            trackIndex: index, 
            trackName: TRACK_CONFIG[index].name, 
            active: buttonStates[index] 
        }
    }));
}

// Mouse interaction handling
function setupInteraction() {
    function onMouseMove(event) {
        if (!isInteractionEnabled) return;
        
        // Calculate mouse position in normalized device coordinates
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update raycaster
        if (typeof camera !== 'undefined') {
            raycaster.setFromCamera(mouse, camera);
            
            // Check for intersections with buttons
            const buttonObjects = buttonMeshes.map(data => data.button);
            const intersects = raycaster.intersectObjects(buttonObjects);
            
            // Handle hover effects
            if (intersects.length > 0) {
                const newHovered = intersects[0].object;
                if (hoveredButton !== newHovered) {
                    // Reset previous hovered button
                    if (hoveredButton) {
                        hoveredButton.scale.multiplyScalar(1 / 1.1); // Reset scale
                    }
                    
                    // Set new hovered button
                    hoveredButton = newHovered;
                    hoveredButton.scale.multiplyScalar(1.1); // Slight scale up
                    document.body.style.cursor = 'pointer';
                }
            } else {
                // No hover
                if (hoveredButton) {
                    hoveredButton.scale.multiplyScalar(1 / 1.1); // Reset scale
                    hoveredButton = null;
                    document.body.style.cursor = 'default';
                }
            }
        }
    }
    
    function onMouseClick(event) {
        if (!isInteractionEnabled || !hoveredButton) return;
        
        const buttonIndex = hoveredButton.userData.index;
        onButtonClick(buttonIndex);
    }
    
    // Add event listeners
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('click', onMouseClick);
    
    logAudio('Mouse interaction setup complete');
}

// Create all audio control buttons with 3D models
async function createAudioButtons() {
    logAudio('Creating 8 floating audio control buttons with custom 3D models...');
    
    if (typeof scene === 'undefined') {
        logAudio('Scene not available, retrying...');
        setTimeout(createAudioButtons, 1000);
        return;
    }
    
    // Clear existing buttons and reset positions
    buttonMeshes.forEach(buttonData => {
        scene.remove(buttonData.group);
        // Clean up materials and textures
        if (buttonData.button.material) buttonData.button.material.dispose();
        if (buttonData.text.material.map) buttonData.text.material.map.dispose();
        if (buttonData.text.material) buttonData.text.material.dispose();
    });
    buttonMeshes = [];
    buttonCurrentPositions = [];
    randomOffsets = [];
    
    // Start fade-in effect
    fadeStartTime = performance.now();
    isFadingIn = true;
    
    // Create new buttons (initially invisible)
    logAudio('Loading 3D models for each button...');
    
    for (let i = 0; i < BUTTON_COUNT; i++) {
        const config = TRACK_CONFIG[i];
        logAudio(`Creating button ${i}: ${config.name}`);
        
        try {
            const buttonData = await createButtonMesh(i, config);
            
            // Set initial opacity to 0 for fade-in
            if (buttonData.button.material) {
                buttonData.button.material.opacity = 0;
            }
            buttonData.text.material.opacity = 0;
            
            buttonMeshes.push(buttonData);
            scene.add(buttonData.group);
            
            // Set initial position
            if (typeof camera !== 'undefined') {
                const position = calculateButtonPosition(i, camera);
                buttonData.group.position.copy(position);
                buttonCurrentPositions[i] = position.clone();
            }
            
            logAudio(`Successfully created button ${i}: ${config.name}`);
        } catch (error) {
            logAudio(`Error creating button ${i}: ${error.message}`);
        }
    }
    
    logAudio(`Successfully created ${buttonMeshes.length} buttons with custom 3D models`);
}

// Animation update function
function updateAudioControls(deltaTime = 0.016) {
    animationTime += deltaTime * FLOAT_SPEED;
    
    // Handle fade-in effect
    if (isFadingIn) {
        const elapsed = (performance.now() - fadeStartTime) / 1000; // Convert to seconds
        const fadeProgress = Math.min(elapsed / 3.0, 1.0); // 3 second fade duration for loading models
        
        // Update opacity for all buttons
        buttonMeshes.forEach((buttonData, index) => {
            const targetButtonOpacity = buttonStates[index] ? 0.9 : 0.5;
            const targetTextOpacity = 1.0;
            
            if (buttonData.button.material) {
                buttonData.button.material.opacity = fadeProgress * targetButtonOpacity;
            }
            buttonData.text.material.opacity = fadeProgress * targetTextOpacity;
        });
        
        // Stop fading when complete
        if (fadeProgress >= 1.0) {
            isFadingIn = false;
            logAudio('Fade-in complete');
        }
    }
    
    // Update button positions relative to camera
    if (typeof camera !== 'undefined') {
        updateButtonPositions(camera);
    }
}

// Initialize the audio control system
function initializeAudioControls() {
    logAudio('Initializing floating audio controls system with custom 3D models...');
    
    if (typeof scene === 'undefined' || typeof camera === 'undefined') {
        logAudio('Scene or camera not ready, retrying in 1 second...');
        setTimeout(initializeAudioControls, 1000);
        return;
    }
    
    createAudioButtons();
    setupInteraction();
    
    logAudio('Audio controls system initialized successfully');
}

// DOM ready handler
document.addEventListener('DOMContentLoaded', function() {
    // Wait for main scene to be ready
    setTimeout(initializeAudioControls, 4000);
});

// Export system for external access
window.AudioControlSystem = {
    getButtons: () => buttonMeshes,
    getButtonStates: () => [...buttonStates], // Return copy
    getTrackConfig: () => [...TRACK_CONFIG], // Return copy of track configuration
    
    setButtonState: (index, active) => {
        if (index >= 0 && index < BUTTON_COUNT) {
            buttonStates[index] = active;
            updateButtonVisual(index, active);
        }
    },
    
    toggleButton: (index) => {
        if (index >= 0 && index < BUTTON_COUNT) {
            onButtonClick(index);
        }
    },
    
    setAllButtons: (active) => {
        for (let i = 0; i < BUTTON_COUNT; i++) {
            buttonStates[i] = active;
            updateButtonVisual(i, active);
        }
        logAudio(`All tracks set to ${active ? 'active' : 'inactive'}`);
    },
    
    // Update individual track configuration
    updateTrackConfig: (index, newConfig) => {
        if (index >= 0 && index < BUTTON_COUNT) {
            TRACK_CONFIG[index] = { ...TRACK_CONFIG[index], ...newConfig };
            logAudio(`Updated configuration for track ${index}: ${TRACK_CONFIG[index].name}`);
            // Note: You'll need to call recreateButtons() to see the changes
        }
    },
    
    // Update model URL for a specific track
    updateTrackModel: (index, modelUrl, config = {}) => {
        if (index >= 0 && index < BUTTON_COUNT) {
            TRACK_CONFIG[index].modelUrl = modelUrl;
            if (config.scale !== undefined) TRACK_CONFIG[index].scale = config.scale;
            if (config.rotation) TRACK_CONFIG[index].rotation = config.rotation;
            if (config.offset) TRACK_CONFIG[index].offset = config.offset;
            
            logAudio(`Updated model for track ${index}: ${TRACK_CONFIG[index].name} -> ${modelUrl}`);
            // Clear cache for this model
            delete loadedModels[modelUrl];
        }
    },
    
    update: updateAudioControls,
    
    // Configuration
    setInteractionEnabled: (enabled) => {
        isInteractionEnabled = enabled;
        logAudio(`Interaction ${enabled ? 'enabled' : 'disabled'}`);
    },
    
    getTrackNames: () => TRACK_CONFIG.map(config => config.name),
    
    // Debug functions
    debugInfo: () => {
        logAudio('=== AUDIO CONTROLS DEBUG ===');
        logAudio(`Buttons created: ${buttonMeshes.length}`);
        logAudio(`Models loaded: ${Object.keys(loadedModels).length}`);
        logAudio(`Models loading: ${Object.keys(loadingModels).length}`);
        logAudio(`Interaction enabled: ${isInteractionEnabled}`);
        logAudio(`Camera available: ${typeof camera !== 'undefined'}`);
        logAudio(`Scene available: ${typeof scene !== 'undefined'}`);
        logAudio(`Button states: ${buttonStates.map((active, i) => `${TRACK_CONFIG[i].name}: ${active}`).join(', ')}`);
        
        if (buttonMeshes.length > 0 && typeof camera !== 'undefined') {
            buttonMeshes.forEach((buttonData, i) => {
                logAudio(`Button ${i} position: ${buttonData.group.position.x.toFixed(1)}, ${buttonData.group.position.y.toFixed(1)}, ${buttonData.group.position.z.toFixed(1)}`);
            });
        }
        
        return {
            buttonCount: buttonMeshes.length,
            modelsLoaded: Object.keys(loadedModels).length,
            modelsLoading: Object.keys(loadingModels).length,
            interactionEnabled: isInteractionEnabled,
            cameraAvailable: typeof camera !== 'undefined',
            states: buttonStates,
            trackConfig: TRACK_CONFIG
        };
    },
    
    // Force recreate buttons (useful for debugging or applying config changes)
    recreateButtons: () => {
        // Clear model cache if needed
        // loadedModels = {};
        createAudioButtons();
    },
    
    // Clear model cache
    clearModelCache: () => {
        loadedModels = {};
        logAudio('Model cache cleared');
    }
};

// Hook into main animation loop
if (typeof window.AssetUpdateCallbacks === 'undefined') {
    window.AssetUpdateCallbacks = [];
}
window.AssetUpdateCallbacks.push(updateAudioControls);
