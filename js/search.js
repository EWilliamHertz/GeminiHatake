*/
document.addEventListener('authReady', (e) => {
    const db = firebase.firestore();
    const params = new URLSearchParams(window.location.search);
    const query = params.get('query');

    const searchQueryDisplay = document.getElementById('search-query-display');
    const searchBarPage = document.getElementById('search-bar-page');
    const searchFormPage = document.getElementById('search-form-page');

    if (searchQueryDisplay) {
        searchQueryDisplay.textContent = query;
    }
    if(searchBarPage) {
        searchBarPage.value = query;
    }

    if (searchFormPage) {
        searchFormPage.addEventListener('submit', (e) => {
            e.preventDefault();
            const newQuery = searchBarPage.value;
            if (newQuery) {
                window.location.href = `search.html?query=${encodeURIComponent(newQuery)}`;
            }
        });
    }

    if (query) {
        searchUsers(query);
        searchDecks(query);
        searchCards(query);
    }

    async function searchUsers(searchTerm) {
        const container = document.getElementById('users-results');
        container.innerHTML = '<p class="text-gray-500">Searching for users...</p>';
        const usersRef = db.collection('users');
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
        const snapshot = await decksRef.orderBy('name').startAt(searchTerm).endAt(searchTerm + '\uf8ff').get();

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
    }

    async function searchCards(searchTerm) {
        const container = document.getElementById('cards-results');
        container.innerHTML = '<p class="text-gray-500">Searching for cards...</p>';
        const cardsRef = db.collectionGroup('collection');
        const snapshot = await cardsRef.where('name', '>=', searchTerm).where('name', '<=', searchTerm + '\uf8ff').get();

        if (snapshot.empty) {
            container.innerHTML = '<p class="text-gray-500">No cards with that name found in any collection.</p>';
            return;
        }

        const uniqueCards = {};
        snapshot.forEach(doc => {
            const card = doc.data();
            if (!uniqueCards[card.name]) {
                uniqueCards[card.name] = {
                    name: card.name,
                    imageUrl: card.imageUrl,
                    count: 0
                };
            }
            if (card.forSale) {
                uniqueCards[card.name].count++;
            }
        });

        container.innerHTML = '';
        Object.values(uniqueCards).forEach(card => {
            const cardHTML = `
                <a href="marketplace.html?cardName=${encodeURIComponent(card.name)}" class="block bg-white rounded-lg shadow-md p-2 transition hover:shadow-xl hover:-translate-y-1">
                    <img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded-md">
                    <div class="p-2 text-center">
                         <p class="font-semibold text-sm">${card.name}</p>
                         ${card.count > 0 ? `<p class="text-xs text-blue-600">${card.count} listing(s) available</p>` : '<p class="text-xs text-gray-500">View in Marketplace</p>'}
                    </div>
                </a>
            `;
            container.innerHTML += cardHTML;
        });
    }
});
