// shadowSystem.js - Simplified dynamic shadow system for underwater kelp forest
// Focuses on realistic shadows without visual artifacts

class ShadowSystem {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        
        // Shadow configuration
        this.config = {
            enabled: true,
            shadowMapSize: 2048,
            shadowCameraNear: 0.5,
            shadowCameraFar: 200,
            shadowCameraSize: 100,
            shadowBias: -0.0001,
            shadowRadius: 4,
            causticIntensity: 0.15,
            causticSpeed: 0.8
        };
        
        // Lighting references
        this.sunLight = null;
        this.causticTextures = [];
        this.causticMaterial = null;
        this.causticPlane = null;
        
        // Animation properties
        this.time = 0;
        
        // Initialize the shadow system
        this.initialize();
    }
    
    initialize() {
        console.log('Initializing Simplified Shadow System...');
        
        // Enable shadows on renderer if not already enabled
        if (!this.renderer.shadowMap.enabled) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.shadowMap.autoUpdate = true;
        }
        
        this.setupLighting();
        this.createSubtleCaustics();
        
        console.log('Shadow System initialized successfully');
    }
    
    setupLighting() {
        // Find existing sun light or enhance it
        this.sunLight = this.scene.children.find(child => 
            child.type === 'DirectionalLight' && child.castShadow
        );
        
        if (this.sunLight) {
            console.log('Found existing shadow-casting light, enhancing it...');
        } else {
            console.log('No shadow-casting light found, enhancing existing directional light...');
            // Find any directional light and make it cast shadows
            this.sunLight = this.scene.children.find(child => 
                child.type === 'DirectionalLight'
            );
            
            if (this.sunLight) {
                this.sunLight.castShadow = true;
            }
        }
        
        if (this.sunLight) {
            // Configure shadow properties for better quality
            this.sunLight.shadow.mapSize.width = this.config.shadowMapSize;
            this.sunLight.shadow.mapSize.height = this.config.shadowMapSize;
            this.sunLight.shadow.camera.near = this.config.shadowCameraNear;
            this.sunLight.shadow.camera.far = this.config.shadowCameraFar;
            this.sunLight.shadow.camera.left = -this.config.shadowCameraSize;
            this.sunLight.shadow.camera.right = this.config.shadowCameraSize;
            this.sunLight.shadow.camera.top = this.config.shadowCameraSize;
            this.sunLight.shadow.camera.bottom = -this.config.shadowCameraSize;
            this.sunLight.shadow.bias = this.config.shadowBias;
            this.sunLight.shadow.radius = this.config.shadowRadius;
            
            // Slightly reposition for better shadow casting
            this.sunLight.position.set(50, 120, 40);
            
            console.log('Shadow casting light configured');
        } else {
            console.log('No directional light found to enhance');
        }
    }
    
    createSubtleCaustics() {
        // Create very subtle caustic light patterns on seafloor only
        this.generateCausticTextures();
        
        // Create simple caustic projection
        const causticGeometry = new THREE.PlaneGeometry(150, 150, 32, 32);
        this.causticMaterial = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.fog,
                {
                    time: { value: 0 },
                    causticTexture: { value: this.causticTextures[0] },
                    intensity: { value: this.config.causticIntensity }
                }
            ]),
            vertexShader: `
                #include <common>
                #include <fog_pars_vertex>
                
                varying vec2 vUv;
                
                void main() {
                    vUv = uv;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    #include <fog_vertex>
                }
            `,
            fragmentShader: `
                #include <common>
                #include <fog_pars_fragment>
                
                uniform float time;
                uniform sampler2D causticTexture;
                uniform float intensity;
                
                varying vec2 vUv;
                
                void main() {
                    // Simple animated caustic pattern
                    vec2 causticUv1 = vUv + vec2(sin(time * 0.3) * 0.05, cos(time * 0.2) * 0.05);
                    vec2 causticUv2 = vUv + vec2(cos(time * 0.4) * 0.08, sin(time * 0.35) * 0.06);
                    
                    float caustic1 = texture2D(causticTexture, causticUv1 * 3.0).r;
                    float caustic2 = texture2D(causticTexture, causticUv2 * 2.0).r;
                    
                    float causticPattern = (caustic1 + caustic2) * 0.5;
                    
                    // Very subtle effect
                    float finalIntensity = causticPattern * intensity * 0.3;
                    
                    vec4 color = vec4(vec3(0.8, 0.95, 1.0) * finalIntensity, finalIntensity * 0.2);
                    gl_FragColor = color;
                    
                    #include <fog_fragment>
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            fog: true
        });
        
        this.causticPlane = new THREE.Mesh(causticGeometry, this.causticMaterial);
        this.causticPlane.rotation.x = -Math.PI / 2;
        this.causticPlane.position.y = -0.8; // Just above seafloor
        this.scene.add(this.causticPlane);
        
        console.log('Subtle caustic effects added');
    }
    
    generateCausticTextures() {
        // Generate simple caustic patterns
        const size = 128;
        
        for (let i = 0; i < 2; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            
            const imageData = context.createImageData(size, size);
            const data = imageData.data;
            
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const index = (y * size + x) * 4;
                    
                    const nx = (x / size) * 2 - 1;
                    const ny = (y / size) * 2 - 1;
                    
                    // Simple caustic pattern
                    const freq = 6 + i * 2;
                    const caustic = Math.sin(nx * freq) * Math.cos(ny * freq);
                    const intensity = Math.max(0, caustic) * 255;
                    
                    data[index] = intensity;
                    data[index + 1] = intensity;
                    data[index + 2] = intensity;
                    data[index + 3] = 255;
                }
            }
            
            context.putImageData(imageData, 0, 0);
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            this.causticTextures.push(texture);
        }
    }
    
    updateKelpShadows() {
        // Ensure kelp instances cast and receive shadows properly
        if (window.KelpSystem) {
            const meshes = window.KelpSystem.getBothInstancedMeshes();
            meshes.forEach(mesh => {
                if (mesh) {
                    mesh.castShadow = true;
                    mesh.receiveShadow = false; // Kelp doesn't need to receive shadows from other kelp
                }
            });
        }
        
        // Update seafloor to receive shadows
        if (window.seafloor) {
            window.seafloor.receiveShadow = true;
            
            // Ensure seafloor material can receive shadows
            if (window.seafloor.material && !window.seafloor.material.receiveShadow) {
                window.seafloor.material.needsUpdate = true;
            }
        }
    }
    
    update(deltaTime) {
        if (!this.config.enabled) return;
        
        this.time += deltaTime;
        
        // Update caustic animation
        if (this.causticMaterial && this.causticMaterial.uniforms) {
            this.causticMaterial.uniforms.time.value = this.time * this.config.causticSpeed;
            
            // Cycle through caustic textures slowly
            const textureIndex = Math.floor(this.time * 0.5) % this.causticTextures.length;
            if (this.causticTextures[textureIndex]) {
                this.causticMaterial.uniforms.causticTexture.value = this.causticTextures[textureIndex];
            }
        }
        
        // Very subtle sun light movement for dynamic shadows
        if (this.sunLight) {
            const lightSway = Math.sin(this.time * 0.1) * 3; // Much more subtle
            this.sunLight.position.x = 50 + lightSway;
            this.sunLight.position.z = 40 + Math.cos(this.time * 0.08) * 2;
        }
    }
    
    // Configuration methods
    setShadowQuality(quality) {
        const qualities = {
            low: 1024,
            medium: 2048,
            high: 4096,
            ultra: 8192
        };
        
        const size = qualities[quality] || qualities.medium;
        this.config.shadowMapSize = size;
        
        if (this.sunLight && this.sunLight.shadow) {
            this.sunLight.shadow.mapSize.width = size;
            this.sunLight.shadow.mapSize.height = size;
            this.sunLight.shadow.map.dispose();
            this.sunLight.shadow.map = null;
        }
        
        console.log(`Shadow quality set to ${quality} (${size}x${size})`);
    }
    
    setCausticIntensity(intensity) {
        this.config.causticIntensity = intensity;
        if (this.causticMaterial && this.causticMaterial.uniforms) {
            this.causticMaterial.uniforms.intensity.value = intensity;
        }
        
        console.log(`Caustic intensity set to ${intensity}`);
    }
    
    toggleShadows(enabled) {
        this.config.enabled = enabled;
        this.renderer.shadowMap.autoUpdate = enabled;
        
        if (this.sunLight) {
            this.sunLight.castShadow = enabled;
        }
        
        if (this.causticPlane) {
            this.causticPlane.visible = enabled;
        }
        
        console.log(`Shadows ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    // Method to adjust overall brightness
    adjustSceneBrightness(factor = 1.2) {
        // Find ambient light and boost it slightly to counteract darkening
        const ambientLight = this.scene.children.find(child => 
            child.type === 'AmbientLight'
        );
        
        if (ambientLight) {
            ambientLight.intensity = Math.min(ambientLight.intensity * factor, 0.5);
            console.log(`Ambient light boosted to ${ambientLight.intensity}`);
        }
        
        // Slightly boost other directional lights that aren't the sun
        this.scene.children.forEach(child => {
            if (child.type === 'DirectionalLight' && child !== this.sunLight) {
                child.intensity = Math.min(child.intensity * 1.1, 0.3);
            }
        });
    }
    
    // Cleanup method
    dispose() {
        this.causticTextures.forEach(texture => texture.dispose());
        if (this.causticMaterial) this.causticMaterial.dispose();
        
        console.log('Shadow System disposed');
    }
}

// Initialize shadow system when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait for scene to be initialized
    const initShadowSystem = () => {
        if (typeof scene !== 'undefined' && typeof renderer !== 'undefined') {
            window.ShadowSystem = new ShadowSystem(scene, renderer);
            
            // Counteract darkening by boosting ambient lighting slightly
            window.ShadowSystem.adjustSceneBrightness(1.3);
            
            // Integrate with existing animation loop - but avoid recursion
            if (typeof window.animate === 'undefined' && typeof animate !== 'undefined') {
                window.animate = animate;
            }
            
            if (!window.shadowSystemIntegrated) {
                window.shadowSystemIntegrated = true;
                
                const originalAnimate = window.animate;
                if (typeof originalAnimate === 'function') {
                    window.animate = function() {
                        originalAnimate();
                        if (window.ShadowSystem) {
                            window.ShadowSystem.update(0.01 * (window.waveSpeed || 1.2));
                            window.ShadowSystem.updateKelpShadows();
                        }
                    };
                }
            }
            
            console.log('Simplified Shadow System integrated successfully');
        } else {
            // Retry after a short delay
            setTimeout(initShadowSystem, 100);
        }
    };
    
    // Start initialization after a delay to ensure kelp system is loaded
    setTimeout(initShadowSystem, 1000);
});

// Export for module compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShadowSystem;
}