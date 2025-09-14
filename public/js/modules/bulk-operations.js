/**
 * Bulk Operations Module
 * Handles bulk editing, selection, and operations on multiple cards
 */

let bulkEditMode = false;
let selectedItems = new Set();

/**
 * Toggle bulk edit mode
 */
function toggleBulkEditMode() {
    bulkEditMode = !bulkEditMode;
    selectedItems.clear();
    
    const bulkEditBtn = document.getElementById('bulk-edit-btn');
    if (bulkEditBtn) {
        if (bulkEditMode) {
            bulkEditBtn.textContent = 'Exit Bulk Edit';
            bulkEditBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            bulkEditBtn.classList.add('bg-red-600', 'hover:bg-red-700');
            showBulkControls();
        } else {
            bulkEditBtn.textContent = 'Bulk Edit';
            bulkEditBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            bulkEditBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
            hideBulkControls();
        }
    }
    
    // Re-render to show/hide checkboxes
    window.CollectionApp.renderCurrentView();
}

/**
 * Show bulk controls
 */
function showBulkControls() {
    const bulkControls = document.getElementById('bulk-controls');
    if (!bulkControls) {
        createBulkControls();
    } else {
        bulkControls.style.display = 'flex';
    }
}

/**
 * Hide bulk controls
 */
function hideBulkControls() {
    const bulkControls = document.getElementById('bulk-controls');
    if (bulkControls) {
        bulkControls.style.display = 'none';
    }
}

/**
 * Create bulk controls UI
 */
function createBulkControls() {
    const controlsContainer = document.querySelector('.flex.flex-wrap.items-center.justify-start.sm\\:justify-end.gap-2');
    if (!controlsContainer) return;
    
    const bulkControls = document.createElement('div');
    bulkControls.id = 'bulk-controls';
    bulkControls.className = 'flex items-center gap-2 mt-2 w-full';
    
    bulkControls.innerHTML = `
        <span class="text-sm text-gray-600 dark:text-gray-400" id="selected-count">0 selected</span>
        <button class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700" onclick="window.BulkOperations.selectAllItems()">
            Select All
        </button>
        <button class="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700" onclick="window.BulkOperations.clearSelection()">
            Clear
        </button>
        <button class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700" onclick="window.BulkOperations.bulkListForSale()">
            List for Sale
        </button>
        <button class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700" onclick="window.BulkOperations.bulkDelete()">
            Delete Selected
        </button>
    `;
    
    controlsContainer.appendChild(bulkControls);
}

/**
 * Toggle item selection
 */
function toggleItemSelection(itemId) {
    if (selectedItems.has(itemId)) {
        selectedItems.delete(itemId);
    } else {
        selectedItems.add(itemId);
    }
    
    updateSelectedCount();
    updateCheckboxes();
}

/**
 * Select all items
 */
function selectAllItems() {
    const currentTab = window.CollectionApp.getCurrentTab();
    const currentData = currentTab === 'collection' ? 
        window.CollectionApp.getCollectionData() : 
        window.CollectionApp.getWishlistData();
    
    currentData.forEach(item => selectedItems.add(item.id));
    updateSelectedCount();
    updateCheckboxes();
}

/**
 * Clear selection
 */
function clearSelection() {
    selectedItems.clear();
    updateSelectedCount();
    updateCheckboxes();
}

/**
 * Update selected count display
 */
function updateSelectedCount() {
    const countElement = document.getElementById('selected-count');
    if (countElement) {
        countElement.textContent = `${selectedItems.size} selected`;
    }
}

/**
 * Update checkboxes to reflect selection
 */
function updateCheckboxes() {
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        const itemId = checkbox.dataset.itemId;
        checkbox.checked = selectedItems.has(itemId);
    });
}

/**
 * Bulk delete selected items
 */
async function bulkDelete() {
    if (selectedItems.size === 0) {
        window.Utils.showNotification('No items selected', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} selected items?`)) {
        return;
    }
    
    try {
        const currentTab = window.CollectionApp.getCurrentTab();
        const currentUser = window.CollectionApp.getCurrentUser();
        const collectionType = currentTab === 'collection' ? 'collection' : 'wishlist';
        const batch = db.batch();
        
        selectedItems.forEach(itemId => {
            const docRef = db.collection('users').doc(currentUser.uid).collection(collectionType).doc(itemId);
            batch.delete(docRef);
        });
        
        await batch.commit();
        
        // Remove from local data
        window.CollectionApp.removeItems(Array.from(selectedItems), collectionType);
        
        selectedItems.clear();
        updateSelectedCount();
        
        window.Utils.showNotification('Selected items deleted successfully', 'success');
        
    } catch (error) {
        console.error('Error deleting items:', error);
        window.Utils.showNotification('Error deleting items', 'error');
    }
}

/**
 * Bulk list items for sale
 */
async function bulkListForSale() {
    if (selectedItems.size === 0) {
        window.Utils.showNotification('No items selected', 'error');
        return;
    }
    
    const salePrice = prompt('Enter sale price for selected items (leave empty to use market price):');
    if (salePrice === null) return; // User cancelled
    
    try {
        const currentTab = window.CollectionApp.getCurrentTab();
        const currentUser = window.CollectionApp.getCurrentUser();
        const collectionType = currentTab === 'collection' ? 'collection' : 'wishlist';
        const batch = db.batch();
        
        selectedItems.forEach(itemId => {
            const docRef = db.collection('users').doc(currentUser.uid).collection(collectionType).doc(itemId);
            const updateData = {
                forSale: true,
                lastModified: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (salePrice && !isNaN(parseFloat(salePrice))) {
                updateData.salePrice = parseFloat(salePrice);
            }
            
            batch.update(docRef, updateData);
        });
        
        await batch.commit();
        
        // Update local data
        window.CollectionApp.updateItemsForSale(Array.from(selectedItems), salePrice);
        
        // Add to marketplace listings
        await addToMarketplace(Array.from(selectedItems));
        
        selectedItems.clear();
        updateSelectedCount();
        
        window.CollectionApp.renderCurrentView();
        
        window.Utils.showNotification('Selected items listed for sale successfully', 'success');
        
    } catch (error) {
        console.error('Error listing items for sale:', error);
        window.Utils.showNotification('Error listing items for sale', 'error');
    }
}

/**
 * Add items to marketplace
 */
async function addToMarketplace(itemIds) {
    try {
        const currentTab = window.CollectionApp.getCurrentTab();
        const currentUser = window.CollectionApp.getCurrentUser();
        const collectionType = currentTab === 'collection' ? 'collection' : 'wishlist';
        const batch = db.batch();
        
        for (const itemId of itemIds) {
            // Get item data
            const itemDoc = await db.collection('users').doc(currentUser.uid).collection(collectionType).doc(itemId).get();
            if (!itemDoc.exists) continue;
            
            const itemData = itemDoc.data();
            
            // Create marketplace listing
            const marketplaceData = {
                ...itemData,
                sellerId: currentUser.uid,
                sellerName: currentUser.displayName || currentUser.email,
                originalItemId: itemId,
                listedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            };
            
            const marketplaceRef = db.collection('marketplaceListings').doc();
            batch.set(marketplaceRef, marketplaceData);
        }
        
        await batch.commit();
        
    } catch (error) {
        console.error('Error adding to marketplace:', error);
        throw error;
    }
}

/**
 * Initialize bulk operations
 */
function initializeBulkOperations() {
    // Add bulk edit button listener
    const bulkEditBtn = document.getElementById('bulk-edit-btn');
    if (bulkEditBtn) {
        bulkEditBtn.addEventListener('click', toggleBulkEditMode);
    }
}

/**
 * Get bulk edit mode status
 */
function isBulkEditMode() {
    return bulkEditMode;
}

/**
 * Get selected items
 */
function getSelectedItems() {
    return selectedItems;
}

/**
 * Reset bulk operations
 */
function resetBulkOperations() {
    bulkEditMode = false;
    selectedItems.clear();
    hideBulkControls();
    
    const bulkEditBtn = document.getElementById('bulk-edit-btn');
    if (bulkEditBtn) {
        bulkEditBtn.textContent = 'Bulk Edit';
        bulkEditBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        bulkEditBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
    }
}

// Export functions
window.BulkOperations = {
    toggleBulkEditMode,
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    bulkDelete,
    bulkListForSale,
    initializeBulkOperations,
    isBulkEditMode,
    getSelectedItems,
    resetBulkOperations
};

