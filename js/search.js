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
        const usersResultsContainer = document.getElementById('users-results');
        usersResultsContainer.innerHTML = '<p>Searching for users...</p>';
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('displayName', '>=', searchTerm).where('displayName', '<=', searchTerm + '\uf8ff').get();

        if (snapshot.empty) {
            usersResultsContainer.innerHTML = '<p>No users found.</p>';
            return;
        }

        usersResultsContainer.innerHTML = '';
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
            usersResultsContainer.innerHTML += userCard;
        });
    }

    async function searchDecks(searchTerm) {
        const decksResultsContainer = document.getElementById('decks-results');
        decksResultsContainer.innerHTML = '<p>Searching for decks...</p>';
        const decksRef = db.collectionGroup('decks');
        const snapshot = await decksRef.where('name', '>=', searchTerm).where('name', '<=', searchTerm + '\uf8ff').get();

        if (snapshot.empty) {
            decksResultsContainer.innerHTML = '<p>No decks found.</p>';
            return;
        }

        decksResultsContainer.innerHTML = '';
        snapshot.forEach(doc => {
            const deck = doc.data();
            const deckCard = `
                <a href="deck.html?deckId=${doc.id}" class="bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                    <h3 class="font-bold text-lg">${deck.name}</h3>
                    <p class="text-gray-500">by ${deck.authorName}</p>
                    <p class="text-sm text-gray-400">${deck.format || deck.tcg}</p>
                </a>
            `;
            decksResultsContainer.innerHTML += deckCard;
        });
    }

    async function searchCards(searchTerm) {
        const cardsResultsContainer = document.getElementById('cards-results');
        cardsResultsContainer.innerHTML = '<p>Searching for cards...</p>';
        const cardsRef = db.collectionGroup('collection');
        const snapshot = await cardsRef.where('name', '>=', searchTerm).where('name', '<=', searchTerm + '\uf8ff').get();

        if (snapshot.empty) {
            cardsResultsContainer.innerHTML = '<p>No cards found in any collection.</p>';
            return;
        }

        cardsResultsContainer.innerHTML = '';
        snapshot.forEach(doc => {
            const card = doc.data();
            const cardImage = `
                <div class="bg-white rounded-lg shadow-md p-2">
                    <img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded-md">
                </div>
            `;
            cardsResultsContainer.innerHTML += cardImage;
        });
    }
});
