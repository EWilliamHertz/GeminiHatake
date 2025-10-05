/**
 * Enhanced Collection Search with Foil/Holo and Condition-based Pricing
 * 
 * Features:
 * - Search results show both normal and foil/holo prices
 * - Card selection modal with condition and foil/holo options
 * - Dynamic price adjustment based on selections
 * - Integration with Scrydex pricing data
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

// Card condition definitions with multipliers
const CARD_CONDITIONS = {
    'near_mint': { label: 'Near Mint', shortLabel: 'NM', multiplier: 1.0 },
    'lightly_played': { label: 'Lightly Played', shortLabel: 'LP', multiplier: 0.85 },
    'moderately_played': { label: 'Moderately Played', shortLabel: 'MP', multiplier: 0.70 },
    'heavily_played': { label: 'Heavily Played', shortLabel: 'HP', multiplier: 0.55 },
    'damaged': { label: 'Damaged', shortLabel: 'DMG', multiplier: 0.40 }
};

// API configurations
const API_CONFIG = {
    pokemon: {
        baseUrl: 'https://api.pokemontcg.io/v2',
        apiKey: '60a08d4a-3a34-43d8-8f41-827b58cfac6d',
        headers: {
            'X-Api-Key': '60a08d4a-3a34-43d8-8f41-827b58cfac6d'
        }
    },
    mtg: {
        baseUrl: 'https://api.scryfall.com',
        headers: {}
    }
};

class EnhancedCollectionSearch {
    constructor() {
        this.searchTimeout = null;
        this.currentResults = [];
        this.selectedCard = null;
        this.isSearching = false;

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('Initializing Enhanced Collection Search...');
        this.enhanceSearchModal();
        this.bindEvents();
    }

    enhanceSearchModal() {
        // Find the search modal and enhance it
        const searchModal = document.getElementById('search-modal');
        if (!searchModal) return;

        // Add enhanced search results container
        const resultsContainer = document.getElementById('search-results-container');
        if (resultsContainer) {
            resultsContainer.className = 'max-h-96 overflow-y-auto space-y-2';
        }

        // Create card selection modal
        this.createCardSelectionModal();
    }

    createCardSelectionModal() {
        const modalHTML = `
            <div id="card-selection-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h2 id="card-selection-title" class="text-2xl font-bold text-gray-900 dark:text-white">
                                Select Card Details
                            </h2>
                            <button id="close-card-selection" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                        
                        <div class="grid md:grid-cols-2 gap-6">
                            <!-- Card Image -->
                            <div class="relative">
                                <img id="card-selection-image" 
                                     src="" 
                                     alt="Card Image" 
                                     class="w-full rounded-lg shadow-md">
                                <div id="card-selection-foil-indicator" class="absolute top-2 right-2 hidden">
                                    <!-- Foil indicator will be added dynamically -->
                                </div>
                            </div>
                            
                            <!-- Card Options -->
                            <div class="space-y-4">
                                <div>
                                    <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Card Information</h3>
                                    <div class="space-y-2 text-sm">
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Set:</span>
                                            <span id="card-selection-set" class="font-medium"></span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Game:</span>
                                            <span id="card-selection-game" class="font-medium"></span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Rarity:</span>
                                            <span id="card-selection-rarity" class="font-medium"></span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Finish Selection -->
                                <div id="finish-selection-container">
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Card Finish
                                    </label>
                                    <div class="space-y-2">
                                        <label class="flex items-center">
                                            <input type="radio" name="card-finish" value="normal" checked 
                                                   class="mr-2 text-blue-600 focus:ring-blue-500">
                                            <span>Normal</span>
                                            <span id="normal-price" class="ml-auto font-semibold text-green-600"></span>
                                        </label>
                                        <label id="foil-option" class="flex items-center hidden">
                                            <input type="radio" name="card-finish" value="foil" 
                                                   class="mr-2 text-blue-600 focus:ring-blue-500">
                                            <span id="foil-label">Foil</span>
                                            <span id="foil-price" class="ml-auto font-semibold text-yellow-600"></span>
                                        </label>
                                    </div>
                                </div>
                                
                                <!-- Condition Selection -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Card Condition
                                    </label>
                                    <select id="card-condition-select" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                                        ${Object.entries(CARD_CONDITIONS).map(([key, condition]) => 
                                            `<option value="${key}">${condition.label}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                
                                <!-- Quantity -->
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Quantity
                                    </label>
                                    <input type="number" id="card-quantity" min="1" value="1" 
                                           class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                                </div>
                                
                                <!-- Current Price Display -->
                                <div class="border-t pt-4">
                                    <div class="flex justify-between items-center mb-4">
                                        <span class="text-lg font-semibold text-gray-900 dark:text-white">Current Price:</span>
                                        <span id="current-card-price" class="text-2xl font-bold text-green-600 dark:text-green-400">
                                            $0.00
                                        </span>
                                    </div>
                                    
                                    <div class="flex space-x-2">
                                        <button id="add-card-to-collection" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                            Add to Collection
                                        </button>
                                        <button id="add-card-to-wishlist" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                            Add to Wishlist
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
        this.bindCardSelectionEvents();
    }

    bindEvents() {
        // Override the existing search input handler
        const searchInput = document.getElementById('card-search-input');
        if (searchInput) {
            // Remove existing event listeners
            searchInput.removeEventListener('input', window.handleSearchInput);
            
            // Add our enhanced search handler
            searchInput.addEventListener('input', (e) => {
                this.handleEnhancedSearch(e.target.value);
            });
        }

        // Override search result clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.enhanced-search-result')) {
                e.preventDefault();
                e.stopPropagation();
                const resultItem = e.target.closest('.enhanced-search-result');
                const cardData = JSON.parse(resultItem.dataset.card);
                this.showCardSelectionModal(cardData);
            }
        });
    }

    bindCardSelectionEvents() {
        // Close modal
        document.getElementById('close-card-selection').addEventListener('click', () => {
            this.hideCardSelectionModal();
        });

        // Finish selection change
        document.querySelectorAll('input[name="card-finish"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.updateCardPrice();
                this.updateFoilIndicator();
            });
        });

        // Condition selection change
        document.getElementById('card-condition-select').addEventListener('change', () => {
            this.updateCardPrice();
        });

        // Quantity change
        document.getElementById('card-quantity').addEventListener('input', () => {
            this.updateCardPrice();
        });

        // Add to collection
        document.getElementById('add-card-to-collection').addEventListener('click', () => {
            this.addCardToCollection();
        });

        // Add to wishlist
        document.getElementById('add-card-to-wishlist').addEventListener('click', () => {
            this.addCardToWishlist();
        });

        // Close on backdrop click
        document.getElementById('card-selection-modal').addEventListener('click', (e) => {
            if (e.target.id === 'card-selection-modal') {
                this.hideCardSelectionModal();
            }
        });
    }

    async handleEnhancedSearch(query) {
        clearTimeout(this.searchTimeout);
        
        const resultsContainer = document.getElementById('search-results-container');
        if (!resultsContainer) return;

        if (query.length < 3) {
            resultsContainer.innerHTML = '<p class="text-center text-gray-500">Enter at least 3 characters.</p>';
            return;
        }

        this.searchTimeout = setTimeout(async () => {
            await this.performEnhancedSearch(query);
        }, 300);
    }

    async performEnhancedSearch(query) {
        if (this.isSearching) return;
        
        this.isSearching = true;
        const resultsContainer = document.getElementById('search-results-container');
        const gameSelector = document.getElementById('game-selector');
        const selectedGame = gameSelector ? gameSelector.value : 'Magic: The Gathering';

        resultsContainer.innerHTML = '<p class="text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Searching cards...</p>';

        try {
            let results = [];
            
            // Search based on selected game
            if (selectedGame === 'Magic: The Gathering') {
                results = await this.searchMTG(query);
            } else if (selectedGame === 'Pokémon') {
                results = await this.searchPokemon(query);
            }

            this.currentResults = results;
            this.displayEnhancedResults();
        } catch (error) {
            console.error('Enhanced search error:', error);
            resultsContainer.innerHTML = '<p class="text-center text-red-500">Search failed. Please try again.</p>';
        } finally {
            this.isSearching = false;
        }
    }

    async searchPokemon(query) {
        try {
            const response = await fetch(
                `${API_CONFIG.pokemon.baseUrl}/cards?q=name:${encodeURIComponent(query)}*&pageSize=10`,
                { headers: API_CONFIG.pokemon.headers }
            );

            if (!response.ok) throw new Error('Pokemon API request failed');

            const data = await response.json();
            return data.data.map(card => this.formatPokemonCard(card));
        } catch (error) {
            console.error('Pokemon search error:', error);
            return [];
        }
    }

    async searchMTG(query) {
        try {
            const response = await fetch(
                `${API_CONFIG.mtg.baseUrl}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=name`,
                { headers: API_CONFIG.mtg.headers }
            );

            if (!response.ok) throw new Error('MTG API request failed');

            const data = await response.json();
            return data.data.slice(0, 10).map(card => this.formatMTGCard(card));
        } catch (error) {
            console.error('MTG search error:', error);
            return [];
        }
    }

    formatPokemonCard(card) {
        const prices = card.tcgplayer?.prices || {};
        const normalPrice = prices.normal?.market || prices.normal?.mid || 0;
        const holoPrice = prices.holofoil?.market || prices.holofoil?.mid || 0;

        return {
            id: card.id,
            name: card.name,
            game: 'pokemon',
            set_name: card.set?.name || 'Unknown Set',
            collector_number: card.number || '',
            rarity: card.rarity,
            imageUrl: card.images?.small || card.images?.large,
            prices: {
                normal: normalPrice,
                foil: holoPrice,
                usd: normalPrice // For compatibility with existing code
            },
            hasVariants: normalPrice > 0 && holoPrice > 0,
            // Additional data for collection
            api_id: card.id,
            set_id: card.set?.id,
            tcgplayer_id: card.tcgplayer?.productId
        };
    }

    formatMTGCard(card) {
        const normalPrice = card.prices?.usd ? parseFloat(card.prices.usd) : 0;
        const foilPrice = card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : 0;

        return {
            id: card.id,
            name: card.name,
            game: 'mtg',
            set_name: card.set_name || 'Unknown Set',
            collector_number: card.collector_number || '',
            rarity: card.rarity,
            imageUrl: card.image_uris?.small || card.image_uris?.normal,
            prices: {
                normal: normalPrice,
                foil: foilPrice,
                usd: normalPrice // For compatibility with existing code
            },
            hasVariants: normalPrice > 0 && foilPrice > 0,
            // Additional data for collection
            api_id: card.id,
            set_id: card.set,
            scryfall_id: card.id
        };
    }

    displayEnhancedResults() {
        const resultsContainer = document.getElementById('search-results-container');
        
        if (this.currentResults.length === 0) {
            resultsContainer.innerHTML = '<p class="text-center text-gray-500">No cards found.</p>';
            return;
        }

        resultsContainer.innerHTML = this.currentResults.map(card => this.renderEnhancedResult(card)).join('');
    }

    renderEnhancedResult(card) {
        const foilLabel = card.game === 'pokemon' ? 'Holo' : 'Foil';
        const gameLabel = card.game === 'pokemon' ? 'Pokémon' : 'MTG';
        
        // Format prices for display
        const normalPrice = convertAndFormat ? 
            convertAndFormat({ usd: card.prices.normal }) : 
            `$${card.prices.normal.toFixed(2)}`;
        
        const foilPrice = convertAndFormat ? 
            convertAndFormat({ usd: card.prices.foil }) : 
            `$${card.prices.foil.toFixed(2)}`;

        // Escape card data for HTML attribute
        const cardDataJson = JSON.stringify(card);
        const escapedCardData = cardDataJson
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return `
            <div class="enhanced-search-result flex items-center p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border border-gray-200 dark:border-gray-600"
                 data-card='${escapedCardData}'>
                
                <div class="flex-shrink-0 mr-4">
                    <img src="${card.imageUrl || 'https://via.placeholder.com/60x84?text=No+Image'}" 
                         alt="${card.name}" 
                         class="w-12 h-16 object-cover rounded shadow-sm"
                         onerror="this.src='https://via.placeholder.com/60x84?text=No+Image'">
                </div>
                
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                        <h3 class="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            ${card.name} ${card.collector_number ? `(${card.collector_number})` : ''}
                        </h3>
                        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded ml-2">
                            ${gameLabel}
                        </span>
                    </div>
                    
                    <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        ${card.set_name} • ${card.rarity || 'Unknown'}
                    </p>
                    
                    <!-- Price Display -->
                    <div class="flex items-center space-x-4 text-xs">
                        ${card.prices.normal > 0 ? `
                            <div class="flex items-center">
                                <span class="text-gray-600 dark:text-gray-400 mr-1">Normal:</span>
                                <span class="font-semibold text-green-600 dark:text-green-400">${normalPrice}</span>
                            </div>
                        ` : ''}
                        
                        ${card.prices.foil > 0 ? `
                            <div class="flex items-center">
                                <i class="fas fa-star text-yellow-500 mr-1"></i>
                                <span class="text-gray-600 dark:text-gray-400 mr-1">${foilLabel}:</span>
                                <span class="font-semibold text-yellow-600 dark:text-yellow-400">${foilPrice}</span>
                            </div>
                        ` : ''}
                        
                        ${!card.prices.normal && !card.prices.foil ? `
                            <span class="text-gray-500 dark:text-gray-400">Price not available</span>
                        ` : ''}
                    </div>
                </div>
                
                <div class="flex-shrink-0 ml-2">
                    <i class="fas fa-chevron-right text-gray-400"></i>
                </div>
            </div>
        `;
    }

    showCardSelectionModal(card) {
        this.selectedCard = card;
        
        // Update modal content
        document.getElementById('card-selection-title').textContent = card.name;
        document.getElementById('card-selection-image').src = card.imageUrl || 'https://via.placeholder.com/300x420?text=No+Image';
        document.getElementById('card-selection-set').textContent = card.set_name;
        document.getElementById('card-selection-game').textContent = card.game === 'pokemon' ? 'Pokémon' : 'Magic: The Gathering';
        document.getElementById('card-selection-rarity').textContent = card.rarity || 'Unknown';

        // Setup finish options
        const foilOption = document.getElementById('foil-option');
        const foilLabel = document.getElementById('foil-label');
        
        if (card.prices.foil > 0) {
            foilOption.classList.remove('hidden');
            foilLabel.textContent = card.game === 'pokemon' ? 'Holo' : 'Foil';
        } else {
            foilOption.classList.add('hidden');
        }

        // Reset selections
        document.querySelector('input[name="card-finish"][value="normal"]').checked = true;
        document.getElementById('card-condition-select').value = 'near_mint';
        document.getElementById('card-quantity').value = '1';

        // Update prices and show modal
        this.updateCardPrice();
        this.updateFoilIndicator();
        
        const modal = document.getElementById('card-selection-modal');
        modal.classList.remove('hidden');
    }

    hideCardSelectionModal() {
        const modal = document.getElementById('card-selection-modal');
        modal.classList.add('hidden');
        this.selectedCard = null;
    }

    updateCardPrice() {
        if (!this.selectedCard) return;

        const isfoil = document.querySelector('input[name="card-finish"]:checked').value === 'foil';
        const condition = document.getElementById('card-condition-select').value;
        const quantity = parseInt(document.getElementById('card-quantity').value) || 1;

        const basePrice = isfoil ? this.selectedCard.prices.foil : this.selectedCard.prices.normal;
        const conditionMultiplier = CARD_CONDITIONS[condition]?.multiplier || 1.0;
        const adjustedPrice = basePrice * conditionMultiplier * quantity;

        // Update price displays
        const normalPriceEl = document.getElementById('normal-price');
        const foilPriceEl = document.getElementById('foil-price');
        const currentPriceEl = document.getElementById('current-card-price');

        if (normalPriceEl) {
            const normalConditionPrice = this.selectedCard.prices.normal * conditionMultiplier;
            normalPriceEl.textContent = convertAndFormat ? 
                convertAndFormat({ usd: normalConditionPrice }) : 
                `$${normalConditionPrice.toFixed(2)}`;
        }

        if (foilPriceEl && this.selectedCard.prices.foil > 0) {
            const foilConditionPrice = this.selectedCard.prices.foil * conditionMultiplier;
            foilPriceEl.textContent = convertAndFormat ? 
                convertAndFormat({ usd: foilConditionPrice }) : 
                `$${foilConditionPrice.toFixed(2)}`;
        }

        if (currentPriceEl) {
            currentPriceEl.textContent = convertAndFormat ? 
                convertAndFormat({ usd: adjustedPrice }) : 
                `$${adjustedPrice.toFixed(2)}`;
        }
    }

    updateFoilIndicator() {
        if (!this.selectedCard) return;

        const isfoil = document.querySelector('input[name="card-finish"]:checked').value === 'foil';
        const indicator = document.getElementById('card-selection-foil-indicator');
        const cardImage = document.getElementById('card-selection-image');

        if (isfoil && this.selectedCard.prices.foil > 0) {
            const foilLabel = this.selectedCard.game === 'pokemon' ? 'Holo' : 'Foil';
            indicator.innerHTML = `
                <div class="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                    <i class="fas fa-star mr-1"></i>${foilLabel}
                </div>
            `;
            indicator.classList.remove('hidden');
            cardImage.classList.add('foil-effect');
        } else {
            indicator.classList.add('hidden');
            cardImage.classList.remove('foil-effect');
        }
    }

    async addCardToCollection() {
        await this.addCardToList('collection');
    }

    async addCardToWishlist() {
        await this.addCardToList('wishlist');
    }

    async addCardToList(listType) {
        if (!this.selectedCard) return;

        const isfoil = document.querySelector('input[name="card-finish"]:checked').value === 'foil';
        const condition = document.getElementById('card-condition-select').value;
        const quantity = parseInt(document.getElementById('card-quantity').value) || 1;

        const basePrice = isfoil ? this.selectedCard.prices.foil : this.selectedCard.prices.normal;
        const conditionMultiplier = CARD_CONDITIONS[condition]?.multiplier || 1.0;
        const adjustedPrice = basePrice * conditionMultiplier;

        // Create card data for collection
        const cardData = {
            ...this.selectedCard,
            is_foil: isfoil,
            condition: condition,
            quantity: quantity,
            prices: {
                ...this.selectedCard.prices,
                usd: adjustedPrice // Update the price based on condition and foil status
            },
            // Add collection-specific metadata
            date_added: new Date().toISOString(),
            list_type: listType
        };

        try {
            // Use the existing collection module to add the card
            if (window.Collection && window.Collection.addCard) {
                await window.Collection.addCard(cardData, listType);
                
                // Show success message
                this.showToast(`Card added to ${listType}!`, 'success');
                
                // Close modal and refresh display
                this.hideCardSelectionModal();
                
                // Trigger collection refresh if the function exists
                if (window.applyAndRender) {
                    window.applyAndRender({});
                }
            } else {
                throw new Error('Collection module not available');
            }
        } catch (error) {
            console.error(`Error adding card to ${listType}:`, error);
            this.showToast(`Failed to add card to ${listType}`, 'error');
        }
    }

    showToast(message, type = 'info') {
        // Use existing toast system if available
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(message, type);
            return;
        }

        // Fallback toast implementation
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

// Initialize the enhanced collection search
window.enhancedCollectionSearch = new EnhancedCollectionSearch();
