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
        // This type of query requires an index in Firestore. 
        // If it fails, Firebase will provide a link in the browser console to create it.
        const snapshot = await usersRef.orderBy('displayName').startAt(searchTerm).endAt(searchTerm + '\uf8ff').get();

        if (snapshot.empty) {
            container.innerHTML = '<p class="text-gray-500">No users found.</p>';
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            const userCard = `
                <a href="profile.html?user=${user.handle}" class="bg-white p-4 rounded-lg shadow-md flex items-center space-x-4 hover:shadow-lg transition-shadow">
                    <img src="${user.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${user.displayName}" class="w-16 h-16 rounded-full object-cover">
                    <div>
                        <h3 class="font-bold text-lg">${user.displayName}</h3>
                        <p class="text-gray-500">@${user.handle}</p>
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
            // This query requires a composite index in Firestore. 
            // The console error will provide a direct link to create it.
            const snapshot = await decksRef.where('name', '>=', searchTerm).where('name', '<=', searchTerm + '\uf8ff').get();

            if (snapshot.empty) {
                container.innerHTML = '<p class="text-gray-500">No decks found.</p>';
                return;
            }

            container.innerHTML = '';
            snapshot.forEach(doc => {
                const deck = doc.data();
                const deckCard = `
                    <a href="deck.html?deckId=${doc.id}" class="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow block">
                        <h3 class="font-bold text-lg truncate">${deck.name}</h3>
                        <p class="text-gray-500">by ${deck.authorName}</p>
                        <p class="text-sm text-gray-400 mt-2">${deck.format || deck.tcg}</p>
                    </a>
                `;
                container.innerHTML += deckCard;
            });
        } catch (error) {
            console.error("Deck search error: ", error);
            container.innerHTML = `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                <p class="font-bold">Permission Error</p>
                <p>Could not search decks. Please check the browser console (F12) for an error message. It may contain a link to create the required database index in Firebase.</p>
            </div>`;
        }
    }

    async function searchCards(searchTerm) {
        const container = document.getElementById('cards-results');
        container.innerHTML = '<p class="text-gray-500">Searching for cards...</p>';
        const cardsRef = db.collectionGroup('collection');
        try {
            // This query also requires a composite index.
            const snapshot = await cardsRef.where('name', '>=', searchTerm).where('name', '<=', searchTerm + '\uf8ff').get();

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
                    <a href="marketplace.html?cardName=${encodeURIComponent(card.name)}" class="block bg-white rounded-lg shadow-md p-2 transition hover:shadow-xl hover:-translate-y-1">
                        <img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded-md" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                        <div class="p-2 text-center">
                             <p class="font-semibold text-sm">${card.name}</p>
                             ${card.count > 0 ? `<p class="text-xs text-blue-600">${card.count} listing(s) available</p>` : '<p class="text-xs text-gray-500">View in Marketplace</p>'}
                        </div>
                    </a>
                `;
                container.innerHTML += cardHTML;
            });
        } catch (error) {
            console.error("Card search error: ", error);
             container.innerHTML = `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                <p class="font-bold">Permission Error</p>
                <p>Could not search cards. Please check the browser console (F12) for an error message. It may contain a link to create the required database index in Firebase.</p>
            </div>`;
        }
    }

    // --- Initial Run ---
    runSearches(query);
});
