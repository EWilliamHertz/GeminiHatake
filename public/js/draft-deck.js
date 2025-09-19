document.addEventListener('authReady', ({ detail: { user } }) => {
    if (!user) {
        document.body.innerHTML = `
            <div class="flex items-center justify-center h-screen bg-gray-900">
                <div class="text-center">
                    <i class="fas fa-user-slash text-6xl text-red-400 mb-4"></i>
                    <h1 class="text-2xl font-bold text-white mb-4">Authentication Required</h1>
                    <p class="text-gray-400 mb-6">Please log in to build your deck.</p>
                    <a href="/index.html" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                        <i class="fas fa-home mr-2"></i>Go to Home
                    </a>
                </div>
            </div>`;
        return;
    }

    const db = firebase.firestore();
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

    const playerStateRef = db.collection('drafts').doc(draftId).collection('playerState').doc(user.uid);

    // DOM Elements
    const draftPoolList = document.getElementById('draft-pool-list');
    const mainDeckList = document.getElementById('main-deck-list');
    const poolCountDisplay = document.getElementById('pool-count-display');
    const deckCountDisplay = document.getElementById('deck-count-display');
    const mainDeckCount = document.getElementById('main-deck-count');
    const totalCards = document.getElementById('total-cards');
    const avgCmc = document.getElementById('avg-cmc');
    const saveDeckBtn = document.getElementById('save-deck-btn');
    const autoBuildBtn = document.getElementById('auto-build-btn');
    const clearDeckBtn = document.getElementById('clear-deck-btn');
    const cardSearch = document.getElementById('card-search');
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    // Color count elements
    const whiteCount = document.getElementById('white-count');
    const blueCount = document.getElementById('blue-count');
    const blackCount = document.getElementById('black-count');
    const redCount = document.getElementById('red-count');
    const greenCount = document.getElementById('green-count');
    
    // Land count elements
    const plainsCount = document.getElementById('plains-count');
    const islandCount = document.getElementById('island-count');
    const swampCount = document.getElementById('swamp-count');
    const mountainCount = document.getElementById('mountain-count');
    const forestCount = document.getElementById('forest-count');
    
    // Modal elements
    const cardPreviewModal = document.getElementById('card-preview-modal');
    const previewImage = document.getElementById('preview-image');
    const closePreview = document.getElementById('close-preview');

    // State
    let draftPool = [];
    let mainDeck = [];
    let basicLands = {
        Plains: 0,
        Island: 0,
        Swamp: 0,
        Mountain: 0,
        Forest: 0
    };
    let currentFilter = 'all';
    let searchTerm = '';

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
        // Count individual mana symbols
        const symbols = card.manaCost.match(/\\{[WUBRG]\\}/g);
        if (symbols) cmc += symbols.length;
        return Math.min(cmc, 15); // Cap at 15 for display purposes
    };

    const getCardColors = (card) => {
        const colors = [];
        if (!card.manaCost) return colors;
        if (card.manaCost.includes('{W}')) colors.push('W');
        if (card.manaCost.includes('{U}')) colors.push('U');
        if (card.manaCost.includes('{B}')) colors.push('B');
        if (card.manaCost.includes('{R}')) colors.push('R');
        if (card.manaCost.includes('{G}')) colors.push('G');
        return colors;
    };

    const isCreature = (card) => {
        return card.type && card.type.toLowerCase().includes('creature');
    };

    const filterCards = (cards) => {
        return cards.filter(card => {
            // Search filter
            if (searchTerm && !card.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
            }
            
            // Type/color filter
            switch (currentFilter) {
                case 'all':
                    return true;
                case 'creatures':
                    return isCreature(card);
                case 'spells':
                    return !isCreature(card);
                case 'white':
                    return getCardColors(card).includes('W');
                case 'blue':
                    return getCardColors(card).includes('U');
                case 'black':
                    return getCardColors(card).includes('B');
                case 'red':
                    return getCardColors(card).includes('R');
                case 'green':
                    return getCardColors(card).includes('G');
                default:
                    return true;
            }
        });
    };

    const updateStats = () => {
        const totalDeckSize = mainDeck.length + Object.values(basicLands).reduce((a, b) => a + b, 0);
        
        // Update counts
        poolCountDisplay.textContent = draftPool.length;
        deckCountDisplay.textContent = totalDeckSize;
        mainDeckCount.textContent = totalDeckSize;
        totalCards.textContent = totalDeckSize;
        
        // Update deck count color
        mainDeckCount.className = totalDeckSize >= 40 ? 'text-2xl font-bold text-green-400' : 
                                  totalDeckSize >= 35 ? 'text-2xl font-bold text-yellow-400' : 
                                  'text-2xl font-bold text-red-400';
        
        // Calculate average CMC
        if (mainDeck.length > 0) {
            const totalCmc = mainDeck.reduce((sum, card) => sum + getCardCmc(card), 0);
            avgCmc.textContent = (totalCmc / mainDeck.length).toFixed(1);
        } else {
            avgCmc.textContent = '0.0';
        }
        
        // Update mana curve
        const curve = [0, 0, 0, 0, 0, 0, 0]; // 0, 1, 2, 3, 4, 5, 6+
        mainDeck.forEach(card => {
            const cmc = getCardCmc(card);
            const index = Math.min(cmc, 6);
            curve[index]++;
        });
        
        const maxCount = Math.max(...curve, 1);
        curve.forEach((count, index) => {
            const bar = document.getElementById(`curve-${index}`);
            if (bar) {
                const percentage = (count / maxCount) * 100;
                bar.style.height = `${percentage}%`;
                bar.title = `${count} cards`;
            }
        });
        
        // Update color distribution
        const colorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
        mainDeck.forEach(card => {
            const colors = getCardColors(card);
            colors.forEach(color => colorCounts[color]++);
        });
        
        whiteCount.textContent = colorCounts.W;
        blueCount.textContent = colorCounts.U;
        blackCount.textContent = colorCounts.B;
        redCount.textContent = colorCounts.R;
        greenCount.textContent = colorCounts.G;
        
        // Update land counts
        plainsCount.textContent = basicLands.Plains;
        islandCount.textContent = basicLands.Island;
        swampCount.textContent = basicLands.Swamp;
        mountainCount.textContent = basicLands.Mountain;
        forestCount.textContent = basicLands.Forest;
        
        // Update save button state
        saveDeckBtn.disabled = totalDeckSize < 40;
        if (totalDeckSize < 40) {
            saveDeckBtn.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i>Need ${40 - totalDeckSize} More Cards`;
        } else {
            saveDeckBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save Deck';
        }
    };

    const renderCards = () => {
        const filteredPool = filterCards(draftPool);
        
        // Render draft pool
        if (filteredPool.length === 0) {
            draftPoolList.innerHTML = `
                <div class="col-span-full flex items-center justify-center h-32 text-gray-500">
                    <div class="text-center">
                        <i class="fas fa-search text-3xl mb-2"></i>
                        <p>No cards match your filter</p>
                    </div>
                </div>
            `;
        } else {
            draftPoolList.innerHTML = filteredPool.map(card => createCardElement(card, 'pool')).join('');
        }
        
        // Render main deck
        if (mainDeck.length === 0) {
            mainDeckList.innerHTML = `
                <div class="col-span-full flex items-center justify-center h-32 text-gray-500">
                    <div class="text-center">
                        <i class="fas fa-layer-group text-3xl mb-2"></i>
                        <p>Click cards from your pool to add them to your deck</p>
                    </div>
                </div>
            `;
        } else {
            // Group cards by name for deck display
            const cardCounts = {};
            mainDeck.forEach(card => {
                if (cardCounts[card.name]) {
                    cardCounts[card.name].count++;
                } else {
                    cardCounts[card.name] = { ...card, count: 1 };
                }
            });
            
            mainDeckList.innerHTML = Object.values(cardCounts).map(card => 
                createCardElement(card, 'deck', card.count)
            ).join('');
        }
        
        updateStats();
    };

    const createCardElement = (card, from, count = 1) => `
        <div class="card-item" data-card-id="${card.id}" data-from="${from}">
            <img src="${card.imageUrl}" alt="${card.name}" class="rounded-md w-full">
            ${count > 1 ? `<div class="card-count">${count}</div>` : ''}
        </div>
    `;

    const showCardPreview = (card) => {
        previewImage.src = card.imageUrl;
        previewImage.alt = card.name;
        cardPreviewModal.classList.remove('hidden');
    };

    const autoBuildDeck = () => {
        if (draftPool.length === 0) {
            showNotification('No cards in draft pool to build with!', 'warning');
            return;
        }
        
        // Clear current deck
        mainDeck = [];
        basicLands = { Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0 };
        
        // Simple auto-build algorithm
        const creatures = draftPool.filter(isCreature);
        const spells = draftPool.filter(card => !isCreature(card));
        
        // Add best creatures (aim for ~15-17 creatures)
        const sortedCreatures = creatures.sort((a, b) => {
            const rarityScore = { 'Mythic Rare': 4, 'Rare': 3, 'Uncommon': 2, 'Common': 1 };
            return (rarityScore[b.rarity] || 0) - (rarityScore[a.rarity] || 0);
        });
        
        mainDeck.push(...sortedCreatures.slice(0, Math.min(17, sortedCreatures.length)));
        
        // Add best spells
        const sortedSpells = spells.sort((a, b) => {
            const rarityScore = { 'Mythic Rare': 4, 'Rare': 3, 'Uncommon': 2, 'Common': 1 };
            return (rarityScore[b.rarity] || 0) - (rarityScore[a.rarity] || 0);
        });
        
        const spellsNeeded = Math.max(0, 23 - mainDeck.length);
        mainDeck.push(...sortedSpells.slice(0, spellsNeeded));
        
        // Remove added cards from pool
        const addedCardIds = new Set(mainDeck.map(card => card.id));
        draftPool = draftPool.filter(card => !addedCardIds.has(card.id));
        
        // Auto-add basic lands based on colors
        const colorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
        mainDeck.forEach(card => {
            const colors = getCardColors(card);
            colors.forEach(color => colorCounts[color]++);
        });
        
        const totalColorSymbols = Object.values(colorCounts).reduce((a, b) => a + b, 0);
        const landsNeeded = 40 - mainDeck.length;
        
        if (totalColorSymbols > 0) {
            basicLands.Plains = Math.round((colorCounts.W / totalColorSymbols) * landsNeeded);
            basicLands.Island = Math.round((colorCounts.U / totalColorSymbols) * landsNeeded);
            basicLands.Swamp = Math.round((colorCounts.B / totalColorSymbols) * landsNeeded);
            basicLands.Mountain = Math.round((colorCounts.R / totalColorSymbols) * landsNeeded);
            basicLands.Forest = Math.round((colorCounts.G / totalColorSymbols) * landsNeeded);
            
            // Adjust to exactly the right number of lands
            const currentLands = Object.values(basicLands).reduce((a, b) => a + b, 0);
            const diff = landsNeeded - currentLands;
            if (diff !== 0) {
                const dominantColor = Object.keys(colorCounts).reduce((a, b) => 
                    colorCounts[a] > colorCounts[b] ? a : b
                );
                const landMap = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };
                basicLands[landMap[dominantColor]] += diff;
            }
        } else {
            // If no colored mana, just add basic lands evenly
            const landsPerType = Math.floor(landsNeeded / 5);
            const remainder = landsNeeded % 5;
            basicLands.Plains = landsPerType + (remainder > 0 ? 1 : 0);
            basicLands.Island = landsPerType + (remainder > 1 ? 1 : 0);
            basicLands.Swamp = landsPerType + (remainder > 2 ? 1 : 0);
            basicLands.Mountain = landsPerType + (remainder > 3 ? 1 : 0);
            basicLands.Forest = landsPerType;
        }
        
        renderCards();
        showNotification('Deck auto-built successfully!', 'success');
    };

    const clearDeck = () => {
        if (mainDeck.length === 0 && Object.values(basicLands).every(count => count === 0)) {
            showNotification('Deck is already empty!', 'info');
            return;
        }
        
        if (confirm('Are you sure you want to clear your deck? This will move all cards back to your pool.')) {
            // Move all cards back to pool
            draftPool.push(...mainDeck);
            mainDeck = [];
            basicLands = { Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0 };
            renderCards();
            showNotification('Deck cleared!', 'info');
        }
    };

    // Event Handlers
    document.addEventListener('click', (e) => {
        const cardEl = e.target.closest('.card-item');
        if (!cardEl) return;

        const cardId = cardEl.dataset.cardId;
        const from = cardEl.dataset.from;

        if (from === 'pool') {
            const cardIndex = draftPool.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                const card = draftPool[cardIndex];
                mainDeck.push(card);
                draftPool.splice(cardIndex, 1);
                showNotification(`Added ${card.name} to deck`, 'success');
            }
        } else if (from === 'deck') {
            const cardIndex = mainDeck.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                const card = mainDeck[cardIndex];
                draftPool.push(card);
                mainDeck.splice(cardIndex, 1);
                showNotification(`Removed ${card.name} from deck`, 'info');
            }
        }
        renderCards();
    });

    // Right-click for card preview
    document.addEventListener('contextmenu', (e) => {
        const cardEl = e.target.closest('.card-item');
        if (!cardEl) return;
        
        e.preventDefault();
        const cardId = cardEl.dataset.cardId;
        const from = cardEl.dataset.from;
        
        let card;
        if (from === 'pool') {
            card = draftPool.find(c => c.id === cardId);
        } else {
            card = mainDeck.find(c => c.id === cardId);
        }
        
        if (card) {
            showCardPreview(card);
        }
    });

    // Filter tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderCards();
        });
    });

    // Search
    cardSearch.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        renderCards();
    });

    // Basic land controls
    document.addEventListener('click', (e) => {
        if (e.target.dataset.land && e.target.dataset.action) {
            const land = e.target.dataset.land;
            const action = e.target.dataset.action;
            
            if (action === 'add') {
                basicLands[land]++;
            } else if (action === 'remove' && basicLands[land] > 0) {
                basicLands[land]--;
            }
            
            updateStats();
        }
    });

    // Button handlers
    autoBuildBtn.addEventListener('click', autoBuildDeck);
    clearDeckBtn.addEventListener('click', clearDeck);

    saveDeckBtn.addEventListener('click', async () => {
        const totalDeckSize = mainDeck.length + Object.values(basicLands).reduce((a, b) => a + b, 0);
        
        if (totalDeckSize < 40) {
            showNotification('Your deck must contain at least 40 cards.', 'warning');
            return;
        }
        
        try {
            saveDeckBtn.disabled = true;
            saveDeckBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
            
            // Create basic land cards
            const landCards = [];
            Object.entries(basicLands).forEach(([landType, count]) => {
                for (let i = 0; i < count; i++) {
                    landCards.push({
                        id: `${landType.toLowerCase()}_${i}_${Date.now()}`,
                        name: landType,
                        imageUrl: `https://via.placeholder.com/223x310/4a5568/ffffff?text=${landType}`,
                        manaCost: '',
                        type: 'Basic Land',
                        rarity: 'Basic Land',
                        set: 'Basic'
                    });
                }
            });
            
            const finalDeck = [...mainDeck, ...landCards];
            
            await playerStateRef.update({
                mainDeck: finalDeck,
                sideboard: draftPool,
                basicLands: basicLands,
                deckBuilt: true,
                deckBuildTimestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showNotification('Deck saved successfully!', 'success');
            
            // Redirect after a short delay
            setTimeout(() => {
                window.location.href = `mtg-gaming.html?id=${draftId}`;
            }, 2000);
            
        } catch (error) {
            console.error("Error saving deck:", error);
            showNotification(`Could not save deck: ${error.message}`, 'error');
        } finally {
            saveDeckBtn.disabled = false;
            saveDeckBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save Deck';
        }
    });

    // Modal handlers
    closePreview.addEventListener('click', () => {
        cardPreviewModal.classList.add('hidden');
    });

    cardPreviewModal.addEventListener('click', (e) => {
        if (e.target === cardPreviewModal) {
            cardPreviewModal.classList.add('hidden');
        }
    });

    // Initial Load
    playerStateRef.get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            draftPool = [...(data.pickedCards || [])];
            mainDeck = [...(data.mainDeck || [])];
            basicLands = { ...basicLands, ...(data.basicLands || {}) };
            renderCards();
            showNotification('Draft pool loaded successfully!', 'success');
        } else {
            showNotification('Could not find your draft data.', 'error');
        }
    }).catch(err => {
        console.error("Error fetching draft pool:", err);
        showNotification('Error loading your drafted cards.', 'error');
    });
});
