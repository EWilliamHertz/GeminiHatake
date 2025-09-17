/**
 * collection-app.js
 * Main application logic for the collection page.
 */
import * as Collection from './collection.js';
import * as UI from './ui.js';
import * as API from './api.js';
import * as Currency from './currency.js';

let currentUser = null;

document.addEventListener('authReady', async ({ detail: { user } }) => {
    if (user) {
        currentUser = user;
        try {
            await Currency.initCurrency('SEK');
            await Collection.loadCollection(user.uid);
            await Collection.loadWishlist(user.uid);
            UI.populateFilters(Collection.getAvailableFilterOptions().sets, Collection.getAvailableFilterOptions().rarities);
            applyAndRender({});
            setupEventListeners();
            UI.createCurrencySelector('user-actions');
        } catch (error) {
            console.error("Initialization failed:", error);
            UI.showToast("Could not load your collection.", "error");
        }
    }
});

function setupEventListeners() {
    document.getElementById('add-card-btn').addEventListener('click', () => UI.openModal(document.getElementById('search-modal')));
    document.getElementById('close-search-modal').addEventListener('click', () => UI.closeModal(document.getElementById('search-modal')));
    document.getElementById('close-card-modal').addEventListener('click', () => UI.closeModal(document.getElementById('card-modal')));
    document.getElementById('close-bulk-list-sale-modal').addEventListener('click', () => UI.closeModal(document.getElementById('bulk-list-sale-modal')));

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
        radio.addEventListener('change', () => UI.toggleBulkPriceInputs(radio.value));
    });

    document.getElementById('close-bulk-review-modal').addEventListener('click', () => UI.closeModal(document.getElementById('bulk-review-modal')));
    document.getElementById('finalize-bulk-list-btn').addEventListener('click', handleFinalizeBulkList);
    document.getElementById('bulk-apply-percentage-btn').addEventListener('click', handleBulkApplyPercentage);

    document.getElementById('card-modal').addEventListener('click', (e) => {
        if (e.target.classList.contains('pending-card-item') || e.target.parentElement.classList.contains('pending-card-item')) {
            const item = e.target.closest('.pending-card-item');
            const index = parseInt(item.dataset.index, 10);
            Collection.swapPendingCard(index);
            UI.populateCardModalForEdit(Collection.getCurrentEditingCard());
            UI.renderPendingCards(Collection.getPendingCards());
        }
        if (e.target.classList.contains('delete-pending-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            Collection.removePendingCard(index);
            UI.renderPendingCards(Collection.getPendingCards());
        }
    });

    document.addEventListener('currencyChanged', () => {
        applyAndRender({});
    });

    // Image upload listener
    const imageUploadInput = document.getElementById('custom-image-upload');
    const imagePreview = document.getElementById('card-modal-image');
    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
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
    UI.updateStats(
        state.activeTab === 'collection'
            ? Collection.calculateCollectionStats()
            : Collection.calculateWishlistStats(),
        state.activeTab
    );
}

async function handleCardFormSubmit(e) {
    e.preventDefault();
    try {
        const { id, data, customImageFile } = UI.getCardFormData();
        
        if (id) {
            // Editing an existing card
            await Collection.updateCard(id, data, customImageFile);
            UI.showToast("Card updated!", "success");
        } else {
            // Adding a new card
            const pendingCards = Collection.getPendingCards();
            const allVersions = [data, ...pendingCards];
            await Collection.addMultipleCards(allVersions, customImageFile);
            UI.showToast(`${allVersions.length} card(s) added!`, "success");
        }
        
        UI.closeModal(document.getElementById('card-modal'));
        applyAndRender({});
        UI.populateFilters(Collection.getAvailableFilterOptions().sets, Collection.getAvailableFilterOptions().rarities);
    } catch (error) {
        console.error("Error saving card:", error);
        UI.showToast(error.message, "error");
    }
}


function handleAddAnotherVersion() {
    try {
        const { data: currentVersionData } = UI.getCardFormData();
        Collection.addPendingCard({ ...currentVersionData });
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
        UI.closeModal(document.getElementById('search-modal'));
        UI.populateCardModalForAdd(cardData);
    }
}

function switchTab(tab) {
    Collection.setTab(tab);
    UI.updateActiveTab(tab);
    applyAndRender({});
}

function switchView(view) {
    Collection.setView(view);
    UI.updateViewToggle(view);
    applyAndRender({});
}

function setTcgFilter(game) {
    UI.updateTcgFilter(game);
    applyAndRender({ game });
}

function handleCollectionDisplayClick(e) {
    const isBulkMode = Collection.getState().bulkEdit.isActive;
    const cardContainer = e.target.closest('.card-container[data-id]');
    if (!cardContainer) return;

    const cardId = cardContainer.dataset.id;

    if (isBulkMode) {
        const checkbox = e.target.closest('.bulk-select-checkbox');
        if (checkbox) {
            Collection.toggleCardSelection(checkbox.dataset.id);
            UI.updateBulkEditSelection(Collection.getSelectedCardIds().length);
            checkbox.closest('.card-container').classList.toggle('ring-4', checkbox.checked);
            checkbox.closest('.card-container').classList.toggle('ring-blue-500', checkbox.checked);
        }
    } else {
        const button = e.target.closest('button[data-action]');
        if (button) {
            e.stopPropagation(); // Prevent card click when clicking a button
            const card = Collection.getCardById(cardId);
            if (button.dataset.action === 'edit') {
                UI.populateCardModalForEdit(card);
            } else if (button.dataset.action === 'delete') {
                if (confirm(`Delete "${card.name}"?`)) {
                    deleteCardAction(cardId);
                }
            }
        } else {
            // If no button was clicked, treat it as a click on the card to edit
            const card = Collection.getCardById(cardId);
            UI.populateCardModalForEdit(card);
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
            const marketPrice = (card.prices && card.prices.usd) ? card.prices.usd : 0;
            salePrice = marketPrice * (percentage / 100);
        } else if (priceOption === 'fixed') {
            salePrice = fixedPrice;
        } else { // individual
            salePrice = card.salePrice || (card.prices && card.prices.usd) ? card.prices.usd : 0;
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
            UI.closeModal(document.getElementById('bulk-list-sale-modal'));
            applyAndRender({});
            UI.updateBulkEditUI(false);
        } catch (error) {
            UI.showToast("Bulk update failed.", "error");
        }
    }
}

function handleBulkApplyPercentage() {
    const percentage = document.getElementById('bulk-apply-percentage-input').value;
    if (!percentage) return;

    document.querySelectorAll('.bulk-review-percent-input').forEach(input => {
        input.value = percentage;
        input.dispatchEvent(new Event('input'));
    });
}

async function handleFinalizeBulkList() {
    const updates = [];
    document.querySelectorAll('#bulk-review-list > div').forEach(item => {
        const cardId = item.dataset.id;
        const fixedPriceInput = item.querySelector('.bulk-review-fixed-input');
        const salePrice = parseFloat(fixedPriceInput.value);

        if (cardId && !isNaN(salePrice)) {
            updates.push({
                id: cardId,
                data: { forSale: true, salePrice: salePrice }
            });
        }
    });

    if (updates.length > 0) {
        try {
            await Collection.batchUpdateSaleStatus(updates);
            UI.showToast(`${updates.length} cards listed for sale successfully!`, "success");
            UI.closeModal(document.getElementById('bulk-review-modal'));
        } catch (error) {
            console.error("Bulk update failed:", error);
            UI.showToast("An error occurred during the bulk update.", "error");
        }
    }
}