/**
 * HatakeSocial - Marketplace Page Script (v13 - Auctions & Analytics)
 *
 * This version adds the UI logic for the new auction and analytics features.
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

                if (tab.dataset.tab === 'auctions') {
                    loadAuctions();
                } else {
                    loadMarketplaceCards();
                }
            });
        });
    };

    const loadMarketplaceCards = async () => {
        loader.style.display = 'block';
        marketplaceGrid.innerHTML = '';
        try {
            const cardName = document.getElementById('search-card-name').value.trim();
            const language = document.getElementById('filter-language').value;
            const condition = document.getElementById('filter-condition').value;
            const country = document.getElementById('filter-location').value.trim();
            let query = db.collectionGroup('collection').where('forSale', '==', true);
            if (cardName) query = query.where('name', '>=', cardName).where('name', '<=', cardName + '\uf8ff');
            if (language !== 'any') query = query.where('language', '==', language);
            if (condition !== 'any') query = query.where('condition', '==', condition);
            const snapshot = await query.limit(200).get();
            if (snapshot.empty) {
                marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">No cards match your search criteria.</p>';
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
            if (country) {
                allCardsData = allCardsData.filter(card =>
                    card.sellerData && card.sellerData.country && card.sellerData.country.toLowerCase().includes(country.toLowerCase())
                );
            }
            sortAndRender();
        } catch (error) {
            console.error("Error loading marketplace:", error);
            marketplaceGrid.innerHTML = `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md col-span-full" role="alert"><p class="font-bold">Database Error</p><p>Could not perform search. This may be due to a missing Firebase index.</p></div>`;
        } finally {
            loader.style.display = 'none';
        }
    };

    const sortAndRender = () => {
        const sortBy = sortByEl.value;
        let sortedCards = [...allCardsData];
        switch (sortBy) {
            case 'price-asc': sortedCards.sort((a, b) => (a.salePrice || Infinity) - (b.salePrice || Infinity)); break;
            case 'price-desc': sortedCards.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0)); break;
            case 'date-desc': default: sortedCards.sort((a, b) => b.addedAt - a.addedAt); break;
        }
        renderMarketplace(sortedCards);
    };

    const renderMarketplace = (cards) => {
        const grid = document.getElementById('marketplace-grid');
        if (cards.length === 0) {
            grid.innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">No cards found for the current filters.</p>';
            return;
        }
        grid.innerHTML = '';
        cards.forEach(card => {
            const sellerHandle = card.sellerData?.handle || 'unknown';
            const priceDisplay = (typeof card.salePrice === 'number' && card.salePrice > 0) ? `${card.salePrice.toFixed(2)} SEK` : 'For Trade';
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 flex flex-col group transition hover:shadow-xl hover:-translate-y-1';
            cardEl.innerHTML = `
                <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block h-full flex flex-col">
                    <div class="relative w-full">
                        <img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded-md mb-2 aspect-[5/7] object-cover" onerror="this.onerror=null;this.src='https://placehold.co/223x310';">
                        <span class="absolute top-1 left-1 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">Buy Now</span>
                    </div>
                    <div class="flex-grow flex flex-col p-1">
                        <h4 class="font-bold text-sm truncate flex-grow text-gray-800 dark:text-white">${card.name}</h4>
                        <p class="text-blue-600 dark:text-blue-400 font-semibold text-lg mt-1">${priceDisplay}</p>
                        <a href="profile.html?user=${sellerHandle}" class="text-xs text-gray-500 dark:text-gray-400 hover:underline">from @${sellerHandle}</a>
                    </div>
                </a>
                <a href="trades.html?propose_to_card=${card.id}" class="propose-trade-btn mt-2 w-full text-center bg-green-600 text-white text-xs font-bold py-1 rounded-full hover:bg-green-700">Propose Trade</a>
            `;
            grid.appendChild(cardEl);
        });
    };

    // --- NEW: Auction and Analytics Functions ---
    const loadAuctions = () => {
        auctionContainer.innerHTML = '';
        const mockAuctions = [
            { id: 1, name: 'Foil Black Lotus', imageUrl: 'https://cards.scryfall.io/large/front/b/d/bd8fa327-dd41-4737-8f19-22807f3ec608.jpg?1614638838', currentBid: 1500, endsIn: '2h 15m' },
            { id: 2, name: 'Gaea\'s Cradle', imageUrl: 'https://cards.scryfall.io/large/front/2/5/25b0b8c2-5729-4ba1-97b5-ae52b24309a1.jpg?1562902898', currentBid: 850, endsIn: '1d 4h' },
            { id: 3, name: 'Mox Sapphire', imageUrl: 'https://cards.scryfall.io/large/front/e/a/ea1feae0-335d-40e9-943b-74b6941b6f38.jpg?1614638848', currentBid: 2200, endsIn: '5h 30m' }
        ];

        mockAuctions.forEach(auction => {
            const auctionCard = document.createElement('div');
            auctionCard.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col group';
            auctionCard.innerHTML = `
                <img src="${auction.imageUrl}" alt="${auction.name}" class="w-full rounded-md mb-4 aspect-[5/7] object-cover">
                <h3 class="font-bold text-lg truncate text-gray-800 dark:text-white">${auction.name}</h3>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-sm text-gray-500 dark:text-gray-400">Current Bid:</span>
                    <span class="font-bold text-xl text-green-600">${auction.currentBid} SEK</span>
                </div>
                 <div class="text-sm text-red-500 font-semibold mt-1">Ends in: ${auction.endsIn}</div>
                <button class="mt-4 w-full text-center bg-purple-600 text-white font-bold py-2 rounded-full hover:bg-purple-700">Place Bid</button>
            `;
            auctionContainer.appendChild(auctionCard);
        });
    };
    
    const renderAnalyticsCharts = () => {
        const renderChart = (ctx, label, data, color) => new Chart(ctx, {
            type: 'line',
            data: { labels: data.map(d => d.name), datasets: [{ label, data: data.map(d => d.change), backgroundColor: color, borderColor: color, tension: 0.1 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
        
        const trendingUpData = [{ name: 'Orcish Bowmasters', change: 25 }, { name: 'The One Ring', change: 18 }, { name: 'Thoughtseize', change: 12 }];
        const trendingDownData = [{ name: 'Sheoldred, the Apocalypse', change: -15 }, { name: 'Solitude', change: -10 }, { name: 'Ragavan, Nimble Pilferer', change: -8 }];

        if (trendingUpChart) trendingUpChart.destroy();
        if (trendingDownChart) trendingDownChart.destroy();

        trendingUpChart = renderChart(document.getElementById('trending-up-chart').getContext('2d'), '% Change (7d)', trendingUpData, 'rgba(34, 197, 94, 0.6)');
        trendingDownChart = renderChart(document.getElementById('trending-down-chart').getContext('2d'), '% Change (7d)', trendingDownData, 'rgba(239, 68, 68, 0.6)');

        const undervaluedList = document.getElementById('undervalued-list');
        undervaluedList.innerHTML = `
            <li class="flex justify-between items-center text-sm"><a href="#" class="text-blue-600 hover:underline">Force of Will</a> <span class="text-green-600 font-semibold">+5% Pred.</span></li>
            <li class="flex justify-between items-center text-sm"><a href="#" class="text-blue-600 hover:underline">Misty Rainforest</a> <span class="text-green-600 font-semibold">+3% Pred.</span></li>
        `;
    };

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loadMarketplaceCards();
    });
    sortByEl.addEventListener('change', sortAndRender);

    setupTabs();
    loadMarketplaceCards();
    renderAnalyticsCharts();
});
