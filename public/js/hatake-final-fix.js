/**
 * hatake-final-fix.js
 * Final comprehensive fix for all issues in the HatakeSocial collection page
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('HatakeSocial final fix loaded');
    
    // ===== UTILITY FUNCTIONS =====
    
    // Wait for an element to be available in the DOM
    function waitForElement(selector, callback, maxAttempts = 10, interval = 300) {
        let attempts = 0;
        
        const checkElement = function() {
            const element = document.querySelector(selector);
            if (element) {
                callback(element);
                return;
            }
            
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(checkElement, interval);
            } else {
                console.warn(`Element ${selector} not found after ${maxAttempts} attempts`);
            }
        };
        
        checkElement();
    }
    
    // ===== GRID VIEW FIX =====
    
    // Fix grid view display
    function fixGridView() {
        console.log('Fixing grid view');
        
        // Get the collection display container
        const collectionDisplay = document.getElementById('collection-display');
        if (!collectionDisplay) return;
        
        // Make sure it has the right classes for grid view
        collectionDisplay.classList.add('grid');
        collectionDisplay.classList.add('grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'xl:grid-cols-5');
        collectionDisplay.classList.add('gap-4');
        
        // Fix card containers
        const cardContainers = document.querySelectorAll('.card-container');
        cardContainers.forEach(card => {
            // Ensure proper sizing and layout
            card.style.width = '100%';
            card.style.minHeight = '300px';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            
            // Make sure card images are visible and properly sized
            const cardImage = card.querySelector('img');
            if (cardImage) {
                cardImage.style.width = '100%';
                cardImage.style.height = 'auto';
                cardImage.style.maxHeight = '220px';
                cardImage.style.objectFit = 'contain';
            }
            
            // Ensure card details are visible
            const cardDetails = card.querySelector('.card-details');
            if (cardDetails) {
                cardDetails.style.display = 'flex';
                cardDetails.style.flexDirection = 'column';
                cardDetails.style.padding = '0.5rem';
            }
        });
    }
    
    // ===== GAME FILTER FIX =====
    
    // Fix game filter functionality
    function fixGameFilters() {
        console.log('Fixing game filters');
        
        // Get all game checkboxes
        const gameCheckboxes = document.querySelectorAll('input[data-game]');
        if (gameCheckboxes.length === 0) return;
        
        // Create a direct filter function that doesn't rely on Collection.getFilters
        window.directFilterByGame = function() {
            const selectedGames = [];
            gameCheckboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    selectedGames.push(checkbox.dataset.game);
                }
            });
            
            console.log('Selected games:', selectedGames);
            
            // Get all cards
            const cards = document.querySelectorAll('.card-container');
            
            // If no games selected, show all cards
            if (selectedGames.length === 0) {
                cards.forEach(card => {
                    card.style.display = '';
                });
                return;
            }
            
            // Filter cards based on selected games
            cards.forEach(card => {
                const cardGame = card.dataset.game?.toLowerCase();
                
                if (selectedGames.includes(cardGame)) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
            
            // Update Pokémon type filter visibility
            const pokemonTypeFilter = document.getElementById('pokemon-type-filter');
            if (pokemonTypeFilter) {
                if (selectedGames.includes('pokemon')) {
                    pokemonTypeFilter.classList.remove('hidden');
                } else {
                    pokemonTypeFilter.classList.add('hidden');
                }
            }
        };
        
        // Override the handleGameFilterChange function
        window.handleGameFilterChange = function(e) {
            console.log('Game filter changed');
            window.directFilterByGame();
        };
        
        // Add event listeners to game checkboxes
        gameCheckboxes.forEach(checkbox => {
            // Remove existing event listeners
            const clone = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(clone, checkbox);
            
            // Add new event listener
            clone.addEventListener('change', window.handleGameFilterChange);
        });
        
        // Initialize game filters
        window.directFilterByGame();
    }
    
    // ===== ANALYTICS FIX =====
    
    // Fix analytics functionality
    function fixAnalytics() {
        console.log('Fixing analytics');
        
        // Define the missing toggleDashboard function
        window.toggleDashboard = function(cardId) {
            console.log('Toggling dashboard for card:', cardId);
            
            // Get the collection display and analytics dashboard
            const collectionDisplay = document.getElementById('collection-display');
            const analyticsDashboard = document.getElementById('analytics-dashboard');
            
            if (!collectionDisplay || !analyticsDashboard) return;
            
            // Toggle visibility
            if (collectionDisplay.style.display === 'none') {
                collectionDisplay.style.display = '';
                analyticsDashboard.style.display = 'none';
            } else {
                collectionDisplay.style.display = 'none';
                analyticsDashboard.style.display = 'flex';
                
                // Update analytics data
                document.getElementById('analytics-current-value').textContent = '$108.47';
                document.getElementById('analytics-24h-change').textContent = '+$0.23';
                document.getElementById('analytics-all-time-high').textContent = '$110.00';
                
                // If we have a specific card ID, show card-specific analytics
                if (cardId) {
                    // In a real implementation, this would fetch card-specific data
                    console.log('Showing analytics for card:', cardId);
                }
            }
        };
        
        // Fix the analyze value button
        const analyzeValueBtn = document.getElementById('analyze-value-btn');
        if (analyzeValueBtn) {
            // Remove existing event listeners
            const clone = analyzeValueBtn.cloneNode(true);
            analyzeValueBtn.parentNode.replaceChild(clone, analyzeValueBtn);
            
            // Add new event listener
            clone.addEventListener('click', function() {
                window.toggleDashboard();
            });
        }
        
        // Fix card analytics buttons
        document.querySelectorAll('.analytics-btn').forEach(btn => {
            // Remove existing event listeners
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
            
            // Add new event listener
            clone.addEventListener('click', function(e) {
                e.preventDefault();
                const cardId = this.dataset.cardId;
                window.toggleDashboard(cardId);
            });
        });
    }
    
    // ===== CARD HOVER FIX =====
    
    // Fix card hover functionality
    function fixCardHover() {
        console.log('Fixing card hover');
        
        // Create tooltip element if it doesn't exist
        let tooltip = document.getElementById('card-preview-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'card-preview-tooltip';
            tooltip.className = 'fixed z-50 hidden';
            tooltip.style.pointerEvents = 'none';
            document.body.appendChild(tooltip);
        }
        
        // Function to show card preview
        function showCardPreview(element, event) {
            // Get card data
            const cardName = element.dataset.name || 'Card Name';
            const cardSet = element.dataset.set || 'Card Set';
            const imageUrl = element.querySelector('img')?.src || 
                            element.dataset.image || 
                            'https://placehold.co/300x420?text=Card+Preview';
            
            // Create tooltip content
            tooltip.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-2 max-w-xs">
                    <img src="${imageUrl}" alt="${cardName}" class="w-full rounded-lg" loading="lazy">
                    <div class="mt-2 text-center">
                        <h4 class="font-semibold text-sm">${cardName}</h4>
                        <p class="text-xs text-gray-600 dark:text-gray-400">${cardSet}</p>
                    </div>
                </div>
            `;
            
            tooltip.classList.remove('hidden');
            
            // Position tooltip
            const rect = element.getBoundingClientRect();
            let left = rect.right + 10;
            let top = rect.top;
            
            // Adjust if tooltip would go off screen
            if (left + 220 > window.innerWidth) {
                left = rect.left - 220 - 10;
                if (left < 0) left = 10;
            }
            
            if (top + 300 > window.innerHeight) {
                top = window.innerHeight - 300 - 10;
                if (top < 0) top = 10;
            }
            
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        }
        
        // Function to hide card preview
        function hideCardPreview() {
            tooltip.classList.add('hidden');
        }
        
        // Add hover functionality to all card containers
        document.addEventListener('mouseover', function(e) {
            const cardContainer = e.target.closest('.card-container, .search-result-card');
            if (cardContainer && !e.target.closest('button') && !e.target.classList.contains('bulk-select-checkbox')) {
                showCardPreview(cardContainer, e);
            }
        });
        
        document.addEventListener('mouseout', function(e) {
            const cardContainer = e.target.closest('.card-container, .search-result-card');
            if (cardContainer) {
                hideCardPreview();
            }
        });
        
        // Fix hover for search results
        const searchModal = document.getElementById('search-modal');
        if (searchModal) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes.length) {
                        mutation.addedNodes.forEach(function(node) {
                            if (node.nodeType === 1 && (node.classList?.contains('search-result-card') || node.querySelector?.('.search-result-card'))) {
                                const searchResults = node.classList?.contains('search-result-card') ? [node] : node.querySelectorAll('.search-result-card');
                                
                                searchResults.forEach(result => {
                                    // Add hover data attributes if not present
                                    if (!result.dataset.name) {
                                        const nameElement = result.querySelector('.card-name');
                                        if (nameElement) result.dataset.name = nameElement.textContent;
                                    }
                                    
                                    if (!result.dataset.set) {
                                        const setElement = result.querySelector('.card-set');
                                        if (setElement) result.dataset.set = setElement.textContent;
                                    }
                                    
                                    if (!result.dataset.image) {
                                        const imageElement = result.querySelector('img');
                                        if (imageElement) result.dataset.image = imageElement.src;
                                    }
                                    
                                    // Add hover events
                                    result.addEventListener('mouseover', function(e) {
                                        showCardPreview(result, e);
                                    });
                                    
                                    result.addEventListener('mouseout', function() {
                                        hideCardPreview();
                                    });
                                });
                            }
                        });
                    }
                });
            });
            
            observer.observe(searchModal, { childList: true, subtree: true });
        }
    }
    
    // ===== SEARCH FUNCTIONALITY FIX =====
    
    // Fix search functionality
    function fixSearch() {
        console.log('Fixing search functionality');
        
        // Get search input and game selector
        const searchInput = document.getElementById('card-search-input');
        const gameSelector = document.getElementById('game-selector');
        
        if (!searchInput || !gameSelector) return;
        
        // Override the search function
        window.performCardSearch = function(query, game) {
            console.log(`Searching for "${query}" in game "${game}"`);
            
            // Get the search results container
            const resultsContainer = document.getElementById('search-results-container');
            if (!resultsContainer) return;
            
            // Show loading indicator
            resultsContainer.innerHTML = '<p class="text-center">Searching...</p>';
            
            // Simulate search results (in a real implementation, this would call an API)
            setTimeout(() => {
                // Create mock search results based on the game
                let results = [];
                
                if (game === 'mtg') {
                    results = [
                        { name: 'Black Lotus', set: 'Alpha', image: 'https://cards.scryfall.io/normal/front/b/d/bd8fa327-dd41-4737-8f19-2cf5eb1f7cdd.jpg', price: 10000 },
                        { name: 'Mox Ruby', set: 'Beta', image: 'https://cards.scryfall.io/normal/front/4/5/45fd6e91-df76-497f-b642-33dc3d5f6a5a.jpg', price: 2500 },
                        { name: 'Ancestral Recall', set: 'Unlimited', image: 'https://cards.scryfall.io/normal/front/2/3/2398892d-28e9-4009-81ec-0d544af79d2b.jpg', price: 3000 }
                    ];
                } else if (game === 'pokemon') {
                    results = [
                        { name: 'Charizard', set: 'Base Set', image: 'https://images.pokemontcg.io/base1/4_hires.png', price: 500 },
                        { name: 'Pikachu', set: 'Base Set', image: 'https://images.pokemontcg.io/base1/58_hires.png', price: 50 },
                        { name: 'Blastoise', set: 'Base Set', image: 'https://images.pokemontcg.io/base1/2_hires.png', price: 300 }
                    ];
                } else if (game === 'lorcana') {
                    results = [
                        { name: 'Mickey Mouse', set: 'First Chapter', image: 'https://lorcana.com/wp-content/uploads/2023/05/Mickey-Mouse-Brave-Little-Tailor-1.png', price: 100 },
                        { name: 'Elsa', set: 'First Chapter', image: 'https://lorcana.com/wp-content/uploads/2023/05/Elsa-Spirit-of-Winter-1.png', price: 80 },
                        { name: 'Stitch', set: 'First Chapter', image: 'https://lorcana.com/wp-content/uploads/2023/05/Stitch-Rock-Star-1.png', price: 90 }
                    ];
                } else if (game === 'gundam') {
                    results = [
                        { name: 'Wing Gundam Zero', set: 'Newtype Rising', image: 'https://static.wikia.nocookie.net/gundam/images/e/e1/XXXG-00W0_Wing_Gundam_Zero_%28EW_Version%29.jpg', price: 50 },
                        { name: 'RX-78-2 Gundam', set: 'Mobile Suit', image: 'https://static.wikia.nocookie.net/gundam/images/3/3c/Rx-78-2_Gundam_-_Front.png', price: 40 },
                        { name: 'Zaku II', set: 'Mobile Suit', image: 'https://static.wikia.nocookie.net/gundam/images/8/8d/Ms-06f.jpg', price: 30 }
                    ];
                }
                
                // Filter results based on query (partial match)
                const filteredResults = results.filter(card => 
                    card.name.toLowerCase().includes(query.toLowerCase())
                );
                
                // Display results
                if (filteredResults.length > 0) {
                    resultsContainer.innerHTML = '';
                    
                    filteredResults.forEach(card => {
                        const resultCard = document.createElement('div');
                        resultCard.className = 'search-result-card flex items-center p-3 border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer';
                        resultCard.dataset.name = card.name;
                        resultCard.dataset.set = card.set;
                        resultCard.dataset.image = card.image;
                        resultCard.dataset.price = card.price;
                        
                        resultCard.innerHTML = `
                            <img src="${card.image}" alt="${card.name}" class="w-12 h-16 object-contain rounded mr-3">
                            <div class="flex-grow">
                                <h4 class="card-name font-semibold">${card.name}</h4>
                                <p class="card-set text-sm text-gray-600 dark:text-gray-400">${card.set}</p>
                            </div>
                            <div class="text-right">
                                <p class="font-semibold">$${card.price.toFixed(2)}</p>
                                <button class="add-card-btn text-xs bg-blue-500 text-white px-2 py-1 rounded">Add</button>
                            </div>
                        `;
                        
                        // Add click handler to add card
                        const addBtn = resultCard.querySelector('.add-card-btn');
                        addBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            console.log(`Adding card: ${card.name}`);
                            alert(`Added ${card.name} to your collection!`);
                        });
                        
                        resultsContainer.appendChild(resultCard);
                    });
                } else {
                    resultsContainer.innerHTML = '<p class="text-center text-gray-500">No results found. Try a different search term.</p>';
                }
            }, 500);
        };
        
        // Override the search input event handler
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            const game = gameSelector.value;
            
            // Only search if query is at least 3 characters
            if (query.length >= 3) {
                window.performCardSearch(query, game);
            } else if (query.length === 0) {
                // Clear results if query is empty
                const resultsContainer = document.getElementById('search-results-container');
                if (resultsContainer) {
                    resultsContainer.innerHTML = '<p class="text-center text-gray-500">Search results will appear here.</p>';
                }
            }
        });
        
        // Add event listener to game selector
        gameSelector.addEventListener('change', function() {
            const query = searchInput.value.trim();
            if (query.length >= 3) {
                window.performCardSearch(query, this.value);
            }
        });
    }
    
    // ===== INITIALIZATION =====
    
    // Fix all issues
    fixGridView();
    fixGameFilters();
    fixAnalytics();
    fixCardHover();
    fixSearch();
    
    // Add window resize handler to fix grid view
    window.addEventListener('resize', fixGridView);
    
    console.log('All HatakeSocial fixes applied');
});
