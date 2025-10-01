// Card View JavaScript
console.log('Card view script loading...');

let currentCard = null;
let priceChart = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Card view DOM ready, loading card...');
    
    try {
        await loadCardData();
    } catch (error) {
        console.error('Error loading card:', error);
        showError();
    }
});

async function loadCardData() {
    const urlParams = new URLSearchParams(window.location.search);
    const cardName = urlParams.get('name');
    const game = urlParams.get('tcg');
    const cardId = urlParams.get('id');
    
    console.log('Loading card:', { cardName, game, cardId });
    
    if (!cardName || !game) {
        throw new Error('Missing card name or game parameter');
    }
    
    try {
        // Search for the card using ScryDex
        const searchScryDexFunction = firebase.functions().httpsCallable('searchScryDex');
        const result = await searchScryDexFunction({ cardName: cardName, game: game });
        
        let searchResults = [];
        if (result && result.data && Array.isArray(result.data.data)) {
            searchResults = result.data.data;
        } else if (result && Array.isArray(result.data)) {
            searchResults = result.data;
        }
        
        // Find exact match by ID or name
        let cardData = null;
        if (cardId) {
            cardData = searchResults.find(card => card.id === cardId);
        }
        if (!cardData) {
            cardData = searchResults.find(card => 
                (card.Name || card.name || '').toLowerCase() === cardName.toLowerCase()
            ) || searchResults[0];
        }
        
        if (!cardData) {
            throw new Error('Card not found in search results.');
        }
        
        console.log('Found card data:', cardData);
        currentCard = cardData;
        
        // Display the card
        displayCard(cardData, game);
        
    } catch (error) {
        console.error('Error loading card data:', error);
        throw error;
    }
}

function displayCard(card, game) {
    console.log('Displaying card:', card);
    
    // Hide loading, show content
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('card-content').classList.remove('hidden');
    
    // Basic card info
    const cardName = card.Name || card.name || 'Unknown Card';
    document.getElementById('card-name').textContent = cardName;
    document.title = `${cardName} - HatakeSocial`;
    
    // Card image
    let imageUrl = 'https://via.placeholder.com/300x420?text=No+Image';
    if (card.images && Array.isArray(card.images) && card.images.length > 0) {
        imageUrl = card.images[0].large || card.images[0].medium || card.images[0].small || imageUrl;
    }
    document.getElementById('card-image').src = imageUrl;
    document.getElementById('card-image').alt = cardName;
    
    // Set and rarity
    const setName = card.expansion?.name || card.set_name || 'Unknown Set';
    const rarity = card.rarity || 'Common';
    document.getElementById('card-set').textContent = setName;
    document.getElementById('card-rarity').textContent = rarity;
    
    // Collector number
    const collectorNumber = card.number || card.collector_number || '';
    document.getElementById('card-number').textContent = collectorNumber ? `#${collectorNumber}` : '';
    
    // Price
    let price = 'N/A';
    if (card.variants && Array.isArray(card.variants) && card.variants.length > 0) {
        const variant = card.variants[0];
        if (variant.prices && Array.isArray(variant.prices) && variant.prices.length > 0) {
            const priceData = variant.prices[0];
            if (priceData.market) {
                price = `$${parseFloat(priceData.market).toFixed(2)}`;
            }
        }
    }
    document.getElementById('card-price').textContent = price;
    
    // Card stats
    displayCardStats(card, game);
    
    // Rulings
    displayRulings(card);
    
    // Price chart
    displayPriceChart(card);
    
    // Add to collection button
    const addBtn = document.getElementById('add-to-collection-btn');
    addBtn.onclick = () => addToCollection(card, game);
}

function displayCardStats(card, game) {
    const statsContainer = document.getElementById('card-stats');
    statsContainer.innerHTML = '';
    
    const stats = [];
    
    // Game-specific stats
    switch (game) {
        case 'mtg':
            if (card.type) stats.push({ label: 'Type', value: card.type });
            if (card.mana_cost) stats.push({ label: 'Mana Cost', value: card.mana_cost });
            if (card.mana_value !== undefined) stats.push({ label: 'Mana Value', value: card.mana_value });
            if (card.power !== undefined && card.toughness !== undefined) {
                stats.push({ label: 'Power/Toughness', value: `${card.power}/${card.toughness}` });
            }
            if (card.colors && card.colors.length > 0) {
                stats.push({ label: 'Colors', value: card.colors.join(', ') });
            }
            break;
            
        case 'pokemon':
            if (card.types) stats.push({ label: 'Types', value: card.types.join(', ') });
            if (card.hp) stats.push({ label: 'HP', value: card.hp });
            if (card.retreat_cost) stats.push({ label: 'Retreat Cost', value: card.retreat_cost });
            break;
            
        case 'lorcana':
            if (card.card_type) stats.push({ label: 'Type', value: card.card_type });
            if (card.cost !== undefined) stats.push({ label: 'Cost', value: card.cost });
            if (card.strength !== undefined) stats.push({ label: 'Strength', value: card.strength });
            if (card.willpower !== undefined) stats.push({ label: 'Willpower', value: card.willpower });
            if (card.lore !== undefined) stats.push({ label: 'Lore', value: card.lore });
            break;
    }
    
    // Common stats
    if (card.artist) stats.push({ label: 'Artist', value: card.artist });
    if (card.language) stats.push({ label: 'Language', value: card.language });
    
    // Render stats
    stats.forEach(stat => {
        const statDiv = document.createElement('div');
        statDiv.className = 'flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600';
        statDiv.innerHTML = `
            <span class="font-medium text-gray-700 dark:text-gray-300">${stat.label}:</span>
            <span class="text-gray-900 dark:text-gray-100">${stat.value}</span>
        `;
        statsContainer.appendChild(statDiv);
    });
}

function displayRulings(card) {
    const rulingsContainer = document.getElementById('card-rulings');
    rulingsContainer.innerHTML = '';
    
    // Card text/rules
    if (card.rules || card.text || card.oracle_text) {
        const rulesText = card.rules || card.text || card.oracle_text;
        const rulesDiv = document.createElement('div');
        rulesDiv.className = 'bg-gray-50 dark:bg-gray-700 p-4 rounded-lg';
        rulesDiv.innerHTML = `
            <h3 class="font-bold mb-2">Card Text</h3>
            <p class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">${rulesText}</p>
        `;
        rulingsContainer.appendChild(rulesDiv);
    }
    
    // Official rulings
    if (card.rulings && Array.isArray(card.rulings) && card.rulings.length > 0) {
        const rulingsDiv = document.createElement('div');
        rulingsDiv.className = 'bg-blue-50 dark:bg-blue-900 p-4 rounded-lg';
        rulingsDiv.innerHTML = `
            <h3 class="font-bold mb-2">Official Rulings</h3>
            <div class="space-y-2">
                ${card.rulings.map(ruling => `
                    <div class="text-sm">
                        <p class="text-gray-700 dark:text-gray-300">${ruling.comment || ruling.text}</p>
                        ${ruling.date ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${ruling.date}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        rulingsContainer.appendChild(rulingsDiv);
    }
    
    // If no rulings, show placeholder
    if (rulingsContainer.children.length === 0) {
        rulingsContainer.innerHTML = `
            <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                <i class="fas fa-info-circle text-2xl mb-2"></i>
                <p>No additional rulings available for this card.</p>
            </div>
        `;
    }
}

function displayPriceChart(card) {
    const ctx = document.getElementById('price-chart').getContext('2d');
    
    // Generate sample price history data (in a real app, this would come from your database)
    const labels = [];
    const prices = [];
    const currentDate = new Date();
    
    // Generate 30 days of sample data
    for (let i = 29; i >= 0; i--) {
        const date = new Date(currentDate);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString());
        
        // Generate realistic price fluctuation
        let basePrice = 10;
        if (card.variants && card.variants[0] && card.variants[0].prices && card.variants[0].prices[0]) {
            basePrice = parseFloat(card.variants[0].prices[0].market) || 10;
        }
        
        const fluctuation = (Math.random() - 0.5) * 0.2; // ±10% fluctuation
        const price = basePrice * (1 + fluctuation);
        prices.push(Math.max(0.01, price)); // Ensure positive price
    }
    
    if (priceChart) {
        priceChart.destroy();
    }
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Market Price ($)',
                data: prices,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1
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
                },
                x: {
                    display: false
                }
            }
        }
    });
}

async function addToCollection(card, game) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            alert('Please log in to add cards to your collection.');
            return;
        }
        
        const db = firebase.firestore();
        const cardData = {
            cardId: card.id,
            name: card.Name || card.name,
            tcg: game,
            imageUrl: card.images?.[0]?.medium || card.images?.[0]?.large,
            set: card.expansion?.name || card.set_name,
            rarity: card.rarity,
            addedAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: user.uid
        };
        
        await db.collection('collections').doc(user.uid).collection('cards').add(cardData);
        
        // Show success feedback
        const btn = document.getElementById('add-to-collection-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check mr-2"></i>Added!';
        btn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        btn.classList.add('bg-green-500');
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('bg-green-500');
            btn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        }, 2000);
        
    } catch (error) {
        console.error('Error adding card to collection:', error);
        alert('Error adding card to collection. Please try again.');
    }
}

function showError() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('card-content').classList.add('hidden');
    document.getElementById('error-content').classList.remove('hidden');
}

// Sidebar toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (sidebarToggle && sidebar && sidebarOverlay) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('-translate-x-full');
            sidebarOverlay.classList.toggle('hidden');
        });
        
        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.add('-translate-x-full');
            sidebarOverlay.classList.add('hidden');
        });
    }
});
