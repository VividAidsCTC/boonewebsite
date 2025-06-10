// Global variables
let scene, camera, renderer;
let kelp = [];
let waveSpeed = 1.0;
let waveIntensity = 1.0;
let currentDirection = 45;
let time = 0;

// Camera controls
let targetRotationX = 0, targetRotationY = 0;
let rotationX = 0, rotationY = 0;
let distance = 30;
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

    // Brighter ocean lighting - warmer tones to preserve brown seafloor
    const ambientLight = new THREE.AmbientLight(0x6699bb, 0.3); // Less blue, more neutral
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xaaccdd, 1.0); // Lighter blue-white
    sunLight.position.set(0, 50, 10);
    scene.add(sunLight);

    const rimLight1 = new THREE.DirectionalLight(0x7799cc, 0.3); // Warmer blue
    rimLight1.position.set(20, 20, 0);
    scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0x6688bb, 0.25); // Even warmer
    rimLight2.position.set(-20, 15, 0);
    scene.add(rimLight2);

    // Add a warm fill light specifically for the seafloor
    const floorLight = new THREE.DirectionalLight(0xddbb88, 0.4); // Warm golden tone
    floorLight.position.set(0, -30, 0); // From below to light the floor
    scene.add(floorLight);

    // Create richer brown seafloor with better material properties
    const floorGeometry = new THREE.PlaneGeometry(2000, 2000);
    const floorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x8B4513, // Richer saddle brown
        shininess: 2,    // Less shiny for more natural look
        specular: 0x332211 // Warm specular highlights
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    scene.add(floor);

    // Setup camera - much lower position
    camera.position.set(0, 2, distance);
    camera.lookAt(0, 3, 0);

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
    const kelpURL = 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/nouveaukelp2.glb';

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

            // Apply dark green-brown kelp material to all meshes
            template.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    // Ensure geometry has position attributes we can modify
                    child.geometry.computeBoundingBox();
                    const geometry = child.geometry;
                    
                    // Store original positions for deformation
                    const positions = geometry.attributes.position.array.slice();
                    geometry.userData.originalPositions = positions;
                    
                    // Calculate bounding box for height calculations
                    const bbox = geometry.boundingBox;
                    geometry.userData.minY = bbox.min.y;
                    geometry.userData.maxY = bbox.max.y;
                    geometry.userData.height = bbox.max.y - bbox.min.y;
                    
                    // Apply dark green-brown kelp material
                    const kelpMaterial = new THREE.MeshPhongMaterial({
                        color: 0x210d05, // Dark green-brown
                        transparent: true,
                        opacity: 0.85,
                        shininess: 10
                    });
                    child.material = kelpMaterial;
                    
                    log(`Prepared mesh for vertex deformation: height=${geometry.userData.height.toFixed(2)}`);
                }
            });

            // Position template so bottom touches ground (Y=0)
            template.position.y = -1; // Place on seafloor level

            // Create 50 kelp instances
            for(let i = 0; i < 50; i++) {
                const kelpInstance = template.clone();

                // Position kelp on the seafloor in tighter formation
                kelpInstance.position.x = (Math.random() - 0.5) * 15; // Reduced from 40 to 15
                kelpInstance.position.z = (Math.random() - 0.5) * 15; // Reduced from 40 to 15
                kelpInstance.position.y = -1; // Place on seafloor level

                // Scale between 0.75x and 1.5x the original size
                const scale = 0.75 + Math.random() * 0.75; // Random scale between 0.75 and 1.5
                kelpInstance.scale.setScalar(scale);

                // Random rotation only
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

                // Prepare cloned geometries for vertex deformation
                kelpInstance.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        // Clone geometry so each instance can be deformed independently
                        child.geometry = child.geometry.clone();
                        // Copy userData from the original template mesh
                        template.traverse((originalChild) => {
                            if (originalChild.isMesh && originalChild.geometry && 
                                originalChild.geometry.userData.originalPositions &&
                                originalChild.name === child.name) {
                                child.geometry.userData.originalPositions = originalChild.geometry.userData.originalPositions.slice();
                                child.geometry.userData.minY = originalChild.geometry.userData.minY;
                                child.geometry.userData.maxY = originalChild.geometry.userData.maxY;
                                child.geometry.userData.height = originalChild.geometry.userData.height;
                                return; // Found match, exit traverse
                            }
                        });
                    }
                });

                scene.add(kelpInstance);
                kelp.push(kelpInstance);

                log(`Instance ${i}: scale=${scale.toFixed(2)}`);
            }

            log(`Created ${kelp.length} GLTF kelp instances with vertex deformation`);
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
        // Base kelp dimensions
        const baseKelpHeight = 20;
        const baseBottomRadius = 0.4;
        const baseTopRadius = 0.2;

        // Scale between 0.75x and 1.5x the original size
        const scale = 0.75 + Math.random() * 0.75;
        const kelpHeight = baseKelpHeight * scale;
        const bottomRadius = baseBottomRadius * scale;
        const topRadius = baseTopRadius * scale;

        // Create custom geometry for bending kelp
        const segments = 20;
        const radialSegments = 8;

        const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, kelpHeight, radialSegments, segments);

        // Store original positions for deformation
        const positions = geometry.attributes.position.array.slice();
        geometry.userData.originalPositions = positions;
        geometry.userData.height = kelpHeight;

        // Brighter, less transparent kelp material
        const greenVariation = 0.7 + Math.random() * 0.5;
        const kelpMaterial = new THREE.MeshPhongMaterial({
            color: new THREE.Color(0.15 * greenVariation, 0.6 * greenVariation, 0.25 * greenVariation),
            transparent: true,
            opacity: 0.95,
            shininess: 15
        });

        const kelpMesh = new THREE.Mesh(geometry, kelpMaterial);

        // Position kelp in tighter formation
        kelpMesh.position.x = (Math.random() - 0.5) * 15; // Reduced from 40 to 15
        kelpMesh.position.z = (Math.random() - 0.5) * 15; // Reduced from 40 to 15
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
    // Mouse controls
    document.addEventListener('mousedown', function() {
        isMouseDown = true;
    });

    document.addEventListener('mouseup', function() {
        isMouseDown = false;
    });

    document.addEventListener('mousemove', function(event) {
        if (isMouseDown) {
            targetRotationY += event.movementX * 0.01;
            targetRotationX += event.movementY * 0.01;
            targetRotationX = Math.max(-Math.PI/3, Math.min(Math.PI/3, targetRotationX));
        }
    });

    document.addEventListener('wheel', function(event) {
        distance += event.deltaY * 0.02;
        distance = Math.max(8, Math.min(60, distance));
    });

    log('Manual camera controls initialized successfully');

    // Slider controls
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

// Function to deform kelp geometry using vertex manipulation
function deformKelp(kelpMesh, time) {
    if (kelpMesh.userData.isGLTF) {
        // Vertex-level deformation for GLTF models
        const userData = kelpMesh.userData;
        const dirRad = (currentDirection * Math.PI) / 180;
        
        // Keep base completely fixed
        kelpMesh.position.x = userData.originalX;
        kelpMesh.position.z = userData.originalZ;
        kelpMesh.position.y = userData.originalY;
        
        // Calculate wave values
        const wave1 = Math.sin(time * userData.freq1 + userData.offset1) * userData.amplitude1;
        const wave2 = Math.cos(time * userData.freq2 + userData.offset2) * userData.amplitude2;
        const wave3 = Math.sin(time * userData.freq3 + userData.offset3) * userData.amplitude3;
        
        // Deform each mesh in the GLTF model
        kelpMesh.traverse((child) => {
            if (child.isMesh && child.geometry && child.geometry.userData.originalPositions) {
                const geometry = child.geometry;
                const positions = geometry.attributes.position;
                const originalPositions = geometry.userData.originalPositions;
                const height = geometry.userData.height;
                const minY = geometry.userData.minY;
                
                // Deform each vertex
                for (let i = 0; i < positions.count; i++) {
                    const i3 = i * 3;
                    
                    // Get original position
                    const originalX = originalPositions[i3];
                    const originalY = originalPositions[i3 + 1];
                    const originalZ = originalPositions[i3 + 2];
                    
                    // Calculate height factor (0 at bottom, 1 at top)
                    const heightFactor = Math.max(0, (originalY - minY) / height);
                    const heightFactorCurved = heightFactor * heightFactor; // Quadratic for natural curve
                    
                    // Calculate bending displacement - increases with height
                    const bendAmountX = (wave1 + wave2 * 0.7) * waveIntensity * heightFactorCurved * 2;
                    const bendAmountZ = (wave2 + wave3 * 0.8) * waveIntensity * heightFactorCurved * 2;
                    
                    // Apply directional bending
                    const finalBendX = bendAmountX * Math.cos(dirRad) + bendAmountZ * Math.sin(dirRad) * 0.3;
                    const finalBendZ = bendAmountZ * Math.sin(dirRad) + bendAmountX * Math.cos(dirRad) * 0.3;
                    
                    // Set new position - bottom stays fixed, top moves more
                    positions.setX(i, originalX + finalBendX);
                    positions.setY(i, originalY);
                    positions.setZ(i, originalZ + finalBendZ);
                }
                
                // Mark for update
                positions.needsUpdate = true;
                geometry.computeVertexNormals();
            }
        });

    } else {
        // Vertex deformation for cylinder geometry (fallback)
        const geometry = kelpMesh.geometry;
        const positions = geometry.attributes.position;
        const originalPositions = geometry.userData.originalPositions;
        const userData = kelpMesh.userData;

        // Keep base fixed
        kelpMesh.position.x = userData.originalX;
        kelpMesh.position.z = userData.originalZ;
        kelpMesh.position.y = userData.originalY;

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
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    time += 0.01 * waveSpeed;

    kelp.forEach(function(k) {
        deformKelp(k, time);
    });

    // Update camera position based on mouse controls - lower Y position
    rotationX += (targetRotationX - rotationX) * 0.1;
    rotationY += (targetRotationY - rotationY) * 0.1;

    camera.position.x = Math.sin(rotationY) * Math.cos(rotationX) * distance;
    camera.position.y = Math.sin(rotationX) * distance + 3; // Changed from +10 to +3
    camera.position.z = Math.cos(rotationY) * Math.cos(rotationX) * distance;
    camera.lookAt(0, 3, 0); // Changed from (0, 10, 0) to (0, 3, 0)

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
