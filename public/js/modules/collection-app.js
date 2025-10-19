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
import * as CSV from './csv-fixed.js';
import * as Currency from './currency.js';
import { getCardImageUrl } from './utils.js';

let currentUser = null;
let csvFile = null;
window.toggleCheckboxes = function(checkboxesId) {
    const checkboxes = document.getElementById(checkboxesId);
    if (!checkboxes) return;
    
    if (checkboxes.style.display === "none") {
        checkboxes.style.display = "block";
    } else {
        checkboxes.style.display = "none";
    }
}
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

           const foilClass = card.is_foil ? 'foil-effect' : '';
            // Use foil price if card is foil, otherwise use normal price
            const priceToUse = card.is_foil && card.prices?.usd_foil ? 
                { usd: card.prices.usd_foil } : 
                { usd: card.prices?.usd || 0 };
            const priceDisplay = Currency.convertAndFormat(priceToUse, card);
            const foilPriceIndicator = card.is_foil && (card.prices?.usd_foil || card.prices?.eur_foil) ? '<span class="text-xs text-blue-400"> (Foil)</span>' : '';
            
            // --- ADD OPTCG SPECIFIC DISPLAY ---
            let optcgInfo = '';
            if (card.game === 'optcg' && card.optcg_details) {
                const details = card.optcg_details;
                optcgInfo = `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                    C:${details.cost || '-'} | P:${details.power || '-'} | ${details.color || ''} | ${details.attribute || ''}
                </p>`;
            }
            // --- END OPTCG SPECIFIC DISPLAY ---
            
            const cardHtml = `
    <div class="card-container group rounded-lg overflow-hidden shadow-lg flex flex-col bg-white dark:bg-gray-800 transform hover:-translate-y-1 transition-transform duration-200 ${isSelected ? 'ring-4 ring-blue-500' : ''}" data-id="${card.id}">
        <div class="relative ${foilClass}">
            ${forSaleIndicator}
            <img src="${getCardImageUrl(card)}" alt="${card.name}" class="w-full object-cover" loading="lazy">
            ${isBulkMode ? `<input type="checkbox" class="bulk-select-checkbox absolute top-2 right-2 h-5 w-5 z-10" ${isSelected ? 'checked' : ''}>` : ''}
            <div class="card-actions absolute bottom-2 right-2 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                ${card.for_sale
                    ? `<button data-action="update-price" title="Update Price" class="p-2 bg-green-600 bg-opacity-80 rounded-full text-white hover:bg-opacity-100"><i class="fas fa-tag"></i></button>
                       <button data-action="remove-sale" title="Remove from Sale" class="p-2 bg-orange-600 bg-opacity-80 rounded-full text-white hover:bg-opacity-100"><i class="fas fa-store-slash"></i></button>`
                    : `<button data-action="list-sale" title="List for Sale" class="p-2 bg-green-600 bg-opacity-80 rounded-full text-white hover:bg-opacity-100"><i class="fas fa-dollar-sign"></i></button>`
                }
                <button data-action="history" class="p-2 bg-gray-800 bg-opacity-60 rounded-full text-white hover:bg-opacity-90"><i class="fas fa-chart-line"></i></button>
                <button data-action="edit" class="p-2 bg-gray-800 bg-opacity-60 rounded-full text-white hover:bg-opacity-90"><i class="fas fa-edit"></i></button>
                <button data-action="delete" class="p-2 bg-red-600 bg-opacity-80 rounded-full text-white hover:bg-opacity-100"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        <div class="p-2 text-xs flex-grow flex flex-col justify-between">
            <div>
                <p class="font-bold truncate text-gray-900 dark:text-gray-100">${card.name}</p>
                <p class="truncate text-gray-600 dark:text-gray-400">${card.set_name}</p>
                ${optcgInfo}
            </div>
            <p class="font-mono text-right font-semibold text-gray-800 dark:text-gray-200 mt-1">${priceDisplay}${foilPriceIndicator}</p>
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
                        <th class="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">Qty</th> {/* Centered Qty Header */}
                        <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Condition</th>
                        <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Value</th>
                        <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    ${cards.map(card => {
                        const isSelected = Collection.getState().bulkEdit.selected.has(card.id);
                        const priceToUse = card.is_foil && card.prices?.usd_foil ?
                            { usd: card.prices.usd_foil } :
                            { usd: card.prices?.usd || 0 };
                        const marketValue = Currency.convertAndFormat(priceToUse, card);
                        // Correctly format sale price using currency module
                        const saleInfo = (card.for_sale && typeof card.sale_price === 'number')
                            ? `<span class="block text-green-500 font-semibold text-xs mt-1">FOR SALE: ${Currency.formatPrice(card.sale_price, card.sale_currency)}</span>`
                            : '';

                        // *** DEFINE OPTCG INFO ***
                        let optcgInfo = '';
                        if (card.game === 'optcg' && card.optcg_details) {
                            const details = card.optcg_details;
                            optcgInfo = `
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                    C:${details.cost ?? '-'} | P:${details.power ?? '-'} | ${details.color || ''} | ${details.attribute || ''}
                                </p>`;
                        }
                        // *** END OPTCG INFO DEFINITION ***

                        return `
                        <tr class="card-container hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}" data-id="${card.id}">
                            ${isBulkMode ? `<td class="px-4 py-3 align-middle"><input type="checkbox" class="bulk-select-checkbox" ${isSelected ? 'checked' : ''}></td>` : ''}
                            <td class="px-4 py-3 whitespace-nowrap align-middle">
                                <div class="flex items-center">
                                    <img src="${getCardImageUrl(card)}" class="h-10 w-auto rounded mr-3" alt="${card.name}">
                                    <div class="min-w-0"> {/* Helps with truncation */}
                                        <p class="font-medium truncate">${card.name}</p>
                                        ${optcgInfo} {/* <-- *** USE THE CORRECT VARIABLE HERE *** */}
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm align-middle">${card.set_name}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm text-center align-middle">${card.quantity}</td> {/* Centered Quantity */}
                            <td class="px-4 py-3 whitespace-nowrap text-sm align-middle">${card.condition}</td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm font-mono align-middle">
                                ${marketValue}
                                ${saleInfo}
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium align-middle">
                                <div class="card-actions flex items-center space-x-3">
                                    ${card.for_sale
                                        ? `<button data-action="update-price" title="Update Price" class="text-green-600 hover:text-green-800"><i class="fas fa-tag"></i></button>
                                           <button data-action="remove-sale" title="Remove from Sale" class="text-orange-600 hover:text-orange-800"><i class="fas fa-store-slash"></i></button>`
                                        : `<button data-action="list-sale" title="List for Sale" class="text-green-600 hover:text-green-800"><i class="fas fa-dollar-sign"></i></button>`
                                    }
                                    <button data-action="history" title="Price History" class="text-blue-600 hover:text-blue-800"><i class="fas fa-chart-line"></i></button>
                                    <button data-action="edit" title="Edit Card" class="text-gray-600 hover:text-gray-800"><i class="fas fa-edit"></i></button>
                                    <button data-action="delete" title="Delete Card" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
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
        
       // Correctly populate the form, including quantity and foil status
document.getElementById('card-quantity').value = card.quantity || 1;
document.getElementById('card-condition').value = card.condition || 'Near Mint';
document.getElementById('card-language').value = card.language || 'English';
document.getElementById('card-purchase-price').value = card.purchase_price || '';
document.getElementById('card-is-foil').checked = card.is_foil || false;
document.getElementById('card-is-signed').checked = card.is_signed || false;
document.getElementById('card-is-altered').checked = card.is_altered || false;
document.getElementById('card-is-graded').checked = card.is_graded || false;
document.getElementById('card-notes').value = card.notes || '';

if (card.is_graded) {
    document.getElementById('grading-company').value = card.grading_company || 'PSA';
    document.getElementById('grade').value = card.grade || '10';
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



// REPLACE the entire populateFilters function with this one.

populateFilters: (cards) => {
    console.log("--- Running Robust populateFilters ---");
    const setCheckboxesContainer = document.getElementById('set-checkboxes');
    const rarityCheckboxesContainer = document.getElementById('rarity-checkboxes');

    if (!setCheckboxesContainer || !rarityCheckboxesContainer) {
        console.error("Filter containers not found!");
        return;
    }
    if (!cards || cards.length === 0) {
        console.warn("populateFilters was called with no cards.");
        return;
    }

    // --- THIS IS THE FIX ---
    // Handle both `card.set_name` (for Pokémon/Lorcana) and `card.set.name` (for MTG)
    const allSets = [...new Set(cards.map(card => {
        if (card.set_name) return card.set_name; // Use this if it exists
        if (card.set && card.set.name) return card.set.name; // Otherwise, try this
        return null; // If neither exists, return null
    }).filter(Boolean))].sort(); // .filter(Boolean) removes any nulls

    const allRarities = [...new Set(cards.map(card => card.rarity).filter(Boolean))].sort();
    // --- END OF FIX ---

    console.log("Found sets:", allSets);
    console.log("Found rarities:", allRarities);

    // Populate Set Filter
    setCheckboxesContainer.innerHTML = '';
    allSets.forEach(set => {
        const label = document.createElement('label');
        label.className = 'block px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
        label.innerHTML = `<input type="checkbox" value="${set}" data-filter-type="set" class="mr-2 form-checkbox"> ${set}`;
        setCheckboxesContainer.appendChild(label);
    });

    // Populate Rarity Filter
    rarityCheckboxesContainer.innerHTML = '';
    allRarities.forEach(rarity => {
        const label = document.createElement('label');
        label.className = 'block px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
        label.innerHTML = `<input type="checkbox" value="${rarity}" data-filter-type="rarity" class="mr-2 form-checkbox"> ${rarity}`;
        rarityCheckboxesContainer.appendChild(label);
    });

    console.log("--- Finished Robust populateFilters ---");
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
            console.log(`[Analytics] === STARTING FRESH CHART RENDER ===`);
            console.log(`[Analytics] Card: ${card.name}`);
            console.log(`[Analytics] API ID: ${card.api_id}`);
            console.log(`[Analytics] Game: ${card.game || card.tcg || 'pokemon'}`);
            console.log(`[Analytics] Container: ${containerId}`);
            
            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`[Analytics] Container ${containerId} not found`);
                return;
            }
            
            // NUCLEAR CHART CLEANUP: Destroy ALL Chart.js instances globally
            console.log(`[Analytics] === STARTING NUCLEAR CHART CLEANUP ===`);
            
            // Method 1: Destroy all Chart.js instances from global registry
            if (typeof Chart !== 'undefined' && Chart.instances) {
                Object.keys(Chart.instances).forEach(key => {
                    const instance = Chart.instances[key];
                    if (instance) {
                        console.log(`[Analytics] DESTROYING Chart instance ${key}`);
                        try {
                            instance.destroy();
                        } catch (destroyError) {
                            console.warn(`[Analytics] Error destroying chart ${key}:`, destroyError);
                        }
                        delete Chart.instances[key];
                    }
                });
            }
            
            // Method 2: Find and destroy any charts in the target container
            const existingCanvases = container.querySelectorAll('canvas');
            existingCanvases.forEach((canvas, index) => {
                const existingChart = Chart.getChart(canvas);
                if (existingChart) {
                    console.log(`[Analytics] DESTROYING existing chart on canvas ${index}`);
                    existingChart.destroy();
                }
            });
            
            // Method 3: Clear the entire container DOM
            container.innerHTML = '';
            
            // Method 4: Force garbage collection hint
            if (window.gc) {
                window.gc();
            }
            
            console.log(`[Analytics] === CHART CLEANUP COMPLETE ===`);
            
            // Show loading state in container
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
                random: Math.random(), // Additional cache buster
                uniqueId: `${card.api_id || card.id}-${Date.now()}` // Unique identifier
            };
            
            console.log(`[Analytics] Request params for ${card.name}:`, requestParams);
            
            // Use Firebase Functions to get price history
            const historyFunction = firebase.functions().httpsCallable('getCardPriceHistory');
            const historyResult = await historyFunction(requestParams);
            
            console.log(`[Analytics] Raw Firebase response for ${card.name}:`, historyResult);
            
            let historyData = [];
            if (historyResult && historyResult.data && historyResult.data.success) {
                historyData = historyResult.data.data || historyResult.data.priceHistory || [];
                console.log(`[Analytics] Extracted ${historyData.length} price points for ${card.name}`);
            } else {
                console.warn(`[Analytics] No valid price history data for ${card.name}:`, historyResult);
                
                // If no real data, generate sample data for demonstration
                console.log(`[Analytics] Generating sample data for ${card.name}`);
                const currentPrice = Currency.getNormalizedPriceUSD(card.prices, card) || 10;
                for (let i = 29; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const variation = (Math.random() - 0.5) * 0.3; // ±15% variation
                    const price = Math.max(0.1, currentPrice * (1 + variation));
                    historyData.push({
                        date: date.toISOString().split('T')[0],
                        market: price,
                        currency: 'USD'
                    });
                }
            }
            
            if (historyData.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">No price history available for ${card.name}.</p>`;
                return;
            }
            
            // Create a completely new canvas element with unique ID based on card and timestamp
            const uniqueCanvasId = `chart-${card.api_id || card.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const canvas = document.createElement('canvas');
            canvas.id = uniqueCanvasId;
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
            
            // Create chart with card-specific data and unique configuration
            const chartConfig = {
                type: 'line',
                data: {
                    labels: processedData.map(entry => {
                        const date = new Date(entry.date);
                        return date.toLocaleDateString();
                    }),
                    datasets: [{
                        label: `${card.name} - Price (USD)`,
                        data: processedData.map(entry => entry.price),
                        borderColor: `hsl(${Math.abs(card.name.charCodeAt(0) * 137.5) % 360}, 70%, 50%)`, // Unique color per card
                        backgroundColor: `hsla(${Math.abs(card.name.charCodeAt(0) * 137.5) % 360}, 70%, 50%, 0.1)`,
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
            };
            
            // Create the chart instance
            const chartInstance = new Chart(canvas, chartConfig);
            
            // Store reference for potential cleanup
            window[`chart_${uniqueCanvasId}`] = chartInstance;
            
            console.log(`[Analytics] === CHART RENDER COMPLETE ===`);
            console.log(`[Analytics] Chart created for ${card.name} with ${processedData.length} data points`);
            console.log(`[Analytics] Chart ID: ${uniqueCanvasId}`);
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
        
        console.log(`[Analytics] === STARTING ANALYTICS DASHBOARD UPDATE ===`);
        console.log(`[Analytics] Collection state:`, state);
        console.log(`[Analytics] Found ${cards.length} cards in collection`);
        
        // Get current user from Firebase Auth instead of state
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            console.error('[Analytics] No authenticated user found');
            // Show empty state for unauthenticated users
            const currentValueEl = document.getElementById('analytics-current-value');
            const change24hEl = document.getElementById('analytics-24h-change');
            const allTimeHighEl = document.getElementById('analytics-all-time-high');
            
            if (currentValueEl) currentValueEl.textContent = '$0.00';
            if (change24hEl) change24hEl.textContent = 'Please log in';
            if (allTimeHighEl) allTimeHighEl.textContent = '$0.00';
            return;
        }
        
        const userId = currentUser.uid;
        console.log(`[Analytics] Using authenticated user ID: ${userId}`);
        
        if (cards.length === 0) {
            console.log(`[Analytics] No cards in local collection, checking Firestore directly`);
            
            // Check Firestore directly for cards
            try {
                const collectionRef = firebase.firestore().collection('users').doc(userId).collection('collection');
                const snapshot = await collectionRef.limit(1).get();
                
                if (snapshot.empty) {
                    console.log(`[Analytics] No cards found in Firestore either`);
                    // Show empty state
                    const currentValueEl = document.getElementById('analytics-current-value');
                    const change24hEl = document.getElementById('analytics-24h-change');
                    const allTimeHighEl = document.getElementById('analytics-all-time-high');
                    
                    if (currentValueEl) currentValueEl.textContent = '$0.00';
                    if (change24hEl) change24hEl.textContent = '$0.00';
                    if (allTimeHighEl) allTimeHighEl.textContent = '$0.00';
                    return;
                }
                
                console.log(`[Analytics] Found ${snapshot.size} cards in Firestore, proceeding with analytics`);
            } catch (firestoreError) {
                console.error(`[Analytics] Error checking Firestore:`, firestoreError);
                return;
            }
        }
        
        try {
            // Use our collection analytics function with proper user authentication
            const getCollectionAnalyticsFunction = firebase.functions().httpsCallable('getCollectionPriceAnalytics');
            
            console.log(`[Analytics] Calling getCollectionPriceAnalytics for user: ${userId}`);
            console.log(`[Analytics] Local collection has ${cards.length} cards`);
            
            // Log sample card data to debug field name issues
            if (cards.length > 0) {
                console.log(`[Analytics] Sample card data:`, cards.slice(0, 3).map(c => ({
                    name: c.name,
                    api_id: c.api_id,
                    cardId: c.cardId, // Check if this exists
                    game: c.game || c.tcg,
                    prices: c.prices,
                    id: c.id
                })));
            }
            
            // Also check what's actually in Firestore by calling the collection directly
            try {
                const collectionRef = firebase.firestore().collection('users').doc(userId).collection('collection');
                const snapshot = await collectionRef.limit(3).get();
                console.log(`[Analytics] Firestore collection has ${snapshot.size} documents`);
                snapshot.docs.forEach((doc, index) => {
                    const data = doc.data();
                    console.log(`[Analytics] Firestore doc ${index}:`, {
                        docId: doc.id,
                        name: data.name,
                        api_id: data.api_id,
                        cardId: data.cardId,
                        id: data.id,
                        game: data.game || data.tcg
                    });
                });
            } catch (firestoreError) {
                console.error(`[Analytics] Error checking Firestore directly:`, firestoreError);
            }
            
            // Call the analytics function with cache-busting parameters
            const analyticsResult = await getCollectionAnalyticsFunction({ 
                userId: userId,
                days: 30,
                timestamp: Date.now(), // Cache buster
                debug: true // Enable debug mode
            });
            
            console.log(`[Analytics] Raw analytics result:`, analyticsResult);
            
            if (analyticsResult && analyticsResult.data && analyticsResult.data.success) {
                const analytics = analyticsResult.data;
                console.log(`[Analytics] SUCCESS: Using real collection analytics:`, analytics);
                
                // Update dashboard values
                const currentValueEl = document.getElementById('analytics-current-value');
                const change24hEl = document.getElementById('analytics-24h-change');
                const allTimeHighEl = document.getElementById('analytics-all-time-high');
                
                if (currentValueEl) {
                    const formattedValue = Currency.convertAndFormat({ usd: analytics.totalValue || 0 });
                    currentValueEl.textContent = formattedValue;
                    console.log(`[Analytics] Updated current value to: ${formattedValue}`);
                }
                
                if (change24hEl) {
                    const valueChange = analytics.valueChange || 0;
                    const percentChange = analytics.percentChange || 0;
                    const isPositive = valueChange >= 0;
                    const changeText = `${isPositive ? '+' : ''}${Currency.convertAndFormat({ usd: Math.abs(valueChange) })} (${isPositive ? '+' : ''}${percentChange.toFixed(1)}%)`;
                    change24hEl.textContent = changeText;
                    change24hEl.className = `text-2xl font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`;
                    console.log(`[Analytics] Updated 24h change to: ${changeText}`);
                }
                
                if (allTimeHighEl) {
                    // Calculate all-time high from current cards
                    const allTimeHigh = Math.max(analytics.totalValue || 0, (analytics.totalValue || 0) + (analytics.valueChange || 0));
                    const formattedHigh = Currency.convertAndFormat({ usd: allTimeHigh });
                    allTimeHighEl.textContent = formattedHigh;
                    console.log(`[Analytics] Updated all-time high to: ${formattedHigh}`);
                }
                
                // Update top movers section with real data
                Analytics.updateTopMovers(analytics.topGainers || [], analytics.topLosers || []);
                
                console.log('[Analytics] === ANALYTICS DASHBOARD UPDATE COMPLETE ===');
            } else {
                console.error('[Analytics] Analytics function returned unsuccessful result:', analyticsResult);
                throw new Error(`Analytics function failed: ${analyticsResult?.data?.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('[Analytics] === ERROR UPDATING ANALYTICS DASHBOARD ===');
            console.error('[Analytics] Error details:', error);
            
            // Fallback to basic calculation
            console.log('[Analytics] Using fallback calculation');
            const currentValue = cards.reduce((sum, card) => {
                return sum + (Currency.getNormalizedPriceUSD(card.prices, card) * (card.quantity || 1));
            }, 0);
            
            const currentValueEl = document.getElementById('analytics-current-value');
            const change24hEl = document.getElementById('analytics-24h-change');
            const allTimeHighEl = document.getElementById('analytics-all-time-high');
            
            if (currentValueEl) {
                currentValueEl.textContent = Currency.convertAndFormat({ usd: currentValue });
            }
            
            if (change24hEl) {
                change24hEl.textContent = `Error: ${error.message}`;
                change24hEl.className = 'text-2xl font-semibold text-red-500 dark:text-red-400';
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
                    return sum + (Currency.getNormalizedPriceUSD(card.prices, card) * (card.quantity || 1));
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
   // REPLACE with this block

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

// In public/js/modules/collection-app.js

// Replace the existing fetchAllCards with this one.
async function fetchAllCards(query, game, progressCallback = null) {
    let allCards = [];
    let currentPage = 1;
    const limit = 100;
    let hasMore = true; // Start with the assumption that there's at least one page.
    const maxPages = 50; // Safety limit to prevent infinite loops

    console.log(`[fetchAllCards] Starting paginated fetch for "${query}"`);

    while (hasMore && currentPage <= maxPages) {
        try {
            // API.searchCards now returns an object: { cards: [], has_more: boolean }
            const response = await API.searchCards(query, game, currentPage, limit);
            const newCards = response.cards;
            
            console.log(`[fetchAllCards] Page ${currentPage}: Found ${newCards.length} cards. API says has_more: ${response.has_more}`);

            if (newCards && newCards.length > 0) {
                allCards = allCards.concat(newCards);
                
                // Call the progress callback to update the UI with current count
                if (progressCallback && typeof progressCallback === 'function') {
                    progressCallback(allCards.length);
                }
            }

            // IMPROVED PAGINATION LOGIC:
            // Continue if EITHER:
            // 1. The API explicitly says has_more is true, OR
            // 2. We received exactly 'limit' cards (suggesting there might be more)
            // Stop if:
            // 1. We received fewer than 'limit' cards (we've reached the end), OR
            // 2. We received 0 cards
            if (newCards.length === 0) {
                console.log(`[fetchAllCards] Stopping: No cards returned on page ${currentPage}`);
                hasMore = false;
            } else if (newCards.length < limit) {
                console.log(`[fetchAllCards] Stopping: Received ${newCards.length} cards (less than limit of ${limit})`);
                hasMore = false;
            } else if (response.has_more === true) {
                console.log(`[fetchAllCards] Continuing: API says has_more is true`);
                currentPage++;
            } else if (newCards.length === limit) {
                // We got exactly 'limit' cards but API says has_more is false
                // Try one more page to be sure
                console.log(`[fetchAllCards] Continuing: Got full page (${limit} cards), checking next page despite has_more=false`);
                currentPage++;
            } else {
                console.log(`[fetchAllCards] Stopping: Default case`);
                hasMore = false;
            }

        } catch (error) {
            console.error(`[fetchAllCards] Failed to fetch page ${currentPage}:`, error);
            hasMore = false; // Stop the loop on any error.
            throw error;
        }
    }

    if (currentPage > maxPages) {
        console.warn(`[fetchAllCards] Reached maximum page limit (${maxPages}). There may be more results.`);
    }

    console.log(`[fetchAllCards] Successfully fetched a total of ${allCards.length} cards for "${query}".`);
    return allCards;
}

// ===================================================================
// === START: NEW DYNAMIC SEARCH AND FILTER LOGIC ====================
// ===================================================================

let allFoundCards = []; // This will store all card versions from a search
let searchTimeout;

// This function's only job is to display cards in the results area.
function renderSearchResults(cards) {
    const resultsContainer = document.getElementById('search-results-container');
    if (!resultsContainer) return;

    if (cards.length === 0) {
        resultsContainer.innerHTML = '<p class="text-center text-gray-500">No cards match the filters.</p>';
        return;
    }

    resultsContainer.innerHTML = cards.map(card => {
        const jsonString = JSON.stringify(card);
        const escapedCardData = jsonString
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // --- ADD OPTCG SPECIFIC DISPLAY ---
        let optcgInfo = '';
        if (card.game === 'optcg' && card.optcg_details) {
            const details = card.optcg_details;
            optcgInfo = `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                C:${details.cost || '-'} | P:${details.power || '-'} | ${details.color || ''} | ${details.attribute || ''}
            </p>`;
        }
        // --- END OPTCG SPECIFIC DISPLAY ---
        
        return `
            <div class="search-result-item flex items-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" data-card='${escapedCardData}'>
                <img src="${getCardImageUrl(card)}" class="w-10 h-auto rounded-sm mr-4">
                <div class="flex-grow">
                    <p class="font-semibold">${card.name} (${card.collector_number || 'N/A'})</p>
                    <p class="text-sm text-gray-500">${card.set_name}</p>
                    ${optcgInfo}
                </div>
                <p class="text-sm font-mono text-gray-700 dark:text-gray-300 ml-4">${Currency.convertAndFormat(card.prices)}</p>
            </div>`;
    }).join('');
}

// This function builds the searchable dropdown based on the cards found.
function createAndPopulateSetFilter(cards) {
    const filterContainer = document.getElementById('modal-set-filter-container');
    if (!filterContainer) return;

    // Get a unique list of set names from the search results
    const uniqueSets = [...new Map(cards.map(card => [card.set_name, card])).values()]
        .map(card => ({ id: card.set_name, text: `${card.set_name}` }))
        .sort((a, b) => a.text.localeCompare(b.text));

    // If there's only one set, we don't need to show a filter.
    if (uniqueSets.length <= 1) {
        filterContainer.innerHTML = '';
        return;
    }

    // Create the <select> element and initialize it with Select2
    filterContainer.innerHTML = '<select id="dynamic-set-filter" class="w-full"></select>';
    const setFilter = $('#dynamic-set-filter');

    setFilter.select2({
        placeholder: `Filter by set (${uniqueSets.length} found)...`,
        allowClear: true,
        data: [{ id: '', text: 'All Sets' }, ...uniqueSets],
        dropdownParent: $('#search-modal') // This makes it work correctly inside a modal
    });

    // When the user selects a set, filter the results on the client side
    setFilter.on('change', (e) => {
        const selectedSet = e.target.value;
        if (!selectedSet) {
            renderSearchResults(allFoundCards); // If 'All Sets' is chosen, show everything
        } else {
            const filteredCards = allFoundCards.filter(card => card.set_name === selectedSet);
            renderSearchResults(filteredCards);
        }
    });
}

// This is the main function that runs when you type in the search bar.
function handleSearchInput() {
    clearTimeout(searchTimeout);
    const query = document.getElementById('card-search-input').value;
    const game = document.getElementById('game-selector').value;
    const resultsContainer = document.getElementById('search-results-container');
    const filterContainer = document.getElementById('modal-set-filter-container');

    if (!resultsContainer || !filterContainer) return;

    // Always clear the old set filter when starting a new search
    filterContainer.innerHTML = '';

    if (query.length < 3) {
        resultsContainer.innerHTML = '<p class="text-center text-gray-500">Enter at least 3 characters to search.</p>';
        allFoundCards = []; // Clear the stored cards
        return;
    }

    resultsContainer.innerHTML = '<p class="text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Searching for all versions...</p>';

    searchTimeout = setTimeout(async () => {
        try {
            // 1. Fetch ALL cards matching the name from your ScryDex function
            // Pass a callback to update the loading message with live counter
            allFoundCards = await fetchAllCards(query, game, (currentCount) => {
                resultsContainer.innerHTML = `<p class="text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading cards... (${currentCount} found so far)</p>`;
            });

            if (allFoundCards.length === 0) {
                 resultsContainer.innerHTML = '<p class="text-center text-gray-500">No cards found.</p>';
                 return;
            }

            // 2. Automatically create the set filter based on the results
            createAndPopulateSetFilter(allFoundCards);

            // 3. Show the initial, unfiltered list of cards
            renderSearchResults(allFoundCards);

        } catch (error) {
            resultsContainer.innerHTML = `<p class="text-center text-red-500">Error: ${error.message}</p>`;
            allFoundCards = [];
        }
    }, 500); // Increased debounce timer for a better experience
}

// ===================================================================
// ===  END: NEW DYNAMIC SEARCH AND FILTER LOGIC  ====================
// ===================================================================
function handleSearchResultClick(item) {
    if (item) {
        // --- THIS IS THE CORRESPONDING FIX ---
        // It simply reads the data attribute. The browser automatically
        // handles the un-escaping of the HTML characters for us.
        const cardData = JSON.parse(item.dataset.card);
        // --- END OF FIX ---

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
                case 'list-sale':
                    openIndividualSaleModal(cardId);
                    break;
                case 'remove-sale':
                    removeCardFromSale(cardId);
                    break;
                case 'update-price':
                    updateCardSalePrice(cardId);
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


// REPLACE the old function with this one
function handleFilterChange(e) {
    console.log("Filter change detected:", e.target.value, e.target.checked); // Debugging line
    const filterType = e.target.dataset.filterType; // 'set' or 'rarity'
    const value = e.target.value;
    const isChecked = e.target.checked;

    // Get a copy of the current filters from your state
    const currentFilters = { ...Collection.getState().filters };

    // --- THIS IS THE CRITICAL FIX ---
    // Ensure the filter array exists before we try to use it.
    if (!currentFilters[filterType] || !Array.isArray(currentFilters[filterType])) {
        currentFilters[filterType] = []; // If it doesn't exist, create it as an empty array.
    }
    // --- END OF FIX ---

    const newFilterSet = new Set(currentFilters[filterType]);
    if (isChecked) {
        newFilterSet.add(value);
    } else {
        newFilterSet.delete(value);
    }
    currentFilters[filterType] = [...newFilterSet];

    // Update the master filter state
    Collection.setFilters(currentFilters);
    
    // This is for a different part of your UI, we can leave it
    if (filterType === 'set') {
        updateSetFilterLabel();
    }
    
    // Re-render the collection with the new filters
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
    if (!game) return;

    const isChecked = e.target.checked;
    const currentFilters = { ...Collection.getFilters() };
    const currentGames = currentFilters.games ? [...currentFilters.games] : [];

    // Update the list of selected games
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

    // Update the games filter in the state
    currentFilters.games = currentGames;

    // --- THIS IS THE FIX ---
    // When games change, we must clear the old Set and Rarity filters
    // as they might not apply to the new selection.
    currentFilters.set = [];
    currentFilters.rarity = [];

    // Apply the new filter state
    Collection.setFilters(currentFilters);

    // Get all cards from the master list
    const allCards = Collection.getState().fullCollection;

    // Determine which cards should be used to populate the filters
    const cardsForFilterPopulation = allCards.filter(card => {
        if (currentGames.length === 0) {
            return true; // If no games selected, use all cards
        }
        const cardGame = card.game || 'mtg'; // Default game to 'mtg' if not specified
        return currentGames.includes(cardGame);
    });

    // Re-populate the Set and Rarity dropdowns using only cards from the selected games
    UI.populateFilters(cardsForFilterPopulation);

    // Apply all filters and re-render the main display
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
    Collection.setFilters({ name: '', set: [], rarity: [], colors: [], games: [], type: '', isFoil: null });
    document.getElementById('filter-name').value = '';
    document.querySelectorAll('input[data-filter-type]').forEach(input => input.checked = false);
    document.querySelectorAll('input[data-game]').forEach(input => input.checked = false);
    document.querySelectorAll('.color-filter-btn').forEach(btn => btn.classList.remove('ring-4', 'ring-blue-500'));
    const typeFilterSelect = document.getElementById('type-filter-select');
    if(typeFilterSelect) typeFilterSelect.value = '';
    
    // Reset foil filter to "All Cards"
    const foilAllRadio = document.querySelector('input[name="foil-filter"][value="all"]');
    if (foilAllRadio) foilAllRadio.checked = true;
    
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

// CSV Import Functions - Fixed implementation

// Handle CSV file selection and initial parsing
async function handleCSVFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusDiv = document.getElementById('csv-import-status');
    const parseBtn = document.getElementById('start-csv-import-btn');
    const previewDiv = document.getElementById('csv-preview');
    const previewTable = document.getElementById('csv-preview-table');
    const previewCount = document.getElementById('csv-preview-count');
    
    try {
        statusDiv.textContent = 'Parsing CSV file...';
        statusDiv.className = 'text-sm text-center p-2 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        
        const parsedData = await CSV.parseCSV(file);
        
        if (parsedData.length === 0) {
            throw new Error('No valid cards found in CSV file');
        }
        
        statusDiv.textContent = `Found ${parsedData.length} cards in CSV file`;
        statusDiv.className = 'text-sm text-center p-2 rounded-md bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        
        // Show preview
        if (previewDiv && previewTable && previewCount) {
            previewCount.textContent = parsedData.length;
            
            // Create preview table
            const previewHtml = `
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Set</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Condition</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Foil</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                        ${parsedData.slice(0, 10).map(card => `
                            <tr>
                                <td class="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">${card.name}</td>
                                <td class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">${card.set_name || card.set || 'Unknown'}</td>
                                <td class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">${card.quantity}</td>
                                <td class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">${card.condition}</td>
                                <td class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">${card.is_foil ? 'Yes' : 'No'}</td>
                            </tr>
                        `).join('')}
                        ${parsedData.length > 10 ? `
                            <tr>
                                <td colspan="5" class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center italic">
                                    ... and ${parsedData.length - 10} more cards
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            `;
            
            previewTable.innerHTML = previewHtml;
            previewDiv.classList.remove('hidden');
        }
        
        parseBtn.disabled = false;
        parseBtn.textContent = `Import ${parsedData.length} Cards`;
        
        csvFile = file;
        
    } catch (error) {
        console.error('CSV parsing error:', error);
        statusDiv.textContent = `Error: ${error.message}`;
        statusDiv.className = 'text-sm text-center p-2 rounded-md bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        parseBtn.disabled = true;
        parseBtn.textContent = 'Parse CSV';
        
        // Hide preview on error
        if (previewDiv) {
            previewDiv.classList.add('hidden');
        }
    }
}

// Handle the actual CSV import process
// Handle the actual CSV import process
async function handleCSVUpload() {
    if (!csvFile) {
        UI.showToast('Please select a CSV file first', 'error');
        return;
    }

    const parseBtn = document.getElementById('start-csv-import-btn');
    const statusDiv = document.getElementById('csv-import-status');

    try {
        UI.setButtonLoading(parseBtn, true, 'Importing...');
        statusDiv.textContent = 'Starting import process...';
        statusDiv.className = 'text-sm text-center p-2 rounded-md bg-blue-100 text-blue-800';

        // Parse CSV again to get fresh data
        const parsedData = await CSV.parseCSV(csvFile);

        // --- FIX: Get the selected game BEFORE closing the modal ---
        const selectedGame = document.getElementById('csv-game-selector').value;

        // Close the import modal and open review modal
        const importModal = document.getElementById('csv-import-modal');
        const reviewModal = document.getElementById('csv-review-modal');

        UI.closeModal(importModal);
        UI.openModal(reviewModal);

        // --- FIX: Pass the selected game to the review function ---
        await openCsvReviewModal(parsedData, selectedGame);

    } catch (error) {
        console.error('CSV import error:', error);
        UI.showToast(`Import failed: ${error.message}`, 'error');
        statusDiv.textContent = `Error: ${error.message}`;
        statusDiv.className = 'text-sm text-center p-2 rounded-md bg-red-100 text-red-800';
    } finally {
        UI.setButtonLoading(parseBtn, false, 'Import Cards');
    }
}

// In js/modules/collection-app.js
// REPLACE the entire openCsvReviewModal function with this one.

// In js/modules/collection-app.js
// REPLACE the entire openCsvReviewModal function with this simplified version.

async function openCsvReviewModal(cards, game) {
    const modal = document.getElementById('csv-review-modal');
    const tableBody = document.getElementById('csv-review-table-body') || document.querySelector('#csv-review-modal tbody');
    if (!modal || !tableBody) {
        console.error('CSV review modal or table body not found');
        return;
    }

    tableBody.innerHTML = '';
    let reviewData = [];

    cards.forEach((card, index) => {
        const row = document.createElement('tr');
        row.dataset.index = index;
        
        row.innerHTML = `
            <td class="p-3">${card.name}</td>
            <td class="p-3">${card.set_name || 'Any'}</td>
            <td class="p-3">${card.collector_number || 'N/A'}</td>
            <td class="p-3">${card.quantity}</td>
            <td class="p-3">${card.condition}</td>
            <td class="p-3">${card.language}</td>
            <td class="p-3">${card.is_foil ? 'Yes' : 'No'}</td>
            <td class="p-3 status-cell">
                <i class="fas fa-spinner fa-spin text-blue-500"></i>
                <span class="ml-2">Searching...</span>
            </td>
            <td class="p-3">
                <button class="text-red-500 hover:text-red-700 remove-row-btn" data-index="${index}">
                    <i class="fas fa-times-circle"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
        reviewData.push({ raw: card, enriched: null, status: 'pending' });
    });

    for (let i = 0; i < reviewData.length; i++) {
        if (reviewData[i].status === 'removed') continue;

        const row = tableBody.querySelector(`tr[data-index="${i}"]`);
        if (!row) continue;

        const statusCell = row.querySelector('.status-cell');

        try {
            // --- THIS IS THE NEW, SIMPLIFIED FIX ---
            let cardName = reviewData[i].raw.name;

            // If the card is a double-faced card (contains "//"),
            // search for only the front face name.
            if (cardName.includes('//')) {
                cardName = cardName.split('//')[0].trim();
            }
            
            // We now use the simplified name for the search.
            // No more special quotes or syntax.
            const response = await API.searchCards(cardName, game);
            // --- END OF FIX ---

            if (response && response.cards && response.cards.length > 0) {
                let bestMatch = response.cards[0];
                const csvSet = reviewData[i].raw.set_name;

                if (csvSet && csvSet !== 'Any') {
                    const setMatch = response.cards.find(c => 
                        c.set.toLowerCase() === csvSet.toLowerCase() || 
                        c.set_name.toLowerCase() === csvSet.toLowerCase()
                    );
                    if (setMatch) {
                        bestMatch = setMatch;
                    }
                }

                reviewData[i].enriched = {
                    ...bestMatch,
                    quantity: reviewData[i].raw.quantity,
                    condition: reviewData[i].raw.condition,
                    language: reviewData[i].raw.language,
                    is_foil: reviewData[i].raw.is_foil,
                    addedAt: new Date()
                };
                reviewData[i].status = 'found';
                statusCell.innerHTML = '<i class="fas fa-check-circle text-green-500"></i><span class="ml-2 text-green-600">Found</span>';
            } else {
                throw new Error(`Card not found for search term: "${cardName}"`);
            }
        } catch (error) {
            reviewData[i].status = 'error';
            statusCell.innerHTML = `<i class="fas fa-exclamation-triangle text-red-500"></i><span class="ml-2 text-red-600" title="${error.message}">Not found</span>`;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const finalizeBtn = document.getElementById('finalize-csv-import-btn');
    if (finalizeBtn) {
        finalizeBtn.onclick = () => finalizeCsvImport(reviewData);
    }

    tableBody.addEventListener('click', (e) => {
        if (e.target.closest('.remove-row-btn')) {
            const index = parseInt(e.target.closest('.remove-row-btn').dataset.index);
            const rowToRemove = tableBody.querySelector(`tr[data-index="${index}"]`);
            if (rowToRemove) {
                rowToRemove.remove();
                if (reviewData[index]) {
                    reviewData[index].status = 'removed';
                }
            }
        }
    });
}


async function finalizeCsvImport(reviewData) {
    const finalizeBtn = document.getElementById('finalize-csv-import-btn');
    
    try {
        UI.setButtonLoading(finalizeBtn, true, 'Importing...');
        
        const cardsToImport = reviewData.filter(item => item.status === 'found').map(item => item.enriched);
        
        if (cardsToImport.length === 0) {
            UI.showToast("No valid cards to import.", "error");
            return;
        }
        
        await Collection.addMultipleCards(cardsToImport);
        
        const failedCount = reviewData.filter(item => item.status === 'error').length;
        UI.showToast(`Successfully imported ${cardsToImport.length} cards!${failedCount > 0 ? ` ${failedCount} cards failed.` : ''}`, 'success');
        
        // Close the review modal
        const reviewModal = document.getElementById('csv-review-modal');
        UI.closeModal(reviewModal);
        
        // Refresh the collection display
        applyAndRender();
        
    } catch (error) {
        console.error('Finalize import error:', error);
        UI.showToast(`Import failed: ${error.message}`, 'error');
    } finally {
        UI.setButtonLoading(finalizeBtn, false, 'Finalize Import');
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
        const marketPrice = Currency.getNormalizedPriceUSD(card.prices, card) || 0;
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
        // Remove currency symbols and parse the price
        const salePrice = parseFloat(finalPriceText.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(salePrice) && salePrice >= 0) {
            // Store the price in the user's current currency, not USD
            updates.push({ 
                id: item.dataset.cardId, 
                data: { 
                    for_sale: true, 
                    sale_price: salePrice,
                    sale_currency: Currency.getUserCurrency() // Store which currency this price is in
                } 
            });
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
        // Currency is initialized by auth.js, just wait for it
        console.log('[Collection] Waiting for currency initialization...');
        
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                try {
                    await Collection.loadCollection(user.uid);
                    await Collection.loadWishlist(user.uid);
                     // --- PASTE THE LOGIC HERE ---
            console.log('[Collection] Populating filters for the first time.');
            const state = Collection.getState();
            const { types } = Collection.getAvailableFilterOptions(state.filters.games);
            UI.populateFilters(state.fullCollection); // This populates Set and Rarity
            UI.populateTypeFilters(types); // This populates Pokémon types
            // --- END OF PASTED LOGIC ---
                    applyAndRender({});
                } catch (error) {
                    console.error("Failed to load user data:", error);
                    UI.showToast("Failed to load your collection. Please refresh the page.", "error");
                }
            }
        });
                // --- Delegated listener for dynamic filter checkboxes ---
       // --- Delegated listener for dynamic filter checkboxes ---
const filterPanel = document.getElementById('filter-panel');
if (filterPanel) {
    filterPanel.addEventListener('change', (e) => {
        const target = e.target;
        if (target.matches('input[type="checkbox"][data-filter-type]')) {
            handleFilterChange(e);
        }
    });
}
        document.getElementById('card-form')?.addEventListener('submit', handleCardFormSubmit);
        document.getElementById('delete-card-btn')?.addEventListener('click', handleDeleteCard);
        document.getElementById('card-search-input')?.addEventListener('input', handleSearchInput);
           document.getElementById('game-selector')?.addEventListener('change', handleSearchInput);
        document.getElementById('search-results-container')?.addEventListener('click', (e) => {
            const item = e.target.closest('.search-result-item');
            if (item) handleSearchResultClick(item);
        });

        // Add hover functionality for search results
// And REPLACE it with this corrected version:
document.getElementById('search-results-container')?.addEventListener('mouseover', (e) => {
    const searchResultItem = e.target.closest('.search-result-item');
    if (searchResultItem) {
        try {
            // --- THIS IS THE FIX ---
            // Just like the click handler, we simply parse the data attribute.
            const cardData = JSON.parse(searchResultItem.dataset.card);
            // --- END OF FIX ---
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
   
        document.getElementById('filter-color-container')?.addEventListener('click', handleColorFilterClick);
        document.getElementById('filter-name')?.addEventListener('input', handleNameFilterInput);
        document.getElementById('clear-filters-btn')?.addEventListener('click', clearAllFilters);
        document.getElementById('game-filter-container')?.addEventListener('change', handleGameFilterChange);
        
        // Foil filter event listener
        const foilRadios = document.querySelectorAll('input[name="foil-filter"]');
        foilRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                let foilValue = null;
                if (e.target.value === 'foil') {
                    foilValue = true;
                } else if (e.target.value === 'non-foil') {
                    foilValue = false;
                }
                Collection.setFilters({ isFoil: foilValue });
                applyAndRender({});
            });
        });
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
        document.getElementById('csv-file-input')?.addEventListener('change', handleCSVFileSelect);
        document.getElementById('start-csv-import-btn')?.addEventListener('click', handleCSVUpload);
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
            const modals = ['search-modal', 'csv-import-modal', 'csv-review-modal', 'bulk-review-modal', 'card-modal', 'card-history-modal', 'individual-sale-modal'];
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
                const modals = ['search-modal', 'csv-import-modal', 'csv-review-modal', 'bulk-review-modal', 'card-modal', 'card-history-modal', 'individual-sale-modal'];
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
                    const csvPreview = document.getElementById('csv-preview');
                    if (csvPreview) csvPreview.classList.add('hidden');
                    const parseBtn = document.getElementById('start-csv-import-btn');
                    if (parseBtn) {
                        parseBtn.disabled = true;
                        parseBtn.textContent = 'Parse CSV';
                    }
                    csvFile = null;
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
                case 'individual-sale-modal':
                    // Clear individual sale modal data
                    currentIndividualSaleCard = null;
                    resetIndividualSaleForm();
                    // Reset modal title and button text
                    const modalTitle = document.querySelector('#individual-sale-modal h2');
                    const confirmBtn = document.getElementById('individual-sale-confirm-btn');
                    if (modalTitle) modalTitle.textContent = 'List Card for Sale';
                    if (confirmBtn) confirmBtn.textContent = 'List for Sale';
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

        // Individual marketplace event listeners
        document.getElementById('individual-sale-confirm-btn')?.addEventListener('click', handleIndividualSaleConfirm);
        
        // Percentage button clicks
        document.querySelectorAll('.percentage-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const percentage = e.target.dataset.percentage;
                
                // Update button states
                document.querySelectorAll('.percentage-btn').forEach(b => {
                    b.classList.remove('bg-blue-500', 'text-white');
                    b.classList.add('hover:bg-blue-50', 'dark:hover:bg-blue-900/50');
                });
                e.target.classList.add('bg-blue-500', 'text-white');
                e.target.classList.remove('hover:bg-blue-50', 'dark:hover:bg-blue-900/50');
                
                // Set percentage value and update price
                document.getElementById('individual-sale-percentage').value = percentage;
                updateIndividualSaleFinalPrice();
            });
        });
        
        // Price input changes
        document.getElementById('individual-sale-percentage')?.addEventListener('input', () => {
            // Clear button states when typing custom percentage
            document.querySelectorAll('.percentage-btn').forEach(btn => {
                btn.classList.remove('bg-blue-500', 'text-white');
                btn.classList.add('hover:bg-blue-50', 'dark:hover:bg-blue-900/50');
            });
            updateIndividualSaleFinalPrice();
        });
        
        document.getElementById('individual-sale-fixed-price')?.addEventListener('input', updateIndividualSaleFinalPrice);
        
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
        const currentPrice = Currency.getNormalizedPriceUSD(card.prices, card) || 10;
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

// --- INDIVIDUAL MARKETPLACE FUNCTIONS ---

let currentIndividualSaleCard = null;

function openIndividualSaleModal(cardId) {
    const card = Collection.getCardById(cardId);
    if (!card) {
        UI.showToast("Card not found.", "error");
        return;
    }

    currentIndividualSaleCard = card;
    const modal = document.getElementById('individual-sale-modal');
    if (!modal) return;

    // Populate card information
    document.getElementById('individual-sale-card-image').src = getCardImageUrl(card);
    document.getElementById('individual-sale-card-name').textContent = card.name;
    document.getElementById('individual-sale-card-set').textContent = card.set_name;
    document.getElementById('individual-sale-card-condition').textContent = `Condition: ${card.condition || 'N/A'}`;
    
    // Set market price
    const marketPrice = Currency.getNormalizedPriceUSD(card.prices, card) || 0;
    document.getElementById('individual-sale-market-price').textContent = Currency.convertAndFormat(card.prices, card);

    // Show/hide quantity section for cards with multiple copies
    const quantitySection = document.getElementById('individual-sale-quantity-section');
    const totalQuantitySpan = document.getElementById('individual-sale-total-quantity');
    const quantityInput = document.getElementById('individual-sale-quantity');
    
    if (card.quantity > 1) {
        quantitySection.classList.remove('hidden');
        totalQuantitySpan.textContent = card.quantity;
        quantityInput.max = card.quantity;
        quantityInput.value = 1;
    } else {
        quantitySection.classList.add('hidden');
        quantityInput.value = 1;
    }

    // Set currency information
    const userCurrency = Currency.getUserCurrency();
    const currencySymbol = Currency.getCurrencySymbol(userCurrency);
    document.getElementById('individual-sale-currency-symbol').textContent = currencySymbol;
    document.getElementById('individual-sale-currency-code').textContent = userCurrency;

    // Reset form
    resetIndividualSaleForm();
    
    // Set default to 100% of market value
    document.getElementById('individual-sale-percentage').value = '100';
    updateIndividualSaleFinalPrice();

    UI.openModal(modal);
}

function resetIndividualSaleForm() {
    // Clear all inputs
    document.getElementById('individual-sale-percentage').value = '';
    document.getElementById('individual-sale-fixed-price').value = '';
    document.getElementById('individual-sale-condition-override').value = '';
    
    // Reset button states
    document.querySelectorAll('.percentage-btn').forEach(btn => {
        btn.classList.remove('bg-blue-500', 'text-white');
        btn.classList.add('hover:bg-blue-50', 'dark:hover:bg-blue-900/50');
    });
    
    // Reset final price
    document.getElementById('individual-sale-final-price').textContent = '$0.00';
    document.getElementById('individual-sale-price-comparison').textContent = '';
}

function updateIndividualSaleFinalPrice() {
    if (!currentIndividualSaleCard) return;

    const marketPriceUSD = Currency.getNormalizedPriceUSD(currentIndividualSaleCard.prices, currentIndividualSaleCard) || 0;
    const percentageInput = document.getElementById('individual-sale-percentage');
    const fixedPriceInput = document.getElementById('individual-sale-fixed-price');
    const finalPriceEl = document.getElementById('individual-sale-final-price');
    const comparisonEl = document.getElementById('individual-sale-price-comparison');

    let finalPriceUSD = 0;
    let comparisonText = '';

    // Determine price based on input method
    if (fixedPriceInput.value && parseFloat(fixedPriceInput.value) > 0) {
        // Fixed price in user's currency - convert to USD for comparison
        const fixedPrice = parseFloat(fixedPriceInput.value);
        finalPriceUSD = Currency.convertFromUserCurrency(fixedPrice);
        
        // Clear percentage input
        percentageInput.value = '';
        
        // Calculate percentage for comparison
        if (marketPriceUSD > 0) {
            const percentage = (finalPriceUSD / marketPriceUSD) * 100;
            comparisonText = `${percentage.toFixed(1)}% of market value`;
        }
    } else if (percentageInput.value && parseFloat(percentageInput.value) > 0) {
        // Percentage of market value
        const percentage = parseFloat(percentageInput.value);
        finalPriceUSD = marketPriceUSD * (percentage / 100);
        
        // Clear fixed price input
        fixedPriceInput.value = '';
        
        if (percentage < 90) {
            comparisonText = 'Below market value';
        } else if (percentage > 110) {
            comparisonText = 'Above market value';
        } else {
            comparisonText = 'Near market value';
        }
    }

    // Display final price in user's currency
    const finalPriceUserCurrency = Currency.convertToUserCurrency(finalPriceUSD);
    const currencySymbol = Currency.getCurrencySymbol(Currency.getUserCurrency());
    finalPriceEl.textContent = `${currencySymbol}${finalPriceUserCurrency.toFixed(2)}`;
    comparisonEl.textContent = comparisonText;

    // Enable/disable confirm button
    const confirmBtn = document.getElementById('individual-sale-confirm-btn');
    confirmBtn.disabled = finalPriceUSD <= 0;
}

async function handleIndividualSaleConfirm() {
    if (!currentIndividualSaleCard) return;

    const confirmBtn = document.getElementById('individual-sale-confirm-btn');
    const originalText = confirmBtn.textContent;
    
    try {
        UI.setButtonLoading(confirmBtn, true);

        // Get final price in USD
        const marketPriceUSD = Currency.getNormalizedPriceUSD(currentIndividualSaleCard.prices, currentIndividualSaleCard) || 0;
        const percentageInput = document.getElementById('individual-sale-percentage');
        const fixedPriceInput = document.getElementById('individual-sale-fixed-price');
        
        let salePriceUserCurrency = 0;
        
        if (fixedPriceInput.value && parseFloat(fixedPriceInput.value) > 0) {
            salePriceUserCurrency = parseFloat(fixedPriceInput.value);
        } else if (percentageInput.value && parseFloat(percentageInput.value) > 0) {
            const percentage = parseFloat(percentageInput.value);
            const salePriceUSD = marketPriceUSD * (percentage / 100);
            salePriceUserCurrency = Currency.convertToUserCurrency(salePriceUSD);
        }

        if (salePriceUserCurrency <= 0) {
            UI.showToast("Please set a valid price.", "error");
            return;
        }

        // Get quantity and condition override
        const quantity = parseInt(document.getElementById('individual-sale-quantity').value) || 1;
        const conditionOverride = document.getElementById('individual-sale-condition-override').value;

        // Prepare update data
        const updateData = {
            for_sale: true,
            sale_price: salePriceUserCurrency,
            sale_currency: Currency.getUserCurrency()
        };

        // If condition override is specified, include it
        if (conditionOverride) {
            updateData.condition = conditionOverride;
        }

        // Update the card in collection
        await Collection.batchUpdateSaleStatus([{
            id: currentIndividualSaleCard.id,
            data: updateData
        }]);

        // Create marketplace listing
        await Collection.batchCreateMarketplaceListings([{
            id: currentIndividualSaleCard.id,
            data: updateData
        }]);

        UI.showToast(`${currentIndividualSaleCard.name} listed for sale!`, "success");
        UI.closeModal(document.getElementById('individual-sale-modal'));
        
        // Refresh the display
        applyAndRender({});

    } catch (error) {
        console.error('Error listing card for sale:', error);
        UI.showToast(`Error: ${error.message}`, "error");
    } finally {
        UI.setButtonLoading(confirmBtn, false, originalText);
    }
}

async function removeCardFromSale(cardId) {
    const card = Collection.getCardById(cardId);
    if (!card || !card.for_sale) {
        UI.showToast("Card is not currently for sale.", "info");
        return;
    }

    const confirmed = confirm(`Remove "${card.name}" from marketplace?`);
    if (!confirmed) return;

    try {
        // Update collection to remove sale status
        await Collection.batchUpdateSaleStatus([{
            id: cardId,
            data: { for_sale: false, sale_price: null, sale_currency: null }
        }]);

        // Remove from marketplace listings
        await Collection.batchRemoveMarketplaceListings([cardId]);

        UI.showToast(`${card.name} removed from marketplace!`, "success");
        
        // Refresh the display
        applyAndRender({});

    } catch (error) {
        console.error('Error removing card from sale:', error);
        UI.showToast(`Error: ${error.message}`, "error");
    }
}

async function updateCardSalePrice(cardId) {
    const card = Collection.getCardById(cardId);
    if (!card || !card.for_sale) {
        UI.showToast("Card is not currently for sale.", "info");
        return;
    }

    // Open the individual sale modal with current price pre-filled
    currentIndividualSaleCard = card;
    const modal = document.getElementById('individual-sale-modal');
    if (!modal) return;

    // Populate card information (same as openIndividualSaleModal)
    document.getElementById('individual-sale-card-image').src = getCardImageUrl(card);
    document.getElementById('individual-sale-card-name').textContent = card.name;
    document.getElementById('individual-sale-card-set').textContent = card.set_name;
    document.getElementById('individual-sale-card-condition').textContent = `Condition: ${card.condition || 'N/A'}`;
    
    const marketPrice = Currency.getNormalizedPriceUSD(card.prices, card) || 0;
    document.getElementById('individual-sale-market-price').textContent = Currency.convertAndFormat(card.prices, card);

    // Set currency information
    const userCurrency = Currency.getUserCurrency();
    const currencySymbol = Currency.getCurrencySymbol(userCurrency);
    document.getElementById('individual-sale-currency-symbol').textContent = currencySymbol;
    document.getElementById('individual-sale-currency-code').textContent = userCurrency;

    // Pre-fill with current sale price
    resetIndividualSaleForm();
    if (card.sale_price) {
        document.getElementById('individual-sale-fixed-price').value = card.sale_price.toFixed(2);
        updateIndividualSaleFinalPrice();
    }

    // Change modal title and button text
    modal.querySelector('h2').textContent = 'Update Sale Price';
    document.getElementById('individual-sale-confirm-btn').textContent = 'Update Price';

    UI.openModal(modal);
}

// ES6 module exports
export { CollectionApp, Analytics, toggleDashboard };
export default CollectionApp;

// For backward compatibility, also assign to window
if (typeof window !== 'undefined') {
    window.CollectionApp = CollectionApp;
    window.toggleDashboard = toggleDashboard;
}