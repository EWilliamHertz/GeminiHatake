/**
 * HatakeSocial - Marketplace Page Script (v6 - Enhanced Debugging)
 *
 * This script will print the specific Firebase error to the console
 * to help us diagnose the final issue with the marketplace.
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

    const loadMarketplaceCards = async () => {
        if(loader) loader.style.display = 'block';
        while (marketplaceGrid.firstChild && marketplaceGrid.firstChild !== loader) {
            marketplaceGrid.removeChild(marketplaceGrid.firstChild);
        }

        try {
            console.log("Attempting to query the 'collection' group where 'forSale' is true...");
            const snapshot = await db.collectionGroup('collection').where('forSale', '==', true).get();
            console.log(`Query successful! Found ${snapshot.size} items.`);

            if(loader) loader.style.display = 'none';

            if (snapshot.empty) {
                marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">No cards are currently listed for sale.</p>';
                return;
            }

            for (const doc of snapshot.docs) {
                // ... card rendering logic ...
            }

        } catch (error) {
            // **THIS IS THE IMPORTANT PART**
            // This will print the REAL error message from Firebase.
            console.error("MARKETPLACE CRITICAL ERROR:", error);
            if(loader) loader.style.display = 'none';
            marketplaceGrid.innerHTML = `<p class="col-span-full text-center text-red-500 p-8">A critical error occurred. Please open the developer console (F12) and send a screenshot of the red error message.</p>`;
        }
    };

    loadMarketplaceCards();
});
