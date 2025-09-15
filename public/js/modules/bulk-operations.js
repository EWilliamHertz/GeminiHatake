/**
 * bulk-operations.js
 * Handles logic for bulk editing the collection.
 */
import * as Collection from './collection.js';
import * as UI from './ui.js';
import * as API from './api.js';

const state = Collection.getState();

export const isBulkEditMode = () => state.bulkEdit.isActive;

/**
 * Toggles bulk edit mode on or off.
 * @returns {boolean} The new state of bulk edit mode.
 */
export function enterBulkEditMode() {
    state.bulkEdit.isActive = true;
    state.bulkEdit.selected.clear();
    document.getElementById('bulk-actions-toolbar').classList.remove('hidden');
    updateSelectionCount();
    return true;
}

export function exitBulkEditMode() {
    state.bulkEdit.isActive = false;
    state.bulkEdit.selected.clear();
    document.getElementById('bulk-actions-toolbar').classList.add('hidden');
    // Re-render to hide checkboxes
    document.querySelector('.tab-button.active').click(); 
}

/**
 * Toggles the selection status of a single card.
 * @param {string} cardId The Firestore ID of the card.
 */
export function toggleCardSelection(cardId) {
    const checkbox = document.querySelector(`.bulk-select-checkbox[data-id="${cardId}"]`);
    if (state.bulkEdit.selected.has(cardId)) {
        state.bulkEdit.selected.delete(cardId);
        if(checkbox) checkbox.checked = false;
    } else {
        state.bulkEdit.selected.add(cardId);
        if(checkbox) checkbox.checked = true;
    }
    updateSelectionCount();
}

/**
 * Updates the count display in the bulk actions toolbar.
 */
function updateSelectionCount() {
    const count = state.bulkEdit.selected.size;
    document.getElementById('bulk-selection-count').textContent = `${count} card${count === 1 ? '' : 's'} selected`;
}

/**
 * Deletes all currently selected cards after confirmation.
 */
export async function deleteSelected() {
    const selectedIds = Array.from(state.bulkEdit.selected);
    if (selectedIds.length === 0) {
        showToast("No cards selected.", "info");
        return;
    }

    if (confirm(`Are you sure you want to delete ${selectedIds.length} card entries? This cannot be undone.`)) {
        try {
            await API.batchDeleteCards(state.currentUser.uid, selectedIds);
            
            // Update local state
            state.fullCollection = state.fullCollection.filter(c => !selectedIds.includes(c.id));
            Collection.applyFilters();
            
            showToast(`${selectedIds.length} cards deleted.`, "success");
            exitBulkEditMode();
        } catch (error) {
            console.error("Bulk delete failed:", error);
            showToast("Error deleting cards.", "error");
        }
    }
}

/**
 * Opens the "List for Sale" modal for the selected cards.
 */
export function listSelectedForSale() {
    const count = state.bulkEdit.selected.size;
    if (count === 0) {
        showToast("No cards selected.", "info");
        return;
    }
    UI.openBulkListSaleModal(count);
}

/**
 * Applies the pricing logic from the modal to the selected cards.
 */
export async function applyBulkListForSale() {
    const selectedIds = Array.from(state.bulkEdit.selected);
    const form = document.getElementById('bulk-list-form');
    const priceOption = form.elements['price-option'].value;

    const updates = [];
    
    for (const id of selectedIds) {
        const card = Collection.getCardById(id);
        if (!card) continue;

        let salePrice = null;
        if (priceOption === 'percentage') {
            const percentage = parseFloat(document.getElementById('bulk-price-percentage').value) / 100;
            const marketPrice = card.prices?.usd || 0;
            if (!isNaN(percentage) && marketPrice > 0) {
                salePrice = parseFloat((marketPrice * percentage).toFixed(2));
            }
        } else {
            const fixedPrice = parseFloat(document.getElementById('bulk-price-fixed').value);
            if (!isNaN(fixedPrice)) {
                salePrice = fixedPrice;
            }
        }
        
        updates.push({
            id: id,
            data: { forSale: true, salePrice: salePrice }
        });
    }

    if (updates.length > 0) {
         try {
            await API.batchUpdateCards(state.currentUser.uid, updates);
            
            // Update local state
             updates.forEach(update => {
                const cardIndex = state.fullCollection.findIndex(c => c.id === update.id);
                if (cardIndex > -1) {
                    state.fullCollection[cardIndex] = { ...state.fullCollection[cardIndex], ...update.data };
                }
            });
            Collection.applyFilters();

            showToast(`${updates.length} cards listed for sale.`, "success");
            exitBulkEditMode();
        } catch (error) {
            console.error("Bulk list for sale failed:", error);
            showToast("Error listing cards for sale.", "error");
        }
    }
}