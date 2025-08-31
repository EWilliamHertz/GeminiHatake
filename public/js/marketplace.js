/**
 * HatakeSocial - Marketplace Page Script (v12 - Image Fix Applied)
 *
 * This script handles all logic for the marketplace.html page.
 * - FIX: Although this page primarily uses Firestore data, the rendering functions have been verified to prioritize `customImageUrl` then `imageUrl`. The root cause of missing images is in how data is added to the collection, which has been fixed in `collection.js`.
 * - NEW: Displays the "notes" field for a card in both grid and list views.
 * - FIX: Corrected the list view rendering to display custom-uploaded images and the "signed" status icon, matching the grid view's functionality.
 * - Displays the user-uploaded custom image for a card if it exists, otherwise falls back to the default image.
 * - Adds a "Signed" filter for Magic: The Gathering cards.
 * - Displays a "Signed" indicator on cards in both grid and list views.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const mainContainer = document.querySelector('main.container');
    const marketplaceGrid = document.getElementById('marketplace-grid');
    const marketplaceListView = document.getElementById('marketplace-list-view');

    if (!marketplaceGrid) return;

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

    const sanitizeHTML = (str) => {
        if (!str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
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
                            <label class="flex items-center space-x-1"><input type="checkbox" id="mtg-signed-filter" class="h-4 w-4 rounded text-yellow-500 focus:ring-yellow-400 mtg-filter"><span class="dark:text-gray-200">Signed</span></label>
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
            const isSigned = document.getElementById('mtg-signed-filter').checked;
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
            if (isSigned) cardsToDisplay = cardsToDisplay.filter(c => c.isSigned === true);
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
        cardEl.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col group transition hover:shadow-xl hover:-translate-y-1';
        const seller = card.sellerData;
        const priceDisplay = (card.salePrice && card.salePrice > 0) ? window.HatakeSocial.convertAndFormatPrice(card.salePrice, seller.primaryCurrency || 'SEK') : 'For Trade';
        
        const quantityBadge = `<div class="absolute top-1 right-1 bg-gray-900 bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">x${card.quantity}</div>`;
        const foilIndicatorHTML = card.isFoil ? `<div class="absolute bottom-1.5 left-1.5 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">Foil</div>` : '';
        const signedIndicatorHTML = card.isSigned ? `<div class="absolute bottom-1.5 left-1.5 ml-12 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">Signed</div>` : '';
        const notesDisplayHTML = card.notes ? `<div class="notes-display p-1 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-t-lg truncate" title="${sanitizeHTML(card.notes)}">${sanitizeHTML(card.notes)}</div>` : '';

        cardEl.innerHTML = `
            <a href="card-view.html?id=${card.scryfallId}" class="block h-full flex flex-col">
                ${notesDisplayHTML}
                <div class="relative">
                    <img src="${card.customImageUrl || card.imageUrl}" alt="${card.name}" class="w-full ${card.notes ? 'rounded-b-md' : 'rounded-md'} mb-2 aspect-[5/7] object-cover" onerror="this.onerror=null;this.src='https://placehold.co/223x310';">
                    ${quantityBadge}
                    ${foilIndicatorHTML}
                    ${signedIndicatorHTML}
                </div>
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
        
        let tradeButtonHTML = '';
        if(user && user.uid !== seller.uid){
            tradeButtonHTML = `<a href="trades.html?propose_to_card=${card.id}" class="px-4 py-2 text-white text-sm font-bold rounded-full flex-shrink-0 bg-green-600 hover:bg-green-700">Propose Trade</a>`;
        } else if (user && user.uid === seller.uid) {
            tradeButtonHTML = `<span class="px-4 py-2 text-white text-sm font-bold rounded-full flex-shrink-0 bg-gray-400 cursor-not-allowed">Your Listing</span>`;
        }
        
        const notesDisplayHTML = card.notes ? `<p class="text-xs text-yellow-600 dark:text-yellow-400 truncate italic" title="${sanitizeHTML(card.notes)}"><i class="fas fa-sticky-note mr-1"></i>${sanitizeHTML(card.notes)}</p>` : '';

        itemEl.innerHTML = `
            <img src="${card.customImageUrl || card.imageUrl}" alt="${card.name}" class="w-16 h-22 object-cover rounded-md flex-shrink-0" onerror="this.onerror=null;this.src='https://placehold.co/64x88';">
            <div class="flex-grow min-w-0">
                <a href="card-view.html?id=${card.scryfallId}" class="font-bold text-lg text-gray-800 dark:text-white hover:underline truncate block">${card.name} ${card.isFoil ? '<i class="fas fa-star text-yellow-400"></i>' : ''} ${card.isSigned ? '<i class="fas fa-signature text-yellow-500"></i>' : ''}</a>
                <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${card.setName || ''}</p>
                ${notesDisplayHTML}
            </div>
            <div class="text-center w-16 flex-shrink-0">
                <p class="text-sm text-gray-500 dark:text-gray-400">Qty</p>
                <p class="font-bold text-lg dark:text-white">${card.quantity}</p>
            </div>
            <div class="w-1/4 text-sm text-gray-600 dark:text-gray-300 flex-shrink-0">
                <p class="font-semibold truncate">${seller.displayName}</p>
                <p class="truncate">from ${seller.city || 'N/A'}, ${seller.country || 'N/A'}</p>
            </div>
            <div class="w-1/6 font-semibold text-lg text-blue-600 dark:text-blue-400 flex-shrink-0">${priceDisplay}</div>
            ${tradeButtonHTML}
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
