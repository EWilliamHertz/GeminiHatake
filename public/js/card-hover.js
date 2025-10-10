/**
 * Card Hover Functionality
 * Provides hover tooltips for card links in posts and comments
 */

let hoverTimeout = null;
let currentTooltip = null;

/**
 * Initialize card hover functionality
 */
export function initCardHover() {
    console.log('[CardHover] Initializing card hover functionality...');
    
    // Use event delegation to handle dynamically added card links
    document.addEventListener('mouseenter', handleCardHover, true);
    document.addEventListener('mouseleave', handleCardLeave, true);
    
    console.log('[CardHover] Card hover functionality initialized');
}

/**
 * Handle mouse enter on card links
 */
function handleCardHover(event) {
    if (!(event.target instanceof Element)) return;
    const cardLink = event.target.closest('.card-link');
    if (!cardLink) return;
    
    const cardName = cardLink.dataset.cardName;
    if (!cardName) return;
    
    // Clear any existing timeout
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
    }
    
    // Set a delay before showing the tooltip
    hoverTimeout = setTimeout(() => {
        showCardTooltip(cardLink, cardName);
    }, 500); // 500ms delay
}

/**
 * Handle mouse leave on card links
 */
function handleCardLeave(event) {
    if (!(event.target instanceof Element)) return;
    const cardLink = event.target.closest('.card-link');
    if (!cardLink) return;
    
    // Clear the timeout
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
    }
    
    // Hide tooltip after a short delay
    setTimeout(() => {
        hideCardTooltip();
    }, 100);
}

/**
 * Show card tooltip with basic card information
 */
async function showCardTooltip(element, cardName) {
    try {
        console.log(`[CardHover] Showing tooltip for: ${cardName}`);
        
        // Remove any existing tooltip
        hideCardTooltip();
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'card-tooltip fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-4 max-w-sm';
        tooltip.innerHTML = `
            <div class="flex items-center space-x-2 mb-2">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span class="text-sm text-gray-600 dark:text-gray-400">Loading ${cardName}...</span>
            </div>
        `;
        
        // Position tooltip
        const rect = element.getBoundingClientRect();
        const tooltipX = Math.min(rect.left, window.innerWidth - 300);
        const tooltipY = rect.bottom + 10;
        
        tooltip.style.left = `${tooltipX}px`;
        tooltip.style.top = `${tooltipY}px`;
        
        document.body.appendChild(tooltip);
        currentTooltip = tooltip;
        
        // Check if we have specific card data from the element's data attributes
        const cardSet = element.dataset.cardSet;
        const cardGame = element.dataset.cardGame;
        
        // Try to fetch card data
        if (typeof firebase.functions === 'function') {
            const searchScryDexFunction = firebase.functions().httpsCallable('searchScryDex');
            let cardFound = false;
            
            // If we have specific set and game info, search that game first
            if (cardSet && cardGame && cardSet !== 'Unknown Set') {
                try {
                    console.log(`[CardHover] Searching specific game ${cardGame} for ${cardName} from ${cardSet}`);
                    const result = await searchScryDexFunction({ query: cardName, game: cardGame });
                    
                    let searchResults = [];
                    if (result && result.data) {
                        if (result.data.success && Array.isArray(result.data.data)) {
                            searchResults = result.data.data;
                        } else if (Array.isArray(result.data)) {
                            searchResults = result.data;
                        }
                    }
                    
                    if (searchResults.length > 0) {
                        // Try to find the card from the specific set first
                        let card = searchResults.find(c => {
                            const cardSetName = c.set_name || (c.expansion && c.expansion.name) || '';
                            return c.name.toLowerCase() === cardName.toLowerCase() && 
                                   cardSetName.toLowerCase() === cardSet.toLowerCase();
                        });
                        
                        // If not found in specific set, use any card with the same name
                        if (!card) {
                            card = searchResults.find(c => c.name.toLowerCase() === cardName.toLowerCase()) || searchResults[0];
                        }
                        
                        if (currentTooltip === tooltip) {
                            updateTooltipContent(tooltip, card, cardGame);
                            cardFound = true;
                        }
                    }
                } catch (error) {
                    console.warn(`[CardHover] Error searching specific game ${cardGame}:`, error);
                }
            }
            
            // If not found with specific data, search all games in priority order
            if (!cardFound) {
                const games = ['lorcana', 'pokemon', 'gundam', 'mtg'];
                
                for (const game of games) {
                    if (cardFound) break;
                    
                    try {
                        const result = await searchScryDexFunction({ query: cardName, game: game });

                        let searchResults = [];
                        if (result && result.data) {
                            if (result.data.success && Array.isArray(result.data.data)) {
                                searchResults = result.data.data;
                            } else if (Array.isArray(result.data)) {
                                searchResults = result.data;
                            }
                        }

                        if (searchResults.length > 0) {
                            const card = searchResults.find(c => c.name.toLowerCase() === cardName.toLowerCase()) || searchResults[0];

                            if (currentTooltip === tooltip) {
                                updateTooltipContent(tooltip, card, game);
                                cardFound = true;
                            }
                            break;
                        }
                    } catch (error) {
                        console.warn(`[CardHover] Error searching ${game}:`, error);
                    }
                }
            }
            
            // If no card found, show not found message
            if (!cardFound && currentTooltip === tooltip) {
                tooltip.innerHTML = `
                    <div class="text-center">
                        <div class="text-gray-500 dark:text-gray-400 mb-2">
                            <i class="fas fa-search text-2xl"></i>
                        </div>
                        <div class="font-medium text-gray-700 dark:text-gray-300">${cardName}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">Card not found</div>
                        <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">Click to search manually</div>
                    </div>
                `;
            }
        } else {
            // Firebase not available
            tooltip.innerHTML = `
                <div class="text-center">
                    <div class="font-medium text-gray-700 dark:text-gray-300">${cardName}</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">Click to view card</div>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('[CardHover] Error showing tooltip:', error);
        hideCardTooltip();
    }
}

/**
 * Update tooltip content with card data
 */
function updateTooltipContent(tooltip, card, game) {
    const gameInfo = getGameInfo(game);
    let cardImage = card.image_url || card.image || '';
if (!cardImage && card.image_uris) {
    cardImage = card.image_uris.normal || card.image_uris.small || '';
}
if (!cardImage && card.images && card.images.length > 0) {
    cardImage = card.images[0].medium || card.images[0].small || '';
}
    
    tooltip.innerHTML = `
        <div class="flex space-x-3">
            ${cardImage ? `
                <div class="flex-shrink-0">
                    <img src="${cardImage}" alt="${card.name}" class="w-16 h-22 object-cover rounded border">
                </div>
            ` : ''}
            <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 dark:text-gray-100 truncate">${card.name}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">${card.set_name || 'Unknown Set'}</div>
                <div class="mt-1">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${gameInfo.bgColor} ${gameInfo.textColor}">
                        ${gameInfo.name}
                    </span>
                </div>
                ${card.type ? `<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${card.type}</div>` : ''}
                <div class="text-xs text-gray-400 dark:text-gray-500 mt-2">Click to view details</div>
            </div>
        </div>
    `;
}

/**
 * Get game information for styling
 */
function getGameInfo(game) {
    const gameMap = {
        'lorcana': {
            name: 'Lorcana',
            bgColor: 'bg-purple-100 dark:bg-purple-800',
            textColor: 'text-purple-800 dark:text-purple-100'
        },
        'pokemon': {
            name: 'Pokémon',
            bgColor: 'bg-yellow-100 dark:bg-yellow-800',
            textColor: 'text-yellow-800 dark:text-yellow-100'
        },
        'gundam': {
            name: 'Gundam',
            bgColor: 'bg-red-100 dark:bg-red-800',
            textColor: 'text-red-800 dark:text-red-100'
        },
        'mtg': {
            name: 'Magic',
            bgColor: 'bg-blue-100 dark:bg-blue-800',
            textColor: 'text-blue-800 dark:text-blue-100'
        }
    };
    
    return gameMap[game] || {
        name: 'Unknown',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        textColor: 'text-gray-800 dark:text-gray-100'
    };
}

/**
 * Hide card tooltip
 */
function hideCardTooltip() {
    if (currentTooltip) {
        currentTooltip.remove();
        currentTooltip = null;
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCardHover);
} else {
    initCardHover();
}
