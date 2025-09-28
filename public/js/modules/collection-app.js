/**
 * collection-app.js
 * Main application logic for the collection page.
 * - FIX: Prevents initialization crash by ensuring a user is logged in before loading collection data.
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
        Collection.clearPendingCards();
        Collection.setCurrentEditingCard(cardData);
        document.getElementById('card-form').reset();
        document.getElementById('card-modal-id').value = '';
        document.getElementById('card-api-id').value = cardData.id;
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
                <input type="checkbox" value="${item}" class="form-checkbox h-4 w-4 rounded text-blue-600">
                <span>${item}</span>
            </label>
        `).join('');
        rarityContainer.innerHTML = `
            <h4 class="font-semibold mb-2 mt-4">Rarity</h4>
            <div class="space-y-1">${rarityCheckboxes}</div>
        `;
    },
    renderBulkReviewModal: (cardIds) => {
        const listContainer = document.getElementById('bulk-review-list');
        listContainer.innerHTML = '';
        if (cardIds.length === 0) {
            listContainer.innerHTML = '<p>No cards selected.</p>';
            return;
        }

        cardIds.forEach(id => {
            const card = Collection.getCardById(id);
            if (!card) return;

            const marketPrice = parseFloat(card.prices?.usd || 0);
            const initialPrice = marketPrice.toFixed(2);
            const currencySymbol = (Currency.formatPrice(0).replace(/[0-9.,\s]/g, ''));


            const itemHtml = `
                <div class="bulk-review-item flex items-center gap-4 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md" data-id="${card.id}" data-market-price="${marketPrice}">
                    <img src="${getCardImageUrl(card)}" class="w-12 h-auto rounded-md">
                    <div class="flex-1">
                        <p class="font-semibold text-sm">${card.name}</p>
                        <p class="text-xs text-gray-500">${card.set_name} - ${Currency.convertAndFormat(marketPrice)}</p>
                    </div>
                    <div class="flex items-center gap-2">
                         <input type="number" class="bulk-review-percent-input w-20 p-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" value="100" placeholder="%">
                         <span class="text-gray-500">%</span>
                    </div>
                     <div class="flex items-center gap-2">
                        <span class="text-gray-500">${currencySymbol}</span>
                        <input type="number" step="0.01" class="bulk-review-fixed-input w-24 p-1 border rounded-md dark:bg-gray-700 dark:border-gray-600" value="${initialPrice}" placeholder="Price">
                    </div>
                </div>
            `;
            listContainer.insertAdjacentHTML('beforeend', itemHtml);
        });
        UI.openModal(document.getElementById('bulk-review-modal'));
    }
};

// --- ANALYTICS DASHBOARD LOGIC ---
const Analytics = (() => {
    let mainValueChart = null;
    const priceHistoryCache = new Map();

    async function fetchPriceHistory(card) {
        if (priceHistoryCache.has(card.api_id)) {
            return priceHistoryCache.get(card.api_id);
        }
        try {
            console.log(`[Analytics] Requesting LIVE price history for ${card.name} from API module.`);
            const history = await API.getScryDexHistory(card);
            priceHistoryCache.set(card.api_id, history);
            return history;
        } catch (error) {
            console.error(`[Analytics] Failed to fetch live price history for ${card.name}:`, error);
            return [];
        }
    }

    function renderChart(canvasId, labels, data, label) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return null;
        if (Chart.getChart(ctx)) Chart.getChart(ctx).destroy();

        const isDarkMode = document.documentElement.classList.contains('dark');
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        const textColor = isDarkMode ? '#e5e7eb' : '#374151';

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label, data: data, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 5,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { ticks: { color: textColor, callback: (value) => Currency.convertAndFormat(value) }, grid: { color: gridColor } },
                    x: { ticks: { color: textColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }, grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { mode: 'index', intersect: false, callbacks: { label: (context) => `Value: ${Currency.convertAndFormat(context.parsed.y)}` } }
                },
                interaction: { mode: 'index', intersect: false },
            }
        });
    }

    const updateAnalyticsMetrics = (metrics) => {
        document.getElementById('analytics-current-value').textContent = Currency.convertAndFormat(metrics.currentValue);
        document.getElementById('analytics-all-time-high').textContent = Currency.convertAndFormat(metrics.allTimeHigh);
        const changeEl = document.getElementById('analytics-24h-change');
        const change = metrics.change24h;
        changeEl.textContent = `${change >= 0 ? '+' : ''}${Currency.convertAndFormat(change)}`;
        changeEl.classList.toggle('text-green-500', change >= 0);
        changeEl.classList.toggle('text-red-500', change < 0);
    };

    const renderTopMovers = ({ gainers, losers }) => {
        const container = document.getElementById('top-movers-container');
        container.innerHTML = '';
        const createMoverHtml = (card) => `
            <div class="top-mover-card flex items-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-500" data-card-id="${card.id}">
                <img src="${getCardImageUrl(card)}" alt="${card.name}" class="w-12 h-auto rounded-md mr-3 flex-shrink-0">
                <div class="flex-1 overflow-hidden">
                    <p class="font-semibold text-sm truncate">${card.name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${card.set_name}</p>
                    <p class="text-sm font-mono ${card.change >= 0 ? 'text-green-500' : 'text-red-500'}">
                        ${card.change >= 0 ? '+' : ''}${Currency.convertAndFormat(card.change)} (${card.percentChange.toFixed(1)}%)
                    </p>
                </div>
            </div>`;
        const allMovers = [...gainers, ...losers];
        if (allMovers.length === 0) {
            container.innerHTML = `<p class="text-gray-500 col-span-full text-center py-4">Not enough price data to determine movers.</p>`;
            return;
        }
        allMovers.forEach(card => container.insertAdjacentHTML('beforeend', createMoverHtml(card)));
    };

    return {
        initDashboard: async function(cards) {
            if (!cards || cards.length === 0) {
                updateAnalyticsMetrics({ currentValue: 0, change24h: 0, allTimeHigh: 0 });
                renderTopMovers({ gainers: [], losers: [] });
                mainValueChart = renderChart('value-chart', [], [], 'Collection Value');
                return;
            }
            
            const cardHistoriesPromises = cards.map(async (card) => ({
                card, 
                history: await fetchPriceHistory(card)
            }));
            const cardHistories = await Promise.all(cardHistoriesPromises);

            const dailyTotals = {};
            cardHistories.forEach(({ card, history }) => {
                if(!history || history.length === 0) return;
                history.forEach(point => {
                    dailyTotals[point.date] = (dailyTotals[point.date] || 0) + point.price * (card.quantity || 1);
                });
            });
            const sortedDates = Object.keys(dailyTotals).sort((a, b) => new Date(a) - new Date(b));
            const data = sortedDates.map(date => dailyTotals[date]);
            const currentValue = data[data.length - 1] || 0;
            updateAnalyticsMetrics({
                currentValue,
                change24h: currentValue - (data[data.length - 2] || currentValue),
                allTimeHigh: Math.max(...data, 0)
            });
            
            const uniqueMovers = new Map();
            cardHistories.forEach(({card, history}) => {
                 if (!history || history.length < 2) return;
                 const startPrice = history[0].price;
                 const endPrice = history[history.length - 1].price;
                 const change = (endPrice - startPrice) * (card.quantity || 1);
                 const percentChange = startPrice > 0 ? (change / (startPrice * (card.quantity || 1))) * 100 : 0;
                 
                 if (uniqueMovers.has(card.api_id)) {
                    const existing = uniqueMovers.get(card.api_id);
                    existing.change += change;
                 } else {
                    uniqueMovers.set(card.api_id, {...card, change, percentChange });
                 }
            });

            const movers = Array.from(uniqueMovers.values()).filter(m => m.change !== 0).sort((a, b) => b.change - a.change);
            renderTopMovers({ gainers: movers.filter(m => m.change > 0).slice(0, 3), losers: movers.filter(m => m.change < 0).slice(-3).reverse() });
            mainValueChart = renderChart('value-chart', sortedDates, data, 'Collection Value');
        },
        renderSingleCardChart: async function(card, canvasId) {
            const history = await fetchPriceHistory(card);
            const ctx = document.getElementById(canvasId).getContext('2d');
            if (history.length === 0) {
                if (Chart.getChart(ctx)) Chart.getChart(ctx).destroy();
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.font = "16px sans-serif";
                ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7281';
                ctx.textAlign = "center";
                ctx.fillText("No price history available.", ctx.canvas.width / 2, 50);
                return;
            }
            const newChart = renderChart(canvasId, history.map(p => p.date), history.map(p => p.price), `${card.name}`);
            if (canvasId === 'value-chart') mainValueChart = newChart;
        }
    };
})();

// --- MAIN APP LOGIC ---

let listenersInitialized = false;
function setupEventListeners() {
    if (listenersInitialized) return;

    document.body.addEventListener('click', (e) => {
        if (e.target.closest('#bulk-select-all-btn')) handleBulkSelectAll();
        if (e.target.closest('#bulk-delete-btn')) handleBulkDeleteClick();
        if (e.target.closest('#bulk-list-btn')) handleBulkListClick();
        if (e.target.closest('#finalize-bulk-list-btn')) handleFinalizeBulkList(e);
        if (e.target.closest('#close-search-modal')) UI.closeModal(document.getElementById('search-modal'));
        if (e.target.closest('#close-card-modal')) UI.closeModal(document.getElementById('card-modal'));
        if (e.target.closest('#close-card-history-modal')) UI.closeModal(document.getElementById('card-history-modal'));
        if (e.target.closest('#close-bulk-review-modal')) UI.closeModal(document.getElementById('bulk-review-modal'));
        if (e.target.closest('#add-card-btn')) UI.openModal(document.getElementById('search-modal'));
        if (e.target.closest('#analyze-value-btn')) handleAnalyzeValueClick();
        if (e.target.closest('#clear-filters-btn')) clearFilters();

        const tabButton = e.target.closest('.tab-button');
        if(tabButton) switchTab(tabButton.dataset.tab);
        if(e.target.closest('#view-toggle-grid')) switchView('grid');
        if(e.target.closest('#view-toggle-list')) switchView('list');

        const cardContainer = e.target.closest('.card-container[data-id]');
        if (cardContainer) handleCardClick(e, cardContainer);

        const searchResult = e.target.closest('.search-result-item');
        if(searchResult) handleSearchResultClick(searchResult);

        const topMover = e.target.closest('.top-mover-card');
        if(topMover) handleTopMoverClick(topMover);
        
        const setMultiselect = document.getElementById('set-multiselect');
        if (setMultiselect) {
            const optionsContainer = setMultiselect.querySelector('#set-options-container');
            if (e.target.closest('.pill-remove')) {
                 const value = e.target.closest('.pill-remove').dataset.value;
                 const checkbox = optionsContainer.querySelector(`input[value="${CSS.escape(value)}"]`);
                 if (checkbox) checkbox.checked = false;
                 const selected = Array.from(optionsContainer.querySelectorAll('input:checked')).map(i => i.value);
                 applyAndRender({ set: selected });
            } else if (setMultiselect.contains(e.target)) {
                 optionsContainer.classList.remove('hidden');
            } else {
                 optionsContainer.classList.add('hidden');
            }
        }
        
        if (e.target.closest('#bulk-edit-btn')) {
            const isActive = Collection.toggleBulkEditMode();
            UI.updateBulkEditUI(isActive);
        }
    });

    document.body.addEventListener('submit', (e) => {
        if(e.target.id === 'card-form') handleCardFormSubmit(e);
    });

    document.body.addEventListener('input', (e) => {
        if(e.target.id === 'filter-name') applyAndRender({ name: e.target.value });
        if(e.target.id === 'card-search-input') handleSearchInput();

        if (e.target.id === 'set-search-input') {
            const filter = e.target.value.toLowerCase();
            const optionsContainer = document.getElementById('set-options-container');
            if(optionsContainer) {
                optionsContainer.querySelectorAll('label').forEach(label => {
                    label.style.display = label.textContent.toLowerCase().includes(filter) ? 'flex' : 'none';
                });
            }
        }
        // Price sync for bulk review modal
        const reviewItem = e.target.closest('.bulk-review-item');
        if (reviewItem) {
            const marketPrice = parseFloat(reviewItem.dataset.marketPrice);
            const percentInput = reviewItem.querySelector('.bulk-review-percent-input');
            const fixedInput = reviewItem.querySelector('.bulk-review-fixed-input');
            
            if (e.target === percentInput) {
                const percent = parseFloat(percentInput.value);
                if (!isNaN(percent)) {
                    fixedInput.value = (marketPrice * (percent / 100)).toFixed(2);
                }
            } else if (e.target === fixedInput) {
                const fixed = parseFloat(fixedInput.value);
                if (!isNaN(fixed) && marketPrice > 0) {
                    percentInput.value = ((fixed / marketPrice) * 100).toFixed(0);
                }
            }
        }
    });

    document.body.addEventListener('change', (e) => {
        if (e.target.closest('#game-filter-container')) {
            const selectedGames = Array.from(document.querySelectorAll('#game-filter-container input:checked')).map(cb => cb.dataset.game);
            applyAndRender({ games: selectedGames, set: [], rarity: [] });
        }
        if (e.target.dataset.filterType === 'set') {
            const optionsContainer = document.getElementById('set-options-container');
            const selected = Array.from(optionsContainer.querySelectorAll('input:checked')).map(i => i.value);
            applyAndRender({ set: selected });
        }
        if (e.target.closest('#filter-rarity-container')) {
            const selected = Array.from(document.querySelectorAll('#filter-rarity-container input:checked')).map(i => i.value);
            applyAndRender({ rarity: selected });
        }
         if (e.target.id === 'card-is-graded') {
            document.getElementById('graded-section').classList.toggle('hidden', !e.target.checked);
        }
        if (e.target.id === 'game-selector') handleSearchInput();
    });

    document.addEventListener('currencyChanged', () => applyAndRender({}));
    listenersInitialized = true;
}

document.addEventListener('authReady', async ({ detail: { user } }) => {
    // FIX: This is the main fix. Only proceed if the user is actually logged in.
    if (user) {
        currentUser = user;
        try {
            // CRITICAL FIX: Call initCurrency with a valid currency string, not an object or uid.
            await Currency.initCurrency('USD');
            await Collection.loadCollection(user.uid);
            setupEventListeners();
            applyAndRender({});
            UI.createCurrencySelector('user-actions');
        } catch (error) {
            console.error("Initialization failed:", error);
            UI.showToast("Could not load collection data.", "error");
        }
    } else {
        // Handle the logged-out state gracefully
        currentUser = null;
        const collectionContainer = document.getElementById('collection-display');
        if (collectionContainer) {
            collectionContainer.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500"><p>Please log in to manage your collection.</p></div>';
        }
    }
});

function applyAndRender(filterUpdate) {
    if (filterUpdate && Object.keys(filterUpdate).length > 0) {
        Collection.setFilters(filterUpdate);
    }
    const state = Collection.getState();
    const analyticsVisible = !document.getElementById('analytics-dashboard').classList.contains('hidden');

    const games = state.filters.games;
    const { sets, rarities } = Collection.getAvailableFilterOptions(games.length > 0 ? games : ['mtg', 'pokemon', 'lorcana', 'gundam']);
    UI.populateFilters(sets, rarities.all || []);

    state.filters.set.forEach(setName => {
        const checkbox = document.querySelector(`#set-options-container input[value="${CSS.escape(setName)}"]`);
        if (checkbox) checkbox.checked = true;
    });
    updateSetPills();
    state.filters.rarity.forEach(rarityName => {
        const checkbox = document.querySelector(`#filter-rarity-container input[value="${CSS.escape(rarityName)}"]`);
        if (checkbox) checkbox.checked = true;
    });
    
    if (analyticsVisible) {
        Analytics.initDashboard(state.filteredCollection);
    } else {
        const cardsToRender = state.activeTab === 'collection' ? state.filteredCollection : state.wishlist;
        const isBulkMode = state.bulkEdit.isActive;
        if (state.activeView === 'grid') UI.renderGridView(cardsToRender, state.activeTab, isBulkMode);
        else UI.renderListView(cardsToRender, state.activeTab, isBulkMode);
    }
    UI.updateStats(Collection.calculateCollectionStats(), state.activeTab);
}

function updateSetPills() {
    const pillsContainer = document.getElementById('set-pills-container');
    const optionsContainer = document.getElementById('set-options-container');
    if (!pillsContainer || !optionsContainer) return;

    pillsContainer.innerHTML = '';
    const checked = optionsContainer.querySelectorAll('input:checked');
    checked.forEach(checkbox => {
        const pill = document.createElement('div');
        pill.className = 'bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center';
        pill.dataset.value = checkbox.value;
        pill.innerHTML = `
            <span>${checkbox.value}</span>
            <button class="pill-remove ml-2 font-bold text-white hover:text-gray-200" data-value="${checkbox.value}">&times;</button>
        `;
        pillsContainer.appendChild(pill);
    });
}

function handleAnalyzeValueClick() {
    const dashboard = document.getElementById('analytics-dashboard');
    const collectionDisplay = document.getElementById('collection-display');
    const tabs = document.querySelector('[data-tab="collection"]').parentElement;
    
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
            Analytics.renderSingleCardChart(card, 'value-chart');
            UI.showToast(`Displaying history for ${card.name}. Re-apply filters or re-open dashboard to see total value.`, "info", 6000);
        }
    }
}

function clearFilters() {
    document.getElementById('filter-name').value = '';
    
    const setOptions = document.querySelectorAll('#set-options-container input');
    if (setOptions.length > 0) {
        setOptions.forEach(el => el.checked = false);
    }
    
    document.querySelectorAll('#filter-rarity-container input').forEach(el => el.checked = false);
    
    applyAndRender({
        name: '',
        set: [],
        rarity: []
    });
}

function handleBulkSelectAll() {
    const state = Collection.getState();
    const filteredIds = state.filteredCollection.map(c => c.id);
    Collection.selectAllFiltered(filteredIds);
    UI.updateBulkEditSelection(Collection.getSelectedCardIds().length);
    applyAndRender({});
}

async function handleBulkDeleteClick() {
    const selectedIds = Collection.getSelectedCardIds();
    if (selectedIds.length === 0) {
        UI.showToast("Please select cards to delete.", "error");
        return;
    }

    if (confirm(`Are you sure you want to delete ${selectedIds.length} selected cards? This cannot be undone.`)) {
        try {
            await Collection.batchDelete(selectedIds);
            UI.showToast(`${selectedIds.length} cards deleted successfully.`, "success");
            applyAndRender({});
        } catch (error) {
            console.error("Bulk delete failed:", error);
            UI.showToast("Failed to delete cards.", "error");
        }
    }
}

function handleBulkListClick() {
    const selectedIds = Collection.getSelectedCardIds();
    if (selectedIds.length === 0) {
        UI.showToast("Please select at least one card to list for sale.", "error");
        return;
    }
    UI.renderBulkReviewModal(selectedIds);
}

async function handleFinalizeBulkList(e) {
    const button = e.target.closest('#finalize-bulk-list-btn');
    UI.setButtonLoading(button, true, "Finalizing...");
    
    try {
        const updates = [];
        document.querySelectorAll('.bulk-review-item').forEach(item => {
            const cardId = item.dataset.id;
            const price = parseFloat(item.querySelector('.bulk-review-fixed-input').value);
            if(cardId && !isNaN(price) && price > 0) {
                updates.push({ id: cardId, data: { is_listed: true, salePrice: price } });
            }
        });

        if (updates.length > 0) {
            await Collection.batchUpdateSaleStatus(updates);
            UI.showToast(`${updates.length} cards have been listed for sale!`, "success");
        } else {
            UI.showToast("No cards with valid prices to list.", "info");
        }

        UI.closeModal(document.getElementById('bulk-review-modal'));
        applyAndRender({});

    } catch (error) {
        console.error("Finalizing bulk list failed:", error);
        UI.showToast("An error occurred while listing cards.", "error");
    } finally {
        UI.setButtonLoading(button, false, "Finalize and List Selected Cards");
    }
}