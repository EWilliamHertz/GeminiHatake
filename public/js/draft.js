// public/js/draft.js
document.addEventListener('authReady', ({ detail: { user } }) => {
    if (!user) {
        document.body.innerHTML = `
            <div class="flex items-center justify-center h-screen bg-gray-900">
                <div class="text-center">
                    <i class="fas fa-user-slash text-6xl text-red-400 mb-4"></i>
                    <h1 class="text-2xl font-bold text-white mb-4">Authentication Required</h1>
                    <p class="text-gray-400 mb-6">Please log in to participate in a draft.</p>
                    <a href="/index.html" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                        <i class="fas fa-home mr-2"></i>Go to Home
                    </a>
                </div>
            </div>`;
        return;
    }

    const db = firebase.firestore();
    const functions = firebase.functions();
    let currentDraftId = null;
    let unsubscribeDraft = null;
    let unsubscribePlayerState = null;
    let draftTimer = null;

    // --- Page Identification ---
    const isLobbyPage = !!document.getElementById('draft-list-container');
    const isRoomPage = !!document.getElementById('current-pack-container');

    // --- MTG API Integration ---
    const MTG_API_BASE = 'https://api.magicthegathering.io/v1';
    
    const setData = {
        'MKM': { name: 'Murders at Karlov Manor', code: 'MKM' },
        'LCI': { name: 'The Lost Caverns of Ixalan', code: 'LCI' },
        'WOE': { name: 'Wilds of Eldraine', code: 'WOE' },
        'LTR': { name: 'The Lord of the Rings: Tales of Middle-earth', code: 'LTR' },
        'MOM': { name: 'March of the Machine', code: 'MOM' },
        'ONE': { name: 'Phyrexia: All Will Be One', code: 'ONE' },
        'BRO': { name: 'The Brothers\' War', code: 'BRO' },
        'DMU': { name: 'Dominaria United', code: 'DMU' }
    };

    // --- Cloud Function Callers ---
    const createDraft = functions.httpsCallable('createDraft');
    const joinDraft = functions.httpsCallable('joinDraft');
    const startDraft = functions.httpsCallable('startDraft');
    const pickCard = functions.httpsCallable('pickCard');
    const leaveDraft = functions.httpsCallable('leaveDraft');

    // --- Utility Functions ---
    const generateBoosterPack = async (setCode) => {
        try {
            // For demo purposes, we'll generate a simulated booster pack
            // In a real implementation, you'd use the MTG API or a more sophisticated method
            const response = await fetch(`${MTG_API_BASE}/cards?set=${setCode}&pageSize=15&random=true`);
            const data = await response.json();
            
            if (data.cards && data.cards.length > 0) {
                return data.cards.slice(0, 15).map(card => ({
                    id: card.id || Math.random().toString(36).substr(2, 9),
                    name: card.name,
                    imageUrl: card.imageUrl || 'https://via.placeholder.com/223x310/1a1a1a/ffffff?text=No+Image',
                    manaCost: card.manaCost || '',
                    type: card.type || 'Unknown',
                    rarity: card.rarity || 'Common',
                    set: setCode
                }));
            } else {
                // Fallback to simulated cards if API fails
                return generateSimulatedPack(setCode);
            }
        } catch (error) {
            console.error('Error fetching from MTG API:', error);
            return generateSimulatedPack(setCode);
        }
    };

    const generateSimulatedPack = (setCode) => {
        const rarities = ['Common', 'Common', 'Common', 'Common', 'Common', 'Common', 'Common', 'Common', 'Common', 'Common', 'Uncommon', 'Uncommon', 'Uncommon', 'Rare', 'Mythic Rare'];
        const colors = ['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless'];
        const types = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker'];
        
        return rarities.map((rarity, index) => ({
            id: `sim_${setCode}_${index}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${colors[Math.floor(Math.random() * colors.length)]} ${types[Math.floor(Math.random() * types.length)]} ${index + 1}`,
            imageUrl: `https://via.placeholder.com/223x310/1a1a1a/ffffff?text=${encodeURIComponent(rarity)}`,
            manaCost: `{${Math.floor(Math.random() * 8)}}`,
            type: types[Math.floor(Math.random() * types.length)],
            rarity: rarity,
            set: setCode
        }));
    };

    const showNotification = (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all duration-300 ${
            type === 'success' ? 'bg-green-600' : 
            type === 'error' ? 'bg-red-600' : 
            type === 'warning' ? 'bg-yellow-600' : 'bg-blue-600'
        } text-white`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${
                    type === 'success' ? 'fa-check-circle' : 
                    type === 'error' ? 'fa-exclamation-circle' : 
                    type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'
                } mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    };

    // ===================================================================
    // LOBBY PAGE LOGIC
    // ===================================================================
    if (isLobbyPage) {
        const createDraftBtn = document.getElementById('create-draft-btn');
        const setSelector = document.getElementById('set-selector');
        const draftListContainer = document.getElementById('draft-list-container');
        const draftList = document.getElementById('draft-list');
        const currentDraftLobby = document.getElementById('current-draft-lobby');
        const draftSetName = document.getElementById('draft-set-name');
        const playerList = document.getElementById('player-list');
        const playerCount = document.getElementById('player-count');
        const startDraftBtn = document.getElementById('start-draft-btn');
        const leaveDraftBtn = document.getElementById('leave-draft-btn');
        const chatMessages = document.getElementById('chat-messages');
        const chatInput = document.getElementById('chat-input');
        const sendChatBtn = document.getElementById('send-chat-btn');

        // Create Draft Handler
        createDraftBtn.addEventListener('click', async () => {
            const setCode = setSelector.value;
            if (!setCode) {
                showNotification('Please select a set first!', 'warning');
                return;
            }

            const setInfo = setData[setCode];
            if (!setInfo) {
                showNotification('Invalid set selected!', 'error');
                return;
            }

            try {
                createDraftBtn.disabled = true;
                createDraftBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Creating...';
                
                const result = await createDraft({ 
                    setCode: setCode, 
                    setName: setInfo.name 
                });
                
                window.location.hash = result.data.draftId;
                showNotification('Draft created successfully!', 'success');
            } catch (error) {
                console.error("Error creating draft:", error);
                showNotification(`Could not create draft: ${error.message}`, 'error');
            } finally {
                createDraftBtn.disabled = false;
                createDraftBtn.innerHTML = '<i class="fas fa-plus mr-2"></i>Create Draft';
            }
        });

        // Start Draft Handler
        startDraftBtn.addEventListener('click', async () => {
            if (currentDraftId && confirm("Are you sure you want to start the draft? No one else will be able to join.")) {
                try {
                    startDraftBtn.disabled = true;
                    startDraftBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Starting...';
                    await startDraft({ draftId: currentDraftId });
                    showNotification('Draft started!', 'success');
                } catch (error) {
                    console.error("Error starting draft:", error);
                    showNotification(`Could not start draft: ${error.message}`, 'error');
                    startDraftBtn.disabled = false;
                    startDraftBtn.innerHTML = '<i class="fas fa-play mr-2"></i>Start Draft';
                }
            }
        });

        // Leave Draft Handler
        leaveDraftBtn.addEventListener('click', async () => {
            if (currentDraftId && confirm("Are you sure you want to leave this draft?")) {
                try {
                    await leaveDraft({ draftId: currentDraftId });
                    window.location.hash = '';
                    showNotification('Left draft successfully', 'info');
                } catch (error) {
                    console.error("Error leaving draft:", error);
                    showNotification(`Could not leave draft: ${error.message}`, 'error');
                }
            }
        });

        // Chat Handlers
        const sendMessage = async () => {
            const message = chatInput.value.trim();
            if (!message || !currentDraftId) return;

            try {
                await db.collection('drafts').doc(currentDraftId).collection('chat').add({
                    message: message,
                    userId: user.uid,
                    userName: user.displayName || 'Anonymous',
                    userPhoto: user.photoURL || 'https://i.imgur.com/B06rBhI.png',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                chatInput.value = '';
            } catch (error) {
                console.error('Error sending message:', error);
                showNotification('Failed to send message', 'error');
            }
        };

        sendChatBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Draft Lobby Listener
        const listenToDraftLobby = (draftId) => {
            if (unsubscribeDraft) unsubscribeDraft();
            currentDraftId = draftId;
            
            unsubscribeDraft = db.collection('drafts').doc(draftId).onSnapshot(doc => {
                if (!doc.exists) {
                    showNotification('This draft no longer exists.', 'error');
                    window.location.hash = '';
                    return;
                }
                
                const data = doc.data();
                if (data.status === 'drafting') {
                    window.location.href = `draft-room.html?id=${draftId}`;
                } else {
                    updateLobbyUI(data);
                }
            });

            // Listen to chat messages
            db.collection('drafts').doc(draftId).collection('chat')
                .orderBy('timestamp', 'asc')
                .onSnapshot(snapshot => {
                    chatMessages.innerHTML = '';
                    snapshot.docs.forEach(doc => {
                        const msg = doc.data();
                        const messageEl = document.createElement('div');
                        messageEl.className = 'flex items-start space-x-2 p-2 rounded hover:bg-gray-700';
                        messageEl.innerHTML = `
                            <img src="${msg.userPhoto}" class="w-6 h-6 rounded-full flex-shrink-0">
                            <div class="flex-grow min-w-0">
                                <div class="flex items-center space-x-2">
                                    <span class="font-semibold text-sm text-blue-400">${msg.userName}</span>
                                    <span class="text-xs text-gray-500">${msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString() : 'now'}</span>
                                </div>
                                <p class="text-sm text-gray-200 break-words">${msg.message}</p>
                            </div>
                        `;
                        chatMessages.appendChild(messageEl);
                    });
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                });
        };

        const updateLobbyUI = (draftData) => {
            draftListContainer.classList.add('hidden');
            currentDraftLobby.classList.remove('hidden');
            
            draftSetName.textContent = draftData.setName || draftData.set;
            playerCount.textContent = draftData.players.length;
            
            playerList.innerHTML = draftData.players.map((p, index) => `
                <li class="flex items-center space-x-3 p-3 bg-gray-600 rounded-lg">
                    <img src="${p.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-10 h-10 rounded-full">
                    <div class="flex-grow">
                        <div class="font-semibold text-white">${p.displayName}</div>
                        <div class="text-xs text-gray-400">
                            ${p.userId === draftData.hostId ? '<i class="fas fa-crown text-yellow-400 mr-1"></i>Host' : `Player ${index + 1}`}
                        </div>
                    </div>
                    ${p.userId === user.uid ? '<i class="fas fa-user text-blue-400"></i>' : ''}
                </li>
            `).join('');
            
            const isHost = user.uid === draftData.hostId;
            const hasEnoughPlayers = draftData.players.length >= 2; // Minimum for testing
            startDraftBtn.classList.toggle('hidden', !isHost);
            startDraftBtn.disabled = !hasEnoughPlayers;
            
            if (isHost && !hasEnoughPlayers) {
                startDraftBtn.innerHTML = '<i class="fas fa-users mr-2"></i>Need More Players';
            } else if (isHost) {
                startDraftBtn.innerHTML = '<i class="fas fa-play mr-2"></i>Start Draft';
            }
        };
        
        const checkUrlForDraft = () => {
            const draftId = window.location.hash.substring(1);
            if (draftId) {
                joinDraft({ draftId })
                    .then(() => {
                        listenToDraftLobby(draftId);
                        showNotification('Joined draft successfully!', 'success');
                    })
                    .catch(err => {
                        showNotification(`Could not join draft: ${err.message}`, 'error');
                        window.location.hash = '';
                    });
            } else {
                if (unsubscribeDraft) unsubscribeDraft();
                currentDraftLobby.classList.add('hidden');
                draftListContainer.classList.remove('hidden');
                
                // Load open drafts
                db.collection('drafts').where('status', '==', 'lobby').onSnapshot(snapshot => {
                    if (snapshot.docs.length === 0) {
                        draftList.innerHTML = `
                            <div class="text-center py-12">
                                <i class="fas fa-inbox text-4xl text-gray-600 mb-4"></i>
                                <p class="text-gray-400 text-lg">No open drafts found</p>
                                <p class="text-gray-500 text-sm">Why not create one?</p>
                            </div>
                        `;
                    } else {
                        draftList.innerHTML = snapshot.docs.map(doc => {
                            const data = doc.data();
                            return `
                                <div class="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-colors">
                                    <div class="flex justify-between items-center">
                                        <div>
                                            <h3 class="font-bold text-lg text-white mb-1">${data.setName}</h3>
                                            <div class="flex items-center space-x-4 text-sm text-gray-400">
                                                <span><i class="fas fa-user mr-1"></i>Host: ${data.hostName}</span>
                                                <span><i class="fas fa-users mr-1"></i>Players: ${data.players.length}/8</span>
                                                <span><i class="fas fa-clock mr-1"></i>${new Date(data.createdAt.toDate()).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                        <a href="#${doc.id}" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                                            <i class="fas fa-sign-in-alt mr-2"></i>Join
                                        </a>
                                    </div>
                                </div>
                            `;
                        }).join('');
                    }
                });
            }
        };

        window.addEventListener('hashchange', checkUrlForDraft);
        checkUrlForDraft();
    }

    // ===================================================================
    // DRAFT ROOM LOGIC
    // ===================================================================
    if (isRoomPage) {
        const draftSetName = document.getElementById('draft-set-name');
        const packNumEl = document.getElementById('pack-number');
        const pickNumEl = document.getElementById('pick-number');
        const timerDisplay = document.getElementById('timer-display');
        const currentPackCards = document.getElementById('current-pack-cards');
        const pickedCardsContainer = document.getElementById('picked-cards-container');
        const pickedCount = document.getElementById('picked-count');
        const totalPicks = document.getElementById('total-picks');
        const cardsRemaining = document.getElementById('cards-remaining');
        const buildDeckBtn = document.getElementById('build-deck-btn');
        const togglePicksBtn = document.getElementById('toggle-picks-btn');
        const pickedCardsFooter = document.getElementById('picked-cards-footer');
        
        // Modal elements
        const cardPreviewModal = document.getElementById('card-preview-modal');
        const previewImage = document.getElementById('preview-image');
        const closePreview = document.getElementById('close-preview');
        const draftCompleteModal = document.getElementById('draft-complete-modal');
        const viewPoolBtn = document.getElementById('view-pool-btn');
        const startBuildingBtn = document.getElementById('start-building-btn');
        
        const urlParams = new URLSearchParams(window.location.search);
        const draftId = urlParams.get('id');

        if (!draftId) {
            document.body.innerHTML = `
                <div class="flex items-center justify-center h-screen bg-gray-900">
                    <div class="text-center">
                        <i class="fas fa-exclamation-triangle text-6xl text-red-400 mb-4"></i>
                        <h1 class="text-2xl font-bold text-white mb-4">Error: No Draft ID</h1>
                        <p class="text-gray-400 mb-6">Please return to the lobby and join a draft.</p>
                        <a href="draft-lobby.html" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                            <i class="fas fa-arrow-left mr-2"></i>Back to Lobby
                        </a>
                    </div>
                </div>`;
            return;
        }

        // Event Handlers
        togglePicksBtn.addEventListener('click', () => {
            const isHidden = pickedCardsFooter.style.display === 'none';
            pickedCardsFooter.style.display = isHidden ? 'block' : 'none';
            togglePicksBtn.innerHTML = isHidden ? 
                '<i class="fas fa-eye-slash mr-1"></i>Hide Picks' : 
                '<i class="fas fa-eye mr-1"></i>Show Picks';
        });

        buildDeckBtn.addEventListener('click', () => {
            window.location.href = `draft-deck.html?id=${draftId}`;
        });

        closePreview.addEventListener('click', () => {
            cardPreviewModal.classList.add('hidden');
        });

        cardPreviewModal.addEventListener('click', (e) => {
            if (e.target === cardPreviewModal) {
                cardPreviewModal.classList.add('hidden');
            }
        });

        viewPoolBtn.addEventListener('click', () => {
            draftCompleteModal.classList.add('hidden');
            // Show all picked cards in a grid view
            showCardPool();
        });

        startBuildingBtn.addEventListener('click', () => {
            window.location.href = `draft-deck.html?id=${draftId}`;
        });

        const showCardPreview = (card) => {
            previewImage.src = card.imageUrl;
            previewImage.alt = card.name;
            cardPreviewModal.classList.remove('hidden');
        };

        const showCardPool = () => {
            // Implementation for showing all cards in a grid
            // This would be a modal or separate view showing all drafted cards
        };

        const listenToDraftRoom = () => {
            unsubscribeDraft = db.collection('drafts').doc(draftId).onSnapshot(doc => {
                if (!doc.exists) {
                    showNotification('Draft not found!', 'error');
                    window.location.href = 'draft-lobby.html';
                    return;
                }
                
                const data = doc.data();
                draftSetName.innerHTML = `<i class="fas fa-magic mr-2 text-purple-400"></i>Drafting: ${data.setName}`;
                packNumEl.textContent = data.currentPackNumber || 1;
                pickNumEl.textContent = data.currentPickNumber || 1;
                
                if (data.status === 'completed') {
                    draftCompleteModal.classList.remove('hidden');
                    buildDeckBtn.classList.remove('hidden');
                }
            });

            unsubscribePlayerState = db.collection('drafts').doc(draftId).collection('playerState').doc(user.uid)
                .onSnapshot(doc => {
                    if (!doc.exists) return;
                    const data = doc.data();
                    renderCurrentPack(data.currentPack || []);
                    renderPickedCards(data.pickedCards || []);
                });
        };

        const renderCurrentPack = (cards) => {
            cardsRemaining.textContent = cards.length;
            
            if (!cards || cards.length === 0) {
                currentPackCards.innerHTML = `
                    <div class="col-span-full flex items-center justify-center h-64">
                        <div class="text-center">
                            <i class="fas fa-hourglass-half text-4xl text-yellow-400 mb-4 animate-spin"></i>
                            <p class="text-xl text-gray-300">Waiting for the next pack...</p>
                            <p class="text-sm text-gray-500 mt-2">Other players are still picking</p>
                        </div>
                    </div>
                `;
                return;
            }
            
            currentPackCards.innerHTML = cards.map(card => `
                <div class="cursor-pointer card-hover relative group" data-card-id="${card.id}">
                    <img src="${card.imageUrl}" alt="${card.name}" class="rounded-lg w-full shadow-lg">
                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                        <i class="fas fa-search-plus text-white opacity-0 group-hover:opacity-100 text-2xl"></i>
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <p class="text-white text-xs font-semibold truncate">${card.name}</p>
                        <p class="text-gray-300 text-xs">${card.rarity}</p>
                    </div>
                </div>
            `).join('');
            
            // Add click handlers
            currentPackCards.querySelectorAll('[data-card-id]').forEach(el => {
                const card = cards.find(c => c.id === el.dataset.cardId);
                
                // Right click for preview
                el.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    showCardPreview(card);
                });
                
                // Left click to pick
                el.addEventListener('click', async () => {
                    const selectedCardId = el.dataset.cardId;
                    currentPackCards.innerHTML = `
                        <div class="col-span-full flex items-center justify-center h-64">
                            <div class="text-center">
                                <i class="fas fa-spinner fa-spin text-4xl text-blue-400 mb-4"></i>
                                <p class="text-xl text-gray-300">Passing pack...</p>
                                <p class="text-sm text-gray-500 mt-2">Your pick has been submitted</p>
                            </div>
                        </div>
                    `;
                    
                    try {
                        await pickCard({ draftId, selectedCardId });
                        showNotification(`Picked: ${card.name}`, 'success');
                    } catch (error) {
                        console.error("Error picking card:", error);
                        showNotification(`Error picking card: ${error.message}`, 'error');
                        // Reload state to get a fresh pack if something went wrong
                        db.collection('drafts').doc(draftId).collection('playerState').doc(user.uid).get().then(doc => {
                            if (doc.exists) renderCurrentPack(doc.data().currentPack || []);
                        });
                    }
                });
            });
        };

        const renderPickedCards = (cards) => {
            pickedCount.textContent = cards.length;
            totalPicks.textContent = cards.length;
            
            if (cards.length === 0) {
                pickedCardsContainer.innerHTML = `
                    <div class="flex items-center justify-center w-full text-gray-500">
                        <div class="text-center">
                            <i class="fas fa-cards-blank text-2xl mb-2"></i>
                            <p class="text-sm">Your drafted cards will appear here</p>
                        </div>
                    </div>
                `;
                return;
            }
            
            pickedCardsContainer.innerHTML = cards.map((card, index) => `
                <div class="relative group flex-shrink-0 picked-card" title="${card.name}">
                    <img src="${card.imageUrl}" alt="${card.name}" class="h-full rounded-md shadow-lg cursor-pointer">
                    <div class="absolute top-1 left-1 bg-black bg-opacity-75 text-white text-xs px-1 rounded">
                        ${index + 1}
                    </div>
                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-md flex items-center justify-center">
                        <i class="fas fa-search-plus text-white opacity-0 group-hover:opacity-100"></i>
                    </div>
                </div>
            `).join('');
            
            // Add preview handlers to picked cards
            pickedCardsContainer.querySelectorAll('.picked-card').forEach((el, index) => {
                el.addEventListener('click', () => {
                    showCardPreview(cards[index]);
                });
            });
            
            // Scroll to the end
            pickedCardsContainer.scrollLeft = pickedCardsContainer.scrollWidth;
        };
        
        listenToDraftRoom();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (unsubscribeDraft) unsubscribeDraft();
        if (unsubscribePlayerState) unsubscribePlayerState();
        if (draftTimer) clearInterval(draftTimer);
    });
});
