// Oscillating flattened sphere above the seafloor
let oscillatingSphere;
let oscillatingTime = 0;

// Configuration for the oscillating sphere
const SPHERE_CONFIG = {
    radius: 100,           // Large radius to cover the scene
    widthSegments: 128,    // More segments for smoother waves
    heightSegments: 64,    // Fewer height segments since it's flattened
    yPosition: 70,         // Position above ground (ground is at y = -1)
    flattenFactor: 0.1,    // How much to flatten (0.1 = very flat, 1.0 = normal sphere)
    amplitude: 2.0,        // Wave height for visibility
    frequency: 0.01,       // Lower frequency for larger waves
    speed: 1.0,            // Animation speed
    opacity: 0.6,          // Transparency
    color: 0x4499dd        // Ocean blue color
};

function createOscillatingSphere() {
    console.log('Creating oscillating flattened sphere...');
    
    // Create sphere geometry with segments for vertex manipulation
    const geometry = new THREE.SphereGeometry(
        SPHERE_CONFIG.radius,
        SPHERE_CONFIG.widthSegments,
        SPHERE_CONFIG.heightSegments
    );
    
    // Store original positions and flatten the sphere
    const positions = geometry.attributes.position.array;
    const originalPositions = positions.slice();
    
    // Flatten the sphere by reducing Y coordinates
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        
        // Flatten by reducing Y coordinate
        positions[i + 1] = y * SPHERE_CONFIG.flattenFactor;
    }
    
    // Update the geometry
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    
    // Store flattened positions as original for wave calculations
    geometry.userData.originalPositions = positions.slice();
    
    // Create material with transparency
    const material = new THREE.MeshPhongMaterial({
        color: SPHERE_CONFIG.color,
        transparent: true,
        opacity: SPHERE_CONFIG.opacity,
        side: THREE.DoubleSide,
        shininess: 50,
        specular: 0x888888
    });
    
    // Create the mesh
    oscillatingSphere = new THREE.Mesh(geometry, material);
    
    // Position the sphere
    oscillatingSphere.position.y = SPHERE_CONFIG.yPosition;
    
    // Add to scene
    scene.add(oscillatingSphere);
    
    console.log('Oscillating flattened sphere created and added to scene at Y:', SPHERE_CONFIG.yPosition);
    console.log('Sphere has', positions.length / 3, 'vertices');
}

function updateOscillatingSphere(deltaTime) {
    if (!oscillatingSphere) return;
    
    // Update time with more dramatic speed
    oscillatingTime += deltaTime * SPHERE_CONFIG.speed * 5;
    
    const geometry = oscillatingSphere.geometry;
    const positions = geometry.attributes.position;
    const originalPositions = geometry.userData.originalPositions;
    
    // Update each vertex to create wave pattern
    for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;
        
        // Get original coordinates
        const originalX = originalPositions[i3];
        const originalY = originalPositions[i3 + 1];
        const originalZ = originalPositions[i3 + 2];
        
        // Calculate distance from center for radial waves
        const distanceFromCenter = Math.sqrt(originalX * originalX + originalZ * originalZ);
        
        // Calculate multiple wave patterns
        const wave1 = Math.sin(distanceFromCenter * SPHERE_CONFIG.frequency + oscillatingTime) * SPHERE_CONFIG.amplitude;
        const wave2 = Math.cos(originalX * SPHERE_CONFIG.frequency * 0.7 + oscillatingTime * 1.3) * SPHERE_CONFIG.amplitude * 0.6;
        const wave3 = Math.sin(originalZ * SPHERE_CONFIG.frequency * 0.5 + oscillatingTime * 0.8) * SPHERE_CONFIG.amplitude * 0.4;
        const wave4 = Math.cos((originalX + originalZ) * SPHERE_CONFIG.frequency * 0.3 + oscillatingTime * 1.1) * SPHERE_CONFIG.amplitude * 0.3;
        
        // Combine waves for more interesting motion
        const totalWave = wave1 + wave2 + wave3 + wave4;
        
        // Only apply waves to vertices that are close to the flattened surface (low Y values)
        const waveIntensity = Math.max(0, 1 - Math.abs(originalY) / (SPHERE_CONFIG.radius * SPHERE_CONFIG.flattenFactor * 2));
        
        // Set new position - apply wave displacement primarily in Y direction
        positions.setX(i, originalX);
        positions.setY(i, originalY + totalWave * waveIntensity);
        positions.setZ(i, originalZ);
    }
    
    // Mark positions for update
    positions.needsUpdate = true;
    
    // Recalculate normals for proper lighting
    geometry.computeVertexNormals();
}

// Function to initialize the oscillating sphere (call this after your scene is set up)
function initializeOscillatingSphere() {
    if (typeof scene !== 'undefined') {
        createOscillatingSphere();
    } else {
        console.error('Scene not available for oscillating sphere');
    }
}

// Function to update sphere settings
function setSphereAmplitude(amplitude) {
    SPHERE_CONFIG.amplitude = amplitude;
}

function setSphereFrequency(frequency) {
    SPHERE_CONFIG.frequency = frequency;
}

function setSphereSpeed(speed) {
    SPHERE_CONFIG.speed = speed;
}

function setSphereOpacity(opacity) {
    if (oscillatingSphere) {
        oscillatingSphere.material.opacity = opacity;
        SPHERE_CONFIG.opacity = opacity;
    }
}

function setSphereFlattenFactor(factor) {
    SPHERE_CONFIG.flattenFactor = Math.max(0.01, Math.min(1.0, factor));
    // You would need to recreate the sphere to apply this change
    if (oscillatingSphere) {
        scene.remove(oscillatingSphere);
        createOscillatingSphere();
    }
}

function setSphereRadius(radius) {
    SPHERE_CONFIG.radius = radius;
    // You would need to recreate the sphere to apply this change
    if (oscillatingSphere) {
        scene.remove(oscillatingSphere);
        createOscillatingSphere();
    }
}

// Auto-initialize when DOM is loaded (after your main script)
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the main scene to be set up
    setTimeout(() => {
        initializeOscillatingSphere();
    }, 1500);
});

// Export for global access (keeping the same name for compatibility)
window.OscillatingPlane = {
    update: updateOscillatingSphere,
    setAmplitude: setSphereAmplitude,
    setFrequency: setSphereFrequency,
    setSpeed: setSphereSpeed,
    setOpacity: setSphereOpacity,
    setFlattenFactor: setSphereFlattenFactor,
    setRadius: setSphereRadius,
    initialize: initializeOscillatingSphere
};
