// Wait for DOM and then load Three.js
document.addEventListener('DOMContentLoaded', function() {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = function() {
        console.log('Three.js loaded, starting kelp forest...');
        startKelpForest();
    };
    script.onerror = function() {
        console.error('Failed to load Three.js');
    };
    document.head.appendChild(script);
});

function startKelpForest() {
    console.log('Starting kelp forest animation');
    
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x001122);
    
    const container = document.getElementById('container');
    container.appendChild(renderer.domElement);

    // Enhanced ocean lighting
    const ambientLight = new THREE.AmbientLight(0x2266aa, 0.3); // Darker blue ambient
    scene.add(ambientLight);
    
    // Strong top-down sunlight filtering through water
    const sunLight = new THREE.DirectionalLight(0x66aadd, 1.2);
    sunLight.position.set(0, 50, 10);
    sunLight.castShadow = true;
    scene.add(sunLight);
    
    // Additional rim lighting from sides
    const rimLight1 = new THREE.DirectionalLight(0x3388bb, 0.4);
    rimLight1.position.set(20, 20, 0);
    scene.add(rimLight1);
    
    const rimLight2 = new THREE.DirectionalLight(0x2266aa, 0.3);
    rimLight2.position.set(-20, 15, 0);
    scene.add(rimLight2);

    // Animation controls
    let waveSpeed = 1.5;
    let waveIntensity = 1.2;
    let currentDirection = 45;

    // Create realistic kelp forest
    const kelp = [];
    
    for(let i = 0; i < 35; i++) {
        // Random kelp dimensions
        const kelpHeight = 15 + Math.random() * 20; // 15-35 units tall
        const bottomRadius = 0.3 + Math.random() * 0.4; // 0.3-0.7 thick at bottom
        const topRadius = bottomRadius * (0.3 + Math.random() * 0.4); // Tapers at top
        
        // Create segmented kelp for better bending
        const segments = Math.floor(kelpHeight / 3); // More segments for smoother bending
        const kelpGeometry = new THREE.CylinderGeometry(topRadius, bottomRadius, kelpHeight, 8, segments);
        
        // Kelp material with more realistic coloring
        const greenVariation = 0.5 + Math.random() * 0.5; // Random green intensity
        const kelpMaterial = new THREE.MeshPhongMaterial({
            color: new THREE.Color(0.1 * greenVariation, 0.4 * greenVariation, 0.2 * greenVariation),
            transparent: true,
            opacity: 0.85,
            shininess: 10
        });
        
        const kelpMesh = new THREE.Mesh(kelpGeometry, kelpMaterial);
        
        // Position kelp
        kelpMesh.position.x = (Math.random() - 0.5) * 40;
        kelpMesh.position.z = (Math.random() - 0.5) * 40;
        kelpMesh.position.y = kelpHeight / 2; // Bottom at y=0, top at kelpHeight
        
        // Store animation data
        kelpMesh.userData = {
            originalX: kelpMesh.position.x,
            originalZ: kelpMesh.position.z,
            originalY: kelpMesh.position.y,
            height: kelpHeight,
            offset1: Math.random() * Math.PI * 2, // Random phase offset
            offset2: Math.random() * Math.PI * 2,
            offset3: Math.random() * Math.PI * 2,
            freq1: 0.8 + Math.random() * 0.6, // Random frequencies for natural variation
            freq2: 1.1 + Math.random() * 0.8,
            freq3: 0.5 + Math.random() * 0.4,
            amplitude1: 0.8 + Math.random() * 0.6, // Random amplitudes
            amplitude2: 0.6 + Math.random() * 0.5,
            amplitude3: 0.4 + Math.random() * 0.3
        };
        
        scene.add(kelpMesh);
        kelp.push(kelpMesh);
    }

    // Camera controls
    let targetRotationX = 0, targetRotationY = 0;
    let rotationX = 0, rotationY = 0;
    let distance = 30; // Pull back a bit for taller kelp
    let isMouseDown = false;

    camera.position.set(0, 8, distance);
    camera.lookAt(0, 10, 0); // Look up slightly

    // Mouse controls
    document.addEventListener('mousedown', function() { isMouseDown = true; });
    document.addEventListener('mouseup', function() { isMouseDown = false; });
    
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

    // Working sliders
    const waveSpeedSlider = document.getElementById('waveSpeed');
    const waveIntensitySlider = document.getElementById('waveIntensity');
    const currentDirectionSlider = document.getElementById('currentDirection');

    waveSpeedSlider.addEventListener('input', function(e) {
        waveSpeed = parseFloat(e.target.value);
    });

    waveIntensitySlider.addEventListener('input', function(e) {
        waveIntensity = parseFloat(e.target.value);
    });

    currentDirectionSlider.addEventListener('input', function(e) {
        currentDirection = parseFloat(e.target.value);
    });

    // Animation variables
    let time = 0;

    // Realistic kelp bending animation
    function animate() {
        requestAnimationFrame(animate);
        
        time += 0.01 * waveSpeed;
        
        kelp.forEach(function(k) {
            const userData = k.userData;
            
            // Convert direction to radians
            const dirRad = (currentDirection * Math.PI) / 180;
            
            // Multiple oscillations with different frequencies and phases
            const wave1 = Math.sin(time * userData.freq1 + userData.offset1) * userData.amplitude1;
            const wave2 = Math.cos(time * userData.freq2 + userData.offset2) * userData.amplitude2;
            const wave3 = Math.sin(time * userData.freq3 + userData.offset3) * userData.amplitude3;
            
            // Secondary cross-waves for more natural motion
            const crossWave1 = Math.cos(time * userData.freq1 * 1.3 + userData.offset2) * userData.amplitude1 * 0.6;
            const crossWave2 = Math.sin(time * userData.freq2 * 0.7 + userData.offset3) * userData.amplitude2 * 0.4;
            
            // Combine waves
            const totalWaveX = (wave1 + wave2 * 0.7 + wave3 * 0.5 + crossWave1) * waveIntensity;
            const totalWaveZ = (wave2 + wave1 * 0.6 + crossWave2) * waveIntensity;
            
            // Apply bending - more bend at the top (height-based)
            const heightFactor = userData.height / 35; // Normalize to max height
            const bendMultiplier = 0.3 + heightFactor * 0.7; // Taller kelp bends more
            
            // Apply directional bending
            k.rotation.z = totalWaveX * Math.cos(dirRad) * bendMultiplier * 0.4;
            k.rotation.x = totalWaveZ * Math.sin(dirRad) * bendMultiplier * 0.4;
            
            // Add some twist for more natural movement
            k.rotation.y = Math.sin(time * 0.3 + userData.offset1) * 0.1 * waveIntensity;
            
            // Subtle position swaying (kelp base moves slightly)
            k.position.x = userData.originalX + Math.sin(time * 0.4 + userData.offset1) * 0.3 * waveIntensity;
            k.position.z = userData.originalZ + Math.cos(time * 0.6 + userData.offset2) * 0.3 * waveIntensity;
            
            // Very subtle vertical bobbing
            k.position.y = userData.originalY + Math.sin(time * 0.2 + userData.offset3) * 0.1 * waveIntensity;
        });
        
        // Camera movement
        rotationX += (targetRotationX - rotationX) * 0.05;
        rotationY += (targetRotationY - rotationY) * 0.05;
        
        camera.position.x = Math.sin(rotationY) * Math.cos(rotationX) * distance;
        camera.position.y = Math.sin(rotationX) * distance + 10;
        camera.position.z = Math.cos(rotationY) * Math.cos(rotationX) * distance;
        camera.lookAt(0, 8, 0);
        
        renderer.render(scene, camera);
    }

    // Handle window resize
    window.addEventListener('resize', function() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    console.log('Starting realistic kelp animation');
    animate();
}
