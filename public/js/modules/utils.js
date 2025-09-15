/**
 * utils.js
 * Contains reusable utility and helper functions.
 */

/**
 * A robust function to get the correct image URL for a card object from any API.
 * Handles different data structures from Scryfall, Pokémon TCG API, and custom uploads.
 * @param {object} cardData The card object.
 * @returns {string} The URL of the card image.
 */
export function getCardImageUrl(cardData) {
    if (!cardData) return 'https://placehold.co/300x420?text=No+Image';

    // 1. Prioritize custom uploaded image
    if (cardData.customImageUrl) {
        return cardData.customImageUrl;
    }

    // 2. Scryfall (Magic: The Gathering)
    if (cardData.image_uris && cardData.image_uris.normal) {
        return cardData.image_uris.normal;
    }
    // Handle multi-faced cards from Scryfall
    if (cardData.card_faces && cardData.card_faces[0].image_uris && cardData.card_faces[0].image_uris.normal) {
        return cardData.card_faces[0].image_uris.normal;
    }

    // 3. Pokémon TCG API
    if (cardData.images && cardData.images.large) {
        return cardData.images.large;
    }

    // 4. Fallback placeholder
    return 'https://placehold.co/300x420?text=Image+Not+Found';
}

/**
 * Creates a debounced function that delays invoking `func` until after `delay` milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * @param {Function} func The function to debounce.
 * @param {number} delay The number of milliseconds to delay.
 * @returns {Function} Returns the new debounced function.
 */
export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * Formats a price value with a currency symbol.
 * This is a simplified version; it can be expanded to use the global HatakeSocial object.
 * @param {number|null|undefined} price The numerical price value.
 * @param {string} currency The currency code (e.g., 'USD').
 * @returns {string} The formatted price string (e.g., "$12.34").
 */
export function formatPrice(price, currency = 'USD') {
    if (price === null || typeof price === 'undefined') {
        return '-';
    }
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(price);
    } catch (e) {
        // Fallback for invalid currency codes
        return `${price.toFixed(2)} ${currency}`;
    }
}