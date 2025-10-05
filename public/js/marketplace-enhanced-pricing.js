/**
 * Enhanced Marketplace Script with Price Conditions and Foil/Holo Support
 * 
 * Features:
 * - Multiple price conditions (Near Mint, Lightly Played, Moderately Played, Heavily Played, Damaged)
 * - Foil/Holo visual indicators
 * - Search results show both normal and foil/holo prices
 * - Marketplace listings show only the specific price for the listed card
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

// Card condition definitions
const CARD_CONDITIONS = {
    'near_mint': { label: 'Near Mint', shortLabel: 'NM', multiplier: 1.0 },
    'lightly_played': { label: 'Lightly Played', shortLabel: 'LP', multiplier: 0.85 },
    'moderately_played': { label: 'Moderately Played', shortLabel: 'MP', multiplier: 0.70 },
    'heavily_played': { label: 'Heavily Played', shortLabel: 'HP', multiplier: 0.55 },
    'damaged': { label: 'Damaged', shortLabel: 'DMG', multiplier: 0.40 }
};

class EnhancedMarketplaceManager {
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
        console.log('Initializing Enhanced Marketplace Manager...');

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
        this.enhanceConditionFilter();
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

    enhanceConditionFilter() {
        const conditionFilter = document.getElementById('condition-filter');
        if (conditionFilter) {
            // Clear existing options
            conditionFilter.innerHTML = '<option value="">All Conditions</option>';
            
            // Add condition options
            Object.entries(CARD_CONDITIONS).forEach(([key, condition]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = condition.label;
                conditionFilter.appendChild(option);
            });
        }
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

        // Filter events
        const gameFilters = document.querySelectorAll('[data-game]');
        gameFilters.forEach(filter => {
            filter.addEventListener('change', () => this.applyFilters());
        });

        const conditionFilter = document.getElementById('condition-filter');
        if (conditionFilter) {
            conditionFilter.addEventListener('change', () => this.applyFilters());
        }

        const minPrice = document.getElementById('min-price');
        const maxPrice = document.getElementById('max-price');
        if (minPrice) minPrice.addEventListener('input', () => this.applyFilters());
        if (maxPrice) maxPrice.addEventListener('input', () => this.applyFilters());

        const rarityFilter = document.getElementById('rarity-filter');
        if (rarityFilter) {
            rarityFilter.addEventListener('change', () => this.applyFilters());
        }

        // Continent filters
        const continentFilters = document.querySelectorAll('[id^="continent-"]');
        continentFilters.forEach(filter => {
            filter.addEventListener('change', () => this.applyFilters());
        });

        // Pagination
        const prevBtn = document.querySelector('.pagination-btn[data-direction="prev"]');
        const nextBtn = document.querySelector('.pagination-btn[data-direction="next"]');
        
        if (prevBtn) prevBtn.addEventListener('click', () => this.changePage(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.changePage(1));
    }

    async loadMarketplaceData() {
        try {
            console.log('Loading marketplace data...');
            
            // Load from Firestore
            const marketplaceRef = this.db.collection('marketplace');
            const snapshot = await marketplaceRef.get();
            
            this.allListings = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                this.allListings.push({
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp?.toDate() || new Date()
                });
            });

            console.log(`Loaded ${this.allListings.length} marketplace listings`);
            this.filteredListings = [...this.allListings];
            
        } catch (error) {
            console.error('Error loading marketplace data:', error);
            this.allListings = [];
            this.filteredListings = [];
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
                           document.getElementById('filter-name')?.value || '').toLowerCase();
        
        if (searchQuery) {
            filtered = filtered.filter(listing => 
                listing.cardName?.toLowerCase().includes(searchQuery) ||
                listing.setName?.toLowerCase().includes(searchQuery) ||
                listing.sellerName?.toLowerCase().includes(searchQuery)
            );
        }

        // Game filter
        const selectedGames = Array.from(document.querySelectorAll('[data-game]:checked'))
            .map(cb => cb.dataset.game);
        
        if (selectedGames.length > 0) {
            filtered = filtered.filter(listing => 
                selectedGames.includes(listing.game?.toLowerCase())
            );
        }

        // Condition filter
        const selectedCondition = document.getElementById('condition-filter')?.value;
        if (selectedCondition) {
            filtered = filtered.filter(listing => listing.condition === selectedCondition);
        }

        // Price range filter
        const minPrice = parseFloat(document.getElementById('min-price')?.value || 0);
        const maxPrice = parseFloat(document.getElementById('max-price')?.value || Infinity);
        
        filtered = filtered.filter(listing => {
            const price = parseFloat(listing.price || 0);
            return price >= minPrice && price <= maxPrice;
        });

        // Rarity filter
        const selectedRarity = document.getElementById('rarity-filter')?.value;
        if (selectedRarity) {
            filtered = filtered.filter(listing => 
                listing.rarity?.toLowerCase() === selectedRarity.toLowerCase()
            );
        }

        // Continent filter
        const selectedContinents = Array.from(document.querySelectorAll('[id^="continent-"]:checked'))
            .map(cb => cb.value);
        
        if (selectedContinents.length > 0) {
            filtered = filtered.filter(listing => 
                selectedContinents.includes(listing.continent?.toLowerCase())
            );
        }

        this.filteredListings = filtered;
        this.currentPage = 1;
        this.updateDisplay();
    }

    updateDisplay() {
        this.updateStatistics();
        this.renderListings();
        this.updatePagination();
    }

    updateStatistics() {
        const totalListings = this.filteredListings.length;
        const prices = this.filteredListings.map(l => parseFloat(l.price || 0)).filter(p => p > 0);
        const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

        // Update statistics display
        const statsElements = {
            'stats-total-listings': totalListings,
            'stats-avg-price': convertAndFormat ? convertAndFormat({ usd: avgPrice }) : `$${avgPrice.toFixed(2)}`,
            'stats-price-range': convertAndFormat ? 
                `${convertAndFormat({ usd: minPrice })} - ${convertAndFormat({ usd: maxPrice })}` :
                `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`
        };

        Object.entries(statsElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    renderListings() {
        const container = document.getElementById('marketplace-listings');
        if (!container) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageListings = this.filteredListings.slice(startIndex, endIndex);

        if (pageListings.length === 0) {
            container.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                    <i class="fas fa-search text-6xl mb-4 opacity-50"></i>
                    <h3 class="text-xl font-semibold mb-2">No listings found</h3>
                    <p>Try adjusting your search or filters</p>
                </div>
            `;
            return;
        }

        container.innerHTML = pageListings.map(listing => this.renderListingCard(listing)).join('');
        
        // Bind card events
        this.bindCardEvents();
    }

    renderListingCard(listing) {
        const foilClass = listing.is_foil ? 'foil-effect' : '';
        const foilIndicator = listing.is_foil ? this.getFoilIndicator(listing.game) : '';
        const conditionInfo = CARD_CONDITIONS[listing.condition] || { label: 'Unknown', shortLabel: '?' };
        
        const priceDisplay = convertAndFormat ? 
            convertAndFormat({ usd: listing.price }) : 
            `$${parseFloat(listing.price || 0).toFixed(2)}`;

        return `
            <div class="marketplace-card bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden relative group cursor-pointer"
                 data-listing-id="${listing.id}">
                
                <!-- Foil/Holo Indicator -->
                ${foilIndicator}
                
                <!-- Add to Trade Button (appears on hover) -->
                <button class="add-to-trade-btn absolute top-2 right-2 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                        data-listing-id="${listing.id}"
                        title="Add to Trade">
                    <i class="fas fa-plus text-sm"></i>
                </button>

                <div class="relative ${foilClass}">
                    <img src="${listing.imageUrl || 'https://via.placeholder.com/200x280?text=No+Image'}" 
                         alt="${listing.cardName}" 
                         class="w-full h-48 object-cover"
                         onerror="this.src='https://via.placeholder.com/200x280?text=No+Image'">
                    
                    <!-- Condition Badge -->
                    <div class="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs font-semibold">
                        ${conditionInfo.shortLabel}
                    </div>
                </div>

                <div class="p-4">
                    <h3 class="font-semibold text-lg mb-1 text-gray-900 dark:text-white truncate">
                        ${listing.cardName || 'Unknown Card'}
                    </h3>
                    
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        ${listing.setName || 'Unknown Set'}
                    </p>
                    
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm text-gray-500 dark:text-gray-400">
                            ${conditionInfo.label}
                        </span>
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                            ${listing.game?.toUpperCase() || 'TCG'}
                        </span>
                    </div>

                    <div class="flex justify-between items-center">
                        <div class="text-right">
                            <p class="text-xl font-bold text-green-600 dark:text-green-400">
                                ${priceDisplay}
                            </p>
                        </div>
                        <div class="text-right">
                            <p class="text-sm text-gray-500 dark:text-gray-400">
                                by ${listing.sellerName || 'Unknown'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getFoilIndicator(game) {
        const isMtg = game?.toLowerCase() === 'mtg' || game?.toLowerCase() === 'magic';
        const isPokemon = game?.toLowerCase() === 'pokemon' || game?.toLowerCase() === 'pokémon';
        
        let label = 'Foil';
        if (isPokemon) {
            label = 'Holo';
        }
        
        return `
            <div class="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                <i class="fas fa-star mr-1"></i>${label}
            </div>
        `;
    }

    bindCardEvents() {
        // Card click events
        document.querySelectorAll('.marketplace-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.add-to-trade-btn')) {
                    const listingId = card.dataset.listingId;
                    this.openCardModal(listingId);
                }
            });
        });

        // Add to trade button events
        document.querySelectorAll('.add-to-trade-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const listingId = btn.dataset.listingId;
                this.addToTradeBasket(listingId);
            });
        });
    }

    addToTradeBasket(listingId) {
        const listing = this.allListings.find(l => l.id === listingId);
        if (!listing) return;

        // Check if already in basket
        if (this.tradeBasket.some(item => item.id === listingId)) {
            this.showToast('Card already in trade basket', 'info');
            return;
        }

        this.tradeBasket.push({
            id: listingId,
            cardName: listing.cardName,
            price: listing.price,
            imageUrl: listing.imageUrl,
            sellerName: listing.sellerName,
            condition: listing.condition,
            is_foil: listing.is_foil,
            game: listing.game
        });

        localStorage.setItem('tradeBasket', JSON.stringify(this.tradeBasket));
        this.updateTradeBasketCounter();
        this.showToast('Added to trade basket', 'success');
    }

    updateTradeBasketCounter() {
        const counter = document.getElementById('trade-basket-counter');
        if (counter) {
            const count = this.tradeBasket.length;
            counter.textContent = count;
            counter.classList.toggle('hidden', count === 0);
        }
    }

    bindTradeBasketButton() {
        const basketBtn = document.getElementById('trade-basket-btn');
        if (basketBtn) {
            basketBtn.addEventListener('click', () => {
                window.location.href = 'trades.html';
            });
        }
    }

    openCardModal(listingId) {
        const listing = this.allListings.find(l => l.id === listingId);
        if (!listing) return;

        // Create and show modal with card details
        this.showCardModal(listing);
    }

    showCardModal(listing) {
        const conditionInfo = CARD_CONDITIONS[listing.condition] || { label: 'Unknown' };
        const foilLabel = this.getFoilLabel(listing.game);
        
        const modalHTML = `
            <div id="card-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                                ${listing.cardName}
                            </h2>
                            <button id="close-card-modal" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                        
                        <div class="grid md:grid-cols-2 gap-6">
                            <div class="relative ${listing.is_foil ? 'foil-effect' : ''}">
                                <img src="${listing.imageUrl || 'https://via.placeholder.com/300x420?text=No+Image'}" 
                                     alt="${listing.cardName}" 
                                     class="w-full rounded-lg shadow-md"
                                     onerror="this.src='https://via.placeholder.com/300x420?text=No+Image'">
                                ${listing.is_foil ? `
                                    <div class="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                                        <i class="fas fa-star mr-1"></i>${foilLabel}
                                    </div>
                                ` : ''}
                            </div>
                            
                            <div class="space-y-4">
                                <div>
                                    <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Card Details</h3>
                                    <div class="space-y-2 text-sm">
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Set:</span>
                                            <span class="font-medium">${listing.setName || 'Unknown'}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Game:</span>
                                            <span class="font-medium">${listing.game?.toUpperCase() || 'TCG'}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Condition:</span>
                                            <span class="font-medium">${conditionInfo.label}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Rarity:</span>
                                            <span class="font-medium">${listing.rarity || 'Unknown'}</span>
                                        </div>
                                        ${listing.is_foil ? `
                                            <div class="flex justify-between">
                                                <span class="text-gray-600 dark:text-gray-400">Finish:</span>
                                                <span class="font-medium text-yellow-600">${foilLabel}</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Seller Information</h3>
                                    <div class="space-y-2 text-sm">
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Seller:</span>
                                            <span class="font-medium">${listing.sellerName || 'Unknown'}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Location:</span>
                                            <span class="font-medium">${listing.continent || 'Unknown'}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="border-t pt-4">
                                    <div class="flex justify-between items-center mb-4">
                                        <span class="text-xl font-bold text-gray-900 dark:text-white">Price:</span>
                                        <span class="text-2xl font-bold text-green-600 dark:text-green-400">
                                            ${convertAndFormat ? convertAndFormat({ usd: listing.price }) : `$${parseFloat(listing.price || 0).toFixed(2)}`}
                                        </span>
                                    </div>
                                    
                                    <div class="flex space-x-2">
                                        <button class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                            Contact Seller
                                        </button>
                                        <button class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                                onclick="window.enhancedMarketplace.addToTradeBasket('${listing.id}')">
                                            Add to Trade
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Bind close event
        document.getElementById('close-card-modal').addEventListener('click', () => {
            document.getElementById('card-modal').remove();
        });
        
        // Close on backdrop click
        document.getElementById('card-modal').addEventListener('click', (e) => {
            if (e.target.id === 'card-modal') {
                document.getElementById('card-modal').remove();
            }
        });
    }

    getFoilLabel(game) {
        const isPokemon = game?.toLowerCase() === 'pokemon' || game?.toLowerCase() === 'pokémon';
        return isPokemon ? 'Holo' : 'Foil';
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredListings.length / this.itemsPerPage);
        
        // Update pagination info
        const pageInfo = document.querySelector('.pagination-info');
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        }

        // Update pagination buttons
        const prevBtn = document.querySelector('.pagination-btn[data-direction="prev"]');
        const nextBtn = document.querySelector('.pagination-btn[data-direction="next"]');
        
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
    }

    changePage(direction) {
        const totalPages = Math.ceil(this.filteredListings.length / this.itemsPerPage);
        const newPage = this.currentPage + direction;
        
        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.renderListings();
            this.updatePagination();
            
            // Scroll to top of listings
            const container = document.getElementById('marketplace-listings');
            if (container) {
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg text-white shadow-lg transition-all duration-300 transform translate-x-full`;
        
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-blue-600',
            warning: 'bg-yellow-600'
        };
        
        toast.classList.add(colors[type] || colors.info);
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.remove('translate-x-full'), 10);
        
        // Animate out and remove
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize the enhanced marketplace manager
window.enhancedMarketplace = new EnhancedMarketplaceManager();
