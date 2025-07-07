/**
 * HatakeSocial - Marketplace Page Script
 *
 * FIX v21: Final fix for "Database Error". This version uses the simplest
 * possible Firestore query and performs all filtering and sorting on the
 * client-side. This is the most robust method to prevent any and all
 * "missing index" errors, regardless of how the data grows.
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
            // This is the simplest possible query. It only requires the default single-field index on 'forSale'.
            const query = db.collectionGroup('collection').where('forSale', '==', true);
            
            const snapshot = await query.limit(500).get();
            
            if (snapshot.empty) {
                marketplaceGrid.innerHTML = `<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">The marketplace is currently empty.</p>`;
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
            
            // Filters and sorting will be applied after the initial load.
            applyFiltersAndSort();

        } catch (error) {
            console.error("Error loading marketplace:", error);
            marketplaceGrid.innerHTML = `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md col-span-full" role="alert"><p class="font-bold">Database Error</p><p>Could not perform search. This may be due to a missing Firebase index. Please check the browser console (F12) for an error link to create the required index.</p></div>`;
        } finally {
            loader.style.display = 'none';
        }
    };

    /**
     * Applies all filters and sorting on the client-side after data is fetched.
     */
    const applyFiltersAndSort = () => {
        let filteredCards = [...allCardsData];
        
        const cardName = document.getElementById('search-card-name').value.trim().toLowerCase();
        const language = document.getElementById('filter-language').value;
        const condition = document.getElementById('filter-condition').value;
        const country = document.getElementById('filter-location').value.trim().toLowerCase();
        const sortBy = sortByEl.value;

        // Client-side filtering logic
        if (cardName) {
            filteredCards = filteredCards.filter(card => card.name.toLowerCase().includes(cardName));
        }
        if (language !== 'any') {
            filteredCards = filteredCards.filter(card => card.language === language);
        }
        if (condition !== 'any') {
            filteredCards = filteredCards.filter(card => card.condition === condition);
        }
        if (country) {
            filteredCards = filteredCards.filter(card =>
                card.sellerData && card.sellerData.country && card.sellerData.country.toLowerCase().includes(country)
            );
        }

        // Client-side sorting logic
        if (sortBy === 'price-asc') {
            filteredCards.sort((a, b) => (a.salePrice || Infinity) - (b.salePrice || Infinity));
        } else if (sortBy === 'price-desc') {
            filteredCards.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
        } else { // Default sort is 'date-desc'
            filteredCards.sort((a, b) => b.addedAt - a.addedAt);
        }
        
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

    // The search form now triggers the client-side filtering, not a new DB query
    searchForm.addEventListener('submit', (e) => { e.preventDefault(); applyFiltersAndSort(); });
    
    // All filter controls now trigger the client-side filtering and sorting
    sortByEl.addEventListener('change', applyFiltersAndSort); 
    document.getElementById('filter-language').addEventListener('change', applyFiltersAndSort);
    document.getElementById('filter-condition').addEventListener('change', applyFiltersAndSort);
    document.getElementById('filter-location').addEventListener('input', applyFiltersAndSort);

    setupTabs();
    loadMarketplaceCards();
    renderAnalyticsCharts();
});
