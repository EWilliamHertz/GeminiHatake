document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const searchCardForm = document.getElementById('search-card-form');
    if (!searchCardForm) return;

    let cardSearchResults = [];

    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const searchCardBtn = document.getElementById('search-card-btn');
    const searchResultsSection = document.getElementById('card-search-results-section');
    const searchResultsContainer = document.getElementById('card-search-results');
    const setFilter = document.getElementById('filter-set');
    const typeFilter = document.getElementById('filter-type');
    const csvUploadBtn = document.getElementById('csv-upload-btn');
    const csvUploadInput = document.getElementById('csv-upload-input');
    const editCardModal = document.getElementById('edit-card-modal');
    const editCardForm = document.getElementById('edit-card-form');

    const switchTab = (tabId) => {
        tabs.forEach(item => {
            const isTarget = item.id === tabId;
            item.classList.toggle('text-blue-600', isTarget);
            item.classList.toggle('border-blue-600', isTarget);
            item.classList.toggle('text-gray-500', !isTarget);
            item.classList.toggle('hover:border-gray-300', !isTarget);
        });
        const targetContentId = tabId.replace('tab-', 'content-');
        tabContents.forEach(content => content.classList.toggle('hidden', content.id !== `content-${tabId.split('-')[1]}`));
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.id);
            if (tab.id === 'tab-collection') loadCardList('collection');
            if (tab.id === 'tab-wishlist') loadCardList('wishlist');
        });
    });

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
            quantity: 1, isFoil: false, condition: 'Near Mint', addedAt: new Date()
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
   
    csvUploadBtn.addEventListener('click', () => {
        if (!user) { alert("Please log in."); return; }
        if (csvUploadInput.files.length === 0) { alert("Please select a file."); return; }
       
        Papa.parse(csvUploadInput.files[0], {
            header: true,
            complete: async (results) => {
                const statusEl = document.getElementById('csv-status');
                statusEl.textContent = `Processing ${results.data.length} cards...`;
                const batch = db.batch();
                const collectionRef = db.collection('users').doc(user.uid).collection('collection');

                for (const row of results.data) {
                    const cardName = row['Card Name'];
                    if (cardName) {
                        const docRef = collectionRef.doc();
                        batch.set(docRef, {
                            name: cardName, quantity: parseInt(row.Count, 10) || 1, set: row.Set,
                            setName: row['Set Name'], isFoil: (row.Foil && row.Foil.toLowerCase() === 'foil'),
                            condition: row.Condition || 'Near Mint', imageUrl: 'https://placehold.co/223x310?text=Loading...',
                            addedAt: new Date(), tcg: "Magic: The Gathering"
                        });
                    }
                }
                try {
                    await batch.commit();
                    statusEl.textContent = `Import complete! Refreshing collection...`;
                    loadCardList('collection');
                } catch(error) {
                    console.error("CSV Upload Error: ", error);
                    statusEl.textContent = "Error uploading. Check console for details.";
                }
            }
        });
    });
   
    const loadCardList = async (listType) => {
        const container = document.getElementById(`${listType}-list`);
        if (!user) { container.innerHTML = `<p>Please log in to view your ${listType}.</p>`; return; }
        container.innerHTML = '<p>Loading...</p>';

        const snapshot = await db.collection('users').doc(user.uid).collection(listType).orderBy('name').get();
        if (snapshot.empty) { container.innerHTML = `<p>Your ${listType} is empty.</p>`; return; }
       
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const card = doc.data();
            const cardEl = document.createElement('div');
            cardEl.className = 'relative';
            cardEl.innerHTML = `
                <img src="${card.imageUrl}" class="rounded-lg shadow-md w-full">
                <div class="absolute top-0 right-0 p-1 bg-black bg-opacity-50 rounded-bl-lg">
                    <button class="edit-card-btn text-white text-xs" data-id="${doc.id}" data-list="${listType}"><i class="fas fa-edit"></i></button>
                    <button class="delete-card-btn text-white text-xs ml-1" data-id="${doc.id}" data-list="${listType}"><i class="fas fa-trash"></i></button>
                </div>
                <div class="absolute bottom-0 left-0 right-0 p-1 bg-black bg-opacity-50 text-white text-xs text-center">
                    <p>$${card.isFoil ? (card.priceUsdFoil || card.priceUsd) : card.priceUsd} (${card.quantity})</p>
                </div>`;
            container.appendChild(cardEl);
        });

        container.querySelectorAll('.edit-card-btn').forEach(btn => btn.addEventListener('click', (e) => {
            openEditModal(e.currentTarget.dataset.id, e.currentTarget.dataset.list);
        }));
        container.querySelectorAll('.delete-card-btn').forEach(btn => btn.addEventListener('click', (e) => {
            if (confirm("Are you sure you want to delete this card?")) {
                deleteCard(e.currentTarget.dataset.id, e.currentTarget.dataset.list);
            }
        }));
    };

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

    document.getElementById('close-edit-card-modal')?.addEventListener('click', () => closeModal(editCardModal));

    const deleteCard = async (cardId, listType) => {
        await db.collection('users').doc(user.uid).collection(listType).doc(cardId).delete();
        loadCardList(listType);
    };

    if (user) {
        loadCardList('collection');
    } else {
        document.getElementById('collection-list').innerHTML = '<p>Please log in to view your collection.</p>';
        document.getElementById('wishlist-list').innerHTML = '<p>Please log in to view your wishlist.</p>';
    }
});
