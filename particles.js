console.log('🌊 Advanced Particle System with Kelp Avoidance Loaded');

const NUM_PARTICLES = 500;
const PARTICLE_RADIUS = 0.3;
const AVOID_RADIUS = 5.0;

let particles = [];

// Initialize all particles
function initializeAdvancedParticles() {
  if (typeof scene === 'undefined') {
    console.error('❌ Scene not found. Load kelptest.js first.');
    return;
  }

  for (let i = 0; i < NUM_PARTICLES; i++) {
    const geometry = new THREE.SphereGeometry(PARTICLE_RADIUS, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffaa, opacity: 0.8, transparent: true });
    const mesh = new THREE.Mesh(geometry, material);

    const startPos = new THREE.Vector3(
      (Math.random() - 0.5) * 200,
      Math.random() * 8 + 1,
      (Math.random() - 0.5) * 200
    );

    mesh.position.copy(startPos);

    mesh.userData = {
      origin: startPos.clone(),
      offset: Math.random() * Math.PI * 2,
      verticalWiggle: 0.5 + Math.random(),
      lateralWiggle: 0.5 + Math.random(),
    };

    scene.add(mesh);
    particles.push(mesh);
  }

  console.log(`✅ Spawned ${particles.length} advanced particles`);
}

// Helper: Find nearest kelp and return avoidance vector
function getAvoidanceVector(position) {
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

  if (closest && closestDist < AVOID_RADIUS) {
    const away = position.clone().sub(closest.position).normalize();
    return away.multiplyScalar((AVOID_RADIUS - closestDist) / AVOID_RADIUS);
  }

  return new THREE.Vector3();
}

// Update all particles
function updateAdvancedParticles(deltaTime) {
  const dirRad = THREE.MathUtils.degToRad(currentDirection);
  const baseDir = new THREE.Vector3(Math.cos(dirRad), 0, Math.sin(dirRad));

  particles.forEach(p => {
    const t = performance.now() / 1000 + p.userData.offset;

    // Base current movement
    const move = baseDir.clone().multiplyScalar(waveSpeed * deltaTime * 20);

    // Vertical wiggle (sine wave)
    const vertical = Math.sin(t * 2) * p.userData.verticalWiggle * 0.1;

    // Lateral wiggle (perpendicular to direction)
    const lateral = new THREE.Vector3(-baseDir.z, 0, baseDir.x)
      .multiplyScalar(Math.sin(t * 1.5) * p.userData.lateralWiggle * 0.1);

    // Kelp avoidance
    const avoid = getAvoidanceVector(p.position);

    // Apply motion
    p.position.add(move).add(lateral).add(avoid);
    p.position.y += vertical;

    // Reset if too far away
    if (p.position.distanceTo(p.userData.origin) > 100) {
      p.position.copy(p.userData.origin);
    }
  });
}

// Delay until scene is ready
setTimeout(initializeAdvancedParticles, 1000);

// Global hook
window.OceanParticles = {
  update: updateAdvancedParticles,
};
