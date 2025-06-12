// GPU-Accelerated Kelp Forest - Complete System
// Global variables
let scene, camera, renderer;
let kelp = []; // CPU fallback array
let waveSpeed = 0.8;
let waveIntensity = 0.6;
let currentDirection = 45;
let time = 0;

// GPU Kelp System Variables
let instancedKelp = null;
let kelpInstanceData = [];
let kelpTemplateGeometry = null;
let kelpMaterial = null;
const KELP_COUNT = 800; // Increased for GPU performance
let isGPUMode = false;

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

// Performance monitoring
let lastFrameTime = performance.now();
let frameCount = 0;

// GPU Kelp Vertex Shader - Safer version
const kelpVertexShader = `
    attribute vec3 originalPosition;
    attribute float instanceId;
    attribute vec3 instancePosition;
    attribute vec3 instanceRotation;
    attribute vec3 instanceScale;
    attribute vec4 animationData1; // freq1, freq2, freq3, amplitude1
    attribute vec4 animationData2; // amplitude2, amplitude3, offset1, offset2
    attribute vec2 animationData3; // offset3, heightFactor
    
    uniform float time;
    uniform float waveSpeed;
    uniform float waveIntensity;
    uniform float currentDirection;
    
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vHeightFactor;
    
    // Rotation matrix for Y axis
    mat3 rotateY(float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return mat3(
            c, 0.0, s,
            0.0, 1.0, 0.0,
            -s, 0.0, c
        );
    }
    
    void main() {
        // Get animation parameters and clamp them
        float freq1 = clamp(animationData1.x, 0.1, 2.0);
        float freq2 = clamp(animationData1.y, 0.1, 2.0);
        float freq3 = clamp(animationData1.z, 0.1, 2.0);
        float amplitude1 = clamp(animationData1.w, 0.0, 1.0);
        float amplitude2 = clamp(animationData2.x, 0.0, 1.0);
        float amplitude3 = clamp(animationData2.y, 0.0, 1.0);
        float offset1 = animationData2.z;
        float offset2 = animationData2.w;
        float offset3 = animationData3.x;
        
        // Calculate height factor and clamp it
        float heightFactor = clamp((originalPosition.y + 0.5) / 1.0, 0.0, 1.0);
        vHeightFactor = heightFactor;
        
        // Clamp time and wave intensity to prevent explosions
        float safeTime = mod(time, 6.28318); // Keep time within 0-2π
        float safeWaveIntensity = clamp(waveIntensity, 0.0, 2.0);
        
        // Calculate wave values - keep them very small
        float wave1 = sin(safeTime * freq1 + offset1) * amplitude1 * 0.1;
        float wave2 = cos(safeTime * freq2 + offset2) * amplitude2 * 0.1;
        float wave3 = sin(safeTime * freq3 + offset3) * amplitude3 * 0.1;
        
        // Convert current direction to radians and clamp
        float dirRad = radians(clamp(currentDirection, -360.0, 360.0));
        
        // Create very small, controlled undulation
        float undulationX = sin(heightFactor * 2.0 + safeTime * freq1 + offset1) * 0.1 * safeWaveIntensity * heightFactor;
        float undulationZ = cos(heightFactor * 2.0 + safeTime * freq1 + offset1 + 1.0) * 0.1 * safeWaveIntensity * heightFactor;
        
        // Apply directional current influence - very small values
        float currentInfluenceX = wave1 * safeWaveIntensity * heightFactor * 0.1;
        float currentInfluenceZ = wave2 * safeWaveIntensity * heightFactor * 0.1;
        
        // Combine and clamp the final bending
        float finalBendX = clamp((undulationX + currentInfluenceX) * cos(dirRad), -1.0, 1.0);
        float finalBendZ = clamp((undulationZ + currentInfluenceZ) * sin(dirRad), -1.0, 1.0);
        
        // Apply bending to position - very conservative
        vec3 bentPosition = originalPosition + vec3(finalBendX * 0.5, 0.0, finalBendZ * 0.5);
        
        // Apply instance transformations
        vec3 scaledPosition = bentPosition * instanceScale;
        vec3 rotatedPosition = rotateY(instanceRotation.y) * scaledPosition;
        vec3 finalPosition = rotatedPosition + instancePosition;
        
        // Safety check - ensure Y position is reasonable
        finalPosition.y = clamp(finalPosition.y, instancePosition.y - 5.0, instancePosition.y + instanceScale.y + 5.0);
        
        // Transform to world space
        vec4 worldPosition = modelMatrix * vec4(finalPosition, 1.0);
        vPosition = worldPosition.xyz;
        
        // Transform normal
        vNormal = normalize(normalMatrix * normal);
        
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
`;

// GPU Kelp Fragment Shader
const kelpFragmentShader = `
    uniform vec3 kelpColor;
    uniform float opacity;
    
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vHeightFactor;
    
    void main() {
        // Basic lighting
        vec3 lightDir = normalize(vec3(0.0, 1.0, 0.5));
        float NdotL = max(dot(normalize(vNormal), lightDir), 0.0);
        
        // Vary color based on height
        vec3 baseColor = kelpColor;
        vec3 tipColor = kelpColor * 0.7; // Darker at tips
        vec3 finalColor = mix(baseColor, tipColor, vHeightFactor);
        
        // Apply lighting
        finalColor = finalColor * (0.3 + 0.7 * NdotL);
        
        gl_FragColor = vec4(finalColor, opacity);
    }
`;

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

// GPU Kelp System Functions
function createGPUKelpSystem() {
    log('Creating GPU-accelerated kelp system...');
    
    // Create base kelp geometry
    if (!kelpTemplateGeometry) {
        const segments = 20;
        const height = 1.0; // Normalized height
        
        const geometry = new THREE.CylinderGeometry(0.02, 0.08, height, 8, segments);
        
        // Add original position attribute for shader
        const positions = geometry.attributes.position.array;
        const originalPositions = new Float32Array(positions.length);
        for (let i = 0; i < positions.length; i++) {
            originalPositions[i] = positions[i];
        }
        geometry.setAttribute('originalPosition', new THREE.BufferAttribute(originalPositions, 3));
        
        kelpTemplateGeometry = geometry;
    }
    
    // Create shader material
    const uniforms = {
        time: { value: 0 },
        waveSpeed: { value: waveSpeed },
        waveIntensity: { value: waveIntensity },
        currentDirection: { value: currentDirection },
        kelpColor: { value: new THREE.Color(0x1c4709) },
        opacity: { value: 0.85 }
    };
    
    kelpMaterial = new THREE.ShaderMaterial({
        vertexShader: kelpVertexShader,
        fragmentShader: kelpFragmentShader,
        uniforms: uniforms,
        transparent: true,
        side: THREE.DoubleSide
    });
    
    // Create instanced mesh
    instancedKelp = new THREE.InstancedMesh(kelpTemplateGeometry, kelpMaterial, KELP_COUNT);
    
    // Initialize instance data
    initializeKelpInstances();
    
    // Add to scene
    scene.add(instancedKelp);
    isGPUMode = true;
    
    log(`Created GPU kelp system with ${KELP_COUNT} instances`);
}

function initializeKelpInstances() {
    log('Initializing kelp instance data...');
    
    // Arrays for instance attributes
    const instancePositions = new Float32Array(KELP_COUNT * 3);
    const instanceRotations = new Float32Array(KELP_COUNT * 3);
    const instanceScales = new Float32Array(KELP_COUNT * 3);
    const animationData1 = new Float32Array(KELP_COUNT * 4);
    const animationData2 = new Float32Array(KELP_COUNT * 4);
    const animationData3 = new Float32Array(KELP_COUNT * 2);
    const instanceIds = new Float32Array(KELP_COUNT);
    
    // Generate random kelp instances
    for (let i = 0; i < KELP_COUNT; i++) {
        const i3 = i * 3;
        const i4 = i * 4;
        const i2 = i * 2;
        
        // Position (spread across seafloor) - more reasonable distribution
        instancePositions[i3] = (Math.random() - 0.5) * 150;     // x
        instancePositions[i3 + 1] = -1;                          // y (seafloor level)
        instancePositions[i3 + 2] = (Math.random() - 0.5) * 150; // z
        
        // Rotation (random Y rotation)
        instanceRotations[i3] = 0;                               // x
        instanceRotations[i3 + 1] = Math.random() * Math.PI * 2; // y
        instanceRotations[i3 + 2] = 0;                           // z
        
        // Scale (more reasonable random size)
        const scale = 5 + Math.random() * 10; // Smaller scale range
        instanceScales[i3] = scale;     // x
        instanceScales[i3 + 1] = scale; // y
        instanceScales[i3 + 2] = scale; // z
        
        // Animation data - smaller, more controlled values
        animationData1[i4] = 0.5 + Math.random() * 0.3;     // freq1 (slower)
        animationData1[i4 + 1] = 0.7 + Math.random() * 0.4; // freq2 (slower)
        animationData1[i4 + 2] = 0.3 + Math.random() * 0.2; // freq3 (slower)
        animationData1[i4 + 3] = 0.2 + Math.random() * 0.3; // amplitude1 (smaller)
        
        animationData2[i4] = 0.1 + Math.random() * 0.2;     // amplitude2 (smaller)
        animationData2[i4 + 1] = 0.05 + Math.random() * 0.1; // amplitude3 (smaller)
        animationData2[i4 + 2] = Math.random() * Math.PI * 2; // offset1
        animationData2[i4 + 3] = Math.random() * Math.PI * 2; // offset2
        
        animationData3[i2] = Math.random() * Math.PI * 2;   // offset3
        animationData3[i2 + 1] = 0.5 + Math.random() * 0.5; // heightFactor
        
        instanceIds[i] = i;
    }
    
    // Set instance attributes
    instancedKelp.geometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
    instancedKelp.geometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(instanceRotations, 3));
    instancedKelp.geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScales, 3));
    instancedKelp.geometry.setAttribute('animationData1', new THREE.InstancedBufferAttribute(animationData1, 4));
    instancedKelp.geometry.setAttribute('animationData2', new THREE.InstancedBufferAttribute(animationData2, 4));
    instancedKelp.geometry.setAttribute('animationData3', new THREE.InstancedBufferAttribute(animationData3, 2));
    instancedKelp.geometry.setAttribute('instanceId', new THREE.InstancedBufferAttribute(instanceIds, 1));
    
    log(`Initialized ${KELP_COUNT} kelp instances with GPU attributes`);
}

function updateGPUKelp(deltaTime) {
    if (!instancedKelp || !kelpMaterial) return;
    
    // Update shader uniforms - clamp time to prevent overflow
    kelpMaterial.uniforms.time.value = (kelpMaterial.uniforms.time.value + deltaTime) % (Math.PI * 4);
    kelpMaterial.uniforms.waveSpeed.value = waveSpeed;
    kelpMaterial.uniforms.waveIntensity.value = waveIntensity;
    kelpMaterial.uniforms.currentDirection.value = currentDirection;
    
    // Debug output occasionally
    if (Math.random() < 0.001) { // Very rarely
        console.log('GPU Kelp Debug:', {
            time: kelpMaterial.uniforms.time.value,
            waveSpeed: waveSpeed,
            waveIntensity: waveIntensity,
            kelpVisible: instancedKelp.visible,
            instanceCount: instancedKelp.count
        });
    }
}

function checkGPUCapabilities() {
    const gl = renderer.getContext();
    const supportsInstancing = renderer.capabilities.isWebGL2 || 
                              (gl.getExtension('ANGLE_instanced_arrays') !== null);
    
    log(`GPU Capabilities:`);
    log(`- Supports instancing: ${supportsInstancing}`);
    log(`- WebGL2: ${renderer.capabilities.isWebGL2}`);
    
    return supportsInstancing;
}

function loadGLTFKelpGPU() {
    log('Loading GLTF kelp for GPU system...');

    if (typeof THREE.GLTFLoader === 'undefined') {
        log('GLTFLoader not available, using procedural kelp');
        createGPUKelpSystem();
        startAnimation(); // Start animation here
        return;
    }

    const loader = new THREE.GLTFLoader();
    const kelpURL = 'https://raw.githubusercontent.com/VividAidsCTC/boonetest/main/nouveaukelp2.glb';

    loader.load(
        kelpURL,
        function(gltf) {
            log('GLTF loaded, extracting geometry for GPU system...');
            
            // Extract the first mesh geometry from the GLTF
            let extractedGeometry = null;
            gltf.scene.traverse((child) => {
                if (child.isMesh && child.geometry && !extractedGeometry) {
                    extractedGeometry = child.geometry.clone();
                }
            });
            
            if (extractedGeometry) {
                // Normalize the geometry
                extractedGeometry.computeBoundingBox();
                const bbox = extractedGeometry.boundingBox;
                const height = bbox.max.y - bbox.min.y;
                const scale = 1.0 / height;
                extractedGeometry.scale(scale, scale, scale);
                
                // Add original position attribute
                const positions = extractedGeometry.attributes.position.array;
                const originalPositions = new Float32Array(positions.length);
                for (let i = 0; i < positions.length; i++) {
                    originalPositions[i] = positions[i];
                }
                extractedGeometry.setAttribute('originalPosition', new THREE.BufferAttribute(originalPositions, 3));
                
                kelpTemplateGeometry = extractedGeometry;
                log('GLTF geometry prepared for GPU instancing');
            }
            
            createGPUKelpSystem();
            startAnimation(); // Start animation here
        },
        function(progress) {
            if (progress.total > 0) {
                log(`Loading GLTF progress: ${Math.round((progress.loaded / progress.total) * 100)}%`);
            }
        },
        function(error) {
            log('Error loading GLTF, using procedural kelp: ' + error.message);
            createGPUKelpSystem();
            startAnimation(); // Start animation here too
        }
    );
}

// CPU Fallback Functions (simplified versions of your originals)
function createFallbackKelp() {
    log('Creating fallback CPU kelp...');

    for(let i = 0; i < 100; i++) { // Reduced count for CPU
        const kelpHeight = 20;
        const geometry = new THREE.CylinderGeometry(0.2, 0.4, kelpHeight, 8, 20);
        
        const positions = geometry.attributes.position.array.slice();
        geometry.userData.originalPositions = positions;
        geometry.userData.height = kelpHeight;

        const kelpMaterial = new THREE.MeshPhongMaterial({
            color: 0x1c4709,
            transparent: true,
            opacity: 0.85,
            shininess: 10
        });

        const kelpMesh = new THREE.Mesh(geometry, kelpMaterial);
        kelpMesh.position.x = (Math.random() - 0.5) * 100;
        kelpMesh.position.z = (Math.random() - 0.5) * 100;
        kelpMesh.position.y = kelpHeight / 2;

        kelpMesh.userData = {
            originalX: kelpMesh.position.x,
            originalZ: kelpMesh.position.z,
            originalY: kelpMesh.position.y,
            height: kelpHeight,
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

    log(`Created ${kelp.length} fallback CPU kelp plants`);
    startAnimation(); // Start animation after creating kelp
}

function deformKelp(kelpMesh, time) {
    const geometry = kelpMesh.geometry;
    const positions = geometry.attributes.position;
    const originalPositions = geometry.userData.originalPositions;
    const userData = kelpMesh.userData;

    kelpMesh.position.x = userData.originalX;
    kelpMesh.position.z = userData.originalZ;
    kelpMesh.position.y = userData.originalY;

    const dirRad = (currentDirection * Math.PI) / 180;
    const wave1 = Math.sin(time * userData.freq1 + userData.offset1) * userData.amplitude1;
    const wave2 = Math.cos(time * userData.freq2 + userData.offset2) * userData.amplitude2;
    const wave3 = Math.sin(time * userData.freq3 + userData.offset3) * userData.amplitude3;

    for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;
        const originalX = originalPositions[i3];
        const originalY = originalPositions[i3 + 1];
        const originalZ = originalPositions[i3 + 2];

        const heightFactor = (originalY + userData.height/2) / userData.height;
        
        const undulationX = Math.sin(heightFactor * 2.5 + time * userData.freq1 + userData.offset1) * waveIntensity * heightFactor;
        const undulationZ = Math.cos(heightFactor * 2.5 + time * userData.freq1 + userData.offset1 + Math.PI/4) * waveIntensity * heightFactor;

        const currentInfluenceX = (wave1 + wave2 * 0.7) * waveIntensity * heightFactor * heightFactor;
        const currentInfluenceZ = (wave2 + wave3 * 0.8) * waveIntensity * heightFactor * heightFactor;

        const finalBendX = (undulationX + currentInfluenceX) * Math.cos(dirRad);
        const finalBendZ = (undulationZ + currentInfluenceZ) * Math.sin(dirRad);

        positions.setX(i, originalX + finalBendX);
        positions.setY(i, originalY);
        positions.setZ(i, originalZ + finalBendZ);
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
}

// Scene setup
function initializeScene() {
    log('Initializing Three.js scene...');

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Background
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 1000, 1000);
    const gradientTexture = new THREE.CanvasTexture(canvas);
    scene.background = gradientTexture;

    const container = document.getElementById('container');
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x6699bb, 0.3);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xaaccdd, 0.8);
    sunLight.position.set(0, 50, 10);
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

    const floor = createTexturedFloor();
    
    // Load textures after a delay
    setTimeout(() => {
        loadSeafloorTextures();
    }, 1000);
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

    log('Manual camera controls initialized successfully');

    // Enhanced slider controls that update GPU uniforms
    const waveSpeedSlider = document.getElementById('waveSpeed');
    const waveIntensitySlider = document.getElementById('waveIntensity');
    const currentDirectionSlider = document.getElementById('currentDirection');

    if (waveSpeedSlider) {
        waveSpeedSlider.addEventListener('input', function(e) {
            waveSpeed = parseFloat(e.target.value);
            if (kelpMaterial && kelpMaterial.uniforms) {
                kelpMaterial.uniforms.waveSpeed.value = waveSpeed;
            }
        });
    }

    if (waveIntensitySlider) {
        waveIntensitySlider.addEventListener('input', function(e) {
            waveIntensity = parseFloat(e.target.value);
            if (kelpMaterial && kelpMaterial.uniforms) {
                kelpMaterial.uniforms.waveIntensity.value = waveIntensity;
            }
        });
    }

    if (currentDirectionSlider) {
        currentDirectionSlider.addEventListener('input', function(e) {
            currentDirection = parseFloat(e.target.value);
            if (kelpMaterial && kelpMaterial.uniforms) {
                kelpMaterial.uniforms.currentDirection.value = currentDirection;
            }
        
            if (typeof OceanParticles !== 'undefined') {
                const radians = (currentDirection * Math.PI) / 180;
                const x = Math.cos(radians);
                const z = Math.sin(radians);
                OceanParticles.setDirection(x, 0.1, z);
            }
        });
    }

    // Toggle GPU/CPU button
    const toggleGPUButton = document.getElementById('toggleGPU');
    if (toggleGPUButton) {
        toggleGPUButton.addEventListener('click', function() {
            if (isGPUMode) {
                log('Switching to CPU kelp rendering...');
                scene.remove(instancedKelp);
                instancedKelp = null;
                isGPUMode = false;
                createFallbackKelp();
            } else {
                log('Switching to GPU kelp rendering...');
                kelp.forEach(k => scene.remove(k));
                kelp = [];
                createGPUKelpSystem();
            }
        });
    }

    // Fallback button (if it exists)
    const fallbackButton = document.getElementById('useFallback');
    if (fallbackButton) {
        fallbackButton.addEventListener('click', function() {
            log('User requested fallback kelp');
            if (isGPUMode) {
                scene.remove(instancedKelp);
                instancedKelp = null;
                isGPUMode = false;
            } else {
                kelp.forEach(k => scene.remove(k));
                kelp = [];
            }
            createFallbackKelp();
        });
    }
}

// Performance monitoring
function monitorPerformance() {
    frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTime;
    
    if (frameCount % 120 === 0) { // Log every 120 frames (2 seconds at 60fps)
        const fps = 1000 / (deltaTime / 120);
        const mode = isGPUMode ? 'GPU' : 'CPU';
        const count = isGPUMode ? KELP_COUNT : kelp.length;
        log(`Performance: ${fps.toFixed(1)} FPS (${mode} mode, ${count} kelp instances)`);
    }
    
    lastFrameTime = currentTime;
}

// Main animation loop
function animate() {
    requestAnimationFrame(animate);

    const deltaTime = 0.01 * waveSpeed;
    time += deltaTime;

    // Update kelp based on mode
    if (isGPUMode && instancedKelp && kelpMaterial) {
        updateGPUKelp(deltaTime);
        
        // Monitor performance occasionally
        if (Math.random() < 0.01) {
            monitorPerformance();
        }
    } else {
        // CPU kelp animation
        kelp.forEach(function(k) {
            deformKelp(k, time);
        });
    }

    // Update oscillating plane
    if (typeof OscillatingPlane !== 'undefined') {
        OscillatingPlane.update(deltaTime); 
    }

    // Update particles
    if (typeof OceanParticles !== 'undefined') {
        OceanParticles.update(deltaTime);
    }

    // Update ocean surface waves
    if (typeof OceanSurface !== 'undefined') {
        OceanSurface.update(deltaTime);
    }

    // Update camera position based on mouse controls
    rotationX += (targetRotationX - rotationX) * 0.1;
    rotationY += (targetRotationY - rotationY) * 0.1;

    camera.position.x = Math.sin(rotationY) * Math.cos(rotationX) * distance;
    camera.position.y = Math.sin(rotationX) * distance + 3;
    camera.position.z = Math.cos(rotationY) * Math.cos(rotationX) * distance;
    camera.lookAt(0, 3, 0);

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

// Debug logging function
function log(message) {
    console.log(message);
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        debugDiv.innerHTML += message + '<br>';
        // Auto-scroll to bottom
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
}

// Cleanup functions
function cleanupGPUKelp() {
    if (instancedKelp) {
        instancedKelp.geometry.dispose();
        instancedKelp.material.dispose();
        scene.remove(instancedKelp);
        instancedKelp = null;
    }
    kelpInstanceData = [];
    isGPUMode = false;
}

function cleanupCPUKelp() {
    kelp.forEach(k => {
        if (k.geometry) k.geometry.dispose();
        if (k.material) k.material.dispose();
        scene.remove(k);
    });
    kelp = [];
}

// Utility functions for debugging
function toggleWireframe() {
    if (isGPUMode && kelpMaterial) {
        kelpMaterial.wireframe = !kelpMaterial.wireframe;
        log(`Wireframe mode: ${kelpMaterial.wireframe ? 'ON' : 'OFF'}`);
    } else if (!isGPUMode && kelp.length > 0) {
        kelp.forEach(k => {
            k.material.wireframe = !k.material.wireframe;
        });
        log(`Wireframe mode: ${kelp[0].material.wireframe ? 'ON' : 'OFF'}`);
    }
}

function checkGPUMemory() {
    const info = renderer.info;
    log(`GPU Memory - Geometries: ${info.memory.geometries}, Textures: ${info.memory.textures}`);
    log(`Render calls: ${info.render.calls}, Triangles: ${info.render.triangles}`);
}

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    log('DOM loaded, initializing GPU kelp forest...');

    if (typeof THREE === 'undefined') {
        console.error('Three.js not loaded');
        log('ERROR: Three.js not loaded');
        return;
    }
    
    log('Three.js loaded successfully');
    initializeScene();
    setupControls();

    // Check if container exists
    const container = document.getElementById('container');
    if (!container) {
        log('ERROR: Container element not found');
        return;
    }

    // Try GPU kelp first, fallback to CPU if needed
    setTimeout(() => {
        if (checkGPUCapabilities()) {
            log('GPU instancing supported - using GPU kelp system');
            loadGLTFKelpGPU();
        } else {
            log('GPU instancing not supported - using CPU fallback');
            createFallbackKelp();
        }
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

// Global exports for compatibility with other scripts
window.GPUKelp = {
    createSystem: createGPUKelpSystem,
    loadGLTF: loadGLTFKelpGPU,
    checkCapabilities: checkGPUCapabilities,
    update: updateGPUKelp,
    cleanup: cleanupGPUKelp,
    toggleWireframe: toggleWireframe,
    checkMemory: checkGPUMemory,
    KELP_COUNT: KELP_COUNT,
    isGPUMode: () => isGPUMode
};

// Console commands for debugging
window.kelpDebug = {
    toggleGPU: () => {
        const toggleButton = document.getElementById('toggleGPU');
        if (toggleButton) toggleButton.click();
    },
    wireframe: toggleWireframe,
    memory: checkGPUMemory,
    performance: () => {
        const mode = isGPUMode ? 'GPU' : 'CPU';
        const count = isGPUMode ? KELP_COUNT : kelp.length;
        console.log(`Current mode: ${mode}, Kelp count: ${count}`);
        console.log(`Wave speed: ${waveSpeed}, Wave intensity: ${waveIntensity}, Direction: ${currentDirection}`);
    },
    testKelp: () => {
        if (isGPUMode && instancedKelp) {
            console.log('GPU Kelp Status:');
            console.log('- InstancedMesh exists:', !!instancedKelp);
            console.log('- Material exists:', !!kelpMaterial);
            console.log('- Geometry exists:', !!kelpTemplateGeometry);
            console.log('- Instance count:', instancedKelp.count);
            console.log('- Visible:', instancedKelp.visible);
            console.log('- Position:', instancedKelp.position);
            console.log('- Scale:', instancedKelp.scale);
            if (kelpMaterial && kelpMaterial.uniforms) {
                console.log('- Time uniform:', kelpMaterial.uniforms.time.value);
                console.log('- Wave intensity:', kelpMaterial.uniforms.waveIntensity.value);
                console.log('- Wave speed:', kelpMaterial.uniforms.waveSpeed.value);
            }
            
            // Check if kelp is in camera view
            const cameraPos = camera.position;
            const kelpBounds = new THREE.Box3().setFromObject(instancedKelp);
            console.log('- Camera position:', cameraPos);
            console.log('- Kelp bounds:', kelpBounds);
            
        } else {
            console.log('CPU Kelp Status:');
            console.log('- Kelp array length:', kelp.length);
            console.log('- First kelp position:', kelp[0] ? kelp[0].position : 'None');
        }
    },
    resetCamera: () => {
        distance = 30;
        targetRotationX = 0;
        targetRotationY = 0;
        rotationX = 0;
        rotationY = 0;
        console.log('Camera reset to default position');
    },
    showBounds: () => {
        // Add wireframe boxes around kelp areas to visualize bounds
        const boxGeometry = new THREE.BoxGeometry(150, 2, 150);
        const boxMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const boundingBox = new THREE.Mesh(boxGeometry, boxMaterial);
        boundingBox.position.set(0, 0, 0);
        scene.add(boundingBox);
        console.log('Added bounding box visualization');
        
        // Remove after 5 seconds
        setTimeout(() => {
            scene.remove(boundingBox);
            boxGeometry.dispose();
            boxMaterial.dispose();
            console.log('Removed bounding box visualization');
        }, 5000);
    }
};
