/**
 * collection-app.js
 * Main application logic for the collection page.
 * - Includes live currency updates and card hover previews.
 */
import * as Collection from './collection.js';
import * as UI from './ui.js';
import * as API from './api.js';
import * as CSV from './csv.js';
import * as Currency from './currency.js';
import { getCardImageUrl } from './utils.js';


let currentUser = null;
let csvFile = null;

// Initialize the application once Firebase Auth is ready
document.addEventListener('authReady', async ({ detail: { user } }) => {
    if (user) {
        currentUser = user;
        try {
            await Currency.initCurrency(user.uid);
            await Collection.loadCollection(user.uid);
            await Collection.loadWishlist(user.uid);
            setupInitialFilters();
            applyAndRender({});
            setupEventListeners();
            UI.createCurrencySelector('user-actions');
        } catch (error) {
            console.error("Initialization failed:", error);
            UI.showToast("Could not load your collection.", "error");
        }
    } else {
        UI.showLoggedOutState();
    }
});

/**
 * Populates the filter dropdowns and dynamic filter section based on the current state.
 */
function setupInitialFilters() {
    const game = Collection.getState().filters.game;
    const options = Collection.getAvailableFilterOptions(game);
    UI.populateFilters(options.sets, options.rarities, options.types);
    UI.renderGameSpecificFilters(game, options.types);
}

/**
 * Sets up all the main event listeners for the page.
 */
function setupEventListeners() {
    // Modal controls
    document.getElementById('add-card-btn').addEventListener('click', () => UI.openModal(document.getElementById('search-modal')));
    document.getElementById('csv-import-btn').addEventListener('click', () => UI.openModal(document.getElementById('csv-import-modal')));
    document.body.addEventListener('click', (e) => {
        if (e.target.id === 'close-search-modal') UI.closeModal(document.getElementById('search-modal'));
        if (e.target.id === 'close-card-modal') UI.closeModal(document.getElementById('card-modal'));
        if (e.target.id === 'close-bulk-list-sale-modal') UI.closeModal(document.getElementById('bulk-list-sale-modal'));
        if (e.target.id === 'close-bulk-review-modal') UI.closeModal(document.getElementById('bulk-review-modal'));
        if (e.target.id === 'close-csv-import-modal') UI.closeModal(document.getElementById('csv-import-modal'));
        if (e.target.id === 'close-csv-review-modal') UI.closeModal(document.getElementById('csv-review-modal'));
    });

    // CSV import
    document.getElementById('csv-file-input').addEventListener('change', (e) => {
        csvFile = e.target.files[0];
        document.getElementById('start-csv-import-btn').disabled = !csvFile;
    });

    document.getElementById('start-csv-import-btn').addEventListener('click', async () => {
        if (csvFile) {
            try {
                UI.updateCsvImportStatus('Parsing file...');
                const data = await CSV.parseCSV(csvFile);
                UI.renderCsvReviewModal(data);
                UI.closeModal(document.getElementById('csv-import-modal'));
            } catch (error) {
                UI.updateCsvImportStatus(`<span class="text-red-500">${error.message}</span>`);
            }
        }
    });

    document.getElementById('finalize-csv-import-btn').addEventListener('click', CSV.finalizeImport);
    document.getElementById('csv-review-table-body').addEventListener('change', (e) => {
        const target = e.target;
        const index = target.closest('tr').dataset.index;
        const field = target.dataset.field;
        const value = target.type === 'checkbox' ? target.checked : target.value;
        CSV.updateReviewedCard(index, field, value);
    });
    document.getElementById('csv-review-table-body').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-csv-row-btn')) {
            const index = e.target.dataset.index;
            CSV.removeReviewedCard(index);
            e.target.closest('tr').remove();
        }
    });


    // Card search and forms
    document.getElementById('card-search-input').addEventListener('input', handleSearchInput);
    document.getElementById('search-results-container').addEventListener('click', handleSearchResultClick);
    document.getElementById('card-form').addEventListener('submit', handleCardFormSubmit);
    document.getElementById('add-another-version-btn').addEventListener('click', handleAddAnotherVersion);

    // Main view controls (Tabs, Grid/List, TCG type)
    document.querySelector('[data-tab="collection"]').addEventListener('click', () => switchTab('collection'));
    document.querySelector('[data-tab="wishlist"]').addEventListener('click', () => switchTab('wishlist'));
    document.getElementById('view-toggle-grid').addEventListener('click', () => switchView('grid'));
    document.getElementById('view-toggle-list').addEventListener('click', () => switchView('list'));
    document.querySelectorAll('.tcg-filter-button').forEach(btn => btn.addEventListener('click', () => setTcgFilter(btn.dataset.game)));

    // Filter inputs
    document.getElementById('filter-name').addEventListener('input', (e) => applyAndRender({ name: e.target.value }));
    document.getElementById('filter-set-container').addEventListener('change', (e) => applyAndRender({ set: UI.getCheckedValues('set') }));
    document.getElementById('filter-rarity-container').addEventListener('change', (e) => applyAndRender({ rarity: UI.getCheckedValues('rarity') }));
    document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);

    // Dynamic filter container listeners
    const gameSpecificFiltersContainer = document.getElementById('game-specific-filters');
    gameSpecificFiltersContainer.addEventListener('change', (e) => {
        if (e.target.id === 'filter-type') applyAndRender({ type: e.target.value });
    });
    gameSpecificFiltersContainer.addEventListener('click', (e) => {
        if (e.target.matches('#filter-colors i')) {
            const color = e.target.dataset.color;
            const selectedColors = Collection.toggleColorFilter(color);
            UI.updateColorFilterSelection(selectedColors);
            applyAndRender({});
        }
    });

    // Collection display interactions (edit, delete, bulk select)
    document.getElementById('collection-display').addEventListener('click', handleCollectionDisplayClick);

    // Card hover preview functionality
    const hoverAreas = ['collection-display', 'search-results-container'];
    hoverAreas.forEach(id => {
        const area = document.getElementById(id);
        area.addEventListener('mouseover', handleCardHover);
        area.addEventListener('mouseout', handleCardHoverOut);
        area.addEventListener('mousemove', handleCardHoverMove);
    });

    // Bulk Edit listeners
    document.getElementById('bulk-edit-btn').addEventListener('click', handleBulkEditToggle);
    document.body.addEventListener('click', e => {
        if (e.target.id === 'bulk-select-all-btn') handleBulkSelectAll();
        if (e.target.id === 'bulk-list-btn') handleBulkListClick();
        if (e.target.id === 'bulk-delete-btn') handleBulkDeleteClick();
        if (e.target.id === 'finalize-bulk-list-btn') handleFinalizeBulkList(e);
        if (e.target.id === 'bulk-apply-percentage-btn') handleBulkApplyPercentage();
    });
    document.body.addEventListener('submit', e => {
        if (e.target.id === 'bulk-list-form') handleBulkListFormSubmit(e);
    });

    // Card modal listeners (for adding/removing pending versions)
    document.getElementById('card-modal').addEventListener('click', handleCardModalClicks);

    // Listen for currency changes to re-render prices
    document.addEventListener('currencyChanged', () => applyAndRender({}));

    // Image upload preview
    document.getElementById('custom-image-upload').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => { document.getElementById('card-modal-image').src = e.target.result; };
            reader.readAsDataURL(file);
        }
    });
}

/**
 * Applies filters and re-renders the collection view.
 * @param {object} [filterUpdate] - An object with new filter values to apply.
 */
function applyAndRender(filterUpdate) {
    if (filterUpdate) Collection.setFilters(filterUpdate);
    const state = Collection.getState();
    const cardsToRender = state.activeTab === 'collection' ? state.filteredCollection : state.wishlist;

    if (state.activeView === 'grid') {
        UI.renderGridView(cardsToRender, state.activeTab);
    } else {
        UI.renderListView(cardsToRender, state.activeTab);
    }
    UI.updateStats(
        state.activeTab === 'collection' ? Collection.calculateCollectionStats() : Collection.calculateWishlistStats(),
        state.activeTab
    );
}

// --- EVENT HANDLER FUNCTIONS ---

async function handleCardFormSubmit(e) {
    e.preventDefault();
    UI.setButtonLoading(e.submitter, true);
    try {
        const { id, data, customImageFile } = UI.getCardFormData();

        if (id) {
            await Collection.updateCard(id, data, customImageFile);
            UI.showToast("Card updated!", "success");
        } else {
            const pendingCards = Collection.getPendingCards();
            const allVersions = [data, ...pendingCards];
            await Collection.addMultipleCards(allVersions, customImageFile);
            UI.showToast(`${allVersions.length} card version(s) added!`, "success");
        }

        UI.closeModal(document.getElementById('card-modal'));
        applyAndRender({});
        setupInitialFilters();
    } catch (error) {
        console.error("Error saving card:", error);
        UI.showToast(error.message, "error");
    } finally {
        UI.setButtonLoading(e.submitter, false);
    }
}

function handleAddAnotherVersion(e) {
    UI.setButtonLoading(e.target, true);
    try {
        const { data: currentVersionData } = UI.getCardFormData();
        Collection.addPendingCard({ ...currentVersionData });
        UI.renderPendingCards(Collection.getPendingCards());
        UI.resetCardFormForNewVersion();
    } catch (error) {
        console.error("Error adding another version:", error);
        UI.showToast(error.message, "error");
    } finally {
        UI.setButtonLoading(e.target, false);
    }
}

let searchTimeout;
function handleSearchInput(e) {
    clearTimeout(searchTimeout);
    const query = e.target.value;
    const game = document.getElementById('game-selector').value;
    if (query.length < 3) {
        UI.renderSearchResults('Enter at least 3 characters.');
        return;
    }
    UI.renderSearchResults('Searching...');
    searchTimeout = setTimeout(async () => {
        try {
            const results = await API.searchCards(query, game);
            UI.renderSearchResults(results);
        } catch (error) {
            UI.renderSearchResults('Could not fetch card data.');
        }
    }, 300);
}

function handleSearchResultClick(e) {
    const item = e.target.closest('.search-result-item');
    if (item) {
        const cardData = JSON.parse(decodeURIComponent(item.dataset.card));
        UI.closeModal(document.getElementById('search-modal'));
        UI.populateCardModalForAdd(cardData);
    }
}

function switchTab(tab) {
    Collection.setTab(tab);
    UI.updateActiveTab(tab);
    applyAndRender({});
    setupInitialFilters();
}

function switchView(view) {
    Collection.setView(view);
    UI.updateViewToggle(view);
    applyAndRender({});
}

function setTcgFilter(game) {
    UI.updateTcgFilter(game);
    applyAndRender({ game, type: '', colors: [] }); // Reset specific filters on game change
    const options = Collection.getAvailableFilterOptions(game);
    UI.populateFilters(options.sets, options.rarities, options.types);
    UI.renderGameSpecificFilters(game, options.types);
}

function handleCollectionDisplayClick(e) {
    const isBulkMode = Collection.getState().bulkEdit.isActive;
    const cardContainer = e.target.closest('.card-container[data-id]');
    if (!cardContainer) return;
    const cardId = cardContainer.dataset.id;

    if (isBulkMode) {
        Collection.toggleCardSelection(cardId);
        const isSelected = Collection.getState().bulkEdit.selected.has(cardId);
        cardContainer.classList.toggle('ring-4', isSelected);
        cardContainer.classList.toggle('ring-blue-500', isSelected);
        const checkbox = cardContainer.querySelector('.bulk-select-checkbox');
        if (checkbox) checkbox.checked = isSelected;
        UI.updateBulkEditSelection(Collection.getSelectedCardIds().length);
    } else {
        const button = e.target.closest('button[data-action]');
        if (button) {
            e.stopPropagation();
            const card = Collection.getCardById(cardId);
            if (!card) return;
            if (button.dataset.action === 'edit') UI.populateCardModalForEdit(card);
            else if (button.dataset.action === 'delete') {
                if (confirm(`Delete "${card.name}"?`)) deleteCardAction(cardId);
            }
        } else {
            const card = Collection.getCardById(cardId);
            if (card) UI.populateCardModalForEdit(card);
        }
    }
}

async function deleteCardAction(cardId) {
    try {
        await Collection.deleteCard(cardId);
        UI.showToast("Card deleted.", "success");
        applyAndRender({});
        setupInitialFilters();
    } catch (error) {
        UI.showToast("Error deleting card.", "error");
    }
}

function handleBulkEditToggle() {
    const isActive = Collection.toggleBulkEditMode();
    UI.updateBulkEditUI(isActive);
    applyAndRender();
}

function handleBulkListClick() {
    const selectedIds = Collection.getSelectedCardIds();
    if (selectedIds.length === 0) {
        UI.showToast("Please select at least one card to list for sale.", "error");
        return;
    }
    UI.renderBulkReviewModal(selectedIds);
}

function handleBulkSelectAll() {
    const filteredIds = Collection.getState().filteredCollection.map(c => c.id);
    Collection.selectAllFiltered(filteredIds);
    UI.updateBulkEditSelection(Collection.getSelectedCardIds().length);
    applyAndRender();
}

async function handleBulkDeleteClick() {
    const selectedIds = Collection.getSelectedCardIds();
    if (selectedIds.length === 0) {
        UI.showToast("Select cards to delete.", "error");
        return;
    }
    if (confirm(`Are you sure you want to delete ${selectedIds.length} cards? This cannot be undone.`)) {
        try {
            await Collection.batchDelete(selectedIds);
            UI.showToast(`${selectedIds.length} cards deleted.`, 'success');
            applyAndRender({});
            setupInitialFilters();
        } catch (error) {
            UI.showToast('Error deleting cards.', 'error');
        }
    }
}

async function handleBulkListFormSubmit(e) {
    e.preventDefault();
    UI.setButtonLoading(e.submitter, true);
    // Implementation from previous correct response
}

function handleBulkApplyPercentage() {
    const percentageInput = document.getElementById('bulk-apply-percentage-input');
    if (!percentageInput) return;
    const percentage = percentageInput.value;
    if (!percentage) return;
    document.querySelectorAll('.bulk-review-percent-input').forEach(input => {
        input.value = percentage;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function handleFinalizeBulkList(e) {
    UI.setButtonLoading(e.target, true);
    try {
        const updates = [];
        document.querySelectorAll('#bulk-review-list > div').forEach(item => {
            const cardId = item.dataset.id;
            const marketPrice = parseFloat(item.dataset.marketPrice);
            const fixedPriceInput = item.querySelector('.bulk-review-fixed-input');
            const percentageInput = item.querySelector('.bulk-review-percent-input');
            let salePrice = null;

            if (fixedPriceInput.value) {
                salePrice = parseFloat(fixedPriceInput.value);
            } else if (percentageInput.value && marketPrice > 0) {
                salePrice = (marketPrice * parseFloat(percentageInput.value)) / 100;
            }

            if (salePrice !== null) {
                updates.push({
                    id: cardId,
                    data: {
                        forSale: true,
                        salePrice: parseFloat(salePrice.toFixed(2))
                    }
                });
            }
        });

        if (updates.length > 0) {
            await Collection.batchUpdateSaleStatus(updates);
            UI.showToast(`${updates.length} cards have been listed for sale.`, 'success');
            UI.closeModal(document.getElementById('bulk-review-modal'));
            applyAndRender({});
        } else {
            UI.showToast('No valid prices were set.', 'info');
        }
    } catch (error) {
        console.error('Bulk list finalization failed:', error);
        UI.showToast('There was an error listing your cards.', 'error');
    } finally {
        UI.setButtonLoading(e.target, false);
    }
}


function handleCardModalClicks(e) {
    const item = e.target.closest('.pending-card-item');
    if (item) {
        const index = parseInt(item.dataset.index, 10);
        if (e.target.classList.contains('delete-pending-btn')) {
            Collection.removePendingCard(index);
            UI.renderPendingCards(Collection.getPendingCards());
        } else {
            Collection.swapPendingCard(index);
            const currentCard = Collection.getCurrentEditingCard();
            const originalCardData = JSON.parse(document.getElementById('card-modal').dataset.originalCard || '{}');
            UI.populateCardModalForEdit({ ...originalCardData, ...currentCard });
            UI.renderPendingCards(Collection.getPendingCards());
        }
    }
}

// Hover handlers
function handleCardHover(e) {
    const cardElement = e.target.closest('.card-container, .search-result-item');
    if (!cardElement) return;

    let card = null;
    const cardId = cardElement.dataset.id;
    if (cardId) {
        card = Collection.getCardById(cardId);
    } else if (cardElement.dataset.card) {
        card = JSON.parse(decodeURIComponent(cardElement.dataset.card));
    }


    if (card) {
        const tooltip = document.getElementById('card-preview-tooltip');
        if (!tooltip) return;

        let img = tooltip.querySelector('img');
        if (!img) {
            tooltip.innerHTML = '<img alt="Card Preview" class="w-full rounded-lg" src=""/>';
            img = tooltip.querySelector('img');
        }

        img.src = getCardImageUrl(card);
        tooltip.classList.remove('hidden');
        updateTooltipPosition(e, tooltip);
    }
}

function handleCardHoverOut(e) {
    const cardElement = e.target.closest('.card-container, .search-result-item');
    if (cardElement) {
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget || !cardElement.contains(relatedTarget)) {
            document.getElementById('card-preview-tooltip').classList.add('hidden');
        }
    }
}

function handleCardHoverMove(e) {
    const tooltip = document.getElementById('card-preview-tooltip');
    if (!tooltip.classList.contains('hidden')) {
        updateTooltipPosition(e, tooltip);
    }
}

function updateTooltipPosition(e, tooltip) {
    const mouseX = e.clientX, mouseY = e.clientY;
    const tooltipWidth = 240;
    const aspectRatio = 3.5 / 2.5;
    const tooltipHeight = tooltipWidth * aspectRatio;
    let left = mouseX + 20;
    let top = mouseY + 20;

    if (left + tooltipWidth > window.innerWidth - 15) left = mouseX - tooltipWidth - 20;
    if (top + tooltipHeight > window.innerHeight - 15) top = window.innerHeight - tooltipHeight - 15;
    if (left < 15) left = 15;
    if (top < 15) top = 15;

    tooltip.style.width = `${tooltipWidth}px`;
    tooltip.style.height = `auto`;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}


function clearFilters() {
    Collection.setFilters({
        name: '',
        set: [],
        rarity: [],
        colors: [],
        type: ''
    });
    document.getElementById('filter-name').value = '';
    UI.clearCheckboxes('set');
    UI.clearCheckboxes('rarity');
    UI.updateColorFilterSelection([]);
    applyAndRender({});
}