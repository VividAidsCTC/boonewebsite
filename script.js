// Debug version to check GLTF loading
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== GLTF DEBUG VERSION ===');
    
    // Check if Three.js loaded
    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded');
        updateLoadingStatus('Error: Three.js failed to load');
        return;
    }
    console.log('✓ Three.js loaded');
    
    // Check if GLTFLoader loaded
    if (typeof THREE.GLTFLoader === 'undefined') {
        console.error('GLTFLoader not loaded');
        updateLoadingStatus('Error: GLTFLoader failed to load');
        return;
    }
    console.log('✓ GLTFLoader loaded');
    
    // Check the actual URL we're trying to load
    const gltfUrl = './scene.gltf';
    console.log('Attempting to load GLTF from:', window.location.origin + '/' + gltfUrl);
    
    // Test if the file exists
    fetch(gltfUrl)
        .then(response => {
            console.log('GLTF file response:', response.status, response.statusText);
            if (response.ok) {
                console.log('✓ GLTF file is accessible');
                startKelpForest();
            } else {
                console.error('✗ GLTF file not accessible:', response.status);
                updateLoadingStatus(`Error: scene.gltf not found (${response.status})`);
                startKelpForest(); // Still start but will use fallback
            }
        })
        .catch(error => {
            console.error('✗ Error checking GLTF file:', error);
            updateLoadingStatus('Error: Cannot access scene.gltf');
            startKelpForest(); // Still start but will use fallback
        });
});

function updateLoadingStatus(message) {
    const statusElement = document.getElementById('loadingStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
    console.log('Status:', message);
}

function startKelpForest() {
    console.log('Starting kelp forest...');
    
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Create background
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#4499dd');
    gradient.addColorStop(1, '#001133');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    const gradientTexture = new THREE.CanvasTexture(canvas);
    scene.background = gradientTexture;
    
    const container = document.getElementById('container');
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x4488cc, 0.6);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0x88ccff, 1.5);
    sunLight.position.set(0, 50, 10);
    scene.add(sunLight);

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshPhongMaterial({ color: 0x371c00 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    scene.add(floor);

    // Animation controls
    let waveSpeed = 1.5;
    let waveIntensity = 1.2;
    let currentDirection = 45;
    let gltfLoaded = false;

    // Try to load GLTF
    console.log('Creating GLTFLoader...');
    const loader = new THREE.GLTFLoader();
    
    updateLoadingStatus('Loading scene.gltf...');
    console.log('Loading GLTF from: ./scene.gltf');
    
    loader.load(
        './scene.gltf',
        
        // Success callback
        function(gltf) {
            console.log('🎉 GLTF LOADED SUCCESSFULLY!', gltf);
            gltfLoaded = true;
            
            const model = gltf.scene;
            console.log('GLTF scene object:', model);
            console.log('GLTF scene children:', model.children);
            
            // Log all objects in the scene
            model.traverse(function(child) {
                console.log('GLTF object:', child.name, child.type, child);
                if (child.isMesh) {
                    console.log('  - Mesh found:', child.name, 'Material:', child.material.name);
                }
            });
            
            // Add the model to the scene
            scene.add(model);
            console.log('✓ GLTF model added to scene');
            
            // Position camera to view the model
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            console.log('Model bounding box:', box);
            console.log('Model size:', size);
            console.log('Model center:', center);
            
            // Position camera
            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = maxDim * 3; // Increased distance to see whole model
            
            camera.position.set(center.x + distance, center.y + size.y, center.z + distance);
            camera.lookAt(center);
            
            console.log('Camera positioned at:', camera.position);
            console.log('Camera looking at:', center);
            
            updateLoadingStatus('GLTF model loaded successfully!');
        },
        
        // Progress callback
        function(progress) {
            const percent = (progress.loaded / progress.total * 100).toFixed(1);
            console.log('Loading progress:', percent + '%');
            updateLoadingStatus(`Loading: ${percent}%`);
        },
        
        // Error callback
        function(error) {
            console.error('❌ GLTF LOADING FAILED:', error);
            console.error('Error details:', error.message);
            updateLoadingStatus('GLTF loading failed - using fallback');
            
            // Create fallback kelp
            createFallbackKelp();
        }
    );

    // Fallback kelp creation
    function createFallbackKelp() {
        console.log('Creating fallback kelp...');
        
        // Create just one test kelp to start
        const geometry = new THREE.CylinderGeometry(0.2, 0.4, 8, 8, 10);
        const material = new THREE.MeshPhongMaterial({ color: 0x228B22 });
        const kelpMesh = new THREE.Mesh(geometry, material);
        kelpMesh.position.set(0, 4, 0);
        scene.add(kelpMesh);
        
        camera.position.set(0, 8, 15);
        camera.lookAt(0, 4, 0);
        
        console.log('✓ Fallback kelp created');
        updateLoadingStatus('Using fallback kelp');
    }

    // Camera controls
    let targetRotationX = 0, targetRotationY = 0;
    let rotationX = 0, rotationY = 0;
    let distance = 30;
    let isMouseDown = false;

    document.addEventListener('mousedown', () => isMouseDown = true);
    document.addEventListener('mouseup', () => isMouseDown = false);
    
    document.addEventListener('mousemove', function(event) {
        if (isMouseDown) {
            targetRotationY += event.movementX * 0.01;
            targetRotationX += event.movementY * 0.01;
        }
    });

    // Sliders
    document.getElementById('waveSpeed').addEventListener('input', function(e) {
        waveSpeed = parseFloat(e.target.value);
        console.log('Wave speed changed to:', waveSpeed);
    });

    document.getElementById('waveIntensity').addEventListener('input', function(e) {
        waveIntensity = parseFloat(e.target.value);
        console.log('Wave intensity changed to:', waveIntensity);
    });

    document.getElementById('currentDirection').addEventListener('input', function(e) {
        currentDirection = parseFloat(e.target.value);
        console.log('Current direction changed to:', currentDirection);
    });

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        // Camera movement
        rotationX += (targetRotationX - rotationX) * 0.05;
        rotationY += (targetRotationY - rotationY) * 0.05;
        
        camera.position.x = Math.sin(rotationY) * Math.cos(rotationX) * distance;
        camera.position.y = Math.sin(rotationX) * distance + 10;
        camera.position.z = Math.cos(rotationY) * Math.cos(rotationX) * distance;
        camera.lookAt(0, 0, 0);
        
        renderer.render(scene, camera);
    }

    // Window resize
    window.addEventListener('resize', function() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    console.log('Starting animation...');
    animate();
}
