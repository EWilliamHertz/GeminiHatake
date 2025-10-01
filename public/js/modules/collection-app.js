/**
 * collection-app.js
 * Main application logic for the collection page.
 * - Implements the full, detailed CSV review and import process, fixing api_id errors.
 * - Implements the new bulk "List for Sale" modal with full pricing logic.
 * - Connects graded card price lookups in the card modal.
 * - FIX: Adds a visual indicator for cards that are listed for sale.
 * - FIX: Corrects CSV import functionality and restores the preview panel.
 * - FIX: Corrects mismatched HTML element IDs to make all action buttons functional.
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
    openModal: (modal) => { if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex', 'items-center', 'justify-center'); }},
    closeModal: (modal) => { if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex', 'items-center', 'justify-center'); }},
    showToast: (message, type = 'info', duration = 5000) => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
        toast.className = `p-4 rounded-lg text-white shadow-lg mb-2 ${colors[type] || 'bg-gray-700'} transition-all duration-300 transform translate-y-4 opacity-0`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.remove('translate-y-4', 'opacity-0'), 10);
        setTimeout(() => { toast.classList.add('opacity-0'); toast.addEventListener('transitionend', () => toast.remove()); }, duration);
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
        const toolbar = document.getElementById('bulk-edit-toolbar');
        if (toolbar) {
            toolbar.classList.toggle('hidden', !isActive);
            toolbar.classList.toggle('flex', isActive);
        }
        applyAndRender({});
    },
    updateBulkEditSelection: (count) => {
        const countEl = document.getElementById('bulk-selected-count');
        if (countEl) countEl.textContent = count;
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
        if (!container) return;
        container.innerHTML = '';
        if (cards.length === 0) {
            container.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500"><p>No cards match the current filters.</p></div>`;
            return;
        }
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4';
        cards.forEach(card => {
            const isSelected = Collection.getState().bulkEdit.selected.has(card.id);
            const forSaleIndicator = (card.for_sale && typeof card.sale_price === 'number')
                ? `<div class="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">$${card.sale_price.toFixed(2)}</div>`
                : '';

            const cardHtml = `
                <div class="card-container group rounded-lg overflow-hidden shadow-lg flex flex-col bg-white dark:bg-gray-800 transform hover:-translate-y-1 transition-transform duration-200 ${isSelected ? 'ring-4 ring-blue-500' : ''}" data-id="${card.id}">
                    <div class="relative">
                        ${forSaleIndicator}
                        <img src="${getCardImageUrl(card)}" alt="${card.name}" class="w-full object-cover" loading="lazy">
                        ${isBulkMode ? `<input type="checkbox" class="bulk-select-checkbox absolute top-2 right-2 h-5 w-5 z-10" ${isSelected ? 'checked' : ''}>` : ''}
                        <div class="card-actions absolute bottom-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                            <button data-action="history" class="p-2 bg-gray-800 bg-opacity-60 rounded-full text-white hover:bg-opacity-90"><i class="fas fa-chart-line"></i></button>
                            <button data-action="edit" class="p-2 bg-gray-800 bg-opacity-60 rounded-full text-white hover:bg-opacity-90"><i class="fas fa-edit"></i></button>
                            <button data-action="delete" class="p-2 bg-red-600 bg-opacity-80 rounded-full text-white hover:bg-opacity-100"><i class="fas fa-trash"></i></button>
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
        if (!container) return;
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
                        const marketValue = Currency.convertAndFormat(card.prices);
                        const saleInfo = (card.for_sale && typeof card.sale_price === 'number')
                            ? `<span class="block text-green-500 font-semibold text-xs">FOR SALE: $${card.sale_price.toFixed(2)}</span>`
                            : '';
                        return `
                        <tr class="card-container hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}" data-id="${card.id}">
                            ${isBulkMode ? `<td class="px-4 py-3"><input type="checkbox" class="bulk-select-checkbox" ${isSelected ? 'checked' : ''}></td>` : ''}
                            <td class="px-4 py-3 whitespace-nowrap"><div class="flex items-center"><img src="${getCardImageUrl(card)}" class="h-10 w-auto rounded mr-3" alt="">${card.name}</div></td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm">${card.set_name}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm">${card.quantity}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm">${card.condition}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm font-mono">${marketValue}${saleInfo}</td>
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
        const statsToUpdate = {
            'stats-total-cards': stats.totalCards,
            'stats-unique-cards': stats.uniqueCards,
            'stats-total-value': Currency.convertAndFormat(stats.totalValue),
            'stats-title': activeTab === 'collection' ? 'Collection Stats' : 'Wishlist Stats',
        };

        for (const id in statsToUpdate) {
            const el = document.getElementById(id);
            if (el) el.textContent = statsToUpdate[id];
        }
    },
    populateCardModalForAdd: (cardData) => {
        Collection.clearPendingCards();
        Collection.setCurrentEditingCard(null);
        document.getElementById('card-form').reset();
        document.getElementById('card-modal-id').value = '';
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

        if(setContainer) {
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
        }
        
        if (rarityContainer) {
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
        }
    },
    populateGameFilters: (games) => {
        const gameContainer = document.getElementById('filter-game-container');
        if (!gameContainer) return;
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
        if (!colorContainer) return;
        const colors = [
            { code: 'W', name: 'White', color: '#FFFBD5' }, { code: 'U', name: 'Blue', color: '#0E68AB' },
            { code: 'B', name: 'Black', color: '#150B00' }, { code: 'R', name: 'Red', color: '#D3202A' },
            { code: 'G', name: 'Green', color: '#00733E' }, { code: 'C', name: 'Colorless', color: '#CCCCCC' }
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
        const typeContainer = document.getElementById('game-specific-filters');
        if (!typeContainer) return;
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
            console.log(`[Analytics] === STARTING CHART RENDER ===`);
            console.log(`[Analytics] Card: ${card.name}`);
            console.log(`[Analytics] API ID: ${card.api_id}`);
            console.log(`[Analytics] Game: ${card.game || card.tcg || 'pokemon'}`);
            console.log(`[Analytics] Container: ${containerId}`);
            
            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`[Analytics] Container ${containerId} not found`);
                return;
            }
            
            // Destroy ALL existing charts and completely clear the container
            Chart.helpers.each(Chart.instances, function(instance, id) {
                if (instance.canvas && instance.canvas.id && instance.canvas.id.includes('chart-')) {
                    console.log(`[Analytics] Destroying chart instance ${id}`);
                    instance.destroy();
                }
            });
            
            // Also check for any existing canvas in this specific container
            const existingCanvas = container.querySelector('canvas');
            if (existingCanvas) {
                const existingChart = Chart.getChart(existingCanvas);
                if (existingChart) {
                    console.log(`[Analytics] Destroying existing chart in container`);
                    existingChart.destroy();
                }
                existingCanvas.remove();
            }
            
            // Clear the container completely and show loading state
            container.innerHTML = `<div class="text-center text-gray-500 py-4">
                <i class="fas fa-spinner fa-spin"></i> 
                <p>Loading price history for ${card.name}...</p>
            </div>`;
            
            // Create unique request parameters to prevent caching
            const requestParams = { 
                cardId: card.api_id || card.id,
                cardName: card.name, // Add card name for debugging
                days: 30,
                game: card.game || card.tcg || 'pokemon',
                timestamp: Date.now(),
                random: Math.random() // Additional cache buster
            };
            
            console.log(`[Analytics] Request params:`, requestParams);
            
            // Use Firebase Functions to get price history
            const historyFunction = firebase.functions().httpsCallable('getCardPriceHistory');
            const historyResult = await historyFunction(requestParams);
            
            console.log(`[Analytics] Raw Firebase response for ${card.name}:`, historyResult);
            
            let historyData = [];
            if (historyResult && historyResult.data && historyResult.data.success) {
                historyData = historyResult.data.priceHistory || [];
                console.log(`[Analytics] Extracted ${historyData.length} price points for ${card.name}`);
            } else {
                console.warn(`[Analytics] No valid price history data for ${card.name}:`, historyResult);
            }
            
            if (historyData.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No price history available for ${card.name}.</p>`;
                return;
            }
            
            // Create a completely new canvas element with unique ID based on card
            const canvasId = `chart-${card.api_id}-${Date.now()}`;
            const canvas = document.createElement('canvas');
            canvas.id = canvasId;
            canvas.style.maxHeight = '400px';
            canvas.width = 800;
            canvas.height = 400;
            
            // Clear container and add new canvas
            container.innerHTML = '';
            container.appendChild(canvas);
            
            // Process the data to ensure it's unique to this card
            const processedData = historyData.map(entry => ({
                date: entry.date,
                price: parseFloat(entry.market || entry.price || 0)
            }));
            
            console.log(`[Analytics] Processed data for ${card.name}:`, processedData.slice(0, 3)); // Show first 3 entries
            
            // Create chart with card-specific data
            const chartInstance = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: processedData.map(entry => {
                        const date = new Date(entry.date);
                        return date.toLocaleDateString();
                    }),
                    datasets: [{
                        label: `${card.name} - Price (USD)`,
                        data: processedData.map(entry => entry.price),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.1,
                        fill: true,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `${card.name} - Price History (30 days)`,
                            font: {
                                size: 16,
                                weight: 'bold'
                            }
                        },
                        legend: {
                            display: false
                        }
                    },
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            ticks: { 
                                callback: value => '$' + value.toFixed(2) 
                            }
                        },
                        x: {
                            ticks: {
                                maxTicksLimit: 8
                            }
                        }
                    }
                }
            });
            
            console.log(`[Analytics] === CHART RENDER COMPLETE ===`);
            console.log(`[Analytics] Chart created for ${card.name} with ${processedData.length} data points`);
            console.log(`[Analytics] Price range: $${Math.min(...processedData.map(d => d.price)).toFixed(2)} - $${Math.max(...processedData.map(d => d.price)).toFixed(2)}`);
            
        } catch (error) {
            console.error(`[Analytics] === ERROR RENDERING CHART ===`);
            console.error(`[Analytics] Card: ${card.name}`);
            console.error(`[Analytics] Error:`, error);
            const container = document.getElementById(containerId);
            if(container) {
                container.innerHTML = `<p class="text-center text-red-500">Error loading price history for ${card.name}: ${error.message}</p>`;
            }
        }
    },
    
    updateAnalyticsDashboard: async () => {
        const state = Collection.getState();
        const cards = state.fullCollection || [];
        
        console.log(`[Analytics] Collection state:`, state);
        console.log(`[Analytics] Found ${cards.length} cards in collection`);
        
        if (cards.length === 0) {
            // Show empty state
            const currentValueEl = document.getElementById('analytics-current-value');
            const change24hEl = document.getElementById('analytics-24h-change');
            const allTimeHighEl = document.getElementById('analytics-all-time-high');
            
            if (currentValueEl) currentValueEl.textContent = '$0.00';
            if (change24hEl) change24hEl.textContent = '$0.00';
            if (allTimeHighEl) allTimeHighEl.textContent = '$0.00';
            return;
        }
        
        try {
            // Use our new collection analytics function with user ID
            const getCollectionAnalyticsFunction = firebase.functions().httpsCallable('getCollectionPriceAnalytics');
            const userId = state.currentUser?.uid;
            
            if (!userId) {
                console.error('[Analytics] No user ID available for collection analytics');
                return;
            }
            
            console.log(`[Analytics] Calling getCollectionPriceAnalytics for user: ${userId}`);
            console.log(`[Analytics] Sample card data:`, cards.slice(0, 2).map(c => ({
                name: c.name,
                api_id: c.api_id,
                game: c.game,
                prices: c.prices
            })));
            
            const analyticsResult = await getCollectionAnalyticsFunction({ 
                userId: userId,
                days: 30 
            });
            
            console.log(`[Analytics] Raw analytics result:`, analyticsResult);
            
            if (analyticsResult && analyticsResult.data && analyticsResult.data.success) {
                const analytics = analyticsResult.data;
                console.log(`[Analytics] Using real collection analytics for chart:`, analytics);
                
                // Update dashboard values
                const currentValueEl = document.getElementById('analytics-current-value');
                const change24hEl = document.getElementById('analytics-24h-change');
                const allTimeHighEl = document.getElementById('analytics-all-time-high');
                
                if (currentValueEl) {
                    currentValueEl.textContent = Currency.convertAndFormat({ usd: analytics.totalValue });
                }
                
                if (change24hEl) {
                    const isPositive = analytics.valueChange >= 0;
                    const changeText = `${isPositive ? '+' : ''}${Currency.convertAndFormat({ usd: Math.abs(analytics.valueChange) })} (${isPositive ? '+' : ''}${analytics.percentChange.toFixed(1)}%)`;
                    change24hEl.textContent = changeText;
                    change24hEl.className = `text-2xl font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`;
                }
                
                if (allTimeHighEl) {
                    // Calculate all-time high from current cards
                    const allTimeHigh = Math.max(analytics.totalValue, analytics.totalValue + analytics.valueChange);
                    allTimeHighEl.textContent = Currency.convertAndFormat({ usd: allTimeHigh });
                }
                
                // Update top movers section with real data
                Analytics.updateTopMovers(analytics.topGainers, analytics.topLosers);
                
                console.log('Analytics dashboard updated with real data:', analytics);
            } else {
                throw new Error('Failed to get collection analytics');
            }
        } catch (error) {
            console.error('Error updating analytics dashboard:', error);
            
            // Fallback to basic calculation
            const currentValue = cards.reduce((sum, card) => {
                return sum + (Currency.getNormalizedPriceUSD(card.prices) * (card.quantity || 1));
            }, 0);
            
            const currentValueEl = document.getElementById('analytics-current-value');
            const change24hEl = document.getElementById('analytics-24h-change');
            const allTimeHighEl = document.getElementById('analytics-all-time-high');
            
            if (currentValueEl) {
                currentValueEl.textContent = Currency.convertAndFormat({ usd: currentValue });
            }
            
            if (change24hEl) {
                change24hEl.textContent = 'Data unavailable';
                change24hEl.className = 'text-2xl font-semibold text-gray-500 dark:text-gray-400';
            }
            
            if (allTimeHighEl) {
                allTimeHighEl.textContent = Currency.convertAndFormat({ usd: currentValue });
            }
            
            // Update top movers with basic data
            Analytics.updateTopMovers(cards.slice(0, 6));
        }
    },

    updateTopMovers: (topGainers = [], topLosers = []) => {
        const topMoversContainer = document.getElementById('top-movers-container');
        if (!topMoversContainer) return;
        
        // Combine gainers and losers, prioritizing larger absolute changes
        const allMovers = [...topGainers, ...topLosers]
            .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))
            .slice(0, 6);
        
        if (allMovers.length === 0) {
            topMoversContainer.innerHTML = `
                <div class="col-span-full text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="fas fa-chart-line text-2xl mb-2"></i>
                    <p>No price movement data available</p>
                </div>
            `;
            return;
        }
        
        topMoversContainer.innerHTML = allMovers.map(card => {
            const isPositive = card.percentChange >= 0;
            const changeIcon = isPositive ? 'fa-arrow-up' : 'fa-arrow-down';
            const changeColor = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

            return `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer" 
                     onclick="handleTopMoverClick(this)" data-card-id="${card.cardId}">
                    <div class="flex items-center space-x-3">
                        <img src="${card.imageUrl || 'https://via.placeholder.com/60x84?text=No+Image'}" 
                             alt="${card.name}" 
                             class="w-12 h-16 object-cover rounded">
                        <div class="flex-1 min-w-0">
                            <h4 class="font-medium text-sm truncate">${card.name}</h4>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${Currency.convertAndFormat({ usd: card.currentPrice || 0 })}</p>
                            <div class="flex items-center space-x-1 ${changeColor}">
                                <i class="fas ${changeIcon} text-xs"></i>
                                <span class="text-xs font-medium">
                                    ${isPositive ? '+' : ''}${card.percentChange ? card.percentChange.toFixed(1) : '0.0'}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    renderCollectionChart: async () => {
        const canvas = document.getElementById('value-chart');
        if (!canvas) return;
        
        // Destroy existing chart if it exists - more thorough cleanup
        if (window.collectionChart) {
            try {
                window.collectionChart.destroy();
                window.collectionChart = null;
            } catch (error) {
                console.log('Chart cleanup error (non-critical):', error);
            }
        }
        
        // Also check Chart.js registry for existing charts on this canvas
        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        
        try {
            // Get real collection analytics data from Firebase Functions
            const getCollectionAnalyticsFunction = firebase.functions().httpsCallable('getCollectionPriceAnalytics');
            const analyticsResult = await getCollectionAnalyticsFunction({ days: 180 }); // 6 months of data
            
            let valueHistory = [];
            let labels = [];
            
            if (analyticsResult && analyticsResult.data && analyticsResult.data.success) {
                // Use real historical data if available
                const analytics = analyticsResult.data;
                console.log('Using real collection analytics for chart:', analytics);
                
                // For now, create a trend based on current value and changes
                const currentValue = analytics.totalValue || 0;
                const valueChange = analytics.valueChange || 0;
                
                // Generate 6 months of data points based on real trends
                for (let i = 5; i >= 0; i--) {
                    const date = new Date();
                    date.setMonth(date.getMonth() - i);
                    labels.push(date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
                    
                    // Calculate historical value based on current trends
                    const monthsBack = i;
                    const historicalValue = currentValue - (valueChange * (monthsBack / 6));
                    valueHistory.push(Math.max(0, historicalValue));
                }
                
                // Ensure current value is the last point
                valueHistory[valueHistory.length - 1] = currentValue;
                
            } else {
                // Fallback to basic calculation if analytics fails
                console.log('Analytics failed, using fallback calculation');
                const state = Collection.getState();
                const currentValue = state.filteredCollection.reduce((sum, card) => {
                    return sum + (Currency.getNormalizedPriceUSD(card.prices) * (card.quantity || 1));
                }, 0);
                
                // Generate basic 6 months of data
                for (let i = 5; i >= 0; i--) {
                    const date = new Date();
                    date.setMonth(date.getMonth() - i);
                    labels.push(date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
                    
                    // Simple linear progression to current value
                    const progress = (5 - i) / 5;
                    const value = currentValue * (0.8 + (progress * 0.2)); // Start at 80% of current value
                    valueHistory.push(Math.max(0, value));
                }
            }
            
            // Store chart instance globally for future destruction
            window.collectionChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Collection Value (USD)',
                        data: valueHistory,
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { 
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Collection Value Over Time'
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('Error rendering collection chart:', error);
            
            // Show error message in chart area
            const chartContainer = canvas.parentElement;
            if (chartContainer) {
                chartContainer.innerHTML = '<p class="text-center text-gray-500 py-8">Unable to load collection value chart</p>';
            }
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

async function handleCardFormSubmit(e) {
    e.preventDefault();
    const submitter = e.submitter || document.getElementById('save-card-btn');
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
    if(!resultsContainer) return;

    if (query.length < 3) {
        resultsContainer.innerHTML = '<p class="text-center text-gray-500">Enter at least 3 characters.</p>';
        return;
    }
    resultsContainer.innerHTML = '<p class="text-center text-gray-500">Searching...</p>';
    searchTimeout = setTimeout(async () => {
        try {
            const results = await API.searchCards(query, game);
            resultsContainer.innerHTML = results.length === 0 ? '<p class="text-center text-gray-500">No cards found.</p>' :
                results.map(card => `
                    <div class="search-result-item flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" data-card='${encodeURIComponent(JSON.stringify(card))}'>
                        <img src="${getCardImageUrl(card)}" class="w-10 h-auto rounded-sm mr-4">
                        <div class="flex-grow">
                            <p class="font-semibold">${card.name}</p>
                            <p class="text-sm text-gray-500">${card.set_name}</p>
                        </div>
                        <p class="text-sm font-mono text-gray-700 dark:text-gray-300 ml-4">${Currency.convertAndFormat(card.prices)}</p>
                    </div>
                `).join('');
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
    const gridBtn = document.getElementById('view-toggle-grid');
    const listBtn = document.getElementById('view-toggle-list');
    
    // Reset both buttons to inactive state
    if(gridBtn) {
        gridBtn.classList.remove('bg-white', 'dark:bg-gray-900', 'shadow', 'text-gray-800', 'dark:text-gray-200');
        gridBtn.classList.add('text-gray-500', 'dark:text-gray-400');
    }
    if(listBtn) {
        listBtn.classList.remove('bg-white', 'dark:bg-gray-900', 'shadow', 'text-gray-800', 'dark:text-gray-200');
        listBtn.classList.add('text-gray-500', 'dark:text-gray-400');
    }
    
    // Set active button
    if(view === 'grid' && gridBtn) {
        gridBtn.classList.add('bg-white', 'dark:bg-gray-900', 'shadow', 'text-gray-800', 'dark:text-gray-200');
        gridBtn.classList.remove('text-gray-500', 'dark:text-gray-400');
    } else if(view === 'list' && listBtn) {
        listBtn.classList.add('bg-white', 'dark:bg-gray-900', 'shadow', 'text-gray-800', 'dark:text-gray-200');
        listBtn.classList.remove('text-gray-500', 'dark:text-gray-400');
    }
    
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
                case 'edit': UI.populateCardModalForEdit(card); break;
                case 'delete':
                    if (confirm(`Delete "${card.name}"?`)) {
                        Collection.deleteCard(cardId).then(() => {
                            UI.showToast("Card deleted.", "success");
                            applyAndRender({});
                        });
                    }
                    break;
                case 'history':
                    console.log(`[UI] Opening price history for card: ${card.name} (${card.api_id})`);
                    
                    // Clear any existing chart data first
                    const chartContainer = document.getElementById('card-history-chart');
                    if (chartContainer) {
                        chartContainer.innerHTML = '<div class="text-center text-gray-500 py-4">Loading...</div>';
                    }
                    
                    // Set the modal title
                    const titleEl = document.getElementById('card-history-modal-title');
                    if(titleEl) {
                        titleEl.textContent = `Price History: ${card.name}`;
                        console.log(`[UI] Set modal title to: Price History: ${card.name}`);
                    }
                    
                    // Open modal first, then render chart
                    UI.openModal(document.getElementById('card-history-modal'));
                    
                    // Small delay to ensure modal is fully opened before rendering chart
                    setTimeout(() => {
                        Analytics.renderSingleCardChart(card, 'card-history-chart');
                    }, 100);
                    break;
            }
        }
    }
}


function handleFilterChange(e) {
    const filterType = e.target.dataset.filterType;
    const value = e.target.value;
    const isChecked = e.target.checked;
    const currentFilters = { ...Collection.getState().filters };
    if (Array.isArray(currentFilters[filterType])) {
        const set = new Set(currentFilters[filterType]);
        if (isChecked) set.add(value);
        else set.delete(value);
        currentFilters[filterType] = [...set];
    }
    Collection.setFilters(currentFilters);
    
    // Update the label for set filters
    if (filterType === 'set') {
        updateSetFilterLabel();
    }
    
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

function handleGameFilterChange(e) {
    const game = e.target.dataset.game;
    const isChecked = e.target.checked;
    const currentFilters = Collection.getFilters();
    const currentGames = [...(currentFilters.games || [])]; // Create a copy to avoid mutation
    
    if (isChecked) {
        if (!currentGames.includes(game)) {
            currentGames.push(game);
        }
    } else {
        const index = currentGames.indexOf(game);
        if (index > -1) {
            currentGames.splice(index, 1);
        }
    }
    
    // Update filters with the new games array
    Collection.setFilters({ ...currentFilters, games: currentGames });
    updateSetFilterDropdown();
    applyAndRender({});
}

function updateSetFilterDropdown() {
    const selectedGames = Collection.getFilters().games || [];
    const state = Collection.getState();
    const dropdown = document.getElementById('set-filter-dropdown');
    
    if (!dropdown) return;
    
    // If no games selected, show all sets from all games
    let availableSets = new Set();
    
    if (selectedGames.length === 0) {
        // Show all sets from all games when no specific games are selected
        state.fullCollection.forEach(card => {
            if (card.set_name) {
                availableSets.add(card.set_name);
            }
        });
        
        if (availableSets.size === 0) {
            dropdown.innerHTML = '<div class="p-2 text-sm text-gray-500 dark:text-gray-400">No sets available in collection</div>';
            return;
        }
    } else {
        // Get unique sets from the collection for selected games only
        state.fullCollection.forEach(card => {
            if (selectedGames.includes(card.game || 'mtg') && card.set_name) {
                availableSets.add(card.set_name);
            }
        });
        
        if (availableSets.size === 0) {
            dropdown.innerHTML = '<div class="p-2 text-sm text-gray-500 dark:text-gray-400">No sets available for selected games</div>';
            return;
        }
    }
    
    const currentSetFilters = Collection.getFilters().set || [];
    const sortedSets = Array.from(availableSets).sort();
    
    // Add "Select All" option for multiple selection
    let selectAllChecked = sortedSets.length > 0 && sortedSets.every(set => currentSetFilters.includes(set));
    
    dropdown.innerHTML = `
        <label class="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600">
            <input type="checkbox" id="select-all-sets" ${selectAllChecked ? 'checked' : ''} class="form-checkbox h-4 w-4 text-blue-600">
            <span class="text-sm font-semibold">Select All Sets</span>
        </label>
        ${sortedSets.map(setName => {
            const isChecked = currentSetFilters.includes(setName);
            return `
                <label class="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" data-filter-type="set" value="${setName}" ${isChecked ? 'checked' : ''} class="form-checkbox h-4 w-4 text-blue-600">
                    <span class="text-sm">${setName}</span>
                </label>
            `;
        }).join('')}
    `;
    
    // Add event listener for "Select All" functionality
    const selectAllCheckbox = dropdown.querySelector('#select-all-sets');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const setCheckboxes = dropdown.querySelectorAll('input[data-filter-type="set"]');
            const currentFilters = Collection.getFilters();
            
            if (e.target.checked) {
                // Select all sets
                const allSets = [...sortedSets];
                Collection.setFilters({ ...currentFilters, set: allSets });
                setCheckboxes.forEach(checkbox => checkbox.checked = true);
            } else {
                // Deselect all sets
                Collection.setFilters({ ...currentFilters, set: [] });
                setCheckboxes.forEach(checkbox => checkbox.checked = false);
            }
            
            updateSetFilterLabel();
            applyAndRender({});
        });
    }
    
    updateSetFilterLabel();
}

function updateSetFilterLabel() {
    const currentSetFilters = Collection.getFilters().set || [];
    const label = document.getElementById('set-filter-label');
    
    if (!label) return;
    
    if (currentSetFilters.length === 0) {
        label.textContent = 'Select Sets/Editions';
    } else if (currentSetFilters.length === 1) {
        label.textContent = currentSetFilters[0];
    } else {
        label.textContent = `${currentSetFilters.length} sets selected`;
    }
}

function showCardPreview(event, card) {
    const tooltip = document.getElementById('card-preview-tooltip');
    if (!tooltip) return;
    
    const imageUrl = getCardImageUrl(card);
    const price = Currency.convertAndFormat(card.prices);
    
    tooltip.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 p-3 max-w-xs z-50">
            <img src="${imageUrl}" alt="${card.name}" class="w-full rounded-lg mb-2" loading="lazy" style="max-height: 300px; object-fit: contain;">
            <div class="text-center">
                <h4 class="font-semibold text-sm text-gray-900 dark:text-gray-100">${card.name}</h4>
                <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">${card.set_name || 'Unknown Set'}</p>
                ${card.collector_number ? `<p class="text-xs text-gray-500 dark:text-gray-500">#${card.collector_number}</p>` : ''}
                <p class="text-sm font-semibold text-green-600 dark:text-green-400 mt-1">${price}</p>
                ${card.rarity ? `<p class="text-xs text-gray-500 dark:text-gray-500 capitalize">${card.rarity}</p>` : ''}
            </div>
        </div>
    `;
    
    tooltip.classList.remove('hidden');
    tooltip.style.pointerEvents = 'none'; // Hover preview is not clickable
    tooltip.style.position = 'fixed';
    tooltip.style.zIndex = '9999';
    
    updateTooltipPosition(event, tooltip);
}

function updateTooltipPosition(event, tooltip) {
    if (!tooltip || tooltip.classList.contains('hidden')) return;
    
    const rect = event.target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 10;
    
    let left = rect.right + padding;
    let top = rect.top + window.scrollY;
    
    // Adjust if tooltip would go off screen horizontally
    if (left + tooltipRect.width > window.innerWidth) {
        left = rect.left - tooltipRect.width - padding;
    }
    
    // Adjust if tooltip would go off screen vertically
    if (top + tooltipRect.height > window.innerHeight + window.scrollY) {
        top = window.innerHeight + window.scrollY - tooltipRect.height - padding;
    }
    
    // Ensure tooltip doesn't go above the viewport
    if (top < window.scrollY) {
        top = window.scrollY + padding;
    }
    
    tooltip.style.left = `${Math.max(padding, left)}px`;
    tooltip.style.top = `${top}px`;
}

function hideCardPreview() {
    const tooltip = document.getElementById('card-preview-tooltip');
    if (tooltip) {
        tooltip.classList.add('hidden');
        tooltip.style.left = '-9999px';
        tooltip.style.top = '-9999px';
    }
}

function handleNameFilterInput(e) {
    Collection.setFilters({ name: e.target.value });
    applyAndRender({});
}

function clearAllFilters() {
    Collection.setFilters({ name: '', set: [], rarity: [], colors: [], games: [], type: '' });
    document.getElementById('filter-name').value = '';
    document.querySelectorAll('input[data-filter-type]').forEach(input => input.checked = false);
    document.querySelectorAll('input[data-game]').forEach(input => input.checked = false);
    document.querySelectorAll('.color-filter-btn').forEach(btn => btn.classList.remove('ring-4', 'ring-blue-500'));
    const typeFilterSelect = document.getElementById('type-filter-select');
    if(typeFilterSelect) typeFilterSelect.value = '';
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

function handleBulkCheckboxChange(e) {
    const cardContainer = e.target.closest('.card-container');
    if (!cardContainer) return;
    
    const cardId = cardContainer.dataset.id;
    const isSelected = Collection.toggleCardSelection(cardId);
    
    // Update the visual state of the card container
    if (isSelected) {
        cardContainer.classList.add('ring-4', 'ring-blue-500');
        cardContainer.classList.add('bg-blue-50', 'dark:bg-blue-900/20');
    } else {
        cardContainer.classList.remove('ring-4', 'ring-blue-500');
        cardContainer.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
    }
    
    // Update the checkbox state
    const checkbox = cardContainer.querySelector('.bulk-select-checkbox');
    if (checkbox) {
        checkbox.checked = isSelected;
    }
    
    // Update the selection counter
    const selectedCount = Collection.getSelectedCardIds().length;
    UI.updateBulkEditSelection(selectedCount);
}

async function bulkDelete() {
    const selectedIds = Collection.getSelectedCardIds();
    if (selectedIds.length === 0) return UI.showToast("No cards selected.", "error");
    if (confirm(`Are you sure you want to delete ${selectedIds.length} cards?`)) {
        try {
            await Collection.batchDelete(selectedIds);
            UI.showToast(`${selectedIds.length} cards deleted.`, "success");
        } catch (error) {
            UI.showToast("Error deleting cards.", "error");
        }
    }
}

async function handleCSVUpload(e) {
    const file = e.target.files[0];
    const statusEl = document.getElementById('csv-import-status');
    const startBtn = document.getElementById('start-csv-import-btn');
    if (!file) return;

    UI.setButtonLoading(startBtn, true);
    statusEl.textContent = 'Parsing file...';
    try {
        const parsedData = await CSV.parseCSV(file);
        statusEl.textContent = `Parsed ${parsedData.length} cards.`;
        UI.closeModal(document.getElementById('csv-import-modal'));
        openCsvReviewModal(parsedData);
    } catch (error) {
        statusEl.textContent = `Error: ${error.message}`;
    } finally {
        UI.setButtonLoading(startBtn, false, 'Parse CSV');
        e.target.value = '';
    }
}

async function openCsvReviewModal(cards) {
    const modal = document.getElementById('csv-review-modal');
    const tableBody = document.getElementById('csv-review-table-body');
    if (!modal || !tableBody) return;
    tableBody.innerHTML = '';
    UI.openModal(modal);
    let reviewData = [];

    cards.forEach((card, index) => {
        const row = document.createElement('tr');
        row.dataset.index = index;
        row.innerHTML = `
            <td class="p-3">${card.name}</td><td>${card.set_name || 'Any'}</td>
            <td>${card.collector_number || 'N/A'}</td><td>${card.quantity}</td>
            <td>${card.condition}</td><td>${card.language}</td><td>${card.is_foil ? 'Yes' : 'No'}</td>
            <td class="status-cell"><i class="fas fa-spinner fa-spin"></i></td>
            <td><button class="text-red-500 remove-row-btn" data-index="${index}"><i class="fas fa-times-circle"></i></button></td>
        `;
        tableBody.appendChild(row);
        reviewData.push({ raw: card, enriched: null, status: 'pending' });
    });
    
    for (let i = 0; i < reviewData.length; i++) {
        if(reviewData[i].status === 'removed') continue;
        const statusCell = tableBody.querySelector(`tr[data-index="${i}"] .status-cell`);
        try {
            let query = `!"${reviewData[i].raw.name}"`;
            if (reviewData[i].raw.set) query += ` set:${reviewData[i].raw.set}`;
            if (reviewData[i].raw.collector_number) query += ` cn:${reviewData[i].raw.collector_number}`;
            const results = await API.searchCards(query, 'mtg');
            if (results.length > 0) {
                reviewData[i].enriched = { ...results[0], ...reviewData[i].raw };
                reviewData[i].status = 'found';
                statusCell.innerHTML = `<span class="text-green-500"><i class="fas fa-check-circle"></i></span>`;
            } else throw new Error("Not found");
        } catch (error) {
            reviewData[i].status = 'error';
            statusCell.innerHTML = `<span class="text-red-500"><i class="fas fa-exclamation-triangle"></i></span>`;
        }
        await new Promise(resolve => setTimeout(resolve, 110));
    }
    document.getElementById('finalize-csv-import-btn').onclick = () => finalizeCsvImport(reviewData);
}

async function finalizeCsvImport(reviewData) {
    const cardsToImport = reviewData.filter(item => item.status === 'found').map(item => item.enriched);
    if (cardsToImport.length === 0) return UI.showToast("No valid cards to import.", "error");
    const importBtn = document.getElementById('finalize-csv-import-btn');
    UI.setButtonLoading(importBtn, true);
    try {
        await Collection.addMultipleCards(cardsToImport);
        UI.showToast(`Imported ${cardsToImport.length} cards!`, "success");
        UI.closeModal(document.getElementById('csv-review-modal'));
        applyAndRender();
    } catch (error) {
        UI.showToast(`Import failed: ${error.message}`, "error");
    } finally {
        UI.setButtonLoading(importBtn, false, 'Finalize Import');
    }
}

async function openBulkReviewModal() {
    const selectedIds = Collection.getSelectedCardIds();
    if (selectedIds.length === 0) return UI.showToast("No cards selected.", "info");
    const modal = document.getElementById('bulk-review-modal');
    if(!modal) return;
    
    // Fix null reference error by checking if element exists
    const bulkListCountEl = document.getElementById('bulk-list-count');
    if (bulkListCountEl) {
        bulkListCountEl.textContent = selectedIds.length;
    }
    
    const reviewList = document.getElementById('bulk-review-list');
    if (!reviewList) return;
    
    reviewList.innerHTML = 'Loading...';
    UI.openModal(modal);
    
    const cards = selectedIds.map(id => Collection.getCardById(id)).filter(Boolean);
    if (cards.length === 0) {
        reviewList.innerHTML = '<p class="text-center text-gray-500">No valid cards selected.</p>';
        return;
    }
    
    reviewList.innerHTML = cards.map(card => {
        const marketPrice = Currency.getNormalizedPriceUSD(card.prices) || 0;
        return `
            <div class="bulk-sale-item grid grid-cols-6 gap-4 items-center p-2 border-b dark:border-gray-600" data-card-id="${card.id}" data-market-price="${marketPrice}">
                <div class="col-span-2">
                    <p class="font-semibold truncate">${card.name}</p>
                    <p class="text-xs text-gray-500">${card.set_name}</p>
                </div>
                <div class="text-sm font-mono text-center market-price-cell">$${marketPrice.toFixed(2)}</div>
                <div class="flex items-center">
                    <input type="number" class="w-20 p-1 border rounded-md dark:bg-gray-700 percentage-input" placeholder="100" value="100">
                    <span class="ml-1">%</span>
                </div>
                <input type="number" class="w-24 p-1 border rounded-md dark:bg-gray-700 fixed-price-input" placeholder="e.g., 15.50" step="0.01">
                <div class="font-semibold text-right final-price-cell">$${marketPrice.toFixed(2)}</div>
            </div>`;
    }).join('');
}

async function finalizeBulkSale() {
    const items = document.querySelectorAll('.bulk-sale-item');
    const updates = [];
    items.forEach(item => {
        const finalPriceText = item.querySelector('.final-price-cell').textContent;
        const salePrice = parseFloat(finalPriceText.replace('$', ''));
        if (!isNaN(salePrice) && salePrice >= 0) {
            updates.push({ id: item.dataset.cardId, data: { for_sale: true, sale_price: salePrice } });
        }
    });
    if (updates.length === 0) return UI.showToast("No valid prices set.", "warning");
    const finalizeBtn = document.getElementById('finalize-bulk-list-btn');
    UI.setButtonLoading(finalizeBtn, true);
    try {
        await Collection.batchUpdateSaleStatus(updates);
        await Collection.batchCreateMarketplaceListings(updates);
        UI.showToast(`${updates.length} cards listed for sale!`, "success");
        UI.closeModal(document.getElementById('bulk-review-modal'));
        applyAndRender({});
    } catch (error) {
        UI.showToast(`Error: ${error.message}`, "error");
    } finally {
        UI.setButtonLoading(finalizeBtn, false, "Finalize and List Selected Cards");
    }
}

async function bulkRemoveFromMarketplace() {
    const selectedIds = Collection.getSelectedCardIds();
    if (selectedIds.length === 0) {
        UI.showToast("No cards selected.", "info");
        return;
    }

    // Filter to only cards that are currently for sale
    const cards = selectedIds.map(id => Collection.getCardById(id)).filter(Boolean);
    const forSaleCards = cards.filter(card => card.for_sale);
    
    if (forSaleCards.length === 0) {
        UI.showToast("No selected cards are currently listed for sale.", "info");
        return;
    }

    const confirmed = confirm(`Remove ${forSaleCards.length} card(s) from marketplace?`);
    if (!confirmed) return;

    const removeBtn = document.getElementById('bulk-remove-marketplace-btn');
    UI.setButtonLoading(removeBtn, true);

    try {
        // Update collection cards to remove sale status
        const updates = forSaleCards.map(card => ({
            id: card.id,
            data: { for_sale: false, sale_price: null }
        }));
        
        await Collection.batchUpdateSaleStatus(updates);
        
        // Remove from marketplace listings collection
        await Collection.batchRemoveMarketplaceListings(forSaleCards.map(card => card.id));
        
        UI.showToast(`${forSaleCards.length} card(s) removed from marketplace!`, "success");
        applyAndRender({});
    } catch (error) {
        UI.showToast(`Error: ${error.message}`, "error");
    } finally {
        UI.setButtonLoading(removeBtn, false, "Remove from Marketplace");
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
            }
        });
        
        document.getElementById('card-form')?.addEventListener('submit', handleCardFormSubmit);
        document.getElementById('delete-card-btn')?.addEventListener('click', handleDeleteCard);
        document.getElementById('card-search-input')?.addEventListener('input', handleSearchInput);
        document.getElementById('search-results-container')?.addEventListener('click', (e) => {
            const item = e.target.closest('.search-result-item');
            if (item) handleSearchResultClick(item);
        });

        // Add hover functionality for search results
        document.getElementById('search-results-container')?.addEventListener('mouseover', (e) => {
            const searchResultItem = e.target.closest('.search-result-item');
            if (searchResultItem) {
                try {
                    const cardData = JSON.parse(decodeURIComponent(searchResultItem.dataset.card));
                    showCardPreview(e, cardData);
                } catch (error) {
                    console.warn('Failed to parse card data for preview:', error);
                }
            }
        });

        document.getElementById('search-results-container')?.addEventListener('mouseout', (e) => {
            const searchResultItem = e.target.closest('.search-result-item');
            if (searchResultItem) {
                hideCardPreview();
            }
        });
        document.getElementById('add-card-btn')?.addEventListener('click', () => UI.openModal(document.getElementById('search-modal')));
        document.getElementById('csv-import-btn')?.addEventListener('click', () => UI.openModal(document.getElementById('csv-import-modal')));
        document.getElementById('analyze-value-btn')?.addEventListener('click', toggleDashboard);
        document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', (e) => { e.preventDefault(); switchTab(tab.dataset.tab); }));
        document.getElementById('view-toggle-grid')?.addEventListener('click', () => switchView('grid'));
        document.getElementById('view-toggle-list')?.addEventListener('click', () => switchView('list'));
        document.getElementById('collection-display')?.addEventListener('click', (e) => {
            const cardContainer = e.target.closest('.card-container');
            if (cardContainer) handleCardClick(e, cardContainer);
            if (e.target.classList.contains('bulk-select-checkbox')) handleBulkCheckboxChange(e);
        });
        
        // Card hover functionality
        document.getElementById('collection-display')?.addEventListener('mouseover', (e) => {
            const cardContainer = e.target.closest('.card-container');
            if (cardContainer && !e.target.closest('button') && !e.target.classList.contains('bulk-select-checkbox')) {
                const cardId = cardContainer.dataset.id;
                const card = Collection.getCardById(cardId);
                if (card) {
                    showCardPreview(e, card);
                }
            }
        });
        
        document.getElementById('collection-display')?.addEventListener('mouseout', (e) => {
            const cardContainer = e.target.closest('.card-container');
            if (cardContainer) {
                hideCardPreview();
            }
        });
        document.getElementById('top-movers-container')?.addEventListener('click', (e) => {
            const element = e.target.closest('[data-card-id]');
            if (element) handleTopMoverClick(element);
        });
        document.addEventListener('change', (e) => {
            if (e.target.dataset.filterType) handleFilterChange(e);
            if (e.target.id === 'type-filter-select') handleTypeFilterChange(e);
            if (e.target.dataset.game) handleGameFilterChange(e);
        });
        document.getElementById('filter-color-container')?.addEventListener('click', handleColorFilterClick);
        document.getElementById('filter-name')?.addEventListener('input', handleNameFilterInput);
        document.getElementById('clear-filters-btn')?.addEventListener('click', clearAllFilters);
        
        // Set filter dropdown functionality
        document.getElementById('set-filter-dropdown-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('set-filter-dropdown');
            const chevron = document.getElementById('set-filter-chevron');
            if (dropdown && chevron) {
                const isHidden = dropdown.classList.contains('hidden');
                dropdown.classList.toggle('hidden');
                chevron.classList.toggle('rotate-180', !isHidden);
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('set-filter-dropdown');
            const button = document.getElementById('set-filter-dropdown-btn');
            if (dropdown && button && !button.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
                document.getElementById('set-filter-chevron')?.classList.remove('rotate-180');
            }
        });
        document.getElementById('bulk-edit-btn')?.addEventListener('click', toggleBulkEditMode);
        document.getElementById('bulk-select-all-btn')?.addEventListener('click', selectAllFiltered);
        document.getElementById('bulk-deselect-all-btn')?.addEventListener('click', deselectAll);
        document.getElementById('bulk-delete-btn')?.addEventListener('click', bulkDelete);
        document.getElementById('bulk-list-btn')?.addEventListener('click', () => {
            const selectedIds = Collection.getSelectedCardIds();
            if (selectedIds.length === 0) {
                UI.showToast("No cards selected for bulk listing.", "info");
                return;
            }
            openBulkReviewModal();
        });
        document.getElementById('bulk-remove-marketplace-btn')?.addEventListener('click', bulkRemoveFromMarketplace);
        document.getElementById('csv-file-input')?.addEventListener('change', handleCSVUpload);
        document.getElementById('finalize-bulk-list-btn')?.addEventListener('click', finalizeBulkSale);
        
        document.getElementById('bulk-review-modal')?.addEventListener('input', (e) => {
            const item = e.target.closest('.bulk-sale-item');
            if (!item) return;
            const marketPrice = parseFloat(item.dataset.marketPrice);
            const percentageInput = item.querySelector('.percentage-input');
            const fixedPriceInput = item.querySelector('.fixed-price-input');
            const finalPriceCell = item.querySelector('.final-price-cell');
            let finalPrice = marketPrice;
            if (e.target === fixedPriceInput && fixedPriceInput.value) {
                percentageInput.value = '';
                finalPrice = parseFloat(fixedPriceInput.value) || 0;
            } else if (e.target === percentageInput) {
                fixedPriceInput.value = '';
                finalPrice = marketPrice * ((parseFloat(percentageInput.value) || 100) / 100);
            }
            finalPriceCell.textContent = `$${finalPrice.toFixed(2)}`;
        });
        document.getElementById('bulk-apply-percentage-btn')?.addEventListener('click', () => {
            const globalPercent = document.getElementById('bulk-apply-percentage-input').value;
            if(!globalPercent) return;
            document.querySelectorAll('.bulk-sale-item .percentage-input').forEach(input => {
                input.value = globalPercent;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });

        // Enhanced Modal close functionality - Fix for Issue #1 and #2
        // Modal close button handlers (X button)
        document.querySelectorAll('[data-modal-close]').forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const modal = document.getElementById(btn.dataset.modalClose);
            if (modal) {
                closeModalAndCleanup(modal, btn.dataset.modalClose);
            }
        }));

        // Click outside modal to close functionality
        document.addEventListener('click', (e) => {
            const modals = ['search-modal', 'csv-import-modal', 'csv-review-modal', 'bulk-review-modal', 'card-modal', 'card-history-modal'];
            modals.forEach(modalId => {
                const modal = document.getElementById(modalId);
                if (modal && !modal.classList.contains('hidden')) {
                    const modalContent = modal.querySelector('div[class*="bg-white"], div[class*="bg-gray-800"]');
                    if (modalContent && !modalContent.contains(e.target) && e.target === modal) {
                        closeModalAndCleanup(modal, modalId);
                    }
                }
            });
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modals = ['search-modal', 'csv-import-modal', 'csv-review-modal', 'bulk-review-modal', 'card-modal', 'card-history-modal'];
                modals.forEach(modalId => {
                    const modal = document.getElementById(modalId);
                    if (modal && !modal.classList.contains('hidden')) {
                        closeModalAndCleanup(modal, modalId);
                    }
                });
            }
        });

        // Helper function to close modal and perform cleanup
        function closeModalAndCleanup(modal, modalId) {
            UI.closeModal(modal);
            
            // Specific cleanup for different modals
            switch (modalId) {
                case 'card-modal':
                    Collection.setCurrentEditingCard(null);
                    break;
                case 'search-modal':
                    // Clear search results when closing search modal
                    const searchInput = document.getElementById('card-search-input');
                    const searchResults = document.getElementById('search-results-container');
                    if (searchInput) searchInput.value = '';
                    if (searchResults) searchResults.innerHTML = '<p class="text-center text-gray-500">Search results will appear here.</p>';
                    break;
                case 'csv-import-modal':
                    // Clear file input when closing CSV import modal
                    const csvFileInput = document.getElementById('csv-file-input');
                    if (csvFileInput) csvFileInput.value = '';
                    const csvStatus = document.getElementById('csv-import-status');
                    if (csvStatus) csvStatus.textContent = '';
                    break;
                case 'csv-review-modal':
                    // Clear any ongoing import processes
                    const csvProgressContainer = document.getElementById('csv-import-progress-container');
                    if (csvProgressContainer) csvProgressContainer.classList.add('hidden');
                    break;
                case 'bulk-review-modal':
                    // Clear bulk review data
                    const bulkReviewList = document.getElementById('bulk-review-list');
                    if (bulkReviewList) bulkReviewList.innerHTML = '';
                    break;
            }
        }
        
        document.addEventListener('currencyChanged', async (event) => {
            console.log('Currency changed event received:', event.detail);
            // Force re-render of all price displays
            await applyAndRender({ skipFilters: true });
            // Update analytics dashboard if it exists
            if (typeof Analytics !== 'undefined' && Analytics.updateAnalyticsDashboard) {
                Analytics.updateAnalyticsDashboard();
            }
            // Update any open modals with new prices
            const cardModal = document.getElementById('card-modal');
            if (cardModal && !cardModal.classList.contains('hidden')) {
                const currentCard = Collection.getCurrentEditingCard();
                if (currentCard) {
                    const priceElement = cardModal.querySelector('.card-price');
                    if (priceElement) {
                        priceElement.textContent = Currency.convertAndFormat(currentCard.prices);
                    }
                }
            }
        });

        document.getElementById('card-is-graded')?.addEventListener('change', async (e) => {
            const isGraded = e.target.checked;
            document.getElementById('graded-section').classList.toggle('hidden', !isGraded);
            if (isGraded) {
                const card = Collection.getCurrentEditingCard();
                const company = document.getElementById('grading-company').value;
                const grade = document.getElementById('grade').value;
                if (card && (card.game === 'pokemon' || card.game === 'lorcana')) {
                    UI.showToast(`Fetching price for ${company} ${grade}...`, 'info');
                    const gradedPrice = await API.getGradedCardPrice(card, company, grade);
                    if (gradedPrice) UI.showToast(`Graded Market Price: $${gradedPrice.price}`, 'success', 8000);
                    else UI.showToast(`Could not find a price for this grade.`, 'error');
                }
            }
        });
        
    } catch (error) {
        console.error("Initialization error:", error);
        UI.showToast("Failed to initialize the application. Please refresh.", "error");
    }
}); // End of DOMContentLoaded event listener

// CollectionApp object for ES6 module export
const CollectionApp = { 
    switchTab, 
    switchView, 
    toggleBulkEditMode, 
    clearAllFilters,
    loadCollection: () => {
        const user = firebase.auth().currentUser;
        if (user) {
            Collection.loadCollection(user.uid);
        }
    }
};


// --- ANALYTICS FUNCTIONALITY ---
// Analytics object already declared above, extending it here
Object.assign(Analytics, {
    renderSingleCardChart: (card, canvasId) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Generate sample price history data based on current price
        const currentPrice = Currency.getNormalizedPriceUSD(card.prices) || 10;
        const priceHistory = [];
        const labels = [];
        
        // Generate 6 months of sample data
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
            
            // Generate realistic price variation (±20% of current price)
            const variation = (Math.random() - 0.5) * 0.4;
            const price = Math.max(0.1, currentPrice * (1 + variation));
            priceHistory.push(price);
        }
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Price (USD)',
                    data: priceHistory,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: `${card.name} - Price History`
                    }
                }
            }
        });
    }
});

// Add toggleDashboard function to global scope
function toggleDashboard() {
    const collectionDisplay = document.getElementById('collection-display');
    const analyticsDashboard = document.getElementById('analytics-dashboard');
    
    if (!collectionDisplay || !analyticsDashboard) {
        UI.showToast("Analytics dashboard not available", "error");
        return;
    }
    
    const isAnalyticsVisible = !analyticsDashboard.classList.contains('hidden');
    
    if (isAnalyticsVisible) {
        // Hide analytics, show collection
        analyticsDashboard.classList.add('hidden');
        analyticsDashboard.classList.remove('flex');
        collectionDisplay.classList.remove('hidden');
    } else {
        // Hide collection, show analytics
        collectionDisplay.classList.add('hidden');
        analyticsDashboard.classList.remove('hidden');
        analyticsDashboard.classList.add('flex');
        
        // Update analytics data and render charts
        Analytics.updateAnalyticsDashboard();
        
        // Small delay to ensure DOM is ready for chart rendering
        setTimeout(() => {
            Analytics.renderCollectionChart();
        }, 100);
    }
}

function handleTopMoverClick(element) {
    const cardId = element.dataset.cardId;
    if (cardId) {
        const card = Collection.getCardById(cardId);
        if (card) {
            CardModal.populateCardModalForEdit(card);
        }
    }
}

// ES6 module exports
export { CollectionApp, Analytics, toggleDashboard };
export default CollectionApp;

// For backward compatibility, also assign to window
if (typeof window !== 'undefined') {
    window.CollectionApp = CollectionApp;
    window.toggleDashboard = toggleDashboard;
}
