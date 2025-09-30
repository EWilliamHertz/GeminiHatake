/**
 * Marketplace Shopping Wizard
 * Handles multi-seller trade proposals and complex marketplace interactions
 */

class MarketplaceWizard {
    constructor() {
        this.tradeBasket = new Map(); // Map of sellerId -> { seller, cards, totalValue }
        this.db = null;
        this.currentUser = null;
        this.init();
    }

    async init() {
        // Wait for Firebase to be ready
        document.addEventListener('authReady', ({ detail: { user } }) => {
            this.currentUser = user;
            this.db = firebase.firestore();
            this.setupEventListeners();
            this.loadTradeBasket();
        });

        // Initialize immediately if auth is already ready
        if (window.db && window.auth?.currentUser) {
            this.currentUser = window.auth.currentUser;
            this.db = window.db;
            this.setupEventListeners();
            this.loadTradeBasket();
        }
    }

    setupEventListeners() {
        // Add to trade basket buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.add-to-trade-basket-btn')) {
                const btn = e.target.closest('.add-to-trade-basket-btn');
                const cardData = JSON.parse(btn.dataset.card);
                this.addToTradeBasket(cardData);
            }
        });

        // Trade basket modal events
        const tradeBasketBtn = document.getElementById('trade-basket-btn');
        const tradeBasketModal = document.getElementById('trade-basket-modal');
        const closeTradeBasketBtn = document.getElementById('close-trade-basket-modal');
        const createTradeProposalsBtn = document.getElementById('create-trade-proposals-btn');

        if (tradeBasketBtn) {
            tradeBasketBtn.addEventListener('click', () => this.openTradeBasket());
        }

        if (closeTradeBasketBtn && tradeBasketModal) {
            closeTradeBasketBtn.addEventListener('click', () => {
                tradeBasketModal.classList.add('hidden');
                tradeBasketModal.classList.remove('flex');
            });
        }

        if (createTradeProposalsBtn) {
            createTradeProposalsBtn.addEventListener('click', () => this.createMultiSellerTradeProposals());
        }

        // Remove from basket
        document.addEventListener('click', (e) => {
            if (e.target.closest('.remove-from-basket-btn')) {
                const btn = e.target.closest('.remove-from-basket-btn');
                const sellerId = btn.dataset.sellerId;
                const cardId = btn.dataset.cardId;
                this.removeFromTradeBasket(sellerId, cardId);
            }
        });
    }

    addToTradeBasket(cardData) {
        if (!this.currentUser) {
            this.showToast('Please log in to add cards to your trade basket', 'error');
            return;
        }

        const sellerId = cardData.sellerId;
        const seller = cardData.sellerData;

        // Initialize seller entry if it doesn't exist
        if (!this.tradeBasket.has(sellerId)) {
            this.tradeBasket.set(sellerId, {
                seller: seller,
                cards: [],
                totalValue: 0
            });
        }

        const sellerBasket = this.tradeBasket.get(sellerId);
        
        // Check if card is already in basket
        const existingCard = sellerBasket.cards.find(card => card.id === cardData.id);
        if (existingCard) {
            this.showToast('Card is already in your trade basket', 'info');
            return;
        }

        // Add card to basket
        sellerBasket.cards.push(cardData);
        sellerBasket.totalValue += cardData.price || 0;

        this.saveTradeBasket();
        this.updateTradeBasketUI();
        this.showToast(`Added ${cardData.cardData.name} to trade basket`, 'success');
    }

    removeFromTradeBasket(sellerId, cardId) {
        const sellerBasket = this.tradeBasket.get(sellerId);
        if (!sellerBasket) return;

        const cardIndex = sellerBasket.cards.findIndex(card => card.id === cardId);
        if (cardIndex === -1) return;

        const removedCard = sellerBasket.cards[cardIndex];
        sellerBasket.cards.splice(cardIndex, 1);
        sellerBasket.totalValue -= removedCard.price || 0;

        // Remove seller if no cards left
        if (sellerBasket.cards.length === 0) {
            this.tradeBasket.delete(sellerId);
        }

        this.saveTradeBasket();
        this.updateTradeBasketUI();
        this.renderTradeBasket();
        this.showToast(`Removed ${removedCard.cardData.name} from trade basket`, 'info');
    }

    openTradeBasket() {
        const modal = document.getElementById('trade-basket-modal');
        if (!modal) {
            this.createTradeBasketModal();
            return;
        }

        this.renderTradeBasket();
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    createTradeBasketModal() {
        const modalHTML = `
            <div id="trade-basket-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                    <div class="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            <i class="fas fa-shopping-basket mr-2 text-blue-600"></i>
                            Trade Basket
                        </h2>
                        <button id="close-trade-basket-modal" class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl">
                            ×
                        </button>
                    </div>
                    
                    <div class="p-6 overflow-y-auto max-h-[60vh]">
                        <div id="trade-basket-content">
                            <!-- Content will be rendered here -->
                        </div>
                    </div>
                    
                    <div class="border-t border-gray-200 dark:border-gray-700 p-6">
                        <div class="flex justify-between items-center mb-4">
                            <div class="text-lg font-semibold">
                                <span id="basket-seller-count">0</span> Sellers • 
                                <span id="basket-card-count">0</span> Cards • 
                                Total: <span id="basket-total-value">$0.00</span>
                            </div>
                        </div>
                        
                        <div class="flex space-x-4">
                            <button id="clear-trade-basket-btn" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">
                                <i class="fas fa-trash mr-2"></i>Clear Basket
                            </button>
                            <button id="create-trade-proposals-btn" class="flex-1 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                                <i class="fas fa-handshake mr-2"></i>Create Trade Proposals
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.setupEventListeners(); // Re-setup listeners for new modal
        this.openTradeBasket(); // Open the modal now that it's created
    }

    renderTradeBasket() {
        const content = document.getElementById('trade-basket-content');
        if (!content) return;

        if (this.tradeBasket.size === 0) {
            content.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-shopping-basket text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                    <h3 class="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">Your trade basket is empty</h3>
                    <p class="text-gray-500 dark:text-gray-500">Add cards from the marketplace to start creating trade proposals</p>
                </div>
            `;
            return;
        }

        let html = '';
        let totalCards = 0;
        let totalValue = 0;

        for (const [sellerId, sellerBasket] of this.tradeBasket) {
            totalCards += sellerBasket.cards.length;
            totalValue += sellerBasket.totalValue;

            html += `
                <div class="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div class="bg-gray-50 dark:bg-gray-700 p-4 border-b border-gray-200 dark:border-gray-600">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <img src="${sellerBasket.seller.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(sellerBasket.seller.displayName) + '&background=random&color=fff'}" 
                                     alt="${sellerBasket.seller.displayName}" 
                                     class="w-10 h-10 rounded-full object-cover mr-3">
                                <div>
                                    <h3 class="font-semibold text-gray-900 dark:text-gray-100">${sellerBasket.seller.displayName}</h3>
                                    <p class="text-sm text-gray-500 dark:text-gray-400">${sellerBasket.seller.country || 'Unknown location'}</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="font-semibold text-lg">${window.convertAndFormat ? window.convertAndFormat(sellerBasket.totalValue) : '$' + sellerBasket.totalValue.toFixed(2)}</p>
                                <p class="text-sm text-gray-500">${sellerBasket.cards.length} card${sellerBasket.cards.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="p-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${sellerBasket.cards.map(card => `
                                <div class="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                                    <img src="${card.cardData.image_uris?.normal || 'https://placehold.co/63x88?text=Card'}" 
                                         alt="${card.cardData.name}" 
                                         class="w-16 h-22 object-cover rounded">
                                    <div class="flex-1">
                                        <h4 class="font-semibold text-gray-900 dark:text-gray-100">${card.cardData.name}</h4>
                                        <p class="text-sm text-gray-500 dark:text-gray-400">${card.cardData.set_name || 'Unknown Set'}</p>
                                        <p class="text-sm font-medium text-green-600">${window.convertAndFormat ? window.convertAndFormat(card.price) : '$' + (card.price || 0).toFixed(2)}</p>
                                    </div>
                                    <button class="remove-from-basket-btn text-red-500 hover:text-red-700 p-2" 
                                            data-seller-id="${sellerId}" 
                                            data-card-id="${card.id}">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        content.innerHTML = html;

        // Update summary
        document.getElementById('basket-seller-count').textContent = this.tradeBasket.size;
        document.getElementById('basket-card-count').textContent = totalCards;
        document.getElementById('basket-total-value').textContent = window.convertAndFormat ? window.convertAndFormat(totalValue) : '$' + totalValue.toFixed(2);
    }

    async createMultiSellerTradeProposals() {
        if (!this.currentUser) {
            this.showToast('Please log in to create trade proposals', 'error');
            return;
        }

        if (this.tradeBasket.size === 0) {
            this.showToast('Your trade basket is empty', 'error');
            return;
        }

        const btn = document.getElementById('create-trade-proposals-btn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Creating Proposals...';

        try {
            const proposals = [];
            
            // Create individual trade proposals for each seller
            for (const [sellerId, sellerBasket] of this.tradeBasket) {
                const tradeProposal = {
                    proposerId: this.currentUser.uid,
                    receiverId: sellerId,
                    participants: [this.currentUser.uid, sellerId],
                    proposerCards: [], // User's cards (to be selected later)
                    receiverCards: sellerBasket.cards,
                    proposerMoney: 0,
                    receiverMoney: sellerBasket.totalValue,
                    status: 'pending',
                    type: 'marketplace_purchase',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                    messages: [],
                    metadata: {
                        isMarketplacePurchase: true,
                        totalValue: sellerBasket.totalValue,
                        cardCount: sellerBasket.cards.length,
                        sellerInfo: sellerBasket.seller
                    }
                };

                const docRef = await this.db.collection('trades').add(tradeProposal);
                proposals.push({ id: docRef.id, sellerId, sellerName: sellerBasket.seller.displayName });
            }

            // Clear the trade basket
            this.tradeBasket.clear();
            this.saveTradeBasket();
            this.updateTradeBasketUI();

            // Close modal
            const modal = document.getElementById('trade-basket-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }

            // Show success message and redirect
            this.showToast(`Created ${proposals.length} trade proposal${proposals.length !== 1 ? 's' : ''}!`, 'success');
            
            // Redirect to trades page
            setTimeout(() => {
                window.location.href = 'trades.html';
            }, 1500);

        } catch (error) {
            console.error('Error creating trade proposals:', error);
            this.showToast('Failed to create trade proposals. Please try again.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    updateTradeBasketUI() {
        const basketBtn = document.getElementById('trade-basket-btn');
        const basketCounter = document.getElementById('trade-basket-counter');
        
        if (!basketBtn || !basketCounter) return;

        const totalCards = Array.from(this.tradeBasket.values())
            .reduce((sum, basket) => sum + basket.cards.length, 0);

        basketCounter.textContent = totalCards;
        basketCounter.classList.toggle('hidden', totalCards === 0);
    }

    saveTradeBasket() {
        const basketData = {};
        for (const [sellerId, sellerBasket] of this.tradeBasket) {
            basketData[sellerId] = sellerBasket;
        }
        localStorage.setItem('hatakeTradeBasket', JSON.stringify(basketData));
    }

    loadTradeBasket() {
        try {
            const basketData = JSON.parse(localStorage.getItem('hatakeTradeBasket') || '{}');
            this.tradeBasket.clear();
            
            for (const [sellerId, sellerBasket] of Object.entries(basketData)) {
                this.tradeBasket.set(sellerId, sellerBasket);
            }
            
            this.updateTradeBasketUI();
        } catch (error) {
            console.error('Error loading trade basket:', error);
            this.tradeBasket.clear();
        }
    }

    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Initialize the marketplace wizard
window.marketplaceWizard = new MarketplaceWizard();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarketplaceWizard;
}
