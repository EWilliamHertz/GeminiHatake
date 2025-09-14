/**
 * Card Modal Module
 * Handles card detail modals for viewing and editing cards
 */

/**
 * Open card details modal
 */
function openCardModal(item) {
    const modal = createCardModal(item);
    document.body.appendChild(modal);
    
    // Show modal
    setTimeout(() => {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }, 10);
}

/**
 * Create card modal
 */
function createCardModal(item) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50';
    
    const imageUrl = window.CardDisplay.getCardImageUrl(item);
    const price = item.prices?.usd || item.price || 0;
    
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center p-6 border-b dark:border-gray-700">
                <h2 class="text-xl font-bold">${item.name}</h2>
                <button class="text-gray-500 hover:text-gray-700 text-2xl" onclick="this.closest('.fixed').remove()">×</button>
            </div>
            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <img src="${imageUrl}" alt="${item.name}" class="w-full rounded-lg" 
                             onerror="this.src='https://placehold.co/223x310/cccccc/969696?text=No+Image'">
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Quantity</label>
                            <input type="number" value="${item.quantity || 1}" min="1" 
                                   class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                   id="modal-quantity">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Condition</label>
                            <select class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" id="modal-condition">
                                <option value="Near Mint" ${item.condition === 'Near Mint' ? 'selected' : ''}>Near Mint</option>
                                <option value="Lightly Played" ${item.condition === 'Lightly Played' ? 'selected' : ''}>Lightly Played</option>
                                <option value="Moderately Played" ${item.condition === 'Moderately Played' ? 'selected' : ''}>Moderately Played</option>
                                <option value="Heavily Played" ${item.condition === 'Heavily Played' ? 'selected' : ''}>Heavily Played</option>
                                <option value="Damaged" ${item.condition === 'Damaged' ? 'selected' : ''}>Damaged</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Language</label>
                            <select class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" id="modal-language">
                                <option value="en" ${item.language === 'en' ? 'selected' : ''}>English</option>
                                <option value="es" ${item.language === 'es' ? 'selected' : ''}>Spanish</option>
                                <option value="fr" ${item.language === 'fr' ? 'selected' : ''}>French</option>
                                <option value="de" ${item.language === 'de' ? 'selected' : ''}>German</option>
                                <option value="it" ${item.language === 'it' ? 'selected' : ''}>Italian</option>
                                <option value="pt" ${item.language === 'pt' ? 'selected' : ''}>Portuguese</option>
                                <option value="ja" ${item.language === 'ja' ? 'selected' : ''}>Japanese</option>
                            </select>
                        </div>
                        <div class="flex items-center space-x-4">
                            <label class="flex items-center">
                                <input type="checkbox" ${item.isFoil ? 'checked' : ''} 
                                       class="mr-2" id="modal-foil">
                                Foil
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" ${item.isSigned ? 'checked' : ''} 
                                       class="mr-2" id="modal-signed">
                                Signed
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" ${item.isAltered ? 'checked' : ''} 
                                       class="mr-2" id="modal-altered">
                                Altered
                            </label>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Purchase Price</label>
                            <input type="number" step="0.01" value="${item.purchasePrice || ''}" 
                                   class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                   id="modal-purchase-price" placeholder="0.00">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Notes</label>
                            <textarea class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                      rows="3" id="modal-notes" placeholder="Add notes...">${item.notes || ''}</textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Upload Photo</label>
                            <input type="file" accept="image/*" 
                                   class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                   id="modal-photo">
                        </div>
                        <div class="flex items-center">
                            <input type="checkbox" ${item.forSale ? 'checked' : ''} 
                                   class="mr-2" id="modal-for-sale">
                            <label>List for sale</label>
                        </div>
                        <div id="sale-price-container" style="display: ${item.forSale ? 'block' : 'none'}">
                            <label class="block text-sm font-medium mb-1">Sale Price</label>
                            <input type="number" step="0.01" value="${item.salePrice || ''}" 
                                   class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                   id="modal-sale-price" placeholder="0.00">
                        </div>
                    </div>
                </div>
                <div class="flex justify-between mt-6 pt-6 border-t dark:border-gray-700">
                    <button class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" 
                            onclick="window.CardModal.deleteItem('${item.id}')">
                        Delete
                    </button>
                    <div class="space-x-2">
                        <button class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700" 
                                onclick="this.closest('.fixed').remove()">
                            Cancel
                        </button>
                        <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" 
                                onclick="window.CardModal.saveItemChanges('${item.id}')">
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add event listener for for-sale checkbox
    const forSaleCheckbox = modal.querySelector('#modal-for-sale');
    const salePriceContainer = modal.querySelector('#sale-price-container');
    
    forSaleCheckbox.addEventListener('change', () => {
        salePriceContainer.style.display = forSaleCheckbox.checked ? 'block' : 'none';
    });
    
    return modal;
}

/**
 * Save item changes from modal
 */
async function saveItemChanges(itemId) {
    try {
        const modal = document.querySelector('.fixed');
        const collectionData = window.CollectionApp.getCollectionData();
        const wishlistData = window.CollectionApp.getWishlistData();
        const currentUser = window.CollectionApp.getCurrentUser();
        
        const item = collectionData.find(item => item.id === itemId) || 
                    wishlistData.find(item => item.id === itemId);
        
        if (!item) {
            window.Utils.showNotification('Item not found', 'error');
            return;
        }
        
        // Get updated values from modal
        const updatedData = {
            quantity: parseInt(modal.querySelector('#modal-quantity').value) || 1,
            condition: modal.querySelector('#modal-condition').value,
            language: modal.querySelector('#modal-language').value,
            isFoil: modal.querySelector('#modal-foil').checked,
            isSigned: modal.querySelector('#modal-signed').checked,
            isAltered: modal.querySelector('#modal-altered').checked,
            purchasePrice: parseFloat(modal.querySelector('#modal-purchase-price').value) || null,
            notes: modal.querySelector('#modal-notes').value,
            forSale: modal.querySelector('#modal-for-sale').checked,
            salePrice: parseFloat(modal.querySelector('#modal-sale-price').value) || null,
            lastModified: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Handle photo upload
        const photoInput = modal.querySelector('#modal-photo');
        if (photoInput.files[0]) {
            const reader = new FileReader();
            const fileData = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(photoInput.files[0]);
            });
            updatedData.customImageUrl = fileData;
        }
        
        // Determine collection type
        const isInWishlist = wishlistData.some(w => w.id === itemId);
        const collectionType = isInWishlist ? 'wishlist' : 'collection';
        
        // Update in Firebase
        const docRef = db.collection('users').doc(currentUser.uid).collection(collectionType).doc(itemId);
        await docRef.update(updatedData);
        
        // Update local data
        Object.assign(item, updatedData);
        
        // Re-render
        window.CollectionApp.renderCurrentView();
        
        // Close modal
        modal.remove();
        
        window.Utils.showNotification('Item updated successfully', 'success');
        
    } catch (error) {
        console.error('Error saving item changes:', error);
        window.Utils.showNotification('Error saving changes', 'error');
    }
}

/**
 * Delete item
 */
async function deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }
    
    try {
        const collectionData = window.CollectionApp.getCollectionData();
        const wishlistData = window.CollectionApp.getWishlistData();
        const currentUser = window.CollectionApp.getCurrentUser();
        
        const isInWishlist = wishlistData.some(w => w.id === itemId);
        const collectionType = isInWishlist ? 'wishlist' : 'collection';
        
        // Delete from Firebase
        await db.collection('users').doc(currentUser.uid).collection(collectionType).doc(itemId).delete();
        
        // Remove from local data
        window.CollectionApp.removeItem(itemId, collectionType);
        
        // Close modal
        document.querySelector('.fixed')?.remove();
        
        window.Utils.showNotification('Item deleted successfully', 'success');
        
    } catch (error) {
        console.error('Error deleting item:', error);
        window.Utils.showNotification('Error deleting item', 'error');
    }
}

/**
 * Open add card modal
 */
function openAddCardModal(card, game) {
    const modal = createAddCardModal(card, game);
    document.body.appendChild(modal);
    
    // Show modal
    setTimeout(() => {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }, 10);
}

/**
 * Create add card modal
 */
function createAddCardModal(card, game) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50';
    
    const imageUrl = window.CardDisplay.getCardImageUrl(card);
    const price = card.prices?.usd || 0;
    
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center p-6 border-b dark:border-gray-700">
                <h2 class="text-xl font-bold">Add ${card.name}</h2>
                <button class="text-gray-500 hover:text-gray-700 text-2xl" onclick="this.closest('.fixed').remove()">×</button>
            </div>
            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <img src="${imageUrl}" alt="${card.name}" class="w-full rounded-lg" 
                             onerror="this.src='https://placehold.co/223x310/cccccc/969696?text=No+Image'">
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Add to</label>
                            <select class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" id="add-list-type">
                                <option value="collection">Collection</option>
                                <option value="wishlist">Wishlist</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Quantity</label>
                            <input type="number" value="1" min="1" 
                                   class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                   id="add-quantity">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Condition</label>
                            <select class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" id="add-condition">
                                <option value="Near Mint">Near Mint</option>
                                <option value="Lightly Played">Lightly Played</option>
                                <option value="Moderately Played">Moderately Played</option>
                                <option value="Heavily Played">Heavily Played</option>
                                <option value="Damaged">Damaged</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Language</label>
                            <select class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" id="add-language">
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="it">Italian</option>
                                <option value="pt">Portuguese</option>
                                <option value="ja">Japanese</option>
                            </select>
                        </div>
                        <div class="flex items-center space-x-4">
                            <label class="flex items-center">
                                <input type="checkbox" class="mr-2" id="add-foil">
                                Foil
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" class="mr-2" id="add-signed">
                                Signed
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" class="mr-2" id="add-altered">
                                Altered
                            </label>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Purchase Price</label>
                            <input type="number" step="0.01" value="${price}" 
                                   class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                   id="add-purchase-price" placeholder="0.00">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Notes</label>
                            <textarea class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                      rows="3" id="add-notes" placeholder="Add notes..."></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Upload Photo</label>
                            <input type="file" accept="image/*" 
                                   class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                   id="add-photo">
                        </div>
                    </div>
                </div>
                <div class="flex justify-end mt-6 pt-6 border-t dark:border-gray-700 space-x-2">
                    <button class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700" 
                            onclick="this.closest('.fixed').remove()">
                        Cancel
                    </button>
                    <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" 
                            onclick="window.CardModal.addCardToCollection('${card.id || card.name}', '${game}')">
                        Add Card
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return modal;
}

/**
 * Add card to collection
 */
async function addCardToCollection(cardId, game) {
    try {
        const modal = document.querySelector('.fixed');
        const currentUser = window.CollectionApp.getCurrentUser();
        
        // Get card data from the search results or create basic data
        let cardData = {};
        
        if (game === 'magic') {
            // Try to get full card data from Scryfall
            try {
                cardData = await window.Utils.makeApiCall(`https://api.scryfall.com/cards/${cardId}`);
            } catch (error) {
                console.warn('Could not fetch full card data, using basic data');
                cardData = { id: cardId, name: cardId };
            }
        } else if (game === 'pokemon') {
            // Try to get full card data from Pokemon TCG API
            try {
                const response = await window.Utils.makeApiCall(`https://api.pokemontcg.io/v2/cards/${cardId}`, {
                    headers: {
                        'X-Api-Key': '60a08d4a-3a34-43d8-8f41-827b58cfac6d'
                    }
                });
                cardData = response.data;
            } catch (error) {
                console.warn('Could not fetch full card data, using basic data');
                cardData = { id: cardId, name: cardId };
            }
        }
        
        // Get form data
        const listType = modal.querySelector('#add-list-type').value;
        const quantity = parseInt(modal.querySelector('#add-quantity').value) || 1;
        const condition = modal.querySelector('#add-condition').value;
        const language = modal.querySelector('#add-language').value;
        const isFoil = modal.querySelector('#add-foil').checked;
        const isSigned = modal.querySelector('#add-signed').checked;
        const isAltered = modal.querySelector('#add-altered').checked;
        const purchasePrice = parseFloat(modal.querySelector('#add-purchase-price').value) || null;
        const notes = modal.querySelector('#add-notes').value;
        
        // Handle photo upload
        let customImageUrl = null;
        const photoInput = modal.querySelector('#add-photo');
        if (photoInput.files[0]) {
            const reader = new FileReader();
            customImageUrl = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(photoInput.files[0]);
            });
        }
        
        // Prepare data for saving
        const itemData = {
            ...cardData,
            tcg: game === 'magic' ? 'Magic: The Gathering' : 'Pokémon',
            quantity,
            condition,
            language,
            isFoil,
            isSigned,
            isAltered,
            purchasePrice,
            notes,
            customImageUrl,
            dateAdded: firebase.firestore.FieldValue.serverTimestamp(),
            productType: 'single'
        };
        
        // Save to Firebase
        const collectionRef = db.collection('users').doc(currentUser.uid).collection(listType);
        const docRef = await collectionRef.add(itemData);
        
        // Add to local data
        itemData.id = docRef.id;
        window.CollectionApp.addItem(itemData, listType);
        
        // Close modal
        modal.remove();
        
        // Clear search results and input
        window.CardSearch.clearSearchResults();
        
        window.Utils.showNotification(`Card added to ${listType} successfully!`, 'success');
        
    } catch (error) {
        console.error('Error adding card:', error);
        window.Utils.showNotification('Error adding card', 'error');
    }
}

// Export functions
window.CardModal = {
    openCardModal,
    createCardModal,
    saveItemChanges,
    deleteItem,
    openAddCardModal,
    createAddCardModal,
    addCardToCollection
};

