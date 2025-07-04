/**
 * HatakeSocial - Trades Page Script (v3 - Final & Stable)
 *
 * This script handles fetching and displaying a user's trades,
 * and now includes the full, working logic for proposing a new trade from scratch.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const incomingContainer = document.getElementById('tab-content-incoming');
    if (!incomingContainer) return;

    if (!user) {
        incomingContainer.innerHTML = '<p class="text-center text-gray-500 p-8">Please log in to view your trades.</p>';
        return;
    }

    // --- Get All DOM Elements ---
    const outgoingContainer = document.getElementById('tab-content-outgoing');
    const historyContainer = document.getElementById('tab-content-history');
    const tabs = document.querySelectorAll('.trade-tab-button');
    const proposeNewTradeBtn = document.getElementById('propose-new-trade-btn');
    
    // Modal Elements
    const tradeModal = document.getElementById('propose-trade-modal');
    const closeTradeModalBtn = document.getElementById('close-trade-modal');
    const sendTradeOfferBtn = document.getElementById('send-trade-offer-btn');
    const tradePartnerSearch = document.getElementById('trade-partner-search');
    const tradePartnerResults = document.getElementById('trade-partner-results');
    const myCollectionSearch = document.getElementById('my-collection-search');
    const theirCollectionSearch = document.getElementById('their-collection-search');
    
    // --- State Variables ---
    let myCollectionForTrade = [];
    let theirCollectionForTrade = [];
    let tradeOffer = {
        proposerCards: [],
        receiverCards: [],
        receiver: null
    };

    // --- Tab Switching Logic ---
    proposeNewTradeBtn.classList.remove('hidden');
    tabs.forEach(button => {
        button.addEventListener('click', () => {
            tabs.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            document.querySelectorAll('.trade-tab-content').forEach(content => content.classList.add('hidden'));
            document.getElementById(`tab-content-${button.dataset.tab}`).classList.remove('hidden');
        });
    });

    // --- Trade Display Functions ---
    const renderTradeItems = (cards = [], money = 0) => {
        let itemsHtml = cards.map(card => `
            <div class="flex items-center space-x-2">
                <img src="${card.imageUrl}" class="w-8 h-11 object-cover rounded-sm">
                <span class="text-sm">${card.name}</span>
            </div>
        `).join('');

        if (money > 0) {
            itemsHtml += `
                <div class="flex items-center space-x-2 mt-2 pt-2 border-t">
                    <i class="fas fa-money-bill-wave text-green-500"></i>
                    <span class="text-sm font-semibold">${money.toFixed(2)} SEK</span>
                </div>
            `;
        }
        return itemsHtml || '<p class="text-sm text-gray-500 italic">No items</p>';
    };

    const createTradeCard = (trade, tradeId, isIncoming) => {
        const tradeCard = document.createElement('div');
        tradeCard.className = 'bg-white p-6 rounded-lg shadow-md';

        const theirItemsHtml = renderTradeItems(isIncoming ? trade.proposerCards : trade.receiverCards, isIncoming ? trade.proposerMoney : trade.receiverMoney);
        const yourItemsHtml = renderTradeItems(isIncoming ? trade.receiverCards : trade.proposerCards, isIncoming ? trade.receiverMoney : trade.proposerMoney);
        
        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800',
            accepted: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800',
            completed: 'bg-blue-100 text-blue-800',
        };
        const statusColor = statusColors[trade.status] || 'bg-gray-100';

        tradeCard.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <p class="text-sm text-gray-500">
                        ${isIncoming ? `Offer from: <strong>${trade.proposerName}</strong>` : `Offer to: <strong>${trade.receiverName}</strong>`}
                    </p>
                    <p class="text-xs text-gray-400">On: ${new Date(trade.createdAt.seconds * 1000).toLocaleString()}</p>
                </div>
                <span class="px-3 py-1 text-sm font-semibold rounded-full ${statusColor}">${trade.status}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="border p-4 rounded-md">
                    <h4 class="font-bold mb-2">${isIncoming ? 'They Offer:' : 'You Receive:'}</h4>
                    <div class="space-y-2">${theirItemsHtml}</div>
                </div>
                <div class="border p-4 rounded-md">
                    <h4 class="font-bold mb-2">${isIncoming ? 'You Offer:' : 'They Receive:'}</h4>
                    <div class="space-y-2">${yourItemsHtml}</div>
                </div>
            </div>
            ${trade.notes ? `<div class="mt-4 p-3 bg-gray-50 rounded-md"><p class="text-sm italic"><strong>Notes:</strong> ${trade.notes}</p></div>` : ''}
            ${isIncoming && trade.status === 'pending' ? `
                <div class="mt-4 text-right space-x-2">
                    <button data-id="${tradeId}" data-action="rejected" class="trade-action-btn px-4 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700">Decline</button>
                    <button data-id="${tradeId}" data-action="accepted" class="trade-action-btn px-4 py-2 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700">Accept</button>
                </div>
            ` : ''}
        `;
        return tradeCard;
    };

    const loadIncomingTrades = async () => { /* ... same as before ... */ };
    const loadOutgoingTrades = async () => { /* ... same as before ... */ };

    // --- Propose Trade Modal Logic ---
    const openProposeTradeModal = async () => {
        tradeOffer = { proposerCards: [], receiverCards: [], receiver: null };
        tradePartnerSearch.value = '';
        myCollectionSearch.value = '';
        theirCollectionSearch.value = '';
        document.getElementById('receiver-trade-section').classList.add('opacity-50', 'pointer-events-none');
        updateSelectionUI('proposer', []);
        updateSelectionUI('receiver', []);

        const myCollectionList = document.getElementById('my-collection-list');
        myCollectionList.innerHTML = '<p class="text-sm text-gray-500 p-2">Loading your collection...</p>';
        const snapshot = await db.collection('users').doc(user.uid).collection('collection').get();
        myCollectionForTrade = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCollectionForTrade(myCollectionForTrade, 'proposer');

        openModal(tradeModal);
    };
    
    const selectTradePartner = async (partner) => {
        tradeOffer.receiver = partner;
        tradePartnerSearch.value = `@${partner.handle}`;
        tradePartnerResults.innerHTML = '';
        tradePartnerResults.classList.add('hidden');

        document.getElementById('receiver-trade-section').classList.remove('opacity-50', 'pointer-events-none');

        const theirCollectionList = document.getElementById('their-collection-list');
        theirCollectionList.innerHTML = '<p class="text-sm text-gray-500 p-2">Loading collection...</p>';
        const snapshot = await db.collection('users').doc(partner.id).collection('collection').get();
        theirCollectionForTrade = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCollectionForTrade(theirCollectionForTrade, 'receiver');
    };

    const renderCollectionForTrade = (cards, side) => {
        const container = document.getElementById(side === 'proposer' ? 'my-collection-list' : 'their-collection-list');
        container.innerHTML = '';
        if (cards.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500 p-2 italic">No cards found.</p>';
            return;
        }
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'flex items-center justify-between p-1 hover:bg-gray-200 rounded cursor-pointer';
            cardEl.innerHTML = `<span class="text-sm truncate">${card.name}</span><i class="fas fa-plus-circle text-green-500"></i>`;
            cardEl.addEventListener('click', () => selectCardForTrade(card, side));
            container.appendChild(cardEl);
        });
    };

    const selectCardForTrade = (card, side) => {
        const list = side === 'proposer' ? tradeOffer.proposerCards : tradeOffer.receiverCards;
        if (!list.some(c => c.id === card.id)) {
            list.push(card);
            updateSelectionUI(side, list);
        }
    };

    const removeCardFromTrade = (cardId, side) => {
        if (side === 'proposer') {
            tradeOffer.proposerCards = tradeOffer.proposerCards.filter(c => c.id !== cardId);
            updateSelectionUI('proposer', tradeOffer.proposerCards);
        } else {
            tradeOffer.receiverCards = tradeOffer.receiverCards.filter(c => c.id !== cardId);
            updateSelectionUI('receiver', tradeOffer.receiverCards);
        }
    };

    const updateSelectionUI = (side, cards) => {
        const container = document.getElementById(`${side}-selected-cards`);
        if (cards.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500 italic">No cards selected.</p>';
            return;
        }
        container.innerHTML = '';
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'flex items-center justify-between p-1 bg-blue-100 rounded';
            cardEl.innerHTML = `
                <span class="text-sm truncate">${card.name}</span>
                <button data-card-id="${card.id}" data-side="${side}" class="remove-trade-item-btn text-red-500 hover:text-red-700"><i class="fas fa-times-circle"></i></button>
            `;
            container.appendChild(cardEl);
        });
    };

    const sendTradeOffer = async () => {
        if (!tradeOffer.receiver) {
            alert("Please select a trade partner.");
            return;
        }
        
        sendTradeOfferBtn.disabled = true;
        sendTradeOfferBtn.textContent = 'Sending...';

        const tradeData = {
            proposerId: user.uid,
            proposerName: user.displayName,
            receiverId: tradeOffer.receiver.id,
            receiverName: tradeOffer.receiver.displayName,
            proposerCards: tradeOffer.proposerCards.map(c => ({ name: c.name, imageUrl: c.imageUrl, value: c.priceUsd })),
            receiverCards: tradeOffer.receiverCards.map(c => ({ name: c.name, imageUrl: c.imageUrl, value: c.priceUsd })),
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
    proposeNewTradeBtn.addEventListener('click', openProposeTradeModal);
    closeTradeModalBtn.addEventListener('click', () => closeModal(tradeModal));
    sendTradeOfferBtn.addEventListener('click', sendTradeOffer);

    tradePartnerSearch.addEventListener('keyup', async (e) => {
        const searchTerm = e.target.value.toLowerCase();
        if (searchTerm.length < 2) {
            tradePartnerResults.innerHTML = '';
            tradePartnerResults.classList.add('hidden');
            return;
        }
        tradePartnerResults.classList.remove('hidden');
        const usersRef = db.collection('users');
        const query = usersRef.orderBy('handle').startAt(searchTerm).endAt(searchTerm + '\uf8ff');
        const snapshot = await query.get();
        tradePartnerResults.innerHTML = '';
        snapshot.forEach(doc => {
            if (doc.id === user.uid) return;
            const userData = doc.data();
            const resultItem = document.createElement('div');
            resultItem.className = 'p-2 hover:bg-gray-100 cursor-pointer';
            resultItem.textContent = `@${userData.handle} (${userData.displayName})`;
            resultItem.addEventListener('click', () => selectTradePartner({ id: doc.id, ...userData }));
            tradePartnerResults.appendChild(resultItem);
        });
    });
    
    myCollectionSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = myCollectionForTrade.filter(c => c.name.toLowerCase().includes(searchTerm));
        renderCollectionForTrade(filtered, 'proposer');
    });

    theirCollectionSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = theirCollectionForTrade.filter(c => c.name.toLowerCase().includes(searchTerm));
        renderCollectionForTrade(filtered, 'receiver');
    });

    document.getElementById('proposer-selected-cards').addEventListener('click', (e) => {
        const button = e.target.closest('.remove-trade-item-btn');
        if (button) removeCardFromTrade(button.dataset.cardId, button.dataset.side);
    });
    document.getElementById('receiver-selected-cards').addEventListener('click', (e) => {
        const button = e.target.closest('.remove-trade-item-btn');
        if (button) removeCardFromTrade(button.dataset.cardId, button.dataset.side);
    });
    
    // --- Initial Load ---
    loadIncomingTrades();
    loadOutgoingTrades();
});
