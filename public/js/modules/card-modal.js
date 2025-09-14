/**
 * Fixed Card Modal Module
 * Handles card detail modals and editing functionality with proper null checks
 */

/**
 * Add card to collection with proper error handling
 */
async function addCardToCollection(cardId, cardData = null) {
    const modal = document.getElementById('add-version-modal');
    if (!modal) {
        console.error('Add version modal not found');
        window.Utils.showNotification('Modal not found', 'error');
        return;
    }

    try {
        // Get current user
        const currentUser = window.CollectionApp.getCurrentUser();
        if (!currentUser) {
            window.Utils.showNotification('Please log in to add cards', 'error');
            return;
        }

        // If no card data provided, try to fetch it
        if (!cardData) {
            try {
                const response = await window.Utils.makeApiCall(`https://api.scryfall.com/cards/${cardId}`);
                cardData = response;
            } catch (error) {
                console.warn('Could not fetch full card data, using basic data');
                cardData = { id: cardId, name: cardId };
            }
        }
        
        // Get form data with proper null checks
        const listTypeEl = modal.querySelector('#add-list-type');
        const quantityEl = modal.querySelector('#add-quantity');
        const conditionEl = modal.querySelector('#add-condition');
        const languageEl = modal.querySelector('#add-language');
        const foilEl = modal.querySelector('#add-foil');
        const signedEl = modal.querySelector('#add-signed');
        const alteredEl = modal.querySelector('#add-altered');
        const purchasePriceEl = modal.querySelector('#add-purchase-price');
        const notesEl = modal.querySelector('#add-notes');
        
        const listType = listTypeEl ? listTypeEl.value : 'collection';
        const quantity = quantityEl ? (parseInt(quantityEl.value) || 1) : 1;
        const condition = conditionEl ? conditionEl.value : 'Near Mint';
        const language = languageEl ? languageEl.value : 'en';
        const isFoil = foilEl ? foilEl.checked : false;
        const isSigned = signedEl ? signedEl.checked : false;
        const isAltered = alteredEl ? alteredEl.checked : false;
        const purchasePrice = purchasePriceEl ? (parseFloat(purchasePriceEl.value) || null) : null;
        const notes = notesEl ? notesEl.value : '';
        
        // Handle photo upload
        let customImageUrl = null;
        const photoInput = modal.querySelector('#add-photo');
        if (photoInput && photoInput.files && photoInput.files[0]) {
            try {
                // Upload photo to Firebase Storage
                const file = photoInput.files[0];
                const storageRef = firebase.storage().ref();
                const photoRef = storageRef.child(`card-photos/${currentUser.uid}/${Date.now()}_${file.name}`);
                const snapshot = await photoRef.put(file);
                customImageUrl = await snapshot.ref.getDownloadURL();
            } catch (uploadError) {
                console.error('Error uploading photo:', uploadError);
                window.Utils.showNotification('Photo upload failed, but card will be added without custom image', 'warning');
            }
        }

        // Prepare card data for database
        const cardToAdd = {
            ...cardData,
            quantity: quantity,
            condition: condition,
            language: language,
            isFoil: isFoil,
            isSigned: isSigned,
            isAltered: isAltered,
            purchasePrice: purchasePrice,
            notes: notes,
            customImageUrl: customImageUrl,
            dateAdded: firebase.firestore.FieldValue.serverTimestamp(),
            addedBy: currentUser.uid,
            source: 'manual'
        };

        // Add to Firebase
        const collectionRef = db.collection('users').doc(currentUser.uid).collection(listType);
        const docRef = await collectionRef.add(cardToAdd);
        
        console.log('Card added successfully with ID:', docRef.id);
        
        // Close modal and refresh data
        window.Utils.closeModal(modal);
        
        // Clear form
        if (quantityEl) quantityEl.value = '1';
        if (conditionEl) conditionEl.value = 'Near Mint';
        if (languageEl) languageEl.value = 'en';
        if (foilEl) foilEl.checked = false;
        if (signedEl) signedEl.checked = false;
        if (alteredEl) alteredEl.checked = false;
        if (purchasePriceEl) purchasePriceEl.value = '';
        if (notesEl) notesEl.value = '';
        if (photoInput) photoInput.value = '';
        
        // Refresh collection data
        await window.CollectionApp.loadCollectionData();
        if (listType === 'wishlist') {
            await window.CollectionApp.loadWishlistData();
        }
        window.CollectionApp.renderCurrentView();
        
        window.Utils.showNotification(`${cardData.name || 'Card'} added to ${listType}!`, 'success');
        
    } catch (error) {
        console.error('Error adding card:', error);
        window.Utils.showNotification('Error adding card: ' + error.message, 'error');
    }
}

/**
 * Open card management modal with proper initialization
 */
function openCardManagementModal(cardData, existingData = null) {
    const modal = document.getElementById('add-version-modal');
    if (!modal) {
        console.error('Add version modal not found');
        return;
    }

    // Set card data in modal
    const cardNameEl = modal.querySelector('#modal-card-name');
    const cardImageEl = modal.querySelector('#modal-card-image');
    const cardSetEl = modal.querySelector('#modal-card-set');
    const cardPriceEl = modal.querySelector('#modal-card-price');
    
    if (cardNameEl) cardNameEl.textContent = cardData.name || 'Unknown Card';
    if (cardImageEl) {
        cardImageEl.src = window.CardDisplay.getCardImageUrl(cardData, 'normal');
        cardImageEl.alt = cardData.name || 'Card Image';
    }
    if (cardSetEl) cardSetEl.textContent = cardData.set_name || cardData.setName || 'Unknown Set';
    if (cardPriceEl) {
        const price = cardData.prices?.usd || cardData.price || 0;
        cardPriceEl.textContent = price > 0 ? window.Utils.safeFormatPrice(price) : 'Price not available';
    }

    // Pre-fill form if editing existing card
    if (existingData) {
        const quantityEl = modal.querySelector('#add-quantity');
        const conditionEl = modal.querySelector('#add-condition');
        const languageEl = modal.querySelector('#add-language');
        const foilEl = modal.querySelector('#add-foil');
        const signedEl = modal.querySelector('#add-signed');
        const alteredEl = modal.querySelector('#add-altered');
        const purchasePriceEl = modal.querySelector('#add-purchase-price');
        const notesEl = modal.querySelector('#add-notes');
        
        if (quantityEl) quantityEl.value = existingData.quantity || 1;
        if (conditionEl) conditionEl.value = existingData.condition || 'Near Mint';
        if (languageEl) languageEl.value = existingData.language || 'en';
        if (foilEl) foilEl.checked = existingData.isFoil || false;
        if (signedEl) signedEl.checked = existingData.isSigned || false;
        if (alteredEl) alteredEl.checked = existingData.isAltered || false;
        if (purchasePriceEl) purchasePriceEl.value = existingData.purchasePrice || '';
        if (notesEl) notesEl.value = existingData.notes || '';
    }

    // Set up add button
    const addButton = modal.querySelector('#add-card-btn');
    if (addButton) {
        // Remove existing event listeners
        const newButton = addButton.cloneNode(true);
        addButton.parentNode.replaceChild(newButton, addButton);
        
        // Add new event listener
        newButton.addEventListener('click', () => {
            addCardToCollection(cardData.id, cardData);
        });
    }

    // Open modal
    window.Utils.openModal(modal);
}

/**
 * Create search result element with proper click handling
 */
function createSearchResultElement(card, game) {
    const cardElement = document.createElement('div');
    cardElement.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow';
    
    const imageUrl = window.CardDisplay.getCardImageUrl(card, 'small');
    const price = game === 'magic' ? 
        (card.prices?.usd || 0) : 
        (card.cardmarket?.prices?.averageSellPrice || 0);
    
    cardElement.innerHTML = `
        <div class="flex items-center space-x-4">
            <img src="${imageUrl}" alt="${card.name}" class="w-16 h-22 object-cover rounded" 
                 onerror="this.src='https://placehold.co/64x89/cccccc/969696?text=No+Image'">
            <div class="flex-1">
                <h3 class="font-semibold text-gray-900 dark:text-white">${card.name}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">${card.set_name || card.set?.name || 'Unknown Set'}</p>
                ${price > 0 ? `<p class="text-sm font-medium text-green-600">${window.Utils.safeFormatPrice(price)}</p>` : ''}
                ${card.rarity ? `<p class="text-xs text-gray-500">${card.rarity}</p>` : ''}
            </div>
            <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                Add to Collection
            </button>
        </div>
    `;
    
    // Add click event listener
    cardElement.addEventListener('click', (e) => {
        e.preventDefault();
        openCardManagementModal(card);
    });
    
    return cardElement;
}

/**
 * Initialize card modal functionality
 */
function initializeCardModal() {
    // Set up modal close handlers
    const modal = document.getElementById('add-version-modal');
    if (modal) {
        const closeButtons = modal.querySelectorAll('.close-modal, [data-close-modal]');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                window.Utils.closeModal(modal);
            });
        });
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                window.Utils.closeModal(modal);
            }
        });
    }
    
    console.log('Card modal functionality initialized');
}

/**
 * Close add version modal
 */
function closeAddVersionModal() {
    const modal = document.getElementById('add-version-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Add card from modal form
 */
async function addCardFromModal() {
    try {
        // Get form values
        const quantity = document.getElementById('modal-quantity')?.value || 1;
        const condition = document.getElementById('modal-condition')?.value || 'Near Mint';
        const language = document.getElementById('modal-language')?.value || 'en';
        const listType = document.getElementById('modal-list-type')?.value || 'collection';
        const isFoil = document.getElementById('modal-foil')?.checked || false;
        const notes = document.getElementById('modal-notes')?.value || '';
        
        // Get card data from modal
        const cardName = document.getElementById('modal-card-name')?.textContent;
        const cardSet = document.getElementById('modal-card-set')?.textContent;
        const cardPrice = document.getElementById('modal-card-price')?.textContent;
        
        if (!cardName) {
            window.Utils.showNotification('Card data not found', 'error');
            return;
        }
        
        // Get the stored card data from the modal
        const modal = document.getElementById('add-version-modal');
        const storedCardData = modal.cardData || {};
        
        // Create card data object
        const cardData = {
            ...storedCardData,
            name: cardName,
            set_name: cardSet,
            quantity: parseInt(quantity),
            condition: condition,
            language: language,
            isFoil: isFoil,
            notes: notes,
            dateAdded: firebase.firestore.FieldValue.serverTimestamp(),
            productType: 'single'
        };
        
        // Add to collection
        await addCardToCollection(cardData, listType);
        
        closeAddVersionModal();
        
    } catch (error) {
        console.error('Error adding card from modal:', error);
        window.Utils.showNotification('Error adding card: ' + error.message, 'error');
    }
}

// Export functions
window.CardModal = {
    addCardToCollection,
    openCardManagementModal,
    createSearchResultElement,
    initializeCardModal,
    closeAddVersionModal,
    addCardFromModal
};

