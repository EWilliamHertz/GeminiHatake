// Local Draft Implementation for Testing
// This provides a simplified draft system that works without Firebase

class LocalDraftManager {
    constructor() {
        this.currentDraft = null;
        this.players = [];
        this.packs = [];
        this.currentPack = 1;
        this.currentPick = 1;
        this.playerPicks = {};
        this.isActive = false;
        this.botManager = window.draftBotManager;
        this.pickTimer = null;
        this.pickTimeLimit = 30; // seconds
        this.currentPlayerIndex = 0;
    }

    // Initialize a new draft
    createDraft(setCode, hostPlayer) {
        this.currentDraft = {
            id: `local_${Date.now()}`,
            setCode: setCode,
            setName: this.getSetName(setCode),
            host: hostPlayer,
            status: 'lobby',
            createdAt: new Date()
        };
        
        this.players = [hostPlayer];
        this.playerPicks = {};
        this.players.forEach(player => {
            this.playerPicks[player.id] = [];
        });

        console.log('Local draft created:', this.currentDraft);
        return this.currentDraft;
    }

    // Add a player to the draft
    addPlayer(player) {
        if (this.players.length >= 8) {
            throw new Error('Draft is full');
        }
        
        this.players.push(player);
        this.playerPicks[player.id] = [];
        this.updateUI();
        
        console.log(`Player ${player.name} joined the draft`);
    }

    // Add a bot to the draft
    addBot() {
        if (this.players.length >= 8) {
            throw new Error('Draft is full');
        }

        const bot = this.botManager.createBot();
        const botPlayer = {
            id: bot.id,
            name: bot.name,
            photoURL: bot.photoURL,
            isBot: true,
            personality: bot.personality
        };

        this.addPlayer(botPlayer);
        
        // Bot sends a greeting message
        setTimeout(() => {
            this.addChatMessage(bot.generateChatMessage('general'), botPlayer);
        }, Math.random() * 2000 + 500);

        return botPlayer;
    }

    // Fill remaining slots with bots
    fillWithBots() {
        while (this.players.length < 8) {
            this.addBot();
        }
    }

    // Start the draft
    async startDraft() {
        if (this.players.length < 2) {
            throw new Error('Need at least 2 players to start');
        }

        this.currentDraft.status = 'drafting';
        this.isActive = true;
        this.currentPack = 1;
        this.currentPick = 1;
        this.currentPlayerIndex = 0;

        // Generate packs for all players
        await this.generateAllPacks();
        
        // Start the first pick
        this.startPickTimer();
        
        console.log('Draft started!');
        this.updateUI();
    }

    // Generate booster packs for all players
    async generateAllPacks() {
        this.packs = [];
        
        for (let packNum = 1; packNum <= 3; packNum++) {
            const packSet = [];
            for (let playerIndex = 0; playerIndex < this.players.length; playerIndex++) {
                const pack = await this.generateBoosterPack(this.currentDraft.setCode);
                packSet.push(pack);
            }
            this.packs.push(packSet);
        }
        
        console.log('Generated packs for all players');
    }

    // Generate a booster pack
    async generateBoosterPack(setCode) {
        // Simulate pack generation with realistic card distribution
        const pack = [];
        const rarities = [
            'Common', 'Common', 'Common', 'Common', 'Common', 'Common', 'Common', 'Common', 'Common', 'Common',
            'Uncommon', 'Uncommon', 'Uncommon',
            Math.random() < 0.125 ? 'Mythic Rare' : 'Rare', // 1/8 chance for mythic
            'Land'
        ];

        const cardTypes = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker'];
        const colors = ['W', 'U', 'B', 'R', 'G'];

        rarities.forEach((rarity, index) => {
            const cardType = cardTypes[Math.floor(Math.random() * cardTypes.length)];
            const color = colors[Math.floor(Math.random() * colors.length)];
            const cmc = Math.floor(Math.random() * 8) + (rarity === 'Common' ? 0 : 1);
            
            const card = {
                id: `${setCode}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                name: `${this.getColorName(color)} ${cardType} ${index + 1}`,
                imageUrl: `https://via.placeholder.com/223x310/1a1a1a/ffffff?text=${encodeURIComponent(rarity)}`,
                manaCost: cmc > 0 ? `{${cmc > 1 ? cmc - 1 : ''}}${cmc > 0 ? `{${color}}` : ''}` : `{${color}}`,
                type: cardType,
                rarity: rarity,
                set: setCode,
                colors: [color]
            };
            
            pack.push(card);
        });

        return pack;
    }

    // Get current pack for a player
    getCurrentPack(playerIndex) {
        if (!this.packs[this.currentPack - 1]) return [];
        
        // Calculate which pack this player should get based on draft direction
        let packIndex;
        if (this.currentPack % 2 === 1) {
            // Packs 1 and 3 go left to right
            packIndex = (playerIndex + this.currentPick - 1) % this.players.length;
        } else {
            // Pack 2 goes right to left
            packIndex = (playerIndex - this.currentPick + 1 + this.players.length) % this.players.length;
        }
        
        return this.packs[this.currentPack - 1][packIndex] || [];
    }

    // Make a pick for a player
    async makePick(playerIndex, cardId) {
        const player = this.players[playerIndex];
        const pack = this.getCurrentPack(playerIndex);
        const cardIndex = pack.findIndex(card => card.id === cardId);
        
        if (cardIndex === -1) {
            throw new Error('Card not found in pack');
        }

        const pickedCard = pack.splice(cardIndex, 1)[0];
        this.playerPicks[player.id].push(pickedCard);

        console.log(`${player.name} picked: ${pickedCard.name}`);

        // Check if all players have picked
        await this.checkAllPlayersPicked();
    }

    // Handle bot picks
    async handleBotPicks() {
        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            if (player.isBot) {
                const pack = this.getCurrentPack(i);
                if (pack.length > 0) {
                    const bot = this.botManager.getBotById(player.id);
                    if (bot) {
                        const pickedCard = await bot.makePick(pack, this.currentPack, this.currentPick);
                        if (pickedCard) {
                            await this.makePick(i, pickedCard.id);
                        }
                    }
                }
            }
        }
    }

    // Check if all players have made their picks
    async checkAllPlayersPicked() {
        // For simplicity, advance immediately after human pick
        // In a real implementation, you'd wait for all players
        
        this.currentPick++;
        
        // Check if pack is done (15 cards, so 15 picks)
        if (this.currentPick > 15) {
            this.currentPack++;
            this.currentPick = 1;
            
            if (this.currentPack > 3) {
                // Draft is complete
                this.completeDraft();
                return;
            }
        }

        // Handle bot picks for next round
        setTimeout(() => {
            this.handleBotPicks();
            this.updateUI();
        }, 1000);
    }

    // Complete the draft
    completeDraft() {
        this.isActive = false;
        this.currentDraft.status = 'complete';
        
        console.log('Draft completed!');
        console.log('Player picks:', this.playerPicks);
        
        // Show completion modal or redirect
        this.showDraftComplete();
    }

    // Start pick timer
    startPickTimer() {
        if (this.pickTimer) {
            clearInterval(this.pickTimer);
        }

        let timeLeft = this.pickTimeLimit;
        this.pickTimer = setInterval(() => {
            timeLeft--;
            this.updateTimerDisplay(timeLeft);
            
            if (timeLeft <= 0) {
                // Auto-pick for human player if time runs out
                this.autoPickForHuman();
            }
        }, 1000);
    }

    // Auto-pick for human player
    autoPickForHuman() {
        const humanPlayerIndex = this.players.findIndex(p => !p.isBot);
        if (humanPlayerIndex !== -1) {
            const pack = this.getCurrentPack(humanPlayerIndex);
            if (pack.length > 0) {
                // Pick the first card (or implement better auto-pick logic)
                this.makePick(humanPlayerIndex, pack[0].id);
            }
        }
    }

    // Utility methods
    getSetName(setCode) {
        const setNames = {
            'MKM': 'Murders at Karlov Manor',
            'LCI': 'The Lost Caverns of Ixalan',
            'WOE': 'Wilds of Eldraine',
            'LTR': 'The Lord of the Rings: Tales of Middle-earth',
            'MOM': 'March of the Machine',
            'ONE': 'Phyrexia: All Will Be One',
            'BRO': 'The Brothers\' War',
            'DMU': 'Dominaria United'
        };
        return setNames[setCode] || setCode;
    }

    getColorName(colorCode) {
        const colorNames = {
            'W': 'White',
            'U': 'Blue', 
            'B': 'Black',
            'R': 'Red',
            'G': 'Green'
        };
        return colorNames[colorCode] || 'Colorless';
    }

    // UI Update methods
    updateUI() {
        this.updatePlayerList();
        this.updateDraftInfo();
        this.updateCurrentPack();
        this.updatePickedCards();
    }

    updatePlayerList() {
        const playerList = document.getElementById('player-list');
        if (!playerList) return;

        playerList.innerHTML = this.players.map((player, index) => `
            <li class="flex items-center space-x-3 p-3 bg-gray-600 rounded-lg">
                <img src="${player.photoURL || 'https://via.placeholder.com/40x40/666/fff?text=P'}" class="w-10 h-10 rounded-full">
                <div class="flex-grow">
                    <div class="font-semibold text-white flex items-center">
                        ${player.name}
                        ${player.isBot ? '<i class="fas fa-robot text-purple-400 ml-2"></i>' : ''}
                    </div>
                    <div class="text-xs text-gray-400">
                        ${index === 0 ? '<i class="fas fa-crown text-yellow-400 mr-1"></i>Host' : `Player ${index + 1}`}
                    </div>
                </div>
            </li>
        `).join('');

        // Update player count
        const playerCount = document.getElementById('player-count');
        if (playerCount) {
            playerCount.textContent = this.players.length;
        }
    }

    updateDraftInfo() {
        const packNumber = document.getElementById('pack-number');
        const pickNumber = document.getElementById('pick-number');
        
        if (packNumber) packNumber.textContent = this.currentPack;
        if (pickNumber) pickNumber.textContent = this.currentPick;
    }

    updateCurrentPack() {
        const currentPackCards = document.getElementById('current-pack-cards');
        if (!currentPackCards || !this.isActive) return;

        const humanPlayerIndex = this.players.findIndex(p => !p.isBot);
        if (humanPlayerIndex === -1) return;

        const pack = this.getCurrentPack(humanPlayerIndex);
        
        currentPackCards.innerHTML = pack.map(card => `
            <div class="card-hover cursor-pointer bg-gray-700 rounded-lg p-2 transition-all duration-200" 
                 onclick="localDraft.makePick(${humanPlayerIndex}, '${card.id}')">
                <img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded">
                <div class="mt-2 text-xs text-center">
                    <div class="font-semibold text-white truncate">${card.name}</div>
                    <div class="text-gray-400">${card.rarity}</div>
                </div>
            </div>
        `).join('');
    }

    updatePickedCards() {
        const pickedCardsContainer = document.getElementById('picked-cards-container');
        const pickedCount = document.getElementById('picked-count');
        
        if (!pickedCardsContainer || !this.isActive) return;

        const humanPlayerIndex = this.players.findIndex(p => !p.isBot);
        if (humanPlayerIndex === -1) return;

        const humanPlayer = this.players[humanPlayerIndex];
        const picks = this.playerPicks[humanPlayer.id] || [];
        
        if (pickedCount) {
            pickedCount.textContent = picks.length;
        }

        pickedCardsContainer.innerHTML = picks.map(card => `
            <div class="picked-card flex-shrink-0 bg-gray-700 rounded p-1" style="width: 80px;">
                <img src="${card.imageUrl}" alt="${card.name}" class="w-full rounded">
                <div class="text-xs text-center mt-1 text-white truncate">${card.name}</div>
            </div>
        `).join('');
    }

    updateTimerDisplay(timeLeft) {
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = `${timeLeft}s`;
            if (timeLeft <= 10) {
                timerDisplay.classList.add('text-red-400');
            } else {
                timerDisplay.classList.remove('text-red-400');
            }
        }
    }

    addChatMessage(message, player) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const messageEl = document.createElement('div');
        messageEl.className = 'flex items-start space-x-2 p-2 rounded hover:bg-gray-700';
        messageEl.innerHTML = `
            <img src="${player.photoURL || 'https://via.placeholder.com/24x24/666/fff?text=P'}" class="w-6 h-6 rounded-full flex-shrink-0">
            <div class="flex-grow min-w-0">
                <div class="flex items-center space-x-2">
                    <span class="font-semibold text-sm text-blue-400">${player.name}</span>
                    ${player.isBot ? '<i class="fas fa-robot text-purple-400 text-xs"></i>' : ''}
                    <span class="text-xs text-gray-500">${new Date().toLocaleTimeString()}</span>
                </div>
                <p class="text-sm text-gray-200 break-words">${message}</p>
            </div>
        `;
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showDraftComplete() {
        const modal = document.getElementById('draft-complete-modal');
        if (modal) {
            modal.classList.remove('hidden');
        } else {
            alert('Draft completed! Check console for results.');
        }
    }
}

// Initialize global local draft manager
window.localDraft = new LocalDraftManager();

console.log('Local Draft System initialized');
