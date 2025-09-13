/**
 * utils.js - A collection of shared helper functions.
 */

/**
 * Shows a notification message on the screen.
 * @param {string} message The message to display.
 * @param {string} [type='info'] 'info', 'success', or 'error'.
 */
export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const typeClasses = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        info: 'bg-blue-500 text-white'
    };
    const iconClasses = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    notification.className = `fixed top-20 right-4 z-[1002] p-4 rounded-lg shadow-lg max-w-sm ${typeClasses[type] || typeClasses.info}`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${iconClasses[type] || iconClasses.info} mr-3"></i>
            <span>${message}</span>
        </div>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

/**
 * Gets the correct image URL for any card from Scryfall or Pokemon TCG data.
 * @param {object} cardData The full card data object.
 * @param {string} [size='normal'] The desired image size.
 * @returns {string} The URL of the card image or a placeholder.
 */
export function getCardImageUrl(cardData, size = 'normal') {
    if (!cardData) return 'https://placehold.co/223x310/cccccc/969696?text=No+Data';

    if (cardData.productType === 'sealed') {
        const imageMap = {
            'booster_box': 'https://placehold.co/223x310/4F46E5/FFFFFF?text=Booster+Box',
            'booster_pack': 'https://placehold.co/223x310/059669/FFFFFF?text=Booster+Pack',
            'bundle': 'https://placehold.co/223x310/DC2626/FFFFFF?text=Bundle',
        };
        return imageMap[cardData.sealedType] || 'https://placehold.co/223x310/6B7280/FFFFFF?text=Sealed';
    }

    if (cardData.customImageUrl) return cardData.customImageUrl;
    if (cardData.image_uris) return cardData.image_uris[size] || cardData.image_uris.normal;
    if (cardData.card_faces) return cardData.card_faces[0].image_uris[size] || cardData.card_faces[0].image_uris.normal;
    if (cardData.images) return cardData.images.large || cardData.images.small;
    if (cardData.imageUrl) return cardData.imageUrl;
    
    const cardName = cardData?.name || 'Unknown';
    const encodedName = encodeURIComponent(cardName.substring(0, 20));
    return `https://placehold.co/223x310/cccccc/969696?text=${encodedName}`;
}


/**
 * Safely converts a price using the global converter, with a fallback.
 * @param {number} value The price in USD.
 * @returns {string} The formatted price string.
 */
export function safeFormatPrice(value) {
    if (window.HatakeSocial && typeof window.HatakeSocial.convertAndFormatPrice === 'function') {
        return window.HatakeSocial.convertAndFormatPrice(value, 'USD');
    }
    const price = Number(value);
    if (isNaN(price)) return '$0.00 USD';
    return `$${price.toFixed(2)} USD`;
}


/**
 * Debounce function to limit the rate at which a function gets called.
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
