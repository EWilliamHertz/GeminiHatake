/**
 * HatakeSocial - Search Page Script (v4 - Complete Overhaul)
 *
 * - Handles all search logic for the platform, including Cards, Users, Articles, and Products.
 * - Dynamically shows/hides advanced filter options based on selected categories.
 * - Fetches card data from external APIs (Scryfall for MTG, Pokémon TCG for Pokémon).
 * - Queries Firestore for internal data (Users, Articles, Products, and card sale status).
 * - Displays a loading indicator during searches.
 */
document.addEventListener('authReady', () => {
    const db = firebase.firestore();
    let user = firebase.auth().currentUser;

    // --- DOM Elements ---
    const searchQueryDisplay = document.getElementById('search-query-display');
    const headerSearchBar = document.getElementById('main-search-bar');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsArea = document.getElementById('search-results-area');
    const filterForm = document.getElementById('search-filter-form');

    // Filter Inputs
    const categoryFilter = document.getElementById('filter-category');
    const cardFiltersContainer = document.getElementById('card-filters-container');
    const tcgFilter = document.getElementById('filter-tcg');
    const forSaleFilter = document.getElementById('filter-for-sale');
    const mtgFilters = document.getElementById('mtg-filters');
    const pokemonFilters = document.getElementById('pokemon-filters');
    const allFilterInputs = filterForm.querySelectorAll('input, select');

    // --- State ---
    let currentQuery = '';

    // --- Helper Functions ---
    const sanitizeHTML = (str) => {
        const temp = document.createElement('div');
        temp.textContent = str || '';
        return temp.innerHTML;
    };

    const toggleLoading = (isLoading) => {
        loadingIndicator.classList.toggle('hidden', !isLoading);
        resultsArea.classList.toggle('hidden', isLoading);
    };

    // --- Render Functions ---
    const renderSection = (id, title, content) => {
        if (!content) return '';
        return `
            <div id="${id}-results-container" class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-semibold mb-4 border-b dark:border-gray-600 pb-2">${title}</h2>
                <div id="${id}-results">${content}</div>
            </div>
        `;
    };

    const renderNoResults = (type) => `<p class="text-gray-500 dark:text-gray-400">No ${type} found.</p>`;

    const renderUserResults = (users) => {
        if (users.length === 0) return renderNoResults('users');
        const userCards = users.map(user => `
            <a href="profile.html?uid=${user.id}" class="flex items-center p-3 -mx-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <img src="${sanitizeHTML(user.photoURL) || 'https://i.imgur.com/B06rBhI.png'}" alt="${sanitizeHTML(user.displayName)}" class="w-12 h-12 rounded-full object-cover mr-4">
                <div>
                    <h3 class="font-bold text-gray-800 dark:text-white">${sanitizeHTML(user.displayName)}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">@${sanitizeHTML(user.handle)}</p>
                </div>
            </a>
        `).join('');
        return `<div class="space-y-2">${userCards}</div>`;
    };
    
    const renderArticleResults = (articles) => {
        if (articles.length === 0) return renderNoResults('articles');
        const articleCards = articles.map(article => `
             <a href="article-view.html?id=${article.id}" class="block p-3 -mx-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <h3 class="font-bold text-lg text-blue-600 dark:text-blue-400">${sanitizeHTML(article.title)}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">${sanitizeHTML(article.summary || '')}</p>
                <p class="text-xs text-gray-400 mt-1">By ${sanitizeHTML(article.authorName)}</p>
            </a>
        `).join('');
        return `<div class="space-y-4">${articleCards}</div>`;
    };

    const renderProductResults = (products) => {
        if (products.length === 0) return renderNoResults('shop products');
         const productCards = products.map(product => `
             <a href="product-view.html?id=${product.id}" class="flex items-center p-3 -mx-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                 <img src="${sanitizeHTML(product.imageUrl) || 'https://placehold.co/100'}" alt="${sanitizeHTML(product.name)}" class="w-16 h-16 rounded-md object-cover mr-4">
                 <div>
                    <h3 class="font-bold text-gray-800 dark:text-white">${sanitizeHTML(product.name)}</h3>
                    <p class="text-sm font-semibold text-green-600 dark:text-green-400">${window.HatakeSocial.convertAndFormatPrice(product.price, product.currency)}</p>
                 </div>
            </a>
         `).join('');
        return `<div class="space-y-2">${productCards}</div>`;
    };
    
    const renderCardResults = (cards, forSaleMap) => {
        if (cards.length === 0) return renderNoResults('cards');
        const cardGrid = cards.map(card => {
             const forSaleCount = forSaleMap.get(card.id) || 0;
             return `
                <a href="card-view.html?id=${card.id}&api=${card.api}" class="block text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow-md p-2 transition hover:shadow-xl hover:-translate-y-1">
                    <img src="${sanitizeHTML(card.imageUrl)}" alt="${sanitizeHTML(card.name)}" class="w-full rounded-md aspect-[0.71]" loading="lazy">
                    <div class="pt-2">
                        <p class="font-semibold text-sm truncate text-gray-800 dark:text-white">${sanitizeHTML(card.name)}</p>
                         ${forSaleCount > 0 
                            ? `<p class="text-xs text-blue-500 font-semibold">${forSaleCount} for sale</p>` 
                            : '<p class="text-xs text-gray-500">Check Listings</p>'}
                    </div>
                </a>
             `;
        }).join('');
        return `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">${cardGrid}</div>`;
    };


    // --- Search Functions ---
    const performUserSearch = async (term) => {
        const usersRef = db.collection('users');
        const termLower = term.toLowerCase();
        const snapshot = await usersRef.orderBy('displayName_lower').startAt(termLower).endAt(termLower + '\uf8ff').limit(10).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    const performArticleSearch = async (term) => {
        // NOTE: Firestore does not support full-text search natively. This is a basic "tags" or "title" search.
        // For a real app, use a dedicated search service like Algolia, Typesense, or Meilisearch.
        const articlesRef = db.collection('articles');
        const termLower = term.toLowerCase();
        // This query requires a composite index on (keywords, publishedAt).
        const snapshot = await articlesRef.where('keywords', 'array-contains', termLower).orderBy('publishedAt', 'desc').limit(10).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    const performProductSearch = async (term) => {
        const productsRef = db.collection('products');
        const termLower = term.toLowerCase();
        const snapshot = await productsRef.where('searchTerms', 'array-contains', termLower).limit(10).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    const performCardSearch = async (term, filters) => {
        try {
            let apiResults = [];
            if (filters.tcg === 'mtg') {
                let scryfallQuery = term;
                if (filters.color) scryfallQuery += ` color=${filters.color}`;
                if (filters.type) scryfallQuery += ` t:${filters.type}`;
                if (filters.artist) scryfallQuery += ` a:"${filters.artist}"`;
                
                const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(scryfallQuery)}`);
                if (!response.ok) return [];
                const data = await response.json();
                apiResults = data.data.map(card => ({
                    id: card.id,
                    name: card.name,
                    imageUrl: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal,
                    api: 'scryfall'
                }));
            } else if (filters.tcg === 'pokemon') {
                // WARNING: THIS IS INSECURE. The API key should be in a Cloud Function.
                const POKEMON_TCG_API_KEY = '60a08d4a-3a34-43d8-8f41-827b58cfac6d'; // Replace with your actual key
                let pokemonQuery = `name:"${term}*"`;
                if(filters.type) pokemonQuery += ` types:${filters.type}`;
                if(filters.supertype) pokemonQuery += ` supertype:${filters.supertype}`;
                if(filters.rarity) pokemonQuery += ` rarity:"${filters.rarity}"`;

                const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(pokemonQuery)}`, {
                    headers: { 'X-Api-Key': POKEMON_TCG_API_KEY }
                });
                if (!response.ok) return [];
                const data = await response.json();
                apiResults = data.data.map(card => ({
                    id: card.id,
                    name: card.name,
                    imageUrl: card.images.large,
                    api: 'pokemontcg'
                }));
            }
            
            if (apiResults.length === 0) return { cards: [], forSaleMap: new Map() };

            const cardIds = apiResults.map(c => c.id);
            const forSaleMap = new Map();
            
            // Firestore allows 'in' queries for up to 10 items at a time. We must batch.
            const batches = [];
            for (let i = 0; i < cardIds.length; i += 10) {
                batches.push(cardIds.slice(i, i + 10));
            }

            for (const batch of batches) {
                const collectionRef = db.collectionGroup('collection')
                    .where('apiId', 'in', batch)
                    .where('forSale', '==', true);
                const snapshot = await collectionRef.get();
                snapshot.forEach(doc => {
                    const cardData = doc.data();
                    const count = forSaleMap.get(cardData.apiId) || 0;
                    forSaleMap.set(cardData.apiId, count + 1);
                });
            }

            // Client-side filter for "for sale" if checked
            const finalCards = filters.forSale ? apiResults.filter(card => forSaleMap.has(card.id)) : apiResults;

            return { cards: finalCards, forSaleMap };

        } catch (error) {
            console.error("Card search error:", error);
            return { cards: [], forSaleMap: new Map() };
        }
    };


    // --- Main Execution ---
    const runSearch = async () => {
        toggleLoading(true);

        const category = categoryFilter.value;
        
        let usersHTML = '', articlesHTML = '', productsHTML = '', cardsHTML = '';

        const cardSearchFilters = {
            tcg: tcgFilter.value,
            forSale: forSaleFilter.checked,
            // MTG
            color: document.getElementById('mtg-color-filter').value,
            type: document.getElementById('mtg-type-filter').value.trim(),
            artist: document.getElementById('mtg-artist-filter').value.trim(),
            // Pokemon
            supertype: document.getElementById('pokemon-supertype-filter').value,
            type: document.getElementById('pokemon-type-filter').value.trim(),
            rarity: document.getElementById('pokemon-rarity-filter').value.trim()
        };

        const promises = [];
        if (category === 'all' || category === 'users') {
            promises.push(performUserSearch(currentQuery).then(res => { usersHTML = renderSection('users', 'Users', renderUserResults(res)); }));
        }
        if (category === 'all' || category === 'articles') {
            promises.push(performArticleSearch(currentQuery).then(res => { articlesHTML = renderSection('articles', 'Articles', renderArticleResults(res)); }));
        }
        if (category === 'all' || category === 'products') {
            promises.push(performProductSearch(currentQuery).then(res => { productsHTML = renderSection('products', 'Shop Products', renderProductResults(res)); }));
        }
        if (category === 'all' || category === 'cards') {
            promises.push(performCardSearch(currentQuery, cardSearchFilters).then(res => { cardsHTML = renderSection('cards', 'Cards', renderCardResults(res.cards, res.forSaleMap)); }));
        }

        await Promise.all(promises);

        resultsArea.innerHTML = usersHTML + articlesHTML + productsHTML + cardsHTML;
        
        if (resultsArea.innerHTML.trim() === '') {
            resultsArea.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 text-lg">No results found for "${sanitizeHTML(currentQuery)}". Try a different search term or adjust your filters.</p>`;
        }

        toggleLoading(false);
    };

    // --- Event Listeners and Initialization ---
    const setupEventListeners = () => {
        allFilterInputs.forEach(input => {
            input.addEventListener('change', runSearch);
        });
        
        // Also listen for typing in text inputs
        document.getElementById('mtg-type-filter').addEventListener('keyup', runSearch);
        document.getElementById('mtg-artist-filter').addEventListener('keyup', runSearch);
        document.getElementById('pokemon-type-filter').addEventListener('keyup', runSearch);
        document.getElementById('pokemon-rarity-filter').addEventListener('keyup', runSearch);

        categoryFilter.addEventListener('change', (e) => {
            cardFiltersContainer.classList.toggle('hidden', e.target.value !== 'cards');
        });

        tcgFilter.addEventListener('change', (e) => {
            mtgFilters.classList.toggle('hidden', e.target.value !== 'mtg');
            pokemonFilters.classList.toggle('hidden', e.target.value !== 'pokemon');
        });
    };

    const initialize = () => {
        const params = new URLSearchParams(window.location.search);
        currentQuery = params.get('query') || '';

        if (!currentQuery) {
            resultsArea.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 text-lg">Please enter a search term in the bar above.</p>';
            return;
        }

        searchQueryDisplay.textContent = currentQuery;
        headerSearchBar.value = currentQuery;

        setupEventListeners();
        // Trigger initial visibility of card filters if needed
        categoryFilter.dispatchEvent(new Event('change'));
        tcgFilter.dispatchEvent(new Event('change'));

        runSearch();
    };

    initialize();
});