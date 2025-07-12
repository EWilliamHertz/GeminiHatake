document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const mainContainer = document.querySelector('main.container');
    const marketplaceGrid = document.getElementById('marketplace-grid');

    if (!marketplaceGrid) return;

    if (!user) {
        mainContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to view the marketplace.</p>';
        return;
    }

    const searchForm = document.getElementById('marketplace-search-form');
    const sortByEl = document.getElementById('sort-by');
    const tcgFilterEl = document.getElementById('filter-tcg');
    const gameSpecificFiltersContainer = document.getElementById('game-specific-filters-container');
    const messageContainer = document.getElementById('marketplace-message');
    
    let allFetchedCards = [];
    let initialLoad = true;

    // --- Filter Rendering ---
    const renderGameSpecificFilters = () => {
        const selectedGame = tcgFilterEl.value;
        gameSpecificFiltersContainer.innerHTML = '';
        if (selectedGame === 'Magic: The Gathering') {
            gameSpecificFiltersContainer.classList.remove('hidden');
            gameSpecificFiltersContainer.innerHTML = `
                <h4 class="text-md font-semibold mb-2 text-gray-800 dark:text-white">Magic Filters</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Colors</label>
                        <div id="mtg-color-filters" class="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            ${['W', 'U', 'B', 'R', 'G', 'C'].map(c => `
                                <label class="flex items-center space-x-1">
                                    <input type="checkbox" value="${c}" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 mtg-color-filter">
                                    <span class="dark:text-gray-200">${c === 'C' ? 'Colorless' : c}</span>
                                </label>`).join('')}
                        </div>
                    </div>
                    <div>
                        <label for="mtg-type-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Card Type</label>
                         <input type="text" id="mtg-type-filter" placeholder="e.g. Creature" class="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                    </div>
                </div>`;
        } else if (selectedGame === 'Pokémon') {
            gameSpecificFiltersContainer.classList.remove('hidden');
            const pokemonTypes = ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Fairy', 'Dragon', 'Colorless'];
            gameSpecificFiltersContainer.innerHTML = `
                <h4 class="text-md font-semibold mb-2 text-gray-800 dark:text-white">Pokémon Filters</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Types</label>
                        <div id="pokemon-type-filters" class="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                             ${pokemonTypes.map(t => `
                                <label class="flex items-center space-x-1">
                                    <input type="checkbox" value="${t}" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 pokemon-type-filter">
                                    <span class="dark:text-gray-200">${t}</span>
                                </label>`).join('')}
                        </div>
                    </div>
                </div>`;
        } else {
            gameSpecificFiltersContainer.classList.add('hidden');
        }
    };

    // --- Data Fetching and Rendering ---
    const fetchAllListings = async () => {
        showMessage('<p class="text-gray-500 dark:text-gray-400">Fetching all listings from the marketplace...</p>');
        try {
            const query = db.collectionGroup('collection').where('forSale', '==', true);
            const snapshot = await query.get();

            if (snapshot.empty) {
                allFetchedCards = [];
                return;
            }

            const sellerIds = [...new Set(snapshot.docs.map(doc => doc.ref.parent.parent.id))];
            const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
            const sellerDocs = await Promise.all(sellerPromises);
            const sellers = new Map(sellerDocs.map(doc => [doc.id, { uid: doc.id, ...doc.data() }]));

            allFetchedCards = snapshot.docs.map(doc => ({
                id: doc.id,
                sellerData: sellers.get(doc.ref.parent.parent.id) || null,
                ...doc.data()
            }));
            
        } catch (error) {
            console.error("Fatal error fetching listings:", error);
            showMessage('<p class="text-red-500">Could not fetch listings. There might be a problem with the database configuration.</p>');
        }
    };

    const applyFiltersAndRender = () => {
        let cardsToDisplay = [...allFetchedCards];

        // Primary Filters
        const nameFilter = document.getElementById('search-card-name').value.trim().toLowerCase();
        const tcgFilter = tcgFilterEl.value;
        const countryFilter = document.getElementById('filter-country').value.trim().toLowerCase();
        const cityFilter = document.getElementById('filter-city').value.trim().toLowerCase();

        if (nameFilter) cardsToDisplay = cardsToDisplay.filter(c => c.name.toLowerCase().includes(nameFilter));
        if (tcgFilter !== 'all') cardsToDisplay = cardsToDisplay.filter(c => c.tcg === tcgFilter);
        if (countryFilter) cardsToDisplay = cardsToDisplay.filter(c => c.sellerData?.country?.toLowerCase().includes(countryFilter));
        if (cityFilter) cardsToDisplay = cardsToDisplay.filter(c => c.sellerData?.city?.toLowerCase().includes(cityFilter));

        // Advanced Game-Specific Filters
        if (tcgFilter === 'Magic: The Gathering') {
            const selectedColors = Array.from(document.querySelectorAll('.mtg-color-filter:checked')).map(cb => cb.value);
            const typeFilter = document.getElementById('mtg-type-filter').value.trim().toLowerCase();

            if (selectedColors.length > 0) {
                cardsToDisplay = cardsToDisplay.filter(c => c.colors && selectedColors.every(color => c.colors.includes(color)));
            }
            if (typeFilter) {
                cardsToDisplay = cardsToDisplay.filter(c => c.type_line && c.type_line.toLowerCase().includes(typeFilter));
            }
        } else if (tcgFilter === 'Pokémon') {
             const selectedTypes = Array.from(document.querySelectorAll('.pokemon-type-filter:checked')).map(cb => cb.value);
             if (selectedTypes.length > 0) {
                cardsToDisplay = cardsToDisplay.filter(c => c.types && selectedTypes.every(type => c.types.includes(type)));
             }
        }

        // Sorting
        const [sortField, sortDirection] = sortByEl.value.split('_');
        cardsToDisplay.sort((a, b) => {
            let valA, valB;
            if (sortField === 'salePrice') {
                valA = a.salePrice || 0;
                valB = b.salePrice || 0;
            } else { // addedAt
                valA = a.addedAt?.seconds || 0;
                valB = b.addedAt?.seconds || 0;
            }
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });

        renderResults(cardsToDisplay);
    };

    const renderResults = (cards) => {
        marketplaceGrid.innerHTML = '';
        messageContainer.innerHTML = '';

        if (cards.length === 0) {
            showMessage('<p class="text-gray-500 dark:text-gray-400">No cards found that match your search criteria.</p>');
            return;
        }

        cards.forEach(card => {
            const seller = card.sellerData;
            if (!seller) return;

            const priceDisplay = (card.salePrice && card.salePrice > 0)
                ? window.HatakeSocial.convertAndFormatPrice(card.salePrice, seller.primaryCurrency || 'SEK')
                : 'For Trade';
            
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 flex flex-col group transition hover:shadow-xl hover:-translate-y-1';
            
            const tradeButtonDisabled = user.uid === seller.uid;
            const tradeButtonClasses = tradeButtonDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700';

            cardEl.innerHTML = `
                <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block h-full flex flex-col">
                    <div class="relative w-full">
                        <img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded-md mb-2 aspect-[5/7] object-cover" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                    </div>
                    <div class="flex-grow flex flex-col p-1">
                        <h4 class="font-bold text-sm truncate flex-grow text-gray-800 dark:text-white" title="${card.name}">${card.name}</h4>
                        <p class="text-blue-600 dark:text-blue-400 font-semibold text-lg mt-1">${priceDisplay}</p>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                             <a href="profile.html?uid=${seller.uid}" class="hover:underline" title="from ${seller.city || 'N/A'}, ${seller.country || 'N/A'}">
                                 from ${seller.city || 'N/A'}, ${seller.country || 'N/A'}
                             </a>
                        </div>
                    </div>
                </a>
                <a href="trades.html?propose_to_card=${card.id}" class="propose-trade-btn mt-2 w-full text-center text-white text-xs font-bold py-1 rounded-full ${tradeButtonClasses}" ${tradeButtonDisabled ? 'disabled' : ''}>
                    ${tradeButtonDisabled ? 'Your Listing' : 'Propose Trade'}
                </a>
            `;
            marketplaceGrid.appendChild(cardEl);
        });
    };

    const showMessage = (html) => {
        marketplaceGrid.innerHTML = '';
        messageContainer.innerHTML = html;
    };

    // --- Event Listeners ---
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        applyFiltersAndRender();
    });
    
    sortByEl.addEventListener('change', applyFiltersAndRender);
    tcgFilterEl.addEventListener('change', () => {
        renderGameSpecificFilters();
        if (!initialLoad) applyFiltersAndRender();
    });
    
    // Use event delegation for dynamic filters
    gameSpecificFiltersContainer.addEventListener('change', (e) => {
        if (e.target.matches('.mtg-color-filter, #mtg-type-filter, .pokemon-type-filter')) {
            applyFiltersAndRender();
        }
    });

    // --- Initial Load ---
    const initializeMarketplace = async () => {
        await fetchAllListings();
        applyFiltersAndRender();
        initialLoad = false;
    };

    initializeMarketplace();
});
