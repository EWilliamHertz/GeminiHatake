/**
 * Card Search Module
 * Handles card searching functionality for manual card adding
 */

/**
 * Search for card versions
 */
async function searchCardVersions() {
    const gameSelect = document.getElementById('manual-game-select');
    const cardNameInput = document.getElementById('manual-card-name');
    const resultsContainer = document.getElementById('manual-add-results');
    
    if (!gameSelect || !cardNameInput || !resultsContainer) return;
    
    const game = gameSelect.value;
    const cardName = cardNameInput.value.trim();
    
    if (!cardName) {
        window.Utils.showNotification('Please enter a card name', 'error');
        return;
    }
    
    resultsContainer.innerHTML = '<div class="text-center p-4">Searching...</div>';
    
    try {
        let searchResults = [];
        
        if (game === 'magic') {
            // Search Scryfall for Magic cards
            const response = await window.Utils.makeApiCall(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&order=released&dir=desc`);
            searchResults = response.data || [];
        } else if (game === 'pokemon') {
            // Search Pokemon TCG API
            const response = await window.Utils.makeApiCall(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cardName)}"`, {
                headers: {
                    'X-Api-Key': '60a08d4a-3a34-43d8-8f41-827b58cfac6d'
                }
            });
            searchResults = response.data || [];
        }
        
        if (searchResults.length === 0) {
            resultsContainer.innerHTML = '<div class="text-center p-4 text-gray-500">No cards found</div>';
            return;
        }
        
        // Display results
        resultsContainer.innerHTML = '';
        searchResults.slice(0, 10).forEach(card => {
            const cardElement = createSearchResultElement(card, game);
            resultsContainer.appendChild(cardElement);
        });
        
    } catch (error) {
        console.error('Error searching for cards:', error);
        resultsContainer.innerHTML = '<div class="text-center p-4 text-red-500">Error searching for cards</div>';
    }
}

/**
 * Create search result element
 */
function createSearchResultElement(card, game) {
    const div = document.createElement('div');
    div.className = 'bg-gray-50 dark:bg-gray-700 p-3 rounded-lg flex items-center space-x-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600';
    
    const imageUrl = window.CardDisplay.getCardImageUrl(card, 'small');
    const setName = card.set_name || card.set?.name || 'Unknown Set';
    const price = card.prices?.usd || 0;
    
    div.innerHTML = `
        <img src="${imageUrl}" alt="${card.name}" class="w-12 h-16 object-cover rounded" 
             onerror="this.src='https://placehold.co/223x310/cccccc/969696?text=No+Image'">
        <div class="flex-1">
            <h4 class="font-semibold text-sm">${card.name}</h4>
            <p class="text-xs text-gray-600 dark:text-gray-400">${setName}</p>
            <p class="text-xs text-green-600">${window.Utils.safeFormatPrice(price)}</p>
        </div>
        <button class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
            Add
        </button>
    `;
    
    div.addEventListener('click', () => window.CardModal.openAddCardModal(card, game));
    
    return div;
}

/**
 * Clear search results
 */
function clearSearchResults() {
    const resultsContainer = document.getElementById('manual-add-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
    }
    
    const cardNameInput = document.getElementById('manual-card-name');
    if (cardNameInput) {
        cardNameInput.value = '';
    }
}

/**
 * Initialize search functionality
 */
function initializeSearch() {
    // Manual card search
    const searchBtn = document.getElementById('search-card-versions-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchCardVersions);
    }
    
    // Enter key for card search
    const cardNameInput = document.getElementById('manual-card-name');
    if (cardNameInput) {
        cardNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchCardVersions();
            }
        });
    }
}

// Export functions
window.CardSearch = {
    searchCardVersions,
    createSearchResultElement,
    clearSearchResults,
    initializeSearch
};

