window.CardDisplay = (() => {

    function initialize() {} 

    function renderGridView(container, collection) {
        if (!container) return;
        container.classList.remove('hidden');
        document.getElementById('collection-table-view')?.classList.add('hidden');
        
        container.innerHTML = '';
        if (collection.length === 0) {
            container.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400 col-span-full">Your collection is empty.</p>`;
            return;
        }
        
        collection.forEach(item => {
            container.appendChild(createCardElement(item));
        });
    }

    function renderListView(container, collection) {
        if (!container) return;
        container.classList.remove('hidden');
        document.getElementById('collection-grid-view')?.classList.add('hidden');

        if (collection.length === 0) {
            container.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400">Your collection is empty.</p>`;
            return;
        }

        let tableHTML = `
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Set</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">`;

        collection.forEach(card => {
            const priceUsd = parseFloat(card.priceUsd) || 0;
            const formattedPrice = priceUsd > 0 ? window.Utils.safeFormatPrice(priceUsd) : 'N/A';
            tableHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700" data-id="${card.id}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${card.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${card.setName || 'Unknown'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${card.quantity || 1}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${formattedPrice}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium" data-list="collection">
                        <button class="text-blue-600 hover:text-blue-900 mr-2 edit-card-btn" data-id="${card.id}">Edit</button>
                        <button class="text-red-600 hover:text-red-900 delete-card-btn" data-id="${card.id}">Delete</button>
                    </td>
                </tr>`;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    }

    function renderWishlist(container, wishlistItems) {
        if (!container) return;
        container.innerHTML = '';
        if (wishlistItems.length === 0) {
            container.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400 col-span-full">Your wishlist is empty.</p>`;
            return;
        }
        wishlistItems.forEach(card => {
            container.appendChild(createCardElement(card, 'wishlist'));
        });
    }
    
    function createCardElement(item, listType = 'collection') {
        const cardEl = document.createElement('div');
        cardEl.className = 'relative group cursor-pointer';
        cardEl.dataset.id = item.id;
        
        const bulkMode = window.BulkOperations.isBulkEditMode();
        const selectedCards = window.BulkOperations.getSelectedCards();
        const isSelected = selectedCards.has(item.id);

        const forSaleIndicator = item.forSale ? 'border-4 border-green-500' : '';
        const checkboxOverlay = bulkMode ? `<div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-3xl ${isSelected ? '' : 'hidden'}"><i class="fas fa-check-circle"></i></div>` : '';
        const price = item.isFoil ? item.priceUsdFoil : item.priceUsd;
        const priceTagHTML = price ? `<div class="absolute top-1.5 left-1.5 bg-black bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">${window.Utils.safeFormatPrice(price)}</div>` : '';
        const quantityBadge = `<div class="absolute top-1.5 right-1.5 bg-gray-900 bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">x${item.quantity || 1}</div>`;

        cardEl.innerHTML = `
            <div class="relative">
                <img src="${getCardImageUrl(item, 'normal')}" alt="${item.name}" class="rounded-lg shadow-md w-full ${forSaleIndicator}" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                ${quantityBadge}
                ${checkboxOverlay}
            </div>
            ${priceTagHTML}
            <div class="card-actions absolute bottom-0 right-0 p-1 bg-black bg-opacity-50 rounded-tl-lg opacity-0 group-hover:opacity-100 transition-opacity" data-list="${listType}">
                <button class="edit-card-btn text-white text-xs p-1" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="delete-card-btn text-white text-xs p-1 ml-1" title="Delete"><i class="fas fa-trash"></i></button>
            </div>`;
        
        return cardEl;
    }

    function getCardImageUrl(cardData, size = 'normal') {
        if (!cardData) return 'https://placehold.co/223x310?text=No+Data';
        if (cardData.image_uris) return cardData.image_uris[size] || cardData.image_uris.normal;
        if (cardData.images) return cardData.images.large || cardData.images.small;
        if (cardData.card_faces) return cardData.card_faces[0].image_uris[size] || cardData.card_faces[0].image_uris.normal;
        return 'https://placehold.co/223x310?text=No+Image';
    }

    return {
        initialize,
        renderGridView,
        renderListView,
        renderWishlist,
        getCardImageUrl
    };

})();

