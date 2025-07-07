/**
 * HatakeSocial - Marketplace Page Script (v12 - Complete & Merged)
 *
 * This version activates the marketplace by fetching and displaying all cards
 * that users have marked for sale. It merges the original filtering and sorting
 * logic with the live data fetching.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const marketplaceGrid = document.getElementById('marketplace-grid');
    if (!marketplaceGrid) return;

    // Show a message if the user is not logged in.
    if (!user) {
        marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">Please log in to view the marketplace.</p>';
        // Hide the loader if the user is not logged in
        const loader = document.getElementById('marketplace-loader');
        if(loader) loader.style.display = 'none';
        return;
    }
    
    // Get DOM elements
    const loader = document.getElementById('marketplace-loader');
    const searchForm = document.getElementById('marketplace-search-form');
    const sortByEl = document.getElementById('sort-by');
    
    // State to hold all fetched card data
    let allCardsData = [];

    // Main function to load and filter cards from Firestore
    const loadMarketplaceCards = async () => {
        loader.style.display = 'block';
        marketplaceGrid.innerHTML = '';

        try {
            // Read all filter values from the form
            const cardName = document.getElementById('search-card-name').value.trim();
            const language = document.getElementById('filter-language').value;
            const condition = document.getElementById('filter-condition').value;
            const country = document.getElementById('filter-location').value.trim();

            // Start with a base query for all cards marked 'forSale'
            let query = db.collectionGroup('collection').where('forSale', '==', true);

            // Dynamically build the query based on selected filters
            if (cardName) {
                // Use a range for partial string matching on the card name
                query = query.where('name', '>=', cardName).where('name', '<=', cardName + '\uf8ff');
            }
            if (language !== 'any') {
                query = query.where('language', '==', language);
            }
            if (condition !== 'any') {
                query = query.where('condition', '==', condition);
            }
            
            // Execute the query
            const snapshot = await query.limit(200).get();
            
            if (snapshot.empty) {
                marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">No cards match your search criteria.</p>';
                loader.style.display = 'none';
                return;
            }

            // Efficiently fetch all seller data in one go
            const sellerIds = [...new Set(snapshot.docs.map(doc => doc.ref.parent.parent.id))];
            const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
            const sellerDocs = await Promise.all(sellerPromises);
            const sellers = {};
            sellerDocs.forEach(doc => {
                if(doc.exists) sellers[doc.id] = doc.data();
            });

            // Map the results and include seller data
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
            
            // Apply client-side filter for country, as this can't be done in the main query
            if (country) {
                allCardsData = allCardsData.filter(card => 
                    card.sellerData && card.sellerData.country && card.sellerData.country.toLowerCase().includes(country.toLowerCase())
                );
            }

            // Sort and render the final list
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
    
    // Function to sort the currently displayed cards
    const sortAndRender = () => {
        const sortBy = sortByEl.value;
        let sortedCards = [...allCardsData];

        switch (sortBy) {
            case 'price-asc':
                sortedCards.sort((a, b) => (a.salePrice || Infinity) - (b.salePrice || Infinity));
                break;
            case 'price-desc':
                sortedCards.sort((a, b) => (b.salePrice || 0) - (a.salePrice || 0));
                break;
            case 'date-desc':
            default:
                sortedCards.sort((a, b) => b.addedAt - a.addedAt);
                break;
        }

        renderMarketplace(sortedCards);
    };

    // Function to render the card grid UI
    const renderMarketplace = (cards) => {
        if(cards.length === 0) {
            marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">No cards found for the current filters.</p>';
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
                    <div class="relative w-full">
                        <img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded-md mb-2 aspect-[5/7] object-cover" onerror="this.onerror=null;this.src='https://placehold.co/223x310';">
                    </div>
                    <div class="flex-grow flex flex-col p-1">
                        <h4 class="font-bold text-sm truncate flex-grow text-gray-800 dark:text-white">${card.name}</h4>
                        <p class="text-blue-600 dark:text-blue-400 font-semibold text-lg mt-1">${priceDisplay}</p>
                        <a href="profile.html?user=${sellerHandle}" class="text-xs text-gray-500 dark:text-gray-400 hover:underline">from @${sellerHandle}</a>
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
