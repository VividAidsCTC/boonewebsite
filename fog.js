/**
 * FOG SYSTEM
 * 
 * This file adds atmospheric fog to the underwater scene for distance dimming.
 * It works alongside kelptest.js and seafloor-models.js.
 * 
 * REQUIREMENTS:
 * - kelptest.js must be loaded first (creates the 'scene' global variable)
 * - Three.js must be loaded
 * - This file should be loaded after kelptest.js
 */

console.log('🌫️ Fog System Loading...');

// Fog configuration
const FOG_CONFIG = {
    // Default underwater fog settings
    color: 0x2f6992,        // Dark blue to match background gradient
    near: 5,               // Distance where fog starts (units)
    far: 200,               // Distance where fog is maximum (units)
    intensity: 2.0,         // Fog intensity multiplier
    enabled: true           // Whether fog is active
};

// Store original fog settings for reset
let originalFogConfig = null;

/**
 * INITIALIZE FOG SYSTEM
 */
function initializeFogSystem() {
    console.log('🌫️ Initializing atmospheric fog system...');
    
    // Check if scene exists
    if (typeof scene === 'undefined') {
        console.error('❌ Scene not found! Make sure kelptest.js loaded first.');
        return false;
    }
    
    // Store original settings
    originalFogConfig = { ...FOG_CONFIG };
    
    // Apply fog to scene
    applyFog();
    
    // Update materials to respond to fog
    updateMaterialsForFog();
    
    console.log('✅ Fog system initialized successfully');
    updateDebugDisplay('🌫️ Atmospheric fog enabled');
    
    return true;
}

/**
 * APPLY FOG TO SCENE
 */
function applyFog() {
    if (!FOG_CONFIG.enabled) {
        scene.fog = null;
        console.log('🌫️ Fog disabled');
        return;
    }
    
    // Create Three.js fog
    scene.fog = new THREE.Fog(
        FOG_CONFIG.color,
        FOG_CONFIG.near,
        FOG_CONFIG.far
    );
    
    console.log(`🌫️ Fog applied: near=${FOG_CONFIG.near}, far=${FOG_CONFIG.far}, color=0x${FOG_CONFIG.color.toString(16)}`);
}

/**
 * UPDATE EXISTING MATERIALS TO RESPOND TO FOG
 */
function updateMaterialsForFog() {
    let materialsUpdated = 0;
    
    // Update all materials in the scene
    scene.traverse((object) => {
        if (object.isMesh && object.material) {
            // Handle both single materials and material arrays
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            
            materials.forEach((material) => {
                if (material.fog !== true) {
                    material.fog = true;
                    material.needsUpdate = true;
                    materialsUpdated++;
                }
            });
        }
    });
    
    console.log(`🎨 Updated ${materialsUpdated} materials to respond to fog`);
}

/**
 * PRESET FOG CONFIGURATIONS
 */
const FOG_PRESETS = {
    // Crystal clear water
    clear: {
        color: 0x002244,
        near: 150,
        far: 800,
        intensity: 0.3
    },
    
    // Normal underwater visibility
    normal: {
        color: 0x001133,
        near: 60,
        far: 450,
        intensity: 1.0
    },
    
    // Murky water
    murky: {
        color: 0x001122,
        near: 30,
        far: 200,
        intensity: 1.5
    },
    
    // Deep ocean
    deep: {
        color: 0x000811,
        near: 20,
        far: 150,
        intensity: 2.0
    },
    
    // Shallow tropical water
    tropical: {
        color: 0x003355,
        near: 100,
        far: 600,
        intensity: 0.7
    }
};

/**
 * APPLY FOG PRESET
 */
function applyFogPreset(presetName) {
    if (!FOG_PRESETS[presetName]) {
        console.error(`❌ Unknown fog preset: ${presetName}`);
        return false;
    }
    
    const preset = FOG_PRESETS[presetName];
    
    // Update configuration
    FOG_CONFIG.color = preset.color;
    FOG_CONFIG.near = preset.near;
    FOG_CONFIG.far = preset.far;
    FOG_CONFIG.intensity = preset.intensity;
    
    // Apply changes
    applyFog();
    
    console.log(`🌫️ Applied fog preset: ${presetName}`);
    updateDebugDisplay(`🌫️ Fog preset: ${presetName}`);
    
    return true;
}

/**
 * MANUAL FOG CONTROL
 */
function setFogSettings(near, far, color, intensity) {
    if (near !== undefined) FOG_CONFIG.near = near;
    if (far !== undefined) FOG_CONFIG.far = far;
    if (color !== undefined) FOG_CONFIG.color = color;
    if (intensity !== undefined) FOG_CONFIG.intensity = intensity;
    
    applyFog();
    
    console.log(`🌫️ Fog settings updated: near=${FOG_CONFIG.near}, far=${FOG_CONFIG.far}`);
    updateDebugDisplay(`🌫️ Fog: ${FOG_CONFIG.near} to ${FOG_CONFIG.far} units`);
}

/**
 * TOGGLE FOG ON/OFF
 */
function toggleFog() {
    FOG_CONFIG.enabled = !FOG_CONFIG.enabled;
    applyFog();
    
    console.log(`🌫️ Fog ${FOG_CONFIG.enabled ? 'enabled' : 'disabled'}`);
    updateDebugDisplay(`🌫️ Fog ${FOG_CONFIG.enabled ? 'ON' : 'OFF'}`);
    
    return FOG_CONFIG.enabled;
}

/**
 * RESET FOG TO DEFAULTS
 */
function resetFog() {
    if (originalFogConfig) {
        Object.assign(FOG_CONFIG, originalFogConfig);
        applyFog();
        console.log('🌫️ Fog reset to defaults');
        updateDebugDisplay('🌫️ Fog reset to defaults');
    }
}

/**
 * ANIMATE FOG (OPTIONAL)
 * Call this in your animation loop for dynamic fog effects
 */
function animateFog(time) {
    if (!scene.fog || !FOG_CONFIG.enabled) return;
    
    // Subtle fog animation - breathing effect
    const breathingIntensity = 0.1;
    const breathingSpeed = 0.5;
    
    const fogVariation = Math.sin(time * breathingSpeed) * breathingIntensity;
    const baseFar = originalFogConfig ? originalFogConfig.far : FOG_CONFIG.far;
    
    scene.fog.far = baseFar + (baseFar * fogVariation);
}

/**
 * GET CURRENT FOG STATUS
 */
function getFogStatus() {
    return {
        enabled: FOG_CONFIG.enabled,
        near: FOG_CONFIG.near,
        far: FOG_CONFIG.far,
        color: `0x${FOG_CONFIG.color.toString(16)}`,
        intensity: FOG_CONFIG.intensity,
        presets: Object.keys(FOG_PRESETS)
    };
}

/**
 * UPDATE DEBUG DISPLAY
 */
function updateDebugDisplay(message) {
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        debugDiv.innerHTML += message + '<br>';
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
}

/**
 * AUTO-INITIALIZATION
 * Waits for scene to be ready, then applies fog
 */
function tryAutoInitialization() {
    if (typeof scene !== 'undefined' && scene) {
        console.log('🌊 Scene detected, initializing fog system...');
        initializeFogSystem();
    } else {
        console.log('⏳ Waiting for scene to be ready...');
        setTimeout(tryAutoInitialization, 1000);
    }
}

// Start trying to initialize after a short delay
setTimeout(tryAutoInitialization, 1500);

/**
 * GLOBAL API
 * Export functions for use by other scripts and HTML controls
 */
window.FogSystem = {
    // Core functions
    init: initializeFogSystem,
    toggle: toggleFog,
    reset: resetFog,
    
    // Configuration
    setSettings: setFogSettings,
    applyPreset: applyFogPreset,
    
    // Animation (optional)
    animate: animateFog,
    
    // Information
    getStatus: getFogStatus,
    getPresets: () => Object.keys(FOG_PRESETS),
    
    // Quick access presets
    clear: () => applyFogPreset('clear'),
    normal: () => applyFogPreset('normal'),
    murky: () => applyFogPreset('murky'),
    deep: () => applyFogPreset('deep'),
    tropical: () => applyFogPreset('tropical')
};

console.log('🌫️ Fog System Ready');
console.log('💡 Usage: FogSystem.init() to start fog');
console.log('💡 Try: FogSystem.clear(), FogSystem.murky(), etc.');
console.log('💡 Custom: FogSystem.setSettings(near, far, color)');

// Make presets easily accessible
console.log('🎨 Available presets:', Object.keys(FOG_PRESETS));
