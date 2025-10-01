console.log('Card view script loading...');

let currentCard = null;
let priceChart = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Card view DOM ready, waiting for authentication...');
    
    // Wait for Firebase Auth to initialize
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            console.log('User authenticated, loading card data...');
            try {
                await loadCardData();
            } catch (error) {
                console.error('Error loading card:', error);
                showError();
            }
        } else {
            console.log('User not authenticated, showing login prompt...');
            // Show a message that user needs to log in
            showLoginRequired();
        }
    });
});

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
    const game = urlParams.get('tcg') || 'pokemon'; // Default to Pokemon
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
        
        // Search for the card using ScryDx - REAL DATA ONLY
        console.log('Searching ScryDx for:', cardName, 'in game:', game);
        const searchScryDxFunction = firebase.functions().httpsCallable('searchScryDx');
        const result = await searchScryDxFunction({ cardName: cardName, game: game });
        console.log('ScryDx search result:', result);
        
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
        
        console.log('Parsed search results:', searchResults);
        console.log('Number of results:', searchResults.length);
        
        if (searchResults.length === 0) {
            throw new Error(`No results found for "${cardName}" in ScryDx. Please check the card name and try again.`);
        }
        
        // Find exact match by ID or name
        let cardData = null;
        
        if (cardId) {
            // Try to find by ID first
            cardData = searchResults.find(card => 
                card.id === cardId || 
                card.scryfall_id === cardId ||
                card.api_id === cardId
            );
        }
        
        if (!cardData) {
            // Find by name match
            const searchName = cardName.toLowerCase().replace(/[-\s]+/g, ' ');
            cardData = searchResults.find(card => {
                const cardNameNormalized = (card.name || card.Name || '').toLowerCase().replace(/[-\s]+/g, ' ');
                return cardNameNormalized === searchName;
            });
        }
        
        if (!cardData) {
            // Take the first result if no exact match
            cardData = searchResults[0];
            console.log('No exact match found, using first result:', cardData.name || cardData.Name);
        }
        
        console.log('Selected card data:', cardData);
        currentCard = cardData;
        
        // Add card to tracking for price history collection
        try {
            const addToTrackingFunction = firebase.functions().httpsCallable('addCardToTracking');
            await addToTrackingFunction({
                cardId: cardData.id,
                game: game,
                cardName: cardData.name || cardData.Name
            });
            console.log('Card added to price tracking');
        } catch (trackingError) {
            console.warn('Could not add card to tracking:', trackingError);
        }
        
        // Display the card
        await displayCard(cardData);
        
        // Load and display price history
        await displayPriceChart(cardData, game);
        
        // Show the card content
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('card-content').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading card data:', error);
        throw error;
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
    console.log('Loading price chart for card:', card.name || card.Name);
    
    try {
        // Get price history data from Firebase Functions
        const historyFunction = firebase.functions().httpsCallable('getCardPriceHistory');
        const historyResult = await historyFunction({ 
            cardId: card.id || card.scryfall_id || card.api_id,
            days: days,
            game: game
        });
        
        let priceData = [];
        
        if (historyResult && historyResult.data && historyResult.data.success) {
            // Use real historical data
            priceData = historyResult.data.priceHistory || [];
            console.log('Using real price history data:', priceData.length, 'data points');
        } else {
            // Fallback to trends data from the card if no historical data
            console.log('No historical data, using trends fallback');
            if (card.variants && card.variants[0] && card.variants[0].prices && card.variants[0].prices[0]) {
                const price = card.variants[0].prices[0];
                const trends = price.trends || {};
                
                // Convert trends to chart data
                const currentPrice = price.market || price.low || 0;
                const today = new Date();
                
                priceData = [];
                
                // Create data points from trends
                if (trends.days_30) {
                    const pastPrice30 = currentPrice - (trends.days_30.price_change || 0);
                    priceData.push({ 
                        date: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
                        price: Math.max(0, pastPrice30),
                        market: Math.max(0, pastPrice30)
                    });
                }
                
                if (trends.days_7) {
                    const pastPrice7 = currentPrice - (trends.days_7.price_change || 0);
                    priceData.push({ 
                        date: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
                        price: Math.max(0, pastPrice7),
                        market: Math.max(0, pastPrice7)
                    });
                }
                
                if (trends.days_1) {
                    const pastPrice1 = currentPrice - (trends.days_1.price_change || 0);
                    priceData.push({ 
                        date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
                        price: Math.max(0, pastPrice1),
                        market: Math.max(0, pastPrice1)
                    });
                }
                
                // Add current price
                priceData.push({ 
                    date: today.toISOString().split('T')[0], 
                    price: currentPrice,
                    market: currentPrice
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
    const canvas = document.getElementById('price-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (priceChart) {
        priceChart.destroy();
    }
    
    // Prepare data for Chart.js
    const labels = priceData.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString();
    });
    
    const prices = priceData.map(item => item.market || item.price || 0);
    
    priceChart = new Chart(ctx, {
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
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
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
