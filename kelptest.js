// Global variables
let scene, camera, renderer;
let kelpInstances = [];
let instancedKelp = null;
let instancedKelp2 = null; // Second kelp model
let waveSpeed = 1.2;
let waveIntensity = 0.6;
let currentDirection = 45;
let time = 0;

let targetRotationX = 0, targetRotationY = 0;
let rotationX = 0, rotationY = 0;
let isMouseDown = false;

let floorTextures = { diffuse: null, normal: null, roughness: null, displacement: null };
let textureLoader = new THREE.TextureLoader();

const KELP_COUNT = 175;
const KELP2_COUNT = 100; // Count for second kelp type
let instanceData = [];
let instanceData2 = []; // Data for second kelp type
let kelpGeometry = null;
let kelpGeometry2 = null; // Second kelp geometry
let kelpMaterial = null;
let kelpMaterial2 = null; // Second kelp material

// Kelp model URLs
const KELP_MODELS = {
    primary: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/nouveaukelp4.glb',
    secondary: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/smallkelp2.glb' // Add your second model URL here
};

// Vertex shader with simple shadow support
const kelpVertexShader = `
   #include <common>
   #include <fog_pars_vertex>
   
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

       // Transform normal
       vNormal = normalize(normalMatrix * normal);
       
       #include <fog_vertex>
   }
`;

// Fragment shader with simple lighting
const kelpFragmentShader = `
   #include <common>
   #include <fog_pars_fragment>
   
   uniform vec3 diffuse;
   uniform float opacity;
   uniform vec3 lightDirection;
   uniform vec3 lightColor;
   
   varying vec3 vNormal;
   varying vec3 vWorldPosition;

   void main() {
       // Simple directional lighting
       vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
       float dotNL = max(dot(normalize(vNormal), lightDir), 0.0);
       
       // Simple shadow approximation based on world position and normal
       float shadowFactor = 1.0;
       float distanceFromCenter = length(vWorldPosition.xz);
       float heightFactor = (vWorldPosition.y + 1.0) / 20.0; // Assuming kelp height of ~20
       
       // Create simple shadow effect - kelp further from center and higher up cast less shadow
       shadowFactor = mix(0.3, 1.0, min(1.0, distanceFromCenter / 30.0 + heightFactor * 0.5));
       
       // Apply lighting with shadow approximation
       vec3 color = diffuse * (0.2 + 0.8 * dotNL * shadowFactor);
       
       gl_FragColor = vec4(color, opacity);
       #include <fog_fragment>
   }
`;

// Create material function with color variation support
function createKelpMaterial(kelpHeight = 20, baseY = -10, colorVariant = 'primary') {
    const colors = {
        primary: new THREE.Color(0x735F1D), // Dark green-brown
        secondary: new THREE.Color(0x4A6741) // Slightly different green
    };

    return new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.fog,
            {
                time: { value: 0 },
                waveSpeed: { value: waveSpeed },
                waveIntensity: { value: waveIntensity },
                currentDirection: { value: currentDirection },
                diffuse: { value: colors[colorVariant] || colors.primary },
                opacity: { value: 0.85 },
                kelpHeight: { value: kelpHeight },
                baseY: { value: baseY },
                lightDirection: { value: new THREE.Vector3(0.5, 1.0, 0.3) },
                lightColor: { value: new THREE.Color(0xaaccdd) }
            }
        ]),
        vertexShader: kelpVertexShader,
        fragmentShader: kelpFragmentShader,
        transparent: true,
        fog: true
    });
}

// Texture loading functions
function createTexturedFloor() {
    log('Creating textured seafloor...');

    const floorGeometry = new THREE.PlaneGeometry(1000, 1000, 256, 256);

    let floorMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x302114,
        fog: true
    });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    floor.receiveShadow = true;
    floor.castShadow = false;
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
        fog: true
    };

    if (floorTextures.diffuse) {
        materialProps.map = floorTextures.diffuse;
    }

    if (floorTextures.normal) {
        materialProps.normalMap = floorTextures.normal;
        materialProps.normalScale = new THREE.Vector2(0.5, 0.5);
    }

    const newMaterial = new THREE.MeshLambertMaterial(materialProps);

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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    // Set fixed camera position
    camera.position.set(0, 10, 30);

    // Lighting setup with shadow-casting sun light
    const ambientLight = new THREE.AmbientLight(0x6699bb, 0.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xaaccdd, 0.9);
    sunLight.position.set(30, 80, 40);
    sunLight.castShadow = true;

    // Configure shadow camera for better coverage
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.radius = 8;

    scene.add(sunLight);

    // Additional rim lights
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

// Create GPU-instanced kelp with fallback geometry
function createGPUKelp(isSecondary = false) {
    const kelpType = isSecondary ? 'secondary' : 'primary';
    log(`Creating GPU-instanced ${kelpType} kelp...`);

    const baseKelpHeight = 20;
    const segments = 32;
    const radialSegments = 8;

    const geometry = new THREE.CylinderGeometry(0.2, 0.4, baseKelpHeight, radialSegments, segments);
    const material = createKelpMaterial(baseKelpHeight, -10, kelpType);
    const count = isSecondary ? KELP2_COUNT : KELP_COUNT;

    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = false;

    if (isSecondary) {
        kelpGeometry2 = geometry;
        kelpMaterial2 = material;
        instancedKelp2 = instancedMesh;
        setupInstanceData(baseKelpHeight, true);
    } else {
        kelpGeometry = geometry;
        kelpMaterial = material;
        instancedKelp = instancedMesh;
        setupInstanceData(baseKelpHeight, false);
    }

    scene.add(instancedMesh);

    log(`Created ${count} GPU-instanced ${kelpType} kelp plants`);

    if (typeof window.FogSystem !== 'undefined') {
        log(`Fog system detected - ${kelpType} kelp material fog compatibility enabled`);
    }
}

// Enhanced GLTF loading function to handle multiple models
function loadGLTFKelp() {
    log('Attempting to load GLTF kelp models...');

    if (typeof THREE.GLTFLoader === 'undefined') {
        log('ERROR: GLTFLoader not available, using GPU cylinder kelp');
        createGPUKelp(false); // Primary kelp
        createGPUKelp(true);  // Secondary kelp
        startAnimation();
        return;
    }

    const loader = new THREE.GLTFLoader();
    let modelsLoaded = 0;
    const totalModels = 2;

    function checkCompletion() {
        if (modelsLoaded >= totalModels) {
            startAnimation();
        }
    }

    // Load primary kelp model
    loader.load(
        KELP_MODELS.primary,
        function(gltf) {
            log('Primary GLTF model loaded successfully, converting to GPU instances...');
            processGLTFModel(gltf, false);
            modelsLoaded++;
            checkCompletion();
        },
        function(progress) {
            if (progress.total > 0) {
                log(`Primary kelp loading progress: ${Math.round((progress.loaded / progress.total) * 100)}%`);
            }
        },
        function(error) {
            log('ERROR loading primary GLTF: ' + error.message + ' - using fallback');
            createGPUKelp(false);
            modelsLoaded++;
            checkCompletion();
        }
    );

    // Load secondary kelp model
    loader.load(
        KELP_MODELS.secondary,
        function(gltf) {
            log('Secondary GLTF model loaded successfully, converting to GPU instances...');
            processGLTFModel(gltf, true);
            modelsLoaded++;
            checkCompletion();
        },
        function(progress) {
            if (progress.total > 0) {
                log(`Secondary kelp loading progress: ${Math.round((progress.loaded / progress.total) * 100)}%`);
            }
        },
        function(error) {
            log('ERROR loading secondary GLTF: ' + error.message + ' - using fallback');
            createGPUKelp(true);
            modelsLoaded++;
            checkCompletion();
        }
    );
}

// Process GLTF model for instancing
function processGLTFModel(gltf, isSecondary = false) {
    const kelpType = isSecondary ? 'secondary' : 'primary';
    let gltfGeometry = null;
    
    gltf.scene.traverse((child) => {
        if (child.isMesh && child.geometry) {
            if (!gltfGeometry) {
                gltfGeometry = child.geometry.clone();
            }
        }
    });

    if (gltfGeometry) {
        gltfGeometry.computeBoundingBox();
        const bbox = gltfGeometry.boundingBox;
        const height = bbox.max.y - bbox.min.y;
        const baseY = bbox.min.y;

        log(`Using ${kelpType} GLTF geometry with height: ${height.toFixed(2)}, baseY: ${baseY.toFixed(2)}`);

        const material = createKelpMaterial(height, baseY, kelpType);
        const count = isSecondary ? KELP2_COUNT : KELP_COUNT;
        const instancedMesh = new THREE.InstancedMesh(gltfGeometry, material, count);
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = false;

        if (isSecondary) {
            kelpGeometry2 = gltfGeometry;
            kelpMaterial2 = material;
            instancedKelp2 = instancedMesh;
            setupInstanceData(height, true);
        } else {
            kelpGeometry = gltfGeometry;
            kelpMaterial = material;
            instancedKelp = instancedMesh;
            setupInstanceData(height, false);
        }

        scene.add(instancedMesh);
        log(`Created ${count} GPU-instanced ${kelpType} GLTF kelp plants`);
    } else {
        log(`No geometry found in ${kelpType} GLTF, using fallback`);
        createGPUKelp(isSecondary);
    }
}

// Enhanced instance data setup
function setupInstanceData(baseHeight = 20, isSecondary = false) {
    const count = isSecondary ? KELP2_COUNT : KELP_COUNT;
    const geometry = isSecondary ? kelpGeometry2 : kelpGeometry;
    const dataArray = isSecondary ? instanceData2 : instanceData;
    
    const instancePositions = new Float32Array(count * 3);
    const instanceRotations = new Float32Array(count * 4);
    const instanceScales = new Float32Array(count * 3);
    const animationData = new Float32Array(count * 4);
    const animationData2 = new Float32Array(count * 4);
    const animationData3 = new Float32Array(count * 2);

    // Clear the data array
    if (isSecondary) {
        instanceData2.length = 0;
    } else {
        instanceData.length = 0;
    }

    for (let i = 0; i < count; i++) {
        // Position distribution - secondary kelp uses different areas
        let x, z;
        if (isSecondary) {
            // Place secondary kelp in different zones or mixed with primary
            x = (Math.random() - 0.5) * 150; // Slightly smaller area
            z = (Math.random() - 0.5) * 150;
        } else {
            x = (Math.random() - 0.5) * 175;
            z = (Math.random() - 0.5) * 175;
        }
        const y = -1;

        instancePositions[i * 3] = x;
        instancePositions[i * 3 + 1] = y;
        instancePositions[i * 3 + 2] = z;

        const rotation = Math.random() * Math.PI * 2;
        instanceRotations[i * 4] = 0;
        instanceRotations[i * 4 + 1] = Math.sin(rotation / 2);
        instanceRotations[i * 4 + 2] = 0;
        instanceRotations[i * 4 + 3] = Math.cos(rotation / 2);

        // Scale variation - secondary kelp can have different scale range
        const scaleMin = isSecondary ? 3 : 4;
        const scaleMax = isSecondary ? 15 : 20;
        const scale = scaleMin + Math.random() * (scaleMax - scaleMin);
        
        instanceScales[i * 3] = scale;
        instanceScales[i * 3 + 1] = scale;
        instanceScales[i * 3 + 2] = scale;

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

        dataArray[i] = {
            position: { x, y, z },
            scale: scale,
            rotation: rotation
        };
    }

    geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
    geometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(instanceRotations, 4));
    geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScales, 3));
    geometry.setAttribute('animationData', new THREE.InstancedBufferAttribute(animationData, 4));
    geometry.setAttribute('animationData2', new THREE.InstancedBufferAttribute(animationData2, 4));
    geometry.setAttribute('animationData3', new THREE.InstancedBufferAttribute(animationData3, 2));
}

// Setup controls for fixed camera rotation
function setupControls() {
    document.addEventListener('mousemove', function(event) {
        if (isMouseDown) {
            targetRotationY += event.movementX * 0.01;
            targetRotationX += event.movementY * 0.01;

            // No rotation limits - full 360 degree rotation
        }
    });

    log('Fixed position camera controls initialized successfully');

    // Slider controls
    const waveSpeedSlider = document.getElementById('waveSpeed');
    const waveIntensitySlider = document.getElementById('waveIntensity');
    const currentDirectionSlider = document.getElementById('currentDirection');

    if (waveSpeedSlider) {
        waveSpeedSlider.addEventListener('input', function(e) {
            waveSpeed = parseFloat(e.target.value);
            // Update both kelp materials
            if (instancedKelp && instancedKelp.material.uniforms) {
                instancedKelp.material.uniforms.waveSpeed.value = waveSpeed;
            }
            if (instancedKelp2 && instancedKelp2.material.uniforms) {
                instancedKelp2.material.uniforms.waveSpeed.value = waveSpeed;
            }
        });
    }

    if (waveIntensitySlider) {
        waveIntensitySlider.addEventListener('input', function(e) {
            waveIntensity = parseFloat(e.target.value);
            // Update both kelp materials
            if (instancedKelp && instancedKelp.material.uniforms) {
                instancedKelp.material.uniforms.waveIntensity.value = waveIntensity;
            }
            if (instancedKelp2 && instancedKelp2.material.uniforms) {
                instancedKelp2.material.uniforms.waveIntensity.value = waveIntensity;
            }
        });
    }

    if (currentDirectionSlider) {
        currentDirectionSlider.addEventListener('input', function(e) {
            currentDirection = parseFloat(e.target.value);
            // Update both kelp materials
            if (instancedKelp && instancedKelp.material.uniforms) {
                instancedKelp.material.uniforms.currentDirection.value = currentDirection;
            }
            if (instancedKelp2 && instancedKelp2.material.uniforms) {
                instancedKelp2.material.uniforms.currentDirection.value = currentDirection;
            }

            if (typeof OceanParticles !== 'undefined') {
                const radians = (currentDirection * Math.PI) / 180;
                const x = Math.cos(radians);
                const z = Math.sin(radians);
                OceanParticles.setDirection(x, 0.1, z);
            }
        });
    }
}

// Enhanced animation loop with dual kelp support
function animate() {
    requestAnimationFrame(animate);

    time += 0.01 * waveSpeed;

    // Update primary GPU kelp shader uniforms
    if (instancedKelp && instancedKelp.material.uniforms) {
        instancedKelp.material.uniforms.time.value = time;
        instancedKelp.material.uniforms.waveSpeed.value = waveSpeed;
        instancedKelp.material.uniforms.waveIntensity.value = waveIntensity;
        instancedKelp.material.uniforms.currentDirection.value = currentDirection;
    }

    // Update secondary GPU kelp shader uniforms
    if (instancedKelp2 && instancedKelp2.material.uniforms) {
        instancedKelp2.material.uniforms.time.value = time * 0.8; // Slightly different timing
        instancedKelp2.material.uniforms.waveSpeed.value = waveSpeed * 0.9; // Slightly different speed
        instancedKelp2.material.uniforms.waveIntensity.value = waveIntensity * 1.1; // Slightly different intensity
        instancedKelp2.material.uniforms.currentDirection.value = currentDirection + 15; // Slightly different direction
    }

    // Update other systems
    if (typeof OscillatingPlane !== 'undefined') {
        OscillatingPlane.update(0.01 * waveSpeed); 
    }

    if (typeof window.RocksAndFishSystem !== 'undefined') {
        window.RocksAndFishSystem.update(0.01 * waveSpeed);
    }

    if (typeof OceanParticles !== 'undefined') {
        OceanParticles.update(0.01 * waveSpeed);
    }

    if (typeof OceanSurface !== 'undefined') {
        OceanSurface.update(0.01 * waveSpeed);
    }

    if (typeof window.AudioControlSystem !== 'undefined') {
        window.AudioControlSystem.update(0.01 * waveSpeed);
    }

    // Update camera rotation only (position stays fixed)
    rotationX += (targetRotationX - rotationX) * 0.1;
    rotationY += (targetRotationY - rotationY) * 0.1;

    // Keep camera at fixed position
    camera.position.set(0, 10, 30);

    // Apply rotation to camera
    camera.rotation.x = 0;
    camera.rotation.y = rotationY;

    renderer.render(scene, camera);
}

function startAnimation() {
    log('Starting animation with dual kelp models and fixed camera position...');

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
    log('DOM loaded, initializing dual GPU kelp forest with fixed camera...');

    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded');
        return;
    }

    initializeScene();
    setupControls();

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

// Enhanced export for compatibility with other systems
window.KelpSystem = {
    getPrimaryInstancedMesh: () => instancedKelp,
    getSecondaryInstancedMesh: () => instancedKelp2,
    getPrimaryInstanceCount: () => KELP_COUNT,
    getSecondaryInstanceCount: () => KELP2_COUNT,
    getPrimaryInstanceData: () => instanceData,
    getSecondaryInstanceData: () => instanceData2,
    // Backwards compatibility methods
    getInstancedMesh: () => instancedKelp,
    getInstanceCount: () => KELP_COUNT,
    getInstanceData: () => instanceData,
    updateUniforms: (uniforms) => {
        if (instancedKelp && instancedKelp.material.uniforms) {
            Object.assign(instancedKelp.material.uniforms, uniforms);
        }
        if (instancedKelp2 && instancedKelp2.material.uniforms) {
            Object.assign(instancedKelp2.material.uniforms, uniforms);
        }
    },
    // Additional utility methods
    getBothInstancedMeshes: () => [instancedKelp, instancedKelp2].filter(mesh => mesh !== null),
    getTotalInstanceCount: () => {
        let total = 0;
        if (instancedKelp) total += KELP_COUNT;
        if (instancedKelp2) total += KELP2_COUNT;
        return total;
    },
    setKelpVisibility: (primaryVisible = true, secondaryVisible = true) => {
        if (instancedKelp) instancedKelp.visible = primaryVisible;
        if (instancedKelp2) instancedKelp2.visible = secondaryVisible;
    }
};
