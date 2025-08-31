document.addEventListener('authReady', ({ detail: { user } }) => {
    console.log("Auth is ready for trades.js");

    // Original script content starts here
    /**
 * HatakeSocial - Advanced Trades Page Script (v20.3 - Complete Code with Final Fix)
 *
 * This script provides a comprehensive and secure trading system.
 * - FIX: Corrected the call from userDoc.exists() to userDoc.exists to match
 * the Firebase v9 SDK, resolving the console error and allowing the script to run.
 * This will enable the tabs and the "Propose a New Trade" button.
 * - FIX: Ensured the full script is provided, restoring all trade modal and UI helper functions.
 */
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        const tradesPageContainer = document.querySelector('main.container');
        if (!tradesPageContainer || !document.getElementById('tab-content-incoming')) return;

        // --- DOM Elements ---
        const incomingContainer = document.getElementById('tab-content-incoming');

        if (!user) {
            // Hide the button if the user is not logged in
            const proposeNewTradeBtn = document.getElementById('propose-new-trade-btn');
            if(proposeNewTradeBtn) proposeNewTradeBtn.classList.add('hidden');
            
            // Display the login message
            const tabContent = document.querySelector('.trade-tab-content');
            if (tabContent) {
                 // Clear all tab contents and show login message in the first one
                document.querySelectorAll('.trade-tab-content').forEach(c => c.innerHTML = '');
                if (incomingContainer) {
                    incomingContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to view your trades.</p>';
                }
            }
            return;
        }

        // --- Firebase Services ---
        const db = firebase.firestore();
        const functions = firebase.functions();

        // --- All other DOM Elements ---
        const outgoingContainer = document.getElementById('tab-content-outgoing');
        const historyContainer = document.getElementById('tab-content-history');
        const analysisContainer = document.getElementById('tab-content-analysis');
        const tabs = document.querySelectorAll('.trade-tab-button');
        const proposeNewTradeBtn = document.getElementById('propose-new-trade-btn');
        const sellerOnboardingSection = document.getElementById('seller-onboarding-section');
        const onboardSellerBtn = document.getElementById('onboard-seller-btn');

        // Modals
        const tradeModal = document.getElementById('propose-trade-modal');
        const paymentModal = document.getElementById('trade-payment-modal');

        // Trade Modal Elements
        const closeTradeModalBtn = document.getElementById('close-trade-modal');
        const sendTradeOfferBtn = document.getElementById('send-trade-offer-btn');
        const tradePartnerSearch = document.getElementById('trade-partner-search');
        const tradePartnerResults = document.getElementById('trade-partner-results');
        const proposerValueEl = document.getElementById('proposer-value');
        const receiverValueEl = document.getElementById('receiver-value');
        const proposerMoneyInput = document.getElementById('proposer-money');
        const receiverMoneyInput = document.getElementById('receiver-money');
        const counterOfferInput = document.getElementById('counter-offer-original-id');

        // Payment Modal Elements
        const closePaymentModalBtn = document.getElementById('close-payment-modal');
        const paymentForm = document.getElementById('payment-form');
        const sellerNameModal = document.getElementById('seller-name-modal');
        const submitPaymentBtn = document.getElementById('submit-payment-btn');

        // --- State & Config Variables ---
        let myCollectionForTrade = [];
        let theirCollectionForTrade = [];
        let tradeOffer = { proposerCards: [], receiverCards: [], proposerMoney: 0, receiverMoney: 0, receiver: null };
        const USD_TO_SEK_RATE = 10.5;
        let stripe, elements, paymentElement;
        
        // --- Main Initialization ---
        const initializePage = async () => {
            stripe = Stripe('pk_test_51RKhZCJqRiYlcnGZJyPeVmRjm8QLYOSrCW0ScjmxocdAJ7psdKTKNsS3JzITCJ61vq9lZNJpm2I6gX2eJgCUrSf100Mi7zWfpn');

            const userDoc = await db.collection('users').doc(user.uid).get();
            
            // THIS IS THE FIX: Changed userDoc.exists() to userDoc.exists
            if (userDoc.exists && !userDoc.data().stripeAccountId) {
                sellerOnboardingSection.classList.remove('hidden');
            }
            
            if (proposeNewTradeBtn) proposeNewTradeBtn.classList.remove('hidden');
            
            loadAllTrades();
            addEventListeners();
            checkForUrlParams();
        };

        // --- Data Loading & Rendering ---
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
                        <p class="text-xs text-gray-400 dark:text-gray-500">On: ${new Date(trade.createdAt.seconds * 1000).toLocaleString()}</p>
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

            switch (trade.status) {
                case 'pending':
                    return isProposer 
                        ? `<button data-id="${tradeId}" data-action="cancelled" class="trade-action-btn btn-danger">Cancel</button>`
                        : `<button data-id="${tradeId}" data-action="rejected" class="trade-action-btn btn-danger">Decline</button>
                           <button data-id="${tradeId}" data-action="accepted" class="trade-action-btn btn-success">Accept</button>`;
                case 'awaiting_payment':
                    return isPayer
                        ? `<button data-id="${tradeId}" data-action="pay" class="trade-action-btn btn-success">Pay Now</button>`
                        : `<span class="text-sm text-gray-500">Waiting for payment...</span>`;
                case 'funds_authorized':
                    const userHasShipped = isProposer ? trade.proposerConfirmedShipment : trade.receiverConfirmedShipment;
                    return userHasShipped
                        ? `<span class="text-sm text-gray-500">Waiting for other party to ship...</span>`
                        : `<button data-id="${tradeId}" data-action="confirm-shipment" class="trade-action-btn btn-primary">Confirm Shipment</button>`;
                case 'shipped':
                    const userHasReceived = isProposer ? trade.proposerConfirmedReceipt : trade.receiverConfirmedReceipt;
                    return userHasReceived
                        ? `<span class="text-sm text-gray-500">Waiting for other party to confirm receipt...</span>`
                        : `<button data-id="${tradeId}" data-action="confirm-receipt" class="trade-action-btn btn-success">Confirm Delivery</button>`;
                default:
                    return '';
            }
        };

        // --- Event Handlers & Actions ---
        const handleTradeAction = async (action, tradeId) => {
            const tradeRef = db.collection('trades').doc(tradeId);
            const tradeDoc = await tradeRef.get();
            if (!tradeDoc.exists) return;
            const tradeData = tradeDoc.data();

            if (action === 'accepted') {
                const moneyInvolved = (tradeData.proposerMoney || 0) > 0 || (tradeData.receiverMoney || 0) > 0;
                const statusUpdate = moneyInvolved ? 'awaiting_payment' : 'funds_authorized';
                await tradeRef.update({ status: statusUpdate });
                Toastify({ text: "Trade accepted! Next steps updated.", duration: 3000, style: { background: "linear-gradient(to right, #38a169, #2f855a)" } }).showToast();
                
                const isProposer = tradeData.proposerId === user.uid;
                const isPayer = (tradeData.proposerMoney > 0 && isProposer) || (tradeData.receiverMoney > 0 && !isProposer);
                if (moneyInvolved && isPayer) {
                    initiateEscrowPayment(tradeId, tradeData);
                }
            } else if (action === 'pay') {
                initiateEscrowPayment(tradeId, tradeData);
            } else if (action === 'confirm-shipment') {
                const isProposer = tradeData.proposerId === user.uid;
                const fieldToUpdate = isProposer ? 'proposerConfirmedShipment' : 'receiverConfirmedShipment';
                await tradeRef.update({ [fieldToUpdate]: true });
                
                const updatedDoc = await tradeRef.get();
                if (updatedDoc.data().proposerConfirmedShipment && updatedDoc.data().receiverConfirmedShipment) {
                    await tradeRef.update({ status: 'shipped' });
                }
                Toastify({ text: "Shipment confirmed!", duration: 3000, style: { background: "linear-gradient(to right, #38a169, #2f855a)" } }).showToast();
            } else if (action === 'confirm-receipt') {
                try {
                    const captureAndReleaseFunds = functions.httpsCallable('captureAndReleaseFunds');
                    await captureAndReleaseFunds({ tradeId });
                    Toastify({ text: "Delivery confirmed! The trade is complete.", duration: 3000, style: { background: "linear-gradient(to right, #38a169, #2f855a)" } }).showToast();
                } catch(error) {
                    console.error("Error capturing funds:", error);
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
                createdAt: new Date(),
                proposerConfirmedShipment: false, receiverConfirmedShipment: false,
                proposerConfirmedReceipt: false, receiverConfirmedReceipt: false,
            };
            try {
                await db.collection('trades').add(tradeData);
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
        
        // --- Stripe & Payment Logic ---
        const handleStripeOnboarding = async () => {
            onboardSellerBtn.disabled = true;
            onboardSellerBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Redirecting...';
            try {
                const createStripeConnectedAccount = functions.httpsCallable('createStripeConnectedAccount');
                const result = await createStripeConnectedAccount();
                if (result.data.url) window.location.href = result.data.url;
            } catch (error) {
                console.error("Stripe onboarding error:", error);
                Toastify({ text: `Error: ${error.message}`, duration: 5000, style: { background: "linear-gradient(to right, #e53e3e, #c53030)" } }).showToast();
                onboardSellerBtn.disabled = false;
                onboardSellerBtn.innerHTML = '<i class="fab fa-stripe-s mr-2"></i>Set Up Payments with Stripe';
            }
        };
        
        const initiateEscrowPayment = async (tradeId, tradeData) => {
            const isProposer = tradeData.proposerId === user.uid;
            const sellerId = (tradeData.proposerMoney || 0) > 0 ? tradeData.receiverId : tradeData.proposerId;
            const amount = Math.max(tradeData.proposerMoney || 0, tradeData.receiverMoney || 0);
            const sellerName = (tradeData.proposerMoney || 0) > 0 ? tradeData.receiverName : tradeData.proposerName;

            try {
                const createEscrowPayment = functions.httpsCallable('createEscrowPayment');
                const result = await createEscrowPayment({ 
                    sellerUid: sellerId, 
                    amount: Math.round(amount * 100), // Convert to cents
                    tradeId: tradeId
                });

                const { clientSecret } = result.data;
                openModal(paymentModal);
                sellerNameModal.textContent = sellerName;

                elements = stripe.elements({ clientSecret });
                paymentElement = elements.create("payment");
                paymentElement.mount("#payment-element");

            } catch (error) {
                console.error("Error creating payment intent:", error);
                Toastify({ text: `Payment Error: ${error.message}`, duration: 5000, style: { background: "linear-gradient(to right, #e53e3e, #c53030)" } }).showToast();
            }
        };

        const handlePaymentSubmit = async (e) => {
            e.preventDefault();
            submitPaymentBtn.disabled = true;
            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: { return_url: window.location.href.split('?')[0] },
            });
            if (error) {
                Toastify({ text: `Payment failed: ${error.message}`, duration: 5000, style: { background: "linear-gradient(to right, #e53e3e, #c53030)" } }).showToast();
                submitPaymentBtn.disabled = false;
            }
        };

        // --- All Helper Functions for UI from Original Script ---
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

        // --- Add all event listeners ---
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
            onboardSellerBtn?.addEventListener('click', handleStripeOnboarding);
            sendTradeOfferBtn?.addEventListener('click', sendTradeOffer);
            closeTradeModalBtn?.addEventListener('click', () => closeModal(tradeModal));
            closePaymentModalBtn?.addEventListener('click', () => closeModal(paymentModal));
            if(paymentForm) paymentForm.addEventListener('submit', handlePaymentSubmit);

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

        // --- Run Initialization ---
        initializePage();
    });
});
    // Original script content ends here
});
