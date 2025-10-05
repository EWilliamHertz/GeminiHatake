/**
 * Enhanced Search Script with Price Conditions and Foil/Holo Support
 * 
 * Features:
 * - Search results show both normal and foil/holo prices for all cards
 * - Multiple price conditions (Near Mint, Lightly Played, etc.)
 * - Proper terminology (holo for Pokemon, foil for MTG)
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

class EnhancedSearchManager {
    constructor() {
        this.searchTimeout = null;
        this.currentResults = [];
        this.isSearching = false;

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('Initializing Enhanced Search Manager...');
        this.bindEvents();
    }

    bindEvents() {
        // Main search bar
        const mainSearchBar = document.getElementById('main-search-bar');
        if (mainSearchBar) {
            mainSearchBar.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });

            mainSearchBar.addEventListener('focus', () => {
                this.showSearchDropdown();
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#main-search-bar') && !e.target.closest('#search-dropdown')) {
                    this.hideSearchDropdown();
                }
            });
        }
    }

    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        
        if (query.length < 2) {
            this.hideSearchDropdown();
            return;
        }

        this.searchTimeout = setTimeout(async () => {
            await this.performSearch(query);
        }, 300);
    }

    async performSearch(query) {
        if (this.isSearching) return;
        
        this.isSearching = true;
        this.showSearchLoading();

        try {
            const results = await Promise.all([
                this.searchPokemon(query),
                this.searchMTG(query)
            ]);

            // Combine and sort results
            this.currentResults = [...results[0], ...results[1]]
                .sort((a, b) => a.name.localeCompare(b.name))
                .slice(0, 10); // Limit to 10 results

            this.displaySearchResults();
        } catch (error) {
            console.error('Search error:', error);
            this.showSearchError();
        } finally {
            this.isSearching = false;
        }
    }

    async searchPokemon(query) {
        try {
            const response = await fetch(
                `${API_CONFIG.pokemon.baseUrl}/cards?q=name:${encodeURIComponent(query)}*&pageSize=5`,
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
            return data.data.slice(0, 5).map(card => this.formatMTGCard(card));
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
            set: card.set?.name || 'Unknown Set',
            rarity: card.rarity,
            imageUrl: card.images?.small || card.images?.large,
            prices: {
                normal: normalPrice,
                foil: holoPrice, // Using 'foil' as generic term, will display as 'holo' for Pokemon
                conditions: this.calculateConditionPrices(normalPrice, holoPrice)
            },
            hasVariants: normalPrice > 0 && holoPrice > 0
        };
    }

    formatMTGCard(card) {
        const normalPrice = card.prices?.usd ? parseFloat(card.prices.usd) : 0;
        const foilPrice = card.prices?.usd_foil ? parseFloat(card.prices.usd_foil) : 0;

        return {
            id: card.id,
            name: card.name,
            game: 'mtg',
            set: card.set_name || 'Unknown Set',
            rarity: card.rarity,
            imageUrl: card.image_uris?.small || card.image_uris?.normal,
            prices: {
                normal: normalPrice,
                foil: foilPrice,
                conditions: this.calculateConditionPrices(normalPrice, foilPrice)
            },
            hasVariants: normalPrice > 0 && foilPrice > 0
        };
    }

    calculateConditionPrices(normalPrice, foilPrice) {
        const conditions = {};
        
        Object.entries(CARD_CONDITIONS).forEach(([key, condition]) => {
            conditions[key] = {
                normal: normalPrice * condition.multiplier,
                foil: foilPrice * condition.multiplier
            };
        });

        return conditions;
    }

    displaySearchResults() {
        const dropdown = this.getOrCreateSearchDropdown();
        
        if (this.currentResults.length === 0) {
            dropdown.innerHTML = `
                <div class="p-4 text-center text-gray-500 dark:text-gray-400">
                    <i class="fas fa-search text-2xl mb-2"></i>
                    <p>No cards found</p>
                </div>
            `;
            return;
        }

        dropdown.innerHTML = this.currentResults.map(card => this.renderSearchResult(card)).join('');
        this.bindSearchResultEvents();
        this.showSearchDropdown();
    }

    renderSearchResult(card) {
        const foilLabel = card.game === 'pokemon' ? 'Holo' : 'Foil';
        const gameLabel = card.game === 'pokemon' ? 'Pokémon' : 'MTG';
        
        // Format prices for display
        const normalPrice = convertAndFormat ? 
            convertAndFormat({ usd: card.prices.normal }) : 
            `$${card.prices.normal.toFixed(2)}`;
        
        const foilPrice = convertAndFormat ? 
            convertAndFormat({ usd: card.prices.foil }) : 
            `$${card.prices.foil.toFixed(2)}`;

        return `
            <div class="search-result-card p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                 data-card-id="${card.id}"
                 data-game="${card.game}">
                
                <div class="flex items-center space-x-3">
                    <div class="flex-shrink-0">
                        <img src="${card.imageUrl || 'https://via.placeholder.com/60x84?text=No+Image'}" 
                             alt="${card.name}" 
                             class="w-12 h-16 object-cover rounded shadow-sm"
                             onerror="this.src='https://via.placeholder.com/60x84?text=No+Image'">
                    </div>
                    
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1">
                            <h3 class="font-semibold text-sm text-gray-900 dark:text-white truncate">
                                ${card.name}
                            </h3>
                            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">
                                ${gameLabel}
                            </span>
                        </div>
                        
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            ${card.set} • ${card.rarity || 'Unknown'}
                        </p>
                        
                        <!-- Price Display -->
                        <div class="space-y-1">
                            ${card.prices.normal > 0 ? `
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-gray-600 dark:text-gray-400">Normal:</span>
                                    <span class="font-semibold text-green-600 dark:text-green-400">${normalPrice}</span>
                                </div>
                            ` : ''}
                            
                            ${card.prices.foil > 0 ? `
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-gray-600 dark:text-gray-400 flex items-center">
                                        <i class="fas fa-star text-yellow-500 mr-1"></i>${foilLabel}:
                                    </span>
                                    <span class="font-semibold text-yellow-600 dark:text-yellow-400">${foilPrice}</span>
                                </div>
                            ` : ''}
                            
                            ${!card.prices.normal && !card.prices.foil ? `
                                <div class="text-xs text-gray-500 dark:text-gray-400">
                                    Price not available
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    bindSearchResultEvents() {
        document.querySelectorAll('.search-result-card').forEach(card => {
            card.addEventListener('click', () => {
                const cardId = card.dataset.cardId;
                const game = card.dataset.game;
                this.showCardDetails(cardId, game);
            });
        });
    }

    showCardDetails(cardId, game) {
        const card = this.currentResults.find(c => c.id === cardId && c.game === game);
        if (!card) return;

        this.hideSearchDropdown();
        this.showCardModal(card);
    }

    showCardModal(card) {
        const foilLabel = card.game === 'pokemon' ? 'Holo' : 'Foil';
        const gameLabel = card.game === 'pokemon' ? 'Pokémon' : 'Magic: The Gathering';
        
        const modalHTML = `
            <div id="search-card-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                                ${card.name}
                            </h2>
                            <button id="close-search-card-modal" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                        
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <img src="${card.imageUrl || 'https://via.placeholder.com/300x420?text=No+Image'}" 
                                     alt="${card.name}" 
                                     class="w-full rounded-lg shadow-md"
                                     onerror="this.src='https://via.placeholder.com/300x420?text=No+Image'">
                            </div>
                            
                            <div class="space-y-4">
                                <div>
                                    <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Card Information</h3>
                                    <div class="space-y-2 text-sm">
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Game:</span>
                                            <span class="font-medium">${gameLabel}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Set:</span>
                                            <span class="font-medium">${card.set}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Rarity:</span>
                                            <span class="font-medium">${card.rarity || 'Unknown'}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Price Information -->
                                <div>
                                    <h3 class="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Market Prices</h3>
                                    
                                    <!-- Normal and Foil/Holo Prices -->
                                    <div class="grid grid-cols-2 gap-4 mb-4">
                                        ${card.prices.normal > 0 ? `
                                            <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                                <h4 class="font-medium text-sm text-gray-900 dark:text-white mb-2">Normal</h4>
                                                <p class="text-xl font-bold text-green-600 dark:text-green-400">
                                                    ${convertAndFormat ? convertAndFormat({ usd: card.prices.normal }) : `$${card.prices.normal.toFixed(2)}`}
                                                </p>
                                            </div>
                                        ` : ''}
                                        
                                        ${card.prices.foil > 0 ? `
                                            <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700">
                                                <h4 class="font-medium text-sm text-gray-900 dark:text-white mb-2 flex items-center">
                                                    <i class="fas fa-star text-yellow-500 mr-1"></i>${foilLabel}
                                                </h4>
                                                <p class="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                                                    ${convertAndFormat ? convertAndFormat({ usd: card.prices.foil }) : `$${card.prices.foil.toFixed(2)}`}
                                                </p>
                                            </div>
                                        ` : ''}
                                    </div>
                                    
                                    <!-- Condition-based Pricing -->
                                    <div>
                                        <h4 class="font-medium text-sm text-gray-900 dark:text-white mb-2">Prices by Condition</h4>
                                        <div class="space-y-2">
                                            ${Object.entries(CARD_CONDITIONS).map(([key, condition]) => {
                                                const normalConditionPrice = card.prices.conditions[key]?.normal || 0;
                                                const foilConditionPrice = card.prices.conditions[key]?.foil || 0;
                                                
                                                return `
                                                    <div class="flex items-center justify-between text-xs py-1 border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                                                        <span class="text-gray-600 dark:text-gray-400">${condition.label}:</span>
                                                        <div class="flex space-x-4">
                                                            ${normalConditionPrice > 0 ? `
                                                                <span class="text-green-600 dark:text-green-400">
                                                                    ${convertAndFormat ? convertAndFormat({ usd: normalConditionPrice }) : `$${normalConditionPrice.toFixed(2)}`}
                                                                </span>
                                                            ` : ''}
                                                            ${foilConditionPrice > 0 ? `
                                                                <span class="text-yellow-600 dark:text-yellow-400">
                                                                    <i class="fas fa-star mr-1"></i>${convertAndFormat ? convertAndFormat({ usd: foilConditionPrice }) : `$${foilConditionPrice.toFixed(2)}`}
                                                                </span>
                                                            ` : ''}
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
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
        document.getElementById('close-search-card-modal').addEventListener('click', () => {
            document.getElementById('search-card-modal').remove();
        });
        
        // Close on backdrop click
        document.getElementById('search-card-modal').addEventListener('click', (e) => {
            if (e.target.id === 'search-card-modal') {
                document.getElementById('search-card-modal').remove();
            }
        });
    }

    getOrCreateSearchDropdown() {
        let dropdown = document.getElementById('search-dropdown');
        
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'search-dropdown';
            dropdown.className = 'absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg mt-1 max-h-96 overflow-y-auto z-50 hidden';
            
            const searchContainer = document.getElementById('main-search-bar').parentElement;
            searchContainer.style.position = 'relative';
            searchContainer.appendChild(dropdown);
        }
        
        return dropdown;
    }

    showSearchDropdown() {
        const dropdown = document.getElementById('search-dropdown');
        if (dropdown) {
            dropdown.classList.remove('hidden');
        }
    }

    hideSearchDropdown() {
        const dropdown = document.getElementById('search-dropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
    }

    showSearchLoading() {
        const dropdown = this.getOrCreateSearchDropdown();
        dropdown.innerHTML = `
            <div class="p-4 text-center text-gray-500 dark:text-gray-400">
                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                <p>Searching cards...</p>
            </div>
        `;
        this.showSearchDropdown();
    }

    showSearchError() {
        const dropdown = this.getOrCreateSearchDropdown();
        dropdown.innerHTML = `
            <div class="p-4 text-center text-red-500 dark:text-red-400">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p>Search failed. Please try again.</p>
            </div>
        `;
        this.showSearchDropdown();
    }
}

// Initialize the enhanced search manager
window.enhancedSearch = new EnhancedSearchManager();
