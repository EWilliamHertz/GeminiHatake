/**
 * HatakeSocial - Marketplace Page Script (v26 - Improved Index Error Handling)
 *
 * This version completely reworks the marketplace for a professional experience.
 * - Removes the non-functional analytics dashboard.
 * - Implements a powerful, multi-field search and filter system.
 * - Redesigns the card listings to show seller reputation, city, and country.
 * - Ensures efficient, paginated loading of marketplace data.
 * - NEW: Provides a more robust and user-friendly error message when a Firestore index is missing, including the direct link to create it.
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

    // --- Helper to generate a Firestore index creation link ---
    const generateIndexCreationLink = (fields) => {
        const projectId = db.app.options.projectId;
        let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=collection`;
        
        fields.forEach(field => {
            url += `&fields=${field.name},${field.order.toUpperCase()}`;
        });
        
        return url;
    };

    // --- Pagination variables ---
    let lastVisible = null;
    const PAGE_SIZE = 24;
    let hasMore = true;
    let isLoading = false;

    const resetAndLoadCards = () => {
        lastVisible = null;
        hasMore = true;
        marketplaceGrid.innerHTML = '';
        const loadMoreBtn = document.querySelector('.load-more-button');
        if (loadMoreBtn) loadMoreBtn.remove();
        loadMarketplaceCards();
    };

    const loadMarketplaceCards = async () => {
        if (!hasMore || isLoading) return;
        isLoading = true;
        loader.style.display = 'block';
        
        // This array helps build the index creation link if the query fails.
        let indexFields = [{ name: 'forSale', order: 'asc' }]; 

        try {
            // Build the query based on filters
            let query = db.collectionGroup('collection').where('forSale', '==', true);
            
            // Get filter values
            const cardName = document.getElementById('search-card-name').value.trim().toLowerCase();
            const condition = document.getElementById('filter-condition').value;
            const country = document.getElementById('filter-location').value.trim().toLowerCase();
            const sortBy = sortByEl.value;

            if (sortBy === 'price-asc') {
                query = query.orderBy('salePrice', 'asc');
                indexFields.push({ name: 'salePrice', order: 'asc' });
            } else if (sortBy === 'price-desc') {
                query = query.orderBy('salePrice', 'desc');
                indexFields.push({ name: 'salePrice', order: 'desc' });
            } else {
                query = query.orderBy('addedAt', 'desc');
                indexFields.push({ name: 'addedAt', order: 'desc' });
            }

            if (lastVisible) {
                query = query.startAfter(lastVisible);
            }
            
            query = query.limit(PAGE_SIZE);

            const snapshot = await query.get();
            
            if (snapshot.empty) {
                if (marketplaceGrid.children.length === 0) {
                     marketplaceGrid.innerHTML = `<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">No cards found for the current filters.</p>`;
                }
                hasMore = false;
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

            let cardsToRender = snapshot.docs.map(doc => {
                const sellerId = doc.ref.parent.parent.id;
                return {
                    id: doc.id,
                    sellerId: sellerId,
                    sellerData: sellers[sellerId] || null,
                    ...doc.data(),
                };
            });

            // Client-side filtering
            if (cardName) cardsToRender = cardsToRender.filter(c => c.name.toLowerCase().includes(cardName));
            if (condition !== 'any') cardsToRender = cardsToRender.filter(c => c.condition === condition);
            if (country) cardsToRender = cardsToRender.filter(c => c.sellerData?.country?.toLowerCase().includes(country));

            renderMarketplace(cardsToRender);

        } catch (error) {
            console.error("Error loading marketplace:", error);
            let errorMessage = '';
            // Check if the error is a missing index
            if (error.code === 'failed-precondition') {
                 const indexLink = generateIndexCreationLink(indexFields);
                 errorMessage = `
                    <div class="col-span-full text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">
                        <p class="font-bold text-red-700 dark:text-red-300">Database Error: Missing Index</p>
                        <p class="text-red-600 dark:text-red-400 mt-2">To sort and filter the marketplace, a database index is required.</p>
                        <a href="${indexLink}" target="_blank" rel="noopener noreferrer" 
                           class="mt-4 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700">
                           Click Here to Create the Index
                        </a>
                        <p class="text-xs text-gray-500 mt-2">This will open the Firebase console. Click "Save" to create the index. It may take a few minutes to build. Afterwards, refresh this page.</p>
                    </div>
                 `;
            } else {
                // Display the actual error for better debugging
                errorMessage = `<p class="text-red-500 p-4 text-center col-span-full">An error occurred: ${error.message}</p>`;
            }
            marketplaceGrid.innerHTML = errorMessage;
        } finally {
            isLoading = false;
            loader.style.display = 'none';
        }
    };

    const renderMarketplace = (cards) => {
        const loadMoreBtn = document.querySelector('.load-more-button');
        if (loadMoreBtn) loadMoreBtn.remove();

        if (cards.length === 0 && marketplaceGrid.children.length === 0) {
            marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">No cards found for the current filters.</p>';
            return;
        }
        
        cards.forEach(card => {
            const seller = card.sellerData;
            if (!seller) return; // Don't render if seller data is missing

            const overallRating = (((seller.averageAccuracy || 0) + (seller.averagePackaging || 0)) / 2).toFixed(1);
            const sellerCurrency = seller.primaryCurrency || 'SEK';
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
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                             <p>★ ${overallRating} | from ${seller.city || 'N/A'}, ${seller.country || 'N/A'}</p>
                        </div>
                    </div>
                </a>
                <a href="trades.html?propose_to_card=${card.id}" 
                   class="propose-trade-btn mt-2 w-full text-center bg-green-600 text-white text-xs font-bold py-1 rounded-full hover:bg-green-700">
                    Propose Trade
                </a>
            `;
            marketplaceGrid.appendChild(cardEl);
        });

        if (hasMore) {
            const newLoadMoreBtn = document.createElement('button');
            newLoadMoreBtn.className = 'load-more-button col-span-full mt-6 px-6 py-3 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 transition';
            newLoadMoreBtn.textContent = 'Load More Cards';
            newLoadMoreBtn.addEventListener('click', loadMarketplaceCards);
            marketplaceGrid.insertAdjacentElement('afterend', newLoadMoreBtn);
        }
    };

    // Event listeners
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        resetAndLoadCards();
    });
    
    sortByEl.addEventListener('change', () => resetAndLoadCards());
    
    // Initial Load
    loadMarketplaceCards();
});
