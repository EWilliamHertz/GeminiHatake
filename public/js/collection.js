/**
 * HatakeSocial - My Collection Page Script (v30.1 - Complete Enhanced Modal System)
 *
 * This script handles all logic for the my_collection.html page.
 * - FIX: Removed unreliable CORS proxy and implemented direct API calls
 * - FIX: Fixed Pokemon TCG API query format and error handling
 * - FEAT: Enhanced modal system for card management with quantity, foil, signed, altered options
 * - FEAT: Added photo upload functionality for card instances
 * - FEAT: Implemented multiple card version management
 * - FEAT: Clickable search results for both Pokemon and MTG cards
 * - FEAT: Complete integration with existing collection management
 */

// --- Helper Functions (Global Scope) ---

/**
 * Gets the correct image URL for any card type from Scryfall or Pokemon TCG data.
 * @param {object} cardData The full card data object from Scryfall, Firestore, or Pokemon TCG API.
 * @param {string} [size='normal'] The desired image size ('small', 'normal', 'large').
 * @returns {string} The URL of the card image or a placeholder.
 */
function getCardImageUrl(cardData, size = 'normal') {
    if (cardData?.tcg === 'Pokémon') {
        return size === 'small' ? cardData.images?.small : cardData.images?.large;
    }
    if (cardData?.card_faces?.[0]?.image_uris?.[size]) {
        return cardData.card_faces[0].image_uris[size];
    }
    if (cardData?.image_uris?.[size]) {
        return cardData.image_uris[size];
    }
    if (cardData?.customImageUrl) {
        return cardData.customImageUrl;
    }
    if (cardData?.imageUrl) {
        return cardData.imageUrl;
    }
    console.warn('No image URL found for card:', cardData?.name);
    return 'https://placehold.co/223x310/cccccc/969696?text=No+Image';
}

/**
 * Safely converts a price using the global converter, with a fallback.
 * @param {number} value The price in USD.
 * @returns {string} The formatted price string.
 */
function safeFormatPrice(value) {
    if (window.HatakeSocial && typeof window.HatakeSocial.convertAndFormatPrice === 'function') {
        return window.HatakeSocial.convertAndFormatPrice(value, 'USD');
    }
    return `$${Number(value).toFixed(2)} USD`;
}

function openModal(modal) {
    if (modal) modal.classList.remove('hidden');
}

function closeModal(modal) {
    if (modal) modal.classList.add('hidden');
}

/**
 * Makes API calls with proper error handling and no CORS proxy
 * @param {string} url The API endpoint URL
 * @param {object} options Fetch options
 * @returns {Promise} The fetch response
 */
async function makeApiCall(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// --- Main Script ---

document.addEventListener('authReady', (e) => {
    console.log('[Collection v30.1] Auth ready. Initializing script...');
    const user = e.detail.user;
    const db = firebase.firestore();
    const mainContainer = document.querySelector('main.container');

    if (!mainContainer) {
        console.error('[Collection v30.1] Critical error: main container not found. Script cannot run.');
        return;
    }

    if (!user) {
        console.log('[Collection v30.1] No user found. Displaying login message.');
        mainContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to manage your collection.</p>';
        return;
    }
    console.log(`[Collection v30.1] User ${user.uid} authenticated. Setting up page elements.`);

    // --- State ---
    let bulkEditMode = false;
    let quickEditMode = false;
    let selectedCards = new Set();
    let fullCollection = [];
    let fullWishlist = [];
    let filteredCollection = [];
    let currentView = 'grid';
    const pokemonApiUrl = 'https://api.pokemontcg.io/v2/cards';
    const pokemonApiKey = '60a08d4a-3a34-43d8-8f41-827b58cfac6d';
    let versionCount = 0;

    // --- DOM Element References ---
    const elements = {
        tabs: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),
        csvUploadBtn: document.getElementById('csv-upload-btn'),
        csvUploadInput: document.getElementById('csv-upload-input'),
        csvStatus: document.getElementById('csv-status'),
        collectionGridView: document.getElementById('collection-grid-view'),
        collectionTableView: document.getElementById('collection-table-view'),
        wishlistListContainer: document.getElementById('wishlist-list'),
        bulkEditBtn: document.getElementById('bulk-edit-btn'),
        bulkActionBar: document.getElementById('bulk-action-bar'),
        selectedCountEl: document.getElementById('selected-count'),
        selectAllCheckbox: document.getElementById('select-all-checkbox'),
        listSelectedBtn: document.getElementById('list-selected-btn'),
        deleteSelectedBtn: document.getElementById('delete-selected-btn'),
        listForSaleModal: document.getElementById('list-for-sale-modal'),
        editCardModal: document.getElementById('edit-card-modal'),
        editCardForm: document.getElementById('edit-card-form'),
        manageListingModal: document.getElementById('manage-listing-modal'),
        manageListingForm: document.getElementById('manage-listing-form'),
        quickEditBtn: document.getElementById('quick-edit-btn'),
        quickEditSaveBar: document.getElementById('quick-edit-save-bar'),
        saveQuickEditsBtn: document.getElementById('save-quick-edits-btn'),
        percentagePriceForm: document.getElementById('percentage-price-form'),
        fixedUndercutForm: document.getElementById('fixed-undercut-form'),
        manualGameSelect: document.getElementById('manual-game-select'),
        searchCardVersionsBtn: document.getElementById('search-card-versions-btn'),
        manualAddResultsContainer: document.getElementById('manual-add-results'),
        addVersionModal: document.getElementById('add-version-modal'),
        addVersionForm: document.getElementById('add-version-form'),
        exportCollectionBtn: document.getElementById('export-collection-btn'),
        filterNameInput: document.getElementById('filter-name'),
        filterSetSelect: document.getElementById('filter-set'),
        filterRaritySelect: document.getElementById('filter-rarity'),
        filterColorSelect: document.getElementById('filter-color'),
        resetFiltersBtn: document.getElementById('reset-filters-btn'),
        gridViewBtn: document.getElementById('grid-view-btn'),
        listViewBtn: document.getElementById('list-view-btn'),
        cardVersionsContainer: document.getElementById('card-versions-container'),
        addAnotherVersionBtn: document.getElementById('add-another-version-btn'),
    };

    const loadCollectionData = async () => {
        if (!elements.collectionGridView) return;
        elements.collectionGridView.innerHTML = '<p class="text-center p-4 text-gray-500 dark:text-gray-400">Loading your collection...</p>';
        try {
            const snapshot = await db.collection('users').doc(user.uid).collection('collection').orderBy('name').get();
            fullCollection = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            filteredCollection = [...fullCollection];
            console.log(`[Collection v30.1] Loaded ${fullCollection.length} cards from Firestore.`);
            calculateAndDisplayStats(fullCollection);
            populateFilters();
            renderCurrentView();
        } catch (error) {
            console.error(`[Collection v30.1] Error loading collection:`, error);
            if (elements.collectionGridView) elements.collectionGridView.innerHTML = `<p class="text-center text-red-500 p-4">Could not load collection. See console for details.</p>`;
        }
    };

    const loadWishlistData = async () => {
        if (!elements.wishlistListContainer) return;
        elements.wishlistListContainer.innerHTML = '<p class="text-center p-4 text-gray-500 dark:text-gray-400">Loading wishlist...</p>';
        try {
            const snapshot = await db.collection('users').doc(user.uid).collection('wishlist').orderBy('name').get();
            fullWishlist = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderWishlist(fullWishlist);
        } catch (error) {
            console.error(`[Collection v30.1] Error loading wishlist:`, error);
            if (elements.wishlistListContainer) elements.wishlistListContainer.innerHTML = `<p class="text-center text-red-500 p-4">Could not load your wishlist.</p>`;
        }
    };

    const renderWishlist = (wishlistItems) => {
        if (!elements.wishlistListContainer) return;
        if (wishlistItems.length === 0) {
            elements.wishlistListContainer.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400 col-span-full">Your wishlist is empty.</p>`;
            return;
        }
        elements.wishlistListContainer.innerHTML = '';
        wishlistItems.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'relative group cursor-pointer';
            cardEl.dataset.id = card.id;
            cardEl.innerHTML = `
                <img src="${getCardImageUrl(card, 'normal')}" alt="${card.name}" class="rounded-lg shadow-md w-full" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                <div class="card-actions absolute top-0 right-0 p-1 bg-black bg-opacity-50 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="edit-card-btn text-white text-xs" data-id="${card.id}" data-list="wishlist"><i class="fas fa-edit"></i></button>
                    <button class="delete-card-btn text-white text-xs ml-1" data-id="${card.id}" data-list="wishlist"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            // Add click event for modal
            cardEl.addEventListener('click', (e) => {
                if (!e.target.closest('.card-actions')) {
                    openCardManagementModal(card);
                }
            });
            
            elements.wishlistListContainer.appendChild(cardEl);
        });
    };

    const calculateAndDisplayStats = (collectionData) => {
        let totalCards = 0;
        let totalValue = 0;
        collectionData.forEach(card => {
            const quantity = card.quantity || 1;
            totalCards += quantity;
            const price = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
            totalValue += price * quantity;
        });

        const statsTotalCardsEl = document.getElementById('stats-total-cards');
        const statsUniqueCardsEl = document.getElementById('stats-unique-cards');
        const statsTotalValueEl = document.getElementById('stats-total-value');

        if (statsTotalCardsEl) statsTotalCardsEl.textContent = totalCards;
        if (statsUniqueCardsEl) statsUniqueCardsEl.textContent = new Set(collectionData.map(c => c.name)).size;
        if (statsTotalValueEl) statsTotalValueEl.textContent = safeFormatPrice(totalValue);
    };

    const populateFilters = () => {
        if (!elements.filterSetSelect) return;
        const sets = new Set(fullCollection.map(card => card.setName).filter(Boolean));
        elements.filterSetSelect.innerHTML = '<option value="all">All Sets</option>';
        [...sets].sort().forEach(setName => {
            const option = document.createElement('option');
            option.value = setName;
            option.textContent = setName;
            elements.filterSetSelect.appendChild(option);
        });
    };

    const applyFilters = () => {
        const nameFilter = elements.filterNameInput ? elements.filterNameInput.value.toLowerCase() : '';
        const setFilter = elements.filterSetSelect ? elements.filterSetSelect.value : 'all';
        const rarityFilter = elements.filterRaritySelect ? elements.filterRaritySelect.value : 'all';
        const colorFilter = elements.filterColorSelect ? elements.filterColorSelect.value : 'all';

        filteredCollection = fullCollection.filter(card => {
            const cardColors = card.colors || [];
            const nameMatch = card.name.toLowerCase().includes(nameFilter);
            const setMatch = setFilter === 'all' || card.setName === setFilter;
            const rarityMatch = rarityFilter === 'all' || card.rarity === rarityFilter;
            let colorMatch = true;
            if (colorFilter !== 'all') {
                if (colorFilter === 'M') colorMatch = cardColors.length > 1;
                else if (colorFilter === 'C') colorMatch = cardColors.length === 0;
                else colorMatch = cardColors.includes(colorFilter);
            }
            return nameMatch && setMatch && rarityMatch && colorMatch;
        });
        renderCurrentView();
    };

    const renderCurrentView = () => {
        if (currentView === 'grid') renderGridView();
        else renderListView();
    };

    const renderGridView = () => {
        const container = elements.collectionGridView;
        if (!container) return;

        if (elements.collectionTableView) elements.collectionTableView.classList.add('hidden');
        container.classList.remove('hidden');

        if (filteredCollection.length === 0) {
            container.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400 col-span-full">No cards found.</p>`;
            return;
        }

        container.innerHTML = '';
        filteredCollection.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'relative group cursor-pointer';
            cardEl.dataset.id = card.id;

            const forSaleIndicator = card.forSale ? 'border-4 border-green-500' : '';
            const isSelected = selectedCards.has(card.id);
            const checkboxOverlay = bulkEditMode ? `<div class="bulk-checkbox-overlay absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-3xl ${isSelected ? '' : 'hidden'}"><i class="fas fa-check-circle"></i></div>` : '';
            const priceUsd = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
            const formattedPrice = priceUsd > 0 ? safeFormatPrice(priceUsd) : '';
            const priceTagHTML = formattedPrice ? `<div class="absolute top-1.5 left-1.5 bg-black bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">${formattedPrice}</div>` : '';
            const quantityBadge = `<div class="absolute top-1.5 right-1.5 bg-gray-900 bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">x${card.quantity || 1}</div>`;

            cardEl.innerHTML = `
                <div class="relative">
                    <img src="${getCardImageUrl(card, 'normal')}" alt="${card.name}" class="rounded-lg shadow-md w-full ${forSaleIndicator}" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                    ${quantityBadge}
                    ${checkboxOverlay}
                </div>
                ${priceTagHTML}
                <div class="card-actions absolute bottom-0 right-0 p-1 bg-black bg-opacity-50 rounded-tl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="edit-card-btn text-white text-xs" data-id="${card.id}" data-list="collection"><i class="fas fa-edit"></i></button>
                    <button class="delete-card-btn text-white text-xs ml-1" data-id="${card.id}" data-list="collection"><i class="fas fa-trash"></i></button>
                    <button class="manage-listing-btn text-white text-xs ml-1" data-id="${card.id}" data-list="collection"><i class="fas fa-tags"></i></button>
                </div>`;
            
            // Add click event for modal (only if not in bulk edit mode)
            cardEl.addEventListener('click', (e) => {
                if (bulkEditMode) {
                    handleCardSelection(card.id);
                } else if (!e.target.closest('.card-actions')) {
                    openCardManagementModal(card);
                }
            });
            
            container.appendChild(cardEl);
        });
    };

    const renderListView = () => {
        const container = elements.collectionTableView;
        if (!container) return;

        if (elements.collectionGridView) elements.collectionGridView.classList.add('hidden');
        container.classList.remove('hidden');

        if (filteredCollection.length === 0) {
            container.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400">No cards match your filters.</p>`;
            return;
        }

        let tableHTML = `
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Set</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Price</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">`;
        
        filteredCollection.forEach(card => {
            const priceUsd = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
            const formattedPrice = priceUsd > 0 ? safeFormatPrice(priceUsd) : 'N/A';
            
            tableHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" data-card-id="${card.id}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${card.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${card.setName || 'Unknown'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${card.quantity || 1}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${formattedPrice}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button class="text-blue-600 hover:text-blue-900 mr-2 edit-card-btn" data-id="${card.id}" data-list="collection">Edit</button>
                        <button class="text-red-600 hover:text-red-900 delete-card-btn" data-id="${card.id}" data-list="collection">Delete</button>
                    </td>
                </tr>`;
        });
        
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;

        // Add click events to table rows
        container.querySelectorAll('tr[data-card-id]').forEach(row => {
            row.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const cardId = row.dataset.cardId;
                    const card = filteredCollection.find(c => c.id === cardId);
                    if (card) {
                        openCardManagementModal(card);
                    }
                }
            });
        });
    };

    // Enhanced Card Management Modal
    const openCardManagementModal = (card) => {
        const modal = createCardManagementModal(card);
        document.body.appendChild(modal);
        openModal(modal);
    };

    const createCardManagementModal = (card) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.id = 'card-management-modal';
        
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 class="text-2xl font-bold dark:text-white">Manage ${card.name}</h2>
                    <button class="close-modal text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl">×</button>
                </div>
                
                <div class="p-6">
                    <div class="flex flex-col lg:flex-row gap-6">
                        <div class="lg:w-1/3">
                            <img src="${getCardImageUrl(card, 'normal')}" alt="${card.name}" class="w-full rounded-lg shadow-md">
                            <div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
                                <p><strong>Set:</strong> ${card.setName || 'Unknown'}</p>
                                <p><strong>Rarity:</strong> ${card.rarity || 'Unknown'}</p>
                                <p><strong>Number:</strong> ${card.collector_number || 'Unknown'}</p>
                                <p><strong>TCG:</strong> ${card.tcg || 'Magic: The Gathering'}</p>
                                ${card.priceUsd ? `<p><strong>Price:</strong> ${safeFormatPrice(card.priceUsd)}</p>` : ''}
                                ${card.priceUsdFoil ? `<p><strong>Foil Price:</strong> ${safeFormatPrice(card.priceUsdFoil)}</p>` : ''}
                            </div>
                        </div>
                        
                        <div class="lg:w-2/3">
                            <div class="mb-4">
                                <h3 class="text-lg font-semibold dark:text-white mb-2">Card Versions</h3>
                                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Manage different versions of this card (foil, signed, altered, etc.)</p>
                            </div>
                            
                            <div id="card-versions-list" class="space-y-4 max-h-96 overflow-y-auto">
                                <!-- Card versions will be populated here -->
                            </div>
                            
                            <button id="add-version-btn" class="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center">
                                <i class="fas fa-plus mr-2"></i>Add Another Version
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                    <button class="cancel-btn px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">Cancel</button>
                    <button class="save-btn px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save Changes</button>
                </div>
            </div>
        `;
        
        // Add initial version if this is a new card or load existing data
        const existingCard = fullCollection.find(c => c.name === card.name && c.set === card.set);
        if (existingCard) {
            addCardVersion(modal, card, existingCard);
        } else {
            addCardVersion(modal, card);
        }
        
        // Event listeners
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('.cancel-btn').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.querySelector('#add-version-btn').addEventListener('click', () => {
            addCardVersion(modal, card);
        });
        
        modal.querySelector('.save-btn').addEventListener('click', () => {
            saveCardVersions(modal, card);
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        return modal;
    };

    const addCardVersion = (modal, card, existingData = null) => {
        const versionsList = modal.querySelector('#card-versions-list');
        const versionId = Date.now() + Math.random();
        
        const versionDiv = document.createElement('div');
        versionDiv.className = 'border border-gray-200 dark:border-gray-700 rounded-lg p-4 card-version';
        versionDiv.dataset.versionId = versionId;
        
        versionDiv.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <h4 class="font-semibold dark:text-white">Version ${versionsList.children.length + 1}</h4>
                <button class="remove-version text-red-500 hover:text-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
                    <input type="number" min="1" value="${existingData?.quantity || 1}" class="quantity-input w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Condition</label>
                    <select class="condition-input w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                        <option value="Near Mint" ${existingData?.condition === 'Near Mint' ? 'selected' : ''}>Near Mint</option>
                        <option value="Lightly Played" ${existingData?.condition === 'Lightly Played' ? 'selected' : ''}>Lightly Played</option>
                        <option value="Moderately Played" ${existingData?.condition === 'Moderately Played' ? 'selected' : ''}>Moderately Played</option>
                        <option value="Heavily Played" ${existingData?.condition === 'Heavily Played' ? 'selected' : ''}>Heavily Played</option>
                        <option value="Damaged" ${existingData?.condition === 'Damaged' ? 'selected' : ''}>Damaged</option>
                    </select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Language</label>
                    <input type="text" value="${existingData?.language || 'English'}" class="language-input w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purchase Price</label>
                    <input type="number" step="0.01" value="${existingData?.purchasePrice || ''}" placeholder="0.00" class="purchase-price-input w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                </div>
                
                <div class="md:col-span-2 lg:col-span-1">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add to List</label>
                    <select class="list-select w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                        <option value="collection">Collection</option>
                        <option value="wishlist">Wishlist</option>
                    </select>
                </div>
            </div>
            
            <div class="mt-4 grid grid-cols-3 gap-4">
                <label class="flex items-center">
                    <input type="checkbox" ${existingData?.isFoil ? 'checked' : ''} class="foil-input mr-2">
                    <span class="text-sm dark:text-gray-300">Foil</span>
                </label>
                
                <label class="flex items-center">
                    <input type="checkbox" ${existingData?.isSigned ? 'checked' : ''} class="signed-input mr-2">
                    <span class="text-sm dark:text-gray-300">Signed</span>
                </label>
                
                <label class="flex items-center">
                    <input type="checkbox" ${existingData?.isAltered ? 'checked' : ''} class="altered-input mr-2">
                    <span class="text-sm dark:text-gray-300">Altered</span>
                </label>
            </div>
            
            <div class="mt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Photo Upload</label>
                <input type="file" accept="image/*" class="photo-input w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                <div class="photo-preview mt-2 hidden">
                    <img class="w-32 h-32 object-cover rounded-md" alt="Card photo">
                    <button type="button" class="remove-photo mt-1 text-xs text-red-500 hover:text-red-700">Remove Photo</button>
                </div>
            </div>
            
            <div class="mt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea class="notes-input w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" rows="2" placeholder="Additional notes...">${existingData?.notes || ''}</textarea>
            </div>
        `;
        
        // Add remove functionality
        versionDiv.querySelector('.remove-version').addEventListener('click', () => {
            if (versionsList.children.length > 1) {
                versionDiv.remove();
                updateVersionNumbers(modal);
            } else {
                alert('You must have at least one version of the card.');
            }
        });
        
        // Add photo preview functionality
        const photoInput = versionDiv.querySelector('.photo-input');
        const photoPreview = versionDiv.querySelector('.photo-preview');
        const photoImg = photoPreview.querySelector('img');
        const removePhotoBtn = photoPreview.querySelector('.remove-photo');
        
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    photoImg.src = e.target.result;
                    photoPreview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                photoPreview.classList.add('hidden');
            }
        });
        
        removePhotoBtn.addEventListener('click', () => {
            photoInput.value = '';
            photoPreview.classList.add('hidden');
        });
        
        versionsList.appendChild(versionDiv);
        updateVersionNumbers(modal);
    };

    const updateVersionNumbers = (modal) => {
        const versions = modal.querySelectorAll('.card-version');
        versions.forEach((version, index) => {
            const header = version.querySelector('h4');
            header.textContent = `Version ${index + 1}`;
        });
    };

    const saveCardVersions = async (modal, card) => {
        const versions = modal.querySelectorAll('.card-version');
        const saveBtn = modal.querySelector('.save-btn');
        
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
        
        try {
            const batch = db.batch();
            
            // Process each version
            for (const version of versions) {
                const listType = version.querySelector('.list-select').value;
                const versionData = {
                    ...card,
                    quantity: parseInt(version.querySelector('.quantity-input').value) || 1,
                    condition: version.querySelector('.condition-input').value,
                    language: version.querySelector('.language-input').value,
                    purchasePrice: parseFloat(version.querySelector('.purchase-price-input').value) || null,
                    isFoil: version.querySelector('.foil-input').checked,
                    isSigned: version.querySelector('.signed-input').checked,
                    isAltered: version.querySelector('.altered-input').checked,
                    notes: version.querySelector('.notes-input').value,
                    dateAdded: firebase.firestore.FieldValue.serverTimestamp(),
                    versionId: version.dataset.versionId
                };
                
                // Handle photo upload if present
                const photoInput = version.querySelector('.photo-input');
                if (photoInput.files[0]) {
                    const reader = new FileReader();
                    const fileData = await new Promise((resolve) => {
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(photoInput.files[0]);
                    });
                    versionData.customImageUrl = fileData;
                }
                
                const newDocRef = db.collection('users').doc(user.uid).collection(listType).doc();
                batch.set(newDocRef, versionData);
            }
            
            await batch.commit();
            modal.remove();
            
            // Reload the appropriate data
            loadCollectionData();
            loadWishlistData();
            
            // Show success message
            showNotification('Card versions saved successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving card versions:', error);
            showNotification('Error saving card versions. Please try again.', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Changes';
        }
    };

    // Notification system
    const showNotification = (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-2"></i>
                <span>${message}</span>
                <button class="ml-auto text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    };

    // Fixed Pokemon TCG API search
    const searchPokemonCards = async (cardName) => {
        try {
            // Fixed query format - removed quotes and used proper syntax
            const searchUrl = `${pokemonApiUrl}?q=name:${encodeURIComponent(cardName)}*`;
            
            const response = await fetch(searchUrl, {
                headers: {
                    'X-Api-Key': pokemonApiKey
                }
            });
            
            if (!response.ok) {
                throw new Error(`Pokemon API error: ${response.status}`);
            }
            
            const result = await response.json();
            
            return result.data.map(card => ({
                id: card.id,
                name: card.name,
                set: card.set.id,
                setName: card.set.name,
                rarity: card.rarity,
                collector_number: card.number,
                imageUrl: card.images.small,
                priceUsd: card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market || null,
                priceUsdFoil: card.tcgplayer?.prices?.reverseHolofoil?.market || null,
                tcg: 'Pokémon',
                types: card.types,
                images: card.images
            }));
            
        } catch (error) {
            console.error('Error searching Pokemon cards:', error);
            throw error;
        }
    };

    // Fixed Magic: The Gathering API search
    const searchMagicCards = async (cardName) => {
        try {
            const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints&order=released&dir=desc`;
            const result = await makeApiCall(searchUrl);
            
            return result.data.map(card => ({
                id: card.id,
                name: card.name,
                set: card.set,
                setName: card.set_name,
                rarity: card.rarity,
                collector_number: card.collector_number,
                imageUrl: getCardImageUrl(card, 'small'),
                priceUsd: card.prices?.usd || null,
                priceUsdFoil: card.prices?.usd_foil || null,
                tcg: 'Magic: The Gathering',
                colors: (card.card_faces ? card.card_faces[0].colors : card.colors) || [],
                card_faces: card.card_faces,
                image_uris: card.image_uris
            }));
            
        } catch (error) {
            console.error('Error searching Magic cards:', error);
            throw error;
        }
    };

    // Bulk edit functionality
    const toggleBulkEditMode = () => {
        bulkEditMode = !bulkEditMode;
        selectedCards.clear();
        if (elements.selectAllCheckbox) elements.selectAllCheckbox.checked = false;

        if (bulkEditMode) {
            if (elements.bulkEditBtn) {
                elements.bulkEditBtn.textContent = 'Cancel';
                elements.bulkEditBtn.classList.add('bg-red-600', 'hover:bg-red-700');
            }
            if (elements.bulkActionBar) elements.bulkActionBar.classList.remove('hidden');
            if (elements.quickEditBtn) elements.quickEditBtn.classList.add('hidden');
        } else {
            if (elements.bulkEditBtn) {
                elements.bulkEditBtn.textContent = 'Bulk Edit';
                elements.bulkEditBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            }
            if (elements.bulkActionBar) elements.bulkActionBar.classList.add('hidden');
            if (elements.quickEditBtn) elements.quickEditBtn.classList.remove('hidden');
        }
        updateSelectedCount();
        renderCurrentView();
    };

    const handleCardSelection = (cardId) => {
        if (selectedCards.has(cardId)) {
            selectedCards.delete(cardId);
        } else {
            selectedCards.add(cardId);
        }
        updateSelectedCount();
        const cardEl = elements.collectionGridView.querySelector(`div[data-id="${cardId}"]`);
        if (cardEl) {
            cardEl.querySelector('.bulk-checkbox-overlay')?.classList.toggle('hidden', !selectedCards.has(cardId));
        }
    };

    const updateSelectedCount = () => {
        if (elements.selectedCountEl) {
            elements.selectedCountEl.textContent = `${selectedCards.size} cards selected`;
        }
    };

    // Delete card functionality
    const deleteCard = async (cardId, listType) => {
        if (confirm('Are you sure you want to delete this card?')) {
            try {
                await db.collection('users').doc(user.uid).collection(listType).doc(cardId).delete();
                if (listType === 'collection') loadCollectionData();
                else loadWishlistData();
                showNotification('Card deleted successfully!', 'success');
            } catch (error) {
                console.error("Error deleting card:", error);
                showNotification('Could not delete card.', 'error');
            }
        }
    };

    // Event Listeners for search functionality
    if (elements.searchCardVersionsBtn) {
        elements.searchCardVersionsBtn.addEventListener('click', async () => {
            const cardName = document.getElementById('manual-card-name').value.trim();
            const game = elements.manualGameSelect.value;

            if (!cardName) {
                alert("Please enter a card name.");
                return;
            }

            elements.manualAddResultsContainer.innerHTML = '<p class="text-center text-gray-500">Searching...</p>';

            let versions = [];
            try {
                if (game === 'magic') {
                    versions = await searchMagicCards(cardName);
                } else if (game === 'pokemon') {
                    versions = await searchPokemonCards(cardName);
                }

                if (versions.length === 0) {
                    elements.manualAddResultsContainer.innerHTML = '<p class="text-center text-gray-500">No cards found. Try a different search term.</p>';
                    return;
                }

                let versionsHtml = versions.map(v => `
                    <div class="flex items-center p-3 border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer add-version-btn transition-colors" data-card='${JSON.stringify(v)}'>
                        <img src="${v.imageUrl}" class="w-12 h-16 object-cover rounded-sm mr-3 shadow-sm" onerror="this.src='https://placehold.co/48x64/cccccc/969696?text=No+Image'">
                        <div class="flex-grow">
                            <p class="font-semibold dark:text-white">${v.name}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${v.setName} (#${v.collector_number})</p>
                            <p class="text-xs text-gray-600 dark:text-gray-300">${v.tcg}</p>
                            ${v.priceUsd ? `<p class="text-xs text-green-600 dark:text-green-400">$${v.priceUsd}</p>` : ''}
                        </div>
                        <div class="text-blue-600 dark:text-blue-400">
                            <i class="fas fa-plus-circle text-lg"></i>
                        </div>
                    </div>
                `).join('');
                
                elements.manualAddResultsContainer.innerHTML = versionsHtml;

                // Add click events to search results
                elements.manualAddResultsContainer.querySelectorAll('.add-version-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const cardData = JSON.parse(btn.dataset.card);
                        openCardManagementModal(cardData);
                    });
                });

            } catch (error) {
                console.error("Error fetching card versions:", error);
                elements.manualAddResultsContainer.innerHTML = '<p class="text-center text-red-500">An error occurred while searching. Please try again.</p>';
            }
        });
    }

    // Event listeners for existing functionality
    if (elements.bulkEditBtn) elements.bulkEditBtn.addEventListener('click', toggleBulkEditMode);

    // Event delegation for card actions
    document.addEventListener('click', async (e) => {
        if (e.target.closest('.edit-card-btn')) {
            const btn = e.target.closest('.edit-card-btn');
            const cardId = btn.dataset.id;
            const listType = btn.dataset.list;
            
            try {
                const docRef = db.collection('users').doc(user.uid).collection(listType).doc(cardId);
                const docSnap = await docRef.get();
                if (docSnap.exists) {
                    const card = { id: cardId, ...docSnap.data() };
                    openCardManagementModal(card);
                }
            } catch (error) {
                console.error("Error loading card for edit:", error);
                showNotification('Could not load card details.', 'error');
            }
        }
        
        if (e.target.closest('.delete-card-btn')) {
            const btn = e.target.closest('.delete-card-btn');
            const cardId = btn.dataset.id;
            const listType = btn.dataset.list;
            deleteCard(cardId, listType);
        }
    });

    // Filter event listeners
    if (elements.filterNameInput) elements.filterNameInput.addEventListener('input', applyFilters);
    if (elements.filterSetSelect) elements.filterSetSelect.addEventListener('change', applyFilters);
    if (elements.filterRaritySelect) elements.filterRaritySelect.addEventListener('change', applyFilters);
    if (elements.filterColorSelect) elements.filterColorSelect.addEventListener('change', applyFilters);
    if (elements.resetFiltersBtn) elements.resetFiltersBtn.addEventListener('click', () => {
        if (elements.filterNameInput) elements.filterNameInput.value = '';
        if (elements.filterSetSelect) elements.filterSetSelect.value = 'all';
        if (elements.filterRaritySelect) elements.filterRaritySelect.value = 'all';
        if (elements.filterColorSelect) elements.filterColorSelect.value = 'all';
        applyFilters();
    });

    // View switching
    const switchView = (view) => {
        currentView = view;
        if (elements.gridViewBtn && elements.listViewBtn) {
            elements.gridViewBtn.classList.toggle('bg-blue-600', view === 'grid');
            elements.gridViewBtn.classList.toggle('text-white', view === 'grid');
            elements.listViewBtn.classList.toggle('bg-blue-600', view === 'list');
            elements.listViewBtn.classList.toggle('text-white', view === 'list');
        }
        renderCurrentView();
    };

    if (elements.gridViewBtn) elements.gridViewBtn.addEventListener('click', () => switchView('grid'));
    if (elements.listViewBtn) elements.listViewBtn.addEventListener('click', () => switchView('list'));

    // Tab switching logic
    elements.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetContentId = `content-${tab.id.split('-')[1]}`;

            elements.tabs.forEach(t => t.classList.remove('text-blue-600', 'border-blue-600'));
            tab.classList.add('text-blue-600', 'border-blue-600');

            elements.tabContents.forEach(content => {
                if (content.id === targetContentId) {
                    content.classList.remove('hidden');
                } else {
                    content.classList.add('hidden');
                }
            });
        });
    });

    // Initialize the page
    console.log('[Collection v30.1] Starting initial data load.');
    loadCollectionData();
    loadWishlistData();
});

