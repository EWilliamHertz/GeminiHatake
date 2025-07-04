/**
 * HatakeSocial - Marketplace Page Script (v5 - Final & Robust)
 *
 * This script waits for the 'authReady' event from auth.js before running.
 * It handles fetching and displaying all cards listed for sale, with robust
 * error handling to prevent crashes from bad data.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const marketplaceGrid = document.getElementById('marketplace-grid');
    if (!marketplaceGrid) return;

    if (!user) {
        marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">Please log in to view the marketplace.</p>';
        return;
    }
    
    const findWishlistBtn = document.getElementById('find-wishlist-btn');
    if(findWishlistBtn) findWishlistBtn.classList.remove('hidden');

    const loader = document.getElementById('marketplace-loader');

    /**
     * Fetches and displays cards listed for sale.
     */
    const loadMarketplaceCards = async () => {
        if(loader) loader.style.display = 'block';
        // Clear previous results, but keep the loader element in the DOM
        while (marketplaceGrid.firstChild && marketplaceGrid.firstChild !== loader) {
            marketplaceGrid.removeChild(marketplaceGrid.firstChild);
        }

        try {
            // This query should now work with the index created.
            const snapshot = await db.collectionGroup('collection').where('forSale', '==', true).get();

            if(loader) loader.style.display = 'none';

            if (snapshot.empty) {
                marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">No cards are currently listed for sale.</p>';
                return;
            }

            console.log(`Found ${snapshot.size} cards for sale. Processing...`);

            for (const doc of snapshot.docs) {
                try {
                    const card = doc.data();
                    const sellerId = doc.ref.parent.parent.id; 

                    const sellerDoc = await db.collection('users').doc(sellerId).get();
                    const sellerName = sellerDoc.exists ? sellerDoc.data().handle : 'unknown';
                    
                    // **THE FIX IS HERE:** This is a much safer way to handle the price.
                    // It checks if 'salePrice' is a number before trying to format it.
                    const priceDisplay = (typeof card.salePrice === 'number')
                        ? `${card.salePrice.toFixed(2)} SEK` 
                        : 'For Trade';

                    const cardEl = document.createElement('div');
                    cardEl.className = 'bg-white rounded-lg shadow-md p-2 flex flex-col';
                    cardEl.innerHTML = `
                        <img src="${card.imageUrl}" class="w-full rounded-md mb-2 aspect-[5/7] object-cover">
                        <h4 class="font-bold text-sm truncate">${card.name}</h4>
                        <p class="text-blue-600 font-semibold text-lg mt-1">${priceDisplay}</p>
                        <a href="profile.html?user=${sellerName}" class="text-xs text-gray-500 hover:underline mt-auto pt-1">@${sellerName}</a>
                    `;
                    marketplaceGrid.appendChild(cardEl);

                } catch (cardError) {
                    // If one card fails to process, log it and continue with the others.
                    console.error(`Could not process card with ID: ${doc.id}. Skipping.`, cardError);
                }
            }

        } catch (error) {
            console.error("CRITICAL: Error loading marketplace cards:", error);
            if(loader) loader.style.display = 'none';
            marketplaceGrid.innerHTML = `<p class="col-span-full text-center text-red-500 p-8">An error occurred while loading the marketplace. Please try again later.</p>`;
        }
    };

    // --- Initial Load ---
    loadMarketplaceCards();
});
