// Global variables
let scene, camera, renderer;
let kelpInstances = []; // Changed from kelp array to instances array
let instancedKelp = null; // Will hold the InstancedMesh
let waveSpeed = 1.2;
let waveIntensity = 0.6;
let currentDirection = 45;
let time = 0;

// Camera controls
let targetRotationX = 0, targetRotationY = 0;
let rotationX = 0, rotationY = 0;
let distance = 30;
let isMouseDown = false;

// Texture loading variables
let floorTextures = {
    diffuse: null,
    normal: null,
    roughness: null,
    displacement: null
};
let textureLoader = new THREE.TextureLoader();

// GPU Instancing variables
const KELP_COUNT = 175;
let instanceMatrix = null;
let instanceData = []; // Store animation data for each instance
let kelpGeometry = null;
let kelpMaterial = null;

// Vertex shader for kelp animation that extends Three.js built-in shaders
const kelpVertexShader = `
    #include <common>
    #include <fog_pars_vertex>
    
    attribute vec3 instancePosition;
    attribute vec4 instanceRotation;
    attribute vec3 instanceScale;
    attribute vec4 animationData; // offset1, freq1, amplitude1, heightScale
    attribute vec4 animationData2; // offset2, freq2, amplitude2, offset3
    attribute vec2 animationData3; // freq3, amplitude3
    
    uniform float time;
    uniform float waveSpeed;
    uniform float waveIntensity;
    uniform float currentDirection;
    
    varying vec3 vNormal;
    
    // Function to apply quaternion rotation
    vec3 applyQuaternion(vec3 v, vec4 q) {
        return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
    }
    
    void main() {
        // Get animation parameters
        float offset1 = animationData.x;
        float freq1 = animationData.y;
        float amplitude1 = animationData.z;
        float heightScale = animationData.w;
        
        float offset2 = animationData2.x;
        float freq2 = animationData2.y;
        float amplitude2 = animationData2.z;
        float offset3 = animationData2.w;
        
        float freq3 = animationData3.x;
        float amplitude3 = animationData3.y;
        
        // Calculate height factor more carefully to ensure base stays fixed
        // For cylinder geometry, Y goes from -height/2 to +height/2
        // For GLTF, we need to use the actual bounds
        float normalizedHeight = (position.y + heightScale * 0.5) / heightScale;
        float heightFactor = clamp(normalizedHeight, 0.0, 1.0);
        
        // Only apply deformation to vertices above the base (heightFactor > 0.1)
        float deformationMask = smoothstep(0.0, 0.2, heightFactor);
        
        // Apply deformation in original object space, but only to upper vertices
        vec3 deformedPosition = position;
        deformedPosition.x += finalBendX * deformationMask;
        deformedPosition.z += finalBendZ * deformationMask;
        // Convert direction to radians
        float dirRad = radians(currentDirection);
        
        // Calculate wave values
        float wave1 = sin(time * freq1 + offset1) * amplitude1;
        float wave2 = cos(time * freq2 + offset2) * amplitude2;
        float wave3 = sin(time * freq3 + offset3) * amplitude3;
        
        // Create multiple undulation points along the height
        float undulationFreq1 = 2.5;
        float undulationFreq2 = 5.0;
        float undulationFreq3 = 8.0;
        
        // Calculate undulating displacement - only use heightFactor for intensity
        float undulationX = (
            sin(heightFactor * undulationFreq1 + time * freq1 + offset1) * 1.0 +
            sin(heightFactor * undulationFreq2 + time * freq2 + offset2) * 0.5 +
            sin(heightFactor * undulationFreq3 + time * freq3 + offset3) * 0.25
        ) * waveIntensity * heightFactor;
        
        float undulationZ = (
            cos(heightFactor * undulationFreq1 + time * freq1 + offset1 + 0.785) * 0.8 +
            cos(heightFactor * undulationFreq2 + time * freq2 + offset2 + 1.047) * 0.4 +
            cos(heightFactor * undulationFreq3 + time * freq3 + offset3 + 0.524) * 0.2
        ) * waveIntensity * heightFactor;
        
        // Apply directional current influence
        float currentInfluenceX = (wave1 + wave2 * 0.7) * waveIntensity * heightFactor * heightFactor;
        float currentInfluenceZ = (wave2 + wave3 * 0.8) * waveIntensity * heightFactor * heightFactor;
        
        // Combine undulation with current direction
        float finalBendX = (undulationX + currentInfluenceX) * cos(dirRad) + 
                          (undulationZ + currentInfluenceZ) * sin(dirRad) * 0.3;
        float finalBendZ = (undulationZ + currentInfluenceZ) * sin(dirRad) + 
                          (undulationX + currentInfluenceX) * cos(dirRad) * 0.3;
        vec3 scaledPosition = deformedPosition * instanceScale;
        vec3 rotatedPosition = applyQuaternion(scaledPosition, instanceRotation);
        
        // Finally position in world space (this should keep the base fixed)
        vec3 finalPosition = rotatedPosition + instancePosition;
        
        // Transform to world and view space
        vec4 mvPosition = modelViewMatrix * vec4(finalPosition, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        // Pass normal for lighting
        vNormal = normalize(normalMatrix * normal);
        
        // Three.js fog calculation
        #include <fog_vertex>
    }
`;

// Fragment shader for kelp that uses Three.js fog system
const kelpFragmentShader = `
    #include <common>
    #include <fog_pars_fragment>
    
    uniform vec3 diffuse;
    uniform float opacity;
    
    varying vec3 vNormal;
    
    void main() {
        // Basic Phong-like lighting
        vec3 lightDirection = normalize(vec3(0.5, 1.0, 0.3));
        float dotNL = max(dot(normalize(vNormal), lightDirection), 0.0);
        
        vec3 color = diffuse * (0.3 + 0.7 * dotNL);
        
        gl_FragColor = vec4(color, opacity);
        
        // Three.js fog calculation
        #include <fog_fragment>
    }
`;

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

    // Lighting setup
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
    
    // Create custom shader material with Three.js fog integration
    kelpMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.fog,
            {
                time: { value: 0 },
                waveSpeed: { value: waveSpeed },
                waveIntensity: { value: waveIntensity },
                currentDirection: { value: currentDirection },
                diffuse: { value: new THREE.Color(0x735F1D) }, // Dark green-brown
                opacity: { value: 0.85 }
            }
        ]),
        vertexShader: kelpVertexShader,
        fragmentShader: kelpFragmentShader,
        transparent: true,
        fog: true // CRITICAL: Enable fog support
    });

    // Create instanced mesh
    instancedKelp = new THREE.InstancedMesh(kelpGeometry, kelpMaterial, KELP_COUNT);
    
    // Set up instance attributes
    const instancePositions = new Float32Array(KELP_COUNT * 3);
    const instanceRotations = new Float32Array(KELP_COUNT * 4);
    const instanceScales = new Float32Array(KELP_COUNT * 3);
    const animationData = new Float32Array(KELP_COUNT * 4); // offset1, freq1, amplitude1, heightScale
    const animationData2 = new Float32Array(KELP_COUNT * 4); // offset2, freq2, amplitude2, offset3
    const animationData3 = new Float32Array(KELP_COUNT * 2); // freq3, amplitude3

    // Generate instance data
    for (let i = 0; i < KELP_COUNT; i++) {
        // Position
        const x = (Math.random() - 0.5) * 175;
        const z = (Math.random() - 0.5) * 175;
        const y = -1; // Seafloor level
        
        instancePositions[i * 3] = x;
        instancePositions[i * 3 + 1] = y;
        instancePositions[i * 3 + 2] = z;

        // Rotation (quaternion)
        const rotation = Math.random() * Math.PI * 2;
        instanceRotations[i * 4] = 0;
        instanceRotations[i * 4 + 1] = Math.sin(rotation / 2);
        instanceRotations[i * 4 + 2] = 0;
        instanceRotations[i * 4 + 3] = Math.cos(rotation / 2);

        // Scale
        const scale = 4 + Math.random() * 20; // Random scale between 4x and 24x
        instanceScales[i * 3] = scale;
        instanceScales[i * 3 + 1] = scale;
        instanceScales[i * 3 + 2] = scale;

        // Animation data
        animationData[i * 4] = Math.random() * Math.PI * 2; // offset1
        animationData[i * 4 + 1] = 0.8 + Math.random() * 0.6; // freq1
        animationData[i * 4 + 2] = 0.8 + Math.random() * 0.6; // amplitude1
        animationData[i * 4 + 3] = baseKelpHeight * scale; // heightScale

        animationData2[i * 4] = Math.random() * Math.PI * 2; // offset2
        animationData2[i * 4 + 1] = 1.1 + Math.random() * 0.8; // freq2
        animationData2[i * 4 + 2] = 0.6 + Math.random() * 0.5; // amplitude2
        animationData2[i * 4 + 3] = Math.random() * Math.PI * 2; // offset3

        animationData3[i * 2] = 0.5 + Math.random() * 0.4; // freq3
        animationData3[i * 2 + 1] = 0.4 + Math.random() * 0.3; // amplitude3

        // Store instance data for reference
        instanceData[i] = {
            position: { x, y, z },
            scale: scale,
            rotation: rotation
        };
    }

    // Set instance attributes
    kelpGeometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
    kelpGeometry.setAttribute('instanceRotation', new THREE.InstancedBufferAttribute(instanceRotations, 4));
    kelpGeometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScales, 3));
    kelpGeometry.setAttribute('animationData', new THREE.InstancedBufferAttribute(animationData, 4));
    kelpGeometry.setAttribute('animationData2', new THREE.InstancedBufferAttribute(animationData2, 4));
    kelpGeometry.setAttribute('animationData3', new THREE.InstancedBufferAttribute(animationData3, 2));

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
                
                log(`Using GLTF geometry with height: ${height.toFixed(2)}`);
                
                // Create material with Three.js fog integration
                kelpMaterial = new THREE.ShaderMaterial({
                    uniforms: THREE.UniformsUtils.merge([
                        THREE.UniformsLib.fog,
                        {
                            time: { value: 0 },
                            waveSpeed: { value: waveSpeed },
                            waveIntensity: { value: waveIntensity },
                            currentDirection: { value: currentDirection },
                            diffuse: { value: new THREE.Color(0x735F1D) },
                            opacity: { value: 0.85 }
                        }
                    ]),
                    vertexShader: kelpVertexShader,
                    fragmentShader: kelpFragmentShader,
                    transparent: true,
                    fog: true // CRITICAL: Enable fog support
                });

                // Create instanced mesh with GLTF geometry
                instancedKelp = new THREE.InstancedMesh(kelpGeometry, kelpMaterial, KELP_COUNT);
                
                // Set up instance data (same as before but with GLTF height)
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
