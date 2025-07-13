/**
 * HatakeSocial - Card View Page Script (v6 - Internal Pricing)
 *
 * This script is a complete, working version for the card-view.html page.
 * - All pricing logic is now based on the internal HatakePriceGuide.
 * - Displays all prices in the user's selected currency.
 * - Shows seller's location and estimated shipping costs for each listing.
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
    let allListings = [];
    let priceChart = null;

    // --- NEW: Helper function to determine shipping region ---
    const getShippingRegion = (sellerCountry, buyerCountry) => {
        const europeanCountries = ["Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden", "United Kingdom"];
        
        if (!buyerCountry || !sellerCountry) return 'restOfWorld';
        if (sellerCountry.toLowerCase() === buyerCountry.toLowerCase()) return 'domestic';
        if (europeanCountries.includes(sellerCountry) && europeanCountries.includes(buyerCountry)) return 'europe';
        if (buyerCountry === "United States" || buyerCountry === "Canada") return 'northAmerica';
        
        return 'restOfWorld';
    };

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
            await fetchListingsFromFirestore(cardData);

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
     * @param {object} cardData - The full card object from Scryfall.
     */
    const fetchListingsFromFirestore = async (cardData) => {
        listingsContainer.innerHTML = '<p class="p-4 text-center text-gray-500 dark:text-gray-400">Loading listings...</p>';
        
        try {
            const listingsQuery = db.collectionGroup('collection')
                .where('name', '==', cardData.name)
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
                    seller: sellers[sellerId] || { handle: 'unknown', displayName: 'Unknown', photoURL: 'https://i.imgur.com/B06rBhI.png', primaryCurrency: 'SEK', shippingProfile: {} },
                    ...doc.data()
                };
            });
            
            applyFiltersAndSort();

        } catch (error) {
            console.error("Firestore query for listings failed:", error);
            listingsContainer.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400">Could not load listings. A database index may be required. Please check the browser console (F12) for an error link.</div>`;
        }
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
            const getOverallRating = (seller) => ((seller.averageAccuracy || 0) + (seller.averagePackaging || 0)) / 2;
            filteredListings.sort((a, b) => getOverallRating(b.seller) - getOverallRating(a.seller));
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
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Price + Ship</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        `;
        
        const buyerData = window.HatakeSocial.currentUserData;

        listings.forEach(listing => {
            const seller = listing.seller;
            const overallRating = (((seller.averageAccuracy || 0) + (seller.averagePackaging || 0)) / 2).toFixed(1);
            const sellerCurrency = seller.primaryCurrency || 'SEK';
            const priceDisplay = window.HatakeSocial.convertAndFormatPrice(listing.salePrice, sellerCurrency);

            // Calculate shipping
            const shippingRegion = getShippingRegion(seller.country, buyerData?.country);
            const shippingCost = seller.shippingProfile?.[shippingRegion] || null;
            const shippingDisplay = shippingCost !== null 
                ? `+ ${window.HatakeSocial.convertAndFormatPrice(shippingCost, sellerCurrency)} ship`
                : '(Shipping not set)';

            tableHTML += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="flex-shrink-0 h-10 w-10">
                                <img class="h-10 w-10 rounded-full object-cover" src="${seller.photoURL}" alt="${seller.displayName}">
                            </div>
                            <div class="ml-4">
                                <a href="profile.html?uid=${listing.sellerId}" class="text-sm font-medium text-gray-900 dark:text-white hover:underline">${seller.displayName}</a>
                                <div class="text-xs text-gray-500 dark:text-gray-400">★ ${overallRating} | from ${seller.city || 'N/A'}, ${seller.country || 'N/A'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        ${listing.condition} ${listing.isFoil ? '<span class="text-blue-500 font-bold">(Foil)</span>' : ''}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <p class="font-semibold text-gray-900 dark:text-white">${priceDisplay}</p>
                        <p class="text-gray-500 dark:text-gray-400 text-xs">${shippingDisplay}</p>
                    </td>
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
     * Renders a simplified price display using the internal price guide.
     * @param {object} cardData - The card object from Scryfall.
     */
    const renderPriceChart = (cardData) => {
        if (!chartCtx) return;
        if (priceChart) {
            priceChart.destroy(); // Destroy old chart instance
        }

        const priceData = window.HatakePriceGuide[cardData.id];
        const priceUSD = priceData?.paper?.cardmarket?.retail?.normal || 0;
        
        if (priceUSD === 0) {
            chartCtx.canvas.parentNode.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 flex items-center justify-center h-full">Price data is not available for this card.</p>';
            return;
        }
        
        const convertedPrice = window.HatakeSocial.convertAndFormatPrice(priceUSD, 'USD');

        chartCtx.canvas.parentNode.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full">
                <p class="text-gray-500 dark:text-gray-400">Current Market Price</p>
                <p class="text-4xl font-bold text-blue-600 dark:text-blue-400">${convertedPrice}</p>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">Based on HatakeSocial Price Guide</p>
            </div>
        `;
    };

    // --- Event Listeners for Controls ---
    filterConditionEl?.addEventListener('change', applyFiltersAndSort);
    filterFoilEl?.addEventListener('change', applyFiltersAndSort);
    sortByEl?.addEventListener('change', applyFiltersAndSort);

    // --- Initial Load ---
    loadCardData();
});
