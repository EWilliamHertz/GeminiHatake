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
    // Let the original click handler work, but enhance the card data with pricing info
    document.addEventListener('click', function(e) {
        const searchItem = e.target.closest('.search-result-item.enhanced');
        if (searchItem) {
            // Don't prevent default - let the original handler work
            try {
                const cardData = JSON.parse(searchItem.dataset.card);
                // Add enhanced pricing info to the card data for the original modal
                enhanceCardDataForOriginalModal(cardData);
            } catch (error) {
                console.error('Error enhancing card data:', error);
            }
        }
    });
}

function enhanceCardDataForOriginalModal(cardData) {
    // This function enhances the card data with condition-based pricing
    // but lets the original modal handle the display
    
    // Add enhanced pricing information to the card data
    if (cardData.prices) {
        const normalPrice = cardData.prices.usd || 0;
        const foilPrice = cardData.prices.usd_foil || 0;
        
        // Add condition-based pricing
        cardData.conditionPricing = {};
        Object.entries(CARD_CONDITIONS).forEach(([key, condition]) => {
            cardData.conditionPricing[key] = {
                normal: normalPrice * condition.multiplier,
                foil: foilPrice * condition.multiplier,
                label: condition.label
            };
        });
        
        // Add foil availability flag
        cardData.hasFoil = foilPrice > 0;
        cardData.isPokemon = cardData.game === 'pokemon' || cardData.set_name?.toLowerCase().includes('pokemon');
        
        // Update the market price display in the modal
        updateMarketPriceDisplay(cardData);
    }
    
    console.log('Enhanced card data for original modal:', cardData);
}

function updateMarketPriceDisplay(cardData) {
    // Wait a bit for the modal to be populated, then update prices
    setTimeout(() => {
        const normalPriceValue = document.getElementById('normal-price-value');
        const foilPriceValue = document.getElementById('foil-price-value');
        const foilPriceDisplay = document.getElementById('foil-price-display');
        const foilLabelText = document.getElementById('foil-label-text');
        
        if (!normalPriceValue || !foilPriceValue) return;
        
        const normalPrice = cardData.prices?.usd || 0;
        const foilPrice = cardData.prices?.usd_foil || 0;
        
        // Update normal price
        if (normalPrice > 0) {
            const formattedNormal = currencyConvertAndFormat ? 
                currencyConvertAndFormat({ usd: normalPrice }) : 
                `$${normalPrice.toFixed(2)}`;
            normalPriceValue.textContent = formattedNormal;
        } else {
            normalPriceValue.textContent = 'N/A';
        }
        
        // Update foil price and label
        if (foilPrice > 0) {
            const formattedFoil = currencyConvertAndFormat ? 
                currencyConvertAndFormat({ usd: foilPrice }) : 
                `$${foilPrice.toFixed(2)}`;
            foilPriceValue.textContent = formattedFoil;
            foilPriceDisplay.style.opacity = '1';
        } else {
            foilPriceValue.textContent = 'N/A';
            foilPriceDisplay.style.opacity = '0.5';
        }
        
        // Set correct foil/holo label
        if (foilLabelText) {
            const isPokemon = cardData.game === 'pokemon' || cardData.set_name?.toLowerCase().includes('pokemon');
            foilLabelText.textContent = isPokemon ? 'Holo' : 'Foil';
        }
        
        // Set up condition change listener
        setupConditionChangeListener(cardData);
        
        // Update prices based on current condition
        updatePricesForCondition(cardData);
        
    }, 100);
}

function setupConditionChangeListener(cardData) {
    const conditionSelect = document.getElementById('card-condition');
    if (!conditionSelect) return;
    
    // Remove existing listener to avoid duplicates
    conditionSelect.removeEventListener('change', handleConditionChange);
    
    // Add new listener
    function handleConditionChange() {
        updatePricesForCondition(cardData);
    }
    
    conditionSelect.addEventListener('change', handleConditionChange);
}

function updatePricesForCondition(cardData) {
    const conditionSelect = document.getElementById('card-condition');
    const normalConditionPrice = document.getElementById('normal-condition-price');
    const foilConditionPrice = document.getElementById('foil-condition-price');
    const normalPriceValue = document.getElementById('normal-price-value');
    const foilPriceValue = document.getElementById('foil-price-value');
    
    if (!conditionSelect || !cardData.prices) return;
    
    const selectedCondition = conditionSelect.value;
    const conditionKey = Object.keys(CARD_CONDITIONS).find(key => 
        CARD_CONDITIONS[key].label === selectedCondition
    );
    
    if (!conditionKey) return;
    
    const multiplier = CARD_CONDITIONS[conditionKey].multiplier;
    const normalPrice = cardData.prices.usd || 0;
    const foilPrice = cardData.prices.usd_foil || 0;
    
    // Update condition labels
    if (normalConditionPrice) {
        normalConditionPrice.textContent = selectedCondition;
    }
    if (foilConditionPrice) {
        foilConditionPrice.textContent = selectedCondition;
    }
    
    // Update prices with condition multiplier
    if (normalPriceValue && normalPrice > 0) {
        const adjustedNormal = normalPrice * multiplier;
        const formattedNormal = currencyConvertAndFormat ? 
            currencyConvertAndFormat({ usd: adjustedNormal }) : 
            `$${adjustedNormal.toFixed(2)}`;
        normalPriceValue.textContent = formattedNormal;
    }
    
    if (foilPriceValue && foilPrice > 0) {
        const adjustedFoil = foilPrice * multiplier;
        const formattedFoil = currencyConvertAndFormat ? 
            currencyConvertAndFormat({ usd: adjustedFoil }) : 
            `$${adjustedFoil.toFixed(2)}`;
        foilPriceValue.textContent = formattedFoil;
    }
}

// Market price display functionality only - no custom modal needed

console.log('Collection Search Integration: Loaded successfully');
