// Global variables for Three.js scene
let scene, camera, renderer;
let controls; // For OrbitControls
let clock = new THREE.Clock(); // For delta time

// Kelp variables (retained from your original file)
let kelp = [];
let waveSpeed = .8; // This seems to be a kelp wave speed, not ocean wave
let waveIntensity = .6; // Kelp wave intensity
let currentDirection = 45;
let time = 0; // For kelp animation

// Camera controls (retained from your original file)
let targetRotationX = 0, targetRotationY = 0;
let rotationX = 0, rotationY = 0;
let distance = 30;
let isMouseDown = false;

// Floor textures (retained from your original file)
let floorTextures = {
    diffuse: null,
    normal: null,
    roughness: null,
    displacement: null
};
let textureLoader = new THREE.TextureLoader();
let seafloor; // Reference to the seafloor mesh

// UI elements (assuming you have them, otherwise remove)
let waveSpeedSlider, waveIntensitySlider, currentDirectionSlider;


// Helper for logging to a debug div (retained from your original file)
function log(message) {
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        const p = document.createElement('p');
        p.textContent = message;
        debugDiv.appendChild(p);
        debugDiv.scrollTop = debugDiv.scrollHeight; // Auto-scroll
    }
    console.log(message); // Also log to console
}


// Function to create textured seafloor (retained from your original file)
function createTexturedFloor() {
    log('Creating textured seafloor...');

    const floorGeometry = new THREE.PlaneGeometry(1000, 1000, 256, 256); // Higher resolution for displacement

    // Default material (will be updated when textures load)
    let floorMaterial = new THREE.MeshPhongMaterial({
        color: 0x302114, // Richer saddle brown
        shininess: 2,
        specular: 0x332211,
        side: THREE.DoubleSide
    });

    seafloor = new THREE.Mesh(floorGeometry, floorMaterial);
    seafloor.rotation.x = -Math.PI / 2;
    seafloor.position.y = -1; // Position slightly below water surface
    seafloor.receiveShadow = true; // Enable shadow receiving
    scene.add(seafloor);

    // Load textures
    log('Loading ground textures...');
    textureLoader.load('textures/sand_diffuse.jpg', (texture) => {
        floorTextures.diffuse = texture;
        log('Diffuse texture loaded successfully');
        updateFloorMaterial();
    });
    textureLoader.load('textures/sand_normal.jpg', (texture) => {
        floorTextures.normal = texture;
        log('Normal map loaded successfully');
        updateFloorMaterial();
    });
    textureLoader.load('textures/sand_roughness.jpg', (texture) => {
        floorTextures.roughness = texture;
        log('Roughness map loaded successfully');
        updateFloorMaterial();
    });
    textureLoader.load('textures/sand_displacement.jpg', (texture) => {
        floorTextures.displacement = texture;
        log('Displacement map loaded successfully');
        updateFloorMaterial();
    });
}

// Function to apply loaded textures to the floor material (retained from your original file)
function updateFloorMaterial() {
    if (seafloor && seafloor.material instanceof THREE.MeshPhongMaterial) {
        if (floorTextures.diffuse && floorTextures.normal && floorTextures.roughness && floorTextures.displacement) {
            seafloor.material = new THREE.MeshStandardMaterial({ // Use StandardMaterial for better PBR textures
                map: floorTextures.diffuse,
                normalMap: floorTextures.normal,
                roughnessMap: floorTextures.roughness,
                displacementMap: floorTextures.displacement,
                displacementScale: 5, // Adjust this for desired displacement effect
                color: 0x504030, // Base color to tint textures
                side: THREE.DoubleSide
            });
            seafloor.material.needsUpdate = true;
            log('Floor material updated with textures');
        }
    }
}


// Main initialization function
function init() {
    log('Initializing Three.js scene...');

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1a3a); // Deep blue background

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000); // Increased far plane for visibility
    camera.position.set(0, 50, 150); // Adjusted for underwater view, move around as needed
    camera.lookAt(0, 0, 0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Enable shadow maps
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    document.body.appendChild(renderer.domElement);

    // Lighting (adjust as needed for underwater feel)
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // Softer ambient light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(50, 200, 100);
    directionalLight.castShadow = true; // Enable shadows
    directionalLight.shadow.mapSize.width = 2048; // Higher resolution shadows
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -250;
    directionalLight.shadow.camera.right = 250;
    directionalLight.shadow.camera.top = 250;
    directionalLight.shadow.camera.bottom = -250;
    scene.add(directionalLight);


    // OrbitControls (if you want to freely move the camera)
    if (typeof THREE.OrbitControls !== 'undefined') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; // Animate controls
        controls.dampingFactor = 0.25;
        // Adjust controls for underwater feel
        controls.maxPolarAngle = Math.PI; // Allow looking up and down fully
        controls.minDistance = 1;
        controls.maxDistance = 1000;
        log('Manual camera controls initialized successfully');
    }

    // Create the seafloor
    createTexturedFloor();

    // --- Initialize other systems explicitly ---

    // Initialize Fog (call its init function, passing scene and camera)
    // Assuming initializeFogSystem in fog.js is modified to accept scene, camera
    if (window.FogSystem && window.FogSystem.init) {
        log('Attempting to initialize FogSystem...');
        window.FogSystem.init(scene, camera); // Pass scene and camera
    } else {
        console.warn('Fog system (fog.js) not found or not initialized correctly.');
    }

    // Initialize Particles (call its init function, passing scene)
    // Assuming initializeAllParticles in particles.js is modified to accept scene
    if (window.OceanParticles && window.OceanParticles.init) { // Check if 'init' is exposed or 'update' is the main entry
        log('Attempting to initialize Particle system...');
        window.OceanParticles.init(scene); // Pass scene
    } else if (window.OceanParticles && typeof initializeAllParticles === 'function') { // Fallback if init not exposed
        log('Attempting to initialize Particle system via global function...');
        initializeAllParticles(scene); // Call the global function if exposed
    } else {
        console.warn('Particle system (particles.js) not found or not initialized correctly.');
    }


    // *** IMPORTANT: Initialize the Ocean Surface after scene is ready ***
    if (window.OceanSurface && window.OceanSurface.initialize) {
        window.OceanSurface.initialize(scene); // Pass the scene object
        log('✅ OceanSurface initialized.');
        // Optionally set initial weather/properties
        // window.OceanSurface.weather("calm");
    } else {
        console.error("❌ OceanSurface system not found or not initialized correctly. Make sure wave.js is loaded.");
    }

    // Load Kelp Model (retained from your original file)
    const gltfLoader = new THREE.GLTFLoader();
    log('Attempting to load GLTF kelp model...');
    gltfLoader.load('models/kelp_optimized.glb', (gltf) => {
        log('GLTF model loaded successfully');
        const kelpModel = gltf.scene;

        // Clone and position kelp instances
        const numKelp = 300;
        const scatterRadius = 200; // Increased scatter area

        // Prepare the mesh for vertex deformation
        let meshToDeform = null;
        kelpModel.traverse((child) => {
            if (child.isMesh) {
                meshToDeform = child;
                // Enable shadows for kelp
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        if (meshToDeform && meshToDeform.geometry.isBufferGeometry) {
            meshToDeform.geometry.computeVertexNormals();
            log('Prepared mesh for vertex deformation: height=' + meshToDeform.geometry.boundingBox.max.y.toFixed(2));
        } else {
            log('Warning: No deformable mesh found in GLTF or not BufferGeometry.');
        }

        log('=== GLTF MODEL ANALYSIS ===');
        if (meshToDeform && meshToDeform.geometry.boundingBox) {
            const bbox = meshToDeform.geometry.boundingBox;
            log(`Overall model size: X=${bbox.max.x - bbox.min.x}, Y=${bbox.max.y - bbox.min.y}, Z=${bbox.max.z - bbox.min.z}`);
        }

        for (let i = 0; i < numKelp; i++) {
            const instance = kelpModel.clone();
            const scale = 3 + Math.random() * 10; // Random scale
            instance.scale.set(scale, scale, scale);
            log(`Instance ${i}: scale=${scale.toFixed(2)}`);

            // Position within the scatter radius, keeping a distance from center if desired
            let x, z;
            let minDistance = 20; // Minimum distance from center for kelp
            do {
                x = (Math.random() - 0.5) * scatterRadius;
                z = (Math.random() - 0.5) * scatterRadius;
            } while (Math.sqrt(x*x + z*z) < minDistance);


            // Position at seafloor level
            instance.position.set(x, seafloor.position.y, z);
            // Random Y rotation
            instance.rotation.y = Math.random() * Math.PI * 2;

            scene.add(instance);
            kelp.push(instance);
        }
        log(`Created ${numKelp} GLTF kelp instances with vertex deformation`);

    }, undefined, (error) => {
        console.error('An error happened loading GLTF:', error);
        log('❌ Failed to load GLTF kelp model: ' + error.message);
    });

    // Setup UI
    setupUI();

    // Handle window resizing
    window.addEventListener('resize', onWindowResize, false);

    // Start the animation loop
    startAnimation(); // Call startAnimation which then calls animate
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Kelp deformation logic (retained from your original file)
function deformKelp(mesh, time) {
    if (!mesh || !mesh.geometry || !mesh.geometry.isBufferGeometry) return;

    const positions = mesh.geometry.attributes.position;
    const initialPositions = mesh.userData.initialPositions || [];

    // Store initial positions if not already done
    if (initialPositions.length === 0) {
        for (let i = 0; i < positions.count; i++) {
            initialPositions.push(new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i)));
        }
        mesh.userData.initialPositions = initialPositions;
    }

    const tempVector = new THREE.Vector3();
    const kelpWaveSpeed = waveSpeed; // Using global kelp wave speed
    const kelpWaveIntensity = waveIntensity; // Using global kelp wave intensity

    for (let i = 0; i < positions.count; i++) {
        tempVector.copy(initialPositions[i]);

        // Apply wave deformation based on height (y-coordinate)
        const bendFactor = Math.sin(tempVector.y * 0.5 + time * kelpWaveSpeed); // Bend more at the top
        const swayFactor = Math.cos(tempVector.y * 0.7 + time * kelpWaveSpeed * 0.8); // Another wave pattern

        // Calculate direction for current
        const currentRad = THREE.MathUtils.degToRad(currentDirection); // Convert degrees to radians

        const displacementX = Math.sin(time * kelpWaveSpeed + tempVector.y * 0.2) * kelpWaveIntensity * Math.cos(currentRad);
        const displacementZ = Math.sin(time * kelpWaveSpeed + tempVector.y * 0.2) * kelpWaveIntensity * Math.sin(currentRad);


        // Combine displacements
        tempVector.x += displacementX * bendFactor;
        tempVector.z += displacementZ * swayFactor;

        // Set the modified position
        positions.setXYZ(i, tempVector.x, tempVector.y, tempVector.z);
    }
    positions.needsUpdate = true;
    mesh.geometry.computeVertexNormals(); // Recalculate normals for lighting
}


// Main animation loop
function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta(); // Get the time passed since last frame

    time += deltaTime; // Update global time for kelp animation

    // Deform kelp
    kelp.forEach(function(k) {
        deformKelp(k, time);
    });

    // Update other systems explicitly
    if (window.OceanParticles && window.OceanParticles.update) {
        window.OceanParticles.update(deltaTime);
    }
    if (window.FogSystem && window.FogSystem.animate) { // If FogSystem has an animate function
        window.FogSystem.animate(deltaTime);
    }

    // *** IMPORTANT: Call the OceanSurface update function ***
    if (window.OceanSurface && window.OceanSurface.update) {
        window.OceanSurface.update(deltaTime);
    }

    if (controls) controls.update(); // Update controls if you have them (for damping)
    renderer.render(scene, camera);
}

// Function to start the animation and hide debug info (retained from your original file)
function startAnimation() {
    log('Starting animation...');

    // Hide debug info after successful start
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        setTimeout(() => {
            debugDiv.style.display = 'none';
        }, 3000);
    }

    animate(); // Start the main animation loop
}

// Function to set up UI controls (example, adapt to your actual UI)
function setupUI() {
    const uiContainer = document.querySelector('.ui-container');
    if (!uiContainer) return;

    // Wave Speed Slider (for Ocean Surface)
    const oceanWaveSpeedGroup = document.createElement('div');
    oceanWaveSpeedGroup.className = 'ui-slider-group';
    oceanWaveSpeedGroup.innerHTML = `
        <label for="oceanWaveSpeed">Ocean Wave Speed</label>
        <input type="range" id="oceanWaveSpeed" min="0.1" max="5.0" value="${window.OceanSurface ? window.OceanSurface.config.waveSpeed : 1.2}" step="0.1">
        <span id="oceanWaveSpeedValue">${window.OceanSurface ? window.OceanSurface.config.waveSpeed : 1.2}</span>
    `;
    const oceanWaveSpeedSlider = oceanWaveSpeedGroup.querySelector('#oceanWaveSpeed');
    const oceanWaveSpeedValueSpan = oceanWaveSpeedGroup.querySelector('#oceanWaveSpeedValue');
    oceanWaveSpeedSlider.oninput = (event) => {
        const val = parseFloat(event.target.value);
        if (window.OceanSurface) {
            window.OceanSurface.setProperties({ waveSpeed: val });
        }
        oceanWaveSpeedValueSpan.textContent = val.toFixed(1);
    };
    uiContainer.appendChild(oceanWaveSpeedGroup);


    // Wave Intensity (Amplitude) Slider (for Ocean Surface)
    const oceanWaveIntensityGroup = document.createElement('div');
    oceanWaveIntensityGroup.className = 'ui-slider-group';
    oceanWaveIntensityGroup.innerHTML = `
        <label for="oceanWaveIntensity">Ocean Wave Intensity</label>
        <input type="range" id="oceanWaveIntensity" min="0.1" max="5.0" value="${window.OceanSurface ? window.OceanSurface.config.waveAmplitude : 0.8}" step="0.1">
        <span id="oceanWaveIntensityValue">${window.OceanSurface ? window.OceanSurface.config.waveAmplitude : 0.8}</span>
    `;
    const oceanWaveIntensitySlider = oceanWaveIntensityGroup.querySelector('#oceanWaveIntensity');
    const oceanWaveIntensityValueSpan = oceanWaveIntensityGroup.querySelector('#oceanWaveIntensityValue');
    oceanWaveIntensitySlider.oninput = (event) => {
        const val = parseFloat(event.target.value);
        if (window.OceanSurface) {
            window.OceanSurface.setProperties({ waveAmplitude: val });
        }
        oceanWaveIntensityValueSpan.textContent = val.toFixed(1);
    };
    uiContainer.appendChild(oceanWaveIntensityGroup);

    // Kelp Wave Speed Slider (from your original index.html, for kelp)
    const kelpWaveSpeedGroup = document.createElement('div');
    kelpWaveSpeedGroup.className = 'ui-slider-group';
    kelpWaveSpeedGroup.innerHTML = `
        <label for="kelpWaveSpeed">Kelp Wave Speed</label>
        <input type="range" id="kelpWaveSpeed" min="0.1" max="3" step="0.1" value="${waveSpeed}">
        <span id="kelpWaveSpeedValue">${waveSpeed.toFixed(1)}</span>
    `;
    const kelpWaveSpeedSlider = kelpWaveSpeedGroup.querySelector('#kelpWaveSpeed');
    const kelpWaveSpeedValueSpan = kelpWaveSpeedGroup.querySelector('#kelpWaveSpeedValue');
    kelpWaveSpeedSlider.oninput = (event) => {
        waveSpeed = parseFloat(event.target.value);
        kelpWaveSpeedValueSpan.textContent = waveSpeed.toFixed(1);
    };
    uiContainer.appendChild(kelpWaveSpeedGroup);

    // Kelp Wave Intensity Slider (from your original index.html, for kelp)
    const kelpWaveIntensityGroup = document.createElement('div');
    kelpWaveIntensityGroup.className = 'ui-slider-group';
    kelpWaveIntensityGroup.innerHTML = `
        <label for="kelpWaveIntensity">Kelp Wave Intensity</label>
        <input type="range" id="kelpWaveIntensity" min="0.1" max="3" step="0.1" value="${waveIntensity}">
        <span id="kelpWaveIntensityValue">${waveIntensity.toFixed(1)}</span>
    `;
    const kelpWaveIntensitySlider = kelpWaveIntensityGroup.querySelector('#kelpWaveIntensity');
    const kelpWaveIntensityValueSpan = kelpWaveIntensityGroup.querySelector('#kelpWaveIntensityValue');
    kelpWaveIntensitySlider.oninput = (event) => {
        waveIntensity = parseFloat(event.target.value);
        kelpWaveIntensityValueSpan.textContent = waveIntensity.toFixed(1);
    };
    uiContainer.appendChild(kelpWaveIntensityGroup);

    // Current Direction Slider (from your original index.html, for kelp)
    const currentDirectionGroup = document.createElement('div');
    currentDirectionGroup.className = 'ui-slider-group';
    currentDirectionGroup.innerHTML = `
        <label for="currentDirection">Current Direction</label>
        <input type="range" id="currentDirection" min="0" max="360" step="10" value="${currentDirection}">
        <span id="currentDirectionValue">${currentDirection}</span>
    `;
    const currentDirectionSlider = currentDirectionGroup.querySelector('#currentDirection');
    const currentDirectionValueSpan = currentDirectionGroup.querySelector('#currentDirectionValue');
    currentDirectionSlider.oninput = (event) => {
        currentDirection = parseFloat(event.target.value);
        currentDirectionValueSpan.textContent = currentDirection;
    };
    uiContainer.appendChild(currentDirectionGroup);


    // Add a simple button for ripple effect
    const rippleButton = document.createElement('button');
    rippleButton.textContent = 'Create Ripple (Center)';
    rippleButton.style.marginTop = '10px';
    rippleButton.onclick = () => {
        if (window.OceanSurface && window.OceanSurface.createRipple) {
            // Create a ripple at the center of the plane, or where your kelp is
            window.OceanSurface.createRipple(0, 0, 3.0); // x, z, intensity
        }
    };
    uiContainer.appendChild(rippleButton);

    log('UI controls setup.');
}


// Start the Three.js application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
