/**
 * hatake-fixes.js
 * Comprehensive fixes for the HatakeSocial collection page
 * 
 * Fixes:
 * 1. Modal closing functionality (X button, click outside, escape key)
 * 2. List view toggle functionality
 * 3. Game filters functionality
 * 4. Set/edition filters dropdown with multi-select
 * 5. Card hover functionality
 * 6. Search modal closing
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('HatakeSocial fixes loaded');
    
    // ===== MODAL FUNCTIONALITY =====
    
    // Generic modal handling functions
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex', 'items-center', 'justify-center', 'items-start');
            
            // Special handling for search modal
            if (modalId === 'search-modal') {
                const searchInput = document.getElementById('card-search-input');
                const resultsContainer = document.getElementById('search-results-container');
                if (searchInput) searchInput.value = '';
                if (resultsContainer) {
                    resultsContainer.innerHTML = '<p class="text-center text-gray-500">Search results will appear here.</p>';
                }
            }
            
            // Special handling for CSV import modal
            if (modalId === 'csv-import-modal') {
                const fileInput = document.getElementById('csv-file-input');
                if (fileInput) fileInput.value = '';
            }
        }
    }
    
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            
            // Check if it's the search modal (has pt-16 class)
            if (modalId === 'search-modal') {
                modal.classList.add('items-start', 'justify-center');
            } else {
                modal.classList.add('items-center', 'justify-center');
            }
        }
    }
    
    // Fix modal close buttons
    document.querySelectorAll('[data-modal-close]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const modalId = btn.getAttribute('data-modal-close');
            console.log('Closing modal via X button:', modalId);
            closeModal(modalId);
        });
    });
    
    // Fix clicking outside modal to close
    document.addEventListener('click', function(e) {
        const modals = ['search-modal', 'csv-import-modal', 'csv-review-modal', 'bulk-review-modal', 'card-modal'];
        modals.forEach(function(modalId) {
            const modal = document.getElementById(modalId);
            if (modal && !modal.classList.contains('hidden')) {
                const modalContent = modal.querySelector('div[class*="bg-white"], div[class*="bg-gray-800"]');
                if (modalContent && !modalContent.contains(e.target) && e.target === modal) {
                    console.log('Closing modal by clicking outside:', modalId);
                    closeModal(modalId);
                }
            }
        });
    });
    
    // Fix Escape key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modals = ['search-modal', 'csv-import-modal', 'csv-review-modal', 'bulk-review-modal', 'card-modal'];
            modals.forEach(function(modalId) {
                const modal = document.getElementById(modalId);
                if (modal && !modal.classList.contains('hidden')) {
                    console.log('Closing modal with Escape key:', modalId);
                    closeModal(modalId);
                }
            });
        }
    });
    
    // ===== VIEW TOGGLE FUNCTIONALITY =====
    
    // Fix view toggle functionality
    const gridToggle = document.getElementById('view-toggle-grid');
    const listToggle = document.getElementById('view-toggle-list');
    const collectionDisplay = document.getElementById('collection-display');
    
    if (gridToggle && listToggle) {
        // Set initial state
        let currentView = localStorage.getItem('collectionView') || 'grid';
        updateViewToggle(currentView);
        
        gridToggle.addEventListener('click', function() {
            updateViewToggle('grid');
            localStorage.setItem('collectionView', 'grid');
            if (window.Collection && typeof window.Collection.setView === 'function') {
                window.Collection.setView('grid');
            }
        });
        
        listToggle.addEventListener('click', function() {
            updateViewToggle('list');
            localStorage.setItem('collectionView', 'list');
            if (window.Collection && typeof window.Collection.setView === 'function') {
                window.Collection.setView('list');
            }
        });
    }
    
    function updateViewToggle(view) {
        if (!gridToggle || !listToggle) return;
        
        if (view === 'grid') {
            gridToggle.classList.add('bg-white', 'dark:bg-gray-900', 'shadow', 'text-gray-800', 'dark:text-gray-200');
            gridToggle.classList.remove('text-gray-500', 'dark:text-gray-400');
            
            listToggle.classList.remove('bg-white', 'dark:bg-gray-900', 'shadow', 'text-gray-800', 'dark:text-gray-200');
            listToggle.classList.add('text-gray-500', 'dark:text-gray-400');
            
            if (collectionDisplay) {
                collectionDisplay.classList.remove('list-view');
                collectionDisplay.classList.add('grid-view');
            }
        } else {
            listToggle.classList.add('bg-white', 'dark:bg-gray-900', 'shadow', 'text-gray-800', 'dark:text-gray-200');
            listToggle.classList.remove('text-gray-500', 'dark:text-gray-400');
            
            gridToggle.classList.remove('bg-white', 'dark:bg-gray-900', 'shadow', 'text-gray-800', 'dark:text-gray-200');
            gridToggle.classList.add('text-gray-500', 'dark:text-gray-400');
            
            if (collectionDisplay) {
                collectionDisplay.classList.remove('grid-view');
                collectionDisplay.classList.add('list-view');
            }
        }
    }
    
    // ===== GAME FILTERS FUNCTIONALITY =====
    
    // Fix game filter functionality
    const gameCheckboxes = document.querySelectorAll('input[data-game]');
    gameCheckboxes.forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
            const game = checkbox.dataset.game;
            const isChecked = checkbox.checked;
            console.log('Game filter changed:', game, isChecked);
            
            // Update visual feedback
            const label = checkbox.closest('label');
            if (label) {
                if (isChecked) {
                    label.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                } else {
                    label.style.backgroundColor = '';
                }
            }
            
            // Update filters in Collection module if available
            if (window.Collection && typeof window.Collection.toggleGameFilter === 'function') {
                window.Collection.toggleGameFilter(game, isChecked);
            } else {
                // Fallback for when Collection module is not available
                let currentGames = JSON.parse(localStorage.getItem('gameFilters') || '[]');
                if (isChecked) {
                    if (!currentGames.includes(game)) {
                        currentGames.push(game);
                    }
                } else {
                    const index = currentGames.indexOf(game);
                    if (index > -1) {
                        currentGames.splice(index, 1);
                    }
                }
                localStorage.setItem('gameFilters', JSON.stringify(currentGames));
                
                // Update set filter dropdown based on selected games
                updateSetFilterDropdown(currentGames);
            }
        });
    });
    
    // ===== SET/EDITION FILTERS FUNCTIONALITY =====
    
    // Fix set filter dropdown
    const setDropdownBtn = document.getElementById('set-filter-dropdown-btn');
    const setDropdown = document.getElementById('set-filter-dropdown');
    const setChevron = document.getElementById('set-filter-chevron');
    
    if (setDropdownBtn && setDropdown) {
        // Ensure the dropdown is created and visible for all users
        if (!setDropdown.querySelector('.set-filter-item')) {
            setDropdown.innerHTML = '<div class="p-2 text-sm text-gray-500 dark:text-gray-400">Select games first to see available sets</div>';
        }
        
        setDropdownBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            console.log('Set dropdown clicked');
            const isHidden = setDropdown.classList.contains('hidden');
            setDropdown.classList.toggle('hidden');
            if (setChevron) {
                setChevron.classList.toggle('rotate-180', !isHidden);
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (setDropdownBtn && setDropdown && !setDropdownBtn.contains(e.target) && !setDropdown.contains(e.target)) {
                setDropdown.classList.add('hidden');
                if (setChevron) {
                    setChevron.classList.remove('rotate-180');
                }
            }
        });
        
        // Handle set filter changes
        setDropdown.addEventListener('change', function(e) {
            if (e.target.matches('input[type="checkbox"][data-filter-type="set"]')) {
                const value = e.target.value;
                const isChecked = e.target.checked;
                console.log('Set filter changed:', value, isChecked);
                
                // Update filters in Collection module if available
                if (window.Collection && typeof window.Collection.toggleSetFilter === 'function') {
                    window.Collection.toggleSetFilter(value, isChecked);
                } else {
                    // Fallback for when Collection module is not available
                    let currentSets = JSON.parse(localStorage.getItem('setFilters') || '[]');
                    if (isChecked) {
                        if (!currentSets.includes(value)) {
                            currentSets.push(value);
                        }
                    } else {
                        const index = currentSets.indexOf(value);
                        if (index > -1) {
                            currentSets.splice(index, 1);
                        }
                    }
                    localStorage.setItem('setFilters', JSON.stringify(currentSets));
                    updateSetFilterLabel(currentSets);
                }
            }
        });
    }
    
    function updateSetFilterDropdown(selectedGames) {
        if (!setDropdown) return;
        
        if (!selectedGames || selectedGames.length === 0) {
            setDropdown.innerHTML = '<div class="p-2 text-sm text-gray-500 dark:text-gray-400">Select games first to see available sets</div>';
            return;
        }
        
        // In a real implementation, we would fetch sets based on selected games
        // For now, we'll just show some sample sets
        const sampleSets = {
            'mtg': ['Dominaria United', 'The Brothers War', 'Phyrexia: All Will Be One', 'March of the Machine'],
            'pokemon': ['Scarlet & Violet', 'Silver Tempest', 'Lost Origin', 'Astral Radiance'],
            'lorcana': ['The First Chapter', 'Rise of the Floodborn', 'Into the Inklands'],
            'gundam': ['Gundam Series 1', 'Gundam Series 2']
        };
        
        let availableSets = [];
        selectedGames.forEach(game => {
            if (sampleSets[game]) {
                availableSets = availableSets.concat(sampleSets[game]);
            }
        });
        
        if (availableSets.length === 0) {
            setDropdown.innerHTML = '<div class="p-2 text-sm text-gray-500 dark:text-gray-400">No sets available for selected games</div>';
            return;
        }
        
        const currentSetFilters = JSON.parse(localStorage.getItem('setFilters') || '[]');
        
        setDropdown.innerHTML = availableSets.map(setName => {
            const isChecked = currentSetFilters.includes(setName);
            return `
                <label class="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer set-filter-item">
                    <input type="checkbox" data-filter-type="set" value="${setName}" ${isChecked ? 'checked' : ''} class="form-checkbox h-4 w-4 text-blue-600">
                    <span class="text-sm">${setName}</span>
                </label>
            `;
        }).join('');
        
        updateSetFilterLabel(currentSetFilters);
    }
    
    function updateSetFilterLabel(currentSetFilters) {
        const label = document.getElementById('set-filter-label');
        if (!label) return;
        
        if (!currentSetFilters || currentSetFilters.length === 0) {
            label.textContent = 'Select Sets/Editions';
        } else if (currentSetFilters.length === 1) {
            label.textContent = currentSetFilters[0];
        } else {
            label.textContent = `${currentSetFilters.length} sets selected`;
        }
    }
    
    // ===== CARD HOVER FUNCTIONALITY =====
    
    // Fix card hover functionality
    let hoverTimeout;
    const tooltip = document.getElementById('card-preview-tooltip');
    
    if (tooltip) {
        document.addEventListener('mouseover', function(e) {
            const cardContainer = e.target.closest('.card-container');
            if (cardContainer && !e.target.closest('button') && !e.target.classList.contains('bulk-select-checkbox')) {
                clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(function() {
                    console.log('Showing card preview');
                    
                    // Get card data - in a real implementation, this would come from the card element
                    const cardName = cardContainer.dataset.name || 'Card Name';
                    const cardSet = cardContainer.dataset.set || 'Card Set';
                    const imageUrl = cardContainer.querySelector('img')?.src || 'https://placehold.co/300x420?text=Card+Preview';
                    
                    tooltip.innerHTML = `
                        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-2 max-w-xs">
                            <img src="${imageUrl}" alt="${cardName}" class="w-full rounded-lg" loading="lazy">
                            <div class="mt-2 text-center">
                                <h4 class="font-semibold text-sm">${cardName}</h4>
                                <p class="text-xs text-gray-600 dark:text-gray-400">${cardSet}</p>
                            </div>
                        </div>
                    `;
                    
                    tooltip.classList.remove('hidden');
                    tooltip.style.pointerEvents = 'none';
                    
                    // Position tooltip
                    const rect = cardContainer.getBoundingClientRect();
                    let left = rect.right + 10;
                    let top = rect.top;
                    
                    // Adjust if tooltip would go off screen
                    if (left + 220 > window.innerWidth) {
                        left = rect.left - 220 - 10;
                    }
                    
                    if (top + 300 > window.innerHeight) {
                        top = window.innerHeight - 300 - 10;
                    }
                    
                    tooltip.style.left = `${left}px`;
                    tooltip.style.top = `${top}px`;
                }, 300);
            }
        });
        
        document.addEventListener('mouseout', function(e) {
            const cardContainer = e.target.closest('.card-container');
            if (cardContainer) {
                clearTimeout(hoverTimeout);
                tooltip.classList.add('hidden');
            }
        });
    }
    
    // ===== INITIALIZATION =====
    
    // Initialize game filters from localStorage
    const savedGameFilters = JSON.parse(localStorage.getItem('gameFilters') || '[]');
    gameCheckboxes.forEach(function(checkbox) {
        const game = checkbox.dataset.game;
        if (savedGameFilters.includes(game)) {
            checkbox.checked = true;
            const label = checkbox.closest('label');
            if (label) {
                label.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            }
        }
    });
    
    // Initialize set filter dropdown based on selected games
    updateSetFilterDropdown(savedGameFilters);
    
    // Initialize view toggle based on localStorage
    const savedView = localStorage.getItem('collectionView') || 'grid';
    updateViewToggle(savedView);
    
    console.log('All HatakeSocial fixes initialized');
});
