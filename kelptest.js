import * as THREE from 'three';

// Animation controls
let waveSpeed = 1.5;
let waveIntensity = 1.2;
let currentDirection = 45;

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x001122);

// Add renderer to container
const container = document.getElementById('container');
container.appendChild(renderer.domElement);

// Create blue gradient background
const canvas = document.createElement('canvas');
canvas.width = 512;
canvas.height = 512;
const context = canvas.getContext('2d');

const gradient = context.createLinearGradient(0, 0, 0, 512);
gradient.addColorStop(0, '#4499dd'); // Light blue at top
gradient.addColorStop(1, '#001133'); // Dark blue at bottom

context.fillStyle = gradient;
context.fillRect(0, 0, 512, 512);

const gradientTexture = new THREE.CanvasTexture(canvas);
scene.background = gradientTexture;

// Enhanced lighting for underwater effect
const ambientLight = new THREE.AmbientLight(0x4488cc, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0x88ccff, 1.8);
sunLight.position.set(0, 50, 10);
scene.add(sunLight);

const rimLight1 = new THREE.DirectionalLight(0x5599dd, 0.7);
rimLight1.position.set(20, 20, 0);
scene.add(rimLight1);

const rimLight2 = new THREE.DirectionalLight(0x4488cc, 0.5);
rimLight2.position.set(-20, 15, 0);
scene.add(rimLight2);

// Create brown seafloor
const floorGeometry = new THREE.PlaneGeometry(100, 100);
const floorMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x75410a,
    shininess: 8
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1;
scene.add(floor);

// Create kelp forest
const kelp = [];

for(let i = 0; i < 35; i++) {
    // Random kelp dimensions
    const kelpHeight = 15 + Math.random() * 20;
    const bottomRadius = 0.3 + Math.random() * 0.4;
    const topRadius = bottomRadius * (0.3 + Math.random() * 0.4);
    
    // Create geometry with many segments for smooth bending
    const segments = 20;
    const radialSegments = 8;
    
    const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, kelpHeight, radialSegments, segments);
    
    // Store original positions for deformation
    const positions = geometry.attributes.position.array.slice();
    geometry.userData.originalPositions = positions;
    geometry.userData.segmentHeight = kelpHeight / segments;
    
    // Kelp material with green variation
    const greenVariation = 0.7 + Math.random() * 0.5;
    const kelpMaterial = new THREE.MeshPhongMaterial({
        color: new THREE.Color(0.15 * greenVariation, 0.6 * greenVariation, 0.25 * greenVariation),
        transparent: true,
        opacity: 0.95,
        shininess: 15
    });
    
    const kelpMesh = new THREE.Mesh(geometry, kelpMaterial);
    
    // Position kelp randomly
    kelpMesh.position.x = (Math.random() - 0.5) * 40;
    kelpMesh.position.z = (Math.random() - 0.5) * 40;
    kelpMesh.position.y = kelpHeight / 2;
    
    // Store animation data
    kelpMesh.userData = {
        originalX: kelpMesh.position.x,
        originalZ: kelpMesh.position.z,
        originalY: kelpMesh.position.y,
        height: kelpHeight,
        segments: segments,
        offset1: Math.random() * Math.PI * 2,
        offset2: Math.random() * Math.PI * 2,
        offset3: Math.random() * Math.PI * 2,
        freq1: 0.8 + Math.random() * 0.6,
        freq2: 1.1 + Math.random() * 0.8,
        freq3: 0.5 + Math.random() * 0.4,
        amplitude1: 0.8 + Math.random() * 0.6,
        amplitude2: 0.6 + Math.random() * 0.5,
        amplitude3: 0.4 + Math.random() * 0.3
    };
    
    scene.add(kelpMesh);
    kelp.push(kelpMesh);
}

// Camera controls
let targetRotationX = 0, targetRotationY = 0;
let rotationX = 0, rotationY = 0;
let distance = 30;
let isMouseDown = false;

camera.position.set(0, 8, distance);
camera.lookAt(0, 10, 0);

// Mouse controls
document.addEventListener('mousedown', () => { isMouseDown = true; });
document.addEventListener('mouseup', () => { isMouseDown = false; });

document.addEventListener('mousemove', (event) => {
    if (isMouseDown) {
        targetRotationY += event.movementX * 0.01;
        targetRotationX += event.movementY * 0.01;
        targetRotationX = Math.max(-Math.PI/3, Math.min(Math.PI/3, targetRotationX));
    }
});

document.addEventListener('wheel', (event) => {
    distance += event.deltaY * 0.02;
    distance = Math.max(8, Math.min(60, distance));
});

// Control sliders
const waveSpeedSlider = document.getElementById('waveSpeed');
const waveIntensitySlider = document.getElementById('waveIntensity');
const currentDirectionSlider = document.getElementById('currentDirection');

waveSpeedSlider.addEventListener('input', (e) => {
    waveSpeed = parseFloat(e.target.value);
});

waveIntensitySlider.addEventListener('input', (e) => {
    waveIntensity = parseFloat(e.target.value);
});

currentDirectionSlider.addEventListener('input', (e) => {
    currentDirection = parseFloat(e.target.value);
});

// Function to deform kelp geometry for realistic bending
function deformKelp(kelpMesh, time) {
    const geometry = kelpMesh.geometry;
    const positions = geometry.attributes.position;
    const originalPositions = geometry.userData.originalPositions;
    const userData = kelpMesh.userData;
    
    // Convert direction to radians
    const dirRad = (currentDirection * Math.PI) / 180;
    
    // Calculate wave values
    const wave1 = Math.sin(time * userData.freq1 + userData.offset1) * userData.amplitude1;
    const wave2 = Math.cos(time * userData.freq2 + userData.offset2) * userData.amplitude2;
    const wave3 = Math.sin(time * userData.freq3 + userData.offset3) * userData.amplitude3;
    
    // Deform each vertex
    for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;
        
        // Get original position
        const originalX = originalPositions[i3];
        const originalY = originalPositions[i3 + 1];
        const originalZ = originalPositions[i3 + 2];
        
        // Calculate height factor (0 at bottom, 1 at top)
        const heightFactor = (originalY + userData.height/2) / userData.height;
        const heightFactorSquared = heightFactor * heightFactor;
        
        // Calculate bending displacement
        const bendAmountX = (wave1 + wave2 * 0.7) * waveIntensity * heightFactorSquared * 2;
        const bendAmountZ = (wave2 + wave3 * 0.8) * waveIntensity * heightFactorSquared * 2;
        
        // Apply directional bending
        const finalBendX = bendAmountX * Math.cos(dirRad) + bendAmountZ * Math.sin(dirRad) * 0.3;
        const finalBendZ = bendAmountZ * Math.sin(dirRad) + bendAmountX * Math.cos(dirRad) * 0.3;
        
        // Set new position
        positions.setX(i, originalX + finalBendX);
        positions.setY(i, originalY);
        positions.setZ(i, originalZ + finalBendZ);
    }
    
    // Mark for update
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
}

// Animation variables
let time = 0;

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    time += 0.01 * waveSpeed;
    
    // Animate each kelp strand
    kelp.forEach((k) => {
        // Deform the kelp geometry to create actual bending
        deformKelp(k, time);
        
        // Add subtle base movement
        k.position.x = k.userData.originalX + Math.sin(time * 0.4 + k.userData.offset1) * 0.2 * waveIntensity;
        k.position.z = k.userData.originalZ + Math.cos(time * 0.6 + k.userData.offset2) * 0.2 * waveIntensity;
        
        // Very subtle vertical bobbing
        k.position.y = k.userData.originalY + Math.sin(time * 0.2 + k.userData.offset3) * 0.05 * waveIntensity;
    });
    
    // Camera movement
    rotationX += (targetRotationX - rotationX) * 0.05;
    rotationY += (targetRotationY - rotationY) * 0.05;
    
    camera.position.x = Math.sin(rotationY) * Math.cos(rotationX) * distance;
    camera.position.y = Math.sin(rotationX) * distance + 10;
    camera.position.z = Math.cos(rotationY) * Math.cos(rotationX) * distance;
    camera.lookAt(0, 8, 0);
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();

console.log('Kelp forest loaded with', kelp.length, 'kelp strands');
