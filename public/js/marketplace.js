document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const marketplaceGrid = document.getElementById('marketplace-grid');

    if (!marketplaceGrid) {
        console.error("Marketplace grid not found!");
        return;
    }
    
    const db = firebase.firestore();

    async function fetchAndDisplayListings() {
        marketplaceGrid.innerHTML = '<p>Loading marketplace...</p>';
        try {
            // Correctly query the top-level 'marketplaceListings' collection
            const snapshot = await db.collection('marketplaceListings').where('forSale', '==', true).limit(50).get();
            
            if (snapshot.empty) {
                marketplaceGrid.innerHTML = '<p>The marketplace is currently empty.</p>';
                return;
            }

            marketplaceGrid.innerHTML = ''; // Clear loading message
            snapshot.forEach(doc => {
                const listing = { id: doc.id, ...doc.data() };
                const listingEl = createListingElement(listing);
                marketplaceGrid.appendChild(listingEl);
            });

        } catch (error) {
            console.error("Error fetching marketplace listings:", error);
            marketplaceGrid.innerHTML = '<p class="text-red-500">Error loading the marketplace.</p>';
        }
    }

    function createListingElement(listing) {
        const el = document.createElement('div');
        el.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden';
        
        // Simplified getCardImageUrl logic for marketplace context
        const imageUrl = listing.imageUrl || (listing.image_uris ? listing.image_uris.normal : 'https://placehold.co/223x310?text=No+Image');

        el.innerHTML = `
            <img src="${imageUrl}" alt="${listing.name}" class="w-full h-auto aspect-[5/7] object-cover">
            <div class="p-3">
                <h3 class="font-semibold text-sm truncate">${listing.name}</h3>
                <p class="text-xs text-gray-500">${listing.setName || listing.set_name}</p>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-lg font-bold text-green-500">$${(listing.salePrice || 0).toFixed(2)}</span>
                    <button class="add-to-cart-btn bg-blue-600 text-white px-2 py-1 text-xs rounded hover:bg-blue-700" data-id="${listing.id}">Add</button>
                </div>
            </div>
        `;
        return el;
    }

    fetchAndDisplayListings();
});
