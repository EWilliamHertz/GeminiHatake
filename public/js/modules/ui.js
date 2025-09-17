/**
 * ui.js
 * Handles all DOM manipulation, rendering, and UI updates for the collection page.
 */
import { getCardImageUrl, formatPrice } from './utils.js';
import * as Collection from './collection.js';
import * as Currency from './currency.js';

// --- ELEMENT SELECTORS ---
const getElement = (id) => document.getElementById(id);
const display = getElement('collection-display');
const searchModal = getElement('search-modal');
const cardModal = getElement('card-modal');
const csvModal = getElement('csv-import-modal');
const bulkListModal = getElement('bulk-list-sale-modal');
const cardPreviewTooltip = getElement('card-preview-tooltip');

// --- NOTIFICATIONS ---
export const showToast = (message, type = 'info') => {
    const container = getElement('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${iconClass} toast-icon"></i> <p>${message}</p>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 100);
    setTimeout(() => { toast.classList.remove('show'); toast.addEventListener('transitionend', () => toast.remove()); }, 5000);
};

// --- CURRENCY INTEGRATION FUNCTIONS ---

/**
 * Format and display prices with currency conversion
 * @param {number} price - The price to format
 * @param {boolean} isFromApi - Whether the price comes from external API (USD) or marketplace (SEK)
 * @returns {string} Formatted price string
 */
export function displayPrice(price, isFromApi = false) {
    if (isFromApi) {
        // Price from external APIs like Scryfall/Pokemon TCG API (USD)
        return Currency.convertAndFormat(price);
    } else {
        // Price from marketplace listings (SEK)
        return Currency.convertFromSekAndFormat(price);
    }
}

/**
 * Create a price display element
 * @param {number} price - The price to display
 * @param {boolean} isFromApi - Whether the price comes from external API
 * @param {string} className - CSS classes to apply
 * @returns {HTMLElement} Price display element
 */
export function createPriceElement(price, isFromApi = false, className = 'text-blue-600 font-semibold') {
    const priceEl = document.createElement('span');
    priceEl.className = className;
    priceEl.textContent = displayPrice(price, isFromApi);
    return priceEl;
}

/**
 * Update all price elements on the page with current currency
 */
export function refreshPriceDisplays() {
    // Update elements with data-price-usd attribute (from APIs)
    document.querySelectorAll('[data-price-usd]').forEach(el => {
        const priceUsd = parseFloat(el.dataset.priceUsd);
        if (!isNaN(priceUsd)) {
            el.textContent = Currency.convertAndFormat(priceUsd);
        }
    });

    // Update elements with data-price-sek attribute (from marketplace)
    document.querySelectorAll('[data-price-sek]').forEach(el => {
        const priceSek = parseFloat(el.dataset.priceSek);
        if (!isNaN(priceSek)) {
            el.textContent = Currency.convertFromSekAndFormat(priceSek);
        }
    });
}

/**
 * Create a currency selector dropdown
 * @param {string} containerId - ID of container to append selector to
 */
export function createCurrencySelector(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const selector = document.createElement('select');
    selector.id = 'currency-selector';
    selector.className = 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-1 text-sm';
    
    const currencies = [
        { code: 'SEK', name: 'Swedish Krona (kr)' },
        { code: 'USD', name: 'US Dollar ($)' },
        { code: 'EUR', name: 'Euro (€)' },
        { code: 'GBP', name: 'British Pound (£)' },
        { code: 'NOK', name: 'Norwegian Krone (kr)' },
        { code: 'DKK', name: 'Danish Krone (kr)' }
    ];

    currencies.forEach(currency => {
        const option = document.createElement('option');
        option.value = currency.code;
        option.textContent = currency.name;
        if (currency.code === Currency.getUserCurrency()) {
            option.selected = true;
        }
        selector.appendChild(option);
    });

    selector.addEventListener('change', (e) => {
        Currency.updateUserCurrency(e.target.value);
        refreshPriceDisplays();
        
        // Trigger custom event for other components to listen to
        document.dispatchEvent(new CustomEvent('currencyChanged', {
            detail: { newCurrency: e.target.value }
        }));
    });

    const label = document.createElement('label');
    label.textContent = 'Currency: ';
    label.className = 'text-sm text-gray-700 dark:text-gray-300 mr-2';
    label.htmlFor = 'currency-selector';

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center space-x-2';
    wrapper.appendChild(label);
    wrapper.appendChild(selector);

    container.appendChild(wrapper);
}

/**
 * Show loading state for price elements
 * @param {string} selector - CSS selector for price elements
 */
export function showPriceLoading(selector = '[data-price-usd], [data-price-sek]') {
    document.querySelectorAll(selector).forEach(el => {
        el.textContent = 'Loading...';
        el.classList.add('animate-pulse');
    });
}

/**
 * Hide loading state for price elements
 * @param {string} selector - CSS selector for price elements
 */
export function hidePriceLoading(selector = '[data-price-usd], [data-price-sek]') {
    document.querySelectorAll(selector).forEach(el => {
        el.classList.remove('animate-pulse');
    });
}

// --- RENDER FUNCTIONS ---

export function renderGridView(cards, activeTab) {
    if (!cards || cards.length === 0) {
        showEmptyState(activeTab === 'collection' ? "No cards match your filters." : "Your wishlist is empty.");
        return;
    }
    const isBulkMode = Collection.getState().bulkEdit.isActive;
    const gridHTML = cards.map(card => {
        const imageUrl = getCardImageUrl(card);
        // Use currency conversion for USD prices from APIs
        const price = Currency.convertAndFormat(card?.prices?.usd || 0);
        const isSelected = Collection.getState().bulkEdit.selected.has(card.id);
        const salePriceDisplay = (card.forSale && typeof card.salePrice === 'number')
            ? `<div class="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">${Currency.convertFromSekAndFormat(card.salePrice)}</div>`
            : '';

        const bulkCheckbox = isBulkMode
            ? `<div class="absolute top-2 right-2"><input type="checkbox" class="bulk-select-checkbox h-6 w-6" data-id="${card.id}" ${isSelected ? 'checked' : ''}></div>`
            : `<div class="absolute top-2 right-2 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button data-action="edit" class="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-lg"><i class="fas fa-pencil-alt"></i></button>
                        <button data-action="delete" class="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"><i class="fas fa-trash"></i></button>
                    </div>`;

        return `
            <div class="card-container relative group ${isSelected ? 'ring-4 ring-blue-500' : ''}" data-id="${card.id}">
                <img src="${imageUrl}" alt="${card.name}" class="rounded-lg shadow-md w-full transition-transform transform group-hover:scale-105">
                <div class="absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                    <div class="text-white text-center p-2"><p class="font-bold">${card.name}</p><p class="text-sm">${card.set_name}</p></div>
                </div>
                 ${bulkCheckbox}
                ${salePriceDisplay}
                <div class="absolute bottom-0 left-0 bg-gray-800 bg-opacity-75 text-white text-xs w-full p-1 rounded-b-lg flex justify-between">
                    <span>Qty: ${card.quantity || 1}</span>
                    <span>${price}</span>
                </div>
            </div>`;
    }).join('');
    display.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">${gridHTML}</div>`;
}

export function renderListView(cards, activeTab) {
    if (!cards || cards.length === 0) {
        showEmptyState(activeTab === 'collection' ? "No cards match your filters." : "Your wishlist is empty.");
        return;
    }
    const isBulkMode = Collection.getState().bulkEdit.isActive;
    const allSelectedOnPage = isBulkMode && cards.length > 0 && cards.every(c => Collection.getState().bulkEdit.selected.has(c.id));

    const tableHeader = `
        <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
                ${isBulkMode ? `<th class="p-3 text-left text-xs font-medium uppercase tracking-wider"><input type="checkbox" id="bulk-select-all-page" ${allSelectedOnPage ? 'checked' : ''}></th>` : ''}
                <th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Name</th>
                <th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Set</th>
                <th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Quantity</th>
                <th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Condition</th>
                <th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Market Price</th>
                <th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                ${!isBulkMode ? '<th class="p-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>' : ''}
            </tr>
        </thead>`;

    const tableBody = cards.map(card => {
        // Use currency conversion for USD prices from APIs
        const price = Currency.convertAndFormat(card?.prices?.usd || 0);
        const isSelected = Collection.getState().bulkEdit.selected.has(card.id);
        const saleStatus = (card.forSale && typeof card.salePrice === 'number')
            ? `<span class="text-green-500 font-semibold">For Sale (${Currency.convertFromSekAndFormat(card.salePrice)})</span>`
            : 'In Collection';
        
        return `
            <tr class="card-container border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600/50 ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50' : ''}" data-id="${card.id}">
                ${isBulkMode ? `<td class="p-3"><input type="checkbox" class="bulk-select-checkbox h-4 w-4" data-id="${card.id}" ${isSelected ? 'checked' : ''}></td>` : ''}
                <td class="p-3 font-medium">${card.name} ${card.is_foil ? '<i class="fas fa-star text-yellow-400"></i>' : ''}</td>
                <td class="p-3 text-sm text-gray-500 dark:text-gray-400">${card.set_name}</td>
                <td class="p-3">${card.quantity || 1}</td>
                <td class="p-3">${card.condition || 'N/A'}</td>
                <td class="p-3">${price}</td>
                <td class="p-3 text-sm">${saleStatus}</td>
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

export function renderSearchResults(results) {
    const container = getElement('search-results-container');
    if (typeof results === 'string') {
        container.innerHTML = `<p class="text-center text-gray-500">${results}</p>`;
        return;
    }
    if (!results || results.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500">No cards found.</p>`;
        return;
    }
    const resultsHTML = results.map(card => {
        const imageUrl = getCardImageUrl(card);
        // Use currency conversion for USD prices from APIs
        const price = Currency.convertAndFormat(card?.prices?.usd || 0);
        const collectorInfo = card.game === 'mtg' && card.collector_number ? ` | #${card.collector_number}` : '';
        const cardDataString = encodeURIComponent(JSON.stringify(card));
        return `
            <div class="flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer search-result-item" data-card='${cardDataString}'>
                <img src="${imageUrl}" alt="${card.name}" class="w-16 h-22 object-contain mr-4 rounded-md pointer-events-none">
                <div class="flex-grow pointer-events-none">
                    <p class="font-semibold">${card.name}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${card.set_name} (${card.set.toUpperCase()}${collectorInfo})</p>
                </div>
                <div class="text-right pointer-events-none">
                    <p class="font-mono">${price}</p>
                    <p class="text-sm capitalize text-gray-500">${card.rarity}</p>
                </div>
            </div>`;
    }).join('');
    container.innerHTML = resultsHTML;
}

// ** OVERHAULED: Handles cloning and swapping **
export function renderPendingCards(pendingCards) {
    const container = getElement('pending-cards-container');
    if (pendingCards.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `<h4 class="text-sm font-bold mb-2">Pending Copies to Add:</h4>` +
        pendingCards.map((card, index) => {
            const details = [
                `${card.quantity || 1}x`, card.condition, card.language,
                card.is_foil ? 'Foil' : ''
            ].filter(Boolean).join(', ');
            // Added data-index for swapping
            return `<div class="pending-card-item bg-gray-100 p-2 rounded-md text-sm mb-1 cursor-pointer" data-index="${index}">${details}</div>`;
        }).join('');
}

// ** NEW: Renders the advanced bulk review modal **
export function renderBulkReviewModal(cardIds) {
    const listContainer = getElement('bulk-review-list');
    listContainer.innerHTML = ''; // Clear previous items

    cardIds.forEach(cardId => {
        const card = Collection.getCardById(cardId);
        if (!card) return;

        const marketPrice = card.prices?.usd || 0;
        const displayMarketPrice = Currency.convertAndFormat(marketPrice);

        const reviewItem = document.createElement('div');
        reviewItem.className = 'grid grid-cols-5 gap-4 items-center p-2 border-b dark:border-gray-700';
        reviewItem.dataset.id = card.id;
        reviewItem.dataset.marketPrice = marketPrice;

        reviewItem.innerHTML = `
            <div class="col-span-2">
                <p class="font-semibold">${card.name}</p>
                <p class="text-xs text-gray-500">${card.set_name} - ${card.condition}</p>
            </div>
            <div>
                <label class="text-xs">Market</label>
                <p>${displayMarketPrice}</p>
            </div>
            <div>
                <label for="review-percent-${card.id}" class="text-xs">% of Market</label>
                <input type="number" id="review-percent-${card.id}" class="bulk-review-percent-input w-full p-1 border rounded-md" value="100">
            </div>
            <div>
                <label for="review-fixed-${card.id}" class="text-xs">Fixed Price</label>
                <input type="number" step="0.01" id="review-fixed-${card.id}" class="bulk-review-fixed-input w-full p-1 border rounded-md">
            </div>
        `;
        listContainer.appendChild(reviewItem);
    });
    openModal(getElement('bulk-review-modal'));
}

// --- UI STATE UPDATES ---
export const showLoadingState = () => display.innerHTML = '<p class="text-center text-gray-500">Loading your collection...</p>';
export const showLoggedOutState = () => getElement('collection-display').innerHTML = '<p class="text-center text-gray-500">Please log in to manage your collection.</p>';
export const showEmptyState = (message) => display.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500"><p>${message}</p></div>`;

export function updateStats(stats, activeTab) {
    const isCollection = activeTab === 'collection';
    getElement('stats-title').textContent = isCollection ? 'Collection Statistics' : 'Wishlist Statistics';
    getElement('stats-total-label').textContent = isCollection ? 'Total Cards:' : 'Total Items:';
    getElement('stats-unique-label').textContent = isCollection ? 'Unique Cards:' : 'Unique Items:';
    getElement('stats-value-label').textContent = isCollection ? 'Total Value:' : 'Wishlist Value:';
    getElement('stats-total-cards').textContent = stats.totalCards;
    getElement('stats-unique-cards').textContent = stats.uniqueCards;
    // Use currency conversion for USD total value
    getElement('stats-total-value').textContent = Currency.convertAndFormat(stats.totalValue || 0);
}

export function populateFilters(sets, rarities) {
    const setFilter = getElement('filter-set');
    const rarityFilter = getElement('filter-rarity');
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
    gridBtn.classList.toggle('bg-white', view === 'grid');
    gridBtn.classList.toggle('dark:bg-gray-900', view === 'grid');
    gridBtn.classList.toggle('shadow', view === 'grid');
    listBtn.classList.toggle('bg-white', view === 'list');
    listBtn.classList.toggle('dark:bg-gray-900', view === 'list');
    listBtn.classList.toggle('shadow', view === 'list');
}

// ** NEW: Implemented Missing Functions **
export function updateActiveTab(tab) {
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
}

export function updateTcgFilter(game) {
    document.querySelectorAll('.tcg-filter-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.game === game);
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
            icon.className = 'fas cursor-pointer text-gray-400';
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

export function updateBulkEditUI(isActive) {
    const bulkEditBtn = getElement('bulk-edit-btn');
    const bulkToolbar = getElement('bulk-edit-toolbar');
    
    bulkEditBtn.innerHTML = isActive ? '<i class="fas fa-times w-6"></i> Cancel' : '<i class="fas fa-edit w-6"></i> Bulk Edit';
    bulkEditBtn.classList.toggle('bg-red-600', isActive);
    bulkEditBtn.classList.toggle('text-white', isActive);
    bulkEditBtn.classList.toggle('hover:bg-red-700', isActive);
    bulkEditBtn.classList.toggle('bg-gray-200', !isActive);
    bulkEditBtn.classList.toggle('dark:bg-gray-700', !isActive);
    bulkEditBtn.classList.toggle('hover:bg-gray-300', !isActive);
    bulkEditBtn.classList.toggle('dark:hover:bg-gray-600', !isActive);
    
    bulkToolbar.classList.toggle('hidden', !isActive);
}

export function updateBulkEditSelection(selectedCount) {
    const selectedCountEl = getElement('bulk-selected-count');
    if (selectedCountEl) {
        selectedCountEl.textContent = selectedCount;
    }
}

// --- MODAL FUNCTIONS ---
export function openModal(modal) {
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
}

export function closeModal(modal) {
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
    }
}

export function openSearchModal() {
    openModal(searchModal);
    const searchInput = getElement('search-input');
    if (searchInput) searchInput.focus();
}

export function closeSearchModal() {
    closeModal(searchModal);
    getElement('search-input').value = '';
    getElement('search-results-container').innerHTML = '';
}

export function openCardModal(card) {
    const modal = getElement('card-modal');
    const imageEl = getElement('modal-card-image');
    const nameEl = getElement('modal-card-name');
    const setEl = getElement('modal-card-set');
    const priceEl = getElement('modal-card-price');
    const rarityEl = getElement('modal-card-rarity');
    const quantityInput = getElement('modal-quantity');
    const conditionSelect = getElement('modal-condition');
    const languageSelect = getElement('modal-language');
    const foilCheckbox = getElement('modal-foil');

    if (imageEl) imageEl.src = getCardImageUrl(card);
    if (nameEl) nameEl.textContent = card.name;
    if (setEl) setEl.textContent = card.set_name;
    // Use currency conversion for USD prices from APIs
    if (priceEl) priceEl.textContent = Currency.convertAndFormat(card?.prices?.usd || 0);
    if (rarityEl) rarityEl.textContent = card.rarity;
    if (quantityInput) quantityInput.value = 1;
    if (conditionSelect) conditionSelect.value = 'Near Mint';
    if (languageSelect) languageSelect.value = 'English';
    if (foilCheckbox) foilCheckbox.checked = false;

    modal.dataset.cardData = JSON.stringify(card);
    openModal(modal);
}

export function closeCardModal() {
    closeModal(cardModal);
}

export function openCsvModal() {
    openModal(csvModal);
}

export function closeCsvModal() {
    closeModal(csvModal);
    getElement('csv-file-input').value = '';
    getElement('csv-preview').innerHTML = '';
}

export function openBulkListModal() {
    openModal(bulkListModal);
}

export function closeBulkListModal() {
    closeModal(bulkListModal);
}

// --- TOOLTIP FUNCTIONS ---
export function showCardPreview(card, event) {
    if (!cardPreviewTooltip) return;
    
    const imageUrl = getCardImageUrl(card);
    // Use currency conversion for USD prices from APIs
    const price = Currency.convertAndFormat(card?.prices?.usd || 0);
    
    cardPreviewTooltip.innerHTML = `
        <img src="${imageUrl}" alt="${card.name}" class="w-48 h-auto rounded-lg shadow-lg">
        <div class="mt-2 text-center">
            <p class="font-semibold">${card.name}</p>
            <p class="text-sm text-gray-600">${card.set_name}</p>
            <p class="text-sm font-mono">${price}</p>
        </div>
    `;
    
    cardPreviewTooltip.style.left = `${event.pageX + 10}px`;
    cardPreviewTooltip.style.top = `${event.pageY + 10}px`;
    cardPreviewTooltip.classList.remove('hidden');
}

export function hideCardPreview() {
    if (cardPreviewTooltip) {
        cardPreviewTooltip.classList.add('hidden');
    }
}

// --- CSV FUNCTIONS ---
export function displayCsvPreview(data) {
    const container = getElement('csv-preview');
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No valid data found in CSV file.</p>';
        return;
    }

    const headers = Object.keys(data[0]);
    const tableHTML = `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    ${headers.map(header => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${header}</th>`).join('')}
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${data.slice(0, 10).map(row => `
                    <tr>
                        ${headers.map(header => `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${row[header] || ''}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${data.length > 10 ? `<p class="mt-2 text-sm text-gray-500">Showing first 10 of ${data.length} rows</p>` : ''}
    `;
    
    container.innerHTML = tableHTML;
}

// --- INITIALIZATION ---

/**
 * Initialize currency-related UI components
 */
export function initCurrencyUI() {
    // Initialize currency system with SEK as default (Hatake website preference)
    Currency.initCurrency('SEK');
    
    // Refresh price displays after currency is initialized
    setTimeout(() => {
        refreshPriceDisplays();
    }, 1000);
    
    // Listen for currency changes and refresh displays
    document.addEventListener('currencyChanged', () => {
        refreshPriceDisplays();
    });
}

// Auto-initialize currency when module is loaded
document.addEventListener('DOMContentLoaded', () => {
    initCurrencyUI();
});

