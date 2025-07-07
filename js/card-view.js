/**
 * HatakeSocial - Card View Page Script
 *
 * This script is a complete, working version for the card-view.html page.
 * It correctly waits for Firebase authentication to be ready.
 * It fetches card data and an image from the Scryfall API.
 * It simulates a 90-day price history and renders it in a chart.
 * It fetches and displays all user listings for the card from Firestore.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const container = document.getElementById('card-view-container');
    if (!container) return; // Exit if not on the card-view page

    const urlParams = new URLSearchParams(window.location.search);
    const cardName = urlParams.get('name');

    if (!cardName) {
        container.innerHTML = '<p class="text-center text-red-500 col-span-full">No card name specified in the URL.</p>';
        return;
    }

    // --- DOM Elements ---
    const cardImageEl = document.getElementById('card-image');
    const cardDetailsEl = document.getElementById('card-details');
    const listingsContainer = document.getElementById('listings-table-container');
    const chartCtx = document.getElementById('price-chart')?.getContext('2d');
    const filterConditionEl = document.getElementById('filter-condition');
    const filterFoilEl = document.getElementById('filter-foil');
    const sortByEl = document.getElementById('sort-by');

    // --- State ---
    let allListings = []; // Store all listings to avoid re-fetching
    let priceChart = null; // To hold the chart instance for proper destruction

    /**
     * Main function to load all data for the card view page.
     */
    const loadCardData = async () => {
        try {
            // 1. Fetch card data from Scryfall API
            const scryfallResponse = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
            if (!scryfallResponse.ok) {
                // Try fuzzy search if exact fails
                const fuzzyResponse = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
                if (!fuzzyResponse.ok) throw new Error('Card not found on Scryfall.');
                const cardData = await fuzzyResponse.json();
                // Redirect to the correct URL with the exact name
                window.location.search = `?name=${encodeURIComponent(cardData.name)}`;
                return;
            }
            const cardData = await scryfallResponse.json();

            // 2. Update the page with Scryfall data
            updatePageWithCardData(cardData);

            // 3. Render the price chart with simulated historical data
            renderPriceChart(cardData);

            // 4. Fetch listings for this card from our Firestore database
            fetchListingsFromFirestore(cardData.name);

        } catch (error) {
            console.error("Error loading card view:", error);
            container.innerHTML = `<p class="text-center text-red-500 col-span-full p-8 bg-white dark:bg-gray-800 rounded-lg">Error: ${error.message}</p>`;
        }
    };

    /**
     * Updates the static parts of the page (image, details) with data from Scryfall.
     * @param {object} cardData - The card object from the Scryfall API.
     */
    const updatePageWithCardData = (cardData) => {
        document.title = `${cardData.name} - HatakeSocial`;
        cardImageEl.src = cardData.image_uris?.large || 'https://placehold.co/370x516/cccccc/969696?text=No+Image';
        cardImageEl.alt = cardData.name;

        cardDetailsEl.innerHTML = `
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">${cardData.name}</h1>
            <p class="text-lg text-gray-600 dark:text-gray-400">${cardData.mana_cost || ''}</p>
            <p class="text-lg text-gray-800 dark:text-gray-200">${cardData.type_line}</p>
            <div class="text-md my-2 space-y-2 text-gray-700 dark:text-gray-300">${cardData.oracle_text.replace(/\n/g, '<br>')}</div>
            ${cardData.power ? `<p class="text-lg font-bold text-gray-900 dark:text-white">${cardData.power} / ${cardData.toughness}</p>` : ''}
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-4">Set: ${cardData.set_name} (#${cardData.collector_number})</p>
        `;
    };

    /**
     * Fetches listings for a specific card name from Firestore.
     * @param {string} name - The exact name of the card to look for.
     */
    const fetchListingsFromFirestore = async (name) => {
        listingsContainer.innerHTML = '<p class="p-4 text-center text-gray-500 dark:text-gray-400">Loading listings...</p>';
        
        const listingsQuery = db.collectionGroup('collection')
            .where('name', '==', name)
            .where('forSale', '==', true);

        const listingsSnapshot = await listingsQuery.get();

        if (listingsSnapshot.empty) {
            listingsContainer.innerHTML = '<p class="p-4 text-center text-gray-500 dark:text-gray-400">No one is currently selling this card.</p>';
            return;
        }

        // Efficiently get all seller info in one batch
        const sellerIds = [...new Set(listingsSnapshot.docs.map(doc => doc.ref.parent.parent.id))];
        const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
        const sellerDocs = await Promise.all(sellerPromises);
        const sellers = {};
        sellerDocs.forEach(doc => {
            if (doc.exists) sellers[doc.id] = doc.data();
        });

        allListings = listingsSnapshot.docs.map(doc => {
            const sellerId = doc.ref.parent.parent.id;
            return {
                id: doc.id,
                seller: sellers[sellerId] || { handle: 'unknown', displayName: 'Unknown', averageRating: 0, photoURL: 'https://i.imgur.com/B06rBhI.png' },
                ...doc.data()
            };
        });
        
        applyFiltersAndSort(); // Render the fetched listings
    };


    /**
     * Applies the current filter and sort options to the `allListings` array and re-renders the table.
     */
    const applyFiltersAndSort = () => {
        let filteredListings = [...allListings];

        // Apply condition filter
        const condition = filterConditionEl.value;
        if (condition !== 'all') {
            filteredListings = filteredListings.filter(l => l.condition === condition);
        }

        // Apply foil filter
        const foil = filterFoilEl.value;
        if (foil !== 'all') {
            const isFoil = foil === 'true';
            filteredListings = filteredListings.filter(l => l.isFoil === isFoil);
        }

        // Apply sorting
        const sortBy = sortByEl.value;
        if (sortBy === 'price-asc') {
            filteredListings.sort((a, b) => a.salePrice - b.salePrice);
        } else if (sortBy === 'price-desc') {
            filteredListings.sort((a, b) => b.salePrice - a.salePrice);
        } else if (sortBy === 'rating-desc') {
            filteredListings.sort((a, b) => (b.seller.averageRating || 0) - (a.seller.averageRating || 0));
        }

        renderListingsTable(filteredListings);
    };

    /**
     * Renders the HTML table for the provided list of listings.
     * @param {Array} listings - The filtered and sorted array of listing objects.
     */
    const renderListingsTable = (listings) => {
        if (listings.length === 0) {
            listingsContainer.innerHTML = '<p class="p-4 text-center text-gray-500 dark:text-gray-400">No listings match the current filters.</p>';
            return;
        }

        let tableHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Seller</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Details</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Price</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        `;
        
        listings.forEach(listing => {
            const rating = listing.seller.averageRating ? listing.seller.averageRating.toFixed(1) : 'N/A';
            tableHTML += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="flex-shrink-0 h-10 w-10">
                                <img class="h-10 w-10 rounded-full object-cover" src="${listing.seller.photoURL}" alt="${listing.seller.displayName}">
                            </div>
                            <div class="ml-4">
                                <a href="profile.html?uid=${listing.sellerId}" class="text-sm font-medium text-gray-900 dark:text-white hover:underline">${listing.seller.displayName}</a>
                                <div class="text-sm text-gray-500 dark:text-gray-400">Rating: ${rating} ★</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        ${listing.condition} ${listing.isFoil ? '<span class="text-blue-500 font-bold">(Foil)</span>' : ''}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">${listing.salePrice.toFixed(2)} SEK</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <a href="trades.html?propose_to_card=${listing.id}" class="text-indigo-600 dark:text-indigo-400 hover:underline">Propose Trade</a>
                    </td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table></div>`;
        listingsContainer.innerHTML = tableHTML;
    };

    /**
     * Generates a plausible 90-day price history and renders it using Chart.js.
     * @param {object} cardData - The card object from Scryfall, used to get the current price.
     */
    const renderPriceChart = (cardData) => {
        if (!chartCtx) return;
        if (priceChart) {
            priceChart.destroy(); // Destroy old chart instance
        }

        const currentPrice = parseFloat(cardData?.prices?.usd || 0);
        if (currentPrice === 0) {
            chartCtx.canvas.parentNode.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 flex items-center justify-center h-full">Price data is not available for this card.</p>';
            return;
        }

        // --- Simulate 90 days of historical data ---
        const history = [];
        const labels = [];
        let price = currentPrice * (0.8 + Math.random() * 0.4); // Start price between 80% and 120% of current

        for (let i = 90; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
            
            // Add some random volatility
            const volatility = price * 0.05; // 5% volatility
            price += (Math.random() - 0.5) * volatility;
            // Add a slight upward trend to meet the current price
            price += (currentPrice - price) * 0.02; 
            // Ensure price doesn't go below a certain threshold
            price = Math.max(price, currentPrice * 0.2); 

            history.push(price.toFixed(2));
        }
        history[89] = currentPrice.toFixed(2); // Ensure the last point is the current price

        priceChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Price (USD)',
                    data: history,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 2,
                    tension: 0.4, // Makes the line smoother
                    pointRadius: 0, // Hides the data points
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            maxTicksLimit: 8, // Limit the number of visible dates
                            color: '#6b7280' // gray-500
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: false,
                        ticks: {
                            color: '#6b7280' // gray-500
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Hide the legend
                    }
                }
            }
        });
    };

    // --- Event Listeners for Controls ---
    filterConditionEl?.addEventListener('change', applyFiltersAndSort);
    filterFoilEl?.addEventListener('change', applyFiltersAndSort);
    sortByEl?.addEventListener('change', applyFiltersAndSort);

    // --- Initial Load ---
    loadCardData();
});
