/**
 * HatakeSocial - Card View Page Script (v10 - Definitive Fix)
 *
 * This script is a complete, working version for the card-view.html page.
 * - FIX: The main data source is now the 'marketplaceListings' collection in Firestore, preventing incorrect API calls.
 * - - FIX: The script now identifies the card's game (MTG or Pokémon) from the Firestore document.
 * - - FIX: 'updatePageWithCardData' is now game-aware. It will display relevant details for Pokémon (HP, types, abilities, attacks) and MTG (mana cost, oracle text).
 * - - FIX: The card image is now correctly sourced from the nested card data within the Firestore listing, fixing the missing image for Pokémon.
 * - - FIX: The logic to find similar listings is corrected to find all versions of a card by its unique API ID, not just by name.
 */

// Import currency module for price conversion
import * as Currency from './modules/currency.js';

document.addEventListener('DOMContentLoaded', (e) => {
    const user = e.detail.user;
    const container = document.getElementById('card-view-container');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const listingId = urlParams.get('id');

    if (!listingId) {
        container.innerHTML = '<p class="text-center text-red-500 col-span-full">No marketplace listing ID specified in the URL.</p>';
        return;
    }

    // Initialize Firebase
    const db = firebase.firestore();

    // Initialize currency system with SEK as default (Hatake website preference)
    Currency.initCurrency('SEK');

    // --- DOM Elements ---
    const cardImageEl = document.getElementById('card-image');
    const cardDetailsEl = document.getElementById('card-details');
    const listingsContainer = document.getElementById('listings-table-container');
    const chartCtx = document.getElementById('price-chart').getContext('2d');
    const filterControls = document.getElementById('filter-controls');

    // --- State ---
    let allListings = [];
    let priceChart = null;

    // --- Helper Functions ---
    const getCardImageUrl = (cardData, size = 'large') => {
        if (cardData?.customImageUrl) return cardData.customImageUrl;
        // This logic has been standardized by our utils.js file for both games
        if (cardData?.image_uris) return cardData.image_uris[size] || cardData.image_uris.normal;
        // Fallback for any legacy change
        if (cardData?.images) return cardData.images[size] || cardData.images.large;
        return 'https://placehold.co/370x516/cccccc/969696?text=No+Image';
    };

    // Updated formatPrice function to use currency conversion
    const formatPrice = (price, isFromApi = false) => {
        const numericPrice = parseFloat(price);
        if (isNaN(numericPrice)) return 'N/A';
        
        // If price is from external API (like Scryfall), it's in USD
        if (isFromApi) {
            return Currency.convertAndFormat(numericPrice);
        } else {
            // If price is from marketplace listings, it's in SEK
            return Currency.convertFromSekAndFormat(numericPrice);
        }
    };

    const getShippingRegion = (sellerCountry, buyerCountry) => {
        const europeanCountries = ["Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"];
        const northAmericaCountries = ["United States", "Canada", "Mexico"];
        
        if (sellerCountry || buyerCountry) return 'restOfWorld';
        if (sellerCountry.toLowerCase() === buyerCountry.toLowerCase()) return 'domestic';
        if (europeanCountries.includes(sellerCountry) && europeanCountries.includes(buyerCountry)) return 'europe';
        if (northAmericaCountries.includes(sellerCountry) && northAmericaCountries.includes(buyerCountry)) return 'northAmerica';
        return 'restOfWorld';
    };

    /**
     * Main function to load all data, starting from the Firestore listing.
     */
    const loadCardData = async () => {
        try {
            const listingDoc = await db.collection('marketplaceListings').doc(listingId).get();
            if (!listingDoc.exists) throw new Error('This marketplace listing does not exist.');

            const listingData = listingDoc.data();
            const cardData = listingData.cardData;

            updatePageWithCardData(cardData);
            renderPriceChart(cardData);
            // Fetch other listings using the unique API ID for accuracy
            await fetchAllListingsForCard(cardData.api_id);

        } catch (error) {
            console.error("Error loading card view:", error);
            container.innerHTML = `<p class="text-center text-red-500 col-span-full p-8 bg-white dark:bg-gray-800 rounded-lg">Error: ${error.message}</p>`;
        }
    };

    /**
     * Updates the page with card details, now aware of both MTG and Pokémon data structures.
     */
    const updatePageWithCardData = (cardData) => {
        document.title = `${cardData.name} - HatakeSocial`;
        cardImageEl.src = getCardImageUrl(cardData, 'large');
        cardImageEl.alt = cardData.name;
        let detailsHTML = '';

        if (cardData.game === 'mtg') {
            const detailsSource = (cardData.card_faces && cardData.card_faces[0]) ? cardData.card_faces[0] : cardData;
            const manaCost = detailsSource.mana_cost || '';
            const typeLine = detailsSource.type_line || cardData.type_line || '';
            const oracleText = detailsSource.oracle_text || '';
            const power = detailsSource.power || null;
            const toughness = detailsSource.toughness || null;
            detailsHTML = `
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white">${cardData.name}</h1>
                <p class="text-lg text-gray-800 dark:text-gray-200">${manaCost}</p>
                <p class="text-lg text-gray-800 dark:text-gray-200">${typeLine}</p>
                <div class="text-md text-gray-700 dark:text-gray-300">${oracleText.replace(/\n/g, '<br>')}</div>
                ${power ? `<p class="text-lg font-bold text-gray-900 dark:text-white">${power} / ${toughness}</p>` : ''}`;
        } else if (cardData.game === 'pokemon') {
            const hp = cardData.hp || '';
            const types = cardData.types?.join(', ') || '';
            detailsHTML = `
                <div class="flex justify-between items-start">
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">${cardData.name}</h1>
                    ${hp ? `<span class="text-lg font-bold text-red-600 dark:text-red-400">HP ${hp}</span>` : ''}
                </div>
                ${types ? `<p class="text-md text-gray-700 dark:text-gray-300">Types: ${types}</p>` : ''}`;

            // Add abilities if they exist
            if (cardData.abilities && cardData.abilities.length > 0) {
                detailsHTML += '<div class="mt-4"><h3 class="text-lg font-semibold text-gray-900 dark:text-white">Abilities</h3>';
                cardData.abilities.forEach(ability => {
                    detailsHTML += `<div class="mt-2"><strong>${ability.name}:</strong> ${ability.text}</div>`;
                });
                detailsHTML += '</div>';
            }

            // Add attacks if they exist
            if (cardData.attacks && cardData.attacks.length > 0) {
                detailsHTML += '<div class="mt-4"><h3 class="text-lg font-semibold text-gray-900 dark:text-white">Attacks</h3>';
                cardData.attacks.forEach(attack => {
                    const cost = attack.cost ? attack.cost.join(', ') : '';
                    const damage = attack.damage || '';
                    detailsHTML += `<div class="mt-2"><strong>${attack.name}</strong> ${cost ? `[${cost}]` : ''} ${damage ? `- ${damage}` : ''}<br>${attack.text || ''}</div>`;
                });
                detailsHTML += '</div>';
            }
        }

        cardDetailsEl.innerHTML = detailsHTML;
    };

    /**
     * Renders the price chart using Chart.js
     */
    const renderPriceChart = (cardData) => {
        // Sample price data - in a real implementation, this would come from historical data
        const priceData = [
            { date: '2024-01-01', price: 25.99 },
            { date: '2024-02-01', price: 27.50 },
            { date: '2024-03-01', price: 24.99 },
            { date: '2024-04-01', price: 26.75 },
            { date: '2024-05-01', price: 28.99 }
        ];

        const labels = priceData.map(data => data.date);
        // Convert USD prices from API data to user's currency
        const prices = priceData.map(data => parseFloat(Currency.convertAndFormat(data.price).replace(/[^0-9.-]+/g, "")));

        if (priceChart) {
            priceChart.destroy();
        }

        priceChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${cardData.name} Price History`,
                    data: prices,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Price History'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return Currency.formatPrice(value, Currency.getUserCurrency());
                            }
                        }
                    }
                }
            }
        });
    };

    /**
     * Fetches all listings for the same card using the API ID
     */
    const fetchAllListingsForCard = async (apiId) => {
        try {
            const querySnapshot = await db.collection('marketplaceListings')
                .where('cardData.api_id', '==', apiId)
                .orderBy('price')
                .get();

            allListings = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            renderListingsTable();
        } catch (error) {
            console.error("Error fetching card listings:", error);
            listingsContainer.innerHTML = '<p class="text-center text-red-500">Error loading listings.</p>';
        }
    };

    /**
     * Renders the listings table with currency conversion
     */
    const renderListingsTable = () => {
        if (allListings.length === 0) {
            listingsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">No other listings found for this card.</p>';
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
            // Convert SEK prices from marketplace listings to user's currency
            const displayPrice = Currency.convertFromSekAndFormat(listing.price);
            
            tableHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="px-4 py-2 text-sm text-gray-900 dark:text-white">
                        ${listing.condition} ${listing.isFoil ? '<i class="fas fa-star text-yellow-400 ml-1" title="Foil"></i>' : ''}
                    </td>
                    <td class="px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400">${displayPrice}</td>
                    <td class="px-4 py-2 text-sm text-gray-900 dark:text-white">
                        <a href="/profile.html?uid=${listing.sellerData.uid}" class="hover:underline">
                            ${listing.sellerData.displayName}
                        </a>
                    </td>
                    <td class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">${listing.sellerData.country || 'N/A'}</td>
                    <td class="px-4 py-2">
                        <button onclick="contactSeller('${listing.sellerData.uid}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs">
                            Contact
                        </button>
                    </td>
                </tr>`;
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>`;

        listingsContainer.innerHTML = tableHTML;
    };

    /**
     * Contact seller function
     */
    window.contactSeller = (sellerUid) => {
        // Implement contact seller functionality
        console.log('Contacting seller:', sellerUid);
        // This could open a modal, redirect to messages, etc.
    };

    // Initialize the page
    loadCardData();
});

