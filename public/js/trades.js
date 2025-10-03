/**
 * HatakeSocial - Trades Script (v26 - FIXED CRITICAL ISSUES)
 *
 * FIXES APPLIED:
 * - FIXED: Added missing participants array in proposeTrade function
 * - FIXED: Implemented proper auto-balance functionality
 * - FIXED: Added notes input field and proper handling
 * - FIXED: Fixed legacy view initialization and synchronization
 * - FIXED: Improved error handling and data validation
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
            theirValue: 0,
            yourCash: 0,
            theirCash: 0
        };
        this.yourCollection = [];
        this.theirCollection = [];
        this.currentBinder = 'your';
        this.tradeBasket = JSON.parse(localStorage.getItem('tradeBasket') || '[]');
        this.userCurrency = 'USD'; // Default currency
        this.currentViewMode = 'grid'; // Default view mode
        
        this.initializeTradeWindow();
    }

    async initializeTradeWindow() {
        // Initialize currency system
        await this.initializeCurrency();
        
        // Add notes input field to the UI
        this.addNotesInputField();
        
        this.loadYourCollection();
        this.bindEvents();
        this.updateTradeBasketCounter();
        this.bindTradeBasketButton();
        this.loadTradeBasketItems();
        
        // ADDED: Handle URL parameters and pending trades
        this.handleUrlParameters();
        this.processPendingTrade();
    }

    // FIXED: Add notes input field to the trade interface
    addNotesInputField() {
        const tradeActionsDiv = document.querySelector('#new-trading-interface .p-4.border-t.border-gray-200.dark\\:border-gray-700.space-y-2');
        if (tradeActionsDiv && !document.getElementById('trade-notes-input')) {
            const notesSection = document.createElement('div');
            notesSection.className = 'mb-4';
            notesSection.innerHTML = `
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Trade Notes (Optional)</label>
                <textarea id="trade-notes-input" 
                         class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                         placeholder="Add any notes about this trade..." 
                         rows="3"></textarea>
            `;
            tradeActionsDiv.insertBefore(notesSection, tradeActionsDiv.firstChild);
        }
    }

    async initializeCurrency() {
        try {
            // Import currency module
            const { getUserCurrency, convertAndFormat } = await import('./modules/currency.js');
            this.userCurrency = getUserCurrency();
            this.convertAndFormat = convertAndFormat;
            
            // Update currency symbols in the UI
            this.updateCurrencySymbols();
            
            // Listen for currency changes
            document.addEventListener('currencyChanged', (e) => {
                this.userCurrency = e.detail.currency;
                this.updateCurrencySymbols();
                this.updateTradeValues();
            });
        } catch (error) {
            console.error('Error initializing currency:', error);
            this.userCurrency = 'USD';
        }
    }

    updateCurrencySymbols() {
        const currencySymbols = {
            'USD': '$', 'SEK': 'kr', 'EUR': '€', 'GBP': '£', 
            'NOK': 'kr', 'DKK': 'kr', 'JPY': '¥'
        };
        
        const symbol = currencySymbols[this.userCurrency] || this.userCurrency;
        
        const yourSymbol = document.getElementById('your-currency-symbol');
        const theirSymbol = document.getElementById('their-currency-symbol');
        
        if (yourSymbol) yourSymbol.textContent = symbol;
        if (theirSymbol) theirSymbol.textContent = symbol;
    }

    // ADDED: Calculate dynamic price based on condition and edition
    calculateCardPrice(cardData) {
        // Top priority: Use sale_price if it exists and is a valid number
        if (cardData.sale_price) {
            const salePrice = parseFloat(cardData.sale_price);
            if (!isNaN(salePrice)) {
                return salePrice;
            }
        }

        // If no prices object, fall back to other possible price fields
        if (!cardData.prices || typeof cardData.prices !== 'object') {
            const fallbackPrice = parseFloat(cardData.priceUsd || cardData.price || 0);
            return isNaN(fallbackPrice) ? 0 : fallbackPrice;
        }

        const prices = cardData.prices;
        const game = cardData.game ? cardData.game.toLowerCase() : 'mtg';

        // --- MTG Pricing Logic ---
        if (game === 'mtg') {
            if (prices.usd) {
                const mtgPrice = parseFloat(prices.usd);
                return isNaN(mtgPrice) ? 0 : mtgPrice;
            }
        }

        // --- Pokémon Pricing Logic ---
        if (game === 'pokemon') {
            const conditionMap = {
                'mint': 'NM',
                'near mint': 'NM',
                'excellent': 'NM',
                'good': 'LP',
                'light played': 'LP',
                'played': 'MP',
                'poor': 'HP',
                'heavily played': 'HP',
                'damaged': 'DM'
            };

            const condition = cardData.condition ? cardData.condition.toLowerCase() : 'near mint';
            const conditionKey = conditionMap[condition] || 'NM'; // Default to NM

            const isFoil = cardData.is_foil || false;
            const isFirstEdition = cardData.is_first_edition || false;

            let priceKey;

            // Build the price key based on the card's specific properties
            if (isFirstEdition) {
                priceKey = isFoil ? `firstEditionHolofoil_${conditionKey}` : `firstEdition_${conditionKey}`;
            } else {
                priceKey = isFoil ? `unlimitedHolofoil_${conditionKey}` : `unlimited_${conditionKey}`;
            }

            // Check if a price exists for that specific key
            if (prices[priceKey] !== undefined && prices[priceKey] !== null) {
                const specificPrice = parseFloat(prices[priceKey]);
                if (!isNaN(specificPrice)) {
                    return specificPrice;
                }
            }
            
            // If no direct match, check for a graded price of the same type as a fallback
            let gradedKey;
            if (isFirstEdition) {
                gradedKey = isFoil ? 'firstEditionHolofoil_graded' : 'firstEdition_graded';
            } else {
                gradedKey = isFoil ? 'unlimitedHolofoil_graded' : 'unlimitedHolofoil_graded';
            }
            
            if (prices[gradedKey] !== undefined && prices[gradedKey] !== null) {
                const gradedPrice = parseFloat(prices[gradedKey]);
                if (!isNaN(gradedPrice)) {
                    return gradedPrice;
                }
            }
        }

        // --- Final Fallback for All Games ---
        // If no specific price was found, find the most likely "main" price from what's available
        const availablePrices = Object.values(prices)
                                      .filter(p => typeof p === 'number' && p > 0)
                                      .sort((a, b) => b - a); // Sort by highest price first

        if (availablePrices.length > 0) {
            return availablePrices[0];
        }

        // If no valid price can be found, return 0
        return 0;
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
                this.displayCards();
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

        // Cash input event listeners
        document.getElementById('your-cash-input')?.addEventListener('input', (e) => {
            this.currentTrade.yourCash = parseFloat(e.target.value) || 0;
            this.updateTradeValues();
        });

        document.getElementById('their-cash-input')?.addEventListener('input', (e) => {
            this.currentTrade.theirCash = parseFloat(e.target.value) || 0;
            this.updateTradeValues();
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

        // Create card display based on view mode
        const cardsHtml = filteredCards.map(card => this.createCardHtml(card)).join('');
        
        if (this.currentViewMode === 'list') {
            binderContent.innerHTML = `
                <div class="space-y-2">
                    ${cardsHtml}
                </div>
            `;
        } else {
            binderContent.innerHTML = `
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    ${cardsHtml}
                </div>
            `;
        }

        // Add click listeners
        this.addCardClickListeners();
    }

    createCardHtml(card) {
        const cardData = card.cardData || card;
        const isSelected = this.isCardInTrade(card.id);
        const price = this.calculateCardPrice(cardData);
        const formattedPrice = this.convertAndFormat ? this.convertAndFormat(price) : `$${price.toFixed(2)}`;
        
        if (this.currentViewMode === 'list') {
            // List view layout
            return `
                <div class="card-item bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-blue-500' : ''}" 
                     data-card-id="${card.id}">
                    <div class="flex items-center p-4">
                        <div class="w-16 h-20 flex-shrink-0 mr-4">
                            <img src="${cardData.imageUrl || cardData.image_uris?.normal || 'https://via.placeholder.com/200x280'}" 
                                 alt="${cardData.name || 'Card'}" 
                                 class="w-full h-full object-cover rounded"
                                 loading="lazy">
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="font-medium text-gray-900 dark:text-white truncate">${cardData.name || 'Unknown Card'}</h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${cardData.set_name || cardData.set || 'Unknown Set'}</p>
                            <div class="flex items-center justify-between mt-2">
                                <span class="text-sm font-semibold text-green-600 dark:text-green-400">${formattedPrice}</span>
                                <span class="text-sm text-gray-500 dark:text-gray-400">${card.condition || 'NM'}</span>
                            </div>
                        </div>
                        ${isSelected ? '<i class="fas fa-check-circle text-blue-500 text-xl"></i>' : ''}
                    </div>
                </div>
            `;
        } else {
            // Grid view layout
            return `
                <div class="card-item bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow ${isSelected ? 'ring-2 ring-blue-500' : ''}" 
                     data-card-id="${card.id}">
                    <div class="relative">
                        <img src="${cardData.imageUrl || cardData.image_uris?.normal || 'https://via.placeholder.com/200x280'}" 
                             alt="${cardData.name || 'Card'}" 
                             class="w-full h-48 object-cover rounded-t-lg"
                             loading="lazy">
                        ${isSelected ? '<div class="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1"><i class="fas fa-check text-sm"></i></div>' : ''}
                    </div>
                    <div class="p-3">
                        <h3 class="font-medium text-gray-900 dark:text-white text-sm truncate">${cardData.name || 'Unknown Card'}</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${cardData.set_name || cardData.set || 'Unknown Set'}</p>
                        <div class="flex items-center justify-between mt-2">
                            <span class="text-sm font-semibold text-green-600 dark:text-green-400">${formattedPrice}</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">${card.condition || 'NM'}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    addCardClickListeners() {
        document.querySelectorAll('.card-item').forEach(cardElement => {
            cardElement.addEventListener('click', () => {
                const cardId = cardElement.getAttribute('data-card-id');
                this.toggleCardInTrade(cardId);
            });
        });
    }

    isCardInTrade(cardId) {
        if (this.currentBinder === 'your') {
            return this.currentTrade.yourCards.some(c => c.id === cardId);
        } else {
            return this.currentTrade.theirCards.some(c => c.id === cardId);
        }
    }

    toggleCardInTrade(cardId) {
        const cards = this.currentBinder === 'your' ? this.yourCollection : this.theirCollection;
        const card = cards.find(c => c.id === cardId);
        
        if (!card) return;

        if (this.currentBinder === 'your') {
            const index = this.currentTrade.yourCards.findIndex(c => c.id === cardId);
            if (index > -1) {
                this.currentTrade.yourCards.splice(index, 1);
            } else {
                this.currentTrade.yourCards.push(card);
            }
            this.updateYourTradeDisplay();
        } else {
            const index = this.currentTrade.theirCards.findIndex(c => c.id === cardId);
            if (index > -1) {
                this.currentTrade.theirCards.splice(index, 1);
            } else {
                this.currentTrade.theirCards.push(card);
            }
            this.updateTheirTradeDisplay();
        }

        this.updateTradeValues();
        this.updateProposalButton();
        this.displayCards(); // Refresh to show selection state
    }

    updateYourTradeDisplay() {
        const container = document.getElementById('your-trade-cards');
        if (!container) return;

        if (this.currentTrade.yourCards.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="fas fa-plus text-3xl mb-2"></i>
                    <p>Add cards from your collection</p>
                </div>
            `;
            return;
        }

        const cardsHtml = this.currentTrade.yourCards.map(card => {
            const cardData = card.cardData || card;
            const price = this.calculateCardPrice(cardData);
            const formattedPrice = this.convertAndFormat ? this.convertAndFormat(price) : `$${price.toFixed(2)}`;
            
            return `
              <div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <img src="${cardData.imageUrl || cardData.image_uris?.normal || 'https://via.placeholder.com/40x56'}" 
                       alt="${cardData.name}" 
                       class="w-10 h-14 object-cover rounded">
                  <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-white truncate">${cardData.name || 'Unknown Card'}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${cardData.set_name || cardData.set || 'Unknown Set'}</p>
                      <div class="flex items-center justify-between mt-1">
                          <span class="text-xs text-gray-600 dark:text-gray-300">${card.condition || 'NM'}</span>
                          <span class="text-sm font-semibold text-green-600 dark:text-green-400">${formattedPrice}</span>
                      </div>
                  </div>
                  <button class="remove-card-btn text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors" data-card-id="${card.id}" data-side="your">
                      <i class="fas fa-times"></i>
                  </button>
              </div>
            `;
        }).join('');

        container.innerHTML = cardsHtml;

        // Add proper event listeners AFTER setting the HTML
        container.querySelectorAll('.remove-card-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const cardId = event.currentTarget.getAttribute('data-card-id');
                const side = event.currentTarget.getAttribute('data-side');
                this.removeCardFromTrade(cardId, side);
            });
        });
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
            const price = this.calculateCardPrice(cardData);
            const formattedPrice = this.convertAndFormat ? this.convertAndFormat(price) : `$${price.toFixed(2)}`;
            const imageUrl = cardData.image_uris?.normal || cardData.image_uris?.large || cardData.images?.large || cardData.imageUrl;
            
            return `
              <div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <img src="${imageUrl || 'https://via.placeholder.com/40x56'}" 
                       alt="${cardData.name}" 
                       class="w-10 h-14 object-cover rounded" 
                       onerror="this.src='https://via.placeholder.com/40x56?text=?'">
                  <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-white truncate">${cardData.name || 'Unknown Card'}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${cardData.set_name || cardData.set || 'Unknown Set'}</p>
                      <div class="flex items-center justify-between mt-1">
                          <span class="text-xs text-gray-600 dark:text-gray-300">${card.condition || 'NM'}</span>
                          <span class="text-sm font-semibold text-green-600 dark:text-green-400">${formattedPrice}</span>
                      </div>
                  </div>
                  <button class="remove-card-btn text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors" data-card-id="${card.id}" data-side="their">
                      <i class="fas fa-times"></i>
                  </button>
              </div>
            `;
        }).join('');

        container.innerHTML = cardsHtml;

        // Add proper event listeners AFTER setting the HTML
        container.querySelectorAll('.remove-card-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const cardId = event.currentTarget.getAttribute('data-card-id');
                const side = event.currentTarget.getAttribute('data-side');
                this.removeCardFromTrade(cardId, side);
            });
        });
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
        // Calculate card values
        this.currentTrade.yourValue = this.currentTrade.yourCards.reduce((sum, card) => {
            const cardData = card.cardData || card;
            const price = this.calculateCardPrice(cardData);
            return sum + price;
        }, 0);

        this.currentTrade.theirValue = this.currentTrade.theirCards.reduce((sum, card) => {
            const cardData = card.cardData || card;
            const price = this.calculateCardPrice(cardData);
            return sum + price;
        }, 0);

        // Calculate total values including cash
        const yourTotalValue = this.currentTrade.yourValue + this.currentTrade.yourCash;
        const theirTotalValue = this.currentTrade.theirValue + this.currentTrade.theirCash;

        // Update display with currency formatting
        const yourValueEl = document.getElementById('your-trade-value');
        const theirValueEl = document.getElementById('their-trade-value');
        const balanceEl = document.getElementById('trade-balance');

        if (yourValueEl) {
            const formattedValue = this.convertAndFormat ? this.convertAndFormat(yourTotalValue) : `$${yourTotalValue.toFixed(2)}`;
            yourValueEl.textContent = formattedValue;
        }

        if (theirValueEl) {
            const formattedValue = this.convertAndFormat ? this.convertAndFormat(theirTotalValue) : `$${theirTotalValue.toFixed(2)}`;
            theirValueEl.textContent = formattedValue;
        }

        if (balanceEl) {
            const difference = yourTotalValue - theirTotalValue;
            const absValue = Math.abs(difference);
            
            if (absValue < 0.01) {
                balanceEl.textContent = 'Balanced';
                balanceEl.className = 'text-sm text-green-600 dark:text-green-400 font-medium';
            } else if (difference > 0) { // Correct: yourTotalValue is GREATER
                const formattedDiff = this.convertAndFormat ? this.convertAndFormat(absValue) : `$${absValue.toFixed(2)}`;
                balanceEl.textContent = `They owe ${formattedDiff}`; // THEY owe YOU
                balanceEl.className = 'text-sm text-blue-600 dark:text-blue-400 font-medium';
            } else { // Correct: yourTotalValue is LESS
                const formattedDiff = this.convertAndFormat ? this.convertAndFormat(absValue) : `$${absValue.toFixed(2)}`;
                balanceEl.textContent = `You owe ${formattedDiff}`; // YOU owe THEM
                balanceEl.className = 'text-sm text-red-600 dark:text-red-400 font-medium';
            }
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
        
        // Game filters from checkboxes (e.g., ['mtg', 'pokemon'])
        const checkedGames = Array.from(document.querySelectorAll('.game-filter:checked'))
            .map(cb => cb.getAttribute('data-game'));

        // If no games are checked, don't filter by game
        if (checkedGames.length === 0) {
            return cardsToFilter.filter(card => {
                const cardData = card.cardData || card;
                return !searchTerm || 
                       (cardData.name || '').toLowerCase().includes(searchTerm) ||
                       (cardData.set_name || cardData.set || '').toLowerCase().includes(searchTerm);
            });
        }

        return cardsToFilter.filter(card => {
            const cardData = card.cardData || card;
            
            // Search filter logic
            const matchesSearch = !searchTerm || 
                (cardData.name || '').toLowerCase().includes(searchTerm) ||
                (cardData.set_name || cardData.set || '').toLowerCase().includes(searchTerm);

            if (!matchesSearch) {
                return false; // Exit early if search doesn't match
            }

            // --- Robust Game Filter Logic ---
            const cardGame = (cardData.game || '').toLowerCase();
            let matchesGame = false;

            // Check if the card's game matches any of the selected filters
            if (checkedGames.includes(cardGame)) {
                matchesGame = true;
            } 
            // Specifically handle the 'mtg' vs 'magic' case
            else if (checkedGames.includes('mtg') && cardGame === 'magic') {
                matchesGame = true;
            }

            return matchesGame;
        });
    }

    filterCards(searchTerm) {
        this.displayCards();
    }

    setViewMode(mode) {
        const gridToggle = document.getElementById('view-toggle-grid');
        const listToggle = document.getElementById('view-toggle-list');

        // Store the current view mode
        this.currentViewMode = mode;

        // Update button states
        if (mode === 'grid') {
            gridToggle?.classList.add('bg-blue-600', 'text-white');
            gridToggle?.classList.remove('bg-gray-300', 'text-gray-700', 'dark:bg-gray-600', 'dark:text-gray-300');
            listToggle?.classList.remove('bg-blue-600', 'text-white');
            listToggle?.classList.add('bg-gray-300', 'text-gray-700', 'dark:bg-gray-600', 'dark:text-gray-300');
        } else {
            listToggle?.classList.add('bg-blue-600', 'text-white');
            listToggle?.classList.remove('bg-gray-300', 'text-gray-700', 'dark:bg-gray-600', 'dark:text-gray-300');
            gridToggle?.classList.remove('bg-blue-600', 'text-white');
            gridToggle?.classList.add('bg-gray-300', 'text-gray-700', 'dark:bg-gray-600', 'dark:text-gray-300');
        }

        // Re-render the cards with the new view mode
        this.displayCards();
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
        const toggleBtn = document.getElementById('toggle-legacy-view');
        const newInterface = document.getElementById('new-trading-interface');
        const legacySection = document.getElementById('legacy-trades-section');

        if (newInterface && legacySection && toggleBtn) {
            const isLegacyHidden = legacySection.classList.toggle('hidden');
            newInterface.classList.toggle('hidden');

            if (isLegacyHidden) {
                // We are now showing the new trade interface
                toggleBtn.innerHTML = '<i class="fas fa-list mr-2"></i>View All Trades';
            } else {
                // We are now showing the legacy trade history
                toggleBtn.innerHTML = '<i class="fas fa-exchange-alt mr-2"></i>New Trade';
                
                // FIXED: Trigger a refresh of the legacy trades when switching to it
                if (window.legacyTradesInitialized) {
                    // Force refresh the legacy trades display
                    const user = firebase.auth().currentUser;
                    const db = firebase.firestore();
                    if (user && db) {
                        loadAllTrades(user, db, 
                            document.getElementById('tab-content-incoming'),
                            document.getElementById('tab-content-outgoing'),
                            document.getElementById('tab-content-history')
                        );
                    }
                }
            }
        }
    }

    // FIXED: Proper proposeTrade function with all required fields
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
            const self = this;

            // Helper to correctly extract data for saving
            const mapCardForStorage = (card) => {
                const cardData = card.cardData || card;
                const imageUrl = cardData.imageUrl || cardData.image_uris?.normal || cardData.images?.large || 'https://via.placeholder.com/40x56';
                
                return {
                    id: card.id,
                    name: cardData.name || 'Unknown Card',
                    imageUrl: imageUrl,
                    priceUsd: self.calculateCardPrice(cardData), // Use robust price calculation
                    game: cardData.game || 'Unknown',
                    condition: card.condition || 'Near Mint'
                };
            };

            // FIXED: Include all required fields including participants array
            const tradeData = {
                participants: [this.user.uid, this.currentTrade.partner.uid], // CRITICAL FIX: This was missing!
                proposerId: this.user.uid,
                proposerName: this.user.displayName || this.user.email,
                receiverId: this.currentTrade.partner.uid,
                receiverName: this.currentTrade.partner.displayName || this.currentTrade.partner.email,
                proposerCards: this.currentTrade.yourCards.map(mapCardForStorage),
                receiverCards: this.currentTrade.theirCards.map(mapCardForStorage),
                proposerMoney: this.currentTrade.yourCash || 0,
                receiverMoney: this.currentTrade.theirCash || 0,
                currency: this.userCurrency || 'USD',
                notes: document.getElementById('trade-notes-input')?.value || '', // FIXED: Now properly references the notes input
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                proposerConfirmedShipment: false,
                receiverConfirmedShipment: false
            };

            console.log('PROPOSING TRADE WITH DATA:', tradeData); // Debug log

            await this.db.collection('trades').add(tradeData);
            
            if (window.Toastify) {
                Toastify({
                    text: "Trade proposal sent successfully!",
                    duration: 3000,
                    style: { background: "linear-gradient(to right, #10b981, #059669)" }
                }).showToast();
            }

            this.resetTrade();

        } catch (error) {
            console.error('CRITICAL: Error proposing trade:', error);
            if (window.Toastify) {
                Toastify({
                    text: "Failed to send trade proposal. Please try again.",
                    duration: 3000,
                    style: { background: "linear-gradient(to right, #ef4444, #dc2626)" }
                }).showToast();
            }
        }
    }

    resetTrade() {
        this.currentTrade = {
            partner: null,
            yourCards: [],
            theirCards: [],
            yourValue: 0,
            theirValue: 0,
            yourCash: 0,
            theirCash: 0
        };

        // Reset cash inputs
        const yourCashInput = document.getElementById('your-cash-input');
        const theirCashInput = document.getElementById('their-cash-input');
        const notesInput = document.getElementById('trade-notes-input');
        
        if (yourCashInput) yourCashInput.value = '';
        if (theirCashInput) theirCashInput.value = '';
        if (notesInput) notesInput.value = '';

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

    // FIXED: Proper auto-balance implementation
    autoBalance() {
        if (!this.currentTrade.partner) {
            if (window.Toastify) {
                Toastify({
                    text: "Please select a trading partner first.",
                    duration: 3000,
                    style: { background: "linear-gradient(to right, #ef4444, #dc2626)" }
                }).showToast();
            }
            return;
        }

        const yourCardValue = this.currentTrade.yourValue;
        const theirCardValue = this.currentTrade.theirValue;
        const difference = yourCardValue - theirCardValue;

        if (Math.abs(difference) < 0.01) {
            if (window.Toastify) {
                Toastify({
                    text: "Trade is already balanced!",
                    duration: 3000,
                    style: { background: "linear-gradient(to right, #10b981, #059669)" }
                }).showToast();
            }
            return;
        }

        // Clear existing cash values
        this.currentTrade.yourCash = 0;
        this.currentTrade.theirCash = 0;

        // Calculate who needs to add cash
        if (difference > 0) {
            // You have more value, they need to add cash
            this.currentTrade.theirCash = Math.abs(difference);
            const theirCashInput = document.getElementById('their-cash-input');
            if (theirCashInput) {
                theirCashInput.value = Math.abs(difference).toFixed(2);
            }
        } else {
            // They have more value, you need to add cash
            this.currentTrade.yourCash = Math.abs(difference);
            const yourCashInput = document.getElementById('your-cash-input');
            if (yourCashInput) {
                yourCashInput.value = Math.abs(difference).toFixed(2);
            }
        }

        // Update the trade values display
        this.updateTradeValues();

        if (window.Toastify) {
            const formattedDiff = this.convertAndFormat ? this.convertAndFormat(Math.abs(difference)) : `$${Math.abs(difference).toFixed(2)}`;
            Toastify({
                text: `Auto-balanced! ${difference > 0 ? 'Partner' : 'You'} will add ${formattedDiff} in cash.`,
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
        modal.id = 'user-search-modal-dynamic';
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

        // Create a temporary user search instance for this modal
        const modalUserSearch = new UserSearch(this.db);
        
        searchInput.addEventListener('input', (e) => {
            modalUserSearch.handleSearch(e.target.value, 'partner-search-results');
        });

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
            const queryLower = query.toLowerCase();
            const usersRef = this.db.collection('users');
            
            // Search by display name (case-sensitive for exact matches)
            const displayNameQuery = usersRef
                .where('displayName', '>=', query)
                .where('displayName', '<=', query + '\uf8ff')
                .limit(10);

            // Search by displayName_lower (case-insensitive)
            const displayNameLowerQuery = usersRef
                .where('displayName_lower', '>=', queryLower)
                .where('displayName_lower', '<=', queryLower + '\uf8ff')
                .limit(10);

            // Search by email (case-insensitive)
            const emailQuery = usersRef
                .where('email', '>=', queryLower)
                .where('email', '<=', queryLower + '\uf8ff')
                .limit(10);

            const [displayNameSnapshot, displayNameLowerSnapshot, emailSnapshot] = await Promise.all([
                displayNameQuery.get(),
                displayNameLowerQuery.get(),
                emailQuery.get()
            ]);

            const usersMap = new Map();
            
            // Add users from display name search (exact case)
            displayNameSnapshot.forEach(doc => {
                const userData = doc.data();
                usersMap.set(doc.id, { uid: doc.id, ...userData });
            });

            // Add users from displayName_lower search (case-insensitive)
            displayNameLowerSnapshot.forEach(doc => {
                const userData = doc.data();
                usersMap.set(doc.id, { uid: doc.id, ...userData });
            });

            // Add users from email search
            emailSnapshot.forEach(doc => {
                const userData = doc.data();
                usersMap.set(doc.id, { uid: doc.id, ...userData });
            });

            const users = Array.from(usersMap.values());

            // Sort results by relevance - exact matches first, then partial matches
            users.sort((a, b) => {
                const aDisplayName = (a.displayName || '').toLowerCase();
                const bDisplayName = (b.displayName || '').toLowerCase();
                const aEmail = (a.email || '').toLowerCase();
                const bEmail = (b.email || '').toLowerCase();
                
                // Exact display name matches first
                if (aDisplayName === queryLower && bDisplayName !== queryLower) return -1;
                if (bDisplayName === queryLower && aDisplayName !== queryLower) return 1;
                
                // Exact email matches next
                if (aEmail === queryLower && bEmail !== queryLower) return -1;
                if (bEmail === queryLower && aEmail !== queryLower) return 1;
                
                // Display name starts with query
                if (aDisplayName.startsWith(queryLower) && !bDisplayName.startsWith(queryLower)) return -1;
                if (bDisplayName.startsWith(queryLower) && !aDisplayName.startsWith(queryLower)) return 1;
                
                // Alphabetical order
                return aDisplayName.localeCompare(bDisplayName);
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

        // Clear search input - check for both modal and regular search inputs
        const modalSearchInput = document.getElementById('partner-search-input');
        const regularSearchInput = resultsContainer.id === 'user-search-results' 
            ? document.getElementById('user-search-input')
            : document.getElementById('trade-partner-search');
        
        if (modalSearchInput) {
            modalSearchInput.value = userData.displayName || userData.email;
        } else if (regularSearchInput) {
            regularSearchInput.value = userData.displayName || userData.email;
        }

        // Close the dynamically created modal by its unique ID
        const modal = document.getElementById('user-search-modal-dynamic');
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
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

// FIXED: Legacy trades functionality with proper initialization
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

    // Load trades and mark as initialized
    loadAllTrades(user, db, incomingContainer, outgoingContainer, historyContainer);
    window.legacyTradesInitialized = true;
}

// Helper functions for trade card rendering (moved up to fix hoisting issue)
window.createTradeCard = async function(trade, tradeId, user) {
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
};

window.renderTradeItems = function(cards, money) {
    let html = '';
    if (cards && cards.length > 0) {
        html += cards.map(card => {
            const price = card.priceUsd || card.priceUsdFoil || 0;
            const numericPrice = parseFloat(price) || 0;

            return `
            <div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2 border border-gray-200 dark:border-gray-600">
                <img src="${card.imageUrl || 'https://via.placeholder.com/40x56'}" 
                     alt="${card.name}"
                     class="w-10 h-14 object-cover rounded"
                     onerror="this.src='https://via.placeholder.com/40x56?text=?'">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">${card.name || 'Unknown Card'}</p>
                    <div class="flex items-center justify-between mt-1">
                        <span class="text-xs text-gray-500 dark:text-gray-400">${card.condition || 'NM'}</span>
                        <span class="text-sm font-semibold text-green-600 dark:text-green-400">$${numericPrice.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    }
    
    if (money && money > 0) {
        html += `<div class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 mb-2">
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-dollar-sign text-green-600 dark:text-green-400"></i>
                        <span class="text-sm font-semibold text-green-700 dark:text-green-300">Cash: $${(parseFloat(money) || 0).toFixed(2)}</span>
                    </div>
                 </div>`;
    }
    
    return html || '<div class="text-sm text-gray-500 dark:text-gray-400 p-4 text-center">No items</div>';
};

window.getActionButtons = function(trade, tradeId, isProposer, user) {
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
};

window.handleTradeAction = async function(action, tradeId, db) {
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
             showTradeToast("Trade accepted! Ready for shipment.", 'success');
        }
    } else if (action === 'confirm-shipment') {
        const user = firebase.auth().currentUser;
        const isProposer = tradeData.proposerId === user.uid;
        const updateField = isProposer ? 'proposerConfirmedShipment' : 'receiverConfirmedShipment';
        
        await tradeRef.update({ [updateField]: true });
        
        // Check if both parties have confirmed shipment
        const updatedDoc = await tradeRef.get();
        const updatedData = updatedDoc.data();
        if (updatedData.proposerConfirmedShipment && updatedData.receiverConfirmedShipment) {
            await tradeRef.update({ status: 'shipped' });
        }
        
        showTradeToast("Shipment confirmed!", 'success');
    } else if (action === 'confirm-receipt') {
        await tradeRef.update({ status: 'completed' });
        showTradeToast("Trade completed successfully!", 'success');
    } else {
        await tradeRef.update({ status: action });
        showTradeToast(`Trade ${action}!`, action === 'rejected' || action === 'cancelled' ? 'error' : 'success');
    }
};

window.showTradeToast = function(message, type) {
    if (window.Toastify) {
        const colors = {
            success: "linear-gradient(to right, #10b981, #059669)",
            error: "linear-gradient(to right, #ef4444, #dc2626)",
            info: "linear-gradient(to right, #3b82f6, #1d4ed8)"
        };
        
        Toastify({
            text: message,
            duration: 3000,
            style: { background: colors[type] || colors.info }
        }).showToast();
    }
};

// FIXED: Improved loadAllTrades function with better error handling
function loadAllTrades(user, db, incomingContainer, outgoingContainer, historyContainer) {
    const tradesRef = db.collection('trades').where('participants', 'array-contains', user.uid);
    
    tradesRef.onSnapshot(snapshot => {
        const trades = [];
        const notifications = [];
        
        // FIXED: Better error handling for individual trade documents
        snapshot.forEach(doc => {
            try {
                const trade = { id: doc.id, ...doc.data() };
                trades.push(trade);
                
                const notification = checkTradeNotification(trade, user.uid);
                if (notification) {
                    notifications.push(notification);
                }
            } catch (error) {
                console.error(`Error processing trade document ${doc.id}:`, error);
                // Continue processing other trades instead of failing completely
            }
        });

        // Categorize trades
        const incoming = trades.filter(trade => trade.receiverId === user.uid && trade.status === 'pending');
        const outgoing = trades.filter(trade => trade.proposerId === user.uid && trade.status === 'pending');
        const history = trades.filter(trade => trade.status !== 'pending');

        // Update containers
        updateTradeContainer(incomingContainer, incoming, user, 'incoming');
        updateTradeContainer(outgoingContainer, outgoing, user, 'outgoing');
        updateTradeContainer(historyContainer, history, user, 'history');

        // Update statistics
        const stats = {
            incoming: incoming.length,
            outgoing: outgoing.length,
            completed: history.filter(t => t.status === 'completed').length,
            totalValue: history.filter(t => t.status === 'completed').reduce((sum, trade) => sum + calculateTradeValue(trade), 0)
        };

        updateTradeStatistics(stats);
        updateTabBadges(incoming.length, outgoing.length, notifications.length);
        updateTradeNotifications(notifications);
    }, error => {
        console.error('Error loading trades:', error);
        // Show error message in containers
        [incomingContainer, outgoingContainer, historyContainer].forEach(container => {
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Trades</h3>
                        <p class="text-gray-500 dark:text-gray-400">${error.message}</p>
                        <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            Retry
                        </button>
                    </div>
                `;
            }
        });
    });
}

async function updateTradeContainer(container, trades, user, type) {
    if (!container) return;

    if (trades.length === 0) {
        const messages = {
            incoming: 'No incoming trade offers.',
            outgoing: 'No outgoing trade offers.',
            history: 'No trade history yet.'
        };

        container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-exchange-alt text-4xl text-gray-400 mb-4"></i>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No Trades</h3>
                <p class="text-gray-500 dark:text-gray-400">${messages[type]}</p>
            </div>
        `;
        return;
    }

    // Sort trades by creation date (newest first)
    trades.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
    });

    const tradeCards = await Promise.all(trades.map(trade => window.createTradeCard(trade, trade.id, user)));
    container.innerHTML = '';
    tradeCards.forEach(card => container.appendChild(card));
}

// Helper function to get card value
function getCardValue(card) {
    return parseFloat(card.priceUsd || card.priceUsdFoil || 0);
}

// Helper function to calculate total trade value
function calculateTradeValue(trade) {
    let value = 0;
    
    if (trade.proposerCards) {
        value += trade.proposerCards.reduce((sum, card) => sum + getCardValue(card), 0);
    }
    if (trade.receiverCards) {
        value += trade.receiverCards.reduce((sum, card) => sum + getCardValue(card), 0);
    }
    
    value += (parseFloat(trade.proposerMoney) || 0) + (parseFloat(trade.receiverMoney) || 0);
    return value;
}

// Helper function to check for trade notifications
function checkTradeNotification(trade, userId) {
    const isReceiver = trade.receiverId === userId;
    const now = Date.now();
    const tradeTime = trade.createdAt?.seconds ? trade.createdAt.seconds * 1000 : now;
    const hoursSinceCreated = (now - tradeTime) / (1000 * 60 * 60);

    // Only show notifications for recent trades (within 24 hours)
    if (hoursSinceCreated > 24) return null;

    switch (trade.status) {
        case 'pending':
            if (isReceiver) {
                return {
                    type: 'pending_incoming',
                    message: `New trade offer from ${trade.proposerName}`,
                    tradeId: trade.id,
                    timestamp: tradeTime,
                    priority: 'high'
                };
            }
            break;
        case 'accepted':
            if (!isReceiver) {
                return {
                    type: 'accepted',
                    message: `${trade.receiverName} accepted your trade offer`,
                    tradeId: trade.id,
                    timestamp: tradeTime,
                    priority: 'medium'
                };
            }
            break;
        case 'shipped':
            return {
                type: 'shipped',
                message: `Trade with ${isReceiver ? trade.proposerName : trade.receiverName} has been shipped`,
                tradeId: trade.id,
                timestamp: tradeTime,
                priority: 'medium'
            };
        case 'completed':
            return {
                type: 'completed',
                message: `Trade with ${isReceiver ? trade.proposerName : trade.receiverName} completed successfully`,
                tradeId: trade.id,
            };
    }
    
    return null;
}

// Update trade statistics display
function updateTradeStatistics(stats) {
    const pendingIncomingEl = document.getElementById('pending-incoming-count');
    const pendingOutgoingEl = document.getElementById('pending-outgoing-count');
    const completedTradesEl = document.getElementById('completed-trades-count');
    const totalTradeValueEl = document.getElementById('total-trade-value');

    if (pendingIncomingEl) pendingIncomingEl.textContent = stats.incoming;
    if (pendingOutgoingEl) pendingOutgoingEl.textContent = stats.outgoing;
    if (completedTradesEl) completedTradesEl.textContent = stats.completed;
    if (totalTradeValueEl) totalTradeValueEl.textContent = `$${stats.totalValue.toFixed(2)}`;

    // Update analytics
    updateTradeAnalytics(stats);
}

// Update trade analytics
function updateTradeAnalytics(stats) {
    const totalTrades = stats.incoming + stats.outgoing + stats.completed;
    const successRate = totalTrades > 0 ? (stats.completed / totalTrades) * 100 : 0;
    const avgTradeValue = stats.completed > 0 ? stats.totalValue / stats.completed : 0;

    const successRateBar = document.getElementById('success-rate-bar');
    const successRateText = document.getElementById('success-rate-text');
    const avgTradeValueEl = document.getElementById('avg-trade-value');

    if (successRateBar) successRateBar.style.width = `${successRate}%`;
    if (successRateText) successRateText.textContent = `${successRate.toFixed(1)}% (${stats.completed} of ${totalTrades} trades completed)`;
    if (avgTradeValueEl) avgTradeValueEl.textContent = `$${avgTradeValue.toFixed(2)}`;
}

// Update tab badges
function updateTabBadges(incoming, outgoing, notifications) {
    const incomingBadge = document.getElementById('incoming-badge');
    const outgoingBadge = document.getElementById('outgoing-badge');
    const notificationsBadge = document.getElementById('notifications-badge');

    if (incomingBadge) {
        incomingBadge.textContent = incoming;
        incomingBadge.style.display = incoming > 0 ? 'inline' : 'none';
    }

    if (outgoingBadge) {
        outgoingBadge.textContent = outgoing;
        outgoingBadge.style.display = outgoing > 0 ? 'inline' : 'none';
    }

    if (notificationsBadge) {
        notificationsBadge.textContent = notifications;
        if (notifications > 0) {
            notificationsBadge.classList.remove('hidden');
        } else {
            notificationsBadge.classList.add('hidden');
        }
    }
}

// Update trade notifications
function updateTradeNotifications(notifications) {
    const notificationsList = document.getElementById('trade-notifications-list');
    if (!notificationsList) return;

    if (notifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-bell text-4xl text-gray-400 mb-4"></i>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No Notifications</h3>
                <p class="text-gray-500 dark:text-gray-400">Trade updates and notifications will appear here.</p>
            </div>
        `;
        return;
    }

    // Sort notifications by priority and timestamp
    notifications.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.timestamp - a.timestamp;
    });

    const notificationsHtml = notifications.map(notification => {
        const priorityColors = {
            high: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
            medium: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20',
            low: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
        };

        const priorityIcons = {
            high: 'fas fa-exclamation-circle text-red-500',
            medium: 'fas fa-info-circle text-yellow-500',
            low: 'fas fa-check-circle text-green-500'
        };

        const timeAgo = getTimeAgo(notification.timestamp);

        return `
            <div class="border rounded-lg p-4 ${priorityColors[notification.priority]}">
                <div class="flex items-start space-x-3">
                    <i class="${priorityIcons[notification.priority]}"></i>
                    <div class="flex-1">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">${notification.message}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${timeAgo}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    notificationsList.innerHTML = notificationsHtml;
}

// Helper function to get time ago string
function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

// Duplicate functions removed - they are now defined earlier in the file
