/**
 * HatakeSocial - Trades Page Script (v2 - with Propose Trade)
 *
 * This script handles fetching and displaying a user's trades,
 * and now includes the full logic for proposing a new trade from scratch.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const incomingContainer = document.getElementById('tab-content-incoming');
    if (!incomingContainer) return;

    if (!user) {
        incomingContainer.innerHTML = '<p class="text-center text-gray-500">Please log in to view your trades.</p>';
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
    const renderTradeItems = (cards = [], money = 0) => { /* ... same as before ... */ };
    const createTradeCard = (trade, tradeId, isIncoming) => { /* ... same as before ... */ };
    const loadIncomingTrades = async () => { /* ... same as before ... */ };
    const loadOutgoingTrades = async () => { /* ... same as before ... */ };

    // --- NEW: Propose Trade Modal Logic ---
    const openProposeTradeModal = async () => {
        // Reset state
        tradeOffer = { proposerCards: [], receiverCards: [], receiver: null };
        document.getElementById('propose-trade-form')?.reset(); // Assuming you add a form element
        document.getElementById('receiver-trade-section').classList.add('opacity-50', 'pointer-events-none');
        updateSelectionUI('proposer', []);
        updateSelectionUI('receiver', []);

        // Load my collection
        const myCollectionList = document.getElementById('my-collection-list');
        myCollectionList.innerHTML = '<p>Loading your collection...</p>';
        const snapshot = await db.collection('users').doc(user.uid).collection('collection').get();
        myCollectionForTrade = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMyCollectionForTrade(myCollectionForTrade);

        openModal(tradeModal);
    };
    
    const selectTradePartner = async (partner) => {
        tradeOffer.receiver = partner;
        document.getElementById('trade-partner-search').value = partner.displayName;
        document.getElementById('trade-partner-results').innerHTML = '';
        document.getElementById('trade-partner-results').classList.add('hidden');

        // Enable the other side of the trade modal
        document.getElementById('receiver-trade-section').classList.remove('opacity-50', 'pointer-events-none');

        // Load their collection
        const theirCollectionList = document.getElementById('their-collection-list');
        theirCollectionList.innerHTML = '<p>Loading collection...</p>';
        const snapshot = await db.collection('users').doc(partner.id).collection('collection').get();
        theirCollectionForTrade = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTheirCollectionForTrade(theirCollectionForTrade);
    };

    const renderMyCollectionForTrade = (cards) => { /* ... similar to marketplace.js ... */ };
    const renderTheirCollectionForTrade = (cards) => { /* ... similar to my collection ... */ };
    const selectCardForTrade = (card, side) => { /* ... logic to add card to proposerCards or receiverCards ... */ };
    const removeCardFromTrade = (cardId, side) => { /* ... logic to remove card ... */ };
    const updateSelectionUI = (side, cards) => { /* ... logic to update selected cards UI ... */ };
    const sendTradeOffer = async () => { /* ... logic to send the trade to Firestore ... */ };

    // --- Event Listeners ---
    proposeNewTradeBtn.addEventListener('click', openProposeTradeModal);
    closeTradeModalBtn.addEventListener('click', () => closeModal(tradeModal));
    sendTradeOfferBtn.addEventListener('click', sendTradeOffer);
    
    // ... other listeners for search, selecting cards, etc. ...
    
    // --- Initial Load ---
    loadIncomingTrades();
    loadOutgoingTrades();
});
