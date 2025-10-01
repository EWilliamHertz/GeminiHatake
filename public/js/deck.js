/**
 * HatakeSocial - Deck Page Script (v35.0 - ScryDex Integration)
 *
 * - UPDATED: Integrated centralized searchCards function from api.js module
 * - UPDATED: Added support for all four TCGs (Magic: The Gathering, Pokémon, Lorcana, Gundam)
 * - UPDATED: Dynamic deck validation rules for each TCG
 * - UPDATED: Adaptive UI elements for different game types
 */

// Note: searchCards function will be loaded from api.js script tag
// import { searchCards, debouncedSearchCards } from './modules/api.js';

// This variable will hold the deck data while the user is on the deck-view tab.
let currentDeckInView = null;
let cardPreviewTooltip = null; // Global variable for the card hover tooltip
let playtestUiRestructured = false; // Flag to ensure UI is only changed once

function getCardImageUrl(cardData, size = 'normal') {
    if (cardData.card_faces && cardData.card_faces[0].image_uris) {
        return cardData.card_faces[0].image_uris[size] || cardData.card_faces[0].image_uris['normal'];
    }
    if (cardData.image_uris) {
        return cardData.image_uris[size] || cardData.image_uris['normal'];
    }
    return 'https://placehold.co/223x310/cccccc/969696?text=No+Image';
}

// TCG-specific configurations
const TCG_CONFIGS = {
    "Magic: The Gathering": {
        apiKey: "mtg",
        formats: ["Standard", "Modern", "Commander", "Pauper", "Legacy", "Vintage", "Oldschool"],
        deckSizes: {
            "Standard": { min: 60, max: null },
            "Modern": { min: 60, max: null },
            "Commander": { min: 100, max: 100 },
            "Pauper": { min: 60, max: null },
            "Legacy": { min: 60, max: null },
            "Vintage": { min: 60, max: null },
            "Oldschool": { min: 60, max: null }
        },
        cardLimits: {
            "Standard": 4,
            "Modern": 4,
            "Commander": 1,
            "Pauper": 4,
            "Legacy": 4,
            "Vintage": 4,
            "Oldschool": 4
        },
        showManaCurve: true,
        showColorIdentity: true
    },
    "Pokémon": {
        apiKey: "pokemon",
        formats: ["Standard", "Expanded"],
        deckSizes: {
            "Standard": { min: 60, max: 60 },
            "Expanded": { min: 60, max: 60 }
        },
        cardLimits: {
            "Standard": 4,
            "Expanded": 4
        },
        showManaCurve: false,
        showEnergyTypes: true
    },
    "Lorcana": {
        apiKey: "lorcana",
        formats: ["Standard"],
        deckSizes: {
            "Standard": { min: 60, max: 60 }
        },
        cardLimits: {
            "Standard": 4
        },
        showManaCurve: false,
        showInkTypes: true
    },
    "Gundam": {
        apiKey: "gundam",
        formats: ["Standard"],
        deckSizes: {
            "Standard": { min: 50, max: 50 }
        },
        cardLimits: {
            "Standard": 3
        },
        showManaCurve: false,
        showPilotTypes: true
    }
};

document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const db = firebase.firestore();
    const deckBuilderForm = document.getElementById('deck-builder-form');
    if (!deckBuilderForm) return;

    // --- Toast Notification Function ---
    function showToast(message, isSuccess = false) {
        const toast = document.getElementById('toast-notification');
        const toastMessage = document.getElementById('toast-message');
        if (!toast || !toastMessage) return;

        toastMessage.textContent = message;
        toast.className = toast.className.replace(/bg-(red|green)-500/, '');
        toast.classList.add(isSuccess ? 'bg-green-500' : 'bg-red-500');
        
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.style.opacity = '1';
        }, 50);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.classList.add('hidden'), 500);
        }, 3000);
    }

    // --- Robust Modal Functions (Brute-Force, No Animations) ---
    const openModal = (modal) => {
        console.log('BRUTE-FORCE OPEN: Attempting to open modal:', modal ? modal.id : 'null');
        if (!modal) {
            console.error('openModal failed: modal element is null.');
            return;
        }
        modal.style.position = 'fixed';
        modal.style.inset = '0px';
        modal.style.zIndex = '2000';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        modal.classList.remove('hidden');

        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.display = 'block';
            modalContent.style.visibility = 'visible';
            modalContent.style.opacity = '1';
            modalContent.style.zIndex = '2001';
        } else {
            console.error('CRITICAL: Could not find .modal-content inside the modal overlay!');
        }
        console.log(`Modal ${modal.id} should now be fully visible.`);
    };

    const closeModal = (modal) => {
        console.log('BRUTE-FORCE CLOSE: Attempting to close modal:', modal ? modal.id : 'null');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        } else {
            console.error('closeModal failed: modal element is null.');
        }
    };
    
    // --- Card Preview Tooltip Initialization ---
    function initializeCardPreviewTooltip() {
        if (document.getElementById('card-preview-tooltip')) return;
        cardPreviewTooltip = document.createElement('img');
        cardPreviewTooltip.id = 'card-preview-tooltip';
        cardPreviewTooltip.style.position = 'absolute';
        cardPreviewTooltip.style.display = 'none';
        cardPreviewTooltip.style.width = '250px';
        cardPreviewTooltip.style.height = '350px';
        cardPreviewTooltip.style.borderRadius = '12px';
        cardPreviewTooltip.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';
        cardPreviewTooltip.style.pointerEvents = 'none';
        cardPreviewTooltip.style.zIndex = '3000';
        document.body.appendChild(cardPreviewTooltip);

        document.addEventListener('mousemove', (e) => {
            if (cardPreviewTooltip && cardPreviewTooltip.style.display === 'block') {
                let x = e.clientX + 20;
                let y = e.clientY + 20;
                if (x + 250 > window.innerWidth) {
                    x = e.clientX - 270;
                }
                if (y + 350 > window.innerHeight) {
                    y = e.clientY - 370;
                }
                cardPreviewTooltip.style.left = `${x}px`;
                cardPreviewTooltip.style.top = `${y}px`;
            }
        });
    }

    // --- State Variables ---
    let fullCollection = [];
    let manaCurveChart = null;
    let playtestState = { deck: [], hand: [], battlefield: [], graveyard: [], library: [] };

    // --- DOM Elements ---
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const testHandBtn = document.getElementById('test-hand-btn');
    const shareDeckBtn = document.getElementById('share-deck-btn');
    
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
            const mainType = card.type_line ? card.type_line.split(' // ')[0] : '';
            let category = 'Other';
            
            // TCG-specific categorization
            if (deck.tcg === 'Magic: The Gathering') {
                if (mainType.includes('Creature')) category = 'Creatures';
                else if (mainType.includes('Planeswalker')) category = 'Planeswalkers';
                else if (mainType.includes('Instant') || mainType.includes('Sorcery')) category = 'Spells';
                else if (mainType.includes('Artifact')) category = 'Artifacts';
                else if (mainType.includes('Enchantment')) category = 'Enchantments';
                else if (mainType.includes('Land')) category = 'Lands';
            } else if (deck.tcg === 'Pokémon') {
                if (card.types && card.types.includes('Pokémon')) category = 'Pokémon';
                else if (card.types && card.types.includes('Trainer')) category = 'Trainer Cards';
                else if (card.types && card.types.includes('Energy')) category = 'Energy Cards';
            } else {
                // Generic categorization for Lorcana and Gundam
                category = card.types ? card.types[0] : 'Other';
            }
            
            if (!categorizedCards[category]) categorizedCards[category] = [];
            categorizedCards[category].push(card);
            totalPrice += (parseFloat(card.prices?.usd || 0) * card.quantity);
        });
        document.getElementById('deck-view-price').textContent = `$${totalPrice.toFixed(2)}`;
        if (deck.cards.length > 0) {
            featuredCardImg.src = getCardImageUrl(deck.cards[0], 'normal');
            featuredCardImg.alt = deck.cards[0].name;
        }
        Object.keys(categorizedCards).sort().forEach(category => {
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
        
        // Show mana curve only for Magic: The Gathering
        const tcgConfig = TCG_CONFIGS[deck.tcg];
        if (tcgConfig && tcgConfig.showManaCurve) {
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
        }
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
        if (tabId === 'tab-builder' && !document.getElementById('editing-deck-id').value) {
            resetBuilderForm();
        }
        if (tabId === 'tab-builder' && user) {
            loadCollectionForDeckBuilder();
        }
        document.getElementById('deck-filters').classList.toggle('hidden', !['tab-my-decks', 'tab-community-decks'].includes(tabId));
        
        if (tabId !== 'tab-deck-view') {
             document.getElementById('missing-cards-section').classList.add('hidden');
        }
    };

    const initializePlaytest = () => {
        if (currentDeckInView && currentDeckInView.id) {
            if (!playtestUiRestructured) {
                const controls = document.getElementById('playtest-controls');
                const deckInfo = document.getElementById('playtest-deck-info');
                const drawBtn = document.getElementById('playtest-draw-btn');
                
                const deckPile = document.createElement('div');
                deckPile.className = 'flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-transform transform hover:scale-105';
                deckPile.style.backgroundImage = 'url("https://i.imgur.com/LdOBU1I.jpeg")'; // UPDATED direct image link
                deckPile.style.backgroundSize = 'cover';
                deckPile.style.backgroundPosition = 'center';
                deckPile.style.border = '2px solid #1a202c';
                deckPile.style.width = '90px';
                deckPile.style.height = '125px';
                deckPile.style.textShadow = '1px 1px 3px black';
                
                deckPile.addEventListener('click', () => drawCards(1));

                const libraryText = document.createElement('p');
                libraryText.className = 'text-sm font-bold text-white';
                libraryText.innerHTML = 'Library: ';
                const libraryCountSpan = document.getElementById('library-count');
                libraryText.appendChild(libraryCountSpan);
                
                deckPile.appendChild(libraryText);
                drawBtn.style.display = 'none';
                
                controls.prepend(deckPile);
                
                const handCountSpan = document.getElementById('hand-count');
                deckInfo.innerHTML = `Hand: `;
                deckInfo.appendChild(handCountSpan);
                
                playtestUiRestructured = true;
            }

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
            openModal(document.getElementById('playtest-modal'));
        } else {
            showToast("Please select a deck to test your hand.");
        }
    };

    testHandBtn.addEventListener('click', initializePlaytest);
    shareDeckBtn.addEventListener('click', () => {
        if (currentDeckInView && currentDeckInView.id) {
            if (currentDeckInView.isPublic !== false) {
                openModal(document.getElementById('share-deck-modal'));
            } else {
                showToast("This deck is private and cannot be shared.");
            }
        } else {
            showToast("Please select a deck to share.");
        }
    });

    const resetBuilderForm = () => {
        const builderTitle = document.getElementById('builder-title');
        const buildDeckBtn = document.getElementById('build-deck-btn');
        const editingDeckIdInput = document.getElementById('editing-deck-id');
        const deckFormatSelectContainer = document.getElementById('deck-format-select-container');
        const writePrimerBtn = document.getElementById('write-primer-btn');

        deckBuilderForm.reset();
        builderTitle.textContent = "Create New Deck";
        buildDeckBtn.innerHTML = '<i class="fas fa-hammer mr-2"></i> Build & Price Deck';
        editingDeckIdInput.value = '';
        deckFormatSelectContainer.classList.add('hidden');
        writePrimerBtn.classList.add('hidden');
    };
    
    const loadCollectionForDeckBuilder = async () => {
        const collectionListContainer = document.getElementById('deck-builder-collection-list');
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
            collectionListContainer.innerHTML = '<p class="text-sm text-red-500 p-2">Could not load collection.</p>';
        }
    };

    const renderCollectionInBuilder = (cards) => {
        const collectionListContainer = document.getElementById('deck-builder-collection-list');
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
        const decklistInput = document.getElementById('decklist-input');
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
        const tcgConfig = TCG_CONFIGS[tcg];
        if (!tcgConfig) {
            return { isValid: true, errors: [] };
        }

        let errors = [];
        let mainDeckCount = 0;
        cards.forEach(card => {
            mainDeckCount += card.quantity;
            
            // Check card legalities for Magic: The Gathering
            if (tcg === "Magic: The Gathering" && card.legalities && card.legalities[format.toLowerCase()] !== 'legal') {
                 errors.push(`- ${card.name} is not legal in ${format}.`);
            }
        });
        
        // Check deck size requirements
        const deckSize = tcgConfig.deckSizes[format];
        if (deckSize) {
            if (deckSize.min && mainDeckCount < deckSize.min) {
                errors.push(`- Deck must have at least ${deckSize.min} cards.`);
            }
            if (deckSize.max && mainDeckCount > deckSize.max) {
                errors.push(`- Deck must have exactly ${deckSize.max} cards.`);
            }
        }
        
        // Check card quantity limits
        const cardLimit = tcgConfig.cardLimits[format];
        if (cardLimit) {
            cards.forEach(card => {
                const isBasicLand = tcg === "Magic: The Gathering" && card.type_line && card.type_line.includes('Basic Land');
                if (card.quantity > cardLimit && !isBasicLand) {
                    errors.push(`- Too many copies of ${card.name} (max ${cardLimit}).`);
                }
            });
        }
        
        // Special rules for Commander format
        if (tcg === "Magic: The Gathering" && format === 'Commander') {
            if (cards.length > 0) {
                 if (!cards[0].type_line || !cards[0].type_line.includes('Legendary Creature')) {
                      errors.push('- The first card in the list must be a Legendary Creature to be a valid Commander.');
                 }
            } else {
                errors.push('- Deck must contain a Commander.');
            }
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
                        showToast("Deck deleted successfully.", true);
                        loadMyDecks();
                    } catch (error) {
                        showToast("Could not delete deck.");
                    }
                }
            });
        });
    };

    const editDeck = (deck, deckId) => {
        switchTab('tab-builder');
        const builderTitle = document.getElementById('builder-title');
        const buildDeckBtn = document.getElementById('build-deck-btn');
        const editingDeckIdInput = document.getElementById('editing-deck-id');
        const deckNameInput = document.getElementById('deck-name-input');
        const deckBioInput = document.getElementById('deck-bio-input');
        const deckPrimerInput = document.getElementById('deck-primer-input');
        const deckTcgSelect = document.getElementById('deck-tcg-select');
        const deckPublicCheckbox = document.getElementById('deck-public-checkbox');
        const deckFormatSelect = document.getElementById('deck-format-select');
        const decklistInput = document.getElementById('decklist-input');
        const writePrimerBtn = document.getElementById('write-primer-btn');

        builderTitle.textContent = "Edit Deck";
        buildDeckBtn.innerHTML = "Update Deck";
        editingDeckIdInput.value = deckId;

        deckNameInput.value = deck.name;
        deckBioInput.value = deck.bio || '';
        deckPrimerInput.value = deck.primer || '';
        deckTcgSelect.value = deck.tcg;
        deckPublicCheckbox.checked = deck.isPublic !== false;
        
        deckTcgSelect.dispatchEvent(new Event('change'));
        setTimeout(() => {
             deckFormatSelect.value = deck.format;
        }, 100);

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
        const tcgFilterButtons = document.getElementById('tcg-filter-buttons');
        const formatFilterButtons = document.getElementById('format-filter-buttons');
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
        const battlefieldEl = document.getElementById('playtest-battlefield');
        const handEl = document.getElementById('playtest-hand');
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
        cardEl.src = getCardImageUrl(card, 'small');
        cardEl.className = 'playtest-card';
        cardEl.dataset.instanceId = card.instanceId;
        cardEl.draggable = true;
        cardEl.addEventListener('dragstart', handleDragStart);

        cardEl.addEventListener('mouseover', () => {
            if (cardPreviewTooltip) {
                cardPreviewTooltip.src = getCardImageUrl(card, 'large');
                cardPreviewTooltip.style.display = 'block';
            }
        });
        cardEl.addEventListener('mouseout', () => {
            if (cardPreviewTooltip) {
                cardPreviewTooltip.style.display = 'none';
            }
        });

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
        const checkCollectionBtn = document.getElementById('check-collection-btn');
        if (!user) {
            showToast("Please log in to check your collection.");
            return;
        }
        if (!currentDeckInView) {
            showToast("Please select a deck first.");
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
            showToast("Could not check deck against your collection.");
        } finally {
            checkCollectionBtn.disabled = false;
            checkCollectionBtn.innerHTML = '<i class="fas fa-check-double mr-2"></i> Check Collection';
        }
    };

    const renderMissingCards = (missing) => {
        const missingCardsList = document.getElementById('missing-cards-list');
        const missingCardsSection = document.getElementById('missing-cards-section');
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
        const decklistInput = document.getElementById('decklist-input');
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
        showToast("Decklist imported successfully!", true);
    };
    
    const submitRating = async (deckId, rating) => {
        if (!user) {
            showToast("Please log in to rate a deck.");
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
            showToast("There was an error submitting your rating.");
        }
    };

    const loadRatingsAndComments = async (deckId) => {
        const deckAverageRatingStars = document.getElementById('deck-average-rating-stars');
        const deckRatingSummary = document.getElementById('deck-rating-summary');
        const deckCommentsList = document.getElementById('deck-comments-list');
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
            deckCommentsList.innerHTML = '<p class="text-red-500">Could not load comments.</p>';
        }
    };

    const renderRatings = (deckData, userRating) => {
        const deckAverageRatingStars = document.getElementById('deck-average-rating-stars');
        const deckRatingSummary = document.getElementById('deck-rating-summary');
        const deckUserRatingStars = document.getElementById('deck-user-rating-stars');
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
        const deckCommentsList = document.getElementById('deck-comments-list');
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
        const deckUserRatingStars = document.getElementById('deck-user-rating-stars');
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
    tabs.forEach(tab => tab.addEventListener('click', (e) => { 
        switchTab(e.target.id);
        if (e.target.id !== 'tab-deck-view') {
            applyDeckFilters(); 
        }
    }));
    
    deckBuilderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const buildDeckBtn = document.getElementById('build-deck-btn');
        if (!user) { showToast("Please log in to build a deck."); return; }
        buildDeckBtn.disabled = true;
        buildDeckBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
        const deckPublicCheckbox = document.getElementById('deck-public-checkbox');
        const isPublic = deckPublicCheckbox.checked;
        const selectedTcg = document.getElementById('deck-tcg-select').value;
        const tcgConfig = TCG_CONFIGS[selectedTcg];
        
        const deckData = {
            name: document.getElementById('deck-name-input').value,
            name_lower: document.getElementById('deck-name-input').value.toLowerCase(),
            bio: document.getElementById('deck-bio-input').value,
            primer: document.getElementById('deck-primer-input').value.trim(),
            tcg: selectedTcg,
            format: document.getElementById('deck-format-select').value,
            authorId: user.uid,
            authorName: user.displayName || 'Anonymous',
            createdAt: new Date(),
            isPublic: isPublic,
            cards: []
        };
        
        const lines = document.getElementById('decklist-input').value.split('\n').filter(line => line.trim() !== '');
        const cardPromises = lines.map(line => {
            const match = line.match(/^(\d+)\s+(.*)/);
            if (!match) return null;
            const cardName = match[2].trim().replace(/\s\/\/.*$/, '');
            const quantity = parseInt(match[1], 10);
            
            // Placeholder for card search - will be replaced with actual API call
            return Promise.resolve({
                id: `card_${Date.now()}_${Math.random()}`,
                name: cardName,
                quantity: quantity,
                prices: { usd: (Math.random() * 10).toFixed(2) },
                type_line: 'Instant',
                cmc: Math.floor(Math.random() * 8),
                image_uris: { normal: 'https://placehold.co/223x310?text=' + encodeURIComponent(cardName) }
            });
        }).filter(p => p);
        
        try {
            deckData.cards = (await Promise.all(cardPromises)).filter(c => c);
            
            const editingId = document.getElementById('editing-deck-id').value;
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
            showToast("Deck saved successfully!", true);
            viewDeck(deckData, userDeckRef.id);
        } catch(error) {
            showToast("Error saving deck: " + error.message);
        } finally {
            buildDeckBtn.disabled = false;
            resetBuilderForm();
        }
    });

    document.getElementById('deck-builder-collection-search').addEventListener('input', () => {
        const searchTerm = document.getElementById('deck-builder-collection-search').value.toLowerCase();
        const filteredCards = fullCollection.filter(card => card.name.toLowerCase().includes(searchTerm));
        renderCollectionInBuilder(filteredCards);
    });
    
    document.getElementById('deck-tcg-select').addEventListener('change', () => {
        const deckTcgSelect = document.getElementById('deck-tcg-select');
        const deckFormatSelect = document.getElementById('deck-format-select');
        const deckFormatSelectContainer = document.getElementById('deck-format-select-container');
        
        const selectedTcg = deckTcgSelect.value;
        const tcgConfig = TCG_CONFIGS[selectedTcg];
        
        if (tcgConfig && tcgConfig.formats) {
            deckFormatSelect.innerHTML = '<option value="" disabled selected>Select a Format</option>';
            tcgConfig.formats.forEach(format => {
                deckFormatSelect.innerHTML += `<option value="${format}">${format}</option>`;
            });
            deckFormatSelectContainer.classList.remove('hidden');
        } else {
            deckFormatSelectContainer.classList.add('hidden');
        }
    });
    
    document.getElementById('tcg-filter-buttons').addEventListener('click', (e) => {
        if (e.target.classList.contains('tcg-filter-btn')) {
            document.getElementById('tcg-filter-buttons').querySelectorAll('.tcg-filter-btn').forEach(btn => btn.classList.remove('filter-btn-active'));
            e.target.classList.add('filter-btn-active');
            const selectedTcg = e.target.dataset.tcg;
            const formatFilterButtons = document.getElementById('format-filter-buttons');
            const formatFilterContainer = document.getElementById('format-filter-container');
            formatFilterButtons.innerHTML = '<button class="format-filter-btn filter-btn-active" data-format="all">All Formats</button>';
            
            const tcgConfig = TCG_CONFIGS[selectedTcg];
            if (selectedTcg !== 'all' && tcgConfig && tcgConfig.formats) {
                tcgConfig.formats.forEach(format => {
                    formatFilterButtons.innerHTML += `<button class="format-filter-btn" data-format="${format}">${format}</button>`;
                });
                formatFilterContainer.classList.remove('hidden');
            } else {
                formatFilterContainer.classList.add('hidden');
            }
            applyDeckFilters();
        }
    });

    document.getElementById('format-filter-buttons').addEventListener('click', (e) => {
        if (e.target.classList.contains('format-filter-btn')) {
            document.getElementById('format-filter-buttons').querySelectorAll('.format-filter-btn').forEach(btn => btn.classList.remove('filter-btn-active'));
            e.target.classList.add('filter-btn-active');
            applyDeckFilters();
        }
    });

    document.getElementById('playtest-battlefield').addEventListener('dragover', (e) => e.preventDefault());
    document.getElementById('playtest-hand').addEventListener('dragover', (e) => e.preventDefault());
    document.getElementById('playtest-battlefield').addEventListener('drop', handleDrop);
    document.getElementById('playtest-hand').addEventListener('drop', handleDrop);
    document.getElementById('close-playtest-modal').addEventListener('click', () => closeModal(document.getElementById('playtest-modal')));
    document.getElementById('playtest-mulligan-btn').addEventListener('click', takeMulligan);
    document.getElementById('playtest-reset-btn').addEventListener('click', initializePlaytest);
    
    document.getElementById('close-share-deck-modal').addEventListener('click', () => closeModal(document.getElementById('share-deck-modal')));

    document.getElementById('share-deck-link-btn').addEventListener('click', () => {
        if (!currentDeckInView) return;
        const url = `${window.location.origin}/deck.html?deckId=${currentDeckInView.id}`;
        navigator.clipboard.writeText(url).then(() => {
            showToast("Public link copied to clipboard!", true);
        }).catch(() => {
            showToast('Failed to copy link.');
        });
    });

    document.getElementById('modal-share-to-feed-btn').addEventListener('click', () => {
        closeModal(document.getElementById('share-deck-modal'));
        const shareMessageTextarea = document.getElementById('share-to-feed-message');
        if (shareMessageTextarea && currentDeckInView) {
            shareMessageTextarea.value = `Check out this deck: [deck:${currentDeckInView.id}:${currentDeckInView.name}]`;
        }
        openModal(document.getElementById('share-to-feed-modal'));
    });

     document.getElementById('modal-share-to-group-btn').addEventListener('click', () => {
        closeModal(document.getElementById('share-deck-modal'));
        loadUserGroups();
        openModal(document.getElementById('share-to-group-modal'));
    });
    
    document.getElementById('close-share-to-feed-modal').addEventListener('click', () => closeModal(document.getElementById('share-to-feed-modal')));
    document.getElementById('close-share-to-group-modal').addEventListener('click', () => closeModal(document.getElementById('share-to-group-modal')));
    
    const loadUserGroups = async () => {
        const groupListContainer = document.getElementById('group-list-container');
        if (!user) return;
        groupListContainer.innerHTML = '<p class="p-4 text-center">Loading your groups...</p>';
        console.log(`Attempting to load groups for user UID: ${user.uid}`);
        try {
            // UPDATED: Using 'participants' as the field name based on user feedback.
            const groupsSnapshot = await db.collection('groups').where('participants', 'array-contains', user.uid).get();
            
            console.log(`Firestore query successful, found ${groupsSnapshot.size} groups.`);

            if (groupsSnapshot.empty) {
                groupListContainer.innerHTML = '<p class="p-4 text-center">You are not a member of any groups.</p>';
                return;
            }
            groupListContainer.innerHTML = '';
            groupsSnapshot.forEach(doc => {
                const group = { id: doc.id, ...doc.data() };
                const groupEl = document.createElement('div');
                groupEl.className = 'p-3 hover:bg-gray-700 cursor-pointer rounded-md';
                groupEl.textContent = group.name;
                groupEl.addEventListener('click', () => shareDeckToGroup(group));
                groupListContainer.appendChild(groupEl);
            });
        } catch (error) {
            console.error("Error loading user groups:", error);
            groupListContainer.innerHTML = '<p class="p-4 text-center text-red-500">Could not load your groups. This might be a database permissions issue. Check console for details.</p>';
        }
    };

    const shareDeckToGroup = async (group) => {
        if (!user || !currentDeckInView) {
            showToast("Please log in and select a deck to share.");
            return;
        }
        const postContent = `Check out my deck: [deck:${currentDeckInView.id}:${currentDeckInView.name}]`;
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.data();
            await db.collection('groups').doc(group.id).collection('posts').add({
                authorName: userData.displayName || 'Anonymous',
                authorId: user.uid,
                authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png',
                content: postContent,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: [],
                commentCount: 0
            });
            showToast(`Deck shared to ${group.name} successfully!`, true);
            closeModal(document.getElementById('share-to-group-modal'));
        } catch (error) {
            showToast("Could not share deck. " + error.message);
        }
    };


    document.getElementById('share-to-feed-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user || !currentDeckInView) {
            showToast("Please log in and select a deck to share.");
            return;
        }
        const postContent = document.getElementById('share-to-feed-message').value;

        if (!postContent || !postContent.includes('[deck:')) {
            showToast("Your post must include the deck link format [deck:...]");
            return;
        }

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
            showToast('Deck shared to feed successfully!', true);
            closeModal(document.getElementById('share-to-feed-modal'));
            document.getElementById('share-to-feed-message').value = '';
            window.location.href = 'app.html';
        } catch (error) {
            showToast("Could not share deck. " + error.message);
        }
    });

    document.getElementById('check-collection-btn').addEventListener('click', checkDeckAgainstCollection);
    
    // Add Test Hand button event listener
    if (testHandBtn) {
        testHandBtn.addEventListener('click', () => {
            if (!currentDeckInView) {
                showToast("Please select a deck first.");
                return;
            }
            initializePlaytest();
            openModal(document.getElementById('playtest-modal'));
        });
    }
    
    // Add Share Deck button event listener
    if (shareDeckBtn) {
        shareDeckBtn.addEventListener('click', () => {
            if (!currentDeckInView) {
                showToast("Please select a deck first.");
                return;
            }
            openModal(document.getElementById('share-deck-modal'));
        });
    }
    document.getElementById('import-deck-btn').addEventListener('click', () => {
        openModal(document.getElementById('import-deck-modal'));
    });
    document.getElementById('close-import-modal').addEventListener('click', () => {
        closeModal(document.getElementById('import-deck-modal'));
    });
    document.getElementById('process-import-btn').addEventListener('click', () => {
        const importDeckFileInput = document.getElementById('import-deck-file-input');
        const importDeckTextarea = document.getElementById('import-deck-textarea');
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
            showToast("Please paste a decklist or select a file.");
        }
        closeModal(document.getElementById('import-deck-modal'));
    });
    
    document.getElementById('write-primer-btn').addEventListener('click', () => {
        const editingDeckIdInput = document.getElementById('editing-deck-id');
        const deckNameInput = document.getElementById('deck-name-input');
        const deckId = editingDeckIdInput.value;
        const deckName = deckNameInput.value;
        if (!deckId || !deckName) {
            showToast('Please save the deck before writing a primer.');
            return;
        }
        const deckNameEncoded = encodeURIComponent(deckName);
        window.location.href = `create-article.html?deckId=${deckId}&deckName=${deckNameEncoded}`;
    });

    document.getElementById('deck-user-rating-stars').addEventListener('click', handleRatingInteraction);
    document.getElementById('deck-user-rating-stars').addEventListener('mouseover', handleRatingInteraction);
    document.getElementById('deck-user-rating-stars').addEventListener('mouseout', handleRatingInteraction);

    document.getElementById('deck-comment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) {
            showToast("Please log in to comment.");
            return;
        }
        const deckId = currentDeckInView?.id;
        if (!deckId) return;

        const deckCommentInput = document.getElementById('deck-comment-input');
        const commentText = deckCommentInput.value.trim();
        if (!commentText) return;

        const submitBtn = e.target.querySelector('button[type="submit"]');
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
            loadRatingsAndComments(deckId);
        } catch (error) {
            showToast("Could not submit your comment.");
        } finally {
            submitBtn.disabled = false;
        }
    });

    // --- Initial Load ---
    initializeCardPreviewTooltip(); 
    const urlParams = new URLSearchParams(window.location.search);
    const deckId = urlParams.get('deckId');
    if (deckId) {
        const publicDeckRef = db.collection('publicDecks').doc(deckId);
        publicDeckRef.get().then(doc => {
            if (doc.exists) {
                viewDeck(doc.data(), doc.id);
            } else if (user) {
                 const userDeckRef = db.collection('users').doc(user.uid).collection('decks').doc(deckId);
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
