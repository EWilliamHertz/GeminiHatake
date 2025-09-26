document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    let currentUser = null;

    const listingsContainer = document.getElementById('listings-container');
    const noResultsDiv = document.getElementById('no-results');
    const searchInput = document.getElementById('search-input');
    const sortOrderSelect = document.getElementById('sort-order');
    const gameFilterContainer = document.getElementById('game-filter-container');
    const rarityFilterContainer = document.getElementById('rarity-filter-container');
    const gradedFilterCheckbox = document.getElementById('filter-graded');
    const gameSpecificFiltersContainer = document.getElementById('game-specific-filters');

    const supportedGames = {
        'mtg': 'Magic: The Gathering',
        'pokemon': 'Pokémon',
        'lorcana': 'Lorcana',
        'gundam': 'Gundam'
    };

    const rarities = ['common', 'uncommon', 'rare', 'mythic', 'promo'];

    let activeFilters = {
        searchText: '',
        games: [],
        rarities: [],
        isGraded: false,
        mtgColors: [],
        pokemonTypes: []
    };

    const init = () => {
        firebase.auth().onAuthStateChanged(user => {
            currentUser = user;
            setupUI();
            addEventListeners();
            fetchListings();
        });
    };

    const setupUI = () => {
        // Populate Game Filters
        gameFilterContainer.innerHTML = '';
        for (const [id, name] of Object.entries(supportedGames)) {
            gameFilterContainer.innerHTML += `
                <label class="flex items-center space-x-2 text-sm font-medium">
                    <input type="checkbox" class="game-filter rounded" value="${id}">
                    <span>${name}</span>
                </label>
            `;
        }

        // Populate Rarity Filters
        rarityFilterContainer.innerHTML = '';
        rarities.forEach(rarity => {
            rarityFilterContainer.innerHTML += `
                <label class="flex items-center space-x-2 text-sm font-medium">
                    <input type="checkbox" class="rarity-filter rounded" value="${rarity}">
                    <span class="capitalize">${rarity}</span>
                </label>
            `;
        });
    };

    const addEventListeners = () => {
        searchInput.addEventListener('input', () => {
            activeFilters.searchText = searchInput.value.toLowerCase();
            fetchListings();
        });

        sortOrderSelect.addEventListener('change', fetchListings);
        gradedFilterCheckbox.addEventListener('change', () => {
            activeFilters.isGraded = gradedFilterCheckbox.checked;
            fetchListings();
        });

        gameFilterContainer.addEventListener('change', e => {
            if (e.target.classList.contains('game-filter')) {
                activeFilters.games = Array.from(gameFilterContainer.querySelectorAll('.game-filter:checked')).map(el => el.value);
                renderGameSpecificFilters();
                fetchListings();
            }
        });

        rarityFilterContainer.addEventListener('change', e => {
            if (e.target.classList.contains('rarity-filter')) {
                activeFilters.rarities = Array.from(rarityFilterContainer.querySelectorAll('.rarity-filter:checked')).map(el => el.value);
                fetchListings();
            }
        });
        
        gameSpecificFiltersContainer.addEventListener('change', e => {
            if (e.target.classList.contains('mtg-color-filter')) {
                 activeFilters.mtgColors = Array.from(gameSpecificFiltersContainer.querySelectorAll('.mtg-color-filter:checked')).map(el => el.value);
            }
            if (e.target.id === 'pokemon-type-filter') {
                activeFilters.pokemonTypes = e.target.value ? [e.target.value] : [];
            }
            fetchListings();
        });
    };

    const renderGameSpecificFilters = () => {
        gameSpecificFiltersContainer.innerHTML = '';
        activeFilters.mtgColors = [];
        activeFilters.pokemonTypes = [];

        if (activeFilters.games.includes('mtg')) {
            const colors = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
            let colorsHtml = '<div class="pt-4 border-t dark:border-gray-700"><h3 class="font-semibold mb-2">Magic Colors</h3><div class="flex flex-wrap gap-2">';
            for (const [code, name] of Object.entries(colors)) {
                colorsHtml += `
                    <label class="flex items-center space-x-1 text-sm">
                        <input type="checkbox" class="mtg-color-filter rounded" value="${code}">
                        <span>${name}</span>
                    </label>
                `;
            }
            colorsHtml += '</div></div>';
            gameSpecificFiltersContainer.innerHTML += colorsHtml;
        }

        if (activeFilters.games.includes('pokemon')) {
            const types = ['Colorless', 'Darkness', 'Dragon', 'Fairy', 'Fighting', 'Fire', 'Grass', 'Lightning', 'Metal', 'Psychic', 'Water'];
            let typesHtml = '<div class="pt-4 border-t dark:border-gray-700"><h3 class="font-semibold mb-2">Pokémon Type</h3>';
            typesHtml += '<select id="pokemon-type-filter" class="w-full p-2 rounded bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">';
            typesHtml += '<option value="">All Types</option>';
            types.forEach(type => {
                typesHtml += `<option value="${type}">${type}</option>`;
            });
            typesHtml += '</select></div>';
            gameSpecificFiltersContainer.innerHTML += typesHtml;
        }
    };

    const fetchListings = async () => {
        listingsContainer.innerHTML = '<div>Loading...</div>';
        noResultsDiv.classList.add('hidden');

        try {
            let allListings = [];
            const selectedGames = activeFilters.games.length > 0 ? activeFilters.games : Object.keys(supportedGames);

            const queryPromises = selectedGames.map(game => {
                let query = db.collectionGroup('forSale').where('game', '==', game);

                if (activeFilters.searchText) {
                    query = query.where('cardData.name_lowercase', '>=', activeFilters.searchText).where('cardData.name_lowercase', '<=', activeFilters.searchText + '\uf8ff');
                }
                if (activeFilters.rarities.length > 0) {
                    query = query.where('cardData.rarity', 'in', activeFilters.rarities);
                }
                if (activeFilters.isGraded) {
                    query = query.where('cardData.is_graded', '==', true);
                }
                if (game === 'mtg' && activeFilters.mtgColors.length > 0) {
                    query = query.where('cardData.colors', 'array-contains-any', activeFilters.mtgColors);
                }
                if (game === 'pokemon' && activeFilters.pokemonTypes.length > 0) {
                    query = query.where('cardData.types', 'array-contains-any', activeFilters.pokemonTypes);
                }
                
                return query.get();
            });

            const querySnapshots = await Promise.all(queryPromises);
            
            const listingsMap = new Map();
            querySnapshots.forEach(snapshot => {
                snapshot.docs.forEach(doc => {
                    if (!listingsMap.has(doc.id)) {
                        listingsMap.set(doc.id, { id: doc.id, ...doc.data() });
                    }
                });
            });
            allListings = Array.from(listingsMap.values());

            sortListings(allListings);
            renderListings(allListings);

        } catch (error) {
            console.error("Error fetching marketplace listings:", error);
            listingsContainer.innerHTML = `<div class="text-red-500">Error loading listings. Please try again later.</div>`;
        }
    };

    const sortListings = (listings) => {
        const sortOrder = sortOrderSelect.value;
        listings.sort((a, b) => {
            switch (sortOrder) {
                case 'price-asc':
                    return a.price - b.price;
                case 'price-desc':
                    return b.price - a.price;
                case 'date-asc':
                    return a.listedAt.toMillis() - b.listedAt.toMillis();
                case 'date-desc':
                    return b.listedAt.toMillis() - a.listedAt.toMillis();
                default:
                    return 0;
            }
        });
    };

    const renderListings = (listings) => {
        listingsContainer.innerHTML = '';
        if (listings.length === 0) {
            noResultsDiv.classList.remove('hidden');
            return;
        }

        listings.forEach(listing => {
            const card = listing.cardData;
            const imageUrl = card.image_uris?.normal || '/images/placeholder.png';
            const price = listing.price ? `$${Number(listing.price).toFixed(2)}` : 'N/A';
            
            const contactButtonHtml = currentUser && currentUser.uid !== listing.sellerId
                ? `<button class="contact-seller-btn mt-2 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700" data-seller-id="${listing.sellerId}" data-card-name="${card.name}">Contact Seller</button>`
                : '';

            const cardElement = `
                <div class="bg-white dark:bg-custom-gray-light rounded-lg shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-300">
                    <img src="${imageUrl}" alt="${card.name}" class="w-full h-auto object-cover">
                    <div class="p-4">
                        <h3 class="font-bold text-lg truncate">${card.name}</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400 capitalize">${card.set_name}</p>
                        <p class="text-lg font-semibold mt-2">${price}</p>
                        ${contactButtonHtml}
                    </div>
                </div>
            `;
            listingsContainer.innerHTML += cardElement;
        });
        
        document.querySelectorAll('.contact-seller-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                if (!currentUser) {
                    alert('Please log in to contact sellers.');
                    return;
                }
                const sellerId = e.target.dataset.sellerId;
                const cardName = e.target.dataset.cardName;
                // Redirect to a chat or messaging page
                window.location.href = `/chat.html?recipient=${sellerId}&card=${encodeURIComponent(cardName)}`;
            });
        });
    };

    init();
});
