// Global variables for floating audio controls
let audioButtons = [];
let buttonMeshes = [];
let textSprites = [];
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let hoveredButton = null;
let isInteractionEnabled = true;

// Configuration
const BUTTON_COUNT = 7;
const BUTTON_RADIUS = 9.5; // Distance in front of camera (increased from 8)
const BUTTON_HEIGHT = 0; // Height above camera (adjustable)
const BUTTON_SIZE = 1; // Default size multiplier for custom models
const FLOAT_AMPLITUDE = 0.2; // Less floating
const FLOAT_SPEED = 0.8; // Slower floating
const TRAIL_SPEED = 0.02; // How slowly buttons follow camera (lower = more trailing)
const SCREEN_SPREAD = 7; // How spread out across screen (reduced from 25)
const MIN_BUTTON_DISTANCE = 5; // Minimum distance between buttons (reduced from 10)

// Track configuration with individual 3D models
const TRACK_CONFIG = [
    {
        name: "Bass Pluck",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/fish/guitar2.glb",
        scale: 2.0,
        rotation: { x: 0, y: 0, z: 0 },
        offset: { x: 0, y: 0, z: 0 }
    },
    {
        name: "Pluck",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/fish/bass2.glb",
        scale: 2.2,
        rotation: { x: 0, y: Math.PI / 4, z: 0 },
        offset: { x: 0, y: 0, z: 0 }
    },
    {
        name: "Pluck (High Pitch)",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/fish/drum2.glb",
        scale: 2.2,
        rotation: { x: 0, y: 0, z: 0 },
        offset: { x: 0, y: -0.5, z: 0 }
    },
    {
        name: "Violin Chorus",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/fish/vocal2.glb",
        scale: 2.2,
        rotation: { x: 2 * Math.PI, y: Math.PI / 4, z: 0 },
        offset: { x: 0, y: 0, z: 0 }
    },
    {
        name: "Synth",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/fish/piano2.glb",
        scale: 2.2,
        rotation: { x: 2 * Math.PI, y: Math.PI, z: Math.PI / 4 },
        offset: { x: 0, y: 0, z: 0 }
    },
    {
        name: "Drums",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/fish/string2.glb",
        scale: 2.2,
        rotation: { x: Math.PI / 6, y: 0, z: 0 },
        offset: { x: 0, y: 0, z: 0 }
    },
    {
        name: "Violin Lead",
        modelUrl: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/fish/synths2.glb",
        scale: 2.2,
        rotation: { x: Math.PI / 6, y: Math.PI / 2, z: 0 },
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

// NEW: Variables for synchronized initialization
let allButtonsInitialized = false;
let initializationProgress = 0;
let totalButtonsToLoad = BUTTON_COUNT;

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
    context.fillStyle = isActive ? 'rgba(23, 23, 23, 0.8)' : 'rgba(100, 100, 100, 0.6)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border
    context.strokeStyle = isActive ? '#5e5e5c' : '#CCCCCC';
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
                        
                        // Ensure the model has proper materials that work without lighting
                        if (modelMesh.material) {
                            // Convert any material to MeshBasicMaterial to avoid lighting issues
                            const originalColor = modelMesh.material.color ? modelMesh.material.color.getHex() : 0x666666;
                            const originalMap = modelMesh.material.map || null;
                            
                            modelMesh.material = new THREE.MeshBasicMaterial({
                                color: originalColor,
                                map: originalMap,
                                transparent: true,
                                opacity: 1.0
                            });
                        } else {
                            // Add default material if none exists
                            modelMesh.material = new THREE.MeshBasicMaterial({ 
                                color: 0x666666,
                                transparent: true,
                                opacity: 1.0
                            });
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
    const material = new THREE.MeshBasicMaterial({
        color: 0x666666,
        transparent: true,
        opacity: 0 // Start invisible for synchronized fade-in
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
    
    // Store original material properties for potential opacity changes
    if (modelMesh.material) {
        // Store original opacity if not already stored
        if (modelMesh.userData.originalOpacity === undefined) {
            modelMesh.userData.originalOpacity = modelMesh.material.opacity || 1.0;
        }
        // Ensure material can handle transparency for hover effects
        modelMesh.material.transparent = true;
        // Start invisible for synchronized fade-in
        modelMesh.material.opacity = 0;
    }
    
    return modelMesh;
}

// Update model material based on active state - NO COLOR CHANGES, only opacity
function updateModelMaterial(modelMesh, isActive) {
    if (modelMesh.material) {
        // Only change opacity based on active state, preserve original colors/textures
        const originalOpacity = modelMesh.userData.originalOpacity || 1.0;
        
        if (isActive) {
            // Active state - full opacity (but only if fade-in is complete)
            modelMesh.material.opacity = allButtonsInitialized ? originalOpacity : 0;
        } else {
            // Inactive state - slightly transparent (but only if fade-in is complete)
            modelMesh.material.opacity = allButtonsInitialized ? originalOpacity * 0.7 : 0;
        }
        
        // Keep transparency enabled for hover effects
        modelMesh.material.transparent = true;
    }
}

// Create button with 3D model
async function createButtonMesh(index, config) {
    // Load the 3D model
    const modelMesh = await load3DModel(config, index);
    
    // Configure the model (starts invisible)
    const configuredModel = configureModel(modelMesh, config, index, buttonStates[index]);
    
    // Create text plane (starts invisible)
    const textGeometry = new THREE.PlaneGeometry(3, 1.5);
    const textTexture = createTextTexture(config.name, buttonStates[index]);
    const textMaterial = new THREE.MeshBasicMaterial({
        map: textTexture,
        transparent: true,
        side: THREE.DoubleSide,
        opacity: 0 // Start invisible
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

// Check if a position is valid (not too close to existing buttons)
function isValidPosition(newPosition, existingPositions, minDistance = MIN_BUTTON_DISTANCE) {
    for (let i = 0; i < existingPositions.length; i++) {
        if (existingPositions[i]) {
            const distance = Math.sqrt(
                Math.pow(newPosition.x - existingPositions[i].x, 2) +
                Math.pow(newPosition.y - existingPositions[i].y, 2) +
                Math.pow(newPosition.z - existingPositions[i].z, 2)
            );
            
            if (distance < minDistance) {
                return false;
            }
        }
    }
    return true;
}

// Generate a grid-based position to ensure better spacing
function generateGridPosition(index, totalButtons) {
    // Use a more spread out arrangement
    const positions = [
        { x: -10, y: 8 },   // Top left
        { x: 0, y: 9 },    // Top center
        { x: 11, y: 7 },    // Top right
        { x: -10, y: 0 },    // Middle left
        { x: 2, y: 1 },     // Middle right
        { x: -8, y: -6 },  // Bottom left
        { x: 5, y: -5 },   // Bottom center
        { x: 12, y: -8 }    // Bottom right
    ];
    
    // Use predefined positions if available, otherwise fall back to grid
    if (index < positions.length) {
        return {
            x: positions[index].x,
            y: positions[index].y,
            z: (Math.random() - 0.5) * 2
        };
    }
    
    // Fallback to grid for extra buttons
    const cols = Math.ceil(Math.sqrt(totalButtons));
    const rows = Math.ceil(totalButtons / cols);
    
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    const spacing = MIN_BUTTON_DISTANCE;
    const startX = -(cols - 1) * spacing / 2;
    const startY = -(rows - 1) * spacing / 2;
    
    return {
        x: startX + col * spacing,
        y: startY + row * spacing,
        z: (Math.random() - 0.5) * 2
    };
}

// Position buttons randomly spread in front of camera with trailing
function calculateButtonPosition(index, camera) {
    const floatOffset = Math.sin(animationTime + index) * FLOAT_AMPLITUDE;
    
    // Get or create random offset for this button
    if (!randomOffsets[index]) {
        let attempts = 0;
        let validPosition = false;
        let newOffset;
        
        // First try grid-based positioning for better initial spread
        if (attempts === 0) {
            newOffset = generateGridPosition(index, BUTTON_COUNT);
            
            // Add some randomness to the grid position
            newOffset.x += (Math.random() - 0.5) * (MIN_BUTTON_DISTANCE * 0.3);
            newOffset.y += (Math.random() - 0.5) * (MIN_BUTTON_DISTANCE * 0.3);
            
            // Check if this grid position is valid
            if (isValidPosition(newOffset, randomOffsets, MIN_BUTTON_DISTANCE)) {
                validPosition = true;
            }
        }
        
        // If grid position failed, try random positioning with better collision detection
        while (!validPosition && attempts < 100) {
            newOffset = {
                x: (Math.random() - 0.5) * SCREEN_SPREAD,
                y: (Math.random() - 0.5) * SCREEN_SPREAD * 0.6, // Reduced vertical spread
                z: (Math.random() - 0.5) * 2 // Smaller depth variation
            };
            
            // Check if this position is valid
            if (isValidPosition(newOffset, randomOffsets, MIN_BUTTON_DISTANCE)) {
                validPosition = true;
                logAudio(`Found valid position for button ${index} after ${attempts + 1} attempts`);
            }
            
            attempts++;
        }
        
        // If we still can't find a valid position, use a fallback with guaranteed spacing
        if (!validPosition) {
            logAudio(`Could not find valid random position for button ${index}, using fallback`);
            const angle = (index / BUTTON_COUNT) * Math.PI * 2;
            const radius = MIN_BUTTON_DISTANCE * 1.5; // Ensure adequate spacing
            
            newOffset = {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius * 0.6,
                z: (Math.random() - 0.5) * 2
            };
        }
        
        randomOffsets[index] = newOffset;
        logAudio(`Button ${index} positioned at: ${newOffset.x.toFixed(1)}, ${newOffset.y.toFixed(1)}, ${newOffset.z.toFixed(1)}`);
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

const MINIMUM_BUTTON_HEIGHT = 1.5; // Change this single value to adjust all button heights

// Update button positions with trailing effect
function updateButtonPositions(camera) {
    if (!camera || buttonMeshes.length === 0) return;
    
    buttonMeshes.forEach((buttonData, index) => {
        // Calculate where button wants to be (using original logic)
        const targetPosition = calculateButtonPosition(index, camera);
        
        // Initialize current position if needed
        if (!buttonCurrentPositions[index]) {
            buttonCurrentPositions[index] = targetPosition.clone();
        }
        
        // Slowly move current position toward target (trailing effect)
        buttonCurrentPositions[index].lerp(targetPosition, TRAIL_SPEED);
        
        // SIMPLE HEIGHT ENFORCEMENT - just one line!
        if (buttonCurrentPositions[index].y < MINIMUM_BUTTON_HEIGHT) {
            buttonCurrentPositions[index].y = MINIMUM_BUTTON_HEIGHT;
        }
        
        // Set button to current position
        buttonData.group.position.copy(buttonCurrentPositions[index]);
        
        // Make buttons face the camera
        if (!buttonData.button.userData.config.noAutoRotate) {
            buttonData.group.lookAt(camera.position);
        }
    });
}

// Update button visual state
function updateButtonVisual(index, isActive) {
    if (index < 0 || index >= buttonMeshes.length) return;
    
    const buttonData = buttonMeshes[index];
    
    // Update 3D model material (only opacity, not colors)
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

// NEW: Check if all buttons are ready for synchronized fade-in
function checkInitializationComplete() {
    // Count successfully created buttons
    const readyButtons = buttonMeshes.filter(buttonData => 
        buttonData && buttonData.group && buttonData.button && buttonData.text
    ).length;
    
    initializationProgress = readyButtons;
    
    // All buttons are ready - start synchronized fade-in
    if (readyButtons === totalButtonsToLoad && !allButtonsInitialized) {
        allButtonsInitialized = true;
        fadeStartTime = performance.now();
        isFadingIn = true;
        logAudio(`All ${readyButtons} buttons initialized! Starting synchronized fade-in...`);
        
        // Set all buttons to their final positions immediately
        if (typeof camera !== 'undefined') {
            buttonMeshes.forEach((buttonData, index) => {
                const position = calculateButtonPosition(index, camera);
                buttonData.group.position.copy(position);
                buttonCurrentPositions[index] = position.clone();
            });
        }
    }
}

// Create all audio control buttons with 3D models - MODIFIED for synchronized loading
async function createAudioButtons() {
    logAudio('Creating 7 floating audio control buttons with custom 3D models...');
    
    if (typeof scene === 'undefined') {
        logAudio('Scene not available, retrying...');
        setTimeout(createAudioButtons, 1000);
        return;
    }
    
    // Clear existing buttons and reset state
    buttonMeshes.forEach(buttonData => {
        scene.remove(buttonData.group);
        // Clean up materials and textures
        if (buttonData.button.material) buttonData.button.material.dispose();
        if (buttonData.text.material.map) buttonData.text.material.map.dispose();
        if (buttonData.text.material) buttonData.text.material.dispose();
    });
    buttonMeshes = [];
    buttonCurrentPositions = [];
    randomOffsets = []; // Clear the random offsets to force regeneration
    
    // Reset initialization state
    allButtonsInitialized = false;
    isFadingIn = false;
    initializationProgress = 0;
    totalButtonsToLoad = BUTTON_COUNT;
    
    logAudio('Loading ALL 3D models simultaneously...');
    
    // Create ALL buttons simultaneously using Promise.all
    const buttonPromises = [];
    
    for (let i = 0; i < BUTTON_COUNT; i++) {
        const config = TRACK_CONFIG[i];
        logAudio(`Queuing button ${i}: ${config.name} for simultaneous loading`);
        
        const buttonPromise = createButtonMesh(i, config).then(buttonData => {
            // Add to scene immediately but keep invisible
            buttonMeshes[i] = buttonData;
            scene.add(buttonData.group);
            
            // Set initial position
            if (typeof camera !== 'undefined') {
                const position = calculateButtonPosition(i, camera);
                buttonData.group.position.copy(position);
                buttonCurrentPositions[i] = position.clone();
            }
            
            logAudio(`Button ${i}: ${config.name} created and added to scene (invisible)`);
            return buttonData;
        }).catch(error => {
            logAudio(`Error creating button ${i}: ${error.message}`);
            return null;
        });
        
        buttonPromises.push(buttonPromise);
    }
    
    // Wait for ALL buttons to be created
    try {
        logAudio('Waiting for all buttons to finish loading...');
        const results = await Promise.all(buttonPromises);
        
        // Filter out any null results from failed loads
        const successfulButtons = results.filter(result => result !== null);
        
        logAudio(`Successfully loaded ${successfulButtons.length}/${BUTTON_COUNT} buttons`);
        
        // Check if initialization is complete
        checkInitializationComplete();
        
    } catch (error) {
        logAudio(`Error during batch button creation: ${error.message}`);
        // Still check what we managed to create
        checkInitializationComplete();
    }
}

// Animation update function - MODIFIED for synchronized fade-in
function updateAudioControls(deltaTime = 0.016) {
    animationTime += deltaTime * FLOAT_SPEED;
    
    // Handle synchronized fade-in effect
    if (isFadingIn && allButtonsInitialized) {
        const elapsed = (performance.now() - fadeStartTime) / 1000; // Convert to seconds
        const fadeProgress = Math.min(elapsed / 2.0, 1.0); // 2 second fade duration for smoother effect
        
        // Update opacity for ALL buttons simultaneously
        buttonMeshes.forEach((buttonData, index) => {
            if (!buttonData) return;
            
            const originalOpacity = buttonData.button.userData.originalOpacity || 1.0;
            const targetButtonOpacity = buttonStates[index] ? originalOpacity : originalOpacity * 0.7;
            const targetTextOpacity = 1.0;
            
            if (buttonData.button.material) {
                buttonData.button.material.opacity = fadeProgress * targetButtonOpacity;
            }
            buttonData.text.material.opacity = fadeProgress * targetTextOpacity;
        });
        
        // Stop fading when complete
        if (fadeProgress >= 1.0) {
            isFadingIn = false;
            logAudio('Synchronized fade-in complete! All fish are now visible.');
        }
    }
    
    // Update button positions relative to camera (only if not still loading)
    if (typeof camera !== 'undefined' && allButtonsInitialized) {
        updateButtonPositions(camera);
    }
}

// Initialize the audio control system
function initializeAudioControls() {
    logAudio('Initializing floating audio controls system with synchronized loading...');
    
    if (typeof scene === 'undefined' || typeof camera === 'undefined') {
        logAudio('Scene or camera not ready, retrying in 1 second...');
        setTimeout(initializeAudioControls, 1000);
        return;
    }
    
    createAudioButtons();
    setupInteraction();
    
    logAudio('Audio controls system initialized - waiting for all models to load...');
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
    
    // Force regenerate button positions (useful if you want to reshuffle)
    regeneratePositions: () => {
        randomOffsets = []; // Clear existing positions
        buttonCurrentPositions = []; // Clear current positions
        logAudio('Button positions regenerated');
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
    
    // Simple method to change minimum height
    setMinimumHeight: (height) => {
        // Just update the global constant
        window.MINIMUM_BUTTON_HEIGHT = height;
        
        // Immediately apply to existing buttons
        buttonMeshes.forEach((buttonData, index) => {
            if (buttonData.group.position.y < height) {
                buttonData.group.position.y = height;
            }
            if (buttonCurrentPositions[index] && buttonCurrentPositions[index].y < height) {
                buttonCurrentPositions[index].y = height;
            }
        });
        
        logAudio(`Minimum height set to: ${height}`);
    },
    
    getMinimumHeight: () => MINIMUM_BUTTON_HEIGHT,
    
    // NEW: Get initialization status
    getInitializationStatus: () => ({
        isComplete: allButtonsInitialized,
        progress: initializationProgress,
        total: totalButtonsToLoad,
        isFadingIn: isFadingIn,
        percentage: Math.round((initializationProgress / totalButtonsToLoad) * 100)
    }),
    
    // Debug functions
    debugInfo: () => {
        logAudio('=== AUDIO CONTROLS DEBUG ===');
        logAudio(`Buttons created: ${buttonMeshes.length}`);
        logAudio(`Models loaded: ${Object.keys(loadedModels).length}`);
        logAudio(`Models loading: ${Object.keys(loadingModels).length}`);
        logAudio(`All initialized: ${allButtonsInitialized}`);
        logAudio(`Is fading in: ${isFadingIn}`);
        logAudio(`Progress: ${initializationProgress}/${totalButtonsToLoad}`);
        logAudio(`Interaction enabled: ${isInteractionEnabled}`);
        logAudio(`Camera available: ${typeof camera !== 'undefined'}`);
        logAudio(`Scene available: ${typeof scene !== 'undefined'}`);
        logAudio(`Button states: ${buttonStates.map((active, i) => `${TRACK_CONFIG[i].name}: ${active}`).join(', ')}`);
        
        if (buttonMeshes.length > 0 && typeof camera !== 'undefined') {
            buttonMeshes.forEach((buttonData, i) => {
                if (buttonData) {
                    logAudio(`Button ${i} position: ${buttonData.group.position.x.toFixed(1)}, ${buttonData.group.position.y.toFixed(1)}, ${buttonData.group.position.z.toFixed(1)}`);
                }
            });
            
            // Check distances between buttons
            logAudio('=== BUTTON DISTANCES ===');
            for (let i = 0; i < buttonMeshes.length; i++) {
                for (let j = i + 1; j < buttonMeshes.length; j++) {
                    if (buttonMeshes[i] && buttonMeshes[j]) {
                        const pos1 = buttonMeshes[i].group.position;
                        const pos2 = buttonMeshes[j].group.position;
                        const distance = Math.sqrt(
                            Math.pow(pos1.x - pos2.x, 2) +
                            Math.pow(pos1.y - pos2.y, 2) +
                            Math.pow(pos1.z - pos2.z, 2)
                        );
                        logAudio(`Distance between ${i} and ${j}: ${distance.toFixed(2)} (min required: ${MIN_BUTTON_DISTANCE})`);
                    }
                }
            }
        }
        
        return {
            buttonCount: buttonMeshes.length,
            modelsLoaded: Object.keys(loadedModels).length,
            modelsLoading: Object.keys(loadingModels).length,
            allInitialized: allButtonsInitialized,
            fadingIn: isFadingIn,
            progress: initializationProgress,
            total: totalButtonsToLoad,
            interactionEnabled: isInteractionEnabled,
            cameraAvailable: typeof camera !== 'undefined',
            states: buttonStates,
            trackConfig: TRACK_CONFIG,
            minDistance: MIN_BUTTON_DISTANCE
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
    },
    
    // Adjust minimum distance between buttons
    setMinDistance: (distance) => {
        MIN_BUTTON_DISTANCE = Math.max(distance, 5); // Minimum of 5 units
        logAudio(`Minimum button distance set to: ${MIN_BUTTON_DISTANCE}`);
        // Force regeneration of positions
        randomOffsets = [];
        buttonCurrentPositions = [];
    }
};

// Hook into main animation loop
if (typeof window.AssetUpdateCallbacks === 'undefined') {
    window.AssetUpdateCallbacks = [];
}
window.AssetUpdateCallbacks.push(updateAudioControls);