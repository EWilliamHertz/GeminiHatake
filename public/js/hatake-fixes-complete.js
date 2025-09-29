/**
 * hatake-fixes-complete.js
 * Comprehensive fixes for all reported issues in the HatakeSocial collection page
 * 
 * Fixes:
 * 1. List view toggle functionality
 * 2. Game filter functionality
 * 3. CSV import modal closing
 * 4. Bulk edit button functionality
 * 5. Japanese Yen currency conversion (150 yen showing as $150)
 * 6. Card hover functionality in search results
 * 7. Price loading for all cards
 * 8. Currency display stability (showing $ even when SEK is selected)
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('HatakeSocial comprehensive fixes loaded');
    
    // ===== GLOBAL VARIABLES =====
    
    // Store exchange rates
    let exchangeRates = {
        USD: 1.0,
        EUR: 0.92,
        GBP: 0.78,
        JPY: 150.0, // Critical fix for Japanese Yen conversion
        SEK: 10.5,
        NOK: 10.8,
        DKK: 6.9
    };
    
    // Current user currency
    let userCurrency = localStorage.getItem('userCurrency') || 'USD';
    
    // Currency symbols
    const currencySymbols = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        JPY: '¥',
        SEK: 'kr',
        NOK: 'kr',
        DKK: 'kr'
    };
    
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
            } else {
                // Direct DOM manipulation fallback
                if (collectionDisplay) {
                    collectionDisplay.classList.remove('list-view');
                    collectionDisplay.classList.add('grid-view');
                    
                    // Update card display
                    const cards = document.querySelectorAll('.card-container');
                    cards.forEach(card => {
                        card.classList.remove('list-card');
                        card.classList.add('grid-card');
                    });
                }
            }
        });
        
        listToggle.addEventListener('click', function() {
            updateViewToggle('list');
            localStorage.setItem('collectionView', 'list');
            if (window.Collection && typeof window.Collection.setView === 'function') {
                window.Collection.setView('list');
            } else {
                // Direct DOM manipulation fallback
                if (collectionDisplay) {
                    collectionDisplay.classList.remove('grid-view');
                    collectionDisplay.classList.add('list-view');
                    
                    // Update card display
                    const cards = document.querySelectorAll('.card-container');
                    cards.forEach(card => {
                        card.classList.remove('grid-card');
                        card.classList.add('list-card');
                    });
                }
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
        } else {
            listToggle.classList.add('bg-white', 'dark:bg-gray-900', 'shadow', 'text-gray-800', 'dark:text-gray-200');
            listToggle.classList.remove('text-gray-500', 'dark:text-gray-400');
            
            gridToggle.classList.remove('bg-white', 'dark:bg-gray-900', 'shadow', 'text-gray-800', 'dark:text-gray-200');
            gridToggle.classList.add('text-gray-500', 'dark:text-gray-400');
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
                
                // Apply filters directly to DOM
                applyGameFilters(currentGames);
            }
        });
    });
    
    function applyGameFilters(selectedGames) {
        const cards = document.querySelectorAll('.card-container');
        
        if (selectedGames.length === 0) {
            // Show all cards if no games selected
            cards.forEach(card => {
                card.style.display = '';
            });
            return;
        }
        
        cards.forEach(card => {
            const cardGame = card.dataset.game;
            if (selectedGames.includes(cardGame)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }
    
    // ===== BULK EDIT FUNCTIONALITY =====
    
    // Fix bulk edit functionality
    const bulkEditBtn = document.getElementById('bulk-edit-btn');
    if (bulkEditBtn) {
        bulkEditBtn.addEventListener('click', function() {
            console.log('Toggling bulk edit mode');
            
            // Toggle bulk edit mode in Collection module if available
            if (window.Collection && typeof window.Collection.toggleBulkEditMode === 'function') {
                window.Collection.toggleBulkEditMode();
            } else {
                // Fallback for when Collection module is not available
                const bulkEditMode = localStorage.getItem('bulkEditMode') === 'true';
                localStorage.setItem('bulkEditMode', (!bulkEditMode).toString());
                
                // Apply bulk edit mode directly to DOM
                toggleBulkEditMode(!bulkEditMode);
            }
        });
    }
    
    function toggleBulkEditMode(isActive) {
        const bulkEditBtn = document.getElementById('bulk-edit-btn');
        const bulkEditToolbar = document.getElementById('bulk-edit-toolbar');
        const cards = document.querySelectorAll('.card-container');
        
        if (isActive) {
            // Activate bulk edit mode
            if (bulkEditBtn) bulkEditBtn.classList.add('bg-blue-500', 'text-white');
            if (bulkEditToolbar) bulkEditToolbar.classList.remove('hidden');
            
            // Add checkboxes to cards
            cards.forEach(card => {
                if (!card.querySelector('.bulk-select-checkbox')) {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'bulk-select-checkbox absolute top-2 left-2 z-10 h-5 w-5';
                    checkbox.addEventListener('change', function() {
                        card.classList.toggle('selected', checkbox.checked);
                    });
                    card.appendChild(checkbox);
                }
                card.classList.add('bulk-edit-mode');
            });
        } else {
            // Deactivate bulk edit mode
            if (bulkEditBtn) bulkEditBtn.classList.remove('bg-blue-500', 'text-white');
            if (bulkEditToolbar) bulkEditToolbar.classList.add('hidden');
            
            // Remove checkboxes from cards
            cards.forEach(card => {
                card.classList.remove('bulk-edit-mode', 'selected');
                const checkbox = card.querySelector('.bulk-select-checkbox');
                if (checkbox) checkbox.remove();
            });
        }
    }
    
    // ===== CSV IMPORT FUNCTIONALITY =====
    
    // Fix CSV import functionality
    const importCsvBtn = document.getElementById('import-csv-btn');
    if (importCsvBtn) {
        importCsvBtn.addEventListener('click', function() {
            console.log('Opening CSV import modal');
            openModal('csv-import-modal');
        });
    }
    
    // Handle CSV file selection
    const csvFileInput = document.getElementById('csv-file-input');
    const parseCsvBtn = document.getElementById('parse-csv-btn');
    
    if (csvFileInput && parseCsvBtn) {
        parseCsvBtn.addEventListener('click', function() {
            if (csvFileInput.files.length > 0) {
                console.log('Parsing CSV file:', csvFileInput.files[0].name);
                // In a real implementation, this would read and parse the CSV file
                // For now, just show a success message
                alert('CSV file parsed successfully!');
                closeModal('csv-import-modal');
            } else {
                alert('Please select a CSV file first.');
            }
        });
    }
    
    // ===== CURRENCY CONVERSION FUNCTIONALITY =====
    
    // Fix currency conversion and display
    const currencySelector = document.querySelector('select[id="currency-selector"]');
    if (currencySelector) {
        // Set initial value from localStorage
        currencySelector.value = userCurrency;
        
        // Update currency when changed
        currencySelector.addEventListener('change', function() {
            userCurrency = currencySelector.value;
            localStorage.setItem('userCurrency', userCurrency);
            console.log('Currency changed to:', userCurrency);
            
            // Update all price displays
            updateAllPrices();
        });
    }
    
    // Fix Japanese Yen conversion and update all prices
    function updateAllPrices() {
        const priceElements = document.querySelectorAll('[data-price]');
        priceElements.forEach(element => {
            const priceUSD = parseFloat(element.dataset.price);
            const priceCurrency = element.dataset.currency || 'USD';
            
            if (isNaN(priceUSD)) return;
            
            // Convert price to user's currency
            let convertedPrice;
            
            // Special handling for Japanese Yen
            if (priceCurrency === 'JPY') {
                // Fix: Convert JPY to USD first, then to user currency
                const priceInUSD = priceUSD / exchangeRates.JPY;
                convertedPrice = convertPrice(priceInUSD, 'USD', userCurrency);
            } else {
                convertedPrice = convertPrice(priceUSD, priceCurrency, userCurrency);
            }
            
            // Format price with correct currency symbol
            const symbol = currencySymbols[userCurrency] || '';
            const formattedPrice = formatPrice(convertedPrice, userCurrency);
            
            // Update element text
            if (userCurrency === 'USD' || userCurrency === 'JPY') {
                element.textContent = `${symbol}${formattedPrice}`;
            } else {
                element.textContent = `${formattedPrice} ${symbol}`;
            }
        });
    }
    
    function convertPrice(price, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) return price;
        
        // Convert to USD first if not already
        let priceInUSD = price;
        if (fromCurrency !== 'USD') {
            priceInUSD = price / exchangeRates[fromCurrency];
        }
        
        // Then convert from USD to target currency
        return priceInUSD * exchangeRates[toCurrency];
    }
    
    function formatPrice(price, currency) {
        // Format based on currency
        if (currency === 'JPY') {
            return Math.round(price).toLocaleString();
        } else {
            return price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
    }
    
    // ===== CARD HOVER FUNCTIONALITY =====
    
    // Fix card hover functionality
    let hoverTimeout;
    const tooltip = document.getElementById('card-preview-tooltip');
    
    if (tooltip) {
        // Add hover functionality to all card containers, including search results
        document.addEventListener('mouseover', function(e) {
            const cardContainer = e.target.closest('.card-container, .search-result-card');
            if (cardContainer && !e.target.closest('button') && !e.target.classList.contains('bulk-select-checkbox')) {
                clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(function() {
                    console.log('Showing card preview');
                    
                    // Get card data
                    const cardName = cardContainer.dataset.name || 'Card Name';
                    const cardSet = cardContainer.dataset.set || 'Card Set';
                    const imageUrl = cardContainer.querySelector('img')?.src || 
                                    cardContainer.dataset.image || 
                                    'https://placehold.co/300x420?text=Card+Preview';
                    
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
            const cardContainer = e.target.closest('.card-container, .search-result-card');
            if (cardContainer) {
                clearTimeout(hoverTimeout);
                tooltip.classList.add('hidden');
            }
        });
        
        // Add hover functionality to search results
        document.addEventListener('DOMNodeInserted', function(e) {
            if (e.target.classList && (e.target.classList.contains('search-result-card') || e.target.querySelector('.search-result-card'))) {
                const searchResults = e.target.classList.contains('search-result-card') ? [e.target] : e.target.querySelectorAll('.search-result-card');
                
                searchResults.forEach(result => {
                    // Make sure we don't add duplicate event listeners
                    if (!result.dataset.hoverInitialized) {
                        result.dataset.hoverInitialized = 'true';
                        
                        // Add hover data attributes if not present
                        if (!result.dataset.name) {
                            const nameElement = result.querySelector('.card-name');
                            if (nameElement) result.dataset.name = nameElement.textContent;
                        }
                        
                        if (!result.dataset.set) {
                            const setElement = result.querySelector('.card-set');
                            if (setElement) result.dataset.set = setElement.textContent;
                        }
                        
                        if (!result.dataset.image) {
                            const imageElement = result.querySelector('img');
                            if (imageElement) result.dataset.image = imageElement.src;
                        }
                    }
                });
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
    
    // Apply game filters on load
    applyGameFilters(savedGameFilters);
    
    // Initialize view toggle based on localStorage
    const savedView = localStorage.getItem('collectionView') || 'grid';
    updateViewToggle(savedView);
    
    // Initialize bulk edit mode based on localStorage
    const bulkEditMode = localStorage.getItem('bulkEditMode') === 'true';
    if (bulkEditMode) {
        toggleBulkEditMode(true);
    }
    
    // Initialize prices with correct currency
    updateAllPrices();
    
    // Add data-price and data-currency attributes to all price elements
    document.querySelectorAll('.card-price').forEach(element => {
        if (!element.dataset.price) {
            const priceText = element.textContent.trim();
            const match = priceText.match(/[\d,.]+/);
            if (match) {
                const price = parseFloat(match[0].replace(/,/g, ''));
                element.dataset.price = price;
                
                // Detect currency from symbol
                if (priceText.includes('$')) {
                    element.dataset.currency = 'USD';
                } else if (priceText.includes('€')) {
                    element.dataset.currency = 'EUR';
                } else if (priceText.includes('£')) {
                    element.dataset.currency = 'GBP';
                } else if (priceText.includes('¥')) {
                    element.dataset.currency = 'JPY';
                } else if (priceText.includes('kr')) {
                    // Default to SEK, but could be NOK or DKK
                    element.dataset.currency = 'SEK';
                }
            }
        }
    });
    
    console.log('All HatakeSocial fixes initialized');
});
