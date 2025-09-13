/**
 * ui.js - Handles all DOM rendering and manipulation for the collection page.
 */
import { getCardImageUrl, safeFormatPrice } from './utils.js';

export function renderGridView(container, collection, { bulkEditMode, selectedCards }, handlers) {
    if (!container) return;
    
    container.innerHTML = '';
    if (collection.length === 0) {
        container.innerHTML = `<p class="text-center p-4 text-gray-500 dark:text-gray-400 col-span-full">No cards found.</p>`;
        return;
    }
    
    collection.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card-container';
        cardEl.dataset.id = card.id;

        const forSaleIndicator = card.forSale ? 'border-4 border-green-500' : 'border-4 border-transparent';
        const isSelected = selectedCards.has(card.id);
        const checkboxOverlay = bulkEditMode ? `<div class="bulk-checkbox-overlay absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-3xl ${isSelected ? '' : 'hidden'}"><i class="fas fa-check-circle"></i></div>` : '';
        const price = card.isFoil ? card.priceUsdFoil : card.priceUsd;
        const priceTagHTML = price ? `<div class="absolute top-1.5 left-1.5 bg-black bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">${safeFormatPrice(price)}</div>` : '';
        const quantityBadge = `<div class="absolute top-1.5 right-1.5 bg-gray-900 bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">x${card.quantity || 1}</div>`;

        cardEl.innerHTML = `
            <div class="relative group cursor-pointer">
                <img src="${getCardImageUrl(card, 'normal')}" alt="${card.name}" class="rounded-lg shadow-md w-full ${forSaleIndicator}" onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                ${quantityBadge}
                ${priceTagHTML}
                ${checkboxOverlay}
                <div class="card-actions absolute bottom-0 right-0 p-1 bg-black bg-opacity-50 rounded-tl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="edit-card-btn text-white text-xs p-1" data-id="${card.id}" data-list="collection" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="delete-card-btn text-white text-xs p-1 ml-1" data-id="${card.id}" data-list="collection" title="Delete"><i class="fas fa-trash"></i></button>
                    <button class="manage-listing-btn text-white text-xs p-1 ml-1" data-id="${card.id}" data-list="collection" title="Manage Listing"><i class="fas fa-tags"></i></button>
                </div>
            </div>`;
        
        cardEl.addEventListener('click', (e) => handlers.onCardClick(e, card.id));
        container.appendChild(cardEl);
    });
}

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
}
