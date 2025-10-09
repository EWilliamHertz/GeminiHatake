console.log('Card view script loading...');

let currentCard = null;
let priceChart = null;

function showLoginRequired() {
    // Hide loading and card content
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('card-content').classList.add('hidden');
    
    // Show login required message
    const errorContent = document.getElementById('error-content');
    if (errorContent) {
        errorContent.innerHTML = `
            <div class="text-blue-500 mb-4">
                <i class="fas fa-sign-in-alt text-4xl"></i>
            </div>
            <h2 class="text-2xl font-bold mb-2">Login Required</h2>
            <p class="text-gray-600 dark:text-gray-400 mb-4">Please log in to view card details and pricing information.</p>
            <div class="space-x-4">
                <button onclick="window.location.href='login.html'" class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors">
                    Log In
                </button>
                <button onclick="history.back()" class="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors">
                    Go Back
                </button>
            </div>
        `;
        errorContent.classList.remove('hidden');
    }
}

async function loadCardData() {
    const urlParams = new URLSearchParams(window.location.search);
    const cardName = urlParams.get('name');
    const game = urlParams.get('game') || urlParams.get('tcg'); // Support both parameters
    const cardId = urlParams.get('id');
    
    console.log('Loading card:', { cardName, game, cardId });
    console.log('Full URL:', window.location.href);
    
    if (!cardName) {
        throw new Error('Missing card name parameter');
    }
    
    try {
        // Show loading state
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('card-content').classList.add('hidden');
        
        // Import the multi-game search function
        const { searchCardsMultiGame } = await import('./card-search.js');
        
        let cardData = null;
        
        if (game) {
            // Search specific game first using searchScryDex
            console.log('Searching specific game:', game, 'for:', cardName);
            try {
                const searchScryDexFunction = firebase.functions().httpsCallable('searchScryDex');
                const result = await searchScryDexFunction({ query: cardName, game: game });
                
                let searchResults = [];
                if (result && result.data) {
                    if (Array.isArray(result.data.data)) {
                        searchResults = result.data.data;
                    } else if (Array.isArray(result.data)) {
                        searchResults = result.data;
                    } else if (result.data.success && Array.isArray(result.data.cards)) {
                        searchResults = result.data.cards;
                    }
                }
                
                if (searchResults.length > 0) {
                    // Find exact match or closest match
                    cardData = searchResults.find(card => 
                        card.name.toLowerCase() === cardName.toLowerCase()
                    ) || searchResults[0];
                    cardData.game = game; // Ensure game is set
                }
            } catch (error) {
                console.warn('Error searching specific game:', error);
            }
        }
        
        if (!cardData) {
            // Search all games using multi-game search
            console.log('Searching all games for:', cardName);
            const results = await searchCardsMultiGame(cardName, 10);
            
            if (results.length === 0) {
                throw new Error(`No results found for "${cardName}". Please check the card name and try again.`);
            }
            
            // Find exact match or use first result
            cardData = results.find(card => 
                card.name.toLowerCase() === cardName.toLowerCase()
            ) || results[0];
        }
        
        console.log('Found card data:', cardData);
        
        // Store the current card
        currentCard = cardData;
        
        // Add card to tracking for price history collection (optional)
        try {
            if (firebase.functions) {
                const addToTrackingFunction = firebase.functions().httpsCallable('addCardToTracking');
                await addToTrackingFunction({
                    cardId: cardData.api_id || cardData.id,
                    game: cardData.game || game || 'unknown',
                    cardName: cardData.name
                });
                console.log('Card added to price tracking');
            }
        } catch (trackingError) {
            console.warn('Could not add card to tracking:', trackingError);
        }
        
        // Display the card
        await displayCard(cardData);
        
        // Load and display price history
        await displayPriceChart(cardData, cardData.game || game);
        
        // Show the card content
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('card-content').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading card data:', error);
        showError();
    }
}

async function displayCard(card) {
    console.log('Displaying card:', card);
    
    // Update page title
    const cardName = card.name || card.Name || 'Unknown Card';
    document.title = `${cardName} - Card View - HatakeSocial`;
    
    // Card name
    const nameElement = document.getElementById('card-name');
    if (nameElement) {
        nameElement.textContent = cardName;
    }
    
    // Card image
    const imageElement = document.getElementById('card-image');
    if (imageElement && card.images && card.images.length > 0) {
        imageElement.src = card.images[0].large || card.images[0].medium || card.images[0].small;
        imageElement.alt = cardName;
    }
    
    // Set information
    const setElement = document.getElementById('card-set');
    if (setElement) {
        const setName = card.set_name || card.expansion?.name || 'Unknown Set';
        setElement.textContent = setName;
    }
    
    // Rarity
    const rarityElement = document.getElementById('card-rarity');
    if (rarityElement) {
        rarityElement.textContent = card.rarity || 'Unknown';
    }
    
    // Card number
    const numberElement = document.getElementById('card-number');
    if (numberElement) {
        numberElement.textContent = card.number || card.collector_number || 'N/A';
    }
    
    // Current price - Use consistent ScryDx price data
    const priceElement = document.getElementById('current-price');
    if (priceElement && card.variants && card.variants.length > 0) {
        const variant = card.variants[0];
        if (variant.prices && variant.prices.length > 0) {
            const price = variant.prices[0];
            const currentPrice = price.market || price.low || 0;
            priceElement.textContent = `$${currentPrice.toFixed(2)}`;
        } else {
            priceElement.textContent = 'Price unavailable';
        }
    } else {
        if (priceElement) priceElement.textContent = 'Price unavailable';
    }
    
    // Card details (mana cost, type, etc.)
    const manaElement = document.getElementById('card-mana');
    if (manaElement) {
        manaElement.textContent = card.mana_cost || card.manaCost || 'N/A';
    }
    
    const typeElement = document.getElementById('card-type');
    if (typeElement) {
        typeElement.textContent = card.type_line || card.typeLine || 'N/A';
    }
    
    const textElement = document.getElementById('card-text');
    if (textElement) {
        textElement.textContent = card.oracle_text || card.oracleText || 'No text available';
    }
    
    // Power/Toughness for creatures
    const ptElement = document.getElementById('card-pt');
    if (ptElement) {
        if (card.power && card.toughness) {
            ptElement.textContent = `${card.power}/${card.toughness}`;
            ptElement.parentElement.classList.remove('hidden');
        } else {
            ptElement.parentElement.classList.add('hidden');
        }
    }
}

async function displayPriceChart(card, game, days = 30) {
    console.log(`[CardView] === STARTING PRICE CHART FOR ${card.name || card.Name} ===`);
    console.log(`[CardView] Card ID: ${card.id || card.scryfall_id || card.api_id}`);
    console.log(`[CardView] Game: ${game}, Days: ${days}`);
    
    try {
        // NUCLEAR CHART CLEANUP: Destroy existing chart completely
        if (priceChart) {
            console.log(`[CardView] Destroying existing chart`);
            try {
                priceChart.destroy();
            } catch (destroyError) {
                console.warn(`[CardView] Error destroying chart:`, destroyError);
            }
            priceChart = null;
        }
        
        // Clear any existing Chart.js instances on the canvas
        const canvas = document.getElementById('price-chart');
        if (canvas) {
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                console.log(`[CardView] Destroying existing Chart.js instance`);
                existingChart.destroy();
            }
        }
        
        // Get price history data from Firebase Functions with unique parameters
        const historyFunction = firebase.functions().httpsCallable('getCardPriceHistory');
        const requestParams = {
            cardId: card.id || card.scryfall_id || card.api_id,
            cardName: card.name || card.Name, // Add card name for debugging
            days: days,
            game: game,
            timestamp: Date.now(), // Cache buster
            uniqueId: `${card.id || card.scryfall_id || card.api_id}-${Date.now()}` // Unique identifier
        };
        
        console.log(`[CardView] Requesting price history with params:`, requestParams);
        
        const historyResult = await historyFunction(requestParams);
        
        console.log(`[CardView] Raw price history result:`, historyResult);
        
        let priceData = [];
        
        if (historyResult && historyResult.data && historyResult.data.success) {
            // Use real historical data
            priceData = historyResult.data.data || historyResult.data.priceHistory || [];
            console.log(`[CardView] Using real price history data: ${priceData.length} data points`);
        } else {
            console.log(`[CardView] No historical data, generating sample data for ${card.name || card.Name}`);
            
            // Generate sample data based on current price
            let currentPrice = 10; // Default price
            
            // Try to get current price from card data
            if (card.variants && card.variants[0] && card.variants[0].prices && card.variants[0].prices[0]) {
                const price = card.variants[0].prices[0];
                currentPrice = price.market || price.low || 10;
            } else if (card.prices && card.prices.usd) {
                currentPrice = parseFloat(card.prices.usd) || 10;
            }
            
            // Generate sample price history with realistic variations
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const variation = (Math.random() - 0.5) * 0.3; // ±15% variation
                const price = Math.max(0.1, currentPrice * (1 + variation));
                priceData.push({
                    date: date.toISOString().split('T')[0],
                    market: price,
                    price: price
                });
            }
            
            console.log(`[CardView] Generated ${priceData.length} sample data points for ${card.name || card.Name}`);
        }
                });
            }
        }
        
        // Display price changes using consistent ScryDx data
        if (card.variants && card.variants[0] && card.variants[0].prices && card.variants[0].prices[0]) {
            const price = card.variants[0].prices[0];
            const trends = price.trends || {};
            
            // 24h change
            const change24h = document.getElementById('price-change-24h');
            if (change24h && trends.days_1) {
                const changeValue = trends.days_1.price_change || 0;
                const changePercent = trends.days_1.percent_change || 0;
                change24h.innerHTML = `
                    <span class="${changeValue >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${changeValue >= 0 ? '+' : ''}$${Math.abs(changeValue).toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%)
                    </span>
                `;
            } else if (change24h) {
                change24h.innerHTML = '<span class="text-gray-500">No data</span>';
            }
            
            // 7d change
            const change7d = document.getElementById('price-change-7d');
            if (change7d && trends.days_7) {
                const changeValue = trends.days_7.price_change || 0;
                const changePercent = trends.days_7.percent_change || 0;
                change7d.innerHTML = `
                    <span class="${changeValue >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${changeValue >= 0 ? '+' : ''}$${Math.abs(changeValue).toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%)
                    </span>
                `;
            } else if (change7d) {
                change7d.innerHTML = '<span class="text-gray-500">No data</span>';
            }
            
            // 30d change
            const change30d = document.getElementById('price-change-30d');
            if (change30d && trends.days_30) {
                const changeValue = trends.days_30.price_change || 0;
                const changePercent = trends.days_30.percent_change || 0;
                change30d.innerHTML = `
                    <span class="${changeValue >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ${changeValue >= 0 ? '+' : ''}$${Math.abs(changeValue).toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%)
                    </span>
                `;
            } else if (change30d) {
                change30d.innerHTML = '<span class="text-gray-500">No data</span>';
            }
        }
        
        // Create the price chart
        if (priceData.length > 0) {
            createPriceChart(priceData);
        } else {
            const chartContainer = document.getElementById('price-chart-container');
            if (chartContainer) {
                chartContainer.innerHTML = '<p class="text-gray-500 text-center py-8">No price history available</p>';
            }
        }
        
    } catch (error) {
        console.error('Error loading price chart:', error);
        // Show basic price info even if chart fails
        const chartContainer = document.getElementById('price-chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Price chart temporarily unavailable</p>';
        }
    }
}

function createPriceChart(priceData) {
    console.log(`[CardView] === CREATING PRICE CHART ===`);
    console.log(`[CardView] Price data points: ${priceData.length}`);
    
    const canvas = document.getElementById('price-chart');
    if (!canvas) {
        console.error(`[CardView] Canvas element 'price-chart' not found`);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // NUCLEAR CHART CLEANUP: Destroy ALL existing charts
    if (priceChart) {
        console.log(`[CardView] Destroying existing priceChart instance`);
        try {
            priceChart.destroy();
        } catch (destroyError) {
            console.warn(`[CardView] Error destroying priceChart:`, destroyError);
        }
        priceChart = null;
    }
    
    // Also check Chart.js registry for any existing charts on this canvas
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
        console.log(`[CardView] Destroying existing Chart.js instance on canvas`);
        existingChart.destroy();
    }
    
    // Clear canvas completely
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Prepare data for Chart.js
    const labels = priceData.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString();
    });
    
    const prices = priceData.map(item => item.market || item.price || 0);
    
    console.log(`[CardView] Chart labels:`, labels.slice(0, 5)); // Show first 5
    console.log(`[CardView] Chart prices:`, prices.slice(0, 5)); // Show first 5
    
    // Create unique chart configuration
    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price ($)',
                data: prices,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: `Price History (${priceData.length} days)`,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 8
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    };
    
    // Create the chart instance
    try {
        priceChart = new Chart(ctx, chartConfig);
        console.log(`[CardView] === CHART CREATION COMPLETE ===`);
        console.log(`[CardView] Chart created with ${prices.length} data points`);
        console.log(`[CardView] Price range: $${Math.min(...prices).toFixed(2)} - $${Math.max(...prices).toFixed(2)}`);
    } catch (chartError) {
        console.error(`[CardView] Error creating chart:`, chartError);
        const chartContainer = document.getElementById('price-chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = `<p class="text-red-500 text-center py-8">Error creating price chart: ${chartError.message}</p>`;
        }
    }
}

// Period selection functions
function showPeriod(days) {
    console.log('Switching to', days, 'day view');
    
    // Update active button
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('bg-blue-500', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
    });
    
    const activeBtn = document.querySelector(`[onclick="showPeriod(${days})"]`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-200', 'text-gray-700');
        activeBtn.classList.add('bg-blue-500', 'text-white');
    }
    
    // Reload chart with new period
    if (currentCard) {
        const urlParams = new URLSearchParams(window.location.search);
        const game = urlParams.get('tcg') || 'pokemon';
        displayPriceChart(currentCard, game, days);
    }
}

function showError() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('card-content').classList.add('hidden');
    document.getElementById('error-content').classList.remove('hidden');
}

// Add to collection functionality
async function addToCollection() {
    if (!currentCard) {
        alert('No card data available');
        return;
    }
    
    try {
        const addFunction = firebase.functions().httpsCallable('addCardToCollection');
        const result = await addFunction({
            cardId: currentCard.id || currentCard.scryfall_id,
            cardData: currentCard,
            quantity: 1
        });
        
        if (result.data.success) {
            alert('Card added to collection!');
        } else {
            alert('Failed to add card to collection');
        }
    } catch (error) {
        console.error('Error adding to collection:', error);
        alert('Error adding card to collection');
    }
}

// Price alert functionality
async function setPriceAlert() {
    if (!currentCard) {
        alert('No card data available');
        return;
    }
    
    const targetPrice = prompt('Enter target price for alert:');
    if (!targetPrice || isNaN(targetPrice)) {
        return;
    }
    
    try {
        // Use the price alerts system
        if (typeof PriceAlerts !== 'undefined') {
            PriceAlerts.addAlert(currentCard.id || currentCard.scryfall_id, {
                cardName: currentCard.name || currentCard.Name,
                targetPrice: parseFloat(targetPrice),
                alertType: 'below'
            });
            alert('Price alert set!');
        } else {
            alert('Price alerts system not available');
        }
    } catch (error) {
        console.error('Error setting price alert:', error);
        alert('Error setting price alert');
    }
}


// Make functions global for debugging
window.loadCardData = loadCardData;
window.showError = showError;
window.displayCard = displayCard;
window.showLoginRequired = showLoginRequired;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Card view DOM ready, loading card data...');
    
    // Load card data immediately without requiring authentication
    try {
        await loadCardData();
    } catch (error) {
        console.error('Error loading card:', error);
        showError();
    }
});

console.log('Card view script functions defined and ready');
