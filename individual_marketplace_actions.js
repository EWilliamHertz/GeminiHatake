/**
 * Individual Marketplace Action Handlers
 * These functions need to be added to collection-app.js to handle individual card marketplace actions
 */

// Add these functions to collection-app.js

async function handleIndividualListForSale(cardId) {
    const card = Collection.getCardById(cardId);
    if (!card) {
        UI.showToast("Card not found", "error");
        return;
    }

    // Open individual sale modal
    let modal = document.getElementById('individual-sale-modal');
    if (!modal) {
        // Create the modal if it doesn't exist
        createIndividualSaleModal();
        modal = document.getElementById('individual-sale-modal');
    }

    // Populate modal with card data
    document.getElementById('individual-sale-card-name').textContent = card.name;
    document.getElementById('individual-sale-card-image').src = getCardImageUrl(card);
    
    // Set market price as default
    const marketPrice = Currency.getNormalizedPriceUSD(card.prices) || 0;
    document.getElementById('individual-sale-price').value = marketPrice.toFixed(2);
    
    // Store card ID for later use
    modal.dataset.cardId = cardId;
    
    UI.openModal(modal);
}

async function handleIndividualRemoveFromSale(cardId) {
    const confirmed = confirm("Remove this card from marketplace?");
    if (!confirmed) return;

    try {
        await Collection.removeCardFromSale(cardId);
        UI.showToast("Card removed from marketplace", "success");
        applyAndRender({});
    } catch (error) {
        UI.showToast(`Error: ${error.message}`, "error");
    }
}

async function finalizeIndividualSale() {
    const modal = document.getElementById('individual-sale-modal');
    const cardId = modal.dataset.cardId;
    const price = parseFloat(document.getElementById('individual-sale-price').value);
    const currency = document.getElementById('individual-sale-currency').value || 'USD';

    if (!cardId || isNaN(price) || price <= 0) {
        UI.showToast("Please enter a valid price", "error");
        return;
    }

    const finalizeBtn = document.getElementById('finalize-individual-sale-btn');
    UI.setButtonLoading(finalizeBtn, true);

    try {
        // Update card sale status
        await Collection.batchUpdateSaleStatus([{
            id: cardId,
            data: { 
                for_sale: true, 
                sale_price: price,
                sale_currency: currency
            }
        }]);

        // Create marketplace listing
        await Collection.batchCreateMarketplaceListings([{
            id: cardId,
            data: { 
                for_sale: true, 
                sale_price: price,
                sale_currency: currency
            }
        }]);

        UI.showToast("Card listed for sale!", "success");
        UI.closeModal(modal);
        applyAndRender({});
    } catch (error) {
        UI.showToast(`Error: ${error.message}`, "error");
    } finally {
        UI.setButtonLoading(finalizeBtn, false, "List for Sale");
    }
}

function createIndividualSaleModal() {
    const modalHtml = `
        <div id="individual-sale-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
            <div class="flex items-center justify-center min-h-screen p-4">
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold">List Card for Sale</h3>
                        <button data-modal-close="individual-sale-modal" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="mb-4">
                        <img id="individual-sale-card-image" src="" alt="Card" class="w-32 h-auto mx-auto rounded">
                        <h4 id="individual-sale-card-name" class="text-center mt-2 font-medium"></h4>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Sale Price</label>
                            <input type="number" id="individual-sale-price" step="0.01" min="0" 
                                   class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-1">Currency</label>
                            <select id="individual-sale-currency" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                                <option value="USD">USD</option>
                                <option value="SEK">SEK</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                                <option value="NOK">NOK</option>
                                <option value="DKK">DKK</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex space-x-3 mt-6">
                        <button data-modal-close="individual-sale-modal" 
                                class="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                            Cancel
                        </button>
                        <button id="finalize-individual-sale-btn" onclick="finalizeIndividualSale()"
                                class="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                            List for Sale
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Update the card action handler to use these functions
function updateCardActionHandler() {
    // Find the existing card action handler and update it
    const existingHandler = `
        if (action === 'list-sale') {
            handleIndividualListForSale(cardId);
        } else if (action === 'remove-sale') {
            handleIndividualRemoveFromSale(cardId);
        } else if (action === 'update-price') {
            handleIndividualListForSale(cardId); // Reuse the same modal for price updates
        }
    `;
    
    console.log("Add this to the handleCardClick function in collection-app.js:");
    console.log(existingHandler);
}

// Make functions globally available
window.handleIndividualListForSale = handleIndividualListForSale;
window.handleIndividualRemoveFromSale = handleIndividualRemoveFromSale;
window.finalizeIndividualSale = finalizeIndividualSale;
window.createIndividualSaleModal = createIndividualSaleModal;
