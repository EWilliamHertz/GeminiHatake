// Debug fix for individual marketplace button issues
// Add this to the end of collection-app.js or run in browser console

// Fix 1: Ensure event delegation is working for dynamically added buttons
document.addEventListener('DOMContentLoaded', function() {
    console.log('Marketplace debug fix loaded');
    
    // Add event delegation for card actions if not already present
    const collectionDisplay = document.getElementById('collection-display');
    if (collectionDisplay) {
        // Remove existing listeners to avoid duplicates
        collectionDisplay.removeEventListener('click', handleCardActionClick);
        
        // Add new listener
        collectionDisplay.addEventListener('click', handleCardActionClick);
        console.log('Card action event listener added');
    }
});

function handleCardActionClick(e) {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const cardContainer = button.closest('.card-container');
    if (!cardContainer) return;
    
    const cardId = cardContainer.dataset.id;
    const action = button.dataset.action;
    
    console.log('Card action clicked:', action, 'for card:', cardId);
    
    const card = Collection.getCardById(cardId);
    if (!card) {
        console.error('Card not found:', cardId);
        return;
    }
    
    switch (action) {
        case 'list-sale':
            console.log('Opening individual sale modal for:', card.name);
            openIndividualSaleModal(cardId);
            break;
        case 'remove-sale':
            console.log('Removing card from sale:', card.name);
            removeCardFromSale(cardId);
            break;
        case 'update-price':
            console.log('Updating card price:', card.name);
            updateCardSalePrice(cardId);
            break;
        case 'edit':
            UI.populateCardModalForEdit(card);
            break;
        case 'delete':
            if (confirm(`Delete "${card.name}"?`)) {
                Collection.deleteCard(cardId).then(() => {
                    UI.showToast("Card deleted.", "success");
                    applyAndRender({});
                });
            }
            break;
        case 'history':
            console.log(`Opening price history for card: ${card.name}`);
            const chartContainer = document.getElementById('card-history-chart');
            if (chartContainer) {
                chartContainer.innerHTML = '<div class="text-center text-gray-500 py-4">Loading...</div>';
            }
            const titleEl = document.getElementById('card-history-modal-title');
            if(titleEl) {
                titleEl.textContent = `Price History: ${card.name}`;
            }
            UI.openModal(document.getElementById('card-history-modal'));
            setTimeout(() => {
                Analytics.renderSingleCardChart(card, 'card-history-chart');
            }, 100);
            break;
        default:
            console.log('Unknown action:', action);
    }
}

// Fix 2: Ensure modal exists and is properly initialized
function checkModalExists() {
    const modal = document.getElementById('individual-sale-modal');
    if (!modal) {
        console.error('Individual sale modal not found in DOM');
        return false;
    }
    
    // Check required elements
    const requiredElements = [
        'individual-sale-card-image',
        'individual-sale-card-name',
        'individual-sale-card-set',
        'individual-sale-market-price',
        'individual-sale-percentage',
        'individual-sale-fixed-price',
        'individual-sale-final-price',
        'individual-sale-confirm-btn'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        console.error('Missing modal elements:', missingElements);
        return false;
    }
    
    console.log('Individual sale modal is properly initialized');
    return true;
}

// Fix 3: Debug currency display issues
function debugCurrencyDisplay() {
    console.log('Current currency:', Currency.getUserCurrency());
    console.log('Currency symbol:', Currency.getCurrencySymbol(Currency.getUserCurrency()));
    
    // Test price conversion
    const testPrice = { usd: 10.00 };
    console.log('Test price conversion:', Currency.convertAndFormat(testPrice));
}

// Fix 4: Check if functions are properly defined
function checkFunctionDefinitions() {
    const requiredFunctions = [
        'openIndividualSaleModal',
        'removeCardFromSale', 
        'updateCardSalePrice',
        'handleIndividualSaleConfirm',
        'updateIndividualSaleFinalPrice'
    ];
    
    const missingFunctions = requiredFunctions.filter(funcName => typeof window[funcName] !== 'function');
    if (missingFunctions.length > 0) {
        console.error('Missing functions:', missingFunctions);
        return false;
    }
    
    console.log('All required functions are defined');
    return true;
}

// Run diagnostics
setTimeout(() => {
    console.log('=== Marketplace Debug Diagnostics ===');
    checkModalExists();
    checkFunctionDefinitions();
    debugCurrencyDisplay();
    console.log('=== End Diagnostics ===');
}, 1000);

// Export for manual testing
window.marketplaceDebug = {
    checkModalExists,
    checkFunctionDefinitions,
    debugCurrencyDisplay,
    handleCardActionClick
};
