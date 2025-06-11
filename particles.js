console.log('🌊 Simple Particle System Loaded');

// Create particle
let simpleParticle;
let speed = 0.5;
let minX = -50;
let maxX = 50;

// Initialize when scene is ready
function initializeSimpleParticle() {
  if (typeof scene === 'undefined') {
    console.error('❌ Scene not found. Load kelptest.js first.');
    return;
  }

  const geometry = new THREE.SphereGeometry(0.5, 8, 8);
  const material = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  simpleParticle = new THREE.Mesh(geometry, material);

  simpleParticle.position.set(minX, 1, 0); // Start at left edge
  scene.add(simpleParticle);

  console.log('✅ Simple particle added');
}

// Update particle movement
function updateSimpleParticle(deltaTime) {
  if (!simpleParticle) return;

  simpleParticle.position.x += speed * deltaTime * 60; // 60 FPS scale

  if (simpleParticle.position.x > maxX) {
    simpleParticle.position.x = minX; // Reset to start
  }
}

// Wait for scene
setTimeout(initializeSimpleParticle, 1000);

// Provide global API (optional)
window.OceanParticles = {
  update: updateSimpleParticle,
};
