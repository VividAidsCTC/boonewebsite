// Safe Kelp System - No Custom Shaders to Avoid Fog Issues
// Global variables
let scene, camera, renderer;
let kelp = [];
let waveSpeed = 0.8;
let waveIntensity = 0.6;
let currentDirection = 45;
let time = 0;

// Camera controls
let targetRotationX = 0, targetRotationY = 0;
let rotationX = 0, rotationY = 0;
let distance = 30;
let isMouseDown = false;

// Floor texture variables
let floorTextures = {
    diffuse: null,
    normal: null,
    roughness: null,
    displacement: null
};
let textureLoader = new THREE.TextureLoader();

// Floor creation functions
function createTexturedFloor() {
    log('Creating textured seafloor...');
    
    const floorGeometry = new THREE.PlaneGeometry(1000, 1000, 256, 256);
    
    let floorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x302114,
        shininess: 2,
        specular: 0x332211
    });
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    floor.receiveShadow = true;
    scene.add(floor);
    
    window.seafloor = floor;
    return floor;
}

function loadGroundTextures(texturePaths) {
    log('Loading ground textures...');
    
    const loadPromises = [];
    
    if (texturePaths.diffuse) {
        const diffusePromise = new Promise((resolve, reject) => {
            textureLoader.load(
                texturePaths.diffuse,
                (texture) => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(8, 8);
                    floorTextures.diffuse = texture;
                    log('Diffuse texture loaded successfully');
                    resolve(texture);
                },
                (progress) => log(`Diffuse texture loading: ${Math.round((progress.loaded/progress.total)*100)}%`),
                (error) => {
                    log('Error loading diffuse texture: ' + error);
                    reject(error);
                }
            );
        });
        loadPromises.push(diffusePromise);
    }
    
    if (texturePaths.normal) {
        const normalPromise = new Promise((resolve, reject) => {
            textureLoader.load(
                texturePaths.normal,
                (texture) => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(8, 8);
                    floorTextures.normal = texture;
                    log('Normal map loaded successfully');
                    resolve(texture);
                },
                (progress) => log(`Normal map loading: ${Math.round((progress.loaded/progress.total)*100)}%`),
                (error) => {
                    log('Error loading normal map: ' + error);
                    reject(error);
                }
            );
        });
        loadPromises.push(normalPromise);
    }
    
    Promise.allSettled(loadPromises).then(() => {
        updateFloorMaterial();
    });
}

function updateFloorMaterial() {
    if (!window.seafloor) {
        log('Error: Seafloor mesh not found');
        return;
    }
    
    log('Updating floor material with textures...');
    
    const materialProps = {
        color: floorTextures.diffuse ? 0xffffff : 0x302114,
        shininess: 5,
        specular: 0x333333
    };
    
    if (floorTextures.diffuse) {
        materialProps.map = floorTextures.diffuse;
    }
    
    if (floorTextures.normal) {
        materialProps.normalMap = floorTextures.normal;
        materialProps.normalScale = new THREE.Vector2(0.5, 0.5);
    }
    
    const newMaterial = new THREE.MeshPhongMaterial(materialProps);
    window.seafloor.material.dispose();
    window.seafloor.material = newMaterial;
    
    log('Floor material updated with textures');
}

function loadSeafloorTextures() {
    const texturePaths = {  
        diffuse: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/textures/Ground059_1K-JPG_Color.jpg',
        normal: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/textures/Ground059_1K-JPG_NormalGL.jpg',
        roughness: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/textures/Ground059_1K-JPG_Roughness.jpg',
        displacement: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/textures/Ground059_1K-JPG_Displacement.jpg'
    };
    
    loadGroundTextures(texturePaths);
}

// Debug logging function
function log(message) {
    console.log(message);
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        debugDiv.innerHTML += message + '<br>';
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
}

// Scene initialization
function initializeScene() {
    log('Initializing Three.js scene...');

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Background
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    const context = canvas.getContext('2d');
    context.fillStyle = '#2f6992';
    context.fillRect(0, 0, 1000, 1000);
    const gradientTexture = new THREE.CanvasTexture(canvas);
    scene.background = gradientTexture;

    // Add to DOM
    const container = document.getElementById('container');
    if (!container) {
        log('ERROR: Container element not found');
        return;
    }
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x6699bb, 0.3);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xaaccdd, 0.8);
    sunLight.position.set(0, 50, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    const rimLight1 = new THREE.DirectionalLight(0x7799cc, 0.3);
    rimLight1.position.set(20, 20, 0);
    scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0x6688bb, 0.25);
    rimLight2.position.set(-20, 15, 0);
    scene.add(rimLight2);

    const floorLight = new THREE.DirectionalLight(0x7aacbe, 0.2);
    floorLight.position.set(0, -30, 0);
    scene.add(floorLight);

    // Create floor
    const floor = createTexturedFloor();
    
    // Load textures after delay
    setTimeout(() => {
        loadSeafloorTextures();
    }, 1000);

    log('Scene initialized successfully');
}

// CPU-based vertex deformation function for smooth kelp animation
function deformKelp(kelpMesh, time) {
    if (kelpMesh.userData.isGLTF) {
        // Handle GLTF models - traverse and deform each mesh
        const userData = kelpMesh.userData;
        const dirRad = (currentDirection * Math.PI) / 180;
        
        // Keep base position fixed
        kelpMesh.position.x = userData.originalX;
        kelpMesh.position.z = userData.originalZ;
        kelpMesh.position.y = userData.originalY;
        
        // Calculate wave values
        const wave1 = Math.sin(time * userData.frequency + userData.offset) * userData.amplitude;
        const wave2 = Math.cos(time * userData.frequency * 1.3 + userData.offset + Math.PI/3) * userData.amplitude * 0.7;
        const wave3 = Math.sin(time * userData.frequency * 0.7 + userData.offset + Math.PI/2) * userData.amplitude * 0.5;
        
        // Deform each mesh in the GLTF model
        kelpMesh.traverse((child) => {
            if (child.isMesh && child.geometry && child.geometry.userData.originalPositions) {
                const geometry = child.geometry;
                const positions = geometry.attributes.position;
                const originalPositions = geometry.userData.originalPositions;
                const height = geometry.userData.height || 1;
                const minY = geometry.userData.minY || -0.5;
                
                // Deform each vertex
                for (let i = 0; i < positions.count; i++) {
                    const i3 = i * 3;
                    
                    // Get original position
                    const originalX = originalPositions[i3];
                    const originalY = originalPositions[i3 + 1];
                    const originalZ = originalPositions[i3 + 2];
                    
                    // Calculate height factor (0 at bottom, 1 at top)
                    const heightFactor = Math.max(0, Math.min(1, (originalY - minY) / height));
                    
                    // Create undulating motion with multiple frequencies
                    const undulationX = (
                        Math.sin(heightFactor * 2.5 + time * userData.frequency + userData.offset) * 0.4 +
                        Math.sin(heightFactor * 5.0 + time * userData.frequency * 1.2 + userData.offset) * 0.2 +
                        Math.sin(heightFactor * 8.0 + time * userData.frequency * 0.8 + userData.offset) * 0.1
                    ) * waveIntensity * heightFactor;
                    
                    const undulationZ = (
                        Math.cos(heightFactor * 2.5 + time * userData.frequency + userData.offset + Math.PI/4) * 0.3 +
                        Math.cos(heightFactor * 5.0 + time * userData.frequency * 1.2 + userData.offset + Math.PI/3) * 0.15 +
                        Math.cos(heightFactor * 8.0 + time * userData.frequency * 0.8 + userData.offset + Math.PI/6) * 0.075
                    ) * waveIntensity * heightFactor;
                    
                    // Apply directional current influence
                    const currentInfluenceX = (wave1 + wave2 * 0.5) * waveIntensity * heightFactor * heightFactor * 0.3;
                    const currentInfluenceZ = (wave2 + wave3 * 0.5) * waveIntensity * heightFactor * heightFactor * 0.3;
                    
                    // Combine undulation with current direction
                    const finalBendX = (undulationX + currentInfluenceX) * Math.cos(dirRad) + 
                                       (undulationZ + currentInfluenceZ) * Math.sin(dirRad) * 0.3;
                    const finalBendZ = (undulationZ + currentInfluenceZ) * Math.sin(dirRad) + 
                                       (undulationX + currentInfluenceX) * Math.cos(dirRad) * 0.3;
                    
                    // Apply deformation with bounds checking
                    const newX = originalX + Math.max(-2, Math.min(2, finalBendX));
                    const newZ = originalZ + Math.max(-2, Math.min(2, finalBendZ));
                    
                    positions.setX(i, newX);
                    positions.setY(i, originalY);
                    positions.setZ(i, newZ);
                }
                
                // Mark for update
                positions.needsUpdate = true;
                geometry.computeVertexNormals();
            }
        });

    } else {
        // Handle cylinder geometry (fallback)
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
        const wave1 = Math.sin(time * userData.frequency + userData.offset) * userData.amplitude;
        const wave2 = Math.cos(time * userData.frequency * 1.3 + userData.offset) * userData.amplitude * 0.7;
        const wave3 = Math.sin(time * userData.frequency * 0.7 + userData.offset) * userData.amplitude * 0.5;

        // Deform each vertex
        for (let i = 0; i < positions.count; i++) {
            const i3 = i * 3;

            // Get original position
            const originalX = originalPositions[i3];
            const originalY = originalPositions[i3 + 1];
            const originalZ = originalPositions[i3 + 2];

            // Calculate height factor (0 at bottom, 1 at top)
            const heightFactor = (originalY + userData.height/2) / userData.height;
            
            // Create undulating displacement
            const undulationX = (
                Math.sin(heightFactor * 2.5 + time * userData.frequency + userData.offset) * 0.5 +
                Math.sin(heightFactor * 5.0 + time * userData.frequency * 1.2 + userData.offset) * 0.25 +
                Math.sin(heightFactor * 8.0 + time * userData.frequency * 0.8 + userData.offset) * 0.125
            ) * waveIntensity * heightFactor;
            
            const undulationZ = (
                Math.cos(heightFactor * 2.5 + time * userData.frequency + userData.offset + Math.PI/4) * 0.4 +
                Math.cos(heightFactor * 5.0 + time * userData.frequency * 1.2 + userData.offset + Math.PI/3) * 0.2 +
                Math.cos(heightFactor * 8.0 + time * userData.frequency * 0.8 + userData.offset + Math.PI/6) * 0.1
            ) * waveIntensity * heightFactor;

            // Apply directional current influence
            const currentInfluenceX = (wave1 + wave2 * 0.7) * waveIntensity * heightFactor * heightFactor * 0.4;
            const currentInfluenceZ = (wave2 + wave3 * 0.8) * waveIntensity * heightFactor * heightFactor * 0.4;

            // Combine undulation with current direction
            const finalBendX = (undulationX + currentInfluenceX) * Math.cos(dirRad) + 
                               (undulationZ + currentInfluenceZ) * Math.sin(dirRad) * 0.3;
            const finalBendZ = (undulationZ + currentInfluenceZ) * Math.sin(dirRad) + 
                               (undulationX + currentInfluenceX) * Math.cos(dirRad) * 0.3;

            // Apply deformation with bounds checking
            const newX = originalX + Math.max(-3, Math.min(3, finalBendX));
            const newZ = originalZ + Math.max(-3, Math.min(3, finalBendZ));

            positions.setX(i, newX);
            positions.setY(i, originalY);
            positions.setZ(i, newZ);
        }

        // Mark for update
        positions.needsUpdate = true;
        geometry.computeVertexNormals();
    }
}

// GLTF Kelp loading with standard materials only
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

            // Compute bounding box
            const box = new THREE.Box3().setFromObject(template);
            const size = new THREE.Vector3();
            box.getSize(size);

            log(`GLTF Model size: X=${size.x.toFixed(3)}, Y=${size.y.toFixed(3)}, Z=${size.z.toFixed(3)}`);

            // Apply standard Phong material to all meshes - NO SHADERS
            template.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    child.geometry.computeBoundingBox();
                    const geometry = child.geometry;
                    
                    // Store original positions for CPU deformation
                    const positions = geometry.attributes.position.array.slice();
                    geometry.userData.originalPositions = positions;
                    
                    const bbox = geometry.boundingBox;
                    geometry.userData.minY = bbox.min.y;
                    geometry.userData.maxY = bbox.max.y;
                    geometry.userData.height = bbox.max.y - bbox.min.y;
                    
                    // Use ONLY standard MeshPhongMaterial - guaranteed to work with fog
                    const kelpMaterial = new THREE.MeshPhongMaterial({
                        color: 0x1c4709, // Dark green
                        transparent: true,
                        opacity: 0.85,
                        shininess: 10,
                        side: THREE.DoubleSide
                    });
                    
                    child.material = kelpMaterial;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    log(`Mesh prepared with standard Phong material`);
                }
            });

            // Position template on seafloor
            template.position.y = -1;

            // Create kelp instances
            for(let i = 0; i < 40; i++) {
                const kelpInstance = template.clone();

                // Position kelp
                kelpInstance.position.x = (Math.random() - 0.5) * 80;
                kelpInstance.position.z = (Math.random() - 0.5) * 80;
                kelpInstance.position.y = -1;

                // Scale
                const scale = 2 + Math.random() * 6;
                kelpInstance.scale.setScalar(scale);

                // Rotation
                kelpInstance.rotation.y = Math.random() * Math.PI * 2;

                // Store animation data
                kelpInstance.userData = {
                    originalX: kelpInstance.position.x,
                    originalZ: kelpInstance.position.z,
                    originalY: kelpInstance.position.y,
                    offset: Math.random() * Math.PI * 2,
                    frequency: 0.5 + Math.random() * 0.5,
                    amplitude: 0.3 + Math.random() * 0.4,
                    isGLTF: true
                };

                // Prepare cloned geometries for independent deformation
                kelpInstance.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        child.geometry = child.geometry.clone();
                        // Copy userData from template
                        template.traverse((originalChild) => {
                            if (originalChild.isMesh && originalChild.geometry && 
                                originalChild.geometry.userData.originalPositions &&
                                originalChild.name === child.name) {
                                child.geometry.userData.originalPositions = originalChild.geometry.userData.originalPositions.slice();
                                child.geometry.userData.minY = originalChild.geometry.userData.minY;
                                child.geometry.userData.maxY = originalChild.geometry.userData.maxY;
                                child.geometry.userData.height = originalChild.geometry.userData.height;
                                return;
                            }
                        });
                    }
                });

                scene.add(kelpInstance);
                kelp.push(kelpInstance);
            }

            log(`Created ${kelp.length} GLTF kelp instances with CPU vertex deformation`);
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

// Fallback kelp creation
function createFallbackKelp() {
    log('Creating fallback cylinder kelp...');

    for(let i = 0; i < 30; i++) {
        const kelpHeight = 15;
        const geometry = new THREE.CylinderGeometry(0.15, 0.3, kelpHeight, 8, 15);
        
        // Store original positions for deformation
        const positions = geometry.attributes.position.array.slice();
        geometry.userData.originalPositions = positions;
        geometry.userData.height = kelpHeight;
        
        // Standard MeshPhongMaterial only
        const kelpMaterial = new THREE.MeshPhongMaterial({
            color: 0x1c4709,
            transparent: true,
            opacity: 0.85,
            shininess: 10
        });

        const kelpMesh = new THREE.Mesh(geometry, kelpMaterial);
        kelpMesh.position.x = (Math.random() - 0.5) * 60;
        kelpMesh.position.z = (Math.random() - 0.5) * 60;
        kelpMesh.position.y = kelpHeight / 2;
        kelpMesh.castShadow = true;
        kelpMesh.receiveShadow = true;

        kelpMesh.userData = {
            originalX: kelpMesh.position.x,
            originalZ: kelpMesh.position.z,
            originalY: kelpMesh.position.y,
            height: kelpHeight,
            offset: Math.random() * Math.PI * 2,
            frequency: 0.5 + Math.random() * 0.5,
            amplitude: 0.3 + Math.random() * 0.4,
            isGLTF: false
        };

        scene.add(kelpMesh);
        kelp.push(kelpMesh);
    }

    log(`Created ${kelp.length} fallback kelp plants`);
    startAnimation();
}

// Controls setup
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

    log('Camera controls initialized');

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
        
            // Update particle direction if available
            if (typeof OceanParticles !== 'undefined') {
                const radians = (currentDirection * Math.PI) / 180;
                const x = Math.cos(radians);
                const z = Math.sin(radians);
                OceanParticles.setDirection(x, 0.1, z);
            }
        });
    }

    // Fallback button
    const fallbackButton = document.getElementById('useFallback');
    if (fallbackButton) {
        fallbackButton.addEventListener('click', function() {
            log('User requested fallback kelp');
            kelp.forEach(k => scene.remove(k));
            kelp = [];
            createFallbackKelp();
        });
    }
}

// Animation loop with CPU-based kelp deformation
function animate() {
    requestAnimationFrame(animate);

    time += 0.01 * waveSpeed;

    // CPU-based kelp deformation - no shader uniforms to cause fog errors
    kelp.forEach(function(k) {
        deformKelp(k, time);
    });

    // Update other systems
    if (typeof OscillatingPlane !== 'undefined') {
        OscillatingPlane.update(0.01 * waveSpeed); 
    }

    if (typeof OceanParticles !== 'undefined') {
        OceanParticles.update(0.01 * waveSpeed);
    }

    if (typeof OceanSurface !== 'undefined') {
        OceanSurface.update(0.01 * waveSpeed);
    }

    // Update camera
    rotationX += (targetRotationX - rotationX) * 0.1;
    rotationY += (targetRotationY - rotationY) * 0.1;

    camera.position.x = Math.sin(rotationY) * Math.cos(rotationX) * distance;
    camera.position.y = Math.sin(rotationX) * distance + 3;
    camera.position.z = Math.cos(rotationY) * Math.cos(rotationX) * distance;
    camera.lookAt(0, 3, 0);

    // Safe render - no shader materials to cause fog issues
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

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    log('DOM loaded, initializing kelp forest...');

    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded');
        log('ERROR: Three.js not loaded');
        return;
    }
    
    log('Three.js loaded successfully');
    initializeScene();
    setupControls();

    // Load kelp after short delay
    setTimeout(() => {
        loadGLTFKelp();
    }, 500);
});

// Handle window resize
window.addEventListener('resize', function() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// Debug utilities
window.kelpDebug = {
    info: () => {
        console.log('Kelp Forest Status:');
        console.log('- Kelp count:', kelp.length);
        console.log('- Wave speed:', waveSpeed);
        console.log('- Wave intensity:', waveIntensity);
        console.log('- Current direction:', currentDirection);
        console.log('- Time:', time);
        console.log('- Using CPU vertex deformation (no shaders)');
    },
    resetCamera: () => {
        distance = 30;
        targetRotationX = 0;
        targetRotationY = 0;
        rotationX = 0;
        rotationY = 0;
        console.log('Camera reset');
    },
    reload: () => {
        kelp.forEach(k => scene.remove(k));
        kelp = [];
        loadGLTFKelp();
    },
    toggleWireframe: () => {
        kelp.forEach(k => {
            k.traverse(child => {
                if (child.material) {
                    child.material.wireframe = !child.material.wireframe;
                }
            });
        });
        console.log('Wireframe toggled');
    }
};
