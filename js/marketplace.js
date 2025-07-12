document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const mainContainer = document.querySelector('main.container');
    const marketplaceGrid = document.getElementById('marketplace-grid');
    const marketplaceListView = document.getElementById('marketplace-list-view');

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
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    
    let allFetchedCards = [];
    let initialLoad = true;
    let currentView = localStorage.getItem('marketplaceView') || 'grid';

    const renderGameSpecificFilters = () => {
        const selectedGame = tcgFilterEl.value;
        gameSpecificFiltersContainer.innerHTML = '';
        gameSpecificFiltersContainer.classList.add('hidden');

        if (selectedGame === 'Magic: The Gathering') {
            gameSpecificFiltersContainer.classList.remove('hidden');
            gameSpecificFiltersContainer.innerHTML = `<h4 class="text-md font-semibold mb-2 text-gray-800 dark:text-white col-span-full">Magic Filters</h4><div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Colors</label><div id="mtg-color-filters" class="flex flex-wrap gap-x-4 gap-y-1 mt-2">${['W', 'U', 'B', 'R', 'G', 'C'].map(c => `<label class="flex items-center space-x-1"><input type="checkbox" value="${c}" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 mtg-color-filter"><span class="dark:text-gray-200">${c === 'C' ? 'Colorless' : c}</span></label>`).join('')}</div></div><div><label for="mtg-type-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Card Type</label><input type="text" id="mtg-type-filter" placeholder="e.g. Creature" class="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"></div></div>`;
        } else if (selectedGame === 'Pokémon') {
             gameSpecificFiltersContainer.classList.remove('hidden');
            const pokemonTypes = ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Fairy', 'Dragon', 'Colorless'];
            gameSpecificFiltersContainer.innerHTML = `<h4 class="text-md font-semibold mb-2 text-gray-800 dark:text-white col-span-full">Pokémon Filters</h4><div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Types</label><div id="pokemon-type-filters" class="flex flex-wrap gap-x-4 gap-y-1 mt-2">${pokemonTypes.map(t => `<label class="flex items-center space-x-1"><input type="checkbox" value="${t}" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 pokemon-type-filter"><span class="dark:text-gray-200">${t}</span></label>`).join('')}</div></div>`;
        }
    };

    const fetchAllListings = async () => {
        showMessage('<p class="text-gray-500 dark:text-gray-400 flex items-center justify-center"><i class="fas fa-spinner fa-spin mr-2"></i>Fetching all listings from the marketplace...</p>');
        try {
            const query = db.collectionGroup('collection').where('forSale', '==', true);
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Query timed out after 15 seconds. The database may be busy or an index is still building.")), 15000)
            );
            
            const snapshot = await Promise.race([query.get(), timeoutPromise]);

            if (snapshot.empty) {
                allFetchedCards = [];
                return;
            }

            const sellerIds = [...new Set(snapshot.docs.map(doc => doc.ref.parent.parent.id))];
            if (sellerIds.length === 0) { allFetchedCards = []; return; }
            
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
            let userMessage = `Could not fetch listings. Error: ${error.message}`;
            if (error.message.includes("timed out")) {
                userMessage += "<br>Please check that the required Firestore indexes have finished building.";
            }
            showMessage(`<p class="text-red-500">${userMessage}</p>`);
        }
    };

    const applyFiltersAndRender = () => {
        let cardsToDisplay = [...allFetchedCards];
        const nameFilter = document.getElementById('search-card-name').value.trim().toLowerCase();
        if (nameFilter) cardsToDisplay = cardsToDisplay.filter(c => c.name.toLowerCase().includes(nameFilter));
        
        const tcgFilter = tcgFilterEl.value;
        if (tcgFilter !== 'all') {
            cardsToDisplay = cardsToDisplay.filter(c => c.tcg === tcgFilter);
            if (tcgFilter === 'Magic: The Gathering') {
                const selectedColors = Array.from(document.querySelectorAll('.mtg-color-filter:checked')).map(cb => cb.value);
                const typeFilter = document.getElementById('mtg-type-filter').value.trim().toLowerCase();
                if (selectedColors.length > 0) cardsToDisplay = cardsToDisplay.filter(c => c.colors && selectedColors.every(color => c.colors.includes(color)));
                if (typeFilter) cardsToDisplay = cardsToDisplay.filter(c => c.type_line && c.type_line.toLowerCase().includes(typeFilter));
            } else if (tcgFilter === 'Pokémon') {
                const selectedTypes = Array.from(document.querySelectorAll('.pokemon-type-filter:checked')).map(cb => cb.value);
                if (selectedTypes.length > 0) cardsToDisplay = cardsToDisplay.filter(c => c.types && selectedTypes.every(type => c.types.includes(type)));
            }
        }
        
        const [sortField, sortDirection] = sortByEl.value.split('_');
        cardsToDisplay.sort((a, b) => {
            let valA = (sortField === 'salePrice') ? (a.salePrice || 0) : (a.addedAt?.seconds || 0);
            let valB = (sortField === 'salePrice') ? (b.salePrice || 0) : (b.addedAt?.seconds || 0);
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });

        renderResults(cardsToDisplay);
    };

    const renderResults = (cards) => {
        const gridContainer = marketplaceGrid;
        const listContainer = marketplaceListView;
        gridContainer.innerHTML = '';
        listContainer.innerHTML = '';
        messageContainer.innerHTML = '';
        
        if (cards.length === 0) {
            showMessage('<p class="text-gray-500 dark:text-gray-400">No cards found that match your search criteria.</p>');
            return;
        }

        const renderTarget = currentView === 'grid' ? gridContainer : listContainer;
        const renderFunction = currentView === 'grid' ? renderGridViewCard : renderListViewItem;
        cards.forEach(card => {
            if (card && card.sellerData) {
                renderTarget.appendChild(renderFunction(card));
            }
        });
    };

    const renderGridViewCard = (card) => {
        const cardEl = document.createElement('div');
        cardEl.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 flex flex-col group transition hover:shadow-xl hover:-translate-y-1';
        const seller = card.sellerData;
        const priceDisplay = (card.salePrice && card.salePrice > 0) ? window.HatakeSocial.convertAndFormatPrice(card.salePrice, seller.primaryCurrency || 'SEK') : 'For Trade';
        cardEl.innerHTML = `<a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block h-full flex flex-col"><img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded-md mb-2 aspect-[5/7] object-cover" onerror="this.onerror=null;this.src='https://placehold.co/223x310';"><div class="flex-grow flex flex-col p-1"><h4 class="font-bold text-sm truncate flex-grow text-gray-800 dark:text-white" title="${card.name}">${card.name}</h4><p class="text-blue-600 dark:text-blue-400 font-semibold text-lg mt-1">${priceDisplay}</p><div class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title="from ${seller.city || 'N/A'}, ${seller.country || 'N/A'}">from ${seller.city || 'N/A'}, ${seller.country || 'N/A'}</div></div></a>`;
        return cardEl;
    };

    const renderListViewItem = (card) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center gap-4';
        const seller = card.sellerData;
        const priceDisplay = (card.salePrice && card.salePrice > 0) ? window.HatakeSocial.convertAndFormatPrice(card.salePrice, seller.primaryCurrency || 'SEK') : 'For Trade';
        const tradeButtonDisabled = user.uid === seller.uid;
        itemEl.innerHTML = `<img src="${card.imageUrl}" alt="${card.name}" class="w-16 h-22 object-cover rounded-md flex-shrink-0" onerror="this.onerror=null;this.src='https://placehold.co/64x88';"><div class="flex-grow min-w-0"><a href="card-view.html?name=${encodeURIComponent(card.name)}" class="font-bold text-lg text-gray-800 dark:text-white hover:underline truncate block">${card.name}</a><p class="text-sm text-gray-500 dark:text-gray-400 truncate">${card.setName || ''}</p></div><div class="w-1/4 text-sm text-gray-600 dark:text-gray-300 flex-shrink-0"><p class="font-semibold truncate">${seller.displayName}</p><p class="truncate">from ${seller.city || 'N/A'}, ${seller.country || 'N/A'}</p></div><div class="w-1/6 font-semibold text-lg text-blue-600 dark:text-blue-400 flex-shrink-0">${priceDisplay}</div><a href="trades.html?propose_to_card=${card.id}" class="px-4 py-2 text-white text-sm font-bold rounded-full flex-shrink-0 ${tradeButtonDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}" ${tradeButtonDisabled ? 'disabled' : ''}>${tradeButtonDisabled ? 'Your Listing' : 'Propose Trade'}</a>`;
        return itemEl;
    };
    
    const switchView = (view) => {
        currentView = view;
        localStorage.setItem('marketplaceView', view);
        if (view === 'grid') {
            marketplaceGrid.classList.remove('hidden');
            marketplaceListView.classList.add('hidden');
            gridViewBtn.classList.add('active-view');
            listViewBtn.classList.remove('active-view');
        } else {
            marketplaceGrid.classList.add('hidden');
            marketplaceListView.classList.remove('hidden');
            gridViewBtn.classList.remove('active-view');
            listViewBtn.classList.add('active-view');
        }
        if(!initialLoad) renderResults(allFetchedCards);
    };

    const showMessage = (html) => {
        marketplaceGrid.innerHTML = '';
        marketplaceListView.innerHTML = '';
        messageContainer.innerHTML = html;
    };

    // --- Event Listeners ---
    searchForm.addEventListener('submit', (e) => e.preventDefault());
    searchForm.addEventListener('keyup', () => applyFiltersAndRender());
    sortByEl.addEventListener('change', () => applyFiltersAndRender());
    tcgFilterEl.addEventListener('change', () => {
        renderGameSpecificFilters();
        applyFiltersAndRender();
    });
    gameSpecificFiltersContainer.addEventListener('change', (e) => {
        if (e.target.matches('input')) {
            applyFiltersAndRender();
        }
    });
    gridViewBtn.addEventListener('click', () => switchView('grid'));
    listViewBtn.addEventListener('click', () => switchView('list'));

    // --- Initial Load ---
    const initializeMarketplace = async () => {
        switchView(currentView);
        renderGameSpecificFilters();
        await fetchAllListings();
        applyFiltersAndRender();
        initialLoad = false;
    };

    initializeMarketplace();
});
