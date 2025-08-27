/**
 * HatakeSocial - My Collection Page Script (v29.5 - Wishlist Click Fix 2)
 *
 * This script handles all logic for the my_collection.html page.
 * - FIX: Corrected the event listener logic to properly handle clicks on wishlist items.
 */

// --- Helper Functions (Global Scope) ---

/**
 * Gets the correct image URL for any card type from Scryfall data.
 * @param {object} cardData The full card data object from Scryfall or Firestore.
 * @param {string} [size='normal'] The desired image size ('small', 'normal', 'large').
 * @returns {string} The URL of the card image or a placeholder.
 */
function getCardImageUrl(cardData, size = 'normal') {
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

// --- Main Script ---

document.addEventListener('authReady', (e) => {
    console.log('[Collection v29.5] Auth ready. Initializing script...');
    const user = e.detail.user;
    const mainContainer = document.querySelector('main.container');

    if (!mainContainer) {
        console.error('[Collection v29.5] Critical error: main container not found. Script cannot run.');
        return;
    }

    if (!user) {
        console.log('[Collection v29.5] No user found. Displaying login message.');
        mainContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to manage your collection.</p>';
        return;
    }
    console.log(`[Collection v29.5] User ${user.uid} authenticated. Setting up page elements.`);

    // --- State ---
    let bulkEditMode = false;
    let quickEditMode = false;
    let selectedCards = new Set();
    let fullCollection = [];
    let fullWishlist = [];
    let filteredCollection = [];
    let currentView = 'grid';

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
    };

    const loadCollectionData = async () => {
        if (!elements.collectionGridView) return;
        elements.collectionGridView.innerHTML = '<p class="text-center p-4 text-gray-500 dark:text-gray-400">Loading your collection...</p>';
        try {
            const snapshot = await db.collection('users').doc(user.uid).collection('collection').orderBy('name').get();
            fullCollection = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            filteredCollection = [...fullCollection];
            console.log(`[Collection v29.5] Loaded ${fullCollection.length} cards from Firestore.`);
            calculateAndDisplayStats(fullCollection);
            populateFilters();
            renderCurrentView();
        } catch (error) {
            console.error(`[Collection v29.5] Error loading collection:`, error);
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
            console.error(`[Collection v29.5] Error loading wishlist:`, error);
            if(elements.wishlistListContainer) elements.wishlistListContainer.innerHTML = `<p class="text-center text-red-500 p-4">Could not load your wishlist.</p>`;
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
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Value</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Notes</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">`;
        filteredCollection.forEach(card => {
            const priceUsd = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
            const formattedPrice = priceUsd > 0 ? safeFormatPrice(priceUsd) : 'N/A';
            tableHTML += `
                <tr class="group" data-id="${card.id}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${card.name} ${card.isFoil ? '<i class="fas fa-star text-yellow-400"></i>' : ''} ${card.isSigned ? '<i class="fas fa-signature text-yellow-500"></i>' : ''}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${card.setName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${card.quantity || 1}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${formattedPrice}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${card.notes || ''}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 space-x-2">
                        <button class="edit-card-btn text-blue-500 hover:text-blue-700" data-id="${card.id}" data-list="collection"><i class="fas fa-edit"></i></button>
                        <button class="delete-card-btn text-red-500 hover:text-red-700" data-id="${card.id}" data-list="collection"><i class="fas fa-trash"></i></button>
                        <button class="manage-listing-btn text-green-500 hover:text-green-700" data-id="${card.id}" data-list="collection"><i class="fas fa-tags"></i></button>
                    </td>
                </tr>`;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    };

    const handleCsvUpload = (file) => {
        if (!file) return;
        if (typeof Papa === 'undefined') {
            console.error("[Collection v29.5] PapaParse library is not loaded. CSV upload is disabled.");
            if (elements.csvStatus) elements.csvStatus.textContent = "Error: CSV parsing library not loaded.";
            return;
        }
        if (elements.csvStatus) {
            elements.csvStatus.textContent = `Parsing ${file.name}...`;
            elements.csvStatus.classList.remove('text-red-500', 'text-green-500');
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                console.log("[Collection v29.5] CSV Parsed:", results);
                if (elements.csvStatus) elements.csvStatus.textContent = `Found ${results.data.length} cards. Importing... This may take a moment.`;

                const collectionRef = db.collection('users').doc(user.uid).collection('collection');
                let importedCount = 0;
                let errorCount = 0;

                const chunks = [];
                for (let i = 0; i < results.data.length; i += 250) {
                    chunks.push(results.data.slice(i, i + 250));
                }

                for (const chunk of chunks) {
                    const batch = db.batch();
                    for (const row of chunk) {
                        const cardName = row['Name'] || row['Card Name'];
                        const setName = row['Set Name'] || row['Set'];
                        const quantity = parseInt(row['Quantity'], 10) || 1;
                        const condition = row['Condition'] || 'Near Mint';
                        const isFoil = (row['Foil'] || '').toLowerCase() === 'true' || (row['Finish'] || '').toLowerCase() === 'foil';
                        const isSigned = (row['Signed'] || '').toLowerCase() === 'true';
                        const notes = row['Notes'] || '';

                        if (!cardName) continue;

                        try {
                            let searchUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;
                            if (setName) searchUrl += `&set=${encodeURIComponent(setName)}`;

                            const response = await fetch(searchUrl);
                            await new Promise(resolve => setTimeout(resolve, 100));

                            if (!response.ok) {
                                console.warn(`Card not found via Scryfall: ${cardName} [${setName || 'any set'}]`);
                                errorCount++;
                                continue;
                            }

                            const cardData = await response.json();
                            const cardDoc = {
                                scryfallId: cardData.id,
                                name: cardData.name,
                                name_lower: cardData.name.toLowerCase(),
                                set: cardData.set,
                                setName: cardData.set_name,
                                rarity: cardData.rarity,
                                collector_number: cardData.collector_number,
                                imageUrl: getCardImageUrl(cardData, 'normal'),
                                priceUsd: cardData.prices?.usd || null,
                                priceUsdFoil: cardData.prices?.usd_foil || null,
                                tcg: 'Magic: The Gathering',
                                colors: (cardData.card_faces ? cardData.card_faces[0].colors : cardData.colors) || [],
                                quantity, condition, isFoil, isSigned, notes,
                                addedAt: new Date(),
                                forSale: false
                            };

                            const newDocRef = collectionRef.doc();
                            batch.set(newDocRef, cardDoc);
                            importedCount++;

                        } catch (err) {
                            console.error(`Error importing row: ${cardName}`, err);
                            errorCount++;
                        }
                    }
                    if(importedCount > 0) await batch.commit();
                }

                if (elements.csvStatus) {
                    elements.csvStatus.textContent = `Import complete. Added: ${importedCount}. Failed: ${errorCount}.`;
                    elements.csvStatus.classList.add('text-green-500');
                }
                alert(`Import complete!\nSuccessfully imported: ${importedCount}\nFailed to find: ${errorCount}`);
                loadCollectionData();
            },
            error: (err) => {
                console.error("[Collection v29.5] CSV Parsing Error:", err);
                if (elements.csvStatus) {
                    elements.csvStatus.textContent = "Error parsing CSV file.";
                    elements.csvStatus.classList.add('text-red-500');
                }
            }
        });
    };

    const exportCollectionAsText = () => {
        if (fullCollection.length === 0) {
            alert("Your collection is empty.");
            return;
        }

        const exportModal = document.createElement('div');
        exportModal.id = 'export-modal';
        exportModal.className = 'modal-overlay open';
        exportModal.innerHTML = `
            <div class="modal-content w-full max-w-lg dark:bg-gray-800">
                <button id="close-export-modal" class="close-button">&times;</button>
                <h2 class="text-2xl font-bold mb-4 dark:text-white">Export Collection</h2>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Export Format</label>
                        <select id="export-format" class="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                            <option value="text">Plain Text</option>
                            <option value="csv">CSV</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Include Fields</label>
                        <div id="export-fields" class="mt-2 grid grid-cols-2 gap-2">
                            <label class="flex items-center"><input type="checkbox" value="set" class="mr-2" checked>Set Code</label>
                            <label class="flex items-center"><input type="checkbox" value="setName" class="mr-2" checked>Expansion Name</label>
                            <label class="flex items-center"><input type="checkbox" value="quantity" class="mr-2" checked>Quantity</label>
                            <label class="flex items-center"><input type="checkbox" value="isFoil" class="mr-2">Is Foil</label>
                            <label class="flex items-center"><input type="checkbox" value="isSigned" class="mr-2">Is Signed</label>
                            <label class="flex items-center"><input type="checkbox" value="notes" class="mr-2">Notes</label>
                            <label class="flex items-center"><input type="checkbox" value="priceUsd" class="mr-2">Market Price</label>
                        </div>
                    </div>
                </div>
                <div class="mt-6 text-right">
                    <button id="confirm-export-btn" class="px-6 py-2 bg-indigo-500 text-white font-semibold rounded-full hover:bg-indigo-600">Export</button>
                </div>
            </div>
        `;
        document.body.appendChild(exportModal);

        document.getElementById('close-export-modal').addEventListener('click', () => {
            exportModal.remove();
        });

        document.getElementById('confirm-export-btn').addEventListener('click', () => {
            const format = document.getElementById('export-format').value;
            const selectedFields = Array.from(document.querySelectorAll('#export-fields input:checked')).map(cb => cb.value);

            let output = '';
            if (format === 'csv') {
                const headers = ['Name', ...selectedFields].join(',');
                const rows = fullCollection.map(card => {
                    const row = [card.name];
                    selectedFields.forEach(field => row.push(card[field] || ''));
                    return row.join(',');
                }).join('\n');
                output = `${headers}\n${rows}`;
            } else {
                output = fullCollection.map(card => {
                    let line = `${card.quantity || 1} ${card.name}`;
                    selectedFields.forEach(field => {
                        if (card[field]) line += ` [${field}: ${card[field]}]`;
                    });
                    return line;
                }).join('\n');
            }

            const textarea = document.createElement('textarea');
            textarea.value = output;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert("Collection copied to clipboard!");
            exportModal.remove();
        });
    };

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

    const toggleQuickEditMode = () => {
        quickEditMode = !quickEditMode;
        if (quickEditMode) {
            currentView = 'list';
            if (elements.quickEditSaveBar) elements.quickEditSaveBar.classList.remove('hidden');
            if (elements.bulkEditBtn) elements.bulkEditBtn.classList.add('hidden');
            if (elements.quickEditBtn) {
                elements.quickEditBtn.innerHTML = '<i class="fas fa-times mr-2"></i>Cancel';
                elements.quickEditBtn.classList.add('bg-red-500', 'hover:bg-red-600');
                elements.quickEditBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
            }
            renderQuickEditView();
        } else {
            currentView = 'grid';
            if (elements.quickEditSaveBar) elements.quickEditSaveBar.classList.add('hidden');
            if (elements.bulkEditBtn) elements.bulkEditBtn.classList.remove('hidden');
            if (elements.quickEditBtn) {
                elements.quickEditBtn.innerHTML = '<i class="fas fa-edit mr-2"></i>Quick Edit';
                elements.quickEditBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
                elements.quickEditBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
            }
            renderCurrentView();
        }
    };

    const renderQuickEditView = () => {
        const container = elements.collectionTableView;
        if (!container) return;

        if (elements.collectionGridView) elements.collectionGridView.classList.add('hidden');
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
        if (!elements.saveQuickEditsBtn) return;
        elements.saveQuickEditsBtn.disabled = true;
        elements.saveQuickEditsBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';

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
            elements.saveQuickEditsBtn.disabled = false;
            elements.saveQuickEditsBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save All Changes';
            toggleQuickEditMode(); // Exit quick edit mode
            loadCollectionData(); // Reload data
        }
    };

    const updateSelectedCount = () => {
        if (elements.selectedCountEl) {
            elements.selectedCountEl.textContent = `${selectedCards.size} cards selected`;
        }
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

            if (modalToOpen === elements.editCardModal) {
                document.getElementById('edit-card-id').value = cardId;
                document.getElementById('edit-card-list-type').value = listType;
                document.getElementById('edit-card-quantity').value = card.quantity || 1;
                document.getElementById('edit-card-condition').value = card.condition;
                document.getElementById('edit-card-language').value = card.language || 'English';
                document.getElementById('edit-card-purchase-price').value = card.purchasePrice || '';
                document.getElementById('edit-card-notes').value = card.notes || '';
                document.getElementById('edit-card-foil').checked = card.isFoil || false;
                document.getElementById('edit-card-signed').checked = card.isSigned || false;
            } else if (modalToOpen === elements.manageListingModal) {
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

    // --- Attaching Event Listeners ---
    if (elements.bulkEditBtn) elements.bulkEditBtn.addEventListener('click', toggleBulkEditMode);
    if (elements.quickEditBtn) elements.quickEditBtn.addEventListener('click', toggleQuickEditMode);
    if (elements.saveQuickEditsBtn) elements.saveQuickEditsBtn.addEventListener('click', saveQuickEdits);
    if (elements.exportCollectionBtn) elements.exportCollectionBtn.addEventListener('click', exportCollectionAsText);

    mainContainer.addEventListener('click', (e) => {
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

        if (target.closest('.edit-card-btn')) {
            openModalHandler(elements.editCardModal, cardId, listType);
        } else if (target.closest('.delete-card-btn')) {
            if (confirm('Are you sure you want to delete this card?')) {
                deleteCard(cardId, listType);
            }
        } else if (target.closest('.manage-listing-btn')) {
            openModalHandler(elements.manageListingModal, cardId, listType);
        } else if (!isActionBtn) {
            const cardDataSource = listType === 'collection' ? fullCollection : fullWishlist;
            const cardData = cardDataSource.find(c => c.id === cardId);
            if (cardData && cardData.scryfallId) {
                window.location.href = `card-view.html?id=${cardData.scryfallId}`;
            }
        }
    });

    if (elements.selectAllCheckbox) {
        elements.selectAllCheckbox.addEventListener('change', (e) => {
            filteredCollection.map(c => c.id).forEach(id => {
                if (e.target.checked) selectedCards.add(id);
                else selectedCards.delete(id);
            });
            updateSelectedCount();
            renderCurrentView();
        });
    }

    if (elements.deleteSelectedBtn) {
        elements.deleteSelectedBtn.addEventListener('click', async () => {
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

    if (elements.editCardForm) {
        elements.editCardForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = elements.editCardForm.querySelector('button[type="submit"]');
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
                closeModal(elements.editCardModal);
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

    if (elements.manageListingForm) {
        elements.manageListingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const cardId = document.getElementById('listing-card-id').value;
            const isForSale = document.getElementById('forSale').checked;
            const salePrice = parseFloat(document.getElementById('salePrice').value) || 0;
            const updatedData = {
                forSale: isForSale,
                salePrice: isForSale ? salePrice : firebase.firestore.FieldValue.delete()
            };
            await db.collection('users').doc(user.uid).collection('collection').doc(cardId).update(updatedData);
            closeModal(elements.manageListingModal);
            loadCollectionData();
        });
    }

    if (elements.filterNameInput) elements.filterNameInput.addEventListener('input', applyFilters);
    if (elements.filterSetSelect) elements.filterSetSelect.addEventListener('change', applyFilters);
    if (elements.filterRaritySelect) elements.filterRaritySelect.addEventListener('change', applyFilters);
    if (elements.filterColorSelect) elements.filterColorSelect.addEventListener('change', applyFilters);
    if (elements.resetFiltersBtn) elements.resetFiltersBtn.addEventListener('click', () => {
        if(elements.filterNameInput) elements.filterNameInput.value = '';
        if(elements.filterSetSelect) elements.filterSetSelect.value = 'all';
        if(elements.filterRaritySelect) elements.filterRaritySelect.value = 'all';
        if(elements.filterColorSelect) elements.filterColorSelect.value = 'all';
        applyFilters();
    });

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

    document.getElementById('close-edit-card-modal')?.addEventListener('click', () => closeModal(elements.editCardModal));
    document.getElementById('close-listing-modal')?.addEventListener('click', () => closeModal(elements.manageListingModal));
    document.getElementById('close-list-sale-modal')?.addEventListener('click', () => closeModal(elements.listForSaleModal));
    document.getElementById('close-add-version-modal')?.addEventListener('click', () => closeModal(elements.addVersionModal));
    
    // --- Tab Switching Logic ---
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

    // --- Initial Load ---
    console.log('[Collection v29.5] Starting initial data load.');
    loadCollectionData();
    loadWishlistData();
});