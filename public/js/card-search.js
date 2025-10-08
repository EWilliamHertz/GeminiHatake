/**
 * card-search.js
 * Multi-game card search functionality using scrydex API
 * Supports Lorcana, Pokemon, Gundam, and Magic: The Gathering
 * Search order: lorcana -> pokemon -> gundam -> magic
 */

// Import the searchCards function from api.js
import { searchCards } from './modules/api.js';

/**
 * Search for cards across multiple games using scrydex
 * @param {string} query - The card name to search for
 * @param {number} limit - Maximum number of results per game (default: 5)
 * @returns {Promise<Array>} Array of card objects with game information
 */
export async function searchCardsMultiGame(query, limit = 5) {
    if (!query || query.length < 2) {
        return [];
    }

    const games = ['lorcana', 'pokemon', 'gundam', 'mtg'];
    const allResults = [];

    for (const game of games) {
        try {
            console.log(`[CardSearch] Searching ${game} for: "${query}"`);
            const result = await searchCards(query, game, 1, limit);
            
            if (result && result.cards && result.cards.length > 0) {
                // Add game info and limit results
                const gameResults = result.cards.slice(0, limit).map(card => ({
                    ...card,
                    game: game,
                    displayName: card.name,
                    searchSource: 'scrydex'
                }));
                
                allResults.push(...gameResults);
                console.log(`[CardSearch] Found ${gameResults.length} results in ${game}`);
            }
        } catch (error) {
            console.error(`[CardSearch] Error searching ${game}:`, error);
            // Continue with other games even if one fails
        }
    }

    // Sort results by relevance (exact matches first, then partial matches)
    const queryLower = query.toLowerCase();
    return allResults.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        // Exact matches first
        if (aName === queryLower && bName !== queryLower) return -1;
        if (bName === queryLower && aName !== queryLower) return 1;
        
        // Then matches that start with the query
        if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
        if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;
        
        // Finally alphabetical order
        return aName.localeCompare(bName);
    });
}

/**
 * Create autocomplete suggestions for card names
 * @param {string} query - The partial card name
 * @param {HTMLElement} suggestionsContainer - Container to display suggestions
 * @param {Function} onSelect - Callback when a card is selected
 */
export async function createCardAutocomplete(query, suggestionsContainer, onSelect) {
    if (!query || query.length < 2) {
        suggestionsContainer.classList.add('hidden');
        return;
    }

    try {
        const cards = await searchCardsMultiGame(query, 7);
        
        suggestionsContainer.innerHTML = '';
        
        if (cards.length > 0) {
            suggestionsContainer.classList.remove('hidden');
            
            cards.forEach(card => {
                const suggestionEl = document.createElement('div');
                suggestionEl.className = 'p-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800 text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 last:border-b-0';
                
                // Create game badge
                const gameBadge = getGameBadge(card.game);
                
                suggestionEl.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="font-medium">${escapeHtml(card.name)}</span>
                        ${gameBadge}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        ${escapeHtml(card.set_name || 'Unknown Set')}
                    </div>
                `;
                
                suggestionEl.addEventListener('click', () => {
                    onSelect(card);
                    suggestionsContainer.classList.add('hidden');
                });
                
                suggestionsContainer.appendChild(suggestionEl);
            });
        } else {
            suggestionsContainer.classList.add('hidden');
        }
    } catch (error) {
        console.error('[CardSearch] Error creating autocomplete:', error);
        suggestionsContainer.classList.add('hidden');
    }
}

/**
 * Get a colored badge for the game type
 * @param {string} game - The game identifier
 * @returns {string} HTML for the game badge
 */
function getGameBadge(game) {
    const badges = {
        'lorcana': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100">Lorcana</span>',
        'pokemon': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">Pokémon</span>',
        'gundam': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">Gundam</span>',
        'mtg': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">Magic</span>'
    };
    
    return badges[game] || '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">Unknown</span>';
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Generate card link URL based on game
 * @param {Object} card - Card object with game and name
 * @returns {string} URL for the card view
 */
export function getCardViewUrl(card) {
    const params = new URLSearchParams({
        name: card.name,
        game: card.game
    });
    
    return `card-view.html?${params.toString()}`;
}

/**
 * Format card name for display in posts
 * @param {Object} card - Card object
 * @returns {string} Formatted card name with game context if needed
 */
export function formatCardForPost(card) {
    // For common card names that might exist in multiple games,
    // include the game context
    const commonNames = ['Charizard', 'Pikachu', 'Lightning Bolt', 'Counterspell'];
    
    if (commonNames.some(name => card.name.toLowerCase().includes(name.toLowerCase()))) {
        return `${card.name} (${getGameDisplayName(card.game)})`;
    }
    
    return card.name;
}

/**
 * Get display name for game
 * @param {string} game - Game identifier
 * @returns {string} Display name
 */
function getGameDisplayName(game) {
    const names = {
        'lorcana': 'Lorcana',
        'pokemon': 'Pokémon',
        'gundam': 'Gundam',
        'mtg': 'Magic'
    };
    
    return names[game] || game;
}
