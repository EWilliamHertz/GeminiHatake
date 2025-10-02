/**
 * Mobile Navigation Module for HatakeSocial
 * Handles hamburger menu functionality and mobile sidebar navigation
 * Version: 1.0 - Complete rewrite for mobile compatibility
 */

class MobileNavigation {
    constructor() {
        this.sidebar = null;
        this.hamburgerButton = null;
        this.overlay = null;
        this.isInitialized = false;
        this.isMobile = false;
        
        // Bind methods to preserve context
        this.toggleSidebar = this.toggleSidebar.bind(this);
        this.closeSidebar = this.closeSidebar.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleOutsideClick = this.handleOutsideClick.bind(this);
    }

    /**
     * Initialize the mobile navigation system
     */
    init() {
        if (this.isInitialized) {
            console.log('Mobile navigation already initialized');
            return;
        }

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    /**
     * Setup the mobile navigation elements and event listeners
     */
    setup() {
        console.log('Setting up mobile navigation...');
        
        // Get DOM elements
        this.sidebar = document.getElementById('sidebar');
        this.hamburgerButton = document.getElementById('sidebar-toggle');
        this.overlay = document.getElementById('sidebar-overlay');

        if (!this.sidebar || !this.hamburgerButton || !this.overlay) {
            console.log('Mobile navigation elements not found - skipping initialization (this is normal for landing pages):', {
                sidebar: !!this.sidebar,
                hamburgerButton: !!this.hamburgerButton,
                overlay: !!this.overlay
            });
            // Don't mark as initialized so it doesn't interfere with other functionality
            return;
        }

        // Initialize mobile state
        this.checkMobileState();
        this.setupEventListeners();
        this.initializeSidebarState();
        
        this.isInitialized = true;
        console.log('Mobile navigation initialized successfully');
    }

    /**
     * Check if we're in mobile mode based on viewport width
     */
    checkMobileState() {
        const isMobileViewport = window.innerWidth < 1024; // lg breakpoint in Tailwind
        
        if (isMobileViewport !== this.isMobile) {
            this.isMobile = isMobileViewport;
            this.updateNavigationState();
        }
    }

    /**
     * Update navigation state based on mobile/desktop mode
     */
    updateNavigationState() {
        if (this.isMobile) {
            // Mobile mode: show hamburger, hide sidebar by default
            this.hamburgerButton.style.display = 'block';
            this.hamburgerButton.classList.remove('lg:hidden');
            this.sidebar.classList.add('-translate-x-full');
            this.sidebar.classList.remove('translate-x-0');
            this.overlay.classList.add('hidden');
        } else {
            // Desktop mode: hide hamburger, show sidebar
            this.hamburgerButton.style.display = 'none';
            this.sidebar.classList.remove('-translate-x-full');
            this.sidebar.classList.add('translate-x-0');
            this.overlay.classList.add('hidden');
        }
    }

    /**
     * Initialize sidebar state on page load
     */
    initializeSidebarState() {
        // Force initial state based on viewport
        this.updateNavigationState();
        
        // Ensure proper z-index and positioning
        this.sidebar.style.zIndex = '50';
        this.overlay.style.zIndex = '40';
        this.hamburgerButton.style.zIndex = '1000';
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Hamburger button click
        this.hamburgerButton.addEventListener('click', this.toggleSidebar);
        
        // Overlay click to close sidebar
        this.overlay.addEventListener('click', this.closeSidebar);
        
        // Window resize to handle mobile/desktop transitions
        window.addEventListener('resize', this.handleResize);
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', this.handleOutsideClick);
        
        // Prevent sidebar clicks from closing the sidebar
        this.sidebar.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Handle escape key to close sidebar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMobile && this.isSidebarOpen()) {
                this.closeSidebar();
            }
        });
    }

    /**
     * Toggle sidebar visibility
     */
    toggleSidebar(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        console.log('Toggling sidebar, current state:', this.isSidebarOpen());

        if (this.isSidebarOpen()) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    /**
     * Open the sidebar
     */
    openSidebar() {
        if (!this.isMobile) return;

        console.log('Opening sidebar');
        
        // Show sidebar
        this.sidebar.classList.remove('-translate-x-full');
        this.sidebar.classList.add('translate-x-0');
        
        // Show overlay
        this.overlay.classList.remove('hidden');
        
        // Prevent body scroll on mobile
        document.body.style.overflow = 'hidden';
        
        // Add aria attributes for accessibility
        this.hamburgerButton.setAttribute('aria-expanded', 'true');
        this.sidebar.setAttribute('aria-hidden', 'false');
    }

    /**
     * Close the sidebar
     */
    closeSidebar() {
        if (!this.isMobile) return;

        console.log('Closing sidebar');
        
        // Hide sidebar
        this.sidebar.classList.add('-translate-x-full');
        this.sidebar.classList.remove('translate-x-0');
        
        // Hide overlay
        this.overlay.classList.add('hidden');
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        // Update aria attributes
        this.hamburgerButton.setAttribute('aria-expanded', 'false');
        this.sidebar.setAttribute('aria-hidden', 'true');
    }

    /**
     * Check if sidebar is currently open
     */
    isSidebarOpen() {
        return !this.sidebar.classList.contains('-translate-x-full');
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        // Debounce resize events
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.checkMobileState();
        }, 100);
    }

    /**
     * Handle clicks outside the sidebar to close it
     */
    handleOutsideClick(e) {
        if (!this.isMobile || !this.isSidebarOpen()) return;
        
        // Don't close if clicking on hamburger button (it has its own handler)
        if (this.hamburgerButton.contains(e.target)) return;
        
        // Don't close if clicking inside sidebar
        if (this.sidebar.contains(e.target)) return;
        
        // Close sidebar for any other clicks
        this.closeSidebar();
    }

    /**
     * Force mobile mode for testing
     */
    forceMobileMode() {
        this.isMobile = true;
        this.updateNavigationState();
    }

    /**
     * Force desktop mode for testing
     */
    forceDesktopMode() {
        this.isMobile = false;
        this.updateNavigationState();
    }

    /**
     * Get current state for debugging
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            isMobile: this.isMobile,
            isSidebarOpen: this.isSidebarOpen(),
            viewportWidth: window.innerWidth,
            elements: {
                sidebar: !!this.sidebar,
                hamburgerButton: !!this.hamburgerButton,
                overlay: !!this.overlay
            }
        };
    }
}

// Create global instance
window.mobileNavigation = new MobileNavigation();

// Auto-initialize when script loads
window.mobileNavigation.init();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileNavigation;
}
