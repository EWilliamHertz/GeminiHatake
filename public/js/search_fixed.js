/**
 * HatakeSocial - Fixed Search Page Script
 * Simplified version that works without complex module imports
 * Supports Magic: The Gathering, Pokémon, Lorcana, and Gundam
 */

// Initialize search functionality when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Search script initializing...');
    
    const db = firebase.firestore();
    let user = null;
    
    // Update user when auth state changes
    firebase.auth().onAuthStateChanged((authUser) => {
        user = authUser;
        console.log('Auth state changed:', authUser ? 'logged in' : 'not logged in');
    });

    // --- Configuration ---
    const CONFIG = {
        SEARCH_DELAY: 300,
        RESULTS_PER_PAGE: 50,
        MAX_SUGGESTIONS: 10,
        MAX_SEARCH_HISTORY: 10
    };

    // TCG Configuration with API endpoints
    const TCG_CONFIGS = {
        "mtg": {
            name: "Magic: The Gathering",
            searchUrl: "https://api.scryfall.com/cards/search",
            autocompleteUrl: "https://api.scryfall.com/cards/autocomplete"
        },
        "pokemon": {
            name: "Pokémon",
            searchUrl: "https://api.pokemontcg.io/v2/cards",
            apiKey: "60a08d4a-3a34-43d8-8f41-827b58cfac6d"
        },
        "lorcana": {
            name: "Lorcana",
            searchUrl: null // Will use ScryDex via Firebase function
        },
        "gundam": {
            name: "Gundam",
            searchUrl: null // Will use ScryDex via Firebase function
        }
    };

    // --- DOM Elements ---
    const searchQueryDisplay = document.getElementById('search-query-display');
    const headerSearchBar = document.getElementById('main-search-bar');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsArea = document.getElementById('search-results-area');
    const filterForm = document.getElementById('search-filter-form');
    
    // Filter Elements
    const categoryFilter = document.getElementById('filter-category');
    const cardFiltersContainer = document.getElementById('card-filters-container');
    const tcgFilter = document.getElementById('filter-tcg');
    const forSaleFilter = document.getElementById('filter-for-sale');
    const mtgFilters = document.getElementById('mtg-filters');
    const pokemonFilters = document.getElementById('pokemon-filters');
    
    // Sort and View Elements
    const sortSelect = document.getElementById('sort-select');
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    
    // Quick Filters
    const quickFilterBtns = document.querySelectorAll('[data-quick-filter]');
    const clearFiltersBtn = document.getElementById('clear-filters');

    // --- State Management ---
    let currentQuery = '';
    let currentPage = 1;
    let totalResults = 0;
    let currentResults = [];
    let searchTimeout = null;
    let currentView = 'grid';
    let searchHistory = JSON.parse(localStorage.getItem('hatake_search_history') || '[]');

    // --- Utility Functions ---
    const sanitizeHTML = (str) => {
        const temp = document.createElement('div');
        temp.textContent = str || '';
        return temp.innerHTML;
    };

    const debounce = (func, delay) => {
        return function(...args) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const toggleLoading = (isLoading) => {
        if (loadingIndicator) {
            loadingIndicator.classList.toggle('hidden', !isLoading);
        }
        if (isLoading) {
            resultsArea.innerHTML = '';
        }
    };

    const showError = (message) => {
        resultsArea.innerHTML = `
            <div class="text-center p-8">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">Search Error</h3>
                <p class="text-gray-600 dark:text-gray-400">${sanitizeHTML(message)}</p>
                <button class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" onclick="location.reload()">
                    Try Again
                </button>
            </div>
        `;
    };

    // --- Search History Management ---
    const addToSearchHistory = (query) => {
        if (!query || query.length < 2) return;
        
        // Remove if already exists
        searchHistory = searchHistory.filter(item => item !== query);
        // Add to beginning
        searchHistory.unshift(query);
        // Keep only last 10
        searchHistory = searchHistory.slice(0, CONFIG.MAX_SEARCH_HISTORY);
        
        localStorage.setItem('hatake_search_history', JSON.stringify(searchHistory));
    };

    // --- API Functions ---
    const searchMTGCards = async (query) => {
        try {
            const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=prints`);
            if (!response.ok) {
                if (response.status === 404) return [];
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('MTG search error:', error);
            throw error;
        }
    };

    const searchPokemonCards = async (query) => {
        try {
            const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(query)}`, {
                headers: {
                    'X-Api-Key': TCG_CONFIGS.pokemon.apiKey
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('Pokemon search error:', error);
            throw error;
        }
    };

    const searchScryDexCards = async (query, game) => {
        try {
            const searchScryDexFunction = firebase.functions().httpsCallable('searchScryDex');
            const result = await searchScryDexFunction({ cardName: query, game: game });
            
            if (result && result.data && Array.isArray(result.data.data)) {
                return result.data.data;
            } else if (result && Array.isArray(result.data)) {
                return result.data;
            }
            return [];
        } catch (error) {
            console.error('ScryDex search error:', error);
            return [];
        }
    };

    // --- Main Search Function ---
    const searchCards = async (query, tcg) => {
        console.log(`Searching for "${query}" in ${tcg}`);
        
        if (!query || query.trim().length < 2) {
            throw new Error('Search query must be at least 2 characters long.');
        }

        try {
            switch (tcg) {
                case 'mtg':
                    return await searchMTGCards(query);
                case 'pokemon':
                    return await searchPokemonCards(query);
                case 'lorcana':
                    return await searchScryDexCards(query, 'lorcana');
                case 'gundam':
                    return await searchScryDexCards(query, 'gundam');
                default:
                    return await searchMTGCards(query);
            }
        } catch (error) {
            console.error(`Search failed for ${tcg}:`, error);
            throw error;
        }
    };

    // --- Search Execution ---
    const runSearch = async () => {
        if (!currentQuery || currentQuery.trim().length < 2) {
            resultsArea.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 text-lg">Please enter a search term in the bar above.</p>';
            return;
        }

        toggleLoading(true);
        
        try {
            const selectedTcg = tcgFilter ? tcgFilter.value : 'mtg';
            const results = await searchCards(currentQuery, selectedTcg);
            
            currentResults = results;
            totalResults = results.length;
            
            addToSearchHistory(currentQuery);
            renderResults(results);
            
        } catch (error) {
            console.error('Search error:', error);
            showError(error.message || 'An error occurred while searching. Please try again.');
        } finally {
            toggleLoading(false);
        }
    };

    // --- Render Functions ---
    const renderResults = (results) => {
        if (results.length === 0) {
            resultsArea.innerHTML = `
                <div class="text-center p-8">
                    <i class="fas fa-search text-4xl text-gray-400 mb-4"></i>
                    <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">No Results Found</h3>
                    <p class="text-gray-600 dark:text-gray-400">Try adjusting your search terms or filters.</p>
                </div>
            `;
            return;
        }

        const cardElements = results.map(card => renderCard(card)).join('');
        
        resultsArea.innerHTML = `
            <div class="mb-4">
                <p class="text-sm text-gray-600 dark:text-gray-400">
                    Found ${totalResults} result${totalResults !== 1 ? 's' : ''} for "${sanitizeHTML(currentQuery)}"
                </p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                ${cardElements}
            </div>
        `;
    };

    const renderCard = (card) => {
        // Handle different card data structures
        const name = card.name || 'Unknown Card';
        const imageUrl = card.image_uris?.normal || card.images?.small || card.image || 'https://via.placeholder.com/200x280?text=No+Image';
        const price = getCardPrice(card);
        const setName = card.set_name || card.set?.name || 'Unknown Set';
        const rarity = card.rarity || 'Unknown';
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" 
                 onclick="openCardDetails('${sanitizeHTML(JSON.stringify(card))}')">
                <div class="aspect-w-3 aspect-h-4 bg-gray-200 dark:bg-gray-700">
                    <img src="${imageUrl}" alt="${sanitizeHTML(name)}" class="w-full h-48 object-cover" 
                         onerror="this.src='https://via.placeholder.com/200x280?text=No+Image'">
                </div>
                <div class="p-4">
                    <h3 class="font-semibold text-lg mb-2 text-gray-900 dark:text-white truncate">${sanitizeHTML(name)}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">${sanitizeHTML(setName)}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-500 mb-2">${sanitizeHTML(rarity)}</p>
                    <div class="flex justify-between items-center">
                        <span class="text-lg font-bold text-green-600 dark:text-green-400">${price}</span>
                        <button class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                onclick="event.stopPropagation(); addCardToCollection('${sanitizeHTML(JSON.stringify(card))}')">
                            Add to Collection
                        </button>
                    </div>
                </div>
            </div>
        `;
    };

    const getCardPrice = (card) => {
        // Handle different price structures
        if (card.prices) {
            if (card.prices.usd) return `$${parseFloat(card.prices.usd).toFixed(2)}`;
            if (card.prices.eur) return `€${parseFloat(card.prices.eur).toFixed(2)}`;
        }
        if (card.cardmarket && card.cardmarket.prices && card.cardmarket.prices.averageSellPrice) {
            return `€${parseFloat(card.cardmarket.prices.averageSellPrice).toFixed(2)}`;
        }
        if (card.tcgplayer && card.tcgplayer.prices) {
            const prices = card.tcgplayer.prices;
            if (prices.normal && prices.normal.market) {
                return `$${parseFloat(prices.normal.market).toFixed(2)}`;
            }
        }
        return 'N/A';
    };

    // --- Event Handlers ---
    const performSearch = (query) => {
        currentQuery = query;
        if (headerSearchBar) headerSearchBar.value = query;
        if (searchQueryDisplay) searchQueryDisplay.textContent = query;
        currentPage = 1;
        runSearch();
    };

    const setupEventListeners = () => {
        // Header search bar
        if (headerSearchBar) {
            headerSearchBar.addEventListener('input', debounce((e) => {
                if (e.target.value.length >= 2) {
                    performSearch(e.target.value);
                }
            }, CONFIG.SEARCH_DELAY));

            headerSearchBar.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    performSearch(headerSearchBar.value);
                }
            });
        }

        // Category filter
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                if (cardFiltersContainer) {
                    cardFiltersContainer.classList.toggle('hidden', e.target.value !== 'cards');
                }
                if (currentQuery) runSearch();
            });
        }

        // TCG filter
        if (tcgFilter) {
            tcgFilter.addEventListener('change', (e) => {
                // Hide all specific filters
                if (mtgFilters) mtgFilters.classList.add('hidden');
                if (pokemonFilters) pokemonFilters.classList.add('hidden');
                
                // Show relevant filters
                const selectedTcg = e.target.value;
                if (selectedTcg === 'mtg' && mtgFilters) {
                    mtgFilters.classList.remove('hidden');
                } else if (selectedTcg === 'pokemon' && pokemonFilters) {
                    pokemonFilters.classList.remove('hidden');
                }
                
                if (currentQuery) runSearch();
            });
        }

        // Quick filters
        quickFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.dataset.quickFilter;
                performSearch(query);
            });
        });

        // Clear filters
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                if (filterForm) filterForm.reset();
                if (categoryFilter) categoryFilter.dispatchEvent(new Event('change'));
                if (tcgFilter) tcgFilter.dispatchEvent(new Event('change'));
                if (currentQuery) runSearch();
            });
        }
    };

    // --- Global Functions ---
    window.performSearch = performSearch;
    
    window.openCardDetails = (cardDataString) => {
        try {
            const cardData = JSON.parse(cardDataString);
            console.log('Opening card details for:', cardData.name);
            // TODO: Implement card details modal
            alert(`Card details for ${cardData.name} - Feature coming soon!`);
        } catch (error) {
            console.error('Error parsing card data:', error);
        }
    };

    window.addCardToCollection = (cardDataString) => {
        try {
            const cardData = JSON.parse(cardDataString);
            console.log('Adding card to collection:', cardData.name);
            
            if (!user) {
                alert('Please log in to add cards to your collection.');
                return;
            }
            
            // TODO: Implement add to collection functionality
            alert(`Added ${cardData.name} to collection - Feature coming soon!`);
        } catch (error) {
            console.error('Error adding card to collection:', error);
        }
    };

    // --- Initialization ---
    const initialize = () => {
        console.log('Initializing search page...');
        
        const params = new URLSearchParams(window.location.search);
        currentQuery = params.get('query') || '';

        if (currentQuery) {
            if (headerSearchBar) headerSearchBar.value = currentQuery;
            if (searchQueryDisplay) searchQueryDisplay.textContent = currentQuery;
            runSearch();
        } else {
            resultsArea.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 text-lg">Please enter a search term in the bar above.</p>';
        }

        setupEventListeners();
        
        // Trigger initial visibility updates
        if (categoryFilter) categoryFilter.dispatchEvent(new Event('change'));
        if (tcgFilter) tcgFilter.dispatchEvent(new Event('change'));
        
        console.log('Search page initialized successfully');
    };

    initialize();
});
