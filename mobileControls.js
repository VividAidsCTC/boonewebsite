// mobileControls.js - Touch controls for underwater kelp forest
// Handles mobile touch gestures for camera rotation and UI interaction

class MobileControls {
    constructor() {
        this.config = {
            enabled: true,
            touchSensitivity: 0.008,
            pinchSensitivity: 0.002,
            inertiaEnabled: true,
            inertiaDamping: 0.92,
            maxInertiaSpeed: 0.15,
            longPressDuration: 500,
            doubleTapDelay: 300
        };
        
        // Touch state tracking
        this.touchState = {
            isActive: false,
            touches: [],
            lastTouchTime: 0,
            tapCount: 0,
            startPositions: [],
            lastPositions: [],
            velocity: { x: 0, y: 0 },
            initialDistance: 0,
            isLongPress: false,
            longPressTimer: null
        };
        
        // Camera rotation targets (integrates with existing system)
        this.rotationVelocity = { x: 0, y: 0 };
        
        // Device detection
        this.isMobile = this.detectMobileDevice();
        this.isTablet = this.detectTabletDevice();
        
        // UI elements for mobile
        this.mobileUI = null;
        
        // Initialize controls
        this.initialize();
    }
    
    detectMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2) ||
               window.matchMedia('(max-width: 768px)').matches;
    }
    
    detectTabletDevice() {
        return /iPad|Android/i.test(navigator.userAgent) && 
               window.matchMedia('(min-width: 768px)').matches;
    }
    
    initialize() {
        console.log(`Mobile Controls initializing... Device: ${this.isMobile ? 'Mobile' : 'Desktop'}`);
        
        if (this.isMobile) {
            this.setupTouchControls();
            this.createMobileUI();
            this.optimizeForMobile();
        }
        
        // Always add touch support for desktop users with touch screens
        this.setupTouchControls();
        
        console.log('Mobile Controls initialized successfully');
    }
    
    setupTouchControls() {
        const canvas = document.querySelector('canvas') || document.body;
        
        // Prevent default touch behaviors
        canvas.style.touchAction = 'none';
        canvas.style.userSelect = 'none';
        
        // Touch event listeners
        canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        canvas.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });
        
        // Prevent context menu on long press
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Orientation change handling
        window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
        
        console.log('Touch controls configured');
    }
    
    handleTouchStart(event) {
        event.preventDefault();
        
        this.touchState.isActive = true;
        this.touchState.touches = Array.from(event.touches);
        this.touchState.startPositions = this.touchState.touches.map(t => ({ x: t.clientX, y: t.clientY }));
        this.touchState.lastPositions = [...this.touchState.startPositions];
        this.touchState.velocity = { x: 0, y: 0 };
        
        const now = Date.now();
        
        // Handle multi-touch (pinch zoom)
        if (this.touchState.touches.length === 2) {
            this.touchState.initialDistance = this.getTouchDistance(this.touchState.touches[0], this.touchState.touches[1]);
        }
        
        // Handle single touch
        if (this.touchState.touches.length === 1) {
            // Double tap detection
            if (now - this.touchState.lastTouchTime < this.config.doubleTapDelay) {
                this.touchState.tapCount++;
                if (this.touchState.tapCount === 2) {
                    this.handleDoubleTap(this.touchState.touches[0]);
                    this.touchState.tapCount = 0;
                }
            } else {
                this.touchState.tapCount = 1;
            }
            
            // Long press detection
            this.touchState.longPressTimer = setTimeout(() => {
                this.touchState.isLongPress = true;
                this.handleLongPress(this.touchState.touches[0]);
            }, this.config.longPressDuration);
        }
        
        this.touchState.lastTouchTime = now;
        
        // Stop inertia
        this.rotationVelocity.x = 0;
        this.rotationVelocity.y = 0;
    }
    
    handleTouchMove(event) {
        event.preventDefault();
        
        if (!this.touchState.isActive) return;
        
        const touches = Array.from(event.touches);
        const currentPositions = touches.map(t => ({ x: t.clientX, y: t.clientY }));
        
        // Clear long press if touch moves too much
        if (this.touchState.longPressTimer) {
            const moveDistance = this.getDistance(
                this.touchState.startPositions[0],
                currentPositions[0]
            );
            if (moveDistance > 10) {
                clearTimeout(this.touchState.longPressTimer);
                this.touchState.longPressTimer = null;
            }
        }
        
        // Handle single touch rotation
        if (touches.length === 1 && this.touchState.lastPositions.length === 1) {
            const deltaX = currentPositions[0].x - this.touchState.lastPositions[0].x;
            const deltaY = currentPositions[0].y - this.touchState.lastPositions[0].y;
            
            // Apply rotation (integrate with existing camera system)
            if (typeof window.targetRotationX !== 'undefined' && typeof window.targetRotationY !== 'undefined') {
                window.targetRotationY += deltaX * this.config.touchSensitivity;
                window.targetRotationX += deltaY * this.config.touchSensitivity;
            }
            
            // Store velocity for inertia
            this.rotationVelocity.x = deltaY * this.config.touchSensitivity;
            this.rotationVelocity.y = deltaX * this.config.touchSensitivity;
        }
        
        // Handle pinch zoom (adjust wave parameters)
        if (touches.length === 2 && this.touchState.touches.length === 2) {
            const currentDistance = this.getTouchDistance(touches[0], touches[1]);
            const pinchDelta = (currentDistance - this.touchState.initialDistance) * this.config.pinchSensitivity;
            
            // Map pinch to wave intensity
            if (typeof window.waveIntensity !== 'undefined') {
                window.waveIntensity = Math.max(0.1, Math.min(2.0, window.waveIntensity + pinchDelta));
                
                // Update kelp materials
                if (window.KelpSystem) {
                    window.KelpSystem.updateUniforms({ waveIntensity: { value: window.waveIntensity } });
                }
                
                // Update UI slider if it exists
                const slider = document.getElementById('waveIntensity');
                if (slider) {
                    slider.value = window.waveIntensity;
                }
            }
            
            this.touchState.initialDistance = currentDistance;
        }
        
        this.touchState.lastPositions = currentPositions;
    }
    
    handleTouchEnd(event) {
        event.preventDefault();
        
        // Clear long press timer
        if (this.touchState.longPressTimer) {
            clearTimeout(this.touchState.longPressTimer);
            this.touchState.longPressTimer = null;
        }
        
        // Handle single tap
        if (this.touchState.touches.length === 1 && !this.touchState.isLongPress) {
            const moveDistance = this.getDistance(
                this.touchState.startPositions[0],
                this.touchState.lastPositions[0]
            );
            
            if (moveDistance < 10) { // Small movement threshold
                this.handleSingleTap(this.touchState.touches[0]);
            }
        }
        
        // Apply inertia if enabled
        if (this.config.inertiaEnabled && this.touchState.touches.length === 1) {
            this.applyInertia();
        }
        
        this.touchState.isActive = false;
        this.touchState.touches = [];
        this.touchState.isLongPress = false;
    }
    
    handleTouchCancel(event) {
        this.handleTouchEnd(event);
    }
    
    handleSingleTap(touch) {
        // Toggle mobile UI visibility or other single tap actions
        if (this.mobileUI) {
            this.toggleMobileUI();
        }
        
        console.log('Single tap detected');
    }
    
    handleDoubleTap(touch) {
        // Reset camera rotation or other double tap actions
        if (typeof window.targetRotationX !== 'undefined' && typeof window.targetRotationY !== 'undefined') {
            window.targetRotationX = 0;
            window.targetRotationY = 0;
        }
        
        console.log('Double tap detected - camera reset');
    }
    
    handleLongPress(touch) {
        // Show context menu or settings
        this.showContextMenu(touch.clientX, touch.clientY);
        
        console.log('Long press detected');
    }
    
    applyInertia() {
        if (!this.config.inertiaEnabled) return;
        
        // Clamp velocity
        this.rotationVelocity.x = Math.max(-this.config.maxInertiaSpeed, 
                                         Math.min(this.config.maxInertiaSpeed, this.rotationVelocity.x));
        this.rotationVelocity.y = Math.max(-this.config.maxInertiaSpeed, 
                                         Math.min(this.config.maxInertiaSpeed, this.rotationVelocity.y));
        
        const updateInertia = () => {
            if (Math.abs(this.rotationVelocity.x) > 0.001 || Math.abs(this.rotationVelocity.y) > 0.001) {
                // Apply velocity to camera rotation
                if (typeof window.targetRotationX !== 'undefined' && typeof window.targetRotationY !== 'undefined') {
                    window.targetRotationX += this.rotationVelocity.x;
                    window.targetRotationY += this.rotationVelocity.y;
                }
                
                // Apply damping
                this.rotationVelocity.x *= this.config.inertiaDamping;
                this.rotationVelocity.y *= this.config.inertiaDamping;
                
                requestAnimationFrame(updateInertia);
            }
        };
        
        requestAnimationFrame(updateInertia);
    }
    
    createMobileUI() {
        if (!this.isMobile) return;
        
        // Create mobile-specific UI overlay
        this.mobileUI = document.createElement('div');
        this.mobileUI.id = 'mobile-ui';
        this.mobileUI.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 12px;
            padding: 15px;
            color: white;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            transition: opacity 0.3s ease;
            backdrop-filter: blur(10px);
            min-width: 200px;
        `;
        
        // Add help text
        const helpText = document.createElement('div');
        helpText.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px;">🌊 Touch Controls</div>
            <div style="font-size: 12px; line-height: 1.4;">
                • Drag to rotate view<br>
                • Pinch to adjust waves<br>
                • Double tap to reset<br>
                • Tap to toggle this menu
            </div>
        `;
        this.mobileUI.appendChild(helpText);
        
        // Add mobile-friendly wave controls
        const waveControl = document.createElement('div');
        waveControl.innerHTML = `
            <div style="font-weight: bold; margin: 10px 0 5px 0;">Wave Intensity</div>
            <input type="range" id="mobile-wave-intensity" min="0.1" max="2.0" step="0.1" value="${window.waveIntensity || 0.6}" 
                   style="width: 100%; height: 30px; -webkit-appearance: none; background: rgba(255,255,255,0.2); border-radius: 5px; outline: none;">
        `;
        this.mobileUI.appendChild(waveControl);
        
        // Add mobile-friendly direction control
        const directionControl = document.createElement('div');
        directionControl.innerHTML = `
            <div style="font-weight: bold; margin: 10px 0 5px 0;">Current Direction</div>
            <input type="range" id="mobile-current-direction" min="0" max="360" step="5" value="${window.currentDirection || 45}" 
                   style="width: 100%; height: 30px; -webkit-appearance: none; background: rgba(255,255,255,0.2); border-radius: 5px; outline: none;">
        `;
        this.mobileUI.appendChild(directionControl);
        
        document.body.appendChild(this.mobileUI);
        
        // Setup mobile control events
        this.setupMobileUIEvents();
        
        // Hide UI after delay
        setTimeout(() => {
            this.mobileUI.style.opacity = '0.7';
        }, 3000);
    }
    
    setupMobileUIEvents() {
        const waveSlider = document.getElementById('mobile-wave-intensity');
        const directionSlider = document.getElementById('mobile-current-direction');
        
        if (waveSlider) {
            waveSlider.addEventListener('input', (e) => {
                window.waveIntensity = parseFloat(e.target.value);
                if (window.KelpSystem) {
                    window.KelpSystem.updateUniforms({ waveIntensity: { value: window.waveIntensity } });
                }
            });
        }
        
        if (directionSlider) {
            directionSlider.addEventListener('input', (e) => {
                window.currentDirection = parseFloat(e.target.value);
                if (window.KelpSystem) {
                    window.KelpSystem.updateUniforms({ currentDirection: { value: window.currentDirection } });
                }
            });
        }
    }
    
    toggleMobileUI() {
        if (!this.mobileUI) return;
        
        const isVisible = this.mobileUI.style.opacity !== '0';
        this.mobileUI.style.opacity = isVisible ? '0' : '1';
    }
    
    showContextMenu(x, y) {
        // Simple context menu for mobile
        const menu = document.createElement('div');
        menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 2000;
            backdrop-filter: blur(10px);
        `;
        
        menu.innerHTML = `
            <div onclick="this.parentElement.remove();" style="cursor: pointer; padding: 5px;">
                📱 Mobile optimized<br>
                🌊 Kelp Forest Scene<br>
                👆 Tap to close
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (menu.parentElement) {
                menu.remove();
            }
        }, 3000);
    }
    
    optimizeForMobile() {
        // Reduce kelp count for better performance on mobile
        if (window.KelpSystem && this.isMobile) {
            console.log('Optimizing for mobile performance...');
            
            // Reduce shadow quality on mobile
            if (window.ShadowSystem) {
                window.ShadowSystem.setShadowQuality('low');
                console.log('Shadow quality reduced for mobile');
            }
        }
        
        // Set viewport meta tag if not present
        if (!document.querySelector('meta[name="viewport"]')) {
            const viewport = document.createElement('meta');
            viewport.name = 'viewport';
            viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
            document.head.appendChild(viewport);
        }
    }
    
    handleOrientationChange() {
        // Handle device rotation
        setTimeout(() => {
            if (typeof camera !== 'undefined' && typeof renderer !== 'undefined') {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            }
        }, 100);
        
        console.log('Orientation changed, adjusting camera aspect ratio');
    }
    
    // Utility methods
    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // Configuration methods
    setSensitivity(sensitivity) {
        this.config.touchSensitivity = sensitivity;
        console.log(`Touch sensitivity set to ${sensitivity}`);
    }
    
    toggleInertia(enabled) {
        this.config.inertiaEnabled = enabled;
        console.log(`Touch inertia ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    // Cleanup
    dispose() {
        if (this.mobileUI && this.mobileUI.parentElement) {
            this.mobileUI.remove();
        }
        
        if (this.touchState.longPressTimer) {
            clearTimeout(this.touchState.longPressTimer);
        }
        
        console.log('Mobile Controls disposed');
    }
}

// Initialize mobile controls when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait for the main systems to initialize
    setTimeout(() => {
        window.MobileControls = new MobileControls();
        console.log('Mobile Controls system initialized');
    }, 1500);
});

// Export for module compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileControls;
}