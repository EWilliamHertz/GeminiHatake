/**
 * HatakeSocial - Marketplace Page Script (v3 - Advanced Search Merged)
 *
 * This script is a complete merge of the original 254-line file from the repository
 * with the new advanced search functionality modeled after Cardmarket.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const marketplaceGrid = document.getElementById('marketplace-grid');
    if (!marketplaceGrid) return;

    if (!user) {
        marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">Please log in to view the marketplace.</p>';
        return;
    }
    
    // --- DOM Elements ---
    const loader = document.getElementById('marketplace-loader');
    const searchForm = document.getElementById('marketplace-search-form');
    const advancedSearchToggle = document.getElementById('toggle-advanced-search');
    const advancedSearchOptions = document.getElementById('advanced-search-options');
    const tradeModal = document.getElementById('propose-trade-modal');
    const closeTradeModalBtn = document.getElementById('close-trade-modal');
    const sendTradeOfferBtn = document.getElementById('send-trade-offer-btn');
    
    // --- State ---
    let allCardsData = []; // This will store the full data for all fetched cards
    let myCollectionForTrade = [];
    let tradeOffer = {
        receiverCard: null,
        proposerCards: [],
        proposerMoney: 0,
        receiverMoney: 0,
        notes: ''
    };

    // --- Search & Display Logic ---
    const loadMarketplaceCards = async () => {
        loader.style.display = 'block';
        marketplaceGrid.innerHTML = '';

        try {
            // Build the query based on form inputs
            let query = db.collectionGroup('collection').where('forSale', '==', true);

            const cardName = document.getElementById('search-card-name').value.trim();
            if (cardName) {
                query = query.orderBy('name').startAt(cardName).endAt(cardName + '\uf8ff');
            }

            const expansion = document.getElementById('search-expansion').value.trim();
            if (expansion) {
                query = query.where('setName', '>=', expansion).where('setName', '<=', expansion + '\uf8ff');
            }
            
            const selectedRarities = Array.from(document.querySelectorAll('.rarity-checkbox:checked')).map(cb => cb.value);
            if (selectedRarities.length > 0) {
                query = query.where('rarity', 'in', selectedRarities);
            }

            // Note: Color filter requires a change in data structure to be efficient.
            // It's included in the HTML but the query part is commented out for now.

            const snapshot = await query.limit(50).get();
            
            if (snapshot.empty) {
                marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 p-8">No cards match your search criteria.</p>';
                loader.style.display = 'none';
                return;
            }

            const sellerIds = [...new Set(snapshot.docs.map(doc => doc.ref.parent.parent.id))];
            const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
            const sellerDocs = await Promise.all(sellerPromises);
            const sellers = {};
            sellerDocs.forEach(doc => {
                if(doc.exists) sellers[doc.id] = doc.data();
            });

            allCardsData = snapshot.docs.map(doc => {
                const sellerId = doc.ref.parent.parent.id;
                return {
                    id: doc.id,
                    sellerData: sellers[sellerId] || { handle: 'unknown', displayName: 'Unknown Seller' },
                    ...doc.data()
                };
            });

            renderMarketplace(allCardsData);

        } catch (error) {
            console.error("Error loading marketplace:", error);
            marketplaceGrid.innerHTML = `<p class="col-span-full text-center text-red-500 p-8">Could not load cards. You may need to create a database index. Check the console (F12) for a link.</p>`;
        } finally {
            loader.style.display = 'none';
        }
    };

    const renderMarketplace = (cards) => {
        marketplaceGrid.innerHTML = '';
        cards.forEach(card => {
            const priceDisplay = (typeof card.salePrice === 'number' && card.salePrice > 0) ? `${card.salePrice.toFixed(2)} SEK` : 'For Trade';
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-white rounded-lg shadow-md p-2 flex flex-col';
            // This now links to the card-view page, which is a better UX
            cardEl.innerHTML = `
                <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block h-full flex flex-col">
                    <img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded-md mb-2 aspect-[5/7] object-cover">
                    <div class="flex-grow flex flex-col p-2">
                        <h4 class="font-bold text-sm truncate flex-grow">${card.name}</h4>
                        <p class="text-blue-600 font-semibold text-lg mt-1">${priceDisplay}</p>
                        <p class="text-xs text-gray-500 hover:underline">from @${card.sellerData.handle}</p>
                    </div>
                </a>
            `;
            marketplaceGrid.appendChild(cardEl);
        });
    };

    // --- Original Trade Modal Logic (Preserved) ---
    const openTradeModal = async (cardId) => {
        const cardToTradeFor = allCardsData.find(c => c.id === cardId);
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
            participants: [user.uid, tradeOffer.receiverCard.sellerId],
            proposerCards: tradeOffer.proposerCards.map(c => ({ name: c.name, imageUrl: c.imageUrl, value: c.priceUsd })),
            receiverCards: [{ name: tradeOffer.receiverCard.name, imageUrl: tradeOffer.receiverCard.imageUrl, value: tradeOffer.receiverCard.priceUsd }],
            proposerMoney: parseFloat(document.getElementById('proposer-money').value) || 0,
            receiverMoney: parseFloat(document.getElementById('receiver-money').value) || 0,
            notes: document.getElementById('trade-notes').value,
            status: 'pending',
            createdAt: new Date(),
            proposerLeftFeedback: false,
            receiverLeftFeedback: false
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
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loadMarketplaceCards();
    });

    advancedSearchToggle.addEventListener('click', () => {
        const isHidden = advancedSearchOptions.classList.toggle('hidden');
        advancedSearchToggle.innerHTML = isHidden ? 'Advanced <i class="fas fa-chevron-down ml-1 text-xs"></i>' : 'Advanced <i class="fas fa-chevron-up ml-1 text-xs"></i>';
    });

    closeTradeModalBtn?.addEventListener('click', () => closeModal(tradeModal));
    sendTradeOfferBtn?.addEventListener('click', sendTradeOffer);
    document.getElementById('proposer-selected-cards')?.addEventListener('click', (e) => {
        const button = e.target.closest('.remove-trade-item-btn');
        if (button) removeCardFromTrade(button.dataset.id);
    });
    document.getElementById('my-collection-search')?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredCards = myCollectionForTrade.filter(card => card.name.toLowerCase().includes(searchTerm));
        renderMyCollectionForTrade(filteredCards);
    });
    document.getElementById('proposer-money')?.addEventListener('input', updateTradeValues);
    document.getElementById('receiver-money')?.addEventListener('input', updateTradeValues);
    
    // --- Initial Load ---
    loadMarketplaceCards();
});
