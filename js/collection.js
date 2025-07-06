/**
 * HatakeSocial - My Collection Page Script (v4 - Manual Add Feature)
 *
 * This script is based on the original from your repository and adds:
 * - A new event listener for the manual add form.
 * - Logic to take user input for quantity, condition, and foil status.
 * - Integration with the Scryfall API to fetch card details for the manually added card.
 */
window.HatakeSocial.onAuthReady((user) => {
    const user = e.detail.user;
    const collectionPage = document.getElementById('content-collection');
    if (!collectionPage) return;

    // --- State ---
    let bulkEditMode = false;
    let selectedCards = new Set();
    let currentCollectionIds = []; // To store IDs of all cards currently displayed
    let cardSearchResults = [];

    // --- DOM Elements ---
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const csvUploadBtn = document.getElementById('csv-upload-btn');
    const csvUploadInput = document.getElementById('csv-upload-input');
    const csvStatus = document.getElementById('csv-status');
    const collectionListContainer = document.getElementById('collection-list');
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
    const closeListingModalBtn = document.getElementById('close-listing-modal');
    const listingForm = document.getElementById('manage-listing-form');
    const forSaleToggle = document.getElementById('forSale');
    const priceInputContainer = document.getElementById('price-input-container');
    const manualAddBtn = document.getElementById('manual-add-btn');

    // --- Tab Switching ---
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

    // --- NEW: Manual Card Add Logic ---
    manualAddBtn.addEventListener('click', async () => {
        if (!user) {
            alert("Please log in to add cards.");
            return;
        }

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
            if (!response.ok) {
                throw new Error("Card not found. Please check the spelling.");
            }
            const cardData = await response.json();

            const cardDoc = {
                name: cardData.name,
                tcg: "Magic: The Gathering", // Assuming MTG for now
                scryfallId: cardData.id,
                set: cardData.set,
                setName: cardData.set_name,
                imageUrl: cardData.image_uris?.normal || '',
                priceUsd: cardData.prices?.usd || '0.00',
                priceUsdFoil: cardData.prices?.usd_foil || '0.00',
                quantity: quantity,
                isFoil: isFoil,
                condition: condition,
                addedAt: new Date(),
                forSale: false
            };

            await db.collection('users').doc(user.uid).collection('collection').add(cardDoc);
            alert(`${quantity}x ${cardData.name} added to your collection!`);
            document.getElementById('manual-add-form').reset(); // Clear the form
            loadCardList('collection'); // Refresh the view

        } catch (error) {
            console.error("Error adding card manually: ", error);
            alert("Could not add card. " + error.message);
        } finally {
            manualAddBtn.disabled = false;
            manualAddBtn.textContent = 'Add Manually';
        }
    });


    // --- CSV Import Logic (FIXED & ROBUST) ---
    csvUploadBtn.addEventListener('click', () => {
        if (!user) { alert("Please log in."); return; }
        if (csvUploadInput.files.length === 0) { alert("Please select a file."); return; }
        
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
                console.log("Detected CSV Headers:", header);
                
                const nameKey = header.find(h => h.toLowerCase().includes('name'));
                const quantityKey = header.find(h => h.toLowerCase().includes('quantity') || h.toLowerCase().includes('count'));
                const foilKey = header.find(h => h.toLowerCase().includes('foil'));
                const conditionKey = header.find(h => h.toLowerCase().includes('condition'));

                if (!nameKey) {
                    csvStatus.textContent = 'Error: Could not find a "Name" or "Card Name" column in your CSV.';
                    return;
                }

                csvStatus.textContent = `Found ${rows.length} cards. Fetching data from Scryfall... This may take a moment.`;
                
                let processedCount = 0;
                let errorCount = 0;
                const batch = db.batch();
                const collectionRef = db.collection('users').doc(user.uid).collection('collection');

                for (const row of rows) {
                    const cardName = row[nameKey];
                    if (!cardName) continue;

                    try {
                        const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
                        if (!response.ok) throw new Error(`Scryfall API error for ${cardName}`);
                        const cardData = await response.json();

                        const cardDoc = {
                            name: cardData.name, tcg: "Magic: The Gathering", scryfallId: cardData.id,
                            set: cardData.set, setName: cardData.set_name, imageUrl: cardData.image_uris?.normal || '',
                            priceUsd: cardData.prices?.usd || '0.00', priceUsdFoil: cardData.prices?.usd_foil || '0.00',
                            quantity: quantityKey ? (parseInt(row[quantityKey], 10) || 1) : 1,
                            isFoil: foilKey ? (row[foilKey] && row[foilKey].toLowerCase() === 'foil') : false,
                            condition: conditionKey ? (row[conditionKey] || 'Near Mint') : 'Near Mint',
                            addedAt: new Date(), forSale: false
                        };
                        
                        const docRef = collectionRef.doc();
                        batch.set(docRef, cardDoc);
                        processedCount++;

                    } catch (error) {
                        console.warn(`Could not find card "${cardName}". Skipping.`, error);
                        errorCount++;
                    }
                    
                    csvStatus.textContent = `Processing... ${processedCount + errorCount} / ${rows.length} cards.`;
                }

                try {
                    await batch.commit();
                    csvStatus.textContent = `Import complete! ${processedCount} cards added. ${errorCount > 0 ? `${errorCount} failed.` : ''} Refreshing...`;
                    setTimeout(() => {
                        loadCardList('collection');
                        csvStatus.textContent = '';
                    }, 2000);
                } catch (error) {
                    console.error("CSV Batch Commit Error: ", error);
                    csvStatus.textContent = "Error saving cards. Check console for details.";
                }
            }
        });
    });

    // --- Bulk Edit Logic ---
    const toggleBulkEditMode = () => {
        bulkEditMode = !bulkEditMode;
        selectedCards.clear();
        selectAllCheckbox.checked = false;
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
        loadCardList('collection');
    };

    const updateSelectedCount = () => {
        selectedCountEl.textContent = `${selectedCards.size} cards selected`;
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
        selectAllCheckbox.checked = selectedCards.size === currentCollectionIds.length && currentCollectionIds.length > 0;
    };
    
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            currentCollectionIds.forEach(id => selectedCards.add(id));
        } else {
            selectedCards.clear();
        }
        updateSelectedCount();
        loadCardList('collection');
    };

    // --- Main Display Function ---
    const loadCardList = async (listType) => {
        const container = document.getElementById(`${listType}-list`);
        if (!user) { container.innerHTML = `<p>Please log in.</p>`; return; }
        container.innerHTML = '<p class="text-center p-4">Loading...</p>';

        const snapshot = await db.collection('users').doc(user.uid).collection(listType).orderBy('name').get();
        if (snapshot.empty) { container.innerHTML = `<p class="text-center p-4">Your ${listType} is empty.</p>`; return; }
       
        container.innerHTML = '';
        currentCollectionIds = []; 
        snapshot.forEach(doc => {
            if (listType === 'collection') {
                currentCollectionIds.push(doc.id);
            }
            const card = doc.data();
            const cardEl = document.createElement('div');
            cardEl.className = 'relative group cursor-pointer';
            cardEl.dataset.id = doc.id;

            const forSaleIndicator = card.forSale ? 'border-4 border-green-500' : '';
            const isSelected = selectedCards.has(doc.id);
            const checkboxOverlay = bulkEditMode && listType === 'collection' ? `<div class="bulk-checkbox-overlay absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-3xl ${isSelected ? '' : 'hidden'}"><i class="fas fa-check-circle"></i></div>` : '';

            cardEl.innerHTML = `
                <img src="${card.imageUrl}" alt="${card.name}" class="rounded-lg shadow-md w-full ${forSaleIndicator}">
                ${checkboxOverlay}
                <div class="card-actions absolute top-0 right-0 p-1 bg-black bg-opacity-50 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="edit-card-btn text-white text-xs" data-list="${listType}"><i class="fas fa-edit"></i></button>
                    <button class="delete-card-btn text-white text-xs ml-1" data-list="${listType}"><i class="fas fa-trash"></i></button>
                    ${listType === 'collection' ? `<button class="manage-listing-btn text-white text-xs ml-1" data-list="${listType}"><i class="fas fa-tags"></i></button>` : ''}
                </div>
            `;
            container.appendChild(cardEl);
        });
    };

    // --- Event Listeners ---
    bulkEditBtn.addEventListener('click', toggleBulkEditMode);
    selectAllCheckbox.addEventListener('change', handleSelectAll);
    
    collectionListContainer.addEventListener('click', (e) => {
        const cardElement = e.target.closest('.group');
        if (!cardElement) return;
        const cardId = cardElement.dataset.id;
        
        if (bulkEditMode) {
            handleCardSelection(cardId);
        } else {
            if (e.target.closest('.edit-card-btn')) openEditModal(cardId, 'collection');
            else if (e.target.closest('.delete-card-btn')) {
                if(confirm('Are you sure you want to delete this card?')) deleteCard(cardId, 'collection');
            }
            else if (e.target.closest('.manage-listing-btn')) openManageListingModal(cardId, 'collection');
            else {
                const cardImg = cardElement.querySelector('img');
                if (cardImg) {
                    const cardName = cardImg.alt;
                    window.location.href = `card-view.html?name=${encodeURIComponent(cardName)}`;
                }
            }
        }
    });

    listSelectedBtn.addEventListener('click', () => {
        if (selectedCards.size === 0) {
            alert("Please select at least one card to list.");
            return;
        }
        document.getElementById('list-sale-count').textContent = selectedCards.size;
        openModal(listForSaleModal);
    });

    document.getElementById('close-list-sale-modal')?.addEventListener('click', () => closeModal(listForSaleModal));

    const listCards = async (priceOption, percentage = 100) => {
        const batch = db.batch();
        const collectionRef = db.collection('users').doc(user.uid).collection('collection');
        
        for (const cardId of selectedCards) {
            const docRef = collectionRef.doc(cardId);
            let newPrice = 0;
            if (priceOption === 'percentage') {
                const cardDoc = await docRef.get();
                const marketPrice = parseFloat(cardDoc.data().priceUsd || 0);
                newPrice = marketPrice * (percentage / 100);
            } else {
                newPrice = parseFloat(priceOption);
            }
            batch.update(docRef, { forSale: true, salePrice: newPrice });
        }

        await batch.commit();
        alert(`${selectedCards.size} cards listed for sale!`);
        closeModal(document.getElementById('list-for-sale-modal'));
        toggleBulkEditMode();
    };

    document.getElementById('percentage-price-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const percentage = document.getElementById('percentage-price-input').value;
        if (percentage && percentage > 0) {
            listCards('percentage', percentage);
        } else {
            alert("Please enter a valid percentage.");
        }
    });

    document.getElementById('custom-price-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const price = document.getElementById('custom-price-input').value;
        if (price && price >= 0) {
            listCards(price);
        } else {
            alert("Please enter a valid price.");
        }
    });

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
            toggleBulkEditMode();
        }
    });

    // --- Original Modal Functions ---
    const openEditModal = async (cardId, listType) => {
        const docRef = db.collection('users').doc(user.uid).collection(listType).doc(cardId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const card = docSnap.data();
            document.getElementById('edit-card-id').value = cardId;
            document.getElementById('edit-card-list-type').value = listType;
            document.getElementById('edit-card-quantity').value = card.quantity;
            document.getElementById('edit-card-condition').value = card.condition;
            document.getElementById('edit-card-foil').checked = card.isFoil;
            openModal(editCardModal);
        }
    };

    const openManageListingModal = async (cardId, listType) => {
        const docRef = db.collection('users').doc(user.uid).collection(listType).doc(cardId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const card = docSnap.data();
            document.getElementById('listing-card-id').value = cardId;
            document.getElementById('listing-card-image').src = card.imageUrl;
            document.getElementById('listing-card-name').textContent = card.name;
            document.getElementById('listing-card-set').textContent = card.setName;
            forSaleToggle.checked = card.forSale || false;
            document.getElementById('salePrice').value = card.salePrice || '';
            priceInputContainer.classList.toggle('hidden', !forSaleToggle.checked);
            openModal(manageListingModal);
        }
    };

    const deleteCard = async (cardId, listType) => {
        await db.collection('users').doc(user.uid).collection(listType).doc(cardId).delete();
        loadCardList(listType);
    };

    editCardForm?.addEventListener('submit', async (e) => {
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

    listingForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cardId = document.getElementById('listing-card-id').value;
        const isForSale = forSaleToggle.checked;
        const salePrice = parseFloat(document.getElementById('salePrice').value) || 0;
        const updatedData = {
            forSale: isForSale,
            salePrice: isForSale ? salePrice : firebase.firestore.FieldValue.delete()
        };
        await db.collection('users').doc(user.uid).collection('collection').doc(cardId).update(updatedData);
        alert("Listing updated successfully!");
        closeModal(manageListingModal);
        loadCardList('collection');
    });

    document.getElementById('close-edit-card-modal')?.addEventListener('click', () => closeModal(editCardModal));
    closeListingModalBtn?.addEventListener('click', () => closeModal(manageListingModal));
    forSaleToggle?.addEventListener('change', () => {
        priceInputContainer.classList.toggle('hidden', !forSaleToggle.checked);
    });

    // --- Initial Load ---
    if (user) {
        loadCardList('collection');
    }
});
