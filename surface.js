// Oscillating plane above the seafloor
let oscillatingPlane;
let oscillatingTime = 0;

// Configuration for the oscillating plane
const PLANE_CONFIG = {
    width: 1000,           // Same as your ground plane
    height: 1000,          // Same as your ground plane
    segments: 64,          // Number of segments for smooth waves
    yPosition: 9,          // 10 units above ground (ground is at y = -1)
    amplitude: 0.5,        // Wave height
    frequency: 0.02,       // Wave frequency
    speed: 1.0,            // Animation speed
    opacity: 0.7,          // Transparency
    color: 0x4499dd        // Ocean blue color
};

function createOscillatingPlane() {
    console.log('Creating oscillating plane...');
    
    // Create plane geometry with segments for vertex manipulation
    const geometry = new THREE.PlaneGeometry(
        PLANE_CONFIG.width, 
        PLANE_CONFIG.height, 
        PLANE_CONFIG.segments, 
        PLANE_CONFIG.segments
    );
    
    // Store original positions for wave calculation
    const positions = geometry.attributes.position.array;
    geometry.userData.originalPositions = positions.slice();
    
    // Create material with transparency
    const material = new THREE.MeshPhongMaterial({
        color: PLANE_CONFIG.color,
        transparent: true,
        opacity: PLANE_CONFIG.opacity,
        side: THREE.DoubleSide,
        shininess: 100,
        specular: 0x222222
    });
    
    // Create the mesh
    oscillatingPlane = new THREE.Mesh(geometry, material);
    
    // Position the plane (horizontal, 10 units above ground)
    oscillatingPlane.rotation.x = -Math.PI / 2; // Make it horizontal
    oscillatingPlane.position.y = PLANE_CONFIG.yPosition;
    
    // Add to scene
    scene.add(oscillatingPlane);
    
    console.log('Oscillating plane created and added to scene');
}

function updateOscillatingPlane(deltaTime) {
    if (!oscillatingPlane) return;
    
    // Update time
    oscillatingTime += deltaTime * PLANE_CONFIG.speed;
    
    const geometry = oscillatingPlane.geometry;
    const positions = geometry.attributes.position;
    const originalPositions = geometry.userData.originalPositions;
    
    // Update each vertex to create sine wave pattern
    for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;
        
        // Get original X and Z coordinates
        const originalX = originalPositions[i3];
        const originalZ = originalPositions[i3 + 2];
        
        // Calculate sine wave based on position and time
        const waveX = Math.sin(originalX * PLANE_CONFIG.frequency + oscillatingTime) * PLANE_CONFIG.amplitude;
        const waveZ = Math.cos(originalZ * PLANE_CONFIG.frequency + oscillatingTime * 0.7) * PLANE_CONFIG.amplitude * 0.5;
        
        // Apply wave displacement to Y coordinate (up/down movement)
        const waveHeight = waveX + waveZ;
        
        // Set new position (X and Z stay the same, only Y changes)
        positions.setX(i, originalX);
        positions.setY(i, originalPositions[i3 + 1] + waveHeight);
        positions.setZ(i, originalZ);
    }
    
    // Mark positions for update
    positions.needsUpdate = true;
    
    // Recalculate normals for proper lighting
    geometry.computeVertexNormals();
}

// Function to initialize the oscillating plane (call this after your scene is set up)
function initializeOscillatingPlane() {
    if (typeof scene !== 'undefined') {
        createOscillatingPlane();
    } else {
        console.error('Scene not available for oscillating plane');
    }
}

// Function to update plane settings
function setPlaneAmplitude(amplitude) {
    PLANE_CONFIG.amplitude = amplitude;
}

function setPlaneFrequency(frequency) {
    PLANE_CONFIG.frequency = frequency;
}

function setPlaneSpeed(speed) {
    PLANE_CONFIG.speed = speed;
}

function setPlaneOpacity(opacity) {
    if (oscillatingPlane) {
        oscillatingPlane.material.opacity = opacity;
        PLANE_CONFIG.opacity = opacity;
    }
}

// Auto-initialize when DOM is loaded (after your main script)
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the main scene to be set up
    setTimeout(() => {
        initializeOscillatingPlane();
    }, 1500);
});

// Export for global access
window.OscillatingPlane = {
    update: updateOscillatingPlane,
    setAmplitude: setPlaneAmplitude,
    setFrequency: setPlaneFrequency,
    setSpeed: setPlaneSpeed,
    setOpacity: setPlaneOpacity,
    initialize: initializeOscillatingPlane
};
