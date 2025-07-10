// mobileControls.js - Simple touch drag controls for camera rotation
// No UI, no popups, just drag to rotate the camera

class MobileControls {
    constructor() {
        this.touchSensitivity = 0.008;
        this.isActive = false;
        this.lastTouch = { x: 0, y: 0 };
        
        this.initialize();
    }
    
    initialize() {
        console.log('Initializing simple touch controls...');
        
        const canvas = document.querySelector('canvas') || document.body;
        
        // Prevent default touch behaviors
        canvas.style.touchAction = 'none';
        canvas.style.userSelect = 'none';
        
        // Touch event listeners
        canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        // Prevent context menu
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        console.log('Touch drag controls ready');
    }
    
    handleTouchStart(event) {
        event.preventDefault();
        
        // Only handle single touch
        if (event.touches.length === 1) {
            this.isActive = true;
            const touch = event.touches[0];
            this.lastTouch = { x: touch.clientX, y: touch.clientY };
        }
    }
    
    handleTouchMove(event) {
        event.preventDefault();
        
        if (!this.isActive || event.touches.length !== 1) return;
        
        const touch = event.touches[0];
        const deltaX = touch.clientX - this.lastTouch.x;
        const deltaY = touch.clientY - this.lastTouch.y;
        
        // Apply rotation to global camera targets
        if (typeof window.targetRotationY !== 'undefined') {
            window.targetRotationY += deltaX * this.touchSensitivity;
        }
        if (typeof window.targetRotationX !== 'undefined') {
            window.targetRotationX += deltaY * this.touchSensitivity;
        }
        
        // Update last touch position
        this.lastTouch = { x: touch.clientX, y: touch.clientY };
    }
    
    handleTouchEnd(event) {
        event.preventDefault();
        this.isActive = false;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        window.MobileControls = new MobileControls();
    }, 1000);
});

// Export for module compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileControls;
}