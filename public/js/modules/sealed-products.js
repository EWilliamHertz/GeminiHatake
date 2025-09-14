/**
 * Sealed Products Module
 * Handles sealed product functionality (booster boxes, packs, etc.)
 */

/**
 * Add sealed product
 */
async function addSealedProduct() {
    const gameSelect = document.getElementById('sealed-game-select');
    const productTypeSelect = document.getElementById('sealed-product-type');
    const setNameInput = document.getElementById('sealed-set-name');
    const productNameInput = document.getElementById('sealed-product-name');
    
    if (!gameSelect || !productTypeSelect || !setNameInput) {
        window.Utils.showNotification('Sealed product form elements not found', 'error');
        return;
    }
    
    const setName = setNameInput.value.trim();
    if (!setName) {
        window.Utils.showNotification('Please enter a set/expansion name', 'error');
        return;
    }
    
    const productData = {
        tcg: gameSelect.value === 'magic' ? 'Magic: The Gathering' : 'Pokémon',
        productType: 'sealed',
        sealedType: productTypeSelect.value,
        setName: setName,
        name: productNameInput.value.trim() || `${setName} ${window.Utils.getProductTypeDisplayName(productTypeSelect.value)}`,
        quantity: 1,
        condition: 'Near Mint',
        language: 'en',
        dateAdded: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        const currentUser = window.CollectionApp.getCurrentUser();
        
        // Save to Firebase
        const collectionRef = db.collection('users').doc(currentUser.uid).collection('collection');
        const docRef = await collectionRef.add(productData);
        
        // Add to local data
        productData.id = docRef.id;
        window.CollectionApp.addItem(productData, 'collection');
        
        // Clear form
        setNameInput.value = '';
        if (productNameInput) productNameInput.value = '';
        
        window.Utils.showNotification(`${productData.name} added to collection!`, 'success');
        
    } catch (error) {
        console.error('Error adding sealed product:', error);
        window.Utils.showNotification('Error adding sealed product', 'error');
    }
}

/**
 * Open sealed product modal for editing
 */
function openSealedProductModal(item) {
    const modal = createSealedProductModal(item);
    document.body.appendChild(modal);
    
    // Show modal
    setTimeout(() => {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }, 10);
}

/**
 * Create sealed product modal
 */
function createSealedProductModal(item) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50';
    
    const imageUrl = window.CardDisplay.getDefaultSealedProductImage(item.sealedType);
    
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center p-6 border-b dark:border-gray-700">
                <h2 class="text-xl font-bold">${item.name}</h2>
                <button class="text-gray-500 hover:text-gray-700 text-2xl" onclick="this.closest('.fixed').remove()">×</button>
            </div>
            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <img src="${imageUrl}" alt="${item.name}" class="w-full rounded-lg">
                        <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <h3 class="font-semibold mb-2">Product Details</h3>
                            <p><strong>Type:</strong> ${window.Utils.getProductTypeDisplayName(item.sealedType)}</p>
                            <p><strong>Set:</strong> ${item.setName}</p>
                            <p><strong>TCG:</strong> ${item.tcg}</p>
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Product Name</label>
                            <input type="text" value="${item.name}" 
                                   class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                   id="sealed-modal-name">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Quantity</label>
                            <input type="number" value="${item.quantity || 1}" min="1" 
                                   class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                   id="sealed-modal-quantity">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Condition</label>
                            <select class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" id="sealed-modal-condition">
                                <option value="Near Mint" ${item.condition === 'Near Mint' ? 'selected' : ''}>Near Mint</option>
                                <option value="Lightly Played" ${item.condition === 'Lightly Played' ? 'selected' : ''}>Lightly Played</option>
                                <option value="Moderately Played" ${item.condition === 'Moderately Played' ? 'selected' : ''}>Moderately Played</option>
                                <option value="Heavily Played" ${item.condition === 'Heavily Played' ? 'selected' : ''}>Heavily Played</option>
                                <option value="Damaged" ${item.condition === 'Damaged' ? 'selected' : ''}>Damaged</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Language</label>
                            <select class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" id="sealed-modal-language">
                                <option value="en" ${item.language === 'en' ? 'selected' : ''}>English</option>
                                <option value="es" ${item.language === 'es' ? 'selected' : ''}>Spanish</option>
                                <option value="fr" ${item.language === 'fr' ? 'selected' : ''}>French</option>
                                <option value="de" ${item.language === 'de' ? 'selected' : ''}>German</option>
                                <option value="it" ${item.language === 'it' ? 'selected' : ''}>Italian</option>
                                <option value="pt" ${item.language === 'pt' ? 'selected' : ''}>Portuguese</option>
                                <option value="ja" ${item.language === 'ja' ? 'selected' : ''}>Japanese</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Purchase Price</label>
                            <input type="number" step="0.01" value="${item.purchasePrice || ''}" 
                                   class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                   id="sealed-modal-purchase-price" placeholder="0.00">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Notes</label>
                            <textarea class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                      rows="3" id="sealed-modal-notes" placeholder="Add notes...">${item.notes || ''}</textarea>
                        </div>
                        <div class="flex items-center">
                            <input type="checkbox" ${item.forSale ? 'checked' : ''} 
                                   class="mr-2" id="sealed-modal-for-sale">
                            <label>List for sale</label>
                        </div>
                        <div id="sealed-sale-price-container" style="display: ${item.forSale ? 'block' : 'none'}">
                            <label class="block text-sm font-medium mb-1">Sale Price</label>
                            <input type="number" step="0.01" value="${item.salePrice || ''}" 
                                   class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" 
                                   id="sealed-modal-sale-price" placeholder="0.00">
                        </div>
                    </div>
                </div>
                <div class="flex justify-between mt-6 pt-6 border-t dark:border-gray-700">
                    <button class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" 
                            onclick="window.SealedProducts.deleteSealedProduct('${item.id}')">
                        Delete
                    </button>
                    <div class="space-x-2">
                        <button class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700" 
                                onclick="this.closest('.fixed').remove()">
                            Cancel
                        </button>
                        <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" 
                                onclick="window.SealedProducts.saveSealedProductChanges('${item.id}')">
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add event listener for for-sale checkbox
    const forSaleCheckbox = modal.querySelector('#sealed-modal-for-sale');
    const salePriceContainer = modal.querySelector('#sealed-sale-price-container');
    
    forSaleCheckbox.addEventListener('change', () => {
        salePriceContainer.style.display = forSaleCheckbox.checked ? 'block' : 'none';
    });
    
    return modal;
}

/**
 * Save sealed product changes
 */
async function saveSealedProductChanges(itemId) {
    try {
        const modal = document.querySelector('.fixed');
        const collectionData = window.CollectionApp.getCollectionData();
        const currentUser = window.CollectionApp.getCurrentUser();
        
        const item = collectionData.find(item => item.id === itemId);
        if (!item) {
            window.Utils.showNotification('Item not found', 'error');
            return;
        }
        
        // Get updated values from modal
        const updatedData = {
            name: modal.querySelector('#sealed-modal-name').value,
            quantity: parseInt(modal.querySelector('#sealed-modal-quantity').value) || 1,
            condition: modal.querySelector('#sealed-modal-condition').value,
            language: modal.querySelector('#sealed-modal-language').value,
            purchasePrice: parseFloat(modal.querySelector('#sealed-modal-purchase-price').value) || null,
            notes: modal.querySelector('#sealed-modal-notes').value,
            forSale: modal.querySelector('#sealed-modal-for-sale').checked,
            salePrice: parseFloat(modal.querySelector('#sealed-modal-sale-price').value) || null,
            lastModified: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Update in Firebase
        const docRef = db.collection('users').doc(currentUser.uid).collection('collection').doc(itemId);
        await docRef.update(updatedData);
        
        // Update local data
        Object.assign(item, updatedData);
        
        // Re-render
        window.CollectionApp.renderCurrentView();
        
        // Close modal
        modal.remove();
        
        window.Utils.showNotification('Sealed product updated successfully', 'success');
        
    } catch (error) {
        console.error('Error saving sealed product changes:', error);
        window.Utils.showNotification('Error saving changes', 'error');
    }
}

/**
 * Delete sealed product
 */
async function deleteSealedProduct(itemId) {
    if (!confirm('Are you sure you want to delete this sealed product?')) {
        return;
    }
    
    try {
        const currentUser = window.CollectionApp.getCurrentUser();
        
        // Delete from Firebase
        await db.collection('users').doc(currentUser.uid).collection('collection').doc(itemId).delete();
        
        // Remove from local data
        window.CollectionApp.removeItem(itemId, 'collection');
        
        // Close modal
        document.querySelector('.fixed')?.remove();
        
        window.Utils.showNotification('Sealed product deleted successfully', 'success');
        
    } catch (error) {
        console.error('Error deleting sealed product:', error);
        window.Utils.showNotification('Error deleting sealed product', 'error');
    }
}

/**
 * Initialize sealed products functionality
 */
function initializeSealedProducts() {
    // Sealed product adding
    const addSealedBtn = document.getElementById('add-sealed-product-btn');
    if (addSealedBtn) {
        addSealedBtn.addEventListener('click', addSealedProduct);
    }
}

/**
 * Get sealed product types
 */
function getSealedProductTypes() {
    return [
        { value: 'booster_box', label: 'Booster Box' },
        { value: 'booster_pack', label: 'Booster Pack' },
        { value: 'bundle', label: 'Bundle' },
        { value: 'prerelease_kit', label: 'Prerelease Kit' },
        { value: 'commander_deck', label: 'Commander Deck' },
        { value: 'starter_deck', label: 'Starter Deck' },
        { value: 'collector_booster', label: 'Collector Booster' },
        { value: 'draft_booster', label: 'Draft Booster' },
        { value: 'set_booster', label: 'Set Booster' },
        { value: 'theme_booster', label: 'Theme Booster' }
    ];
}

/**
 * Check if item is sealed product
 */
function isSealedProduct(item) {
    return item.productType === 'sealed';
}

// Export functions
window.SealedProducts = {
    addSealedProduct,
    openSealedProductModal,
    createSealedProductModal,
    saveSealedProductChanges,
    deleteSealedProduct,
    initializeSealedProducts,
    getSealedProductTypes,
    isSealedProduct
};

