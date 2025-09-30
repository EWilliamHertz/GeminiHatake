/**
 * HatakeSocial - Trades Script (v25 - Collection Loading & User Search Fix)
 *
 * - FIX: Implemented proper collection loading for the "Your Collection" tab
 * - FIX: Added user search functionality in the trade modal
 * - FIX: Added trade basket integration from marketplace
 */

// --- Date Formatting Helper ---
const formatTimestamp = (timestamp) => {
    if (!timestamp || !timestamp.seconds) {
        return 'Unknown date';
    }
    const date = new Date(timestamp.seconds * 1000);
    const userDateFormat = localStorage.getItem('userDateFormat') || 'dmy'; // Default to D/M/Y

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (userDateFormat === 'mdy') {
        return `${month}/${day}/${year}`;
    }
    return `${day}/${month}/${year}`;
};

// Trade Window Class for the new interface
class TradeWindow {
    constructor(user, db) {
        this.user = user;
        this.db = db;
        this.currentTrade = {
            partner: null,
            yourCards: [],
            theirCards: [],
            yourValue: 0,
            theirValue: 0
        };
        this.yourCollection = [];
        this.theirCollection = [];
        this.currentBinder = 'your';
        this.tradeBasket = JSON.parse(localStorage.getItem('tradeBasket') || '[]');
        
        this.initializeTradeWindow();
    }

    initializeTradeWindow() {
        this.loadYourCollection();
        this.bindEvents();
        this.updateTradeBasketCounter();
        this.bindTradeBasketButton();
        this.loadTradeBasketItems();
        
        // ADDED: Handle URL parameters and pending trades
        this.handleUrlParameters();
        this.processPendingTrade();
    }

    bindEvents() {
        // Binder tab switching
        document.getElementById('your-binder-tab')?.addEventListener('click', () => {
            this.switchBinder('your');
        });

        document.getElementById('their-binder-tab')?.addEventListener('click', () => {
            this.switchBinder('their');
        });

        // Search functionality
        document.getElementById('binder-search')?.addEventListener('input', (e) => {
            this.filterCards(e.target.value);
        });

        // Game filters
        document.querySelectorAll('.game-filter').forEach(filter => {
            filter.addEventListener('change', () => {
                this.applyFilters();
            });
        });

        // View toggles
        document.getElementById('view-toggle-grid')?.addEventListener('click', () => {
            this.setViewMode('grid');
        });

        document.getElementById('view-toggle-list')?.addEventListener('click', () => {
            this.setViewMode('list');
        });

        // Trade actions
        document.getElementById('propose-trade-btn')?.addEventListener('click', () => {
            this.proposeTrade();
        });

        document.getElementById('autobalance-btn')?.addEventListener('click', () => {
            this.autoBalance();
        });

        // Legacy view toggle
        document.getElementById('toggle-legacy-view')?.addEventListener('click', () => {
            this.toggleLegacyView();
        });

        // ADDED: Trade partner selection functionality
        document.getElementById('trade-partner-name')?.addEventListener('click', () => {
            this.openUserSearchModal();
        });
    }

    async loadYourCollection() {
        const binderContent = document.getElementById('binder-content');
        if (!binderContent) return;

        try {
            binderContent.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
                    <p>Loading your collection...</p>
                </div>
            `;

            // Load user's collection from Firestore - FIXED: Use correct subcollection path
            const collectionRef = this.db.collection('users')
                .doc(this.user.uid)
                .collection('collection')
                .orderBy('addedAt', 'desc');

            const snapshot = await collectionRef.get();
            this.yourCollection = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                this.yourCollection.push({
                    id: doc.id,
                    ...data,
                    cardData: data.cardData || data
                });
            });

            console.log(`Loaded ${this.yourCollection.length} cards from user collection`);
            this.displayCards();

        } catch (error) {
            console.error('Error loading collection:', error);
            binderContent.innerHTML = `
                <div class="text-center text-red-500 dark:text-red-400 py-8">
                    <i class="fas fa-exclamation-triangle text-3xl mb-2"></i>
                    <p>Error loading collection: ${error.message}</p>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    async loadTheirCollection(partnerId) {
        if (!partnerId) return;

        try {
            // FIXED: Use correct subcollection path for partner's collection
            const collectionRef = this.db.collection('users')
                .doc(partnerId)
                .collection('collection')
                .orderBy('addedAt', 'desc');

            const snapshot = await collectionRef.get();
            this.theirCollection = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                this.theirCollection.push({
                    id: doc.id,
                    ...data,
                    cardData: data.cardData || data
                });
            });

            console.log(`Loaded ${this.theirCollection.length} cards from partner collection`);
            
            if (this.currentBinder === 'their') {
                this.displayCards();
            }

        } catch (error) {
            console.error('Error loading partner collection:', error);
        }
    }

    switchBinder(binderType) {
        this.currentBinder = binderType;
        
        // Update tab appearance
        document.getElementById('your-binder-tab')?.classList.toggle('border-blue-600', binderType === 'your');
        document.getElementById('your-binder-tab')?.classList.toggle('text-blue-600', binderType === 'your');
        document.getElementById('your-binder-tab')?.classList.toggle('border-transparent', binderType !== 'your');
        document.getElementById('your-binder-tab')?.classList.toggle('text-gray-500', binderType !== 'your');

        document.getElementById('their-binder-tab')?.classList.toggle('border-blue-600', binderType === 'their');
        document.getElementById('their-binder-tab')?.classList.toggle('text-blue-600', binderType === 'their');
        document.getElementById('their-binder-tab')?.classList.toggle('border-transparent', binderType !== 'their');
        document.getElementById('their-binder-tab')?.classList.toggle('text-gray-500', binderType !== 'their');

        this.displayCards();
    }

    displayCards() {
        const binderContent = document.getElementById('binder-content');
        if (!binderContent) return;

        const cards = this.currentBinder === 'your' ? this.yourCollection : this.theirCollection;
        const filteredCards = this.applyFilters(cards);

        if (filteredCards.length === 0) {
            const message = this.currentBinder === 'your' 
                ? 'No cards in your collection match the current filters.'
                : this.currentTrade.partner 
                    ? 'No cards in partner\'s collection match the current filters.'
                    : 'Select a trading partner to view their collection.';

            binderContent.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="fas fa-cards-blank text-3xl mb-2"></i>
                    <p>${message}</p>
                </div>
            `;
            return;
        }

        // Create card grid
        const cardsHtml = filteredCards.map(card => this.createCardHtml(card)).join('');
        binderContent.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                ${cardsHtml}
            </div>
        `;

        // Add click listeners
        this.addCardClickListeners();
    }

    createCardHtml(card) {
        const cardData = card.cardData || card;
        const imageUrl = cardData.image_uris?.normal || 
                        cardData.image_uris?.large || 
                        cardData.images?.large || 
                        cardData.imageUrl || 
                        'https://via.placeholder.com/223x310?text=No+Image';

        const price = cardData.priceUsd || cardData.price || 0;
        const isInTrade = this.currentBinder === 'your' 
            ? this.currentTrade.yourCards.some(c => c.id === card.id)
            : this.currentTrade.theirCards.some(c => c.id === card.id);

        return `
            <div class="trade-card bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer ${isInTrade ? 'ring-2 ring-blue-500' : ''}" 
                 data-card-id="${card.id}">
                <div class="relative">
                    <img src="${imageUrl}" 
                         alt="${cardData.name || 'Card'}" 
                         class="w-full h-32 object-cover"
                         onerror="this.src='https://via.placeholder.com/223x310?text=No+Image'">
                    ${isInTrade ? '<div class="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1"><i class="fas fa-check text-xs"></i></div>' : ''}
                </div>
                <div class="p-2">
                    <h4 class="font-medium text-sm mb-1 text-gray-900 dark:text-white truncate">${cardData.name || 'Unknown Card'}</h4>
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-gray-600 dark:text-gray-400">${cardData.game || 'Unknown'}</span>
                        <span class="font-bold text-green-600 dark:text-green-400">$${price.toFixed(2)}</span>
                    </div>
                    ${card.quantity > 1 ? `<div class="text-xs text-gray-500 mt-1">Qty: ${card.quantity}</div>` : ''}
                </div>
            </div>
        `;
    }

    addCardClickListeners() {
        document.querySelectorAll('.trade-card').forEach(cardElement => {
            cardElement.addEventListener('click', () => {
                const cardId = cardElement.getAttribute('data-card-id');
                this.toggleCardInTrade(cardId);
            });
        });
    }

    toggleCardInTrade(cardId) {
        if (this.currentBinder === 'your') {
            const cardIndex = this.currentTrade.yourCards.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                // Remove from trade
                this.currentTrade.yourCards.splice(cardIndex, 1);
            } else {
                // Add to trade
                const card = this.yourCollection.find(c => c.id === cardId);
                if (card) {
                    this.currentTrade.yourCards.push(card);
                }
            }
            this.updateYourTradeDisplay();
        } else if (this.currentBinder === 'their' && this.currentTrade.partner) {
            const cardIndex = this.currentTrade.theirCards.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                // Remove from trade
                this.currentTrade.theirCards.splice(cardIndex, 1);
            } else {
                // Add to trade
                const card = this.theirCollection.find(c => c.id === cardId);
                if (card) {
                    this.currentTrade.theirCards.push(card);
                }
            }
            this.updateTheirTradeDisplay();
        }

        this.displayCards(); // Refresh to show selection state
        this.updateTradeValues();
        this.updateProposalButton();
    }

    updateYourTradeDisplay() {
        const container = document.getElementById('your-trade-cards');
        if (!container) return;

        if (this.currentTrade.yourCards.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="fas fa-plus-circle text-3xl mb-2"></i>
                    <p>Add cards from your collection</p>
                </div>
            `;
            return;
        }

        const cardsHtml = this.currentTrade.yourCards.map(card => {
            const cardData = card.cardData || card;
            const imageUrl = cardData.image_uris?.normal || cardData.image_uris?.large || cardData.images?.large || cardData.imageUrl;
            return `
                <div class="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <img src="${imageUrl}" alt="${cardData.name}" class="w-8 h-8 object-cover rounded" onerror="this.src='https://via.placeholder.com/32x32?text=?'">
                    <span class="flex-1 text-sm truncate">${cardData.name}</span>
                    <button class="text-red-500 hover:text-red-700" onclick="tradeWindow.removeCardFromTrade('${card.id}', 'your')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = cardsHtml;
    }

    updateTheirTradeDisplay() {
        const container = document.getElementById('their-trade-cards');
        if (!container) return;

        if (this.currentTrade.theirCards.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="fas fa-user-plus text-3xl mb-2"></i>
                    <p>Partner's cards will appear here</p>
                </div>
            `;
            return;
        }

        const cardsHtml = this.currentTrade.theirCards.map(card => {
            const cardData = card.cardData || card;
            const imageUrl = cardData.image_uris?.normal || cardData.image_uris?.large || cardData.images?.large || cardData.imageUrl;
            return `
                <div class="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <img src="${imageUrl}" alt="${cardData.name}" class="w-8 h-8 object-cover rounded" onerror="this.src='https://via.placeholder.com/32x32?text=?'">
                    <span class="flex-1 text-sm truncate">${cardData.name}</span>
                    <button class="text-red-500 hover:text-red-700" onclick="tradeWindow.removeCardFromTrade('${card.id}', 'their')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = cardsHtml;
    }

    removeCardFromTrade(cardId, side) {
        if (side === 'your') {
            const index = this.currentTrade.yourCards.findIndex(c => c.id === cardId);
            if (index > -1) {
                this.currentTrade.yourCards.splice(index, 1);
                this.updateYourTradeDisplay();
            }
        } else {
            const index = this.currentTrade.theirCards.findIndex(c => c.id === cardId);
            if (index > -1) {
                this.currentTrade.theirCards.splice(index, 1);
                this.updateTheirTradeDisplay();
            }
        }

        this.displayCards(); // Refresh to show selection state
        this.updateTradeValues();
        this.updateProposalButton();
    }

    updateTradeValues() {
        this.currentTrade.yourValue = this.currentTrade.yourCards.reduce((sum, card) => {
            const cardData = card.cardData || card;
            return sum + (cardData.priceUsd || cardData.price || 0);
        }, 0);

        this.currentTrade.theirValue = this.currentTrade.theirCards.reduce((sum, card) => {
            const cardData = card.cardData || card;
            return sum + (cardData.priceUsd || cardData.price || 0);
        }, 0);

        // Update display
        const yourValueEl = document.getElementById('your-trade-value');
        const theirValueEl = document.getElementById('their-trade-value');

        if (yourValueEl) {
            yourValueEl.textContent = `$${this.currentTrade.yourValue.toFixed(2)}`;
        }

        if (theirValueEl) {
            theirValueEl.textContent = `$${this.currentTrade.theirValue.toFixed(2)}`;
        }
    }

    updateProposalButton() {
        const proposeBtn = document.getElementById('propose-trade-btn');
        const autoBalanceBtn = document.getElementById('autobalance-btn');

        if (proposeBtn) {
            const canPropose = this.currentTrade.partner && 
                              (this.currentTrade.yourCards.length > 0 || this.currentTrade.theirCards.length > 0);
            proposeBtn.disabled = !canPropose;
        }

        if (autoBalanceBtn) {
            const canBalance = this.currentTrade.partner && 
                              (this.currentTrade.yourCards.length > 0 || this.currentTrade.theirCards.length > 0);
            autoBalanceBtn.disabled = !canBalance;
        }
    }

    applyFilters(cards = null) {
        const cardsToFilter = cards || (this.currentBinder === 'your' ? this.yourCollection : this.theirCollection);
        
        // Search filter
        const searchTerm = document.getElementById('binder-search')?.value.toLowerCase() || '';
        
        // Game filters
        const checkedGames = Array.from(document.querySelectorAll('.game-filter:checked'))
            .map(cb => cb.getAttribute('data-game'));

        return cardsToFilter.filter(card => {
            const cardData = card.cardData || card;
            
            // Search filter
            const matchesSearch = !searchTerm || 
                (cardData.name || '').toLowerCase().includes(searchTerm) ||
                (cardData.set_name || cardData.set || '').toLowerCase().includes(searchTerm);

            // Game filter
            const matchesGame = checkedGames.length === 0 || 
                checkedGames.includes((cardData.game || '').toLowerCase());

            return matchesSearch && matchesGame;
        });
    }

    filterCards(searchTerm) {
        this.displayCards();
    }

    setViewMode(mode) {
        const gridToggle = document.getElementById('view-toggle-grid');
        const listToggle = document.getElementById('view-toggle-list');

        if (mode === 'grid') {
            gridToggle?.classList.add('bg-blue-600', 'text-white');
            gridToggle?.classList.remove('bg-gray-300', 'text-gray-700');
            listToggle?.classList.remove('bg-blue-600', 'text-white');
            listToggle?.classList.add('bg-gray-300', 'text-gray-700');
        } else {
            listToggle?.classList.add('bg-blue-600', 'text-white');
            listToggle?.classList.remove('bg-gray-300', 'text-gray-700');
            gridToggle?.classList.remove('bg-blue-600', 'text-white');
            gridToggle?.classList.add('bg-gray-300', 'text-gray-700');
        }
    }

    setTradePartner(partner) {
        this.currentTrade.partner = partner;
        
        // Update partner name display
        const partnerNameEl = document.getElementById('trade-partner-name');
        if (partnerNameEl) {
            partnerNameEl.textContent = partner.displayName || partner.email || 'Unknown User';
        }

        // Enable their binder tab
        const theirTab = document.getElementById('their-binder-tab');
        if (theirTab) {
            theirTab.disabled = false;
            theirTab.classList.remove('opacity-50');
        }

        // Load their collection
        this.loadTheirCollection(partner.uid);
        this.updateProposalButton();
    }

    loadTradeBasketItems() {
        // Add trade basket items to your trade automatically
        this.tradeBasket.forEach(basketCard => {
            // Convert basket card to collection format
            const collectionCard = {
                id: `basket_${basketCard.id}`,
                cardData: {
                    name: basketCard.name,
                    imageUrl: basketCard.imageUrl,
                    priceUsd: basketCard.priceUsd,
                    game: basketCard.game,
                    condition: basketCard.condition || 'Near Mint'
                },
                quantity: 1,
                condition: basketCard.condition || 'Near Mint',
                isFromBasket: true
            };

            // Add to your trade if not already there
            if (!this.currentTrade.yourCards.some(c => c.id === collectionCard.id)) {
                this.currentTrade.yourCards.push(collectionCard);
            }
        });

        if (this.tradeBasket.length > 0) {
            this.updateYourTradeDisplay();
            this.updateTradeValues();
            this.updateProposalButton();
            
            // Clear trade basket after loading
            localStorage.removeItem('tradeBasket');
            this.tradeBasket = [];
            this.updateTradeBasketCounter();
        }
    }

    updateTradeBasketCounter() {
        const counter = document.getElementById('trade-basket-counter');
        if (counter) {
            if (this.tradeBasket.length > 0) {
                counter.textContent = this.tradeBasket.length;
                counter.classList.remove('hidden');
            } else {
                counter.classList.add('hidden');
            }
        }
    }

    bindTradeBasketButton() {
        const tradeBasketBtn = document.getElementById('trade-basket-btn');
        if (tradeBasketBtn) {
            tradeBasketBtn.addEventListener('click', () => {
                // Already on trades page, just scroll to trade window
                document.getElementById('new-trading-interface')?.scrollIntoView({ behavior: 'smooth' });
            });
        }
    }

    toggleLegacyView() {
        const newInterface = document.getElementById('new-trading-interface');
        const legacySection = document.getElementById('legacy-trades-section');

        if (newInterface && legacySection) {
            newInterface.classList.toggle('hidden');
            legacySection.classList.toggle('hidden');
        }
    }

    async proposeTrade() {
        if (!this.currentTrade.partner) {
            alert('Please select a trading partner first.');
            return;
        }

        if (this.currentTrade.yourCards.length === 0 && this.currentTrade.theirCards.length === 0) {
            alert('Please add some cards to the trade.');
            return;
        }

        try {
            const tradeData = {
                proposerId: this.user.uid,
                proposerName: this.user.displayName || this.user.email,
                receiverId: this.currentTrade.partner.uid,
                receiverName: this.currentTrade.partner.displayName || this.currentTrade.partner.email,
                participants: [this.user.uid, this.currentTrade.partner.uid],
                proposerCards: this.currentTrade.yourCards.map(c => ({
                    id: c.id,
                    name: c.cardData?.name || 'Unknown Card',
                    imageUrl: c.cardData?.imageUrl || c.cardData?.image_uris?.normal,
                    priceUsd: c.cardData?.priceUsd || c.cardData?.price || 0,
                    game: c.cardData?.game || 'Unknown',
                    condition: c.condition || 'Near Mint'
                })),
                receiverCards: this.currentTrade.theirCards.map(c => ({
                    id: c.id,
                    name: c.cardData?.name || 'Unknown Card',
                    imageUrl: c.cardData?.imageUrl || c.cardData?.image_uris?.normal,
                    priceUsd: c.cardData?.priceUsd || c.cardData?.price || 0,
                    game: c.cardData?.game || 'Unknown',
                    condition: c.condition || 'Near Mint'
                })),
                proposerMoney: 0,
                receiverMoney: 0,
                notes: '',
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                proposerConfirmedShipment: false,
                receiverConfirmedShipment: false
            };

            await this.db.collection('trades').add(tradeData);
            
            // Show success message
            if (window.Toastify) {
                Toastify({
                    text: "Trade proposal sent successfully!",
                    duration: 3000,
                    style: { background: "linear-gradient(to right, #10b981, #059669)" }
                }).showToast();
            }

            // Reset trade
            this.resetTrade();

        } catch (error) {
            console.error('Error proposing trade:', error);
            alert('Failed to send trade proposal. Please try again.');
        }
    }

    resetTrade() {
        this.currentTrade = {
            partner: null,
            yourCards: [],
            theirCards: [],
            yourValue: 0,
            theirValue: 0
        };

        // Reset UI
        const partnerNameEl = document.getElementById('trade-partner-name');
        if (partnerNameEl) {
            partnerNameEl.textContent = 'Select a trading partner';
        }

        // Disable their binder tab
        const theirTab = document.getElementById('their-binder-tab');
        if (theirTab) {
            theirTab.disabled = true;
            theirTab.classList.add('opacity-50');
        }

        // Switch back to your binder
        this.switchBinder('your');

        // Update displays
        this.updateYourTradeDisplay();
        this.updateTheirTradeDisplay();
        this.updateTradeValues();
        this.updateProposalButton();
    }

    autoBalance() {
        // Simple auto-balance implementation
        const valueDiff = Math.abs(this.currentTrade.yourValue - this.currentTrade.theirValue);
        
        if (window.Toastify) {
            Toastify({
                text: `Value difference: $${valueDiff.toFixed(2)}. Auto-balance feature coming soon!`,
                duration: 3000,
                style: { background: "linear-gradient(to right, #f59e0b, #d97706)" }
            }).showToast();
        }
    }

    // ADDED: Open user search modal for trade partner selection
    openUserSearchModal() {
        // Create a simple modal for user search
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white">Select Trade Partner</h2>
                    <button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" id="close-user-search">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <input class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" 
                       id="partner-search-input" 
                       placeholder="Search for a user by name or email..." 
                       type="text"/>
                <div class="max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-700 rounded-md hidden" id="partner-search-results">
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Bind events
        const closeBtn = modal.querySelector('#close-user-search');
        const searchInput = modal.querySelector('#partner-search-input');
        const resultsContainer = modal.querySelector('#partner-search-results');

        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        // Use the existing user search functionality
        if (window.userSearch) {
            searchInput.addEventListener('input', (e) => {
                window.userSearch.handleSearch(e.target.value, 'partner-search-results');
            });
        }

        // Focus the search input
        searchInput.focus();
    }

    // ADDED: Handle URL parameters for pre-selected sellers
    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const sellerId = urlParams.get('seller');
        
        if (sellerId) {
            // Load seller information and set as trade partner
            this.loadSellerAsTradePartner(sellerId);
        }
    }

    // ADDED: Process pending trade data from marketplace
    processPendingTrade() {
        const pendingTrade = localStorage.getItem('pendingTrade');
        if (pendingTrade) {
            try {
                const tradeData = JSON.parse(pendingTrade);
                
                // Check if the trade data is recent (within 5 minutes)
                if (Date.now() - tradeData.timestamp < 5 * 60 * 1000) {
                    // Set the seller as trade partner
                    this.setTradePartner(tradeData.selectedSeller);
                    
                    // Show success message
                    if (window.Toastify) {
                        Toastify({
                            text: `Trade partner set to ${tradeData.selectedSeller.displayName || tradeData.selectedSeller.email}`,
                            duration: 3000,
                            style: { background: "linear-gradient(to right, #10b981, #059669)" }
                        }).showToast();
                    }
                }
                
                // Clear the pending trade data
                localStorage.removeItem('pendingTrade');
            } catch (error) {
                console.error('Error processing pending trade:', error);
                localStorage.removeItem('pendingTrade');
            }
        }
    }

    // ADDED: Load seller information and set as trade partner
    async loadSellerAsTradePartner(sellerId) {
        try {
            const userDoc = await this.db.collection('users').doc(sellerId).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                const sellerInfo = {
                    uid: sellerId,
                    displayName: userData.displayName,
                    email: userData.email
                };
                
                this.setTradePartner(sellerInfo);
                
                if (window.Toastify) {
                    Toastify({
                        text: `Trade partner set to ${userData.displayName || userData.email}`,
                        duration: 3000,
                        style: { background: "linear-gradient(to right, #10b981, #059669)" }
                    }).showToast();
                }
            } else {
                console.error('Seller not found:', sellerId);
            }
        } catch (error) {
            console.error('Error loading seller information:', error);
        }
    }
}

// User Search functionality
class UserSearch {
    constructor(db) {
        this.db = db;
        this.searchTimeout = null;
        this.bindEvents();
    }

    bindEvents() {
        const userSearchInput = document.getElementById('user-search-input');
        const tradePartnerSearch = document.getElementById('trade-partner-search');

        if (userSearchInput) {
            userSearchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value, 'user-search-results');
            });
        }

        if (tradePartnerSearch) {
            tradePartnerSearch.addEventListener('input', (e) => {
                this.handleSearch(e.target.value, 'trade-partner-results');
            });
        }
    }

    handleSearch(query, resultsContainerId) {
        clearTimeout(this.searchTimeout);
        
        const resultsContainer = document.getElementById(resultsContainerId);
        if (!resultsContainer) return;

        if (query.length < 2) {
            resultsContainer.classList.add('hidden');
            return;
        }

        this.searchTimeout = setTimeout(() => {
            this.searchUsers(query, resultsContainer);
        }, 300);
    }

    async searchUsers(query, resultsContainer) {
        try {
            // Search users by display name or email
            const usersRef = this.db.collection('users');
            
            // Firestore doesn't support case-insensitive search, so we'll do a simple starts-with search
            const snapshot = await usersRef
                .where('displayName', '>=', query)
                .where('displayName', '<=', query + '\uf8ff')
                .limit(10)
                .get();

            const users = [];
            snapshot.forEach(doc => {
                const userData = doc.data();
                users.push({
                    uid: doc.id,
                    ...userData
                });
            });

            this.displaySearchResults(users, resultsContainer);

        } catch (error) {
            console.error('Error searching users:', error);
            resultsContainer.innerHTML = '<div class="p-2 text-red-500">Error searching users</div>';
            resultsContainer.classList.remove('hidden');
        }
    }

    displaySearchResults(users, resultsContainer) {
        if (users.length === 0) {
            resultsContainer.innerHTML = '<div class="p-2 text-gray-500">No users found</div>';
            resultsContainer.classList.remove('hidden');
            return;
        }

        const resultsHtml = users.map(user => `
            <div class="user-search-result p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600 last:border-b-0" 
                 data-user-uid="${user.uid}" 
                 data-user-name="${user.displayName || user.email}"
                 data-user-email="${user.email || ''}">
                <div class="flex items-center space-x-2">
                    <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        ${(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="font-medium text-gray-900 dark:text-white">${user.displayName || 'Unknown User'}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">${user.email || ''}</div>
                    </div>
                </div>
            </div>
        `).join('');

        resultsContainer.innerHTML = resultsHtml;
        resultsContainer.classList.remove('hidden');

        // Add click listeners
        resultsContainer.querySelectorAll('.user-search-result').forEach(result => {
            result.addEventListener('click', () => {
                const userData = {
                    uid: result.getAttribute('data-user-uid'),
                    displayName: result.getAttribute('data-user-name'),
                    email: result.getAttribute('data-user-email')
                };

                this.selectUser(userData, resultsContainer);
            });
        });
    }

    selectUser(userData, resultsContainer) {
        // Set as trade partner if we have a trade window
        if (window.tradeWindow) {
            window.tradeWindow.setTradePartner(userData);
        }

        // Hide results
        resultsContainer.classList.add('hidden');

        // Clear search input
        const searchInput = resultsContainer.id === 'user-search-results' 
            ? document.getElementById('user-search-input')
            : document.getElementById('trade-partner-search');
        
        if (searchInput) {
            searchInput.value = userData.displayName || userData.email;
        }

        // Show success message
        if (window.Toastify) {
            Toastify({
                text: `Selected ${userData.displayName || userData.email} as trade partner`,
                duration: 3000,
                style: { background: "linear-gradient(to right, #10b981, #059669)" }
            }).showToast();
        }
    }
}

// Main initialization
document.addEventListener('authReady', ({ detail: { user } }) => {
    console.log("Auth is ready for trades.js");

    if (!user) {
        // Handle non-authenticated state
        const newInterface = document.getElementById('new-trading-interface');
        const legacySection = document.getElementById('legacy-trades-section');
        
        if (newInterface) {
            newInterface.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <div class="text-center">
                        <i class="fas fa-sign-in-alt text-4xl text-gray-400 mb-4"></i>
                        <h2 class="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">Please Log In</h2>
                        <p class="text-gray-500 dark:text-gray-500">You need to be logged in to access the trading features.</p>
                    </div>
                </div>
            `;
        }

        if (legacySection) {
            legacySection.innerHTML = `
                <div class="text-center py-8">
                    <p class="text-gray-500 dark:text-gray-400">Please log in to view your trades.</p>
                </div>
            `;
        }
        return;
    }

    const db = firebase.firestore();

    // Initialize trade window for new interface
    window.tradeWindow = new TradeWindow(user, db);

    // Initialize user search
    window.userSearch = new UserSearch(db);

    // Initialize legacy trades functionality (existing code)
    initializeLegacyTrades(user, db);
});

// Legacy trades functionality (existing code)
function initializeLegacyTrades(user, db) {
    const tradesPageContainer = document.querySelector('#legacy-trades-section');
    if (!tradesPageContainer) return;

    const incomingContainer = document.getElementById('tab-content-incoming');
    const outgoingContainer = document.getElementById('tab-content-outgoing');
    const historyContainer = document.getElementById('tab-content-history');
    const analysisContainer = document.getElementById('tab-content-analysis');
    const tabs = document.querySelectorAll('.trade-tab-button');

    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding content
            document.querySelectorAll('.trade-tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById(`tab-content-${tabName}`)?.classList.remove('hidden');
        });
    });

    // Load trades
    loadAllTrades(user, db, incomingContainer, outgoingContainer, historyContainer);
}

function loadAllTrades(user, db, incomingContainer, outgoingContainer, historyContainer) {
    const tradesRef = db.collection('trades').where('participants', 'array-contains', user.uid).orderBy('createdAt', 'desc');

    tradesRef.onSnapshot(async (snapshot) => {
        if (incomingContainer) incomingContainer.innerHTML = '';
        if (outgoingContainer) outgoingContainer.innerHTML = '';
        if (historyContainer) historyContainer.innerHTML = '';

        if (snapshot.empty) {
            const noTradesMsg = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No trades found.</p>';
            if (incomingContainer) incomingContainer.innerHTML = noTradesMsg;
            if (outgoingContainer) outgoingContainer.innerHTML = noTradesMsg;
            if (historyContainer) historyContainer.innerHTML = noTradesMsg;
            return;
        }

        let counts = { incoming: 0, outgoing: 0, history: 0 };
        for (const doc of snapshot.docs) {
            const trade = doc.data();
            const tradeCard = await createTradeCard(trade, doc.id, user);
            const isReceiver = trade.receiverId === user.uid;

            if (['pending', 'accepted', 'awaiting_payment', 'funds_authorized', 'shipped', 'disputed'].includes(trade.status)) {
                if (isReceiver && incomingContainer) {
                    incomingContainer.appendChild(tradeCard);
                    counts.incoming++;
                } else if (!isReceiver && outgoingContainer) {
                    outgoingContainer.appendChild(tradeCard);
                    counts.outgoing++;
                }
            } else if (historyContainer) {
                historyContainer.appendChild(tradeCard);
                counts.history++;
            }
        }

        if (counts.incoming === 0 && incomingContainer) {
            incomingContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No active incoming offers.</p>';
        }
        if (counts.outgoing === 0 && outgoingContainer) {
            outgoingContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No active outgoing offers.</p>';
        }
        if (counts.history === 0 && historyContainer) {
            historyContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No trade history.</p>';
        }
    }, err => console.error("Error loading trades:", err));
}

async function createTradeCard(trade, tradeId, user) {
    const tradeCard = document.createElement('div');
    tradeCard.className = 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md';
    tradeCard.setAttribute('data-trade-id', tradeId);
    const isProposer = trade.proposerId === user.uid;

    const proposerItemsHtml = renderTradeItems(trade.proposerCards, trade.proposerMoney);
    const receiverItemsHtml = renderTradeItems(trade.receiverCards, trade.receiverMoney);

    const statusColors = {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
        accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
        awaiting_payment: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
        funds_authorized: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
        shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
        completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        disputed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
    };
    const statusColor = statusColors[trade.status] || 'bg-gray-100 dark:bg-gray-700';

    const actionButtons = getActionButtons(trade, tradeId, isProposer, user);

    tradeCard.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                    ${isProposer ? `Offer to: <strong>${trade.receiverName}</strong>` : `Offer from: <strong>${trade.proposerName}</strong>`}
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500">On: ${formatTimestamp(trade.createdAt)}</p>
            </div>
            <span class="px-3 py-1 text-sm font-semibold rounded-full ${statusColor}">${(trade.status || 'unknown').replace('_', ' ')}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="border dark:border-gray-600 p-4 rounded-md">
                <h4 class="font-bold mb-2 dark:text-white">${trade.proposerName} Offers:</h4>
                <div class="space-y-2">${proposerItemsHtml}</div>
            </div>
            <div class="border dark:border-gray-600 p-4 rounded-md">
                <h4 class="font-bold mb-2 dark:text-white">${trade.receiverName} Offers:</h4>
                <div class="space-y-2">${receiverItemsHtml}</div>
            </div>
        </div>
        ${trade.notes ? `<div class="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md"><p class="text-sm italic dark:text-gray-300"><strong>Notes:</strong> ${trade.notes}</p></div>` : ''}
        <div class="mt-4 text-right space-x-2">${actionButtons}</div>
    `;

    // Add event listeners for action buttons
    tradeCard.querySelectorAll('.trade-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            handleTradeAction(action, id, firebase.firestore());
        });
    });

    return tradeCard;
}

function renderTradeItems(cards, money) {
    let html = '';
    
    if (cards && cards.length > 0) {
        html += cards.map(card => `
            <div class="flex items-center space-x-2">
                <img src="${card.imageUrl || 'https://via.placeholder.com/32x32?text=?'}" 
                     alt="${card.name}" 
                     class="w-8 h-8 object-cover rounded"
                     onerror="this.src='https://via.placeholder.com/32x32?text=?'">
                <span class="text-sm">${card.name}</span>
                <span class="text-xs text-gray-500">$${(card.priceUsd || 0).toFixed(2)}</span>
            </div>
        `).join('');
    }
    
    if (money && money > 0) {
        html += `<div class="text-sm font-semibold text-green-600">+ $${money.toFixed(2)} cash</div>`;
    }
    
    return html || '<div class="text-sm text-gray-500">No items</div>';
}

function getActionButtons(trade, tradeId, isProposer, user) {
    const isPayer = (trade.proposerMoney > 0 && isProposer) || (trade.receiverMoney > 0 && !isProposer);
    const buyerUid = (trade.proposerMoney || 0) > 0 ? trade.proposerId : trade.receiverId;
    const isBuyer = user.uid === buyerUid;

    switch (trade.status) {
        case 'pending':
            return isProposer
                ? `<button data-id="${tradeId}" data-action="cancelled" class="trade-action-btn px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Cancel</button>`
                : `<button data-id="${tradeId}" data-action="rejected" class="trade-action-btn px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 mr-2">Decline</button>
                   <button data-id="${tradeId}" data-action="accepted" class="trade-action-btn px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Accept</button>`;
        case 'awaiting_payment':
             return isPayer
                ? `<button data-id="${tradeId}" data-action="pay" class="trade-action-btn px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Pay with Escrow.com</button>`
                : `<span class="text-sm text-gray-500">Waiting for payment...</span>`;
        case 'funds_authorized':
            const userHasShipped = isProposer ? trade.proposerConfirmedShipment : trade.receiverConfirmedShipment;
            return userHasShipped
                ? `<span class="text-sm text-gray-500">Waiting for other party to ship...</span>`
                : `<button data-id="${tradeId}" data-action="confirm-shipment" class="trade-action-btn px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Confirm Shipment</button>`;
        case 'shipped':
             if (isBuyer) {
                 return `<button data-id="${tradeId}" data-action="confirm-receipt" class="trade-action-btn px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Confirm Delivery & Release Funds</button>`;
             } else {
                 return `<span class="text-sm text-gray-500">Waiting for buyer to confirm receipt...</span>`;
             }
        default:
            return '';
    }
}

async function handleTradeAction(action, tradeId, db) {
    const tradeRef = db.collection('trades').doc(tradeId);
    const tradeDoc = await tradeRef.get();
    if (!tradeDoc.exists) return;
    const tradeData = tradeDoc.data();

    if (action === 'accepted') {
        const moneyInvolved = (tradeData.proposerMoney || 0) > 0 || (tradeData.receiverMoney || 0) > 0;
        if (moneyInvolved) {
             await tradeRef.update({ status: 'accepted' });
             // initiateEscrowTransaction(tradeId, tradeData); // Implement if needed
        } else {
             await tradeRef.update({ status: 'funds_authorized' });
             showToast("Trade accepted! Ready for shipment.", 'success');
        }
    } else if (action === 'confirm-shipment') {
        const user = firebase.auth().currentUser;
        const isProposer = tradeData.proposerId === user.uid;
        const fieldToUpdate = isProposer ? 'proposerConfirmedShipment' : 'receiverConfirmedShipment';
        await tradeRef.update({ [fieldToUpdate]: true });

        const updatedDoc = await tradeRef.get();
        if (updatedDoc.data().proposerConfirmedShipment && updatedDoc.data().receiverConfirmedShipment) {
            await tradeRef.update({ status: 'shipped' });
        }
        showToast("Shipment confirmed!", 'success');
    } else if (action === 'confirm-receipt') {
        await tradeRef.update({ status: 'completed' });
        showToast("Trade completed successfully!", 'success');
    } else if (['rejected', 'cancelled'].includes(action)) {
        await tradeRef.update({ status: action });
        showToast("Trade offer has been updated.", 'info');
    }
}

function showToast(message, type = 'info') {
    if (window.Toastify) {
        const backgrounds = {
            success: "linear-gradient(to right, #10b981, #059669)",
            error: "linear-gradient(to right, #ef4444, #dc2626)",
            warning: "linear-gradient(to right, #f59e0b, #d97706)",
            info: "linear-gradient(to right, #3b82f6, #2563eb)"
        };

        Toastify({
            text: message,
            duration: 3000,
            style: { background: backgrounds[type] || backgrounds.info }
        }).showToast();
    } else {
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}
