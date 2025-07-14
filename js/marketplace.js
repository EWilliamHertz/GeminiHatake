/**
 * HatakeSocial - Marketplace Page Script (v7 - Final Fix Merged)
 *
 * This script handles all logic for the marketplace.html page.
 * - Works with the corrected Firestore security rules for collection group queries.
 * - Implements multi-seller search (comma-separated).
 * - Implements a comprehensive set of advanced, client-side filters
 * for Magic: The Gathering cards.
 * - All filtering is performed client-side for a fast and responsive user experience.
 */

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

    // --- DOM Elements ---
    const searchForm = document.getElementById('marketplace-search-form');
    const sortByEl = document.getElementById('sort-by');
    const tcgFilterEl = document.getElementById('filter-tcg');
    const gameSpecificFiltersContainer = document.getElementById('game-specific-filters-container');
    const messageContainer = document.getElementById('marketplace-message');
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    
    // --- State ---
    let allFetchedCards = [];
    let currentView = localStorage.getItem('marketplaceView') || 'grid';
    const rarityOrder = { 'mythic': 4, 'rare': 3, 'uncommon': 2, 'common': 1 };

    // --- Helper Functions ---
    const showMessage = (html) => {
        marketplaceGrid.innerHTML = '';
        marketplaceListView.innerHTML = '';
        messageContainer.innerHTML = html;
    };

    // --- Filter Rendering ---
    const renderGameSpecificFilters = () => {
        const selectedGame = tcgFilterEl.value;
        gameSpecificFiltersContainer.innerHTML = '';
        gameSpecificFiltersContainer.classList.add('hidden');

        if (selectedGame === 'Magic: The Gathering') {
            gameSpecificFiltersContainer.classList.remove('hidden');
            const formats = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander'];
            const languages = { 'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian', 'pt': 'Portuguese', 'ja': 'Japanese', 'ko': 'Korean', 'ru': 'Russian', 'zhs': 'Simplified Chinese', 'zht': 'Traditional Chinese' };

            gameSpecificFiltersContainer.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Colors</label>
                        <div id="mtg-color-filters" class="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                            ${['W', 'U', 'B', 'R', 'G'].map(c => `<label class="flex items-center space-x-1"><input type="checkbox" value="${c}" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 mtg-filter"><span class="dark:text-gray-200">${c}</span></label>`).join('')}
                            <label class="flex items-center space-x-1"><input type="checkbox" value="C" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 mtg-filter"><span class="dark:text-gray-200">Colorless</span></label>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Rarity</label>
                        <div id="mtg-rarity-filters" class="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                            ${['common', 'uncommon', 'rare', 'mythic'].map(r => `<label class="flex items-center space-x-1"><input type="checkbox" value="${r}" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 mtg-filter"><span class="dark:text-gray-200 capitalize">${r}</span></label>`).join('')}
                        </div>
                    </div>
                    <div>
                        <label for="mtg-type-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Card Type</label>
                        <input type="text" id="mtg-type-filter" placeholder="e.g. Creature, Instant" class="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 mtg-filter">
                    </div>
                    <div>
                        <label for="mtg-lang-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Language</label>
                        <select id="mtg-lang-filter" class="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 mtg-filter">
                            <option value="">Any</option>
                            ${Object.entries(languages).map(([code, name]) => `<option value="${code}">${name}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label for="mtg-condition-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Condition</label>
                        <select id="mtg-condition-filter" class="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 mtg-filter">
                            <option value="">Any</option>
                            <option>Near Mint</option><option>Lightly Played</option><option>Moderately Played</option><option>Heavily Played</option><option>Damaged</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Attributes</label>
                        <div id="mtg-attr-filters" class="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                            <label class="flex items-center space-x-1"><input type="checkbox" id="mtg-foil-filter" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 mtg-filter"><span class="dark:text-gray-200">Foil</span></label>
                        </div>
                    </div>
                </div>
                <div class="mt-4 pt-4 border-t dark:border-gray-600">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Format Legality</label>
                     <div id="mtg-format-filters" class="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                        ${formats.map(f => `<label class="flex items-center space-x-1"><input type="checkbox" value="${f}" class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 mtg-filter"><span class="dark:text-gray-200 capitalize">${f}</span></label>`).join('')}
                    </div>
                </div>
            `;
        }
    };

    // --- Data Fetching and Rendering ---
    const fetchAllListings = async () => {
        showMessage('<p class="text-gray-500 dark:text-gray-400 flex items-center justify-center"><i class="fas fa-spinner fa-spin mr-2"></i>Fetching all listings from the marketplace...</p>');
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
            showMessage(`<p class="text-red-500">Could not fetch listings. This is likely a Firestore security rule issue. Please ensure your rules allow collection group queries on the 'collection' group. Error: ${error.message}</p>`);
        }
    };

    const applyFiltersAndRender = () => {
        let cardsToDisplay = [...allFetchedCards];

        const nameFilter = document.getElementById('search-card-name').value.trim().toLowerCase();
        const tcgFilter = tcgFilterEl.value;
        const sellerInput = document.getElementById('filter-seller').value;
        const sellerNames = sellerInput.split(',').map(name => name.trim().toLowerCase()).filter(name => name.length > 0);
        const cityFilter = document.getElementById('filter-city')?.value.trim().toLowerCase();
        const countryFilter = document.getElementById('filter-country')?.value.trim().toLowerCase();

        if (nameFilter) cardsToDisplay = cardsToDisplay.filter(c => c.name.toLowerCase().includes(nameFilter));
        if (tcgFilter !== 'all') cardsToDisplay = cardsToDisplay.filter(c => c.tcg === tcgFilter);
        
        if (sellerNames.length > 0) {
            cardsToDisplay = cardsToDisplay.filter(c => {
                const sellerDisplayName = c.sellerData?.displayName?.toLowerCase();
                return sellerDisplayName && sellerNames.some(searchName => sellerDisplayName.includes(searchName));
            });
        }
        if (cityFilter) cardsToDisplay = cardsToDisplay.filter(c => c.sellerData?.city?.toLowerCase().includes(cityFilter));
        if (countryFilter) cardsToDisplay = cardsToDisplay.filter(c => c.sellerData?.country?.toLowerCase().includes(countryFilter));
        
        if (tcgFilter === 'Magic: The Gathering' && document.getElementById('mtg-color-filters')) {
            const selectedColors = Array.from(document.querySelectorAll('#mtg-color-filters input:checked')).map(cb => cb.value);
            const selectedRarities = Array.from(document.querySelectorAll('#mtg-rarity-filters input:checked')).map(cb => cb.value);
            const typeFilter = document.getElementById('mtg-type-filter').value.trim().toLowerCase();
            const langFilter = document.getElementById('mtg-lang-filter').value;
            const conditionFilter = document.getElementById('mtg-condition-filter').value;
            const isFoil = document.getElementById('mtg-foil-filter').checked;
            const selectedFormats = Array.from(document.querySelectorAll('#mtg-format-filters input:checked')).map(cb => cb.value);

            if (selectedColors.length > 0) {
                cardsToDisplay = cardsToDisplay.filter(c => {
                    const cardColors = c.colors || (c.color_identity || []);
                    if (selectedColors.includes('C')) {
                        return cardColors.length === 0;
                    }
                    return selectedColors.every(color => cardColors.includes(color));
                });
            }
            if (selectedRarities.length > 0) cardsToDisplay = cardsToDisplay.filter(c => c.rarity && selectedRarities.includes(c.rarity));
            if (typeFilter) cardsToDisplay = cardsToDisplay.filter(c => c.type_line && c.type_line.toLowerCase().includes(typeFilter));
            if (langFilter) cardsToDisplay = cardsToDisplay.filter(c => c.lang === langFilter);
            if (conditionFilter) cardsToDisplay = cardsToDisplay.filter(c => c.condition === conditionFilter);
            if (isFoil) cardsToDisplay = cardsToDisplay.filter(c => c.isFoil === true);
            if (selectedFormats.length > 0) {
                cardsToDisplay = cardsToDisplay.filter(c => c.legalities && selectedFormats.every(format => c.legalities[format] === 'legal'));
            }
        }
        
        const [sortField, sortDirection] = sortByEl.value.split('_');
        cardsToDisplay.sort((a, b) => {
            let valA, valB;
            switch(sortField) {
                case 'price': valA = a.salePrice || 0; valB = b.salePrice || 0; break;
                case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
                case 'rarity': valA = rarityOrder[a.rarity] || 0; valB = rarityOrder[b.rarity] || 0; break;
                default: valA = a.addedAt?.seconds || 0; valB = b.addedAt?.seconds || 0; break;
            }
            if (typeof valA === 'string') return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        });

        renderResults(cardsToDisplay);
    };

    const renderResults = (cards) => {
        marketplaceGrid.innerHTML = '';
        marketplaceListView.innerHTML = '';
        messageContainer.innerHTML = '';

        if (cards.length === 0) {
            showMessage('<p class="text-gray-500 dark:text-gray-400">No cards found that match your search criteria.</p>');
            return;
        }

        const renderTarget = currentView === 'grid' ? marketplaceGrid : marketplaceListView;
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
        cardEl.innerHTML = `
            <a href="card-view.html?id=${card.scryfallId}" class="block h-full flex flex-col">
                <img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded-md mb-2 aspect-[5/7] object-cover" onerror="this.onerror=null;this.src='https://placehold.co/223x310';">
                <div class="flex-grow flex flex-col p-1">
                    <h4 class="font-bold text-sm truncate flex-grow text-gray-800 dark:text-white" title="${card.name}">${card.name}</h4>
                    <p class="text-blue-600 dark:text-blue-400 font-semibold text-lg mt-1">${priceDisplay}</p>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title="from ${seller.displayName}">
                        Seller: ${seller.displayName}
                    </div>
                </div>
            </a>`;
        return cardEl;
    };

    const renderListViewItem = (card) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center gap-4';
        const seller = card.sellerData;
        const priceDisplay = (card.salePrice && card.salePrice > 0) ? window.HatakeSocial.convertAndFormatPrice(card.salePrice, seller.primaryCurrency || 'SEK') : 'For Trade';
        const tradeButtonDisabled = user.uid === seller.uid;
        itemEl.innerHTML = `
            <img src="${card.imageUrl}" alt="${card.name}" class="w-16 h-22 object-cover rounded-md flex-shrink-0" onerror="this.onerror=null;this.src='https://placehold.co/64x88';">
            <div class="flex-grow min-w-0">
                <a href="card-view.html?id=${card.scryfallId}" class="font-bold text-lg text-gray-800 dark:text-white hover:underline truncate block">${card.name}</a>
                <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${card.setName || ''}</p>
            </div>
            <div class="w-1/4 text-sm text-gray-600 dark:text-gray-300 flex-shrink-0">
                <p class="font-semibold truncate">${seller.displayName}</p>
                <p class="truncate">from ${seller.city || 'N/A'}, ${seller.country || 'N/A'}</p>
            </div>
            <div class="w-1/6 font-semibold text-lg text-blue-600 dark:text-blue-400 flex-shrink-0">${priceDisplay}</div>
            <a href="trades.html?propose_to_card=${card.id}" class="px-4 py-2 text-white text-sm font-bold rounded-full flex-shrink-0 ${tradeButtonDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}" ${tradeButtonDisabled ? 'aria-disabled="true" tabindex="-1"' : ''}>
                ${tradeButtonDisabled ? 'Your Listing' : 'Propose Trade'}
            </a>
        `;
        return itemEl;
    };
    
    const switchView = (view) => {
        currentView = view;
        localStorage.setItem('marketplaceView', view);
        const activeClasses = ['bg-blue-600', 'text-white'];
        const inactiveClasses = ['text-gray-500', 'dark:text-gray-400'];

        if (view === 'grid') {
            marketplaceGrid.classList.remove('hidden');
            marketplaceListView.classList.add('hidden');
            gridViewBtn.classList.add(...activeClasses);
            gridViewBtn.classList.remove(...inactiveClasses);
            listViewBtn.classList.remove(...activeClasses);
            listViewBtn.classList.add(...inactiveClasses);
        } else {
            marketplaceGrid.classList.add('hidden');
            marketplaceListView.classList.remove('hidden');
            listViewBtn.classList.add(...activeClasses);
            listViewBtn.classList.remove(...inactiveClasses);
            gridViewBtn.classList.remove(...activeClasses);
            gridViewBtn.classList.add(...inactiveClasses);
        }
        applyFiltersAndRender();
    };

    // --- Event Listeners ---
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        applyFiltersAndRender();
    });
    sortByEl.addEventListener('change', applyFiltersAndRender);
    tcgFilterEl.addEventListener('change', () => {
        renderGameSpecificFilters();
        applyFiltersAndRender();
    });
    
    gameSpecificFiltersContainer.addEventListener('input', (e) => {
        if (e.target.matches('.mtg-filter')) {
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
    };

    initializeMarketplace();
});
