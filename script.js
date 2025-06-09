// Animated Kelp Forest GLB Loader
document.addEventListener('DOMContentLoaded', function() {
    console.log('🌊 Starting Animated Kelp Forest from GLB...');
    
    // Check if Three.js loaded
    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded');
        updateLoadingStatus('Error: Three.js failed to load');
        return;
    }
    console.log('✅ Three.js loaded');
    
    // Check if GLTFLoader loaded
    if (typeof THREE.GLTFLoader === 'undefined') {
        console.error('GLTFLoader not loaded');
        updateLoadingStatus('Error: GLTFLoader failed to load');
        return;
    }
    console.log('✅ GLTFLoader loaded');
    
    startKelpForest();
});

function updateLoadingStatus(message) {
    const statusElement = document.getElementById('loadingStatus');
    if (statusElement) {
        statusElement.textContent = message;
    }
    console.log('📢 Status:', message);
}

function startKelpForest() {
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Enable shadows for better visual quality
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    
    // Create underwater atmosphere background
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    // Create underwater gradient
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#87CEEB'); // Light blue at top (surface)
    gradient.addColorStop(0.3, '#4682B4'); // Steel blue
    gradient.addColorStop(0.7, '#2F4F4F'); // Dark slate gray
    gradient.addColorStop(1, '#191970'); // Midnight blue at bottom
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    
    const gradientTexture = new THREE.CanvasTexture(canvas);
    scene.background = gradientTexture;
    
    const container = document.getElementById('container');
    container.appendChild(renderer.domElement);

    // Enhanced underwater lighting
    const ambientLight = new THREE.AmbientLight(0x87CEEB, 0.4); // Soft blue ambient
    scene.add(ambientLight);
    
    // Main sunlight filtering through water
    const sunLight = new THREE.DirectionalLight(0xB0E0E6, 1.2);
    sunLight.position.set(20, 50, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    scene.add(sunLight);
    
    // Underwater caustic-like lighting
    const causticLight1 = new THREE.SpotLight(0x00CED1, 0.6, 30, Math.PI / 6, 0.3);
    causticLight1.position.set(10, 15, 5);
    scene.add(causticLight1);
    
    const causticLight2 = new THREE.SpotLight(0x20B2AA, 0.4, 25, Math.PI / 8, 0.4);
    causticLight2.position.set(-8, 12, -3);
    scene.add(causticLight2);
    
    // Rim lighting for depth
    const rimLight = new THREE.DirectionalLight(0x4682B4, 0.3);
    rimLight.position.set(-10, 5, -10);
    scene.add(rimLight);

    // Create sandy seafloor
    const floorGeometry = new THREE.PlaneGeometry(100, 100, 20, 20);
    const floorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xDEB887, // Sandy brown
        shininess: 10,
        transparent: true,
        opacity: 0.9
    });
    
    // Add some texture variation to the floor
    const vertices = floorGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 2] += Math.random() * 0.5 - 0.25; // Random height variation
    }
    floorGeometry.attributes.position.needsUpdate = true;
    floorGeometry.computeVertexNormals();
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -5;
    floor.receiveShadow = true;
    scene.add(floor);

    // Animation and control variables
    let animationSpeed = 1.0;
    let waveIntensity = 1.0;
    let currentDirection = 0;
    let cameraDistance = 10;
    
    // GLB model variables
    let kelpModel = null;
    let mixer = null; // For animations
    let kelpMeshes = [];
    let originalPositions = new Map();

    // Load GLB model
    updateLoadingStatus('Loading animated_kelp.glb...');
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        './animated_kelp.glb',
        
        // Success callback
        function(gltf) {
            console.log('🎉 GLB loaded successfully!', gltf);
            updateLoadingStatus('GLB loaded! Setting up scene...');
            
            kelpModel = gltf.scene;
            
            // Log model information
            console.log('📊 GLB structure:', {
                animations: gltf.animations.length,
                scenes: gltf.scenes.length,
                cameras: gltf.cameras.length
            });
            
            // Scale and position the model
            const box = new THREE.Box3().setFromObject(kelpModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            console.log('📏 Model dimensions:', size);
            console.log('🎯 Model center:', center);
            
            // Auto-scale if the model is too large or small
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 20 || maxDim < 1) {
                const scale = maxDim > 20 ? 20 / maxDim : 2 / maxDim;
                kelpModel.scale.setScalar(scale);
                console.log(`🔧 Auto-scaled model by factor: ${scale.toFixed(2)}`);
            }
            
            // Center the model
            kelpModel.position.set(-center.x, -center.y, -center.z);
            
            // Enable shadows and collect meshes
            let meshCount = 0;
            kelpModel.traverse(function(child) {
                console.log(`🔍 Object: ${child.name || 'unnamed'} (${child.type})`);
                
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    meshCount++;
                    
                    // Store kelp meshes for custom animation
                    if (child.name.toLowerCase().includes('kelp') || 
                        child.material.name.toLowerCase().includes('kelp') || 
                        meshCount <= 10) { // Assume first 10 meshes are kelp
                        
                        kelpMeshes.push(child);
                        
                        // Store original vertex positions for deformation
                        if (child.geometry && child.geometry.attributes.position) {
                            const positions = child.geometry.attributes.position.array.slice();
                            originalPositions.set(child, {
                                positions: positions,
                                offset1: Math.random() * Math.PI * 2,
                                offset2: Math.random() * Math.PI * 2,
                                freq1: 0.5 + Math.random() * 0.8,
                                freq2: 0.3 + Math.random() * 0.6,
                                amplitude1: 0.8 + Math.random() * 0.6,
                                amplitude2: 0.6 + Math.random() * 0.5
                            });
                        }
                        
                        console.log(`🌱 Kelp mesh found: ${child.name}`);
                    }
                    
                    // Enhance materials for underwater look
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => enhanceMaterial(mat));
                        } else {
                            enhanceMaterial(child.material);
                        }
                    }
                }
            });
            
            console.log(`📈 Total meshes: ${meshCount}, Kelp meshes: ${kelpMeshes.length}`);
            
            // Setup animations if they exist
            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(kelpModel);
                
                gltf.animations.forEach((clip, index) => {
                    console.log(`🎬 Animation ${index}: ${clip.name}, duration: ${clip.duration.toFixed(2)}s`);
                    const action = mixer.clipAction(clip);
                    action.play();
                });
                
                console.log(`✨ Started ${gltf.animations.length} animations`);
            }
            
            scene.add(kelpModel);
            
            // Position camera to view the model nicely
            positionCamera();
            
            updateLoadingStatus('Animated kelp forest ready!');
        },
        
        // Progress callback
        function(progress) {
            const percent = progress.total > 0 ? 
                (progress.loaded / progress.total * 100).toFixed(1) : 
                '...';
            updateLoadingStatus(`Loading GLB: ${percent}%`);
            console.log(`📥 Loading progress: ${percent}%`);
        },
        
        // Error callback
        function(error) {
            console.error('❌ GLB loading failed:', error);
            updateLoadingStatus('Error: Failed to load animated_kelp.glb');
            
            // Create fallback kelp
            createFallbackKelp();
        }
    );

    // Enhance materials for underwater appearance
    function enhanceMaterial(material) {
        if (material.isMeshStandardMaterial || material.isMeshPhongMaterial) {
            // Add slight transparency and underwater tint
            material.transparent = true;
            material.opacity = Math.max(0.8, material.opacity || 1);
            
            // Enhance colors for underwater look
            if (material.color) {
                material.color.multiplyScalar(0.9); // Slightly darker
            }
        }
    }

    // Position camera based on model size
    function positionCamera() {
        if (!kelpModel) return;
        
        const box = new THREE.Box3().setFromObject(kelpModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = Math.max(maxDim * 1.5, cameraDistance);
        
        camera.position.set(
            center.x + distance * 0.7,
            center.y + size.y * 0.3,
            center.z + distance
        );
        camera.lookAt(center);
        
        console.log(`📷 Camera positioned at distance: ${distance.toFixed(2)}`);
    }

    // Fallback kelp creation
    function createFallbackKelp() {
        console.log('🔄 Creating fallback kelp...');
        
        for (let i = 0; i < 8; i++) {
            const height = 5 + Math.random() * 8;
            const radius = 0.1 + Math.random() * 0.2;
            
            const geometry = new THREE.CylinderGeometry(radius * 0.3, radius, height, 8, 15);
            const material = new THREE.MeshPhongMaterial({
                color: new THREE.Color(0.1, 0.4 + Math.random() * 0.3, 0.2),
                transparent: true,
                opacity: 0.85
            });
            
            const kelpMesh = new THREE.Mesh(geometry, material);
            kelpMesh.position.set(
                (Math.random() - 0.5) * 15,
                height / 2 - 2,
                (Math.random() - 0.5) * 15
            );
            kelpMesh.castShadow = true;
            
            scene.add(kelpMesh);
            kelpMeshes.push(kelpMesh);
            
            // Store original positions for animation
            const positions = geometry.attributes.position.array.slice();
            originalPositions.set(kelpMesh, {
                positions: positions,
                offset1: Math.random() * Math.PI * 2,
                offset2: Math.random() * Math.PI * 2,
                freq1: 0.5 + Math.random() * 0.8,
                freq2: 0.3 + Math.random() * 0.6,
                amplitude1: 0.8 + Math.random() * 0.6,
                amplitude2: 0.6 + Math.random() * 0.5
            });
        }
        
        positionCamera();
        updateLoadingStatus('Fallback kelp ready!');
    }

    // Camera controls
    let targetRotationX = 0, targetRotationY = 0;
    let rotationX = 0, rotationY = 0;
    let isMouseDown = false;

    // Mouse controls
    document.addEventListener('mousedown', () => isMouseDown = true);
    document.addEventListener('mouseup', () => isMouseDown = false);
    
    document.addEventListener('mousemove', function(event) {
        if (isMouseDown) {
            targetRotationY += event.movementX * 0.01;
            targetRotationX += event.movementY * 0.01;
            targetRotationX = Math.max(-Math.PI/3, Math.min(Math.PI/3, targetRotationX));
        }
    });

    document.addEventListener('wheel', function(event) {
        cameraDistance += event.deltaY * 0.01;
        cameraDistance = Math.max(2, Math.min(50, cameraDistance));
        
        // Update slider
        const distanceSlider = document.getElementById('cameraDistance');
        if (distanceSlider) {
            distanceSlider.value = cameraDistance;
            document.getElementById('distanceValue').textContent = cameraDistance.toFixed(1);
        }
    });

    // Control sliders
    function setupControls() {
        // Animation Speed
        const speedSlider = document.getElementById('animationSpeed');
        if (speedSlider) {
            speedSlider.addEventListener('input', function(e) {
                animationSpeed = parseFloat(e.target.value);
                document.getElementById('speedValue').textContent = animationSpeed.toFixed(1);
                console.log('🏃 Animation speed:', animationSpeed);
            });
        }

        // Wave Intensity  
        const intensitySlider = document.getElementById('waveIntensity');
        if (intensitySlider) {
            intensitySlider.addEventListener('input', function(e) {
                waveIntensity = parseFloat(e.target.value);
                document.getElementById('intensityValue').textContent = waveIntensity.toFixed(1);
                console.log('🌊 Wave intensity:', waveIntensity);
            });
        }

        // Current Direction
        const directionSlider = document.getElementById('currentDirection');
        if (directionSlider) {
            directionSlider.addEventListener('input', function(e) {
                currentDirection = parseFloat(e.target.value);
                document.getElementById('directionValue').textContent = currentDirection;
                console.log('🧭 Current direction:', currentDirection);
            });
        }

        // Camera Distance
        const distanceSlider = document.getElementById('cameraDistance');
        if (distanceSlider) {
            distanceSlider.addEventListener('input', function(e) {
                cameraDistance = parseFloat(e.target.value);
                document.getElementById('distanceValue').textContent = cameraDistance.toFixed(1);
                console.log('📷 Camera distance:', cameraDistance);
            });
        }
    }

    // Custom kelp deformation for additional wave effects
    function deformKelp(mesh, time) {
        const data = originalPositions.get(mesh);
        if (!data || !mesh.geometry.attributes.position) return;

        const positions = mesh.geometry.attributes.position;
        const originalPos = data.positions;
        
        // Convert direction to radians
        const dirRad = (currentDirection * Math.PI) / 180;
        
        // Calculate wave values
        const wave1 = Math.sin(time * data.freq1 + data.offset1) * data.amplitude1;
        const wave2 = Math.cos(time * data.freq2 + data.offset2) * data.amplitude2;
        
        // Get mesh bounding box for height calculations
        const box = new THREE.Box3().setFromObject(mesh);
        const height = box.max.y - box.min.y;
        
        // Deform vertices
        for (let i = 0; i < positions.count; i++) {
            const i3 = i * 3;
            
            const originalX = originalPos[i3];
            const originalY = originalPos[i3 + 1];
            const originalZ = originalPos[i3 + 2];
            
            // Height factor (0 at bottom, 1 at top)
            const heightFactor = height > 0 ? (originalY - box.min.y) / height : 0;
            const heightFactorSquared = heightFactor * heightFactor;
            
            // Apply wave deformation
            const bendAmountX = (wave1 + wave2 * 0.6) * waveIntensity * heightFactorSquared * 0.5;
            const bendAmountZ = (wave2 + wave1 * 0.4) * waveIntensity * heightFactorSquared * 0.5;
            
            // Apply directional influence
            const finalBendX = bendAmountX * Math.cos(dirRad) + bendAmountZ * Math.sin(dirRad) * 0.3;
            const finalBendZ = bendAmountZ * Math.sin(dirRad) + bendAmountX * Math.cos(dirRad) * 0.3;
            
            positions.setX(i, originalX + finalBendX);
            positions.setY(i, originalY);
            positions.setZ(i, originalZ + finalBendZ);
        }
        
        positions.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
    }

    // Animation loop
    const clock = new THREE.Clock();
    let time = 0;

    function animate() {
        requestAnimationFrame(animate);
        
        const deltaTime = clock.getDelta();
        time += deltaTime * animationSpeed;
        
        // Update GLB animations
        if (mixer) {
            mixer.update(deltaTime * animationSpeed);
        }
        
        // Apply custom wave deformation to kelp meshes
        kelpMeshes.forEach(mesh => {
            deformKelp(mesh, time);
        });
        
        // Update caustic lights (moving underwater light patterns)
        causticLight1.position.x = Math.sin(time * 0.3) * 8;
        causticLight1.position.z = Math.cos(time * 0.4) * 6;
        causticLight2.position.x = Math.cos(time * 0.25) * -6;
        causticLight2.position.z = Math.sin(time * 0.35) * 8;
        
        // Camera movement
        rotationX += (targetRotationX - rotationX) * 0.05;
        rotationY += (targetRotationY - rotationY) * 0.05;
        
        if (kelpModel) {
            const box = new THREE.Box3().setFromObject(kelpModel);
            const center = box.getCenter(new THREE.Vector3());
            
            camera.position.x = Math.sin(rotationY) * Math.cos(rotationX) * cameraDistance + center.x;
            camera.position.y = Math.sin(rotationX) * cameraDistance + center.y;
            camera.position.z = Math.cos(rotationY) * Math.cos(rotationX) * cameraDistance + center.z;
            camera.lookAt(center);
        }
        
        renderer.render(scene, camera);
    }

    // Handle window resize
    window.addEventListener('resize', function() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Initialize controls
    setupControls();
    
    console.log('🎬 Starting animation loop...');
    animate();
}
