/**
 * HatakeSocial - Trades Script (v23 - User Search Fix)
 *
 * - FIX: Implemented the missing user search functionality in the trade modal.
 * - Now searches the 'users' collection for matching handles.
 */

// --- Date Formatting Helper ---
const formatTimestamp = (timestamp) => {
    if (!timestamp || !timestamp.seconds) {
        return 'Unknown date';
    }
    const date = new Date(timestamp.seconds * 1000);
    const userDateFormat = localStorage.getItem('userDateFormat') || 'dmy'; // Default to D/M/Y

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (userDateFormat === 'mdy') {
        return `${month}/${day}/${year}`;
    }
    return `${day}/${month}/${year}`;
};


document.addEventListener('authReady', ({ detail: { user } }) => {
    console.log("Auth is ready for trades.js");

    const tradesPageContainer = document.querySelector('main.container');
    if (!tradesPageContainer || !document.getElementById('tab-content-incoming')) return;

    const incomingContainer = document.getElementById('tab-content-incoming');

    if (!user) {
        const proposeNewTradeBtn = document.getElementById('propose-new-trade-btn');
        if(proposeNewTradeBtn) proposeNewTradeBtn.classList.add('hidden');

        const tabContent = document.querySelector('.trade-tab-content');
        if (tabContent) {
            document.querySelectorAll('.trade-tab-content').forEach(c => c.innerHTML = '');
            if (incomingContainer) {
                incomingContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to view your trades.</p>';
            }
        }
        return;
    }

    const db = firebase.firestore();
    const functions = firebase.functions();

    const outgoingContainer = document.getElementById('tab-content-outgoing');
    const historyContainer = document.getElementById('tab-content-history');
    const analysisContainer = document.getElementById('tab-content-analysis');
    const tabs = document.querySelectorAll('.trade-tab-button');
    const proposeNewTradeBtn = document.getElementById('propose-new-trade-btn');

    const tradeModal = document.getElementById('propose-trade-modal');
    const closeTradeModalBtn = document.getElementById('close-trade-modal');
    const sendTradeOfferBtn = document.getElementById('send-trade-offer-btn');
    const tradePartnerSearch = document.getElementById('trade-partner-search');
    const tradePartnerResults = document.getElementById('trade-partner-results');
    const proposerValueEl = document.getElementById('proposer-value');
    const receiverValueEl = document.getElementById('receiver-value');
    const proposerMoneyInput = document.getElementById('proposer-money');
    const receiverMoneyInput = document.getElementById('receiver-money');
    const counterOfferInput = document.getElementById('counter-offer-original-id');

    let myCollectionForTrade = [];
    let theirCollectionForTrade = [];
    let tradeOffer = { proposerCards: [], receiverCards: [], proposerMoney: 0, receiverMoney: 0, receiver: null };
    const USD_TO_SEK_RATE = 10.5;

    const initializePage = async () => {
        if (proposeNewTradeBtn) proposeNewTradeBtn.classList.remove('hidden');
        loadAllTrades();
        addEventListeners();
        checkForUrlParams();
    };

    const loadAllTrades = () => {
        const tradesRef = db.collection('trades').where('participants', 'array-contains', user.uid).orderBy('createdAt', 'desc');

        tradesRef.onSnapshot(async (snapshot) => {
            incomingContainer.innerHTML = '';
            outgoingContainer.innerHTML = '';
            historyContainer.innerHTML = '';

            if (snapshot.empty) {
                const noTradesMsg = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No trades found.</p>';
                incomingContainer.innerHTML = noTradesMsg;
                outgoingContainer.innerHTML = noTradesMsg;
                historyContainer.innerHTML = noTradesMsg;
                return;
            }

            let counts = { incoming: 0, outgoing: 0, history: 0 };
            for (const doc of snapshot.docs) {
                const trade = doc.data();
                const tradeCard = await createTradeCard(trade, doc.id);
                const isReceiver = trade.receiverId === user.uid;

                if (['pending', 'accepted', 'awaiting_payment', 'funds_authorized', 'shipped', 'disputed'].includes(trade.status)) {
                    if (isReceiver) {
                        incomingContainer.appendChild(tradeCard);
                        counts.incoming++;
                    } else {
                        outgoingContainer.appendChild(tradeCard);
                        counts.outgoing++;
                    }
                } else {
                    historyContainer.appendChild(tradeCard);
                    counts.history++;
                }
            }

            if (counts.incoming === 0) incomingContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No active incoming offers.</p>';
            if (counts.outgoing === 0) outgoingContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No active outgoing offers.</p>';
            if (counts.history === 0) historyContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No trade history.</p>';

        }, err => console.error("Error loading trades:", err));
    };

    const createTradeCard = async (trade, tradeId) => {
        const tradeCard = document.createElement('div');
        tradeCard.className = 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md';
        const isProposer = trade.proposerId === user.uid;

        const proposerItemsHtml = renderTradeItems(trade.proposerCards, trade.proposerMoney);
        const receiverItemsHtml = renderTradeItems(trade.receiverCards, trade.receiverMoney);

        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            awaiting_payment: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
            funds_authorized: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
            shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
            completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
            cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
            disputed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
        };
        const statusColor = statusColors[trade.status] || 'bg-gray-100 dark:bg-gray-700';

        const actionButtons = getActionButtons(trade, tradeId, isProposer);

        tradeCard.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        ${isProposer ? `Offer to: <strong>${trade.receiverName}</strong>` : `Offer from: <strong>${trade.proposerName}</strong>`}
                    </p>
                    <p class="text-xs text-gray-400 dark:text-gray-500">On: ${formatTimestamp(trade.createdAt)}</p>
                </div>
                <span class="px-3 py-1 text-sm font-semibold rounded-full ${statusColor}">${(trade.status || 'unknown').replace('_', ' ')}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="border dark:border-gray-600 p-4 rounded-md">
                    <h4 class="font-bold mb-2 dark:text-white">${trade.proposerName} Offers:</h4>
                    <div class="space-y-2">${proposerItemsHtml}</div>
                </div>
                <div class="border dark:border-gray-600 p-4 rounded-md">
                    <h4 class="font-bold mb-2 dark:text-white">${trade.receiverName} Offers:</h4>
                    <div class="space-y-2">${receiverItemsHtml}</div>
                </div>
            </div>
            ${trade.notes ? `<div class="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md"><p class="text-sm italic dark:text-gray-300"><strong>Notes:</strong> ${trade.notes}</p></div>` : ''}
            <div class="mt-4 text-right space-x-2">${actionButtons}</div>
        `;
        return tradeCard;
    };

    const getActionButtons = (trade, tradeId, isProposer) => {
        const isPayer = (trade.proposerMoney > 0 && isProposer) || (trade.receiverMoney > 0 && !isProposer);
        const buyerUid = (trade.proposerMoney || 0) > 0 ? trade.proposerId : trade.receiverId;
        const isBuyer = user.uid === buyerUid;

        switch (trade.status) {
            case 'pending':
                return isProposer
                    ? `<button data-id="${tradeId}" data-action="cancelled" class="trade-action-btn btn-danger">Cancel</button>`
                    : `<button data-id="${tradeId}" data-action="rejected" class="trade-action-btn btn-danger">Decline</button>
                       <button data-id="${tradeId}" data-action="accepted" class="trade-action-btn btn-success">Accept</button>`;
            case 'awaiting_payment':
                 return isPayer
                    ? `<button data-id="${tradeId}" data-action="pay" class="trade-action-btn btn-success">Pay with Escrow.com</button>`
                    : `<span class="text-sm text-gray-500">Waiting for payment...</span>`;
            case 'funds_authorized': // This status means payment is secured by Escrow.com
                const userHasShipped = isProposer ? trade.proposerConfirmedShipment : trade.receiverConfirmedShipment;
                return userHasShipped
                    ? `<span class="text-sm text-gray-500">Waiting for other party to ship...</span>`
                    : `<button data-id="${tradeId}" data-action="confirm-shipment" class="trade-action-btn btn-primary">Confirm Shipment</button>`;
            case 'shipped':
                 if (isBuyer) {
                     return `<button data-id="${tradeId}" data-action="confirm-receipt" class="trade-action-btn btn-success">Confirm Delivery & Release Funds</button>`;
                 } else {
                     return `<span class="text-sm text-gray-500">Waiting for buyer to confirm receipt...</span>`;
                 }
            default:
                return '';
        }
    };

    const handleTradeAction = async (action, tradeId) => {
        const tradeRef = db.collection('trades').doc(tradeId);
        const tradeDoc = await tradeRef.get();
        if (!tradeDoc.exists) return;
        const tradeData = tradeDoc.data();

        if (action === 'accepted') {
            const moneyInvolved = (tradeData.proposerMoney || 0) > 0 || (tradeData.receiverMoney || 0) > 0;
            if (moneyInvolved) {
                 await tradeRef.update({ status: 'accepted' }); // First update status to accepted
                 initiateEscrowTransaction(tradeId, tradeData); // Then create the escrow transaction
            } else {
                 await tradeRef.update({ status: 'funds_authorized' }); // No money, straight to shipment
                 Toastify({ text: "Trade accepted! Ready for shipment.", duration: 3000, style: { background: "linear-gradient(to right, #38a169, #2f855a)" } }).showToast();
            }
        } else if (action === 'pay') {
             // This button now just re-triggers the escrow creation in case the user closed the window
             initiateEscrowTransaction(tradeId, tradeData);
        } else if (action === 'confirm-shipment') {
            const isProposer = tradeData.proposerId === user.uid;
            const fieldToUpdate = isProposer ? 'proposerConfirmedShipment' : 'receiverConfirmedShipment';
            await tradeRef.update({ [fieldToUpdate]: true });

            const updatedDoc = await tradeRef.get();
            if (updatedDoc.data().proposerConfirmedShipment && updatedDoc.data().receiverConfirmedShipment) {
                await tradeRef.update({ status: 'shipped' });
            }
            // Note: with Escrow.com, you must ALSO mark the item as shipped on their platform.
            Toastify({ text: "Shipment confirmed! Remember to also update the status on Escrow.com.", duration: 5000, style: { background: "linear-gradient(to right, #38a169, #2f855a)" } }).showToast();
        } else if (action === 'confirm-receipt') {
            try {
                const releaseEscrowFunds = functions.httpsCallable('releaseEscrowFunds');
                await releaseEscrowFunds({ tradeId });
                Toastify({ text: "Delivery confirmed! The trade is complete.", duration: 3000, style: { background: "linear-gradient(to right, #38a169, #2f855a)" } }).showToast();
            } catch(error) {
                console.error("Error releasing funds:", error);
                Toastify({ text: `Error: ${error.message}`, duration: 5000, style: { background: "linear-gradient(to right, #e53e3e, #c53030)" } }).showToast();
            }
        } else if (['rejected', 'cancelled'].includes(action)) {
            await tradeRef.update({ status: action });
            Toastify({ text: "Trade offer has been updated.", duration: 3000 }).showToast();
        }
    };

     const sendTradeOffer = async () => {
        if (!tradeOffer.receiver) { alert("Please select a trade partner."); return; }
        sendTradeOfferBtn.disabled = true;
        sendTradeOfferBtn.textContent = 'Sending...';

        const tradeData = {
            proposerId: user.uid,
            proposerName: user.displayName,
            receiverId: tradeOffer.receiver.id,
            receiverName: tradeOffer.receiver.displayName,
            participants: [user.uid, tradeOffer.receiver.id],
            proposerCards: tradeOffer.proposerCards.map(c => ({ id: c.id, name: c.name, imageUrl: c.imageUrl, priceUsd: c.priceUsd, priceUsdFoil: c.priceUsdFoil, isFoil: c.isFoil })),
            receiverCards: tradeOffer.receiverCards.map(c => ({ id: c.id, name: c.name, imageUrl: c.imageUrl, priceUsd: c.priceUsd, priceUsdFoil: c.priceUsdFoil, isFoil: c.isFoil })),
            proposerMoney: parseFloat(proposerMoneyInput.value) || 0,
            receiverMoney: parseFloat(receiverMoneyInput.value) || 0,
            notes: document.getElementById('trade-notes').value,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            proposerConfirmedShipment: false, receiverConfirmedShipment: false
        };

        try {
            const docRef = await db.collection('trades').add(tradeData);
            // After adding, we can check if we need to immediately start the escrow process
            // This is handled by the 'accepted' action from the other user.
            Toastify({ text: "Trade offer sent!", duration: 3000, style: { background: "linear-gradient(to right, #38a169, #2f855a)" } }).showToast();
            closeModal(tradeModal);
        } catch (error) {
            console.error("Error sending trade offer:", error);
            alert("Could not send trade offer.");
        } finally {
            sendTradeOfferBtn.disabled = false;
            sendTradeOfferBtn.textContent = 'Send Trade Offer';
        }
    };

    const initiateEscrowTransaction = async (tradeId, tradeData) => {
        const createEscrowTransaction = functions.httpsCallable('createEscrowTransaction');

        const buyerUid = (tradeData.proposerMoney > 0) ? tradeData.proposerId : tradeData.receiverId;
        const sellerUid = (tradeData.proposerMoney > 0) ? tradeData.receiverId : tradeData.proposerId;
        const amount = Math.max(tradeData.proposerMoney, tradeData.receiverMoney);

        const description = `Trade of TCG cards between ${tradeData.proposerName} and ${tradeData.receiverName}.`;

        Toastify({ text: "Creating secure transaction... Please wait.", duration: 4000 }).showToast();

        try {
            const result = await createEscrowTransaction({
                tradeId,
                buyerUid,
                sellerUid,
                amount,
                description
            });

            if (result.data.success && result.data.paymentUrl) {
                // Redirect the buyer to Escrow.com to complete the payment
                window.location.href = result.data.paymentUrl;
            } else {
                 throw new Error("Failed to get payment URL from server.");
            }

        } catch (error) {
             console.error("Error creating Escrow.com transaction:", error);
             Toastify({ text: `Escrow Error: ${error.message}`, duration: 5000, style: { background: "linear-gradient(to right, #e53e3e, #c53030)" } }).showToast();
        }
    };

    const openProposeTradeModal = async (options = {}) => {
        const { counterOfTrade = null, initialCard = null, initialPartner = null } = options;
        tradeOffer = { proposerCards: [], receiverCards: [], proposerMoney: 0, receiverMoney: 0, receiver: null };
        document.getElementById('proposer-selected-cards').innerHTML = '<p class="text-sm text-gray-500 italic">No cards selected.</p>';
        document.getElementById('receiver-selected-cards').innerHTML = '<p class="text-sm text-gray-500 italic">No cards selected.</p>';
        counterOfferInput.value = '';
        tradePartnerSearch.value = '';

        const myCollectionList = document.getElementById('my-collection-list');
        myCollectionList.innerHTML = '<p class="text-sm text-gray-500 p-2">Loading your collection...</p>';
        const snapshot = await db.collection('users').doc(user.uid).collection('collection').where('forSale', '==', true).get();
        myCollectionForTrade = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCollectionForTrade(myCollectionForTrade, 'proposer', 'list');

        if (initialPartner) {
            await selectTradePartner(initialPartner);
            if (initialCard) {
                selectCardForTrade(initialCard, 'receiver');
            }
        }
        updateTotalValueUI();
        openModal(tradeModal);
    };

    const selectTradePartner = async (partner) => {
        tradeOffer.receiver = partner;
        tradePartnerSearch.value = `@${partner.handle}`;
        tradePartnerResults.innerHTML = '';
        tradePartnerResults.classList.add('hidden');
        document.getElementById('receiver-trade-section').classList.remove('opacity-50', 'pointer-events-none');
        document.getElementById('receiver-selected-cards').innerHTML = '<p class="text-sm text-gray-500 italic">No cards selected.</p>';

        const theirCollectionList = document.getElementById('their-collection-list');
        theirCollectionList.innerHTML = '<p class="text-sm text-gray-500 p-2">Loading collection...</p>';
        const snapshot = await db.collection('users').doc(partner.id).collection('collection').where('forSale', '==', true).get();
        theirCollectionForTrade = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCollectionForTrade(theirCollectionForTrade, 'receiver', 'list');
    };

    const renderCollectionForTrade = (cards, side, viewType) => {
        const listContainer = document.getElementById(side === 'proposer' ? 'my-collection-list' : 'their-collection-list');
        const binderContainer = document.getElementById(side === 'proposer' ? 'my-collection-binder' : 'their-collection-binder');
        listContainer.innerHTML = '';
        binderContainer.innerHTML = '';

        if (cards.length === 0) {
            const noCardsMsg = '<p class="text-sm text-gray-500 p-2 italic col-span-full">No cards found for trade.</p>';
            listContainer.innerHTML = noCardsMsg;
            binderContainer.innerHTML = noCardsMsg;
            return;
        }

        if (viewType === 'list') {
            cards.forEach(card => {
                const cardEl = document.createElement('div');
                cardEl.className = 'flex items-center justify-between p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded cursor-pointer';
                const price = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
                cardEl.innerHTML = `<span class="text-sm truncate dark:text-gray-300">${card.name}</span><div class="flex items-center"><span class="text-xs text-gray-500 dark:text-gray-400 mr-2">${(price * USD_TO_SEK_RATE).toFixed(2)} SEK</span><i class="fas fa-plus-circle text-green-500"></i></div>`;
                cardEl.addEventListener('click', () => selectCardForTrade(card, side));
                listContainer.appendChild(cardEl);
            });
        } else { // Binder view
            cards.forEach(card => {
                const cardEl = document.createElement('div');
                cardEl.className = 'relative cursor-pointer group';
                cardEl.innerHTML = `<img src="${card.imageUrl || 'https://placehold.co/223x310'}" alt="${card.name}" class="w-full rounded-md shadow-sm transition-transform group-hover:scale-105"><div class="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i class="fas fa-plus-circle text-white text-2xl"></i></div>`;
                cardEl.addEventListener('click', () => selectCardForTrade(card, side));
                binderContainer.appendChild(cardEl);
            });
        }
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
            container.innerHTML = `<p class="text-sm text-gray-500 italic">No cards selected.</p>`;
        } else {
            container.innerHTML = '';
            cards.forEach(card => {
                const cardEl = document.createElement('div');
                cardEl.className = 'flex items-center justify-between p-1 bg-blue-100 dark:bg-blue-900/50 rounded';
                cardEl.innerHTML = `<span class="text-sm truncate dark:text-gray-200">${card.name}</span><button data-card-id="${card.id}" data-side="${side}" class="remove-trade-item-btn text-red-500 hover:text-red-700"><i class="fas fa-times-circle"></i></button>`;
                container.appendChild(cardEl);
            });
        }
        updateTotalValueUI();
    };

    const updateTotalValueUI = () => {
        let proposerValue = 0;
        tradeOffer.proposerCards.forEach(card => {
            proposerValue += parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
        });
        proposerValue += (parseFloat(proposerMoneyInput.value) || 0) / USD_TO_SEK_RATE;
        const proposerValueEl = document.getElementById('proposer-value');
        if (proposerValueEl) proposerValueEl.textContent = `${(proposerValue * USD_TO_SEK_RATE).toFixed(2)} SEK`;

        let receiverValue = 0;
        tradeOffer.receiverCards.forEach(card => {
            receiverValue += parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
        });
        receiverValue += (parseFloat(receiverMoneyInput.value) || 0) / USD_TO_SEK_RATE;
        const receiverValueEl = document.getElementById('receiver-value');
        if(receiverValueEl) receiverValueEl.textContent = `${(receiverValue * USD_TO_SEK_RATE).toFixed(2)} SEK`;
    };

    const checkForUrlParams = async () => {
        const params = new URLSearchParams(window.location.search);
        const userToTradeWith = params.get('with');
        if (userToTradeWith) {
            const userDoc = await db.collection('users').doc(userToTradeWith).get();
            if (userDoc.exists) {
                openProposeTradeModal({ initialPartner: { id: userDoc.id, ...userDoc.data() } });
            }
        }
    };

    const openModal = (modal) => modal.classList.add('open');
    const closeModal = (modal) => modal.classList.remove('open');
    const renderTradeItems = (cards = [], money = 0) => {
        let itemsHtml = cards.map(card => `<div class="flex items-center space-x-2"><img src="${card.imageUrl || 'https://placehold.co/32x44'}" class="w-8 h-11 object-cover rounded-sm"><span class="text-sm dark:text-gray-300">${card.name} ${card.isFoil ? '<i class="fas fa-star text-yellow-400"></i>' : ''}</span></div>`).join('');
        if (money > 0) itemsHtml += `<div class="flex items-center space-x-2 mt-2 pt-2 border-t dark:border-gray-600"><i class="fas fa-money-bill-wave text-green-500"></i><span class="text-sm font-semibold dark:text-gray-300">${money.toFixed(2)} SEK</span></div>`;
        return itemsHtml || '<p class="text-sm text-gray-500 italic">No items</p>';
    };

    const addEventListeners = () => {
        tabs.forEach(button => {
            button.addEventListener('click', () => {
                tabs.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                document.querySelectorAll('.trade-tab-content').forEach(content => content.classList.add('hidden'));
                const targetContent = document.getElementById(`tab-content-${button.dataset.tab}`);
                if (targetContent) targetContent.classList.remove('hidden');
            });
        });
        proposeNewTradeBtn?.addEventListener('click', () => openProposeTradeModal());
        sendTradeOfferBtn?.addEventListener('click', sendTradeOffer);
        closeTradeModalBtn?.addEventListener('click', () => closeModal(tradeModal));

        tradePartnerSearch?.addEventListener('input', async (e) => {
            const query = e.target.value.toLowerCase();
            if (query.length < 2) {
                tradePartnerResults.innerHTML = '';
                tradePartnerResults.classList.add('hidden');
                return;
            }

            const usersRef = db.collection('users');
            // Firestore does not support case-insensitive or partial text search natively.
            // A common workaround is to use >= and < queries on a known field.
            const endQuery = query + '\uf8ff';
            const snapshot = await usersRef.where('handle', '>=', query).where('handle', '<', endQuery).limit(10).get();

            tradePartnerResults.innerHTML = '';
            if (snapshot.empty) {
                tradePartnerResults.innerHTML = '<p class="p-2 text-sm text-gray-500">No users found.</p>';
            } else {
                snapshot.forEach(doc => {
                    if (doc.id === user.uid) return; // Don't show the current user
                    const userData = doc.data();
                    const resultEl = document.createElement('div');
                    resultEl.className = 'p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
                    resultEl.textContent = `@${userData.handle}`;
                    resultEl.addEventListener('click', () => selectTradePartner({ id: doc.id, ...userData }));
                    tradePartnerResults.appendChild(resultEl);
                });
            }
            tradePartnerResults.classList.remove('hidden');
        });


        document.body.addEventListener('click', (e) => {
            const button = e.target.closest('button.trade-action-btn');
            if (button) {
                handleTradeAction(button.dataset.action, button.dataset.id);
            }
        });

        if(tradeModal) {
            tradeModal.addEventListener('click', (e) => {
                const button = e.target.closest('.remove-trade-item-btn');
                if (button) {
                    removeCardFromTrade(button.dataset.cardId, button.dataset.side);
                }
            });
        }
    };

    initializePage();
});

// --- NEW TRADING FEATURES ---

// Trade Window Management
class TradeWindow {
    constructor() {
        this.currentTrade = {
            yourCards: [],
            theirCards: [],
            yourValue: 0,
            theirValue: 0,
            partner: null
        };
        this.initializeTradeWindow();
    }

    initializeTradeWindow() {
        // Add event listeners for trade window functionality
        document.addEventListener('DOMContentLoaded', () => {
            this.setupTradeWindowEvents();
            this.setupAutobalance();
            this.setupEscrowIntegration();
        });
    }

    setupTradeWindowEvents() {
        // Binder tab switching
        const binderTabs = document.querySelectorAll('[data-binder]');
        binderTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchBinder(e.target.dataset.binder);
            });
        });

        // Game filters
        const gameFilters = document.querySelectorAll('.game-filter');
        gameFilters.forEach(filter => {
            filter.addEventListener('change', () => {
                this.applyFilters();
            });
        });

        // Search functionality
        const binderSearch = document.getElementById('binder-search');
        if (binderSearch) {
            binderSearch.addEventListener('input', (e) => {
                this.searchCards(e.target.value);
            });
        }

        // View toggle
        const viewToggles = document.querySelectorAll('#view-toggle-grid, #view-toggle-list');
        viewToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                this.switchView(e.target.id.includes('grid') ? 'grid' : 'list');
            });
        });
    }

    switchBinder(binderType) {
        const tabs = document.querySelectorAll('[data-binder]');
        tabs.forEach(tab => {
            tab.classList.remove('border-blue-600', 'text-blue-600');
            tab.classList.add('border-transparent', 'text-gray-500');
        });

        const activeTab = document.querySelector(`[data-binder="${binderType}"]`);
        if (activeTab) {
            activeTab.classList.add('border-blue-600', 'text-blue-600');
            activeTab.classList.remove('border-transparent', 'text-gray-500');
        }

        if (binderType === 'your') {
            this.loadYourCollection();
        } else if (binderType === 'their' && this.currentTrade.partner) {
            this.loadPartnerCollection();
        }
    }

    async loadYourCollection() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('users').doc(user.uid).collection('collection').get();
            const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderBinder(cards, 'your');
        } catch (error) {
            console.error('Error loading your collection:', error);
            this.showToast('Failed to load your collection', 'error');
        }
    }

    async loadPartnerCollection() {
        if (!this.currentTrade.partner) return;

        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('users').doc(this.currentTrade.partner.uid).collection('collection').get();
            const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.renderBinder(cards, 'their');
        } catch (error) {
            console.error('Error loading partner collection:', error);
            this.showToast('Failed to load partner collection', 'error');
        }
    }

    renderBinder(cards, owner) {
        const binderContent = document.getElementById('binder-content');
        if (!binderContent) return;

        const filteredCards = this.filterCards(cards);
        const currentView = document.getElementById('view-toggle-grid').classList.contains('bg-blue-600') ? 'grid' : 'list';

        if (currentView === 'grid') {
            binderContent.innerHTML = `
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    ${filteredCards.map(card => this.renderCardGrid(card, owner)).join('')}
                </div>
            `;
        } else {
            binderContent.innerHTML = `
                <div class="space-y-2">
                    ${filteredCards.map(card => this.renderCardList(card, owner)).join('')}
                </div>
            `;
        }

        // Add click handlers for adding cards to trade
        binderContent.querySelectorAll('.trade-card-item').forEach(item => {
            item.addEventListener('click', () => {
                const cardId = item.dataset.cardId;
                const card = filteredCards.find(c => c.id === cardId);
                if (card) {
                    this.addCardToTrade(card, owner);
                }
            });
        });
    }

    renderCardGrid(card, owner) {
        const imageUrl = this.getCardImageUrl(card);
        const price = this.formatPrice(card.prices);
        
        return `
            <div class="trade-card-item bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" data-card-id="${card.id}">
                <img src="${imageUrl}" alt="${card.name}" class="w-full h-32 object-cover">
                <div class="p-2">
                    <h4 class="text-xs font-medium text-gray-900 dark:text-white truncate">${card.name}</h4>
                    <p class="text-xs text-gray-600 dark:text-gray-400">${price}</p>
                </div>
            </div>
        `;
    }

    renderCardList(card, owner) {
        const imageUrl = this.getCardImageUrl(card);
        const price = this.formatPrice(card.prices);
        
        return `
            <div class="trade-card-item flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow" data-card-id="${card.id}">
                <img src="${imageUrl}" alt="${card.name}" class="w-12 h-16 object-cover rounded mr-3">
                <div class="flex-1">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white">${card.name}</h4>
                    <p class="text-xs text-gray-600 dark:text-gray-400">${card.set_name || 'Unknown Set'}</p>
                    <p class="text-xs text-green-600 dark:text-green-400">${price}</p>
                </div>
                <div class="text-right">
                    <span class="text-xs text-gray-500">Qty: ${card.quantity || 1}</span>
                </div>
            </div>
        `;
    }

    addCardToTrade(card, owner) {
        const tradeSection = owner === 'your' ? 'yourCards' : 'theirCards';
        
        // Check if card is already in trade
        const existingCard = this.currentTrade[tradeSection].find(c => c.id === card.id);
        if (existingCard) {
            this.showToast('Card already in trade', 'warning');
            return;
        }

        this.currentTrade[tradeSection].push(card);
        this.updateTradeDisplay();
        this.calculateTradeValues();
        this.showToast(`Added ${card.name} to trade`, 'success');
    }

    removeCardFromTrade(cardId, owner) {
        const tradeSection = owner === 'your' ? 'yourCards' : 'theirCards';
        this.currentTrade[tradeSection] = this.currentTrade[tradeSection].filter(c => c.id !== cardId);
        this.updateTradeDisplay();
        this.calculateTradeValues();
    }

    updateTradeDisplay() {
        this.updateTradeSection('your', this.currentTrade.yourCards);
        this.updateTradeSection('their', this.currentTrade.theirCards);
    }

    updateTradeSection(owner, cards) {
        const container = document.getElementById(`${owner}-trade-cards`);
        if (!container) return;

        if (cards.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="fas fa-${owner === 'your' ? 'plus-circle' : 'user-plus'} text-3xl mb-2"></i>
                    <p>${owner === 'your' ? 'Add cards from your collection' : "Partner's cards will appear here"}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = cards.map(card => `
            <div class="flex items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                <img src="${this.getCardImageUrl(card)}" alt="${card.name}" class="w-8 h-10 object-cover rounded mr-2">
                <div class="flex-1">
                    <p class="text-xs font-medium text-gray-900 dark:text-white">${card.name}</p>
                    <p class="text-xs text-gray-600 dark:text-gray-400">${this.formatPrice(card.prices)}</p>
                </div>
                <button class="text-red-500 hover:text-red-700 ml-2" onclick="tradeWindow.removeCardFromTrade('${card.id}', '${owner}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    calculateTradeValues() {
        this.currentTrade.yourValue = this.currentTrade.yourCards.reduce((sum, card) => {
            return sum + (this.getCardValue(card) || 0);
        }, 0);

        this.currentTrade.theirValue = this.currentTrade.theirCards.reduce((sum, card) => {
            return sum + (this.getCardValue(card) || 0);
        }, 0);

        // Update UI
        const yourValueEl = document.getElementById('your-trade-value');
        const theirValueEl = document.getElementById('their-trade-value');
        
        if (yourValueEl) yourValueEl.textContent = this.formatCurrency(this.currentTrade.yourValue);
        if (theirValueEl) theirValueEl.textContent = this.formatCurrency(this.currentTrade.theirValue);

        // Enable/disable autobalance and propose buttons
        this.updateTradeButtons();
    }

    updateTradeButtons() {
        const autobalanceBtn = document.getElementById('autobalance-btn');
        const proposeBtn = document.getElementById('propose-trade-btn');
        
        const hasCards = this.currentTrade.yourCards.length > 0 || this.currentTrade.theirCards.length > 0;
        const hasPartner = this.currentTrade.partner !== null;
        
        if (autobalanceBtn) {
            autobalanceBtn.disabled = !hasCards;
        }
        
        if (proposeBtn) {
            proposeBtn.disabled = !hasCards || !hasPartner;
        }
    }

    // Autobalance functionality
    setupAutobalance() {
        const autobalanceBtn = document.getElementById('autobalance-btn');
        if (autobalanceBtn) {
            autobalanceBtn.addEventListener('click', () => {
                this.showAutobalanceModal();
            });
        }

        const closeAutobalanceBtn = document.getElementById('close-autobalance-modal');
        if (closeAutobalanceBtn) {
            closeAutobalanceBtn.addEventListener('click', () => {
                this.hideAutobalanceModal();
            });
        }

        const applyAutobalanceBtn = document.getElementById('apply-autobalance');
        if (applyAutobalanceBtn) {
            applyAutobalanceBtn.addEventListener('click', () => {
                this.applyAutobalanceSuggestions();
            });
        }
    }

    showAutobalanceModal() {
        const modal = document.getElementById('autobalance-modal');
        if (!modal) return;

        const yourValue = this.currentTrade.yourValue;
        const theirValue = this.currentTrade.theirValue;
        const difference = Math.abs(yourValue - theirValue);

        document.getElementById('autobalance-your-value').textContent = this.formatCurrency(yourValue);
        document.getElementById('autobalance-their-value').textContent = this.formatCurrency(theirValue);
        document.getElementById('autobalance-difference').textContent = this.formatCurrency(difference);

        this.generateAutobalanceSuggestions(yourValue, theirValue, difference);
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    hideAutobalanceModal() {
        const modal = document.getElementById('autobalance-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    generateAutobalanceSuggestions(yourValue, theirValue, difference) {
        const suggestionsContainer = document.getElementById('autobalance-suggestions');
        if (!suggestionsContainer) return;

        const needsMore = yourValue < theirValue ? 'your' : 'their';
        const suggestions = [];

        // Cash suggestion
        if (difference > 1) {
            suggestions.push({
                type: 'cash',
                side: needsMore,
                amount: difference,
                description: `Add ${this.formatCurrency(difference)} cash to ${needsMore === 'your' ? 'your' : 'their'} side`
            });
        }

        // Card suggestions (simplified - would need more complex logic in production)
        suggestions.push({
            type: 'card',
            side: needsMore,
            description: `Add cards worth approximately ${this.formatCurrency(difference)} to ${needsMore === 'your' ? 'your' : 'their'} side`
        });

        suggestionsContainer.innerHTML = suggestions.map(suggestion => `
            <div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div class="flex items-center justify-between">
                    <span class="text-sm">${suggestion.description}</span>
                    <button class="px-3 py-1 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700" 
                            onclick="tradeWindow.applySuggestion('${suggestion.type}', '${suggestion.side}', ${suggestion.amount || 0})">
                        Apply
                    </button>
                </div>
            </div>
        `).join('');
    }

    applySuggestion(type, side, amount) {
        if (type === 'cash') {
            // For now, just show escrow modal
            this.showEscrowModal(amount);
        } else {
            this.showToast('Card suggestions require manual selection', 'info');
        }
    }

    // Escrow.com Integration
    setupEscrowIntegration() {
        const closeEscrowBtn = document.getElementById('close-escrow-modal');
        if (closeEscrowBtn) {
            closeEscrowBtn.addEventListener('click', () => {
                this.hideEscrowModal();
            });
        }

        const proceedEscrowBtn = document.getElementById('proceed-escrow');
        if (proceedEscrowBtn) {
            proceedEscrowBtn.addEventListener('click', () => {
                this.processEscrowPayment();
            });
        }
    }

    showEscrowModal(amount) {
        const modal = document.getElementById('escrow-modal');
        if (!modal) return;

        const escrowFee = amount * 0.008; // 0.8%
        const platformFee = amount * 0.027; // 2.7%
        const total = amount + escrowFee + platformFee;

        document.getElementById('escrow-trade-amount').textContent = this.formatCurrency(amount);
        document.getElementById('escrow-fee').textContent = this.formatCurrency(escrowFee);
        document.getElementById('platform-fee').textContent = this.formatCurrency(platformFee);
        document.getElementById('escrow-total').textContent = this.formatCurrency(total);

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    hideEscrowModal() {
        const modal = document.getElementById('escrow-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    async processEscrowPayment() {
        try {
            // This would integrate with Escrow.com API
            this.showToast('Redirecting to Escrow.com for secure payment...', 'info');
            
            // For now, just simulate the process
            setTimeout(() => {
                this.showToast('Escrow payment initiated successfully', 'success');
                this.hideEscrowModal();
            }, 2000);
            
        } catch (error) {
            console.error('Escrow payment error:', error);
            this.showToast('Failed to process escrow payment', 'error');
        }
    }

    // Utility functions
    filterCards(cards) {
        const selectedGames = Array.from(document.querySelectorAll('.game-filter:checked')).map(cb => cb.dataset.game);
        const searchTerm = document.getElementById('binder-search')?.value.toLowerCase() || '';

        return cards.filter(card => {
            const matchesGame = selectedGames.length === 0 || selectedGames.includes(card.game);
            const matchesSearch = !searchTerm || card.name.toLowerCase().includes(searchTerm);
            return matchesGame && matchesSearch;
        });
    }

    applyFilters() {
        // Re-render current binder with new filters
        const activeTab = document.querySelector('[data-binder].border-blue-600');
        if (activeTab) {
            this.switchBinder(activeTab.dataset.binder);
        }
    }

    searchCards(searchTerm) {
        this.applyFilters();
    }

    switchView(viewType) {
        const gridBtn = document.getElementById('view-toggle-grid');
        const listBtn = document.getElementById('view-toggle-list');

        if (viewType === 'grid') {
            gridBtn.classList.add('bg-blue-600', 'text-white');
            gridBtn.classList.remove('bg-gray-300', 'text-gray-700');
            listBtn.classList.add('bg-gray-300', 'text-gray-700');
            listBtn.classList.remove('bg-blue-600', 'text-white');
        } else {
            listBtn.classList.add('bg-blue-600', 'text-white');
            listBtn.classList.remove('bg-gray-300', 'text-gray-700');
            gridBtn.classList.add('bg-gray-300', 'text-gray-700');
            gridBtn.classList.remove('bg-blue-600', 'text-white');
        }

        this.applyFilters();
    }

    getCardImageUrl(card) {
        if (card.image_uris?.normal) return card.image_uris.normal;
        if (card.image_uris?.large) return card.image_uris.large;
        if (card.image_uris?.small) return card.image_uris.small;
        return 'https://placehold.co/223x310?text=No+Image';
    }

    getCardValue(card) {
        if (card.prices?.usd) return parseFloat(card.prices.usd);
        if (card.prices?.eur) return parseFloat(card.prices.eur) * 1.1; // Rough conversion
        return 0;
    }

    formatPrice(prices) {
        if (prices?.usd) return `$${parseFloat(prices.usd).toFixed(2)}`;
        if (prices?.eur) return `€${parseFloat(prices.eur).toFixed(2)}`;
        return 'N/A';
    }

    formatCurrency(amount) {
        return `$${amount.toFixed(2)}`;
    }

    showToast(message, type = 'info') {
        // Simple toast implementation
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg text-white ${
            type === 'success' ? 'bg-green-600' : 
            type === 'error' ? 'bg-red-600' : 
            type === 'warning' ? 'bg-yellow-600' : 'bg-blue-600'
        }`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Marketplace Integration
class MarketplaceIntegration {
    static addCardToTradeFromMarketplace(cardData) {
        if (window.tradeWindow) {
            // Convert marketplace card to trade format
            const tradeCard = {
                id: cardData.id || cardData.api_id,
                name: cardData.cardData?.name || cardData.name,
                prices: cardData.cardData?.prices || cardData.prices,
                image_uris: cardData.cardData?.image_uris || cardData.image_uris,
                set_name: cardData.cardData?.set_name || cardData.set_name,
                quantity: 1
            };
            
            window.tradeWindow.addCardToTrade(tradeCard, 'their');
            window.tradeWindow.showToast(`Added ${tradeCard.name} to trade window`, 'success');
        }
    }
}

// Tour.js Integration
class TradingTour {
    constructor() {
        this.tour = null;
        this.initializeTour();
    }

    initializeTour() {
        if (typeof Shepherd === 'undefined') {
            console.warn('Shepherd.js not loaded, tour functionality disabled');
            return;
        }

        this.tour = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                classes: 'shadow-md bg-purple-dark',
                scrollTo: true
            }
        });

        this.setupTourSteps();
        this.setupTourTrigger();
    }

    setupTourSteps() {
        this.tour.addStep({
            id: 'welcome',
            text: 'Welcome to the HatakeSocial Trading Center! Let me show you how to trade cards securely.',
            buttons: [{
                text: 'Next',
                action: this.tour.next
            }]
        });

        this.tour.addStep({
            id: 'trade-window',
            text: 'This is your trade window. Cards you want to trade will appear here, along with their values.',
            attachTo: {
                element: '#your-trade-cards',
                on: 'right'
            },
            buttons: [{
                text: 'Back',
                action: this.tour.back
            }, {
                text: 'Next',
                action: this.tour.next
            }]
        });

        this.tour.addStep({
            id: 'binder-view',
            text: 'Browse your collection or your partner\'s collection here. Click on cards to add them to the trade.',
            attachTo: {
                element: '#binder-content',
                on: 'left'
            },
            buttons: [{
                text: 'Back',
                action: this.tour.back
            }, {
                text: 'Next',
                action: this.tour.next
            }]
        });

        this.tour.addStep({
            id: 'autobalance',
            text: 'Use the Auto Balance feature to get suggestions for equalizing trade values with cards or cash.',
            attachTo: {
                element: '#autobalance-btn',
                on: 'top'
            },
            buttons: [{
                text: 'Back',
                action: this.tour.back
            }, {
                text: 'Next',
                action: this.tour.next
            }]
        });

        this.tour.addStep({
            id: 'secure-payment',
            text: 'All cash transactions are secured through Escrow.com, ensuring safe trades for everyone.',
            buttons: [{
                text: 'Back',
                action: this.tour.back
            }, {
                text: 'Finish',
                action: this.tour.complete
            }]
        });
    }

    setupTourTrigger() {
        const tourBtn = document.getElementById('start-tour-btn');
        if (tourBtn) {
            tourBtn.classList.remove('hidden');
            tourBtn.addEventListener('click', () => {
                this.startTour();
            });
        }
    }

    startTour() {
        if (this.tour) {
            this.tour.start();
        }
    }
}

// Initialize new trading features
let tradeWindow, marketplaceIntegration, tradingTour;

document.addEventListener('DOMContentLoaded', () => {
    tradeWindow = new TradeWindow();
    marketplaceIntegration = new MarketplaceIntegration();
    tradingTour = new TradingTour();
    
    // Make tradeWindow globally accessible for onclick handlers
    window.tradeWindow = tradeWindow;
    window.MarketplaceIntegration = MarketplaceIntegration;
});
