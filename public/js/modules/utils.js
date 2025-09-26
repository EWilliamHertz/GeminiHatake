/**
 * utils.js
 * Contains helper and utility functions for data transformation and formatting.
 */

/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * @param {Function} func The function to debounce.
 * @param {number} wait The number of milliseconds to delay.
 * @returns {Function} Returns the new debounced function.
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Transforms a Scryfall card object into the app's standard format.
 * @param {object} scryfallCard - The raw card object from the Scryfall API.
 * @returns {object} A standardized card object.
 */
export function transformScryfallCard(scryfallCard) {
    return {
        api_id: scryfallCard.id,
        name: scryfallCard.name,
        set: scryfallCard.set,
        set_name: scryfallCard.set_name,
        rarity: scryfallCard.rarity,
        image_uris: scryfallCard.image_uris,
        prices: {
            usd: scryfallCard.prices?.usd || null,
            usd_foil: scryfallCard.prices?.usd_foil || null,
        },
        purchasePrice: 0,
        collector_number: scryfallCard.collector_number,
        color_identity: scryfallCard.color_identity,
        type_line: scryfallCard.type_line,
        game: 'mtg',
    };
}


/**
 * Transforms a Pokémon TCG API card object into the app's standard format.
 * This function is now robust and safely handles missing data.
 * @param {object} pokemonCard - The raw card object from the Pokémon TCG API.
 * @returns {object} A standardized card object.
 */
export function transformPokemonCard(pokemonCard) {
    const prices = pokemonCard.tcgplayer?.prices || {};
    const normalPrice = prices?.normal?.market
        || prices?.unlimited?.market
        || prices?.holofoil?.market
        || null;
    const foilPrice = prices?.holofoil?.market
        || prices?.reverseHolofoil?.market
        || prices?.["1stEditionHolofoil"]?.market
        || null;

    const image_uris = {
        small: pokemonCard.images?.small || '',
        normal: pokemonCard.images?.large || '',
        large: pokemonCard.images?.large || '',
        art_crop: pokemonCard.images?.large || '',
    };

    return {
        api_id: pokemonCard.id,
        name: pokemonCard.name,
        set: pokemonCard.set.id,
        set_name: pokemonCard.set.name,
        rarity: pokemonCard.rarity || 'Common',
        image_uris: image_uris,
        // Keep the original images object for backward compatibility with saved cards
        images: pokemonCard.images,
        prices: {
            usd: normalPrice,
            usd_foil: foilPrice,
        },
        purchasePrice: 0,
        collector_number: pokemonCard.number,
        type_line: pokemonCard.supertype + (pokemonCard.subtypes ? ` - ${pokemonCard.subtypes.join(' ')}` : ''),
        game: 'pokemon',
    };
}

/**
 * Gets a reliable image URL from a card object, supporting both old and new data structures.
 * @param {object} card - The card object.
 * @returns {string} The URL for the card image.
 */
export function getCardImageUrl(card) {
    if (card && card.customImageUrl) {
        return card.customImageUrl;
    }
    // The cleanScryDexData function now creates the 'image_uris.normal' property. This is the new standard path.
    if (card && card.image_uris && card.image_uris.normal) {
        return card.image_uris.normal;
    }
    // Fallback for Scryfall multi-faced cards which have a different structure
    if (card && card.card_faces && card.card_faces[0].image_uris && card.card_faces[0].image_uris.normal) {
        return card.card_faces[0].image_uris.normal;
    }
    // Final fallback for any other legacy data structures
    if (card && card.image_uris) {
        return card.image_uris;
    }
    return 'images/placeholder.png'; // A default placeholder image
}


/**
 * Formats a price string.
 * @param {number|string|null} price - The price to format.
 * @param {string} currency - The currency code (e.g., 'USD').
 * @returns {string} The formatted price string (e.g., '$1.23').
 */
export function formatPrice(price, currency = 'USD') {
    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice)) {
        return 'N/A';
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(numericPrice);
}