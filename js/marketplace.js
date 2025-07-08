/**
 * HatakeSocial - Marketplace Page Script (v23 - Internationalization)
 *
 * NEW: Uses the global currency conversion function to display all prices.
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

    let lastVisible = null;
    const PAGE_SIZE = 24;
    let hasMore = true;
    let allCardsData = [];
    let isInitialLoad = true;

    const setupTabs = () => {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                tabContents.forEach(content => {
                    content.id === `tab-content-${tab.dataset.tab}` ? 
                        content.classList.remove('hidden') : 
                        content.classList.add('hidden');
                });
                if (tab.dataset.tab === 'buy-now') resetAndLoadCards();
            });
        });
    };

    const resetAndLoadCards = () => {
        lastVisible = null;
        hasMore = true;
        allCardsData = [];
        marketplaceGrid.innerHTML = '';
        const loadMoreBtn = document.querySelector('.load-more-button');
        if (loadMoreBtn) loadMoreBtn.remove();
        loadMarketplaceCards();
    };

    const loadMarketplaceCards = async () => {
        if (!hasMore) return;
        
        loader.style.display = 'block';
        
        try {
            let query = db.collectionGroup('collection')
                .where('forSale', '==', true)
                .orderBy('addedAt', 'desc')
                .limit(PAGE_SIZE);

            if (lastVisible) {
                query = query.startAfter(lastVisible);
            }

            const snapshot = await query.get();
            
            if (snapshot.empty) {
                if (isInitialLoad) {
                    marketplaceGrid.innerHTML = `<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">The marketplace is currently empty.</p>`;
                }
                hasMore = false;
                loader.style.display = 'none';
                isInitialLoad = false;
                return;
            }

            lastVisible = snapshot.docs[snapshot.docs.length - 1];
            
            const sellerIds = [...new Set(snapshot.docs.map(doc => doc.ref.parent.parent.id))];
            const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
            const sellerDocs = await Promise.all(sellerPromises);
            
            const sellers = {};
            sellerDocs.forEach(doc => {
                if (doc.exists) sellers[doc.id] = doc.data();
            });

            const newCards = snapshot.docs.map(doc => {
                const sellerId = doc.ref.parent.parent.id;
                return {
                    id: doc.id,
                    sellerId: sellerId,
                    sellerData: sellers[sellerId] || null,
                    ...doc.data(),
                    addedAt: doc.data().addedAt?.toDate ? doc.data().addedAt.toDate() : new Date(0)
                };
            });

            allCardsData = [...allCardsData, ...newCards];
            
            applyFiltersAndSort();
            isInitialLoad = false;

        } catch (error) {
            console.error("Error loading marketplace:", error);
            marketplaceGrid.innerHTML = `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md col-span-full" role="alert"><p class="font-bold">Database Error</p><p>Could not load marketplace data. A required index may be missing.</p></div>`;
        } finally {
            loader.style.display = 'none';
        }
    };

    const applyFiltersAndSort = () => {
        let filteredCards = [...allCardsData];
        
        const cardName = document.getElementById('search-card-name').value.trim().toLowerCase();
        const language = document.getElementById('filter-language').value;
        const condition = document.getElementById('filter-condition').value;
        const country = document.getElementById('filter-location').value.trim().toLowerCase();
        const sortBy = sortByEl.value;

        if (cardName) filteredCards = filteredCards.filter(c => c.name.toLowerCase().includes(cardName));
        if (language !== 'any') filteredCards = filteredCards.filter(c => c.language === language);
        if (condition !== 'any') filteredCards = filteredCards.filter(c => c.condition === condition);
        if (country) filteredCards = filteredCards.filter(c => c.sellerData?.country?.toLowerCase().includes(country));

        if (sortBy === 'price-asc') {
            filteredCards.sort((a, b) => (a.salePrice || 0) - (b.salePrice || 0));
        } else if (sortBy === 'price-desc') {
            filteredCards.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
        } else {
            filteredCards.sort((a, b) => b.addedAt - a.addedAt);
        }
        
        renderMarketplace(filteredCards);
    };

    const renderMarketplace = (cards) => {
        marketplaceGrid.innerHTML = ''; // Clear the grid before rendering

        if (cards.length === 0 && isInitialLoad) {
            marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">No cards found for the current filters.</p>';
            return;
        }
        
        cards.forEach(card => {
            const sellerHandle = card.sellerData?.handle || 'unknown';
            const sellerCurrency = card.sellerData?.primaryCurrency || 'SEK';
            const priceDisplay = card.salePrice > 0 
                ? window.HatakeSocial.convertAndFormatPrice(card.salePrice, sellerCurrency)
                : 'For Trade';
            
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 flex flex-col group transition hover:shadow-xl hover:-translate-y-1';
            cardEl.innerHTML = `
                <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block h-full flex flex-col">
                    <div class="relative w-full">
                        <img src="${card.imageUrl}" alt="${card.name}" 
                             class="w-full rounded-md mb-2 aspect-[5/7] object-cover" 
                             onerror="this.onerror=null;this.src='https://placehold.co/223x310';">
                    </div>
                    <div class="flex-grow flex flex-col p-1">
                        <h4 class="font-bold text-sm truncate flex-grow text-gray-800 dark:text-white">
                            ${card.name}
                        </h4>
                        <p class="text-blue-600 dark:text-blue-400 font-semibold text-lg mt-1">
                            ${priceDisplay}
                        </p>
                        <a href="profile.html?uid=${card.sellerId}" 
                           class="text-xs text-gray-500 dark:text-gray-400 hover:underline">
                            from @${sellerHandle}
                        </a>
                    </div>
                </a>
                <a href="trades.html?propose_to_card=${card.id}" 
                   class="propose-trade-btn mt-2 w-full text-center bg-green-600 text-white text-xs font-bold py-1 rounded-full hover:bg-green-700">
                    Propose Trade
                </a>
            `;
            marketplaceGrid.appendChild(cardEl);
        });

        const loadMoreBtn = document.querySelector('.load-more-button');
        if (loadMoreBtn) loadMoreBtn.remove();
        
        if (hasMore && cards.length > 0) {
            const newLoadMoreBtn = document.createElement('button');
            newLoadMoreBtn.className = 'load-more-button col-span-full mt-6 px-6 py-3 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 transition';
            newLoadMoreBtn.textContent = 'Load More Cards';
            newLoadMoreBtn.addEventListener('click', loadMarketplaceCards);
            marketplaceGrid.parentElement.insertBefore(newLoadMoreBtn, marketplaceGrid.nextSibling);
        }
    };

    const renderAnalyticsCharts = () => { /* ... (no changes) ... */ };

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        resetAndLoadCards();
    });
    
    sortByEl.addEventListener('change', () => applyFiltersAndSort());
    
    setupTabs();
    loadMarketplaceCards();
    // renderAnalyticsCharts(); // This can be enabled when you have data for it
});
