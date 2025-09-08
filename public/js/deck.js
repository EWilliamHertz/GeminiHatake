/**
 * HatakeSocial - Deck Page Script (v31.2 - Button and State Fixes)
 *
 * - FIX: Resolves issues where "Share" and "Test Hand" buttons were unresponsive by using a more reliable state variable (`currentDeckInView`).
 * - The main "Share" button now correctly opens the share options modal.
 * - The "Test Hand" button now correctly initializes the playtest area.
 * - Added alerts for cases where a deck isn't selected, providing better user feedback.
 * - Updated "Copy Link" to use modern navigator.clipboard API for better reliability.
 * - Added a check to only allow sharing of public decks.
 */

function getCardImageUrl(cardData, size = 'normal') {
    if (cardData.card_faces && cardData.card_faces[0].image_uris) {
        return cardData.card_faces[0].image_uris[size];
    }
    if (cardData.image_uris) {
        return cardData.image_uris[size];
    }
    return 'https://placehold.co/223x310/cccccc/969696?text=No+Image';
}

document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const db = firebase.firestore();
    const functions = firebase.functions();
    const deckBuilderForm = document.getElementById('deck-builder-form');
    if (!deckBuilderForm) return;

    const openModal = (modal) => modal && modal.classList.remove('hidden');
    const closeModal = (modal) => modal && modal.classList.add('hidden');

    // --- State Variables ---
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
    const shareDeckBtn = document.getElementById('share-deck-btn');
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
    const writePrimerBtn = document.getElementById('write-primer-btn');
    const deckPublicCheckbox = document.getElementById('deck-public-checkbox');
    const deckCommentForm = document.getElementById('deck-comment-form');
    const deckCommentInput = document.getElementById('deck-comment-input');
    const deckCommentsList = document.getElementById('deck-comments-list');
    const deckAverageRatingStars = document.getElementById('deck-average-rating-stars');
    const deckRatingSummary = document.getElementById('deck-rating-summary');
    const deckUserRatingStars = document.getElementById('deck-user-rating-stars');
    const shareDeckModal = document.getElementById('share-deck-modal');
    const closeShareDeckModalBtn = document.getElementById('close-share-deck-modal');
    const shareDeckLinkBtn = document.getElementById('share-deck-link-btn');
    const modalShareToFeedBtn = document.getElementById('modal-share-to-feed-btn');
    const shareToFeedModal = document.getElementById('share-to-feed-modal');
    const closeShareToFeedModalBtn = document.getElementById('close-share-to-feed-modal');
    const shareToFeedForm = document.getElementById('share-to-feed-form');

    // Card Quick View Tooltip Logic
    const tooltip = document.createElement('img');
    tooltip.id = 'card-quick-view-tooltip';
    tooltip.classList.add('hidden');
    document.body.appendChild(tooltip);
    document.addEventListener('mouseover', (event) => {
        const cardLink = event.target.closest('.card-link');
        if (cardLink && cardLink.dataset.scryfallId) {
            tooltip.src = `https://api.scryfall.com/cards/${cardLink.dataset.scryfallId}?format=image&version=normal`;
            tooltip.classList.remove('hidden');
        }
    });
    document.addEventListener('mouseout', (event) => {
        if (event.target.closest('.card-link')) tooltip.classList.add('hidden');
    });
    document.addEventListener('mousemove', (event) => {
        tooltip.style.left = event.pageX + 20 + 'px';
        tooltip.style.top = event.pageY + 20 + 'px';
    });

    const formats = {
        "Magic: The Gathering": ["Standard", "Modern", "Commander", "Pauper", "Legacy", "Vintage", "Oldschool"],
        "Pokémon": ["Standard", "Expanded"],
        "Flesh and Blood": ["Classic Constructed", "Blitz"],
        "Yu-Gi-Oh!": ["Advanced", "Traditional"]
    };

    const resetBuilderForm = () => {
        deckBuilderForm.reset();
        builderTitle.textContent = "Create New Deck";
        buildDeckBtn.textContent = "Build & Price Deck";
        editingDeckIdInput.value = '';
        deckFormatSelectContainer.classList.add('hidden');
        writePrimerBtn.classList.add('hidden');
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
        tabContents.forEach(content => {
            content.classList.toggle('hidden', content.id !== targetContentId);
        });
        if (tabId === 'tab-builder' && !editingDeckIdInput.value) {
            resetBuilderForm();
        }
        if (tabId === 'tab-builder' && user) {
            loadCollectionForDeckBuilder();
        }
        deckFilters.classList.toggle('hidden', !['tab-my-decks', 'tab-community-decks'].includes(tabId));
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
        currentDeckInView = { ...deck, id: deckId };
        document.getElementById('tab-deck-view').classList.remove('hidden');
        switchTab('tab-deck-view');
        document.getElementById('deck-view-name').textContent = deck.name;
        document.getElementById('deck-view-author').textContent = `by ${deck.authorName || 'Anonymous'}`;
        document.getElementById('deck-view-format').textContent = deck.format || 'N/A';
        const bioEl = document.getElementById('deck-view-bio');
        bioEl.textContent = deck.bio || '';
        bioEl.classList.toggle('hidden', !deck.bio);
        const primerSection = document.getElementById('deck-primer-display-section');
        const primerContent = document.getElementById('deck-view-primer');
        primerContent.textContent = deck.primer || '';
        primerSection.classList.toggle('hidden', !deck.primer?.trim());
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
            totalPrice += (parseFloat(card.prices?.usd || 0) * card.quantity);
        });
        document.getElementById('deck-view-price').textContent = `$${totalPrice.toFixed(2)}`;
        if (deck.cards.length > 0) {
            featuredCardImg.src = getCardImageUrl(deck.cards[0], 'normal');
            featuredCardImg.alt = deck.cards[0].name;
        }
        Object.keys(categorizedCards).forEach(category => {
            const categoryEl = document.createElement('div');
            categoryEl.className = 'mb-4';
            categoryEl.innerHTML = `<h3 class="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">${category} (${categorizedCards[category].reduce((acc, c) => acc + c.quantity, 0)})</h3>`;
            const cardList = document.createElement('div');
            cardList.className = 'space-y-1';
            categorizedCards[category].forEach(card => {
                const cardEl = document.createElement('div');
                cardEl.className = 'flex justify-between items-center text-sm';
                cardEl.innerHTML = `
                    <span class="card-link cursor-pointer text-blue-600 dark:text-blue-400 hover:underline" data-scryfall-id="${card.id}">${card.quantity}x ${card.name}</span>
                    <span class="text-gray-500 dark:text-gray-400">$${(parseFloat(card.prices?.usd || 0) * card.quantity).toFixed(2)}</span>
                `;
                cardList.appendChild(cardEl);
            });
            categoryEl.appendChild(cardList);
            listEl.appendChild(categoryEl);
        });
        displayLegality(deck);
        loadRatingsAndComments(deckId);
        if (manaCurveChart) {
            manaCurveChart.destroy();
        }
        const manaCosts = deck.cards.flatMap(card => Array(card.quantity).fill(card.cmc || 0));
        const manaCurveData = Array(8).fill(0);
        manaCosts.forEach(cmc => {
            if (cmc >= 7) {
                manaCurveData[7]++;
            } else {
                manaCurveData[cmc]++;
            }
        });

        const ctx = document.getElementById('mana-curve-chart').getContext('2d');
        manaCurveChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['0', '1', '2', '3', '4', '5', '6', '7+'],
                datasets: [{
                    label: 'Number of Cards',
                    data: manaCurveData,
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            precision: 0
                        }
                    }
                }
            }
        });
    };

    const loadMyDecks = async (tcg = 'all', format = 'all') => {
        const myDecksList = document.getElementById('my-decks-list');
        if (!user) {
            myDecksList.innerHTML = '<p class="text-gray-500 dark:text-gray-300 p-4 text-center">Please log in to view your decks.</p>';
            return;
        }
        myDecksList.innerHTML = '<p class="text-gray-500 dark:text-gray-300 p-4 text-center">Loading your decks...</p>';
        try {
            let query = db.collection('users').doc(user.uid).collection('decks');
            if (tcg !== 'all') query = query.where('tcg', '==', tcg);
            if (format !== 'all') query = query.where('format', '==', format);
            query = query.orderBy('createdAt', 'desc');
            const snapshot = await query.get();
            if (snapshot.empty) {
                myDecksList.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4 text-center">You haven\'t created any decks yet.</p>';
                return;
            }
            let decks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderMyDecks(decks);
        } catch (error) {
            console.error("Error loading user decks:", error);
            myDecksList.innerHTML = `<p class="text-red-500 p-4 text-center">An error occurred while loading your decks. A database index might be required for this filter combination.</p>`;
        }
    };

    const renderMyDecks = (decks) => {
        const myDecksList = document.getElementById('my-decks-list');
        myDecksList.innerHTML = '';
        if (decks.length === 0) {
            myDecksList.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4 text-center">No decks found for the selected filters.</p>';
            return;
        }
        decks.forEach(deckData => {
            const totalPrice = deckData.cards.reduce((acc, card) => {
                const price = card.prices?.usd || 0;
                return acc + (parseFloat(price) * card.quantity);
            }, 0);
            const deckCard = document.createElement('div');
            deckCard.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md cursor-pointer hover:shadow-xl relative';
            deckCard.innerHTML = `
                <h3 class="text-xl font-bold dark:text-white">${deckData.name}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">${deckData.format} • ${deckData.tcg}</p>
                <p class="text-blue-500 font-semibold mt-2">Value: $${totalPrice.toFixed(2)}</p>
                <div class="absolute top-2 right-2 flex space-x-2">
                    <button class="edit-deck-btn text-blue-500 hover:text-blue-700" data-deck-id="${deckData.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-deck-btn text-red-500 hover:text-red-700" data-deck-id="${deckData.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            deckCard.addEventListener('click', (e) => {
                if (!e.target.closest('.edit-deck-btn') && !e.target.closest('.delete-deck-btn')) {
                    viewDeck(deckData, deckData.id);
                }
            });
            myDecksList.appendChild(deckCard);
        });
        document.querySelectorAll('.edit-deck-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const deckId = btn.dataset.deckId;
                const deck = decks.find(d => d.id === deckId);
                if (deck) editDeck(deck, deckId);
            });
        });
        document.querySelectorAll('.delete-deck-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const deckId = btn.dataset.deckId;
                if (confirm('Are you sure you want to delete this deck?')) {
                    try {
                        const batch = db.batch();
                        batch.delete(db.collection('users').doc(user.uid).collection('decks').doc(deckId));
                        batch.delete(db.collection('publicDecks').doc(deckId));
                        await batch.commit();
                        loadMyDecks();
                    } catch (error) {
                        console.error("Error deleting deck:", error);
                        alert("Could not delete deck.");
                    }
                }
            });
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
        writePrimerBtn.classList.remove('hidden');
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
        const activeTab = document.querySelector('.tab-button.text-blue-600');

        if (!activeTab) return;

        if(activeTab.id === 'tab-my-decks') {
            loadMyDecks(tcg, format);
        } else if (activeTab.id === 'tab-community-decks') {
            loadCommunityDecks(tcg, format);
        }
    };
    
    const initializePlaytest = () => {
        if (!currentDeckInView) {
            alert("Please view a deck before trying to test your hand.");
            return;
        };
        
        playtestState.deck = [];
        currentDeckInView.cards.forEach(card => {
            for (let i = 0; i < card.quantity; i++) {
                playtestState.deck.push({ ...card, instanceId: Math.random() });
            }
        });

        playtestState.library = [...playtestState.deck].sort(() => Math.random() - 0.5);
        playtestState.hand = [];
        playtestState.battlefield = [];
        playtestState.graveyard = [];
        drawCards(7);
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
        const renderZone = (zoneEl, cards) => {
            const title = zoneEl.querySelector('h3');
            zoneEl.innerHTML = '';
            if (title) zoneEl.appendChild(title);
            cards.forEach(card => zoneEl.appendChild(createPlaytestCard(card)));
        };
        renderZone(handEl, playtestState.hand);
        renderZone(battlefieldEl, playtestState.battlefield);
    };

    const createPlaytestCard = (card) => {
        const cardEl = document.createElement('img');
        cardEl.src = getCardImageUrl(card, 'normal');
        cardEl.className = 'playtest-card';
        cardEl.dataset.instanceId = card.instanceId;
        cardEl.draggable = true;
        cardEl.addEventListener('dragstart', handleDragStart);
        return cardEl;
    };

    const handleDragStart = (e) => e.dataTransfer.setData('text/plain', e.target.dataset.instanceId);

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
    
    const submitRating = async (deckId, rating) => {
        if (!user) {
            alert("Please log in to rate a deck.");
            return;
        }
        const deckRef = db.collection('publicDecks').doc(deckId);
        const ratingRef = deckRef.collection('ratings').doc(user.uid);
        try {
            await db.runTransaction(async (transaction) => {
                const deckDoc = await transaction.get(deckRef);
                if (!deckDoc.exists) throw "Deck does not exist!";
                const ratingDoc = await transaction.get(ratingRef);
                const deckData = deckDoc.data();
                const oldRating = ratingDoc.exists ? ratingDoc.data().rating : 0;
                const isNewRating = !ratingDoc.exists;
                transaction.set(ratingRef, { rating: rating, ratedAt: new Date() });
                let ratingCount = deckData.ratingCount || 0;
                let totalRating = (deckData.averageRating || 0) * ratingCount;
                if (isNewRating) {
                    ratingCount++;
                    totalRating += rating;
                } else {
                    totalRating = totalRating - oldRating + rating;
                }
                const averageRating = totalRating / ratingCount;
                transaction.update(deckRef, {
                    ratingCount: ratingCount,
                    averageRating: averageRating
                });
            });
            loadRatingsAndComments(deckId);
        } catch (error) {
            console.error("Error submitting rating:", error);
            alert("There was an error submitting your rating.");
        }
    };

    const loadRatingsAndComments = async (deckId) => {
        deckAverageRatingStars.innerHTML = '...';
        deckRatingSummary.textContent = '';
        deckCommentsList.innerHTML = '<p>Loading comments...</p>';
        try {
            const deckDoc = await db.collection('publicDecks').doc(deckId).get();
            const deckData = deckDoc.exists ? deckDoc.data() : { averageRating: 0, ratingCount: 0 };
            let userRating = 0;
            if (user) {
                const userRatingDoc = await db.collection('publicDecks').doc(deckId).collection('ratings').doc(user.uid).get();
                if (userRatingDoc.exists) {
                    userRating = userRatingDoc.data().rating;
                }
            }
            renderRatings(deckData, userRating);
            const commentsSnapshot = await db.collection('publicDecks').doc(deckId).collection('comments').orderBy('createdAt', 'desc').get();
            const comments = commentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderComments(comments);
        } catch (error) {
            console.error("Error loading ratings and comments:", error);
            deckCommentsList.innerHTML = '<p class="text-red-500">Could not load comments.</p>';
        }
    };

    const renderRatings = (deckData, userRating) => {
        const avg = deckData.averageRating || 0;
        const count = deckData.ratingCount || 0;
        let avgStarsHTML = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= avg) {
                avgStarsHTML += '<i class="fas fa-star"></i>';
            } else if (i - 0.5 <= avg) {
                avgStarsHTML += '<i class="fas fa-star-half-alt"></i>';
            } else {
                avgStarsHTML += '<i class="far fa-star"></i>';
            }
        }
        deckAverageRatingStars.innerHTML = avgStarsHTML;
        deckRatingSummary.textContent = `(${avg.toFixed(1)} from ${count} ratings)`;
        const userStars = deckUserRatingStars.querySelectorAll('i');
        userStars.forEach(star => {
            const value = parseInt(star.dataset.value);
            if (value <= userRating) {
                star.className = 'fas fa-star text-yellow-400';
            } else {
                star.className = 'far fa-star text-gray-300';
            }
        });
    };

    const renderComments = (comments) => {
        if (comments.length === 0) {
            deckCommentsList.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No comments yet. Be the first to comment!</p>';
            return;
        }
        deckCommentsList.innerHTML = comments.map(comment => `
            <div class="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                <div class="flex items-center mb-2">
                    <img src="${comment.authorPhotoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${comment.authorName}" class="w-6 h-6 rounded-full mr-2">
                    <span class="font-semibold text-sm dark:text-gray-200">${comment.authorName}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">${comment.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}</span>
                </div>
                <p class="text-sm dark:text-gray-300">${comment.text}</p>
            </div>
        `).join('');
    };

    const handleRatingInteraction = (e) => {
        const star = e.target.closest('i');
        if (!star) return;
        const value = parseInt(star.dataset.value);
        const stars = deckUserRatingStars.querySelectorAll('i');
        if (e.type === 'click') {
            const deckId = currentDeckInView?.id;
            if (deckId) submitRating(deckId, value);
        } else if (e.type === 'mouseover') {
            stars.forEach(s => {
                const sValue = parseInt(s.dataset.value);
                if (sValue <= value) {
                    s.className = 'fas fa-star text-yellow-400';
                } else {
                    s.className = 'far fa-star text-gray-300';
                }
            });
        } else if (e.type === 'mouseout') {
            const deckId = currentDeckInView?.id;
            if (deckId) loadRatingsAndComments(deckId);
        }
    };
    
    // --- Event Listeners ---
    tabs.forEach(tab => tab.addEventListener('click', () => { if (tab.id !== 'tab-deck-view') { switchTab(tab.id); applyDeckFilters(); } }));
    
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
    
    shareDeckBtn.addEventListener('click', () => {
        if (currentDeckInView && currentDeckInView.isPublic !== false) {
            openModal(shareDeckModal);
        } else {
            alert("This deck is not public. Please edit the deck and check 'Make this deck public' to enable sharing.");
        }
    });
    closeShareDeckModalBtn.addEventListener('click', () => closeModal(shareDeckModal));

    shareDeckLinkBtn.addEventListener('click', () => {
        if (!currentDeckInView) return;
        const url = `${window.location.origin}/deck.html?deckId=${currentDeckInView.id}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('Public link copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy link.');
        });
    });

    modalShareToFeedBtn.addEventListener('click', () => {
        closeModal(shareDeckModal);
        openModal(shareToFeedModal);
    });
    
    closeShareToFeedModalBtn.addEventListener('click', () => closeModal(shareToFeedModal));

    shareToFeedForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user || !currentDeckInView) {
            alert("Please log in and select a deck to share.");
            return;
        }
        const message = document.getElementById('share-to-feed-message').value;
        const postContent = `${message}\n\nCheck out my deck: [deck:${currentDeckInView.id}:${currentDeckInView.name}]`;
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
            closeModal(shareToFeedModal);
            document.getElementById('share-to-feed-message').value = '';
            window.location.href = 'app.html';
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
    

    // --- Primer Button Event Listener ---
    writePrimerBtn.addEventListener('click', () => {
        const deckId = editingDeckIdInput.value;
        const deckName = deckNameInput.value;
        if (!deckId || !deckName) {
            alert('Please save the deck before writing a primer.');
            return;
        }
        const deckNameEncoded = encodeURIComponent(deckName);
        window.location.href = `create-article.html?deckId=${deckId}&deckName=${deckNameEncoded}`;
    });

    deckUserRatingStars.addEventListener('click', handleRatingInteraction);
    deckUserRatingStars.addEventListener('mouseover', handleRatingInteraction);
    deckUserRatingStars.addEventListener('mouseout', handleRatingInteraction);

    deckCommentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) {
            alert("Please log in to comment.");
            return;
        }
        const deckId = currentDeckInView?.id;
        if (!deckId) return;

        const commentText = deckCommentInput.value.trim();
        if (!commentText) return;

        const submitBtn = deckCommentForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            await db.collection('publicDecks').doc(deckId).collection('comments').add({
                text: commentText,
                authorId: user.uid,
                authorName: user.displayName,
                authorPhotoURL: user.photoURL,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            deckCommentInput.value = '';
            loadRatingsAndComments(deckId); // Refresh comments
        } catch (error) {
            console.error("Error submitting comment:", error);
            alert("Could not submit your comment.");
        } finally {
            submitBtn.disabled = false;
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