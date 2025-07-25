/**
 * HatakeSocial - Advanced Trades Page Script (v18 - Client-Side Inventory Transfer)
 *
 * This script implements a comprehensive and secure trading system.
 * - NEW: Adds client-side logic to transfer card ownership when a trade is completed.
 * - This is an interim solution until a backend function can be deployed.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const tradesPageContainer = document.querySelector('main.container');
    if (!tradesPageContainer || !document.getElementById('tab-content-incoming')) return;

    if (!user) {
        tradesPageContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to view your trades.</p>';
        return;
    }

    // --- DOM Elements ---
    const incomingContainer = document.getElementById('tab-content-incoming');
    const outgoingContainer = document.getElementById('tab-content-outgoing');
    const historyContainer = document.getElementById('tab-content-history');
    const analysisContainer = document.getElementById('tab-content-analysis');
    const tabs = document.querySelectorAll('.trade-tab-button');
    const proposeNewTradeBtn = document.getElementById('propose-new-trade-btn');

    // Modals
    const tradeModal = document.getElementById('propose-trade-modal');
    const feedbackModal = document.getElementById('feedback-modal');
    const disputeModal = document.getElementById('dispute-modal');
    const autoBalanceModal = document.getElementById('auto-balance-modal');

    // Trade Modal Elements
    const closeTradeModalBtn = document.getElementById('close-trade-modal');
    const sendTradeOfferBtn = document.getElementById('send-trade-offer-btn');
    const tradePartnerSearch = document.getElementById('trade-partner-search');
    const tradePartnerResults = document.getElementById('trade-partner-results');
    const myCollectionSearch = document.getElementById('my-collection-search');
    const theirCollectionSearch = document.getElementById('their-collection-search');
    const proposerValueEl = document.getElementById('proposer-value');
    const receiverValueEl = document.getElementById('receiver-value');
    const proposerMoneyInput = document.getElementById('proposer-money');
    const receiverMoneyInput = document.getElementById('receiver-money');
    const counterOfferInput = document.getElementById('counter-offer-original-id');

    // Auto-Balance Modal Elements
    const closeBalanceModalBtn = document.getElementById('close-balance-modal');
    const autoBalanceForm = document.getElementById('auto-balance-form');
    const balanceTargetSideInput = document.getElementById('balance-target-side');

    // Feedback Modal Elements
    const feedbackForm = document.getElementById('feedback-form');
    const closeFeedbackModalBtn = document.getElementById('close-feedback-modal');
    const starRatingContainers = document.querySelectorAll('.star-rating-container');

    // Dispute Modal Elements
    const disputeForm = document.getElementById('dispute-form');
    const closeDisputeModalBtn = document.getElementById('close-dispute-modal');

    // --- State Variables ---
    let myCollectionForTrade = [];
    let theirCollectionForTrade = [];
    let tradeOffer = {
        proposerCards: [],
        receiverCards: [],
        proposerMoney: 0,
        receiverMoney: 0,
        receiver: null
    };
    const USD_TO_SEK_RATE = 10.5; // Example rate

    // --- Helper Functions ---
    const generateIndexCreationLink = (collection, fields) => {
        const projectId = db.app.options.projectId;
        let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=${collection}`;
        fields.forEach(field => {
            url += `&fields=${field.name},${field.order.toUpperCase()}`;
        });
        return url;
    };

    const displayIndexError = (container, link) => {
        const errorMessage = `
            <div class="col-span-full text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">
                <p class="font-bold text-red-700 dark:text-red-300">Database Error</p>
                <p class="text-red-600 dark:text-red-400 mt-2">A required database index is missing for this query.</p>
                <a href="${link}" target="_blank" rel="noopener noreferrer"
                   class="mt-4 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700">
                   Click Here to Create the Index
                </a>
                <p class="text-xs text-gray-500 mt-2">This will open the Firebase console. Click "Save" to create the index. It may take a few minutes.</p>
            </div>
         `;
        container.innerHTML = errorMessage;
    };
    
    const loadTradeAnalysis = async () => {
        analysisContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">Loading trade analysis...</p>';

        try {
            const tradesSnapshot = await db.collection('trades')
                .where('participants', 'array-contains', user.uid)
                .where('status', '==', 'completed')
                .get();

            if (tradesSnapshot.empty) {
                analysisContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No completed trades to analyze.</p>';
                return;
            }

            let analysisHTML = `
                <div class="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead class="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Card Name</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Purchase Price</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Sale Value</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Profit</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            `;

            for (const doc of tradesSnapshot.docs) {
                const trade = doc.data();
                const isProposer = trade.proposerId === user.uid;
                const cardsSold = isProposer ? trade.proposerCards : trade.receiverCards;
                const moneyReceived = isProposer ? trade.receiverMoney : trade.proposerMoney;

                for (const card of cardsSold) {
                    const purchasePrice = card.purchasePrice || 0;
                    const saleValue = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) * USD_TO_SEK_RATE || 0;
                    const profit = saleValue - purchasePrice + (moneyReceived / cardsSold.length); // Distribute money received over all cards
                    const profitColor = profit >= 0 ? 'text-green-500' : 'text-red-500';

                    analysisHTML += `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${card.name} ${card.isFoil ? '<i class="fas fa-star text-yellow-400"></i>' : ''}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${purchasePrice.toFixed(2)} SEK</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${saleValue.toFixed(2)} SEK</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${profitColor}">${profit.toFixed(2)} SEK</td>
                        </tr>
                    `;
                }
            }

            analysisHTML += `</tbody></table></div>`;
            analysisContainer.innerHTML = analysisHTML;

        } catch (error) {
            console.error("Error loading trade analysis:", error);
            analysisContainer.innerHTML = '<p class="text-center text-red-500 p-4">Could not load trade analysis.</p>';
        }
    };

    // --- Tab Switching Logic ---
    if(proposeNewTradeBtn) proposeNewTradeBtn.classList.remove('hidden');
    tabs.forEach(button => {
        button.addEventListener('click', () => {
            tabs.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            document.querySelectorAll('.trade-tab-content').forEach(content => content.classList.add('hidden'));
            const targetContent = document.getElementById(`tab-content-${button.dataset.tab}`);
            if(targetContent) targetContent.classList.remove('hidden');
            
            if(button.dataset.tab === 'analysis'){
                loadTradeAnalysis();
            }
        });
    });

    // --- Main Loading Functions ---
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

            let hasIncoming = false, hasOutgoing = false, hasHistory = false;

            for (const doc of snapshot.docs) {
                const trade = doc.data();
                const tradeCard = await createTradeCard(trade, doc.id);

                if (['pending', 'accepted', 'shipped', 'disputed'].includes(trade.status) && trade.receiverId === user.uid) {
                    incomingContainer.appendChild(tradeCard);
                    hasIncoming = true;
                } else if (['pending', 'accepted', 'shipped', 'disputed'].includes(trade.status) && trade.proposerId === user.uid) {
                    outgoingContainer.appendChild(tradeCard);
                    hasOutgoing = true;
                } else if (['completed', 'rejected', 'countered'].includes(trade.status)) {
                    historyContainer.appendChild(tradeCard);
                    hasHistory = true;
                }
            }

            if (!hasIncoming) incomingContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No active incoming offers.</p>';
            if (!hasOutgoing) outgoingContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No active outgoing offers.</p>';
            if (!hasHistory) historyContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No trade history.</p>';

        }, err => {
            console.error("Error loading trades:", err);
            if (err.code === 'failed-precondition') {
                const indexLink = generateIndexCreationLink('trades', [{ name: 'participants', order: 'asc' }, { name: 'createdAt', order: 'desc' }]);
                displayIndexError(incomingContainer, indexLink);
                outgoingContainer.innerHTML = '';
                historyContainer.innerHTML = '';
            } else {
                incomingContainer.innerHTML = `<p class="text-red-500 p-4 text-center">An unknown error occurred.</p>`;
            }
        });
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
            shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
            completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
            countered: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
            disputed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
        };
        const statusColor = statusColors[trade.status] || 'bg-gray-100 dark:bg-gray-700';

        let actionButtons = '';
        let tradeStatusSection = '';
        let shippingInfoHTML = '';

        const formatAddress = (userData) => {
            if (!userData || !userData.address) {
                return userData.displayName || 'Address not available';
            }
            const parts = [
                userData.displayName,
                userData.address.street,
                `${userData.address.zip || ''} ${userData.address.city || ''}`.trim(),
                userData.address.country
            ];
            return parts.filter(part => part && part.trim() !== '').join('<br>');
        };

        const formatPayout = (userData) => {
            if (!userData || !userData.payoutDetails) {
                return 'Payout details not provided.';
            }
            const { iban, swift, clearing, bankAccount } = userData.payoutDetails;
            let details = [];
            if (iban) details.push(`<strong>IBAN:</strong> ${iban}`);
            if (swift) details.push(`<strong>SWIFT/BIC:</strong> ${swift}`);
            if (clearing) details.push(`<strong>Clearing Nr:</strong> ${clearing}`);
            if (bankAccount) details.push(`<strong>Account Nr:</strong> ${bankAccount}`);
            return details.length > 0 ? details.join('<br>') : 'No payout details available.';
        };

        if (['accepted', 'shipped', 'completed'].includes(trade.status)) {
            try {
                const proposerDoc = await db.collection('users').doc(trade.proposerId).get();
                const receiverDoc = await db.collection('users').doc(trade.receiverId).get();
                if (proposerDoc.exists && receiverDoc.exists) {
                    const proposerData = proposerDoc.data();
                    const receiverData = receiverDoc.data();
                    
                    const yourAddress = formatAddress(isProposer ? proposerData : receiverData);
                    const theirAddress = formatAddress(isProposer ? receiverData : proposerData);
                    
                    let payoutInfoHTML = '';
                    if (trade.proposerMoney > 0 || trade.receiverMoney > 0) {
                        const payer = trade.proposerMoney > 0 ? proposerData : receiverData;
                        const payee = trade.proposerMoney > 0 ? receiverData : proposerData;
                        const paymentAmount = Math.max(trade.proposerMoney, trade.receiverMoney);

                        payoutInfoHTML = `
                            <div class="mt-4 pt-4 border-t dark:border-gray-600">
                                <h5 class="font-semibold text-gray-700 dark:text-gray-300">Payment Details:</h5>
                                <p class="text-sm dark:text-gray-400">
                                    <strong>${payer.displayName}</strong> to send <strong>${paymentAmount.toFixed(2)} SEK</strong> to <strong>${payee.displayName}</strong>
                                </p>
                                <div class="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                                    ${formatPayout(payee)}
                                </div>
                            </div>
                        `;
                    }

                    shippingInfoHTML = `
                        <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border dark:border-gray-700">
                            <h4 class="font-bold text-lg mb-2 dark:text-white">Shipping & Payment Information</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p class="font-semibold text-gray-700 dark:text-gray-300">Ship Your Items To:</p>
                                    <address class="not-italic dark:text-gray-400">${theirAddress}</address>
                                </div>
                                <div>
                                    <p class="font-semibold text-gray-700 dark:text-gray-300">They Will Ship To:</p>
                                    <address class="not-italic dark:text-gray-400">${yourAddress}</address>
                                </div>
                            </div>
                            ${payoutInfoHTML}
                        </div>
                    `;
                }
            } catch (err) {
                console.error("Error fetching user addresses for trade card:", err);
                shippingInfoHTML = '<p class="text-xs text-red-500">Could not load shipping addresses.</p>';
            }
        }

        switch(trade.status) {
            case 'pending':
                if (isProposer) {
                    actionButtons = `<button data-id="${tradeId}" data-action="rejected" class="trade-action-btn px-4 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700 text-sm">Cancel Offer</button>`;
                } else {
                    actionButtons = `
                        <button data-id="${tradeId}" data-action="rejected" class="trade-action-btn px-4 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700 text-sm">Decline</button>
                        <button data-id="${tradeId}" data-action="counter" class="trade-action-btn px-4 py-2 bg-yellow-500 text-white font-semibold rounded-full hover:bg-yellow-600 text-sm">Counter</button>
                        <button data-id="${tradeId}" data-action="accepted" class="trade-action-btn px-4 py-2 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700 text-sm">Accept</button>
                    `;
                }
                break;
            case 'accepted':
                const userHasShipped = isProposer ? trade.proposerConfirmedShipment : trade.receiverConfirmedShipment;
                const otherUserHasShipped = isProposer ? trade.receiverConfirmedShipment : trade.proposerConfirmedShipment;
                tradeStatusSection = getShipmentStatusHTML(userHasShipped, otherUserHasShipped, isProposer);
                if (!userHasShipped) {
                    actionButtons = `<button data-id="${tradeId}" data-action="confirm-shipment" class="trade-action-btn px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Confirm You Have Shipped</button>`;
                }
                break;
            case 'shipped':
                const userHasReceived = isProposer ? trade.proposerConfirmedReceipt : trade.receiverConfirmedReceipt;
                tradeStatusSection = `<div class="mt-4 p-4 bg-indigo-50 dark:bg-gray-700 rounded-lg"><h4 class="font-bold text-indigo-800 dark:text-indigo-300">Items Shipped! Awaiting Receipt.</h4></div>`;
                if (!userHasReceived) {
                    actionButtons = `<button data-id="${tradeId}" data-action="confirm-receipt" class="trade-action-btn px-4 py-2 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700">Confirm You Received Items</button>`;
                }
                break;
            case 'completed':
                const userHasLeftFeedback = (isProposer && trade.proposerLeftFeedback) || (!isProposer && trade.receiverLeftFeedback);
                if (!userHasLeftFeedback) {
                    actionButtons = `<button data-id="${tradeId}" class="leave-feedback-btn px-4 py-2 bg-yellow-500 text-white font-semibold rounded-full hover:bg-yellow-600">Leave Feedback</button>`;
                } else {
                    actionButtons = `<p class="text-sm text-green-600 font-semibold">Feedback Submitted!</p>`;
                }
                break;
        }

        if (['accepted', 'shipped', 'disputed'].includes(trade.status)) {
            actionButtons += `<button data-id="${tradeId}" class="report-problem-btn text-xs text-gray-500 hover:text-red-500 ml-2">Report Problem</button>`;
        }
        
        tradeCard.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        ${isProposer ? `Offer to: <strong>${trade.receiverName}</strong>` : `Offer from: <strong>${trade.proposerName}</strong>`}
                    </p>
                    <p class="text-xs text-gray-400 dark:text-gray-500">On: ${new Date(trade.createdAt.seconds * 1000).toLocaleString()}</p>
                </div>
                <span class="px-3 py-1 text-sm font-semibold rounded-full ${statusColor}">${trade.status}</span>
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
            ${shippingInfoHTML}
            ${trade.notes ? `<div class="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md"><p class="text-sm italic dark:text-gray-300"><strong>Notes:</strong> ${trade.notes}</p></div>` : ''}
            ${tradeStatusSection}
            <div class="mt-4 text-right space-x-2">${actionButtons}</div>
        `;
        return tradeCard;
    };

    const getShipmentStatusHTML = (userHasShipped, otherUserHasShipped, isProposer) => {
        const userStatus = userHasShipped ? '<p class="text-green-600"><i class="fas fa-check-circle mr-1"></i> Shipped</p>' : '<p class="text-yellow-600"><i class="fas fa-clock mr-1"></i> Awaiting Shipment</p>';
        const otherUserStatus = otherUserHasShipped ? '<p class="text-green-600"><i class="fas fa-check-circle mr-1"></i> Shipped</p>' : '<p class="text-yellow-600"><i class="fas fa-clock mr-1"></i> Awaiting Shipment</p>';
        
        return `
            <div class="mt-4 p-4 bg-blue-50 dark:bg-gray-700 rounded-lg">
                <h4 class="font-bold text-blue-800 dark:text-blue-300">Trade Accepted! Awaiting Shipment.</h4>
                <div class="grid grid-cols-2 gap-4 mt-2 text-sm">
                    <div>
                        <p class="font-semibold dark:text-gray-200">You (${isProposer ? 'Proposer' : 'Receiver'})</p>
                        ${userStatus}
                    </div>
                    <div>
                        <p class="font-semibold dark:text-gray-200">Them (${isProposer ? 'Receiver' : 'Proposer'})</p>
                         ${otherUserStatus}
                    </div>
                </div>
            </div>
        `;
    };
    
    const renderTradeItems = (cards = [], money = 0) => {
        let itemsHtml = cards.map(card => `
            <div class="flex items-center space-x-2">
                <img src="${card.imageUrl || 'https://placehold.co/32x44'}" class="w-8 h-11 object-cover rounded-sm">
                <span class="text-sm dark:text-gray-300">${card.name}</span>
            </div>
        `).join('');

        if (money > 0) {
            itemsHtml += `
                <div class="flex items-center space-x-2 mt-2 pt-2 border-t dark:border-gray-600">
                    <i class="fas fa-money-bill-wave text-green-500"></i>
                    <span class="text-sm font-semibold dark:text-gray-300">${money.toFixed(2)} SEK</span>
                </div>
            `;
        }
        return itemsHtml || '<p class="text-sm text-gray-500 italic">No items</p>';
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
        renderCollectionForTrade(myCollectionForTrade, 'proposer');

        if (counterOfTrade) {
            counterOfferInput.value = counterOfTrade.id;
            const partnerId = counterOfTrade.proposerId;
            const partnerDoc = await db.collection('users').doc(partnerId).get();
            if (partnerDoc.exists) {
                await selectTradePartner({ id: partnerDoc.id, ...partnerDoc.data() });
                tradeOffer.proposerCards = counterOfTrade.receiverCards || [];
                tradeOffer.receiverCards = counterOfTrade.proposerCards || [];
                proposerMoneyInput.value = counterOfTrade.receiverMoney || 0;
                receiverMoneyInput.value = counterOfTrade.proposerMoney || 0;
            }
        } else if (initialPartner && initialCard) {
            await selectTradePartner(initialPartner);
            selectCardForTrade(initialCard, 'receiver');
        } else if (initialPartner) {
            await selectTradePartner(initialPartner);
        }

        updateSelectionUI('proposer', tradeOffer.proposerCards);
        updateSelectionUI('receiver', tradeOffer.receiverCards);
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
        renderCollectionForTrade(theirCollectionForTrade, 'receiver');
    };

    const renderCollectionForTrade = (cards, side) => {
        const container = document.getElementById(side === 'proposer' ? 'my-collection-list' : 'their-collection-list');
        container.innerHTML = '';
        if (cards.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500 p-2 italic">No cards found for trade.</p>';
            return;
        }
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'flex items-center justify-between p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded cursor-pointer';
            const price = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
            const localPrice = window.HatakeSocial.convertAndFormatPrice(price, 'USD');
            cardEl.innerHTML = `
                <span class="text-sm truncate dark:text-gray-300">${card.name}</span>
                <div class="flex items-center">
                    <span class="text-xs text-gray-500 dark:text-gray-400 mr-2">${localPrice}</span>
                    <i class="fas fa-plus-circle text-green-500"></i>
                </div>
            `;
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
            container.innerHTML = `<p class="text-sm text-gray-500 italic">No cards selected.</p>`;
        } else {
            container.innerHTML = '';
            cards.forEach(card => {
                const cardEl = document.createElement('div');
                cardEl.className = 'flex items-center justify-between p-1 bg-blue-100 dark:bg-blue-900/50 rounded';
                cardEl.innerHTML = `
                    <span class="text-sm truncate dark:text-gray-200">${card.name}</span>
                    <button data-card-id="${card.id}" data-side="${side}" class="remove-trade-item-btn text-red-500 hover:text-red-700"><i class="fas fa-times-circle"></i></button>
                `;
                container.appendChild(cardEl);
            });
        }
        updateTotalValueUI();
    };

    const updateTotalValueUI = () => {
        let proposerValue = 0;
        tradeOffer.proposerCards.forEach(card => {
            const price = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
            proposerValue += price;
        });
        proposerValue += parseFloat(proposerMoneyInput.value) / USD_TO_SEK_RATE || 0;
        proposerValueEl.textContent = `${(proposerValue * USD_TO_SEK_RATE).toFixed(2)} SEK`;

        let receiverValue = 0;
        tradeOffer.receiverCards.forEach(card => {
            const price = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
            receiverValue += price;
        });
        receiverValue += parseFloat(receiverMoneyInput.value) / USD_TO_SEK_RATE || 0;
        receiverValueEl.textContent = `${(receiverValue * USD_TO_SEK_RATE).toFixed(2)} SEK`;
    };

    const autoBalanceTrade = (targetSide, percentage) => {
        const sourceSide = targetSide === 'proposer' ? 'receiver' : 'proposer';
        const sourceCards = tradeOffer[`${sourceSide}Cards`];
        const sourceMoneyInput = document.getElementById(`${sourceSide}-money`);
        const collectionToUse = targetSide === 'proposer' ? myCollectionForTrade : theirCollectionForTrade;
    
        let sourceValueUSD = 0;
        sourceCards.forEach(card => {
            sourceValueUSD += parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
        });
        sourceValueUSD += parseFloat(sourceMoneyInput.value) / USD_TO_SEK_RATE || 0;
    
        const targetValueUSD = sourceValueUSD * (percentage / 100);
    
        let currentTargetValueUSD = 0;
        tradeOffer[`${targetSide}Cards`].forEach(card => {
            currentTargetValueUSD += parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
        });
        currentTargetValueUSD += parseFloat(document.getElementById(`${targetSide}-money`).value) / USD_TO_SEK_RATE || 0;
    
        let valueToFind = targetValueUSD - currentTargetValueUSD;
        if (valueToFind <= 0) {
            alert("The offer already meets or exceeds the target percentage!");
            return;
        }
    
        const availableCards = collectionToUse
            .filter(card => !tradeOffer[`${targetSide}Cards`].some(offerCard => offerCard.id === card.id))
            .map(card => ({
                ...card,
                value: parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0
            }))
            .filter(card => card.value > 0)
            .sort((a, b) => b.value - a.value);
    
        const cardsToAdd = [];
        for (const card of availableCards) {
            if (valueToFind <= 0) break;
            if (card.value <= valueToFind) {
                cardsToAdd.push(card);
                valueToFind -= card.value;
            }
        }
    
        if (cardsToAdd.length > 0) {
            tradeOffer[`${targetSide}Cards`].push(...cardsToAdd);
            updateSelectionUI(targetSide, tradeOffer[`${targetSide}Cards`]);
            alert(`Added ${cardsToAdd.length} card(s) to the offer to meet ${percentage}% of the other side's value.`);
        } else {
            alert("Could not find any suitable cards to automatically balance the trade.");
        }
    };

    const createNotification = async (userId, message, link) => {
        const notificationData = {
            message: message,
            link: link,
            isRead: false,
            timestamp: new Date()
        };
        await db.collection('users').doc(userId).collection('notifications').add(notificationData);
    };

    const sendTradeOffer = async () => {
        if (!tradeOffer.receiver) {
            alert("Please select a trade partner.");
            return;
        }
        if (tradeOffer.proposerCards.length === 0 && tradeOffer.receiverCards.length === 0 && !proposerMoneyInput.value && !receiverMoneyInput.value) {
            alert("Please select at least one card or add money to trade.");
            return;
        }
        
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
            createdAt: new Date(),
            proposerConfirmedShipment: false, receiverConfirmedShipment: false,
            proposerConfirmedReceipt: false, receiverConfirmedReceipt: false,
            proposerLeftFeedback: false, receiverLeftFeedback: false
        };

        try {
            const originalTradeId = counterOfferInput.value;
            if (originalTradeId) {
                await db.collection('trades').doc(originalTradeId).update({ status: 'countered' });
                tradeData.counterOfTradeId = originalTradeId;
            }

            const tradeDocRef = await db.collection('trades').add(tradeData);
            
            await createNotification(
                tradeOffer.receiver.id,
                `You have a new trade offer from ${user.displayName}!`,
                '/trades.html'
            );
            
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
    
    // FINALIZED INVENTORY TRANSFER LOGIC
    const handleTradeAction = async (action, tradeId) => {
        const tradeRef = db.collection('trades').doc(tradeId);
        const tradeDoc = await tradeRef.get();
        if (!tradeDoc.exists) return;
        const tradeData = tradeDoc.data();
        const isProposer = tradeData.proposerId === user.uid;

        let confirmMessage = 'Are you sure?';
        switch (action) {
            case 'rejected':
                confirmMessage = isProposer ? 'Are you sure you want to cancel this offer?' : 'Are you sure you want to decline this trade?';
                break;
            case 'accepted':
                confirmMessage = 'Are you sure you want to accept this trade? This will lock in the items.';
                break;
            case 'confirm-shipment':
                confirmMessage = 'Please confirm that you have shipped your items.';
                break;
            case 'confirm-receipt':
                confirmMessage = 'Please confirm you have received the items from your trade partner.';
                break;
        }

        if (confirm(confirmMessage)) {
            try {
                if (action === 'accepted') {
                    await tradeRef.update({ status: 'accepted' });
                    const otherPartyId = isProposer ? tradeData.receiverId : tradeData.proposerId;
                    await createNotification(otherPartyId, `Your trade offer was accepted by ${user.displayName}. Please ship your items.`, '/trades.html');
                    await createNotification(user.uid, `You accepted the trade. Please ship your items.`, '/trades.html');
                } else if (action === 'rejected') {
                    await tradeRef.update({ status: action });
                    const otherPartyId = isProposer ? tradeData.receiverId : tradeData.proposerId;
                    const message = isProposer ? `Your trade offer to ${tradeData.receiverName} was cancelled.` : `Your trade offer was rejected by ${user.displayName}.`;
                    await createNotification(otherPartyId, message, '/trades.html');
                } else if (action === 'counter') {
                    openProposeTradeModal({ counterOfTrade: { id: tradeId, ...tradeData } });
                } else if (action === 'confirm-shipment') {
                    const fieldToUpdate = isProposer ? 'proposerConfirmedShipment' : 'receiverConfirmedShipment';
                    await tradeRef.update({ [fieldToUpdate]: true });

                    const updatedDoc = await tradeRef.get();
                    if (updatedDoc.data().proposerConfirmedShipment && updatedDoc.data().receiverConfirmedShipment) {
                        await tradeRef.update({ status: 'shipped' });
                    }
                } else if (action === 'confirm-receipt') {
                    const fieldToUpdate = isProposer ? 'proposerConfirmedReceipt' : 'receiverConfirmedReceipt';
                    await tradeRef.update({ [fieldToUpdate]: true });

                    const updatedDoc = await tradeRef.get();
                    const updatedTradeData = updatedDoc.data();
                    if (updatedTradeData.proposerConfirmedReceipt && updatedTradeData.receiverConfirmedReceipt) {
                        // All parties have confirmed receipt, now perform the inventory transfer.
                        const batch = db.batch();

                        // Remove cards from proposer, add to receiver
                        updatedTradeData.proposerCards.forEach(card => {
                            const cardToRemoveRef = db.collection('users').doc(tradeData.proposerId).collection('collection').doc(card.id);
                            batch.delete(cardToRemoveRef);

                            const cardToAddRef = db.collection('users').doc(tradeData.receiverId).collection('collection').doc();
                            const newCardData = { ...card, forSale: false, addedAt: new Date() };
                            delete newCardData.id; 
                            batch.set(cardToAddRef, newCardData);
                        });

                        // Remove cards from receiver, add to proposer
                        updatedTradeData.receiverCards.forEach(card => {
                            const cardToRemoveRef = db.collection('users').doc(tradeData.receiverId).collection('collection').doc(card.id);
                            batch.delete(cardToRemoveRef);

                            const cardToAddRef = db.collection('users').doc(tradeData.proposerId).collection('collection').doc();
                            const newCardData = { ...card, forSale: false, addedAt: new Date() };
                            delete newCardData.id;
                            batch.set(cardToAddRef, newCardData);
                        });

                        // Finally, update the trade status to completed
                        batch.update(tradeRef, { status: 'completed' });

                        await batch.commit();

                        // Send notifications
                        await createNotification(tradeData.proposerId, `Your trade with ${tradeData.receiverName} is complete! Leave feedback.`, '/trades.html');
                        await createNotification(tradeData.receiverId, `Your trade with ${tradeData.proposerName} is complete! Leave feedback.`, '/trades.html');
                    }
                }
            } catch (error) {
                console.error(`Error during trade action '${action}':`, error);
                alert("An error occurred. Please try again.");
            }
        }
    };
    
    const openFeedbackModal = async (tradeId) => {
        const tradeDoc = await db.collection('trades').doc(tradeId).get();
        const trade = tradeDoc.data();
        const isProposer = trade.proposerId === user.uid;
        const otherUserId = isProposer ? trade.receiverId : trade.proposerId;
        const otherUserName = isProposer ? trade.receiverName : trade.proposerName;
        
        document.getElementById('feedback-trade-id').value = tradeId;
        document.getElementById('feedback-for-user-id').value = otherUserId;
        document.getElementById('feedback-for-user-name').textContent = otherUserName;
        
        feedbackForm.reset();
        starRatingContainers.forEach(container => {
            container.querySelectorAll('.star-icon').forEach(s => {
                s.classList.remove('fas', 'text-yellow-400');
                s.classList.add('far', 'text-gray-300');
            });
            container.nextElementSibling.value = 0;
        });
        openModal(feedbackModal);
    };

    const openDisputeModal = (tradeId) => {
        document.getElementById('dispute-trade-id').value = tradeId;
        disputeForm.reset();
        openModal(disputeModal);
    };

    const checkForUrlParams = async () => {
        const params = new URLSearchParams(window.location.search);
        const cardToProposeId = params.get('propose_to_card');
        const userToTradeWith = params.get('with');

        if (cardToProposeId) {
            const cardQuery = await db.collectionGroup('collection').where(firebase.firestore.FieldPath.documentId(), '==', cardToProposeId).limit(1).get();
            if (!cardQuery.empty) {
                const cardDoc = cardQuery.docs[0];
                const cardData = { id: cardDoc.id, ...cardDoc.data() };
                const sellerId = cardDoc.ref.parent.parent.id;
                
                const userDoc = await db.collection('users').doc(sellerId).get();
                if (userDoc.exists) {
                    const partnerData = { id: userDoc.id, ...userDoc.data() };
                    openProposeTradeModal({ initialCard: cardData, initialPartner: partnerData });
                }
            }
        } else if (userToTradeWith) {
             const userDoc = await db.collection('users').doc(userToTradeWith).get();
             if (userDoc.exists) {
                const partnerData = { id: userDoc.id, ...userDoc.data() };
                openProposeTradeModal({ initialPartner: partnerData });
             }
        }
    };

    // --- EVENT LISTENERS ---
    proposeNewTradeBtn?.addEventListener('click', () => openProposeTradeModal());
    closeTradeModalBtn?.addEventListener('click', () => closeModal(tradeModal));
    sendTradeOfferBtn?.addEventListener('click', sendTradeOffer);
    
    document.querySelectorAll('.auto-balance-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const side = e.currentTarget.dataset.side;
            balanceTargetSideInput.value = side;
            openModal(autoBalanceModal);
        });
    });

    closeBalanceModalBtn?.addEventListener('click', () => closeModal(autoBalanceModal));
    autoBalanceForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const side = balanceTargetSideInput.value;
        const percentage = document.getElementById('balance-percentage').value;
        autoBalanceTrade(side, percentage);
        closeModal(autoBalanceModal);
    });
    
    proposerMoneyInput.addEventListener('input', updateTotalValueUI);
    receiverMoneyInput.addEventListener('input', updateTotalValueUI);

    tradePartnerSearch?.addEventListener('keyup', async (e) => {
        const searchTerm = e.target.value.toLowerCase();
        if (searchTerm.length < 2) {
            tradePartnerResults.innerHTML = '';
            tradePartnerResults.classList.add('hidden');
            return;
        }
        tradePartnerResults.classList.remove('hidden');
        const usersRef = db.collection('users');
        const query = usersRef.orderBy('handle').startAt(searchTerm).endAt(searchTerm + '\uf8ff');
        
        try {
            const snapshot = await query.get();
            tradePartnerResults.innerHTML = '';
            if (snapshot.empty) {
                tradePartnerResults.innerHTML = '<div class="p-2 text-gray-500">No users found.</div>';
                return;
            }
            snapshot.forEach(doc => {
                if (doc.id === user.uid) return;
                const userData = doc.data();
                const resultItem = document.createElement('div');
                resultItem.className = 'p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
                resultItem.textContent = `@${userData.handle} (${userData.displayName})`;
                resultItem.addEventListener('click', () => selectTradePartner({ id: doc.id, ...userData }));
                tradePartnerResults.appendChild(resultItem);
            });
        } catch (error) {
            console.error("User search error:", error);
            tradePartnerResults.innerHTML = `<div class="p-2 text-red-500">Error: Could not perform search.</div>`;
        }
    });
    
    myCollectionSearch?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = myCollectionForTrade.filter(c => c.name.toLowerCase().includes(searchTerm));
        renderCollectionForTrade(filtered, 'proposer');
    });

    theirCollectionSearch?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = theirCollectionForTrade.filter(c => c.name.toLowerCase().includes(searchTerm));
        renderCollectionForTrade(filtered, 'receiver');
    });

    document.getElementById('proposer-selected-cards')?.addEventListener('click', (e) => {
        const button = e.target.closest('.remove-trade-item-btn');
        if (button) removeCardFromTrade(button.dataset.cardId, button.dataset.side);
    });
    document.getElementById('receiver-selected-cards')?.addEventListener('click', (e) => {
        const button = e.target.closest('.remove-trade-item-btn');
        if (button) removeCardFromTrade(button.dataset.cardId, button.dataset.side);
    });

    document.body.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        if (button.classList.contains('trade-action-btn')) {
            handleTradeAction(button.dataset.action, button.dataset.id);
        } else if (button.classList.contains('leave-feedback-btn')) {
            openFeedbackModal(button.dataset.id);
        } else if (button.classList.contains('report-problem-btn')) {
            openDisputeModal(button.dataset.id);
        }
    });
    
    closeFeedbackModalBtn?.addEventListener('click', () => closeModal(feedbackModal));

    feedbackForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        const tradeId = document.getElementById('feedback-trade-id').value;
        const forUserId = document.getElementById('feedback-for-user-id').value;
        const ratingAccuracy = parseInt(document.getElementById('rating-accuracy').value, 10);
        const ratingPackaging = parseInt(document.getElementById('rating-packaging').value, 10);
        const comment = document.getElementById('feedback-comment').value;

        if (ratingAccuracy === 0 || ratingPackaging === 0) {
            alert("Please provide a rating for all categories.");
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Feedback';
            return;
        }

        const feedbackData = {
            forUserId, fromUserId: user.uid, fromUserName: user.displayName,
            tradeId, comment, createdAt: new Date(),
            ratings: { accuracy: ratingAccuracy, packaging: ratingPackaging }
        };

        try {
            await db.collection('feedback').add(feedbackData);

            const tradeRef = db.collection('trades').doc(tradeId);
            const tradeDoc = await tradeRef.get();
            if (tradeDoc.exists) {
                const fieldToUpdate = tradeDoc.data().proposerId === user.uid 
                    ? 'proposerLeftFeedback' 
                    : 'receiverLeftFeedback';
                await tradeRef.update({ [fieldToUpdate]: true });
            }
            
            alert("Feedback submitted successfully!");
            closeModal(feedbackModal);

        } catch (error) {
            console.error("Error submitting feedback:", error);
            alert("Could not submit feedback.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Feedback';
        }
    });

    closeDisputeModalBtn?.addEventListener('click', () => closeModal(disputeModal));

    disputeForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        
        const tradeId = document.getElementById('dispute-trade-id').value;
        const reason = document.getElementById('dispute-reason').value;
        const details = document.getElementById('dispute-details').value;

        try {
            await db.collection('disputes').add({
                tradeId, reason, details,
                reportedBy: user.uid,
                status: 'open',
                createdAt: new Date()
            });
            await db.collection('trades').doc(tradeId).update({ status: 'disputed' });
            alert('Dispute submitted. A moderator will review your case shortly.');
            closeModal(disputeModal);
        } catch (error) {
            console.error("Error submitting dispute:", error);
            alert("Could not submit dispute.");
        } finally {
            submitBtn.disabled = false;
        }
    });

    starRatingContainers.forEach(container => {
        container.addEventListener('mouseover', e => {
            if (e.target.classList.contains('star-icon')) {
                const hoverValue = parseInt(e.target.dataset.value, 10);
                container.querySelectorAll('.star-icon').forEach(star => {
                    const starValue = parseInt(star.dataset.value, 10);
                    star.classList.toggle('fas', starValue <= hoverValue);
                    star.classList.toggle('far', starValue > hoverValue);
                    star.classList.toggle('text-yellow-400', starValue <= hoverValue);
                    star.classList.toggle('text-gray-300', starValue > hoverValue);
                });
            }
        });

        container.addEventListener('mouseout', () => {
            const selectedRating = parseInt(container.nextElementSibling.value, 10);
            container.querySelectorAll('.star-icon').forEach(star => {
                const starValue = parseInt(star.dataset.value, 10);
                 star.classList.toggle('fas', starValue <= selectedRating);
                 star.classList.toggle('far', starValue > selectedRating);
                 star.classList.toggle('text-yellow-400', starValue <= selectedRating);
                 star.classList.toggle('text-gray-300', starValue > selectedRating);
            });
        });

        container.addEventListener('click', e => {
            if (e.target.classList.contains('star-icon')) {
                container.nextElementSibling.value = e.target.dataset.value;
            }
        });
    });

    // --- INITIAL LOAD ---
    loadAllTrades();
    checkForUrlParams();
});
