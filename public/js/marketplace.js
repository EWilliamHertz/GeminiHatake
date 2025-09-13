/**
 * HatakeSocial - Enhanced Marketplace Script (v18 - Corrected Data Fetching & Bug Fixes)
 *
 * This script handles the enhanced marketplace with separate tabs for singles and sealed products.
 * - Fixes a TypeError by adding a null check for the main container.
 * - Reverts the data fetching logic to query the correct top-level 'marketplaceListings'
 * collection, which resolves the Firestore permission errors.
 * - Connects to the global cart.js script to add items to the cart.
 * - Makes marketplace listings clickable, linking to the card-view page.
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
    const marketplaceTabs = document.querySelectorAll('.marketplace-tab');
    const singlesFilters = document.getElementById('singles-filters');
    const sealedFilters = document.getElementById('sealed-filters');
    const searchLabel = document.getElementById('search-label');
    const searchProductName = document.getElementById('search-product-name');
    
    // --- State ---
    let allFetchedItems = [];
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
            const icon = tab.querySelector('i');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active', 'border-blue-500', 'text-blue-600', 'dark:text-blue-400');
                tab.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400');
                if(icon) icon.classList.add('text-blue-600', 'dark:text-blue-400');
            } else {
                tab.classList.remove('active', 'border-blue-500', 'text-blue-600', 'dark:text-blue-400');
                tab.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400');
                 if(icon) icon.classList.remove('text-blue-600', 'dark:text-blue-400');
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
        fetchMarketplaceData();
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

    // --- Data Fetching (CORRECTED) ---
    const fetchMarketplaceData = async () => {
        try {
            showMessage('<div class="flex items-center justify-center p-8"><i class="fas fa-spinner fa-spin mr-3 text-2xl"></i>Loading marketplace listings...</div>');
            
            let query = db.collection('marketplaceListings');
            
            if (currentTab === 'singles') {
                query = query.where('productType', 'in', ['single', 'card', null]);
            } else {
                query = query.where('productType', 'in', ['sealed', 'booster_box', 'booster_pack', 'bundle', 'prerelease_kit', 'commander_deck', 'starter_deck']);
            }
            
            const snapshot = await query.limit(500).get();
            
            if (snapshot.empty) {
                showMessage(`<div class="text-center p-8"><i class="fas fa-store text-4xl text-gray-400 mb-4"></i><h3 class="text-xl font-semibold text-gray-600 dark:text-gray-400">No ${currentTab} available</h3><p class="text-gray-500 dark:text-gray-500">Be the first to list ${currentTab} for sale!</p></div>`);
                allFetchedItems = [];
                return;
            }

            allFetchedItems = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data()
            }));

            performSearch();

        } catch (error) {
            console.error('Error fetching marketplace data:', error);
            showMessage('<div class="text-center text-red-600 p-8"><i class="fas fa-exclamation-triangle mr-2"></i>Error loading marketplace. Please try again.</div>');
        }
    };
    
    // --- Search and Filtering ---
    const performSearch = () => {
        if (!allFetchedItems) return;
        const searchTerm = document.getElementById('search-product-name').value.toLowerCase().trim();
        const selectedTcg = document.getElementById('filter-tcg').value;
        const sellerFilter = document.getElementById('filter-seller')?.value.toLowerCase().trim() || '';
        const countryFilter = document.getElementById('filter-country')?.value.toLowerCase().trim() || '';
        const cityFilter = document.getElementById('filter-city')?.value.toLowerCase().trim() || '';

        let filteredItems = allFetchedItems.filter(item => {
            if (searchTerm && !item.name.toLowerCase().includes(searchTerm)) return false;
            if (selectedTcg !== 'all' && item.tcg !== selectedTcg) return false;
            if (sellerFilter && !item.sellerData?.displayName?.toLowerCase().includes(sellerFilter)) return false;
            if (countryFilter && !item.sellerData?.country?.toLowerCase().includes(countryFilter)) return false;
            if (cityFilter && !item.sellerData?.city?.toLowerCase().includes(cityFilter)) return false;

            return true; 
        });

        const sortBy = sortByEl.value;
        filteredItems.sort((a, b) => {
            const priceA = a.isFoil ? (a.priceUsdFoil || 0) : (a.priceUsd || 0);
            const priceB = b.isFoil ? (b.priceUsdFoil || 0) : (b.priceUsd || 0);

            switch (sortBy) {
                case 'price_asc': return priceA - priceB;
                case 'price_desc': return priceB - priceA;
                case 'name_asc': return a.name.localeCompare(b.name);
                case 'rarity_desc': return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
                case 'addedAt_desc':
                default:
                    return (b.addedAt?.toDate() || 0) - (a.addedAt?.toDate() || 0);
            }
        });

        renderResults(filteredItems);
    };

    // --- Result Rendering ---
    const renderResults = (items) => {
        if (items.length === 0) {
            showMessage(`<div class="text-center p-8"><i class="fas fa-search text-4xl text-gray-400 mb-4"></i><h3 class="text-xl font-semibold text-gray-600 dark:text-gray-400">No results found</h3><p class="text-gray-500 dark:text-gray-500">Try adjusting your search criteria.</p></div>`);
            return;
        }

        messageContainer.innerHTML = '';
        currentView === 'grid' ? renderGridView(items) : renderListView(items);
    };
    
    const renderGridView = (items) => {
        marketplaceGrid.innerHTML = items.map(item => createCardHTML(item, 'grid')).join('');
        marketplaceGrid.classList.remove('hidden');
        marketplaceListView.classList.add('hidden');
    };

    const renderListView = (items) => {
        marketplaceListView.innerHTML = items.map(item => createCardHTML(item, 'list')).join('');
        marketplaceGrid.classList.add('hidden');
        marketplaceListView.classList.remove('hidden');
    };

    const createCardHTML = (card, viewType) => {
        const imageUrl = card.imageUrl || 'https://placehold.co/223x310?text=No+Image';
        const price = (card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
        const formattedPrice = window.HatakeSocial.convertAndFormatPrice(price, 'USD');
        const condition = card.condition || 'Not Set';
        const quantity = card.quantity || 1;
        const sellerName = sanitizeHTML(card.sellerData?.displayName || 'Unknown');
        const sellerCountry = sanitizeHTML(card.sellerData?.country || '');
        const sellerId = card.sellerId || '#';

        if (viewType === 'grid') {
            return `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col group">
                    <div class="relative overflow-hidden cursor-pointer marketplace-card" data-card-id="${card.id}" data-seller-id="${sellerId}">
                        <img src="${imageUrl}" alt="${sanitizeHTML(card.name)}" class="w-full h-auto aspect-[5/7] object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.onerror=null;this.src='https://placehold.co/223x310?text=No+Image';">
                    </div>
                    <div class="p-3 flex flex-col flex-grow">
                        <h3 class="font-semibold text-sm mb-1 line-clamp-2 flex-grow">${sanitizeHTML(card.name)}</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                           <a href="profile.html?uid=${sellerId}" class="hover:underline">${sellerName}</a> ${sellerCountry ? `(${sellerCountry})` : ''}
                        </p>
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-lg font-bold text-green-500">${formattedPrice}</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">Qty: ${quantity}</span>
                        </div>
                        <button class="w-full mt-auto bg-blue-600 text-white text-sm py-2 px-2 rounded-lg hover:bg-blue-700 transition-colors add-to-cart-btn" data-card-id="${card.id}">
                            <i class="fas fa-cart-plus mr-1"></i> Add to Cart
                        </button>
                    </div>
                </div>
            `;
        } else { // list view
             return `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 flex items-center space-x-4 hover:shadow-lg transition-shadow">
                    <img src="${imageUrl}" alt="${sanitizeHTML(card.name)}" class="w-20 h-28 object-cover rounded-md cursor-pointer marketplace-card" data-card-id="${card.id}" data-seller-id="${sellerId}" onerror="this.onerror=null;this.src='https://placehold.co/80x112?text=No+Image';">
                    <div class="flex-1 min-w-0">
                        <h3 class="font-semibold text-lg truncate cursor-pointer marketplace-card" data-card-id="${card.id}" data-seller-id="${sellerId}">${sanitizeHTML(card.name)}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">${sanitizeHTML(card.set_name || '')}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                           Sold by <a href="profile.html?uid=${sellerId}" class="font-semibold hover:underline">${sellerName}</a>
                        </p>
                         <div class="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400 mt-1">
                            <span>Cond: ${condition}</span>
                            <span>Qty: ${quantity}</span>
                            ${sellerCountry ? `<span><i class="fas fa-map-marker-alt mr-1"></i>${sellerCountry}</span>` : ''}
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <div class="text-xl font-bold text-green-500 mb-2">${formattedPrice}</div>
                        <button class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 add-to-cart-btn" data-card-id="${card.id}">
                            <i class="fas fa-cart-plus mr-2"></i>Add to Cart
                        </button>
                    </div>
                </div>
            `;
        }
    };

    // --- View Toggle ---
    const setView = (view) => {
        currentView = view;
        localStorage.setItem('marketplaceView', view);
        
        gridViewBtn.classList.toggle('bg-blue-600', view === 'grid');
        gridViewBtn.classList.toggle('text-white', view === 'grid');
        gridViewBtn.classList.toggle('text-gray-500', view !== 'grid');
        
        listViewBtn.classList.toggle('bg-blue-600', view === 'list');
        listViewBtn.classList.toggle('text-white', view === 'list');
        listViewBtn.classList.toggle('text-gray-500', view !== 'list');
        
        if (allFetchedItems.length > 0) {
            renderResults(allFetchedItems);
        }
    };

    // --- Event Listeners ---
    marketplaceTabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
    
    // FIX: Add null check to prevent script crash
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => { e.preventDefault(); performSearch(); });
        searchForm.addEventListener('input', performSearch);
    }
    
    if (sortByEl) sortByEl.addEventListener('change', performSearch);
    if (gridViewBtn) gridViewBtn.addEventListener('click', () => setView('grid'));
    if (listViewBtn) listViewBtn.addEventListener('click', () => setView('list'));

    // FIX: Add null check to prevent script crash
    if(mainContainer) {
        mainContainer.addEventListener('click', (e) => {
            const addToCartButton = e.target.closest('.add-to-cart-btn');
            if (addToCartButton) {
                e.stopPropagation();
                if (!user) {
                    const loginModal = document.getElementById('loginModal');
                    if (loginModal) window.openModal(loginModal);
                    return;
                }
                const cardId = addToCartButton.dataset.cardId;
                const card = allFetchedItems.find(c => c.id === cardId);
                if (card) {
                    const price = (card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
                    const cartItem = {
                        id: card.id,
                        name: card.name,
                        price: price,
                        currency: 'USD', 
                        imageUrl: card.imageUrl,
                        sellerId: card.sellerId,
                        sellerName: card.sellerData?.displayName || 'Unknown',
                        quantity: 1,
                        type: currentTab === 'singles' ? 'card' : 'sealed'
                    };
                    
                    if (window.addToCart) {
                        window.addToCart(cartItem);
                    } else {
                        console.error('addToCart function not found. Is cart.js loaded?');
                    }
                }
                return;
            }

            const cardElement = e.target.closest('.marketplace-card');
            if (cardElement) {
                const cardId = cardElement.dataset.cardId;
                const sellerId = cardElement.dataset.sellerId;
                const card = allFetchedItems.find(c => c.id === cardId && c.sellerId === sellerId);
                if (card) {
                    window.location.href = `card-view.html?userId=${card.sellerId}&cardId=${card.id}`;
                }
            }
        });
    }

    // --- Initialization ---
    switchTab(currentTab);
    setView(currentView);
});

