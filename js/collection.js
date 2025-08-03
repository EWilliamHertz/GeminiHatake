/**
 * HatakeSocial - My Collection Page Script (v28.14 - Final)
 *
 * This script handles all logic for the my_collection.html page.
 * - FIX: Re-providing the complete, non-skeleton implementation of all functions.
 * - FIX: Added extensive console logging to trace execution flow and pinpoint any future errors.
 * - FIX: Maintained defensive checks for all DOM elements to prevent script crashes.
 * - FIX: Maintained the race-condition fix for the currency converter.
 */

/**
 * Gets the correct image URL for any card type from Scryfall data.
 * @param {object} cardData The full card data object from Scryfall.
 * @param {string} [size='normal'] The desired image size ('small', 'normal', 'large').
 * @returns {string} The URL of the card image or a placeholder.
 */
function getCardImageUrl(cardData, size = 'normal') {
    if (cardData && cardData.card_faces && cardData.card_faces[0] && cardData.card_faces[0].image_uris) {
        return cardData.card_faces[0].image_uris[size];
    }
    if (cardData && cardData.image_uris) {
        return cardData.image_uris[size];
    }
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
    // Fallback: Converter is not ready, display in USD as a failsafe.
    return `$${Number(value).toFixed(2)} USD`;
}

function openModal(modal) {
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeModal(modal) {
    if (modal) {
        modal.classList.add('hidden');
    }
}

document.addEventListener('authReady', (e) => {
    console.log('[Collection v28.14] Auth ready. Initializing script...');

    const user = e.detail.user;
    const collectionPageContainer = document.getElementById('content-collection');

    if (!collectionPageContainer) {
        console.error('[Collection v28.14] Critical error: #content-collection container not found. Script cannot run.');
        return;
    }

    if (!user) {
        console.log('[Collection v28.14] No user found. Displaying login message.');
        const mainContent = document.querySelector('main.container');
        if (mainContent) mainContent.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to manage your collection.</p>';
        return;
    }
    
    console.log(`[Collection v28.14] User ${user.uid} authenticated. Setting up page elements.`);

    // --- State ---
    let bulkEditMode = false;
    let quickEditMode = false;
    let selectedCards = new Set();
    let fullCollection = [];
    let filteredCollection = [];
    let currentView = 'grid';

    // --- DOM Element References ---
    const collectionGridView = document.getElementById('collection-grid-view');
    const collectionTableView = document.getElementById('collection-table-view');
    const wishlistListContainer = document.getElementById('wishlist-list');
    const bulkEditBtn = document.getElementById('bulk-edit-btn');
    const bulkActionBar = document.getElementById('bulk-action-bar');
    const selectedCountEl = document.getElementById('selected-count');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    const editCardModal = document.getElementById('edit-card-modal');
    const editCardForm = document.getElementById('edit-card-form');
    const manageListingModal = document.getElementById('manage-listing-modal');
    const manageListingForm = document.getElementById('manage-listing-form');
    const quickEditBtn = document.getElementById('quick-edit-btn');
    const quickEditSaveBar = document.getElementById('quick-edit-save-bar');
    const saveQuickEditsBtn = document.getElementById('save-quick-edits-btn');
    const exportCollectionBtn = document.getElementById('export-collection-btn');
    const filterNameInput = document.getElementById('filter-name');
    const filterSetSelect = document.getElementById('filter-set');
    const filterRaritySelect = document.getElementById('filter-rarity');
    const filterColorSelect = document.getElementById('filter-color');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');

    const loadCollectionData = async () => {
        if (!collectionGridView) {
            console.error('[Collection v28.14] collectionGridView element not found. Cannot load collection.');
            return;
        }
        console.log('[Collection v28.14] Loading collection data...');
        collectionGridView.innerHTML = '<p class="text-center p-4 text-gray-500 dark:text-gray-400">Loading your collection...</p>';
        try {
            const snapshot = await db.collection('users').doc(user.uid).collection('collection').orderBy('name').get();
            fullCollection = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            filteredCollection = [...fullCollection];
            console.log(`[Collection v28.14] Loaded ${fullCollection.length} cards from Firestore.`);
            calculateAndDisplayStats(fullCollection);
            populateFilters();
            renderCurrentView();
        } catch (error) {
            console.error(`[Collection v28.14] Error loading collection:`, error);
            if (collectionGridView) collectionGridView.innerHTML = `<p class="text-center text-red-500 p-4">Could not load your collection. See console for details.</p>`;
        }
    };

    const populateFilters = () => {
        if (!filterSetSelect) return;
        const sets = new Set(fullCollection.map(card => card.setName).filter(Boolean));
        filterSetSelect.innerHTML = '<option value="all">All Sets</option>';
        [...sets].sort().forEach(setName => {
            const option = document.createElement('option');
            option.value = setName;
            option.textContent = setName;
            filterSetSelect.appendChild(option);
        });
    };

    const applyFilters = () => {
        const nameFilter = filterNameInput ? filterNameInput.value.toLowerCase() : '';
        const setFilter = filterSetSelect ? filterSetSelect.value : 'all';
        const rarityFilter = filterRaritySelect ? filterRaritySelect.value : 'all';
        const colorFilter = filterColorSelect ? filterColorSelect.value : 'all';

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
        console.log(`[Collection v28.14] Rendering view: ${currentView}`);
        if (currentView === 'grid') renderGridView();
        else renderListView();
    };

    const renderGridView = () => {
        const container = collectionGridView;
        if (!container) return;
        const collectionToRender = filteredCollection;

        if (collectionTableView) collectionTableView.classList.add('hidden');
        container.classList.remove('hidden');

        if (collectionToRender.length === 0) {
            container.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400 col-span-full">No cards found.</p>`;
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
            const formattedPrice = priceUsd > 0 ? safeFormatPrice(priceUsd) : '';
            const priceTagHTML = formattedPrice ? `<div class="absolute top-1.5 left-1.5 bg-black bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">${formattedPrice}</div>` : '';
            const quantityBadge = `<div class="absolute top-1.5 right-1.5 bg-gray-900 bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">x${card.quantity || 1}</div>`;

            cardEl.innerHTML = `
                <div class="relative">
                    <img src="${card.customImageUrl || getCardImageUrl(card, 'normal')}" alt="${card.name}" class="rounded-lg shadow-md w-full ${forSaleIndicator}" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                    ${quantityBadge}
                    ${checkboxOverlay}
                </div>
                ${priceTagHTML}
                <div class="card-actions absolute bottom-0 right-0 p-1 bg-black bg-opacity-50 rounded-tl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="edit-card-btn text-white text-xs" data-id="${card.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete-card-btn text-white text-xs ml-1" data-id="${card.id}"><i class="fas fa-trash"></i></button>
                    <button class="manage-listing-btn text-white text-xs ml-1" data-id="${card.id}"><i class="fas fa-tags"></i></button>
                </div>`;
            container.appendChild(cardEl);
        });
    };

    const renderListView = () => {
        const container = collectionTableView;
        if (!container) return;
        
        if (collectionGridView) collectionGridView.classList.add('hidden');
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
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Value</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">`;
        filteredCollection.forEach(card => {
            const priceUsd = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
            const formattedPrice = priceUsd > 0 ? safeFormatPrice(priceUsd) : 'N/A';
            tableHTML += `
                <tr class="group" data-id="${card.id}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${card.name} ${card.isFoil ? '<i class="fas fa-star text-yellow-400"></i>' : ''}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${card.setName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${card.quantity || 1}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formattedPrice}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 space-x-2">
                        <button class="edit-card-btn text-blue-500 hover:text-blue-700" data-id="${card.id}"><i class="fas fa-edit"></i></button>
                        <button class="delete-card-btn text-red-500 hover:text-red-700" data-id="${card.id}"><i class="fas fa-trash"></i></button>
                        <button class="manage-listing-btn text-green-500 hover:text-green-700" data-id="${card.id}"><i class="fas fa-tags"></i></button>
                    </td>
                </tr>`;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    };

    const calculateAndDisplayStats = (collectionData) => {
        let totalCards = 0;
        let totalValue = 0;
        collectionData.forEach(card => {
            totalCards += (card.quantity || 1);
            totalValue += (parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0) * (card.quantity || 1);
        });

        const statsTotalCardsEl = document.getElementById('stats-total-cards');
        const statsUniqueCardsEl = document.getElementById('stats-unique-cards');
        const statsTotalValueEl = document.getElementById('stats-total-value');

        if (statsTotalCardsEl) statsTotalCardsEl.textContent = totalCards;
        if (statsUniqueCardsEl) statsUniqueCardsEl.textContent = new Set(collectionData.map(c => c.name)).size;
        if (statsTotalValueEl) statsTotalValueEl.textContent = safeFormatPrice(totalValue);
    };

    const toggleBulkEditMode = () => {
        bulkEditMode = !bulkEditMode;
        selectedCards.clear();
        if (selectAllCheckbox) selectAllCheckbox.checked = false;

        if (bulkEditMode) {
            if (bulkEditBtn) {
                bulkEditBtn.textContent = 'Cancel';
                bulkEditBtn.classList.add('bg-red-600', 'hover:bg-red-700');
            }
            if (bulkActionBar) bulkActionBar.classList.remove('hidden');
            if (quickEditBtn) quickEditBtn.classList.add('hidden');
        } else {
            if (bulkEditBtn) {
                bulkEditBtn.textContent = 'Bulk Edit';
                bulkEditBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            }
            if (bulkActionBar) bulkActionBar.classList.add('hidden');
            if (quickEditBtn) quickEditBtn.classList.remove('hidden');
        }
        updateSelectedCount();
        renderCurrentView();
    };
    
    const toggleQuickEditMode = () => {
        quickEditMode = !quickEditMode;
        if (quickEditMode) {
            currentView = 'list';
            if (quickEditSaveBar) quickEditSaveBar.classList.remove('hidden');
            if (bulkEditBtn) bulkEditBtn.classList.add('hidden');
            if (quickEditBtn) {
                quickEditBtn.innerHTML = '<i class="fas fa-times mr-2"></i>Cancel';
                quickEditBtn.classList.add('bg-red-500', 'hover:bg-red-600');
                quickEditBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
            }
            renderQuickEditView();
        } else {
            currentView = 'grid';
            if (quickEditSaveBar) quickEditSaveBar.classList.add('hidden');
            if (bulkEditBtn) bulkEditBtn.classList.remove('hidden');
            if (quickEditBtn) {
                quickEditBtn.innerHTML = '<i class="fas fa-edit mr-2"></i>Quick Edit';
                quickEditBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
                quickEditBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
            }
            renderCurrentView();
        }
    };

    const renderQuickEditView = () => {
        const container = collectionTableView;
        if (!container) return;
        
        if (collectionGridView) collectionGridView.classList.add('hidden');
        container.classList.remove('hidden');

        let tableHTML = `
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th class="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                        <th class="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th>
                        <th class="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Condition</th>
                        <th class="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Lang</th>
                        <th class="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Foil</th>
                        <th class="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Signed</th>
                        <th class="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Notes</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">`;
        fullCollection.forEach(card => {
            tableHTML += `
                <tr data-id="${card.id}" class="quick-edit-row">
                    <td class="p-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${card.name}</td>
                    <td class="p-2"><input type="number" value="${card.quantity || 1}" class="w-16 p-1 border rounded dark:bg-gray-900 dark:border-gray-600 quick-edit-input" data-field="quantity"></td>
                    <td class="p-2">
                        <select class="p-1 border rounded dark:bg-gray-900 dark:border-gray-600 quick-edit-input" data-field="condition">
                            <option ${card.condition === 'Near Mint' ? 'selected' : ''}>Near Mint</option>
                            <option ${card.condition === 'Lightly Played' ? 'selected' : ''}>Lightly Played</option>
                            <option ${card.condition === 'Moderately Played' ? 'selected' : ''}>Moderately Played</option>
                            <option ${card.condition === 'Heavily Played' ? 'selected' : ''}>Heavily Played</option>
                            <option ${card.condition === 'Damaged' ? 'selected' : ''}>Damaged</option>
                        </select>
                    </td>
                    <td class="p-2"><input type="text" value="${card.language || 'English'}" class="w-20 p-1 border rounded dark:bg-gray-900 dark:border-gray-600 quick-edit-input" data-field="language"></td>
                    <td class="p-2"><input type="checkbox" ${card.isFoil ? 'checked' : ''} class="h-4 w-4 rounded quick-edit-input" data-field="isFoil"></td>
                    <td class="p-2"><input type="checkbox" ${card.isSigned ? 'checked' : ''} class="h-4 w-4 rounded quick-edit-input" data-field="isSigned"></td>
                    <td class="p-2"><input type="text" value="${card.notes || ''}" class="w-full p-1 border rounded dark:bg-gray-900 dark:border-gray-600 quick-edit-input" data-field="notes"></td>
                </tr>`;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    };
    
    const saveQuickEdits = async () => {
        if (!saveQuickEditsBtn) return;
        saveQuickEditsBtn.disabled = true;
        saveQuickEditsBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';

        const batch = db.batch();
        const rows = document.querySelectorAll('.quick-edit-row');

        rows.forEach(row => {
            const docId = row.dataset.id;
            if (docId) {
                const docRef = db.collection('users').doc(user.uid).collection('collection').doc(docId);
                const updatedData = {};
                row.querySelectorAll('.quick-edit-input').forEach(input => {
                    const field = input.dataset.field;
                    let value;
                    if (input.type === 'checkbox') value = input.checked;
                    else if (input.type === 'number') value = parseInt(input.value, 10) || 1;
                    else value = input.value;
                    updatedData[field] = value;
                });
                batch.update(docRef, updatedData);
            }
        });

        try {
            await batch.commit();
            alert("All changes saved successfully!");
        } catch (error) {
            console.error("Error saving quick edits:", error);
            alert("An error occurred while saving changes.");
        } finally {
            saveQuickEditsBtn.disabled = false;
            saveQuickEditsBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save All Changes';
            toggleQuickEditMode(); // Exit quick edit mode
            loadCollectionData(); // Reload data
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
        const cardEl = collectionGridView.querySelector(`div[data-id="${cardId}"]`);
        if (cardEl) {
            cardEl.querySelector('.bulk-checkbox-overlay')?.classList.toggle('hidden', !selectedCards.has(cardId));
        }
    };

    const exportCollectionAsText = () => {
        if (fullCollection.length === 0) {
            alert("Your collection is empty.");
            return;
        }
        const textList = fullCollection.map(card => {
            return `${card.quantity || 1} "${card.name}" [${card.set || card.setName}]`;
        }).join('\n');
        const textarea = document.createElement('textarea');
        textarea.value = textList;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert("Collection copied to clipboard!");
    };
    
    const openModalHandler = async (modalToOpen, cardId, listType) => {
        if (!modalToOpen) return;
        try {
            const docRef = db.collection('users').doc(user.uid).collection(listType).doc(cardId);
            const docSnap = await docRef.get();
            if (!docSnap.exists) {
                console.error("Card document not found:", cardId);
                return;
            }
            const card = docSnap.data();

            if (modalToOpen === editCardModal) {
                document.getElementById('edit-card-id').value = cardId;
                document.getElementById('edit-card-list-type').value = listType;
                document.getElementById('edit-card-quantity').value = card.quantity || 1;
                document.getElementById('edit-card-condition').value = card.condition;
                document.getElementById('edit-card-language').value = card.language || 'English';
                document.getElementById('edit-card-purchase-price').value = card.purchasePrice || '';
                document.getElementById('edit-card-notes').value = card.notes || '';
                document.getElementById('edit-card-foil').checked = card.isFoil || false;
                document.getElementById('edit-card-signed').checked = card.isSigned || false;
            } else if (modalToOpen === manageListingModal) {
                document.getElementById('listing-card-id').value = cardId;
                document.getElementById('listing-card-image').src = card.customImageUrl || getCardImageUrl(card);
                document.getElementById('listing-card-name').textContent = card.name;
                document.getElementById('listing-card-set').textContent = card.setName;
                const forSaleToggle = document.getElementById('forSale');
                if(forSaleToggle) {
                    forSaleToggle.checked = card.forSale || false;
                    document.getElementById('price-input-container').classList.toggle('hidden', !forSaleToggle.checked);
                }
            }
            openModal(modalToOpen);
        } catch(error) {
            console.error("Error opening modal:", error);
            alert("Could not open the dialog. See console for details.");
        }
    };

    const deleteCard = async (cardId, listType) => {
        try {
            await db.collection('users').doc(user.uid).collection(listType).doc(cardId).delete();
            if (listType === 'collection') loadCollectionData();
            else loadWishlistData();
        } catch (error) {
            console.error("Error deleting card:", error);
            alert("Could not delete card.");
        }
    };

    // --- Event Listeners ---
    if (bulkEditBtn) bulkEditBtn.addEventListener('click', toggleBulkEditMode);
    if (quickEditBtn) quickEditBtn.addEventListener('click', toggleQuickEditMode);
    if (saveQuickEditsBtn) saveQuickEditsBtn.addEventListener('click', saveQuickEdits);
    if (exportCollectionBtn) exportCollectionBtn.addEventListener('click', exportCollectionAsText);

    collectionPageContainer.addEventListener('click', (e) => {
        const target = e.target;
        const cardElement = target.closest('.group[data-id]');
        if (!cardElement) return;

        const cardId = cardElement.dataset.id;
        const listType = cardElement.closest('#wishlist-list') ? 'wishlist' : 'collection';

        const isActionBtn = target.closest('.edit-card-btn, .delete-card-btn, .manage-listing-btn');

        if (bulkEditMode && listType === 'collection' && !isActionBtn) {
            handleCardSelection(cardId);
            return;
        }
        
        if (target.closest('.edit-card-btn')) openModalHandler(editCardModal, cardId, listType);
        else if (target.closest('.delete-card-btn')) {
            if (confirm('Are you sure you want to delete this card?')) deleteCard(cardId, listType);
        } else if (target.closest('.manage-listing-btn')) openModalHandler(manageListingModal, cardId, listType);
        else if (!isActionBtn) {
            const cardData = fullCollection.find(c => c.id === cardId);
            if (cardData && cardData.scryfallId) window.location.href = `card-view.html?id=${cardData.scryfallId}`;
        }
    });

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            filteredCollection.map(c => c.id).forEach(id => {
                if (e.target.checked) selectedCards.add(id);
                else selectedCards.delete(id);
            });
            updateSelectedCount();
            renderCurrentView();
        });
    }

    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', async () => {
            if (selectedCards.size === 0) return alert("Please select cards to delete.");
            if (confirm(`Are you sure you want to delete ${selectedCards.size} selected cards?`)) {
                const batch = db.batch();
                const collectionRef = db.collection('users').doc(user.uid).collection('collection');
                selectedCards.forEach(cardId => batch.delete(collectionRef.doc(cardId)));
                try {
                    await batch.commit();
                    alert(`${selectedCards.size} cards deleted.`);
                    toggleBulkEditMode(); 
                    loadCollectionData();
                } catch (error) {
                    console.error("Error deleting selected cards:", error);
                    alert("An error occurred while deleting cards.");
                }
            }
        });
    }
    
    if (editCardForm) {
        editCardForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = editCardForm.querySelector('button[type="submit"]');
            if(submitButton) submitButton.disabled = true;
            try {
                const cardId = document.getElementById('edit-card-id').value;
                const listType = document.getElementById('edit-card-list-type').value;
                const updatedData = {
                    quantity: parseInt(document.getElementById('edit-card-quantity').value, 10),
                    condition: document.getElementById('edit-card-condition').value,
                    language: document.getElementById('edit-card-language').value,
                    purchasePrice: parseFloat(document.getElementById('edit-card-purchase-price').value) || 0,
                    notes: document.getElementById('edit-card-notes').value,
                    isFoil: document.getElementById('edit-card-foil').checked,
                    isSigned: document.getElementById('edit-card-signed').checked,
                };
                await db.collection('users').doc(user.uid).collection(listType).doc(cardId).update(updatedData);
                alert("Card updated successfully!");
                closeModal(editCardModal);
                if (listType === 'collection') loadCollectionData();
                else loadWishlistData();
            } catch (error) {
                console.error("Error updating card:", error);
                alert("Could not update card.");
            } finally {
                if(submitButton) submitButton.disabled = false;
            }
        });
    }

    if (manageListingForm) {
        manageListingForm.addEventListener('submit', async (e) => {
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
    }

    // Attach listeners for filters
    if (filterNameInput) filterNameInput.addEventListener('input', applyFilters);
    if (filterSetSelect) filterSetSelect.addEventListener('change', applyFilters);
    if (filterRaritySelect) filterRaritySelect.addEventListener('change', applyFilters);
    if (filterColorSelect) filterColorSelect.addEventListener('change', applyFilters);
    if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', () => {
        if(filterNameInput) filterNameInput.value = '';
        if(filterSetSelect) filterSetSelect.value = 'all';
        if(filterRaritySelect) filterRaritySelect.value = 'all';
        if(filterColorSelect) filterColorSelect.value = 'all';
        applyFilters();
    });
    
    // View switcher
    if (gridViewBtn) gridViewBtn.addEventListener('click', () => { currentView = 'grid'; renderCurrentView(); });
    if (listViewBtn) listViewBtn.addEventListener('click', () => { currentView = 'list'; renderCurrentView(); });

    // --- Initial Load ---
    console.log('[Collection v28.14] Starting initial data load.');
    loadCollectionData();
});
