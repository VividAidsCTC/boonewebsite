<!DOCTYPE html>
<html>
<head>
    <title>Optimized Rocks and Fish</title>
    <style>
        body { margin: 0; }
        canvas { display: block; }
    </style>
</head>
<body>
    <script type="importmap">
    {
        "imports": {
            "three": "https://unpkg.com/three@0.165.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.165.0/examples/jsm/"
        }
    }
    </script>

    <script type="module">
        import * as THREE from 'three';
        import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

        // --- Global Variables (scoped to this module) ---
        let scene, camera, renderer, controls;
        let rockInstances = [];
        let fishInstances = [];
        let allInstancedMeshes = [];
        const clock = new THREE.Clock();

        // --- Performance-optimized configuration ---
        const INSTANCES_PER_ROCK_MODEL = 25;
        const INSTANCES_PER_FISH_MODEL = 15;
        const SPAWN_RADIUS = 150;

        // --- Model configurations ---
        const ASSET_CONFIG = {
            rocks: [{
                name: 'rock1',
                url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/rock1.glb',
                scale: { min: 0.8, max: 1.5 },
                yOffset: -1,
            }, {
                name: 'rock2',
                url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/rock2.glb',
                scale: { min: 1.0, max: 1.8 },
                yOffset: -1,
            }],
            fish: [{
                name: 'fish1',
                url: 'https://raw.githubusercontent.com/VividAidsCTC/boonetest2/main/ocean_models/fish1.glb',
                scale: { min: 0.3, max: 0.7 },
                yOffset: 5,
                swimHeight: { min: 3, max: 12 },
            }]
        };

        // --- Simplified Fish Shaders (now using instanceMatrix) ---
        const fishVertexShader = `
            // instanceMatrix is provided automatically by InstancedMesh
            attribute vec2 animationData; // swimSpeed, phaseOffset
            
            uniform float time;
            uniform float globalSwimSpeed;
            
            varying vec3 vNormal;
            
            void main() {
                vec3 pos = position;
                
                float swimSpeed = animationData.x;
                float phaseOffset = animationData.y;
                
                // Simplified swimming motion
                float t = time * globalSwimSpeed * swimSpeed + phaseOffset;
                pos.x += sin(t) * 0.5; // Bend the body
                pos.y += cos(t * 1.5) * 0.2; // Gentle up/down bob
                
                // The instanceMatrix already contains position, rotation, and scale
                vec4 modelViewPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * modelViewPosition;
                
                // Correctly transform the normal
                vNormal = normalize( normalMatrix * mat3(instanceMatrix) * normal );
            }
        `;

        const fishFragmentShader = `
            uniform vec3 diffuse;
            varying vec3 vNormal;
            
            void main() {
                // Simplified lighting
                float dotNL = max(dot(normalize(vNormal), normalize(vec3(0.5, 1.0, 0.3))), 0.2);
                gl_FragColor = vec4(diffuse * dotNL, 1.0); // Use 1.0 alpha
            }
        `;

        // --- Initialization ---
        function init() {
            // Scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x050A1A); // Dark blue background
            scene.fog = new THREE.Fog(0x050A1A, 50, 200);

            // Camera
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 15, 40);

            // Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);

            // Controls
            controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.target.set(0, 5, 0);

            // Lighting
            const ambientLight = new THREE.AmbientLight(0x404060, 2); // Soft ambient light
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
            directionalLight.position.set(10, 30, 20);
            scene.add(directionalLight);
            
            // Start asset loading
            loadAllAssets(scene);

            // Handle window resizing
            window.addEventListener('resize', onWindowResize, false);

            // Start the animation loop
            animate();
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        // --- Asset Loading and Setup ---
        async function loadAllAssets(scene) {
            console.log('[Assets] Loading assets sequentially...');
            try {
                for (const rockConfig of ASSET_CONFIG.rocks) {
                    await loadAssetModel(scene, rockConfig, true);
                }
                for (const fishConfig of ASSET_CONFIG.fish) {
                    await loadAssetModel(scene, fishConfig, false);
                }
                const totalInstances = (rockInstances.length * INSTANCES_PER_ROCK_MODEL) + (fishInstances.length * INSTANCES_PER_FISH_MODEL);
                console.log(`[Assets] All assets loaded! Total instances: ${totalInstances}`);
            } catch (error) {
                console.error(`[Assets] Error loading assets: ${error.message}`);
            }
        }

        async function loadAssetModel(scene, assetConfig, isRock) {
            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync(assetConfig.url);
            
            let geometry = null;
            gltf.scene.traverse((child) => {
                if (child.isMesh && !geometry) {
                    geometry = child.geometry;
                }
            });

            if (!geometry) {
                console.error(`No geometry found in ${assetConfig.name}`);
                // Use a fallback so the app doesn't crash
                geometry = new THREE.BoxGeometry(1, 1, 1);
            }
            
            // --- Material Creation ---
            let material;
            const instanceCount = isRock ? INSTANCES_PER_ROCK_MODEL : INSTANCES_PER_FISH_MODEL;
            
            if (isRock) {
                material = new THREE.MeshLambertMaterial({ color: 0x605550 }); // A more rock-like color
            } else {
                // For fish, we add the animation attributes to the geometry
                setupFishAnimationData(geometry, instanceCount);
                material = new THREE.ShaderMaterial({
                    uniforms: {
                        time: { value: 0 },
                        globalSwimSpeed: { value: 0.5 },
                        diffuse: { value: new THREE.Color(0x4488bb) }
                    },
                    vertexShader: fishVertexShader,
                    fragmentShader: fishFragmentShader,
                    fog: true // Allow fog to affect fish
                });
            }

            const instancedMesh = new THREE.InstancedMesh(geometry, material, instanceCount);
            
            // --- Instancing Logic using setMatrixAt ---
            const matrix = new THREE.Matrix4();
            for (let i = 0; i < instanceCount; i++) {
                const position = new THREE.Vector3();
                const rotation = new THREE.Quaternion();
                const scale = new THREE.Vector3();

                // Position
                const x = (Math.random() - 0.5) * SPAWN_RADIUS * 2;
                const z = (Math.random() - 0.5) * SPAWN_RADIUS * 2;
                let y = assetConfig.yOffset;
                if (assetConfig.swimHeight) {
                    y += assetConfig.swimHeight.min + Math.random() * (assetConfig.swimHeight.max - assetConfig.swimHeight.min);
                }
                position.set(x, y, z);

                // Rotation
                rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);

                // Scale
                const scaleVal = assetConfig.scale.min + Math.random() * (assetConfig.scale.max - assetConfig.scale.min);
                scale.set(scaleVal, scaleVal, scaleVal);

                // Compose matrix and set it for the instance
                matrix.compose(position, rotation, scale);
                instancedMesh.setMatrixAt(i, matrix);
            }
            instancedMesh.instanceMatrix.needsUpdate = true;
            
            scene.add(instancedMesh);
            allInstancedMeshes.push(instancedMesh);

            if (isRock) {
                rockInstances.push({ mesh: instancedMesh });
            } else {
                fishInstances.push({ mesh: instancedMesh });
            }
            console.log(`[Assets] Created ${instanceCount} instances of ${assetConfig.name}`);
        }

        function setupFishAnimationData(geometry, count) {
            const animationData = new Float32Array(count * 2);
            for (let i = 0; i < count; i++) {
                // swimSpeed
                animationData[i * 2 + 0] = 0.5 + Math.random() * 0.5;
                // phaseOffset
                animationData[i * 2 + 1] = Math.random() * Math.PI * 2;
            }
            geometry.setAttribute('animationData', new THREE.InstancedBufferAttribute(animationData, 2));
        }

        // --- Animation Loop ---
        function updateAssets(deltaTime) {
            // Update fish shader time uniform
            fishInstances.forEach(fishInstance => {
                if (fishInstance.mesh.material.uniforms) {
                    fishInstance.mesh.material.uniforms.time.value += deltaTime;
                }
            });
        }

        function animate() {
            requestAnimationFrame(animate);
            
            const deltaTime = clock.getDelta();
            
            controls.update();
            updateAssets(deltaTime);

            renderer.render(scene, camera);
        }

        // --- Start Everything ---
        init();

    </script>
</body>
</html>
