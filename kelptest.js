// Fixed Kelp System - Solves shader material fog uniform issues
// Global variables
let scene, camera, renderer;
let kelp = [];
let waveSpeed = .8;
let waveIntensity = .6;
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

// Fixed Kelp Shader Material with proper fog uniforms
function createKelpShaderMaterial() {
    const kelpUniforms = THREE.UniformsUtils.merge([
        THREE.UniformsLib.common,
        THREE.UniformsLib.fog,
        THREE.UniformsLib.lights,
        {
            uTime: { value: 0 },
            uWaveSpeed: { value: waveSpeed },
            uWaveIntensity: { value: waveIntensity },
            uDirection: { value: new THREE.Vector2(
                Math.cos(currentDirection * Math.PI / 180), 
                Math.sin(currentDirection * Math.PI / 180)
            )}
        }
    ]);

    const vertexShader = `
        #include <common>
        #include <fog_pars_vertex>
        #include <shadowmap_pars_vertex>
        #include <logdepthbuf_pars_vertex>

        uniform float uTime;
        uniform float uWaveSpeed;
        uniform float uWaveIntensity;
        uniform vec2 uDirection;

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewPosition;

        void main() {
            vec3 pos = position;
            
            // Calculate height factor (0 at bottom, 1 at top)
            float heightFactor = clamp((pos.y + 1.0) / 2.0, 0.0, 1.0);

            // Create wave motion - keep it small and controlled
            float wave1 = sin(heightFactor * 2.0 + uTime * 0.8) * 0.3;
            float wave2 = cos(heightFactor * 4.0 + uTime * 1.2) * 0.15;
            float wave3 = sin(heightFactor * 6.0 + uTime * 1.5) * 0.075;

            float bendAmount = (wave1 + wave2 + wave3) * uWaveIntensity * heightFactor;

            // Apply directional bending - very conservative
            pos.x += uDirection.x * bendAmount * 0.5;
            pos.z += uDirection.y * bendAmount * 0.5;

            // Standard transformations
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            vViewPosition = -mvPosition.xyz;
            vPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
            vNormal = normalize(normalMatrix * normal);

            gl_Position = projectionMatrix * mvPosition;

            #include <logdepthbuf_vertex>
            #include <fog_vertex>
            #include <shadowmap_vertex>
        }
    `;

    const fragmentShader = `
        #include <common>
        #include <fog_pars_fragment>
        #include <logdepthbuf_pars_fragment>

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewPosition;

        void main() {
            #include <logdepthbuf_fragment>

            // Simple lighting calculation
            vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
            float diff = max(dot(normalize(vNormal), lightDir), 0.0);

            // Kelp color
            vec3 baseColor = vec3(0.11, 0.28, 0.05);
            vec3 color = baseColor * (0.4 + 0.6 * diff);

            gl_FragColor = vec4(color, 0.85);

            #include <fog_fragment>
        }
    `;

    return new THREE.ShaderMaterial({
        uniforms: kelpUniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        fog: true, // Enable fog support
        lights: false // Disable automatic lighting since we handle it manually
    });
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

// GLTF Kelp loading with fixed shader materials
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

            // Apply fixed shader material to all meshes
            const sharedKelpMaterial = createKelpShaderMaterial();
            
            template.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    child.geometry.computeBoundingBox();
                    const geometry = child.geometry;
                    
                    // Store original positions for potential CPU fallback
                    const positions = geometry.attributes.position.array.slice();
                    geometry.userData.originalPositions = positions;
                    
                    const bbox = geometry.boundingBox;
                    geometry.userData.minY = bbox.min.y;
                    geometry.userData.maxY = bbox.max.y;
                    geometry.userData.height = bbox.max.y - bbox.min.y;
                    
                    // Apply the fixed shader material
                    child.material = sharedKelpMaterial.clone();
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    log(`Mesh prepared with fixed shader material`);
                }
            });

            // Position template on seafloor
            template.position.y = -1;

            // Create kelp instances
            for(let i = 0; i < 50; i++) { // Reduced count for stability
                const kelpInstance = template.clone();

                // Position kelp
                kelpInstance.position.x = (Math.random() - 0.5) * 80;
                kelpInstance.position.z = (Math.random() - 0.5) * 80;
                kelpInstance.position.y = -1;

                // Scale
                const scale = 2 + Math.random() * 6; // Smaller scale for stability
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

// Fallback kelp creation
function createFallbackKelp() {
    log('Creating fallback cylinder kelp...');

    for(let i = 0; i < 25; i++) {
        const kelpHeight = 15;
        const geometry = new THREE.CylinderGeometry(0.15, 0.3, kelpHeight, 8, 15);
        
        // Use MeshPhongMaterial instead of shader for fallback
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

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    time += 0.01 * waveSpeed;

    // Update kelp shader uniforms
    kelp.forEach(function(k) {
        k.traverse(child => {
            if (child.material && child.material.uniforms) {
                // Safely update uniforms
                if (child.material.uniforms.uTime) {
                    child.material.uniforms.uTime.value = time;
                }
                if (child.material.uniforms.uWaveSpeed) {
                    child.material.uniforms.uWaveSpeed.value = waveSpeed;
                }
                if (child.material.uniforms.uWaveIntensity) {
                    child.material.uniforms.uWaveIntensity.value = waveIntensity;
                }
                if (child.material.uniforms.uDirection) {
                    child.material.uniforms.uDirection.value.set(
                        Math.cos(currentDirection * Math.PI / 180),
                        Math.sin(currentDirection * Math.PI / 180)
                    );
                }
            }
        });
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

    // Safe render
    try {
        renderer.render(scene, camera);
    } catch (error) {
        console.error('Render error:', error);
        // Stop animation if there's a persistent error
        return;
    }
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
    }
};
