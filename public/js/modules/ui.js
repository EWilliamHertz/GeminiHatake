/**
 * ui.js - Handles all DOM rendering and manipulation for the collection page.
 */
import { getCardImageUrl, safeFormatPrice } from './utils.js';

// --- VIEW RENDERING ---

export function renderGridView(container, collection, state, handlers) {
    if (!container) return;
    container.classList.remove('hidden');
    document.getElementById('collection-table-view')?.classList.add('hidden');
    
    container.innerHTML = '';
    if (collection.length === 0) {
        container.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400 col-span-full">No cards found.</p>`;
        return;
    }
    
    collection.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'relative group cursor-pointer';
        cardEl.dataset.id = card.id;

        const forSaleIndicator = card.forSale ? 'border-4 border-green-500' : '';
        const isSelected = state.selectedCards.has(card.id);
        const checkboxOverlay = state.bulkEditMode ? `<div class="bulk-checkbox-overlay absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-3xl ${isSelected ? '' : 'hidden'}"><i class="fas fa-check-circle"></i></div>` : '';
        const price = card.isFoil ? card.priceUsdFoil : card.priceUsd;
        const priceTagHTML = price ? `<div class="absolute top-1.5 left-1.5 bg-black bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">${safeFormatPrice(price)}</div>` : '';
        const quantityBadge = `<div class="absolute top-1.5 right-1.5 bg-gray-900 bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">x${card.quantity || 1}</div>`;

        cardEl.innerHTML = `
            <div class="relative">
                <img src="${getCardImageUrl(card, 'normal')}" alt="${card.name}" class="rounded-lg shadow-md w-full ${forSaleIndicator}" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                ${quantityBadge}
                ${checkboxOverlay}
            </div>
            ${priceTagHTML}
            <div class="card-actions absolute bottom-0 right-0 p-1 bg-black bg-opacity-50 rounded-tl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <button class="edit-card-btn text-white text-xs p-1" data-id="${card.id}" data-list="collection" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="delete-card-btn text-white text-xs p-1 ml-1" data-id="${card.id}" data-list="collection" title="Delete"><i class="fas fa-trash"></i></button>
                <button class="manage-listing-btn text-white text-xs p-1 ml-1" data-id="${card.id}" data-list="collection" title="Manage Listing"><i class="fas fa-tags"></i></button>
            </div>`;
        
        cardEl.addEventListener('click', (e) => handlers.onCardClick(e, card.id, card));
        container.appendChild(cardEl);
    });
}

export function renderListView(container, collection, handlers) {
    if (!container) return;
    container.classList.remove('hidden');
    document.getElementById('collection-grid-view')?.classList.add('hidden');

    if (collection.length === 0) {
        container.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400">No cards match your filters.</p>`;
        return;
    }

    let tableHTML = `
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Set</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Price</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">`;

    collection.forEach(card => {
        const priceUsd = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
        const formattedPrice = priceUsd > 0 ? safeFormatPrice(priceUsd) : 'N/A';
        tableHTML += `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" data-card-id="${card.id}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${card.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${card.setName || 'Unknown'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${card.quantity || 1}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${formattedPrice}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-blue-600 hover:text-blue-900 mr-2 edit-card-btn" data-id="${card.id}" data-list="collection">Edit</button>
                    <button class="text-red-600 hover:text-red-900 mr-2 delete-card-btn" data-id="${card.id}" data-list="collection">Delete</button>
                    <button class="text-green-600 hover:text-green-900 manage-listing-btn" data-id="${card.id}" data-list="collection">List</button>
                </td>
            </tr>`;
    });
    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
    
    // Add listeners after rendering
    container.querySelectorAll('tr[data-card-id]').forEach(row => {
        row.addEventListener('click', e => {
            if (!e.target.closest('button')) {
                const card = collection.find(c => c.id === row.dataset.cardId);
                if (card) handlers.onCardClick(e, card.id, card);
            }
        });
    });
}

export function renderWishlist(container, wishlistItems, handlers) {
    if (!container) return;
    if (wishlistItems.length === 0) {
        container.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400 col-span-full">Your wishlist is empty.</p>`;
        return;
    }
    container.innerHTML = '';
    wishlistItems.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'relative group cursor-pointer';
        cardEl.dataset.id = card.id;
        cardEl.innerHTML = `
            <img src="${getCardImageUrl(card, 'normal')}" alt="${card.name}" class="rounded-lg shadow-md w-full" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
            <div class="card-actions absolute top-0 right-0 p-1 bg-black bg-opacity-50 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <button class="edit-card-btn text-white text-xs" data-id="${card.id}" data-list="wishlist"><i class="fas fa-edit"></i></button>
                <button class="delete-card-btn text-white text-xs ml-1" data-id="${card.id}" data-list="wishlist"><i class="fas fa-trash"></i></button>
            </div>
        `;
        cardEl.addEventListener('click', (e) => handlers.onCardClick(e, card.id, card));
        container.appendChild(cardEl);
    });
}


// --- UI STATE AND STATS ---

export function updateSelectedCount(element, count) {
    if (element) {
        element.textContent = `${count} cards selected`;
    }
}

export function populateFilters(selectElement, collection) {
    if (!selectElement) return;
    const sets = [...new Set(collection.map(card => card.setName).filter(Boolean))].sort();
    selectElement.innerHTML = '<option value="all">All Sets</option>';
    sets.forEach(setName => {
        const option = document.createElement('option');
        option.value = setName;
        option.textContent = setName;
        selectElement.appendChild(option);
    });
}

export function calculateAndDisplayStats(collection) {
    let totalCards = 0;
    let totalValue = 0;
    collection.forEach(card => {
        const quantity = card.quantity || 1;
        totalCards += quantity;
        const price = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
        totalValue += price * quantity;
    });

    document.getElementById('stats-total-cards').textContent = totalCards;
    document.getElementById('stats-unique-cards').textContent = new Set(collection.map(c => c.name)).size;
    document.getElementById('stats-total-value').textContent = safeFormatPrice(totalValue);
    // Rarity breakdown logic can be added here if needed
}

// --- MODALS AND DYNAMIC UI ---

export function openCardManagementModal(card, existingData, handlers) {
    const existingModal = document.getElementById('card-management-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'card-management-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    // Use the same modal for adding a new card and editing an existing one
    // The `existingData` object determines if it's an edit or a new card
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div class="flex justify-between items-center p-4 border-b dark:border-gray-700">
                <h2 class="text-xl font-bold dark:text-white">${existingData ? 'Edit Card' : 'Add Card'}</h2>
                <button class="close-modal text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">&times;</button>
            </div>
            <div class="p-6 overflow-y-auto">
                </div>
            <div class="flex justify-end p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <button class="cancel-btn px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 mr-2">Cancel</button>
                <button class="save-btn px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Save Changes</button>
            </div>
        </div>
    `;

    const formContainer = modal.querySelector('.p-6');
    populateAddEditForm(formContainer, card, existingData);

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.close-modal').addEventListener('click', closeModal);
    modal.querySelector('.cancel-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    modal.querySelector('.save-btn').addEventListener('click', () => {
        const formData = getFormData(formContainer);
        handlers.onSave(card, formData, existingData?.id);
        closeModal();
    });
}

function populateAddEditForm(container, card, data) {
    // `card` has the scryfall data, `data` has the user's saved data (if it exists)
    container.innerHTML = `
        <div class="flex items-center space-x-4 mb-4">
            <img class="w-24 rounded-lg" src="${getCardImageUrl(card, 'normal')}">
            <div>
                <h3 class="text-lg font-bold dark:text-white">${card.name}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">${card.setName}</p>
            </div>
        </div>
        <div class="space-y-4">
            <div>
                <label class="block font-bold mb-1 dark:text-gray-200">Add to:</label>
                <select id="form-list-select" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                    <option value="collection" ${data?.listType === 'collection' || !data ? 'selected' : ''}>My Collection</option>
                    <option value="wishlist" ${data?.listType === 'wishlist' ? 'selected' : ''}>My Wishlist</option>
                </select>
            </div>
            <div>
                <label class="block font-bold mb-1 dark:text-gray-200">Quantity</label>
                <input id="form-quantity" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" min="1" type="number" value="${data?.quantity || 1}">
            </div>
            <div>
                <label class="block font-bold mb-1 dark:text-gray-200">Condition</label>
                <select id="form-condition" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                    <option>Near Mint</option>
                    <option>Lightly Played</option>
                    <option>Moderately Played</option>
                    <option>Heavily Played</option>
                    <option>Damaged</option>
                </select>
            </div>
                <div class="flex items-center">
                    <input id="form-foil" class="mr-2 h-4 w-4 rounded text-blue-600 focus:ring-blue-500" type="checkbox" ${data?.isFoil ? 'checked' : ''}>
                    <label class="dark:text-gray-300" for="form-foil">Is this card foil?</label>
                </div>
            </div>
    `;
    // Pre-select the condition
    if (data?.condition) {
        container.querySelector('#form-condition').value = data.condition;
    }
}

function getFormData(container) {
    return {
        listType: container.querySelector('#form-list-select').value,
        quantity: parseInt(container.querySelector('#form-quantity').value, 10) || 1,
        condition: container.querySelector('#form-condition').value,
        isFoil: container.querySelector('#form-foil').checked,
        // Get other form values
    };
}


export function renderManualSearchResults(container, cards, onAdd) {
    if (!cards || cards.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500">No cards found.</p>';
        return;
    }
    container.innerHTML = cards.map(card => `
        <div class="flex items-center justify-between p-2 border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">
            <div class="flex items-center">
                <img src="${card.imageUrl}" class="w-10 h-14 object-cover rounded-sm mr-3">
                <div>
                    <p class="font-semibold">${card.name}</p>
                    <p class="text-xs text-gray-500">${card.setName}</p>
                </div>
            </div>
            <button class="add-manual-btn text-blue-500 hover:text-blue-700" data-card='${JSON.stringify(card)}'>
                <i class="fas fa-plus-circle text-xl"></i>
            </button>
        </div>
    `).join('');

    container.querySelectorAll('.add-manual-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cardData = JSON.parse(btn.dataset.card);
            onAdd(cardData);
        });
    });
}