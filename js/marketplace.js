/**
 * HatakeSocial - Marketplace Page Script (v5 - With Trading)
 *
 * This script handles fetching and displaying all cards listed for sale,
 * and now includes the logic for proposing a trade.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const marketplaceGrid = document.getElementById('marketplace-grid');
    if (!marketplaceGrid) return;

    if (!user) {
        marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">Please log in to view the marketplace.</p>';
        return;
    }
    
    // --- Get DOM Elements ---
    const findWishlistBtn = document.getElementById('find-wishlist-btn');
    const loader = document.getElementById('marketplace-loader');
    const tradeModal = document.getElementById('propose-trade-modal');
    const closeTradeModalBtn = document.getElementById('close-trade-modal');
    const sendTradeOfferBtn = document.getElementById('send-trade-offer-btn');
    
    let allMarketplaceCards = [];
    let myCollectionForTrade = [];
    let tradeOffer = {
        receiverCard: null,
        proposerCards: [],
        proposerMoney: 0,
        receiverMoney: 0,
        notes: ''
    };

    // --- Main Functions ---

    const loadMarketplaceCards = async () => {
        if(loader) loader.style.display = 'block';
        marketplaceGrid.innerHTML = '';
        marketplaceGrid.appendChild(loader);

        try {
            const snapshot = await db.collectionGroup('collection').where('forSale', '==', true).get();
            if(loader) loader.style.display = 'none';

            if (snapshot.empty) {
                marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">No cards are currently listed for sale.</p>';
                return;
            }

            allMarketplaceCards = []; // Reset the cache
            for (const doc of snapshot.docs) {
                const card = doc.data();
                const sellerId = doc.ref.parent.parent.id;
                
                // Don't show the user's own cards in the marketplace
                if (sellerId === user.uid) continue;

                const sellerDoc = await db.collection('users').doc(sellerId).get();
                const sellerData = sellerDoc.exists ? sellerDoc.data() : { handle: 'unknown', displayName: 'Unknown' };
                
                allMarketplaceCards.push({ id: doc.id, sellerId, sellerData, ...card });
            }
            renderMarketplace(allMarketplaceCards);

        } catch (error) {
            console.error("Error loading marketplace cards:", error);
            if(loader) loader.style.display = 'none';
            marketplaceGrid.innerHTML = `<p class="col-span-full text-center text-red-500 p-8">An error occurred while loading the marketplace.</p>`;
        }
    };

    const renderMarketplace = (cards) => {
        marketplaceGrid.innerHTML = ''; // Clear grid
        if (cards.length === 0) {
            marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">No cards match your search.</p>';
            return;
        }

        cards.forEach(card => {
            const priceDisplay = (typeof card.salePrice === 'number' && card.salePrice > 0) ? `${card.salePrice.toFixed(2)} SEK` : 'For Trade';
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-white rounded-lg shadow-md p-2 flex flex-col';
            cardEl.innerHTML = `
                <img src="${card.imageUrl}" class="w-full rounded-md mb-2 aspect-[5/7] object-cover">
                <h4 class="font-bold text-sm truncate">${card.name}</h4>
                <p class="text-blue-600 font-semibold text-lg mt-1">${priceDisplay}</p>
                <a href="profile.html?user=${card.sellerData.handle}" class="text-xs text-gray-500 hover:underline">@${card.sellerData.handle}</a>
                <button data-card-id="${card.id}" class="propose-trade-btn mt-2 w-full bg-green-500 text-white text-sm font-bold py-1 rounded-full hover:bg-green-600">Propose Trade</button>
            `;
            marketplaceGrid.appendChild(cardEl);
        });
    };

    const openTradeModal = async (cardId) => {
        const cardToTradeFor = allMarketplaceCards.find(c => c.id === cardId);
        if (!cardToTradeFor) {
            alert("Could not find card details.");
            return;
        }
        
        // Reset trade state
        tradeOffer = {
            receiverCard: cardToTradeFor,
            proposerCards: [],
            proposerMoney: 0,
            receiverMoney: 0,
            notes: ''
        };

        // Display the card being requested
        const receiverDisplay = document.getElementById('receiver-card-display');
        receiverDisplay.innerHTML = `
            <div class="flex items-center space-x-2">
                <img src="${cardToTradeFor.imageUrl}" class="w-12 h-16 object-cover rounded-md">
                <div>
                    <p class="font-bold">${cardToTradeFor.name}</p>
                    <p class="text-sm text-gray-500">from @${cardToTradeFor.sellerData.handle}</p>
                </div>
            </div>
        `;

        // Load my collection for offering
        const myCollectionList = document.getElementById('my-collection-list');
        myCollectionList.innerHTML = '<p>Loading your collection...</p>';
        const snapshot = await db.collection('users').doc(user.uid).collection('collection').get();
        myCollectionForTrade = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        renderMyCollectionForTrade(myCollectionForTrade);
        updateProposerSelectionUI();
        openModal(tradeModal);
    };

    const renderMyCollectionForTrade = (cards) => {
        const myCollectionList = document.getElementById('my-collection-list');
        myCollectionList.innerHTML = '';
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'flex items-center justify-between p-1 hover:bg-gray-200 rounded cursor-pointer';
            cardEl.dataset.cardId = card.id;
            cardEl.innerHTML = `
                <span class="text-sm truncate">${card.name}</span>
                <i class="fas fa-plus-circle text-green-500"></i>
            `;
            cardEl.addEventListener('click', () => selectCardForTrade(card.id));
            myCollectionList.appendChild(cardEl);
        });
    };

    const selectCardForTrade = (cardId) => {
        const card = myCollectionForTrade.find(c => c.id === cardId);
        if (card && !tradeOffer.proposerCards.some(c => c.id === cardId)) {
            tradeOffer.proposerCards.push(card);
            updateProposerSelectionUI();
        }
    };

    const removeCardFromTrade = (cardId) => {
        tradeOffer.proposerCards = tradeOffer.proposerCards.filter(c => c.id !== cardId);
        updateProposerSelectionUI();
    };

    const updateProposerSelectionUI = () => {
        const container = document.getElementById('proposer-selected-cards');
        if (tradeOffer.proposerCards.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500 italic">No cards selected.</p>';
            return;
        }
        container.innerHTML = '';
        tradeOffer.proposerCards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'flex items-center justify-between p-1 bg-blue-100 rounded';
            cardEl.innerHTML = `
                <span class="text-sm truncate">${card.name}</span>
                <button data-card-id="${card.id}" class="remove-trade-item-btn text-red-500 hover:text-red-700"><i class="fas fa-times-circle"></i></button>
            `;
            container.appendChild(cardEl);
        });
    };

    const sendTradeOffer = async () => {
        if (!tradeOffer.receiverCard) return;

        sendTradeOfferBtn.disabled = true;
        sendTradeOfferBtn.textContent = 'Sending...';

        const tradeData = {
            proposerId: user.uid,
            proposerName: user.displayName,
            receiverId: tradeOffer.receiverCard.sellerId,
            receiverName: tradeOffer.receiverCard.sellerData.displayName,
            proposerCards: tradeOffer.proposerCards.map(c => ({ name: c.name, imageUrl: c.imageUrl, value: c.priceUsd })),
            receiverCards: [{ name: tradeOffer.receiverCard.name, imageUrl: tradeOffer.receiverCard.imageUrl, value: tradeOffer.receiverCard.priceUsd }],
            proposerMoney: parseFloat(document.getElementById('proposer-money').value) || 0,
            receiverMoney: parseFloat(document.getElementById('receiver-money').value) || 0,
            notes: document.getElementById('trade-notes').value,
            status: 'pending',
            createdAt: new Date()
        };

        try {
            await db.collection('trades').add(tradeData);
            alert("Trade offer sent successfully!");
            closeModal(tradeModal);
        } catch (error) {
            console.error("Error sending trade offer:", error);
            alert("Could not send trade offer.");
        } finally {
            sendTradeOfferBtn.disabled = false;
            sendTradeOfferBtn.textContent = 'Send Trade Offer';
        }
    };

    // --- Event Listeners ---
    marketplaceGrid.addEventListener('click', (e) => {
        const button = e.target.closest('.propose-trade-btn');
        if (button) {
            openTradeModal(button.dataset.cardId);
        }
    });

    closeTradeModalBtn.addEventListener('click', () => closeModal(tradeModal));
    sendTradeOfferBtn.addEventListener('click', sendTradeOffer);

    document.getElementById('proposer-selected-cards').addEventListener('click', (e) => {
        const button = e.target.closest('.remove-trade-item-btn');
        if (button) {
            removeCardFromTrade(button.dataset.cardId);
        }
    });
    
    // --- Initial Load ---
    loadMarketplaceCards();
});
