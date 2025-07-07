window.HatakeSocial.onAuthReady((user) => {
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
    const auctionsContainer = document.getElementById('auctions-container'); // NEW
    const chartCtx = document.getElementById('price-chart').getContext('2d');
    
    const filterConditionEl = document.getElementById('filter-condition');
    const filterFoilEl = document.getElementById('filter-foil');
    const sortByEl = document.getElementById('sort-by');

    let allListings = [];

    const loadCardData = async () => {
        try {
            const scryfallResponse = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
            if (!scryfallResponse.ok) throw new Error('Card not found on Scryfall.');
            const cardData = await scryfallResponse.json();

            document.title = `${cardData.name} - HatakeSocial`;
            cardImageEl.src = cardData.image_uris?.large || 'https://placehold.co/370x516?text=No+Image';
            cardImageEl.alt = cardData.name;
            cardDetailsEl.innerHTML = `
                <h1 class="text-2xl font-bold">${cardData.name}</h1>
                <p class="text-lg text-gray-600">${cardData.mana_cost || ''}</p>
                <p class="text-lg text-gray-800">${cardData.type_line}</p>
                <div class="text-md my-2 space-y-2">${cardData.oracle_text.replace(/\n/g, '<br>')}</div>
                ${cardData.power ? `<p class="text-lg font-bold">${cardData.power} / ${cardData.toughness}</p>` : ''}
                <p class="text-sm text-gray-500 mt-4">Set: ${cardData.set_name} (#${cardData.collector_number})</p>
            `;

            listingsContainer.innerHTML = '<p class="p-4 text-center">Loading listings...</p>';
            const listingsQuery = db.collectionGroup('collection').where('name', '==', cardData.name).where('forSale', '==', true);
            const listingsSnapshot = await listingsQuery.get();
            
            if (listingsSnapshot.empty) {
                listingsContainer.innerHTML = '<p class="p-4 text-center text-gray-500">No one is currently selling this card.</p>';
                renderPriceChart(null);
            } else {
                 const sellerIds = [...new Set(listingsSnapshot.docs.map(doc => doc.ref.parent.parent.id))];
                const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
                const sellerDocs = await Promise.all(sellerPromises);
                const sellers = {};
                sellerDocs.forEach(doc => { if(doc.exists) sellers[doc.id] = doc.data(); });
                allListings = listingsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    seller: sellers[doc.ref.parent.parent.id] || { handle: 'unknown', displayName: 'Unknown', averageRating: 0 },
                    ...doc.data()
                }));
                applyFiltersAndSort();
                renderPriceChart(cardData);
            }
            
            // NEW: Load auctions for this card
            loadAuctionsForCard(cardData.name);

        } catch (error) {
            console.error("Error loading card view:", error);
            container.innerHTML = `<p class="text-center text-red-500 col-span-full">Error: ${error.message}</p>`;
        }
    };

    // --- NEW: Function to load and render auctions ---
    const loadAuctionsForCard = (cardName) => {
        // This is a placeholder. In a real app, you would query your 'auctions' collection.
        auctionsContainer.innerHTML = '';
        const mockAuctions = [
            { id: 1, name: cardName, currentBid: 1500, endsIn: '2h 15m', seller: { name: 'SuperSeller', rating: 4.9 } },
            { id: 2, name: cardName, currentBid: 1450, endsIn: '1d 4h', seller: { name: 'CardKing', rating: 4.8 } }
        ].filter(a => a.name === cardName); // Simple filter for demo

        if (mockAuctions.length === 0) {
            auctionsContainer.innerHTML = '<p class="text-center text-gray-500">No active auctions for this card.</p>';
            return;
        }

        mockAuctions.forEach(auction => {
            const auctionEl = document.createElement('div');
            auctionEl.className = 'bg-white p-4 rounded-lg shadow-md flex items-center justify-between';
            auctionEl.innerHTML = `
                <div>
                    <p class="font-bold text-lg">${auction.currentBid} SEK</p>
                    <p class="text-sm text-gray-500">Seller: ${auction.seller.name} (${auction.seller.rating} ★)</p>
                </div>
                <div>
                    <p class="text-sm text-red-500 font-semibold text-right">${auction.endsIn}</p>
                    <button class="mt-1 px-4 py-1 bg-purple-600 text-white font-semibold rounded-full text-sm">Bid</button>
                </div>
            `;
            auctionsContainer.appendChild(auctionEl);
        });
    };

    const applyFiltersAndSort = () => {
        let filteredListings = [...allListings];
        const condition = filterConditionEl.value;
        if (condition !== 'all') filteredListings = filteredListings.filter(l => l.condition === condition);
        const foil = filterFoilEl.value;
        if (foil !== 'all') filteredListings = filteredListings.filter(l => l.isFoil === (foil === 'true'));
        const sortBy = sortByEl.value;
        if (sortBy === 'price-asc') filteredListings.sort((a, b) => a.salePrice - b.salePrice);
        else if (sortBy === 'price-desc') filteredListings.sort((a, b) => b.salePrice - a.salePrice);
        else if (sortBy === 'rating-desc') filteredListings.sort((a, b) => (b.seller.averageRating || 0) - (a.seller.averageRating || 0));
        renderListingsTable(filteredListings);
    };

    const renderListingsTable = (listings) => {
        if (listings.length === 0) {
            listingsContainer.innerHTML = '<p class="p-4 text-center text-gray-500">No listings match the current filters.</p>';
            return;
        }
        let tableHTML = `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condition</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th></tr></thead>
            <tbody class="bg-white divide-y divide-gray-200">`;
        listings.forEach(listing => {
            const rating = listing.seller.averageRating ? listing.seller.averageRating.toFixed(1) : 'N/A';
            tableHTML += `<tr>
                <td class="px-6 py-4 whitespace-nowrap"><div class="flex items-center"><div class="flex-shrink-0 h-10 w-10"><img class="h-10 w-10 rounded-full object-cover" src="${listing.seller.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt=""></div><div class="ml-4">
                <a href="profile.html?user=${listing.seller.handle}" class="text-sm font-medium text-gray-900 hover:underline">${listing.seller.displayName}</a>
                <div class="text-sm text-gray-500">Rating: ${rating} ★</div></div></div></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${listing.condition} ${listing.isFoil ? '<span class="text-blue-500 font-bold">(Foil)</span>' : ''}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">${listing.salePrice.toFixed(2)} SEK</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><a href="#" class="text-indigo-600 hover:text-indigo-900">Propose Trade</a></td></tr>`;
        });
        tableHTML += `</tbody></table></div>`;
        listingsContainer.innerHTML = tableHTML;
    };

    const renderPriceChart = (cardData) => {
        const price = parseFloat(cardData?.prices?.usd || 0);
        const labels = ['-60d', '-30d', '-7d', 'Today'];
        const prices = [price * (1 + (Math.random() - 0.5) * 0.2), price * (1 + (Math.random() - 0.5) * 0.1), price * (1 + (Math.random() - 0.5) * 0.05), price].map(p => p > 0 ? p.toFixed(2) : 0);
        new Chart(chartCtx, {
            type: 'line',
            data: { labels: labels, datasets: [{ label: 'Price (USD)', data: prices, backgroundColor: 'rgba(54, 162, 235, 0.2)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 2, tension: 0.1 }] },
            options: { scales: { y: { beginAtZero: false } } }
        });
    };

    filterConditionEl.addEventListener('change', applyFiltersAndSort);
    filterFoilEl.addEventListener('change', applyFiltersAndSort);
    sortByEl.addEventListener('change', applyFiltersAndSort);

    loadCardData();
});
