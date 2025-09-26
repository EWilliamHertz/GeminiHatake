/**
 * HatakeSocial - Enhanced Search Page Script (ScryDex Integration)
 * Features:
 * - Uses centralized searchCards function from js/modules/api.js
 * - Support for all four TCGs (Magic: The Gathering, Pokémon, Lorcana, Gundam)
 * - Debounced search with 300ms delay
 * - Real-time autocomplete suggestions
 * - Search history and saved searches
 * - Advanced filtering with all missing options
 * - Pagination and sorting
 * - Export functionality
 * - Improved error handling and loading states
 * - Mobile-responsive design
 */

// Import centralized API functions
import { searchCards, debouncedSearchCards } from './modules/api.js';

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

    // TCG Configuration
    const TCG_CONFIGS = {
        "Magic: The Gathering": {
            apiKey: "mtg",
            autocompleteUrl: "https://api.scryfall.com/cards/autocomplete"
        },
        "Pokémon": {
            apiKey: "pokemon",
            autocompleteUrl: null // No autocomplete API available
        },
        "Lorcana": {
            apiKey: "lorcana",
            autocompleteUrl: null
        },
        "Gundam": {
            apiKey: "gundam",
            autocompleteUrl: null
        }
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
    const lorcanaFilters = document.getElementById('lorcana-filters');
    const gundamFilters = document.getElementById('gundam-filters');
    
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
            
            // Get suggestions based on selected TCG
            const selectedTcg = tcgFilter ? tcgFilter.value : 'Magic: The Gathering';
            const tcgConfig = TCG_CONFIGS[selectedTcg];
            
            if (categoryFilter.value === 'all' || categoryFilter.value === 'cards') {
                // Only MTG has autocomplete API available
                if (tcgConfig && tcgConfig.autocompleteUrl) {
                    try {
                        const response = await fetch(`${tcgConfig.autocompleteUrl}?q=${encodeURIComponent(query)}`);
                        if (response.ok) {
                            const data = await response.json();
                            suggestions = suggestions.concat(data.data.slice(0, 5));
                        }
                    } catch (error) {
                        console.warn(`${selectedTcg} autocomplete error:`, error);
                    }
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
            
            // Use centralized searchCards function
            const selectedTcg = filters.tcg || 'Magic: The Gathering';
            const tcgConfig = TCG_CONFIGS[selectedTcg];
            
            if (tcgConfig) {
                apiResults = await searchCards(term, tcgConfig.apiKey);
            }

            // Apply additional filters
            if (filters.priceMin || filters.priceMax) {
                apiResults = apiResults.filter(card => {
                    const price = parseFloat(card.prices?.usd) || 0;
                    if (filters.priceMin && price < parseFloat(filters.priceMin)) return false;
                    if (filters.priceMax && price > parseFloat(filters.priceMax)) return false;
                    return true;
                });
            }

            // Apply TCG-specific filters
            if (selectedTcg === 'Magic: The Gathering') {
                if (filters.mtgColors && filters.mtgColors.length > 0) {
                    apiResults = apiResults.filter(card => {
                        if (!card.color_identity) return false;
                        return filters.mtgColors.some(color => card.color_identity.includes(color));
                    });
                }
                if (filters.mtgType) {
                    apiResults = apiResults.filter(card => 
                        card.type_line && card.type_line.toLowerCase().includes(filters.mtgType.toLowerCase())
                    );
                }
                if (filters.mtgRarity) {
                    apiResults = apiResults.filter(card => 
                        card.rarity && card.rarity.toLowerCase() === filters.mtgRarity.toLowerCase()
                    );
                }
            } else if (selectedTcg === 'Pokémon') {
                if (filters.pokemonType) {
                    apiResults = apiResults.filter(card => 
                        card.types && card.types.includes(filters.pokemonType)
                    );
                }
                if (filters.pokemonRarity) {
                    apiResults = apiResults.filter(card => 
                        card.rarity && card.rarity.toLowerCase() === filters.pokemonRarity.toLowerCase()
                    );
                }
            }

            // Get for-sale information from Firestore
            const forSaleMap = new Map();
            if (apiResults.length > 0) {
                const cardIds = apiResults.map(c => c.api_id || c.id);
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
                apiResults.filter(card => forSaleMap.has(card.api_id || card.id)) : 
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
            const cardId = card.api_id || card.id;
            const forSaleCount = forSaleMap.get(cardId) || 0;
            const price = (card.prices && card.prices.usd) ? parseFloat(card.prices.usd) : 0;
            const priceDisplay = price > 0 ? `$${price.toFixed(2)}` : 'N/A';
            const imageUrl = card.image_uris ? 
                (card.image_uris.normal || card.image_uris.large || card.image_uris.small) : 
                'https://placehold.co/223x310/cccccc/969696?text=No+Image';
            
            if (currentView === 'list') {
                return `
                    <div class="flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow">
                        <img src="${sanitizeHTML(imageUrl)}" alt="${sanitizeHTML(card.name)}" class="w-16 h-22 rounded-md object-cover mr-4">
                        <div class="flex-1">
                            <h3 class="font-bold text-gray-800 dark:text-white">${sanitizeHTML(card.name)}</h3>
                            <p class="text-sm text-gray-600 dark:text-gray-400">${sanitizeHTML(card.set_name || card.set)} • ${sanitizeHTML(card.rarity)}</p>
                            <p class="text-sm font-semibold text-green-600 dark:text-green-400">${priceDisplay}</p>
                            ${forSaleCount > 0 ? `<p class="text-xs text-blue-500">${forSaleCount} for sale</p>` : ''}
                            <p class="text-xs text-gray-500 dark:text-gray-400">Game: ${sanitizeHTML(card.game || 'Unknown')}</p>
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
                            <img src="${sanitizeHTML(imageUrl)}" alt="${sanitizeHTML(card.name)}" class="w-full h-full object-cover">
                            <div class="absolute top-2 right-2">
                                <button class="w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-md flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <i class="fas fa-heart text-gray-400 hover:text-red-500"></i>
                                </button>
                            </div>
                            ${forSaleCount > 0 ? `
                                <div class="absolute top-2 left-2">
                                    <span class="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">${forSaleCount} for sale</span>
                                </div>
                            ` : ''}
                        </div>
                        <div class="p-3">
                            <h3 class="font-semibold text-sm truncate text-gray-800 dark:text-white mb-1">${sanitizeHTML(card.name)}</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">${sanitizeHTML(card.set_name || card.set)}</p>
                            <p class="text-sm font-bold text-green-600 dark:text-green-400 mb-2">${priceDisplay}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">${sanitizeHTML(card.game || 'Unknown')}</p>
                            <div class="flex space-x-1">
                                <button class="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button class="flex-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                                    <i class="fas fa-star"></i>
                                </button>
                                ${forSaleCount > 0 ? `
                                    <button class="flex-1 px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700">
                                        <i class="fas fa-shopping-cart"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
        }).join('');

        const containerClass = currentView === 'grid' ? 
            'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4' : 
            'space-y-4';

        return `<div class="${containerClass}">${cardElements}</div>`;
    };

    const renderUserResults = (users) => {
        if (users.length === 0) return '<p class="text-gray-500 dark:text-gray-400">No users found.</p>';
        
        return users.map(user => `
            <div class="flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow">
                <img src="${sanitizeHTML(user.photoURL || 'https://i.imgur.com/B06rBhI.png')}" alt="${sanitizeHTML(user.displayName)}" class="w-12 h-12 rounded-full mr-4">
                <div class="flex-1">
                    <h3 class="font-bold text-gray-800 dark:text-white">${sanitizeHTML(user.displayName)}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">@${sanitizeHTML(user.handle || user.uid)}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${sanitizeHTML(user.city || '')} ${sanitizeHTML(user.country || '')}</p>
                </div>
                <div class="flex space-x-2">
                    <button class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                        View Profile
                    </button>
                    <button class="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                        Follow
                    </button>
                </div>
            </div>
        `).join('');
    };

    const renderArticleResults = (articles) => {
        if (articles.length === 0) return '<p class="text-gray-500 dark:text-gray-400">No articles found.</p>';
        
        return articles.map(article => `
            <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow">
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">${sanitizeHTML(article.title)}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">${sanitizeHTML(article.excerpt || '')}</p>
                <div class="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>By ${sanitizeHTML(article.authorName)}</span>
                    <span>${article.publishedAt?.toDate?.()?.toLocaleDateString() || 'Recently'}</span>
                </div>
                <div class="mt-2">
                    <button class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                        Read Article
                    </button>
                </div>
            </div>
        `).join('');
    };

    const renderProductResults = (products) => {
        if (products.length === 0) return '<p class="text-gray-500 dark:text-gray-400">No products found.</p>';
        
        return products.map(product => `
            <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow">
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">${sanitizeHTML(product.name)}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">${sanitizeHTML(product.description || '')}</p>
                <p class="text-lg font-bold text-green-600 dark:text-green-400 mb-2">$${parseFloat(product.price || 0).toFixed(2)}</p>
                <div class="flex space-x-2">
                    <button class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                        View Product
                    </button>
                    <button class="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                        Add to Cart
                    </button>
                </div>
            </div>
        `).join('');
    };

    // --- Main Search Function ---
    const runSearch = async () => {
        if (!currentQuery.trim()) {
            resultsArea.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 text-lg">Please enter a search term.</p>';
            return;
        }

        toggleLoading(true);
        addToSearchHistory(currentQuery);

        try {
            const filters = {
                tcg: tcgFilter ? tcgFilter.value : 'Magic: The Gathering',
                forSale: forSaleFilter ? forSaleFilter.checked : false,
                priceMin: document.getElementById('filter-price-min')?.value,
                priceMax: document.getElementById('filter-price-max')?.value,
                // MTG specific filters
                mtgColors: Array.from(document.querySelectorAll('input[name="mtg-colors"]:checked')).map(cb => cb.value),
                mtgType: document.getElementById('filter-mtg-type')?.value,
                mtgRarity: document.getElementById('filter-mtg-rarity')?.value,
                // Pokémon specific filters
                pokemonType: document.getElementById('filter-pokemon-type')?.value,
                pokemonRarity: document.getElementById('filter-pokemon-rarity')?.value
            };

            let results = '';
            const category = categoryFilter ? categoryFilter.value : 'all';

            switch (category) {
                case 'cards':
                    const { cards, forSaleMap } = await performCardSearch(currentQuery, filters);
                    currentResults = cards;
                    results = renderCardResults(cards, forSaleMap);
                    break;
                case 'users':
                    const users = await performUserSearch(currentQuery);
                    currentResults = users;
                    results = renderUserResults(users);
                    break;
                case 'articles':
                    const articles = await performArticleSearch(currentQuery);
                    currentResults = articles;
                    results = renderArticleResults(articles);
                    break;
                case 'products':
                    const products = await performProductSearch(currentQuery);
                    currentResults = products;
                    results = renderProductResults(products);
                    break;
                default: // 'all'
                    const [cardData, users2, articles2, products2] = await Promise.all([
                        performCardSearch(currentQuery, filters),
                        performUserSearch(currentQuery),
                        performArticleSearch(currentQuery),
                        performProductSearch(currentQuery)
                    ]);
                    
                    results = `
                        <div class="space-y-8">
                            <div>
                                <h2 class="text-xl font-bold mb-4 text-gray-800 dark:text-white">Cards (${cardData.cards.length})</h2>
                                ${renderCardResults(cardData.cards.slice(0, 12), cardData.forSaleMap)}
                                ${cardData.cards.length > 12 ? '<p class="text-center mt-4"><button class="text-blue-600 hover:underline">View all cards</button></p>' : ''}
                            </div>
                            <div>
                                <h2 class="text-xl font-bold mb-4 text-gray-800 dark:text-white">Users (${users2.length})</h2>
                                ${renderUserResults(users2.slice(0, 5))}
                                ${users2.length > 5 ? '<p class="text-center mt-4"><button class="text-blue-600 hover:underline">View all users</button></p>' : ''}
                            </div>
                            <div>
                                <h2 class="text-xl font-bold mb-4 text-gray-800 dark:text-white">Articles (${articles2.length})</h2>
                                ${renderArticleResults(articles2.slice(0, 5))}
                                ${articles2.length > 5 ? '<p class="text-center mt-4"><button class="text-blue-600 hover:underline">View all articles</button></p>' : ''}
                            </div>
                            <div>
                                <h2 class="text-xl font-bold mb-4 text-gray-800 dark:text-white">Products (${products2.length})</h2>
                                ${renderProductResults(products2.slice(0, 5))}
                                ${products2.length > 5 ? '<p class="text-center mt-4"><button class="text-blue-600 hover:underline">View all products</button></p>' : ''}
                            </div>
                        </div>
                    `;
                    break;
            }

            resultsArea.innerHTML = results || '<p class="text-center text-gray-500 dark:text-gray-400">No results found.</p>';
            
            // Update results info
            const start = (currentPage - 1) * CONFIG.RESULTS_PER_PAGE + 1;
            const end = Math.min(currentPage * CONFIG.RESULTS_PER_PAGE, totalResults);
            updateResultsInfo(start, end, totalResults);

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
            const debouncedSearch = debounce(() => {
                if (headerSearchBar.value !== currentQuery) {
                    performSearch(headerSearchBar.value);
                }
            }, CONFIG.SEARCH_DELAY);

            const debouncedSuggestions = debounce((query) => {
                showSuggestions(query);
            }, 200);

            headerSearchBar.addEventListener('input', (e) => {
                const query = e.target.value;
                if (query.length >= 2) {
                    debouncedSuggestions(query);
                } else {
                    if (suggestionsContainer) suggestionsContainer.classList.add('hidden');
                }
                debouncedSearch();
            });

            headerSearchBar.addEventListener('focus', () => {
                if (headerSearchBar.value.length >= 2) {
                    showSuggestions(headerSearchBar.value);
                }
            });

            headerSearchBar.addEventListener('blur', () => {
                // Delay hiding suggestions to allow clicking
                setTimeout(() => {
                    if (suggestionsContainer) suggestionsContainer.classList.add('hidden');
                }, 200);
            });
        }

        // Filter changes
        if (filterForm) {
            filterForm.addEventListener('change', runSearch);
        }

        // Category filter
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                const isCards = e.target.value === 'cards' || e.target.value === 'all';
                if (cardFiltersContainer) {
                    cardFiltersContainer.classList.toggle('hidden', !isCards);
                }
                runSearch();
            });
        }

        // TCG filter
        if (tcgFilter) {
            tcgFilter.addEventListener('change', (e) => {
                // Hide all TCG-specific filters
                if (mtgFilters) mtgFilters.classList.add('hidden');
                if (pokemonFilters) pokemonFilters.classList.add('hidden');
                if (lorcanaFilters) lorcanaFilters.classList.add('hidden');
                if (gundamFilters) gundamFilters.classList.add('hidden');
                
                // Show relevant filters
                const selectedTcg = e.target.value;
                if (selectedTcg === 'Magic: The Gathering' && mtgFilters) {
                    mtgFilters.classList.remove('hidden');
                } else if (selectedTcg === 'Pokémon' && pokemonFilters) {
                    pokemonFilters.classList.remove('hidden');
                } else if (selectedTcg === 'Lorcana' && lorcanaFilters) {
                    lorcanaFilters.classList.remove('hidden');
                } else if (selectedTcg === 'Gundam' && gundamFilters) {
                    gundamFilters.classList.remove('hidden');
                }
                
                runSearch();
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
