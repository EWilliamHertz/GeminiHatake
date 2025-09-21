// Draft Bot Implementation for HatakeSocial
// This module provides AI bot players for draft lobbies

class DraftBot {
    constructor(name, personality = 'balanced') {
        this.id = `bot_${Math.random().toString(36).substr(2, 9)}`;
        this.name = name;
        this.personality = personality; // 'aggressive', 'balanced', 'defensive', 'random'
        this.picks = [];
        this.colors = [];
        this.preferredTypes = [];
        this.isBot = true;
        this.photoURL = this.generateBotAvatar();
        this.pickDelay = Math.random() * 3000 + 2000; // 2-5 seconds
    }

    generateBotAvatar() {
        const avatars = [
            'https://api.dicebear.com/7.x/bottts/svg?seed=bot1',
            'https://api.dicebear.com/7.x/bottts/svg?seed=bot2',
            'https://api.dicebear.com/7.x/bottts/svg?seed=bot3',
            'https://api.dicebear.com/7.x/bottts/svg?seed=bot4',
            'https://api.dicebear.com/7.x/bottts/svg?seed=bot5'
        ];
        return avatars[Math.floor(Math.random() * avatars.length)];
    }

    // Evaluate a card based on bot's personality and current picks
    evaluateCard(card, availableCards, packNumber, pickNumber) {
        let score = 0;

        // Base rarity scoring
        const rarityScores = {
            'Mythic Rare': 100,
            'Rare': 80,
            'Uncommon': 40,
            'Common': 20
        };
        score += rarityScores[card.rarity] || 20;

        // Color consistency bonus
        if (this.colors.length > 0) {
            const cardColors = this.extractColors(card.manaCost);
            const colorMatch = cardColors.some(color => this.colors.includes(color));
            if (colorMatch) score += 30;
            else if (cardColors.length === 0) score += 10; // Colorless is flexible
            else score -= 20; // Off-color penalty
        }

        // Personality-based adjustments
        switch (this.personality) {
            case 'aggressive':
                if (card.type.includes('Creature')) score += 20;
                if (card.manaCost && this.getCMC(card.manaCost) <= 3) score += 15;
                break;
            case 'defensive':
                if (card.type.includes('Instant') || card.type.includes('Enchantment')) score += 15;
                if (card.manaCost && this.getCMC(card.manaCost) >= 4) score += 10;
                break;
            case 'random':
                score += Math.random() * 50 - 25; // Random variance
                break;
            default: // balanced
                if (card.type.includes('Creature')) score += 10;
                break;
        }

        // Early pick considerations
        if (pickNumber <= 3 && packNumber === 1) {
            score += rarityScores[card.rarity] * 0.5; // Prioritize power level early
        }

        // Late pick considerations
        if (pickNumber >= 10) {
            if (card.type.includes('Land')) score += 20; // Lands are good late
            if (this.colors.length > 0) {
                const cardColors = this.extractColors(card.manaCost);
                if (!cardColors.some(color => this.colors.includes(color))) {
                    score -= 40; // Heavy penalty for off-color late picks
                }
            }
        }

        return Math.max(0, score);
    }

    // Extract colors from mana cost
    extractColors(manaCost) {
        if (!manaCost) return [];
        const colors = [];
        if (manaCost.includes('W')) colors.push('White');
        if (manaCost.includes('U')) colors.push('Blue');
        if (manaCost.includes('B')) colors.push('Black');
        if (manaCost.includes('R')) colors.push('Red');
        if (manaCost.includes('G')) colors.push('Green');
        return colors;
    }

    // Get converted mana cost
    getCMC(manaCost) {
        if (!manaCost) return 0;
        let cmc = 0;
        const matches = manaCost.match(/\{(\d+)\}/g);
        if (matches) {
            matches.forEach(match => {
                const num = parseInt(match.replace(/[{}]/g, ''));
                if (!isNaN(num)) cmc += num;
            });
        }
        // Count colored mana symbols
        cmc += (manaCost.match(/\{[WUBRG]\}/g) || []).length;
        return cmc;
    }

    // Make a pick from available cards
    async makePick(availableCards, packNumber, pickNumber) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (!availableCards || availableCards.length === 0) {
                    resolve(null);
                    return;
                }

                // Evaluate all cards
                const evaluatedCards = availableCards.map(card => ({
                    card,
                    score: this.evaluateCard(card, availableCards, packNumber, pickNumber)
                }));

                // Sort by score and add some randomness
                evaluatedCards.sort((a, b) => {
                    const scoreDiff = b.score - a.score;
                    if (Math.abs(scoreDiff) < 10) {
                        return Math.random() - 0.5; // Random tiebreaker for close scores
                    }
                    return scoreDiff;
                });

                const pickedCard = evaluatedCards[0].card;
                
                // Update bot's strategy based on pick
                this.updateStrategy(pickedCard);
                this.picks.push(pickedCard);

                console.log(`Bot ${this.name} picked: ${pickedCard.name} (Score: ${evaluatedCards[0].score})`);
                resolve(pickedCard);
            }, this.pickDelay);
        });
    }

    // Update bot strategy based on picks
    updateStrategy(card) {
        const cardColors = this.extractColors(card.manaCost);
        
        // Establish colors based on early picks
        if (this.picks.length < 5) {
            cardColors.forEach(color => {
                if (!this.colors.includes(color)) {
                    this.colors.push(color);
                }
            });
            
            // Limit to 2-3 colors max
            if (this.colors.length > 3) {
                this.colors = this.colors.slice(0, 2);
            }
        }

        // Track preferred types
        if (card.type && !this.preferredTypes.includes(card.type)) {
            this.preferredTypes.push(card.type);
        }
    }

    // Generate a chat message occasionally
    generateChatMessage(context = 'general') {
        const messages = {
            general: [
                "Good luck everyone! 🎲",
                "This set looks fun to draft",
                "May the best drafter win!",
                "Ready to see some spicy picks",
                "Let's draft some magic!"
            ],
            pick: [
                "Nice pick!",
                "Interesting choice",
                "That's a solid card",
                "Good value there",
                "Smart pick"
            ],
            waiting: [
                "Take your time",
                "Thinking...",
                "Tough choice this pack",
                "So many good options",
                "This is a hard pick"
            ]
        };

        const messageArray = messages[context] || messages.general;
        return messageArray[Math.floor(Math.random() * messageArray.length)];
    }
}

// Bot Manager Class
class DraftBotManager {
    constructor() {
        this.bots = [];
        this.botNames = [
            'AlphaDrafter', 'BetaBot', 'CardCrafter', 'DraftMaster', 'EchoBot',
            'FlexPicker', 'GammaBot', 'HyperDraft', 'IntelliPick', 'JetBot',
            'KappaDraft', 'LambdaBot', 'MetaBot', 'NeuralPick', 'OmegaDraft',
            'PixelBot', 'QuantumPick', 'RhoBot', 'SigmaBot', 'ThetaDraft'
        ];
        this.usedNames = new Set();
    }

    createBot(personality = null) {
        const personalities = ['aggressive', 'balanced', 'defensive', 'random'];
        const selectedPersonality = personality || personalities[Math.floor(Math.random() * personalities.length)];
        
        // Get unused name
        const availableNames = this.botNames.filter(name => !this.usedNames.has(name));
        if (availableNames.length === 0) {
            // If all names used, generate a random one
            const randomName = `Bot${Math.floor(Math.random() * 1000)}`;
            this.usedNames.add(randomName);
            return new DraftBot(randomName, selectedPersonality);
        }

        const botName = availableNames[Math.floor(Math.random() * availableNames.length)];
        this.usedNames.add(botName);
        
        const bot = new DraftBot(botName, selectedPersonality);
        this.bots.push(bot);
        return bot;
    }

    removeBot(botId) {
        const botIndex = this.bots.findIndex(bot => bot.id === botId);
        if (botIndex !== -1) {
            const bot = this.bots[botIndex];
            this.usedNames.delete(bot.name);
            this.bots.splice(botIndex, 1);
        }
    }

    getBotById(botId) {
        return this.bots.find(bot => bot.id === botId);
    }

    // Add bots to fill a draft lobby
    async addBotsToLobby(draftId, targetPlayerCount = 8) {
        if (!window.firebase || !window.firebase.firestore) {
            console.error('Firebase not available for bot management');
            return;
        }

        const db = window.firebase.firestore();
        
        try {
            const draftDoc = await db.collection('drafts').doc(draftId).get();
            if (!draftDoc.exists) return;

            const draftData = draftDoc.data();
            const currentPlayerCount = draftData.players.length;
            const botsToAdd = Math.min(targetPlayerCount - currentPlayerCount, 7); // Max 7 bots

            for (let i = 0; i < botsToAdd; i++) {
                const bot = this.createBot();
                
                // Add bot to draft
                await db.collection('drafts').doc(draftId).update({
                    players: window.firebase.firestore.FieldValue.arrayUnion({
                        userId: bot.id,
                        displayName: bot.name,
                        photoURL: bot.photoURL,
                        isBot: true,
                        personality: bot.personality
                    })
                });

                // Occasionally send a chat message
                if (Math.random() < 0.3) {
                    setTimeout(async () => {
                        await db.collection('drafts').doc(draftId).collection('chat').add({
                            message: bot.generateChatMessage('general'),
                            userId: bot.id,
                            userName: bot.name,
                            userPhoto: bot.photoURL,
                            timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                            isBot: true
                        });
                    }, Math.random() * 5000 + 1000);
                }
            }

            console.log(`Added ${botsToAdd} bots to draft ${draftId}`);
        } catch (error) {
            console.error('Error adding bots to lobby:', error);
        }
    }

    // Handle bot picks during drafting
    async handleBotPick(draftId, botId, availableCards, packNumber, pickNumber) {
        const bot = this.getBotById(botId);
        if (!bot) return null;

        const pickedCard = await bot.makePick(availableCards, packNumber, pickNumber);
        
        // Occasionally send a chat message about the pick
        if (Math.random() < 0.2 && window.firebase) {
            const db = window.firebase.firestore();
            setTimeout(async () => {
                await db.collection('drafts').doc(draftId).collection('chat').add({
                    message: bot.generateChatMessage('pick'),
                    userId: bot.id,
                    userName: bot.name,
                    userPhoto: bot.photoURL,
                    timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                    isBot: true
                });
            }, Math.random() * 2000 + 500);
        }

        return pickedCard;
    }
}

// Export for use in other modules
window.DraftBotManager = DraftBotManager;
window.DraftBot = DraftBot;

// Initialize global bot manager
window.draftBotManager = new DraftBotManager();

console.log('Draft Bot System initialized');
