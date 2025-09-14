/**
 * Fixed Card Search Module
 * Handles card searching functionality with proper result fetching
 */

/**
 * Search for card versions with proper result fetching
 */
async function searchCardVersions() {
    const gameSelect = document.getElementById('manual-game-select');
    const cardNameInput = document.getElementById('manual-card-name');
    const resultsContainer = document.getElementById('manual-add-results');
    
    if (!gameSelect || !cardNameInput || !resultsContainer) {
        console.error('Required elements not found for card search');
        window.Utils.showNotification('Search interface not found', 'error');
        return;
    }
    
    const game = gameSelect.value;
    const cardName = cardNameInput.value.trim();
    
    if (!cardName) {
        window.Utils.showNotification('Please enter a card name', 'error');
        return;
    }
    
    resultsContainer.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin"></i> Searching for cards...</div>';
    
    try {
        let searchResults = [];
        
        if (game === 'magic') {
            // Enhanced Magic card search
            searchResults = await searchMagicCards(cardName);
        } else if (game === 'pokemon') {
            // Enhanced Pokemon card search
            searchResults = await searchPokemonCards(cardName);
        }
        
        if (searchResults.length === 0) {
            resultsContainer.innerHTML = '<div class="text-center p-4 text-gray-500">No cards found. Try a different search term.</div>';
            return;
        }
        
        // Display results
        resultsContainer.innerHTML = '';
        
        // Add result count info
        const countInfo = document.createElement('div');
        countInfo.className = 'text-sm text-gray-600 dark:text-gray-400 mb-3 text-center font-medium';
        countInfo.textContent = `Found ${searchResults.length} results`;
        resultsContainer.appendChild(countInfo);
        
        // Display all results (no artificial limit)
        searchResults.forEach(card => {
            const cardElement = window.CardModal.createSearchResultElement(card, game);
            resultsContainer.appendChild(cardElement);
        });
        
        console.log(`Search completed: ${searchResults.length} results for "${cardName}"`);
        
    } catch (error) {
        console.error('Error searching for cards:', error);
        let errorMessage = 'Error searching for cards';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('429')) {
            errorMessage = 'Too many requests. Please wait a moment and try again.';
        }
        
        resultsContainer.innerHTML = `<div class="text-center p-4 text-red-500">${errorMessage}</div>`;
        window.Utils.showNotification(errorMessage, 'error');
    }
}

/**
 * Enhanced Magic card search with proper pagination
 */
async function searchMagicCards(cardName) {
    try {
        let allResults = [];
        
        // First, try a broad search to get all printings
        const searchQuery = `"${cardName}"`;
        const response = await window.Utils.makeApiCall(
            `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=released&dir=desc&unique=prints`
        );
        
        if (response && response.data) {
            allResults = response.data;
            
            // Get additional pages if available
            let nextPageUrl = response.next_page;
            let pageCount = 1;
            const maxPages = 5; // Limit to prevent too many requests
            
            while (nextPageUrl && pageCount < maxPages) {
                try {
                    const nextResponse = await window.Utils.makeApiCall(nextPageUrl);
                    if (nextResponse && nextResponse.data) {
                        allResults = allResults.concat(nextResponse.data);
                        nextPageUrl = nextResponse.next_page;
                        pageCount++;
                        
                        // Small delay to respect rate limits
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } else {
                        break;
                    }
                } catch (pageError) {
                    console.warn(`Error fetching page ${pageCount + 1}:`, pageError);
                    break;
                }
            }
        }
        
        console.log(`Magic search for "${cardName}": ${allResults.length} results`);
        return allResults;
        
    } catch (error) {
        console.error('Error searching Magic cards:', error);
        
        // Fallback to simpler search
        try {
            const fallbackResponse = await window.Utils.makeApiCall(
                `https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&order=name`
            );
            return fallbackResponse.data || [];
        } catch (fallbackError) {
            console.error('Fallback search also failed:', fallbackError);
            return [];
        }
    }
}

/**
 * Enhanced Pokemon card search with proper pagination
 */
async function searchPokemonCards(cardName) {
    try {
        let allResults = [];
        let page = 1;
        const maxPages = 10; // Allow more pages for Pokemon since they have more variants
        
        while (page <= maxPages) {
            try {
                const response = await window.Utils.makeApiCall(
                    `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cardName)}"&page=${page}&pageSize=50&orderBy=-set.releaseDate`,
                    {
                        headers: {
                            'X-Api-Key': '60a08d4a-3a34-43d8-8f41-827b58cfac6d'
                        }
                    }
                );
                
                if (response.data && response.data.length > 0) {
                    allResults = allResults.concat(response.data);
                    page++;
                    
                    // If we got less than 50 results, we've reached the end
                    if (response.data.length < 50) {
                        break;
                    }
                    
                    // Small delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                    break;
                }
            } catch (pageError) {
                console.warn(`Error fetching Pokemon page ${page}:`, pageError);
                break;
            }
        }
        
        console.log(`Pokemon search for "${cardName}": ${allResults.length} results`);
        return allResults;
        
    } catch (error) {
        console.error('Error searching Pokemon cards:', error);
        return [];
    }
}

/**
 * Initialize card search functionality
 */
function initializeCardSearch() {
    // Search button
    const searchBtn = document.getElementById('search-card-versions-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchCardVersions);
    }
    
    // Enter key in search input
    const cardNameInput = document.getElementById('manual-card-name');
    if (cardNameInput) {
        cardNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchCardVersions();
            }
        });
    }
    
    console.log('Card search functionality initialized');
}

// Export functions
window.CardSearch = {
    searchCardVersions,
    searchMagicCards,
    searchPokemonCards,
    initializeCardSearch,
    initializeSearch: initializeCardSearch,
    initialize: initializeCardSearch
};

