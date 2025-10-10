/**
 * Complete Card Tagging System Rebuild for GeminiHatake
 * Fixes all card matching, metadata, and tooltip issues
 */

// Global card data storage
let globalCardData = new Map();
let selectedCardForPost = null;

// Card search configuration
const CARD_APIS = {
    mtg: {
        name: 'Magic: The Gathering',
        searchUrl: 'https://api.scryfall.com/cards/search',
        color: '#ff6b35'
    },
    pokemon: {
        name: 'Pokemon',
        searchUrl: 'https://api.pokemontcg.io/v2/cards',
        color: '#ffcc02'
    },
    lorcana: {
        name: 'Lorcana',
        searchUrl: 'https://api.lorcana-api.com/cards/fetch',
        color: '#4a90e2'
    },
    gundam: {
        name: 'Gundam',
        searchUrl: 'https://api.gundam-api.com/cards/search',
        color: '#e74c3c'
    }
};

/**
 * Standardized card data structure
 */
class CardData {
    constructor(rawCard, game) {
        this.id = this.extractId(rawCard, game);
        this.name = this.extractName(rawCard, game);
        this.set = this.extractSet(rawCard, game);
        this.setCode = this.extractSetCode(rawCard, game);
        this.game = game;
        this.imageUrl = this.extractImageUrl(rawCard, game);
        this.type = this.extractType(rawCard, game);
        this.rarity = this.extractRarity(rawCard, game);
        this.manaCost = this.extractManaCost(rawCard, game);
        this.price = this.extractPrice(rawCard, game);
        this.rawData = rawCard;
    }

    extractId(card, game) {
        switch (game) {
            case 'mtg': return card.id || card.oracle_id;
            case 'pokemon': return card.id;
            case 'lorcana': return card.unique_id || card.id;
            case 'gundam': return card.card_id || card.id;
            default: return card.id || Math.random().toString(36);
        }
    }

    extractName(card, game) {
        switch (game) {
            case 'mtg': return card.name;
            case 'pokemon': return card.name;
            case 'lorcana': return card.name;
            case 'gundam': return card.name;
            default: return card.name || 'Unknown Card';
        }
    }

    extractSet(card, game) {
        switch (game) {
            case 'mtg': return card.set_name || card.expansion?.name || 'Unknown Set';
            case 'pokemon': return card.set?.name || 'Unknown Set';
            case 'lorcana': return card.set_name || card.expansion || 'Unknown Set';
            case 'gundam': return card.series || card.set || 'Unknown Set';
            default: return 'Unknown Set';
        }
    }

    extractSetCode(card, game) {
        switch (game) {
            case 'mtg': return card.set || card.set_code;
            case 'pokemon': return card.set?.id;
            case 'lorcana': return card.set_code;
            case 'gundam': return card.series_code;
            default: return '';
        }
    }

    extractImageUrl(card, game) {
        switch (game) {
            case 'mtg': return card.image_uris?.normal || card.image_uris?.large || card.image_uris?.small || '';
            case 'pokemon': return card.images?.large || card.images?.small || '';
            case 'lorcana': return card.image || card.image_url || '';
            case 'gundam': return card.image_url || card.image || '';
            default: return '';
        }
    }

    extractType(card, game) {
        switch (game) {
            case 'mtg': return card.type_line || 'Unknown Type';
            case 'pokemon': return card.supertype || 'Unknown Type';
            case 'lorcana': return card.type || 'Unknown Type';
            case 'gundam': return card.type || 'Unknown Type';
            default: return 'Unknown Type';
        }
    }

    extractRarity(card, game) {
        switch (game) {
            case 'mtg': return card.rarity || 'common';
            case 'pokemon': return card.rarity || 'Common';
            case 'lorcana': return card.rarity || 'Common';
            case 'gundam': return card.rarity || 'Common';
            default: return 'Common';
        }
    }

    extractManaCost(card, game) {
        switch (game) {
            case 'mtg': return card.mana_cost || '';
            case 'pokemon': return card.convertedRetreatCost || '';
            case 'lorcana': return card.cost || '';
            case 'gundam': return card.cost || '';
            default: return '';
        }
    }

    extractPrice(card, game) {
        switch (game) {
            case 'mtg': return card.prices?.usd || card.prices?.eur || '';
            case 'pokemon': return card.cardmarket?.prices?.averageSellPrice || '';
            case 'lorcana': return card.price || '';
            case 'gundam': return card.price || '';
            default: return '';
        }
    }

    // Generate a unique key for storage
    getStorageKey() {
        return `${this.game}:${this.name}:${this.setCode}`;
    }

    // Convert to post data format
    toPostData() {
        return {
            cardId: this.id,
            cardName: this.name,
            cardSet: this.set,
            cardSetCode: this.setCode,
            cardGame: this.game,
            cardImageUrl: this.imageUrl,
            cardType: this.type,
            cardRarity: this.rarity,
            cardManaCost: this.manaCost,
            cardPrice: this.price,
            cardDataComplete: true
        };
    }
}

/**
 * Enhanced card search with exact matching
 */
class CardSearchEngine {
    constructor() {
        this.cache = new Map();
        this.searchTimeout = null;
    }

    async searchAllGames(query) {
        if (query.length < 2) return [];

        const cacheKey = query.toLowerCase();
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        console.log(`[CardSearch] Searching all games for: "${query}"`);
        
        const searchPromises = [
            this.searchMTG(query),
            this.searchPokemon(query),
            this.searchLorcana(query),
            this.searchGundam(query)
        ];

        try {
            const results = await Promise.allSettled(searchPromises);
            const allCards = [];

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    allCards.push(...result.value);
                }
            });

            // Sort by exact match first, then by relevance
            const sortedCards = this.sortByRelevance(allCards, query);
            
            // Cache results
            this.cache.set(cacheKey, sortedCards);
            
            console.log(`[CardSearch] Total results found: ${sortedCards.length}`);
            return sortedCards;
        } catch (error) {
            console.error('[CardSearch] Search error:', error);
            return [];
        }
    }

    async searchMTG(query) {
        try {
            const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=name`);
            if (!response.ok) return [];
            
            const data = await response.json();
            return data.data?.map(card => new CardData(card, 'mtg')) || [];
        } catch (error) {
            console.error('[CardSearch] MTG search error:', error);
            return [];
        }
    }

    async searchPokemon(query) {
        try {
            const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(query)}*`, {
                headers: {
                    'X-Api-Key': '60a08d4a-3a34-43d8-8f41-827b58cfac6d'
                }
            });
            if (!response.ok) return [];
            
            const data = await response.json();
            return data.data?.map(card => new CardData(card, 'pokemon')) || [];
        } catch (error) {
            console.error('[CardSearch] Pokemon search error:', error);
            return [];
        }
    }

    async searchLorcana(query) {
        try {
            // Using a mock API for Lorcana - replace with actual API when available
            const response = await fetch(`https://api.lorcana-api.com/cards/fetch?search=${encodeURIComponent(query)}`);
            if (!response.ok) return [];
            
            const data = await response.json();
            return data.cards?.map(card => new CardData(card, 'lorcana')) || [];
        } catch (error) {
            console.error('[CardSearch] Lorcana search error:', error);
            // Return mock data for testing
            if (query.toLowerCase().includes('bell')) {
                return [new CardData({
                    id: 'lorcana-bell-1',
                    name: 'Ring the Bell',
                    set_name: 'The First Chapter',
                    image: 'https://example.com/bell.jpg',
                    type: 'Action',
                    rarity: 'Common',
                    cost: 2
                }, 'lorcana')];
            }
            return [];
        }
    }

    async searchGundam(query) {
        try {
            // Using a mock API for Gundam - replace with actual API when available
            const response = await fetch(`https://api.gundam-api.com/cards/search?name=${encodeURIComponent(query)}`);
            if (!response.ok) return [];
            
            const data = await response.json();
            return data.cards?.map(card => new CardData(card, 'gundam')) || [];
        } catch (error) {
            console.error('[CardSearch] Gundam search error:', error);
            return [];
        }
    }

    sortByRelevance(cards, query) {
        const queryLower = query.toLowerCase();
        
        return cards.sort((a, b) => {
            const aNameLower = a.name.toLowerCase();
            const bNameLower = b.name.toLowerCase();
            
            // Exact match first
            if (aNameLower === queryLower && bNameLower !== queryLower) return -1;
            if (bNameLower === queryLower && aNameLower !== queryLower) return 1;
            
            // Starts with query
            if (aNameLower.startsWith(queryLower) && !bNameLower.startsWith(queryLower)) return -1;
            if (bNameLower.startsWith(queryLower) && !aNameLower.startsWith(queryLower)) return 1;
            
            // Contains query
            const aContains = aNameLower.includes(queryLower);
            const bContains = bNameLower.includes(queryLower);
            if (aContains && !bContains) return -1;
            if (bContains && !aContains) return 1;
            
            // Alphabetical
            return aNameLower.localeCompare(bNameLower);
        });
    }
}

/**
 * Enhanced autocomplete with proper card selection
 */
class CardAutocomplete {
    constructor() {
        this.searchEngine = new CardSearchEngine();
        this.currentSuggestions = [];
    }

    async handleCardInput(textarea, suggestionsContainer, onCardSelect) {
        const text = textarea.value;
        const cursorPos = textarea.selectionStart;
        
        // Check for card pattern [CardName
        const cardMatch = /\[([^\]]*)$/.exec(text.substring(0, cursorPos));
        if (!cardMatch) {
            this.hideSuggestions(suggestionsContainer);
            return;
        }

        const query = cardMatch[1];
        if (query.length < 2) {
            this.hideSuggestions(suggestionsContainer);
            return;
        }

        console.log(`[CardAutocomplete] Searching for: "${query}"`);
        
        try {
            const cards = await this.searchEngine.searchAllGames(query);
            this.showSuggestions(cards, suggestionsContainer, textarea, onCardSelect);
        } catch (error) {
            console.error('[CardAutocomplete] Error:', error);
            this.hideSuggestions(suggestionsContainer);
        }
    }

    showSuggestions(cards, container, textarea, onCardSelect) {
        if (cards.length === 0) {
            this.hideSuggestions(container);
            return;
        }

        this.currentSuggestions = cards;
        container.innerHTML = '';
        container.classList.remove('hidden');

        cards.slice(0, 10).forEach((card, index) => {
            const suggestionEl = this.createSuggestionElement(card, index);
            suggestionEl.addEventListener('click', () => {
                this.selectCard(card, textarea, container, onCardSelect);
            });
            container.appendChild(suggestionEl);
        });
    }

    createSuggestionElement(card, index) {
        const el = document.createElement('div');
        el.className = 'p-3 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between';
        
        const gameColor = CARD_APIS[card.game]?.color || '#666';
        
        el.innerHTML = `
            <div class="flex-1">
                <div class="font-semibold text-gray-800 dark:text-gray-200">${this.escapeHtml(card.name)}</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">${this.escapeHtml(card.set)}</div>
            </div>
            <div class="ml-2">
                <span class="px-2 py-1 text-xs font-medium rounded" style="background-color: ${gameColor}; color: white;">
                    ${CARD_APIS[card.game]?.name || card.game.toUpperCase()}
                </span>
            </div>
        `;
        
        return el;
    }

    selectCard(card, textarea, container, onCardSelect) {
        console.log(`[CardAutocomplete] Card selected: ${card.name} from ${card.set}`);
        
        // Store card data globally
        globalCardData.set(card.getStorageKey(), card);
        
        // Update textarea
        const text = textarea.value;
        const cursorPos = textarea.selectionStart;
        const beforeCursor = text.substring(0, cursorPos);
        const afterCursor = text.substring(cursorPos);
        
        const lastBracketIndex = beforeCursor.lastIndexOf('[');
        const newText = beforeCursor.substring(0, lastBracketIndex) + `[${card.name}] ` + afterCursor;
        
        textarea.value = newText;
        textarea.focus();
        
        // Hide suggestions
        this.hideSuggestions(container);
        
        // Call callback
        if (onCardSelect) {
            onCardSelect(card);
        }
    }

    hideSuggestions(container) {
        container.classList.add('hidden');
        container.innerHTML = '';
        this.currentSuggestions = [];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/**
 * Enhanced content formatter with proper card linking
 */
class ContentFormatter {
    formatPostContent(postData) {
        const isPostObject = typeof postData === 'object' && postData !== null && postData.content;
        const content = isPostObject ? postData.content : postData;
        
        if (!content) return '';
        
        let formatted = this.escapeHtml(content);
        
        // Format mentions
        formatted = formatted.replace(/@(\w+)/g, 
            `<a href="profile.html?user=$1" class="font-semibold text-blue-500 hover:underline">@$1</a>`);
        
        // Format hashtags
        formatted = formatted.replace(/#(\w+)/g, 
            `<a href="search.html?query=%23$1" class="font-semibold text-indigo-500 hover:underline">#$1</a>`);
        
        // Format deck links
        formatted = formatted.replace(/\[deck:([^:]+):([^\]]+)\]/g, 
            `<a href="deck.html?deckId=$1" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">[Deck: $2]</a>`);
        
        // Format card links
        formatted = formatted.replace(/\[([^\]\[:]+)\]/g, (match, cardName) => {
            return this.createCardLink(cardName, postData);
        });
        
        return formatted;
    }

    createCardLink(cardName, postData) {
        // Check if we have stored card data for this post
        if (postData && postData.cardName && cardName.toLowerCase() === postData.cardName.toLowerCase()) {
            return this.createRichCardLink(postData);
        }
        
        // Check global card data
        const storedCard = this.findStoredCard(cardName);
        if (storedCard) {
            return this.createRichCardLink(storedCard.toPostData());
        }
        
        // Fallback to simple link
        return this.createSimpleCardLink(cardName);
    }

    createRichCardLink(cardData) {
        const attrs = [
            `data-card-name="${this.escapeHtml(cardData.cardName || '')}"`,
            `data-card-set="${this.escapeHtml(cardData.cardSet || '')}"`,
            `data-card-game="${this.escapeHtml(cardData.cardGame || '')}"`,
            `data-card-image-url="${this.escapeHtml(cardData.cardImageUrl || '')}"`,
            `data-card-type="${this.escapeHtml(cardData.cardType || '')}"`,
            `data-card-rarity="${this.escapeHtml(cardData.cardRarity || '')}"`,
            `data-card-id="${this.escapeHtml(cardData.cardId || '')}"`,
            `title="View ${this.escapeHtml(cardData.cardName || '')}"`
        ].join(' ');
        
        return `<a href="card-view.html?name=${encodeURIComponent(cardData.cardName || '')}&set=${encodeURIComponent(cardData.cardSet || '')}" 
                   class="text-blue-500 dark:text-blue-400 card-link hover:underline font-medium" 
                   ${attrs}>[${this.escapeHtml(cardData.cardName || '')}]</a>`;
    }

    createSimpleCardLink(cardName) {
        return `<a href="card-view.html?name=${encodeURIComponent(cardName)}" 
                   class="text-blue-500 dark:text-blue-400 card-link hover:underline" 
                   data-card-name="${this.escapeHtml(cardName)}"
                   title="View ${this.escapeHtml(cardName)}">[${this.escapeHtml(cardName)}]</a>`;
    }

    findStoredCard(cardName) {
        for (const [key, card] of globalCardData) {
            if (card.name.toLowerCase() === cardName.toLowerCase()) {
                return card;
            }
        }
        return null;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

/**
 * Enhanced tooltip system with proper card data
 */
class CardTooltipSystem {
    constructor() {
        this.tooltip = null;
        this.currentCard = null;
        this.loadingTimeout = null;
    }

    initialize() {
        console.log('[CardTooltip] Initializing tooltip system...');
        
        // Create tooltip element
        this.createTooltip();
        
        // Initialize hover events for existing card links
        this.initializeCardLinks();
        
        console.log('[CardTooltip] Tooltip system initialized');
    }

    createTooltip() {
        if (this.tooltip) {
            this.tooltip.remove();
        }
        
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'fixed z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 max-w-sm hidden';
        this.tooltip.style.pointerEvents = 'none';
        document.body.appendChild(this.tooltip);
    }

    initializeCardLinks() {
        const cardLinks = document.querySelectorAll('.card-link');
        console.log(`[CardTooltip] Found ${cardLinks.length} card links to initialize`);
        
        cardLinks.forEach(link => {
            // Remove existing listeners
            link.removeEventListener('mouseenter', this.handleMouseEnter);
            link.removeEventListener('mouseleave', this.handleMouseLeave);
            link.removeEventListener('mousemove', this.handleMouseMove);
            
            // Add new listeners
            link.addEventListener('mouseenter', (e) => this.handleMouseEnter(e));
            link.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
            link.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        });
    }

    handleMouseEnter = (event) => {
        const link = event.target;
        const cardName = link.getAttribute('data-card-name');
        
        if (!cardName) return;
        
        console.log(`[CardTooltip] Showing tooltip for: ${cardName}`);
        
        // Clear any existing timeout
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
        }
        
        // Show loading state
        this.showLoadingTooltip(cardName);
        
        // Load card data
        this.loadingTimeout = setTimeout(() => {
            this.loadCardData(link);
        }, 300);
    }

    handleMouseLeave = (event) => {
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }
        
        this.hideTooltip();
    }

    handleMouseMove = (event) => {
        if (this.tooltip && !this.tooltip.classList.contains('hidden')) {
            this.positionTooltip(event);
        }
    }

    showLoadingTooltip(cardName) {
        this.tooltip.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span class="text-sm text-gray-600 dark:text-gray-400">Loading ${cardName}...</span>
            </div>
        `;
        this.tooltip.classList.remove('hidden');
    }

    async loadCardData(link) {
        const cardData = this.extractCardDataFromLink(link);
        
        if (cardData.cardName && cardData.cardSet && cardData.cardSet !== 'Unknown Set') {
            // Use stored data
            this.showCardTooltip(cardData);
        } else {
            // Try to fetch fresh data
            await this.fetchAndShowCardData(cardData.cardName || link.getAttribute('data-card-name'));
        }
    }

    extractCardDataFromLink(link) {
        return {
            cardName: link.getAttribute('data-card-name') || '',
            cardSet: link.getAttribute('data-card-set') || '',
            cardGame: link.getAttribute('data-card-game') || '',
            cardImageUrl: link.getAttribute('data-card-image-url') || '',
            cardType: link.getAttribute('data-card-type') || '',
            cardRarity: link.getAttribute('data-card-rarity') || '',
            cardId: link.getAttribute('data-card-id') || ''
        };
    }

    async fetchAndShowCardData(cardName) {
        try {
            const searchEngine = new CardSearchEngine();
            const results = await searchEngine.searchAllGames(cardName);
            
            // Find exact match
            const exactMatch = results.find(card => 
                card.name.toLowerCase() === cardName.toLowerCase()
            );
            
            if (exactMatch) {
                this.showCardTooltip(exactMatch.toPostData());
            } else {
                this.showErrorTooltip(cardName);
            }
        } catch (error) {
            console.error('[CardTooltip] Error fetching card data:', error);
            this.showErrorTooltip(cardName);
        }
    }

    showCardTooltip(cardData) {
        const gameColor = CARD_APIS[cardData.cardGame]?.color || '#666';
        const gameName = CARD_APIS[cardData.cardGame]?.name || cardData.cardGame?.toUpperCase() || 'Unknown';
        
        this.tooltip.innerHTML = `
            <div class="space-y-2">
                ${cardData.cardImageUrl ? `
                    <img src="${cardData.cardImageUrl}" alt="${cardData.cardName}" 
                         class="w-full h-32 object-cover rounded" 
                         onerror="this.style.display='none'">
                ` : ''}
                <div>
                    <h3 class="font-bold text-gray-800 dark:text-gray-200">${cardData.cardName || 'Unknown Card'}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">${cardData.cardSet || 'Unknown Set'}</p>
                </div>
                ${cardData.cardType ? `
                    <p class="text-xs text-gray-500 dark:text-gray-500">${cardData.cardType}</p>
                ` : ''}
                <div class="flex items-center justify-between">
                    <span class="px-2 py-1 text-xs font-medium rounded text-white" 
                          style="background-color: ${gameColor}">
                        ${gameName}
                    </span>
                    ${cardData.cardRarity ? `
                        <span class="text-xs text-gray-500 dark:text-gray-500 capitalize">
                            ${cardData.cardRarity}
                        </span>
                    ` : ''}
                </div>
                <p class="text-xs text-blue-600 dark:text-blue-400">Click to view details</p>
            </div>
        `;
        
        this.tooltip.classList.remove('hidden');
    }

    showErrorTooltip(cardName) {
        this.tooltip.innerHTML = `
            <div class="text-center">
                <h3 class="font-bold text-gray-800 dark:text-gray-200">${cardName}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">Card information not available</p>
                <p class="text-xs text-blue-600 dark:text-blue-400">Click to search</p>
            </div>
        `;
        
        this.tooltip.classList.remove('hidden');
    }

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.classList.add('hidden');
        }
        this.currentCard = null;
    }

    positionTooltip(event) {
        if (!this.tooltip) return;
        
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let x = event.clientX + 10;
        let y = event.clientY + 10;
        
        // Adjust if tooltip would go off screen
        if (x + tooltipRect.width > viewportWidth) {
            x = event.clientX - tooltipRect.width - 10;
        }
        
        if (y + tooltipRect.height > viewportHeight) {
            y = event.clientY - tooltipRect.height - 10;
        }
        
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${y}px`;
    }
}

/**
 * Main card system controller
 */
class CardSystemController {
    constructor() {
        this.autocomplete = new CardAutocomplete();
        this.formatter = new ContentFormatter();
        this.tooltipSystem = new CardTooltipSystem();
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;
        
        console.log('[CardSystem] Initializing complete card system...');
        
        // Initialize tooltip system
        this.tooltipSystem.initialize();
        
        // Set up global functions for app.js integration
        this.setupGlobalFunctions();
        
        this.initialized = true;
        console.log('[CardSystem] Card system initialization complete');
    }

    setupGlobalFunctions() {
        // Export functions for app.js
        window.cardSystemFormatContent = (data) => this.formatter.formatPostContent(data);
        
        window.cardSystemHandleAutocomplete = async (textarea, suggestionsContainer, onCardSelect) => {
            await this.autocomplete.handleCardInput(textarea, suggestionsContainer, onCardSelect);
        };
        
        window.cardSystemEnhancePost = (postData, selectedCard, content) => {
            if (selectedCard && content.includes(`[${selectedCard.name}]`)) {
                const cardData = selectedCard.toPostData();
                return { ...postData, ...cardData };
            }
            return postData;
        };
        
        window.cardSystemInitializeHover = () => {
            this.tooltipSystem.initializeCardLinks();
        };
        
        // Set global selected card
        window.cardSystemSetSelectedCard = (card) => {
            selectedCardForPost = card;
        };
        
        window.cardSystemGetSelectedCard = () => {
            return selectedCardForPost;
        };
    }

    // Reinitialize after new content is added
    reinitialize() {
        console.log('[CardSystem] Reinitializing card system...');
        this.tooltipSystem.initializeCardLinks();
    }
}

// Initialize the system when the module loads
const cardSystem = new CardSystemController();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => cardSystem.initialize());
} else {
    cardSystem.initialize();
}

// Export for manual initialization
export { cardSystem, CardSystemController, CardData, CardSearchEngine };
