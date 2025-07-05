document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const collectionPage = document.getElementById('content-collection');
    if (!collectionPage) return;

    // --- State ---
    let bulkEditMode = false;
    let selectedCards = new Set();
    let cardSearchResults = [];

    // --- DOM Elements ---
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const searchCardBtn = document.getElementById('search-card-btn');
    const searchResultsSection = document.getElementById('card-search-results-section');
    const searchResultsContainer = document.getElementById('card-search-results');
    const setFilter = document.getElementById('filter-set');
    const typeFilter = document.getElementById('filter-type');
    const csvUploadBtn = document.getElementById('csv-upload-btn');
    const csvUploadInput = document.getElementById('csv-upload-input');
    const csvStatus = document.getElementById('csv-status');
    const collectionListContainer = document.getElementById('collection-list');
    const bulkEditBtn = document.getElementById('bulk-edit-btn');
    const bulkActionBar = document.getElementById('bulk-action-bar');
    const selectedCountEl = document.getElementById('selected-count');
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

    // --- Single Card Search & Add ---
    searchCardBtn.addEventListener('click', async () => {
        const cardName = document.getElementById('search-card-name').value;
        if (!cardName) return;
        searchResultsSection.classList.remove('hidden');
        searchResultsContainer.innerHTML = '<p>Searching...</p>';
        try {
            const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints`);
            if (!response.ok) throw new Error("Card not found.");
            const data = await response.json();
            cardSearchResults = data.data;
            renderSearchResults();
        } catch (error) {
            searchResultsContainer.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        }
    });

    const renderSearchResults = () => {
        const set = setFilter.value;
        const type = typeFilter.value;
        let filteredResults = cardSearchResults;

        if (set) filteredResults = filteredResults.filter(card => card.set === set);
        if (type) filteredResults = filteredResults.filter(card => card.type_line && card.type_line.includes(type));

        searchResultsContainer.innerHTML = '';
        if (filteredResults.length === 0) {
            searchResultsContainer.innerHTML = '<p>No results match your filters.</p>';
            return;
        }

        const uniqueSets = [...new Set(cardSearchResults.map(card => card.set_name))].sort();
        setFilter.innerHTML = '<option value="">All Sets</option>';
        uniqueSets.forEach(setName => setFilter.innerHTML += `<option value="${cardSearchResults.find(c=>c.set_name === setName).set}">${setName}</option>`);
       
        const uniqueTypes = [...new Set(cardSearchResults.map(card => card.type_line ? card.type_line.split('—')[0].trim() : 'Unknown'))].sort();
        typeFilter.innerHTML = '<option value="">All Types</option>';
        uniqueTypes.forEach(typeName => typeFilter.innerHTML += `<option value="${typeName}">${typeName}</option>`);

        filteredResults.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'cursor-pointer';
            cardEl.innerHTML = `<img src="${card.image_uris?.normal || ''}" class="rounded-lg shadow-md w-full">`;
            cardEl.addEventListener('click', () => addCardToDb(card));
            searchResultsContainer.appendChild(cardEl);
        });
    };
   
    setFilter.addEventListener('change', renderSearchResults);
    typeFilter.addEventListener('change', renderSearchResults);

    const addCardToDb = async (cardData) => {
        if (!user) { alert("Please log in."); return; }
        const listType = document.querySelector('input[name="add-to-list"]:checked').value;
       
        const cardDoc = {
            name: cardData.name, tcg: "Magic: The Gathering", scryfallId: cardData.id,
            set: cardData.set, setName: cardData.set_name, imageUrl: cardData.image_uris?.normal || '',
            priceUsd: cardData.prices?.usd || '0.00', priceUsdFoil: cardData.prices?.usd_foil || '0.00',
            quantity: 1, isFoil: false, condition: 'Near Mint', addedAt: new Date(),
            forSale: false
        };
       
        try {
            await db.collection('users').doc(user.uid).collection(listType).add(cardDoc);
            alert(`${cardData.name} (${cardData.set_name}) added to your ${listType}!`);
            loadCardList(listType);
        } catch(error) {
            console.error("Error adding card: ", error);
            alert("Could not add card. See console for details.");
        }
    };

    // --- CSV Import Logic (FIXED & ROBUST) ---
    csvUploadBtn.addEventListener('click', () => {
        if (!user) { alert("Please log in."); return; }
        if (csvUploadInput.files.length === 0) { alert("Please select a file."); return; }
        
        Papa.parse(csvUploadInput.files[0], {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data;
                csvStatus.textContent = `Found ${rows.length} cards. Fetching data from Scryfall... This may take a moment.`;
                
                let processedCount = 0;
                const batch = db.batch();
                const collectionRef = db.collection('users').doc(user.uid).collection('collection');

                for (const row of rows) {
                    const cardName = row['Card Name'];
                    if (!cardName) continue;

                    try {
                        const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
                        if (!response.ok) throw new Error(`Scryfall API error for ${cardName}`);
                        const cardData = await response.json();

                        const cardDoc = {
                            name: cardData.name, tcg: "Magic: The Gathering", scryfallId: cardData.id,
                            set: cardData.set, setName: cardData.set_name, imageUrl: cardData.image_uris?.normal || '',
                            priceUsd: cardData.prices?.usd || '0.00', priceUsdFoil: cardData.prices?.usd_foil || '0.00',
                            quantity: parseInt(row.Count, 10) || 1,
                            isFoil: (row.Foil && row.Foil.toLowerCase() === 'foil'),
                            condition: row.Condition || 'Near Mint', addedAt: new Date(), forSale: false
                        };
                        
                        const docRef = collectionRef.doc();
                        batch.set(docRef, cardDoc);
                        processedCount++;

                    } catch (error) {
                        console.warn(`Could not find card "${cardName}". Skipping.`, error);
                    }
                    
                    csvStatus.textContent = `Processing... ${processedCount} / ${rows.length} cards.`;
                }

                try {
                    await batch.commit();
                    csvStatus.textContent = `Import complete! ${processedCount} cards added. Refreshing...`;
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
        selectedCountEl.textContent = selectedCards.size;
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
    };

    // --- Main Display Function ---
    const loadCardList = async (listType) => {
        const container = document.getElementById(`${listType}-list`);
        if (!user) { container.innerHTML = `<p>Please log in.</p>`; return; }
        container.innerHTML = '<p class="text-center p-4">Loading...</p>';

        const snapshot = await db.collection('users').doc(user.uid).collection(listType).orderBy('name').get();
        if (snapshot.empty) { container.innerHTML = `<p class="text-center p-4">Your ${listType} is empty.</p>`; return; }
       
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const card = doc.data();
            const cardEl = document.createElement('div');
            cardEl.className = 'relative group cursor-pointer';
            cardEl.dataset.id = doc.id;

            const forSaleIndicator = card.forSale ? 'border-4 border-green-500' : '';
            const checkboxOverlay = bulkEditMode && listType === 'collection' ? `<div class="bulk-checkbox-overlay absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-3xl ${selectedCards.has(doc.id) ? '' : 'hidden'}"><i class="fas fa-check-circle"></i></div>` : '';

            cardEl.innerHTML = `
                <img src="${card.imageUrl}" class="rounded-lg shadow-md w-full ${forSaleIndicator}">
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
                // Default click action when not in bulk mode: Go to card view
                const cardImg = cardElement.querySelector('img');
                if (cardImg) {
                    const cardName = cardImg.alt; // Assuming alt text is the card name
                    // window.location.href = `card-view.html?name=${encodeURIComponent(cardName)}`;
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

    const listCards = async (priceOption) => {
        const batch = db.batch();
        const collectionRef = db.collection('users').doc(user.uid).collection('collection');
        
        for (const cardId of selectedCards) {
            const docRef = collectionRef.doc(cardId);
            let newPrice = 0;
            if (priceOption === 'market') {
                const cardDoc = await docRef.get();
                newPrice = parseFloat(cardDoc.data().priceUsd || 0);
            } else {
                newPrice = parseFloat(priceOption);
            }
            batch.update(docRef, { forSale: true, salePrice: newPrice });
        }

        await batch.commit();
        alert(`${selectedCards.size} cards listed for sale!`);
        closeModal(listForSaleModal);
        toggleBulkEditMode();
    };

    document.getElementById('list-at-market-price-btn')?.addEventListener('click', () => listCards('market'));
    document.getElementById('custom-price-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const price = document.getElementById('custom-price-input').value;
        if (price && price > 0) {
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
