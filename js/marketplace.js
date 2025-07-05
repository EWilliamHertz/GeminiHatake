document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const marketplaceGrid = document.getElementById('marketplace-grid');
    if (!marketplaceGrid) return;

    // ** NEW: Read search query from URL **
    const urlParams = new URLSearchParams(window.location.search);
    const cardNameToFilter = urlParams.get('cardName');

    if (!user) {
        marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">Please log in to view the marketplace.</p>';
        return;
    }
    
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

    const loadMarketplaceCards = async () => {
        loader.style.display = 'block';
        marketplaceGrid.innerHTML = '';

        try {
            const forSaleSnapshot = await db.collectionGroup('collection').where('forSale', '==', true).get();
            
            if (forSaleSnapshot.empty) {
                marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">The marketplace is empty.</p>';
                loader.style.display = 'none';
                return;
            }

            const sellerIds = [...new Set(forSaleSnapshot.docs.map(doc => doc.ref.parent.parent.id))];
            const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
            const sellerDocs = await Promise.all(sellerPromises);
            const sellers = {};
            sellerDocs.forEach(doc => {
                if(doc.exists) sellers[doc.id] = doc.data();
            });

            allMarketplaceCards = forSaleSnapshot.docs.map(doc => {
                const sellerId = doc.ref.parent.parent.id;
                return {
                    id: doc.id,
                    sellerId: sellerId,
                    sellerData: sellers[sellerId] || { handle: 'unknown', displayName: 'Unknown Seller' },
                    ...doc.data()
                };
            });

            // ** NEW: Filter cards if a name is provided in the URL **
            let cardsToRender = allMarketplaceCards;
            if (cardNameToFilter) {
                const pageTitle = document.querySelector('h1');
                if(pageTitle) pageTitle.innerHTML = `Marketplace: <span class="text-blue-600">${cardNameToFilter}</span>`;
                cardsToRender = allMarketplaceCards.filter(card => card.name.toLowerCase() === cardNameToFilter.toLowerCase());
            }

            renderMarketplace(cardsToRender);

        } catch (error) {
            console.error("Error loading marketplace:", error);
            marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-red-500 p-8">Could not load marketplace cards.</p>';
        } finally {
            loader.style.display = 'none';
        }
    };

    const renderMarketplace = (cards) => {
        marketplaceGrid.innerHTML = '';
        if (cards.length === 0) {
            marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">No cards found for this search.</p>';
            return;
        }

        cards.forEach(card => {
            const priceDisplay = (typeof card.salePrice === 'number' && card.salePrice > 0) ? `${card.salePrice.toFixed(2)} SEK` : 'For Trade';
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-white rounded-lg shadow-md p-2 flex flex-col transition hover:shadow-xl hover:-translate-y-1';
            cardEl.innerHTML = `
                <img src="${card.imageUrl}" class="w-full rounded-md mb-2 aspect-[5/7] object-cover">
                <div class="flex-grow flex flex-col p-2">
                    <h4 class="font-bold text-sm truncate flex-grow">${card.name}</h4>
                    <p class="text-blue-600 font-semibold text-lg mt-1">${priceDisplay}</p>
                    <a href="profile.html?user=${card.sellerData.handle}" class="text-xs text-gray-500 hover:underline">@${card.sellerData.handle}</a>
                </div>
                <button data-card-id="${card.id}" class="propose-trade-btn mt-2 w-full bg-green-500 text-white text-sm font-bold py-2 rounded-full hover:bg-green-600">
                    Propose Trade
                </button>
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
        
        tradeOffer = {
            receiverCard: cardToTradeFor,
            proposerCards: [],
            proposerMoney: 0,
            receiverMoney: 0,
            notes: ''
        };

        const receiverDisplay = document.getElementById('receiver-card-display');
        receiverDisplay.innerHTML = `
            <div class="flex items-center space-x-2">
                <img src="${cardToTradeFor.imageUrl}" class="w-12 h-16 object-cover rounded-md">
                <div>
                    <p class="font-bold">${cardToTradeFor.name}</p>
                    <p class="text-sm text-gray-500">from @${cardToTradeFor.sellerData.handle}</p>
                    <p class="text-sm font-semibold">Market Value: $${parseFloat(cardToTradeFor.priceUsd || 0).toFixed(2)}</p>
                </div>
            </div>
        `;

        const myCollectionList = document.getElementById('my-collection-list');
        myCollectionList.innerHTML = '<p>Loading your collection...</p>';
        const snapshot = await db.collection('users').doc(user.uid).collection('collection').get();
        myCollectionForTrade = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        renderMyCollectionForTrade(myCollectionForTrade);
        updateProposerSelectionUI();
        updateTradeValues();
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
            updateTradeValues();
        }
    };

    const removeCardFromTrade = (cardId) => {
        tradeOffer.proposerCards = tradeOffer.proposerCards.filter(c => c.id !== cardId);
        updateProposerSelectionUI();
        updateTradeValues();
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

    const updateTradeValues = () => {
        const proposerValueEl = document.getElementById('proposer-total-value');
        const receiverValueEl = document.getElementById('receiver-total-value');

        const proposerCardValue = tradeOffer.proposerCards.reduce((sum, card) => sum + parseFloat(card.priceUsd || 0), 0);
        const proposerMoney = parseFloat(document.getElementById('proposer-money').value) || 0;
        const proposerTotal = proposerCardValue + proposerMoney;

        const receiverCardValue = parseFloat(tradeOffer.receiverCard.priceUsd || 0);
        const receiverMoney = parseFloat(document.getElementById('receiver-money').value) || 0;
        const receiverTotal = receiverCardValue + receiverMoney;

        proposerValueEl.textContent = `Total Value: $${proposerTotal.toFixed(2)}`;
        receiverValueEl.textContent = `Total Value: $${receiverTotal.toFixed(2)}`;
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

    document.getElementById('my-collection-search').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredCards = myCollectionForTrade.filter(card => card.name.toLowerCase().includes(searchTerm));
        renderMyCollectionForTrade(filteredCards);
    });

    document.getElementById('proposer-money').addEventListener('input', updateTradeValues);
    document.getElementById('receiver-money').addEventListener('input', updateTradeValues);
    
    loadMarketplaceCards();
});


/*
