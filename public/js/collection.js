/**
 * collection.js - Main controller for the My Collection page.
 * This file orchestrates the page logic by importing functions from specialized modules.
 */

// Import functions from modules
import { showNotification, debounce } from './modules/utils.js';
import { searchMagicCards, searchPokemonCards } from './modules/api.js';
import { handleCSVUpload } from './modules/csv.js';
import { renderGridView, updateSelectedCount, populateFilters, calculateAndDisplayStats } from './modules/ui.js';

document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    if (!user) {
        document.querySelector('main.container').innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to manage your collection.</p>';
        return;
    }

    const db = firebase.firestore();

    // --- State Management ---
    let fullCollection = [];
    let filteredCollection = [];
    let selectedCards = new Set();
    let bulkEditMode = false;
    let currentView = 'grid';

    // --- DOM Element References ---
    const elements = {
        collectionGridView: document.getElementById('collection-grid-view'),
        collectionTableView: document.getElementById('collection-table-view'),
        bulkEditBtn: document.getElementById('bulk-edit-btn'),
        bulkActionBar: document.getElementById('bulk-action-bar'),
        selectedCountEl: document.getElementById('selected-count'),
        selectAllCheckbox: document.getElementById('select-all-checkbox'),
        deleteSelectedBtn: document.getElementById('delete-selected-btn'),
        listSelectedBtn: document.getElementById('list-selected-btn'),
        csvUploadBtn: document.getElementById('csv-upload-btn'),
        csvUploadInput: document.getElementById('csv-upload-input'),
        csvStatus: document.getElementById('csv-status'),
        filterName: document.getElementById('filter-name'),
        filterSet: document.getElementById('filter-set'),
        filterRarity: document.getElementById('filter-rarity'),
        filterColor: document.getElementById('filter-color'),
        filterProductType: document.getElementById('filter-product-type'),
        resetFiltersBtn: document.getElementById('reset-filters-btn'),
        searchCardVersionsBtn: document.getElementById('search-card-versions-btn'),
    };
    
    // --- Core Logic ---
    const loadCollectionData = async () => {
        try {
            const snapshot = await db.collection('users').doc(user.uid).collection('collection').get();
            fullCollection = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            populateFilters(elements.filterSet, fullCollection);
            calculateAndDisplayStats(fullCollection);
            applyFilters();
        } catch (error) {
            console.error("Error loading collection:", error);
            showNotification("Could not load your collection.", "error");
        }
    };

    const applyFilters = () => {
        const filters = {
            name: elements.filterName.value.toLowerCase(),
            set: elements.filterSet.value,
            rarity: elements.filterRarity.value,
            color: elements.filterColor.value,
            productType: elements.filterProductType.value
        };

        filteredCollection = fullCollection.filter(card => {
            if (filters.name && !card.name.toLowerCase().includes(filters.name)) return false;
            if (filters.set !== 'all' && card.setName !== filters.set) return false;
            if (filters.rarity !== 'all' && card.rarity !== filters.rarity) return false;
            // Add more filter logic here if needed (e.g., color, productType)
            return true;
        });
        
        renderCurrentView();
    };

    const renderCurrentView = () => {
        const handlers = { onCardClick };
        const state = { bulkEditMode, selectedCards };
        if (currentView === 'grid') {
            renderGridView(elements.collectionGridView, filteredCollection, state, handlers);
        } else {
            // renderListView(...) would go here if implemented
        }
    };
    
    const onCardClick = (event, cardId) => {
        if (bulkEditMode) {
            if (selectedCards.has(cardId)) {
                selectedCards.delete(cardId);
            } else {
                selectedCards.add(cardId);
            }
            updateSelectedCount(elements.selectedCountEl, selectedCards.size);
            renderCurrentView(); // Re-render to show selection change
        } else {
            // Logic for opening a single card modal
            console.log("Open modal for card:", cardId);
        }
    };

    const toggleBulkEditMode = () => {
        bulkEditMode = !bulkEditMode;
        selectedCards.clear();
        elements.selectAllCheckbox.checked = false;
        elements.bulkActionBar.classList.toggle('hidden', !bulkEditMode);
        elements.bulkEditBtn.textContent = bulkEditMode ? 'Cancel Bulk Edit' : 'Bulk Edit';
        elements.bulkEditBtn.classList.toggle('bg-red-600', bulkEditMode);
        updateSelectedCount(elements.selectedCountEl, 0);
        renderCurrentView();
    };
    
    const deleteSelectedCards = async () => {
        if (selectedCards.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedCards.size} cards?`)) return;

        const batch = db.batch();
        selectedCards.forEach(id => batch.delete(db.collection('users').doc(user.uid).collection('collection').doc(id)));
        
        try {
            await batch.commit();
            showNotification(`${selectedCards.size} cards deleted.`, 'success');
            toggleBulkEditMode();
            loadCollectionData();
        } catch (error) {
            console.error("Error deleting cards:", error);
            showNotification("Failed to delete cards.", "error");
        }
    };

    // --- Event Listener Wiring ---
    elements.bulkEditBtn.addEventListener('click', toggleBulkEditMode);
    elements.deleteSelectedBtn.addEventListener('click', deleteSelectedCards);
    elements.resetFiltersBtn.addEventListener('click', () => {
        elements.filterName.value = '';
        elements.filterSet.value = 'all';
        elements.filterRarity.value = 'all';
        elements.filterColor.value = 'all';
        elements.filterProductType.value = 'all';
        applyFilters();
    });

    [elements.filterName, elements.filterSet, elements.filterRarity, elements.filterColor, elements.filterProductType].forEach(el => {
        el.addEventListener('input', debounce(applyFilters, 300));
    });
    
    elements.selectAllCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            filteredCollection.forEach(card => selectedCards.add(card.id));
        } else {
            selectedCards.clear();
        }
        updateSelectedCount(elements.selectedCountEl, selectedCards.size);
        renderCurrentView();
    });
    
    elements.csvUploadBtn.addEventListener('click', () => {
        const file = elements.csvUploadInput.files[0];
        handleCSVUpload(file, db, user, elements.csvStatus, loadCollectionData);
    });

    // --- Initial Load ---
    loadCollectionData();
});
