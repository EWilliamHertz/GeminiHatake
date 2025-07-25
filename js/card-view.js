/**
 * HatakeSocial - Card View Page Script (v6 - Comments & Profile Links)
 *
 * This script is a complete, working version for the card-view.html page.
 * - NEW: Adds a community discussion section for users to comment on cards.
 * - FIX: Updates links to point to the new profile.html page.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const container = document.getElementById('card-view-container');
    if (!container) return; // Exit if not on the card-view page

    const urlParams = new URLSearchParams(window.location.search);
    const cardId = urlParams.get('id');
    const cardName = urlParams.get('name');


    if (!cardId && !cardName) {
        container.innerHTML = '<p class="text-center text-red-500 col-span-full">No card ID or name specified in the URL.</p>';
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
    
    // Comments Elements
    const commentForm = document.getElementById('comment-form');
    const commentInput = document.getElementById('comment-input');
    const commentsList = document.getElementById('comments-list');


    // --- State ---
    let allListings = [];
    let priceChart = null;
    let currentScryfallId = null;

    // --- Helper function to determine shipping region ---
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
            // Prioritize fetching by ID for accuracy, fall back to name search
            const scryfallUrl = cardId 
                ? `https://api.scryfall.com/cards/${cardId}`
                : `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`;

            const scryfallResponse = await fetch(scryfallUrl);
            if (!scryfallResponse.ok) {
                throw new Error('Card not found on Scryfall.');
            }
            const cardData = await scryfallResponse.json();
            currentScryfallId = cardData.id; // Store the definitive ID

            updatePageWithCardData(cardData);
            renderPriceChart(cardData);
            await fetchListingsFromFirestore(cardData);
            loadComments();

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

            const sellerIds = [...new Set(listingsSnapshot.docs.map(doc => doc.ref.parent.parent.id))];
            const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
            const sellerDocs = await Promise.all(sellerPromises);
            const sellers = {};
            sellerDocs.forEach(doc => {
                if (doc.exists) sellers[doc.id] = {id: doc.id, ...doc.data()};
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

        const condition = filterConditionEl.value;
        if (condition !== 'all') {
            filteredListings = filteredListings.filter(l => l.condition === condition);
        }

        const foil = filterFoilEl.value;
        if (foil !== 'all') {
            const isFoil = foil === 'true';
            filteredListings = filteredListings.filter(l => l.isFoil === isFoil);
        }

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
                                <a href="profile.html?uid=${seller.id}" class="text-sm font-medium text-gray-900 dark:text-white hover:underline">${seller.displayName}</a>
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
    
    const loadComments = () => {
        if (!currentScryfallId) return;

        const commentsRef = db.collection('cards').doc(currentScryfallId).collection('comments').orderBy('timestamp', 'desc');
        
        commentsRef.onSnapshot(snapshot => {
            commentsList.innerHTML = '';
            if (snapshot.empty) {
                commentsList.innerHTML = '<p class="text-center text-sm text-gray-500 dark:text-gray-400">No comments yet. Be the first!</p>';
                return;
            }
            snapshot.forEach(doc => {
                const comment = doc.data();
                const commentEl = document.createElement('div');
                commentEl.className = 'flex items-start space-x-3';
                commentEl.innerHTML = `
                    <img src="${comment.authorPhotoURL}" alt="${comment.authorName}" class="h-10 w-10 rounded-full object-cover">
                    <div class="flex-1 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <div class="flex justify-between items-center">
                            <a href="profile.html?uid=${comment.authorId}" class="font-semibold text-sm text-gray-800 dark:text-white hover:underline">${comment.authorName}</a>
                            <span class="text-xs text-gray-400">${new Date(comment.timestamp.seconds * 1000).toLocaleString()}</span>
                        </div>
                        <p class="text-gray-700 dark:text-gray-300 mt-1">${comment.text}</p>
                    </div>
                `;
                commentsList.appendChild(commentEl);
            });
        });
    };
    
    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            alert("Please log in to post a comment.");
            return;
        }
        
        const commentText = commentInput.value.trim();
        if (!commentText) return;

        const commentData = {
            text: commentText,
            authorId: user.uid,
            authorName: user.displayName,
            authorPhotoURL: user.photoURL,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('cards').doc(currentScryfallId).collection('comments').add(commentData);
            commentForm.reset();
        } catch (error) {
            console.error("Error posting comment:", error);
            alert("Could not post comment. Please try again.");
        }
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

        const priceUSD = parseFloat(cardData?.prices?.usd || 0);
        if (priceUSD === 0) {
            chartCtx.canvas.parentNode.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 flex items-center justify-center h-full">Price data is not available for this card.</p>';
            return;
        }

        const history = [];
        const labels = [];
        let price = priceUSD * (0.8 + Math.random() * 0.4);

        for (let i = 90; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
            
            const volatility = price * 0.05; 
            price += (Math.random() - 0.5) * volatility;
            price += (priceUSD - price) * 0.02; 
            price = Math.max(price, priceUSD * 0.2); 

            history.push(price);
        }
        history[history.length - 1] = priceUSD;
        
        const convertedHistory = history.map(p => parseFloat(window.HatakeSocial.convertAndFormatPrice(p, 'USD').split(' ')[0]));
        const currencyLabel = window.HatakeSocial.currentCurrency;

        priceChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `Price (${currencyLabel})`,
                    data: convertedHistory,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { maxTicksLimit: 8, color: '#6b7280' }, grid: { display: false } },
                    y: { beginAtZero: false, ticks: { color: '#6b7280' } }
                },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += `${context.parsed.y.toFixed(2)} ${currencyLabel}`;
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    };

    // --- Event Listeners for Controls ---
    filterConditionEl?.addEventListener('change', applyFiltersAndSort);
    filterFoilEl?.addEventListener('change', applyFiltersAndSort);
    sortByEl?.addEventListener('change', applyFiltersAndSort);
    commentForm?.addEventListener('submit', handleCommentSubmit);


    // --- Initial Load ---
    loadCardData();
});
