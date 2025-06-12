// Oscillating plane above the seafloor
let oscillatingPlane;
let oscillatingTime = 0;

// Configuration for the oscillating plane
const PLANE_CONFIG = {
    width: 2000,           // Same as your ground plane
    height: 2000,          // Same as your ground plane
    segments: 256,         // More segments for smoother waves with displacement
    yPosition: 70,          // Units above ground (ground is at y = -1)
    amplitude: 2.0,        // Larger wave height for visibility
    frequency: 0.01,       // Lower frequency for larger waves
    speed: 1.0,            // Animation speed
    opacity: 0.7,          // Transparency
    color: new THREE.Color(0x4499dd) // Ocean blue color
};

// Vertex Shader for the ocean surface
const oceanVertexShader = 
    uniform float time;
    uniform float amplitude;
    uniform float frequency;
    uniform float speed;

    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
        vNormal = normal;
        
        vec3 newPosition = position;
        
        // Calculate multiple wave patterns
        float wave1 = sin(newPosition.x * frequency + time * speed) * amplitude;
        float wave2 = cos(newPosition.y * frequency * 0.7 + time * speed * 1.3) * amplitude * 0.6;
        float wave3 = sin((newPosition.x + newPosition.y) * frequency * 0.5 + time * speed * 0.8) * amplitude * 0.4;
        
        // Combine waves for more interesting motion
        float totalWave = wave1 + wave2 + wave3;
        
        // Apply wave displacement along the Y-axis (upwards for a horizontal plane)
        newPosition.z += totalWave; // Modify the Z-coordinate in local space which becomes Y in world space after rotation

        vec4 mvPosition = modelViewMatrix * vec4( newPosition, 1.0 );
        vViewPosition = -mvPosition.xyz;

        gl_Position = projectionMatrix * mvPosition;
    }
;

// Fragment Shader for the ocean surface
const oceanFragmentShader = 
    uniform vec3 color;
    uniform float opacity;

    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
        // Simple Phong-like lighting calculation
        vec3 normal = normalize(vNormal);
        vec3 lightDirection = normalize(vec3(0.0, 1.0, 0.0)); // Example light direction from above
        float lightIntensity = max(0.0, dot(normal, lightDirection));

        gl_FragColor = vec4(color * (0.5 + lightIntensity * 0.5), opacity);
    }
;

function createOscillatingPlane() {
    console.log('Creating oscillating plane with ShaderMaterial...');
    
    const geometry = new THREE.PlaneGeometry(
        PLANE_CONFIG.width, 
        PLANE_CONFIG.height, 
        PLANE_CONFIG.segments, 
        PLANE_CONFIG.segments
    );
    
    // Shader Material for GPU-based wave deformation
    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: oscillatingTime },
            amplitude: { value: PLANE_CONFIG.amplitude },
            frequency: { value: PLANE_CONFIG.frequency },
            speed: { value: PLANE_CONFIG.speed * 5 }, // Increased speed multiplier
            color: { value: PLANE_CONFIG.color },
            opacity: { value: PLANE_CONFIG.opacity }
        },
        vertexShader: oceanVertexShader,
        fragmentShader: oceanFragmentShader,
        transparent: true,
        side: THREE.DoubleSide // Render both sides of the plane
    });
    
    oscillatingPlane = new THREE.Mesh(geometry, material);
    
    // Position the plane (horizontal, at specified Y position)
    oscillatingPlane.rotation.x = -Math.PI / 2; // Make it horizontal
    oscillatingPlane.position.y = PLANE_CONFIG.yPosition;
    
    scene.add(oscillatingPlane);
    
    console.log('Oscillating plane created and added to scene at Y:', PLANE_CONFIG.yPosition);
    console.log('Plane has', geometry.attributes.position.count, 'vertices');
}

function updateOscillatingPlane(deltaTime) {
    if (!oscillatingPlane || !oscillatingPlane.material.uniforms) return;
    
    // Update time uniform, which drives the wave animation in the shader
    oscillatingTime += deltaTime;
    oscillatingPlane.material.uniforms.time.value = oscillatingTime;
}

// Function to initialize the oscillating plane (call this after your scene is set up)
function initializeOscillatingPlane() {
    if (typeof scene !== 'undefined') {
        createOscillatingPlane();
    } else {
        console.error('Scene not available for oscillating plane');
    }
}

// Functions to update plane settings (these will now update uniforms)
function setPlaneAmplitude(amplitude) {
    PLANE_CONFIG.amplitude = amplitude;
    if (oscillatingPlane && oscillatingPlane.material.uniforms) {
        oscillatingPlane.material.uniforms.amplitude.value = amplitude;
    }
}

function setPlaneFrequency(frequency) {
    PLANE_CONFIG.frequency = frequency;
    if (oscillatingPlane && oscillatingPlane.material.uniforms) {
        oscillatingPlane.material.uniforms.frequency.value = frequency;
    }
}

function setPlaneSpeed(speed) {
    PLANE_CONFIG.speed = speed;
    if (oscillatingPlane && oscillatingPlane.material.uniforms) {
        oscillatingPlane.material.uniforms.speed.value = speed * 5; // Apply the multiplier
    }
}

function setPlaneOpacity(opacity) {
    PLANE_CONFIG.opacity = opacity;
    if (oscillatingPlane && oscillatingPlane.material.uniforms) {
        oscillatingPlane.material.uniforms.opacity.value = opacity;
    }
}

// Auto-initialize when DOM is loaded (after your main script)
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the main scene to be set up
    setTimeout(() => {
        initializeOscillatingPlane();
    }, 1500);
});

// Export for global access
window.OscillatingPlane = {
    update: updateOscillatingPlane,
    setAmplitude: setPlaneAmplitude,
    setFrequency: setPlaneFrequency,
    setSpeed: setPlaneSpeed,
    setOpacity: setPlaneOpacity,
    initialize: initializeOscillatingPlane
};
