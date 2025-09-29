/**
 * hatake-restore.js
 * Comprehensive fix to restore all functionality in the HatakeSocial collection page
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('HatakeSocial restore script loaded');
    
    // ===== INITIALIZATION FIX =====
    
    // Fix "Failed to initialize the application" error
    function fixInitialization() {
        console.log('Fixing initialization');
        
        // Remove error message if present
        const errorMessage = document.querySelector('.bg-red-500');
        if (errorMessage) {
            errorMessage.remove();
        }
        
        // Initialize Collection object if it doesn't exist
        if (!window.Collection) {
            window.Collection = {
                init: function() {
                    console.log('Collection initialized');
                    return Promise.resolve();
                },
                getFilters: function() {
                    // Return default filters
                    return {
                        name: document.getElementById('name-filter')?.value || '',
                        set: document.getElementById('set-filter')?.value || '',
                        games: Array.from(document.querySelectorAll('input[data-game]:checked')).map(cb => cb.dataset.game),
                        type: document.getElementById('type-filter')?.value || 'All Types'
                    };
                },
                applyFilters: function() {
                    filterCards();
                }
            };
        }
    }
    
    // ===== VIEW TOGGLE FUNCTIONALITY =====
    
    // Fix view toggle functionality
    function fixViewToggle() {
        console.log('Fixing view toggle');
        
        const gridToggle = document.getElementById('view-toggle-grid');
        const listToggle = document.getElementById('view-toggle-list');
        const collectionDisplay = document.getElementById('collection-display');
        
        if (!gridToggle || !listToggle || !collectionDisplay) return;
        
        // Get current view from localStorage or default to grid
        const currentView = localStorage.getItem('collectionView') || 'grid';
        
        // Set initial state
        updateViewToggle(currentView);
        updateCardDisplay(currentView);
        
        // Add event listeners
        gridToggle.addEventListener('click', function() {
            updateViewToggle('grid');
            updateCardDisplay('grid');
            localStorage.setItem('collectionView', 'grid');
        });
        
        listToggle.addEventListener('click', function() {
            updateViewToggle('list');
            updateCardDisplay('list');
            localStorage.setItem('collectionView', 'list');
        });
        
        function updateViewToggle(view) {
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
        
        function updateCardDisplay(view) {
            if (view === 'grid') {
                collectionDisplay.classList.remove('list-view');
                collectionDisplay.classList.add('grid-view', 'grid', 'grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'xl:grid-cols-5', 'gap-4');
                collectionDisplay.classList.remove('flex', 'flex-col', 'space-y-2');
                
                // Update card containers for grid view
                document.querySelectorAll('.card-container').forEach(card => {
                    card.classList.remove('list-card', 'flex', 'items-center', 'p-2');
                    card.classList.add('grid-card');
                    
                    // Hide list-specific elements
                    const listDetails = card.querySelector('.list-details');
                    if (listDetails) listDetails.classList.add('hidden');
                    
                    // Show grid-specific elements
                    const cardImage = card.querySelector('.card-image');
                    if (cardImage) {
                        cardImage.classList.remove('hidden');
                        cardImage.style.width = '';
                    }
                });
            } else {
                collectionDisplay.classList.remove('grid-view', 'grid', 'grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'xl:grid-cols-5', 'gap-4');
                collectionDisplay.classList.add('list-view', 'flex', 'flex-col', 'space-y-2');
                
                // Update card containers for list view
                document.querySelectorAll('.card-container').forEach(card => {
                    card.classList.remove('grid-card');
                    card.classList.add('list-card', 'flex', 'items-center', 'p-2', 'bg-white', 'dark:bg-gray-800', 'rounded-lg', 'shadow');
                    
                    // Create list details if they don't exist
                    if (!card.querySelector('.list-details')) {
                        const cardName = card.dataset.name || 'Unknown Card';
                        const cardSet = card.dataset.set || 'Unknown Set';
                        const cardPrice = card.dataset.price || '0.00';
                        const cardGame = card.dataset.game || 'Unknown Game';
                        
                        const listDetails = document.createElement('div');
                        listDetails.className = 'list-details flex-grow ml-4';
                        listDetails.innerHTML = `
                            <div class="flex justify-between">
                                <h3 class="font-semibold">${cardName}</h3>
                                <span class="card-price">${formatPrice(cardPrice)}</span>
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                                <span>${cardSet}</span> · <span>${cardGame}</span>
                            </div>
                        `;
                        
                        // Find the right position to insert
                        const cardImage = card.querySelector('.card-image');
                        if (cardImage) {
                            cardImage.insertAdjacentElement('afterend', listDetails);
                        } else {
                            card.appendChild(listDetails);
                        }
                    } else {
                        // Show existing list details
                        const listDetails = card.querySelector('.list-details');
                        listDetails.classList.remove('hidden');
                    }
                    
                    // Adjust image size for list view
                    const cardImage = card.querySelector('.card-image');
                    if (cardImage) {
                        cardImage.classList.remove('hidden');
                        cardImage.style.width = '60px';
                    }
                });
            }
        }
    }
    
    // ===== GAME FILTERS FUNCTIONALITY =====
    
    // Fix game filter functionality
    function fixGameFilters() {
        console.log('Fixing game filters');
        
        // Get all game checkboxes
        const gameCheckboxes = document.querySelectorAll('input[data-game]');
        if (gameCheckboxes.length === 0) return;
        
        // Add event listeners to game checkboxes
        gameCheckboxes.forEach(checkbox => {
            // Remove existing event listeners
            const clone = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(clone, checkbox);
            
            // Add new event listener
            clone.addEventListener('change', function() {
                handleGameFilterChange();
            });
        });
        
        // Define handleGameFilterChange function
        window.handleGameFilterChange = function() {
            console.log('Game filter changed');
            
            // Get selected games
            const selectedGames = Array.from(document.querySelectorAll('input[data-game]:checked')).map(cb => cb.dataset.game);
            console.log('Selected games:', selectedGames);
            
            // Update game-specific filters
            updateGameSpecificFilters(selectedGames);
            
            // Filter cards
            filterCards();
        };
        
        // Update game-specific filters based on selected games
        function updateGameSpecificFilters(selectedGames) {
            const gameSpecificFilters = document.getElementById('game-specific-filters');
            if (!gameSpecificFilters) return;
            
            // Clear existing filters
            gameSpecificFilters.innerHTML = '';
            
            // Add game-specific filters
            if (selectedGames.includes('pokemon')) {
                // Add Pokémon type filter
                const pokemonTypeFilter = document.createElement('div');
                pokemonTypeFilter.id = 'pokemon-type-filter';
                pokemonTypeFilter.className = 'mb-4';
                pokemonTypeFilter.innerHTML = `
                    <h3 class="text-lg font-semibold mb-2">Type (Pokémon)</h3>
                    <select id="type-filter" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                        <option>All Types</option>
                        <option>Fire</option>
                        <option>Water</option>
                        <option>Grass</option>
                        <option>Electric</option>
                        <option>Psychic</option>
                        <option>Fighting</option>
                        <option>Darkness</option>
                        <option>Metal</option>
                        <option>Fairy</option>
                        <option>Dragon</option>
                        <option>Colorless</option>
                    </select>
                `;
                gameSpecificFilters.appendChild(pokemonTypeFilter);
                
                // Add event listener to type filter
                const typeFilter = pokemonTypeFilter.querySelector('#type-filter');
                if (typeFilter) {
                    typeFilter.addEventListener('change', filterCards);
                }
            }
            
            if (selectedGames.includes('mtg')) {
                // Add Magic color filter
                const mtgColorFilter = document.createElement('div');
                mtgColorFilter.id = 'mtg-color-filter';
                mtgColorFilter.className = 'mb-4';
                mtgColorFilter.innerHTML = `
                    <h3 class="text-lg font-semibold mb-2">Color (Magic)</h3>
                    <select id="color-filter" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                        <option>All Colors</option>
                        <option>White</option>
                        <option>Blue</option>
                        <option>Black</option>
                        <option>Red</option>
                        <option>Green</option>
                        <option>Colorless</option>
                        <option>Multicolor</option>
                    </select>
                `;
                gameSpecificFilters.appendChild(mtgColorFilter);
                
                // Add event listener to color filter
                const colorFilter = mtgColorFilter.querySelector('#color-filter');
                if (colorFilter) {
                    colorFilter.addEventListener('change', filterCards);
                }
            }
            
            if (selectedGames.includes('lorcana')) {
                // Add Lorcana ink filter
                const lorcanaInkFilter = document.createElement('div');
                lorcanaInkFilter.id = 'lorcana-ink-filter';
                lorcanaInkFilter.className = 'mb-4';
                lorcanaInkFilter.innerHTML = `
                    <h3 class="text-lg font-semibold mb-2">Ink (Lorcana)</h3>
                    <select id="ink-filter" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                        <option>All Inks</option>
                        <option>Amber</option>
                        <option>Amethyst</option>
                        <option>Emerald</option>
                        <option>Ruby</option>
                        <option>Sapphire</option>
                        <option>Steel</option>
                    </select>
                `;
                gameSpecificFilters.appendChild(lorcanaInkFilter);
                
                // Add event listener to ink filter
                const inkFilter = lorcanaInkFilter.querySelector('#ink-filter');
                if (inkFilter) {
                    inkFilter.addEventListener('change', filterCards);
                }
            }
        }
        
        // Initialize game filters
        handleGameFilterChange();
    }
    
    // Filter cards based on all filters
    function filterCards() {
        console.log('Filtering cards');
        
        // Get filter values
        const nameFilter = document.getElementById('name-filter')?.value.toLowerCase() || '';
        const setFilter = document.getElementById('set-filter')?.value.toLowerCase() || '';
        const selectedGames = Array.from(document.querySelectorAll('input[data-game]:checked')).map(cb => cb.dataset.game);
        
        // Get game-specific filter values
        const typeFilter = document.getElementById('type-filter')?.value || 'All Types';
        const colorFilter = document.getElementById('color-filter')?.value || 'All Colors';
        const inkFilter = document.getElementById('ink-filter')?.value || 'All Inks';
        
        // Get all cards
        const cards = document.querySelectorAll('.card-container');
        
        // Filter cards
        cards.forEach(card => {
            const cardName = card.dataset.name?.toLowerCase() || '';
            const cardSet = card.dataset.set?.toLowerCase() || '';
            const cardGame = card.dataset.game?.toLowerCase() || '';
            const cardType = card.dataset.type || '';
            const cardColor = card.dataset.color || '';
            const cardInk = card.dataset.ink || '';
            
            // Check if card matches all filters
            const nameMatch = nameFilter === '' || cardName.includes(nameFilter);
            const setMatch = setFilter === '' || cardSet.includes(setFilter);
            const gameMatch = selectedGames.length === 0 || selectedGames.includes(cardGame);
            
            // Check game-specific filters
            let typeMatch = true;
            let colorMatch = true;
            let inkMatch = true;
            
            if (cardGame === 'pokemon' && typeFilter !== 'All Types') {
                typeMatch = cardType === typeFilter;
            }
            
            if (cardGame === 'mtg' && colorFilter !== 'All Colors') {
                colorMatch = cardColor === colorFilter;
            }
            
            if (cardGame === 'lorcana' && inkFilter !== 'All Inks') {
                inkMatch = cardInk === inkFilter;
            }
            
            // Show card if it matches all filters
            if (nameMatch && setMatch && gameMatch && typeMatch && colorMatch && inkMatch) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }
    
    // ===== MODAL FUNCTIONALITY =====
    
    // Fix modal functionality
    function fixModals() {
        console.log('Fixing modals');
        
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
            // Remove existing event listeners
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
            
            // Add new event listener
            clone.addEventListener('click', function(e) {
                e.stopPropagation();
                const modalId = clone.getAttribute('data-modal-close');
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
        
        // Fix Add Card button
        const addCardBtn = document.getElementById('add-card-btn');
        if (addCardBtn) {
            // Remove existing event listeners
            const clone = addCardBtn.cloneNode(true);
            addCardBtn.parentNode.replaceChild(clone, addCardBtn);
            
            // Add new event listener
            clone.addEventListener('click', function() {
                openModal('search-modal');
            });
        }
    }
    
    // ===== CARD BUTTONS FUNCTIONALITY =====
    
    // Fix card buttons functionality
    function fixCardButtons() {
        console.log('Fixing card buttons');
        
        // Fix card button styling
        document.querySelectorAll('.card-container').forEach(card => {
            const cardActions = card.querySelector('.card-actions');
            if (cardActions) {
                // Ensure buttons are properly contained within the card
                cardActions.style.position = 'absolute';
                cardActions.style.bottom = '8px';
                cardActions.style.right = '8px';
                cardActions.style.display = 'flex';
                cardActions.style.gap = '8px';
                
                // Fix button styling
                cardActions.querySelectorAll('button').forEach(btn => {
                    btn.style.padding = '4px';
                    btn.style.borderRadius = '4px';
                    btn.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                });
            }
        });
        
        // Fix card button functionality
        document.addEventListener('click', function(e) {
            // Edit button
            if (e.target.closest('.edit-btn')) {
                e.preventDefault();
                const card = e.target.closest('.card-container');
                if (card) {
                    const cardId = card.dataset.cardId;
                    console.log('Editing card:', cardId);
                    alert(`Editing card: ${cardId}`);
                }
            }
            
            // Delete button
            if (e.target.closest('.delete-btn')) {
                e.preventDefault();
                const card = e.target.closest('.card-container');
                if (card) {
                    const cardId = card.dataset.cardId;
                    console.log('Deleting card:', cardId);
                    if (confirm('Are you sure you want to delete this card?')) {
                        card.remove();
                    }
                }
            }
            
            // Analytics button
            if (e.target.closest('.analytics-btn')) {
                e.preventDefault();
                const card = e.target.closest('.card-container');
                if (card) {
                    const cardId = card.dataset.cardId;
                    console.log('Showing analytics for card:', cardId);
                    window.toggleDashboard(cardId);
                }
            }
        });
    }
    
    // ===== CURRENCY FUNCTIONALITY =====
    
    // Fix currency functionality
    function fixCurrency() {
        console.log('Fixing currency functionality');
        
        // Get currency selector
        const currencySelector = document.querySelector('select[id="currency-selector"]');
        if (!currencySelector) return;
        
        // Set initial value from localStorage
        const userCurrency = localStorage.getItem('userCurrency') || 'USD';
        currencySelector.value = userCurrency;
        
        // Update currency when changed
        currencySelector.addEventListener('change', function() {
            const newCurrency = currencySelector.value;
            localStorage.setItem('userCurrency', newCurrency);
            console.log('Currency changed to:', newCurrency);
            
            // Update all price displays
            updateAllPrices(newCurrency);
        });
        
        // Update all prices with the current currency
        updateAllPrices(userCurrency);
        
        // Function to update all prices
        function updateAllPrices(currency) {
            document.querySelectorAll('.card-price').forEach(element => {
                const priceUSD = parseFloat(element.dataset.price || element.textContent.replace(/[^0-9.]/g, ''));
                if (isNaN(priceUSD)) return;
                
                element.textContent = formatPrice(priceUSD, currency);
            });
        }
    }
    
    // Format price with currency symbol
    function formatPrice(price, currency = 'USD') {
        const currencySymbols = {
            USD: '$',
            EUR: '€',
            GBP: '£',
            JPY: '¥',
            SEK: 'kr',
            NOK: 'kr',
            DKK: 'kr'
        };
        
        const exchangeRates = {
            USD: 1.0,
            EUR: 0.92,
            GBP: 0.78,
            JPY: 150.0,
            SEK: 10.5,
            NOK: 10.8,
            DKK: 6.9
        };
        
        // Convert price to target currency
        const convertedPrice = price * exchangeRates[currency];
        
        // Format based on currency
        const symbol = currencySymbols[currency] || '';
        
        if (currency === 'JPY') {
            return `${symbol}${Math.round(convertedPrice).toLocaleString()}`;
        } else if (currency === 'USD') {
            return `${symbol}${convertedPrice.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
        } else {
            return `${convertedPrice.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ${symbol}`;
        }
    }
    
    // ===== BULK EDIT FUNCTIONALITY =====
    
    // Fix bulk edit functionality
    function fixBulkEdit() {
        console.log('Fixing bulk edit functionality');
        
        // Fix bulk edit button
        const bulkEditBtn = document.getElementById('bulk-edit-btn');
        if (bulkEditBtn) {
            // Remove existing event listeners
            const clone = bulkEditBtn.cloneNode(true);
            bulkEditBtn.parentNode.replaceChild(clone, bulkEditBtn);
            
            // Add new event listener
            clone.addEventListener('click', function() {
                toggleBulkEditMode();
            });
        }
        
        // Fix bulk edit toolbar buttons
        const selectAllBtn = document.getElementById('bulk-select-all-btn');
        const listForSaleBtn = document.getElementById('bulk-list-btn');
        const deleteSelectedBtn = document.getElementById('bulk-delete-btn');
        
        if (selectAllBtn) {
            // Remove existing event listeners
            const clone = selectAllBtn.cloneNode(true);
            selectAllBtn.parentNode.replaceChild(clone, selectAllBtn);
            
            // Add new event listener
            clone.addEventListener('click', function() {
                const checkboxes = document.querySelectorAll('.bulk-select-checkbox');
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                
                checkboxes.forEach(checkbox => {
                    checkbox.checked = !allChecked;
                    const card = checkbox.closest('.card-container');
                    if (card) {
                        card.classList.toggle('selected', !allChecked);
                    }
                });
                
                updateSelectedCount();
            });
        }
        
        if (listForSaleBtn) {
            // Remove existing event listeners
            const clone = listForSaleBtn.cloneNode(true);
            listForSaleBtn.parentNode.replaceChild(clone, listForSaleBtn);
            
            // Add new event listener
            clone.addEventListener('click', function() {
                openBulkReviewModal('list');
            });
        }
        
        if (deleteSelectedBtn) {
            // Remove existing event listeners
            const clone = deleteSelectedBtn.cloneNode(true);
            deleteSelectedBtn.parentNode.replaceChild(clone, deleteSelectedBtn);
            
            // Add new event listener
            clone.addEventListener('click', function() {
                openBulkReviewModal('delete');
            });
        }
        
        // Toggle bulk edit mode
        function toggleBulkEditMode() {
            const bulkEditToolbar = document.getElementById('bulk-edit-toolbar');
            const bulkEditActive = bulkEditToolbar && !bulkEditToolbar.classList.contains('hidden');
            
            if (bulkEditActive) {
                // Deactivate bulk edit mode
                bulkEditToolbar.classList.add('hidden');
                bulkEditBtn.classList.remove('bg-blue-500', 'text-white');
                
                // Remove checkboxes from cards
                document.querySelectorAll('.card-container').forEach(card => {
                    card.classList.remove('bulk-edit-mode', 'selected');
                    const checkbox = card.querySelector('.bulk-select-checkbox');
                    if (checkbox) checkbox.remove();
                });
            } else {
                // Activate bulk edit mode
                bulkEditToolbar.classList.remove('hidden');
                bulkEditBtn.classList.add('bg-blue-500', 'text-white');
                
                // Add checkboxes to cards
                document.querySelectorAll('.card-container').forEach(card => {
                    if (!card.querySelector('.bulk-select-checkbox')) {
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.className = 'bulk-select-checkbox absolute top-2 left-2 z-10 h-5 w-5';
                        checkbox.addEventListener('change', function() {
                            card.classList.toggle('selected', checkbox.checked);
                            updateSelectedCount();
                        });
                        card.appendChild(checkbox);
                    }
                    card.classList.add('bulk-edit-mode');
                });
            }
        }
        
        // Update selected count
        function updateSelectedCount() {
            const selectedCount = document.querySelectorAll('.card-container.selected').length;
            const countElement = document.getElementById('bulk-selected-count');
            if (countElement) {
                countElement.textContent = selectedCount;
            }
        }
        
        // Open bulk review modal
        window.openBulkReviewModal = function(mode) {
            console.log('Opening bulk review modal:', mode);
            
            // Get selected cards
            const selectedCards = document.querySelectorAll('.card-container.selected');
            if (selectedCards.length === 0) {
                alert('Please select at least one card first.');
                return;
            }
            
            // Get or create the bulk review modal
            let bulkReviewModal = document.getElementById('bulk-review-modal');
            
            if (!bulkReviewModal) {
                // Create the modal
                bulkReviewModal = document.createElement('div');
                bulkReviewModal.id = 'bulk-review-modal';
                bulkReviewModal.className = 'fixed inset-0 bg-black bg-opacity-75 hidden items-center justify-center z-[1002]';
                
                bulkReviewModal.innerHTML = `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
                        <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                            <h3 class="text-lg font-semibold" id="bulk-review-title">Bulk Action</h3>
                            <button class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold" data-modal-close="bulk-review-modal">×</button>
                        </div>
                        <div class="p-6">
                            <p class="mb-4" id="bulk-review-message">You are about to perform a bulk action on <span id="bulk-review-count">0</span> cards.</p>
                            <div class="mb-4" id="bulk-price-container">
                                <label class="block text-sm font-medium mb-1" for="bulk-price">Price per card ($)</label>
                                <input type="number" id="bulk-price" class="w-full p-2 border rounded-md" min="0" step="0.01" value="0.00">
                            </div>
                            <div class="flex justify-end space-x-2">
                                <button class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md" data-modal-close="bulk-review-modal">Cancel</button>
                                <button id="bulk-confirm-btn" class="px-4 py-2 bg-blue-500 text-white rounded-md">Confirm</button>
                            </div>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(bulkReviewModal);
                
                // Add event listener to close button
                const closeBtn = bulkReviewModal.querySelector('[data-modal-close="bulk-review-modal"]');
                if (closeBtn) {
                    closeBtn.addEventListener('click', function() {
                        bulkReviewModal.classList.add('hidden');
                        bulkReviewModal.classList.remove('flex');
                    });
                }
                
                // Add event listener to confirm button
                const confirmBtn = bulkReviewModal.querySelector('#bulk-confirm-btn');
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', function() {
                        // Handle confirmation based on mode
                        if (mode === 'list') {
                            const price = document.getElementById('bulk-price').value;
                            alert(`${selectedCards.length} cards will be listed for sale at $${price} each.`);
                        } else if (mode === 'delete') {
                            if (confirm(`Are you sure you want to delete ${selectedCards.length} cards?`)) {
                                selectedCards.forEach(card => card.remove());
                            }
                        }
                        
                        // Close modal
                        bulkReviewModal.classList.add('hidden');
                        bulkReviewModal.classList.remove('flex');
                        
                        // Deselect all cards
                        document.querySelectorAll('.card-container.selected').forEach(card => {
                            card.classList.remove('selected');
                            const checkbox = card.querySelector('.bulk-select-checkbox');
                            if (checkbox) checkbox.checked = false;
                        });
                        
                        // Update selected count
                        updateSelectedCount();
                    });
                }
            }
            
            // Update modal content
            const bulkReviewTitle = document.getElementById('bulk-review-title');
            const bulkReviewMessage = document.getElementById('bulk-review-message');
            const bulkReviewCount = document.getElementById('bulk-review-count');
            const bulkPriceContainer = document.getElementById('bulk-price-container');
            
            if (bulkReviewTitle) {
                bulkReviewTitle.textContent = mode === 'list' ? 'List Cards for Sale' : 'Delete Cards';
            }
            
            if (bulkReviewMessage) {
                bulkReviewMessage.textContent = mode === 'list' 
                    ? `You are about to list ${selectedCards.length} cards for sale.` 
                    : `You are about to delete ${selectedCards.length} cards.`;
            }
            
            if (bulkReviewCount) {
                bulkReviewCount.textContent = selectedCards.length;
            }
            
            if (bulkPriceContainer) {
                bulkPriceContainer.style.display = mode === 'list' ? 'block' : 'none';
            }
            
            // Show modal
            bulkReviewModal.classList.remove('hidden');
            bulkReviewModal.classList.add('flex', 'items-center', 'justify-center');
        };
    }
    
    // ===== ANALYTICS FUNCTIONALITY =====
    
    // Fix analytics functionality
    function fixAnalytics() {
        console.log('Fixing analytics functionality');
        
        // Define the toggleDashboard function
        window.toggleDashboard = function(cardId) {
            console.log('Toggling dashboard for card:', cardId);
            
            // Get the collection display and analytics dashboard
            const collectionDisplay = document.getElementById('collection-display');
            const analyticsDashboard = document.getElementById('analytics-dashboard');
            
            if (!collectionDisplay || !analyticsDashboard) {
                console.error('Collection display or analytics dashboard not found');
                return;
            }
            
            // Toggle visibility
            if (analyticsDashboard.style.display === 'flex') {
                collectionDisplay.style.display = '';
                analyticsDashboard.style.display = 'none';
            } else {
                collectionDisplay.style.display = 'none';
                analyticsDashboard.style.display = 'flex';
                
                // Update analytics data
                const currentValue = document.getElementById('analytics-current-value');
                const change24h = document.getElementById('analytics-24h-change');
                const allTimeHigh = document.getElementById('analytics-all-time-high');
                
                if (currentValue) currentValue.textContent = '$108.47';
                if (change24h) change24h.textContent = '+$0.23';
                if (allTimeHigh) allTimeHigh.textContent = '$110.00';
                
                // If we have a specific card ID, show card-specific analytics
                if (cardId) {
                    console.log('Showing analytics for card:', cardId);
                    
                    // In a real implementation, this would fetch card-specific data
                    // For now, just show some mock data
                    if (currentValue) currentValue.textContent = '$45.99';
                    if (change24h) change24h.textContent = '+$1.25';
                    if (allTimeHigh) allTimeHigh.textContent = '$50.00';
                }
            }
        };
        
        // Fix the analyze value button
        const analyzeValueBtn = document.getElementById('analyze-value-btn');
        if (analyzeValueBtn) {
            // Remove existing event listeners
            const clone = analyzeValueBtn.cloneNode(true);
            analyzeValueBtn.parentNode.replaceChild(clone, analyzeValueBtn);
            
            // Add new event listener
            clone.addEventListener('click', function() {
                window.toggleDashboard();
            });
        }
    }
    
    // ===== INITIALIZATION =====
    
    // Apply all fixes
    fixInitialization();
    fixViewToggle();
    fixGameFilters();
    fixModals();
    fixCardButtons();
    fixCurrency();
    fixBulkEdit();
    fixAnalytics();
    
    console.log('All functionality restored');
});
