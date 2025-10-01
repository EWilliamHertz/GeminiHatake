/**
 * HatakeSocial - Multi-Game Card View Page Script
 */

import * as Currency from './modules/currency.js';
import { getCardDetails } from './modules/api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('id');
    const cardName = urlParams.get('name');
    const tcg = urlParams.get('tcg');
    const container = document.getElementById('card-view-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const cardDetailsContainer = document.getElementById('card-details-container');
    const errorContainer = document.getElementById('error-container');

    if (!cardName || !tcg) {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        if (errorContainer) {
            errorContainer.classList.remove('hidden');
            errorContainer.querySelector('p').textContent = 'No card name or TCG specified in the URL.';
        }
        return;
    }

    // Map TCG names to game codes
    const gameMap = {
        'mtg': 'mtg',
        'magic: the gathering': 'mtg',
        'pokemon': 'pokemon',
        'pokémon': 'pokemon',
        'lorcana': 'lorcana',
        'gundam': 'gundam'
    };
    const game = gameMap[tcg.toLowerCase()] || tcg;

    const db = firebase.firestore();
    Currency.initCurrency('SEK');

    // --- DOM Elements ---
    const cardImageEl = document.getElementById('card-image');
    const cardDetailsEl = document.getElementById('card-details');
    const cardRulingsEl = document.getElementById('card-rulings');
    const listingsContainer = document.getElementById('listings-table-container');
    const chartCtx = document.getElementById('price-chart')?.getContext('2d');

    let allListings = [];
    let priceChart = null;

    /**
     * Main function to load all data.
     */
    const loadCardData = async () => {
        try {
            let cardData;
            
            if (cardId) {
                // If we have a card ID, try to get details directly
                cardData = await getCardDetails(cardId, game);
            } else {
                        // Search for the card by name using ScryDex
                        const searchScryDexFunction = firebase.functions().httpsCallable('searchScryDex');
                const result = await searchScryDexFunction({ cardName: cardName, game: game });
                
                let searchResults = [];
                if (result && result.data && Array.isArray(result.data.data)) {
                    searchResults = result.data.data;
                } else if (result && Array.isArray(result.data)) {
                    searchResults = result.data;
                }
                
                // Find exact match or first result
                cardData = searchResults.find(card => 
                    (card.Name || card.name || '').toLowerCase() === cardName.toLowerCase()
                ) || searchResults[0];
                
                if (!cardData) {
                    throw new Error('Card not found in search results.');
                }
            }

            if (!cardData) {
                throw new Error('Card data could not be fetched.');
            }

            updatePageWithCardData(cardData);
            renderRulings(cardData);
            if (chartCtx) {
                renderPriceChart(cardData);
            }
            await fetchAllListingsForCard(cardData.api_id || cardData.id);

        } catch (error) {
            console.error("Error loading card view:", error);
            container.innerHTML = `<p class="text-center text-red-500 col-span-full p-8 bg-white dark:bg-gray-800 rounded-lg">Error: ${error.message}</p>`;
        }
    };

    /**
     * Updates the page with game-specific card details.
     */
    const updatePageWithCardData = (cardData) => {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        if (cardDetailsContainer) cardDetailsContainer.classList.remove('hidden');
        
        const name = cardData.name || cardData.Name || 'Unknown Card';
        document.title = `${name} - HatakeSocial`;
        
        // Update the existing card image if it exists
        if (cardImageEl) {
            const imageUrl = cardData.image_uris?.large || cardData.image_uris?.normal || cardData.images?.[0]?.large || cardData.images?.[0]?.medium || 'https://placehold.co/370x516/cccccc/969696?text=No+Image';
            cardImageEl.src = imageUrl;
            cardImageEl.alt = name;
        }

        let detailsHTML = `<h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">${cardData.name}</h1>`;

        switch (cardData.game) {
            case 'mtg':
                const mtgDetails = cardData.card_faces ? cardData.card_faces[0] : cardData;
                detailsHTML += `
                    <p class="text-lg text-gray-700 dark:text-gray-300">${mtgDetails.mana_cost || ''}</p>
                    <p class="text-md font-semibold text-gray-800 dark:text-gray-200 mt-2">${mtgDetails.type_line || cardData.type_line}</p>
                    <div class="text-sm text-gray-600 dark:text-gray-400 mt-4 prose dark:prose-invert">${(mtgDetails.oracle_text || '').replace(/\n/g, '<br>')}</div>
                    ${mtgDetails.power ? `<p class="text-lg font-bold text-gray-900 dark:text-white mt-4">${mtgDetails.power} / ${mtgDetails.toughness}</p>` : ''}
                    ${mtgDetails.loyalty ? `<p class="text-lg font-bold text-gray-900 dark:text-white mt-4">Loyalty: ${mtgDetails.loyalty}</p>` : ''}`;
                break;
            
            case 'pokemon':
                detailsHTML += `
                    <div class="flex justify-between items-start">
                        <p class="text-md text-gray-700 dark:text-gray-300">Type: ${cardData.types?.join(', ') || 'N/A'}</p>
                        ${cardData.hp ? `<span class="text-lg font-bold text-red-600 dark:text-red-400">HP ${cardData.hp}</span>` : ''}
                    </div>`;
                if (cardData.abilities && cardData.abilities.length > 0) {
                    detailsHTML += '<div class="mt-4"><h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b dark:border-gray-600 pb-1 mb-2">Abilities</h3>';
                    cardData.abilities.forEach(ability => {
                        detailsHTML += `<div class="text-sm mt-2"><strong>${ability.name}:</strong> ${ability.text}</div>`;
                    });
                    detailsHTML += '</div>';
                }
                if (cardData.attacks && cardData.attacks.length > 0) {
                    detailsHTML += '<div class="mt-4"><h3 class="text-lg font-semibold text-gray-900 dark:text-white border-b dark:border-gray-600 pb-1 mb-2">Attacks</h3>';
                    cardData.attacks.forEach(attack => {
                        detailsHTML += `<div class="text-sm mt-2"><strong>${attack.name}</strong> ${attack.cost ? `[${attack.cost.join('')}]` : ''} ${attack.damage ? `- <strong>${attack.damage}</strong>` : ''}<br><span class="italic">${attack.text || ''}</span></div>`;
                    });
                    detailsHTML += '</div>';
                }
                break;

            case 'lorcana':
            case 'gundam':
                detailsHTML += `
                    <p class="text-md font-semibold text-gray-800 dark:text-gray-200 mt-2">${cardData.type || ''}</p>
                    <div class="text-sm text-gray-600 dark:text-gray-400 mt-4">${(cardData.text || '').replace(/\n/g, '<br>')}</div>
                `;
                break;
        }

        cardDetailsEl.innerHTML = detailsHTML;
    };
    
    /**
     * Renders the rulings for the card.
     */
    const renderRulings = (cardData) => {
        const rulingsContent = document.getElementById('rulings-content');
        if (!rulingsContent) return;
        
        if (!cardData.rulings || cardData.rulings.length === 0) {
            rulingsContent.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No rulings available for this card.</p>';
            return;
        }

        let rulingsHTML = '<div class="space-y-4">';
        
        cardData.rulings.forEach(ruling => {
            const publishedDate = ruling.published_at ? new Date(ruling.published_at).toLocaleDateString() : 'Unknown date';
            rulingsHTML += `
                <div class="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-r">
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">${publishedDate}</p>
                    <p class="text-gray-800 dark:text-gray-200">${ruling.comment || ruling.text || 'No ruling text available.'}</p>
                </div>
            `;
        });
        
        rulingsHTML += '</div>';
        rulingsContent.innerHTML = rulingsHTML;
    };

    /**
     * Renders the price chart using historical data.
     */
    const renderPriceChart = (cardData) => {
        // Access the first raw price's trends
        const trends = cardData.prices?.raw?.[0]?.trends;
        if (!trends) {
            console.log("No price trend data available for this card.");
            return;
        }

        const currentPrice = parseFloat(cardData.prices.raw?.[0]?.market || 0);
        if (isNaN(currentPrice)) return;

        const priceDataPoints = [
            { label: '180 days ago', value: trends.days_180?.price_change || 0 },
            { label: '90 days ago', value: trends.days_90?.price_change || 0 },
            { label: '30 days ago', value: trends.days_30?.price_change || 0 },
            { label: '14 days ago', value: trends.days_14?.price_change || 0 },
            { label: '7 days ago', value: trends.days_7?.price_change || 0 },
            { label: 'Yesterday', value: trends.days_1?.price_change || 0 },
            { label: 'Today', value: 0 }
        ].reverse(); // Reverse to show oldest to newest

        const labels = priceDataPoints.map(p => p.label);
        const prices = priceDataPoints.map(p => (currentPrice - p.value).toFixed(2));
        
        if (priceChart) {
            priceChart.destroy();
        }

        priceChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `Price History (USD)`,
                    data: prices,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: false } },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: { callback: (value) => Currency.convertAndFormat(value, 'USD') }
                    }
                }
            }
        });
    };

    /**
     * Fetches all other marketplace listings for the same card.
     */
    const fetchAllListingsForCard = async (apiId) => {
        try {
            const querySnapshot = await db.collection('marketplaceListings')
                .where('cardData.api_id', '==', apiId)
                .orderBy('price')
                .get();

            allListings = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderListingsTable();
        } catch (error) {
            console.error("Error fetching other listings:", error);
            listingsContainer.innerHTML = '<p class="text-center text-red-500">Error loading other listings.</p>';
        }
    };

    /**
     * Renders the table of available marketplace listings.
     */
    const renderListingsTable = () => {
        if (allListings.length === 0) {
            listingsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 py-4">No marketplace listings found for this card.</p>';
            return;
        }

        let tableHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Condition</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Price</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Seller</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Location</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">`;

        allListings.forEach(listing => {
            const displayPrice = Currency.convertFromSekAndFormat(listing.price);
            tableHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="px-4 py-2 text-sm text-gray-900 dark:text-white">
                        ${listing.condition} ${listing.isFoil ? '<i class="fas fa-star text-yellow-400 ml-1" title="Foil"></i>' : ''}
                    </td>
                    <td class="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400">${displayPrice}</td>
                    <td class="px-4 py-2 text-sm text-gray-900 dark:text-white">
                        <a href="/profile.html?uid=${listing.sellerData.uid}" class="hover:underline">${listing.sellerData.displayName}</a>
                    </td>
                    <td class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">${listing.sellerData.country || 'N/A'}</td>
                    <td class="px-4 py-2">
                        <button onclick="contactSeller('${listing.sellerData.uid}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">Contact</button>
                    </td>
                </tr>`;
        });

        tableHTML += `</tbody></table></div>`;
        listingsContainer.innerHTML = tableHTML;
    };

    // Make contactSeller globally accessible
    window.contactSeller = (sellerUid) => {
        window.location.href = `/messages.html?recipient=${sellerUid}`;
    };

    // --- Initialize the Page ---
    loadCardData();
});