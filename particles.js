console.log('🌊 Enhanced Multi-Type Particle System with Kelp Avoidance Loaded');

// Particle configuration
const PARTICLE_CONFIG = {
  debris: {
    count: 3000,
    radius: 0.1,
    color: 0xffffff,
    opacity: 0.2,
    avoidRadius: 5.0
  },
  bubbles: {
    count: 150,
    radius: 0.4,
    color: 0x87ceeb,
    opacity: 0.3,
    avoidRadius: 3.0
  },
  plankton: {
    count: 400,
    radius: 0.1,
    color: 0x90ee90,
    opacity: 0.6,
    avoidRadius: 2.0
  },
  sediment: {
    count: 500,
    radius: 0.10,
    color: 0xd2691e,
    opacity: 0.4,
    avoidRadius: 1.5
  }
};

let particleGroups = {
  debris: [],
  bubbles: [],
  plankton: [],
  sediment: []
};

// Initialize particles by type
function initializeParticleType(type, config) {
  if (typeof scene === 'undefined') {
    console.error('❌ Scene not found. Load kelptest.js first.');
    return;
  }

  const particles = [];
  
  for (let i = 0; i < config.count; i++) {
    const geometry = new THREE.SphereGeometry(config.radius, 4, 3);
    const material = new THREE.MeshBasicMaterial({ 
      color: config.color, 
      opacity: config.opacity, 
      transparent: true 
    });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position particles based on type
    const startPos = getInitialPosition(type);
    mesh.position.copy(startPos);
    
    // Type-specific userData
    mesh.userData = {
      type: type,
      origin: startPos.clone(),
      offset: Math.random() * Math.PI * 2,
      verticalWiggle: 0.5 + Math.random(),
      lateralWiggle: 0.5 + Math.random(),
      speed: 0.5 + Math.random() * 0.5,
      lifeTime: 0,
      maxLifeTime: 10 + Math.random() * 20,
      ...getTypeSpecificData(type)
    };
    
    scene.add(mesh);
    particles.push(mesh);
  }
  
  return particles;
}

// Get initial position based on particle type
function getInitialPosition(type) {
  const base = new THREE.Vector3(
    (Math.random() - 0.5) * 400,
    Math.random() * 10 + 1,
    (Math.random() - 0.5) * 400
  );
  
  switch(type) {
    case 'bubbles':
      base.y = Math.random() * 2; // Start near ocean floor
      break;
    case 'sediment':
      base.y = Math.random() * 3; // Lower in water column
      break;
    case 'plankton':
      base.y = Math.random() * 6 + 2; // Mid-water
      break;
    default: // debris
      base.y = Math.random() * 8 + 1; // Throughout water column
  }
  
  return base;
}

// Get type-specific data
function getTypeSpecificData(type) {
  switch(type) {
    case 'bubbles':
      return {
        buoyancy: 8.0 + Math.random() * 1.5,
        wobble: Math.random() * 0.3,
        expansionRate: 1 + Math.random() * 0.02
      };
    case 'plankton':
      return {
        schooling: Math.random() > 0.7,
        darting: Math.random() * 0.5,
        glowPulse: Math.random() * Math.PI * 2
      };
    case 'sediment':
      return {
        sinking: 0.1 + Math.random() * 0.2,
        density: Math.random()
      };
    default:
      return {};
  }
}

// Helper: Find nearest kelp and return avoidance vector
function getAvoidanceVector(position, avoidRadius) {
  if (typeof kelp === 'undefined' || kelp.length === 0) return new THREE.Vector3();
  
  let closest = null;
  let closestDist = Infinity;
  
  kelp.forEach(k => {
    const dist = k.position.distanceTo(position);
    if (dist < closestDist) {
      closestDist = dist;
      closest = k;
    }
  });
  
  if (closest && closestDist < avoidRadius) {
    const away = position.clone().sub(closest.position).normalize();
    return away.multiplyScalar((avoidRadius - closestDist) / avoidRadius);
  }
  
  return new THREE.Vector3();
}

// Update debris particles (original behavior)
function updateDebrisParticles(particles, deltaTime) {
  const dirRad = THREE.MathUtils.degToRad(currentDirection);
  const baseDir = new THREE.Vector3(Math.cos(dirRad), 0, Math.sin(dirRad));
  
  particles.forEach(p => {
    const t = performance.now() / 1000 + p.userData.offset;
    
    // Base current movement
    const move = baseDir.clone().multiplyScalar(waveSpeed * deltaTime * 20);
    
    // Vertical wiggle
    const vertical = Math.sin(t * 2) * p.userData.verticalWiggle * 0.1;
    
    // Lateral wiggle
    const lateral = new THREE.Vector3(-baseDir.z, 0, baseDir.x)
      .multiplyScalar(Math.sin(t * 1.5) * p.userData.lateralWiggle * 0.1);
    
    // Kelp avoidance
    const avoid = getAvoidanceVector(p.position, PARTICLE_CONFIG.debris.avoidRadius);
    
    // Apply motion
    p.position.add(move).add(lateral).add(avoid);
    p.position.y += vertical;
    
    // Reset if too far away
    if (p.position.distanceTo(p.userData.origin) > 100) {
      p.position.copy(p.userData.origin);
    }
  });
}

// Update bubble particles
function updateBubbleParticles(particles, deltaTime) {
  particles.forEach(p => {
    const t = performance.now() / 1000 + p.userData.offset;
    const data = p.userData;
    
    // Upward buoyancy
    p.position.y += data.buoyancy * deltaTime;
    
    // Wobble side to side
    const wobbleX = Math.sin(t * 3) * data.wobble * deltaTime;
    const wobbleZ = Math.cos(t * 2.5) * data.wobble * deltaTime;
    p.position.x += wobbleX;
    p.position.z += wobbleZ;
    
    // Slight expansion as they rise
    const scale = 1 + (p.position.y - data.origin.y) * 0.001;
    p.scale.setScalar(Math.min(scale, 1.5));
    
    // Kelp avoidance
    const avoid = getAvoidanceVector(p.position, PARTICLE_CONFIG.bubbles.avoidRadius);
    p.position.add(avoid);
    
    // Reset when they reach surface or drift too far
    if (p.position.y > 15 || p.position.distanceTo(data.origin) > 150) {
      p.position.copy(getInitialPosition('bubbles'));
      p.scale.setScalar(1);
    }
  });
}

// Update plankton particles
function updatePlanktonParticles(particles, deltaTime) {
  particles.forEach(p => {
    const t = performance.now() / 1000 + p.userData.offset;
    const data = p.userData;
    
    // Gentle drifting with current
    const dirRad = THREE.MathUtils.degToRad(currentDirection);
    const baseDir = new THREE.Vector3(Math.cos(dirRad), 0, Math.sin(dirRad));
    const drift = baseDir.clone().multiplyScalar(waveSpeed * deltaTime * 5);
    
    // Vertical migration (plankton often migrate up and down)
    const verticalMigration = Math.sin(t * 0.1) * 0.5 * deltaTime;
    
    // Random darting movements
    if (Math.random() < 0.01) {
      const dart = new THREE.Vector3(
        (Math.random() - 0.5) * data.darting,
        (Math.random() - 0.5) * data.darting * 0.5,
        (Math.random() - 0.5) * data.darting
      );
      p.position.add(dart);
    }
    
    // Pulsing glow effect
    const glowIntensity = (Math.sin(t + data.glowPulse) + 1) * 0.5;
    p.material.opacity = PARTICLE_CONFIG.plankton.opacity * (0.5 + glowIntensity * 0.5);
    
    // Apply movements
    p.position.add(drift);
    p.position.y += verticalMigration;
    
    // Kelp avoidance
    const avoid = getAvoidanceVector(p.position, PARTICLE_CONFIG.plankton.avoidRadius);
    p.position.add(avoid);
    
    // Reset if too far
    if (p.position.distanceTo(data.origin) > 80) {
      p.position.copy(data.origin);
    }
  });
}

// Update sediment particles
function updateSedimentParticles(particles, deltaTime) {
  particles.forEach(p => {
    const t = performance.now() / 1000 + p.userData.offset;
    const data = p.userData;
    
    // Gentle sinking
    p.position.y -= data.sinking * deltaTime;
    
    // Drift with current (reduced)
    const dirRad = THREE.MathUtils.degToRad(currentDirection);
    const baseDir = new THREE.Vector3(Math.cos(dirRad), 0, Math.sin(dirRad));
    const drift = baseDir.clone().multiplyScalar(waveSpeed * deltaTime * 2);
    
    // Slight swirling motion
    const swirl = new THREE.Vector3(
      Math.sin(t * 0.5) * 0.1,
      0,
      Math.cos(t * 0.5) * 0.1
    ).multiplyScalar(deltaTime);
    
    p.position.add(drift).add(swirl);
    
    // Reset when hits bottom or drifts too far
    if (p.position.y < 0 || p.position.distanceTo(data.origin) > 120) {
      p.position.copy(getInitialPosition('sediment'));
    }
  });
}

// Initialize all particle types
function initializeAllParticles() {
  console.log('🌊 Initializing multi-type particle system...');
  
  particleGroups.debris = initializeParticleType('debris', PARTICLE_CONFIG.debris);
  particleGroups.bubbles = initializeParticleType('bubbles', PARTICLE_CONFIG.bubbles);
  particleGroups.plankton = initializeParticleType('plankton', PARTICLE_CONFIG.plankton);
  particleGroups.sediment = initializeParticleType('sediment', PARTICLE_CONFIG.sediment);
  
  const totalParticles = Object.values(particleGroups).reduce((sum, group) => sum + group.length, 0);
  console.log(`✅ Spawned ${totalParticles} particles across ${Object.keys(particleGroups).length} types`);
}

// Update all particle types
function updateAllParticles(deltaTime) {
  updateDebrisParticles(particleGroups.debris, deltaTime);
  updateBubbleParticles(particleGroups.bubbles, deltaTime);
  updatePlanktonParticles(particleGroups.plankton, deltaTime);
  updateSedimentParticles(particleGroups.sediment, deltaTime);
}

// Toggle particle types
function toggleParticleType(type, visible) {
  if (particleGroups[type]) {
    particleGroups[type].forEach(p => {
      p.visible = visible;
    });
    console.log(`${visible ? '✅' : '❌'} ${type} particles ${visible ? 'enabled' : 'disabled'}`);
  }
}

// Cleanup function
function cleanupParticles() {
  Object.values(particleGroups).forEach(group => {
    group.forEach(particle => {
      scene.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
    });
  });
  particleGroups = { debris: [], bubbles: [], plankton: [], sediment: [] };
  console.log('🧹 Particles cleaned up');
}

// Delay until scene is ready
setTimeout(initializeAllParticles, 1000);

// Global interface
window.OceanParticles = {
  update: updateAllParticles,
  toggle: toggleParticleType,
  cleanup: cleanupParticles,
  groups: particleGroups,
  config: PARTICLE_CONFIG
};

console.log('🎉 Enhanced particle system ready! Use OceanParticles.toggle("bubbles", false) to disable particle types');
