/**
 * Fixed Mobile Navigation for HatakeSocial
 * Simple, reliable hamburger menu implementation
 */

(function() {
    'use strict';
    
    let isInitialized = false;
    let isSidebarOpen = false;
    
    function initMobileNavigation() {
        if (isInitialized) return;
        
        const sidebar = document.getElementById('sidebar');
        const hamburgerButton = document.getElementById('sidebar-toggle');
        const overlay = document.getElementById('sidebar-overlay');
        
        // Skip initialization if elements don't exist (like on index.html)
        if (!sidebar || !hamburgerButton || !overlay) {
            console.log('Mobile navigation elements not found - skipping initialization');
            return;
        }
        
        console.log('Initializing mobile navigation...');
        
        // Create overlay if it doesn't exist
        if (!overlay) {
            const newOverlay = document.createElement('div');
            newOverlay.id = 'sidebar-overlay';
            newOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-40 hidden';
            document.body.appendChild(newOverlay);
        }
        
        // Hamburger button click handler
        hamburgerButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
        });
        
        // Overlay click handler
        const overlayElement = document.getElementById('sidebar-overlay');
        if (overlayElement) {
            overlayElement.addEventListener('click', function() {
                closeSidebar();
            });
        }
        
        // Handle window resize
        window.addEventListener('resize', function() {
            if (window.innerWidth >= 1024) {
                // Desktop mode - show sidebar, hide overlay
                sidebar.style.transform = 'translateX(0)';
                hamburgerButton.style.display = 'none';
                if (overlayElement) {
                    overlayElement.classList.add('hidden');
                }
                isSidebarOpen = true;
            } else {
                // Mobile mode - hide sidebar, show hamburger
                if (!isSidebarOpen) {
                    sidebar.style.transform = 'translateX(-100%)';
                }
                hamburgerButton.style.display = 'block';
            }
        });
        
        // Initial setup
        updateLayout();
        isInitialized = true;
        console.log('Mobile navigation initialized successfully');
    }
    
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (!sidebar || !overlay) return;
        
        if (isSidebarOpen) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }
    
    function openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (!sidebar || !overlay) return;
        
        sidebar.style.transform = 'translateX(0)';
        overlay.classList.remove('hidden');
        isSidebarOpen = true;
        
        console.log('Sidebar opened');
    }
    
    function closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (!sidebar || !overlay) return;
        
        sidebar.style.transform = 'translateX(-100%)';
        overlay.classList.add('hidden');
        isSidebarOpen = false;
        
        console.log('Sidebar closed');
    }
    
    function updateLayout() {
        const sidebar = document.getElementById('sidebar');
        const hamburgerButton = document.getElementById('sidebar-toggle');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (!sidebar || !hamburgerButton || !overlay) return;
        
        if (window.innerWidth >= 1024) {
            // Desktop mode
            sidebar.style.transform = 'translateX(0)';
            hamburgerButton.style.display = 'none';
            overlay.classList.add('hidden');
            isSidebarOpen = true;
        } else {
            // Mobile mode
            sidebar.style.transform = 'translateX(-100%)';
            hamburgerButton.style.display = 'block';
            overlay.classList.add('hidden');
            isSidebarOpen = false;
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileNavigation);
    } else {
        initMobileNavigation();
    }
    
    // Expose functions globally for debugging
    window.mobileNavDebug = {
        toggleSidebar: toggleSidebar,
        openSidebar: openSidebar,
        closeSidebar: closeSidebar,
        updateLayout: updateLayout,
        getState: function() {
            return {
                isInitialized: isInitialized,
                isSidebarOpen: isSidebarOpen,
                viewportWidth: window.innerWidth
            };
        }
    };
    
})();
