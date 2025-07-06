/**
 * HatakeSocial - Marketplace Page Script (v10 - Full Filtering)
 *
 * This version implements the complete search and filtering functionality
 * from the marketplace search form.
 * - NEW: Queries now filter by card name, language, condition, and seller country.
 * - FIX: Consolidates search logic into a single, powerful function.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const marketplaceGrid = document.getElementById('marketplace-grid');
    if (!marketplaceGrid) return;

    if (!user) {
        marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">Please log in to view the marketplace.</p>';
        return;
    }
    
    // --- DOM Elements ---
    const loader = document.getElementById('marketplace-loader');
    const searchForm = document.getElementById('marketplace-search-form');
    const sortByEl = document.getElementById('sort-by');
    
    // --- State ---
    let allCardsData = [];

    // --- Search & Display Logic ---
    const loadMarketplaceCards = async () => {
        loader.style.display = 'block';
        marketplaceGrid.innerHTML = '';

        try {
            // --- NEW: Read all filter values from the form ---
            const cardName = document.getElementById('search-card-name').value.trim();
            const language = document.getElementById('filter-language').value;
            const condition = document.getElementById('filter-condition').value;
            const country = document.getElementById('filter-location').value.trim();

            let query = db.collectionGroup('collection').where('forSale', '==', true);

            // --- NEW: Dynamically build the query based on filters ---
            if (cardName) {
                // Using a range for partial string matching
                query = query.where('name', '>=', cardName).where('name', '<=', cardName + '\uf8ff');
            }
            if (language !== 'any') {
                // Note: This requires a composite index in Firestore: (forSale, language)
                query = query.where('language', '==', language);
            }
            if (condition !== 'any') {
                 // Note: This requires a composite index in Firestore: (forSale, condition)
                query = query.where('condition', '==', condition);
            }

            // Client-side filtering will be needed for seller country, as we can't query on a sub-collection's parent field directly.
            
            const snapshot = await query.limit(200).get();
            
            if (snapshot.empty) {
                marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">No cards match your search criteria.</p>';
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
            
            // --- NEW: Apply client-side filter for country ---
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
        } else { // 'date-desc' is the default
            sortedCards.sort((a, b) => b.addedAt - a.addedAt);
        }

        renderMarketplace(sortedCards);
    };

    const renderMarketplace = (cards) => {
        if(cards.length === 0) {
            marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">No cards match your search criteria.</p>';
            return;
        }

        marketplaceGrid.innerHTML = '';
        cards.forEach(card => {
            const sellerHandle = card.sellerData?.handle || 'unknown'; 
            const priceDisplay = (typeof card.salePrice === 'number' && card.salePrice > 0) ? `$${card.salePrice.toFixed(2)} USD` : 'For Trade';
            
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
    
    // --- Event Listeners ---
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loadMarketplaceCards();
    });
    
    sortByEl.addEventListener('change', sortAndRender);

    // --- Initial Load ---
    loadMarketplaceCards();
});
```

I have updated the `marketplace.js` file to fully support the search and filtering capabilities defined in your UI. Now, when a user fills out the search form and clicks "Search," the results will be filtered by card name, language, condition, and the seller's country, making the marketplace a much more effective tool for finding specific car
