/**
 * HatakeSocial - My Collection Page Script (v24 - Filter & View Fix)
 *
 * This script handles all logic for the my_collection.html page.
 * - FIX: The client-side filtering logic has been corrected and now works as intended.
 * - RE-IMPLEMENTED: A "List View" toggle has been added back, allowing users to switch
 * between the default grid view and a more detailed table view of their collection.
 * - All previous functionality (CSV import, bulk edit, etc.) is preserved.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const collectionPageContainer = document.getElementById('content-collection');
    if (!collectionPageContainer) return;

    if (!user) {
        const mainContent = document.querySelector('main.container');
        if (mainContent) mainContent.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to manage your collection.</p>';
        return;
    }

    // --- State ---
    let bulkEditMode = false;
    let quickEditMode = false;
    let selectedCards = new Set();
    let fullCollection = [];
    let filteredCollection = [];
    let currentView = 'grid'; // 'grid' or 'list'

    // --- DOM Elements ---
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const csvUploadBtn = document.getElementById('csv-upload-btn');
    const csvUploadInput = document.getElementById('csv-upload-input');
    const csvStatus = document.getElementById('csv-status');
    const collectionGridView = document.getElementById('collection-grid-view');
    const collectionTableView = document.getElementById('collection-table-view');
    const wishlistListContainer = document.getElementById('wishlist-list');
    const bulkEditBtn = document.getElementById('bulk-edit-btn');
    const bulkActionBar = document.getElementById('bulk-action-bar');
    const selectedCountEl = document.getElementById('selected-count');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const listSelectedBtn = document.getElementById('list-selected-btn');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    const listForSaleModal = document.getElementById('list-for-sale-modal');
    const editCardModal = document.getElementById('edit-card-modal');
    const editCardForm = document.getElementById('edit-card-form');
    const manageListingModal = document.getElementById('manage-listing-modal');
    const quickEditBtn = document.getElementById('quick-edit-btn');
    const quickEditSaveBar = document.getElementById('quick-edit-save-bar');
    const saveQuickEditsBtn = document.getElementById('save-quick-edits-btn');
    const percentagePriceForm = document.getElementById('percentage-price-form');
    const fixedUndercutForm = document.getElementById('fixed-undercut-form');
    const manualGameSelect = document.getElementById('manual-game-select');
    const searchCardVersionsBtn = document.getElementById('search-card-versions-btn');
    const manualAddResultsContainer = document.getElementById('manual-add-results');
    const addVersionModal = document.getElementById('add-version-modal');
    const addVersionForm = document.getElementById('add-version-form');
    const closeAddVersionModalBtn = document.getElementById('close-add-version-modal');
    const exportCollectionBtn = document.getElementById('export-collection-btn');

    // Filter Elements
    const filterNameInput = document.getElementById('filter-name');
    const filterSetSelect = document.getElementById('filter-set');
    const filterRaritySelect = document.getElementById('filter-rarity');
    const filterColorSelect = document.getElementById('filter-color');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');

    // View Toggle Elements
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');


    const loadCollectionData = async () => {
        const container = collectionGridView;
        container.innerHTML = '<p class="text-center p-4 text-gray-500 dark:text-gray-400">Loading your collection...</p>';
        try {
            const snapshot = await db.collection('users').doc(user.uid).collection('collection').orderBy('name').get();
            fullCollection = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            filteredCollection = [...fullCollection];

            calculateAndDisplayStats(fullCollection);
            populateFilters();
            renderCurrentView();
        } catch (error) {
            console.error(`Error loading collection:`, error);
            container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load your collection.</p>`;
        }
    };

    const loadWishlistData = async () => {
        const container = wishlistListContainer;
        container.innerHTML = '<p class="text-center p-4 text-gray-500 dark:text-gray-400">Loading wishlist...</p>';
        try {
            const snapshot = await db.collection('users').doc(user.uid).collection('wishlist').orderBy('name').get();
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderWishlist(items);
        } catch (error) {
            console.error(`Error loading wishlist:`, error);
            container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load your wishlist.</p>`;
        }
    };

    const populateFilters = () => {
        const sets = new Set();
        fullCollection.forEach(card => {
            if (card.setName) sets.add(card.setName);
        });

        filterSetSelect.innerHTML = '<option value="all">All Sets</option>';
        [...sets].sort().forEach(setName => {
            const option = document.createElement('option');
            option.value = setName;
            option.textContent = setName;
            filterSetSelect.appendChild(option);
        });
    };

    const applyFilters = () => {
        const nameFilter = filterNameInput.value.toLowerCase();
        const setFilter = filterSetSelect.value;
        const rarityFilter = filterRaritySelect.value;
        const colorFilter = filterColorSelect.value;

        filteredCollection = fullCollection.filter(card => {
            const cardColors = card.colors || [];

            const nameMatch = card.name.toLowerCase().includes(nameFilter);
            const setMatch = setFilter === 'all' || card.setName === setFilter;
            const rarityMatch = rarityFilter === 'all' || card.rarity === rarityFilter;

            let colorMatch = true;
            if (colorFilter !== 'all') {
                if (colorFilter === 'M') {
                    colorMatch = cardColors.length > 1;
                } else if (colorFilter === 'C') {
                    colorMatch = cardColors.length === 0;
                } else {
                    colorMatch = cardColors.includes(colorFilter);
                }
            }

            return nameMatch && setMatch && rarityMatch && colorMatch;
        });

        renderCurrentView();
    };

    const renderCurrentView = () => {
        if (currentView === 'grid') {
            renderGridView();
        } else {
            renderListView();
        }
    };

    const renderGridView = () => {
        const container = collectionGridView;
        const collectionToRender = filteredCollection;

        if (collectionTableView) collectionTableView.classList.add('hidden');
        if(container) container.classList.remove('hidden');

        if (collectionToRender.length === 0) {
            container.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400">No cards match your filters.</p>`;
            return;
        }

        container.innerHTML = '';
        collectionToRender.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'relative group cursor-pointer';
            cardEl.dataset.id = card.id;

            const forSaleIndicator = card.forSale ? 'border-4 border-green-500' : '';
            const isSelected = selectedCards.has(card.id);
            const checkboxOverlay = bulkEditMode ? `<div class="bulk-checkbox-overlay absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-3xl ${isSelected ? '' : 'hidden'}"><i class="fas fa-check-circle"></i></div>` : '';

            const priceUsd = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
            const formattedPrice = priceUsd > 0 ? window.HatakeSocial.convertAndFormatPrice(priceUsd, 'USD') : '';
            const priceTagHTML = formattedPrice
                ? `<div class="absolute top-1.5 left-1.5 bg-black bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">${formattedPrice}</div>`
                : '';
            const foilIndicatorHTML = card.isFoil ? `<div class="absolute bottom-1.5 left-1.5 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">Foil</div>` : '';

            const quantityBadge = `<div class="absolute top-1.5 right-1.5 bg-gray-900 bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">x${card.quantity}</div>`;

            cardEl.innerHTML = `
                <div class="relative">
                    <img src="${card.imageUrl || 'https://placehold.co/223x310'}" alt="${card.name}" class="rounded-lg shadow-md w-full ${forSaleIndicator}" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                    ${quantityBadge}
                    ${checkboxOverlay}
                </div>
                ${priceTagHTML}
                ${foilIndicatorHTML}
                <div class="card-actions absolute bottom-0 right-0 p-1 bg-black bg-opacity-50 rounded-tl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="edit-card-btn text-white text-xs" data-list="collection"><i class="fas fa-edit"></i></button>
                    <button class="delete-card-btn text-white text-xs ml-1" data-list="collection"><i class="fas fa-trash"></i></button>
                    <button class="manage-listing-btn text-white text-xs ml-1" data-list="collection"><i class="fas fa-tags"></i></button>
                </div>
            `;
            container.appendChild(cardEl);
        });
    };

    const renderListView = () => {
        const container = collectionTableView;
        const collectionToRender = filteredCollection;

        if(collectionGridView) collectionGridView.classList.add('hidden');
        if(container) container.classList.remove('hidden');

        if (collectionToRender.length === 0) {
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
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Condition</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Value</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        `;
        collectionToRender.forEach(card => {
            const priceUsd = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
            const formattedPrice = priceUsd > 0 ? window.HatakeSocial.convertAndFormatPrice(priceUsd, 'USD') : 'N/A';
            tableHTML += `
                <tr class="group">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${card.name} ${card.isFoil ? '<i class="fas fa-star text-yellow-400"></i>' : ''}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${card.setName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${card.quantity}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${card.condition}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formattedPrice}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 space-x-2">
                        <button class="edit-card-btn text-blue-500 hover:text-blue-700" data-id="${card.id}" data-list="collection"><i class="fas fa-edit"></i></button>
                        <button class="delete-card-btn text-red-500 hover:text-red-700" data-id="${card.id}" data-list="collection"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    };

    const renderWishlist = (wishlistItems) => {
        if (!wishlistListContainer) return;
        if (wishlistItems.length === 0) {
            wishlistListContainer.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400">Your wishlist is empty.</p>`;
            return;
        }
        wishlistListContainer.innerHTML = '';
        wishlistItems.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'relative group cursor-pointer';
            cardEl.dataset.id = card.id;
            cardEl.innerHTML = `
                <img src="${card.imageUrl || 'https://placehold.co/223x310'}" alt="${card.name}" class="rounded-lg shadow-md w-full" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                <div class="card-actions absolute top-0 right-0 p-1 bg-black bg-opacity-50 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="edit-card-btn text-white text-xs" data-list="wishlist"><i class="fas fa-edit"></i></button>
                    <button class="delete-card-btn text-white text-xs ml-1" data-list="wishlist"><i class="fas fa-trash"></i></button>
                </div>
            `;
            wishlistListContainer.appendChild(cardEl);
        });
    };

    const calculateAndDisplayStats = (collectionData) => {
        let totalCards = 0;
        let totalValue = 0;
        const rarityCounts = { common: 0, uncommon: 0, rare: 0, mythic: 0 };
        const uniqueCards = new Set(collectionData.map(c => c.name)).size;

        collectionData.forEach(card => {
            const quantity = card.quantity || 1;
            totalCards += quantity;

            const price = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
            totalValue += price * quantity;

            if (card.rarity) {
                if (rarityCounts.hasOwnProperty(card.rarity.toLowerCase())) {
                    rarityCounts[card.rarity.toLowerCase()] += quantity;
                }
            }
        });

        document.getElementById('stats-total-cards').textContent = totalCards;
        document.getElementById('stats-unique-cards').textContent = uniqueCards;
        document.getElementById('stats-total-value').textContent = window.HatakeSocial.convertAndFormatPrice(totalValue, 'USD');

        const rarityContainer = document.getElementById('stats-rarity-breakdown');
        if (rarityContainer) {
            rarityContainer.innerHTML = `
                <span title="Common" class="flex items-center"><i class="fas fa-circle text-gray-400 mr-1"></i>${rarityCounts.common}</span>
                <span title="Uncommon" class="flex items-center"><i class="fas fa-circle text-blue-400 mr-1"></i>${rarityCounts.uncommon}</span>
                <span title="Rare" class="flex items-center"><i class="fas fa-circle text-yellow-400 mr-1"></i>${rarityCounts.rare}</span>
                <span title="Mythic" class="flex items-center"><i class="fas fa-circle text-red-500 mr-1"></i>${rarityCounts.mythic}</span>
            `;
        }
    };

    const toggleBulkEditMode = () => {
        bulkEditMode = !bulkEditMode;
        selectedCards.clear();
        if (selectAllCheckbox) selectAllCheckbox.checked = false;

        if (bulkEditMode) {
            bulkEditBtn.textContent = 'Cancel Bulk Edit';
            bulkEditBtn.classList.add('bg-red-600', 'hover:bg-red-700');
            bulkActionBar.classList.remove('hidden');
            quickEditBtn.classList.add('hidden');
        } else {
            bulkEditBtn.textContent = 'Bulk Edit';
            bulkEditBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            bulkActionBar.classList.add('hidden');
            quickEditBtn.classList.remove('hidden');
        }
        updateSelectedCount();
        renderGridView();
    };

    const toggleQuickEditMode = () => {
        quickEditMode = !quickEditMode;
        if (quickEditMode) {
            collectionGridView.classList.add('hidden');
            collectionTableView.classList.remove('hidden');
            quickEditSaveBar.classList.remove('hidden');
            bulkEditBtn.classList.add('hidden');
            quickEditBtn.innerHTML = '<i class="fas fa-times mr-2"></i>Cancel';
            quickEditBtn.classList.replace('bg-yellow-500', 'bg-red-500');
            quickEditBtn.classList.replace('hover:bg-yellow-600', 'hover:bg-red-600');
            renderQuickEditView();
        } else {
            collectionGridView.classList.remove('hidden');
            collectionTableView.classList.add('hidden');
            quickEditSaveBar.classList.add('hidden');
            bulkEditBtn.classList.remove('hidden');
            quickEditBtn.innerHTML = '<i class="fas fa-edit mr-2"></i>Quick Edit';
            quickEditBtn.classList.replace('bg-red-500', 'bg-yellow-500');
            quickEditBtn.classList.replace('hover:bg-red-600', 'hover:bg-yellow-600');
            renderGridView();
        }
    };

    const renderQuickEditView = () => {
        let tableHTML = `
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Card Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Condition</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Foil</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">For Sale</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Price</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        `;
        fullCollection.forEach(card => {
            tableHTML += `
                <tr data-id="${card.id}" class="quick-edit-row">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${card.name}</td>
                    <td class="px-6 py-4"><input type="number" value="${card.quantity}" class="w-16 p-1 border rounded dark:bg-gray-900 dark:border-gray-600 quick-edit-input" data-field="quantity"></td>
                    <td class="px-6 py-4">
                        <select class="p-1 border rounded dark:bg-gray-900 dark:border-gray-600 quick-edit-input" data-field="condition">
                            <option ${card.condition === 'Near Mint' ? 'selected' : ''}>Near Mint</option>
                            <option ${card.condition === 'Lightly Played' ? 'selected' : ''}>Lightly Played</option>
                            <option ${card.condition === 'Moderately Played' ? 'selected' : ''}>Moderately Played</option>
                            <option ${card.condition === 'Heavily Played' ? 'selected' : ''}>Heavily Played</option>
                            <option ${card.condition === 'Damaged' ? 'selected' : ''}>Damaged</option>
                        </select>
                    </td>
                    <td class="px-6 py-4"><input type="checkbox" ${card.isFoil ? 'checked' : ''} class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 quick-edit-input" data-field="isFoil"></td>
                    <td class="px-6 py-4"><input type="checkbox" ${card.forSale ? 'checked' : ''} class="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 quick-edit-input" data-field="forSale"></td>
                    <td class="px-6 py-4"><input type="number" value="${card.salePrice || ''}" placeholder="0.00" step="0.01" class="w-24 p-1 border rounded dark:bg-gray-900 dark:border-gray-600 quick-edit-input" data-field="salePrice"></td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        collectionTableView.innerHTML = tableHTML;
    };

    const saveQuickEdits = async () => {
        saveQuickEditsBtn.disabled = true;
        saveQuickEditsBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';

        const batch = db.batch();
        const rows = document.querySelectorAll('.quick-edit-row');

        rows.forEach(row => {
            const docId = row.dataset.id;
            const docRef = db.collection('users').doc(user.uid).collection('collection').doc(docId);
            const updatedData = {};
            row.querySelectorAll('.quick-edit-input').forEach(input => {
                const field = input.dataset.field;
                let value;
                if (input.type === 'checkbox') {
                    value = input.checked;
                } else if (input.type === 'number') {
                    value = parseFloat(input.value) || 0;
                } else {
                    value = input.value;
                }
                updatedData[field] = value;
            });
            batch.update(docRef, updatedData);
        });

        try {
            await batch.commit();
            alert("All changes saved successfully!");
            toggleQuickEditMode();
        } catch (error) {
            console.error("Error saving quick edits:", error);
            alert("An error occurred while saving changes.");
        } finally {
            saveQuickEditsBtn.disabled = false;
            saveQuickEditsBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save All Changes';
        }
    };

    const updateSelectedCount = () => {
        if (selectedCountEl) {
            selectedCountEl.textContent = `${selectedCards.size} cards selected`;
        }
    };

    const handleCardSelection = (cardId) => {
        if (selectedCards.has(cardId)) {
            selectedCards.delete(cardId);
        } else {
            selectedCards.add(cardId);
        }
        updateSelectedCount();
        const cardEl = document.querySelector(`div[data-id="${cardId}"]`);
        cardEl?.querySelector('.bulk-checkbox-overlay')?.classList.toggle('hidden', !selectedCards.has(cardId));
        if (selectAllCheckbox) {
            const allCollectionIds = fullCollection.map(c => c.id);
            selectAllCheckbox.checked = selectedCards.size === allCollectionIds.length && allCollectionIds.length > 0;
        }
    };

    const handleSelectAll = (e) => {
        const allCollectionIds = fullCollection.map(c => c.id);
        if (e.target.checked) {
            allCollectionIds.forEach(id => selectedCards.add(id));
        } else {
            selectedCards.clear();
        }
        updateSelectedCount();
        renderGridView();
    };

    const listCardsWithPercentage = async (percentage) => {
        const batch = db.batch();
        const collectionRef = db.collection('users').doc(user.uid).collection('collection');
        const userCurrency = window.HatakeSocial.currentUserData?.primaryCurrency || 'SEK';

        selectedCards.forEach(cardId => {
            const card = fullCollection.find(c => c.id === cardId);
            if (card) {
                const marketPriceUSD = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
                if (marketPriceUSD > 0) {
                    const priceInUserCurrency = parseFloat(window.HatakeSocial.convertAndFormatPrice(marketPriceUSD, 'USD').split(' ')[0]);
                    const newPrice = priceInUserCurrency * (percentage / 100);
                    batch.update(collectionRef.doc(cardId), { forSale: true, salePrice: parseFloat(newPrice.toFixed(2)) });
                }
            }
        });

        try {
            await batch.commit();
            alert(`${selectedCards.size} cards listed for sale!`);
            closeModal(listForSaleModal);
            toggleBulkEditMode();
        } catch (error) {
            console.error("Error listing cards:", error);
            alert("An error occurred. Please try again.");
        }
    };

    const listCardsWithUndercut = async (undercutAmount) => {
        alert("Pricing with undercut is a complex feature that requires fetching competitor prices. This functionality will be implemented in a future update!");
    };

    const displayCardVersions = (versions) => {
        manualAddResultsContainer.innerHTML = '';
        const tooltip = document.getElementById('manual-add-tooltip'); // Get the tooltip element

        if (versions.length === 0) {
            manualAddResultsContainer.innerHTML = '<p class="text-center text-gray-500">No versions found.</p>';
            return;
        }

        versions.forEach(card => {
            const versionEl = document.createElement('div');
            versionEl.className = 'flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md';
            
            versionEl.innerHTML = `
                <div class="flex items-center space-x-3">
                    <img src="${card.imageUrl}" class="w-10 h-14 object-cover rounded-sm card-thumbnail-preview">
                    <div>
                        <p class="text-sm font-semibold dark:text-white">${card.name}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${card.setName} (#${card.collector_number || 'N/A'})</p>
                    </div>
                </div>
                <button class="add-version-btn px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded-full hover:bg-green-700">Add</button>
            `;
            
            const thumbnail = versionEl.querySelector('.card-thumbnail-preview');
            thumbnail.addEventListener('mouseover', () => {
                if (tooltip) {
                    tooltip.src = thumbnail.src;
                    tooltip.classList.remove('hidden');
                }
            });
            thumbnail.addEventListener('mouseout', () => {
                if (tooltip) {
                    tooltip.classList.add('hidden');
                }
            });

            versionEl.querySelector('.add-version-btn').addEventListener('click', () => {
                openAddVersionModal(card);
            });

            manualAddResultsContainer.appendChild(versionEl);
        });
    };

    const openAddVersionModal = (cardData) => {
        document.getElementById('add-version-name').textContent = cardData.name;
        document.getElementById('add-version-set').textContent = cardData.setName;
        document.getElementById('add-version-image').src = cardData.imageUrl;
        document.getElementById('add-version-data').value = JSON.stringify(cardData);
        addVersionForm.reset();
        openModal(addVersionModal);
    };

    const openModalHandler = async (modal, cardId, listType) => {
        const docRef = db.collection('users').doc(user.uid).collection(listType).doc(cardId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) return;
        const card = docSnap.data();

        if (modal === editCardModal) {
            document.getElementById('edit-card-id').value = cardId;
            document.getElementById('edit-card-list-type').value = listType;
            document.getElementById('edit-card-quantity').value = card.quantity;
            document.getElementById('edit-card-condition').value = card.condition;
            document.getElementById('edit-card-foil').checked = card.isFoil;
        } else if (modal === manageListingModal) {
            document.getElementById('listing-card-id').value = cardId;
            document.getElementById('listing-card-image').src = card.imageUrl;
            document.getElementById('listing-card-name').textContent = card.name;
            document.getElementById('listing-card-set').textContent = card.setName;
            const forSaleToggle = document.getElementById('forSale');
            forSaleToggle.checked = card.forSale || false;
            document.getElementById('salePrice').value = card.salePrice || '';
            document.getElementById('price-input-container').classList.toggle('hidden', !forSaleToggle.checked);
        }
        openModal(modal);
    };

    const deleteCard = async (cardId, listType) => {
        await db.collection('users').doc(user.uid).collection(listType).doc(cardId).delete();
        if (listType === 'collection') {
            loadCollectionData();
        } else {
            loadWishlistData();
        }
    };
    
    const exportCollectionAsText = () => {
        if (fullCollection.length === 0) {
            alert("Your collection is empty.");
            return;
        }

        const textList = fullCollection.map(card => {
            return `"${card.name}" [${card.set}/${card.setName}] (${card.collector_number || 'N/A'})`;
        }).join('\n');

        const textarea = document.createElement('textarea');
        textarea.value = textList;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        alert("Collection copied to clipboard!");
    };

    // --- Event Listeners ---
    if(exportCollectionBtn) exportCollectionBtn.addEventListener('click', exportCollectionAsText);
    
    document.addEventListener('mousemove', (e) => {
        const tooltip = document.getElementById('manual-add-tooltip');
        if (tooltip && !tooltip.classList.contains('hidden')) {
            tooltip.style.left = e.pageX + 20 + 'px';
            tooltip.style.top = e.pageY + 20 + 'px';
        }
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('text-blue-600', 'border-blue-600'));
            tab.classList.add('text-blue-600', 'border-blue-600');
            tabContents.forEach(content => content.classList.toggle('hidden', content.id !== `content-${tab.id.split('-')[1]}`));

            if (tab.id === 'tab-collection') loadCollectionData();
            if (tab.id === 'tab-wishlist') loadWishlistData();
        });
    });

    filterNameInput.addEventListener('input', applyFilters);
    filterSetSelect.addEventListener('change', applyFilters);
    filterRaritySelect.addEventListener('change', applyFilters);
    filterColorSelect.addEventListener('change', applyFilters);
    resetFiltersBtn.addEventListener('click', () => {
        filterNameInput.value = '';
        filterSetSelect.value = 'all';
        filterRaritySelect.value = 'all';
        filterColorSelect.value = 'all';
        applyFilters();
    });

    const switchView = (view) => {
        currentView = view;
        renderCurrentView();
    };

    gridViewBtn?.addEventListener('click', () => switchView('grid'));
    listViewBtn?.addEventListener('click', () => switchView('list'));

    searchCardVersionsBtn.addEventListener('click', async () => {
        const cardName = document.getElementById('manual-card-name').value;
        const game = manualGameSelect.value;
        if (!cardName) {
            alert("Please enter a card name.");
            return;
        }

        searchCardVersionsBtn.disabled = true;
        searchCardVersionsBtn.textContent = 'Searching...';
        manualAddResultsContainer.innerHTML = '<p class="text-center text-gray-500">Searching...</p>';

        try {
            let versions = [];
            if (game === 'magic') {
                const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints&order=released`);
                if (!response.ok) throw new Error("Card not found on Scryfall.");
                const result = await response.json();
                versions = result.data.map(card => ({
                    id: card.id,
                    name: card.name,
                    set: card.set,
                    setName: card.set_name,
                    rarity: card.rarity,
                    collector_number: card.collector_number,
                    imageUrl: card.image_uris?.normal || '',
                    priceUsd: card.prices?.usd || null,
                    priceUsdFoil: card.prices?.usd_foil || null,
                    tcg: 'Magic: The Gathering'
                }));
            } else if (game === 'pokemon') {
                const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cardName)}"&orderBy=set.releaseDate`);
                if (!response.ok) throw new Error("Card not found on Pokémon TCG API.");
                const result = await response.json();
                versions = result.data.map(card => ({
                    id: card.id,
                    name: card.name,
                    set: card.set.id,
                    setName: card.set.name,
                    rarity: card.rarity || 'Common',
                    collector_number: card.number,
                    imageUrl: card.images?.small || '',
                    priceUsd: card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market || null,
                    priceUsdFoil: card.tcgplayer?.prices?.reverseHolofoil?.market || card.tcgplayer?.prices?.holofoil?.market || null,
                    tcg: 'Pokémon'
                }));
            }
            displayCardVersions(versions);
        } catch (error) {
            manualAddResultsContainer.innerHTML = `<p class="text-center text-red-500">${error.message}</p>`;
        } finally {
            searchCardVersionsBtn.disabled = false;
            searchCardVersionsBtn.textContent = 'Search for Card';
        }
    });

    addVersionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cardData = JSON.parse(document.getElementById('add-version-data').value);
        const listType = document.getElementById('add-to-list-select').value;
        const cardDoc = {
            ...cardData,
            scryfallId: cardData.id,
            quantity: parseInt(document.getElementById('add-version-quantity').value, 10),
            condition: document.getElementById('add-version-condition').value,
            isFoil: document.getElementById('add-version-foil').checked,
            addedAt: new Date(),
            forSale: false
        };
        delete cardDoc.id;

        try {
            await db.collection('users').doc(user.uid).collection(listType).add(cardDoc);
            alert(`${cardDoc.quantity}x ${cardDoc.name} (${cardDoc.setName}) added to your ${listType}!`);
            closeModal(addVersionModal);
            if (listType === 'collection') {
                loadCollectionData();
            } else {
                loadWishlistData();
            }
        } catch (error) {
            console.error("Error adding card version:", error);
            alert("Could not add card to collection.");
        }
    });

    csvUploadBtn.addEventListener('click', () => {
        if (csvUploadInput.files.length === 0) {
            alert("Please select a CSV file to upload.");
            return;
        }

        Papa.parse(csvUploadInput.files[0], {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data;
                if (!rows || rows.length === 0) {
                    csvStatus.textContent = "CSV file is empty or could not be read.";
                    return;
                }

                const header = Object.keys(rows[0]).map(h => h.toLowerCase());

                const findKey = (possibleKeys) => header.find(h => possibleKeys.includes(h.toLowerCase()));

                const nameKey = findKey(['name', 'card', 'card name']);
                const setCodeKey = findKey(['set code', 'edition', 'set', 'set name', 'expansion']);
                const quantityKey = findKey(['quantity', 'count', 'qty']);
                const conditionKey = findKey(['condition']);
                const foilKey = findKey(['foil', 'is foil', 'isfoil']);

                if (!nameKey) {
                    csvStatus.textContent = 'Error: CSV must have a "Name" or "Card" column.';
                    csvStatus.classList.add('text-red-500');
                    csvUploadBtn.disabled = false;
                    return;
                }

                if (!setCodeKey) {
                    if (!confirm("Warning: No 'Set', 'Edition', or 'Set Code' column was found. The importer will try to guess the newest version of each card, which may not be correct. Do you want to continue?")) {
                        csvStatus.textContent = "Import cancelled by user.";
                        csvUploadBtn.disabled = false;
                        return;
                    }
                }

                csvStatus.textContent = `Found ${rows.length} cards. Fetching data... This may take a moment.`;
                csvUploadBtn.disabled = true;

                let processedCount = 0;
                let errorCount = 0;
                const collectionRef = db.collection('users').doc(user.uid).collection('collection');

                const originalHeaders = Object.keys(rows[0]);
                const originalNameHeader = originalHeaders.find(h => h.toLowerCase() === nameKey);
                const originalSetHeader = setCodeKey ? originalHeaders.find(h => h.toLowerCase() === setCodeKey) : null;
                const originalQuantityHeader = quantityKey ? originalHeaders.find(h => h.toLowerCase() === quantityKey) : null;
                const originalConditionHeader = conditionKey ? originalHeaders.find(h => h.toLowerCase() === conditionKey) : null;
                const originalFoilHeader = foilKey ? originalHeaders.find(h => h.toLowerCase() === foilKey) : null;

                for (const row of rows) {
                    if (!row || !row[originalNameHeader]) {
                        errorCount++;
                        continue;
                    }
                    const cardName = row[originalNameHeader];
                    const setCode = originalSetHeader ? row[originalSetHeader] : null;
                    const quantity = originalQuantityHeader ? parseInt(row[originalQuantityHeader], 10) : 1;
                    const condition = originalConditionHeader ? row[originalConditionHeader] : 'Near Mint';
                    const isFoil = originalFoilHeader ? (String(row[originalFoilHeader]).toLowerCase() === 'foil' || String(row[originalFoilHeader]).toLowerCase() === 'true' || row[originalFoilHeader] === '1') : false;

                    try {
                        await new Promise(resolve => setTimeout(resolve, 100));

                        let apiUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;
                        if (setCode) {
                            apiUrl += `&set=${encodeURIComponent(setCode.toLowerCase())}`;
                        }

                        const response = await fetch(apiUrl);
                        if (!response.ok) throw new Error(`Scryfall API error for ${cardName} ${setCode ? `(Set: ${setCode})` : ''}`);

                        const cardData = await response.json();
                        const cardDoc = {
                            name: cardData.name,
                            name_lower: cardData.name.toLowerCase(),
                            tcg: "Magic: The Gathering",
                            scryfallId: cardData.id,
                            set: cardData.set,
                            setName: cardData.set_name,
                            rarity: cardData.rarity,
                            imageUrl: cardData.image_uris?.normal || '',
                            priceUsd: cardData.prices?.usd || null,
                            priceUsdFoil: cardData.prices?.usd_foil || null,
                            cmc: cardData.cmc,
                            colors: cardData.colors,
                            color_identity: cardData.color_identity,
                            type_line: cardData.type_line,
                            legalities: cardData.legalities,
                            quantity: isNaN(quantity) ? 1 : quantity,
                            isFoil: isFoil,
                            condition: condition,
                            addedAt: new Date(),
                            forSale: false,
                            salePrice: 0
                        };

                        await collectionRef.add(cardDoc);
                        processedCount++;
                    } catch (error) {
                        console.warn(`Could not process card "${cardName}". Skipping.`, error);
                        errorCount++;
                    }
                    csvStatus.textContent = `Processing... ${processedCount + errorCount} / ${rows.length}`;
                }

                csvStatus.textContent = `Import complete! ${processedCount} cards added. ${errorCount > 0 ? `${errorCount} failed.` : ''}`;
                csvUploadBtn.disabled = false;
                setTimeout(() => {
                    loadCollectionData();
                    csvStatus.textContent = '';
                }, 3000);
            }
        });
    });

    const setupActionListeners = (container) => {
        container.addEventListener('click', (e) => {
            const cardElement = e.target.closest('.group');
            if (!cardElement) return;
            const cardId = cardElement.dataset.id;
            const listType = container.id.includes('collection') ? 'collection' : 'wishlist';

            if (bulkEditMode && listType === 'collection') {
                handleCardSelection(cardId);
            } else {
                if (e.target.closest('.edit-card-btn')) openModalHandler(editCardModal, cardId, listType);
                else if (e.target.closest('.delete-card-btn')) {
                    if (confirm('Are you sure you want to delete this card?')) deleteCard(cardId, listType);
                } else if (e.target.closest('.manage-listing-btn')) {
                    openModalHandler(manageListingModal, cardId, listType);
                } else {
                    const cardImg = cardElement.querySelector('img');
                    if (cardImg) window.location.href = `card-view.html?name=${encodeURIComponent(cardImg.alt)}`;
                }
            }
        });
    };
    setupActionListeners(collectionGridView);
    setupActionListeners(wishlistListContainer);
    if (bulkEditBtn) bulkEditBtn.addEventListener('click', toggleBulkEditMode);
    if (quickEditBtn) quickEditBtn.addEventListener('click', toggleQuickEditMode);
    if (saveQuickEditsBtn) saveQuickEditsBtn.addEventListener('click', saveQuickEdits);
    if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', handleSelectAll);
    if (listSelectedBtn) listSelectedBtn.addEventListener('click', () => {
        if (selectedCards.size === 0) {
            alert("Please select at least one card to list.");
            return;
        }
        document.getElementById('list-sale-count').textContent = selectedCards.size;
        openModal(listForSaleModal);
    });
    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', async () => {
        if (selectedCards.size === 0) {
            alert("Please select cards to delete.");
            return;
        }
        if (confirm(`Are you sure you want to delete ${selectedCards.size} cards? This cannot be undone.`)) {
            const batch = db.batch();
            selectedCards.forEach(cardId => {
                batch.delete(db.collection('users').doc(user.uid).collection('collection').doc(cardId));
            });
            await batch.commit();
            alert(`${selectedCards.size} cards deleted.`);
            toggleBulkEditMode();
            loadCollectionData();
        }
    });
    editCardForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cardId = document.getElementById('edit-card-id').value;
        const listType = document.getElementById('edit-card-list-type').value;
        const updatedData = {
            quantity: parseInt(document.getElementById('edit-card-quantity').value, 10),
            condition: document.getElementById('edit-card-condition').value,
            isFoil: document.getElementById('edit-card-foil').checked
        };
        await db.collection('users').doc(user.uid).collection(listType).doc(cardId).update(updatedData);
        closeModal(editCardModal);
        if (listType === 'collection') {
            loadCollectionData();
        } else {
            loadWishlistData();
        }
    });
    document.getElementById('manage-listing-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const cardId = document.getElementById('listing-card-id').value;
        const isForSale = document.getElementById('forSale').checked;
        const salePrice = parseFloat(document.getElementById('salePrice').value) || 0;
        const updatedData = {
            forSale: isForSale,
            salePrice: isForSale ? salePrice : firebase.firestore.FieldValue.delete()
        };
        await db.collection('users').doc(user.uid).collection('collection').doc(cardId).update(updatedData);
        closeModal(manageListingModal);
        loadCollectionData();
    });
    percentagePriceForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const percentage = document.getElementById('percentage-price-input').value;
        if (percentage && percentage > 0) listCardsWithPercentage(percentage);
    });
    fixedUndercutForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = document.getElementById('fixed-undercut-input').value;
        if (amount && amount > 0) listCardsWithUndercut(amount);
    });
    document.getElementById('close-edit-card-modal')?.addEventListener('click', () => closeModal(editCardModal));
    document.getElementById('close-listing-modal')?.addEventListener('click', () => closeModal(manageListingModal));
    document.getElementById('close-list-sale-modal')?.addEventListener('click', () => closeModal(listForSaleModal));
    closeAddVersionModalBtn?.addEventListener('click', () => closeModal(addVersionModal));
    document.getElementById('forSale')?.addEventListener('change', (e) => {
        document.getElementById('price-input-container').classList.toggle('hidden', !e.target.checked);
    });

    // --- Initial Load ---
    loadCollectionData();
});
