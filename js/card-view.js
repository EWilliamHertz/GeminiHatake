/**
 * HatakeSocial - Card View Page Script
 *
 * FIX v20: Re-orders the Firestore query to exactly match the composite
 * index (forSale, name), which is required for collectionGroup queries.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const container = document.getElementById('card-view-container');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const cardName = urlParams.get('name');

    if (!cardName) {
        container.innerHTML = '<p class="text-center text-red-500 col-span-full">No card name specified in the URL.</p>';
        return;
    }

    const cardImageEl = document.getElementById('card-image');
    const cardDetailsEl = document.getElementById('card-details');
    const listingsContainer = document.getElementById('listings-table-container');
    const chartCtx = document.getElementById('price-chart')?.getContext('2d');
    const filterConditionEl = document.getElementById('filter-condition');
    const filterFoilEl = document.getElementById('filter-foil');
    const sortByEl = document.getElementById('sort-by');

    let allListings = [];
    let priceChart = null;

    const loadCardData = async () => {
        try {
            const scryfallResponse = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
            if (!scryfallResponse.ok) {
                const fuzzyResponse = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
                if (!fuzzyResponse.ok) throw new Error('Card not found on Scryfall.');
                const cardData = await fuzzyResponse.json();
                window.location.search = `?name=${encodeURIComponent(cardData.name)}`;
                return;
            }
            const cardData = await scryfallResponse.json();

            updatePageWithCardData(cardData);
            renderPriceChart(cardData);
            await fetchListingsFromFirestore(cardData);

        } catch (error) {
            console.error("Error loading card view:", error);
            container.innerHTML = `<p class="text-center text-red-500 col-span-full p-8 bg-white dark:bg-gray-800 rounded-lg">Error: ${error.message}</p>`;
        }
    };

    const updatePageWithCardData = (cardData) => { /* ... unchanged ... */ };

    const fetchListingsFromFirestore = async (cardData) => {
        listingsContainer.innerHTML = '<p class="p-4 text-center text-gray-500 dark:text-gray-400">Loading listings...</p>';
        try {
            // FIX: The order of .where() clauses now matches the composite index.
            const listingsQuery = db.collectionGroup('collection')
                .where('forSale', '==', true)
                .where('name', '==', cardData.name);

            const listingsSnapshot = await listingsQuery.get();
            
            if (listingsSnapshot.empty) {
                listingsContainer.innerHTML = '<p class="p-4 text-center text-gray-500 dark:text-gray-400">No one is currently selling this card.</p>';
                return;
            }

            const sellerIds = [...new Set(listingsSnapshot.docs.map(doc => doc.ref.parent.parent.id))];
            const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
            const sellerDocs = await Promise.all(sellerPromises);
            const sellers = {};
            sellerDocs.forEach(doc => {
                if (doc.exists) sellers[doc.id] = doc.data();
            });

            allListings = listingsSnapshot.docs.map(doc => ({
                id: doc.id,
                seller: sellers[doc.ref.parent.parent.id] || { handle: 'unknown', displayName: 'Unknown', averageRating: 0, photoURL: 'https://i.imgur.com/B06rBhI.png' },
                ...doc.data()
            }));
            
            applyFiltersAndSort();

        } catch (error) {
            console.error("Firestore query for listings failed:", error);
            listingsContainer.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400">Could not load listings. A database index may be required. Please check the browser console (F12) for an error link.</div>`;
        }
    };

    const applyFiltersAndSort = () => { /* ... unchanged ... */ };
    const renderListingsTable = (listings) => { /* ... unchanged ... */ };
    const renderPriceChart = (cardData) => { /* ... unchanged ... */ };

    filterConditionEl?.addEventListener('change', applyFiltersAndSort);
    filterFoilEl?.addEventListener('change', applyFiltersAndSort);
    sortByEl?.addEventListener('change', applyFiltersAndSort);

    loadCardData();
});
