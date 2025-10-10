/**
 * Card Data Types and Utilities
 * Provides standardized data structures and utility functions for card handling
 */

/**
 * Standardized card data structure used throughout the application
 * @typedef {Object} StandardizedCard
 * @property {string} id - Unique identifier from source API
 * @property {string} name - Exact card name
 * @property {'lorcana'|'pokemon'|'gundam'|'mtg'} game - Game identifier
 * @property {string} setName - Full set name
 * @property {string} [setCode] - Set abbreviation/code
 * @property {string} [setId] - Set identifier
 * @property {string} imageUrl - Primary card image URL
 * @property {Object} [imageUrls] - Alternative image sizes
 * @property {string} [imageUrls.small] - Small image URL
 * @property {string} [imageUrls.normal] - Normal image URL
 * @property {string} [imageUrls.large] - Large image URL
 * @property {string} [type] - Card type (creature, spell, etc.)
 * @property {string} [rarity] - Card rarity
 * @property {string} [collectorNumber] - Collector number within set
 * @property {string[]} searchTerms - Normalized search terms
 * @property {boolean} exactMatch - Whether this was an exact name match
 * @property {'scrydx'} sourceApi - Source API used
 * @property {Date} lastUpdated - When data was fetched
 */

/**
 * Match result with confidence scoring
 * @typedef {Object} MatchResult
 * @property {StandardizedCard} card - The matched card
 * @property {'exact'|'fuzzy'|'partial'} matchType - Type of match
 * @property {number} confidence - Confidence score (0-100)
 * @property {string[]} matchedTerms - Which search terms matched
 */

/**
 * Post card data structure for Firestore storage
 * @typedef {Object} PostCardData
 * @property {string} cardName - Card name
 * @property {string} cardSet - Set name
 * @property {string} cardGame - Game identifier
 * @property {string} cardImageUrl - Image URL
 * @property {string} [cardId] - Card ID
 * @property {string} [cardType] - Card type
 * @property {string} [cardRarity] - Card rarity
 * @property {string} [setCode] - Set code
 * @property {boolean} dataComplete - All required fields present
 * @property {Date} lastValidated - When card data was last verified
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
export function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,     // deletion
                matrix[j - 1][i] + 1,     // insertion
                matrix[j - 1][i - 1] + indicator // substitution
            );
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Calculate similarity percentage between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity percentage (0-100)
 */
export function calculateSimilarity(a, b) {
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 100;
    
    const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
    return Math.round(((maxLength - distance) / maxLength) * 100);
}

/**
 * Normalize a string for search comparison
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
export function normalizeForSearch(str) {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ');   // Normalize whitespace
}

/**
 * Generate search terms for a card name
 * @param {string} cardName - Card name
 * @returns {string[]} Array of search terms
 */
export function generateSearchTerms(cardName) {
    const normalized = normalizeForSearch(cardName);
    const terms = [normalized];
    
    // Add individual words
    const words = normalized.split(' ').filter(word => word.length > 2);
    terms.push(...words);
    
    // Add partial combinations for multi-word names
    if (words.length > 1) {
        for (let i = 0; i < words.length - 1; i++) {
            terms.push(words.slice(i, i + 2).join(' '));
        }
    }
    
    return [...new Set(terms)]; // Remove duplicates
}

/**
 * Calculate match confidence for a card against a search query
 * @param {StandardizedCard} card - Card to evaluate
 * @param {string} query - Search query
 * @returns {number} Confidence score (0-100)
 */
export function calculateMatchConfidence(card, query) {
    const normalizedQuery = normalizeForSearch(query);
    const normalizedCardName = normalizeForSearch(card.name);
    
    // Exact match gets highest score
    if (normalizedCardName === normalizedQuery) {
        return 100;
    }
    
    // Check if query is contained in card name
    if (normalizedCardName.includes(normalizedQuery)) {
        const containmentScore = (normalizedQuery.length / normalizedCardName.length) * 90;
        return Math.max(containmentScore, 75); // Minimum 75 for containment
    }
    
    // Calculate similarity score
    const similarity = calculateSimilarity(normalizedCardName, normalizedQuery);
    
    // Check search terms for partial matches
    let bestTermMatch = 0;
    for (const term of card.searchTerms) {
        const termSimilarity = calculateSimilarity(term, normalizedQuery);
        bestTermMatch = Math.max(bestTermMatch, termSimilarity);
    }
    
    return Math.max(similarity, bestTermMatch);
}

/**
 * Determine match type based on confidence score
 * @param {number} confidence - Confidence score
 * @param {string} cardName - Card name
 * @param {string} query - Search query
 * @returns {'exact'|'fuzzy'|'partial'|'poor'} Match type
 */
export function determineMatchType(confidence, cardName, query) {
    const normalizedCardName = normalizeForSearch(cardName);
    const normalizedQuery = normalizeForSearch(query);
    
    if (normalizedCardName === normalizedQuery) {
        return 'exact';
    }
    
    if (confidence >= 85) {
        return 'fuzzy';
    }
    
    if (confidence >= 70) {
        return 'partial';
    }
    
    return 'poor';
}

/**
 * Validate that a card has all required fields
 * @param {StandardizedCard} card - Card to validate
 * @returns {boolean} True if card is valid
 */
export function validateCard(card) {
    const requiredFields = ['id', 'name', 'game', 'setName', 'imageUrl'];
    
    for (const field of requiredFields) {
        if (!card[field] || (typeof card[field] === 'string' && card[field].trim() === '')) {
            console.warn(`Card validation failed: missing or empty field '${field}'`, card);
            return false;
        }
    }
    
    // Validate game is one of supported games
    const supportedGames = ['lorcana', 'pokemon', 'gundam', 'mtg'];
    if (!supportedGames.includes(card.game)) {
        console.warn(`Card validation failed: unsupported game '${card.game}'`, card);
        return false;
    }
    
    return true;
}

/**
 * Create a PostCardData object from a StandardizedCard
 * @param {StandardizedCard} card - Source card
 * @returns {PostCardData} Post card data
 */
export function createPostCardData(card) {
    return {
        cardName: card.name,
        cardSet: card.setName,
        cardGame: card.game,
        cardImageUrl: card.imageUrl,
        cardId: card.id,
        cardType: card.type,
        cardRarity: card.rarity,
        setCode: card.setCode,
        dataComplete: validateCard(card),
        lastValidated: new Date()
    };
}

/**
 * Get game display information
 * @param {string} game - Game identifier
 * @returns {Object} Game display info
 */
export function getGameInfo(game) {
    const gameMap = {
        'lorcana': {
            name: 'Lorcana',
            displayName: 'Disney Lorcana',
            bgColor: 'bg-purple-100 dark:bg-purple-800',
            textColor: 'text-purple-800 dark:text-purple-100',
            priority: 1
        },
        'pokemon': {
            name: 'Pokémon',
            displayName: 'Pokémon TCG',
            bgColor: 'bg-yellow-100 dark:bg-yellow-800',
            textColor: 'text-yellow-800 dark:text-yellow-100',
            priority: 2
        },
        'gundam': {
            name: 'Gundam',
            displayName: 'Gundam Card Game',
            bgColor: 'bg-red-100 dark:bg-red-800',
            textColor: 'text-red-800 dark:text-red-100',
            priority: 3
        },
        'mtg': {
            name: 'Magic',
            displayName: 'Magic: The Gathering',
            bgColor: 'bg-blue-100 dark:bg-blue-800',
            textColor: 'text-blue-800 dark:text-blue-100',
            priority: 4
        }
    };
    
    return gameMap[game] || {
        name: 'Unknown',
        displayName: 'Unknown Game',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        textColor: 'text-gray-800 dark:text-gray-100',
        priority: 999
    };
}

/**
 * Sort cards by relevance for search results
 * @param {MatchResult[]} results - Array of match results
 * @returns {MatchResult[]} Sorted results
 */
export function sortCardsByRelevance(results) {
    return results.sort((a, b) => {
        // First by match type priority
        const matchTypePriority = { exact: 0, fuzzy: 1, partial: 2, poor: 3 };
        const aTypePriority = matchTypePriority[a.matchType] || 999;
        const bTypePriority = matchTypePriority[b.matchType] || 999;
        
        if (aTypePriority !== bTypePriority) {
            return aTypePriority - bTypePriority;
        }
        
        // Then by confidence score
        if (a.confidence !== b.confidence) {
            return b.confidence - a.confidence;
        }
        
        // Then by game priority
        const aGameInfo = getGameInfo(a.card.game);
        const bGameInfo = getGameInfo(b.card.game);
        
        if (aGameInfo.priority !== bGameInfo.priority) {
            return aGameInfo.priority - bGameInfo.priority;
        }
        
        // Finally by name alphabetically
        return a.card.name.localeCompare(b.card.name);
    });
}

/**
 * Filter results to remove poor matches
 * @param {MatchResult[]} results - Array of match results
 * @param {number} minConfidence - Minimum confidence threshold (default: 70)
 * @returns {MatchResult[]} Filtered results
 */
export function filterPoorMatches(results, minConfidence = 70) {
    return results.filter(result => {
        // Always include exact matches
        if (result.matchType === 'exact') {
            return true;
        }
        
        // Filter by confidence threshold
        return result.confidence >= minConfidence;
    });
}
