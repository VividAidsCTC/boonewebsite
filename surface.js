// Oscillating flattened sphere above the seafloor
let oscillatingSphere;
let oscillatingTime = 0;

// Configuration for the oscillating sphere
const SPHERE_CONFIG = {
    radius: 500,           // Large radius to cover the scene
    widthSegments: 128,    // More segments for smoother waves
    heightSegments: 64,    // Fewer height segments since it's flattened
    yPosition: 70,         // Position above ground (ground is at y = -1)
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

// Wave generation parameters - randomized for each vertex
let waveData = [];

function initializeWaveData(vertexCount) {
    console.log('Initializing wave data for', vertexCount, 'vertices');
    waveData = [];
    
    for (let i = 0; i < vertexCount; i++) {
        // Create 10 different wave types per vertex with random parameters
        const waves = [];
        for (let w = 0; w < 10; w++) {
            waves.push({
                // Wave type parameters
                frequency: 0.002 + Math.random() * 0.008,  // Random frequency
                amplitude: 0.5 + Math.random() * 2.0,      // Random amplitude
                speed: 0.5 + Math.random() * 2.0,          // Random speed
                phase: Math.random() * Math.PI * 2,        // Random phase offset
                noiseScale: 0.001 + Math.random() * 0.005, // Noise scale
                waveType: Math.floor(Math.random() * 5),   // 5 different wave patterns
                direction: Math.random() * Math.PI * 2,    // Random direction
                persistence: 0.3 + Math.random() * 0.7     // Wave persistence
            });
        }
        waveData.push({
            waves: waves,
            baseNoise: Math.random() * 100,  // Base noise offset
            intensity: 0.7 + Math.random() * 0.6  // Overall intensity multiplier
        });
    }
}

// Noise function (simple pseudo-random)
function noise(x, y, z, scale) {
    const n = Math.sin(x * scale + y * scale * 1.3 + z * scale * 0.7) * 
              Math.cos(y * scale * 1.7 + z * scale * 0.3) *
              Math.sin(z * scale * 2.1 + x * scale * 0.9);
    return n * 0.5 + 0.5; // Normalize to 0-1
}

function updateOscillatingSphere(deltaTime) {
    if (!oscillatingSphere) return;
    
    // Update time with more dramatic speed
    oscillatingTime += deltaTime * SPHERE_CONFIG.speed * 5;
    
    const geometry = oscillatingSphere.geometry;
    const positions = geometry.attributes.position;
    const originalPositions = geometry.userData.originalPositions;
    
    // Initialize wave data if not done yet
    if (waveData.length === 0) {
        initializeWaveData(positions.count);
    }
    
    // Update each vertex to create complex wave patterns
    for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;
        
        // Get original coordinates
        const originalX = originalPositions[i3];
        const originalY = originalPositions[i3 + 1];
        const originalZ = originalPositions[i3 + 2];
        
        // Get wave data for this vertex
        const vertexWaves = waveData[i];
        let totalWave = 0;
        
        // Calculate 10 different wave types
        for (let w = 0; w < vertexWaves.waves.length; w++) {
            const wave = vertexWaves.waves[w];
            let waveValue = 0;
            
            // Different wave patterns based on type
            switch (wave.waveType) {
                case 0: // Radial waves
                    const distanceFromCenter = Math.sqrt(originalX * originalX + originalZ * originalZ);
                    waveValue = Math.sin(distanceFromCenter * wave.frequency + oscillatingTime * wave.speed + wave.phase);
                    break;
                    
                case 1: // Directional waves
                    const dirX = Math.cos(wave.direction);
                    const dirZ = Math.sin(wave.direction);
                    const projection = originalX * dirX + originalZ * dirZ;
                    waveValue = Math.cos(projection * wave.frequency + oscillatingTime * wave.speed + wave.phase);
                    break;
                    
                case 2: // Spiral waves
                    const angle = Math.atan2(originalZ, originalX);
                    const radius = Math.sqrt(originalX * originalX + originalZ * originalZ);
                    waveValue = Math.sin(angle * 3 + radius * wave.frequency + oscillatingTime * wave.speed + wave.phase);
                    break;
                    
                case 3: // Cross waves (interference pattern)
                    const wave3a = Math.sin(originalX * wave.frequency + oscillatingTime * wave.speed + wave.phase);
                    const wave3b = Math.cos(originalZ * wave.frequency * 1.3 + oscillatingTime * wave.speed * 0.8 + wave.phase);
                    waveValue = wave3a * wave3b;
                    break;
                    
                case 4: // Circular ripples with multiple centers
                    const centerX = Math.sin(oscillatingTime * 0.1 + wave.phase) * 100;
                    const centerZ = Math.cos(oscillatingTime * 0.15 + wave.phase) * 100;
                    const distFromMovingCenter = Math.sqrt((originalX - centerX) * (originalX - centerX) + (originalZ - centerZ) * (originalZ - centerZ));
                    waveValue = Math.sin(distFromMovingCenter * wave.frequency + oscillatingTime * wave.speed + wave.phase);
                    break;
            }
            
            // Add noise to the wave
            const noiseValue = noise(originalX, originalZ, oscillatingTime * wave.speed, wave.noiseScale);
            waveValue = waveValue * (0.7 + noiseValue * 0.6);
            
            // Apply amplitude and persistence
            totalWave += waveValue * wave.amplitude * wave.persistence;
        }
        
        // Add global noise layer
        const globalNoise = noise(originalX, originalZ, oscillatingTime * 0.5, 0.003) - 0.5;
        totalWave += globalNoise * SPHERE_CONFIG.amplitude * 0.5;
        
        // Apply vertex-specific intensity
        totalWave *= vertexWaves.intensity;
        
        // Only apply waves to vertices that are close to the flattened surface
        const waveIntensity = Math.max(0, 1 - Math.abs(originalY) / (SPHERE_CONFIG.radius * SPHERE_CONFIG.flattenFactor * 2));
        
        // Add some turbulence based on position
        const turbulence = Math.sin(originalX * 0.01 + oscillatingTime * 2) * 
                          Math.cos(originalZ * 0.01 + oscillatingTime * 1.5) * 
                          SPHERE_CONFIG.amplitude * 0.3;
        
        // Combine all wave effects
        const finalWave = (totalWave + turbulence) * waveIntensity * SPHERE_CONFIG.amplitude * 0.5;
        
        // Set new position - apply wave displacement primarily in Y direction
        positions.setX(i, originalX);
        positions.setY(i, originalY + finalWave);
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
