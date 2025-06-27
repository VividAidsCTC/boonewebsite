// Global variables
let scene, camera, renderer;
let kelpInstances = [];
let instancedKelpModels = []; // Array to hold multiple instanced kelp models
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
const KELP_MODELS_COUNT = 4; // Number of different kelp models to use
let instanceData = [];
let kelpGeometries = [];
let kelpMaterials = [];
let modelsLoaded = 0;

// Kelp model URLs - add more URLs here for additional variety
const KELP_MODEL_URLS = [
    'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/nouveaukelp4.glb',
    // Add more kelp model URLs here when available:
    // 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/kelp_model_2.glb',
    // 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/kelp_model_3.glb',
    // 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/kelp_model_4.glb'
];

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

// Create material function with slight color variations
function createKelpMaterial(kelpHeight = 20, baseY = -10, colorVariation = 0) {
    // Create slight color variations for different kelp models
    const baseColor = new THREE.Color(0x735F1D);
    const hsl = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(hsl);
    
    // Vary hue and saturation slightly
    hsl.h += (colorVariation - 0.5) * 0.1;
    hsl.s += (colorVariation - 0.5) * 0.2;
    hsl.l += (colorVariation - 0.5) * 0.1;
    
    const variedColor = new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
    
    return new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.fog,
            {
                time: { value: 0 },
                waveSpeed: { value: waveSpeed },
                waveIntensity: { value: waveIntensity },
                currentDirection: { value: currentDirection },
                diffuse: { value: variedColor },
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

// Create GPU-instanced kelp with fallback cylinder geometry
function createFallbackKelp(modelIndex = 0) {
    log(`Creating fallback GPU-instanced kelp model ${modelIndex}...`);

    const baseKelpHeight = 20;
    const segments = 32;
    const radialSegments = 8;
    
    // Create slight variations in the cylinder geometry for different models
    const radiusTop = 0.2 + (modelIndex * 0.05);
    const radiusBottom = 0.4 + (modelIndex * 0.1);
    const height = baseKelpHeight + (modelIndex * 2);
    
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, segments);
    const material = createKelpMaterial(height, -10, modelIndex / KELP_MODELS_COUNT);

    kelpGeometries[modelIndex] = geometry;
    kelpMaterials[modelIndex] = material;
    
    log(`Created fallback kelp model ${modelIndex} with height ${height}`);
}

// Calculate how many instances each model should have
function distributeInstancesAcrossModels() {
    const instancesPerModel = Math.floor(KELP_COUNT / kelpGeometries.length);
    const remainder = KELP_COUNT % kelpGeometries.length;
    
    const distribution = [];
    for (let i = 0; i < kelpGeometries.length; i++) {
        distribution[i] = instancesPerModel + (i < remainder ? 1 : 0);
    }
    
    return distribution;
}

// Setup instance data for multiple models
function setupMultiModelInstanceData() {
    const distribution = distributeInstancesAcrossModels();
    let instanceIndex = 0;
    
    for (let modelIndex = 0; modelIndex < kelpGeometries.length; modelIndex++) {
        const instanceCount = distribution[modelIndex];
        if (instanceCount === 0) continue;
        
        const instancePositions = new Float32Array(instanceCount * 3);
        const instanceRotations = new Float32Array(instanceCount * 4);
        const instanceScales = new Float32Array(instanceCount * 3);
        const animationData = new Float32Array(instanceCount * 4);
        const animationData2 = new Float32Array(instanceCount * 4);
        const animationData3 = new Float32Array(instanceCount * 2);

        // Get the geometry bounds for this model
        kelpGeometries[modelIndex].computeBoundingBox();
        const bbox = kelpGeometries[modelIndex].boundingBox;
        const baseHeight = bbox ? (bbox.max.y - bbox.min.y) : 20;

        for (let i = 0; i < instanceCount; i++) {
            const x = (Math.random() - 0.5) * 175;
            const z = (Math.random() - 0.5) * 175;
            const y = -1;
            
            instancePositions[i * 3] = x;
            instancePositions[i * 3 + 1] = y;
            instancePositions[i * 3 + 2] = z;

            const rotation = Math.random() * Math.PI * 2;
            instanceRotations[i * 4] = 0;
            instanceRotations[i * 4 + 1] = Math.sin(rotation / 2);
            instanceRotations[i * 4 + 2] = 0;
            instanceRotations[i * 4 + 3] = Math.cos(rotation / 2);

            const scale = 4 + Math.random() * 20;
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

            instanceData[instanceIndex + i] = {
                position: { x, y, z },
                scale: scale,
                rotation: rotation,
                modelIndex: modelIndex
            };
        }

        // Set up the geometry attributes
        kelpGeometries[modelIndex].setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
        kelpGeometries[modelIndex].setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(instanceRotations, 4));
        kelpGeometries[modelIndex].setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScales, 3));
        kelpGeometries[modelIndex].setAttribute('animationData', new THREE.InstancedBufferAttribute(animationData, 4));
        kelpGeometries[modelIndex].setAttribute('animationData2', new THREE.InstancedBufferAttribute(animationData2, 4));
        kelpGeometries[modelIndex].setAttribute('animationData3', new THREE.InstancedBufferAttribute(animationData3, 2));

        // Create the instanced mesh
        const instancedMesh = new THREE.InstancedMesh(kelpGeometries[modelIndex], kelpMaterials[modelIndex], instanceCount);
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = false;
        
        instancedKelpModels[modelIndex] = instancedMesh;
        scene.add(instancedMesh);
        
        instanceIndex += instanceCount;
        
        log(`Created ${instanceCount} instances of kelp model ${modelIndex}`);
    }
}

// Load multiple GLTF kelp models
function loadMultipleGLTFKelp() {
    log('Loading multiple GLTF kelp models...');

    if (typeof THREE.GLTFLoader === 'undefined') {
        log('ERROR: GLTFLoader not available, using fallback cylinder kelp');
        createAllFallbackKelp();
        return;
    }

    const loader = new THREE.GLTFLoader();
    modelsLoaded = 0;
    
    // Load each model URL
    KELP_MODEL_URLS.forEach((url, index) => {
        loader.load(
            url,
            function(gltf) {
                log(`GLTF model ${index} loaded successfully from ${url}`);
                
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
                    
                    log(`Model ${index}: height=${height.toFixed(2)}, baseY=${baseY.toFixed(2)}`);
                    
                    kelpGeometries[index] = gltfGeometry;
                    kelpMaterials[index] = createKelpMaterial(height, baseY, index / KELP_MODEL_URLS.length);
                } else {
                    log(`No geometry found in GLTF model ${index}, using fallback`);
                    createFallbackKelp(index);
                }
                
                modelsLoaded++;
                if (modelsLoaded >= KELP_MODEL_URLS.length) {
                    finalizeKelpCreation();
                }
            },
            function(progress) {
                if (progress.total > 0) {
                    log(`Model ${index} loading: ${Math.round((progress.loaded / progress.total) * 100)}%`);
                }
            },
            function(error) {
                log(`ERROR loading GLTF model ${index}: ${error.message}`);
                createFallbackKelp(index);
                
                modelsLoaded++;
                if (modelsLoaded >= KELP_MODEL_URLS.length) {
                    finalizeKelpCreation();
                }
            }
        );
    });
    
    // If we only have one model URL, fill the rest with variations
    if (KELP_MODEL_URLS.length < KELP_MODELS_COUNT) {
        for (let i = KELP_MODEL_URLS.length; i < KELP_MODELS_COUNT; i++) {
            createFallbackKelp(i);
            modelsLoaded++;
        }
        
        if (modelsLoaded >= KELP_MODELS_COUNT) {
            finalizeKelpCreation();
        }
    }
}

function createAllFallbackKelp() {
    for (let i = 0; i < KELP_MODELS_COUNT; i++) {
        createFallbackKelp(i);
    }
    finalizeKelpCreation();
}

function finalizeKelpCreation() {
    log('Finalizing multi-model kelp creation...');
    setupMultiModelInstanceData();
    
    log(`Created ${instancedKelpModels.length} different kelp models with ${KELP_COUNT} total instances`);
    
    if (typeof window.FogSystem !== 'undefined') {
        log('Fog system detected - kelp material fog compatibility enabled');
    }
    
    startAnimation();
}

// Setup controls for fixed camera rotation
function setupControls() {
    document.addEventListener('mousemove', function(event) {
        if (isMouseDown) {
            targetRotationY += event.movementX * 0.01;
            targetRotationX += event.movementY * 0.01;
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
            // Update all kelp models
            instancedKelpModels.forEach(instancedMesh => {
                if (instancedMesh && instancedMesh.material.uniforms) {
                    instancedMesh.material.uniforms.waveSpeed.value = waveSpeed;
                }
            });
        });
    }

    if (waveIntensitySlider) {
        waveIntensitySlider.addEventListener('input', function(e) {
            waveIntensity = parseFloat(e.target.value);
            // Update all kelp models
            instancedKelpModels.forEach(instancedMesh => {
                if (instancedMesh && instancedMesh.material.uniforms) {
                    instancedMesh.material.uniforms.waveIntensity.value = waveIntensity;
                }
            });
        });
    }

    if (currentDirectionSlider) {
        currentDirectionSlider.addEventListener('input', function(e) {
            currentDirection = parseFloat(e.target.value);
            // Update all kelp models
            instancedKelpModels.forEach(instancedMesh => {
                if (instancedMesh && instancedMesh.material.uniforms) {
                    instancedMesh.material.uniforms.currentDirection.value = currentDirection;
                }
            });
            
            if (typeof OceanParticles !== 'undefined') {
                const radians = (currentDirection * Math.PI) / 180;
                const x = Math.cos(radians);
                const z = Math.sin(radians);
                OceanParticles.setDirection(x, 0.1, z);
            }
        });
    }
}

// Animation loop with fixed camera position
function animate() {
    requestAnimationFrame(animate);

    time += 0.01 * waveSpeed;

    // Update all GPU kelp shader uniforms
    instancedKelpModels.forEach(instancedMesh => {
        if (instancedMesh && instancedMesh.material.uniforms) {
            instancedMesh.material.uniforms.time.value = time;
            instancedMesh.material.uniforms.waveSpeed.value = waveSpeed;
            instancedMesh.material.uniforms.waveIntensity.value = waveIntensity;
            instancedMesh.material.uniforms.currentDirection.value = currentDirection;
        }
    });

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
    log('Starting animation with fixed camera position...');

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
    log('DOM loaded, initializing multi-model GPU kelp forest with fixed camera...');

    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded');
        return;
    }
    
    initializeScene();
    setupControls();

    setTimeout(() => {
        loadMultipleGLTFKelp();
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
    getInstancedMeshes: () => instancedKelpModels,
    getInstanceCount: () => KELP_COUNT,
    getInstanceData: () => instanceData,
    getModelCount: () => instancedKelpModels.length,
    updateUniforms: (uniforms) => {
        instancedKelpModels.forEach(instancedMesh => {
            if (instancedMesh && instancedMesh.material.uniforms) {
                Object.assign(instancedMesh.material.uniforms, uniforms);
            }
        });
    }
};
