/**
 * HatakeSocial - Deck Page Script (v23 - Enhanced AI Advisor)
 *
 * - Adds a "Quick View" tooltip that appears when hovering over card names in the deck view.
 * - The tooltip shows the correct card image for the specific edition by using its Scryfall ID.
 * - Enhances the AI Deck Advisor to allow suggestions for various formats, include a budget parameter, and analyze existing decklists for improvements.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const deckBuilderForm = document.getElementById('deck-builder-form');
    if (!deckBuilderForm) return;

    // --- State Variables ---
    let deckToShare = null;
    let fullCollection = [];
    let manaCurveChart = null;
    let playtestState = { deck: [], hand: [], battlefield: [], graveyard: [], library: [] };
    let currentDeckInView = null;

    // --- DOM Elements ---
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const deckFilters = document.getElementById('deck-filters');
    const tcgFilterButtons = document.getElementById('tcg-filter-buttons');
    const formatFilterContainer = document.getElementById('format-filter-container');
    const formatFilterButtons = document.getElementById('format-filter-buttons');
    const deckTcgSelect = document.getElementById('deck-tcg-select');
    const deckFormatSelectContainer = document.getElementById('deck-format-select-container');
    const deckFormatSelect = document.getElementById('deck-format-select');
    const editingDeckIdInput = document.getElementById('editing-deck-id');
    const builderTitle = document.getElementById('builder-title');
    const buildDeckBtn = document.getElementById('build-deck-btn');
    const deckNameInput = document.getElementById('deck-name-input');
    const deckBioInput = document.getElementById('deck-bio-input');
    const decklistInput = document.getElementById('decklist-input');
    const deckPrimerInput = document.getElementById('deck-primer-input');
    const shareDeckBtn = document.getElementById('share-deck-to-feed-btn');
    const collectionSearchInput = document.getElementById('deck-builder-collection-search');
    const collectionListContainer = document.getElementById('deck-builder-collection-list');
    const testHandBtn = document.getElementById('test-hand-btn');
    const playtestModal = document.getElementById('playtest-modal');
    const closePlaytestModalBtn = document.getElementById('close-playtest-modal');
    const playtestDrawBtn = document.getElementById('playtest-draw-btn');
    const playtestMulliganBtn = document.getElementById('playtest-mulligan-btn');
    const playtestResetBtn = document.getElementById('playtest-reset-btn');
    const battlefieldEl = document.getElementById('playtest-battlefield');
    const handEl = document.getElementById('playtest-hand');
    const checkCollectionBtn = document.getElementById('check-collection-btn');
    const missingCardsSection = document.getElementById('missing-cards-section');
    const missingCardsList = document.getElementById('missing-cards-list');
    const importDeckBtn = document.getElementById('import-deck-btn');
    const importDeckModal = document.getElementById('import-deck-modal');
    const closeImportModalBtn = document.getElementById('close-import-modal');
    const importDeckTextarea = document.getElementById('import-deck-textarea');
    const importDeckFileInput = document.getElementById('import-deck-file-input');
    const processImportBtn = document.getElementById('process-import-btn');
    
    // AI Advisor Elements from the new section
    const getAISuggestionsBtn = document.getElementById('get-ai-suggestions-btn');
    const suggestionsOutput = document.getElementById('suggestions-output');
    const aiDeckThemeInput = document.getElementById('ai-deck-theme');
    const aiGameFormatSelect = document.getElementById('ai-game-format');
    const aiDeckBudgetInput = document.getElementById('ai-deck-budget');
    const aiDecklistAnalysisTextarea = document.getElementById('ai-decklist-analysis');

    const deckPublicCheckbox = document.getElementById('deck-public-checkbox');

    // Card Quick View Tooltip Logic
    const tooltip = document.createElement('img');
    tooltip.id = 'card-quick-view-tooltip';
    tooltip.classList.add('hidden');
    document.body.appendChild(tooltip);

    document.addEventListener('mouseover', (event) => {
        const cardLink = event.target.closest('.card-link');
        if (cardLink) {
            const scryfallId = cardLink.dataset.scryfallId;
            if (scryfallId) {
                tooltip.src = `https://api.scryfall.com/cards/${scryfallId}?format=image&version=normal`;
                tooltip.classList.remove('hidden');
            }
        }
    });

    document.addEventListener('mouseout', (event) => {
        const cardLink = event.target.closest('.card-link');
        if (cardLink) {
            tooltip.classList.add('hidden');
        }
    });

    document.addEventListener('mousemove', (event) => {
        tooltip.style.left = event.pageX + 20 + 'px';
        tooltip.style.top = event.pageY + 20 + 'px';
    });
    // End of Tooltip Logic

    const formats = {
        "Magic: The Gathering": ["Standard", "Modern", "Commander", "Pauper", "Legacy", "Vintage", "Oldschool"],
        "Pokémon": ["Standard", "Expanded"],
        "Flesh and Blood": ["Classic Constructed", "Blitz"],
        "Yu-Gi-Oh!": ["Advanced", "Traditional"]
    };

    const generateIndexCreationLink = (collection, fields) => {
        const projectId = db.app.options.projectId;
        let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=${collection}`;
        fields.forEach(field => {
            url += `&fields=${field.name},${field.order.toUpperCase()}`;
        });
        return url;
    };

    const switchTab = (tabId) => {
        tabs.forEach(item => {
            const isTarget = item.id === tabId;
            item.classList.toggle('text-blue-600', isTarget);
            item.classList.toggle('border-blue-600', isTarget);
            item.classList.toggle('text-gray-500', !isTarget);
            item.classList.toggle('hover:border-gray-300', !isTarget);
        });
        const targetContentId = tabId.replace('tab-', 'content-');
        tabContents.forEach(content => content.id === targetContentId ? content.classList.remove('hidden') : content.classList.add('hidden'));
        
        if (tabId === 'tab-builder' && user) {
            loadCollectionForDeckBuilder();
        }
        if (tabId === 'tab-my-decks' || tabId === 'tab-community-decks') {
            deckFilters.classList.remove('hidden');
        } else {
            deckFilters.classList.add('hidden');
        }
        if (tabId !== 'tab-deck-view') {
            missingCardsSection.classList.add('hidden');
        }
    };
    
    const loadCollectionForDeckBuilder = async () => {
        if (!user) {
            collectionListContainer.innerHTML = '<p class="text-sm text-gray-500 p-2">Log in to see your collection.</p>';
            return;
        }
        collectionListContainer.innerHTML = '<p class="text-sm text-gray-500 p-2">Loading collection...</p>';
        try {
            const snapshot = await db.collection('users').doc(user.uid).collection('collection').orderBy('name').get();
            if (snapshot.empty) {
                collectionListContainer.innerHTML = '<p class="text-sm text-gray-500 p-2">Your collection is empty.</p>';
                return;
            }
            fullCollection = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCollectionInBuilder(fullCollection);
        } catch (error) {
            console.error("Error loading collection for deck builder:", error);
            collectionListContainer.innerHTML = '<p class="text-sm text-red-500 p-2">Could not load collection.</p>';
        }
    };

    const renderCollectionInBuilder = (cards) => {
        collectionListContainer.innerHTML = '';
        if (cards.length === 0) {
            collectionListContainer.innerHTML = '<p class="text-sm text-gray-500 p-2">No matching cards found.</p>';
            return;
        }
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer';
            cardEl.innerHTML = `
                <div class="flex-grow truncate">
                    <p class="text-sm font-medium text-gray-800 dark:text-gray-200">${card.name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${card.setName}</p>
                </div>
                <div class="text-right flex-shrink-0 ml-2">
                    <p class="text-sm font-bold dark:text-gray-300">${card.quantity}</p>
                </div>
            `;
            cardEl.addEventListener('click', () => addCardToDecklist(card.name));
            collectionListContainer.appendChild(cardEl);
        });
    };
    
    const addCardToDecklist = (cardName) => {
        const currentList = decklistInput.value;
        const regex = new RegExp(`^(\\d+)\\s+${cardName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'im');
        const match = currentList.match(regex);

        if (match) {
            const count = parseInt(match[1], 10);
            const newList = currentList.replace(regex, `${count + 1} ${cardName}`);
            decklistInput.value = newList;
        } else {
            decklistInput.value += `1 ${cardName}\n`;
        }
        decklistInput.scrollTop = decklistInput.scrollHeight;
        decklistInput.focus();
    };
    
    const validateDeck = (cards, format, tcg) => {
        if (tcg !== "Magic: The Gathering") {
            return { isValid: true, errors: [] };
        }

        let errors = [];
        let mainDeckCount = 0;
        
        cards.forEach(card => {
            mainDeckCount += card.quantity;
            if (card.legalities && card.legalities[format.toLowerCase()] !== 'legal') {
                 errors.push(`- ${card.name} is not legal in ${format}.`);
            }
        });

        switch (format) {
            case 'Standard':
            case 'Modern':
            case 'Legacy':
            case 'Vintage':
            case 'Pauper':
                if (mainDeckCount < 60) errors.push('- Main deck must have at least 60 cards.');
                cards.forEach(card => {
                    if (card.quantity > 4 && !card.type_line.includes('Basic Land')) {
                        errors.push(`- Too many copies of ${card.name} (max 4).`);
                    }
                });
                break;
            case 'Commander':
                if (mainDeckCount !== 100) errors.push('- Commander decks must have exactly 100 cards.');
                cards.forEach(card => {
                    if (card.quantity > 1 && !card.type_line.includes('Basic Land')) {
                        errors.push(`- Too many copies of ${card.name} (max 1 for Commander).`);
                    }
                });
                if (cards.length > 0) {
                     if (!cards[0].type_line.includes('Legendary Creature')) {
                         errors.push('- The first card in the list must be a Legendary Creature to be a valid Commander.');
                     }
                } else {
                    errors.push('- Deck must contain a Commander.');
                }
                break;
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    };

    const displayLegality = (deck) => {
        const legalityContainer = document.getElementById('deck-legality-section');
        const result = validateDeck(deck.cards, deck.format, deck.tcg);
        
        if (result.isValid) {
            legalityContainer.innerHTML = `
                <div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4" role="alert">
                    <p class="font-bold"><i class="fas fa-check-circle mr-2"></i>Deck is legal for ${deck.format} format.</p>
                </div>
            `;
        } else {
            let errorHTML = result.errors.map(err => `<li>${err}</li>`).join('');
            legalityContainer.innerHTML = `
                 <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
                    <p class="font-bold"><i class="fas fa-exclamation-triangle mr-2"></i>This deck is not legal for ${deck.format}.</p>
                    <ul class="list-disc list-inside mt-2">${errorHTML}</ul>
                </div>
            `;
        }
    };
    
    const viewDeck = (deck, deckId) => {
        currentDeckInView = deck;
        document.getElementById('tab-deck-view').classList.remove('hidden');
        switchTab('tab-deck-view');
        deckToShare = { ...deck, id: deckId };

        document.getElementById('deck-view-name').textContent = deck.name;
        document.getElementById('deck-view-author').textContent = `by ${deck.authorName || 'Anonymous'}`;
        document.getElementById('deck-view-format').textContent = deck.format || 'N/A';
        const bioEl = document.getElementById('deck-view-bio');
        if (deck.bio) {
            bioEl.textContent = deck.bio;
            bioEl.classList.remove('hidden');
        } else {
            bioEl.classList.add('hidden');
        }
        
        const primerSection = document.getElementById('deck-primer-display-section');
        const primerContent = document.getElementById('deck-view-primer');
        if (deck.primer && deck.primer.trim() !== '') {
            primerContent.textContent = deck.primer;
            primerSection.classList.remove('hidden');
        } else {
            primerSection.classList.add('hidden');
        }
        
        const listEl = document.getElementById('deck-view-list');
        const featuredCardImg = document.getElementById('deck-view-featured-card');
        listEl.innerHTML = '';

        const categorizedCards = {};
        let totalPrice = 0;
        deck.cards.forEach(card => {
            const mainType = card.type_line.split(' // ')[0];
            let category = 'Other';
            if (mainType.includes('Creature')) category = 'Creatures';
            else if (mainType.includes('Planeswalker')) category = 'Planeswalkers';
            else if (mainType.includes('Instant') || mainType.includes('Sorcery')) category = 'Spells';
            else if (mainType.includes('Artifact')) category = 'Artifacts';
            else if (mainType.includes('Enchantment')) category = 'Enchantments';
            else if (mainType.includes('Land')) category = 'Lands';
            
            if (!categorizedCards[category]) categorizedCards[category] = [];
            categorizedCards[category].push(card);
            totalPrice += parseFloat(card.prices.usd || 0) * card.quantity;
        });

        document.getElementById('deck-view-price').textContent = `$${totalPrice.toFixed(2)}`;
        if (deck.cards.length > 0) {
            featuredCardImg.src = deck.cards[0].image_uris?.normal || 'https://placehold.co/223x310?text=No+Image';
        }

        const order = ['Creatures', 'Planeswalkers', 'Spells', 'Artifacts', 'Enchantments', 'Lands', 'Other'];
        order.forEach(category => {
            if (categorizedCards[category]) {
                const cardCount = categorizedCards[category].reduce((acc, c) => acc + c.quantity, 0);
                let categoryHTML = `<div class="break-inside-avoid mb-4"><h3 class="font-bold text-lg mb-2 dark:text-white">${category} (${cardCount})</h3>`;
                categorizedCards[category].forEach(card => {
                    categoryHTML += `<p class="dark:text-gray-300">${card.quantity} <a href="#" class="card-link text-blue-600 dark:text-blue-400 hover:underline" data-scryfall-id="${card.id}">${card.name}</a></p>`;
                });
                categoryHTML += `</div>`;
                listEl.innerHTML += categoryHTML;
            }
        });

        calculateAndDisplayDeckStats(deck);
        displayLegality(deck);
    };

    const calculateAndDisplayDeckStats = (deck) => {
        const manaCurve = {};
        const cardTypes = {};
        let totalCards = 0;

        deck.cards.forEach(card => {
            totalCards += card.quantity;
            if (deck.tcg === "Magic: The Gathering" && card.cmc !== undefined) {
                const cmc = Math.floor(card.cmc);
                if (cmc >= 7) {
                    manaCurve['7+'] = (manaCurve['7+'] || 0) + card.quantity;
                } else {
                    manaCurve[cmc] = (manaCurve[cmc] || 0) + card.quantity;
                }
            }
            const type = card.type_line.split(' — ')[0].split(' // ')[0];
            cardTypes[type] = (cardTypes[type] || 0) + card.quantity;
        });

        const manaCurveEl = document.getElementById('mana-curve-chart');
        if (manaCurveChart) {
            manaCurveChart.destroy();
        }
        manaCurveChart = new Chart(manaCurveEl, {
            type: 'bar',
            data: {
                labels: Object.keys(manaCurve).sort((a,b) => parseInt(a) - parseInt(b)),
                datasets: [{
                    label: '# of Cards',
                    data: Object.values(manaCurve),
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                plugins: { legend: { display: false } }
            }
        });

        const cardTypesEl = document.getElementById('card-types-stats');
        cardTypesEl.innerHTML = '';
        Object.entries(cardTypes).sort(([,a],[,b]) => b-a).forEach(([type, count]) => {
            cardTypesEl.innerHTML += `<div class="flex justify-between text-sm dark:text-gray-300"><span>${type}</span><span class="font-semibold">${count}</span></div>`;
        });
    };

    const loadMyDecks = async (tcg = 'all', format = 'all') => {
        const myDecksList = document.getElementById('my-decks-list');
        if (!user) { myDecksList.innerHTML = '<p>Please log in to see your decks.</p>'; return; }
        myDecksList.innerHTML = '<p>Loading...</p>';
        let query = db.collection('users').doc(user.uid).collection('decks');
        if(tcg !== 'all') query = query.where('tcg', '==', tcg);
        if(format !== 'all') query = query.where('format', '==', format);
        const snapshot = await query.orderBy('createdAt', 'desc').get();

        if (snapshot.empty) { myDecksList.innerHTML = '<p>No decks found for the selected filters.</p>'; return; }
        myDecksList.innerHTML = '';
        snapshot.forEach(doc => {
            const deck = doc.data();
            const totalPrice = deck.cards.reduce((acc, card) => acc + parseFloat(card.prices.usd || 0) * card.quantity, 0);
            const deckCard = document.createElement('div');
            deckCard.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md';
            
            deckCard.innerHTML = `
                <div class="cursor-pointer hover:opacity-80" data-deck-id="${doc.id}">
                    <h3 class="text-xl font-bold dark:text-white">${deck.name}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${deck.format || deck.tcg}</p>
                    <p class="text-blue-500 font-semibold mt-2">Value: $${totalPrice.toFixed(2)}</p>
                </div>
                <div class="mt-2 flex space-x-2">
                    <button class="edit-deck-btn text-sm text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white" data-deck-id="${doc.id}">Edit</button>
                    <button class="delete-deck-btn text-sm text-red-500 hover:text-red-700" data-deck-id="${doc.id}">Delete</button>
                </div>
            `;
            
            deckCard.querySelector('.cursor-pointer').addEventListener('click', () => viewDeck(deck, doc.id));
            deckCard.querySelector('.edit-deck-btn').addEventListener('click', () => editDeck(deck, doc.id));
            deckCard.querySelector('.delete-deck-btn').addEventListener('click', async () => {
                if (confirm(`Are you sure you want to delete the deck "${deck.name}"? This cannot be undone.`)) {
                    await db.collection('users').doc(user.uid).collection('decks').doc(doc.id).delete();
                    await db.collection('publicDecks').doc(doc.id).delete();
                    alert('Deck deleted successfully.');
                    loadMyDecks();
                }
            });
            myDecksList.appendChild(deckCard);
        });
    };
    
    const editDeck = (deck, deckId) => {
        switchTab('tab-builder');
        builderTitle.textContent = "Edit Deck";
        buildDeckBtn.textContent = "Update Deck";
        editingDeckIdInput.value = deckId;

        deckNameInput.value = deck.name;
        deckBioInput.value = deck.bio || '';
        deckPrimerInput.value = deck.primer || '';
        deckTcgSelect.value = deck.tcg;
        deckPublicCheckbox.checked = deck.isPublic !== false;
        
        deckTcgSelect.dispatchEvent(new Event('change'));
        deckFormatSelect.value = deck.format;

        decklistInput.value = deck.cards.map(c => `${c.quantity} ${c.name}`).join('\n');
    };
    
    const loadCommunityDecks = async (tcg = 'all', format = 'all') => {
        const communityDecksList = document.getElementById('community-decks-list');
        communityDecksList.innerHTML = '<p class="text-gray-500 dark:text-gray-300 p-4 text-center">Loading community decks...</p>';
        
        try {
            let query = db.collection('publicDecks');
            
            if (tcg !== 'all') query = query.where('tcg', '==', tcg);
            if (format !== 'all') query = query.where('format', '==', format);
            query = query.orderBy('createdAt', 'desc');

            const snapshot = await query.limit(50).get();

            if (snapshot.empty) {
                communityDecksList.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4 text-center">No community decks found for the selected filters.</p>';
                return;
            }

            let decks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderCommunityDecks(decks);

        } catch (error) {
            console.error("Error loading community decks:", error);
            communityDecksList.innerHTML = `<p class="text-red-500 p-4 text-center">An error occurred while loading decks. A database index might be required for this filter combination.</p>`;
        }
    };
    
    const renderCommunityDecks = (decks) => {
        const communityDecksList = document.getElementById('community-decks-list');
        communityDecksList.innerHTML = '';
        if (decks.length === 0) {
            communityDecksList.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4 text-center">No decks found for the selected filters.</p>';
            return;
        }
        decks.forEach(deckData => {
            const totalPrice = deckData.cards.reduce((acc, card) => {
                const price = card.prices?.usd || 0;
                return acc + (parseFloat(price) * card.quantity);
            }, 0);
            const deckCard = document.createElement('div');
            deckCard.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md cursor-pointer hover:shadow-xl';
            deckCard.innerHTML = `<h3 class="text-xl font-bold dark:text-white">${deckData.name}</h3><p class="text-sm text-gray-500 dark:text-gray-400">by ${deckData.authorName || 'Anonymous'}</p><p class="text-blue-500 font-semibold mt-2">Value: $${totalPrice.toFixed(2)}</p>`;
            deckCard.addEventListener('click', () => viewDeck(deckData, deckData.id));
            communityDecksList.appendChild(deckCard);
        });
    };

    const applyDeckFilters = () => {
        const tcg = tcgFilterButtons.querySelector('.filter-btn-active').dataset.tcg;
        const format = formatFilterButtons.querySelector('.filter-btn-active')?.dataset.format || 'all';
        const activeTab = document.querySelector('#tab-my-decks.text-blue-600') ? 'my' : 'community';

        if(activeTab === 'my') {
            loadMyDecks(tcg, format);
        } else {
            loadCommunityDecks(tcg, format);
        }
    };
    
    const initializePlaytest = () => {
        if (!deckToShare) return;
        
        playtestState.deck = [];
        deckToShare.cards.forEach(card => {
            for (let i = 0; i < card.quantity; i++) {
                playtestState.deck.push({ ...card, instanceId: Math.random() });
            }
        });

        playtestState.library = [...playtestState.deck].sort(() => Math.random() - 0.5);
        playtestState.hand = [];
        playtestState.battlefield = [];
        playtestState.graveyard = [];

        drawCards(7);
        renderPlaytestState();
        openModal(playtestModal);
    };

    const drawCards = (numToDraw) => {
        for (let i = 0; i < numToDraw; i++) {
            if (playtestState.library.length > 0) {
                playtestState.hand.push(playtestState.library.pop());
            }
        }
        renderPlaytestState();
    };
    
    const takeMulligan = () => {
        if (playtestState.hand.length === 0) return;
        
        const newHandSize = playtestState.hand.length - 1;
        playtestState.library = [...playtestState.deck].sort(() => Math.random() - 0.5);
        playtestState.hand = [];
        drawCards(newHandSize);
    };

    const renderPlaytestState = () => {
        document.getElementById('library-count').textContent = playtestState.library.length;
        document.getElementById('hand-count').textContent = playtestState.hand.length;

        handEl.innerHTML = '<h3 class="text-xs uppercase font-bold text-gray-400 absolute">Hand</h3>';
        playtestState.hand.forEach(card => {
            handEl.appendChild(createPlaytestCard(card));
        });

        battlefieldEl.innerHTML = '<h3 class="text-xs uppercase font-bold text-gray-400 absolute">Battlefield</h3>';
        playtestState.battlefield.forEach(card => {
            battlefieldEl.appendChild(createPlaytestCard(card));
        });
    };

    const createPlaytestCard = (card) => {
        const cardEl = document.createElement('img');
        cardEl.src = card.image_uris?.normal || 'https://placehold.co/223x310';
        cardEl.className = 'playtest-card';
        cardEl.dataset.instanceId = card.instanceId;
        cardEl.draggable = true;
        cardEl.addEventListener('dragstart', handleDragStart);
        return cardEl;
    };

    const handleDragStart = (e) => {
        e.dataTransfer.setData('text/plain', e.target.dataset.instanceId);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const zoneEl = e.target.closest('.playtest-zone');
        if (!zoneEl) return;
        
        const cardInstanceId = parseFloat(e.dataTransfer.getData('text/plain'));
        const newZone = zoneEl.id.includes('battlefield') ? 'battlefield' : 'hand';
        
        let cardToMove = null;
        let originalZone = null;

        if (playtestState.hand.some(c => c.instanceId === cardInstanceId)) {
            originalZone = 'hand';
            cardToMove = playtestState.hand.find(c => c.instanceId === cardInstanceId);
        } else if (playtestState.battlefield.some(c => c.instanceId === cardInstanceId)) {
            originalZone = 'battlefield';
            cardToMove = playtestState.battlefield.find(c => c.instanceId === cardInstanceId);
        }

        if (cardToMove && originalZone !== newZone) {
            playtestState[originalZone] = playtestState[originalZone].filter(c => c.instanceId !== cardInstanceId);
            playtestState[newZone].push(cardToMove);
            renderPlaytestState();
        }
    };

    const checkDeckAgainstCollection = async () => {
        if (!user) {
            alert("Please log in to check your collection.");
            return;
        }
        if (!currentDeckInView) {
            alert("Please view a deck first.");
            return;
        }

        checkCollectionBtn.disabled = true;
        checkCollectionBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Checking...';

        try {
            if (fullCollection.length === 0) {
                const snapshot = await db.collection('users').doc(user.uid).collection('collection').get();
                fullCollection = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            
            const collectionMap = new Map();
            fullCollection.forEach(card => {
                collectionMap.set(card.name.toLowerCase(), card.quantity);
            });

            const missing = [];
            currentDeckInView.cards.forEach(deckCard => {
                const ownedCount = collectionMap.get(deckCard.name.toLowerCase()) || 0;
                const neededCount = deckCard.quantity;
                if (ownedCount < neededCount) {
                    missing.push({
                        name: deckCard.name,
                        needed: neededCount - ownedCount
                    });
                }
            });

            renderMissingCards(missing);

        } catch (error) {
            console.error("Error checking collection:", error);
            alert("Could not check deck against your collection.");
        } finally {
            checkCollectionBtn.disabled = false;
            checkCollectionBtn.innerHTML = '<i class="fas fa-check-double mr-2"></i> Check Collection';
        }
    };

    const renderMissingCards = (missing) => {
        if (missing.length === 0) {
            missingCardsList.innerHTML = '<p class="text-green-700 dark:text-green-300 font-semibold">Congratulations! You have all the cards for this deck.</p>';
        } else {
            missingCardsList.innerHTML = missing.map(card => `
                <div class="flex justify-between items-center">
                    <span class="dark:text-red-200">You need ${card.needed}x ${card.name}</span>
                    <a href="card-view.html?name=${encodeURIComponent(card.name)}" target="_blank" class="text-xs px-2 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600">Find on Market</a>
                </div>
            `).join('');
        }
        missingCardsSection.classList.remove('hidden');
    };
    
    const parseAndFillDecklist = (content) => {
        const lines = content.split('\n').filter(line => line.trim() !== '');
        let parsedList = '';
        lines.forEach(line => {
            const match = line.match(/^(?:(\d+)x?\s+)?(.*?)(?:\s+\/\/.*|\s+\([A-Z0-9]+\))?$/);
            if (match) {
                const quantity = match[1] || '1';
                const cardName = match[2].trim();
                if (cardName && !cardName.toLowerCase().startsWith('sideboard')) {
                     parsedList += `${quantity} ${cardName}\n`;
                }
            }
        });
        decklistInput.value = parsedList;
        alert("Decklist imported successfully!");
    };
    
    const renderCategorizedSuggestions = (categories) => {
        suggestionsOutput.innerHTML = '';
        // A helper to add cards to the main decklist input
        const addCardsToMainDeck = (cardList) => {
            cardList.forEach(cardString => {
                 const match = cardString.match(/^(\d+)\s*x\s*(.*)/i);
                 if(match) {
                    addCardToDecklist(match[2].trim());
                 }
            });
            alert(`${cardList.length} cards added to your decklist!`);
        };

        for (const category in categories) {
            const details = document.createElement('details');
            details.className = 'bg-gray-50 dark:bg-gray-700/50 rounded-lg open:shadow-lg';
            details.open = true; // Start with details open
            
            const summary = document.createElement('summary');
            summary.className = 'p-3 cursor-pointer font-semibold text-lg text-gray-800 dark:text-white flex justify-between items-center';
            summary.innerHTML = `<span>${category} (${categories[category].length})</span>`;
            
            const cardGrid = document.createElement('div');
            cardGrid.className = 'p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2';
            
            categories[category].forEach(cardString => {
                const cardEl = document.createElement('div');
                cardEl.className = 'text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer';
                cardEl.textContent = cardString;
                 const match = cardString.match(/^(\d+)\s*x\s*(.*)/i);
                 if(match) {
                    cardEl.onclick = () => addCardToDecklist(match[2].trim());
                 }
                cardGrid.appendChild(cardEl);
            });
            
            details.appendChild(summary);
            details.appendChild(cardGrid);
            suggestionsOutput.appendChild(details);
        }
    };

    // --- All Event Listeners ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.id === 'tab-deck-view') return;
            switchTab(tab.id);
            applyDeckFilters();
        });
    });
    collectionSearchInput.addEventListener('input', () => {
        const searchTerm = collectionSearchInput.value.toLowerCase();
        const filteredCards = fullCollection.filter(card => card.name.toLowerCase().includes(searchTerm));
        renderCollectionInBuilder(filteredCards);
    });
    deckTcgSelect.addEventListener('change', () => {
        const selectedTcg = deckTcgSelect.value;
        if (formats[selectedTcg]) {
            deckFormatSelect.innerHTML = '<option value="" disabled selected>Select a Format</option>';
            formats[selectedTcg].forEach(format => {
                deckFormatSelect.innerHTML += `<option value="${format}">${format}</option>`;
            });
            deckFormatSelectContainer.classList.remove('hidden');
        } else {
            deckFormatSelectContainer.classList.add('hidden');
        }
    });
    deckBuilderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) { alert("Please log in to build a deck."); return; }

        buildDeckBtn.disabled = true;
        buildDeckBtn.textContent = 'Processing...';

        const isPublic = deckPublicCheckbox.checked;

        const deckData = {
            name: deckNameInput.value,
            name_lower: deckNameInput.value.toLowerCase(),
            bio: deckBioInput.value,
            primer: deckPrimerInput.value.trim(),
            tcg: deckTcgSelect.value,
            format: deckFormatSelect.value,
            authorId: user.uid,
            authorName: user.displayName || 'Anonymous',
            createdAt: new Date(),
            isPublic: isPublic,
            cards: []
        };

        const lines = decklistInput.value.split('\n').filter(line => line.trim() !== '');
        const cardPromises = lines.map(line => {
            const match = line.match(/^(\d+)\s+(.*)/);
            if (!match) return null;
            const cardName = match[2].trim().replace(/\s\/\/.*$/, '');
            return fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`)
                .then(res => res.ok ? res.json() : null)
                .then(cardData => cardData ? { ...cardData, quantity: parseInt(match[1], 10) } : null);
        }).filter(p => p);

        deckData.cards = (await Promise.all(cardPromises)).filter(c => c);

        const validationResult = validateDeck(deckData.cards, deckData.format, deckData.tcg);
        if (!validationResult.isValid) {
            const errorString = validationResult.errors.join('\n');
            if (!confirm(`This deck is not legal for the ${deckData.format} format:\n\n${errorString}\n\nDo you want to save it anyway?`)) {
                buildDeckBtn.disabled = false;
                buildDeckBtn.textContent = 'Build & Price Deck';
                return;
            }
        }

        const editingId = editingDeckIdInput.value;
        try {
            const userDeckRef = editingId 
                ? db.collection('users').doc(user.uid).collection('decks').doc(editingId)
                : db.collection('users').doc(user.uid).collection('decks').doc();
            
            const publicDeckRef = db.collection('publicDecks').doc(userDeckRef.id);
            const batch = db.batch();

            batch.set(userDeckRef, deckData);

            if (isPublic) {
                batch.set(publicDeckRef, deckData);
            } else if (editingId) {
                batch.delete(publicDeckRef);
            }

            await batch.commit();
            alert("Deck saved successfully!");
            viewDeck(deckData, userDeckRef.id);

        } catch(error) {
            alert("Error saving deck: " + error.message);
        } finally {
            buildDeckBtn.disabled = false;
            buildDeckBtn.textContent = 'Build & Price Deck';
        }
    });
    tcgFilterButtons.addEventListener('click', (e) => {
        if (e.target.classList.contains('tcg-filter-btn')) {
            tcgFilterButtons.querySelectorAll('.tcg-filter-btn').forEach(btn => btn.classList.remove('filter-btn-active'));
            e.target.classList.add('filter-btn-active');
            
            const selectedTcg = e.target.dataset.tcg;
            formatFilterButtons.innerHTML = '<button class="format-filter-btn filter-btn-active" data-format="all">All Formats</button>';
            if (selectedTcg !== 'all' && formats[selectedTcg]) {
                formats[selectedTcg].forEach(format => {
                    formatFilterButtons.innerHTML += `<button class="format-filter-btn" data-format="${format}">${format}</button>`;
                });
                formatFilterContainer.classList.remove('hidden');
            } else {
                formatFilterContainer.classList.add('hidden');
            }
            applyDeckFilters();
        }
    });
    formatFilterButtons.addEventListener('click', (e) => {
        if (e.target.classList.contains('format-filter-btn')) {
            formatFilterButtons.querySelectorAll('.format-filter-btn').forEach(btn => btn.classList.remove('filter-btn-active'));
            e.target.classList.add('filter-btn-active');
            applyDeckFilters();
        }
    });
    battlefieldEl.addEventListener('dragover', (e) => e.preventDefault());
    handEl.addEventListener('dragover', (e) => e.preventDefault());
    battlefieldEl.addEventListener('drop', handleDrop);
    handEl.addEventListener('drop', handleDrop);
    testHandBtn.addEventListener('click', initializePlaytest);
    closePlaytestModalBtn.addEventListener('click', () => closeModal(playtestModal));
    playtestDrawBtn.addEventListener('click', () => drawCards(1));
    playtestMulliganBtn.addEventListener('click', takeMulligan);
    playtestResetBtn.addEventListener('click', initializePlaytest);
    shareDeckBtn.addEventListener('click', async () => {
        if (!user || !deckToShare) {
            alert("Please log in and select a deck to share.");
            return;
        }
        const postContent = `Check out my deck: [deck:${deckToShare.id}:${deckToShare.name}]\n\n${deckToShare.bio || ''}`;
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            await db.collection('posts').add({
                author: userData.displayName || 'Anonymous',
                authorId: user.uid,
                authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png',
                content: postContent,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: [],
                comments: []
            });
            alert('Deck shared to feed successfully!');
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Error sharing deck:", error);
            alert("Could not share deck. " + error.message);
        }
    });
    checkCollectionBtn.addEventListener('click', checkDeckAgainstCollection);
    importDeckBtn.addEventListener('click', () => {
        openModal(importDeckModal);
    });
    closeImportModalBtn.addEventListener('click', () => {
        closeModal(importDeckModal);
    });
    processImportBtn.addEventListener('click', () => {
        const file = importDeckFileInput.files[0];
        const text = importDeckTextarea.value;

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                parseAndFillDecklist(content);
            };
            reader.readAsText(file);
        } else if (text) {
            parseAndFillDecklist(text);
        } else {
            alert("Please paste a decklist or select a file.");
        }
        closeModal(importDeckModal);
    });
    
    // *** NEW ENHANCED AI ADVISOR LOGIC ***
    getAISuggestionsBtn.addEventListener('click', async () => {
        const decklist = aiDecklistAnalysisTextarea.value.trim();
        const theme = aiDeckThemeInput.value.trim();
        const format = aiGameFormatSelect.value;
        const budget = aiDeckBudgetInput.value.trim();

        if (!theme && !decklist) {
            alert("Please provide a theme/commander for a new deck, or a decklist to analyze.");
            return;
        }

        let prompt = `You are an expert Magic: The Gathering deck builder providing advice. The user wants help with the ${format} format.`;

        if (decklist) {
            // Scenario 1: Analyze an existing decklist
            prompt += ` Please analyze the following decklist. Provide specific suggestions for cards to cut and cards to add. Explain your reasoning for each suggestion.`;
            if (budget) {
                prompt += ` All suggestions for additions must be budget-friendly, keeping the total cost of upgrades under about $${budget}. Suggest affordable alternatives to expensive staples.`;
            }
            prompt += `\n\nHere is the decklist to analyze:\n${decklist}`;
        } else if (theme) {
            // Scenario 2: Suggest a new deck
            prompt += ` The user wants to build a deck around the theme or commander: "${theme}".`;
            if (budget) {
                prompt += ` The total cost of the deck should be affordable, around a budget of $${budget}.`;
            }
            prompt += ` Please provide a complete, ready-to-play decklist. The list should be formatted with cards grouped by type (e.g., Commander, Creature, Sorcery, Instant, Artifact, Enchantment, Land). Provide the response as a JSON object where keys are the category names (like "Commander", "Creatures", "Spells", "Lands") and values are an array of strings, with each string being "quantity x Card Name".`;
        }

        suggestionsOutput.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-purple-500 text-2xl"></i><p class="mt-2 text-gray-400">AI Advisor is thinking...</p></div>';

        try {
            let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { 
                contents: chatHistory,
                generationConfig: {
                    // Request JSON output only if we are building a new decklist
                    ...( (theme && !decklist) && { responseMimeType: "application/json" } )
                }
            };
            const apiKey = ""; // Leave blank, handled by the environment
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            
            const apiResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!apiResponse.ok) {
                throw new Error(`Gemini API request failed with status: ${apiResponse.status}`);
            }

            const result = await apiResponse.json();
            
            if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
                const responseText = result.candidates[0].content.parts[0].text;
                
                if (theme && !decklist) {
                    // Render the JSON decklist
                    const categorizedSuggestions = JSON.parse(responseText);
                    renderCategorizedSuggestions(categorizedSuggestions);
                } else {
                    // Render the text analysis
                    const formattedResponse = responseText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    suggestionsOutput.innerHTML = `<div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">${formattedResponse}</div>`;
                }
            } else {
                throw new Error('Unexpected response structure from Gemini API.');
            }

        } catch (error) {
            console.error("Error fetching AI suggestions:", error);
            suggestionsOutput.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        }
    });


    // --- Initial Load ---
    const urlParams = new URLSearchParams(window.location.search);
    const deckId = urlParams.get('deckId');
    if (deckId) {
        const userDeckRef = user ? db.collection('users').doc(user.uid).collection('decks').doc(deckId) : null;
        const publicDeckRef = db.collection('publicDecks').doc(deckId);

        publicDeckRef.get().then(doc => {
            if (doc.exists) {
                viewDeck(doc.data(), doc.id);
            } else if (userDeckRef) {
                userDeckRef.get().then(userDoc => {
                    if (userDoc.exists) {
                        viewDeck(userDoc.data(), userDoc.id);
                    }
                });
            }
        });
    }

    if (user) {
        loadMyDecks();
    }
    loadCommunityDecks();
});
