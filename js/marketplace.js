/**
 * HatakeSocial - Marketplace Page Script
 *
 * This script waits for the 'authReady' event from auth.js before running.
 * It handles fetching and displaying all cards listed for sale.
 * It is designed to fail on first run to generate a required Firestore index link.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const marketplaceGrid = document.getElementById('marketplace-grid');
    if (!marketplaceGrid) return;

    if (!user) {
        marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500">Please log in to view the marketplace.</p>';
        return;
    }
    
    const findWishlistBtn = document.getElementById('find-wishlist-btn');
    findWishlistBtn.classList.remove('hidden');

    /**
     * Fetches and displays cards listed for sale.
     */
    const loadMarketplaceCards = async () => {
        const loader = document.getElementById('marketplace-loader');
        loader.style.display = 'block';
        marketplaceGrid.innerHTML = ''; // Clear previous results, but keep loader
        marketplaceGrid.appendChild(loader);

        try {
            // This is a collectionGroup query. It will search across all 'collection'
            // subcollections in the entire database. It requires a special index.
            const snapshot = await db.collectionGroup('collection').where('forSale', '==', true).get();

            loader.style.display = 'none'; // Hide loader after fetch

            if (snapshot.empty) {
                marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500">No cards are currently listed for sale.</p>';
                return;
            }

            for (const doc of snapshot.docs) {
                const card = doc.data();
                const sellerId = doc.ref.parent.parent.id; // Get the user ID from the path

                // We need to fetch the seller's info
                const sellerDoc = await db.collection('users').doc(sellerId).get();
                const sellerName = sellerDoc.exists ? sellerDoc.data().handle : 'unknown';

                const cardEl = document.createElement('div');
                cardEl.className = 'bg-white rounded-lg shadow-md p-2 flex flex-col';
                cardEl.innerHTML = `
                    <img src="${card.imageUrl}" class="w-full rounded-md mb-2">
                    <h4 class="font-bold text-sm truncate">${card.name}</h4>
                    <p class="text-blue-600 font-semibold text-lg mt-1">${card.salePrice.toFixed(2)} SEK</p>
                    <a href="profile.html?user=${sellerName}" class="text-xs text-gray-500 hover:underline mt-auto pt-1">@${sellerName}</a>
                `;
                marketplaceGrid.appendChild(cardEl);
            }

            
        } catch (error) {
            console.error("THIS IS THE EXPECTED ERROR IF THE INDEX IS MISSING. CLICK THE LINK BELOW TO CREATE THE INDEX:", error);
            marketplaceGrid.innerHTML = `
                <div class="col-span-full text-center p-8 bg-red-100 text-red-700 rounded-lg">
                    <h2 class="text-2xl font-bold">Action Required: Database Index Missing</h2>
                    <p class="mt-2">To power the marketplace, a one-time database setup is needed.</p>
                    <p class="mt-4 font-semibold">Please follow these steps:</p>
                    <ol class="text-left inline-block mt-2 space-y-1">
                        <li>1. Open the Developer Console (press F12).</li>
                        <li>2. Find the red error message that starts with "THIS IS THE EXPECTED ERROR...".</li>
                        <li>3. Click the long <span class="font-mono bg-gray-200 px-1">https://console.firebase.google.com...</span> link inside that error message.</li>
                        <li>4. A new Firebase tab will open. Click the "Create" button there.</li>
                        <li>5. Wait for the index to build (status becomes "Enabled"), then refresh this page.</li>
                    </ol>
                </div>`;
        }
    };

    // --- Initial Load ---
    loadMarketplaceCards();
});
