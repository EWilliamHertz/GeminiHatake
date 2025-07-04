/**
 * HatakeSocial - Trades Page Script
 *
 * This script waits for the 'authReady' event from auth.js before running.
 * It handles fetching and displaying a user's incoming and outgoing trades.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const incomingContainer = document.getElementById('tab-content-incoming');
    if (!incomingContainer) return; // We are not on the trades page

    if (!user) {
        incomingContainer.innerHTML = '<p class="text-center text-gray-500">Please log in to view your trades.</p>';
        return;
    }

    const outgoingContainer = document.getElementById('tab-content-outgoing');
    const historyContainer = document.getElementById('tab-content-history');
    const tabs = document.querySelectorAll('.trade-tab-button');

    // --- Tab Switching Logic ---
    tabs.forEach(button => {
        button.addEventListener('click', () => {
            tabs.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            document.querySelectorAll('.trade-tab-content').forEach(content => content.classList.add('hidden'));
            document.getElementById(`tab-content-${button.dataset.tab}`).classList.remove('hidden');
        });
    });

    /**
     * Renders a list of cards for a trade offer.
     * @param {Array} cards - Array of card objects.
     * @param {number} money - Amount of money offered.
     * @returns {string} HTML string for the cards list.
     */
    const renderTradeItems = (cards, money = 0) => {
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

    /**
     * Creates the HTML for a single trade offer card.
     * @param {object} trade - The trade data from Firestore.
     * @param {string} tradeId - The ID of the trade document.
     * @param {boolean} isIncoming - True if it's an incoming offer.
     */
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

    /**
     * Fetches and displays trades where the current user is the receiver.
     */
    const loadIncomingTrades = async () => {
        incomingContainer.innerHTML = '<p>Loading incoming offers...</p>';
        const q = db.collection('trades').where('receiverId', '==', user.uid).orderBy('createdAt', 'desc');
        q.onSnapshot(snapshot => {
            incomingContainer.innerHTML = '';
            if (snapshot.empty) {
                incomingContainer.innerHTML = '<p class="text-center text-gray-500">You have no incoming trade offers.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const tradeCard = createTradeCard(doc.data(), doc.id, true);
                incomingContainer.appendChild(tradeCard);
            });
        });
    };

    /**
     * Fetches and displays trades where the current user is the proposer.
     */
    const loadOutgoingTrades = async () => {
        outgoingContainer.innerHTML = '<p>Loading outgoing offers...</p>';
        const q = db.collection('trades').where('proposerId', '==', user.uid).orderBy('createdAt', 'desc');
        q.onSnapshot(snapshot => {
            outgoingContainer.innerHTML = '';
            if (snapshot.empty) {
                outgoingContainer.innerHTML = '<p class="text-center text-gray-500">You have no outgoing trade offers.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const tradeCard = createTradeCard(doc.data(), doc.id, false);
                outgoingContainer.appendChild(tradeCard);
            });
        });
    };
    
    // ... loadHistoryTrades function would go here ...

    // --- Event Delegation for Accept/Decline Buttons ---
    incomingContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('.trade-action-btn');
        if (button) {
            button.disabled = true;
            const tradeId = button.dataset.id;
            const action = button.dataset.action;

            try {
                await db.collection('trades').doc(tradeId).update({ status: action });
                alert(`Trade offer has been ${action}.`);
            } catch (error) {
                console.error("Error updating trade status:", error);
                alert("Could not update trade status.");
                button.disabled = false;
            }
        }
    });

    // --- Initial Load ---
    loadIncomingTrades();
    loadOutgoingTrades();
});
