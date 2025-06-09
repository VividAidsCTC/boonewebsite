// Wait for Three.js and GLTFLoader to load
document.addEventListener('DOMContentLoaded', function() {
    // Check if Three.js loaded
    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded');
        updateLoadingStatus('Error: Three.js failed to load');
        return;
    }
    
    // Check if GLTFLoader loaded
    if (typeof THREE.GLTFLoader === 'undefined') {
        console.error('GLTFLoader not loaded');
        updateLoadingStatus('Error: GLTFLoader failed to load');
        return;
    }
    
    console.log('Starting GLTF kelp forest animation');
    updateLoadingStatus('Initializing scene...');
    startKelpForest();
});

function updateLoadingStatus(message) {
    const statusElement = document.getElementById('loadingStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function startKelpForest() {
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Enable shadows for better GLTF rendering
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Create blue gradient background
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    // Create gradient from light blue (top) to dark blue (bottom)
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#4499dd'); // Light blue at top
    gradient.addColorStop(1, '#001133'); // Dark blue at bottom
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    
    const gradientTexture = new THREE.CanvasTexture(canvas);
    scene.background = gradientTexture;
    
    const container = document.getElementById('container');
    container.appendChild(renderer.domElement);

    // Enhanced lighting for GLTF models
    const ambientLight = new THREE.AmbientLight(0x4488cc, 0.6); // Brighter ambient
    scene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0x88ccff, 1.5);
    sunLight.position.set(0, 50, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);
    
    const rimLight1 = new THREE.DirectionalLight(0x5599dd, 0.6);
    rimLight1.position.set(20, 20, 0);
    scene.add(rimLight1);
    
    const rimLight2 = new THREE.DirectionalLight(0x4488cc, 0.4);
    rimLight2.position.set(-20, 15, 0);
    scene.add(rimLight2);

    // Create seafloor
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x371c00,
        shininess: 4
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    floor.receiveShadow = true;
    scene.add(floor);

    // Animation controls
    let waveSpeed = 1.5;
    let waveIntensity = 1.2;
    let currentDirection = 45;

    // GLTF model variables
    let gltfScene = null;
    let kelpMeshes = [];
    let originalPositions = [];

    // Load GLTF model
    updateLoadingStatus('Loading scene.gltf...');
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        './scene.gltf',
        
        // onLoad callback
        function(gltf) {
            console.log('GLTF loaded successfully', gltf);
            updateLoadingStatus('Model loaded! Setting up animation...');
            
            gltfScene = gltf.scene;
            
            // Scale and position the model appropriately
            gltfScene.scale.set(1, 1, 1); // Adjust scale as needed
            gltfScene.position.set(0, 0, 0); // Adjust position as needed
            
            // Enable shadows on all meshes
            gltfScene.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    // Store kelp meshes for animation
                    if (child.name.toLowerCase().includes('kelp') || 
                        child.material.name.toLowerCase().includes('kelp') ||
                        child.geometry) {
                        
                        kelpMeshes.push(child);
                        
                        // Store original positions for animation
                        const positions = child.geometry.attributes.position.array.slice();
                        originalPositions.push({
                            mesh: child,
                            originalPositions: positions,
                            offset1: Math.random() * Math.PI * 2,
                            offset2: Math.random() * Math.PI * 2,
                            offset3: Math.random() * Math.PI * 2,
                            freq1: 0.8 + Math.random() * 0.6,
                            freq2: 1.1 + Math.random() * 0.8,
                            freq3: 0.5 + Math.random() * 0.4,
                            amplitude1: 0.8 + Math.random() * 0.6,
                            amplitude2: 0.6 + Math.random() * 0.5,
                            amplitude3: 0.4 + Math.random() * 0.3
                        });
                        
                        console.log('Found kelp mesh:', child.name);
                    }
                }
            });
            
            scene.add(gltfScene);
            console.log('GLTF scene added to Three.js scene');
            console.log('Found', kelpMeshes.length, 'kelp meshes for animation');
            
            updateLoadingStatus('Ready! Use controls to adjust animation.');
            
            // Position camera to view the model
            positionCameraForModel(gltfScene);
        },
        
        // onProgress callback
        function(progress) {
            const percentComplete = (progress.loaded / progress.total * 100).toFixed(1);
            updateLoadingStatus(`Loading: ${percentComplete}%`);
            console.log('Loading progress:', percentComplete + '%');
        },
        
        // onError callback
        function(error) {
            console.error('Error loading GLTF:', error);
            updateLoadingStatus('Error: Failed to load scene.gltf. Check console for details.');
            
            // Fallback: create a simple placeholder
            createFallbackKelp();
        }
    );

    // Function to position camera appropriately for the loaded model
    function positionCameraForModel(model) {
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        console.log('Model size:', size);
        console.log('Model center:', center);
        
        // Position camera based on model size
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;
        
        camera.position.set(center.x, center.y + size.y * 0.5, center.z + distance);
        camera.lookAt(center);
        
        console.log('Camera positioned at:', camera.position);
    }

    // Fallback function to create simple kelp if GLTF fails
    function createFallbackKelp() {
        console.log('Creating fallback kelp...');
        updateLoadingStatus('Using fallback geometry...');
        
        for(let i = 0; i < 10; i++) {
            const kelpHeight = 8 + Math.random() * 12;
            const kelpRadius = 0.2 + Math.random() * 0.3;
            
            const geometry = new THREE.CylinderGeometry(kelpRadius * 0.5, kelpRadius, kelpHeight, 8, 10);
            const material = new THREE.MeshPhongMaterial({
                color: new THREE.Color(0.2, 0.6, 0.3),
                transparent: true,
                opacity: 0.8
            });
            
            const kelpMesh = new THREE.Mesh(geometry, material);
            kelpMesh.position.x = (Math.random() - 0.5) * 20;
            kelpMesh.position.z = (Math.random() - 0.5) * 20;
            kelpMesh.position.y = kelpHeight / 2;
            kelpMesh.castShadow = true;
            
            scene.add(kelpMesh);
            kelpMeshes.push(kelpMesh);
            
            // Store original positions
            const positions = geometry.attributes.position.array.slice();
            originalPositions.push({
                mesh: kelpMesh,
                originalPositions: positions,
                offset1: Math.random() * Math.PI * 2,
                offset2: Math.random() * Math.PI * 2,
                offset3: Math.random() * Math.PI * 2,
                freq1: 0.8 + Math.random() * 0.6,
                freq2: 1.1 + Math.random() * 0.8,
                freq3: 0.5 + Math.random() * 0.4,
                amplitude1: 0.8 + Math.random() * 0.6,
                amplitude2: 0.6 + Math.random() * 0.5,
                amplitude3: 0.4 + Math.random() * 0.3
            });
        }
        
        // Position camera for fallback kelp
        camera.position.set(0, 8, 15);
        camera.lookAt(0, 4, 0);
        
        updateLoadingStatus('Fallback kelp ready!');
    }

    // Camera controls
    let targetRotationX = 0, targetRotationY = 0;
    let rotationX = 0, rotationY = 0;
    let distance = 30;
    let isMouseDown = false;

    // Mouse controls
    document.addEventListener('mousedown', function() { isMouseDown = true; });
    document.addEventListener('mouseup', function() { isMouseDown = false; });
    
    document.addEventListener('mousemove', function(event) {
        if (isMouseDown) {
            targetRotationY += event.movementX * 0.01;
            targetRotationX += event.movementY * 0.01;
            targetRotationX = Math.max(-Math.PI/3, Math.min(Math.PI/3, targetRotationX));
        }
    });

    document.addEventListener('wheel', function(event) {
        distance += event.deltaY * 0.02;
        distance = Math.max(5, Math.min(100, distance));
    });

    // Working sliders
    const waveSpeedSlider = document.getElementById('waveSpeed');
    const waveIntensitySlider = document.getElementById('waveIntensity');
    const currentDirectionSlider = document.getElementById('currentDirection');

    waveSpeedSlider.addEventListener('input', function(e) {
        waveSpeed = parseFloat(e.target.value);
        console.log('Wave speed:', waveSpeed);
    });

    waveIntensitySlider.addEventListener('input', function(e) {
        waveIntensity = parseFloat(e.target.value);
        console.log('Wave intensity:', waveIntensity);
    });

    currentDirectionSlider.addEventListener('input', function(e) {
        currentDirection = parseFloat(e.target.value);
        console.log('Current direction:', currentDirection);
    });

    // Animation variables
    let time = 0;

    // Function to deform kelp geometry for bending (works with GLTF meshes)
    function deformKelp(kelpData, time) {
        const mesh = kelpData.mesh;
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;
        const originalPositions = kelpData.originalPositions;
        
        if (!positions || !originalPositions) return;
        
        // Convert direction to radians
        const dirRad = (currentDirection * Math.PI) / 180;
        
        // Calculate wave values
        const wave1 = Math.sin(time * kelpData.freq1 + kelpData.offset1) * kelpData.amplitude1;
        const wave2 = Math.cos(time * kelpData.freq2 + kelpData.offset2) * kelpData.amplitude2;
        const wave3 = Math.sin(time * kelpData.freq3 + kelpData.offset3) * kelpData.amplitude3;
        
        // Get bounding box for height calculations
        if (!mesh.userData.boundingBox) {
            const box = new THREE.Box3().setFromObject(mesh);
            mesh.userData.boundingBox = box;
        }
        
        const boundingBox = mesh.userData.boundingBox;
        const height = boundingBox.max.y - boundingBox.min.y;
        
        // Deform each vertex
        for (let i = 0; i < positions.count; i++) {
            const i3 = i * 3;
            
            // Get original position
            const originalX = originalPositions[i3];
            const originalY = originalPositions[i3 + 1];
            const originalZ = originalPositions[i3 + 2];
            
            // Calculate height factor (0 at bottom, 1 at top)
            const heightFactor = height > 0 ? (originalY - boundingBox.min.y) / height : 0;
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

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        time += 0.01 * waveSpeed;
        
        // Animate all kelp meshes (both GLTF and fallback)
        originalPositions.forEach(function(kelpData) {
            deformKelp(kelpData, time);
        });
        
        // Camera movement
        rotationX += (targetRotationX - rotationX) * 0.05;
        rotationY += (targetRotationY - rotationY) * 0.05;
        
        camera.position.x = Math.sin(rotationY) * Math.cos(rotationX) * distance;
        camera.position.y = Math.sin(rotationX) * distance + 10;
        camera.position.z = Math.cos(rotationY) * Math.cos(rotationX) * distance;
        
        // Look at the center of the scene or the loaded model
        if (gltfScene) {
            const box = new THREE.Box3().setFromObject(gltfScene);
            const center = box.getCenter(new THREE.Vector3());
            camera.lookAt(center);
        } else {
            camera.lookAt(0, 8, 0);
        }
        
        renderer.render(scene, camera);
    }

    // Handle window resize
    window.addEventListener('resize', function() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    console.log('Starting GLTF kelp animation');
    animate();
}
