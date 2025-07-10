// Audio Playback System for Floating Controls
// This script handles the 7 audio tracks that sync with the floating button controls

// Audio configuration - matches the button order from floating controls
const AUDIO_CONFIG = [
    {
        name: "Guitar",
        url: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/mp3/02aa.mp3"
    },
    {
        name: "Bass", 
        url: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/mp3/04aa.mp3"
    },
    {
        name: "Drums",
        url: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/mp3/06aa.mp3"
    },
    {
        name: "Vocals",
        url: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/mp3/08aa.mp3"
    },
    {
        name: "Piano",
        url: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/mp3/10aa.mp3"
    },
    {
        name: "Strings", 
        url: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/mp3/12aa.mp3"
    },
    {
        name: "Synth",
        url: "https://raw.githubusercontent.com/VividAidsCTC/boonewebsite/main/mp3/14aa.mp3"
    }
];

// Audio system variables
let audioElements = [];
let audioLoaded = [];
let audioPlaying = [];
let isSystemInitialized = false;
let pauseTimeout = null;
let playStartTime = 0;
let isFirstPlay = true;

// Constants
const PAUSE_DURATION = 10000; // 10 seconds in milliseconds
const FADE_DURATION = 1000; // 1 second fade in/out

// Debug logging for audio system
function logAudio(message) {
    console.log('[Audio System] ' + message);
    const debugDiv = document.getElementById('debug');
    if (debugDiv) {
        debugDiv.innerHTML += '[Audio] ' + message + '<br>';
    }
}

// Create and configure audio elements
function createAudioElements() {
    logAudio('Creating audio elements for 7 tracks...');
    
    AUDIO_CONFIG.forEach((config, index) => {
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.preload = "auto";
        audio.volume = 1.0;
        audio.loop = false; // We'll handle looping manually for the pause
        
        // Set up event listeners
        audio.addEventListener('loadeddata', () => {
            audioLoaded[index] = true;
            logAudio(`${config.name} loaded successfully`);
            checkAllAudioLoaded();
        });
        
        audio.addEventListener('error', (e) => {
            logAudio(`Error loading ${config.name}: ${e.message}`);
            audioLoaded[index] = false;
        });
        
        audio.addEventListener('ended', () => {
            logAudio(`${config.name} playback ended`);
            handleTrackEnded(index);
        });
        
        audio.addEventListener('canplaythrough', () => {
            logAudio(`${config.name} can play through`);
        });
        
        // Store the audio element
        audioElements[index] = audio;
        audioLoaded[index] = false;
        audioPlaying[index] = false;
        
        // Start loading
        audio.src = config.url;
        logAudio(`Started loading ${config.name} from ${config.url}`);
    });
}

// Check if all audio files are loaded
function checkAllAudioLoaded() {
    const loadedCount = audioLoaded.filter(loaded => loaded).length;
    logAudio(`Audio loading progress: ${loadedCount}/${AUDIO_CONFIG.length}`);
    
    if (loadedCount === AUDIO_CONFIG.length && !isSystemInitialized) {
        logAudio('All audio files loaded! Waiting for buttons to initialize...');
        waitForButtonsAndStart();
    }
}

// Wait for button system to be ready, then start synchronized playback
function waitForButtonsAndStart() {
    if (typeof window.AudioControlSystem === 'undefined') {
        logAudio('Button system not ready, waiting...');
        setTimeout(waitForButtonsAndStart, 1000);
        return;
    }
    
    const buttonStatus = window.AudioControlSystem.getInitializationStatus();
    if (!buttonStatus.isComplete) {
        logAudio(`Buttons not ready (${buttonStatus.progress}/${buttonStatus.total}), waiting...`);
        setTimeout(waitForButtonsAndStart, 1000);
        return;
    }
    
    logAudio('Both audio and buttons ready! Starting synchronized playback...');
    initializeAudioSystem();
}

// Initialize the audio system and start playback
function initializeAudioSystem() {
    if (isSystemInitialized) return;
    
    isSystemInitialized = true;
    playStartTime = Date.now();
    isFirstPlay = true;
    
    // Start all tracks simultaneously
    startAllTracks();
    
    // Set up the loop with pause
    scheduleNextLoop();
    
    logAudio('Audio system initialized and playback started!');
}

// Start all audio tracks at the same time
function startAllTracks() {
    logAudio('Starting all tracks simultaneously...');
    
    const buttonStates = window.AudioControlSystem.getButtonStates();
    
    audioElements.forEach((audio, index) => {
        if (audioLoaded[index]) {
            // Reset to beginning
            audio.currentTime = 0;
            
            // Set volume based on button state
            audio.volume = buttonStates[index] ? 1.0 : 0.0;
            
            // Start playback
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    audioPlaying[index] = true;
                    logAudio(`${AUDIO_CONFIG[index].name} started (${buttonStates[index] ? 'audible' : 'muted'})`);
                }).catch(error => {
                    logAudio(`Error playing ${AUDIO_CONFIG[index].name}: ${error.message}`);
                });
            }
        }
    });
}

// Handle when a track ends (check if we need to wait for others)
function handleTrackEnded(trackIndex) {
    audioPlaying[trackIndex] = false;
    
    // Check if all tracks have ended
    const stillPlaying = audioPlaying.some(playing => playing);
    if (!stillPlaying) {
        logAudio('All tracks finished, starting pause...');
        startPausePhase();
    }
}

// Start the pause phase
function startPausePhase() {
    logAudio(`Starting ${PAUSE_DURATION/1000} second pause...`);
    
    // Clear any existing timeout
    if (pauseTimeout) {
        clearTimeout(pauseTimeout);
    }
    
    // Schedule next loop
    pauseTimeout = setTimeout(() => {
        logAudio('Pause complete, restarting tracks...');
        startAllTracks();
        scheduleNextLoop();
    }, PAUSE_DURATION);
}

// Schedule the next loop (this handles the timing)
function scheduleNextLoop() {
    // This function exists to handle any additional timing logic if needed
    // The main loop is handled by track end events and the pause timeout
}

// Handle track muting/unmuting when buttons are clicked
function handleTrackToggle(trackIndex, isActive) {
    if (trackIndex >= 0 && trackIndex < audioElements.length && audioLoaded[trackIndex]) {
        const audio = audioElements[trackIndex];
        const targetVolume = isActive ? 1.0 : 0.0;
        
        // Smooth volume transition
        fadeVolume(audio, audio.volume, targetVolume, FADE_DURATION);
        
        logAudio(`${AUDIO_CONFIG[trackIndex].name} ${isActive ? 'unmuted' : 'muted'}`);
    }
}

// Smooth volume fading
function fadeVolume(audio, startVolume, endVolume, duration) {
    const startTime = Date.now();
    const volumeDiff = endVolume - startVolume;
    
    function updateVolume() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easeInOut curve for smooth transition
        const easedProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        audio.volume = Math.max(0, Math.min(1, startVolume + (volumeDiff * easedProgress)));
        
        if (progress < 1) {
            requestAnimationFrame(updateVolume);
        }
    }
    
    updateVolume();
}

// Listen for button toggle events from the floating controls
function setupButtonEventListeners() {
    // Listen for track toggle events from the button system
    window.addEventListener('trackToggle', (event) => {
        const { trackIndex, trackName, active } = event.detail;
        logAudio(`Received toggle event: ${trackName} (${trackIndex}) -> ${active}`);
        handleTrackToggle(trackIndex, active);
    });
    
    logAudio('Button event listeners setup complete');
}

// Initialize the audio system
function initializeAudioPlayback() {
    logAudio('Initializing audio playback system...');
    
    // Check if we have audio context (for autoplay policy)
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        logAudio('Web Audio API available');
    }
    
    createAudioElements();
    setupButtonEventListeners();
    
    logAudio('Audio system setup complete, waiting for audio files to load...');
}

// Public API for the audio system
window.AudioPlaybackSystem = {
    // Control methods
    stopAll: () => {
        audioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        audioPlaying.fill(false);
        if (pauseTimeout) {
            clearTimeout(pauseTimeout);
            pauseTimeout = null;
        }
        logAudio('All audio stopped');
    },
    
    resumeAll: () => {
        if (isSystemInitialized) {
            startAllTracks();
            scheduleNextLoop();
            logAudio('All audio resumed');
        }
    },
    
    setTrackVolume: (trackIndex, volume) => {
        if (trackIndex >= 0 && trackIndex < audioElements.length && audioLoaded[trackIndex]) {
            audioElements[trackIndex].volume = Math.max(0, Math.min(1, volume));
            logAudio(`${AUDIO_CONFIG[trackIndex].name} volume set to ${volume}`);
        }
    },
    
    getMasterVolume: () => {
        return audioElements.length > 0 ? audioElements[0].volume : 0;
    },
    
    setMasterVolume: (volume) => {
        const buttonStates = window.AudioControlSystem ? window.AudioControlSystem.getButtonStates() : [];
        audioElements.forEach((audio, index) => {
            if (audioLoaded[index]) {
                const trackActive = buttonStates[index] !== false; // Default to true if no button state
                audio.volume = trackActive ? Math.max(0, Math.min(1, volume)) : 0;
            }
        });
        logAudio(`Master volume set to ${volume}`);
    },
    
    // Status methods
    getLoadingStatus: () => ({
        loaded: audioLoaded.filter(loaded => loaded).length,
        total: AUDIO_CONFIG.length,
        isComplete: audioLoaded.every(loaded => loaded),
        percentage: Math.round((audioLoaded.filter(loaded => loaded).length / AUDIO_CONFIG.length) * 100)
    }),
    
    getPlaybackStatus: () => ({
        isInitialized: isSystemInitialized,
        tracksPlaying: audioPlaying.filter(playing => playing).length,
        totalTracks: AUDIO_CONFIG.length,
        currentTime: isSystemInitialized ? (Date.now() - playStartTime) / 1000 : 0,
        isPaused: pauseTimeout !== null
    }),
    
    getTrackStates: () => {
        return AUDIO_CONFIG.map((config, index) => ({
            name: config.name,
            loaded: audioLoaded[index],
            playing: audioPlaying[index],
            volume: audioElements[index] ? audioElements[index].volume : 0,
            currentTime: audioElements[index] ? audioElements[index].currentTime : 0,
            duration: audioElements[index] ? audioElements[index].duration : 0
        }));
    },
    
    // Debug methods
    debugInfo: () => {
        logAudio('=== AUDIO SYSTEM DEBUG ===');
        logAudio(`System initialized: ${isSystemInitialized}`);
        logAudio(`Audio elements created: ${audioElements.length}`);
        logAudio(`Tracks loaded: ${audioLoaded.filter(loaded => loaded).length}/${AUDIO_CONFIG.length}`);
        logAudio(`Tracks playing: ${audioPlaying.filter(playing => playing).length}`);
        logAudio(`Pause timeout active: ${pauseTimeout !== null}`);
        
        AUDIO_CONFIG.forEach((config, index) => {
            const audio = audioElements[index];
            logAudio(`${config.name}: loaded=${audioLoaded[index]}, playing=${audioPlaying[index]}, volume=${audio ? audio.volume.toFixed(2) : 'N/A'}`);
        });
        
        return {
            initialized: isSystemInitialized,
            elementsCreated: audioElements.length,
            loaded: audioLoaded,
            playing: audioPlaying,
            pauseActive: pauseTimeout !== null,
            config: AUDIO_CONFIG
        };
    },
    
    // Force restart the system
    restart: () => {
        logAudio('Restarting audio system...');
        
        // Stop everything
        window.AudioPlaybackSystem.stopAll();
        
        // Reset state
        isSystemInitialized = false;
        isFirstPlay = true;
        playStartTime = 0;
        
        // Restart if audio is loaded
        if (audioLoaded.every(loaded => loaded)) {
            initializeAudioSystem();
        } else {
            logAudio('Audio not loaded, waiting...');
            checkAllAudioLoaded();
        }
    },
    
    // Update configuration (useful for testing different audio files)
    updateTrackUrl: (trackIndex, newUrl) => {
        if (trackIndex >= 0 && trackIndex < AUDIO_CONFIG.length) {
            AUDIO_CONFIG[trackIndex].url = newUrl;
            
            // Reload this track
            if (audioElements[trackIndex]) {
                audioElements[trackIndex].src = newUrl;
                audioLoaded[trackIndex] = false;
                logAudio(`Updated ${AUDIO_CONFIG[trackIndex].name} URL to: ${newUrl}`);
            }
        }
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure other systems are ready
    setTimeout(initializeAudioPlayback, 2000);
});

// Also initialize if called after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initializeAudioPlayback, 2000);
    });
} else {
    // DOM already ready
    setTimeout(initializeAudioPlayback, 2000);
}