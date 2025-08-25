// This event listener ensures that the Firebase user object is available before any other code runs.
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const tradesPageContainer = document.querySelector('main.container');
    // Exit if not on the trades page or if the main container is missing.
    if (!tradesPageContainer || !document.getElementById('tab-content-incoming')) return;

    // If the user is not logged in, display a message and stop execution.
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
    const sellerOnboardingSection = document.getElementById('seller-onboarding-section');
    const onboardSellerBtn = document.getElementById('onboard-seller-btn');

    // Modals
    const tradeModal = document.getElementById('propose-trade-modal');
    const feedbackModal = document.getElementById('feedback-modal');
    const disputeModal = document.getElementById('dispute-modal');
    const autoBalanceModal = document.getElementById('auto-balance-modal');
    const paymentModal = document.getElementById('trade-payment-modal');

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
    
    // Payment Modal Elements
    const closePaymentModalBtn = document.getElementById('close-payment-modal');
    const paymentForm = document.getElementById('payment-form');
    const sellerNameModal = document.getElementById('seller-name-modal');

    // --- State & Config Variables ---
    let myCollectionForTrade = [];
    let theirCollectionForTrade = [];
    let tradeOffer = { proposerCards: [], receiverCards: [], proposerMoney: 0, receiverMoney: 0, receiver: null };
    const USD_TO_SEK_RATE = 10.5; // Example rate, should be fetched from an API in a real app
    let stripe, elements, paymentElement;

    // --- Firebase Services ---
    const db = firebase.firestore();
    const functions = firebase.functions();

    // --- Main Initialization ---
    const initializePage = async () => {
        // Initialize Stripe.js with your public key
        stripe = Stripe('pk_test_51RKhZCJqRiYlcnGZJyPeVmRjm8QLYOSrCW0ScjmxocdAJ7psdKTKNsS3JzITCJ61vq9lZNJpm2I6gX2eJgCUrSf100Mi7zWfpn');

        // Check user's seller status to show/hide the onboarding section
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists() && !userDoc.data().stripeAccountId) {
            sellerOnboardingSection.classList.remove('hidden');
        }
        
        if (proposeNewTradeBtn) proposeNewTradeBtn.classList.remove('hidden');
        
        loadAllTrades();
        addEventListeners();
    };

    // --- Data Loading & Rendering ---
    const loadAllTrades = () => {
        const tradesRef = db.collection('trades').where('participants', 'array-contains', user.uid).orderBy('createdAt', 'desc');

        tradesRef.onSnapshot(async (snapshot) => {
            // Clear containers before re-rendering
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

                if (['pending', 'accepted', 'funds_authorized', 'shipped', 'disputed'].includes(trade.status) && trade.receiverId === user.uid) {
                    incomingContainer.appendChild(tradeCard);
                    counts.incoming++;
                } else if (['pending', 'accepted', 'funds_authorized', 'shipped', 'disputed'].includes(trade.status) && trade.proposerId === user.uid) {
                    outgoingContainer.appendChild(tradeCard);
                    counts.outgoing++;
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

        // Render items for both sides of the trade
        const proposerItemsHtml = renderTradeItems(trade.proposerCards, trade.proposerMoney);
        const receiverItemsHtml = renderTradeItems(trade.receiverCards, trade.receiverMoney);

        // Determine status color
        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            accepted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            funds_authorized: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
            shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
            completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
            cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
            disputed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
        };
        const statusColor = statusColors[trade.status] || 'bg-gray-100 dark:bg-gray-700';
        
        // Determine which action buttons to show based on trade status and user role
        const actionButtons = getActionButtons(trade, tradeId, isProposer);

        tradeCard.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        ${isProposer ? `Offer to: <strong>${trade.receiverName}</strong>` : `Offer from: <strong>${trade.proposerName}</strong>`}
                    </p>
                    <p class="text-xs text-gray-400 dark:text-gray-500">On: ${new Date(trade.createdAt.seconds * 1000).toLocaleString()}</p>
                </div>
                <span class="px-3 py-1 text-sm font-semibold rounded-full ${statusColor}">${trade.status.replace('_', ' ')}</span>
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
    
    // --- UI & Event Handlers ---
    const addEventListeners = () => {
        // Tab switching
        tabs.forEach(button => {
            button.addEventListener('click', () => {
                tabs.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                document.querySelectorAll('.trade-tab-content').forEach(content => content.classList.add('hidden'));
                document.getElementById(`tab-content-${button.dataset.tab}`).classList.remove('hidden');
            });
        });

        // Main action buttons
        proposeNewTradeBtn?.addEventListener('click', () => openProposeTradeModal());
        onboardSellerBtn?.addEventListener('click', handleStripeOnboarding);
        sendTradeOfferBtn?.addEventListener('click', sendTradeOffer);
        
        // Modal close buttons
        closeTradeModalBtn?.addEventListener('click', () => closeModal(tradeModal));
        closePaymentModalBtn?.addEventListener('click', () => closeModal(paymentModal));

        // Form submissions
        paymentForm?.addEventListener('submit', handlePaymentSubmit);

        // Dynamic event listeners for trade cards
        document.body.addEventListener('click', async (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            if (button.classList.contains('trade-action-btn')) {
                handleTradeAction(button.dataset.action, button.dataset.id);
            }
        });
    };
    
    const getActionButtons = (trade, tradeId, isProposer) => {
        switch (trade.status) {
            case 'pending':
                return isProposer 
                    ? `<button data-id="${tradeId}" data-action="cancelled" class="trade-action-btn btn-danger">Cancel Offer</button>`
                    : `<button data-id="${tradeId}" data-action="rejected" class="trade-action-btn btn-danger">Decline</button>
                       <button data-id="${tradeId}" data-action="accepted" class="trade-action-btn btn-success">Accept</button>`;
            case 'funds_authorized':
                const userHasShipped = isProposer ? trade.proposerConfirmedShipment : trade.receiverConfirmedShipment;
                return userHasShipped ? `<span class="text-sm text-gray-500">Waiting for other party to ship...</span>`
                                      : `<button data-id="${tradeId}" data-action="confirm-shipment" class="trade-action-btn btn-primary">Confirm Shipment</button>`;
            case 'shipped':
                 const userHasReceived = isProposer ? trade.proposerConfirmedReceipt : trade.receiverConfirmedReceipt;
                 return userHasReceived ? `<span class="text-sm text-gray-500">Waiting for other party to confirm receipt...</span>`
                                        : `<button data-id="${tradeId}" data-action="confirm-receipt" class="trade-action-btn btn-success">Confirm Delivery</button>`;
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
            const moneyInvolved = tradeData.proposerMoney > 0 || tradeData.receiverMoney > 0;
            if (moneyInvolved) {
                // If money is involved, start the escrow payment flow
                initiateEscrowPayment(tradeId, tradeData);
            } else {
                // If no money, accept the trade directly
                await tradeRef.update({ status: 'funds_authorized' }); // Use same status for consistency
                Toastify({ text: "Trade accepted! Please ship your items.", duration: 3000 }).showToast();
            }
        } else if (action === 'confirm-shipment') {
            const isProposer = tradeData.proposerId === user.uid;
            const fieldToUpdate = isProposer ? 'proposerConfirmedShipment' : 'receiverConfirmedShipment';
            await tradeRef.update({ [fieldToUpdate]: true });
            
            // Check if both have shipped to update the main status
            const updatedDoc = await tradeRef.get();
            if (updatedDoc.data().proposerConfirmedShipment && updatedDoc.data().receiverConfirmedShipment) {
                await tradeRef.update({ status: 'shipped' });
            }
             Toastify({ text: "Shipment confirmed!", duration: 3000 }).showToast();
        } else if (action === 'confirm-receipt') {
            // This triggers the cloud function to capture funds
            const captureAndReleaseFunds = functions.httpsCallable('captureAndReleaseFunds');
            await captureAndReleaseFunds({ tradeId });
            Toastify({ text: "Delivery confirmed! The trade is complete.", duration: 3000 }).showToast();
        } else if (['rejected', 'cancelled'].includes(action)) {
            await tradeRef.update({ status: action });
            Toastify({ text: "Trade offer has been updated.", duration: 3000 }).showToast();
        }
    };

    // --- Stripe & Payment Logic ---
    const handleStripeOnboarding = async () => {
        onboardSellerBtn.disabled = true;
        onboardSellerBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Redirecting...';
        try {
            const createStripeConnectedAccount = functions.httpsCallable('createStripeConnectedAccount');
            const result = await createStripeConnectedAccount();
            if (result.data.url) {
                window.location.href = result.data.url;
            }
        } catch (error) {
            console.error("Stripe onboarding error:", error);
            Toastify({ text: `Error: ${error.message}`, duration: 5000 }).showToast();
            onboardSellerBtn.disabled = false;
            onboardSellerBtn.innerHTML = '<i class="fab fa-stripe-s mr-2"></i>Set Up Payments with Stripe';
        }
    };
    
    const initiateEscrowPayment = async (tradeId, tradeData) => {
        const isProposer = tradeData.proposerId === user.uid;
        const payerId = isProposer ? tradeData.proposerId : tradeData.receiverId;
        const sellerId = isProposer ? tradeData.receiverId : tradeData.proposerId;
        const amount = isProposer ? tradeData.proposerMoney : tradeData.receiverMoney;
        
        // Only the payer should see the payment modal
        if (user.uid !== payerId) {
            await db.collection('trades').doc(tradeId).update({ status: 'accepted' });
            Toastify({ text: "Trade accepted! Waiting for other party to pay.", duration: 3000 }).showToast();
            return;
        }

        try {
            const createEscrowPayment = functions.httpsCallable('createEscrowPayment');
            const result = await createEscrowPayment({ 
                sellerUid: sellerId, 
                amount: Math.round(amount * 100) // Convert to cents
            });

            const { clientSecret } = result.data;
            openModal(paymentModal);
            sellerNameModal.textContent = isProposer ? tradeData.receiverName : tradeData.proposerName;

            elements = stripe.elements({ clientSecret });
            paymentElement = elements.create("payment");
            paymentElement.mount("#payment-element");

        } catch (error) {
            console.error("Error creating payment intent:", error);
            Toastify({ text: `Payment Error: ${error.message}`, duration: 5000 }).showToast();
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.href.split('?')[0] + '?payment_success=true',
            },
        });

        if (error) {
            Toastify({ text: `Payment failed: ${error.message}`, duration: 5000 }).showToast();
        }
    };

    // --- Utility Functions ---
    const openModal = (modal) => modal.classList.add('open');
    const closeModal = (modal) => modal.classList.remove('open');
    const renderTradeItems = (cards = [], money = 0) => {
        let itemsHtml = cards.map(card => `
            <div class="flex items-center space-x-2">
                <img src="${card.imageUrl || 'https://placehold.co/32x44'}" class="w-8 h-11 object-cover rounded-sm">
                <span class="text-sm dark:text-gray-300">${card.name} ${card.isFoil ? '<i class="fas fa-star text-yellow-400"></i>' : ''}</span>
            </div>
        `).join('');

        if (money > 0) {
            itemsHtml += `<div class="flex items-center space-x-2 mt-2 pt-2 border-t dark:border-gray-600">
                            <i class="fas fa-money-bill-wave text-green-500"></i>
                            <span class="text-sm font-semibold dark:text-gray-300">${money.toFixed(2)} SEK</span>
                          </div>`;
        }
        return itemsHtml || '<p class="text-sm text-gray-500 italic">No items</p>';
    };

    // --- Run Initialization ---
    initializePage();
});
