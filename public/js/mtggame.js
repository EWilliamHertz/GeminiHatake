document.addEventListener('authReady', ({ detail: { user } }) => {
    if (!user) {
        document.body.innerHTML = `
            <div class="flex items-center justify-center h-screen bg-gray-900">
                <div class="text-center">
                    <i class="fas fa-user-slash text-6xl text-red-400 mb-4"></i>
                    <h1 class="text-2xl font-bold text-white mb-4">Authentication Required</h1>
                    <p class="text-gray-400 mb-6">Please log in to play Magic: The Gathering.</p>
                    <a href="/index.html" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                        <i class="fas fa-home mr-2"></i>Go to Home
                    </a>
                </div>
            </div>`;
        return;
    }

    const db = firebase.firestore();
    const functions = firebase.functions();
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('id');

    if (!gameId) {
        document.body.innerHTML = `
            <div class="flex items-center justify-center h-screen bg-gray-900">
                <div class="text-center">
                    <i class="fas fa-exclamation-triangle text-6xl text-red-400 mb-4"></i>
                    <h1 class="text-2xl font-bold text-white mb-4">Error: No Game ID</h1>
                    <p class="text-gray-400 mb-6">Please return to the lobby and start a game.</p>
                    <a href="draft-lobby.html" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                        <i class="fas fa-arrow-left mr-2"></i>Back to Lobby
                    </a>
                </div>
            </div>`;
        return;
    }

    // Game state
    let gameState = null;
    let playerState = null;
    let selectedCards = new Set();
    let currentPhase = 'untap';
    let gameLog = [];
    let unsubscribeGame = null;
    let unsubscribePlayer = null;

    // DOM Elements
    const playerHand = document.getElementById('player-hand');
    const playerBattlefield = document.getElementById('player-battlefield');
    const opponentBattlefield = document.getElementById('opponent-battlefield');
    const playerLife = document.getElementById('player-life');
    const opponentLife = document.getElementById('opponent-life');
    const playerHandCount = document.getElementById('player-hand-count');
    const opponentHandCount = document.getElementById('opponent-hand-count');
    const gamePhase = document.getElementById('game-phase');
    const turnNumber = document.getElementById('turn-number');
    const priorityIndicator = document.getElementById('priority-indicator');
    const playerManaPool = document.getElementById('player-mana-pool');
    const opponentManaPool = document.getElementById('opponent-mana-pool');
    const gameLogElement = document.getElementById('game-log');
    const gameLogSidebar = document.getElementById('game-log-sidebar');
    
    // Buttons
    const nextPhaseBtn = document.getElementById('next-phase-btn');
    const passTurnBtn = document.getElementById('pass-turn-btn');
    const concedeBtn = document.getElementById('concede-btn');
    const drawCardBtn = document.getElementById('draw-card-btn');
    const mulliganBtn = document.getElementById('mulligan-btn');
    const toggleLogBtn = document.getElementById('toggle-log-btn');
    const closeLogBtn = document.getElementById('close-log-btn');
    
    // Modals
    const cardPreviewModal = document.getElementById('card-preview-modal');
    const cardPreviewImage = document.getElementById('card-preview-image');
    const closeCardPreview = document.getElementById('close-card-preview');
    const cardActions = document.getElementById('card-actions');
    const gameOverModal = document.getElementById('game-over-modal');
    const gameResultIcon = document.getElementById('game-result-icon');
    const gameResultTitle = document.getElementById('game-result-title');
    const gameResultMessage = document.getElementById('game-result-message');
    const playAgainBtn = document.getElementById('play-again-btn');
    const returnLobbyBtn = document.getElementById('return-lobby-btn');
    
    // Stack
    const stackZone = document.getElementById('stack-zone');
    const stackContents = document.getElementById('stack-contents');
    const resolveStackBtn = document.getElementById('resolve-stack-btn');
    const addToStackBtn = document.getElementById('add-to-stack-btn');

    // Cloud Functions
    const playCard = functions.httpsCallable('playCard');
    const tapCard = functions.httpsCallable('tapCard');
    const untapCard = functions.httpsCallable('untapCard');
    const attackWithCreature = functions.httpsCallable('attackWithCreature');
    const blockWithCreature = functions.httpsCallable('blockWithCreature');
    const nextPhase = functions.httpsCallable('nextPhase');
    const passTurn = functions.httpsCallable('passTurn');
    const drawCard = functions.httpsCallable('drawCard');
    const concede = functions.httpsCallable('concede');

    // Utility Functions
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

    const addToGameLog = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        gameLog.unshift({ message, timestamp });
        updateGameLog();
    };

    const updateGameLog = () => {
        gameLogElement.innerHTML = gameLog.map(entry => `
            <div class="log-entry">
                <span class="text-gray-400 text-xs">[${entry.timestamp}]</span>
                <span class="ml-2">${entry.message}</span>
            </div>
        `).join('');
    };

    const getCardCmc = (card) => {
        if (!card.manaCost) return 0;
        const matches = card.manaCost.match(/\\{(\\d+)\\}/g);
        let cmc = 0;
        if (matches) {
            matches.forEach(match => {
                const num = parseInt(match.replace(/[{}]/g, ''));
                if (!isNaN(num)) cmc += num;
            });
        }
        const symbols = card.manaCost.match(/\\{[WUBRG]\\}/g);
        if (symbols) cmc += symbols.length;
        return cmc;
    };

    const isCreature = (card) => {
        return card.type && card.type.toLowerCase().includes('creature');
    };

    const isLand = (card) => {
        return card.type && card.type.toLowerCase().includes('land');
    };

    const canPlayCard = (card) => {
        if (isLand(card)) {
            return gameState.currentPhase === 'main1' || gameState.currentPhase === 'main2';
        }
        return gameState.currentPhase === 'main1' || gameState.currentPhase === 'main2';
    };

    const createCardElement = (card, zone, options = {}) => {
        const cardEl = document.createElement('div');
        cardEl.className = `card-${zone} ${options.tapped ? 'tapped' : ''} ${options.selected ? 'selected' : ''}`;
        cardEl.dataset.cardId = card.id;
        cardEl.dataset.zone = zone;
        
        cardEl.innerHTML = `
            <img src="${card.imageUrl}" alt="${card.name}" 
                 style="height: ${zone === 'in-hand' ? '120px' : '100px'}; width: auto;">
        `;
        
        // Add event listeners
        cardEl.addEventListener('click', (e) => handleCardClick(e, card, zone));
        cardEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showCardPreview(card, zone);
        });
        
        return cardEl;
    };

    const handleCardClick = async (e, card, zone) => {
        e.stopPropagation();
        
        if (zone === 'in-hand') {
            if (canPlayCard(card)) {
                try {
                    await playCard({ gameId, cardId: card.id });
                    addToGameLog(`You played ${card.name}`);
                } catch (error) {
                    showNotification(`Cannot play ${card.name}: ${error.message}`, 'error');
                }
            } else {
                showNotification(`Cannot play ${card.name} during ${gameState.currentPhase} phase`, 'warning');
            }
        } else if (zone === 'in-play') {
            if (selectedCards.has(card.id)) {
                selectedCards.delete(card.id);
                e.target.closest('.card-in-play').classList.remove('selected');
            } else {
                selectedCards.add(card.id);
                e.target.closest('.card-in-play').classList.add('selected');
            }
        }
    };

    const showCardPreview = (card, zone) => {
        cardPreviewImage.src = card.imageUrl;
        cardPreviewImage.alt = card.name;
        
        // Clear previous actions
        cardActions.innerHTML = '';
        
        // Add appropriate action buttons based on zone and card type
        if (zone === 'in-hand' && canPlayCard(card)) {
            const playBtn = document.createElement('button');
            playBtn.className = 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors';
            playBtn.innerHTML = '<i class="fas fa-play mr-2"></i>Play';
            playBtn.onclick = async () => {
                try {
                    await playCard({ gameId, cardId: card.id });
                    cardPreviewModal.classList.add('hidden');
                    addToGameLog(`You played ${card.name}`);
                } catch (error) {
                    showNotification(`Cannot play ${card.name}: ${error.message}`, 'error');
                }
            };
            cardActions.appendChild(playBtn);
        }
        
        if (zone === 'in-play') {
            if (isLand(card) && !card.tapped) {
                const tapBtn = document.createElement('button');
                tapBtn.className = 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors';
                tapBtn.innerHTML = '<i class="fas fa-hand-point-down mr-2"></i>Tap for Mana';
                tapBtn.onclick = async () => {
                    try {
                        await tapCard({ gameId, cardId: card.id });
                        cardPreviewModal.classList.add('hidden');
                        addToGameLog(`You tapped ${card.name} for mana`);
                    } catch (error) {
                        showNotification(`Cannot tap ${card.name}: ${error.message}`, 'error');
                    }
                };
                cardActions.appendChild(tapBtn);
            }
            
            if (isCreature(card) && gameState.currentPhase === 'combat') {
                const attackBtn = document.createElement('button');
                attackBtn.className = 'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors';
                attackBtn.innerHTML = '<i class="fas fa-sword mr-2"></i>Attack';
                attackBtn.onclick = async () => {
                    try {
                        await attackWithCreature({ gameId, cardId: card.id });
                        cardPreviewModal.classList.add('hidden');
                        addToGameLog(`${card.name} attacks!`);
                    } catch (error) {
                        showNotification(`Cannot attack with ${card.name}: ${error.message}`, 'error');
                    }
                };
                cardActions.appendChild(attackBtn);
            }
        }
        
        cardPreviewModal.classList.remove('hidden');
    };

    const updateGameUI = () => {
        if (!gameState || !playerState) return;
        
        // Update life totals
        playerLife.textContent = playerState.life;
        opponentLife.textContent = gameState.players.find(p => p.id !== user.uid)?.life || 20;
        
        // Update hand counts
        playerHandCount.textContent = playerState.hand.length;
        const opponentState = gameState.players.find(p => p.id !== user.uid);
        opponentHandCount.textContent = opponentState?.handSize || 0;
        document.getElementById('opp-hand-display').textContent = opponentState?.handSize || 0;
        
        // Update turn and phase
        turnNumber.textContent = gameState.turnNumber;
        gamePhase.textContent = gameState.currentPhase.charAt(0).toUpperCase() + gameState.currentPhase.slice(1);
        
        // Update priority indicator
        const hasPlayerPriority = gameState.playerWithPriority === user.uid;
        priorityIndicator.classList.toggle('hidden', !hasPlayerPriority);
        
        // Update phase indicator
        gamePhase.className = hasPlayerPriority ? 'phase-indicator phase-active' : 'phase-indicator phase-inactive';
        
        // Update player info
        document.getElementById('player-name').textContent = user.displayName || 'You';
        document.getElementById('player-avatar').src = user.photoURL || 'https://i.imgur.com/B06rBhI.png';
        
        if (opponentState) {
            document.getElementById('opponent-name').textContent = opponentState.displayName || 'Opponent';
            document.getElementById('opponent-avatar').src = opponentState.photoURL || 'https://i.imgur.com/B06rBhI.png';
        }
        
        // Render hand
        playerHand.innerHTML = '';
        if (playerState.hand.length === 0) {
            playerHand.innerHTML = '<div class="text-gray-500 text-sm">No cards in hand</div>';
        } else {
            playerState.hand.forEach(card => {
                const cardEl = createCardElement(card, 'in-hand');
                playerHand.appendChild(cardEl);
            });
        }
        
        // Render battlefield
        playerBattlefield.innerHTML = '';
        if (playerState.battlefield.length === 0) {
            playerBattlefield.innerHTML = '<div class="text-gray-500 text-sm">Your Battlefield</div>';
        } else {
            playerState.battlefield.forEach(card => {
                const cardEl = createCardElement(card, 'in-play', { 
                    tapped: card.tapped,
                    selected: selectedCards.has(card.id)
                });
                playerBattlefield.appendChild(cardEl);
            });
        }
        
        // Render opponent battlefield
        opponentBattlefield.innerHTML = '';
        if (opponentState && opponentState.battlefield.length === 0) {
            opponentBattlefield.innerHTML = '<div class="text-gray-500 text-sm">Opponent\\'s Battlefield</div>';
        } else if (opponentState) {
            opponentState.battlefield.forEach(card => {
                const cardEl = createCardElement(card, 'opponent-play');
                opponentBattlefield.appendChild(cardEl);
            });
        }
        
        // Update mana pools
        updateManaPool(playerState.manaPool, playerManaPool);
        if (opponentState) {
            updateManaPool(opponentState.manaPool, opponentManaPool);
        }
        
        // Update button states
        const isPlayerTurn = gameState.activePlayer === user.uid;
        nextPhaseBtn.disabled = !hasPlayerPriority;
        passTurnBtn.disabled = !isPlayerTurn;
        drawCardBtn.disabled = !hasPlayerPriority;
        
        // Check for game over
        if (gameState.status === 'finished') {
            showGameOver();
        }
    };

    const updateManaPool = (manaPool, container) => {
        container.innerHTML = '';
        if (!manaPool || Object.values(manaPool).every(count => count === 0)) {
            container.innerHTML = '<span class="text-gray-500 text-xs">No mana</span>';
            return;
        }
        
        const manaColors = [
            { symbol: 'W', color: '#fffbd5', name: 'White' },
            { symbol: 'U', color: '#0e68ab', name: 'Blue' },
            { symbol: 'B', color: '#150b00', name: 'Black' },
            { symbol: 'R', color: '#d3202a', name: 'Red' },
            { symbol: 'G', color: '#00733e', name: 'Green' },
            { symbol: 'C', color: '#ccc', name: 'Colorless' }
        ];
        
        manaColors.forEach(({ symbol, color, name }) => {
            const count = manaPool[symbol.toLowerCase()] || 0;
            if (count > 0) {
                const manaEl = document.createElement('div');
                manaEl.className = 'mana-symbol';
                manaEl.style.backgroundColor = color;
                manaEl.style.color = symbol === 'W' ? '#000' : '#fff';
                manaEl.textContent = count;
                manaEl.title = `${count} ${name} mana`;
                container.appendChild(manaEl);
            }
        });
    };

    const showGameOver = () => {
        const winner = gameState.winner;
        const isWinner = winner === user.uid;
        
        gameResultIcon.className = isWinner ? 'fas fa-trophy text-yellow-400 text-6xl mb-4' : 'fas fa-skull text-red-400 text-6xl mb-4';
        gameResultTitle.textContent = isWinner ? 'Victory!' : 'Defeat';
        gameResultMessage.textContent = isWinner ? 
            'Congratulations! You won the game!' : 
            'Better luck next time!';
        
        gameOverModal.classList.remove('hidden');
    };

    // Event Handlers
    nextPhaseBtn.addEventListener('click', async () => {
        try {
            await nextPhase({ gameId });
            addToGameLog(`Phase changed to ${gameState.currentPhase}`);
        } catch (error) {
            showNotification(`Cannot advance phase: ${error.message}`, 'error');
        }
    });

    passTurnBtn.addEventListener('click', async () => {
        try {
            await passTurn({ gameId });
            addToGameLog('You passed the turn');
        } catch (error) {
            showNotification(`Cannot pass turn: ${error.message}`, 'error');
        }
    });

    drawCardBtn.addEventListener('click', async () => {
        try {
            await drawCard({ gameId });
            addToGameLog('You drew a card');
        } catch (error) {
            showNotification(`Cannot draw card: ${error.message}`, 'error');
        }
    });

    concedeBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to concede? This will end the game.')) {
            try {
                await concede({ gameId });
                addToGameLog('You conceded the game');
            } catch (error) {
                showNotification(`Cannot concede: ${error.message}`, 'error');
            }
        }
    });

    mulliganBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to mulligan? You will draw one fewer card.')) {
            try {
                // Implement mulligan logic
                showNotification('Mulligan functionality coming soon!', 'info');
            } catch (error) {
                showNotification(`Cannot mulligan: ${error.message}`, 'error');
            }
        }
    });

    // Game log toggle
    toggleLogBtn.addEventListener('click', () => {
        gameLogSidebar.classList.toggle('translate-x-full');
    });

    closeLogBtn.addEventListener('click', () => {
        gameLogSidebar.classList.add('translate-x-full');
    });

    // Modal handlers
    closeCardPreview.addEventListener('click', () => {
        cardPreviewModal.classList.add('hidden');
    });

    cardPreviewModal.addEventListener('click', (e) => {
        if (e.target === cardPreviewModal) {
            cardPreviewModal.classList.add('hidden');
        }
    });

    playAgainBtn.addEventListener('click', () => {
        window.location.href = 'draft-lobby.html';
    });

    returnLobbyBtn.addEventListener('click', () => {
        window.location.href = 'draft-lobby.html';
    });

    // Stack handlers
    resolveStackBtn.addEventListener('click', () => {
        // Implement stack resolution
        stackZone.style.display = 'none';
    });

    addToStackBtn.addEventListener('click', () => {
        // Implement adding to stack
        showNotification('Stack interaction coming soon!', 'info');
    });

    // Initialize game listeners
    const initializeGame = () => {
        // Listen to game state
        unsubscribeGame = db.collection('games').doc(gameId).onSnapshot(doc => {
            if (doc.exists) {
                gameState = doc.data();
                updateGameUI();
            }
        });

        // Listen to player state
        unsubscribePlayer = db.collection('games').doc(gameId)
            .collection('players').doc(user.uid).onSnapshot(doc => {
                if (doc.exists) {
                    playerState = doc.data();
                    updateGameUI();
                }
            });
    };

    // Initialize the game
    initializeGame();
    addToGameLog('Game started - Good luck!');

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (unsubscribeGame) unsubscribeGame();
        if (unsubscribePlayer) unsubscribePlayer();
    });
});
