console.log('🌊 Simple Particle System with Current Direction Loaded');

let simpleParticle;
let minRange = 60;  // Distance before reset
let origin = new THREE.Vector3(-200, 1, 10);  // Reset origin

// Initialize particle
function initializeSimpleParticle() {
  if (typeof scene === 'undefined') {
    console.error('❌ Scene not found. Load kelptest.js first.');
    return;
  }

  const geometry = new THREE.SphereGeometry(0.5, 8, 8);
  const material = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  simpleParticle = new THREE.Mesh(geometry, material);

  simpleParticle.position.copy(origin);
  scene.add(simpleParticle);

  console.log('✅ Particle with current direction initialized');
}

// Update function
function updateSimpleParticle(deltaTime) {
  if (!simpleParticle || typeof waveSpeed === 'undefined' || typeof currentDirection === 'undefined') return;

  // Convert degrees to radians
  const dirRad = THREE.MathUtils.degToRad(currentDirection);

  // Direction vector in XZ plane
  const dirX = Math.cos(dirRad);
  const dirZ = Math.sin(dirRad);

  // Move particle based on direction and waveSpeed
  simpleParticle.position.x += dirX * waveSpeed * deltaTime * 60;
  simpleParticle.position.z += dirZ * waveSpeed * deltaTime * 60;

  // Reset if far from origin
  const distanceFromOrigin = simpleParticle.position.distanceTo(origin);
  if (distanceFromOrigin > minRange) {
    simpleParticle.position.copy(origin);
  }
}

// Delay to wait for scene load
setTimeout(initializeSimpleParticle, 1000);

// Global access
window.OceanParticles = {
  update: updateSimpleParticle,
};
