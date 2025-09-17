/**
 * collection-app.js
 * Main application logic for the collection page.
 */
import * as Collection from './collection.js';
import * as UI from './ui.js';
import * as API from './api.js';

let currentUser = null;

document.addEventListener('authReady', async ({ detail: { user } }) => {
    if (user) {
        currentUser = user;
        try {
            await Collection.loadCollection(user.uid);
            await Collection.loadWishlist(user.uid);
            UI.populateFilters(Collection.getAvailableFilterOptions().sets, Collection.getAvailableFilterOptions().rarities);
            applyAndRender({});
            setupEventListeners();
        } catch (error) {
            console.error("Initialization failed:", error);
            UI.showToast("Could not load your collection.", "error");
        }
    } else {
        // UI.showLoggedOutState(); This function doesn't exist in the provided ui.js
    }
});

function setupEventListeners() {
    document.getElementById('add-card-btn').addEventListener('click', () => UI.openSearchModal());
    document.getElementById('close-search-modal').addEventListener('click', UI.closeSearchModal);
    document.getElementById('close-card-modal').addEventListener('click', UI.closeCardModal);
    document.getElementById('close-bulk-list-sale-modal').addEventListener('click', UI.closeBulkListSaleModal);
    document.getElementById('card-search-input').addEventListener('input', handleSearchInput);
    document.getElementById('search-results-container').addEventListener('click', handleSearchResultClick);
    document.getElementById('card-form').addEventListener('submit', handleCardFormSubmit);
    document.getElementById('add-another-version-btn').addEventListener('click', handleAddAnotherVersion);
    document.querySelector('[data-tab="collection"]').addEventListener('click', () => switchTab('collection'));
    document.querySelector('[data-tab="wishlist"]').addEventListener('click', () => switchTab('wishlist'));
    document.getElementById('view-toggle-grid').addEventListener('click', () => switchView('grid'));
    document.getElementById('view-toggle-list').addEventListener('click', () => switchView('list'));
    document.querySelectorAll('.tcg-filter-button').forEach(btn => btn.addEventListener('click', () => setTcgFilter(btn.dataset.game)));
    document.getElementById('filter-name').addEventListener('input', (e) => applyAndRender({ name: e.target.value }));
    document.getElementById('filter-set').addEventListener('change', (e) => applyAndRender({ set: e.target.value }));
    document.getElementById('filter-rarity').addEventListener('change', (e) => applyAndRender({ rarity: e.target.value }));
    document.getElementById('collection-display').addEventListener('click', handleCollectionDisplayClick);
    
    // Bulk Edit Listeners
    document.getElementById('bulk-edit-btn').addEventListener('click', handleBulkEditToggle);
    document.getElementById('bulk-list-btn').addEventListener('click', handleBulkListClick);
    document.getElementById('bulk-delete-btn').addEventListener('click', handleBulkDeleteClick);
    document.getElementById('bulk-select-all-btn').addEventListener('click', handleBulkSelectAll);
    document.getElementById('bulk-list-form').addEventListener('submit', handleBulkListFormSubmit);
    document.querySelectorAll('input[name="price-option"]').forEach(radio => {
        radio.addEventListener('change', UI.toggleBulkPriceInputs);
    });
}

function applyAndRender(filterUpdate) {
    if(filterUpdate) Collection.setFilters(filterUpdate);
    const state = Collection.getState();
    const cardsToRender = state.activeTab === 'collection' ? state.filteredCollection : state.wishlist;
    
    if (state.activeView === 'grid') {
        UI.renderGridView(cardsToRender, state.activeTab);
    } else {
        UI.renderListView(cardsToRender, state.activeTab);
    }
    UI.updateStats(state.activeTab === 'collection' ? Collection.calculateCollectionStats() : { totalCards: 0, uniqueCards: 0, totalValue: 0 }, state.activeTab);
}

async function handleCardFormSubmit(e) {
    e.preventDefault();
    try {
        const { id, data, customImageFile } = UI.getCardFormData();
        if (id) {
            await Collection.updateCard(id, data, customImageFile);
            UI.showToast("Card updated!", "success");
        } else {
            const pendingCards = Collection.getPendingCards();
            const allVersions = [data, ...pendingCards];
            await Collection.addMultipleCards(allVersions);
            UI.showToast(`${allVersions.length} card(s) added!`, "success");
        }
        UI.closeCardModal();
        applyAndRender({});
        UI.populateFilters(Collection.getAvailableFilterOptions().sets, Collection.getAvailableFilterOptions().rarities);
    } catch (error) {
        console.error("Error saving card:", error);
        UI.showToast(error.message, "error");
    }
}

function handleAddAnotherVersion() {
    try {
        const { data } = UI.getCardFormData(false);
        Collection.addPendingCard(data);
        UI.renderPendingCards(Collection.getPendingCards());
        UI.resetCardFormForNewVersion();
    } catch (error) {
        console.error("Error adding another version:", error);
        UI.showToast(error.message, "error");
    }
}

let searchTimeout;
function handleSearchInput(e) {
    clearTimeout(searchTimeout);
    const query = e.target.value;
    if (query.length < 3) {
        UI.renderSearchResults('Enter at least 3 characters.');
        return;
    }
    UI.renderSearchResults('Searching...');
    searchTimeout = setTimeout(async () => {
        const game = document.getElementById('game-selector').value;
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
        UI.closeSearchModal();
        UI.populateCardModalForAdd(cardData);
    }
}

function switchTab(tab) {
    Collection.setTab(tab);
    UI.updateActiveTab(tab); // <-- UNCOMMENTED
    applyAndRender({});
}

function switchView(view) {
    Collection.setView(view);
    UI.updateViewToggle(view);
    applyAndRender({});
}

function setTcgFilter(game) {
    UI.updateTcgFilter(game); // <-- UNCOMMENTED
    applyAndRender({ game });
}

function handleCollectionDisplayClick(e) {
    const isBulkMode = Collection.getState().bulkEdit.isActive;
    
    if (isBulkMode) {
        const checkbox = e.target.closest('.bulk-select-checkbox');
        const selectAllCheckbox = e.target.closest('#bulk-select-all-page');

        if (checkbox) {
            Collection.toggleCardSelection(checkbox.dataset.id);
            UI.updateSelectedCount();
            applyAndRender();
        } else if (selectAllCheckbox) {
            const filteredIds = Collection.getState().filteredCollection.map(c => c.id);
            if (selectAllCheckbox.checked) {
                Collection.selectAllFiltered(filteredIds);
            } else {
                Collection.deselectAllFiltered();
            }
            UI.updateSelectedCount();
            applyAndRender();
        }
    } else {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        const cardContainer = button.closest('.card-container[data-id]');
        if (!cardContainer) return;
        const cardId = cardContainer.dataset.id;
        const card = Collection.getCardById(cardId);

        if (button.dataset.action === 'edit') {
            UI.populateCardModalForEdit(card);
        } else if (button.dataset.action === 'delete') {
            if (confirm(`Delete "${card.name}"?`)) {
                deleteCardAction(cardId);
            }
        }
    }
}

async function deleteCardAction(cardId) {
    try {
        await Collection.deleteCard(cardId);
        UI.showToast("Card deleted.", "success");
        applyAndRender({});
        UI.populateFilters(Collection.getAvailableFilterOptions().sets, Collection.getAvailableFilterOptions().rarities);
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
        UI.showToast("Select cards to list.", "error");
        return;
    }
    UI.openBulkListSaleModal(selectedIds.length);
}

function handleBulkSelectAll() {
    const filteredIds = Collection.getState().filteredCollection.map(c => c.id);
    Collection.selectAllFiltered(filteredIds);
    UI.updateSelectedCount();
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
            UI.populateFilters(Collection.getAvailableFilterOptions().sets, Collection.getAvailableFilterOptions().rarities);
        } catch (error) {
            UI.showToast('Error deleting cards.', 'error');
        }
    }
}

async function handleBulkListFormSubmit(e) {
    e.preventDefault();
    const selectedIds = Collection.getSelectedCardIds();
    const formData = new FormData(e.target);
    const priceOption = formData.get('price-option');
    const percentage = parseFloat(formData.get('percentage')) || 100;
    const fixedPrice = parseFloat(formData.get('fixed-price')) || 0;

    const updates = selectedIds.map(id => {
        const card = Collection.getCardById(id);
        if (!card) return null;

        let salePrice = 0;
        if (priceOption === 'percentage') {
            const marketPrice = card.prices?.usd || 0;
            salePrice = marketPrice * (percentage / 100);
        } else if (priceOption === 'fixed') {
            salePrice = fixedPrice;
        } else { // individual
            salePrice = card.salePrice || card.prices?.usd || 0;
        }

        return {
            id: card.id,
            data: {
                forSale: true,
                salePrice: parseFloat(salePrice.toFixed(2))
            }
        };
    }).filter(Boolean);

    if (updates.length > 0) {
        try {
            await Collection.batchUpdateSaleStatus(updates);
            UI.showToast(`${updates.length} cards listed for sale!`, "success");
            UI.closeBulkListSaleModal();
            applyAndRender({});
            UI.updateBulkEditUI(false);
        } catch (error) {
            UI.showToast("Bulk update failed.", "error");
        }
    }
}