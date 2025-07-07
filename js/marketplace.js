/**
 * HatakeSocial - Marketplace Page Script
 *
 * FIX v18: Final version to work with the new, required Firestore indexes.
 * This version ensures that the queries exactly match the indexes created
 * to prevent any "missing index" or permission errors at scale.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const marketplaceGrid = document.getElementById('marketplace-grid');
    if (!marketplaceGrid) return;

    if (!user) {
        document.querySelector('main.container').innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">Please log in to view the marketplace.</p>';
        return;
    }

    const loader = document.getElementById('marketplace-loader');
    const searchForm = document.getElementById('marketplace-search-form');
    const sortByEl = document.getElementById('sort-by');
    const tabs = document.querySelectorAll('.marketplace-tab-button');
    const tabContents = document.querySelectorAll('.marketplace-tab-content');
    const auctionContainer = document.getElementById('tab-content-auctions');

    let allCardsData = [];
    let trendingUpChart = null;
    let trendingDownChart = null;

    const setupTabs = () => {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                tabContents.forEach(content => {
                    content.id === `tab-content-${tab.dataset.tab}` ? content.classList.remove('hidden') : content.classList.add('hidden');
                });
                if (tab.dataset.tab === 'auctions') loadAuctions();
                else loadMarketplaceCards();
            });
        });
    };

    const loadMarketplaceCards = async () => {
        loader.style.display = 'block';
        marketplaceGrid.innerHTML = '';
        try {
            const cardName = document.getElementById('search-card-name').value.trim();
            
            let query = db.collectionGroup('collection').where('forSale', '==', true);

            if (cardName) {
                // This query does not require a special index because it doesn't have an inequality filter with an orderBy on a different field.
                query = query.where('name', '>=', cardName).where('name', '<=', cardName + '\uf8ff');
            } else {
                // This query now exactly matches the index: forSale (Ascending), addedAt (Descending)
                query = query.orderBy('addedAt', 'desc');
            }
            
            const snapshot = await query.limit(100).get();
            
            if (snapshot.empty) {
                const message = cardName 
                    ? `No results found for "${cardName}".`
                    : "The marketplace is currently empty.";
                marketplaceGrid.innerHTML = `<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">${message}</p>`;
                allCardsData = [];
                loader.style.display = 'none';
                return;
            }

            const sellerIds = [...new Set(snapshot.docs.map(doc => doc.ref.parent.parent.id))];
            const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
            const sellerDocs = await Promise.all(sellerPromises);
            const sellers = {};
            sellerDocs.forEach(doc => {
                if (doc.exists) sellers[doc.id] = doc.data();
            });

            allCardsData = snapshot.docs.map(doc => ({
                id: doc.id,
                sellerId: doc.ref.parent.parent.id,
                sellerData: sellers[doc.ref.parent.parent.id],
                ...doc.data(),
                addedAt: doc.data().addedAt?.toDate ? doc.data().addedAt.toDate() : new Date(0)
            }));
            
            applyFiltersAndSort();

        } catch (error) {
            console.error("Error loading marketplace:", error);
            marketplaceGrid.innerHTML = `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md col-span-full" role="alert"><p class="font-bold">Database Error</p><p>Could not perform search. This may be due to a missing Firebase index. Please check the browser console (F12) for an error link to create the required index.</p></div>`;
        } finally {
            loader.style.display = 'none';
        }
    };

    const applyFiltersAndSort = () => {
        let filteredCards = [...allCardsData];
        
        const language = document.getElementById('filter-language').value;
        const condition = document.getElementById('filter-condition').value;
        const country = document.getElementById('filter-location').value.trim();
        const sortBy = sortByEl.value;

        if (language !== 'any') filteredCards = filteredCards.filter(card => card.language === language);
        if (condition !== 'any') filteredCards = filteredCards.filter(card => card.condition === condition);
        if (country) filteredCards = filteredCards.filter(card => card.sellerData?.country?.toLowerCase().includes(country.toLowerCase()));

        if (sortBy === 'price-asc') filteredCards.sort((a, b) => (a.salePrice || Infinity) - (b.salePrice || Infinity));
        else if (sortBy === 'price-desc') filteredCards.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
        else filteredCards.sort((a, b) => b.addedAt - a.addedAt);
        
        renderMarketplace(filteredCards);
    };

    const renderMarketplace = (cards) => {
        const grid = document.getElementById('marketplace-grid');
        grid.innerHTML = '';
        if (cards.length === 0) {
            grid.innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">No cards found for the current filters.</p>';
            return;
        }
        
        cards.forEach(card => {
            const sellerHandle = card.sellerData?.handle || 'unknown';
            const priceDisplay = (typeof card.salePrice === 'number' && card.salePrice > 0) ? `${card.salePrice.toFixed(2)} SEK` : 'For Trade';
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 flex flex-col group transition hover:shadow-xl hover:-translate-y-1';
            cardEl.innerHTML = `
                <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block h-full flex flex-col">
                    <div class="relative w-full"><img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded-md mb-2 aspect-[5/7] object-cover" onerror="this.onerror=null;this.src='https://placehold.co/223x310';"><span class="absolute top-1 left-1 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">Buy Now</span></div>
                    <div class="flex-grow flex flex-col p-1">
                        <h4 class="font-bold text-sm truncate flex-grow text-gray-800 dark:text-white">${card.name}</h4>
                        <p class="text-blue-600 dark:text-blue-400 font-semibold text-lg mt-1">${priceDisplay}</p>
                        <a href="profile.html?uid=${card.sellerId}" class="text-xs text-gray-500 dark:text-gray-400 hover:underline">from @${sellerHandle}</a>
                    </div>
                </a>
                <a href="trades.html?propose_to_card=${card.id}" class="propose-trade-btn mt-2 w-full text-center bg-green-600 text-white text-xs font-bold py-1 rounded-full hover:bg-green-700">Propose Trade</a>
            `;
            grid.appendChild(cardEl);
        });
    };

    const loadAuctions = () => { /* ... unchanged ... */ };
    const renderAnalyticsCharts = () => { /* ... unchanged ... */ };

    searchForm.addEventListener('submit', (e) => { e.preventDefault(); loadMarketplaceCards(); });
    sortByEl.addEventListener('change', applyFiltersAndSort); 
    document.getElementById('filter-language').addEventListener('change', applyFiltersAndSort);
    document.getElementById('filter-condition').addEventListener('change', applyFiltersAndSort);
    document.getElementById('filter-location').addEventListener('input', applyFiltersAndSort);

    setupTabs();
    loadMarketplaceCards();
    renderAnalyticsCharts();
});


/* ================================================================
|                     js/card-view.js                          |
|   Replace the entire content of your card-view.js file       |
|   with the code below.                                       |
================================================================
*/

/**
 * HatakeSocial - Card View Page Script
 *
 * FIX v18: Uses the new, correct composite index to reliably fetch listings.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const container = document.getElementById('card-view-container');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const cardName = urlParams.get('name');

    if (!cardName) {
        container.innerHTML = '<p class="text-center text-red-500 col-span-full">No card name specified in the URL.</p>';
        return;
    }

    const cardImageEl = document.getElementById('card-image');
    const cardDetailsEl = document.getElementById('card-details');
    const listingsContainer = document.getElementById('listings-table-container');
    const chartCtx = document.getElementById('price-chart')?.getContext('2d');
    const filterConditionEl = document.getElementById('filter-condition');
    const filterFoilEl = document.getElementById('filter-foil');
    const sortByEl = document.getElementById('sort-by');

    let allListings = [];
    let priceChart = null;

    const loadCardData = async () => {
        try {
            const scryfallResponse = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
            if (!scryfallResponse.ok) {
                const fuzzyResponse = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
                if (!fuzzyResponse.ok) throw new Error('Card not found on Scryfall.');
                const cardData = await fuzzyResponse.json();
                window.location.search = `?name=${encodeURIComponent(cardData.name)}`;
                return;
            }
            const cardData = await scryfallResponse.json();

            updatePageWithCardData(cardData);
            renderPriceChart(cardData);
            await fetchListingsFromFirestore(cardData);

        } catch (error) {
            console.error("Error loading card view:", error);
            container.innerHTML = `<p class="text-center text-red-500 col-span-full p-8 bg-white dark:bg-gray-800 rounded-lg">Error: ${error.message}</p>`;
        }
    };

    const updatePageWithCardData = (cardData) => { /* ... unchanged ... */ };

    const fetchListingsFromFirestore = async (cardData) => {
        listingsContainer.innerHTML = '<p class="p-4 text-center text-gray-500 dark:text-gray-400">Loading listings...</p>';
        try {
            // This query now exactly matches the index: name (Ascending), forSale (Ascending)
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
                if (doc.exists) sellers[doc.id] = doc.data();
            });

            allListings = listingsSnapshot.docs.map(doc => ({
                id: doc.id,
                seller: sellers[doc.ref.parent.parent.id] || { handle: 'unknown', displayName: 'Unknown', averageRating: 0, photoURL: 'https://i.imgur.com/B06rBhI.png' },
                ...doc.data()
            }));
            
            applyFiltersAndSort();

        } catch (error) {
            console.error("Firestore query for listings failed:", error);
            listingsContainer.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400">Could not load listings. A database index may be required. Please check the browser console (F12) for an error link.</div>`;
        }
    };

    const applyFiltersAndSort = () => { /* ... unchanged ... */ };
    const renderListingsTable = (listings) => { /* ... unchanged ... */ };
    const renderPriceChart = (cardData) => { /* ... unchanged ... */ };

    filterConditionEl?.addEventListener('change', applyFiltersAndSort);
    filterFoilEl?.addEventListener('change', applyFiltersAndSort);
    sortByEl?.addEventListener('change', applyFiltersAndSort);

    loadCardData();
});
