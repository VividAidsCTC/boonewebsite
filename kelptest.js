// Global variables
let scene, camera, renderer;
let kelpInstances = [];
let instancedKelp = null;
let waveSpeed = 1.2;
let waveIntensity = 0.6;
let currentDirection = 45;
let time = 0;

let targetRotationX = 0, targetRotationY = 0;
let rotationX = 0, rotationY = 0;
let distance = 30;
let isMouseDown = false;

let floorTextures = { diffuse: null, normal: null, roughness: null, displacement: null };
let textureLoader = new THREE.TextureLoader();

const KELP_COUNT = 175;
let instanceData = [];
let kelpGeometry = null;
let kelpMaterial = null;

// Vertex shader with shadow support
const kelpVertexShader = `
    #include <common>
    #include <fog_pars_vertex>
    #include <shadowmap_pars_vertex>
    
    attribute vec3 instancePosition;
    attribute vec4 instanceRotation;
    attribute vec3 instanceScale;
    attribute vec4 animationData;
    attribute vec4 animationData2;
    attribute vec2 animationData3;
    
    uniform float time;
    uniform float waveSpeed;
    uniform float waveIntensity;
    uniform float currentDirection;
    uniform float baseY;
    uniform float kelpHeight;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    vec3 applyQuaternion(vec3 v, vec4 q) {
        return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
    }

    void main() {
        // Per-instance animation params
        float offset1 = animationData.x;

        // Vertex local position
        vec3 pos = position;

        // Height factor: 0 at baseY, 1 at top
        float heightFactor = (pos.y - baseY) / kelpHeight;
        heightFactor = clamp(heightFactor, 0.0, 1.0);

        // Sine wave for swaying
        float dirRad = radians(currentDirection);
        float wave = sin(time * waveSpeed + pos.y * 0.3 + offset1) * waveIntensity * heightFactor;

        float bendX = wave * cos(dirRad);
        float bendZ = wave * sin(dirRad);

        // Deform only upper parts
        pos.x += bendX * heightFactor;
        pos.z += bendZ * heightFactor;

        // Apply scale, rotation, and position
        vec3 scaledPos = pos * instanceScale;
        vec3 rotatedPos = applyQuaternion(scaledPos, instanceRotation);
        vec3 worldPos = rotatedPos + instancePosition;
        
        // Store world position for fragment shader
        vWorldPosition = worldPos;

        // Final projection
        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Transform normal to world space for shadows
        vec3 transformedNormal = normalMatrix * normal;
        vNormal = normalize(transformedNormal);
        
        #include <fog_vertex>
        
        // Shadow mapping - need to define required variables
        #ifdef USE_SHADOWMAP
            vec4 worldPosition = vec4(worldPos, 1.0);
            #include <shadowmap_vertex>
        #endif
    }
`;

// Fragment shader with shadow support
const kelpFragmentShader = `
    #include <common>
    #include <fog_pars_fragment>
    #include <shadowmap_pars_fragment>
    
    uniform vec3 diffuse;
    uniform float opacity;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
        vec3 lightDirection = normalize(vec3(0.5, 1.0, 0.3));
        float dotNL = max(dot(normalize(vNormal), lightDirection), 0.0);
        
        // Calculate shadow factor using Three.js built-in functions
        float shadowFactor = 1.0;
        #ifdef USE_SHADOWMAP
            shadowFactor = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, vDirectionalShadowCoord[ 0 ] );
        #endif
        
        // Apply shadows to lighting
        vec3 color = diffuse * (0.2 + 0.8 * dotNL * shadowFactor);
        
        gl_FragColor = vec4(color, opacity);
        #include <fog_fragment>
    }
`;

// Create material function
function createKelpMaterial(kelpHeight = 20, baseY = -10) {
    return new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.fog,
            THREE.UniformsLib.lights,
            THREE.UniformsLib.shadowmap,
            {
                time: { value: 0 },
                waveSpeed: { value: waveSpeed },
                waveIntensity: { value: waveIntensity },
                currentDirection: { value: currentDirection },
                diffuse: { value: new THREE.Color(0x735F1D) }, // Dark green-brown
                opacity: { value: 0.85 },
                kelpHeight: { value: kelpHeight },
                baseY: { value: baseY },
            }
        ]),
        vertexShader: kelpVertexShader,
        fragmentShader: kelpFragmentShader,
        transparent: true,
        fog: true, // CRITICAL: Enable fog support
        lights: true // Enable lighting calculations for shadows
    });
}

// Texture loading functions (kept the same)
function createTexturedFloor() {
    log('Creating textured seafloor...');
    
    const floorGeometry = new THREE.PlaneGeometry(1000, 1000, 256, 256);
    
    let floorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x302114,
        shininess: 2,
        specular: 0x332211,
        fog: true // IMPORTANT: Enable fog for compatibility
    });
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    floor.receiveShadow = true; // Enable shadow receiving on the seafloor
    floor.castShadow = false; // Floor doesn't cast shadows
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
    
    // ... (other texture loading code remains the same)
    
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
        specular: 0x333333,
        fog: true // IMPORTANT: Enable fog for compatibility
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
        displacement: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/textures/Ground059_1K-JPG_Displacement.jpg',
        ao: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/textures/Ground059_1K-JPG_AmbientOcclusion.jpg'
    };
    
    loadGroundTextures(texturePaths);
}

// Debug logging function
function log(message) {
    console.log(message);
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        debugDiv.innerHTML += message + '<br>';
    }
}

// Initialize scene
function initializeScene() {
    log('Initializing Three.js scene...');

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(120, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Enable shadow mapping for GPU-accelerated shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows for better quality
    renderer.shadowMap.autoUpdate = true;

    // Create blue gradient background
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    const context = canvas.getContext('2d');
    context.fillStyle = '#3c7878';
    context.fillRect(0, 0, 1000, 1000);

    const gradientTexture = new THREE.CanvasTexture(canvas);
    scene.background = gradientTexture;

    const container = document.getElementById('container');
    container.appendChild(renderer.domElement);

    // Lighting setup with shadow-casting sun light
    const ambientLight = new THREE.AmbientLight(0x6699bb, 0.2); // Reduced ambient for better shadow contrast
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xaaccdd, 0.9);
    sunLight.position.set(30, 80, 40); // Positioned for good shadow angles
    sunLight.castShadow = true; // Enable shadow casting
    
    // Configure shadow camera for better coverage
    sunLight.shadow.mapSize.width = 4096;  // High resolution shadow map
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.0001; // Reduce shadow acne
    sunLight.shadow.radius = 8; // Soft shadow radius
    
    scene.add(sunLight);

    // Additional rim lights (non-shadow casting)
    const rimLight1 = new THREE.DirectionalLight(0x7799cc, 0.2);
    rimLight1.position.set(20, 20, 0);
    scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0x6688bb, 0.15);
    rimLight2.position.set(-20, 15, 0);
    scene.add(rimLight2);

    const floorLight = new THREE.DirectionalLight(0x7aacbe, 0.1);
    floorLight.position.set(0, -30, 0);
    scene.add(floorLight);

    const floor = createTexturedFloor();
    
    setTimeout(() => {
        loadSeafloorTextures();
    }, 1000);
}

// Create GPU-instanced kelp
function createGPUKelp() {
    log('Creating GPU-instanced kelp...');

    // Create base geometry - simple kelp shape
    const baseKelpHeight = 20;
    const segments = 32; // Higher for smoother deformation
    const radialSegments = 8;
    
    kelpGeometry = new THREE.CylinderGeometry(0.2, 0.4, baseKelpHeight, radialSegments, segments);
    
    // Create material
    kelpMaterial = createKelpMaterial(baseKelpHeight, -10);

    // Create instanced mesh
    instancedKelp = new THREE.InstancedMesh(kelpGeometry, kelpMaterial, KELP_COUNT);
    instancedKelp.castShadow = true; // Enable shadow casting
    instancedKelp.receiveShadow = false; // Kelp doesn't need to receive shadows from other kelp
    
    // Set up instance data
    setupInstanceData(baseKelpHeight);

    scene.add(instancedKelp);
    
    log(`Created ${KELP_COUNT} GPU-instanced kelp plants`);
    
    // Make sure fog system knows about this material
    if (typeof window.FogSystem !== 'undefined') {
        log('Fog system detected - kelp material fog compatibility enabled');
    }
}

// Load GLTF kelp or create fallback
function loadGLTFKelp() {
    log('Attempting to load GLTF kelp model...');

    if (typeof THREE.GLTFLoader === 'undefined') {
        log('ERROR: GLTFLoader not available, using GPU cylinder kelp');
        createGPUKelp();
        startAnimation();
        return;
    }

    const loader = new THREE.GLTFLoader();
    const kelpURL = 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/nouveaukelp4.glb';

    loader.load(
        kelpURL,
        function(gltf) {
            log('GLTF model loaded successfully, converting to GPU instances...');
            
            // Extract geometry from GLTF
            let gltfGeometry = null;
            gltf.scene.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    if (!gltfGeometry) {
                        gltfGeometry = child.geometry.clone();
                    }
                }
            });

            if (gltfGeometry) {
                // Use GLTF geometry instead of cylinder
                kelpGeometry = gltfGeometry;

                // Get bounds for height calculations
                gltfGeometry.computeBoundingBox();
                const bbox = gltfGeometry.boundingBox;
                const height = bbox.max.y - bbox.min.y;
                const baseY = bbox.min.y;
                
                log(`Using GLTF geometry with height: ${height.toFixed(2)}, baseY: ${baseY.toFixed(2)}`);
                
                // Create material with proper height and baseY values
                kelpMaterial = createKelpMaterial(height, baseY);

                // Create instanced mesh with GLTF geometry
                instancedKelp = new THREE.InstancedMesh(kelpGeometry, kelpMaterial, KELP_COUNT);
                instancedKelp.castShadow = true; // Enable shadow casting
                instancedKelp.receiveShadow = false; // Kelp doesn't need to receive shadows from other kelp
                
                // Set up instance data with GLTF height
                setupInstanceData(height);
                
                scene.add(instancedKelp);
                log(`Created ${KELP_COUNT} GPU-instanced GLTF kelp plants`);
            } else {
                log('No geometry found in GLTF, using fallback');
                createGPUKelp();
            }
            
            startAnimation();
        },
        function(progress) {
            if (progress.total > 0) {
                log(`Loading progress: ${Math.round((progress.loaded / progress.total) * 100)}%`);
            }
        },
        function(error) {
            log('ERROR loading GLTF: ' + error.message);
            createGPUKelp();
            startAnimation();
        }
    );
}

function setupInstanceData(baseHeight = 20) {
    const instancePositions = new Float32Array(KELP_COUNT * 3);
    const instanceRotations = new Float32Array(KELP_COUNT * 4);
    const instanceScales = new Float32Array(KELP_COUNT * 3);
    const animationData = new Float32Array(KELP_COUNT * 4);
    const animationData2 = new Float32Array(KELP_COUNT * 4);
    const animationData3 = new Float32Array(KELP_COUNT * 2);

    for (let i = 0; i < KELP_COUNT; i++) {
        // Position
        const x = (Math.random() - 0.5) * 175;
        const z = (Math.random() - 0.5) * 175;
        const y = -1;
        
        instancePositions[i * 3] = x;
        instancePositions[i * 3 + 1] = y;
        instancePositions[i * 3 + 2] = z;

        // Rotation
        const rotation = Math.random() * Math.PI * 2;
        instanceRotations[i * 4] = 0;
        instanceRotations[i * 4 + 1] = Math.sin(rotation / 2);
        instanceRotations[i * 4 + 2] = 0;
        instanceRotations[i * 4 + 3] = Math.cos(rotation / 2);

        // Scale
        const scale = 4 + Math.random() * 20;
        instanceScales[i * 3] = scale;
        instanceScales[i * 3 + 1] = scale;
        instanceScales[i * 3 + 2] = scale;

        // Animation data
        animationData[i * 4] = Math.random() * Math.PI * 2;
        animationData[i * 4 + 1] = 0.8 + Math.random() * 0.6;
        animationData[i * 4 + 2] = 0.8 + Math.random() * 0.6;
        animationData[i * 4 + 3] = baseHeight * scale;

        animationData2[i * 4] = Math.random() * Math.PI * 2;
        animationData2[i * 4 + 1] = 1.1 + Math.random() * 0.8;
        animationData2[i * 4 + 2] = 0.6 + Math.random() * 0.5;
        animationData2[i * 4 + 3] = Math.random() * Math.PI * 2;

        animationData3[i * 2] = 0.5 + Math.random() * 0.4;
        animationData3[i * 2 + 1] = 0.4 + Math.random() * 0.3;

        instanceData[i] = {
            position: { x, y, z },
            scale: scale,
            rotation: rotation
        };
    }

    // Set attributes
    kelpGeometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
    kelpGeometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(instanceRotations, 4));
    kelpGeometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScales, 3));
    kelpGeometry.setAttribute('animationData', new THREE.InstancedBufferAttribute(animationData, 4));
    kelpGeometry.setAttribute('animationData2', new THREE.InstancedBufferAttribute(animationData2, 4));
    kelpGeometry.setAttribute('animationData3', new THREE.InstancedBufferAttribute(animationData3, 2));
}

// Setup controls
function setupControls() {
    document.addEventListener('mousemove', function(event) {
        if (isMouseDown) {
            targetRotationY += event.movementX * 0.01;
            targetRotationX += event.movementY * 0.01;
            
            const maxRotation = 15 * (Math.PI / 180);
            targetRotationY = Math.max(-maxRotation, Math.min(maxRotation, targetRotationY));
            targetRotationX = Math.max(-maxRotation, Math.min(maxRotation, targetRotationX));
        }
    });

    log('Manual camera controls initialized successfully');

    // Slider controls
    const waveSpeedSlider = document.getElementById('waveSpeed');
    const waveIntensitySlider = document.getElementById('waveIntensity');
    const currentDirectionSlider = document.getElementById('currentDirection');

    if (waveSpeedSlider) {
        waveSpeedSlider.addEventListener('input', function(e) {
            waveSpeed = parseFloat(e.target.value);
            if (instancedKelp && instancedKelp.material.uniforms) {
                instancedKelp.material.uniforms.waveSpeed.value = waveSpeed;
            }
        });
    }

    if (waveIntensitySlider) {
        waveIntensitySlider.addEventListener('input', function(e) {
            waveIntensity = parseFloat(e.target.value);
            if (instancedKelp && instancedKelp.material.uniforms) {
                instancedKelp.material.uniforms.waveIntensity.value = waveIntensity;
            }
        });
    }

    if (currentDirectionSlider) {
        currentDirectionSlider.addEventListener('input', function(e) {
            currentDirection = parseFloat(e.target.value);
            if (instancedKelp && instancedKelp.material.uniforms) {
                instancedKelp.material.uniforms.currentDirection.value = currentDirection;
            }
            
            // Update particle direction if available
            if (typeof OceanParticles !== 'undefined') {
                const radians = (currentDirection * Math.PI) / 180;
                const x = Math.cos(radians);
                const z = Math.sin(radians);
                OceanParticles.setDirection(x, 0.1, z);
            }
        });
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    time += 0.01 * waveSpeed;

    // Update GPU kelp shader uniforms
    if (instancedKelp && instancedKelp.material.uniforms) {
        instancedKelp.material.uniforms.time.value = time;
        instancedKelp.material.uniforms.waveSpeed.value = waveSpeed;
        instancedKelp.material.uniforms.waveIntensity.value = waveIntensity;
        instancedKelp.material.uniforms.currentDirection.value = currentDirection;
    }

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
    camera.lookAt(0, 5, 5);

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

// DOM ready handler
document.addEventListener('DOMContentLoaded', function() {
    log('DOM loaded, initializing GPU kelp forest...');

    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded');
        return;
    }
    
    initializeScene();
    setupControls();

    // Try to load GLTF first, fallback to GPU cylinders if it fails
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

// Mouse event handlers
document.addEventListener('mousedown', function(event) {
    isMouseDown = true;
});

document.addEventListener('mouseup', function(event) {
    isMouseDown = false;
});

// Export for compatibility with other systems
window.KelpSystem = {
    getInstancedMesh: () => instancedKelp,
    getInstanceCount: () => KELP_COUNT,
    getInstanceData: () => instanceData,
    updateUniforms: (uniforms) => {
        if (instancedKelp && instancedKelp.material.uniforms) {
            Object.assign(instancedKelp.material.uniforms, uniforms);
        }
    }
};
