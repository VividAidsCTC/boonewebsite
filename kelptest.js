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

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x4488bb, 0.4);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0x88ccff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // Simple animated material (no custom shaders to start)
    const kelpMaterial = new THREE.MeshPhongMaterial({
        color: 0x228833,
        transparent: true,
        opacity: 0.8
    });

    // Create kelp forest
    const kelp = [];
    const kelpGeometry = new THREE.CylinderGeometry(0.1, 0.3, 10, 8, 16);
    
    for(let i = 0; i < 30; i++) {
        const kelpMesh = new THREE.Mesh(kelpGeometry, kelpMaterial);
        kelpMesh.position.x = (Math.random() - 0.5) * 30;
        kelpMesh.position.z = (Math.random() - 0.5) * 30;
        kelpMesh.position.y = 0;
        
        const scale = 0.8 + Math.random() * 0.6;
        kelpMesh.scale.set(scale, scale, scale);
        
        scene.add(kelpMesh);
        kelp.push(kelpMesh);
    }

    // Camera position
    camera.position.set(0, 5, 25);
    camera.lookAt(0, 0, 0);

    // Animation variables
    let time = 0;

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        time += 0.01;
        
        // Simple kelp animation - rotate and sway
        kelp.forEach((k, index) => {
            k.rotation.z = Math.sin(time + index * 0.5) * 0.3;
            k.rotation.x = Math.cos(time * 0.7 + index * 0.3) * 0.2;
        });
        
        renderer.render(scene, camera);
    }

    console.log('Starting animation loop');
    animate();
    
    // Test - add a spinning cube to verify animation is working
    const testGeometry = new THREE.BoxGeometry(1, 1, 1);
    const testMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const testCube = new THREE.Mesh(testGeometry, testMaterial);
    testCube.position.set(0, 8, 0);
    scene.add(testCube);
    
    // Make the test cube spin
    function animateTest() {
        requestAnimationFrame(animateTest);
        testCube.rotation.x += 0.01;
        testCube.rotation.y += 0.01;
    }
    animateTest();
}
