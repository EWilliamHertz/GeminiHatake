/**
 * HatakeSocial - My Collection Page Script (v7 - Complete with Bulk Edit)
 *
 * This script handles all logic for the my_collection.html page.
 * It is now correctly structured to run after the 'authReady' event.
 * This version is a complete merge, restoring the bulk edit functionality
 * that was missing in the previous version.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const collectionPageContainer = document.getElementById('content-collection');
    // Exit if we are not on the My Collection page.
    if (!collectionPageContainer) {
        return;
    }

    if (!user) {
        const mainContent = document.querySelector('main.container');
        if (mainContent) {
            mainContent.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to manage your collection.</p>';
        }
        return;
    }

    // --- State ---
    let bulkEditMode = false;
    let selectedCards = new Set();
    let currentCollectionIds = []; // To help with the "Select All" feature

    // --- DOM Elements ---
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const csvUploadBtn = document.getElementById('csv-upload-btn');
    const csvUploadInput = document.getElementById('csv-upload-input');
    const csvStatus = document.getElementById('csv-status');
    const collectionListContainer = document.getElementById('collection-list');
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
    const manualAddBtn = document.getElementById('manual-add-btn');

    // --- Main Display Function ---
    const loadCardList = async (listType = 'collection') => {
        const container = listType === 'collection' ? collectionListContainer : wishlistListContainer;
        if (!user) {
            container.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4">Please log in to view your ${listType}.</p>`;
            return;
        }
        container.innerHTML = '<p class="text-center p-4">Loading...</p>';

        try {
            const snapshot = await db.collection('users').doc(user.uid).collection(listType).orderBy('name').get();
            
            if (listType === 'collection') {
                calculateAndDisplayStats(snapshot);
                currentCollectionIds = snapshot.docs.map(doc => doc.id);
            }

            if (snapshot.empty) {
                container.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400">Your ${listType} is empty.</p>`;
                return;
            }
        
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const card = doc.data();
                const cardEl = document.createElement('div');
                cardEl.className = 'relative group cursor-pointer';
                cardEl.dataset.id = doc.id;

                const forSaleIndicator = card.forSale ? 'border-4 border-green-500' : '';
                const isSelected = selectedCards.has(doc.id);
                const checkboxOverlay = bulkEditMode && listType === 'collection' ? `<div class="bulk-checkbox-overlay absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-3xl ${isSelected ? '' : 'hidden'}"><i class="fas fa-check-circle"></i></div>` : '';

                cardEl.innerHTML = `
                    <img src="${card.imageUrl || 'https://placehold.co/223x310'}" alt="${card.name}" class="rounded-lg shadow-md w-full ${forSaleIndicator}" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                    ${checkboxOverlay}
                    <div class="card-actions absolute top-0 right-0 p-1 bg-black bg-opacity-50 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="edit-card-btn text-white text-xs" data-list="${listType}"><i class="fas fa-edit"></i></button>
                        <button class="delete-card-btn text-white text-xs ml-1" data-list="${listType}"><i class="fas fa-trash"></i></button>
                        ${listType === 'collection' ? `<button class="manage-listing-btn text-white text-xs ml-1" data-list="${listType}"><i class="fas fa-tags"></i></button>` : ''}
                    </div>
                `;
                container.appendChild(cardEl);
            });
        } catch (error) {
            console.error(`Error loading ${listType}:`, error);
            container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load your ${listType}. Please check your connection and try again.</p>`;
        }
    };

    // --- Statistics ---
    const calculateAndDisplayStats = (snapshot) => {
        let totalCards = 0;
        let totalValue = 0;
        const rarityCounts = { common: 0, uncommon: 0, rare: 0, mythic: 0 };
        const uniqueCards = snapshot.size;

        snapshot.forEach(doc => {
            const card = doc.data();
            const quantity = card.quantity || 1;
            totalCards += quantity;
            
            const price = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
            totalValue += price * quantity;

            if (card.rarity) {
                if (rarityCounts.hasOwnProperty(card.rarity)) {
                    rarityCounts[card.rarity] += quantity;
                }
            }
        });

        document.getElementById('stats-total-cards').textContent = totalCards;
        document.getElementById('stats-unique-cards').textContent = uniqueCards;
        document.getElementById('stats-total-value').textContent = `$${totalValue.toFixed(2)}`;
        
        const rarityContainer = document.getElementById('stats-rarity-breakdown');
        rarityContainer.innerHTML = `
            <span title="Common" class="flex items-center"><i class="fas fa-circle text-gray-400 mr-1"></i>${rarityCounts.common}</span>
            <span title="Uncommon" class="flex items-center"><i class="fas fa-circle text-blue-400 mr-1"></i>${rarityCounts.uncommon}</span>
            <span title="Rare" class="flex items-center"><i class="fas fa-circle text-yellow-400 mr-1"></i>${rarityCounts.rare}</span>
            <span title="Mythic" class="flex items-center"><i class="fas fa-circle text-red-500 mr-1"></i>${rarityCounts.mythic}</span>
        `;
    };

    // --- Bulk Edit Logic ---
    const toggleBulkEditMode = () => {
        bulkEditMode = !bulkEditMode;
        selectedCards.clear();
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        
        if (bulkEditMode) {
            bulkEditBtn.textContent = 'Cancel Bulk Edit';
            bulkEditBtn.classList.add('bg-red-600', 'hover:bg-red-700');
            bulkActionBar.classList.remove('hidden');
        } else {
            bulkEditBtn.textContent = 'Bulk Edit';
            bulkEditBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            bulkActionBar.classList.add('hidden');
        }
        updateSelectedCount();
        loadCardList('collection'); // Re-render to show/hide checkboxes
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
            selectAllCheckbox.checked = selectedCards.size === currentCollectionIds.length && currentCollectionIds.length > 0;
        }
    };
    
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            currentCollectionIds.forEach(id => selectedCards.add(id));
        } else {
            selectedCards.clear();
        }
        updateSelectedCount();
        loadCardList('collection'); // Re-render to show selections
    };

    const listCardsForSale = async (priceOption, value) => {
        const batch = db.batch();
        const collectionRef = db.collection('users').doc(user.uid).collection('collection');
        
        for (const cardId of selectedCards) {
            const docRef = collectionRef.doc(cardId);
            let newPrice = 0;
            if (priceOption === 'percentage') {
                // This requires fetching each doc to get its price, which can be slow.
                // For a better UX, this data could be pre-loaded or passed differently.
                const cardDoc = await docRef.get();
                const marketPrice = parseFloat(cardDoc.data().priceUsd || 0);
                newPrice = marketPrice * (value / 100);
            } else { // custom price
                newPrice = parseFloat(value);
            }
            batch.update(docRef, { forSale: true, salePrice: newPrice });
        }

        await batch.commit();
        alert(`${selectedCards.size} cards listed for sale!`);
        closeModal(listForSaleModal);
        toggleBulkEditMode(); // Exit bulk edit mode after action
    };

    // --- Event Handlers ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => {
                item.classList.remove('text-blue-600', 'border-blue-600');
                item.classList.add('text-gray-500', 'hover:border-gray-300');
            });
            tab.classList.add('text-blue-600', 'border-blue-600');
            tab.classList.remove('text-gray-500', 'hover:border-gray-300');
            tabContents.forEach(content => content.classList.toggle('hidden', content.id !== `content-${tab.id.split('-')[1]}`));
            
            if (tab.id === 'tab-collection') loadCardList('collection');
            if (tab.id === 'tab-wishlist') loadCardList('wishlist');
        });
    });

    manualAddBtn.addEventListener('click', async () => {
        const cardName = document.getElementById('manual-card-name').value;
        const quantity = parseInt(document.getElementById('manual-quantity').value, 10);
        const condition = document.getElementById('manual-condition').value;
        const isFoil = document.getElementById('manual-is-foil').checked;

        if (!cardName || !quantity || quantity < 1) {
            alert("Please enter a valid card name and quantity.");
            return;
        }

        manualAddBtn.disabled = true;
        manualAddBtn.textContent = 'Adding...';

        try {
            const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
            if (!response.ok) throw new Error("Card not found. Please check the spelling.");
            
            const cardData = await response.json();
            const cardDoc = {
                name: cardData.name, tcg: "Magic: The Gathering", scryfallId: cardData.id,
                set: cardData.set, setName: cardData.set_name, rarity: cardData.rarity,
                imageUrl: cardData.image_uris?.normal || '',
                priceUsd: cardData.prices?.usd || '0.00', priceUsdFoil: cardData.prices?.usd_foil || '0.00',
                quantity: quantity, isFoil: isFoil, condition: condition,
                addedAt: new Date(), forSale: false
            };

            await db.collection('users').doc(user.uid).collection('collection').add(cardDoc);
            alert(`${quantity}x ${cardData.name} added to your collection!`);
            document.getElementById('manual-add-form').reset();
            loadCardList('collection');

        } catch (error) {
            alert("Could not add card. " + error.message);
        } finally {
            manualAddBtn.disabled = false;
            manualAddBtn.textContent = 'Add Manually';
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

                const header = Object.keys(rows[0]);
                const nameKey = header.find(h => h.toLowerCase().includes('name'));
                if (!nameKey) {
                    csvStatus.textContent = 'Error: Could not find a "Name" column in your CSV.';
                    return;
                }

                csvStatus.textContent = `Found ${rows.length} cards. Fetching data... This may take a moment.`;
                csvUploadBtn.disabled = true;
                
                let processedCount = 0;
                let errorCount = 0;
                const collectionRef = db.collection('users').doc(user.uid).collection('collection');

                for (const row of rows) {
                    const cardName = row[nameKey];
                    if (!cardName) continue;

                    try {
                        await new Promise(resolve => setTimeout(resolve, 100)); // Scryfall API rate limit
                        
                        const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
                        if (!response.ok) throw new Error(`Scryfall API error`);
                        
                        const cardData = await response.json();
                        const cardDoc = {
                            name: cardData.name, tcg: "Magic: The Gathering", scryfallId: cardData.id,
                            set: cardData.set, setName: cardData.set_name, rarity: cardData.rarity,
                            imageUrl: cardData.image_uris?.normal || '',
                            priceUsd: cardData.prices?.usd || '0.00', priceUsdFoil: cardData.prices?.usd_foil || '0.00',
                            quantity: parseInt(row['Quantity'] || row['Count'] || 1, 10),
                            isFoil: (row['Foil'] || '').toLowerCase() === 'foil',
                            condition: row['Condition'] || 'Near Mint',
                            addedAt: new Date(), forSale: false
                        };
                        
                        await collectionRef.add(cardDoc);
                        processedCount++;
                    } catch (error) {
                        console.warn(`Could not process card "${cardName}". Skipping.`);
                        errorCount++;
                    }
                    csvStatus.textContent = `Processing... ${processedCount + errorCount} / ${rows.length}`;
                }

                csvStatus.textContent = `Import complete! ${processedCount} cards added. ${errorCount > 0 ? `${errorCount} failed.` : ''}`;
                csvUploadBtn.disabled = false;
                setTimeout(() => {
                    loadCardList('collection');
                    csvStatus.textContent = '';
                }, 3000);
            }
        });
    });

    // --- Bulk Edit & Card Actions Listeners ---
    if (bulkEditBtn) bulkEditBtn.addEventListener('click', toggleBulkEditMode);
    if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', handleSelectAll);
    
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
    setupActionListeners(collectionListContainer);
    setupActionListeners(wishlistListContainer);

    if (listSelectedBtn) {
        listSelectedBtn.addEventListener('click', () => {
            if (selectedCards.size === 0) {
                alert("Please select at least one card to list.");
                return;
            }
            document.getElementById('list-sale-count').textContent = selectedCards.size;
            openModal(listForSaleModal);
        });
    }

    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', async () => {
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
                toggleBulkEditMode(); // Resets view
            }
        });
    }

    // --- Modal Logic ---
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
        loadCardList(listType);
    };

    // --- Form Submissions & Modal Closures ---
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
        loadCardList(listType);
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
        loadCardList('collection');
    });

    document.getElementById('percentage-price-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const percentage = document.getElementById('percentage-price-input').value;
        if (percentage && percentage > 0) listCardsForSale('percentage', percentage);
        else alert("Please enter a valid percentage.");
    });

    document.getElementById('custom-price-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const price = document.getElementById('custom-price-input').value;
        if (price && price >= 0) listCardsForSale('custom', price);
        else alert("Please enter a valid price.");
    });

    document.getElementById('close-edit-card-modal')?.addEventListener('click', () => closeModal(editCardModal));
    document.getElementById('close-listing-modal')?.addEventListener('click', () => closeModal(manageListingModal));
    document.getElementById('close-list-sale-modal')?.addEventListener('click', () => closeModal(listForSaleModal));
    document.getElementById('forSale')?.addEventListener('change', (e) => {
        document.getElementById('price-input-container').classList.toggle('hidden', !e.target.checked);
    });

    // --- Initial Load ---
    loadCardList('collection');
});
