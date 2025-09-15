/**
 * collection-app.js
 * Main entry point and orchestrator for the TCG Collection page.
 */
import * as Collection from './collection.js';
import * as UI from './ui.js';
import * as API from './api.js';
import * as CSV from './csv.js';
import * as Bulk from './bulk-operations.js';
import { debounce } from './utils.js';
import { showToast } from './ui.js'; // *** FIXED: Import showToast from UI module ***

// --- STATE & INITIALIZATION ---

let currentUser;

/**
 * Main initialization function for the collection application.
 * Waits for Firebase auth to be ready.
 */
function init() {
    document.addEventListener('authReady', async (e) => {
        if (e.detail.user) {
            currentUser = e.detail.user;
            UI.showLoadingState();
            await Collection.loadCollection(currentUser.uid);
            await Collection.loadWishlist(currentUser.uid);
            
            setupEventListeners();
            
            // Initial render
            await renderFilteredCollection();
            updateAllUI();
        } else {
            // User is not logged in, show a message or redirect
            UI.showLoggedOutState();
        }
    });
}

/**
 * Fetches the filtered collection from the state and tells the UI to render it.
 */
async function renderFilteredCollection() {
    const state = Collection.getState();
    const cardsToRender = state.activeTab === 'collection' ? state.filteredCollection : state.wishlist;
    
    if (state.activeView === 'grid') {
        UI.renderGridView(cardsToRender, state.activeTab);
    } else {
        UI.renderListView(cardsToRender, state.activeTab);
    }

    if (cardsToRender.length === 0) {
        const message = state.activeTab === 'collection' 
            ? "Your collection is empty. Add cards to get started!"
            : "Your wishlist is empty. Search for cards to add them.";
        UI.showEmptyState(message);
    }
}

/**
 * Updates dynamic UI components like stats and filters.
 */
function updateAllUI() {
    const stats = Collection.calculateStats();
    UI.updateStats(stats);
    
    const { sets, rarities } = Collection.getAvailableFilterOptions();
    UI.populateFilters(sets, rarities);
}


// --- EVENT LISTENERS ---

function setupEventListeners() {
    // Header & Main Actions
    document.getElementById('add-card-btn').addEventListener('click', UI.openSearchModal);
    document.getElementById('import-csv-btn').addEventListener('click', UI.openCsvImportModal);
    document.getElementById('export-csv-btn').addEventListener('click', CSV.exportCollectionToCSV);
    document.getElementById('bulk-edit-btn').addEventListener('click', handleEnterBulkEditMode);

    // View Toggles
    document.getElementById('view-toggle-grid').addEventListener('click', () => handleViewChange('grid'));
    document.getElementById('view-toggle-list').addEventListener('click', () => handleViewChange('list'));

    // Tabs
    document.querySelectorAll('.tab-button').forEach(tab => {
        tab.addEventListener('click', () => handleTabChange(tab.dataset.tab));
    });

    // *** NEW: TCG Filter Event Listener ***
    document.querySelectorAll('.tcg-filter-button').forEach(btn => {
        btn.addEventListener('click', () => handleTcgFilterChange(btn.dataset.game));
    });

    // Filters
    document.getElementById('filter-name').addEventListener('input', debounce(handleFilterChange, 300));
    document.getElementById('filter-set').addEventListener('change', handleFilterChange);
    document.getElementById('filter-rarity').addEventListener('change', handleFilterChange);
    document.getElementById('filter-colors').addEventListener('click', handleColorFilterClick);

    // Modals - Search
    document.getElementById('close-search-modal').addEventListener('click', UI.closeSearchModal);
    document.getElementById('card-search-input').addEventListener('input', debounce(handleCardSearch, 300));
    document.getElementById('game-selector').addEventListener('change', handleCardSearch);

    // Modals - Add/Edit Card
    document.getElementById('close-card-modal').addEventListener('click', () => UI.closeCardModal());
    document.getElementById('card-form').addEventListener('submit', handleSaveCard);
    document.getElementById('list-for-sale-toggle').addEventListener('change', UI.toggleListForSaleSection);
    document.getElementById('add-another-version-btn').addEventListener('click', handleAddAnotherVersion);

    // Modals - CSV Import
    document.getElementById('close-csv-modal').addEventListener('click', UI.closeCsvImportModal);
    document.getElementById('csv-file-input').addEventListener('change', (e) => {
        CSV.handleCSVImport(e.target.files[0]);
    });

    // Modals - Bulk List
    document.getElementById('close-bulk-list-modal').addEventListener('click', UI.closeBulkListSaleModal);
    document.getElementById('bulk-list-form').addEventListener('submit', handleBulkListForSale);
    document.querySelector('input[name="price-option"][value="percentage"]').addEventListener('change', UI.toggleBulkPriceInputs);
    document.querySelector('input[name="price-option"][value="fixed"]').addEventListener('change', UI.toggleBulkPriceInputs);


    // Dynamic Event Listeners on Collection Display
    const display = document.getElementById('collection-display');
    display.addEventListener('click', handleCollectionDisplayClick);
    
    // Bulk Actions Toolbar
    document.getElementById('bulk-cancel-btn').addEventListener('click', Bulk.exitBulkEditMode);
    document.getElementById('bulk-delete-btn').addEventListener('click', Bulk.deleteSelected);
    document.getElementById('bulk-list-sale-btn').addEventListener('click', Bulk.listSelectedForSale);
}


// --- EVENT HANDLERS ---

async function handleViewChange(view) {
    if (Collection.getState().activeView === view) return;
    Collection.setView(view);
    UI.updateViewToggle(view);
    await renderFilteredCollection();
}

async function handleTabChange(tab) {
    if (Collection.getState().activeTab === tab) return;
    Collection.setTab(tab);
    UI.updateActiveTab(tab);
    await renderFilteredCollection();
}

// *** NEW: TCG Filter Handler ***
async function handleTcgFilterChange(game) {
    if (Collection.getState().filters.game === game) return;
    Collection.setFilters({ game: game }); // Update the state
    UI.updateTcgFilter(game); // Update the button visuals
    await renderFilteredCollection(); // Re-render the view
}

async function handleFilterChange() {
    const filters = {
        name: document.getElementById('filter-name').value,
        set: document.getElementById('filter-set').value,
        rarity: document.getElementById('filter-rarity').value,
        colors: Collection.getState().filters.colors, // Keep colors from their own handler
        game: Collection.getState().filters.game // Keep the game filter
    };
    Collection.setFilters(filters);
    await renderFilteredCollection();
}

async function handleColorFilterClick(e) {
    if (e.target.tagName === 'I') {
        const color = e.target.dataset.color;
        const newColors = Collection.toggleColorFilter(color);
        UI.updateColorFilterSelection(newColors);
        await handleFilterChange();
    }
}

async function handleCardSearch() {
    const query = document.getElementById('card-search-input').value;
    const game = document.getElementById('game-selector').value;
    if (query.length < 3) {
        UI.renderSearchResults(null, "Enter at least 3 characters to search.");
        return;
    }

    UI.renderSearchResults(null, "Searching...");
    try {
        const results = await API.searchCards(query, game);
        UI.renderSearchResults(results, game);
    } catch (error) {
        console.error("Search failed:", error);
        UI.renderSearchResults(null, `Error: ${error.message}`);
    }
}

async function handleSaveCard(e) {
    e.preventDefault();
    const formData = UI.getCardFormData();
    
    try {
        if (formData.id) {
            await Collection.updateCard(formData.id, formData.data, formData.customImageFile);
            showToast("Card updated successfully!", "success");
        } else {
            await Collection.addCard(formData.data, formData.customImageFile);
            showToast("Card added to collection!", "success");
        }
        UI.closeCardModal();
        await renderFilteredCollection();
        updateAllUI();
    } catch (error) {
        console.error("Failed to save card:", error);
        showToast(`Error: ${error.message}`, "error");
    }
}

function handleAddAnotherVersion() {
    const currentCardData = Collection.getCurrentEditingCard();
    if (currentCardData) {
        UI.closeCardModal();
        setTimeout(() => {
            UI.openSearchModal(currentCardData.name);
            handleCardSearch();
        }, 100);
    }
}

function handleEnterBulkEditMode() {
    const isBulkMode = Bulk.enterBulkEditMode();
    if (isBulkMode) {
        renderFilteredCollection(); // Re-render to show checkboxes
    }
}

async function handleBulkListForSale(e) {
    e.preventDefault();
    await Bulk.applyBulkListForSale();
    UI.closeBulkListSaleModal();
    await renderFilteredCollection();
}

async function handleCollectionDisplayClick(e) {
    const cardElement = e.target.closest('.card-container');
    if (!cardElement) return;

    const cardId = cardElement.dataset.id;
    const actionButton = e.target.closest('[data-action]');
    
    if (Bulk.isBulkEditMode()) {
        if (!actionButton) {
             Bulk.toggleCardSelection(cardId);
        }
        return;
    }

    if (actionButton) {
        const action = actionButton.dataset.action;
        switch (action) {
            case 'edit':
                const cardData = Collection.getCardById(cardId);
                if (cardData) UI.populateCardModalForEdit(cardData);
                break;
            case 'delete':
                if (confirm('Are you sure you want to delete this card entry?')) {
                    try {
                        await Collection.deleteCard(cardId);
                        showToast('Card deleted.', 'success');
                        await renderFilteredCollection();
                        updateAllUI();
                    } catch (error) {
                        console.error('Deletion failed:', error);
                        showToast(`Error: ${error.message}`, 'error');
                    }
                }
                break;
            case 'list':
                const cardToList = Collection.getCardById(cardId);
                if (cardToList) UI.populateCardModalForEdit(cardToList, true);
                break;
        }
    }
}


// --- STARTUP ---

init();