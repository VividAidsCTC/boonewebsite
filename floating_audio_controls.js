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
const BUTTON_RADIUS = 5; // Distance from camera
const BUTTON_SIZE = 3;
const FLOAT_AMPLITUDE = 0.3;
const FLOAT_SPEED = 1.5;

// Track configuration
const TRACK_NAMES = [
    "Guitar",
    "Bass", 
    "Drums",
    "Vocals",
    "Piano",
    "Strings",
    "Synth",
    "Effects"
];

// Button states
let buttonStates = new Array(BUTTON_COUNT).fill(true); // All active by default
let animationTime = 0;

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
    context.fillStyle = isActive ? 'rgba(0, 150, 255, 0.8)' : 'rgba(100, 100, 100, 0.6)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border
    context.strokeStyle = isActive ? '#00AAFF' : '#666666';
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

// Create button geometry and material
function createButtonMesh(index, trackName) {
    // Button base (sphere)
    const buttonGeometry = new THREE.SphereGeometry(BUTTON_SIZE, 16, 12);
    const buttonMaterial = new THREE.MeshLambertMaterial({
        color: buttonStates[index] ? 0x0099FF : 0x666666,
        transparent: true,
        opacity: buttonStates[index] ? 0.9 : 0.6
    });
    
    const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);
    buttonMesh.userData = { 
        type: 'audioButton', 
        index: index, 
        trackName: trackName,
        isActive: buttonStates[index]
    };
    
    // Text plane
    const textGeometry = new THREE.PlaneGeometry(3, 1.5);
    const textTexture = createTextTexture(trackName, buttonStates[index]);
    const textMaterial = new THREE.MeshBasicMaterial({
        map: textTexture,
        transparent: true,
        side: THREE.DoubleSide
    });
    
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(0, -1.5, 0); // Below the button
    
    // Group button and text
    const buttonGroup = new THREE.Group();
    buttonGroup.add(buttonMesh);
    buttonGroup.add(textMesh);
    
    return { group: buttonGroup, button: buttonMesh, text: textMesh };
}

// Position buttons in a circle around camera
function calculateButtonPosition(index, camera) {
    const angle = (index / BUTTON_COUNT) * Math.PI * 2;
    const floatOffset = Math.sin(animationTime + index) * FLOAT_AMPLITUDE;
    
    // Position relative to camera
    const relativePosition = new THREE.Vector3(
        Math.cos(angle) * BUTTON_RADIUS,
        2 + floatOffset, // Slight upward offset with floating
        Math.sin(angle) * BUTTON_RADIUS
    );
    
    // Convert to world position
    const worldPosition = relativePosition.clone().applyMatrix4(camera.matrixWorld);
    
    return worldPosition;
}

// Update button positions relative to camera
function updateButtonPositions(camera) {
    if (!camera || buttonMeshes.length === 0) return;
    
    buttonMeshes.forEach((buttonData, index) => {
        const worldPosition = calculateButtonPosition(index, camera);
        buttonData.group.position.copy(worldPosition);
        
        // Make buttons face the camera
        buttonData.group.lookAt(camera.position);
    });
}

// Update button visual state
function updateButtonVisual(index, isActive) {
    if (index < 0 || index >= buttonMeshes.length) return;
    
    const buttonData = buttonMeshes[index];
    const color = isActive ? 0x0099FF : 0x666666;
    const opacity = isActive ? 0.9 : 0.6;
    
    // Update button material
    buttonData.button.material.color.setHex(color);
    buttonData.button.material.opacity = opacity;
    buttonData.button.userData.isActive = isActive;
    
    // Update text texture
    const newTexture = createTextTexture(TRACK_NAMES[index], isActive);
    buttonData.text.material.map.dispose(); // Clean up old texture
    buttonData.text.material.map = newTexture;
    buttonData.text.material.needsUpdate = true;
    
    logAudio(`Button ${index} (${TRACK_NAMES[index]}) set to ${isActive ? 'active' : 'inactive'}`);
}

// Handle button clicks
function onButtonClick(index) {
    buttonStates[index] = !buttonStates[index];
    updateButtonVisual(index, buttonStates[index]);
    
    // TODO: Add audio track control here
    logAudio(`Track ${TRACK_NAMES[index]} ${buttonStates[index] ? 'enabled' : 'disabled'}`);
    
    // Emit custom event for audio system
    window.dispatchEvent(new CustomEvent('trackToggle', {
        detail: { 
            trackIndex: index, 
            trackName: TRACK_NAMES[index], 
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
                        hoveredButton.scale.setScalar(1);
                    }
                    
                    // Set new hovered button
                    hoveredButton = newHovered;
                    hoveredButton.scale.setScalar(1.1); // Slight scale up
                    document.body.style.cursor = 'pointer';
                }
            } else {
                // No hover
                if (hoveredButton) {
                    hoveredButton.scale.setScalar(1);
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

// Create all audio control buttons
function createAudioButtons() {
    logAudio('Creating 8 floating audio control buttons...');
    
    if (typeof scene === 'undefined') {
        logAudio('Scene not available, retrying...');
        setTimeout(createAudioButtons, 1000);
        return;
    }
    
    // Clear existing buttons
    buttonMeshes.forEach(buttonData => {
        scene.remove(buttonData.group);
    });
    buttonMeshes = [];
    
    // Create new buttons
    for (let i = 0; i < BUTTON_COUNT; i++) {
        const buttonData = createButtonMesh(i, TRACK_NAMES[i]);
        buttonMeshes.push(buttonData);
        scene.add(buttonData.group);
        
        logAudio(`Created button ${i}: ${TRACK_NAMES[i]}`);
    }
    
    logAudio(`Successfully created ${BUTTON_COUNT} audio control buttons`);
}

// Animation update function
function updateAudioControls(deltaTime = 0.016) {
    animationTime += deltaTime * FLOAT_SPEED;
    
    // Update button positions relative to camera
    if (typeof camera !== 'undefined') {
        updateButtonPositions(camera);
    }
}

// Initialize the audio control system
function initializeAudioControls() {
    logAudio('Initializing floating audio controls system...');
    
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
    
    update: updateAudioControls,
    
    // Configuration
    setInteractionEnabled: (enabled) => {
        isInteractionEnabled = enabled;
        logAudio(`Interaction ${enabled ? 'enabled' : 'disabled'}`);
    },
    
    getTrackNames: () => [...TRACK_NAMES],
    
    // Debug functions
    debugInfo: () => {
        logAudio('=== AUDIO CONTROLS DEBUG ===');
        logAudio(`Buttons created: ${buttonMeshes.length}`);
        logAudio(`Interaction enabled: ${isInteractionEnabled}`);
        logAudio(`Button states: ${buttonStates.map((active, i) => `${TRACK_NAMES[i]}: ${active}`).join(', ')}`);
        
        return {
            buttonCount: buttonMeshes.length,
            interactionEnabled: isInteractionEnabled,
            states: buttonStates
        };
    }
};

// Hook into main animation loop
if (typeof window.AssetUpdateCallbacks === 'undefined') {
    window.AssetUpdateCallbacks = [];
}
window.AssetUpdateCallbacks.push(updateAudioControls);
