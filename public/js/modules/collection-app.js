/**
 * Collection App Module
 * Main application controller that manages state and coordinates between modules
 */

// Application state
let currentUser = null;
let collectionData = [];
let wishlistData = [];
let currentTab = 'collection';
let currentView = 'grid';
let currentSort = 'name';
let currentFilter = 'all';
let searchQuery = '';

/**
 * Initialize the application
 */
async function initializeApp() {
    try {
        // Initialize Firebase auth state listener
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                await loadCollectionData();
                initializeEventListeners();
                renderCurrentView();
                updateStats();
            } else {
                // Redirect to login if not authenticated
                window.location.href = '/auth.html';
            }
        });
        
    } catch (error) {
        console.error('Error initializing app:', error);
        window.Utils.showNotification('Error initializing application', 'error');
    }
}

/**
 * Load collection and wishlist data
 */
async function loadCollectionData() {
    if (!currentUser) return;
    
    try {
        // Load collection
        const collectionSnapshot = await db.collection('users').doc(currentUser.uid).collection('collection').get();
        collectionData = collectionSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Load wishlist
        const wishlistSnapshot = await db.collection('users').doc(currentUser.uid).collection('wishlist').get();
        wishlistData = wishlistSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`Loaded ${collectionData.length} collection items and ${wishlistData.length} wishlist items`);
        
    } catch (error) {
        console.error('Error loading collection data:', error);
        window.Utils.showNotification('Error loading collection data', 'error');
    }
}

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
    // Tab switching
    const collectionTab = document.getElementById('collection-tab');
    const wishlistTab = document.getElementById('wishlist-tab');
    
    if (collectionTab) {
        collectionTab.addEventListener('click', () => switchTab('collection'));
    }
    if (wishlistTab) {
        wishlistTab.addEventListener('click', () => switchTab('wishlist'));
    }
    
    // View switching
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    
    if (gridViewBtn) {
        gridViewBtn.addEventListener('click', () => switchView('grid'));
    }
    if (listViewBtn) {
        listViewBtn.addEventListener('click', () => switchView('list'));
    }
    
    // Sorting
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderCurrentView();
        });
    }
    
    // Filtering
    const filterSelect = document.getElementById('filter-select');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            currentFilter = e.target.value;
            renderCurrentView();
        });
    }
    
    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', window.Utils.debounce((e) => {
            searchQuery = e.target.value.toLowerCase();
            renderCurrentView();
        }, 300));
    }
    
    // Initialize module event listeners
    window.BulkOperations.initializeBulkOperations();
    window.CSVImport.initializeCSVImport();
    window.SealedProducts.initializeSealedProducts();
    window.CardSearch.initializeSearch();
}

/**
 * Switch between collection and wishlist tabs
 */
function switchTab(tab) {
    currentTab = tab;
    
    // Update tab appearance
    const collectionTab = document.getElementById('collection-tab');
    const wishlistTab = document.getElementById('wishlist-tab');
    
    if (collectionTab && wishlistTab) {
        if (tab === 'collection') {
            collectionTab.classList.add('border-blue-500', 'text-blue-600');
            collectionTab.classList.remove('border-transparent', 'text-gray-500');
            wishlistTab.classList.remove('border-blue-500', 'text-blue-600');
            wishlistTab.classList.add('border-transparent', 'text-gray-500');
        } else {
            wishlistTab.classList.add('border-blue-500', 'text-blue-600');
            wishlistTab.classList.remove('border-transparent', 'text-gray-500');
            collectionTab.classList.remove('border-blue-500', 'text-blue-600');
            collectionTab.classList.add('border-transparent', 'text-gray-500');
        }
    }
    
    // Reset bulk operations when switching tabs
    window.BulkOperations.resetBulkOperations();
    
    renderCurrentView();
    updateStats();
}

/**
 * Switch between grid and list views
 */
function switchView(view) {
    currentView = view;
    
    // Update view button appearance
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    
    if (gridViewBtn && listViewBtn) {
        if (view === 'grid') {
            gridViewBtn.classList.add('bg-blue-600', 'text-white');
            gridViewBtn.classList.remove('bg-gray-200', 'text-gray-700');
            listViewBtn.classList.remove('bg-blue-600', 'text-white');
            listViewBtn.classList.add('bg-gray-200', 'text-gray-700');
        } else {
            listViewBtn.classList.add('bg-blue-600', 'text-white');
            listViewBtn.classList.remove('bg-gray-200', 'text-gray-700');
            gridViewBtn.classList.remove('bg-blue-600', 'text-white');
            gridViewBtn.classList.add('bg-gray-200', 'text-gray-700');
        }
    }
    
    renderCurrentView();
}

/**
 * Render current view based on tab and view mode
 */
function renderCurrentView() {
    const data = currentTab === 'collection' ? collectionData : wishlistData;
    const filteredData = filterAndSortData(data);
    
    if (currentView === 'grid') {
        renderGridView(filteredData);
    } else {
        renderListView(filteredData);
    }
}

/**
 * Filter and sort data
 */
function filterAndSortData(data) {
    let filtered = [...data];
    
    // Apply search filter
    if (searchQuery) {
        filtered = filtered.filter(item => 
            item.name?.toLowerCase().includes(searchQuery) ||
            item.set_name?.toLowerCase().includes(searchQuery) ||
            item.setName?.toLowerCase().includes(searchQuery)
        );
    }
    
    // Apply type filter
    if (currentFilter !== 'all') {
        if (currentFilter === 'singles') {
            filtered = filtered.filter(item => item.productType !== 'sealed');
        } else if (currentFilter === 'sealed') {
            filtered = filtered.filter(item => item.productType === 'sealed');
        } else if (currentFilter === 'foil') {
            filtered = filtered.filter(item => item.isFoil);
        } else if (currentFilter === 'for-sale') {
            filtered = filtered.filter(item => item.forSale);
        }
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
        switch (currentSort) {
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            case 'set':
                return (a.set_name || a.setName || '').localeCompare(b.set_name || b.setName || '');
            case 'price':
                const priceA = a.prices?.usd || a.price || 0;
                const priceB = b.prices?.usd || b.price || 0;
                return priceB - priceA;
            case 'date':
                const dateA = a.dateAdded?.toDate?.() || new Date(0);
                const dateB = b.dateAdded?.toDate?.() || new Date(0);
                return dateB - dateA;
            default:
                return 0;
        }
    });
    
    return filtered;
}

/**
 * Render grid view
 */
function renderGridView(data) {
    const gridContainer = document.getElementById('collection-grid');
    const listContainer = document.getElementById('collection-list-view');
    
    if (!gridContainer || !listContainer) return;
    
    // Show grid, hide list
    gridContainer.style.display = 'grid';
    listContainer.style.display = 'none';
    
    // Clear and populate grid
    gridContainer.innerHTML = '';
    
    if (data.length === 0) {
        gridContainer.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8">No items found</div>';
        return;
    }
    
    data.forEach(item => {
        const cardElement = window.CardDisplay.createCardElement(
            item, 
            window.BulkOperations.isBulkEditMode(), 
            window.BulkOperations.getSelectedItems()
        );
        gridContainer.appendChild(cardElement);
    });
}

/**
 * Render list view
 */
function renderListView(data) {
    const gridContainer = document.getElementById('collection-grid');
    const listContainer = document.getElementById('collection-list-view');
    
    if (!gridContainer || !listContainer) return;
    
    // Show list, hide grid
    gridContainer.style.display = 'none';
    listContainer.style.display = 'block';
    
    // Clear and populate list
    listContainer.innerHTML = '';
    
    if (data.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-gray-500 py-8">No items found</div>';
        return;
    }
    
    data.forEach(item => {
        const listElement = window.CardDisplay.createListElement(
            item, 
            window.BulkOperations.isBulkEditMode(), 
            window.BulkOperations.getSelectedItems()
        );
        listContainer.appendChild(listElement);
    });
}

/**
 * Update statistics
 */
function updateStats() {
    const data = currentTab === 'collection' ? collectionData : wishlistData;
    
    // Calculate stats
    const totalItems = data.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const uniqueCards = data.length;
    const totalValue = data.reduce((sum, item) => {
        const price = item.prices?.usd || item.price || 0;
        const quantity = item.quantity || 1;
        return sum + (price * quantity);
    }, 0);
    
    // Update display
    const totalItemsElement = document.getElementById('total-items');
    const uniqueCardsElement = document.getElementById('unique-cards');
    const totalValueElement = document.getElementById('total-value');
    
    if (totalItemsElement) totalItemsElement.textContent = totalItems;
    if (uniqueCardsElement) uniqueCardsElement.textContent = uniqueCards;
    if (totalValueElement) totalValueElement.textContent = window.Utils.safeFormatPrice(totalValue);
}

/**
 * Add item to collection or wishlist
 */
function addItem(item, listType) {
    if (listType === 'collection') {
        collectionData.push(item);
    } else {
        wishlistData.push(item);
    }
    
    renderCurrentView();
    updateStats();
}

/**
 * Remove item from collection or wishlist
 */
function removeItem(itemId, listType) {
    if (listType === 'collection') {
        collectionData = collectionData.filter(item => item.id !== itemId);
    } else {
        wishlistData = wishlistData.filter(item => item.id !== itemId);
    }
    
    renderCurrentView();
    updateStats();
}

/**
 * Remove multiple items
 */
function removeItems(itemIds, listType) {
    if (listType === 'collection') {
        collectionData = collectionData.filter(item => !itemIds.includes(item.id));
    } else {
        wishlistData = wishlistData.filter(item => !itemIds.includes(item.id));
    }
    
    renderCurrentView();
    updateStats();
}

/**
 * Update items for sale status
 */
function updateItemsForSale(itemIds, salePrice) {
    const data = currentTab === 'collection' ? collectionData : wishlistData;
    
    data.forEach(item => {
        if (itemIds.includes(item.id)) {
            item.forSale = true;
            if (salePrice && !isNaN(parseFloat(salePrice))) {
                item.salePrice = parseFloat(salePrice);
            }
        }
    });
}

// Getter functions for other modules
function getCurrentUser() { return currentUser; }
function getCollectionData() { return collectionData; }
function getWishlistData() { return wishlistData; }
function getCurrentTab() { return currentTab; }
function getCurrentView() { return currentView; }

// Export functions
window.CollectionApp = {
    initializeApp,
    loadCollectionData,
    renderCurrentView,
    switchTab,
    switchView,
    addItem,
    removeItem,
    removeItems,
    updateItemsForSale,
    getCurrentUser,
    getCollectionData,
    getWishlistData,
    getCurrentTab,
    getCurrentView
};

