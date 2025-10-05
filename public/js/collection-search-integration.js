/**
 * Collection Search Integration
 * 
 * This script integrates enhanced pricing display into the existing collection search
 * without completely overriding the existing functionality.
 */

// Card condition definitions with multipliers
const CARD_CONDITIONS = {
    'near_mint': { label: 'Near Mint', shortLabel: 'NM', multiplier: 1.0 },
    'lightly_played': { label: 'Lightly Played', shortLabel: 'LP', multiplier: 0.85 },
    'moderately_played': { label: 'Moderately Played', shortLabel: 'MP', multiplier: 0.70 },
    'heavily_played': { label: 'Heavily Played', shortLabel: 'HP', multiplier: 0.55 },
    'damaged': { label: 'Damaged', shortLabel: 'DMG', multiplier: 0.40 }
};

// Currency conversion function
let currencyConvertAndFormat = null;

// Load currency module
async function loadCurrencyModule() {
    try {
        const currencyModule = await import('./modules/currency.js');
        currencyConvertAndFormat = currencyModule.convertAndFormat;
        console.log('Currency module loaded successfully');
    } catch (error) {
        console.error('Failed to load currency module:', error);
    }
}

// Wait for the page to load and then enhance the search results
document.addEventListener('DOMContentLoaded', function() {
    console.log('Collection Search Integration: Initializing...');
    
    // Load currency module first, then initialize
    loadCurrencyModule().then(() => {
        // Wait a bit for the collection app to initialize
        setTimeout(() => {
            enhanceSearchResults();
            interceptSearchResultClicks();
            createEnhancedCardModal();
        }, 1000);
    });
});

function enhanceSearchResults() {
    // Monitor the search results container for changes
    const resultsContainer = document.getElementById('search-results-container');
    if (!resultsContainer) {
        console.log('Search results container not found');
        return;
    }

    // Use MutationObserver to detect when search results are updated
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if search result items were added
                const searchItems = resultsContainer.querySelectorAll('.search-result-item');
                if (searchItems.length > 0) {
                    enhanceExistingResults(searchItems);
                }
            }
        });
    });

    observer.observe(resultsContainer, {
        childList: true,
        subtree: true
    });
}

function enhanceExistingResults(searchItems) {
    console.log('Enhancing', searchItems.length, 'search results');
    
    searchItems.forEach(item => {
        if (item.classList.contains('enhanced')) return; // Already enhanced
        
        try {
            const cardData = JSON.parse(item.dataset.card);
            enhanceSearchResultItem(item, cardData);
            item.classList.add('enhanced');
        } catch (error) {
            console.error('Error enhancing search result:', error);
        }
    });
}

function enhanceSearchResultItem(item, cardData) {
    // Find the price element
    const priceElement = item.querySelector('.text-sm.font-mono');
    if (!priceElement) return;

    // Create enhanced price display
    const enhancedPriceDiv = document.createElement('div');
    enhancedPriceDiv.className = 'text-xs space-y-1';
    
    // Determine if this is Pokemon or MTG
    const isPokemon = cardData.game === 'pokemon' || cardData.set_name?.toLowerCase().includes('pokemon');
    const foilLabel = isPokemon ? 'Holo' : 'Foil';
    
    // Get prices
    const normalPrice = cardData.prices?.usd || 0;
    const foilPrice = cardData.prices?.usd_foil || 0;
    
    let priceHTML = '';
    
    if (normalPrice > 0) {
        const formattedNormal = currencyConvertAndFormat ? 
            currencyConvertAndFormat({ usd: normalPrice }) : 
            `$${normalPrice.toFixed(2)}`;
        priceHTML += `
            <div class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-400">Normal:</span>
                <span class="font-semibold text-green-600 dark:text-green-400">${formattedNormal}</span>
            </div>
        `;
    }
    
    if (foilPrice > 0) {
        const formattedFoil = currencyConvertAndFormat ? 
            currencyConvertAndFormat({ usd: foilPrice }) : 
            `$${foilPrice.toFixed(2)}`;
        priceHTML += `
            <div class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-400 flex items-center">
                    <i class="fas fa-star text-yellow-500 mr-1"></i>${foilLabel}:
                </span>
                <span class="font-semibold text-yellow-600 dark:text-yellow-400">${formattedFoil}</span>
            </div>
        `;
    }
    
    if (!normalPrice && !foilPrice) {
        priceHTML = '<span class="text-gray-500 dark:text-gray-400">Price not available</span>';
    }
    
    enhancedPriceDiv.innerHTML = priceHTML;
    
    // Replace the old price element
    priceElement.parentNode.replaceChild(enhancedPriceDiv, priceElement);
    
    // Add enhanced styling
    item.classList.add('border', 'border-gray-200', 'dark:border-gray-600', 'rounded-lg', 'mb-2');
}

function interceptSearchResultClicks() {
    // Override the existing click handler
    document.addEventListener('click', function(e) {
        const searchItem = e.target.closest('.search-result-item.enhanced');
        if (searchItem) {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                const cardData = JSON.parse(searchItem.dataset.card);
                showEnhancedCardModal(cardData);
            } catch (error) {
                console.error('Error showing enhanced card modal:', error);
            }
        }
    }, true); // Use capture phase to intercept before other handlers
}

function createEnhancedCardModal() {
    const modalHTML = `
        <div id="enhanced-card-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h2 id="enhanced-card-title" class="text-2xl font-bold text-gray-900 dark:text-white">
                            Select Card Details
                        </h2>
                        <button id="close-enhanced-card-modal" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="grid md:grid-cols-2 gap-6">
                        <!-- Card Image -->
                        <div class="relative">
                            <img id="enhanced-card-image" 
                                 src="" 
                                 alt="Card Image" 
                                 class="w-full rounded-lg shadow-md">
                            <div id="enhanced-foil-indicator" class="absolute top-2 right-2 hidden">
                                <!-- Foil indicator will be added dynamically -->
                            </div>
                        </div>
                        
                        <!-- Card Options -->
                        <div class="space-y-4">
                            <div>
                                <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Card Information</h3>
                                <div class="space-y-2 text-sm">
                                    <div class="flex justify-between">
                                        <span class="text-gray-600 dark:text-gray-400">Set:</span>
                                        <span id="enhanced-card-set" class="font-medium"></span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="text-gray-600 dark:text-gray-400">Number:</span>
                                        <span id="enhanced-card-number" class="font-medium"></span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Finish Selection -->
                            <div id="enhanced-finish-selection">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Card Finish
                                </label>
                                <div class="space-y-2">
                                    <label class="flex items-center">
                                        <input type="radio" name="enhanced-finish" value="normal" checked 
                                               class="mr-2 text-blue-600 focus:ring-blue-500">
                                        <span>Normal</span>
                                        <span id="enhanced-normal-price" class="ml-auto font-semibold text-green-600"></span>
                                    </label>
                                    <label id="enhanced-foil-option" class="flex items-center hidden">
                                        <input type="radio" name="enhanced-finish" value="foil" 
                                               class="mr-2 text-blue-600 focus:ring-blue-500">
                                        <span id="enhanced-foil-label">Foil</span>
                                        <span id="enhanced-foil-price" class="ml-auto font-semibold text-yellow-600"></span>
                                    </label>
                                </div>
                            </div>
                            
                            <!-- Condition Selection -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Card Condition
                                </label>
                                <select id="enhanced-condition-select" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                                    ${Object.entries(CARD_CONDITIONS).map(([key, condition]) => 
                                        `<option value="${key}">${condition.label}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            
                            <!-- Quantity -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Quantity
                                </label>
                                <input type="number" id="enhanced-quantity" min="1" value="1" 
                                       class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            </div>
                            
                            <!-- Current Price Display -->
                            <div class="border-t pt-4">
                                <div class="flex justify-between items-center mb-4">
                                    <span class="text-lg font-semibold text-gray-900 dark:text-white">Total Price:</span>
                                    <span id="enhanced-total-price" class="text-2xl font-bold text-green-600 dark:text-green-400">
                                        $0.00
                                    </span>
                                </div>
                                
                                <div class="flex space-x-2">
                                    <button id="enhanced-add-to-collection" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                        Add to Collection
                                    </button>
                                    <button id="enhanced-add-to-wishlist" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                        Add to Wishlist
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    bindEnhancedModalEvents();
}

let currentEnhancedCard = null;

function bindEnhancedModalEvents() {
    // Close modal
    document.getElementById('close-enhanced-card-modal').addEventListener('click', hideEnhancedCardModal);

    // Finish selection change
    document.querySelectorAll('input[name="enhanced-finish"]').forEach(radio => {
        radio.addEventListener('change', updateEnhancedCardPrice);
    });

    // Condition selection change
    document.getElementById('enhanced-condition-select').addEventListener('change', updateEnhancedCardPrice);

    // Quantity change
    document.getElementById('enhanced-quantity').addEventListener('input', updateEnhancedCardPrice);

    // Add buttons
    document.getElementById('enhanced-add-to-collection').addEventListener('click', () => addEnhancedCardToList('collection'));
    document.getElementById('enhanced-add-to-wishlist').addEventListener('click', () => addEnhancedCardToList('wishlist'));

    // Close on backdrop click
    document.getElementById('enhanced-card-modal').addEventListener('click', (e) => {
        if (e.target.id === 'enhanced-card-modal') {
            hideEnhancedCardModal();
        }
    });
}

function showEnhancedCardModal(cardData) {
    currentEnhancedCard = cardData;
    
    // Determine if this is Pokemon or MTG
    const isPokemon = cardData.game === 'pokemon' || cardData.set_name?.toLowerCase().includes('pokemon');
    const foilLabel = isPokemon ? 'Holo' : 'Foil';
    
    // Update modal content
    document.getElementById('enhanced-card-title').textContent = cardData.name;
    
    // Use the card's image URL or construct one
    const imageUrl = cardData.image_uris?.normal || cardData.image_uris?.small || 
                     (cardData.images ? cardData.images.small || cardData.images.large : null) ||
                     'https://via.placeholder.com/300x420?text=No+Image';
    document.getElementById('enhanced-card-image').src = imageUrl;
    
    document.getElementById('enhanced-card-set').textContent = cardData.set_name || 'Unknown Set';
    document.getElementById('enhanced-card-number').textContent = cardData.collector_number || 'N/A';

    // Setup finish options
    const foilOption = document.getElementById('enhanced-foil-option');
    const foilLabelEl = document.getElementById('enhanced-foil-label');
    const foilPrice = cardData.prices?.usd_foil || 0;
    
    if (foilPrice > 0) {
        foilOption.classList.remove('hidden');
        foilLabelEl.textContent = foilLabel;
    } else {
        foilOption.classList.add('hidden');
    }

    // Reset selections
    document.querySelector('input[name="enhanced-finish"][value="normal"]').checked = true;
    document.getElementById('enhanced-condition-select').value = 'near_mint';
    document.getElementById('enhanced-quantity').value = '1';

    // Update prices and show modal
    updateEnhancedCardPrice();
    
    const modal = document.getElementById('enhanced-card-modal');
    modal.classList.remove('hidden');
}

function hideEnhancedCardModal() {
    const modal = document.getElementById('enhanced-card-modal');
    modal.classList.add('hidden');
    currentEnhancedCard = null;
}

function updateEnhancedCardPrice() {
    if (!currentEnhancedCard) return;

    const isfoil = document.querySelector('input[name="enhanced-finish"]:checked').value === 'foil';
    const condition = document.getElementById('enhanced-condition-select').value;
    const quantity = parseInt(document.getElementById('enhanced-quantity').value) || 1;

    const normalBasePrice = currentEnhancedCard.prices?.usd || 0;
    const foilBasePrice = currentEnhancedCard.prices?.usd_foil || 0;
    const basePrice = isfoil ? foilBasePrice : normalBasePrice;
    
    const conditionMultiplier = CARD_CONDITIONS[condition]?.multiplier || 1.0;
    const adjustedPrice = basePrice * conditionMultiplier;
    const totalPrice = adjustedPrice * quantity;

    // Update price displays
    const normalPriceEl = document.getElementById('enhanced-normal-price');
    const foilPriceEl = document.getElementById('enhanced-foil-price');
    const totalPriceEl = document.getElementById('enhanced-total-price');

    if (normalPriceEl && normalBasePrice > 0) {
        const normalConditionPrice = normalBasePrice * conditionMultiplier;
        normalPriceEl.textContent = currencyConvertAndFormat ? 
            currencyConvertAndFormat({ usd: normalConditionPrice }) : 
            `$${normalConditionPrice.toFixed(2)}`;
    }

    if (foilPriceEl && foilBasePrice > 0) {
        const foilConditionPrice = foilBasePrice * conditionMultiplier;
        foilPriceEl.textContent = currencyConvertAndFormat ? 
            currencyConvertAndFormat({ usd: foilConditionPrice }) : 
            `$${foilConditionPrice.toFixed(2)}`;
    }

    if (totalPriceEl) {
        totalPriceEl.textContent = currencyConvertAndFormat ? 
            currencyConvertAndFormat({ usd: totalPrice }) : 
            `$${totalPrice.toFixed(2)}`;
    }

    // Update foil indicator
    updateEnhancedFoilIndicator(isfoil);
}

function updateEnhancedFoilIndicator(isfoil) {
    if (!currentEnhancedCard) return;

    const indicator = document.getElementById('enhanced-foil-indicator');
    const cardImage = document.getElementById('enhanced-card-image');
    const isPokemon = currentEnhancedCard.game === 'pokemon' || currentEnhancedCard.set_name?.toLowerCase().includes('pokemon');
    const foilLabel = isPokemon ? 'Holo' : 'Foil';

    if (isfoil && (currentEnhancedCard.prices?.usd_foil || 0) > 0) {
        indicator.innerHTML = `
            <div class="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                <i class="fas fa-star mr-1"></i>${foilLabel}
            </div>
        `;
        indicator.classList.remove('hidden');
        cardImage.classList.add('foil-effect');
    } else {
        indicator.classList.add('hidden');
        cardImage.classList.remove('foil-effect');
    }
}

async function addEnhancedCardToList(listType) {
    if (!currentEnhancedCard) return;

    const isfoil = document.querySelector('input[name="enhanced-finish"]:checked').value === 'foil';
    const condition = document.getElementById('enhanced-condition-select').value;
    const quantity = parseInt(document.getElementById('enhanced-quantity').value) || 1;

    const normalBasePrice = currentEnhancedCard.prices?.usd || 0;
    const foilBasePrice = currentEnhancedCard.prices?.usd_foil || 0;
    const basePrice = isfoil ? foilBasePrice : normalBasePrice;
    const conditionMultiplier = CARD_CONDITIONS[condition]?.multiplier || 1.0;
    const adjustedPrice = basePrice * conditionMultiplier;

    // Create enhanced card data
    const enhancedCardData = {
        ...currentEnhancedCard,
        is_foil: isfoil,
        condition: condition,
        quantity: quantity,
        prices: {
            ...currentEnhancedCard.prices,
            usd: adjustedPrice
        },
        date_added: new Date().toISOString()
    };

    try {
        // Close the enhanced modal first
        hideEnhancedCardModal();
        
        // Close the search modal
        const searchModal = document.getElementById('search-modal');
        if (searchModal) {
            searchModal.classList.add('hidden');
        }
        
        // Use the existing UI system to populate and show the card modal
        if (window.UI && window.UI.populateCardModalForAdd) {
            window.UI.populateCardModalForAdd(enhancedCardData);
        }
        
        // Show success message
        showEnhancedToast(`Card prepared for adding to ${listType}!`, 'success');
        
    } catch (error) {
        console.error(`Error preparing card for ${listType}:`, error);
        showEnhancedToast(`Failed to prepare card for ${listType}`, 'error');
    }
}

function showEnhancedToast(message, type = 'info') {
    // Use existing toast system if available
    if (window.UI && window.UI.showToast) {
        window.UI.showToast(message, type);
        return;
    }

    // Fallback toast implementation
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg text-white shadow-lg transition-all duration-300 transform translate-x-full`;
    
    const colors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600',
        warning: 'bg-yellow-600'
    };
    
    toast.classList.add(colors[type] || colors.info);
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.remove('translate-x-full'), 10);
    
    // Animate out and remove
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

console.log('Collection Search Integration: Loaded successfully');
