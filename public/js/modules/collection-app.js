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
import { showToast } from './ui.js';

// --- STATE & INITIALIZATION ---
let currentUser;

function init() {
    document.addEventListener('authReady', async (e) => {
        if (e.detail.user) {
            currentUser = e.detail.user;
            UI.showLoadingState();
            try {
                await Collection.loadCollection(currentUser.uid);
                await Collection.loadWishlist(currentUser.uid);
                setupEventListeners();
                await renderFilteredCollection();
                updateAllUI(); // Initial UI update for collection
            } catch (error) {
                console.error("Initialization failed:", error);
                UI.showEmptyState("Error loading collection. Check console for details.");
            }
        } else {
            UI.showLoggedOutState();
        }
    });
}

async function renderFilteredCollection() {
    const state = Collection.getState();
    const cardsToRender = state.activeTab === 'collection' ? state.filteredCollection : state.wishlist;
    if (state.activeView === 'grid') {
        UI.renderGridView(cardsToRender, state.activeTab);
    } else {
        UI.renderListView(cardsToRender, state.activeTab);
    }
    if (cardsToRender.length === 0 && state.fullCollection.length > 0 && state.activeTab === 'collection') {
         UI.showEmptyState("No cards match your current filters.");
    } else if (cardsToRender.length === 0) {
        const message = state.activeTab === 'collection' 
            ? "Your collection is empty. Add cards to get started!"
            : "Your wishlist is empty. Search for cards to add them.";
        UI.showEmptyState(message);
    }
}

function updateAllUI() {
    // *** UPDATED: Logic to call correct stats function based on active tab ***
    const state = Collection.getState();
    const stats = state.activeTab === 'collection' 
        ? Collection.calculateCollectionStats()
        : Collection.calculateWishlistStats();
    
    UI.updateStats(stats, state.activeTab); 
    
    const { sets, rarities } = Collection.getAvailableFilterOptions();
    UI.populateFilters(sets, rarities);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    document.getElementById('add-card-btn').addEventListener('click', () => UI.openSearchModal(''));
    document.getElementById('import-csv-btn').addEventListener('click', UI.openCsvImportModal);
    document.getElementById('export-csv-btn').addEventListener('click', CSV.exportCollectionToCSV);
    document.getElementById('bulk-edit-btn').addEventListener('click', handleEnterBulkEditMode);
    document.getElementById('view-toggle-grid').addEventListener('click', () => handleViewChange('grid'));
    document.getElementById('view-toggle-list').addEventListener('click', () => handleViewChange('list'));

    document.querySelectorAll('.tab-button').forEach(tab => tab.addEventListener('click', () => handleTabChange(tab.dataset.tab)));
    document.querySelectorAll('.tcg-filter-button').forEach(btn => btn.addEventListener('click', () => handleTcgFilterChange(btn.dataset.game)));

    document.getElementById('filter-name').addEventListener('input', debounce(handleFilterChange, 300));
    document.getElementById('filter-set').addEventListener('change', handleFilterChange);
    document.getElementById('filter-rarity').addEventListener('change', handleFilterChange);
    document.getElementById('filter-colors').addEventListener('click', handleColorFilterClick);

    // Modals
    document.getElementById('search-modal').addEventListener('click', (e) => { if (e.target.id === 'search-modal') UI.closeSearchModal(); });
    document.getElementById('close-search-modal').addEventListener('click', UI.closeSearchModal);
    document.getElementById('card-search-input').addEventListener('input', debounce(handleCardSearch, 300));
    document.getElementById('game-selector').addEventListener('change', handleCardSearch);
    
    document.getElementById('card-modal').addEventListener('click', (e) => { if (e.target.id === 'card-modal') UI.closeCardModal(); });
    document.getElementById('close-card-modal').addEventListener('click', UI.closeCardModal);
    document.getElementById('card-form').addEventListener('submit', handleSaveCard);
    document.getElementById('list-for-sale-toggle').addEventListener('change', UI.toggleListForSaleSection);
    document.getElementById('add-another-version-btn').addEventListener('click', handleAddAnotherVersion);
    
    document.getElementById('csv-import-modal').addEventListener('click', (e) => { if (e.target.id === 'csv-import-modal') UI.closeCsvImportModal(); });
    document.getElementById('close-csv-modal').addEventListener('click', UI.closeCsvImportModal);
    document.getElementById('csv-file-input').addEventListener('change', (e) => CSV.handleCSVImport(e.target.files[0]));
    
    document.getElementById('bulk-list-sale-modal').addEventListener('click', (e) => { if (e.target.id === 'bulk-list-sale-modal') UI.closeBulkListSaleModal(); });
    document.getElementById('close-bulk-list-modal').addEventListener('click', UI.closeBulkListSaleModal);
    document.getElementById('bulk-list-form').addEventListener('submit', handleBulkListForSale);
    document.querySelector('input[name="price-option"][value="percentage"]').addEventListener('change', UI.toggleBulkPriceInputs);
    document.querySelector('input[name="price-option"][value="fixed"]').addEventListener('change', UI.toggleBulkPriceInputs);

    // Dynamic Listeners
    const display = document.getElementById('collection-display');
    display.addEventListener('click', handleCollectionDisplayClick);
    const searchResults = document.getElementById('search-results-container');
    searchResults.addEventListener('mouseover', handleSearchHover);
    searchResults.addEventListener('mouseout', handleSearchHoverOut);
    searchResults.addEventListener('mousemove', handleSearchHoverMove);

    // Bulk Actions
    document.getElementById('bulk-cancel-btn').addEventListener('click', Bulk.exitBulkEditMode);
    document.getElementById('bulk-delete-btn').addEventListener('click', Bulk.deleteSelected);
    document.getElementById('bulk-list-sale-btn').addEventListener('click', Bulk.listSelectedForSale);
}

// --- EVENT HANDLERS ---
async function handleViewChange(view) { if (Collection.getState().activeView !== view) { Collection.setView(view); UI.updateViewToggle(view); await renderFilteredCollection(); } }
async function handleTabChange(tab) { if (Collection.getState().activeTab !== tab) { Collection.setTab(tab); UI.updateActiveTab(tab); await renderFilteredCollection(); updateAllUI(); } }
async function handleTcgFilterChange(game) { if (Collection.getState().filters.game !== game) { Collection.setFilters({ game }); UI.updateTcgFilter(game); await renderFilteredCollection(); updateAllUI(); } }
async function handleFilterChange() { Collection.setFilters({ name: document.getElementById('filter-name').value, set: document.getElementById('filter-set').value, rarity: document.getElementById('filter-rarity').value }); await renderFilteredCollection(); updateAllUI(); }
async function handleColorFilterClick(e) { if (e.target.tagName === 'I') { UI.updateColorFilterSelection(Collection.toggleColorFilter(e.target.dataset.color)); await handleFilterChange(); } }

function handleSearchHover(e) { const item = e.target.closest('.search-result-item'); if (item) { UI.showCardPreview(item.dataset.card); } }
function handleSearchHoverOut() { UI.hideCardPreview(); }
function handleSearchHoverMove(e) { UI.moveCardPreview(e); }

async function handleCardSearch() { const query = document.getElementById('card-search-input').value; const game = document.getElementById('game-selector').value; if (query.length < 3) { UI.renderSearchResults("Enter at least 3 characters to search."); return; } UI.renderSearchResults("Searching..."); try { const results = await API.searchCards(query, game); UI.renderSearchResults(results); } catch (error) { console.error("Search failed:", error); UI.renderSearchResults(`Error: ${error.message}`); } }
async function handleSaveCard(e) { e.preventDefault(); const isEditing = !!document.getElementById('card-modal-id').value; try { if (isEditing) { const formData = UI.getCardFormData(true); await Collection.updateCard(formData.id, formData.data, formData.customImageFile); showToast("Card updated successfully!", "success"); } else { const versionsToAdd = Collection.getPendingCards(); if (document.getElementById('card-quantity').value > 0) { const currentVersionData = UI.getCardFormData(true).data; versionsToAdd.push(currentVersionData); } if(versionsToAdd.length === 0){ showToast("No card versions to add.", "info"); return; } await Collection.addMultipleCards(versionsToAdd); showToast(`${versionsToAdd.length} version(s) added!`, "success"); } UI.closeCardModal(); await renderFilteredCollection(); updateAllUI(); } catch (error) { console.error("Failed to save card(s):", error); showToast(`Error: ${error.message}`, "error"); } }
function handleAddAnotherVersion() { try { const { data: versionData } = UI.getCardFormData(true); if (versionData.quantity > 0) { Collection.addPendingCard(versionData); UI.renderPendingCards(Collection.getPendingCards()); UI.resetCardFormForNewVersion(); } else { showToast("Quantity must be at least 1.", "error"); } } catch (error) { showToast("Could not add version. Please fill out the form.", "error"); } }
function handleEnterBulkEditMode() { if (Bulk.enterBulkEditMode()) renderFilteredCollection(); }
async function handleBulkListForSale(e) { e.preventDefault(); await Bulk.applyBulkListForSale(); UI.closeBulkListSaleModal(); await renderFilteredCollection(); }
async function handleCollectionDisplayClick(e) {
    if (e.target.id === 'bulk-select-all') { Bulk.toggleSelectAll(e.target.checked); await renderFilteredCollection(); return; }
    const cardElement = e.target.closest('.card-container');
    if (!cardElement) return;
    const cardId = cardElement.dataset.id;
    const actionButton = e.target.closest('[data-action]');
    if (Bulk.isBulkEditMode()) { if (!actionButton) { Bulk.toggleCardSelection(cardId); await renderFilteredCollection(); } return; }
    if (actionButton) {
        const action = actionButton.dataset.action;
        switch (action) {
            case 'edit': const cardData = Collection.getCardById(cardId); if (cardData) UI.populateCardModalForEdit(cardData); break;
            case 'delete': if (confirm('Are you sure you want to delete this card entry?')) { try { await Collection.deleteCard(cardId); showToast('Card deleted.', 'success'); await renderFilteredCollection(); updateAllUI(); } catch (error) { console.error('Deletion failed:', error); showToast(`Error: ${error.message}`, 'error'); } } break;
            case 'list': const cardToList = Collection.getCardById(cardId); if (cardToList) UI.populateCardModalForEdit(cardToList, true); break;
        }
    }
}

init();