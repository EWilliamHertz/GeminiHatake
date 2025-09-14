/**
 * Card Display Module
 * Handles card rendering, image loading, and display functionality
 */

/**
 * Enhanced image URL function with better fallbacks
 */
function getCardImageUrl(cardData, size = 'normal') {
    if (!cardData) {
        return 'https://placehold.co/223x310/cccccc/969696?text=No+Data';
    }

    // Handle sealed products
    if (cardData.productType === 'sealed') {
        return getDefaultSealedProductImage(cardData.sealedType || 'booster_box');
    }

    // Handle custom uploaded images first
    if (cardData.customImageUrl) {
        return cardData.customImageUrl;
    }

    // Handle legacy imageUrl field
    if (cardData.imageUrl) {
        return cardData.imageUrl;
    }

    // Handle Pokémon TCG cards
    if (cardData?.tcg === 'Pokémon' || cardData?.game === 'Pokémon') {
        if (cardData.images) {
            if (size === 'small' && cardData.images.small) return cardData.images.small;
            if (size === 'large' && cardData.images.large) return cardData.images.large;
            return cardData.images.large || cardData.images.small || cardData.images.normal;
        }
    }

    // Handle double-faced cards (card_faces structure)
    if (cardData.card_faces && Array.isArray(cardData.card_faces) && cardData.card_faces.length > 0) {
        const firstFace = cardData.card_faces[0];
        if (firstFace.image_uris && typeof firstFace.image_uris === 'object') {
            if (firstFace.image_uris[size]) return firstFace.image_uris[size];
            return firstFace.image_uris.normal || firstFace.image_uris.large || firstFace.image_uris.small;
        }
    }

    // Handle single-faced cards (standard image_uris structure)
    if (cardData.image_uris && typeof cardData.image_uris === 'object') {
        if (cardData.image_uris[size]) return cardData.image_uris[size];
        return cardData.image_uris.normal || cardData.image_uris.large || cardData.image_uris.small;
    }

    // Handle Scryfall ID-based fallback
    if (cardData.id && typeof cardData.id === 'string') {
        return `https://cards.scryfall.io/${size}/front/${cardData.id.charAt(0)}/${cardData.id.charAt(1)}/${cardData.id}.jpg`;
    }

    // Final fallback
    const cardName = cardData?.name || 'Unknown';
    const encodedName = encodeURIComponent(cardName.substring(0, 20));
    return `https://placehold.co/223x310/cccccc/969696?text=${encodedName}`;
}

/**
 * Get default image for sealed products
 */
function getDefaultSealedProductImage(type) {
    const imageMap = {
        'booster_box': 'https://placehold.co/200x280/4F46E5/FFFFFF?text=Booster+Box',
        'booster_pack': 'https://placehold.co/200x280/059669/FFFFFF?text=Booster+Pack',
        'bundle': 'https://placehold.co/200x280/DC2626/FFFFFF?text=Bundle',
        'prerelease_kit': 'https://placehold.co/200x280/7C2D12/FFFFFF?text=Prerelease+Kit',
        'commander_deck': 'https://placehold.co/200x280/1F2937/FFFFFF?text=Commander+Deck',
        'starter_deck': 'https://placehold.co/200x280/374151/FFFFFF?text=Starter+Deck',
        'collector_booster': 'https://placehold.co/200x280/7C3AED/FFFFFF?text=Collector+Booster',
        'draft_booster': 'https://placehold.co/200x280/059669/FFFFFF?text=Draft+Booster',
        'set_booster': 'https://placehold.co/200x280/0891B2/FFFFFF?text=Set+Booster',
        'theme_booster': 'https://placehold.co/200x280/EA580C/FFFFFF?text=Theme+Booster'
    };
    return imageMap[type] || 'https://placehold.co/200x280/6B7280/FFFFFF?text=Sealed+Product';
}

/**
 * Create card element for grid view
 */
function createCardElement(item, bulkMode = false, selectedItems = new Set()) {
    const div = document.createElement('div');
    div.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer relative';
    div.dataset.itemId = item.id;
    
    const imageUrl = getCardImageUrl(item);
    const price = item.prices?.usd || item.price || 0;
    const quantity = item.quantity || 1;
    
    const bulkCheckbox = bulkMode ? `
        <div class="absolute top-2 left-2 z-10">
            <input type="checkbox" class="item-checkbox w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" 
                   data-item-id="${item.id}" onchange="window.CollectionApp.toggleItemSelection('${item.id}')" 
                   ${selectedItems.has(item.id) ? 'checked' : ''}>
        </div>
    ` : '';
    
    div.innerHTML = `
        ${bulkCheckbox}
        <div class="relative">
            <img src="${imageUrl}" alt="${item.name}" class="w-full h-48 object-cover" 
                 onerror="this.src='https://placehold.co/223x310/cccccc/969696?text=No+Image'">
            ${item.isFoil ? '<div class="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs">Foil</div>' : ''}
            ${quantity > 1 ? `<div class="absolute ${bulkMode ? 'top-8' : 'top-2'} ${bulkMode ? 'left-2' : 'left-2'} bg-blue-500 text-white px-2 py-1 rounded text-xs">${quantity}x</div>` : ''}
            ${item.forSale ? '<div class="absolute bottom-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">For Sale</div>' : ''}
        </div>
        <div class="p-3">
            <h3 class="font-semibold text-sm mb-1 truncate">${item.name}</h3>
            <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">${item.set_name || item.setName || 'Unknown Set'}</p>
            <p class="text-xs text-gray-500 dark:text-gray-500">${item.condition || 'Near Mint'}</p>
            <p class="text-sm font-bold text-green-600 mt-2">${window.Utils.safeFormatPrice(price)}</p>
        </div>
    `;
    
    // Add click handlers
    if (!bulkMode) {
        div.addEventListener('click', () => window.CardModal.openCardModal(item));
    } else {
        div.addEventListener('click', (e) => {
            if (!e.target.classList.contains('item-checkbox')) {
                window.CollectionApp.toggleItemSelection(item.id);
            }
        });
    }
    
    return div;
}

/**
 * Create list element for list view
 */
function createListElement(item, bulkMode = false, selectedItems = new Set()) {
    const div = document.createElement('div');
    div.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex items-center space-x-4 hover:shadow-lg transition-shadow cursor-pointer relative';
    div.dataset.itemId = item.id;
    
    const imageUrl = getCardImageUrl(item);
    const price = item.prices?.usd || item.price || 0;
    const quantity = item.quantity || 1;
    
    const bulkCheckbox = bulkMode ? `
        <input type="checkbox" class="item-checkbox w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 mr-4" 
               data-item-id="${item.id}" onchange="window.CollectionApp.toggleItemSelection('${item.id}')" 
               ${selectedItems.has(item.id) ? 'checked' : ''}>
    ` : '';
    
    div.innerHTML = `
        ${bulkCheckbox}
        <img src="${imageUrl}" alt="${item.name}" class="w-16 h-20 object-cover rounded" 
             onerror="this.src='https://placehold.co/223x310/cccccc/969696?text=No+Image'">
        <div class="flex-1">
            <h3 class="font-semibold text-lg">${item.name}</h3>
            <p class="text-gray-600 dark:text-gray-400">${item.set_name || item.setName || 'Unknown Set'}</p>
            <p class="text-sm text-gray-500">${item.condition || 'Near Mint'} • ${quantity}x ${item.isFoil ? '• Foil' : ''} ${item.forSale ? '• For Sale' : ''}</p>
        </div>
        <div class="text-right">
            <p class="text-lg font-bold text-green-600">${window.Utils.safeFormatPrice(price)}</p>
        </div>
    `;
    
    // Add click handlers
    if (!bulkMode) {
        div.addEventListener('click', () => window.CardModal.openCardModal(item));
    } else {
        div.addEventListener('click', (e) => {
            if (!e.target.classList.contains('item-checkbox')) {
                window.CollectionApp.toggleItemSelection(item.id);
            }
        });
    }
    
    return div;
}

// Export functions
window.CardDisplay = {
    getCardImageUrl,
    getDefaultSealedProductImage,
    createCardElement,
    createListElement
};

