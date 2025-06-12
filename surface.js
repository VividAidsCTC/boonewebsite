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

    // Advance global time
    oscillatingTime += deltaTime * SPHERE_CONFIG.speed;

    const geometry = oscillatingSphere.geometry;
    const positions = geometry.attributes.position;
    const originalPositions = geometry.userData.originalPositions;

    // Init white patches if not done
    if (whitePatchData.length === 0) {
        initializeWhitePatches();
    }

    // Create color buffer if needed
    if (!geometry.attributes.color) {
        const colors = new Float32Array(positions.count * 3);
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    const colors = geometry.attributes.color;

    // Update each vertex
    for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;

        const originalX = originalPositions[i3];
        const originalY = originalPositions[i3 + 1];
        const originalZ = originalPositions[i3 + 2];

        // Reset to base water color
        let r = 0.3;
        let g = 0.6;
        let b = 0.9;

        for (let p = 0; p < whitePatchData.length; p++) {
            const patch = whitePatchData[p];

            const angle = patch.orbitAngle + oscillatingTime * patch.orbitSpeed;
            const wobble = Math.sin(oscillatingTime * patch.wobbleSpeed) * patch.wobbleAmount;

            const centerX = Math.cos(angle) * (patch.orbitRadius + wobble);
            const centerZ = Math.sin(angle) * (patch.orbitRadius + wobble);
            const centerY = patch.orbitHeight + Math.sin(oscillatingTime * patch.wobbleSpeed * 0.7) * 3;

            const dx = originalX - centerX;
            const dy = originalY - centerY;
            const dz = originalZ - centerZ;

            // Elliptical falloff
            const rotatedX = dx * Math.cos(patch.streakAngle) + dz * Math.sin(patch.streakAngle);
            const rotatedZ = -dx * Math.sin(patch.streakAngle) + dz * Math.cos(patch.streakAngle);

            const dWidth = (rotatedZ ** 2) / (patch.patchWidth ** 2);
            const dLength = (rotatedX ** 2) / (patch.patchLength ** 2);
            const dHeight = (dy ** 2) / (25 ** 2);

            const influence = dWidth + dLength + dHeight;

            if (influence < 1.0) {
                const intensity = (1.0 - influence) * patch.intensity;
                const flicker = 0.8 + 0.2 * Math.sin(originalX * 0.05 + oscillatingTime * 3);
                const glow = intensity * flicker;

                r = Math.min(1.0, r + glow * 0.8);
                g = Math.min(1.0, g + glow * 0.9);
                b = Math.min(1.0, b + glow * 1.0);
            }
        }

        colors.setXYZ(i, r, g, b);

        // Small wave motion
        const waveFactor = Math.max(0, 1 - Math.abs(originalY) / (SPHERE_CONFIG.radius * SPHERE_CONFIG.flattenFactor));
        const waveY = Math.sin(originalX * 0.01 + oscillatingTime) * 0.5 + Math.cos(originalZ * 0.01 + oscillatingTime * 0.8) * 0.3;

        positions.setX(i, originalX);
        positions.setY(i, originalY + waveY * waveFactor * SPHERE_CONFIG.amplitude * 0.2);
        positions.setZ(i, originalZ);
    }

    positions.needsUpdate = true;
    colors.needsUpdate = true;
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
