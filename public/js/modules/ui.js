/**
 * ui.js
 * Handles all DOM manipulation, rendering, and UI updates for the collection page.
 */
import { getCardImageUrl } from './utils.js';
import * as Collection from './collection.js';
import * as Currency from './currency.js';

// --- ELEMENT SELECTORS ---
const getElement = (id) => document.getElementById(id);
const display = getElement('collection-display');

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

// --- CURRENCY & PRICE DISPLAY ---

export function createCurrencySelector(containerId) {
    const container = document.getElementById(containerId);
    if (!container || container.querySelector('#currency-selector')) return;

    const selector = document.createElement('select');
    selector.id = 'currency-selector';
    selector.className = 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-1 text-sm';

    const currencies = [ 'SEK', 'USD', 'EUR', 'GBP', 'NOK', 'DKK' ];

    currencies.forEach(code => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = code;
        if (code === Currency.getUserCurrency()) option.selected = true;
        selector.appendChild(option);
    });

    selector.addEventListener('change', (e) => {
        Currency.updateUserCurrency(e.target.value);
    });

    container.appendChild(selector);
}

/**
 * Updates and shows the card preview tooltip.
 * @param {Event} event - The mouse event.
 * @param {object} card - The card data object.
 */
export function updateCardPreviewTooltip(event, card) {
    const tooltip = document.getElementById('card-preview-tooltip');
    if (!tooltip) return;
    let img = tooltip.querySelector('img');
    if (!img) {
        tooltip.innerHTML = '<img alt="Card Preview" class="w-full rounded-lg" src=""/>';
        img = tooltip.querySelector('img');
    }
    img.src = getCardImageUrl(card);
    tooltip.classList.remove('hidden');
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.right + 10}px`;
    tooltip.style.top = `${window.scrollY + rect.top}px`;
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
        const price = Currency.convertAndFormat(card.prices, card);
        const isSelected = Collection.getState().bulkEdit.selected.has(card.id);
        const salePriceDisplay = (card.for_sale && typeof card.sale_price === 'number')
            ? `<div class="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">${Currency.convertAndFormat(card.sale_price)}</div>`
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
        const price = Currency.convertAndFormat(card.prices, card);
        const isSelected = Collection.getState().bulkEdit.selected.has(card.id);
        const saleStatus = (card.for_sale && typeof card.sale_price === 'number')
            ? `<span class="text-green-500 font-semibold">For Sale (${Currency.convertAndFormat(card.sale_price)})</span>`
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
    const container = document.getElementById('search-results-container');
    if (!container) return;

    if (typeof results === 'string') {
        container.innerHTML = `<p class="text-gray-400">${results}</p>`;
        return;
    }
    if (!Array.isArray(results) || results.length === 0) {
        container.innerHTML = '<p class="text-gray-400">No cards found.</p>';
        return;
    }

    const resultsHTML = results.map(card => {
        const imageUrl = getCardImageUrl(card);
        const price = Currency.convertAndFormat(card.prices, card);
        const collectorInfo = card.collector_number ? ` (#${card.collector_number})` : '';
        const cardDataString = encodeURIComponent(JSON.stringify(card));

        return `
            <div class="search-result-item flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" data-card='${cardDataString}'>
                <img src="${imageUrl}" alt="${card.name}" class="w-16 h-22 object-contain mr-4 rounded-md pointer-events-none" onerror="this.src='images/placeholder.png';">
                <div class="flex-grow pointer-events-none">
                    <p class="font-semibold">${card.name}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${card.set_name}${collectorInfo}</p>
                </div>
                <div class="text-right pointer-events-none">
                    <p class="font-mono font-bold text-green-500">${price}</p>
                    <p class="text-sm capitalize text-gray-500">${card.rarity}</p>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = resultsHTML;
}



export function renderPendingCards(pendingCards) {
    const container = getElement('pending-versions-list');
    if (!container) return;

    if (!pendingCards || pendingCards.length === 0) {
        container.innerHTML = '';
        return;
    }

    const cardsHTML = pendingCards.map((card, index) => {
        const details = [
            `Qty: ${card.quantity || 1}`,
            card.condition || 'N/A',
            card.language || 'N/A',
            card.is_foil ? 'Foil' : null,
            card.is_signed ? 'Signed' : null,
            card.is_altered ? 'Altered' : null,
        ].filter(Boolean).join(', ');

        return `
            <div class="pending-card-item flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-2 rounded-md text-sm mb-1" data-index="${index}">
                <p class="font-semibold text-gray-800 dark:text-gray-200 cursor-pointer flex-grow" title="${details}">${details}</p>
                <div>
                    <button type="button" class="swap-pending-btn text-blue-500 hover:text-blue-700 px-2" title="Edit this version"><i class="fas fa-pencil-alt"></i></button>
                    <button type="button" class="remove-pending-btn text-red-500 hover:text-red-700 font-bold text-lg px-2" title="Remove this version">&times;</button>
                </div>
            </div>`;
    }).join('');

    container.innerHTML = cardsHTML;
}


export function renderBulkReviewModal(cardIds) {
    const listContainer = getElement('bulk-review-list');
    listContainer.innerHTML = '';

    cardIds.forEach(cardId => {
        const card = Collection.getCardById(cardId);
        if (!card) return;

        const marketPrice = Currency.getNormalizedPriceUSD(card.prices, card) || 0;
        const displayMarketPrice = Currency.convertAndFormat(marketPrice, card);

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

export function renderCsvReviewModal(data) {
    const tableBody = document.getElementById('csv-review-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    data.forEach((card, index) => {
        const row = document.createElement('tr');
        row.dataset.index = index;
        row.innerHTML = `
            <td class="p-3 whitespace-nowrap">${card.name}</td>
            <td class="p-3 whitespace-nowrap">${card.set_name}</td>
            <td class="p-3 whitespace-nowrap">${card.collector_number}</td>
            <td class="p-3"><input type="number" class="w-16 p-1 dark:bg-gray-700 rounded" value="${card.quantity}" data-field="quantity"></td>
            <td class="p-3">
                <select class="p-1 dark:bg-gray-700 rounded" data-field="condition">
                    <option ${card.condition === 'Near Mint' ? 'selected' : ''}>Near Mint</option>
                    <option ${card.condition === 'Lightly Played' ? 'selected' : ''}>Lightly Played</option>
                    <option ${card.condition === 'Moderately Played' ? 'selected' : ''}>Moderately Played</option>
                    <option ${card.condition === 'Heavily Played' ? 'selected' : ''}>Heavily Played</option>
                    <option ${card.condition === 'Damaged' ? 'selected' : ''}>Damaged</option>
                </select>
            </td>
            <td class="p-3">
                 <select class="p-1 dark:bg-gray-700 rounded" data-field="language">
                    <option ${card.language === 'English' ? 'selected' : ''}>English</option>
                    <option ${card.language === 'Japanese' ? 'selected' : ''}>Japanese</option>
                    <option ${card.language === 'German' ? 'selected' : ''}>German</option>
                    <option ${card.language === 'French' ? 'selected' : ''}>French</option>
                    <option ${card.language === 'Spanish' ? 'selected' : ''}>Spanish</option>
                </select>
            </td>
            <td class="p-3"><input type="checkbox" ${card.is_foil ? 'checked' : ''} data-field="is_foil"></td>
            <td class="p-3 csv-row-status" data-status="pending">Pending</td>
            <td class="p-3"><button class="text-red-500 hover:text-red-700 remove-csv-row-btn" data-index="${index}">&times;</button></td>
        `;
        tableBody.appendChild(row);
    });

    openModal(document.getElementById('csv-review-modal'));
}

export function updateCsvReviewRowStatus(index, status, message = '') {
    const row = document.querySelector(`#csv-review-table-body tr[data-index='${index}']`);
    if (!row) return;

    const statusCell = row.querySelector('.csv-row-status');
    if (!statusCell) return;

    switch (status) {
        case 'loading':
            statusCell.innerHTML = '<i class="fas fa-spinner fa-spin text-blue-500"></i>';
            row.classList.add('opacity-50');
            break;
        case 'success':
            statusCell.innerHTML = `<i class="fas fa-check-circle text-green-500"></i> <span class="text-xs">${message}</span>`;
            row.classList.remove('opacity-50');
            row.classList.add('bg-green-50', 'dark:bg-green-900/50');
            break;
        case 'error':
            statusCell.innerHTML = `<i class="fas fa-times-circle text-red-500"></i> <span class="text-xs text-red-500">${message}</span>`;
            row.classList.remove('opacity-50');
            row.classList.add('bg-red-50', 'dark:bg-red-900/50');
            break;
        default:
            statusCell.textContent = 'Pending';
            row.className = '';
    }
}

export function toggleCsvImportProgress(show) {
    const container = document.getElementById('csv-import-progress-container');
    if (container) {
        container.classList.toggle('hidden', !show);
    }
}

export function updateCsvImportProgress(current, total, percentage) {
    const text = document.getElementById('csv-progress-text');
    const percentEl = document.getElementById('csv-progress-percentage');
    const bar = document.getElementById('csv-progress-bar');

    if (text) text.textContent = `Importing ${current} of ${total}...`;
    if (percentEl) percentEl.textContent = `${percentage}%`;
    if (bar) bar.style.width = `${percentage}%`;
}


export function updateCsvImportStatus(message) {
    const statusEl = getElement('csv-import-status');
    if (statusEl) {
        statusEl.innerHTML = message;
    }
}

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
    getElement('stats-total-value').textContent = Currency.convertAndFormat(stats.totalValue || 0);
}

export function populateFilters(sets, rarities) {
    populateMultiSelect('filter-set-container', 'Sets', 'set', sets);
    populateMultiSelect('filter-rarity-container', 'Rarities', 'rarity', rarities);
}

function populateMultiSelect(containerId, label, type, options) {
    const container = getElement(containerId);
    let optionsHTML = '';
    if (Array.isArray(options)) {
        optionsHTML = options.map(o => `
            <label class="flex items-center space-x-2">
                <input type="checkbox" name="${type}" value="${o}">
                <span>${o}</span>
            </label>
        `).join('');
    } else {
        for (const game in options) {
            optionsHTML += `<div class="font-bold">${game === 'mtg' ? 'Magic: The Gathering' : 'Pokémon'}</div>`;
            optionsHTML += options[game].map(o => `
                <label class="flex items-center space-x-2">
                    <input type="checkbox" name="${type}" value="${o}">
                    <span>${o}</span>
                </label>
            `).join('');
        }
    }

    container.innerHTML = `
        <button class="w-full text-left p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" onclick="this.nextElementSibling.classList.toggle('hidden')">${label}</button>
        <div class="hidden absolute z-10 w-full bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-md mt-1 p-2 space-y-2 max-h-60 overflow-y-auto">
            ${optionsHTML}
        </div>
    `;
}

export function getCheckedValues(type) {
    return Array.from(document.querySelectorAll(`input[name=${type}]:checked`)).map(el => el.value);
}

export function clearCheckboxes(type) {
    document.querySelectorAll(`input[name=${type}]`).forEach(el => el.checked = false);
}

export function renderGameSpecificFilters(game, types) {
    const container = getElement('game-specific-filters');
    if (!container) return;
    let content = '';

    if (game === 'mtg') {
        content = `
            <div id="magic-filters">
                <label class="text-sm">Colors (Magic)</label>
                <div class="flex justify-around mt-2 text-2xl" id="filter-colors">
                    <i class="fas fa-circle text-gray-400 cursor-pointer" data-color="W" title="White"></i>
                    <i class="fas fa-tint text-gray-400 cursor-pointer" data-color="U" title="Blue"></i>
                    <i class="fas fa-skull text-gray-400 cursor-pointer" data-color="B" title="Black"></i>
                    <i class="fas fa-fire text-gray-400 cursor-pointer" data-color="R" title="Red"></i>
                    <i class="fas fa-leaf text-gray-400 cursor-pointer" data-color="G" title="Green"></i>
                    <i class="fas fa-gem text-gray-400 cursor-pointer" data-color="C" title="Colorless"></i>
                </div>
            </div>
        `;
    } else if (game === 'pokemon') {
        const typeOptions = types.map(t => `<option value="${t}">${t}</option>`).join('');
        content = `
            <div id="pokemon-filters">
                <label for="filter-type" class="text-sm">Types (Pokémon)</label>
                <select id="filter-type" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                    <option value="">All Types</option>
                    ${typeOptions}
                </select>
            </div>
        `;
    }

    container.innerHTML = content;
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
    bulkToolbar.classList.toggle('hidden', !isActive);
}

export function updateBulkEditSelection(selectedCount) {
    const selectedCountEl = getElement('bulk-selected-count');
    if (selectedCountEl) {
        selectedCountEl.textContent = selectedCount;
    }
}

export function openModal(modal) {
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

export function closeModal(modal) {
    if (modal) {
        if (modal.id === 'card-modal') {
            Collection.clearPendingCards();
            renderPendingCards([]);
        }
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

export function populateCardModalForAdd(cardData) {
    Collection.clearPendingCards();
    Collection.setCurrentEditingCard(null);
    document.getElementById('card-form').reset();

    getElement('card-modal-id').value = '';
    getElement('card-api-id').value = cardData.api_id || cardData.id;
    getElement('card-modal-title').textContent = 'Add New Card';
    getElement('card-modal-subtitle').textContent = `${cardData.name} - ${cardData.set_name}`;
    getElement('card-modal-image').src = getCardImageUrl(cardData);
    getElement('save-card-btn').textContent = 'Add to Collection';
    getElement('delete-card-btn').classList.add('hidden');
    getElement('pending-versions-container').classList.remove('hidden');
    getElement('add-another-version-btn').classList.remove('hidden');
    
    getElement('graded-section').classList.add('hidden');

    openModal(getElement('card-modal'));
    getElement('card-modal').dataset.card = JSON.stringify(cardData);
}

export function populateCardModalForEdit(card) {
    Collection.clearPendingCards();
    Collection.setCurrentEditingCard(card);
    document.getElementById('card-form').reset();

    getElement('card-modal-id').value = card.id;
    getElement('card-api-id').value = card.api_id;
    getElement('card-modal-title').textContent = 'Edit Card';
    getElement('card-modal-subtitle').textContent = `${card.name} - ${card.set_name}`;
    getElement('card-modal-image').src = card.customImageUrl || getCardImageUrl(card);

    getElement('card-quantity').value = card.quantity || 1;
    getElement('card-condition').value = card.condition || 'Near Mint';
    getElement('card-language').value = card.language || 'English';
    getElement('card-is-foil').checked = card.is_foil || false;
    getElement('card-is-signed').checked = card.is_signed || false;
    getElement('card-is-altered').checked = card.is_altered || false;
    getElement('card-purchase-price').value = card.purchase_price || '';
    getElement('card-notes').value = card.notes || '';

    const isGraded = card.is_graded || false;
    getElement('card-is-graded').checked = isGraded;
    const gradedSection = getElement('graded-section');
    gradedSection.classList.toggle('hidden', !isGraded);
    if (isGraded) {
        getElement('grading-company').value = card.grading_company || 'PSA';
        getElement('grade').value = card.grade || '10';
    }

    getElement('save-card-btn').textContent = 'Save Changes';
    getElement('delete-card-btn').classList.remove('hidden');
    getElement('pending-versions-container').classList.add('hidden');
    getElement('add-another-version-btn').classList.add('hidden');

    openModal(getElement('card-modal'));
    getElement('card-modal').dataset.card = JSON.stringify(card);
}

export function getCardFormData() {
    const modal = getElement('card-modal');
    const cardData = JSON.parse(modal.dataset.card || '{}');
    const id = getElement('card-modal-id').value;
    const isGraded = getElement('card-is-graded').checked;

    const data = {
        name: cardData.name,
        set_name: cardData.set_name,
        api_id: cardData.api_id || getElement('card-api-id').value,
        image_uris: cardData.image_uris,
        prices: cardData.prices,
        rarity: cardData.rarity,
        game: cardData.game,
        collector_number: cardData.collector_number,
        type_line: cardData.type_line || null, // Ensure type_line is null if undefined
        color_identity: cardData.color_identity || [],
        quantity: parseInt(getElement('card-quantity').value, 10) || 1,
        condition: getElement('card-condition').value,
        language: getElement('card-language').value,
        is_foil: getElement('card-is-foil').checked,
        is_signed: getElement('card-is-signed').checked,
        is_altered: getElement('card-is-altered').checked,
        is_graded: isGraded,
        purchase_price: parseFloat(getElement('card-purchase-price').value) || null,
        notes: getElement('card-notes').value,
        grading_company: isGraded ? getElement('grading-company').value : null,
        grade: isGraded ? getElement('grade').value : null,
    };

    if (!id) {
        data.addedAt = new Date();
    }

    // Remove undefined fields before returning
    for (const key in data) {
        if (data[key] === undefined) {
            delete data[key];
        }
    }

    return {
        id: id,
        data: data,
        customImageFile: getElement('custom-image-upload').files[0] || null
    };
}


export function resetCardFormForNewVersion() {
    getElement('card-quantity').value = 1;
    getElement('card-condition').value = 'Near Mint';
    getElement('card-language').value = 'English';
    getElement('card-is-foil').checked = false;
    getElement('card-is-signed').checked = false;
    getElement('card-is-altered').checked = false;
    getElement('card-purchase-price').value = '';
    getElement('card-notes').value = '';
    getElement('card-is-graded').checked = false;
    getElement('graded-section').classList.add('hidden');
}


export function toggleBulkPriceInputs(selectedValue) {
    document.getElementById('bulk-price-percentage-group').classList.toggle('hidden', selectedValue !== 'percentage');
    document.getElementById('bulk-price-fixed-group').classList.toggle('hidden', selectedValue !== 'fixed');
}

export function setButtonLoading(button, isLoading, loadingText = "Processing...") {
    if (button) {
        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || 'Submit';
        }
    }
}