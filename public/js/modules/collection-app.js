/**
 * Collection App Module
 * Main application controller that manages state and coordinates between modules
 */
window.CollectionApp = (() => {
    let currentUser = null;
    let db = null;
    let fullCollection = [];
    let fullWishlist = [];
    let filteredCollection = [];
    let currentTab = 'collection';
    let currentView = 'grid';

    function initialize(user, firestore) {
        currentUser = user;
        db = firestore;
        console.log(`[CollectionApp] Initializing for user ${user.uid}`);
        loadAllData();
        initializeEventListeners();
    }

    async function loadAllData() {
        console.log("[CollectionApp] Loading all data from Firestore...");
        await Promise.all([loadCollectionData(), loadWishlistData()]);
        updateStats(currentTab === 'collection' ? fullCollection : fullWishlist);
        renderCurrentView();
    }

    async function loadCollectionData() {
        try {
            const snapshot = await db.collection('users').doc(currentUser.uid).collection('collection').orderBy('name').get();
            fullCollection = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("[CollectionApp] Error loading collection:", error);
            window.Utils.showNotification('Could not load your collection.', 'error');
        }
    }

    async function loadWishlistData() {
        try {
            const snapshot = await db.collection('users').doc(currentUser.uid).collection('wishlist').orderBy('name').get();
            fullWishlist = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("[CollectionApp] Error loading wishlist:", error);
            window.Utils.showNotification('Could not load your wishlist.', 'error');
        }
    }

    function initializeEventListeners() {
        document.getElementById('tab-collection')?.addEventListener('click', () => switchTab('collection'));
        document.getElementById('tab-wishlist')?.addEventListener('click', () => switchTab('wishlist'));
        document.getElementById('grid-view-btn')?.addEventListener('click', () => switchView('grid'));
        document.getElementById('list-view-btn')?.addEventListener('click', () => switchView('list'));
        document.querySelector('main').addEventListener('click', handleCardActionClick);
    }

    function switchTab(tabName) {
        currentTab = tabName;
        // UI updates for tabs...
        document.getElementById('content-collection').classList.toggle('hidden', tabName !== 'collection');
        document.getElementById('content-wishlist').classList.toggle('hidden', tabName !== 'wishlist');
        ['collection', 'wishlist'].forEach(t => {
            const tabEl = document.getElementById(`tab-${t}`);
            tabEl.classList.toggle('text-blue-600', tabName === t);
            tabEl.classList.toggle('border-blue-600', tabName === t);
            tabEl.classList.toggle('text-gray-500', tabName !== t);
            tabEl.classList.toggle('border-transparent', tabName !== t);
        });
        
        const dataForStats = tabName === 'collection' ? fullCollection : fullWishlist;
        updateStats(dataForStats);

        if (window.BulkOperations.isBulkEditMode()) {
            window.BulkOperations.toggleBulkEditMode();
        }
        renderCurrentView();
    }
    
    function switchView(viewName) {
        currentView = viewName;
        // UI updates for view buttons...
        document.getElementById('grid-view-btn').classList.toggle('bg-blue-600', viewName === 'grid');
        document.getElementById('grid-view-btn').classList.toggle('text-white', viewName === 'grid');
        document.getElementById('list-view-btn').classList.toggle('bg-blue-600', viewName === 'list');
        document.getElementById('list-view-btn').classList.toggle('text-white', viewName === 'list');
        renderCurrentView();
    }

    function renderCurrentView() {
        applyFiltersAndSort();
        if (currentTab === 'collection') {
            const gridContainer = document.getElementById('collection-grid-view');
            const listContainer = document.getElementById('collection-table-view');
            if (currentView === 'grid') {
                window.CardDisplay.renderGridView(gridContainer, filteredCollection);
            } else {
                window.CardDisplay.renderListView(listContainer, filteredCollection);
            }
        } else {
            const wishlistContainer = document.getElementById('wishlist-list');
            window.CardDisplay.renderWishlist(wishlistContainer, fullWishlist);
        }
    }
    
    function applyFiltersAndSort() {
        filteredCollection = [...fullCollection];
    }
    
    function updateStats(cardList) {
        const totalCards = cardList.reduce((sum, card) => sum + (card.quantity || 1), 0);
        const uniqueCards = new Set(cardList.map(c => c.name)).size;
        const totalValue = cardList.reduce((sum, card) => {
            const price = parseFloat(card.priceUsd) || 0;
            return sum + (price * (card.quantity || 1));
        }, 0);
        
        document.getElementById('stats-total-cards').textContent = totalCards.toLocaleString();
        document.getElementById('stats-unique-cards').textContent = uniqueCards.toLocaleString();
        document.getElementById('stats-total-value').textContent = window.Utils.safeFormatPrice(totalValue);
    }

    function handleCardActionClick(e) {
        const cardElement = e.target.closest('[data-id]');
        if (!cardElement) return;

        const cardId = cardElement.dataset.id;
        
        if (e.target.closest('.delete-card-btn')) {
            const listType = e.target.closest('[data-list]').dataset.list;
            const cardData = (listType === 'collection' ? fullCollection : fullWishlist).find(c => c.id === cardId);
            if (confirm(`Are you sure you want to delete "${cardData.name}"?`)) {
                deleteCard(cardId, listType);
            }
        } else if (e.target.closest('.edit-card-btn')) {
            const listType = e.target.closest('[data-list]').dataset.list;
            const cardData = (listType === 'collection' ? fullCollection : fullWishlist).find(c => c.id === cardId);
            window.CardModal.openCardManagementModal(cardData, cardData);
        } else if (window.BulkOperations.isBulkEditMode()) {
            window.BulkOperations.handleCardSelection(cardId);
        }
    }

    async function deleteCard(cardId, listType) {
        try {
            await db.collection('users').doc(currentUser.uid).collection(listType).doc(cardId).delete();
            
            if (listType === 'collection') {
                fullCollection = fullCollection.filter(c => c.id !== cardId);
                updateStats(fullCollection);
            } else {
                fullWishlist = fullWishlist.filter(c => c.id !== cardId);
                updateStats(fullWishlist);
            }
            renderCurrentView();
            window.Utils.showNotification('Card deleted successfully.', 'success');
        } catch (error) {
            console.error("Error deleting card:", error);
            window.Utils.showNotification('Could not delete card.', 'error');
        }
    }

    return {
        initialize,
        renderCurrentView,
        loadAllData,
        getCurrentUser: () => currentUser,
        getDb: () => db,
        getFullCollection: () => fullCollection,
        getFilteredCollection: () => filteredCollection,
    };
})();

