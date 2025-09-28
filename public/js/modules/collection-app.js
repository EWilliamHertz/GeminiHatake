/**
 * collection-app.js
 * Main application logic for the collection page.
 * - FIX: Prevents initialization crash by ensuring a user is logged in before loading collection data.
 * - FIX: Properly clears currentEditingCard state to prevent incorrect quantity updates.
 */
import * as Collection from './collection.js';
import * as API from './api.js';
import * as CSV from './csv.js';
import * as Currency from './currency.js';
import { getCardImageUrl } from './utils.js';

let currentUser = null;
let csvFile = null;

// --- UI HELPER ---
const UI = {
    openModal: (modal) => {
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex', 'items-center', 'justify-center');
    },
    closeModal: (modal) => {
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex', 'items-center', 'justify-center');
    },
    showToast: (message, type = 'info', duration = 5000) => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-blue-600'
        };
        toast.className = `p-4 rounded-lg text-white shadow-lg mb-2 ${colors[type] || 'bg-gray-700'} transition-all duration-300 transform translate-y-4 opacity-0`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('translate-y-4', 'opacity-0');
        }, 10);
        setTimeout(() => {
            toast.classList.add('opacity-0');
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);
    },
    setButtonLoading: (button, isLoading, originalText = 'Submit') => {
        if (!button) return;
        if (isLoading) {
            button.dataset.originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Processing...`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || originalText;
        }
    },
     updateBulkEditUI: (isActive) => {
        document.getElementById('bulk-edit-toolbar').classList.toggle('hidden', !isActive);
        document.getElementById('bulk-edit-toolbar').classList.toggle('flex', isActive);
        applyAndRender({});
    },
    updateBulkEditSelection: (count) => {
        const countEl = document.getElementById('bulk-selected-count');
        if (countEl) {
            countEl.textContent = count;
        }
    },
    createCurrencySelector: (containerId) => {
        const container = document.getElementById(containerId);
        if (!container || document.getElementById('currency-selector')) return;

        const supported = {
            'USD': 'United States Dollar',
            'SEK': 'Swedish Krona',
            'EUR': 'Euro',
            'GBP': 'British Pound',
            'NOK': 'Norwegian Krone',
            'DKK': 'Danish Krone'
        };
        const currentCode = Currency.getUserCurrency();

        const select = document.createElement('select');
        select.id = 'currency-selector';
        select.className = 'bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500';

        for (const code in supported) {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = `${code} - ${supported[code]}`;
            if (code === currentCode) {
                option.selected = true;
            }
            select.appendChild(option);
        }

        select.addEventListener('change', async (e) => {
            try {
                await Currency.updateUserCurrency(e.target.value);
                UI.showToast(`Currency updated to ${e.target.value}`, 'success');
            } catch (error) {
                UI.showToast(`Failed to update currency: ${error.message}`, 'error');
            }
        });

        container.appendChild(select);
    },
    renderGridView: (cards, activeTab, isBulkMode) => {
        const container = document.getElementById('collection-display');
        container.innerHTML = '';
        if (cards.length === 0) {
            container.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500"><p>No cards match the current filters.</p></div>`;
            return;
        }
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';
        cards.forEach(card => {
            const isSelected = Collection.getState().bulkEdit.selected.has(card.id);
            const cardHtml = `
                <div class="card-container group rounded-lg overflow-hidden shadow-lg flex flex-col bg-white dark:bg-gray-800 transform hover:-translate-y-1 transition-transform duration-200 ${isSelected ? 'ring-4 ring-blue-500' : ''}" data-id="${card.id}">
                    <div class="relative">
                        <img src="${getCardImageUrl(card)}" alt="${card.name}" class="w-full object-cover" loading="lazy">
                        ${isBulkMode ? `<input type="checkbox" class="bulk-select-checkbox absolute top-2 left-2 h-5 w-5 z-10" ${isSelected ? 'checked' : ''}>` : ''}
                        <div class="card-actions absolute top-2 right-2 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                            <button data-action="history" class="p-2 bg-gray-800 bg-opacity-60 rounded-full text-white hover:bg-opacity-90"><i class="fas fa-chart-line"></i></button>
                            <button data-action="edit" class="p-2 bg-gray-800 bg-opacity-60 rounded-full text-white hover:bg-opacity-90"><i class="fas fa-edit"></i></button>
                            <button data-action="delete" class="p-2 bg-gray-800 bg-opacity-60 rounded-full text-white hover:bg-opacity-90"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="p-2 text-xs flex-grow flex flex-col justify-between">
                        <div>
                            <p class="font-bold truncate text-gray-900 dark:text-gray-100">${card.name}</p>
                            <p class="truncate text-gray-600 dark:text-gray-400">${card.set_name}</p>
                        </div>
                        <p class="font-mono text-right font-semibold text-gray-800 dark:text-gray-200 mt-1">${Currency.convertAndFormat(card.prices)}</p>
                    </div>
                </div>
            `;
            grid.insertAdjacentHTML('beforeend', cardHtml);
        });
        container.appendChild(grid);
    },
    renderListView: (cards, activeTab, isBulkMode) => {
        const container = document.getElementById('collection-display');
        if (cards.length === 0) {
            container.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500"><p>No cards to display.</p></div>`;
            return;
        }
        const tableHtml = `
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        ${isBulkMode ? '<th class="px-4 py-3"></th>' : ''}
                        <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Name</th>
                        <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Set</th>
                        <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Qty</th>
                        <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Condition</th>
                        <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Value</th>
                        <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    ${cards.map(card => {
                        const isSelected = Collection.getState().bulkEdit.selected.has(card.id);
                        return `
                        <tr class="card-container hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}" data-id="${card.id}">
                            ${isBulkMode ? `<td class="px-4 py-3"><input type="checkbox" class="bulk-select-checkbox" ${isSelected ? 'checked' : ''}></td>` : ''}
                            <td class="px-4 py-3 whitespace-nowrap"><div class="flex items-center"><img src="${getCardImageUrl(card)}" class="h-10 w-auto rounded mr-3" alt="">${card.name}</div></td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm">${card.set_name}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm">${card.quantity}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm">${card.condition}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm font-mono">${Currency.convertAndFormat(card.prices)}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                <div class="card-actions flex items-center space-x-3">
                                    <button data-action="history" title="Price History"><i class="fas fa-chart-line"></i></button>
                                    <button data-action="edit" title="Edit Card"><i class="fas fa-edit"></i></button>
                                    <button data-action="delete" title="Delete Card"><i class="fas fa-trash text-red-500"></i></button>
                                </div>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = tableHtml;
    },
    updateStats: (stats, activeTab) => {
        document.getElementById('stats-total-cards').textContent = stats.totalCards;
        document.getElementById('stats-unique-cards').textContent = stats.uniqueCards;
        document.getElementById('stats-total-value').textContent = Currency.convertAndFormat(stats.totalValue);
        document.getElementById('stats-title').textContent = activeTab === 'collection' ? 'Collection Stats' : 'Wishlist Stats';
    },
    populateCardModalForAdd: (cardData) => {
        // CRITICAL FIX: Clear all state before setting new card data
        Collection.clearPendingCards();
        Collection.setCurrentEditingCard(null); // Clear previous card state first
        
        // Reset the form completely
        document.getElementById('card-form').reset();
        document.getElementById('card-modal-id').value = '';
        
        // Set the new card data
        Collection.setCurrentEditingCard(cardData);
        document.getElementById('card-api-id').value = cardData.api_id || cardData.id;
        document.getElementById('card-modal-title').textContent = `Add: ${cardData.name}`;
        document.getElementById('card-modal-subtitle').textContent = `${cardData.set_name} (#${cardData.collector_number})`;
        document.getElementById('card-modal-image').src = getCardImageUrl(cardData);
        document.getElementById('save-card-btn').textContent = 'Add to Collection';
        document.getElementById('delete-card-btn').classList.add('hidden');
        document.getElementById('card-is-foil').checked = cardData.finishes?.includes('foil');
        UI.openModal(document.getElementById('card-modal'));
    },
    populateCardModalForEdit: (card) => {
        Collection.clearPendingCards();
        Collection.setCurrentEditingCard(card);
        const form = document.getElementById('card-form');
        form.reset();
        document.getElementById('card-modal-id').value = card.id;
        document.getElementById('card-api-id').value = card.api_id;
        document.getElementById('card-modal-title').textContent = `Edit: ${card.name}`;
        document.getElementById('card-modal-subtitle').textContent = `${card.set_name} (#${card.collector_number})`;
        document.getElementById('card-modal-image').src = getCardImageUrl(card);
        
        for (const key in card) {
            const el = form.elements[key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())];
            if (el) {
                if (el.type === 'checkbox') el.checked = !!card[key];
                else el.value = card[key];
            }
        }

        document.getElementById('save-card-btn').textContent = 'Update Card';
        document.getElementById('delete-card-btn').classList.remove('hidden');
        document.getElementById('card-is-graded').dispatchEvent(new Event('change'));
        UI.openModal(document.getElementById('card-modal'));
    },
    getCardFormData: () => {
        const form = document.getElementById('card-form');
        const id = form.querySelector('#card-modal-id').value;
        const customImageFile = form.querySelector('#custom-image-upload').files[0] || null;

        const data = {
            api_id: form.querySelector('#card-api-id').value,
            quantity: parseInt(form.querySelector('#card-quantity').value, 10) || 1,
            condition: form.querySelector('#card-condition').value,
            language: form.querySelector('#card-language').value,
            purchase_price: parseFloat(form.querySelector('#card-purchase-price').value) || null,
            is_foil: form.querySelector('#card-is-foil').checked,
            is_signed: form.querySelector('#card-is-signed').checked,
            is_altered: form.querySelector('#card-is-altered').checked,
            is_graded: form.querySelector('#card-is-graded').checked,
            notes: form.querySelector('#card-notes').value,
        };
        
        const currentCard = Collection.getCurrentEditingCard();
        if (currentCard) {
            Object.assign(data, {
                name: currentCard.name, 
                set_name: currentCard.set_name, 
                collector_number: currentCard.collector_number,
                rarity: currentCard.rarity, 
                prices: currentCard.prices, 
                image_uris: currentCard.image_uris,
                card_faces: currentCard.card_faces || null,
                game: currentCard.game,
            });
        }

        if (data.is_graded) {
            data.grading_company = form.querySelector('#grading-company').value;
            data.grade = form.querySelector('#grade').value;
        }
        
        // Sanitize object to remove undefined values before sending to Firestore
        for (const key in data) {
            if (data[key] === undefined) {
                data[key] = null;
            }
        }
        
        return { id, data, customImageFile };
    },
    populateFilters: (sets, rarities) => {
        const setContainer = document.getElementById('filter-set-container');
        const rarityContainer = document.getElementById('filter-rarity-container');

        const setOptionsHtml = sets.map(item => `
            <label class="flex items-center space-x-2 text-sm p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer">
                <input type="checkbox" value="${item}" data-filter-type="set" class="form-checkbox h-4 w-4 rounded text-blue-600">
                <span>${item}</span>
            </label>
        `).join('');

        setContainer.innerHTML = `
            <h4 class="font-semibold mb-2">Set</h4>
            <div class="relative" id="set-multiselect">
                <div id="set-select-box" class="p-2 border rounded-md min-h-[42px] flex flex-wrap gap-1 items-center cursor-text bg-white dark:bg-gray-700 dark:border-gray-600">
                    <div id="set-pills-container" class="flex flex-wrap gap-1"></div>
                    <input type="text" id="set-search-input" class="flex-grow p-1 bg-transparent focus:outline-none" placeholder="Filter by set...">
                </div>
                <div id="set-options-container" class="options-container hidden absolute z-20 w-full bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                    ${setOptionsHtml}
                </div>
            </div>
        `;
        
        const rarityCheckboxes = rarities.map(item => `
            <label class="flex items-center space-x-2 text-sm">
                <input type="checkbox" value="${item}" data-filter-type="rarity" class="form-checkbox h-4 w-4 rounded text-blue-600">
                <span>${item}</span>
            </label>
        `).join('');
        
        rarityContainer.innerHTML = `
            <h4 class="font-semibold mb-2">Rarity</h4>
            <div class="space-y-2">${rarityCheckboxes}</div>
        `;
    },
    populateGameFilters: (games) => {
        const gameContainer = document.getElementById('filter-game-container');
        const gameCheckboxes = games.map(game => `
            <label class="flex items-center space-x-2 text-sm">
                <input type="checkbox" value="${game}" data-filter-type="game" class="form-checkbox h-4 w-4 rounded text-blue-600">
                <span>${game.toUpperCase()}</span>
            </label>
        `).join('');
        
        gameContainer.innerHTML = `
            <h4 class="font-semibold mb-2">Game</h4>
            <div class="space-y-2">${gameCheckboxes}</div>
        `;
    },
    populateColorFilters: () => {
        const colorContainer = document.getElementById('filter-color-container');
        const colors = [
            { code: 'W', name: 'White', color: '#FFFBD5' },
            { code: 'U', name: 'Blue', color: '#0E68AB' },
            { code: 'B', name: 'Black', color: '#150B00' },
            { code: 'R', name: 'Red', color: '#D3202A' },
            { code: 'G', name: 'Green', color: '#00733E' },
            { code: 'C', name: 'Colorless', color: '#CCCCCC' }
        ];
        
        const colorButtons = colors.map(color => `
            <button type="button" data-color="${color.code}" class="color-filter-btn w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-500 transition-colors" style="background-color: ${color.color};" title="${color.name}"></button>
        `).join('');
        
        colorContainer.innerHTML = `
            <h4 class="font-semibold mb-2">Colors (MTG)</h4>
            <div class="flex flex-wrap gap-2">${colorButtons}</div>
        `;
    },
    populateTypeFilters: (types) => {
        const typeContainer = document.getElementById('filter-type-container');
        const typeSelect = `
            <h4 class="font-semibold mb-2">Type (Pokémon)</h4>
            <select id="type-filter-select" class="w-full p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600">
                <option value="">All Types</option>
                ${types.map(type => `<option value="${type}">${type}</option>`).join('')}
            </select>
        `;
        
        typeContainer.innerHTML = typeSelect;
    }
};

// --- ANALYTICS MODULE ---
const Analytics = {
    renderSingleCardChart: async (card, containerId) => {
        try {
            const historyData = await API.getScryDexHistory(card);
            const container = document.getElementById(containerId);
            
            if (!historyData || historyData.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500">No price history available for this card.</p>';
                return;
            }
            
            const ctx = document.createElement('canvas');
            container.innerHTML = '';
            container.appendChild(ctx);
            
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: historyData.map(entry => entry.date),
                    datasets: [{
                        label: 'Price (USD)',
                        data: historyData.map(entry => entry.price),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toFixed(2);
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error rendering chart:', error);
            document.getElementById(containerId).innerHTML = '<p class="text-center text-red-500">Error loading price history.</p>';
        }
    }
};

// --- MAIN APPLICATION LOGIC ---
function applyAndRender(options = {}) {
    const state = Collection.getState();
    const { activeTab, activeView, filteredCollection, wishlist, bulkEdit } = state;
    
    const cards = activeTab === 'collection' ? filteredCollection : wishlist;
    
    if (activeView === 'grid') {
        UI.renderGridView(cards, activeTab, bulkEdit.isActive);
    } else {
        UI.renderListView(cards, activeTab, bulkEdit.isActive);
    }
    
    const stats = activeTab === 'collection' ? Collection.calculateCollectionStats() : Collection.calculateWishlistStats();
    UI.updateStats(stats, activeTab);
    
    if (!options.skipFilters) {
        const games = state.filters.games;
        const { sets, rarities, types } = Collection.getAvailableFilterOptions(games);
        UI.populateFilters(sets, rarities[games[0]] || []);
        UI.populateTypeFilters(types);
    }
}

function toggleDashboard() {
    const dashboard = document.getElementById('dashboard');
    const collectionDisplay = document.getElementById('collection-display');
    const tabs = document.getElementById('tabs');
    
    const show = dashboard.classList.contains('hidden');
    
    dashboard.classList.toggle('hidden', !show);
    collectionDisplay.classList.toggle('hidden', show);
    tabs.classList.toggle('hidden', show);
    document.getElementById('view-toggle-grid').parentElement.classList.toggle('hidden', show);
    
    applyAndRender({});
    if (show) {
        UI.showToast("Disclaimer: Price data is for informational purposes only.", "info", 8000);
    }
}

async function handleCardFormSubmit(e) {
    e.preventDefault();
    const submitter = e.submitter;
    UI.setButtonLoading(submitter, true, submitter.textContent);
    try {
        const { id, data, customImageFile } = UI.getCardFormData();
        if (id) {
            await Collection.updateCard(id, data, customImageFile);
            UI.showToast("Card updated!", "success");
        } else {
            data.addedAt = new Date();
            await Collection.addMultipleCards([data], customImageFile);
            UI.showToast("Card added!", "success");
        }
        
        // CRITICAL FIX: Clear the editing state after successful submission
        Collection.setCurrentEditingCard(null);
        
        UI.closeModal(document.getElementById('card-modal'));
        applyAndRender({});
    } catch (error) {
        console.error("Error saving card:", error);
        UI.showToast(error.message, "error");
    } finally {
        UI.setButtonLoading(submitter, false);
    }
}

async function handleDeleteCard() {
    const cardId = document.getElementById('card-modal-id').value;
    const card = Collection.getCardById(cardId);
    if (card && confirm(`Are you sure you want to delete "${card.name}"? This cannot be undone.`)) {
        try {
            await Collection.deleteCard(cardId);
            UI.showToast("Card deleted.", "success");
            
            // CRITICAL FIX: Clear the editing state after deletion
            Collection.setCurrentEditingCard(null);
            
            UI.closeModal(document.getElementById('card-modal'));
            applyAndRender({});
        } catch (error) {
            UI.showToast("Error deleting card.", "error");
        }
    }
}

let searchTimeout;
function handleSearchInput() {
    clearTimeout(searchTimeout);
    const query = document.getElementById('card-search-input').value;
    const game = document.getElementById('game-selector').value;
    const resultsContainer = document.getElementById('search-results-container');
    if (query.length < 3) {
        resultsContainer.innerHTML = '<p class="text-center text-gray-500">Enter at least 3 characters.</p>';
        return;
    }
    resultsContainer.innerHTML = '<p class="text-center text-gray-500">Searching...</p>';
    searchTimeout = setTimeout(async () => {
        try {
            const results = await API.searchCards(query, game);
            if (results.length === 0) {
                 resultsContainer.innerHTML = '<p class="text-center text-gray-500">No cards found.</p>';
            } else {
                resultsContainer.innerHTML = results.map(card => `
                    <div class="search-result-item flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" data-card='${encodeURIComponent(JSON.stringify(card))}'>
                        <img src="${getCardImageUrl(card)}" class="w-10 h-auto rounded-sm mr-4">
                        <div class="flex-grow">
                            <p class="font-semibold">${card.name}</p>
                            <p class="text-sm text-gray-500">${card.set_name}</p>
                        </div>
                        <p class="text-sm font-mono text-gray-700 dark:text-gray-300 ml-4">${Currency.convertAndFormat(card.prices)}</p>
                    </div>
                `).join('');
            }
        } catch (error) {
            resultsContainer.innerHTML = `<p class="text-center text-red-500">Error: ${error.message}</p>`;
        }
    }, 300);
}

function handleSearchResultClick(item) {
    if (item) {
        const cardData = JSON.parse(decodeURIComponent(item.dataset.card));
        UI.closeModal(document.getElementById('search-modal'));
        UI.populateCardModalForAdd(cardData);
    }
}

function switchTab(tab) {
    Collection.setTab(tab);
    document.querySelector('[data-tab="collection"]').classList.toggle('active', tab === 'collection');
    document.querySelector('[data-tab="wishlist"]').classList.toggle('active', tab === 'wishlist');
    applyAndRender({});
}

function switchView(view) {
    Collection.setView(view);
    document.getElementById('view-toggle-grid').classList.toggle('bg-white', view === 'grid');
    document.getElementById('view-toggle-grid').classList.toggle('dark:bg-gray-900', view === 'grid');
    document.getElementById('view-toggle-list').classList.toggle('bg-white', view === 'list');
    document.getElementById('view-toggle-list').classList.toggle('dark:bg-gray-900', view === 'list');
    applyAndRender({});
}

function handleCardClick(e, cardContainer) {
    const cardId = cardContainer.dataset.id;
    const isBulkMode = Collection.getState().bulkEdit.isActive;

    if (isBulkMode) {
        Collection.toggleCardSelection(cardId);
        UI.updateBulkEditSelection(Collection.getSelectedCardIds().length);
        applyAndRender({});
    } else {
        const button = e.target.closest('button[data-action]');
        if (button) {
            e.stopPropagation();
            const card = Collection.getCardById(cardId);
            if (!card) return;
            switch (button.dataset.action) {
                case 'edit':
                    UI.populateCardModalForEdit(card);
                    break;
                case 'delete':
                    if (confirm(`Delete "${card.name}"?`)) {
                        Collection.deleteCard(cardId).then(() => {
                            UI.showToast("Card deleted.", "success");
                            applyAndRender({});
                        });
                    }
                    break;
                case 'history':
                    document.getElementById('card-history-modal-title').textContent = `Price History: ${card.name}`;
                    UI.openModal(document.getElementById('card-history-modal'));
                    Analytics.renderSingleCardChart(card, 'card-history-chart');
                    break;
            }
        }
    }
}


function handleTopMoverClick(element) {
    if (element?.dataset.cardId) {
        const card = Collection.getCardById(element.dataset.cardId);
        if (card) {
            UI.populateCardModalForEdit(card);
        }
    }
}

function handleFilterChange(e) {
    const filterType = e.target.dataset.filterType;
    const value = e.target.value;
    const isChecked = e.target.checked;
    
    const currentFilters = Collection.getState().filters;
    
    if (filterType === 'set') {
        if (isChecked) {
            currentFilters.set.push(value);
        } else {
            const index = currentFilters.set.indexOf(value);
            if (index > -1) currentFilters.set.splice(index, 1);
        }
    } else if (filterType === 'rarity') {
        if (isChecked) {
            currentFilters.rarity.push(value);
        } else {
            const index = currentFilters.rarity.indexOf(value);
            if (index > -1) currentFilters.rarity.splice(index, 1);
        }
    } else if (filterType === 'game') {
        if (isChecked) {
            currentFilters.games.push(value);
        } else {
            const index = currentFilters.games.indexOf(value);
            if (index > -1) currentFilters.games.splice(index, 1);
        }
    }
    
    Collection.setFilters(currentFilters);
    applyAndRender({});
}

function handleColorFilterClick(e) {
    if (e.target.classList.contains('color-filter-btn')) {
        const color = e.target.dataset.color;
        const colors = Collection.toggleColorFilter(color);
        
        e.target.classList.toggle('ring-4', colors.includes(color));
        e.target.classList.toggle('ring-blue-500', colors.includes(color));
        
        applyAndRender({});
    }
}

function handleTypeFilterChange(e) {
    Collection.setFilters({ type: e.target.value });
    applyAndRender({});
}

function handleNameFilterInput(e) {
    Collection.setFilters({ name: e.target.value });
    applyAndRender({});
}

function clearAllFilters() {
    Collection.setFilters({
        name: '',
        set: [],
        rarity: [],
        colors: [],
        games: [],
        type: ''
    });
    
    document.getElementById('name-filter-input').value = '';
    document.querySelectorAll('input[data-filter-type]').forEach(input => {
        input.checked = false;
    });
    document.querySelectorAll('.color-filter-btn').forEach(btn => {
        btn.classList.remove('ring-4', 'ring-blue-500');
    });
    document.getElementById('type-filter-select').value = '';
    
    applyAndRender({});
}

function toggleBulkEditMode() {
    const isActive = Collection.toggleBulkEditMode();
    UI.updateBulkEditUI(isActive);
}

function selectAllFiltered() {
    const state = Collection.getState();
    const cards = state.activeTab === 'collection' ? state.filteredCollection : state.wishlist;
    const cardIds = cards.map(card => card.id);
    Collection.selectAllFiltered(cardIds);
    UI.updateBulkEditSelection(Collection.getSelectedCardIds().length);
    applyAndRender({});
}

function deselectAll() {
    Collection.deselectAllFiltered();
    UI.updateBulkEditSelection(0);
    applyAndRender({});
}

async function bulkMarkForSale() {
    const selectedIds = Collection.getSelectedCardIds();
    if (selectedIds.length === 0) {
        UI.showToast("No cards selected.", "error");
        return;
    }
    
    const updates = selectedIds.map(id => ({
        id: id,
        data: { for_sale: true }
    }));
    
    try {
        await Collection.batchUpdateSaleStatus(updates);
        UI.showToast(`${selectedIds.length} cards marked for sale.`, "success");
    } catch (error) {
        UI.showToast("Error updating cards.", "error");
    }
}

async function bulkRemoveFromSale() {
    const selectedIds = Collection.getSelectedCardIds();
    if (selectedIds.length === 0) {
        UI.showToast("No cards selected.", "error");
        return;
    }
    
    const updates = selectedIds.map(id => ({
        id: id,
        data: { for_sale: false }
    }));
    
    try {
        await Collection.batchUpdateSaleStatus(updates);
        UI.showToast(`${selectedIds.length} cards removed from sale.`, "success");
    } catch (error) {
        UI.showToast("Error updating cards.", "error");
    }
}

async function bulkDelete() {
    const selectedIds = Collection.getSelectedCardIds();
    if (selectedIds.length === 0) {
        UI.showToast("No cards selected.", "error");
        return;
    }
    
    if (confirm(`Are you sure you want to delete ${selectedIds.length} cards? This cannot be undone.`)) {
        try {
            await Collection.batchDelete(selectedIds);
            UI.showToast(`${selectedIds.length} cards deleted.`, "success");
        } catch (error) {
            UI.showToast("Error deleting cards.", "error");
        }
    }
}

function handleBulkCheckboxChange(e) {
    if (e.target.classList.contains('bulk-select-checkbox')) {
        const cardContainer = e.target.closest('.card-container');
        const cardId = cardContainer.dataset.id;
        Collection.toggleCardSelection(cardId);
        UI.updateBulkEditSelection(Collection.getSelectedCardIds().length);
        applyAndRender({});
    }
}

async function handleCSVUpload(e) {
    csvFile = e.target.files[0];
    if (!csvFile) return;
    
    try {
        const text = await csvFile.text();
        const cards = CSV.parseManaboxCSV(text);
        
        document.getElementById('csv-preview-count').textContent = cards.length;
        document.getElementById('csv-preview').classList.remove('hidden');
        
        const previewHtml = cards.slice(0, 5).map(card => `
            <tr>
                <td class="px-4 py-2 border">${card.name}</td>
                <td class="px-4 py-2 border">${card.set_name}</td>
                <td class="px-4 py-2 border">${card.quantity}</td>
                <td class="px-4 py-2 border">${card.condition}</td>
            </tr>
        `).join('');
        
        document.getElementById('csv-preview-table').innerHTML = `
            <table class="min-w-full border-collapse border">
                <thead>
                    <tr class="bg-gray-50">
                        <th class="px-4 py-2 border">Name</th>
                        <th class="px-4 py-2 border">Set</th>
                        <th class="px-4 py-2 border">Quantity</th>
                        <th class="px-4 py-2 border">Condition</th>
                    </tr>
                </thead>
                <tbody>${previewHtml}</tbody>
            </table>
            ${cards.length > 5 ? `<p class="text-sm text-gray-500 mt-2">... and ${cards.length - 5} more cards</p>` : ''}
        `;
    } catch (error) {
        UI.showToast("Error reading CSV file.", "error");
    }
}

async function importCSV() {
    if (!csvFile) {
        UI.showToast("No CSV file selected.", "error");
        return;
    }
    
    const button = document.getElementById('import-csv-btn');
    UI.setButtonLoading(button, true, 'Import CSV');
    
    try {
        const text = await csvFile.text();
        const cards = CSV.parseManaboxCSV(text);
        
        await Collection.addMultipleCards(cards);
        UI.showToast(`Successfully imported ${cards.length} cards!`, "success");
        
        document.getElementById('csv-preview').classList.add('hidden');
        document.getElementById('csv-file-input').value = '';
        csvFile = null;
        
        UI.closeModal(document.getElementById('import-modal'));
        applyAndRender({});
    } catch (error) {
        console.error("CSV import error:", error);
        UI.showToast(`Import failed: ${error.message}`, "error");
    } finally {
        UI.setButtonLoading(button, false);
    }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await Currency.initCurrency();
        
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                try {
                    await Collection.loadCollection(user.uid);
                    await Collection.loadWishlist(user.uid);
                    applyAndRender({});
                    UI.createCurrencySelector('currency-selector-container');
                } catch (error) {
                    console.error("Failed to load user data:", error);
                    UI.showToast("Failed to load your collection. Please refresh the page.", "error");
                }
            } else {
                window.location.href = '/login.html';
            }
        });
        
        // Modal event listeners
        document.getElementById('card-form').addEventListener('submit', handleCardFormSubmit);
        document.getElementById('delete-card-btn').addEventListener('click', handleDeleteCard);
        document.getElementById('card-search-input').addEventListener('input', handleSearchInput);
        
        // Search result clicks
        document.getElementById('search-results-container').addEventListener('click', (e) => {
            const item = e.target.closest('.search-result-item');
            if (item) handleSearchResultClick(item);
        });
        
        // Tab switching
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(tab.dataset.tab);
            });
        });
        
        // View switching
        document.getElementById('view-toggle-grid').addEventListener('click', () => switchView('grid'));
        document.getElementById('view-toggle-list').addEventListener('click', () => switchView('list'));
        
        // Card interactions
        document.getElementById('collection-display').addEventListener('click', (e) => {
            const cardContainer = e.target.closest('.card-container');
            if (cardContainer) handleCardClick(e, cardContainer);
            if (e.target.classList.contains('bulk-select-checkbox')) handleBulkCheckboxChange(e);
        });
        
        // Filter event listeners
        document.addEventListener('change', (e) => {
            if (e.target.dataset.filterType) handleFilterChange(e);
        });
        
        document.getElementById('filter-color-container').addEventListener('click', handleColorFilterClick);
        document.addEventListener('change', (e) => {
            if (e.target.id === 'type-filter-select') handleTypeFilterChange(e);
        });
        
        document.getElementById('name-filter-input').addEventListener('input', handleNameFilterInput);
        document.getElementById('clear-filters-btn').addEventListener('click', clearAllFilters);
        
        // Bulk edit
        document.getElementById('bulk-edit-btn').addEventListener('click', toggleBulkEditMode);
        document.getElementById('bulk-select-all-btn').addEventListener('click', selectAllFiltered);
        document.getElementById('bulk-deselect-all-btn').addEventListener('click', deselectAll);
        document.getElementById('bulk-mark-sale-btn').addEventListener('click', bulkMarkForSale);
        document.getElementById('bulk-remove-sale-btn').addEventListener('click', bulkRemoveFromSale);
        document.getElementById('bulk-delete-btn').addEventListener('click', bulkDelete);
        
        // CSV import
        document.getElementById('csv-file-input').addEventListener('change', handleCSVUpload);
        document.getElementById('import-csv-btn').addEventListener('click', importCSV);
        
        // Dashboard
        document.getElementById('dashboard-btn').addEventListener('click', toggleDashboard);
        
        // Top movers
        document.getElementById('top-movers-list').addEventListener('click', (e) => {
            const element = e.target.closest('[data-card-id]');
            if (element) handleTopMoverClick(element);
        });
        
        // Modal close buttons
        document.querySelectorAll('[data-modal-close]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = document.getElementById(btn.dataset.modalClose);
                if (modal) {
                    UI.closeModal(modal);
                    // CRITICAL FIX: Clear editing state when modal is closed
                    if (btn.dataset.modalClose === 'card-modal') {
                        Collection.setCurrentEditingCard(null);
                    }
                }
            });
        });
        
        // Currency change listener
        document.addEventListener('currencyChanged', () => {
            applyAndRender({ skipFilters: true });
        });
        
    } catch (error) {
        console.error("Initialization error:", error);
        UI.showToast("Failed to initialize the application. Please refresh the page.", "error");
    }
});

// Export functions for global access
window.CollectionApp = {
    switchTab,
    switchView,
    toggleBulkEditMode,
    clearAllFilters,
    importCSV,
    toggleDashboard
};
