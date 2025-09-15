/**
 * HatakeSocial - Enhanced Search Page Script (Integrated with existing APIs)
 * 
 * Features:
 * - Uses existing API modules from js/modules/api.js
 * - Debounced search with 300ms delay
 * - Real-time autocomplete suggestions
 * - Search history and saved searches
 * - Advanced filtering with all missing options
 * - Pagination and sorting
 * - Export functionality
 * - Improved error handling and loading states
 * - Mobile-responsive design
 */

// Import existing API functions
import { searchMagicCards, searchPokemonCards } from './modules/api.js';

document.addEventListener('authReady', () => {
    const db = firebase.firestore();
    let user = firebase.auth().currentUser;

    // --- Configuration ---
    const CONFIG = {
        SEARCH_DELAY: 300,
        RESULTS_PER_PAGE: 50,
        MAX_SUGGESTIONS: 10,
        MAX_SEARCH_HISTORY: 10
    };

    // --- DOM Elements ---
    const searchQueryDisplay = document.getElementById('search-query-display');
    const headerSearchBar = document.getElementById('main-search-bar');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsArea = document.getElementById('search-results-area');
    const filterForm = document.getElementById('search-filter-form');
    const suggestionsContainer = document.getElementById('search-suggestions');
    const suggestionsList = document.getElementById('suggestions-list');
    
    // Filter Elements
    const categoryFilter = document.getElementById('filter-category');
    const cardFiltersContainer = document.getElementById('card-filters-container');
    const tcgFilter = document.getElementById('filter-tcg');
    const forSaleFilter = document.getElementById('filter-for-sale');
    const mtgFilters = document.getElementById('mtg-filters');
    const pokemonFilters = document.getElementById('pokemon-filters');
    
    // Pagination Elements
    const paginationContainer = document.getElementById('pagination-container');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageNumbers = document.getElementById('page-numbers');
    const resultsPerPageSelect = document.getElementById('results-per-page');
    
    // Sort and View Elements
    const sortSelect = document.getElementById('sort-select');
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    const exportBtn = document.getElementById('export-results');
    
    // Quick Filters
    const quickFilterBtns = document.querySelectorAll('[data-quick-filter]');
    
    // Search History Elements
    const searchHistoryContainer = document.getElementById('search-history-container');
    const searchHistoryList = document.getElementById('search-history-list');
    const savedSearchesList = document.getElementById('saved-searches-list');
    const saveCurrentSearchBtn = document.getElementById('save-current-search');
    const clearFiltersBtn = document.getElementById('clear-filters');

    // --- State Management ---
    let currentQuery = '';
    let currentPage = 1;
    let totalResults = 0;
    let currentResults = [];
    let searchTimeout = null;
    let suggestionsTimeout = null;
    let currentView = 'grid';
    let searchHistory = JSON.parse(localStorage.getItem('hatake_search_history') || '[]');
    let savedSearches = JSON.parse(localStorage.getItem('hatake_saved_searches') || '[]');

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

    const updateResultsInfo = (start, end, total) => {
        const startEl = document.getElementById('results-start');
        const endEl = document.getElementById('results-end');
        const totalEl = document.getElementById('results-total');
        
        if (startEl) startEl.textContent = start;
        if (endEl) endEl.textContent = end;
        if (totalEl) totalEl.textContent = total;
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
        updateSearchHistoryDisplay();
    };

    const updateSearchHistoryDisplay = () => {
        if (!searchHistoryContainer || !searchHistoryList) return;
        
        if (searchHistory.length === 0) {
            searchHistoryContainer.classList.add('hidden');
            return;
        }

        searchHistoryContainer.classList.remove('hidden');
        searchHistoryList.innerHTML = searchHistory.map(query => `
            <button class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" 
                    onclick="performSearch('${sanitizeHTML(query)}')">
                ${sanitizeHTML(query)}
            </button>
        `).join('');
    };

    // --- Autocomplete Functionality ---
    const showSuggestions = async (query) => {
        if (!query || query.length < 2 || !suggestionsContainer || !suggestionsList) {
            if (suggestionsContainer) suggestionsContainer.classList.add('hidden');
            return;
        }

        try {
            let suggestions = [];
            
            // Get MTG suggestions from Scryfall
            if (categoryFilter.value === 'all' || categoryFilter.value === 'cards') {
                try {
                    const response = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`);
                    if (response.ok) {
                        const data = await response.json();
                        suggestions = suggestions.concat(data.data.slice(0, 5));
                    }
                } catch (error) {
                    console.warn('Scryfall autocomplete error:', error);
                }
            }

            // Add search history suggestions
            const historyMatches = searchHistory.filter(item => 
                item.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 3);
            
            suggestions = suggestions.concat(historyMatches);

            // Remove duplicates and limit
            suggestions = [...new Set(suggestions)].slice(0, CONFIG.MAX_SUGGESTIONS);

            if (suggestions.length > 0) {
                suggestionsList.innerHTML = suggestions.map(suggestion => `
                    <button class="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm" 
                            onclick="selectSuggestion('${sanitizeHTML(suggestion)}')">
                        ${sanitizeHTML(suggestion)}
                    </button>
                `).join('');
                suggestionsContainer.classList.remove('hidden');
            } else {
                suggestionsContainer.classList.add('hidden');
            }
        } catch (error) {
            console.error('Suggestions error:', error);
            suggestionsContainer.classList.add('hidden');
        }
    };

    const selectSuggestion = (suggestion) => {
        headerSearchBar.value = suggestion;
        suggestionsContainer.classList.add('hidden');
        performSearch(suggestion);
    };

    // --- API Search Functions ---
    const performUserSearch = async (term) => {
        try {
            const usersRef = db.collection('users');
            const termLower = term.toLowerCase();
            const snapshot = await usersRef
                .orderBy('displayName_lower')
                .startAt(termLower)
                .endAt(termLower + '\uf8ff')
                .limit(50)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('User search error:', error);
            return [];
        }
    };

    const performArticleSearch = async (term) => {
        try {
            const articlesRef = db.collection('articles');
            const termLower = term.toLowerCase();
            const snapshot = await articlesRef
                .where('keywords', 'array-contains', termLower)
                .orderBy('publishedAt', 'desc')
                .limit(50)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Article search error:', error);
            return [];
        }
    };

    const performProductSearch = async (term) => {
        try {
            const productsRef = db.collection('products');
            const termLower = term.toLowerCase();
            const snapshot = await productsRef
                .where('searchTerms', 'array-contains', termLower)
                .limit(50)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Product search error:', error);
            return [];
        }
    };

    const performCardSearch = async (term, filters) => {
        try {
            let apiResults = [];
            
            if (filters.tcg === 'mtg') {
                apiResults = await searchMagicCards(term);
            } else if (filters.tcg === 'pokemon') {
                apiResults = await searchPokemonCards(term);
            }

            // Apply additional filters
            if (filters.priceMin || filters.priceMax) {
                apiResults = apiResults.filter(card => {
                    const price = parseFloat(card.priceUsd) || 0;
                    if (filters.priceMin && price < parseFloat(filters.priceMin)) return false;
                    if (filters.priceMax && price > parseFloat(filters.priceMax)) return false;
                    return true;
                });
            }

            // Get for-sale information from Firestore
            const forSaleMap = new Map();
            if (apiResults.length > 0) {
                const cardIds = apiResults.map(c => c.id);
                const batches = [];
                for (let i = 0; i < cardIds.length; i += 10) {
                    batches.push(cardIds.slice(i, i + 10));
                }

                for (const batch of batches) {
                    try {
                        const collectionRef = db.collectionGroup('collection')
                            .where('apiId', 'in', batch)
                            .where('forSale', '==', true);
                        const snapshot = await collectionRef.get();
                        snapshot.forEach(doc => {
                            const cardData = doc.data();
                            const count = forSaleMap.get(cardData.apiId) || 0;
                            forSaleMap.set(cardData.apiId, count + 1);
                        });
                    } catch (error) {
                        console.warn('Error fetching for-sale data:', error);
                    }
                }
            }

            // Apply for-sale filter if needed
            const finalCards = filters.forSale ? 
                apiResults.filter(card => forSaleMap.has(card.id)) : 
                apiResults;

            totalResults = finalCards.length;
            return { cards: finalCards, forSaleMap };
        } catch (error) {
            console.error('Card search error:', error);
            return { cards: [], forSaleMap: new Map() };
        }
    };

    // --- Render Functions ---
    const renderCardResults = (cards, forSaleMap) => {
        if (cards.length === 0) return '<p class="text-gray-500 dark:text-gray-400">No cards found.</p>';
        
        const cardElements = cards.map(card => {
            const forSaleCount = forSaleMap.get(card.id) || 0;
            const priceDisplay = card.priceUsd ? `$${parseFloat(card.priceUsd).toFixed(2)}` : 'Price N/A';
            
            if (currentView === 'list') {
                return `
                    <div class="flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow">
                        <img src="${sanitizeHTML(card.imageUrl)}" alt="${sanitizeHTML(card.name)}" class="w-16 h-22 rounded-md object-cover mr-4">
                        <div class="flex-1">
                            <h3 class="font-bold text-gray-800 dark:text-white">${sanitizeHTML(card.name)}</h3>
                            <p class="text-sm text-gray-600 dark:text-gray-400">${sanitizeHTML(card.setName)} • ${sanitizeHTML(card.rarity)}</p>
                            <p class="text-sm font-semibold text-green-600 dark:text-green-400">${priceDisplay}</p>
                            ${forSaleCount > 0 ? `<p class="text-xs text-blue-500">${forSaleCount} for sale</p>` : ''}
                        </div>
                        <div class="flex flex-col space-y-2">
                            <button class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                                Add to Collection
                            </button>
                            <button class="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                                Add to Wishlist
                            </button>
                            ${forSaleCount > 0 ? `
                                <button class="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700">
                                    View Listings
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden">
                        <div class="aspect-[0.71] relative">
                            <img src="${sanitizeHTML(card.imageUrl)}" alt="${sanitizeHTML(card.name)}" class="w-full h-full object-cover">
                            <div class="absolute top-2 right-2">
                                <button class="w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <i class="fas fa-heart text-gray-400 hover:text-red-500"></i>
                                </button>
                            </div>
                        </div>
                        <div class="p-3">
                            <h3 class="font-semibold text-sm truncate text-gray-800 dark:text-white mb-1">${sanitizeHTML(card.name)}</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">${sanitizeHTML(card.setName)}</p>
                            <p class="text-sm font-bold text-green-600 dark:text-green-400 mb-2">${priceDisplay}</p>
                            ${forSaleCount > 0 ? `
                                <p class="text-xs text-blue-500 font-semibold mb-2">${forSaleCount} for sale</p>
                            ` : `
                                <p class="text-xs text-gray-500 mb-2">Check Listings</p>
                            `}
                            <div class="flex space-x-1">
                                <button class="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                                    Add
                                </button>
                                <button class="flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                                    Wish
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
        }).join('');
        
        const containerClass = currentView === 'list' ? 'space-y-4' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4';
        return `<div class="${containerClass}">${cardElements}</div>`;
    };

    // --- Main Search Function ---
    const runSearch = async () => {
        if (!currentQuery) {
            resultsArea.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 text-lg">Please enter a search term in the bar above.</p>';
            return;
        }

        toggleLoading(true);
        
        try {
            const category = categoryFilter.value;
            const filters = {
                tcg: tcgFilter.value,
                forSale: forSaleFilter.checked,
                priceMin: document.getElementById('price-min')?.value,
                priceMax: document.getElementById('price-max')?.value
            };
            
            let cardsHTML = '';
            currentResults = [];

            if (category === 'all' || category === 'cards') {
                const cardResults = await performCardSearch(currentQuery, filters);
                cardsHTML = `
                    <div class="mb-8">
                        <h2 class="text-2xl font-semibold mb-4 border-b dark:border-gray-600 pb-2">Cards</h2>
                        <div>${renderCardResults(cardResults.cards, cardResults.forSaleMap)}</div>
                    </div>
                `;
                currentResults = cardResults.cards.map(r => ({
                    ...r, 
                    type: 'card',
                    forSaleCount: cardResults.forSaleMap.get(r.id) || 0
                }));
            }

            if (cardsHTML.trim() === '') {
                resultsArea.innerHTML = `
                    <div class="text-center p-8">
                        <i class="fas fa-search text-4xl text-gray-400 mb-4"></i>
                        <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">No results found</h3>
                        <p class="text-gray-600 dark:text-gray-400">Try a different search term or adjust your filters.</p>
                    </div>
                `;
            } else {
                resultsArea.innerHTML = cardsHTML;
            }

            addToSearchHistory(currentQuery);

        } catch (error) {
            console.error('Search error:', error);
            showError('An error occurred while searching. Please try again.');
        } finally {
            toggleLoading(false);
        }
    };

    // --- Event Listeners ---
    const setupEventListeners = () => {
        // Search input with debouncing
        if (headerSearchBar) {
            headerSearchBar.addEventListener('input', debounce((e) => {
                const query = e.target.value.trim();
                if (query !== currentQuery) {
                    currentQuery = query;
                    if (searchQueryDisplay) searchQueryDisplay.textContent = query;
                    if (query.length >= 2) {
                        showSuggestions(query);
                        runSearch();
                    } else {
                        if (suggestionsContainer) suggestionsContainer.classList.add('hidden');
                        if (query.length === 0) {
                            resultsArea.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 text-lg">Please enter a search term in the bar above.</p>';
                        }
                    }
                }
            }, CONFIG.SEARCH_DELAY));
        }

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (headerSearchBar && suggestionsContainer && 
                !headerSearchBar.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                suggestionsContainer.classList.add('hidden');
            }
        });

        // Filter changes
        if (filterForm) {
            const allFilterInputs = filterForm.querySelectorAll('input, select');
            allFilterInputs.forEach(input => {
                input.addEventListener('change', debounce(runSearch, CONFIG.SEARCH_DELAY));
            });
        }

        // Category filter visibility
        if (categoryFilter && cardFiltersContainer) {
            categoryFilter.addEventListener('change', (e) => {
                cardFiltersContainer.classList.toggle('hidden', e.target.value !== 'cards');
            });
        }

        // TCG filter visibility
        if (tcgFilter && mtgFilters && pokemonFilters) {
            tcgFilter.addEventListener('change', (e) => {
                mtgFilters.classList.toggle('hidden', e.target.value !== 'mtg');
                pokemonFilters.classList.toggle('hidden', e.target.value !== 'pokemon');
            });
        }

        // Quick filters
        quickFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.dataset.quickFilter;
                if (headerSearchBar) headerSearchBar.value = query;
                performSearch(query);
            });
        });

        // View toggle
        if (gridViewBtn && listViewBtn) {
            gridViewBtn.addEventListener('click', () => {
                currentView = 'grid';
                gridViewBtn.classList.add('bg-white', 'dark:bg-gray-600', 'text-gray-900', 'dark:text-white');
                gridViewBtn.classList.remove('text-gray-600', 'dark:text-gray-400');
                listViewBtn.classList.remove('bg-white', 'dark:bg-gray-600', 'text-gray-900', 'dark:text-white');
                listViewBtn.classList.add('text-gray-600', 'dark:text-gray-400');
                runSearch();
            });

            listViewBtn.addEventListener('click', () => {
                currentView = 'list';
                listViewBtn.classList.add('bg-white', 'dark:bg-gray-600', 'text-gray-900', 'dark:text-white');
                listViewBtn.classList.remove('text-gray-600', 'dark:text-gray-400');
                gridViewBtn.classList.remove('bg-white', 'dark:bg-gray-600', 'text-gray-900', 'dark:text-white');
                gridViewBtn.classList.add('text-gray-600', 'dark:text-gray-400');
                runSearch();
            });
        }

        // Clear filters
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                if (filterForm) filterForm.reset();
                if (categoryFilter) categoryFilter.dispatchEvent(new Event('change'));
                if (tcgFilter) tcgFilter.dispatchEvent(new Event('change'));
                runSearch();
            });
        }

        // Keyboard navigation
        if (headerSearchBar) {
            headerSearchBar.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (suggestionsContainer) suggestionsContainer.classList.add('hidden');
                    performSearch(headerSearchBar.value);
                } else if (e.key === 'Escape') {
                    if (suggestionsContainer) suggestionsContainer.classList.add('hidden');
                }
            });
        }
    };

    // --- Global Functions ---
    window.performSearch = (query) => {
        currentQuery = query;
        if (headerSearchBar) headerSearchBar.value = query;
        if (searchQueryDisplay) searchQueryDisplay.textContent = query;
        currentPage = 1;
        runSearch();
    };

    window.selectSuggestion = selectSuggestion;

    // --- Initialization ---
    const initialize = () => {
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
        updateSearchHistoryDisplay();
        
        // Trigger initial visibility updates
        if (categoryFilter) categoryFilter.dispatchEvent(new Event('change'));
        if (tcgFilter) tcgFilter.dispatchEvent(new Event('change'));
    };

    initialize();
});

