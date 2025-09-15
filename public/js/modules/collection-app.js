/**
 * collection-app.js
 * Main application logic for the collection page.
 */
import * as Collection from './collection.js';
import * as UI from './ui.js';
import * as API from './api.js';

document.addEventListener('authReady', async ({ detail: { user } }) => {
    if (user) {
        try {
            await Collection.loadCollection(user.uid);
            await Collection.loadWishlist(user.uid);
            // *** CRITICAL BUG FIX HERE ***
            // The function is named populateFilters, not populateFilterDropdowns.
            UI.populateFilters(Collection.getAvailableFilterOptions().sets, Collection.getAvailableFilterOptions().rarities);
            UI.renderGridView(Collection.getState().filteredCollection, Collection.getState().activeTab); // Default to grid view
            UI.updateStats(Collection.calculateCollectionStats(), Collection.getState().activeTab);
            setupEventListeners();
            // Card preview events should be set up on the display container
            UI.setupCardPreviewEvents(document.getElementById('collection-display'));
        } catch (error) {
            console.error("Initialization failed:", error);
            UI.showToast("Could not load your collection.", "error");
        }
    } else {
        UI.showLoggedOutState();
    }
});

function setupEventListeners() {
    // Modal Triggers
    document.getElementById('add-card-btn').addEventListener('click', () => UI.openSearchModal());
    document.getElementById('close-search-modal').addEventListener('click', UI.closeSearchModal);
    document.getElementById('close-card-modal').addEventListener('click', UI.closeCardModal);

    // Search
    document.getElementById('card-search-input').addEventListener('input', handleSearchInput);
    document.getElementById('search-results-container').addEventListener('click', handleSearchResultClick);

    // Form Submission
    document.getElementById('card-form').addEventListener('submit', handleCardFormSubmit);
    document.getElementById('add-another-version-btn').addEventListener('click', handleAddAnotherVersion);

    // Main UI Toggles
    document.querySelector('[data-tab="collection"]').addEventListener('click', () => switchTab('collection'));
    document.querySelector('[data-tab="wishlist"]').addEventListener('click', () => switchTab('wishlist'));
    document.getElementById('view-toggle-grid').addEventListener('click', () => switchView('grid'));
    document.getElementById('view-toggle-list').addEventListener('click', () => switchView('list'));
    document.querySelectorAll('.tcg-filter-button').forEach(btn => btn.addEventListener('click', () => setTcgFilter(btn.dataset.game)));

    // Filters
    document.getElementById('filter-name').addEventListener('input', (e) => applyAndRender({ name: e.target.value }));
    document.getElementById('filter-set').addEventListener('change', (e) => applyAndRender({ set: e.target.value }));
    document.getElementById('filter-rarity').addEventListener('change', (e) => applyAndRender({ rarity: e.target.value }));
    document.getElementById('filter-colors').addEventListener('click', handleColorFilterClick);

    // Card Actions (Edit/Delete) within the collection display area
    document.getElementById('collection-display').addEventListener('click', handleCardActionClick);

    // Sale section toggle in modal
    document.getElementById('list-for-sale-toggle').addEventListener('change', UI.toggleListForSaleSection);
}

function applyAndRender(filterUpdate) {
    Collection.setFilters(filterUpdate);
    const state = Collection.getState();
    const cardsToRender = state.activeTab === 'collection' ? state.filteredCollection : state.wishlist;
    
    if (state.activeView === 'grid') {
        UI.renderGridView(cardsToRender, state.activeTab);
    } else {
        UI.renderListView(cardsToRender, state.activeTab);
    }
    UI.updateStats(state.activeTab === 'collection' ? Collection.calculateCollectionStats() : Collection.calculateWishlistStats(), state.activeTab);
}

async function handleCardFormSubmit(e) {
    e.preventDefault();
    try {
        const { id, data, customImageFile } = UI.getCardFormData();
        
        if (id) { // Editing an existing card
            await Collection.updateCard(id, data, customImageFile);
            UI.showToast("Card updated successfully!", "success");
        } else { // Adding a new card (and potentially pending versions)
            const pendingCards = Collection.getPendingCards();
            const allVersions = [data, ...pendingCards];
            await Collection.addMultipleCards(allVersions);
            UI.showToast(`${allVersions.length} card version(s) added!`, "success");
        }
        
        UI.closeCardModal();
        applyAndRender({}); // Re-render the collection with the latest data
        UI.populateFilters(Collection.getAvailableFilterOptions().sets, Collection.getAvailableFilterOptions().rarities);

    } catch (error) {
        console.error("Error saving card:", error);
        UI.showToast(error.message, "error");
    }
}

function handleAddAnotherVersion() {
    try {
        const { data } = UI.getCardFormData(false); // Get only the instance data, not the base API data
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
        UI.renderSearchResults(null, 'Enter at least 3 characters to search.');
        return;
    }
    UI.renderSearchResults(null, 'Searching...');
    searchTimeout = setTimeout(async () => {
        const game = document.getElementById('game-selector').value;
        try {
            const results = await API.searchCards(query, game);
            UI.renderSearchResults(results);
        } catch (error) {
            UI.renderSearchResults(null, 'Could not fetch card data.');
            console.error("Card search failed:", error);
        }
    }, 300);
}

function handleSearchResultClick(e) {
    const item = e.target.closest('.search-result-item');
    if (item) {
        const cardData = JSON.parse(decodeURIComponent(item.dataset.card));
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

function handleColorFilterClick(e) {
    if (e.target.tagName === 'I' && e.target.dataset.color) {
        const color = e.target.dataset.color;
        const selectedColors = Collection.toggleColorFilter(color);
        UI.updateColorFilterSelection(selectedColors);
        applyAndRender({});
    }
}

async function handleCardActionClick(e) {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const cardContainer = button.closest('.card-container[data-id]');
    if (!cardContainer) return;

    const cardId = cardContainer.dataset.id;
    const card = Collection.getCardById(cardId);

    if (action === 'edit') {
        UI.populateCardModalForEdit(card);
    } else if (action === 'delete') {
        if (confirm(`Are you sure you want to delete "${card.name}" from your collection?`)) {
            try {
                await Collection.deleteCard(cardId);
                UI.showToast("Card deleted.", "success");
                applyAndRender({});
                 UI.populateFilters(Collection.getAvailableFilterOptions().sets, Collection.getAvailableFilterOptions().rarities);
            } catch (error) {
                console.error("Failed to delete card:", error);
                UI.showToast("Error deleting card.", "error");
            }
        }
    }
}