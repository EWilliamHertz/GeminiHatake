/**
 * HatakeSocial - Search Page Script (v3 - Advanced Filters)
 *
 * This version adds advanced filtering options for card searches.
 * - Filters by card type, color, mana value, and price.
 * - Combines Firestore queries with client-side filtering for complex searches.
 */
document.addEventListener('authReady', (e) => {
    const db = firebase.firestore();
    const params = new URLSearchParams(window.location.search);
    const query = params.get('query');

    // --- DOM Elements ---
    const searchQueryDisplay = document.getElementById('search-query-display');
    const searchBarPage = document.getElementById('search-bar-page');
    const searchFormPage = document.getElementById('search-form-page');
    
    const filterForm = document.getElementById('filter-form');
    const filterUsersCheckbox = document.getElementById('filter-users');
    const filterDecksCheckbox = document.getElementById('filter-decks');
    const filterCardsCheckbox = document.getElementById('filter-cards');
    
    // Advanced Filter Elements
    const filterCardType = document.getElementById('filter-card-type');
    const filterColor = document.getElementById('filter-color');
    const filterManaValue = document.getElementById('filter-mana-value');
    const filterPriceMin = document.getElementById('filter-price-min');
    const filterPriceMax = document.getElementById('filter-price-max');

    // --- Helper to generate a Firestore index creation link ---
    const generateIndexCreationLink = (collection, fields) => {
        const projectId = db.app.options.projectId;
        let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=${collection}`;
        fields.forEach(field => {
            url += `&fields=${field.name},${field.order.toUpperCase()}`;
        });
        return url;
    };

    // --- Initial Setup ---
    if (searchQueryDisplay) {
        searchQueryDisplay.textContent = query || '';
    }
    if (searchBarPage) {
        searchBarPage.value = query || '';
    }

    // --- Event Listeners ---
    if (searchFormPage) {
        searchFormPage.addEventListener('submit', (e) => {
            e.preventDefault();
            const newQuery = searchBarPage.value.trim();
            if (newQuery) {
                // Build a new query string with all filters
                const params = new URLSearchParams();
                params.set('query', newQuery);
                if (filterCardType.value) params.set('type', filterCardType.value);
                if (filterColor.value) params.set('color', filterColor.value);
                if (filterManaValue.value) params.set('cmc', filterManaValue.value);
                if (filterPriceMin.value) params.set('minPrice', filterPriceMin.value);
                if (filterPriceMax.value) params.set('maxPrice', filterPriceMax.value);

                window.location.href = `search.html?${params.toString()}`;
            }
        });
    }

    if (filterForm) {
        filterForm.addEventListener('change', () => {
            runSearches(query);
        });
    }

    // --- Search Functions ---
    function runSearches(searchTerm) {
        if (!searchTerm) return;

        document.getElementById('users-results-container').style.display = filterUsersCheckbox.checked ? 'block' : 'none';
        document.getElementById('decks-results-container').style.display = filterDecksCheckbox.checked ? 'block' : 'none';
        document.getElementById('cards-results-container').style.display = filterCardsCheckbox.checked ? 'block' : 'none';

        if (filterUsersCheckbox.checked) searchUsers(searchTerm);
        if (filterDecksCheckbox.checked) searchDecks(searchTerm);
        if (filterCardsCheckbox.checked) searchCards(searchTerm);
    }

    async function searchUsers(searchTerm) {
        const container = document.getElementById('users-results');
        container.innerHTML = '<p class="text-gray-500">Searching for users...</p>';
        const usersRef = db.collection('users');
        const searchTermLower = searchTerm.toLowerCase();
        const snapshot = await usersRef.orderBy('displayName_lower').startAt(searchTermLower).endAt(searchTermLower + '\uf8ff').get();

        if (snapshot.empty) {
            container.innerHTML = '<p class="text-gray-500">No users found.</p>';
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            const userCard = `
                <a href="profile.html?uid=${doc.id}" class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center space-x-4 hover:shadow-lg transition-shadow">
                    <img src="${user.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${user.displayName}" class="w-16 h-16 rounded-full object-cover">
                    <div>
                        <h3 class="font-bold text-lg text-gray-800 dark:text-white">${user.displayName}</h3>
                        <p class="text-gray-500 dark:text-gray-400">@${user.handle}</p>
                    </div>
                </a>
            `;
            container.innerHTML += userCard;
        });
    }

    async function searchDecks(searchTerm) {
        const container = document.getElementById('decks-results');
        container.innerHTML = '<p class="text-gray-500">Searching for decks...</p>';
        const decksRef = db.collectionGroup('decks');
        try {
            const searchTermLower = searchTerm.toLowerCase();
            const snapshot = await decksRef.where('name_lower', '>=', searchTermLower).where('name_lower', '<=', searchTermLower + '\uf8ff').get();

            if (snapshot.empty) {
                container.innerHTML = '<p class="text-gray-500">No decks found.</p>';
                return;
            }

            container.innerHTML = '';
            snapshot.forEach(doc => {
                const deck = doc.data();
                const deckCard = `
                    <a href="deck.html?deckId=${doc.id}" class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow block">
                        <h3 class="font-bold text-lg truncate text-gray-800 dark:text-white">${deck.name}</h3>
                        <p class="text-gray-500 dark:text-gray-400">by ${deck.authorName}</p>
                        <p class="text-sm text-gray-400 mt-2">${deck.format || deck.tcg}</p>
                    </a>
                `;
                container.innerHTML += deckCard;
            });
        } catch (error) {
            console.error("Deck search error: ", error);
            if (error.code === 'failed-precondition') {
                 const indexLink = generateIndexCreationLink('decks', [{ name: 'name_lower', order: 'asc' }]);
                 const errorMessage = `
                    <div class="col-span-full text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">
                        <p class="font-bold text-red-700 dark:text-red-300">Database Error</p>
                        <p class="text-red-600 dark:text-red-400 mt-2">A required database index is missing for this query.</p>
                        <a href="${indexLink}" target="_blank" rel="noopener noreferrer" 
                           class="mt-4 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700">
                           Click Here to Create the Index
                        </a>
                        <p class="text-xs text-gray-500 mt-2">This will open the Firebase console. Click "Save" to create the index. It may take a few minutes to build.</p>
                    </div>
                 `;
                 container.innerHTML = errorMessage;
            } else {
                container.innerHTML = `<p class="text-red-500 p-4 text-center">An unknown error occurred while searching decks.</p>`;
            }
        }
    }

    async function searchCards(searchTerm) {
        const container = document.getElementById('cards-results');
        container.innerHTML = '<p class="text-gray-500">Searching for cards...</p>';
        let cardsQuery = db.collectionGroup('collection');
        
        try {
            const searchTermLower = searchTerm.toLowerCase();
            if (searchTerm) {
                 cardsQuery = cardsQuery.where('name_lower', '>=', searchTermLower).where('name_lower', '<=', searchTermLower + '\uf8ff');
            }
            // Add other filters if available
            // Note: Firestore has limitations on combining inequality filters.
            // For a production app, a dedicated search service like Algolia would be better here.
            // For now, we will perform some filtering on the client side.

            const snapshot = await cardsQuery.get();

            if (snapshot.empty) {
                container.innerHTML = '<p class="text-gray-500">No cards with that name found in any collection.</p>';
                return;
            }
            
            let allCards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Client-side filtering for advanced fields
            const typeFilter = filterCardType.value;
            const colorFilter = filterColor.value;
            const cmcFilter = parseInt(filterManaValue.value, 10);
            const minPriceFilter = parseFloat(filterPriceMin.value);
            const maxPriceFilter = parseFloat(filterPriceMax.value);

            if (typeFilter) allCards = allCards.filter(c => c.type_line && c.type_line.includes(typeFilter));
            if (colorFilter) allCards = allCards.filter(c => c.colors && c.colors.includes(colorFilter));
            if (!isNaN(cmcFilter)) allCards = allCards.filter(c => c.cmc === cmcFilter);
            if (!isNaN(minPriceFilter)) allCards = allCards.filter(c => parseFloat(c.priceUsd) >= minPriceFilter);
            if (!isNaN(maxPriceFilter)) allCards = allCards.filter(c => parseFloat(c.priceUsd) <= maxPriceFilter);

            const uniqueCards = {};
            allCards.forEach(card => {
                if (!uniqueCards[card.name]) {
                    uniqueCards[card.name] = { name: card.name, imageUrl: card.imageUrl, count: 0 };
                }
                if (card.forSale) {
                    uniqueCards[card.name].count++;
                }
            });

            container.innerHTML = '';
            Object.values(uniqueCards).forEach(card => {
                const cardHTML = `
                    <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 transition hover:shadow-xl hover:-translate-y-1">
                        <img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded-md" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                        <div class="p-2 text-center">
                             <p class="font-semibold text-sm text-gray-800 dark:text-white">${card.name}</p>
                             ${card.count > 0 ? `<p class="text-xs text-blue-600">${card.count} listing(s) available</p>` : '<p class="text-xs text-gray-500">View Listings</p>'}
                        </div>
                    </a>
                `;
                container.innerHTML += cardHTML;
            });
        } catch (error) {
            console.error("Card search error: ", error);
            if (error.code === 'failed-precondition') {
                 const indexLink = generateIndexCreationLink('collection', [{ name: 'name_lower', order: 'asc' }]);
                 const errorMessage = `
                    <div class="col-span-full text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">
                        <p class="font-bold text-red-700 dark:text-red-300">Database Error</p>
                        <p class="text-red-600 dark:text-red-400 mt-2">A required database index is missing for this query.</p>
                        <a href="${indexLink}" target="_blank" rel="noopener noreferrer" 
                           class="mt-4 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700">
                           Click Here to Create the Index
                        </a>
                        <p class="text-xs text-gray-500 mt-2">This will open the Firebase console. Click "Save" to create the index. It may take a few minutes to build.</p>
                    </div>
                 `;
                 container.innerHTML = errorMessage;
            } else {
                container.innerHTML = `<p class="text-red-500 p-4 text-center">An unknown error occurred while searching cards.</p>`;
            }
        }
    }

    // --- Initial Run ---
    runSearches(query);
});
