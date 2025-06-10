// Global variables
let scene, camera, renderer;
let kelp = [];
let waveSpeed = 1.5;
let waveIntensity = 1.2;
let currentDirection = 45;
let time = 0;

// Camera controls - mostly static with minimal movement
let targetRotationX = 0, targetRotationY = 0;
let rotationX = 0, rotationY = 0;
let distance = 25; // Closer for better kelp viewing
let isMouseDown = false;

// Debug logging function
function log(message) {
    console.log(message);
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        debugDiv.innerHTML += message + '<br>';
    }
}

// Wait for DOM and start the application
document.addEventListener('DOMContentLoaded', function() {
    log('DOM loaded, initializing kelp forest...');

    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded');
        return;
    }

    initializeScene();

    // Try to load GLTF first, fallback to cylinders if it fails
    setTimeout(() => {
        loadGLTFKelp();
    }, 500);
});

function initializeScene() {
    log('Initializing Three.js scene...');

    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Create blue gradient background
    const canvas = document.createElement('canvas');
    canvas.width = 2000;
    canvas.height = 2000;
    const context = canvas.getContext('2d');

    const gradient = context.createLinearGradient(0, 0, 0, 2000);
    gradient.addColorStop(0, '#4499dd');
    gradient.addColorStop(1, '#001133');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 2000, 2000);

    const gradientTexture = new THREE.CanvasTexture(canvas);
    scene.background = gradientTexture;

    const container = document.getElementById('container');
    container.appendChild(renderer.domElement);

    // Brighter ocean lighting
    const ambientLight = new THREE.AmbientLight(0x4488cc, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0x88ccff, 1.2);
    sunLight.position.set(0, 50, 10);
    scene.add(sunLight);

    const rimLight1 = new THREE.DirectionalLight(0x5599dd, 0.4);
    rimLight1.position.set(20, 20, 0);
    scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0x4488cc, 0.3);
    rimLight2.position.set(-20, 15, 0);
    scene.add(rimLight2);

    // Create brighter brown seafloor
    const floorGeometry = new THREE.PlaneGeometry(2000, 2000);
    const floorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x594738,
        shininess: 4
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    scene.add(floor);

    // Camera setup
    camera.position.set(0, 8, distance);
    camera.lookAt(0, 10, 0);

    setupControls();
    log('Scene initialized successfully');
}

function loadGLTFKelp() {
    log('Attempting to load GLTF kelp model...');

    if (typeof THREE.GLTFLoader === 'undefined') {
        log('ERROR: GLTFLoader not available');
        createFallbackKelp();
        return;
    }

    const loader = new THREE.GLTFLoader();
    const kelpURL = 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/nouveaukelp.glb';

    loader.load(
        kelpURL,
        function(gltf) {
            log('GLTF model loaded successfully');
            const template = gltf.scene;

            // Compute overall bounding box for the entire model
            const box = new THREE.Box3().setFromObject(template);
            const size = new THREE.Vector3();
            box.getSize(size);

            log(`=== GLTF MODEL ANALYSIS ===`);
            log(`Overall model size: X=${size.x.toFixed(3)}, Y=${size.y.toFixed(3)}, Z=${size.z.toFixed(3)}`);
            log(`Model center: X=${box.getCenter(new THREE.Vector3()).x.toFixed(3)}, Y=${box.getCenter(new THREE.Vector3()).y.toFixed(3)}, Z=${box.getCenter(new THREE.Vector3()).z.toFixed(3)}`);
            log(`Children count: ${template.children.length}`);

            // Analyze each mesh in the model
            let meshCount = 0;
            template.traverse((child) => {
                if (child.isMesh) {
                    meshCount++;
                    child.geometry.computeBoundingBox();
                    const meshBox = child.geometry.boundingBox;
                    const meshSize = new THREE.Vector3();
                    meshBox.getSize(meshSize);

                    log(`Mesh ${meshCount}: ${child.name || 'unnamed'}`);
                    log(`  Size: X=${meshSize.x.toFixed(3)}, Y=${meshSize.y.toFixed(3)}, Z=${meshSize.z.toFixed(3)}`);
                    log(`  Position: X=${child.position.x.toFixed(3)}, Y=${child.position.y.toFixed(3)}, Z=${child.position.z.toFixed(3)}`);
                    log(`  Scale: X=${child.scale.x.toFixed(3)}, Y=${child.scale.y.toFixed(3)}, Z=${child.scale.z.toFixed(3)}`);

                    // Check if it's essentially flat
                    if (meshSize.y < 0.1) {
                        log(`  ⚠️  This mesh appears to be FLAT (Y < 0.1)`);
                    }
                }
            });

            // If the model is flat, let's try to fix it
            if (size.y < 1.0) {
                log(`🔧 Model appears flat (Y=${size.y.toFixed(3)}). Trying to stretch in Y direction...`);
                template.scale.set(1, 100, 1); // Stretch Y by 100x
            }

            // Clone and position multiple instances - 15-20 kelp
            for(let i = 0; i < 18; i++) {
                const kelpInstance = template.clone();

                // Random positioning
                kelpInstance.position.x = (Math.random() - 0.5) * 40;
                kelpInstance.position.z = (Math.random() - 0.5) * 40;
                kelpInstance.position.y = 0;

                // Scale between 0.75x and 1.5x the original size
                const scale = 0.75 + Math.random() * 0.75; // Random between 0.75 and 1.5
                kelpInstance.scale.setScalar(scale);

                log(`Instance ${i}: scale ${scale.toFixed(1)}`);

                // Random rotation
                kelpInstance.rotation.y = Math.random() * Math.PI * 2;

                // Store animation data
                kelpInstance.userData = {
                    originalX: kelpInstance.position.x,
                    originalZ: kelpInstance.position.z,
                    originalY: kelpInstance.position.y,
                    offset1: Math.random() * Math.PI * 2,
                    offset2: Math.random() * Math.PI * 2,
                    offset3: Math.random() * Math.PI * 2,
                    freq1: 0.8 + Math.random() * 0.6,
                    freq2: 1.1 + Math.random() * 0.8,
                    freq3: 0.5 + Math.random() * 0.4,
                    amplitude1: 0.8 + Math.random() * 0.6,
                    amplitude2: 0.6 + Math.random() * 0.5,
                    amplitude3: 0.4 + Math.random() * 0.3,
                    isGLTF: true
                };

                scene.add(kelpInstance);
                kelp.push(kelpInstance);
            }

            log(`Created ${kelp.length} GLTF kelp instances`);
            startAnimation();
        },
        function(progress) {
            if (progress.total > 0) {
                log(`Loading progress: ${Math.round((progress.loaded / progress.total) * 100)}%`);
            }
        },
        function(error) {
            log('ERROR loading GLTF: ' + error.message);
            createFallbackKelp();
        }
    );
}

function createFallbackKelp() {
    log('Creating fallback cylinder kelp...');

    for(let i = 0; i < 35; i++) {
        // Random kelp dimensions
        const kelpHeight = 15 + Math.random() * 20;
        const bottomRadius = 0.3 + Math.random() * 0.4;
        const topRadius = bottomRadius * (0.3 + Math.random() * 0.4);

        // Create custom geometry for bending kelp
        const segments = 20;
        const radialSegments = 8;

        const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, kelpHeight, radialSegments, segments);

        // Store original positions for deformation
        const positions = geometry.attributes.position.array.slice();
        geometry.userData.originalPositions = positions;
        geometry.userData.segmentHeight = kelpHeight / segments;

        // Brighter, less transparent kelp material
        const greenVariation = 0.7 + Math.random() * 0.5;
        const kelpMaterial = new THREE.MeshPhongMaterial({
            color: new THREE.Color(0.15 * greenVariation, 0.6 * greenVariation, 0.25 * greenVariation),
            transparent: true,
            opacity: 0.95,
            shininess: 15
        });

        const kelpMesh = new THREE.Mesh(geometry, kelpMaterial);

        // Position kelp
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
            amplitude3: 0.4 + Math.random() * 0.3,
            isGLTF: false
        };

        scene.add(kelpMesh);
        kelp.push(kelpMesh);
    }

    log(`Created ${kelp.length} cylinder kelp plants`);
    startAnimation();
}

function setupControls() {
    // Disable mouse controls for fixed camera
    // document.addEventListener('mousedown', function() { isMouseDown = true; });
    // document.addEventListener('mouseup', function() { isMouseDown = false; });
    // document.addEventListener('mousemove', function(event) { ... });
    // document.addEventListener('wheel', function(event) { ... });

    // Working sliders only
    const waveSpeedSlider = document.getElementById('waveSpeed');
    const waveIntensitySlider = document.getElementById('waveIntensity');
    const currentDirectionSlider = document.getElementById('currentDirection');

    if (waveSpeedSlider) {
        waveSpeedSlider.addEventListener('input', function(e) {
            waveSpeed = parseFloat(e.target.value);
        });
    }

    if (waveIntensitySlider) {
        waveIntensitySlider.addEventListener('input', function(e) {
            waveIntensity = parseFloat(e.target.value);
        });
    }

    if (currentDirectionSlider) {
        currentDirectionSlider.addEventListener('input', function(e) {
            currentDirection = parseFloat(e.target.value);
        });
    }

    // Fallback button (if it exists)
    const fallbackButton = document.getElementById('useFallback');
    if (fallbackButton) {
        fallbackButton.addEventListener('click', function() {
            log('User requested fallback kelp');
            // Clear existing kelp
            kelp.forEach(k => scene.remove(k));
            kelp = [];
            createFallbackKelp();
        });
    }
}

// Function to deform kelp geometry for bending
function deformKelp(kelpMesh, time) {
    if (kelpMesh.userData.isGLTF) {
        // GLTF kelp bending - create gradual curve from base to top
        const userData = kelpMesh.userData;
        const dirRad = (currentDirection * Math.PI) / 180;
        
        const wave1 = Math.sin(time * userData.freq1 + userData.offset1) * userData.amplitude1;
        const wave2 = Math.cos(time * userData.freq2 + userData.offset2) * userData.amplitude2;
        
        // Keep the base completely fixed - no position movement at all
        kelpMesh.position.x = userData.originalX;
        kelpMesh.position.z = userData.originalZ;
        kelpMesh.position.y = userData.originalY;
        
        // For GLTF models, we need to traverse and bend individual parts
        // This creates a more realistic bending effect
        kelpMesh.traverse((child) => {
            if (child.isMesh) {
                // Get the height of this mesh relative to the whole kelp
                const localY = child.position.y;
                const boundingBox = new THREE.Box3().setFromObject(kelpMesh);
                const totalHeight = boundingBox.max.y - boundingBox.min.y;
                const heightFactor = Math.max(0, localY / totalHeight); // 0 at bottom, 1 at top
                
                // Apply progressive bending - more at the top
                const bendStrength = heightFactor * heightFactor; // Quadratic curve for natural look
                
                // Calculate bending
                const bendX = wave1 * waveIntensity * 0.3 * bendStrength * Math.cos(dirRad);
                const bendZ = wave2 * waveIntensity * 0.3 * bendStrength * Math.sin(dirRad);
                
                // Apply rotation to create curve effect
                child.rotation.z = wave1 * waveIntensity * 0.15 * bendStrength;
                child.rotation.x = wave2 * waveIntensity * 0.12 * bendStrength;
                
                // Slight position offset for top parts only
                if (heightFactor > 0.3) { // Only bend upper 70% of kelp
                    child.position.x = bendX * 0.5;
                    child.position.z = bendZ * 0.5;
                }
            }
        });

    } else {
        // Vertex deformation for cylinder geometry (your original approach)
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

        // Add subtle base movement
        kelpMesh.position.x = userData.originalX + Math.sin(time * 0.4 + userData.offset1) * 0.2 * waveIntensity;
        kelpMesh.position.z = userData.originalZ + Math.cos(time * 0.6 + userData.offset2) * 0.2 * waveIntensity;

        // Very subtle vertical bobbing
        kelpMesh.position.y = userData.originalY + Math.sin(time * 0.2 + userData.offset3) * 0.05 * waveIntensity;
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    time += 0.01 * waveSpeed;

    kelp.forEach(function(k) {
        deformKelp(k, time);
    });

    // Fixed camera - no movement
    // Camera stays in the same position always
    // rotationX and rotationY remain at 0
    
    camera.position.x = Math.sin(0) * Math.cos(0) * distance;
    camera.position.y = Math.sin(0) * distance + 10;
    camera.position.z = Math.cos(0) * Math.cos(0) * distance;
    camera.lookAt(0, 8, 0);

    renderer.render(scene, camera);
}

function startAnimation() {
    log('Starting animation...');

    // Hide debug info after successful start
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        setTimeout(() => {
            debugDiv.style.display = 'none';
        }, 3000);
    }

    animate();
}

// Handle window resize
window.addEventListener('resize', function() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});
