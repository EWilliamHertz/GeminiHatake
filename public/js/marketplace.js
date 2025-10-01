/**
 * HatakeSocial - Marketplace Script (v24 - Trade Integration Fix)
 *
 * - FIX: Properly implemented the 'Add to Trade' functionality with hover effects
 * - Cards now show a purple button in the top right corner when hovered
 * - Clicking the button adds the card to a trade basket and redirects to trades page
 */

// Import currency functions
let convertAndFormat = null;
let initCurrency = null;

// Load currency module
(async () => {
    try {
        const currencyModule = await import('./modules/currency.js');
        convertAndFormat = currencyModule.convertAndFormat;
        initCurrency = currencyModule.initCurrency;
        window.convertAndFormat = convertAndFormat;

        // Initialize currency system
        await initCurrency();
    } catch (error) {
        console.error('Failed to load currency module:', error);
    }
})();

class MarketplaceManager {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.allListings = [];
        this.filteredListings = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.searchTimeout = null;
        this.selectedCard = null;
        this.currentCurrency = 'USD';
        this.exchangeRates = { USD: 1 };

        // Trade basket functionality
        this.tradeBasket = JSON.parse(localStorage.getItem('tradeBasket') || '[]');

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('Initializing Marketplace Manager...');

        // Wait for Firebase to be initialized
        await this.waitForFirebase();

        // Wait for auth state
        this.auth.onAuthStateChanged(user => {
            this.currentUser = user;
            console.log('Auth state changed:', user ? user.uid : 'No user');
        });

        this.bindEvents();
        await this.loadMarketplaceData();
        this.updateDisplay();
        this.updateTradeBasketCounter();
        this.bindTradeBasketButton();
    }

    async waitForFirebase() {
        let attempts = 0;
        const maxAttempts = 50;

        while (attempts < maxAttempts) {
            if (window.db && window.auth) {
                this.db = window.db;
                this.auth = window.auth;
                console.log('Firebase initialized successfully');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        throw new Error('Firebase failed to initialize after 5 seconds');
    }

    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('main-search-bar');
        const filterName = document.getElementById('filter-name');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        if (filterName) {
            filterName.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Game filters
        const gameCheckboxes = document.querySelectorAll('[data-game]');
        gameCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.applyFilters());
        });

        // Additional filters
        const filterElements = [
            'condition-filter',
            'min-price',
            'max-price',
            'rarity-filter',
            'location-filter',
            'set-filter',
            'sort-filter'
        ];

        filterElements.forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                const eventType = element.type === 'text' ? 'input' : 'change';
                element.addEventListener(eventType, () => {
                    if (filterId === 'min-price' || filterId === 'max-price' || filterId === 'set-filter') {
                        // Add debounce for text inputs
                        clearTimeout(this.filterTimeout);
                        this.filterTimeout = setTimeout(() => this.applyFilters(), 300);
                    } else {
                        this.applyFilters();
                    }
                });
            }
        });

        // Clear filters button
        const clearFiltersBtn = document.getElementById('clear-filters-btn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }

        // View toggles
        const gridToggle = document.getElementById('view-toggle-grid');
        const listToggle = document.getElementById('view-toggle-list');

        if (gridToggle) {
            gridToggle.addEventListener('click', () => this.setViewMode('grid'));
        }

        if (listToggle) {
            listToggle.addEventListener('click', () => this.setViewMode('list'));
        }

        // Pagination
        const prevPage = document.getElementById('prev-page');
        const nextPage = document.getElementById('next-page');

        if (prevPage) {
            prevPage.addEventListener('click', () => this.changePage(-1));
        }

        if (nextPage) {
            nextPage.addEventListener('click', () => this.changePage(1));
        }

        // Modal events
        this.bindModalEvents();

        // Game-specific filter toggles
        this.bindGameFilterToggles();

        // Currency change listener
        document.addEventListener('currencyChanged', () => {
            this.updateDisplay();
            this.updateStats();
        });
    }

    bindModalEvents() {
        // Close modal buttons
        document.querySelectorAll('[data-modal-close]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = btn.getAttribute('data-modal-close');
                this.closeModal(modalId);
            });
        });

        // Add to collection form
        const addCollectionForm = document.getElementById('add-collection-form');
        if (addCollectionForm) {
            addCollectionForm.addEventListener('submit', (e) => this.handleAddToCollection(e));
        }

        // Graded checkbox toggle
        const gradedCheckbox = document.getElementById('collection-graded');
        if (gradedCheckbox) {
            gradedCheckbox.addEventListener('change', (e) => {
                const gradedDetails = document.getElementById('graded-details');
                if (gradedDetails) {
                    gradedDetails.classList.toggle('hidden', !e.target.checked);
                }
            });
        }

        // Contact seller button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'contact-seller-btn' || e.target.closest('#contact-seller-btn')) {
                this.handleContactSeller();
            }
        });

        // ADDED: Start trade button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'start-trade-btn' || e.target.closest('#start-trade-btn')) {
                this.handleStartTrade();
            }
        });
    }

    bindGameFilterToggles() {
        const gameCheckboxes = document.querySelectorAll('#game-filter-container input[type="checkbox"]');
        gameCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.toggleGameSpecificFilters();
                this.applyFilters();
            });
        });
    }

    toggleGameSpecificFilters() {
        const gameFilters = {
            'mtg': document.getElementById('mtg-filters'),
            'pokemon': document.getElementById('pokemon-filters'),
            'lorcana': document.getElementById('lorcana-filters'),
            'gundam': document.getElementById('gundam-filters')
        };

        const checkedGames = Array.from(document.querySelectorAll('#game-filter-container input[type="checkbox"]:checked'))
            .map(cb => cb.getAttribute('data-game'));

        // Hide all game-specific filters first
        Object.values(gameFilters).forEach(filter => {
            if (filter) filter.classList.add('hidden');
        });

        // Show filters for checked games
        checkedGames.forEach(game => {
            if (gameFilters[game]) {
                gameFilters[game].classList.remove('hidden');
            }
        });
    }

    async loadMarketplaceData() {
        console.log('Loading marketplace data...');
        const loadingIndicator = document.getElementById('loading-indicator');
        const marketplaceDisplay = document.getElementById('marketplace-display');

        if (loadingIndicator) {
            loadingIndicator.classList.remove('hidden');
        }

        if (marketplaceDisplay) {
            marketplaceDisplay.classList.add('hidden');
        }

        try {
            console.log('Querying marketplaceListings collection...');

            // Query the marketplaceListings collection
            const snapshot = await this.db.collection('marketplaceListings')
                .orderBy('listedAt', 'desc')
                .get();

            this.allListings = [];

            console.log(`Found ${snapshot.size} documents in marketplaceListings`);

            snapshot.forEach(doc => {
                const data = doc.data();
                console.log('Processing listing:', doc.id, data);

                const listing = {
                    id: doc.id,
                    ...data,
                    // Ensure proper data structure
                    cardData: data.cardData || data,
                    sellerData: data.sellerData || { displayName: 'Unknown Seller' },
                    price: data.price || 0,
                    listedAt: data.listedAt?.toDate() || new Date()
                };
                this.allListings.push(listing);
            });

            this.filteredListings = [...this.allListings];
            console.log(`Loaded ${this.allListings.length} marketplace listings`);

            this.updateStats();
            this.applyFilters();

        } catch (error) {
            console.error('Error loading marketplace data:', error);
            this.showToast('Failed to load marketplace listings: ' + error.message, 'error');

            // Show error in the UI
            const grid = document.getElementById('marketplace-grid');
            if (grid) {
                grid.innerHTML = `
                    <div class="col-span-full flex flex-col items-center justify-center py-12 text-red-500">
                        <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                        <h3 class="text-xl font-semibold mb-2">Error Loading Marketplace</h3>
                        <p class="text-center">${error.message}</p>
                        <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            Retry
                        </button>
                    </div>
                `;
            }
        } finally {
            if (loadingIndicator) {
                loadingIndicator.classList.add('hidden');
            }

            if (marketplaceDisplay) {
                marketplaceDisplay.classList.remove('hidden');
            }
        }
    }

    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.applyFilters();
        }, 300);
    }

    applyFilters() {
        let filtered = [...this.allListings];

        // Search filter
        const searchQuery = (document.getElementById('main-search-bar')?.value ||
                           document.getElementById('filter-name')?.value || '').toLowerCase().trim();

        if (searchQuery) {
            filtered = filtered.filter(listing => {
                const cardData = listing.cardData || listing;
                const name = cardData.name || '';
                const setName = cardData.set_name || cardData.set || '';
                return name.toLowerCase().includes(searchQuery) ||
                       setName.toLowerCase().includes(searchQuery);
            });
        }

        // Game filter
        const checkedGames = Array.from(document.querySelectorAll('#game-filter-container input[type="checkbox"]:checked'))
            .map(cb => cb.getAttribute('data-game'));

        if (checkedGames.length > 0) {
            filtered = filtered.filter(listing => {
                const game = (listing.cardData?.game || listing.game || '').toLowerCase();
                return checkedGames.includes(game);
            });
        }

        // Condition filter
        const conditionFilter = document.getElementById('condition-filter')?.value;
        if (conditionFilter) {
            filtered = filtered.filter(listing => {
                const condition = listing.cardData?.condition || listing.condition || '';
                return condition === conditionFilter;
            });
        }

        // Price range filter
        const minPrice = parseFloat(document.getElementById('min-price')?.value || 0);
        const maxPrice = parseFloat(document.getElementById('max-price')?.value || Infinity);

        filtered = filtered.filter(listing => {
            const price = listing.price || 0;
            return price >= minPrice && price <= maxPrice;
        });

        // Rarity filter
        const rarityFilter = document.getElementById('rarity-filter')?.value;
        if (rarityFilter) {
            filtered = filtered.filter(listing => {
                const rarity = (listing.cardData?.rarity || '').toLowerCase();
                return rarity.includes(rarityFilter.toLowerCase());
            });
        }

        // Seller location filter
        const locationFilter = document.getElementById('location-filter')?.value;
        if (locationFilter) {
            filtered = filtered.filter(listing => {
                const sellerCountry = listing.sellerData?.country || '';
                return sellerCountry === locationFilter;
            });
        }

        // Set filter
        const setFilter = document.getElementById('set-filter')?.value?.toLowerCase().trim();
        if (setFilter) {
            filtered = filtered.filter(listing => {
                const setName = (listing.cardData?.set_name || listing.cardData?.set || '').toLowerCase();
                return setName.includes(setFilter);
            });
        }

        // Game-specific filters
        filtered = this.applyGameSpecificFilters(filtered);

        // Sort
        const sortBy = document.getElementById('sort-filter')?.value || 'newest';
        this.sortListings(filtered, sortBy);

        this.filteredListings = filtered;
        this.currentPage = 1;
        this.updateDisplay();
        this.updateStats();
    }

    applyGameSpecificFilters(filtered) {
        // MTG filters
        const mtgTypeFilter = document.getElementById('mtg-type-filter')?.value;
        if (mtgTypeFilter) {
            filtered = filtered.filter(listing => {
                const typeLine = listing.cardData?.type_line || '';
                return typeLine.includes(mtgTypeFilter);
            });
        }

        // Pokemon filters
        const pokemonTypeFilter = document.getElementById('pokemon-type-filter')?.value;
        const pokemonGradedFilter = document.getElementById('pokemon-graded-filter')?.checked;

        if (pokemonTypeFilter) {
            filtered = filtered.filter(listing => {
                const supertype = listing.cardData?.supertype || '';
                return supertype === pokemonTypeFilter;
            });
        }

        if (pokemonGradedFilter) {
            filtered = filtered.filter(listing => {
                return listing.cardData?.isGraded || listing.isGraded;
            });
        }

        // Lorcana filters
        const lorcanaGradedFilter = document.getElementById('lorcana-graded-filter')?.checked;
        if (lorcanaGradedFilter) {
            filtered = filtered.filter(listing => {
                return listing.cardData?.isGraded || listing.isGraded;
            });
        }

        // Gundam filters
        const gundamSeriesFilter = document.getElementById('gundam-series-filter')?.value;
        if (gundamSeriesFilter) {
            filtered = filtered.filter(listing => {
                const series = listing.cardData?.series || '';
                return series === gundamSeriesFilter;
            });
        }

        return filtered;
    }

    sortListings(listings, sortBy) {
        switch (sortBy) {
            case 'newest':
                listings.sort((a, b) => new Date(b.listedAt) - new Date(a.listedAt));
                break;
            case 'oldest':
                listings.sort((a, b) => new Date(a.listedAt) - new Date(b.listedAt));
                break;
            case 'price-low':
                listings.sort((a, b) => (a.price || 0) - (b.price || 0));
                break;
            case 'price-high':
                listings.sort((a, b) => (b.price || 0) - (a.price || 0));
                break;
            case 'name':
                listings.sort((a, b) => {
                    const nameA = (a.cardData?.name || '').toLowerCase();
                    const nameB = (b.cardData?.name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                });
                break;
        }
    }

    updateDisplay() {
        const grid = document.getElementById('marketplace-grid');
        if (!grid) return;

        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageListings = this.filteredListings.slice(startIndex, endIndex);

        // Clear grid
        grid.innerHTML = '';

        if (pageListings.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-12 text-gray-500">
                    <i class="fas fa-store-slash text-4xl mb-4"></i>
                    <h3 class="text-xl font-semibold">No listings found</h3>
                    <p>Try adjusting your search or filters</p>
                </div>
            `;
            this.updatePagination();
            return;
        }

        // Create cards
        pageListings.forEach(listing => {
            const cardElement = this.createCardElement(listing);
            grid.appendChild(cardElement);
        });

        // Add event listeners for trade buttons
        this.addTradeButtonListeners();
        this.updatePagination();
    }

    createCardElement(listing) {
        const cardData = listing.cardData || listing;
        const sellerData = listing.sellerData || {};
        
        const cardDiv = document.createElement('div');
        cardDiv.className = 'marketplace-card bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 relative group';
        cardDiv.setAttribute('data-listing-id', listing.id);

        const imageUrl = cardData.image_uris?.normal || 
                        cardData.image_uris?.large || 
                        cardData.images?.large || 
                        cardData.imageUrl || 
                        'https://via.placeholder.com/223x310?text=No+Image';

        const price = listing.price || 0;
        const priceDisplay = convertAndFormat ? convertAndFormat(price) : `$${price.toFixed(2)}`;

        cardDiv.innerHTML = `
            <div class="relative">
                <img src="${imageUrl}" 
                     alt="${cardData.name || 'Card'}" 
                     class="w-full h-64 object-cover"
                     onerror="this.src='https://via.placeholder.com/223x310?text=No+Image'">
                
                <!-- Add to Trade Button (appears on hover) -->
                <button class="add-to-trade-btn absolute top-2 right-2 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" 
                        data-listing-id="${listing.id}" 
                        title="Add to Trade">
                    <i class="fas fa-plus text-sm"></i>
                </button>
            </div>
            
            <div class="p-4">
                <h3 class="font-semibold text-lg mb-2 text-gray-900 dark:text-white truncate">${cardData.name || 'Unknown Card'}</h3>
                
                <!-- Price and Game -->
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm text-gray-600 dark:text-gray-400 capitalize">${cardData.game || 'Unknown Game'}</span>
                    <span class="text-lg font-bold text-green-600 dark:text-green-400">${priceDisplay}</span>
                </div>
                
                <!-- Set and Rarity -->
                <div class="mb-2">
                    ${cardData.set_name ? `<p class="text-xs text-gray-500 dark:text-gray-400 truncate">${cardData.set_name}</p>` : ''}
                    <div class="flex items-center space-x-2 mt-1">
                        ${cardData.rarity ? `<span class="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded-full capitalize">${cardData.rarity}</span>` : ''}
                        ${cardData.foil ? '<span class="inline-block bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs px-2 py-1 rounded-full">Foil</span>' : ''}
                        ${cardData.condition ? `<span class="inline-block bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs px-2 py-1 rounded-full capitalize">${cardData.condition.replace('_', ' ')}</span>` : ''}
                    </div>
                </div>
                
                <!-- Seller Information -->
                <div class="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            ${sellerData.photoURL ? `<img src="${sellerData.photoURL}" alt="Seller" class="w-6 h-6 rounded-full">` : '<div class="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center"><i class="fas fa-user text-xs text-gray-500"></i></div>'}
                            <div>
                                <p class="text-sm font-medium text-gray-900 dark:text-white">${sellerData.displayName || 'Unknown'}</p>
                                ${sellerData.country ? `<p class="text-xs text-gray-500 dark:text-gray-400">${sellerData.country}</p>` : ''}
                            </div>
                        </div>
                        ${listing.quantity > 1 ? `<span class="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">Qty: ${listing.quantity}</span>` : ''}
                    </div>
                </div>
            </div>
        `;

        // Add click event for card details
        cardDiv.addEventListener('click', (e) => {
            // Don't trigger if clicking the trade button
            if (!e.target.closest('.add-to-trade-btn')) {
                this.showCardDetails(listing);
            }
        });

        return cardDiv;
    }

    addTradeButtonListeners() {
        document.querySelectorAll('.add-to-trade-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const listingId = button.getAttribute('data-listing-id');
                const listing = this.allListings.find(l => l.id === listingId);
                if (listing) {
                    this.addCardToTradeBasket(listing);
                }
            });
        });
    }

    addCardToTradeBasket(listing) {
        // Check if card is already in basket
        const existingIndex = this.tradeBasket.findIndex(c => c.id === listing.id);
        if (existingIndex !== -1) {
            this.showToast("Card is already in your trade basket!", 'warning');
            return;
        }

        // Add card to basket
        const cardData = listing.cardData || listing;
        this.tradeBasket.push({
            id: listing.id,
            name: cardData.name,
            imageUrl: cardData.image_uris?.normal || cardData.image_uris?.large || cardData.images?.large || cardData.imageUrl,
            priceUsd: listing.price,
            game: cardData.game,
            sellerName: listing.sellerData?.displayName || 'Unknown',
            condition: cardData.condition,
            foil: cardData.foil || false
        });

        // Save to localStorage
        localStorage.setItem('tradeBasket', JSON.stringify(this.tradeBasket));
        
        // Update counter
        this.updateTradeBasketCounter();

        // Show success message
        this.showToast(`${cardData.name} added to trade basket!`, 'success');

        // Optional: Redirect to trades page after a short delay
        setTimeout(() => {
            window.location.href = 'trades.html';
        }, 1500);
    }

    updateTradeBasketCounter() {
        const counter = document.getElementById('trade-basket-counter');
        if (counter) {
            if (this.tradeBasket.length > 0) {
                counter.textContent = this.tradeBasket.length;
                counter.classList.remove('hidden');
            } else {
                counter.classList.add('hidden');
            }
        }
    }

    bindTradeBasketButton() {
        const tradeBasketBtn = document.getElementById('trade-basket-btn');
        if (tradeBasketBtn) {
            tradeBasketBtn.addEventListener('click', () => {
                window.location.href = 'trades.html';
            });
        }
    }

    showCardDetails(listing) {
        this.selectedCard = listing;
        const modal = document.getElementById('card-details-modal');
        if (modal) {
            this.populateCardDetailsModal(listing);
            modal.classList.remove('hidden');
        }
    }

    populateCardDetailsModal(listing) {
        const cardData = listing.cardData || listing;
        const sellerData = listing.sellerData || {};

        // Update modal content
        const elements = {
            'modal-card-image': cardData.image_uris?.normal || cardData.image_uris?.large || cardData.images?.large || cardData.imageUrl,
            'modal-card-name': cardData.name || 'Unknown Card',
            'modal-card-set': cardData.set_name || cardData.set || 'Unknown Set',
            'modal-card-price': convertAndFormat ? convertAndFormat(listing.price || 0, 'USD') : `$${(listing.price || 0).toFixed(2)}`,
            'modal-card-condition': cardData.condition || 'Unknown',
            'modal-seller-name': sellerData.displayName || 'Unknown Seller'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'modal-card-image') {
                    element.src = value;
                    element.onerror = () => element.src = 'https://via.placeholder.com/223x310?text=No+Image';
                } else {
                    element.textContent = value;
                }
            }
        });

        // Update foil indicator
        const foilIndicator = document.getElementById('modal-card-foil');
        if (foilIndicator) {
            foilIndicator.classList.toggle('hidden', !cardData.foil);
        }
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredListings.length / this.itemsPerPage);
        
        // Update page info
        const pageInfo = document.getElementById('page-info');
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        }

        // Update buttons
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
            prevBtn.classList.toggle('opacity-50', this.currentPage === 1);
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
            nextBtn.classList.toggle('opacity-50', this.currentPage === totalPages || totalPages === 0);
        }
    }

    changePage(direction) {
        const totalPages = Math.ceil(this.filteredListings.length / this.itemsPerPage);
        const newPage = this.currentPage + direction;

        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.updateDisplay();
            
            // Scroll to top of grid
            const grid = document.getElementById('marketplace-grid');
            if (grid) {
                grid.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    updateStats() {
        const totalListings = document.getElementById('total-listings');
        const avgPrice = document.getElementById('avg-price');

        if (totalListings) {
            totalListings.textContent = this.filteredListings.length;
        }

        if (avgPrice && this.filteredListings.length > 0) {
            const total = this.filteredListings.reduce((sum, listing) => sum + (listing.price || 0), 0);
            const average = total / this.filteredListings.length;
            avgPrice.textContent = convertAndFormat ? convertAndFormat(average) : `$${average.toFixed(2)}`;
        } else if (avgPrice) {
            avgPrice.textContent = convertAndFormat ? convertAndFormat(0) : '$0.00';
        }
    }

    clearFilters() {
        // Clear specific filter elements
        const filterIds = [
            'filter-name',
            'condition-filter',
            'min-price',
            'max-price',
            'rarity-filter',
            'location-filter',
            'set-filter',
            'sort-filter'
        ];

        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = false;
                } else {
                    element.value = '';
                }
            }
        });

        // Clear game checkboxes
        const gameCheckboxes = document.querySelectorAll('#game-filter-container input[type="checkbox"]');
        gameCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        // Reset game-specific filters
        this.toggleGameSpecificFilters();
        
        // Reapply filters
        this.applyFilters();
    }

    setViewMode(mode) {
        const grid = document.getElementById('marketplace-grid');
        const gridToggle = document.getElementById('view-toggle-grid');
        const listToggle = document.getElementById('view-toggle-list');

        if (mode === 'grid') {
            grid?.classList.remove('list-view');
            grid?.classList.add('grid-view');
            gridToggle?.classList.add('bg-blue-600', 'text-white');
            gridToggle?.classList.remove('bg-gray-300', 'text-gray-700');
            listToggle?.classList.remove('bg-blue-600', 'text-white');
            listToggle?.classList.add('bg-gray-300', 'text-gray-700');
        } else {
            grid?.classList.remove('grid-view');
            grid?.classList.add('list-view');
            listToggle?.classList.add('bg-blue-600', 'text-white');
            listToggle?.classList.remove('bg-gray-300', 'text-gray-700');
            gridToggle?.classList.remove('bg-blue-600', 'text-white');
            gridToggle?.classList.add('bg-gray-300', 'text-gray-700');
        }

        localStorage.setItem('marketplaceViewMode', mode);
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    showToast(message, type = 'info') {
        if (window.Toastify) {
            const backgrounds = {
                success: "linear-gradient(to right, #10b981, #059669)",
                error: "linear-gradient(to right, #ef4444, #dc2626)",
                warning: "linear-gradient(to right, #f59e0b, #d97706)",
                info: "linear-gradient(to right, #3b82f6, #2563eb)"
            };

            Toastify({
                text: message,
                duration: 3000,
                style: { background: backgrounds[type] || backgrounds.info }
            }).showToast();
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    async handleAddToCollection(e) {
        e.preventDefault();
        
        if (!this.currentUser) {
            this.showToast('Please log in to add cards to your collection', 'error');
            return;
        }

        if (!this.selectedCard) {
            this.showToast('No card selected', 'error');
            return;
        }

        const formData = new FormData(e.target);
        const collectionData = {
            cardData: this.selectedCard.cardData || this.selectedCard,
            quantity: parseInt(formData.get('quantity')) || 1,
            condition: formData.get('condition') || 'Near Mint',
            isGraded: formData.get('graded') === 'on',
            gradingCompany: formData.get('grading-company') || null,
            grade: formData.get('grade') || null,
            notes: formData.get('notes') || '',
            addedAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: this.currentUser.uid
        };

        try {
            await this.db.collection('userCollections').add(collectionData);
            this.showToast('Card added to your collection!', 'success');
            this.closeModal('add-to-collection-modal');
            e.target.reset();
        } catch (error) {
            console.error('Error adding to collection:', error);
            this.showToast('Failed to add card to collection', 'error');
        }
    }

    handleContactSeller() {
        if (!this.currentUser) {
            this.showToast('Please log in to contact sellers', 'error');
            return;
        }

        if (!this.selectedCard || !this.selectedCard.sellerData) {
            this.showToast('Seller information not available', 'error');
            return;
        }

        // Implement messaging functionality here
        // This would typically open a messaging modal or redirect to messages page
        this.showToast('Messaging feature coming soon!', 'info');
    }

    // ADDED: Start trade functionality
    handleStartTrade() {
        if (!this.currentUser) {
            this.showToast('Please log in to start a trade', 'error');
            return;
        }

        if (!this.selectedCard || !this.selectedCard.sellerData) {
            this.showToast('Seller information not available', 'error');
            return;
        }

        // Add the card to trade basket
        this.addCardToTradeBasket(this.selectedCard);

        // Store the selected seller information for the trade
        const tradeData = {
            selectedCard: this.selectedCard,
            selectedSeller: this.selectedCard.sellerData,
            timestamp: Date.now()
        };
        localStorage.setItem('pendingTrade', JSON.stringify(tradeData));

        // Close the modal and redirect to trades page
        this.closeModal('card-detail-modal');
        
        // Show success message
        this.showToast('Card added to trade! Redirecting to trades page...', 'success');
        
        // Redirect after a short delay
        setTimeout(() => {
            window.location.href = 'trades.html?seller=' + encodeURIComponent(this.selectedCard.sellerData.uid);
        }, 1500);
    }
}

// Initialize the marketplace manager
const marketplaceManager = new MarketplaceManager();
