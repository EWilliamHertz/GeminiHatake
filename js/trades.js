/**
 * HatakeSocial - Trades Page Script (v4 - Trade Partner Search)
 *
 * This script handles all logic for the trades page.
 * - Implements a search functionality to find trade partners by their handle.
 * - Dynamically fetches and displays the selected partner's collection.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const tradesPageContainer = document.querySelector('main.container');
    if (!tradesPageContainer || !document.getElementById('tab-content-incoming')) return;

    if (!user) {
        tradesPageContainer.innerHTML = '<p class="text-center text-gray-500 p-8">Please log in to view your trades.</p>';
        return;
    }

    // --- DOM Elements ---
    const incomingContainer = document.getElementById('tab-content-incoming');
    const outgoingContainer = document.getElementById('tab-content-outgoing');
    const historyContainer = document.getElementById('tab-content-history');
    const tabs = document.querySelectorAll('.trade-tab-button');
    const proposeNewTradeBtn = document.getElementById('propose-new-trade-btn');
    const tradeModal = document.getElementById('propose-trade-modal');
    const closeTradeModalBtn = document.getElementById('close-trade-modal');
    const sendTradeOfferBtn = document.getElementById('send-trade-offer-btn');
    const tradePartnerSearch = document.getElementById('trade-partner-search');
    const tradePartnerResults = document.getElementById('trade-partner-results');
    const myCollectionSearch = document.getElementById('my-collection-search');
    const theirCollectionSearch = document.getElementById('their-collection-search');
    const feedbackModal = document.getElementById('feedback-modal');
    const feedbackForm = document.getElementById('feedback-form');
    const closeFeedbackModalBtn = document.getElementById('close-feedback-modal');
    const starRatingContainer = document.getElementById('star-rating');

    // --- State Variables ---
    let myCollectionForTrade = [];
    let theirCollectionForTrade = [];
    let tradeOffer = {
        proposerCards: [],
        receiverCards: [],
        receiver: null
    };

    // --- Tab Switching Logic ---
    if(proposeNewTradeBtn) proposeNewTradeBtn.classList.remove('hidden');
    tabs.forEach(button => {
        button.addEventListener('click', () => {
            tabs.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            document.querySelectorAll('.trade-tab-content').forEach(content => content.classList.add('hidden'));
            document.getElementById(`tab-content-${button.dataset.tab}`).classList.remove('hidden');
        });
    });

    // --- Main Loading Function ---
    const loadAllTrades = () => {
        const tradesRef = db.collection('trades').where('participants', 'array-contains', user.uid).orderBy('createdAt', 'desc');

        // Use onSnapshot for real-time updates
        tradesRef.onSnapshot(snapshot => {
            incomingContainer.innerHTML = '';
            outgoingContainer.innerHTML = '';
            historyContainer.innerHTML = '';

            if (snapshot.empty) {
                const noTradesMsg = '<p class="text-center text-gray-500 p-4">No trades found.</p>';
                incomingContainer.innerHTML = noTradesMsg;
                outgoingContainer.innerHTML = noTradesMsg;
                historyContainer.innerHTML = noTradesMsg;
                return;
            }

            let hasIncoming = false, hasOutgoing = false, hasHistory = false;

            snapshot.forEach(doc => {
                const trade = doc.data();
                const tradeCard = createTradeCard(trade, doc.id);

                if (trade.status === 'pending' && trade.receiverId === user.uid) {
                    incomingContainer.appendChild(tradeCard);
                    hasIncoming = true;
                } else if (trade.status === 'pending' && trade.proposerId === user.uid) {
                    outgoingContainer.appendChild(tradeCard);
                    hasOutgoing = true;
                } else if (trade.status !== 'pending') {
                    historyContainer.appendChild(tradeCard);
                    hasHistory = true;
                }
            });

            if (!hasIncoming) incomingContainer.innerHTML = '<p class="text-center text-gray-500 p-4">No incoming offers.</p>';
            if (!hasOutgoing) outgoingContainer.innerHTML = '<p class="text-center text-gray-500 p-4">No outgoing offers.</p>';
            if (!hasHistory) historyContainer.innerHTML = '<p class="text-center text-gray-500 p-4">No trade history.</p>';

        }, err => {
            console.error("Error loading trades:", err);
            const errorMessage = `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p class="font-bold">Error Loading Trades</p><p>This is likely due to a missing database index. Please open the browser console (F12) and look for an error message from Firebase. It should contain a link to create the required index.</p></div>`;
            incomingContainer.innerHTML = errorMessage;
        });
    };

    const createTradeCard = (trade, tradeId) => {
        const tradeCard = document.createElement('div');
        tradeCard.className = 'bg-white p-6 rounded-lg shadow-md';
        const isIncoming = trade.receiverId === user.uid;
        const isProposer = trade.proposerId === user.uid;

        const theirItemsHtml = renderTradeItems(isProposer ? trade.receiverCards : trade.proposerCards, isProposer ? trade.receiverMoney : trade.proposerMoney);
        const yourItemsHtml = renderTradeItems(isProposer ? trade.proposerCards : trade.receiverCards, isProposer ? trade.proposerMoney : trade.receiverMoney);
        
        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800',
            accepted: 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800',
        };
        const statusColor = statusColors[trade.status] || 'bg-gray-100';

        let actionButtons = '';
        if (trade.status === 'pending' && isIncoming) {
            actionButtons = `
                <button data-id="${tradeId}" data-action="rejected" class="trade-action-btn px-4 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700">Decline</button>
                <button data-id="${tradeId}" data-action="accepted" class="trade-action-btn px-4 py-2 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700">Accept</button>
            `;
        } else if (trade.status === 'accepted') {
             actionButtons = `<button data-id="${tradeId}" class="complete-trade-btn px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Mark as Complete</button>`;
        } else if (trade.status === 'completed') {
            const userHasLeftFeedback = (isProposer && trade.proposerLeftFeedback) || (!isProposer && trade.receiverLeftFeedback);
            if (!userHasLeftFeedback) {
                actionButtons = `<button data-id="${tradeId}" class="leave-feedback-btn px-4 py-2 bg-yellow-500 text-white font-semibold rounded-full hover:bg-yellow-600">Leave Feedback</button>`;
            } else {
                actionButtons = `<p class="text-sm text-green-600 font-semibold">Feedback Submitted!</p>`;
            }
        }

        tradeCard.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <p class="text-sm text-gray-500">
                        ${isProposer ? `Offer to: <strong>${trade.receiverName}</strong>` : `Offer from: <strong>${trade.proposerName}</strong>`}
                    </p>
                    <p class="text-xs text-gray-400">On: ${new Date(trade.createdAt.seconds * 1000).toLocaleString()}</p>
                </div>
                <span class="px-3 py-1 text-sm font-semibold rounded-full ${statusColor}">${trade.status}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="border p-4 rounded-md">
                    <h4 class="font-bold mb-2">${isProposer ? 'They Receive:' : 'You Offer:'}</h4>
                    <div class="space-y-2">${yourItemsHtml}</div>
                </div>
                <div class="border p-4 rounded-md">
                    <h4 class="font-bold mb-2">${isProposer ? 'You Offer:' : 'They Receive:'}</h4>
                    <div class="space-y-2">${theirItemsHtml}</div>
                </div>
            </div>
            ${trade.notes ? `<div class="mt-4 p-3 bg-gray-50 rounded-md"><p class="text-sm italic"><strong>Notes:</strong> ${trade.notes}</p></div>` : ''}
            <div class="mt-4 text-right space-x-2">${actionButtons}</div>
        `;
        return tradeCard;
    };

    const renderTradeItems = (cards = [], money = 0) => {
        let itemsHtml = cards.map(card => `
            <div class="flex items-center space-x-2">
                <img src="${card.imageUrl || 'https://placehold.co/32x44'}" class="w-8 h-11 object-cover rounded-sm">
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
        const snapshot = await db.collection('users').doc(partner.id).collection('collection').where('forSale', '==', true).get();
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
            container.innerHTML = `<p class="text-sm text-gray-500 italic">${side === 'receiver' ? 'Select a trade partner first.' : 'No cards selected.'}</p>`;
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
        if (tradeOffer.proposerCards.length === 0 && tradeOffer.receiverCards.length === 0) {
            alert("Please select at least one card to trade.");
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
            proposerCards: tradeOffer.proposerCards.map(c => ({ name: c.name, imageUrl: c.imageUrl, value: c.priceUsd })),
            receiverCards: tradeOffer.receiverCards.map(c => ({ name: c.name, imageUrl: c.imageUrl, value: c.priceUsd })),
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
    if (proposeNewTradeBtn) proposeNewTradeBtn.addEventListener('click', openProposeTradeModal);
    if (closeTradeModalBtn) closeTradeModalBtn.addEventListener('click', () => closeModal(tradeModal));
    if (sendTradeOfferBtn) sendTradeOfferBtn.addEventListener('click', sendTradeOffer);

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
                resultItem.className = 'p-2 hover:bg-gray-100 cursor-pointer';
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

    // --- UPGRADED: Main click handler for trade actions ---
    document.body.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const tradeId = button.dataset.id;
        if (!tradeId) return;

        // Handle Accept/Decline
        if (button.classList.contains('trade-action-btn')) {
            const action = button.dataset.action;
            if (confirm(`Are you sure you want to ${action} this trade?`)) {
                await db.collection('trades').doc(tradeId).update({ status: action });
            }
        }
        // Handle Mark as Complete
        if (button.classList.contains('complete-trade-btn')) {
            if (confirm("Are you sure you want to mark this trade as complete? This action cannot be undone.")) {
                await db.collection('trades').doc(tradeId).update({ status: 'completed' });
            }
        }
        // Handle "Leave Feedback" button click
        if (button.classList.contains('leave-feedback-btn')) {
            const tradeDoc = await db.collection('trades').doc(tradeId).get();
            const trade = tradeDoc.data();
            const isProposer = trade.proposerId === user.uid;
            const otherUserId = isProposer ? trade.receiverId : trade.proposerId;
            const otherUserName = isProposer ? trade.receiverName : trade.proposerName;
            
            // Populate the modal
            document.getElementById('feedback-trade-id').value = tradeId;
            document.getElementById('feedback-for-user-id').value = otherUserId;
            document.getElementById('feedback-for-user-name').textContent = otherUserName;
            
            // Reset form state
            feedbackForm.reset();
            document.getElementById('rating-value').value = 0;
            starRatingContainer.querySelectorAll('.star-icon').forEach(s => {
                s.classList.remove('fas', 'text-yellow-400');
                s.classList.add('far', 'text-gray-300');
            });

            openModal(feedbackModal);
        }
    });
    
    // --- UPGRADED: Feedback Modal Logic ---
    if (feedbackModal) {
        // Handle star rating interaction
        starRatingContainer.addEventListener('mouseover', (e) => {
            if (e.target.classList.contains('star-icon')) {
                const hoverValue = parseInt(e.target.dataset.value, 10);
                starRatingContainer.querySelectorAll('.star-icon').forEach(star => {
                    const starValue = parseInt(star.dataset.value, 10);
                    if (starValue <= hoverValue) {
                        star.classList.remove('far', 'text-gray-300');
                        star.classList.add('fas', 'text-yellow-400');
                    }
                });
            }
        });

        starRatingContainer.addEventListener('mouseout', () => {
            const selectedRating = parseInt(document.getElementById('rating-value').value, 10);
            starRatingContainer.querySelectorAll('.star-icon').forEach(star => {
                const starValue = parseInt(star.dataset.value, 10);
                if (starValue > selectedRating) {
                    star.classList.remove('fas', 'text-yellow-400');
                    star.classList.add('far', 'text-gray-300');
                }
            });
        });

        starRatingContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('star-icon')) {
                const value = e.target.dataset.value;
                document.getElementById('rating-value').value = value;
            }
        });

        // Handle modal close
        closeFeedbackModalBtn?.addEventListener('click', () => closeModal(feedbackModal));

        // Handle form submission
        feedbackForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            const tradeId = document.getElementById('feedback-trade-id').value;
            const forUserId = document.getElementById('feedback-for-user-id').value;
            const rating = parseInt(document.getElementById('rating-value').value, 10);
            const comment = document.getElementById('feedback-comment').value;

            if (rating === 0) {
                alert("Please select a star rating.");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Feedback';
                return;
            }

            try {
                // 1. Add the feedback document
                const feedbackData = {
                    forUserId: forUserId,
                    fromUserId: user.uid,
                    fromUserName: user.displayName,
                    tradeId: tradeId,
                    rating: rating,
                    comment: comment,
                    createdAt: new Date()
                };
                await db.collection('feedback').add(feedbackData);

                // 2. Update the user's aggregate rating in a transaction
                const userRef = db.collection('users').doc(forUserId);
                await db.runTransaction(async (transaction) => {
                    const userDoc = await transaction.get(userRef);
                    if (!userDoc.exists) {
                        // If the user doc somehow doesn't exist, create it with the first rating
                        transaction.set(userRef, {
                            ratingCount: 1,
                            ratingTotal: rating,
                            averageRating: rating
                        }, { merge: true });
                    } else {
                        const oldRatingTotal = userDoc.data().ratingTotal || 0;
                        const oldRatingCount = userDoc.data().ratingCount || 0;
                        const newRatingCount = oldRatingCount + 1;
                        const newRatingTotal = oldRatingTotal + rating;
                        const newAverageRating = newRatingTotal / newRatingCount;
                        transaction.update(userRef, {
                            ratingCount: newRatingCount,
                            ratingTotal: newRatingTotal,
                            averageRating: newAverageRating
                        });
                    }
                });

                // 3. Update the trade document to mark that feedback has been left
                const tradeRef = db.collection('trades').doc(tradeId);
                const tradeDoc = await tradeRef.get();
                const fieldToUpdate = tradeDoc.data().proposerId === user.uid ? 'proposerLeftFeedback' : 'receiverLeftFeedback';
                await tradeRef.update({ [fieldToUpdate]: true });
                
                alert("Feedback submitted successfully!");
                closeModal(feedbackModal);

            } catch (error) {
                console.error("Error submitting feedback:", error);
                alert("Could not submit feedback. Please try again.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Feedback';
            }
        });
    }

    // --- Initial Load ---
    loadAllTrades();
});
