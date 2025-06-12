let oscillatingDome;
let oscillatingTime = 0;

const DOME_CONFIG = {
    radius: 3000,
    segments: 512,
    amplitude: 1.0,
    frequency: 0.05,
    speed: 1.0,
    opacity: 0.7,
    color: new THREE.Color(0x4499dd)
};

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

        // Calculate distance from center (XZ space in dome)
        float distanceFromCenter = length(newPosition.xy);
        float maxDistance = ${DOME_CONFIG.radius.toFixed(1)};

        // Add noise
        float noise1 = sin(newPosition.x * 0.003 + newPosition.y * 0.002) * 0.3;
        float noise2 = cos(newPosition.x * 0.007 - newPosition.y * 0.005) * 0.2;
        float randomOffset = noise1 + noise2;

        // Combine wave patterns
        float waveScale = 1.0 - (distanceFromCenter / maxDistance) * 0.5;
        float wave1 = sin(newPosition.x * frequency * (1.0 + randomOffset * 0.5) + time * speed) * amplitude * waveScale;
        float wave2 = cos(newPosition.y * frequency * (1.2 + randomOffset * 0.3) + time * speed * 1.3) * amplitude * 0.7 * waveScale;
        float wave3 = sin((newPosition.x + newPosition.y) * frequency * (0.8 + randomOffset * 0.4) + time * speed * 0.9) * amplitude * 0.5 * waveScale;
        float w
