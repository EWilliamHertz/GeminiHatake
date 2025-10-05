/**
 * Enhanced Trades Script with Foil/Holo Support
 * 
 * Features:
 * - Visual indicators for foil/holo cards in trade interface
 * - Proper price display for specific card conditions
 * - Enhanced trade basket functionality
 */

// Import currency functions
let convertAndFormat = null;
let initCurrency = null;

// Load currency module
(async () => {
    try {
        const currencyModule = await import('./modules/currency.js');
        convertAndFormat = currencyModule.convertAndFormat;
        initCurrency = currencyModule.initCurrency;
        window.convertAndFormat = convertAndFormat;

        // Initialize currency system
        await initCurrency();
    } catch (error) {
        console.error('Failed to load currency module:', error);
    }
})();

// Card condition definitions
const CARD_CONDITIONS = {
    'near_mint': { label: 'Near Mint', shortLabel: 'NM', multiplier: 1.0 },
    'lightly_played': { label: 'Lightly Played', shortLabel: 'LP', multiplier: 0.85 },
    'moderately_played': { label: 'Moderately Played', shortLabel: 'MP', multiplier: 0.70 },
    'heavily_played': { label: 'Heavily Played', shortLabel: 'HP', multiplier: 0.55 },
    'damaged': { label: 'Damaged', shortLabel: 'DMG', multiplier: 0.40 }
};

class EnhancedTradesManager {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.tradeBasket = JSON.parse(localStorage.getItem('tradeBasket') || '[]');
        this.currentTrade = null;
        this.userCards = [];
        this.partnerCards = [];

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('Initializing Enhanced Trades Manager...');

        // Wait for Firebase to be initialized
        await this.waitForFirebase();

        // Wait for auth state
        this.auth.onAuthStateChanged(user => {
            this.currentUser = user;
            console.log('Auth state changed:', user ? user.uid : 'No user');
            if (user) {
                this.loadUserCollection();
            }
        });

        this.bindEvents();
        this.updateTradeBasketDisplay();
        this.loadTradeBasket();
    }

    async waitForFirebase() {
        let attempts = 0;
        const maxAttempts = 50;

        while (attempts < maxAttempts) {
            if (window.db && window.auth) {
                this.db = window.db;
                this.auth = window.auth;
                console.log('Firebase initialized successfully');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        throw new Error('Firebase failed to initialize after 5 seconds');
    }

    bindEvents() {
        // Trade basket button
        const basketBtn = document.getElementById('trade-basket-btn');
        if (basketBtn) {
            basketBtn.addEventListener('click', () => {
                this.toggleTradeBasket();
            });
        }

        // Clear trade basket
        const clearBasketBtn = document.getElementById('clear-trade-basket');
        if (clearBasketBtn) {
            clearBasketBtn.addEventListener('click', () => {
                this.clearTradeBasket();
            });
        }

        // Add cards to trade from basket
        const addToTradeBtn = document.getElementById('add-basket-to-trade');
        if (addToTradeBtn) {
            addToTradeBtn.addEventListener('click', () => {
                this.addBasketToTrade();
            });
        }
    }

    async loadUserCollection() {
        if (!this.currentUser) return;

        try {
            const collectionRef = this.db.collection('collections').doc(this.currentUser.uid);
            const doc = await collectionRef.get();
            
            if (doc.exists) {
                this.userCards = doc.data().cards || [];
                console.log(`Loaded ${this.userCards.length} cards from user collection`);
            }
        } catch (error) {
            console.error('Error loading user collection:', error);
        }
    }

    loadTradeBasket() {
        const basketContainer = document.getElementById('trade-basket-cards');
        if (!basketContainer) return;

        if (this.tradeBasket.length === 0) {
            basketContainer.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="fas fa-shopping-basket text-3xl mb-2"></i>
                    <p>Your trade basket is empty</p>
                    <p class="text-sm">Add cards from the marketplace</p>
                </div>
            `;
            return;
        }

        basketContainer.innerHTML = this.tradeBasket.map(card => this.renderTradeBasketCard(card)).join('');
        this.bindTradeBasketEvents();
    }

    renderTradeBasketCard(card) {
        const foilClass = card.is_foil ? 'foil-effect' : '';
        const foilIndicator = card.is_foil ? this.getFoilIndicator(card.game) : '';
        const conditionInfo = CARD_CONDITIONS[card.condition] || { label: 'Unknown', shortLabel: '?' };
        
        const priceDisplay = convertAndFormat ? 
            convertAndFormat({ usd: card.price }) : 
            `$${parseFloat(card.price || 0).toFixed(2)}`;

        return `
            <div class="trade-basket-card bg-white dark:bg-gray-700 rounded-lg p-3 mb-2 relative group"
                 data-card-id="${card.id}">
                
                <!-- Foil/Holo Indicator -->
                ${foilIndicator}
                
                <!-- Remove Button -->
                <button class="remove-from-basket absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        data-card-id="${card.id}">
                    <i class="fas fa-times"></i>
                </button>

                <div class="flex items-center space-x-3">
                    <div class="relative ${foilClass} flex-shrink-0">
                        <img src="${card.imageUrl || 'https://via.placeholder.com/60x84?text=No+Image'}" 
                             alt="${card.cardName}" 
                             class="w-12 h-16 object-cover rounded"
                             onerror="this.src='https://via.placeholder.com/60x84?text=No+Image'">
                    </div>
                    
                    <div class="flex-1 min-w-0">
                        <h4 class="font-medium text-sm text-gray-900 dark:text-white truncate">
                            ${card.cardName}
                        </h4>
                        <p class="text-xs text-gray-600 dark:text-gray-400">
                            ${conditionInfo.shortLabel} • ${card.game?.toUpperCase() || 'TCG'}
                        </p>
                        <p class="text-sm font-semibold text-green-600 dark:text-green-400">
                            ${priceDisplay}
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    getFoilIndicator(game) {
        const isMtg = game?.toLowerCase() === 'mtg' || game?.toLowerCase() === 'magic';
        const isPokemon = game?.toLowerCase() === 'pokemon' || game?.toLowerCase() === 'pokémon';
        
        let label = 'Foil';
        if (isPokemon) {
            label = 'Holo';
        }
        
        return `
            <div class="absolute top-1 left-1 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-1 py-0.5 rounded text-xs font-bold">
                <i class="fas fa-star mr-1"></i>${label}
            </div>
        `;
    }

    bindTradeBasketEvents() {
        // Remove from basket buttons
        document.querySelectorAll('.remove-from-basket').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cardId = btn.dataset.cardId;
                this.removeFromTradeBasket(cardId);
            });
        });

        // Card click events for details
        document.querySelectorAll('.trade-basket-card').forEach(card => {
            card.addEventListener('click', () => {
                const cardId = card.dataset.cardId;
                this.showTradeBasketCardDetails(cardId);
            });
        });
    }

    removeFromTradeBasket(cardId) {
        this.tradeBasket = this.tradeBasket.filter(card => card.id !== cardId);
        localStorage.setItem('tradeBasket', JSON.stringify(this.tradeBasket));
        this.updateTradeBasketDisplay();
        this.loadTradeBasket();
        this.showToast('Removed from trade basket', 'info');
    }

    clearTradeBasket() {
        if (this.tradeBasket.length === 0) return;

        if (confirm('Are you sure you want to clear your trade basket?')) {
            this.tradeBasket = [];
            localStorage.setItem('tradeBasket', JSON.stringify(this.tradeBasket));
            this.updateTradeBasketDisplay();
            this.loadTradeBasket();
            this.showToast('Trade basket cleared', 'info');
        }
    }

    addBasketToTrade() {
        if (this.tradeBasket.length === 0) {
            this.showToast('Trade basket is empty', 'warning');
            return;
        }

        // Add all basket cards to the current trade
        this.tradeBasket.forEach(card => {
            this.addCardToTrade(card, 'your');
        });

        // Clear the basket after adding to trade
        this.tradeBasket = [];
        localStorage.setItem('tradeBasket', JSON.stringify(this.tradeBasket));
        this.updateTradeBasketDisplay();
        this.loadTradeBasket();
        
        this.showToast(`Added ${this.tradeBasket.length} cards to trade`, 'success');
    }

    addCardToTrade(card, side) {
        const container = document.getElementById(`${side}-trade-cards`);
        if (!container) return;

        // Remove empty state if present
        const emptyState = container.querySelector('.text-center');
        if (emptyState) {
            emptyState.remove();
        }

        const cardElement = this.renderTradeCard(card, side);
        container.insertAdjacentHTML('beforeend', cardElement);
        
        this.updateTradeValue(side);
    }

    renderTradeCard(card, side) {
        const foilClass = card.is_foil ? 'foil-effect' : '';
        const foilIndicator = card.is_foil ? this.getFoilIndicator(card.game) : '';
        const conditionInfo = CARD_CONDITIONS[card.condition] || { label: 'Unknown', shortLabel: '?' };
        
        const priceDisplay = convertAndFormat ? 
            convertAndFormat({ usd: card.price }) : 
            `$${parseFloat(card.price || 0).toFixed(2)}`;

        return `
            <div class="trade-card bg-gray-50 dark:bg-gray-600 rounded-lg p-2 mb-2 relative group"
                 data-card-id="${card.id}"
                 data-price="${card.price}">
                
                <!-- Foil/Holo Indicator -->
                ${foilIndicator}
                
                <!-- Remove Button -->
                <button class="remove-from-trade absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        data-card-id="${card.id}"
                        data-side="${side}">
                    <i class="fas fa-times"></i>
                </button>

                <div class="flex items-center space-x-2">
                    <div class="relative ${foilClass} flex-shrink-0">
                        <img src="${card.imageUrl || 'https://via.placeholder.com/40x56?text=No+Image'}" 
                             alt="${card.cardName}" 
                             class="w-8 h-11 object-cover rounded"
                             onerror="this.src='https://via.placeholder.com/40x56?text=No+Image'">
                    </div>
                    
                    <div class="flex-1 min-w-0">
                        <h5 class="font-medium text-xs text-gray-900 dark:text-white truncate">
                            ${card.cardName}
                        </h5>
                        <p class="text-xs text-gray-600 dark:text-gray-400">
                            ${conditionInfo.shortLabel}
                        </p>
                        <p class="text-xs font-semibold text-green-600 dark:text-green-400">
                            ${priceDisplay}
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    updateTradeValue(side) {
        const container = document.getElementById(`${side}-trade-cards`);
        const valueElement = document.getElementById(`${side}-trade-value`);
        
        if (!container || !valueElement) return;

        const cards = container.querySelectorAll('.trade-card');
        let totalValue = 0;

        cards.forEach(card => {
            const price = parseFloat(card.dataset.price || 0);
            totalValue += price;
        });

        const valueDisplay = convertAndFormat ? 
            convertAndFormat({ usd: totalValue }) : 
            `$${totalValue.toFixed(2)}`;

        valueElement.textContent = valueDisplay;
    }

    updateTradeBasketDisplay() {
        const counter = document.getElementById('trade-basket-counter');
        if (counter) {
            const count = this.tradeBasket.length;
            counter.textContent = count;
            counter.classList.toggle('hidden', count === 0);
        }

        // Update basket total value
        const totalValue = this.tradeBasket.reduce((sum, card) => sum + parseFloat(card.price || 0), 0);
        const basketValue = document.getElementById('trade-basket-value');
        if (basketValue) {
            const valueDisplay = convertAndFormat ? 
                convertAndFormat({ usd: totalValue }) : 
                `$${totalValue.toFixed(2)}`;
            basketValue.textContent = valueDisplay;
        }
    }

    toggleTradeBasket() {
        const basketPanel = document.getElementById('trade-basket-panel');
        if (basketPanel) {
            basketPanel.classList.toggle('hidden');
        }
    }

    showTradeBasketCardDetails(cardId) {
        const card = this.tradeBasket.find(c => c.id === cardId);
        if (!card) return;

        this.showCardModal(card);
    }

    showCardModal(card) {
        const conditionInfo = CARD_CONDITIONS[card.condition] || { label: 'Unknown' };
        const foilLabel = this.getFoilLabel(card.game);
        
        const modalHTML = `
            <div id="card-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
                                ${card.cardName}
                            </h2>
                            <button id="close-card-modal" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                        
                        <div class="grid md:grid-cols-2 gap-6">
                            <div class="relative ${card.is_foil ? 'foil-effect' : ''}">
                                <img src="${card.imageUrl || 'https://via.placeholder.com/300x420?text=No+Image'}" 
                                     alt="${card.cardName}" 
                                     class="w-full rounded-lg shadow-md"
                                     onerror="this.src='https://via.placeholder.com/300x420?text=No+Image'">
                                ${card.is_foil ? `
                                    <div class="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                                        <i class="fas fa-star mr-1"></i>${foilLabel}
                                    </div>
                                ` : ''}
                            </div>
                            
                            <div class="space-y-4">
                                <div>
                                    <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Card Details</h3>
                                    <div class="space-y-2 text-sm">
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Game:</span>
                                            <span class="font-medium">${card.game?.toUpperCase() || 'TCG'}</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600 dark:text-gray-400">Condition:</span>
                                            <span class="font-medium">${conditionInfo.label}</span>
                                        </div>
                                        ${card.is_foil ? `
                                            <div class="flex justify-between">
                                                <span class="text-gray-600 dark:text-gray-400">Finish:</span>
                                                <span class="font-medium text-yellow-600">${foilLabel}</span>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                                
                                <div class="border-t pt-4">
                                    <div class="flex justify-between items-center mb-4">
                                        <span class="text-xl font-bold text-gray-900 dark:text-white">Value:</span>
                                        <span class="text-2xl font-bold text-green-600 dark:text-green-400">
                                            ${convertAndFormat ? convertAndFormat({ usd: card.price }) : `$${parseFloat(card.price || 0).toFixed(2)}`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Bind close event
        document.getElementById('close-card-modal').addEventListener('click', () => {
            document.getElementById('card-modal').remove();
        });
        
        // Close on backdrop click
        document.getElementById('card-modal').addEventListener('click', (e) => {
            if (e.target.id === 'card-modal') {
                document.getElementById('card-modal').remove();
            }
        });
    }

    getFoilLabel(game) {
        const isPokemon = game?.toLowerCase() === 'pokemon' || game?.toLowerCase() === 'pokémon';
        return isPokemon ? 'Holo' : 'Foil';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg text-white shadow-lg transition-all duration-300 transform translate-x-full`;
        
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-blue-600',
            warning: 'bg-yellow-600'
        };
        
        toast.classList.add(colors[type] || colors.info);
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.remove('translate-x-full'), 10);
        
        // Animate out and remove
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize the enhanced trades manager
window.enhancedTrades = new EnhancedTradesManager();
