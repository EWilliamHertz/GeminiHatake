/**
 * HatakeSocial - Marketplace Page Script (v11 - Live Marketplace)
 *
 * This version activates the marketplace by fetching and displaying all cards
 * that users have marked for sale. It also includes the full filtering and
 * sorting functionality.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const marketplaceGrid = document.getElementById('marketplace-grid');
    if (!marketplaceGrid) return;

    if (!user) {
        marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">Please log in to view the marketplace.</p>';
        return;
    }
    
    const loader = document.getElementById('marketplace-loader');
    const searchForm = document.getElementById('marketplace-search-form');
    const sortByEl = document.getElementById('sort-by');
    
    let allCardsData = [];

    const loadMarketplaceCards = async () => {
        loader.style.display = 'block';
        marketplaceGrid.innerHTML = '';

        try {
            const cardName = document.getElementById('search-card-name').value.trim();
            const language = document.getElementById('filter-language').value;
            const condition = document.getElementById('filter-condition').value;
            const country = document.getElementById('filter-location').value.trim();

            let query = db.collectionGroup('collection').where('forSale', '==', true);

            if (cardName) {
                query = query.where('name', '>=', cardName).where('name', '<=', cardName + '\uf8ff');
            }
            if (language !== 'any') {
                query = query.where('language', '==', language);
            }
            if (condition !== 'any') {
                query = query.where('condition', '==', condition);
            }

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
                if(doc.exists) sellers[doc.id] = doc.data();
            });

            allCardsData = snapshot.docs.map(doc => {
                const sellerId = doc.ref.parent.parent.id;
                return {
                    id: doc.id,
                    sellerId: sellerId,
                    sellerData: sellers[sellerId],
                    ...doc.data(),
                    addedAt: doc.data().addedAt?.toDate ? doc.data().addedAt.toDate() : new Date(0) 
                };
            });
            
            if (country) {
                allCardsData = allCardsData.filter(card => 
                    card.sellerData && card.sellerData.country && card.sellerData.country.toLowerCase().includes(country.toLowerCase())
                );
            }

            sortAndRender();

        } catch (error) {
            console.error("Error loading marketplace:", error);
            marketplaceGrid.innerHTML = `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md col-span-full" role="alert">
                <p class="font-bold">Database Error</p>
                <p>Could not perform search. This may be due to a missing Firebase index. Please check the developer console (F12) for an error message with a link to create the required index.</p>
             </div>`;
        } finally {
            loader.style.display = 'none';
        }
    };
    
    const sortAndRender = () => {
        const sortBy = sortByEl.value;
        let sortedCards = [...allCardsData];

        if (sortBy === 'price-asc') {
            sortedCards.sort((a, b) => (a.salePrice || Infinity) - (b.salePrice || Infinity));
        } else if (sortBy === 'price-desc') {
            sortedCards.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
        } else {
            sortedCards.sort((a, b) => b.addedAt - a.addedAt);
        }

        renderMarketplace(sortedCards);
    };

    const renderMarketplace = (cards) => {
        if(cards.length === 0) {
            marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">No cards match your search criteria.</p>';
            return;
        }

        marketplaceGrid.innerHTML = '';
        cards.forEach(card => {
            const sellerHandle = card.sellerData?.handle || 'unknown'; 
            const priceDisplay = (typeof card.salePrice === 'number' && card.salePrice > 0) ? `${card.salePrice.toFixed(2)} SEK` : 'For Trade';
            
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 flex flex-col group transition hover:shadow-xl hover:-translate-y-1';
            
            cardEl.innerHTML = `
                <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block h-full flex flex-col">
                    <div class="relative w-full"><img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded-md mb-2 aspect-[5/7] object-cover" onerror="this.onerror=null;this.src='https://placehold.co/223x310';"></div>
                    <div class="flex-grow flex flex-col p-1">
                        <h4 class="font-bold text-sm truncate flex-grow text-gray-800 dark:text-white">${card.name}</h4>
                        <p class="text-blue-600 dark:text-blue-400 font-semibold text-lg mt-1">${priceDisplay}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400 group-hover:underline">from @${sellerHandle}</p>
                    </div>
                </a>
                <a href="trades.html?propose_to_card=${card.id}" class="propose-trade-btn mt-2 w-full text-center bg-green-600 text-white text-xs font-bold py-1 rounded-full hover:bg-green-700">Propose Trade</a>
            `;
            marketplaceGrid.appendChild(cardEl);
        });
    };
    
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loadMarketplaceCards();
    });
    
    sortByEl.addEventListener('change', sortAndRender);

    loadMarketplaceCards();
});
