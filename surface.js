// Oscillating plane above the seafloor
let oscillatingPlane;
let oscillatingTime = 0;

// Configuration for the oscillating plane
const PLANE_CONFIG = {
    width: 2000,
    height: 2000,
    segments: 256,
    yPosition: 70,
    amplitude: 2.0,
    frequency: 0.01,
    speed: 1.0,
    opacity: 0.7,
    color: new THREE.Color(0x4499dd)
};

// Vertex Shader for the ocean surface
const oceanVertexShader = `
    uniform float time;
    uniform float amplitude;
    uniform float frequency;
    uniform float speed;

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vWaveHeight;
    varying vec2 vUv;

    void main() {
        vNormal = normal;
        vUv = uv;
        vec3 newPosition = position;

        // Calculate multiple wave patterns
        float wave1 = sin(newPosition.x * frequency + time * speed) * amplitude;
        float wave2 = cos(newPosition.y * frequency * 0.7 + time * speed * 1.3) * amplitude * 0.6;
        float wave3 = sin((newPosition.x + newPosition.y) * frequency * 0.5 + time * speed * 0.8) * amplitude * 0.4;

        // Combine waves for more interesting motion
        float totalWave = wave1 + wave2 + wave3;

        // Pass the wave displacement to fragment shader
        vWaveHeight = totalWave;

        // Apply wave displacement along the Z-axis
        newPosition.z += totalWave;

        vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
        vViewPosition = -mvPosition.xyz;

        gl_Position = projectionMatrix * mvPosition;
    }
`;

// Fragment Shader for the ocean surface
const oceanFragmentShader = `
    uniform vec3 color;
    uniform float opacity;
    uniform float time;
    uniform float amplitude;

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vWaveHeight;
    varying vec2 vUv;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 lightDirection = normalize(vec3(0.0, 1.0, 0.0));
        float lightIntensity = max(0.0, dot(normal, lightDirection));

        // Create foam based on wave displacement relative to amplitude
        float waveRatio = vWaveHeight / amplitude;
        
        // Create foam pattern using UV coordinates for consistent distribution
        float foamNoise = sin(vUv.x * 50.0 + time * 3.0) * 
                         cos(vUv.y * 40.0 + time * 2.5) * 
                         sin((vUv.x + vUv.y) * 30.0 + time * 2.0);
        
        // Foam appears on wave crests - using relative wave height
        float foamThreshold = 0.6; // 60% of max wave height
        float foamFactor = smoothstep(foamThreshold - 0.2, foamThreshold + 0.2, waveRatio + foamNoise * 0.1);
        
        // Mix ocean color with white foam
        vec3 foamColor = vec3(0.95, 0.98, 1.0); // Slightly blue-tinted white
        vec3 baseColor = color * (0.5 + lightIntensity * 0.5);
        vec3 finalColor = mix(baseColor, foamColor, foamFactor * 0.7);
        
        // Slightly increase opacity where there's foam
        float finalOpacity = opacity + foamFactor * 0.2;

        gl_FragColor = vec4(finalColor, finalOpacity);
    }
`;

function createOscillatingPlane() {
    console.log('Creating oscillating plane with ShaderMaterial...');

    const geometry = new THREE.PlaneGeometry(
        PLANE_CONFIG.width,
        PLANE_CONFIG.height,
        PLANE_CONFIG.segments,
        PLANE_CONFIG.segments
    );

    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: oscillatingTime },
            amplitude: { value: PLANE_CONFIG.amplitude },
            frequency: { value: PLANE_CONFIG.frequency },
            speed: { value: PLANE_CONFIG.speed * 5 },
            color: { value: PLANE_CONFIG.color },
            opacity: { value: PLANE_CONFIG.opacity }
        },
        vertexShader: oceanVertexShader,
        fragmentShader: oceanFragmentShader,
        transparent: true,
        side: THREE.DoubleSide
    });

    oscillatingPlane = new THREE.Mesh(geometry, material);
    oscillatingPlane.rotation.x = -Math.PI / 2;
    oscillatingPlane.position.y = PLANE_CONFIG.yPosition;

    scene.add(oscillatingPlane);

    console.log('Oscillating plane created at Y:', PLANE_CONFIG.yPosition);
    console.log('Plane has', geometry.attributes.position.count, 'vertices');
}

function updateOscillatingPlane(deltaTime) {
    if (!oscillatingPlane || !oscillatingPlane.material.uniforms) return;
    oscillatingTime += deltaTime;
    oscillatingPlane.material.uniforms.time.value = oscillatingTime;
}

function initializeOscillatingPlane() {
    if (typeof scene !== 'undefined') {
        createOscillatingPlane();
    } else {
        console.error('Scene not available for oscillating plane');
    }
}

// Update functions
function setPlaneAmplitude(amplitude) {
    PLANE_CONFIG.amplitude = amplitude;
    if (oscillatingPlane?.material?.uniforms) {
        oscillatingPlane.material.uniforms.amplitude.value = amplitude;
    }
}

function setPlaneFrequency(frequency) {
    PLANE_CONFIG.frequency = frequency;
    if (oscillatingPlane?.material?.uniforms) {
        oscillatingPlane.material.uniforms.frequency.value = frequency;
    }
}

function setPlaneSpeed(speed) {
    PLANE_CONFIG.speed = speed;
    if (oscillatingPlane?.material?.uniforms) {
        oscillatingPlane.material.uniforms.speed.value = speed * 5;
    }
}

function setPlaneOpacity(opacity) {
    PLANE_CONFIG.opacity = opacity;
    if (oscillatingPlane?.material?.uniforms) {
        oscillatingPlane.material.uniforms.opacity.value = opacity;
    }
}

// Auto-initialize after DOM loads
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        initializeOscillatingPlane();
    }, 1500);
});

// Export for external control
window.OscillatingPlane = {
    update: updateOscillatingPlane,
    setAmplitude: setPlaneAmplitude,
    setFrequency: setPlaneFrequency,
    setSpeed: setPlaneSpeed,
    setOpacity: setPlaneOpacity,
    initialize: initializeOscillatingPlane
};
