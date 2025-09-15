/**
 * ui.js
 * Handles all DOM manipulation, rendering, and UI updates for the collection page.
 */
import { getCardImageUrl, formatPrice } from './utils.js';
import * as Collection from './collection.js';
import * as API from './api.js';

// --- ELEMENT SELECTORS ---
const getElement = (id) => document.getElementById(id);
const display = getElement('collection-display');
const searchModal = getElement('search-modal');
const cardModal = getElement('card-modal');
const csvModal = getElement('csv-import-modal');
const bulkListModal = getElement('bulk-list-sale-modal');

// --- RENDER FUNCTIONS ---

/**
 * Renders the collection in a grid format.
 * @param {Array} cards - Array of card objects to render.
 * @param {string} activeTab - 'collection' or 'wishlist'.
 */
export function renderGridView(cards, activeTab) {
    if (!cards || cards.length === 0) {
        showEmptyState(activeTab === 'collection' ? "No cards match your filters." : "Your wishlist is empty.");
        return;
    }
    const isBulkMode = Collection.getState().bulkEdit.isActive;

    const gridHTML = cards.map(card => {
        const imageUrl = getCardImageUrl(card);
        const price = formatPrice(card?.prices?.usd, 'USD'); // Assuming USD price from Scryfall
        const isSelected = Collection.getState().bulkEdit.selected.has(card.id);

        return `
            <div class="card-container relative group" data-id="${card.id}">
                <img src="${imageUrl}" alt="${card.name}" class="rounded-lg shadow-md w-full transition-transform transform group-hover:scale-105">
                <div class="absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                    <div class="text-white text-center p-2">
                        <p class="font-bold">${card.name}</p>
                        <p class="text-sm">${card.set_name}</p>
                    </div>
                </div>
                 ${isBulkMode ? `
                    <div class="absolute top-2 right-2">
                        <input type="checkbox" class="bulk-select-checkbox h-6 w-6" data-id="${card.id}" ${isSelected ? 'checked' : ''}>
                    </div>` : `
                    <div class="absolute top-2 right-2 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button data-action="edit" class="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-lg"><i class="fas fa-pencil-alt"></i></button>
                        <button data-action="delete" class="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"><i class="fas fa-trash"></i></button>
                    </div>`
                }
                <div class="absolute bottom-0 left-0 bg-gray-800 bg-opacity-75 text-white text-xs w-full p-1 rounded-b-lg flex justify-between">
                    <span>Qty: ${card.quantity || 1}</span>
                    <span>${price}</span>
                </div>
            </div>
        `;
    }).join('');

    display.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">${gridHTML}</div>`;
}

/**
 * Renders the collection in a list (table) format.
 * @param {Array} cards - Array of card objects to render.
 * @param {string} activeTab - 'collection' or 'wishlist'.
 */
export function renderListView(cards, activeTab) {
    if (!cards || cards.length === 0) {
        showEmptyState(activeTab === 'collection' ? "No cards match your filters." : "Your wishlist is empty.");
        return;
    }
    const isBulkMode = Collection.getState().bulkEdit.isActive;

    const tableHeader = `
        <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
                ${isBulkMode ? '<th class="p-3 text-left text-xs font-medium uppercase tracking-wider"><input type="checkbox" id="bulk-select-all"></th>' : ''}
                <th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Name</th>
                <th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Set</th>
                <th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Quantity</th>
                <th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Condition</th>
                <th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Price</th>
                ${!isBulkMode ? '<th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>' : ''}
            </tr>
        </thead>
    `;

    const tableBody = cards.map(card => {
         const price = formatPrice(card?.prices?.usd, 'USD');
         const isSelected = Collection.getState().bulkEdit.selected.has(card.id);
        return `
            <tr class="card-container border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600/50" data-id="${card.id}">
                ${isBulkMode ? `<td class="p-3"><input type="checkbox" class="bulk-select-checkbox h-4 w-4" data-id="${card.id}" ${isSelected ? 'checked' : ''}></td>` : ''}
                <td class="p-3 font-medium">${card.name} ${card.is_foil ? '<i class="fas fa-star text-yellow-400"></i>' : ''}</td>
                <td class="p-3 text-sm text-gray-500 dark:text-gray-400">${card.set_name}</td>
                <td class="p-3">${card.quantity || 1}</td>
                <td class="p-3">${card.condition || 'N/A'}</td>
                <td class="p-3">${price}</td>
                ${!isBulkMode ? `
                    <td class="p-3">
                        <div class="flex space-x-2">
                            <button data-action="edit" class="text-blue-500 hover:text-blue-700"><i class="fas fa-pencil-alt"></i></button>
                            <button data-action="delete" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>` : ''
                }
            </tr>
        `;
    }).join('');

    display.innerHTML = `<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">${tableHeader}<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">${tableBody}</tbody></table>`;
}

/**
 * Renders search results in the search modal.
 * @param {Array|null} results - Array of card data from API.
 * @param {string} context - The game ('mtg', 'pokemon') or a message string.
 */
export function renderSearchResults(results, context) {
    const container = getElement('search-results-container');
    if (results === null) {
        container.innerHTML = `<p class="text-center text-gray-500">${context}</p>`;
        return;
    }
    if (results.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500">No cards found.</p>`;
        return;
    }

    const resultsHTML = results.map(card => {
        const imageUrl = getCardImageUrl(card);
        const price = formatPrice(card?.prices?.usd, 'USD');
        const cardDataString = encodeURIComponent(JSON.stringify(card));

        return `
            <div class="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer search-result-item" data-card='${cardDataString}'>
                <img src="${imageUrl}" alt="${card.name}" class="w-16 h-22 object-contain mr-4 rounded-md">
                <div class="flex-grow">
                    <p class="font-semibold">${card.name}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${card.set_name} (${card.set.toUpperCase()})</p>
                </div>
                <div class="text-right">
                    <p class="font-mono">${price}</p>
                    <p class="text-sm capitalize text-gray-500">${card.rarity}</p>
                </div>
            </div>
        `;
    }).join('');
    container.innerHTML = resultsHTML;

    // Add event listeners to new results
    document.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const cardData = JSON.parse(decodeURIComponent(item.dataset.card));
            closeSearchModal();
            populateCardModalForAdd(cardData);
        });
    });
}


// --- UI STATE UPDATES ---

export const showLoadingState = () => display.innerHTML = '<p class="text-center text-gray-500">Loading your collection...</p>';
export const showLoggedOutState = () => display.innerHTML = '<p class="text-center text-gray-500">Please log in to manage your collection.</p>';
export const showEmptyState = (message) => display.innerHTML = `<p class="text-center text-gray-500">${message}</p>`;

export function updateStats(stats) {
    getElement('stats-total-cards').textContent = stats.totalCards;
    getElement('stats-unique-cards').textContent = stats.uniqueCards;
    getElement('stats-total-value').textContent = formatPrice(stats.totalValue, 'USD');
}

export function populateFilters(sets, rarities) {
    const setFilter = getElement('filter-set');
    const rarityFilter = getElement('filter-rarity');

    // Preserve current selection
    const currentSet = setFilter.value;
    const currentRarity = rarityFilter.value;

    setFilter.innerHTML = '<option value="">All Sets</option>' + sets.map(s => `<option value="${s}">${s}</option>`).join('');
    rarityFilter.innerHTML = '<option value="">All Rarities</option>' + rarities.map(r => `<option value="${r}">${r}</option>`).join('');
    
    setFilter.value = currentSet;
    rarityFilter.value = currentRarity;
}

export function updateViewToggle(view) {
    const gridBtn = getElement('view-toggle-grid');
    const listBtn = getElement('view-toggle-list');
    if (view === 'grid') {
        gridBtn.classList.add('bg-white', 'dark:bg-gray-900', 'shadow');
        gridBtn.classList.remove('text-gray-500', 'dark:text-gray-400');
        listBtn.classList.remove('bg-white', 'dark:bg-gray-900', 'shadow');
        listBtn.classList.add('text-gray-500', 'dark:text-gray-400');
    } else {
        listBtn.classList.add('bg-white', 'dark:bg-gray-900', 'shadow');
        listBtn.classList.remove('text-gray-500', 'dark:text-gray-400');
        gridBtn.classList.remove('bg-white', 'dark:bg-gray-900', 'shadow');
        gridBtn.classList.add('text-gray-500', 'dark:text-gray-400');
    }
}

export function updateActiveTab(tab) {
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
}

export function updateColorFilterSelection(selectedColors) {
    const colorIcons = document.querySelectorAll('#filter-colors i');
    colorIcons.forEach(icon => {
        const color = icon.dataset.color;
        if (selectedColors.includes(color)) {
            icon.classList.remove('text-gray-400');
            switch(color) {
                case 'W': icon.classList.add('text-yellow-200'); break;
                case 'U': icon.classList.add('text-blue-500'); break;
                case 'B': icon.classList.add('text-black'); break;
                case 'R': icon.classList.add('text-red-500'); break;
                case 'G': icon.classList.add('text-green-500'); break;
                case 'C': icon.classList.add('text-gray-500'); break;
            }
        } else {
            icon.className = 'fas cursor-pointer text-gray-400'; // Reset classes
            // Re-add specific icon class
            switch(color) {
                case 'W': icon.classList.add('fa-circle'); break;
                case 'U': icon.classList.add('fa-tint'); break;
                case 'B': icon.classList.add('fa-skull'); break;
                case 'R': icon.classList.add('fa-fire'); break;
                case 'G': icon.classList.add('fa-leaf'); break;
                case 'C': icon.classList.add('fa-gem'); break;
            }
        }
    });
}


// --- MODAL MANAGEMENT ---

const openModal = (modal) => { modal.classList.remove('hidden'); modal.classList.add('flex'); }
const closeModal = (modal) => { modal.classList.add('hidden'); modal.classList.remove('flex'); }

// Search Modal
export function openSearchModal(query = '') {
    getElement('card-search-input').value = query;
    getElement('search-results-container').innerHTML = '<p class="text-center text-gray-500">Search results will appear here.</p>';
    openModal(searchModal);
    getElement('card-search-input').focus();
}
export const closeSearchModal = () => closeModal(searchModal);

// Add/Edit Card Modal
export const openCardModal = () => openModal(cardModal);
export const closeCardModal = () => {
    getElement('card-form').reset();
    getElement('list-for-sale-section').classList.add('hidden');
    closeModal(cardModal);
};

export function populateCardModalForAdd(cardData) {
    Collection.setCurrentEditingCard(cardData); // Store original API data
    getElement('card-modal-id').value = ''; // Ensure no ID for new cards
    getElement('card-modal-title').textContent = cardData.name;
    getElement('card-modal-subtitle').textContent = `${cardData.set_name} (${cardData.set.toUpperCase()})`;
    getElement('card-modal-image').src = getCardImageUrl(cardData);
    getElement('save-card-btn').textContent = "Add to Collection";
    openCardModal();
}

export function populateCardModalForEdit(cardData, listForSale = false) {
    Collection.setCurrentEditingCard(cardData); // Store full card data for reference
    getElement('card-modal-id').value = cardData.id;
    getElement('card-modal-title').textContent = `Editing: ${cardData.name}`;
    getElement('card-modal-subtitle').textContent = `${cardData.set_name} (${cardData.set.toUpperCase()})`;
    getElement('card-modal-image').src = getCardImageUrl(cardData);
    
    // Populate form fields
    getElement('card-quantity').value = cardData.quantity || 1;
    getElement('card-condition').value = cardData.condition || 'Near Mint';
    getElement('card-language').value = cardData.language || 'English';
    getElement('card-purchase-price').value = cardData.purchasePrice || '';
    getElement('card-is-foil').checked = cardData.is_foil || false;
    getElement('card-is-signed').checked = cardData.is_signed || false;
    getElement('card-is-altered').checked = cardData.is_altered || false;

    // Handle 'for sale' section
    const forSaleToggle = getElement('list-for-sale-toggle');
    const forSaleSection = getElement('list-for-sale-section');
    const salePriceInput = getElement('card-sale-price');

    if (cardData.forSale || listForSale) {
        forSaleToggle.checked = true;
        forSaleSection.classList.remove('hidden');
        salePriceInput.value = cardData.salePrice || '';
    } else {
        forSaleToggle.checked = false;
        forSaleSection.classList.add('hidden');
        salePriceInput.value = '';
    }
    
    getElement('save-card-btn').textContent = "Save Changes";
    openCardModal();
}

export function getCardFormData() {
    const id = getElement('card-modal-id').value;
    const forSale = getElement('list-for-sale-toggle').checked;
    
    // Get original API data stored when modal was opened
    const originalApiData = Collection.getCurrentEditingCard();
    if (!originalApiData) throw new Error("Could not find original card data.");
    
    const data = {
        ...originalApiData, // Base data from Scryfall/Pokemon API
        quantity: parseInt(getElement('card-quantity').value, 10),
        condition: getElement('card-condition').value,
        language: getElement('card-language').value,
        purchasePrice: parseFloat(getElement('card-purchase-price').value) || null,
        is_foil: getElement('card-is-foil').checked,
        is_signed: getElement('card-is-signed').checked,
        is_altered: getElement('card-is-altered').checked,
        forSale: forSale,
        salePrice: forSale ? (parseFloat(getElement('card-sale-price').value) || null) : null,
        addedAt: id ? originalApiData.addedAt : new Date().toISOString() // Preserve original add date
    };

    const customImageFile = getElement('custom-image-upload').files[0] || null;

    return { id, data, customImageFile };
}

export const toggleListForSaleSection = () => getElement('list-for-sale-section').classList.toggle('hidden');

// CSV Modal
export const openCsvImportModal = () => openModal(csvModal);
export const closeCsvImportModal = () => {
    getElement('csv-file-input').value = '';
    getElement('csv-import-status').textContent = 'Awaiting file...';
    closeModal(csvModal);
};
export const updateCsvImportStatus = (message) => {
    const statusEl = getElement('csv-import-status');
    statusEl.innerHTML += message + '<br>';
    statusEl.scrollTop = statusEl.scrollHeight; // Auto-scroll
};

// Bulk List Sale Modal
export function openBulkListSaleModal(count) {
    getElement('bulk-list-count').textContent = count;
    openModal(bulkListModal);
}
export const closeBulkListSaleModal = () => {
    getElement('bulk-list-form').reset();
    toggleBulkPriceInputs(); // Reset to default state
    closeModal(bulkListModal);
};

export function toggleBulkPriceInputs() {
    const isPercentage = getElement('bulk-list-form').elements['price-option'].value === 'percentage';
    getElement('bulk-price-percentage').disabled = !isPercentage;
    getElement('bulk-price-fixed').disabled = isPercentage;
}