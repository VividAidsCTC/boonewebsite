/**
 * OCEAN CURRENT PARTICLES SYSTEM
 * 
 * This file adds floating particles to show ocean current flow. 
 * Includes plankton, sediment, debris, and organic matter.
 * 
 * REQUIREMENTS:
 * - kelptest.js must be loaded first (creates the 'scene' global variable)
 * - Three.js must be loaded
 * - This file should be loaded after kelptest.js
 */

console.log('🌊 Ocean Particles System Loading...');

// Particle System Configuration
const PARTICLE_CONFIG = {
    // Particle counts for different types
    counts: {
        plankton: 600,      // Small floating organisms
        sediment: 450,      // Tiny dirt/sand particles
        debris: 150,         // Small organic debris
        bubbles: 90         // Air bubbles rising up
    },
    
    // Current flow settings
    current: {
        direction: { x: 1, y: 0.1, z: 0.3 },  // Flow direction vector
        strength: 0.5,                         // Overall current strength
        turbulence: 0.3,                       // Random turbulence amount
        verticalDrift: 0.1                     // Vertical movement component
    },
    
    // Visual settings
    opacity: 0.6,
    fadeDistance: 300,      // Distance at which particles fade out
    spawnArea: {            // Area where particles spawn
        width: 400,
        height: 200,
        depth: 400
    },
    
    enabled: true
};

// Particle system objects
let particleSystems = {};
let particleCurrentDirection = new THREE.Vector3(1, 0.1, 0.3); // RENAMED from currentDirection
let animationTime = 0;

/**
 * PARTICLE TYPE DEFINITIONS
 */
const PARTICLE_TYPES = {
    plankton: {
        size: { min: 0.5, max: 2.0 },
        color: 0x88ccaa,
        opacity: 0.4,
        speed: { min: 0.3, max: 0.8 },
        drift: { min: 0.1, max: 0.3 },
        lifespan: 60000,  // milliseconds
        texture: 'dot'
    },
    
    sediment: {
        size: { min: 0.2, max: 1.0 },
        color: 0x8b7355,
        opacity: 0.3,
        speed: { min: 0.2, max: 0.5 },
        drift: { min: 0.05, max: 0.2 },
        lifespan: 90000,
        texture: 'dot'
    },
    
    debris: {
        size: { min: 1.0, max: 3.0 },
        color: 0x654321,
        opacity: 0.5,
        speed: { min: 0.4, max: 0.9 },
        drift: { min: 0.2, max: 0.4 },
        lifespan: 120000,
        texture: 'square'
    },
    
    bubbles: {
        size: { min: 1.0, max: 4.0 },
        color: 0xffffff,
        opacity: 0.2,
        speed: { min: 0.1, max: 0.3 },
        drift: { min: -0.5, max: -0.1 }, // Negative = upward
        lifespan: 30000,
        texture: 'circle'
    }
};

/**
 * INITIALIZE PARTICLE SYSTEM
 */
function initializeParticleSystem() {
    console.log('🌊 Initializing ocean current particles...');
    
    // Check if scene exists
    if (typeof scene === 'undefined') {
        console.error('❌ Scene not found! Make sure kelptest.js loaded first.');
        return false;
    }
    
    // Create particle systems for each type
    Object.keys(PARTICLE_TYPES).forEach(type => {
        if (PARTICLE_CONFIG.counts[type] > 0) {
            createParticleSystem(type);
        }
    });
    
    console.log('✅ Ocean particle system initialized');
    updateDebugDisplay('🌊 Ocean current particles active');
    
    return true;
}

/**
 * CREATE PARTICLE SYSTEM FOR SPECIFIC TYPE
 */
function createParticleSystem(type) {
    const config = PARTICLE_TYPES[type];
    const count = PARTICLE_CONFIG.counts[type];
    
    // Create geometry and positions
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const lifetimes = new Float32Array(count);
    const spawntimes = new Float32Array(count);
    
    // Initialize particles
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        
        // Random position within spawn area
        positions[i3] = (Math.random() - 0.5) * PARTICLE_CONFIG.spawnArea.width;
        positions[i3 + 1] = (Math.random() - 0.5) * PARTICLE_CONFIG.spawnArea.height;
        positions[i3 + 2] = (Math.random() - 0.5) * PARTICLE_CONFIG.spawnArea.depth;
        
        // Random velocity based on current + some randomness
        velocities[i3] = PARTICLE_CONFIG.current.direction.x * randomRange(config.speed.min, config.speed.max);
        velocities[i3 + 1] = PARTICLE_CONFIG.current.direction.y * randomRange(config.speed.min, config.speed.max) + randomRange(config.drift.min, config.drift.max);
        velocities[i3 + 2] = PARTICLE_CONFIG.current.direction.z * randomRange(config.speed.min, config.speed.max);
        
        // Random size
        sizes[i] = randomRange(config.size.min, config.size.max);
        
        // Lifetime tracking
        lifetimes[i] = config.lifespan;
        spawntimes[i] = Math.random() * config.lifespan; // Stagger spawning
    }
    
    // Set geometry attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    geometry.setAttribute('spawntime', new THREE.BufferAttribute(spawntimes, 1));
    
    // Create material
    const material = new THREE.PointsMaterial({
        color: config.color,
        size: 2.0,
        opacity: config.opacity * PARTICLE_CONFIG.opacity,
        transparent: true,
        fog: true,
        vertexColors: false,
        sizeAttenuation: true
    });
    
    // Create particle system
    const particles = new THREE.Points(geometry, material);
    particles.name = `particles_${type}`;
    
    // Store system
    particleSystems[type] = {
        mesh: particles,
        config: config,
        count: count,
        time: 0
    };
    
    // Add to scene
    scene.add(particles);
    
    console.log(`🌊 Created ${count} ${type} particles`);
}

/**
 * UPDATE PARTICLES (call this in animation loop)
 */
function updateParticles(deltaTime) {
    if (!PARTICLE_CONFIG.enabled) return;
    
    animationTime += deltaTime;
    
    Object.keys(particleSystems).forEach(type => {
        updateParticleType(type, deltaTime);
    });
}

/**
 * UPDATE SPECIFIC PARTICLE TYPE
 */
function updateParticleType(type, deltaTime) {
    const system = particleSystems[type];
    if (!system) return;
    
    const positions = system.mesh.geometry.attributes.position.array;
    const velocities = system.mesh.geometry.attributes.velocity.array;
    const sizes = system.mesh.geometry.attributes.size.array;
    const lifetimes = system.mesh.geometry.attributes.lifetime.array;
    const spawntimes = system.mesh.geometry.attributes.spawntime.array;
    
    const count = system.count;
    const config = system.config;
    
    // Update each particle
    for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        
        // Check if particle should be active
        const age = (animationTime - spawntimes[i]) % config.lifespan;
        if (age < 0) continue; // Not spawned yet
        
        // Current + turbulence
        const turbulenceX = Math.sin(animationTime * 0.001 + i * 0.1) * PARTICLE_CONFIG.current.turbulence;
        const turbulenceY = Math.cos(animationTime * 0.0015 + i * 0.15) * PARTICLE_CONFIG.current.turbulence;
        const turbulenceZ = Math.sin(animationTime * 0.0012 + i * 0.12) * PARTICLE_CONFIG.current.turbulence;
        
        // Update velocity with current and turbulence
        const flowStrength = PARTICLE_CONFIG.current.strength;
        velocities[i3] = particleCurrentDirection.x * flowStrength + turbulenceX;
        velocities[i3 + 1] = particleCurrentDirection.y * flowStrength + turbulenceY + config.drift.min;
        velocities[i3 + 2] = particleCurrentDirection.z * flowStrength + turbulenceZ;
        
        // Update position
        positions[i3] += velocities[i3] * deltaTime;
        positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
        positions[i3 + 2] += velocities[i3 + 2] * deltaTime;
        
        // Wrap particles that go too far
        const bounds = PARTICLE_CONFIG.spawnArea;
        if (positions[i3] > bounds.width / 2) positions[i3] = -bounds.width / 2;
        if (positions[i3] < -bounds.width / 2) positions[i3] = bounds.width / 2;
        if (positions[i3 + 1] > bounds.height / 2) positions[i3 + 1] = -bounds.height / 2;
        if (positions[i3 + 1] < -bounds.height / 2) positions[i3 + 1] = bounds.height / 2;
        if (positions[i3 + 2] > bounds.depth / 2) positions[i3 + 2] = -bounds.depth / 2;
        if (positions[i3 + 2] < -bounds.depth / 2) positions[i3 + 2] = bounds.depth / 2;
    }
    
    // Mark attributes for update
    system.mesh.geometry.attributes.position.needsUpdate = true;
    system.mesh.geometry.attributes.velocity.needsUpdate = true;
}

/**
 * SET CURRENT DIRECTION
 */
function setCurrentDirection(x, y, z) {
    particleCurrentDirection.set(x, y, z);
    particleCurrentDirection.normalize();
    
    console.log(`🌊 Current direction set to: ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`);
    updateDebugDisplay(`🌊 Current: ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`);
}

/**
 * SET CURRENT STRENGTH
 */
function setCurrentStrength(strength) {
    PARTICLE_CONFIG.current.strength = Math.max(0, Math.min(3, strength));
    
    console.log(`🌊 Current strength: ${PARTICLE_CONFIG.current.strength}`);
    updateDebugDisplay(`🌊 Flow strength: ${PARTICLE_CONFIG.current.strength.toFixed(1)}`);
}

/**
 * TOGGLE PARTICLES ON/OFF
 */
function toggleParticles() {
    PARTICLE_CONFIG.enabled = !PARTICLE_CONFIG.enabled;
    
    Object.keys(particleSystems).forEach(type => {
        particleSystems[type].mesh.visible = PARTICLE_CONFIG.enabled;
    });
    
    console.log(`🌊 Particles ${PARTICLE_CONFIG.enabled ? 'enabled' : 'disabled'}`);
    updateDebugDisplay(`🌊 Particles ${PARTICLE_CONFIG.enabled ? 'ON' : 'OFF'}`);
    
    return PARTICLE_CONFIG.enabled;
}

/**
 * ADJUST PARTICLE DENSITY
 */
function setParticleDensity(multiplier) {
    console.log(`🌊 Particle density adjustment: ${multiplier}x (requires restart)`);
    updateDebugDisplay(`🌊 Density: ${multiplier}x (restart needed)`);
    
    // Note: Would need to recreate particle systems to actually change density
    // For now, just log the request
}

/**
 * UTILITY FUNCTIONS
 */
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

function updateDebugDisplay(message) {
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        debugDiv.innerHTML += message + '<br>';
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
}

/**
 * AUTO-INITIALIZATION
 */
function tryAutoInitialization() {
    if (typeof scene !== 'undefined' && scene) {
        console.log('🌊 Scene detected, initializing particle system...');
        initializeParticleSystem();
    } else {
        console.log('⏳ Waiting for scene to be ready...');
        setTimeout(tryAutoInitialization, 1000);
    }
}

// Start trying to initialize after a short delay
setTimeout(tryAutoInitialization, 2000);

/**
 * GLOBAL API
 */
window.OceanParticles = {
    // Core functions
    init: initializeParticleSystem,
    update: updateParticles,
    toggle: toggleParticles,
    
    // Current control
    setDirection: setCurrentDirection,
    setStrength: setCurrentStrength,
    setDensity: setParticleDensity,
    
    // Presets
    calmCurrent: () => {
        setCurrentDirection(0.5, 0.1, 0.2);
        setCurrentStrength(0.3);
    },
    
    strongCurrent: () => {
        setCurrentDirection(1, 0.2, 0.3);
        setCurrentStrength(1.2);
    },
    
    verticalCurrent: () => {
        setCurrentDirection(0.2, 1, 0.1);
        setCurrentStrength(0.8);
    },
    
    // Information
    getStatus: () => ({
        enabled: PARTICLE_CONFIG.enabled,
        direction: particleCurrentDirection,
        strength: PARTICLE_CONFIG.current.strength,
        types: Object.keys(particleSystems),
        totalParticles: Object.values(PARTICLE_CONFIG.counts).reduce((a, b) => a + b, 0)
    })
};

console.log('🌊 Ocean Particles System Ready');
console.log('💡 Usage: OceanParticles.update(deltaTime) in your animation loop');
console.log('💡 Try: OceanParticles.strongCurrent(), OceanParticles.calmCurrent()');
console.log('💡 Control: OceanParticles.setDirection(x, y, z), OceanParticles.setStrength(0-3)');
