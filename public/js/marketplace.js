/**
 * Enhanced Marketplace Module
 * Handles marketplace listings display, filtering, and card addition to collection
 * Uses auth.js and messenger.js for authentication and messaging functionality
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

        // Other filters
        const filterElements = [
            'condition-filter', 'min-price', 'max-price', 'sort-filter',
            'mtg-type-filter', 'pokemon-type-filter', 'pokemon-graded-filter',
            'lorcana-graded-filter', 'gundam-series-filter'
        ];

        filterElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => this.applyFilters());
                element.addEventListener('input', () => this.applyFilters());
            }
        });

        // Clear filters
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
                    <i class="fas fa-search text-4xl mb-4"></i>
                    <h3 class="text-xl font-semibold mb-2">No listings found</h3>
                    <p>Try adjusting your filters or search terms</p>
                </div>
            `;
            return;
        }

        // Render cards
        pageListings.forEach(listing => {
            const cardElement = this.createCardElement(listing);
            grid.appendChild(cardElement);
        });

        this.updatePagination();
    }

    createCardElement(listing) {
        const cardData = listing.cardData || listing;
        const sellerData = listing.sellerData || { displayName: 'Unknown Seller' };
        
        const cardDiv = document.createElement('div');
        cardDiv.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer';
        cardDiv.addEventListener('click', () => this.openCardModal(listing));

        const imageUrl = this.getCardImageUrl(cardData);
        const condition = this.formatCondition(cardData.condition || 'unknown');
        const price = this.formatPrice(listing.price || 0);
        const game = this.getGameDisplayName(cardData.game || 'unknown');

        cardDiv.innerHTML = `
            <div class="aspect-w-3 aspect-h-4 relative">
                <img src="${imageUrl}" alt="${cardData.name || 'Card'}" 
                     class="w-full h-48 object-cover rounded-t-lg"
                     onerror="this.src='https://via.placeholder.com/300x400?text=No+Image'">
                ${cardData.isFoil || cardData.is_foil ? '<div class="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold">FOIL</div>' : ''}
                ${cardData.isGraded ? '<div class="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">GRADED</div>' : ''}
            </div>
            <div class="p-4">
                <h3 class="font-semibold text-lg mb-2 line-clamp-2">${cardData.name || 'Unknown Card'}</h3>
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">${game}</span>
                    <span class="text-sm text-gray-600 dark:text-gray-400">${condition}</span>
                </div>
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm text-gray-600 dark:text-gray-400">${cardData.set_name || cardData.set || 'Unknown Set'}</span>
                    <span class="font-bold text-lg text-green-600">${price}</span>
                </div>
                <div class="flex items-center text-sm text-gray-500">
                    <img src="${sellerData.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(sellerData.displayName || 'U') + '&background=random&color=fff'}" 
                         alt="${sellerData.displayName}" class="w-6 h-6 rounded-full mr-2">
                    <span>${sellerData.displayName || 'Unknown Seller'}</span>
                </div>
            </div>
        `;

        return cardDiv;
    }

    getCardImageUrl(cardData) {
        if (cardData.image_uris?.normal) return cardData.image_uris.normal;
        if (cardData.image_uris?.large) return cardData.image_uris.large;
        if (cardData.images?.normal) return cardData.images.normal;
        if (cardData.images?.large) return cardData.images.large;
        if (cardData.imageUrl) return cardData.imageUrl;
        return 'https://via.placeholder.com/300x400?text=No+Image';
    }

    formatCondition(condition) {
        const conditionMap = {
            'mint': 'Mint',
            'near_mint': 'Near Mint',
            'excellent': 'Excellent',
            'good': 'Good',
            'light_played': 'Light Played',
            'played': 'Played',
            'poor': 'Poor'
        };
        return conditionMap[condition] || condition.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatPrice(price) {
        // Use the currency converter from currency.js module if available
        if (window.convertAndFormat) {
            return window.convertAndFormat(price);
        }
        
        // Fallback to USD formatting
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price);
    }

    getGameDisplayName(game) {
        const gameMap = {
            'mtg': 'Magic: The Gathering',
            'pokemon': 'Pokémon',
            'lorcana': 'Lorcana',
            'gundam': 'Gundam'
        };
        return gameMap[game.toLowerCase()] || game;
    }

    openCardModal(listing) {
        this.selectedCard = listing;
        const modal = document.getElementById('card-detail-modal');
        if (!modal) return;

        const cardData = listing.cardData || listing;
        const sellerData = listing.sellerData || { displayName: 'Unknown Seller' };

        // Update modal content
        document.getElementById('modal-card-name').textContent = cardData.name || 'Unknown Card';
        document.getElementById('modal-card-image').src = this.getCardImageUrl(cardData);

        // Card details
        const detailsContainer = document.getElementById('modal-card-details');
        detailsContainer.innerHTML = `
            <div class="space-y-3">
                <div class="flex justify-between">
                    <span class="font-medium">Price:</span>
                    <span class="text-xl font-bold text-green-600">${this.formatPrice(listing.price || 0)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="font-medium">Game:</span>
                    <span>${this.getGameDisplayName(cardData.game || 'unknown')}</span>
                </div>
                <div class="flex justify-between">
                    <span class="font-medium">Set:</span>
                    <span>${cardData.set_name || cardData.set || 'Unknown'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="font-medium">Condition:</span>
                    <span>${this.formatCondition(cardData.condition || 'unknown')}</span>
                </div>
                ${cardData.collector_number ? `
                <div class="flex justify-between">
                    <span class="font-medium">Collector #:</span>
                    <span>${cardData.collector_number}</span>
                </div>` : ''}
                ${cardData.rarity ? `
                <div class="flex justify-between">
                    <span class="font-medium">Rarity:</span>
                    <span>${cardData.rarity}</span>
                </div>` : ''}
                <div class="flex justify-between">
                    <span class="font-medium">Foil:</span>
                    <span>${cardData.isFoil || cardData.is_foil ? 'Yes' : 'No'}</span>
                </div>
                ${cardData.isGraded ? `
                <div class="flex justify-between">
                    <span class="font-medium">Graded:</span>
                    <span>${cardData.gradingCompany || 'Unknown'} ${cardData.grade || 'N/A'}</span>
                </div>` : ''}
                <div class="flex justify-between">
                    <span class="font-medium">Listed:</span>
                    <span>${listing.listedAt ? listing.listedAt.toLocaleDateString() : 'Unknown'}</span>
                </div>
            </div>
        `;

        // Seller info
        const sellerContainer = document.getElementById('modal-seller-info');
        sellerContainer.innerHTML = `
            <div class="flex items-center space-x-3">
                <img src="${sellerData.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(sellerData.displayName || 'U') + '&background=random&color=fff'}" 
                     alt="${sellerData.displayName}" class="w-12 h-12 rounded-full">
                <div>
                    <p class="font-semibold">${sellerData.displayName || 'Unknown Seller'}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">${sellerData.country || 'Unknown Location'}</p>
                </div>
            </div>
        `;

        this.openModal('card-detail-modal');
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
        const cardData = this.selectedCard.cardData || this.selectedCard;
        
        const collectionCard = {
            ...cardData,
            quantity: parseInt(formData.get('quantity') || 1),
            condition: formData.get('condition') || 'near_mint',
            purchasePrice: parseFloat(formData.get('purchase-price')) || null,
            isFoil: formData.has('foil'),
            isGraded: formData.has('graded'),
            gradingCompany: formData.has('graded') ? formData.get('grading-company') : null,
            grade: formData.has('graded') ? formData.get('grade') : null,
            notes: formData.get('notes') || '',
            addedAt: firebase.firestore.FieldValue.serverTimestamp(),
            addedFrom: 'marketplace',
            originalListingId: this.selectedCard.id
        };

        try {
            await this.db.collection('users')
                .doc(this.currentUser.uid)
                .collection('collection')
                .add(collectionCard);

            this.showToast('Card added to your collection!', 'success');
            this.closeModal('add-collection-modal');
            this.closeModal('card-detail-modal');
            
        } catch (error) {
            console.error('Error adding card to collection:', error);
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

        const sellerData = this.selectedCard.sellerData;
        const cardData = this.selectedCard.cardData || this.selectedCard;
        
        // Use the global messenger function from messenger.js
        if (window.openNewConversationModal) {
            window.openNewConversationModal(false, (userId, userData) => {
                // Pre-fill message about the card
                const messageText = `Hi! I'm interested in your ${cardData.name || 'card'} listed for ${this.formatPrice(this.selectedCard.price || 0)}. Is it still available?`;
                console.log('Starting conversation with seller:', userData.displayName, 'Message:', messageText);
            });
        } else {
            this.showToast('Messaging system not available', 'error');
        }
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredListings.length / this.itemsPerPage);
        const pageInfo = document.getElementById('page-info');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        }

        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
    }

    changePage(direction) {
        const totalPages = Math.ceil(this.filteredListings.length / this.itemsPerPage);
        const newPage = this.currentPage + direction;
        
        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.updateDisplay();
            
            // Scroll to top
            document.getElementById('marketplace-display')?.scrollTo(0, 0);
        }
    }

    updateStats() {
        const totalListings = this.filteredListings.length;
        const avgPrice = totalListings > 0 ? 
            this.filteredListings.reduce((sum, listing) => sum + (listing.price || 0), 0) / totalListings : 0;
        
        const prices = this.filteredListings.map(listing => listing.price || 0).filter(p => p > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

        const statsElements = {
            'stats-total-listings': totalListings.toString(),
            'stats-avg-price': this.formatPrice(avgPrice),
            'stats-price-range': `${this.formatPrice(minPrice)} - ${this.formatPrice(maxPrice)}`
        };

        Object.entries(statsElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    clearFilters() {
        // Clear all filter inputs
        const searchBar = document.getElementById('main-search-bar');
        const filterName = document.getElementById('filter-name');
        
        if (searchBar) searchBar.value = '';
        if (filterName) filterName.value = '';
        
        const conditionFilter = document.getElementById('condition-filter');
        const minPrice = document.getElementById('min-price');
        const maxPrice = document.getElementById('max-price');
        const sortFilter = document.getElementById('sort-filter');
        
        if (conditionFilter) conditionFilter.value = '';
        if (minPrice) minPrice.value = '';
        if (maxPrice) maxPrice.value = '';
        if (sortFilter) sortFilter.value = 'newest';

        // Uncheck all game filters
        document.querySelectorAll('#game-filter-container input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Clear game-specific filters
        const mtgTypeFilter = document.getElementById('mtg-type-filter');
        const pokemonTypeFilter = document.getElementById('pokemon-type-filter');
        const pokemonGradedFilter = document.getElementById('pokemon-graded-filter');
        const lorcanaGradedFilter = document.getElementById('lorcana-graded-filter');
        const gundamSeriesFilter = document.getElementById('gundam-series-filter');
        
        if (mtgTypeFilter) mtgTypeFilter.value = '';
        if (pokemonTypeFilter) pokemonTypeFilter.value = '';
        if (pokemonGradedFilter) pokemonGradedFilter.checked = false;
        if (lorcanaGradedFilter) lorcanaGradedFilter.checked = false;
        if (gundamSeriesFilter) gundamSeriesFilter.value = '';

        // Hide game-specific filter sections
        this.toggleGameSpecificFilters();

        // Reapply filters (which will show all items)
        this.applyFilters();
    }

    setViewMode(mode) {
        const gridToggle = document.getElementById('view-toggle-grid');
        const listToggle = document.getElementById('view-toggle-list');
        const grid = document.getElementById('marketplace-grid');

        if (mode === 'grid') {
            gridToggle?.classList.add('bg-white', 'dark:bg-gray-900', 'shadow');
            gridToggle?.classList.remove('text-gray-500', 'dark:text-gray-400');
            listToggle?.classList.remove('bg-white', 'dark:bg-gray-900', 'shadow');
            listToggle?.classList.add('text-gray-500', 'dark:text-gray-400');
            
            if (grid) {
                grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';
            }
        } else {
            listToggle?.classList.add('bg-white', 'dark:bg-gray-900', 'shadow');
            listToggle?.classList.remove('text-gray-500', 'dark:text-gray-400');
            gridToggle?.classList.remove('bg-white', 'dark:bg-gray-900', 'shadow');
            gridToggle?.classList.add('text-gray-500', 'dark:text-gray-400');
            
            if (grid) {
                grid.className = 'space-y-4';
            }
        }
        
        this.updateDisplay();
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`Toast (${type}): ${message}`);
        }
    }
}

// Initialize the marketplace when the script loads
window.marketplaceManager = new MarketplaceManager();
