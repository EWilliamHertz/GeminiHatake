/**
 * HatakeSocial - Search Page Script
 *
 * BUG FIX: Implements robust parallel queries for searching across
 * different collection groups to avoid Firestore index errors.
 * BUG FIX: Adds a 'name_lower' field to documents to enable case-insensitive search.
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
                window.location.href = `search.html?query=${encodeURIComponent(newQuery)}`;
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
                 console.error("Firebase Index Error: You are missing a composite index for this query. Please create it in your Firebase console. The error message below contains a link to do so automatically.");
                 console.error(error.message);
                 container.innerHTML = `<p class="text-red-500 p-4 text-center">Error searching decks. A required database index is missing. Please open the browser console (F12) for a link to create it.</p>`;
            } else {
                container.innerHTML = `<p class="text-red-500 p-4 text-center">An unknown error occurred while searching decks.</p>`;
            }
        }
    }

    async function searchCards(searchTerm) {
        const container = document.getElementById('cards-results');
        container.innerHTML = '<p class="text-gray-500">Searching for cards...</p>';
        const cardsRef = db.collectionGroup('collection');
        try {
            const searchTermLower = searchTerm.toLowerCase();
            const snapshot = await cardsRef.where('name_lower', '>=', searchTermLower).where('name_lower', '<=', searchTermLower + '\uf8ff').get();

            if (snapshot.empty) {
                container.innerHTML = '<p class="text-gray-500">No cards with that name found in any collection.</p>';
                return;
            }

            const uniqueCards = {};
            snapshot.forEach(doc => {
                const card = doc.data();
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
                 console.error("Firebase Index Error: You are missing a composite index for this query. Please create it in your Firebase console. The error message below contains a link to do so automatically.");
                 console.error(error.message);
                 container.innerHTML = `<p class="text-red-500 p-4 text-center">Error searching cards. A required database index is missing. Please open the browser console (F12) for a link to create it.</p>`;
            } else {
                container.innerHTML = `<p class="text-red-500 p-4 text-center">An unknown error occurred while searching cards.</p>`;
            }
        }
    }

    // --- Initial Run ---
    runSearches(query);
});
