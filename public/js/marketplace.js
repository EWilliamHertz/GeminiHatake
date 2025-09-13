/**
 * HatakeSocial - Enhanced Marketplace Script (v15 - Corrected Data Source)
 *
 * This script handles the enhanced marketplace with separate tabs for:
 * - Singles (individual cards)
 * - Sealed Products (booster boxes, packs, etc.)
 */

document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const mainContainer = document.querySelector('main.container');
    const marketplaceGrid = document.getElementById('marketplace-grid');
    const marketplaceListView = document.getElementById('marketplace-list-view');

    if (!marketplaceGrid) return;
    
    const db = firebase.firestore();

    // --- DOM Elements ---
    const searchForm = document.getElementById('marketplace-search-form');
    const sortByEl = document.getElementById('sort-by');
    const tcgFilterEl = document.getElementById('filter-tcg');
    const messageContainer = document.getElementById('marketplace-message');
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    
    // NEW: Tab elements
    const marketplaceTabs = document.querySelectorAll('.marketplace-tab');
    const singlesFilters = document.getElementById('singles-filters');
    const sealedFilters = document.getElementById('sealed-filters');
    const searchLabel = document.getElementById('search-label');
    const searchProductName = document.getElementById('search-product-name');
    
    // --- State ---
    let allFetchedCards = [];
    let currentView = localStorage.getItem('marketplaceView') || 'grid';
    let currentTab = localStorage.getItem('marketplaceTab') || 'singles';
    const rarityOrder = { 'mythic': 4, 'rare': 3, 'uncommon': 2, 'common': 1 };

    // --- Helper Functions ---
    const showMessage = (html) => {
        if(marketplaceGrid) marketplaceGrid.innerHTML = '';
        if(marketplaceListView) marketplaceListView.innerHTML = '';
        if(messageContainer) messageContainer.innerHTML = html;
    };

    const sanitizeHTML = (str) => {
        if (!str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    };

    // --- Tab Management ---
    const switchTab = (tabName) => {
        currentTab = tabName;
        localStorage.setItem('marketplaceTab', tabName);
        
        marketplaceTabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active', 'border-blue-500', 'text-blue-600');
                tab.classList.remove('border-transparent', 'text-gray-500');
            } else {
                tab.classList.remove('active', 'border-blue-500', 'text-blue-600');
                tab.classList.add('border-transparent', 'text-gray-500');
            }
        });
        
        if (tabName === 'singles') {
            searchLabel.textContent = 'Card Name';
            searchProductName.placeholder = 'e.g., Sol Ring';
            singlesFilters.classList.remove('hidden');
            sealedFilters.classList.add('hidden');
        } else {
            searchLabel.textContent = 'Product Name';
            searchProductName.placeholder = 'e.g., Foundations Booster Box';
            singlesFilters.classList.add('hidden');
            sealedFilters.classList.remove('hidden');
        }
        
        renderGameSpecificFilters();
        fetchMarketplaceData(); // Re-fetch data when tab changes
    };

    // --- Filter Rendering ---
    const renderGameSpecificFilters = () => {
        const selectedGame = tcgFilterEl.value;
        
        if (currentTab === 'singles' && selectedGame === 'Magic: The Gathering') {
            const languages = { 'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian', 'pt': 'Portuguese', 'ja': 'Japanese', 'ko': 'Korean', 'ru': 'Russian', 'zhs': 'Simplified Chinese', 'zht': 'Traditional Chinese' };

            singlesFilters.innerHTML = `
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
            `;
        } else {
            singlesFilters.innerHTML = '';
        }
    };

    // --- Data Fetching ---
    const fetchMarketplaceData = async () => {
        try {
            showMessage('<div class="flex items-center justify-center"><i class="fas fa-spinner fa-spin mr-2"></i>Loading marketplace...</div>');
            
            let query;
            if (currentTab === 'singles') {
                query = db.collection('marketplaceListings')
                    .where('productType', 'in', ['single', 'card', null]);
            } else {
                query = db.collection('marketplaceListings')
                    .where('productType', 'in', ['sealed', 'booster_box', 'booster_pack', 'bundle', 'prerelease_kit', 'commander_deck', 'starter_deck']);
            }
            
            const snapshot = await query.limit(500).get();
            
            if (snapshot.empty) {
                showMessage(`<div class="text-center"><i class="fas fa-store text-4xl text-gray-400 mb-4"></i><h3 class="text-xl font-semibold text-gray-600 dark:text-gray-400">No ${currentTab} available</h3><p class="text-gray-500 dark:text-gray-500">Be the first to list ${currentTab} for sale!</p></div>`);
                return;
            }

            allFetchedCards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            performSearch();

        } catch (error) {
            console.error('Error fetching marketplace data:', error);
            showMessage('<div class="text-center text-red-600"><i class="fas fa-exclamation-triangle mr-2"></i>Error loading marketplace. Please try again.</div>');
        }
    };

    // --- Search and Filtering ---
    const performSearch = () => {
        const searchTerm = searchProductName.value.toLowerCase().trim();
        const selectedTcg = tcgFilterEl.value;
        const sellerFilter = document.getElementById('filter-seller')?.value.toLowerCase().trim() || '';
        const countryFilter = document.getElementById('filter-country')?.value.toLowerCase().trim() || '';
        const cityFilter = document.getElementById('filter-city')?.value.toLowerCase().trim() || '';

        let filteredCards = allFetchedCards.filter(card => {
            const sellerName = card.sellerData?.displayName || '';
            const sellerCountry = card.sellerData?.country || '';
            const sellerCity = card.sellerData?.city || '';

            if (searchTerm && !card.name.toLowerCase().includes(searchTerm)) return false;
            if (selectedTcg !== 'all' && card.tcg !== selectedTcg) return false;
            if (sellerFilter && !sellerName.toLowerCase().includes(sellerFilter)) return false;
            if (countryFilter && !sellerCountry.toLowerCase().includes(countryFilter)) return false;
            if (cityFilter && !sellerCity.toLowerCase().includes(cityFilter)) return false;

            if (currentTab === 'singles') {
                if (selectedTcg === 'Magic: The Gathering') {
                    const colorFilters = Array.from(document.querySelectorAll('#mtg-color-filters input:checked')).map(cb => cb.value);
                    const rarityFilters = Array.from(document.querySelectorAll('#mtg-rarity-filters input:checked')).map(cb => cb.value);
                    const typeFilter = document.getElementById('mtg-type-filter')?.value.toLowerCase().trim() || '';
                    const langFilter = document.getElementById('mtg-lang-filter')?.value || '';
                    const conditionFilter = document.getElementById('mtg-condition-filter')?.value || '';
                    const foilFilter = document.getElementById('mtg-foil-filter')?.checked;
                    const signedFilter = document.getElementById('mtg-signed-filter')?.checked;

                    if (colorFilters.length > 0) {
                        const cardColors = card.colors || [];
                        if (!colorFilters.some(color => cardColors.includes(color))) return false;
                    }
                    if (rarityFilters.length > 0 && !rarityFilters.includes(card.rarity)) return false;
                    if (typeFilter && !card.type_line?.toLowerCase().includes(typeFilter)) return false;
                    if (langFilter && card.language !== langFilter) return false;
                    if (conditionFilter && card.condition !== conditionFilter) return false;
                    if (foilFilter && !card.foil) return false;
                    if (signedFilter && !card.signed) return false;
                }
            } else {
                const sealedTypeFilter = document.getElementById('sealed-type-filter')?.value || '';
                const sealedSetFilter = document.getElementById('sealed-set-filter')?.value.toLowerCase().trim() || '';
                const sealedConditionFilter = document.getElementById('sealed-condition-filter')?.value || '';

                if (sealedTypeFilter && card.productType !== sealedTypeFilter) return false;
                if (sealedSetFilter && !card.set_name?.toLowerCase().includes(sealedSetFilter)) return false;
                if (sealedConditionFilter && card.condition !== sealedConditionFilter) return false;
            }

            return true;
        });

        const sortBy = sortByEl.value;
        filteredCards.sort((a, b) => {
            switch (sortBy) {
                case 'price_asc':
                    return (a.salePrice || 0) - (b.salePrice || 0);
                case 'price_desc':
                    return (b.salePrice || 0) - (a.salePrice || 0);
                case 'name_asc':
                    return a.name.localeCompare(b.name);
                case 'rarity_desc':
                    return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
                case 'addedAt_desc':
                default:
                    return (b.lastUpdated?.toDate() || 0) - (a.lastUpdated?.toDate() || 0);
            }
        });

        renderResults(filteredCards);
    };

    // --- Result Rendering ---
    const renderResults = (cards) => {
        if (cards.length === 0) {
            showMessage(`<div class="text-center"><i class="fas fa-search text-4xl text-gray-400 mb-4"></i><h3 class="text-xl font-semibold text-gray-600 dark:text-gray-400">No results found</h3><p class="text-gray-500 dark:text-gray-500">Try adjusting your search criteria.</p></div>`);
            return;
        }

        messageContainer.innerHTML = '';

        if (currentView === 'grid') {
            marketplaceGrid.classList.remove('hidden');
            marketplaceListView.classList.add('hidden');
            renderGridView(cards);
        } else {
            marketplaceGrid.classList.add('hidden');
            marketplaceListView.classList.remove('hidden');
            renderListView(cards);
        }
    };

    const renderGridView = (cards) => {
        marketplaceGrid.innerHTML = cards.map(card => {
            const imageUrl = getCardImageUrl(card);
            const price = card.salePrice ? `${card.salePrice.toFixed(2)} ${card.currency || 'SEK'}` : 'Price not set';
            const condition = card.condition || 'Unknown';
            const quantity = card.quantity || 1;
            const sellerName = card.sellerData?.displayName || 'Unknown';
            const sellerCountry = card.sellerData?.country || '';
            
            return `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer marketplace-card" data-card-id="${card.id}">
                    <div class="aspect-w-3 aspect-h-4 relative">
                        <img src="${imageUrl}" alt="${sanitizeHTML(card.name)}" class="w-full h-48 object-cover" onerror="this.src='https://via.placeholder.com/200x280/374151/9CA3AF?text=No+Image'">
                        ${card.foil ? '<div class="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">Foil</div>' : ''}
                        ${card.signed ? '<div class="absolute top-2 left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded">Signed</div>' : ''}
                    </div>
                    <div class="p-3">
                        <h3 class="font-semibold text-sm mb-1 line-clamp-2">${sanitizeHTML(card.name)}</h3>
                        <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">${sanitizeHTML(card.set_name || '')}</p>
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-lg font-bold text-green-600">${price}</span>
                            <span class="text-xs text-gray-500">Qty: ${quantity}</span>
                        </div>
                        <div class="text-xs text-gray-600 dark:text-gray-400">
                            <div>Condition: ${condition}</div>
                            <div>Seller: ${sanitizeHTML(sellerName)}</div>
                            ${sellerCountry ? `<div>Location: ${sanitizeHTML(sellerCountry)}</div>` : ''}
                        </div>
                        <button class="w-full mt-2 bg-blue-600 text-white text-sm py-1 px-2 rounded hover:bg-blue-700 add-to-cart-btn" data-card-id="${card.id}">
                            Add to Cart
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    const renderListView = (cards) => {
        marketplaceListView.innerHTML = cards.map(card => {
            const imageUrl = getCardImageUrl(card);
            const price = card.salePrice ? `${card.salePrice.toFixed(2)} ${card.currency || 'SEK'}` : 'Price not set';
            const condition = card.condition || 'Unknown';
            const quantity = card.quantity || 1;
            const sellerName = card.sellerData?.displayName || 'Unknown';
            const sellerCountry = card.sellerData?.country || '';
            
            return `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex items-center space-x-4 hover:shadow-lg transition-shadow marketplace-card" data-card-id="${card.id}">
                    <img src="${imageUrl}" alt="${sanitizeHTML(card.name)}" class="w-16 h-20 object-cover rounded" onerror="this.src='https://via.placeholder.com/64x80/374151/9CA3AF?text=No+Image'">
                    <div class="flex-1">
                        <h3 class="font-semibold text-lg mb-1">${sanitizeHTML(card.name)}</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">${sanitizeHTML(card.set_name || '')}</p>
                        <div class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                            <span>Condition: ${condition}</span>
                            <span>Qty: ${quantity}</span>
                            <span>Seller: ${sanitizeHTML(sellerName)}</span>
                            ${sellerCountry ? `<span>Location: ${sanitizeHTML(sellerCountry)}</span>` : ''}
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold text-green-600 mb-2">${price}</div>
                        <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 add-to-cart-btn" data-card-id="${card.id}">
                            Add to Cart
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    // --- Image URL Helper ---
    const getCardImageUrl = (card) => {
        if (currentTab === 'sealed') {
            if (card.set_icon_svg_uri) return card.set_icon_svg_uri;
            if (card.icon_svg_uri) return card.icon_svg_uri;
            return 'https://via.placeholder.com/200x280/374151/9CA3AF?text=Sealed+Product';
        }
        
        if (card.image_uris?.normal) return card.image_uris.normal;
        if (card.image_uris?.large) return card.image_uris.large;
        if (card.image_uris?.small) return card.image_uris.small;
        if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
        if (card.scryfall_id) return `https://api.scryfall.com/cards/${card.scryfall_id}?format=image`;
        return 'https://via.placeholder.com/200x280/374151/9CA3AF?text=No+Image';
    };

    // --- View Toggle ---
    const setView = (view) => {
        currentView = view;
        localStorage.setItem('marketplaceView', view);
        
        gridViewBtn.classList.toggle('bg-blue-500', view === 'grid');
        gridViewBtn.classList.toggle('text-white', view === 'grid');
        listViewBtn.classList.toggle('bg-blue-500', view === 'list');
        listViewBtn.classList.toggle('text-white', view === 'list');
        
        if (allFetchedCards.length > 0) {
            performSearch();
        }
    };

    // --- Event Listeners ---
    marketplaceTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        performSearch();
    });

    searchProductName.addEventListener('input', performSearch);
    
    tcgFilterEl.addEventListener('change', () => {
        renderGameSpecificFilters();
        performSearch();
    });
    
    sortByEl.addEventListener('change', performSearch);
    
    // Add event listeners for dynamically created filters
    singlesFilters.addEventListener('change', performSearch);
    sealedFilters.addEventListener('change', performSearch);

    gridViewBtn.addEventListener('click', () => setView('grid'));
    listViewBtn.addEventListener('click', () => setView('list'));

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart-btn')) {
            const cardId = e.target.dataset.cardId;
            const card = allFetchedCards.find(c => c.id === cardId);
            if (card) {
                console.log('Adding to cart:', card);
            }
        }
    });

    // --- Initialization ---
    switchTab(currentTab);
    setView(currentView);
});