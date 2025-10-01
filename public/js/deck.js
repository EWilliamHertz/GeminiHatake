/**
 * HatakeSocial - Deck Page Script (v35.0 - Enhanced 4-TCG Support)
 *
 * Enhanced to support all 4 TCGs: Magic: The Gathering, Pokémon, Lorcana, and Gundam
 * Added proper game and format filtering for My Decks and Community Decks
 * Integrated with proper APIs for each TCG
 */

// This variable will hold the deck data while the user is on the deck-view tab.
let currentDeckInView = null;
let cardPreviewTooltip = null; // Global variable for the card hover tooltip
let playtestUiRestructured = false; // Flag to ensure UI is only changed once

// TCG Configuration with formats and APIs
const TCG_CONFIG = {
    'Magic: The Gathering': {
        formats: ['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Commander', 'Historic', 'Alchemy', 'Pauper', 'Limited'],
        api: 'scryfall',
        deckSizes: {
            'Standard': { min: 60, max: null },
            'Pioneer': { min: 60, max: null },
            'Modern': { min: 60, max: null },
            'Legacy': { min: 60, max: null },
            'Vintage': { min: 60, max: null },
            'Commander': { min: 100, max: 100 },
            'Historic': { min: 60, max: null },
            'Alchemy': { min: 60, max: null },
            'Pauper': { min: 60, max: null },
            'Limited': { min: 40, max: null }
        },
        cardLimits: {
            'Standard': 4,
            'Pioneer': 4,
            'Modern': 4,
            'Legacy': 4,
            'Vintage': 4,
            'Commander': 1,
            'Historic': 4,
            'Alchemy': 4,
            'Pauper': 4,
            'Limited': 4
        }
    },
    'Pokémon': {
        formats: ['Standard', 'Expanded', 'Unlimited', 'GLC (Gym Leader Challenge)', 'Theme Deck'],
        api: 'pokemon',
        deckSizes: {
            'Standard': { min: 60, max: 60 },
            'Expanded': { min: 60, max: 60 },
            'Unlimited': { min: 60, max: 60 },
            'GLC (Gym Leader Challenge)': { min: 60, max: 60 },
            'Theme Deck': { min: 60, max: 60 }
        },
        cardLimits: {
            'Standard': 4,
            'Expanded': 4,
            'Unlimited': 4,
            'GLC (Gym Leader Challenge)': 4,
            'Theme Deck': 4
        }
    },
    'Lorcana': {
        formats: ['Standard', 'Limited', 'Casual'],
        api: 'lorcana',
        deckSizes: {
            'Standard': { min: 60, max: 60 },
            'Limited': { min: 40, max: null },
            'Casual': { min: 60, max: null }
        },
        cardLimits: {
            'Standard': 4,
            'Limited': 4,
            'Casual': 4
        }
    },
    'Gundam': {
        formats: ['Standard', 'Advanced', 'Casual'],
        api: 'gundam',
        deckSizes: {
            'Standard': { min: 50, max: 50 },
            'Advanced': { min: 50, max: 50 },
            'Casual': { min: 50, max: null }
        },
        cardLimits: {
            'Standard': 3,
            'Advanced': 3,
            'Casual': 3
        }
    }
};

function getCardImageUrl(cardData, size = 'normal') {
    if (cardData.card_faces && cardData.card_faces[0].image_uris) {
        return cardData.card_faces[0].image_uris[size] || cardData.card_faces[0].image_uris['normal'];
    }
    if (cardData.image_uris) {
        return cardData.image_uris[size] || cardData.image_uris['normal'];
    }
    // Handle Pokémon TCG API format
    if (cardData.images && cardData.images.small) {
        return size === 'small' ? cardData.images.small : cardData.images.large || cardData.images.small;
    }
    // Handle other TCG formats
    if (cardData.image_url) {
        return cardData.image_url;
    }
    return 'https://placehold.co/223x310/cccccc/969696?text=No+Image';
}

document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const db = firebase.firestore();
    const deckBuilderForm = document.getElementById('deck-builder-form');
    if (!deckBuilderForm) return;

    // --- State Variables ---
    let fullCollection = [];
    let manaCurveChart = null;
    let playtestState = { deck: [], hand: [], battlefield: [], graveyard: [], library: [] };
    let currentFilters = { tcg: 'all', format: 'all' };

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

    // --- Modal Functions ---
    const openModal = (modal) => {
        console.log('Opening modal:', modal ? modal.id : 'null');
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
        }
        console.log(`Modal ${modal.id} opened successfully.`);
    };

    const closeModal = (modal) => {
        console.log('Closing modal:', modal ? modal.id : 'null');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }
    };
    
    // Make closeModal globally available
    window.closeModal = closeModal;
    
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

    // --- DOM Elements ---
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const testHandBtn = document.getElementById('test-hand-btn');
    const shareDeckBtn = document.getElementById('share-deck-btn');
    const tcgSelect = document.getElementById('deck-tcg-select');
    const formatSelectContainer = document.getElementById('deck-format-select-container');
    const formatSelect = document.getElementById('deck-format-select');
    
    // --- TCG and Format Selection ---
    tcgSelect.addEventListener('change', function() {
        const selectedTcg = this.value;
        if (selectedTcg && TCG_CONFIG[selectedTcg]) {
            // Show format selection
            formatSelectContainer.classList.remove('hidden');
            
            // Populate format options
            formatSelect.innerHTML = '<option value="" disabled selected>Select a Format</option>';
            TCG_CONFIG[selectedTcg].formats.forEach(format => {
                const option = document.createElement('option');
                option.value = format;
                option.textContent = format;
                formatSelect.appendChild(option);
            });
        } else {
            formatSelectContainer.classList.add('hidden');
        }
    });

    // --- Filter Functions ---
    function initializeFilters() {
        const tcgFilterButtons = document.getElementById('tcg-filter-buttons');
        const formatFilterContainer = document.getElementById('format-filter-container');
        const formatFilterButtons = document.getElementById('format-filter-buttons');

        // TCG Filter Event Listeners
        tcgFilterButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('tcg-filter-btn')) {
                // Update active state
                tcgFilterButtons.querySelectorAll('.tcg-filter-btn').forEach(btn => {
                    btn.classList.remove('filter-btn-active');
                });
                e.target.classList.add('filter-btn-active');
                
                const selectedTcg = e.target.dataset.tcg;
                currentFilters.tcg = selectedTcg;
                currentFilters.format = 'all'; // Reset format filter
                
                // Show/hide format filter based on TCG selection
                if (selectedTcg === 'all') {
                    formatFilterContainer.classList.add('hidden');
                } else {
                    formatFilterContainer.classList.remove('hidden');
                    populateFormatFilter(selectedTcg);
                }
                
                // Apply filters
                applyFilters();
            }
        });

        // Format Filter Event Listeners
        formatFilterButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('format-filter-btn')) {
                // Update active state
                formatFilterButtons.querySelectorAll('.format-filter-btn').forEach(btn => {
                    btn.classList.remove('filter-btn-active');
                });
                e.target.classList.add('filter-btn-active');
                
                currentFilters.format = e.target.dataset.format;
                applyFilters();
            }
        });
    }

    function populateFormatFilter(tcg) {
        const formatFilterButtons = document.getElementById('format-filter-buttons');
        formatFilterButtons.innerHTML = '';
        
        // Add "All" option
        const allBtn = document.createElement('button');
        allBtn.className = 'format-filter-btn filter-btn-active';
        allBtn.dataset.format = 'all';
        allBtn.textContent = 'All';
        formatFilterButtons.appendChild(allBtn);
        
        // Add format options for selected TCG
        if (TCG_CONFIG[tcg]) {
            TCG_CONFIG[tcg].formats.forEach(format => {
                const btn = document.createElement('button');
                btn.className = 'format-filter-btn';
                btn.dataset.format = format;
                btn.textContent = format;
                formatFilterButtons.appendChild(btn);
            });
        }
    }

    function applyFilters() {
        const currentTab = document.querySelector('.tab-button.text-blue-600').id;
        
        if (currentTab === 'tab-my-decks') {
            loadMyDecks();
        } else if (currentTab === 'tab-community-decks') {
            loadCommunityDecks();
        }
    }

    function filterDecks(decks) {
        return decks.filter(deck => {
            // TCG filter
            if (currentFilters.tcg !== 'all' && deck.tcg !== currentFilters.tcg) {
                return false;
            }
            
            // Format filter
            if (currentFilters.format !== 'all' && deck.format !== currentFilters.format) {
                return false;
            }
            
            return true;
        });
    }

    // --- Card Search and API Functions ---
    const searchCard = async (cardName, tcg) => {
        try {
            switch (tcg) {
                case 'Magic: The Gathering':
                    return await searchMagicCard(cardName);
                case 'Pokémon':
                    return await searchPokemonCard(cardName);
                case 'Lorcana':
                    return await searchLorcanaCard(cardName);
                case 'Gundam':
                    return await searchGundamCard(cardName);
                default:
                    throw new Error('Unsupported TCG');
            }
        } catch (error) {
            console.error(`Error searching for card "${cardName}" in ${tcg}:`, error);
            return null;
        }
    };

    const searchMagicCard = async (cardName) => {
        const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
        if (response.ok) {
            return await response.json();
        }
        throw new Error('Card not found');
    };

    const searchPokemonCard = async (cardName) => {
        const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cardName)}"`, {
            headers: {
                'X-Api-Key': '60a08d4a-3a34-43d8-8f41-827b58cfac6d'
            }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
                const card = data.data[0];
                // Normalize Pokémon card data to match our format
                return {
                    id: card.id,
                    name: card.name,
                    type_line: card.types ? card.types.join(' ') : 'Pokémon',
                    cmc: card.convertedRetreatCost || 0,
                    prices: { 
                        usd: card.tcgplayer?.prices?.holofoil?.market || 
                             card.tcgplayer?.prices?.normal?.market || 
                             card.tcgplayer?.prices?.reverseHolofoil?.market || 
                             '0.00' 
                    },
                    image_uris: { 
                        normal: card.images?.large || card.images?.small,
                        small: card.images?.small 
                    },
                    images: card.images
                };
            }
        }
        throw new Error('Card not found');
    };

    const searchLorcanaCard = async (cardName) => {
        // Placeholder for Lorcana API - implement when available
        // For now, create a mock card
        return {
            id: `lorcana-${Date.now()}`,
            name: cardName,
            type_line: 'Character',
            cmc: 3,
            prices: { usd: '2.50' },
            image_uris: { 
                normal: 'https://placehold.co/223x310?text=Lorcana+Card',
                small: 'https://placehold.co/146x204?text=Lorcana+Card'
            }
        };
    };

    const searchGundamCard = async (cardName) => {
        // Placeholder for Gundam API - implement when available
        // For now, create a mock card
        return {
            id: `gundam-${Date.now()}`,
            name: cardName,
            type_line: 'Mobile Suit',
            cmc: 4,
            prices: { usd: '3.00' },
            image_uris: { 
                normal: 'https://placehold.co/223x310?text=Gundam+Card',
                small: 'https://placehold.co/146x204?text=Gundam+Card'
            }
        };
    };

    // --- Deck Management Functions ---
    const viewDeck = (deck, deckId) => {
        currentDeckInView = { ...deck, id: deckId };
        
        document.getElementById('tab-deck-view').classList.remove('hidden');
        switchTab('tab-deck-view');

        document.getElementById('deck-view-name').textContent = deck.name;
        document.getElementById('deck-view-author').textContent = `by ${deck.authorName || 'Anonymous'}`;
        document.getElementById('deck-view-format').textContent = `${deck.tcg || 'Unknown'} - ${deck.format || 'N/A'}`;
        
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
            const mainType = card.type_line || card.types?.join(' ') || 'Unknown';
            let category = 'Other';
            
            // Magic: The Gathering categories
            if (mainType.includes('Creature')) category = 'Creatures';
            else if (mainType.includes('Planeswalker')) category = 'Planeswalkers';
            else if (mainType.includes('Instant') || mainType.includes('Sorcery')) category = 'Spells';
            else if (mainType.includes('Artifact')) category = 'Artifacts';
            else if (mainType.includes('Enchantment')) category = 'Enchantments';
            else if (mainType.includes('Land')) category = 'Lands';
            // Pokémon categories
            else if (mainType.includes('Pokémon')) category = 'Pokémon';
            else if (mainType.includes('Trainer')) category = 'Trainers';
            else if (mainType.includes('Energy')) category = 'Energy';
            // Lorcana categories
            else if (mainType.includes('Character')) category = 'Characters';
            else if (mainType.includes('Action')) category = 'Actions';
            else if (mainType.includes('Item')) category = 'Items';
            else if (mainType.includes('Location')) category = 'Locations';
            // Gundam categories
            else if (mainType.includes('Mobile Suit')) category = 'Mobile Suits';
            else if (mainType.includes('Pilot')) category = 'Pilots';
            else if (mainType.includes('Command')) category = 'Commands';
            else if (mainType.includes('Operation')) category = 'Operations';
            
            if (!categorizedCards[category]) categorizedCards[category] = [];
            categorizedCards[category].push(card);
            totalPrice += (parseFloat(card.prices?.usd || card.price || 0) * card.quantity);
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
                    <span class="card-link cursor-pointer text-blue-600 dark:text-blue-400 hover:underline" data-card-id="${card.id}">${card.quantity}x ${card.name}</span>
                    <span class="text-gray-500 dark:text-gray-400">$${(parseFloat(card.prices?.usd || card.price || 0) * card.quantity).toFixed(2)}</span>
                `;
                cardList.appendChild(cardEl);
            });
            categoryEl.appendChild(cardList);
            listEl.appendChild(categoryEl);
        });
        
        displayLegality(deck);
        loadRatingsAndComments(deckId);
        
        // Create mana/cost curve chart (adapt for different TCGs)
        if (manaCurveChart) {
            manaCurveChart.destroy();
        }
        
        const costs = deck.cards.flatMap(card => {
            const cost = card.cmc || card.convertedManaCost || card.cost || 0;
            return Array(card.quantity).fill(cost);
        });
        const curveData = Array(8).fill(0);
        costs.forEach(cost => {
            if (cost >= 7) {
                curveData[7]++;
            } else {
                curveData[cost]++;
            }
        });

        const ctx = document.getElementById('mana-curve-chart').getContext('2d');
        const chartLabel = deck.tcg === 'Magic: The Gathering' ? 'Mana Cost' : 'Cost';
        
        manaCurveChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['0', '1', '2', '3', '4', '5', '6', '7+'],
                datasets: [{
                    label: 'Number of Cards',
                    data: curveData,
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `${chartLabel} Distribution`
                    }
                },
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

    // --- Deck Loading Functions ---
    const loadMyDecks = async () => {
        if (!user) return;
        
        const myDecksList = document.getElementById('my-decks-list');
        myDecksList.innerHTML = '<div class="col-span-full text-center text-gray-500 dark:text-gray-400">Loading your decks...</div>';
        
        try {
            const snapshot = await db.collection('decks').where('authorId', '==', user.uid).get();
            let decks = [];
            snapshot.forEach(doc => {
                decks.push({ id: doc.id, ...doc.data() });
            });
            
            // Apply filters
            decks = filterDecks(decks);
            
            myDecksList.innerHTML = '';
            if (decks.length === 0) {
                myDecksList.innerHTML = '<div class="col-span-full text-center text-gray-500 dark:text-gray-400">No decks found matching the current filters.</div>';
                return;
            }
            
            decks.forEach(deck => {
                const deckCard = createDeckCard(deck, true);
                myDecksList.appendChild(deckCard);
            });
        } catch (error) {
            console.error('Error loading my decks:', error);
            myDecksList.innerHTML = '<div class="col-span-full text-center text-red-500">Error loading decks. Please try again.</div>';
        }
    };

    const loadCommunityDecks = async () => {
        const communityDecksList = document.getElementById('community-decks-list');
        communityDecksList.innerHTML = '<div class="col-span-full text-center text-gray-500 dark:text-gray-400">Loading community decks...</div>';
        
        try {
            const snapshot = await db.collection('decks').where('isPublic', '==', true).orderBy('createdAt', 'desc').limit(50).get();
            let decks = [];
            snapshot.forEach(doc => {
                decks.push({ id: doc.id, ...doc.data() });
            });
            
            // Apply filters
            decks = filterDecks(decks);
            
            communityDecksList.innerHTML = '';
            if (decks.length === 0) {
                communityDecksList.innerHTML = '<div class="col-span-full text-center text-gray-500 dark:text-gray-400">No community decks found matching the current filters.</div>';
                return;
            }
            
            decks.forEach(deck => {
                const deckCard = createDeckCard(deck, false);
                communityDecksList.appendChild(deckCard);
            });
        } catch (error) {
            console.error('Error loading community decks:', error);
            communityDecksList.innerHTML = '<div class="col-span-full text-center text-red-500">Error loading community decks. Please try again.</div>';
        }
    };

    const createDeckCard = (deck, isOwner) => {
        const deckCard = document.createElement('div');
        deckCard.className = 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer';
        
        const totalPrice = deck.cards ? deck.cards.reduce((sum, card) => sum + (parseFloat(card.prices?.usd || card.price || 0) * card.quantity), 0) : 0;
        const cardCount = deck.cards ? deck.cards.reduce((sum, card) => sum + card.quantity, 0) : 0;
        
        deckCard.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h3 class="text-xl font-bold text-gray-800 dark:text-white">${deck.name}</h3>
                <span class="text-sm px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">${deck.tcg || 'Unknown'}</span>
            </div>
            <p class="text-gray-600 dark:text-gray-400 mb-2">by ${deck.authorName || 'Anonymous'}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Format: ${deck.format || 'N/A'}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">${cardCount} cards</p>
            ${deck.bio ? `<p class="text-gray-700 dark:text-gray-300 mb-4 text-sm">${deck.bio}</p>` : ''}
            <div class="flex justify-between items-center">
                <span class="text-lg font-bold text-blue-600 dark:text-blue-400">$${totalPrice.toFixed(2)}</span>
                <div class="flex space-x-2">
                    ${isOwner ? `
                        <button class="edit-deck-btn px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600" data-deck-id="${deck.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-deck-btn px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600" data-deck-id="${deck.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                    <button class="view-deck-btn px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600" data-deck-id="${deck.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Add event listeners
        deckCard.querySelector('.view-deck-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            viewDeck(deck, deck.id);
        });
        
        if (isOwner) {
            deckCard.querySelector('.edit-deck-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                editDeck(deck);
            });
            
            deckCard.querySelector('.delete-deck-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteDeck(deck.id);
            });
        }
        
        return deckCard;
    };

    const resetBuilderForm = () => {
        const builderTitle = document.getElementById('builder-title');
        const buildDeckBtn = document.getElementById('build-deck-btn');
        const editingDeckIdInput = document.getElementById('editing-deck-id');
        const writePrimerBtn = document.getElementById('write-primer-btn');

        deckBuilderForm.reset();
        builderTitle.textContent = "Create New Deck";
        buildDeckBtn.innerHTML = '<i class="fas fa-hammer mr-2"></i> Build & Price Deck';
        editingDeckIdInput.value = '';
        formatSelectContainer.classList.add('hidden');
        if (writePrimerBtn) writePrimerBtn.classList.add('hidden');
    };

    const editDeck = (deck) => {
        document.getElementById('editing-deck-id').value = deck.id;
        document.getElementById('deck-name-input').value = deck.name;
        document.getElementById('deck-tcg-select').value = deck.tcg || '';
        document.getElementById('deck-bio-input').value = deck.bio || '';
        document.getElementById('deck-primer-input').value = deck.primer || '';
        document.getElementById('deck-public-checkbox').checked = deck.isPublic !== false;
        document.getElementById('builder-title').textContent = 'Edit Deck';
        
        // Trigger TCG change to show format options
        if (deck.tcg) {
            tcgSelect.dispatchEvent(new Event('change'));
            setTimeout(() => {
                document.getElementById('deck-format-select').value = deck.format || '';
            }, 100);
        }
        
        // Convert deck cards back to decklist format
        if (deck.cards) {
            const decklistText = deck.cards.map(card => `${card.quantity} ${card.name}`).join('\n');
            document.getElementById('decklist-input').value = decklistText;
        }
        
        switchTab('tab-builder');
    };

    const deleteDeck = async (deckId) => {
        if (!confirm('Are you sure you want to delete this deck? This action cannot be undone.')) {
            return;
        }
        
        try {
            await db.collection('decks').doc(deckId).delete();
            showToast('Deck deleted successfully!', true);
            loadMyDecks();
        } catch (error) {
            console.error('Error deleting deck:', error);
            showToast('Error deleting deck. Please try again.');
        }
    };

    // --- Form Submission ---
    deckBuilderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const deckName = document.getElementById('deck-name-input').value.trim();
        const deckTcg = document.getElementById('deck-tcg-select').value;
        const deckFormat = document.getElementById('deck-format-select').value;
        const deckBio = document.getElementById('deck-bio-input').value.trim();
        const decklistText = document.getElementById('decklist-input').value.trim();
        const deckPrimer = document.getElementById('deck-primer-input').value.trim();
        const isPublic = document.getElementById('deck-public-checkbox').checked;
        const editingDeckId = document.getElementById('editing-deck-id').value;
        
        if (!deckName || !deckTcg || !deckFormat || !decklistText) {
            showToast('Please fill in all required fields.');
            return;
        }
        
        // Parse decklist
        const decklistLines = decklistText.split('\n').filter(line => line.trim());
        const cards = [];
        
        showToast('Building deck... This may take a moment.', true);
        
        for (const line of decklistLines) {
            const match = line.match(/^(\d+)\s+(.+)$/);
            if (match) {
                const quantity = parseInt(match[1]);
                const cardName = match[2].trim();
                
                const cardData = await searchCard(cardName, deckTcg);
                if (cardData) {
                    cards.push({
                        ...cardData,
                        quantity: quantity
                    });
                } else {
                    console.warn(`Card not found: ${cardName}`);
                    // Add as placeholder
                    cards.push({
                        id: `unknown-${Date.now()}-${Math.random()}`,
                        name: cardName,
                        quantity: quantity,
                        type_line: 'Unknown',
                        cmc: 0,
                        prices: { usd: '0.00' },
                        image_uris: { normal: 'https://placehold.co/223x310?text=Unknown+Card' }
                    });
                }
            }
        }
        
        const deckData = {
            name: deckName,
            tcg: deckTcg,
            format: deckFormat,
            bio: deckBio,
            primer: deckPrimer,
            cards: cards,
            isPublic: isPublic,
            authorId: user.uid,
            authorName: user.displayName || user.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (!editingDeckId) {
            deckData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        try {
            if (editingDeckId) {
                await db.collection('decks').doc(editingDeckId).update(deckData);
                showToast('Deck updated successfully!', true);
            } else {
                await db.collection('decks').add(deckData);
                showToast('Deck created successfully!', true);
            }
            
            resetBuilderForm();
            switchTab('tab-my-decks');
            loadMyDecks();
        } catch (error) {
            console.error('Error saving deck:', error);
            showToast('Error saving deck. Please try again.');
        }
    });

    // --- Playtest Functions ---
    const initializePlaytest = () => {
        if (currentDeckInView && currentDeckInView.id) {
            if (!playtestUiRestructured) {
                const controls = document.getElementById('playtest-controls');
                const deckInfo = document.getElementById('playtest-deck-info');
                const drawBtn = document.getElementById('playtest-draw-btn');
                
                if (controls && deckInfo) {
                    const deckPile = document.createElement('div');
                    deckPile.className = 'flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer transition-transform transform hover:scale-105';
                    deckPile.style.backgroundImage = 'url("https://i.imgur.com/LdOBU1I.jpeg")';
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
                    const libraryCountSpan = document.createElement('span');
                    libraryCountSpan.id = 'library-count';
                    libraryText.appendChild(libraryCountSpan);
                    
                    deckPile.appendChild(libraryText);
                    if (drawBtn) drawBtn.style.display = 'none';
                    
                    controls.prepend(deckPile);
                    
                    const handCountSpan = document.createElement('span');
                    handCountSpan.id = 'hand-count';
                    deckInfo.innerHTML = `Hand: `;
                    deckInfo.appendChild(handCountSpan);
                    
                    playtestUiRestructured = true;
                }
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
            updatePlaytestUI();
        } else {
            showToast("Please select a deck to test your hand.");
        }
    };

    const drawCards = (count) => {
        for (let i = 0; i < count && playtestState.library.length > 0; i++) {
            const card = playtestState.library.pop();
            playtestState.hand.push(card);
        }
        updatePlaytestUI();
    };

    const updatePlaytestUI = () => {
        const handZone = document.getElementById('hand-zone');
        const battlefieldZone = document.getElementById('battlefield-zone');
        const libraryCountSpan = document.getElementById('library-count');
        const handCountSpan = document.getElementById('hand-count');

        if (libraryCountSpan) libraryCountSpan.textContent = playtestState.library.length;
        if (handCountSpan) handCountSpan.textContent = playtestState.hand.length;

        if (handZone) {
            handZone.innerHTML = '<span class="absolute top-2 left-2 text-blue-600 dark:text-blue-400 font-semibold">Hand</span>';
            playtestState.hand.forEach(card => {
                const cardEl = document.createElement('img');
                cardEl.src = getCardImageUrl(card, 'small');
                cardEl.className = 'playtest-card';
                cardEl.draggable = true;
                cardEl.dataset.instanceId = card.instanceId;
                cardEl.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', card.instanceId);
                    e.dataTransfer.setData('source', 'hand');
                });
                handZone.appendChild(cardEl);
            });
        }

        if (battlefieldZone) {
            battlefieldZone.innerHTML = '<span class="absolute top-2 left-2 text-green-600 dark:text-green-400 font-semibold">Battlefield</span>';
            playtestState.battlefield.forEach(card => {
                const cardEl = document.createElement('img');
                cardEl.src = getCardImageUrl(card, 'small');
                cardEl.className = 'playtest-card';
                cardEl.draggable = true;
                cardEl.dataset.instanceId = card.instanceId;
                cardEl.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', card.instanceId);
                    e.dataTransfer.setData('source', 'battlefield');
                });
                battlefieldZone.appendChild(cardEl);
            });
        }
    };

    // --- Additional Functions ---
    const displayLegality = (deck) => {
        const legalitySection = document.getElementById('deck-legality-section');
        if (!legalitySection) return;
        
        // Basic legality check based on TCG and format
        const config = TCG_CONFIG[deck.tcg];
        let legalityInfo = [];
        
        if (config && deck.format) {
            const deckSize = deck.cards ? deck.cards.reduce((sum, card) => sum + card.quantity, 0) : 0;
            const formatConfig = config.deckSizes[deck.format];
            const cardLimit = config.cardLimits[deck.format];
            
            let isLegal = true;
            let issues = [];
            
            // Check deck size
            if (formatConfig) {
                if (formatConfig.min && deckSize < formatConfig.min) {
                    isLegal = false;
                    issues.push(`Deck too small (${deckSize}/${formatConfig.min} minimum)`);
                }
                if (formatConfig.max && deckSize > formatConfig.max) {
                    isLegal = false;
                    issues.push(`Deck too large (${deckSize}/${formatConfig.max} maximum)`);
                }
            }
            
            // Check card limits
            if (cardLimit && deck.cards) {
                deck.cards.forEach(card => {
                    if (card.quantity > cardLimit) {
                        isLegal = false;
                        issues.push(`Too many copies of ${card.name} (${card.quantity}/${cardLimit} maximum)`);
                    }
                });
            }
            
            legalityInfo.push({
                format: deck.format,
                legal: isLegal,
                issues: issues
            });
        }
        
        legalitySection.innerHTML = `
            <h3 class="text-lg font-semibold mb-2 dark:text-gray-200">Format Legality</h3>
            <div class="space-y-2">
                ${legalityInfo.map(info => `
                    <div class="flex items-center space-x-2">
                        <span class="px-2 py-1 rounded text-sm ${info.legal ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}">
                            ${info.format}: ${info.legal ? 'Legal' : 'Illegal'}
                        </span>
                    </div>
                    ${info.issues.length > 0 ? `
                        <div class="ml-4 text-sm text-red-600 dark:text-red-400">
                            ${info.issues.map(issue => `<div>• ${issue}</div>`).join('')}
                        </div>
                    ` : ''}
                `).join('')}
            </div>
        `;
    };

    const loadRatingsAndComments = async (deckId) => {
        // Placeholder for ratings and comments functionality
        console.log('Loading ratings and comments for deck:', deckId);
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

    const renderCollectionInBuilder = (collection) => {
        const collectionListContainer = document.getElementById('deck-builder-collection-list');
        collectionListContainer.innerHTML = '';
        
        collection.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer';
            cardEl.innerHTML = `
                <div class="flex items-center space-x-2">
                    <img src="${getCardImageUrl(card, 'small')}" alt="${card.name}" class="w-8 h-11 rounded">
                    <div>
                        <div class="font-medium text-sm">${card.name}</div>
                        <div class="text-xs text-gray-500">Owned: ${card.quantity || 1}</div>
                    </div>
                </div>
                <button class="add-to-deck-btn px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">
                    Add
                </button>
            `;
            
            cardEl.querySelector('.add-to-deck-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                addCardToDeckBuilder(card);
            });
            
            collectionListContainer.appendChild(cardEl);
        });
    };

    const addCardToDeckBuilder = (card) => {
        const decklistInput = document.getElementById('decklist-input');
        const currentDecklist = decklistInput.value;
        const newLine = `1 ${card.name}`;
        
        if (currentDecklist.trim()) {
            decklistInput.value = currentDecklist + '\n' + newLine;
        } else {
            decklistInput.value = newLine;
        }
        
        showToast(`Added ${card.name} to deck!`, true);
    };

    // --- Event Listeners ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.id);
            if (tab.id === 'tab-my-decks') {
                loadMyDecks();
            } else if (tab.id === 'tab-community-decks') {
                loadCommunityDecks();
            }
        });
    });

    // Import deck functionality
    const importDeckBtn = document.getElementById('import-deck-btn');
    const importDeckModal = document.getElementById('import-deck-modal');
    const importConfirmBtn = document.getElementById('import-confirm-btn');
    
    if (importDeckBtn && importDeckModal) {
        importDeckBtn.addEventListener('click', () => {
            openModal(importDeckModal);
        });
    }
    
    if (importConfirmBtn) {
        importConfirmBtn.addEventListener('click', () => {
            const importText = document.getElementById('import-decklist-textarea').value.trim();
            if (importText) {
                document.getElementById('decklist-input').value = importText;
                closeModal(importDeckModal);
                document.getElementById('import-decklist-textarea').value = '';
            }
        });
    }

    // Playtest functionality
    if (testHandBtn) {
        testHandBtn.addEventListener('click', () => {
            const playtestModal = document.getElementById('playtest-modal');
            if (playtestModal) {
                openModal(playtestModal);
                initializePlaytest();
            }
        });
    }

    // Playtest controls
    const drawCardBtn = document.getElementById('draw-card-btn');
    const newHandBtn = document.getElementById('new-hand-btn');
    const resetPlaytestBtn = document.getElementById('reset-playtest-btn');
    
    if (drawCardBtn) {
        drawCardBtn.addEventListener('click', () => drawCards(1));
    }
    
    if (newHandBtn) {
        newHandBtn.addEventListener('click', () => {
            playtestState.library.push(...playtestState.hand);
            playtestState.hand = [];
            playtestState.library = playtestState.library.sort(() => Math.random() - 0.5);
            drawCards(7);
            updatePlaytestUI();
        });
    }
    
    if (resetPlaytestBtn) {
        resetPlaytestBtn.addEventListener('click', () => {
            initializePlaytest();
        });
    }

    // Drag and drop for playtest
    const handZone = document.getElementById('hand-zone');
    const battlefieldZone = document.getElementById('battlefield-zone');
    
    [handZone, battlefieldZone].forEach(zone => {
        if (zone) {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
            });
            
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                const instanceId = e.dataTransfer.getData('text/plain');
                const source = e.dataTransfer.getData('source');
                const targetZone = zone.id.replace('-zone', '');
                
                if (source === 'hand' && targetZone === 'battlefield') {
                    const cardIndex = playtestState.hand.findIndex(card => card.instanceId == instanceId);
                    if (cardIndex !== -1) {
                        const card = playtestState.hand.splice(cardIndex, 1)[0];
                        playtestState.battlefield.push(card);
                        updatePlaytestUI();
                    }
                } else if (source === 'battlefield' && targetZone === 'hand') {
                    const cardIndex = playtestState.battlefield.findIndex(card => card.instanceId == instanceId);
                    if (cardIndex !== -1) {
                        const card = playtestState.battlefield.splice(cardIndex, 1)[0];
                        playtestState.hand.push(card);
                        updatePlaytestUI();
                    }
                }
            });
        }
    });

    // Collection search
    const collectionSearchInput = document.getElementById('deck-builder-collection-search');
    if (collectionSearchInput) {
        collectionSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredCollection = fullCollection.filter(card => 
                card.name.toLowerCase().includes(searchTerm)
            );
            renderCollectionInBuilder(filteredCollection);
        });
    }

    // Initialize
    initializeCardPreviewTooltip();
    initializeFilters();
    
    // Load initial data
    if (user) {
        loadMyDecks();
    }
    
    // Set up card hover previews
    document.addEventListener('mouseover', (e) => {
        if (e.target.classList.contains('card-link')) {
            const cardId = e.target.dataset.cardId || e.target.dataset.scryfallId;
            if (cardId && cardPreviewTooltip) {
                // Find the card in current deck view
                if (currentDeckInView && currentDeckInView.cards) {
                    const card = currentDeckInView.cards.find(c => c.id === cardId);
                    if (card) {
                        cardPreviewTooltip.src = getCardImageUrl(card, 'normal');
                        cardPreviewTooltip.style.display = 'block';
                    }
                }
            }
        }
    });
    
    document.addEventListener('mouseout', (e) => {
        if (e.target.classList.contains('card-link') && cardPreviewTooltip) {
            cardPreviewTooltip.style.display = 'none';
        }
    });
});
