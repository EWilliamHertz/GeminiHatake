/**
 * Card Search Module for Multi-Game Support - WITH OPTCG
 * Integrates with scrydex for Lorcana, Pokemon, Gundam, and Magic: The Gathering
 * Integrates with OPTCGAPI for One Piece TCG
 * Search order: lorcana -> pokemon -> gundam -> optcg -> mtg
 */

/**
 * Search cards across multiple games using scrydex and OPTCGAPI
 * @param {string} query - The card name to search for
 * @param {number} limit - Maximum number of results per game
 * @returns {Promise<Array>} Array of card objects with game information
 */
export async function searchCardsMultiGame(query, limit = 5) {
    if (!query || query.length < 2) {
        return [];
    }

    // Updated games list to include OPTCG
    const games = ['lorcana', 'pokemon', 'gundam', 'optcg', 'mtg'];
    const allResults = [];

    for (const game of games) {
        try {
            console.log(`[CardSearch] Searching ${game} for: "${query}"`);
            
            if (game === 'optcg') {
                // Use the new searchOPTCG function for One Piece cards
                const searchOPTCGFunction = firebase.functions().httpsCallable('searchOPTCG');
                const result = await searchOPTCGFunction({ query: query });
                
                let searchResults = [];
                if (result && result.data && result.data.success) {
                    searchResults = result.data.data || [];
                }
                
                if (searchResults.length > 0) {
                    // Add game information to each card and limit results
                    const gameResults = searchResults.slice(0, limit).map(card => ({
                        ...card,
                        game: 'optcg',
                        searchSource: 'optcgapi'
                    }));
                    
                    allResults.push(...gameResults);
                    console.log(`[CardSearch] Found ${gameResults.length} results in ${game}`);
                }
            } else {
                // Use the searchScryDex function for other games
                const searchScryDexFunction = firebase.functions().httpsCallable('searchScryDex');
                const result = await searchScryDexFunction({ query: query, game: game });
                
                let searchResults = [];
                if (result && result.data) {
                    if (Array.isArray(result.data.data)) {
                        searchResults = result.data.data;
                    } else if (Array.isArray(result.data)) {
                        searchResults = result.data;
                    } else if (result.data.success && Array.isArray(result.data.cards)) {
                        searchResults = result.data.cards;
                    }
                }
                
                if (searchResults.length > 0) {
                    // Add game information to each card and limit results
                    const gameResults = searchResults.slice(0, limit).map(card => ({
                        ...card,
                        game: game,
                        searchSource: 'scrydex'
                    }));
                    
                    allResults.push(...gameResults);
                    console.log(`[CardSearch] Found ${gameResults.length} results in ${game}`);
                }
            }
        } catch (error) {
            console.error(`[CardSearch] Error searching ${game}:`, error);
            // Continue with other games even if one fails
        }
    }

    // Sort results by relevance (exact matches first, then partial matches)
    const sortedResults = allResults.sort((a, b) => {
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Exact matches first
        if (aName === queryLower && bName !== queryLower) return -1;
        if (bName === queryLower && aName !== queryLower) return 1;
        
        // Then by game priority (lorcana, pokemon, gundam, optcg, mtg)
        const gameOrder = { lorcana: 0, pokemon: 1, gundam: 2, optcg: 3, mtg: 4 };
        const aGamePriority = gameOrder[a.game] || 999;
        const bGamePriority = gameOrder[b.game] || 999;
        
        if (aGamePriority !== bGamePriority) {
            return aGamePriority - bGamePriority;
        }
        
        // Finally by name alphabetically
        return aName.localeCompare(bName);
    });

    console.log(`[CardSearch] Total results found: ${sortedResults.length}`);
    return sortedResults;
}

/**
 * Create autocomplete suggestions for card search
 * @param {string} query - The search query
 * @param {HTMLElement} suggestionsContainer - The container to display suggestions
 * @param {Function} onSelect - Callback when a card is selected
 */
export async function createCardAutocomplete(query, suggestionsContainer, onSelect) {
    try {
        console.log(`[CardAutocomplete] Searching for: "${query}"`);
        
        // Clear previous suggestions
        suggestionsContainer.innerHTML = '';
        
        if (query.length < 2) {
            suggestionsContainer.classList.add('hidden');
            return;
        }
        
        // Search for cards
        const results = await searchCardsMultiGame(query, 7);
        
        if (results.length === 0) {
            suggestionsContainer.classList.add('hidden');
            return;
        }
        
        // Create suggestion elements
        results.forEach(card => {
            const suggestionEl = document.createElement('div');
            suggestionEl.className = 'p-3 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800 text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 last:border-b-0';
            
            // Create game badge
            const gameBadge = getGameBadge(card.game);
            
            suggestionEl.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <div class="font-medium">${card.name}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">${card.set_name || (card.expansion && card.expansion.name) || 'Unknown Set'}</div>
                    </div>
                    <div class="ml-2">
                        ${gameBadge}
                    </div>
                </div>
            `;
            
            suggestionEl.addEventListener('click', () => {
                onSelect(card);
            });
            
            suggestionsContainer.appendChild(suggestionEl);
        });
        
        // Show suggestions
        suggestionsContainer.classList.remove('hidden');
        
    } catch (error) {
        console.error('[CardAutocomplete] Error:', error);
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
        'optcg': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-100">One Piece</span>',
        'mtg': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">Magic</span>'
    };
    
    return badges[game] || '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">Unknown</span>';
}

/**
 * Get display name for a game
 * @param {string} game - The game identifier
 * @returns {string} Human-readable game name
 */
export function getGameDisplayName(game) {
    const names = {
        'lorcana': 'Lorcana',
        'pokemon': 'Pokémon',
        'gundam': 'Gundam',
        'optcg': 'One Piece',
        'mtg': 'Magic: The Gathering'
    };
    
    return names[game] || game;
}

/**
 * Search a specific game for cards
 * @param {string} query - The search query
 * @param {string} game - The game to search
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of card objects
 */
export async function searchSpecificGame(query, game, limit = 10) {
    try {
        console.log(`[CardSearch] Searching specific game ${game} for: "${query}"`);
        
        if (game === 'optcg') {
            // Use searchOPTCG for One Piece
            const searchOPTCGFunction = firebase.functions().httpsCallable('searchOPTCG');
            const result = await searchOPTCGFunction({ query: query });
            
            let searchResults = [];
            if (result && result.data && result.data.success) {
                searchResults = result.data.data || [];
            }
            
            // Add game information and limit results
            return searchResults.slice(0, limit).map(card => ({
                ...card,
                game: 'optcg',
                searchSource: 'optcgapi'
            }));
        } else {
            // Use searchScryDex for other games
            const searchScryDexFunction = firebase.functions().httpsCallable('searchScryDex');
            const result = await searchScryDexFunction({ query: query, game: game });
            
            let searchResults = [];
            if (result && result.data) {
                if (Array.isArray(result.data.data)) {
                    searchResults = result.data.data;
                } else if (Array.isArray(result.data)) {
                    searchResults = result.data;
                } else if (result.data.success && Array.isArray(result.data.cards)) {
                    searchResults = result.data.cards;
                }
            }
            
            // Add game information and limit results
            return searchResults.slice(0, limit).map(card => ({
                ...card,
                game: game,
                searchSource: 'scrydex'
            }));
        }
        
    } catch (error) {
        console.error(`[CardSearch] Error searching ${game}:`, error);
        return [];
    }
}

