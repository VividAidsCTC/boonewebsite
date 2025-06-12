// Oscillating flattened sphere above the seafloor
let oscillatingSphere;
let oscillatingTime = 0;

// Configuration for the oscillating sphere
const SPHERE_CONFIG = {
    radius: 700,           // Large radius to cover the scene
    widthSegments: 128,    // More segments for smoother waves
    heightSegments: 64,    // Fewer height segments since it's flattened
    yPosition: 5,         // Position above ground (ground is at y = -1)
    flattenFactor: 0.1,    // How much to flatten (0.1 = very flat, 1.0 = normal sphere)
    amplitude: 3.0,        // Increased wave height for more visibility
    frequency: 0.01,       // Lower frequency for larger waves
    speed: 1.0,            // Animation speed
    opacity: 0.7,          // Slightly more opaque for better visibility
    color: 0x5599ee        // Brighter ocean blue color
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
    
    // Create material with transparency and better wave visibility
    const material = new THREE.MeshPhongMaterial({
        color: SPHERE_CONFIG.color,
        transparent: true,
        opacity: SPHERE_CONFIG.opacity,
        side: THREE.DoubleSide,
        shininess: 100,        // Increased shininess for more reflective waves
        specular: 0xffffff,    // White specular highlights (the "white waves")
        emissive: 0x001122,    // Slight blue glow
        wireframe: false       // Set to true for debugging wave structure
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

// White patch generation parameters
let whitePatchData = [];
const NUM_WHITE_PATCHES = 15; // Number of white streaky patches

function initializeWhitePatches() {
    console.log('Initializing white patch data...');
    whitePatchData = [];
    
    for (let i = 0; i < NUM_WHITE_PATCHES; i++) {
        whitePatchData.push({
            // Orbital parameters
            orbitRadius: 50 + Math.random() * 400,        // Distance from center
            orbitSpeed: 0.5 + Math.random() * 2.0,        // How fast it orbits
            orbitAngle: Math.random() * Math.PI * 2,      // Starting angle
            orbitHeight: Math.random() * 20 - 10,         // Y offset variation
            
            // Patch characteristics
            patchWidth: 30 + Math.random() * 80,          // Width of the streak
            patchLength: 80 + Math.random() * 200,        // Length of the streak
            intensity: 0.5 + Math.random() * 0.5,         // Brightness intensity
            
            // Movement variation
            wobbleSpeed: 0.3 + Math.random() * 0.7,       // Secondary movement
            wobbleAmount: 5 + Math.random() * 15,         // How much wobble
            
            // Streak direction
            streakAngle: Math.random() * Math.PI * 2      // Direction of the streak
        });
    }
}

function updateOscillatingSphere(deltaTime) {
    if (!oscillatingSphere) return;
    
    // Update time
    oscillatingTime += deltaTime * SPHERE_CONFIG.speed * 3;
    
    const geometry = oscillatingSphere.geometry;
    const positions = geometry.attributes.position;
    const originalPositions = geometry.userData.originalPositions;
    
    // Initialize white patches if not done yet
    if (whitePatchData.length === 0) {
        initializeWhitePatches();
    }
    
    // Create color attribute if it doesn't exist
    if (!geometry.attributes.color) {
        const colors = new Float32Array(positions.count * 3);
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    
    const colors = geometry.attributes.color;
    
    // Update each vertex
    for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;
        
        // Get original coordinates
        const originalX = originalPositions[i3];
        const originalY = originalPositions[i3 + 1];
        const originalZ = originalPositions[i3 + 2];
        
        // Reset color to base ocean color
        let finalRed = 0.3;   // Base ocean color
        let finalGreen = 0.6;
        let finalBlue = 0.9;
        
        // Check if this vertex should be affected by any white patches
        for (let p = 0; p < whitePatchData.length; p++) {
            const patch = whitePatchData[p];
            
            // Update patch orbit position
            const currentAngle = patch.orbitAngle + oscillatingTime * patch.orbitSpeed;
            const wobble = Math.sin(oscillatingTime * patch.wobbleSpeed) * patch.wobbleAmount;
            
            // Calculate patch center position
            const patchCenterX = Math.cos(currentAngle) * (patch.orbitRadius + wobble);
            const patchCenterZ = Math.sin(currentAngle) * (patch.orbitRadius + wobble);
            const patchCenterY = patch.orbitHeight + Math.sin(oscillatingTime * patch.wobbleSpeed * 0.7) * 5;
            
            // Calculate distance from vertex to patch center
            const dx = originalX - patchCenterX;
            const dy = originalY - patchCenterY;
            const dz = originalZ - patchCenterZ;
            
            // Create streak effect by using different distances for width vs length
            const streakDx = dx * Math.cos(patch.streakAngle) + dz * Math.sin(patch.streakAngle);
            const streakDz = -dx * Math.sin(patch.streakAngle) + dz * Math.cos(patch.streakAngle);
            
            // Calculate elliptical distance for streak shape
            const normalizedWidth = (streakDz * streakDz) / (patch.patchWidth * patch.patchWidth);
            const normalizedLength = (streakDx * streakDx) / (patch.patchLength * patch.patchLength);
            const normalizedHeight = (dy * dy) / (20 * 20); // Height tolerance
            
            const ellipticalDistance = normalizedWidth + normalizedLength + normalizedHeight;
            
            // If vertex is within the streak patch
            if (ellipticalDistance < 1.0) {
                // Calculate intensity based on distance from center
                const intensity = (1.0 - ellipticalDistance) * patch.intensity;
                
                // Add some noise/variation to the patch
                const noiseX = Math.sin(originalX * 0.02 + oscillatingTime * 2) * 0.3;
                const noiseZ = Math.cos(originalZ * 0.02 + oscillatingTime * 1.5) * 0.3;
                const finalIntensity = intensity * (0.7 + noiseX + noiseZ);
                
                // Blend white color based on intensity
                if (finalIntensity > 0) {
                    finalRed = Math.min(1.0, finalRed + finalIntensity * 0.8);
                    finalGreen = Math.min(1.0, finalGreen + finalIntensity * 0.9);
                    finalBlue = Math.min(1.0, finalBlue + finalIntensity * 1.0);
                }
            }
        }
        
        // Apply the color to the vertex
        colors.setXYZ(i, finalRed, finalGreen, finalBlue);
        
        // Apply small wave displacement (much subtler now)
        const waveIntensity = Math.max(0, 1 - Math.abs(originalY) / (SPHERE_CONFIG.radius * SPHERE_CONFIG.flattenFactor * 2));
        const smallWave = Math.sin(originalX * 0.01 + oscillatingTime) * 0.5 + 
                         Math.cos(originalZ * 0.01 + oscillatingTime * 0.8) * 0.3;
        
        positions.setX(i, originalX);
        positions.setY(i, originalY + smallWave * waveIntensity * SPHERE_CONFIG.amplitude * 0.2);
        positions.setZ(i, originalZ);
    }
    
    // Mark for updates
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    
    // Recalculate normals
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
