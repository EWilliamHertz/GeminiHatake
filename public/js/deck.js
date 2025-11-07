/**
 * HatakeSocial - Deck Page Script (v36.0 - Fixed Tab Functionality)
 *
 * Enhanced to support all 4 TCGs: Magic: The Gathering, Pokémon, Lorcana, and Gundam
 * Fixed tab functionality to work immediately without auth dependencies
 */

// Global variables
let currentDeckInView = null;
let cardPreviewTooltip = null;
let playtestUiRestructured = false;
let user = null;
let db = null;
let currentFilters = { tcg: 'all', format: 'all' };

// TCG Configuration
const TCG_CONFIG = {
    'Magic: The Gathering': {
        formats: ['Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Commander', 'Historic', 'Alchemy', 'Pauper', 'Limited'],
        api: 'scryfall'
    },
    'Pokémon': {
        formats: ['Standard', 'Expanded', 'Unlimited', 'GLC (Gym Leader Challenge)', 'Theme Deck'],
        api: 'pokemon'
    },
    'Lorcana': {
        formats: ['Standard', 'Limited', 'Casual'],
        api: 'lorcana'
    },
    'Gundam': {
        formats: ['Standard', 'Advanced', 'Casual'],
        api: 'gundam'
    }
};

// Robust initialization function (global scope)
window.initializeDeckBuilder = function() {
    console.log('Initializing deck builder...');
    try {
        initializeTabs();
        initializeFormHandlers();
        initializeFilters();
        
        // Initialize Firebase if available
        if (typeof firebase !== 'undefined') {
            db = firebase.firestore();
        }
        
        console.log('Deck builder initialization complete');
    } catch (error) {
        console.error('Error initializing deck builder:', error);
        // Retry after a short delay
        setTimeout(window.initializeDeckBuilder, 500);
    }
};

// Execute immediately
window.initializeDeckBuilder();

// Multiple initialization strategies to ensure it works
document.addEventListener('DOMContentLoaded', window.initializeDeckBuilder);

// Also try immediate initialization if DOM is ready
if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting for DOMContentLoaded...');
} else {
    console.log('DOM already loaded, initializing immediately...');
    setTimeout(window.initializeDeckBuilder, 100);
}

// Fallback initialization after page load
window.addEventListener('load', function() {
    console.log('Window loaded, ensuring deck builder is initialized...');
    // Check if tabs are working, if not, reinitialize
    const tabs = document.querySelectorAll('.tab-button');
    if (tabs.length > 0 && !tabs[0].onclick && !tabs[0].hasAttribute('data-initialized')) {
        console.log('Tabs not initialized, running fallback initialization...');
        window.initializeDeckBuilder();
    }
});

// Listen for auth ready
document.addEventListener('authReady', function(e) {
    console.log('Auth ready, user:', e.detail.user);
    user = e.detail.user;
    if (user) {
        loadMyDecks();
        loadCollectionForDeckBuilder();
    }
});

// Tab functionality
function initializeTabs() {
    console.log('Initializing tabs...');
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    console.log('Found tabs:', tabs.length);
    console.log('Found tab contents:', tabContents.length);
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            console.log('Tab clicked:', tab.id);
            switchTab(tab.id);
            
            // Load content based on tab
            if (tab.id === 'tab-my-decks') {
                loadMyDecks();
            } else if (tab.id === 'tab-community-decks') {
                loadCommunityDecks();
            }
        });
        
        // Mark tab as initialized
        tab.setAttribute('data-initialized', 'true');
    });
}

function switchTab(tabId) {
    console.log('Switching to tab:', tabId);
    
    // Update tab buttons
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        const isActive = tab.id === tabId;
        tab.classList.toggle('text-blue-600', isActive);
        tab.classList.toggle('border-blue-600', isActive);
        tab.classList.toggle('text-gray-500', !isActive);
        tab.classList.toggle('hover:text-gray-700', !isActive);
        tab.classList.toggle('hover:border-gray-300', !isActive);
    });
    
    // Update tab content
    const targetContentId = tabId.replace('tab-', 'content-');
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.toggle('hidden', content.id !== targetContentId);
    });
    
    // Show/hide filters
    const deckFilters = document.getElementById('deck-filters');
    if (deckFilters) {
        const showFilters = ['tab-my-decks', 'tab-community-decks'].includes(tabId);
        deckFilters.classList.toggle('hidden', !showFilters);
    }
    
    // Reset builder form if needed
    if (tabId === 'tab-builder' && !document.getElementById('editing-deck-id').value) {
        resetBuilderForm();
    }
}

// Form handlers
function initializeFormHandlers() {
    console.log('Initializing form handlers...');
    
    // TCG selection handler
    const tcgSelect = document.getElementById('deck-tcg-select');
    const formatContainer = document.getElementById('deck-format-select-container');
    const formatSelect = document.getElementById('deck-format-select');
    
    if (tcgSelect && formatContainer && formatSelect) {
        tcgSelect.addEventListener('change', function() {
            const selectedTcg = this.value;
            console.log('TCG selected:', selectedTcg);
            
            if (selectedTcg && TCG_CONFIG[selectedTcg]) {
                formatContainer.classList.remove('hidden');
                
                // Populate format options
                formatSelect.innerHTML = '<option value="" disabled selected>Select a Format</option>';
                TCG_CONFIG[selectedTcg].formats.forEach(format => {
                    const option = document.createElement('option');
                    option.value = format;
                    option.textContent = format;
                    formatSelect.appendChild(option);
                });
            } else {
                formatContainer.classList.add('hidden');
            }
        });
    }
    
    // Form submission
    const deckBuilderForm = document.getElementById('deck-builder-form');
    if (deckBuilderForm && typeof handleFormSubmission !== 'undefined') {
        deckBuilderForm.addEventListener('submit', handleFormSubmission);
    }
    
    // Import deck button
    const importBtn = document.getElementById('import-deck-btn');
    if (importBtn) {
        importBtn.addEventListener('click', function() {
            const modal = document.getElementById('import-deck-modal');
            if (modal) {
                openModal(modal);
            }
        });
    }
}

// Filter functionality
function initializeFilters() {
    console.log('Initializing filters...');
    
    const tcgFilterButtons = document.getElementById('tcg-filter-buttons');
    const formatFilterContainer = document.getElementById('format-filter-container');
    const formatFilterButtons = document.getElementById('format-filter-buttons');
    
    if (tcgFilterButtons) {
        tcgFilterButtons.addEventListener('click', function(e) {
            if (e.target.classList.contains('tcg-filter-btn')) {
                // Update active state
                tcgFilterButtons.querySelectorAll('.tcg-filter-btn').forEach(btn => {
                    btn.classList.remove('filter-btn-active');
                });
                e.target.classList.add('filter-btn-active');
                
                const selectedTcg = e.target.dataset.tcg;
                currentFilters.tcg = selectedTcg;
                currentFilters.format = 'all';
                
                // Show/hide format filter
                if (formatFilterContainer) {
                    if (selectedTcg === 'all') {
                        formatFilterContainer.classList.add('hidden');
                    } else {
                        formatFilterContainer.classList.remove('hidden');
                        populateFormatFilter(selectedTcg);
                    }
                }
                
                applyFilters();
            }
        });
    }
    
    if (formatFilterButtons) {
        formatFilterButtons.addEventListener('click', function(e) {
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
}

function populateFormatFilter(tcg) {
    const formatFilterButtons = document.getElementById('format-filter-buttons');
    if (!formatFilterButtons) return;
    
    formatFilterButtons.innerHTML = '';
    
    // Add "All" option
    const allBtn = document.createElement('button');
    allBtn.className = 'format-filter-btn filter-btn-active px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200';
    allBtn.dataset.format = 'all';
    allBtn.textContent = 'All';
    formatFilterButtons.appendChild(allBtn);
    
    // Add format options
    if (TCG_CONFIG[tcg]) {
        TCG_CONFIG[tcg].formats.forEach(format => {
            const btn = document.createElement('button');
            btn.className = 'format-filter-btn px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200';
            btn.dataset.format = format;
            btn.textContent = format;
            formatFilterButtons.appendChild(btn);
        });
    }
}

function applyFilters() {
    const currentTab = document.querySelector('.tab-button.text-blue-600');
    if (!currentTab) return;
    
    if (currentTab.id === 'tab-my-decks') {
        loadMyDecks();
    } else if (currentTab.id === 'tab-community-decks') {
        loadCommunityDecks();
    }
}

// Deck loading functions
function loadMyDecks() {
    console.log('Loading my decks...');
    const myDecksList = document.getElementById('my-decks-list');
    if (!myDecksList) return;
    
    if (!user) {
        myDecksList.innerHTML = '<div class="col-span-full text-center text-gray-500 dark:text-gray-400">Please log in to view your decks.</div>';
        return;
    }
    
    if (!db) {
        myDecksList.innerHTML = '<div class="col-span-full text-center text-gray-500 dark:text-gray-400">Database not available.</div>';
        return;
    }
    
    myDecksList.innerHTML = '<div class="col-span-full text-center text-gray-500 dark:text-gray-400">Loading your decks...</div>';
    
    // Load decks from Firebase
    db.collection('decks').where('authorId', '==', user.uid).get()
        .then(snapshot => {
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
        })
        .catch(error => {
            console.error('Error loading my decks:', error);
            myDecksList.innerHTML = '<div class="col-span-full text-center text-red-500">Error loading decks. Please try again.</div>';
        });
}

function loadCommunityDecks() {
    console.log('Loading community decks...');
    const communityDecksList = document.getElementById('community-decks-list');
    if (!communityDecksList) return;
    
    if (!db) {
        communityDecksList.innerHTML = '<div class="col-span-full text-center text-gray-500 dark:text-gray-400">Database not available.</div>';
        return;
    }
    
    communityDecksList.innerHTML = '<div class="col-span-full text-center text-gray-500 dark:text-gray-400">Loading community decks...</div>';
    
    // Load public decks from Firebase
    db.collection('decks').where('isPublic', '==', true).orderBy('createdAt', 'desc').limit(50).get()
        .then(snapshot => {
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
        })
        .catch(error => {
            console.error('Error loading community decks:', error);
            communityDecksList.innerHTML = '<div class="col-span-full text-center text-red-500">Error loading community decks. Please try again.</div>';
        });
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

function createDeckCard(deck, isOwner) {
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
    deckCard.querySelector('.view-deck-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        viewDeck(deck, deck.id);
    });
    
    if (isOwner) {
        const editBtn = deckCard.querySelector('.edit-deck-btn');
        const deleteBtn = deckCard.querySelector('.delete-deck-btn');
        
        if (editBtn) {
            editBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                editDeck(deck);
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                deleteDeck(deck.id);
            });
        }
    }
    
    return deckCard;
}

// Utility functions
// showToast function is already available globally from auth.js

function openModal(modal) {
    if (!modal) return;
    
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
}

function closeModal(modal) {
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
}

// Make closeModal globally available
window.closeModal = closeModal;

function resetBuilderForm() {
    const deckBuilderForm = document.getElementById('deck-builder-form');
    if (deckBuilderForm) {
        deckBuilderForm.reset();
    }
    
    const builderTitle = document.getElementById('builder-title');
    if (builderTitle) {
        builderTitle.textContent = 'Create New Deck';
    }
    
    const formatContainer = document.getElementById('deck-format-select-container');
    if (formatContainer) {
        formatContainer.classList.add('hidden');
    }
    
    const editingDeckId = document.getElementById('editing-deck-id');
    if (editingDeckId) {
        editingDeckId.value = '';
    }
    
    // Reset submit button text
    const submitBtn = document.getElementById('build-deck-btn');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-hammer mr-2"></i>Build Deck';
    }
}

// Deck form submission handler
async function handleFormSubmission(e) {
    e.preventDefault();
    
    // Check authentication
    if (!user) {
        showToast('Please log in to save decks.', 'error');
        return;
    }
    
    // Check database connection
    if (!db) {
        showToast('Database connection not available.', 'error');
        return;
    }
    
    // Get form values
    const deckName = document.getElementById('deck-name-input').value.trim();
    const tcg = document.getElementById('deck-tcg-select').value;
    const format = document.getElementById('deck-format-select').value;
    const bio = document.getElementById('deck-bio-input').value.trim();
    const decklistText = document.getElementById('decklist-input').value.trim();
    const primer = document.getElementById('deck-primer-input').value.trim();
    const isPublic = document.getElementById('deck-public-checkbox').checked;
    const editingDeckId = document.getElementById('editing-deck-id').value;
    
    // Validate required fields
    if (!deckName) {
        showToast('Please enter a deck name.', 'error');
        return;
    }
    
    if (!tcg) {
        showToast('Please select a TCG.', 'error');
        return;
    }
    
    if (!format) {
        showToast('Please select a format.', 'error');
        return;
    }
    
    if (!decklistText) {
        showToast('Please enter a decklist.', 'error');
        return;
    }
    
    // Parse decklist
    const cards = parseDeckList(decklistText);
    
    if (cards.length === 0) {
        showToast('Could not parse any cards from the decklist.', 'error');
        return;
    }
    
    // Disable submit button and show loading state
    const submitBtn = document.getElementById('build-deck-btn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
    
    try {
        // Get user data for author name
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        const authorName = userData?.username || user.displayName || user.email;
        
        // Prepare deck data
        const deckData = {
            name: deckName,
            tcg: tcg,
            format: format,
            bio: bio,
            primer: primer,
            cards: cards,
            isPublic: isPublic,
            authorId: user.uid,
            authorName: authorName,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Save or update deck
        if (editingDeckId) {
            // Update existing deck
            await db.collection('decks').doc(editingDeckId).update(deckData);
            showToast('Deck updated successfully!', 'success');
        } else {
            // Create new deck
            deckData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('decks').add(deckData);
            showToast('Deck created successfully!', 'success');
        }
        
        // Reset form and switch to My Decks tab
        resetBuilderForm();
        switchTab('tab-my-decks');
        loadMyDecks();
        
    } catch (error) {
        console.error('Error saving deck:', error);
        showToast('Error saving deck: ' + error.message, 'error');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// Parse decklist text into card objects
function parseDeckList(decklistText) {
    const cards = [];
    const lines = decklistText.split('\n');
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
            continue; // Skip empty lines and comments
        }
        
        // Match patterns like "4 Sol Ring" or "4x Sol Ring"
        const match = trimmedLine.match(/^(\d+)x?\s+(.+)$/i);
        if (match) {
            const quantity = parseInt(match[1]);
            const cardName = match[2].trim();
            
            cards.push({
                name: cardName,
                quantity: quantity,
                price: 0 // Will be populated later if needed
            });
        }
    }
    
    return cards;
}

function viewDeck(deck, deckId) {
    console.log('Viewing deck:', deck.name);
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.id = 'deck-view-modal';
    
    const cardCount = deck.cards ? deck.cards.reduce((sum, card) => sum + card.quantity, 0) : 0;
    const totalPrice = deck.cards ? deck.cards.reduce((sum, card) => sum + (parseFloat(card.prices?.usd || card.price || 0) * card.quantity), 0) : 0;
    
    // Build card list HTML
    let cardListHTML = '';
    if (deck.cards && deck.cards.length > 0) {
        cardListHTML = deck.cards.map(card => `
            <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <div>
                    <span class="font-medium">${card.quantity}x</span>
                    <span class="ml-2">${card.name}</span>
                </div>
                <span class="text-gray-600 dark:text-gray-400">$${(parseFloat(card.prices?.usd || card.price || 0) * card.quantity).toFixed(2)}</span>
            </div>
        `).join('');
    } else {
        cardListHTML = '<p class="text-gray-500 dark:text-gray-400">No cards in this deck.</p>';
    }
    
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex justify-between items-start">
                <div>
                    <h2 class="text-3xl font-bold text-gray-800 dark:text-white mb-2">${deck.name}</h2>
                    <p class="text-gray-600 dark:text-gray-400">by ${deck.authorName || 'Anonymous'}</p>
                    <div class="flex gap-2 mt-2">
                        <span class="text-sm px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">${deck.tcg || 'Unknown'}</span>
                        <span class="text-sm px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">${deck.format || 'N/A'}</span>
                    </div>
                </div>
                <button class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-3xl" onclick="this.closest('#deck-view-modal').remove()">
                    &times;
                </button>
            </div>
            
            <div class="p-6">
                ${deck.bio ? `
                    <div class="mb-6">
                        <h3 class="text-xl font-bold mb-2 text-gray-800 dark:text-white">Description</h3>
                        <p class="text-gray-700 dark:text-gray-300">${deck.bio}</p>
                    </div>
                ` : ''}
                
                <div class="mb-6">
                    <h3 class="text-xl font-bold mb-2 text-gray-800 dark:text-white">Deck Stats</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded">
                            <p class="text-sm text-gray-600 dark:text-gray-400">Total Cards</p>
                            <p class="text-2xl font-bold text-gray-800 dark:text-white">${cardCount}</p>
                        </div>
                        <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded">
                            <p class="text-sm text-gray-600 dark:text-gray-400">Total Value</p>
                            <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">$${totalPrice.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
                
                <div class="mb-6">
                    <h3 class="text-xl font-bold mb-2 text-gray-800 dark:text-white">Card List</h3>
                    <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded max-h-96 overflow-y-auto">
                        ${cardListHTML}
                    </div>
                </div>
                
                ${deck.primer ? `
                    <div class="mb-6">
                        <h3 class="text-xl font-bold mb-2 text-gray-800 dark:text-white">Deck Primer</h3>
                        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded whitespace-pre-wrap">
                            ${deck.primer}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Close on background click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
}

function editDeck(deck) {
    console.log('Editing deck:', deck.name);
    
    // Switch to builder tab
    switchTab('tab-builder');
    
    // Populate form with deck data
    document.getElementById('deck-name-input').value = deck.name || '';
    document.getElementById('deck-tcg-select').value = deck.tcg || '';
    
    // Trigger TCG change to show format selector
    const tcgSelect = document.getElementById('deck-tcg-select');
    const event = new Event('change');
    tcgSelect.dispatchEvent(event);
    
    // Set format after a short delay to ensure format selector is populated
    setTimeout(() => {
        document.getElementById('deck-format-select').value = deck.format || '';
    }, 100);
    
    document.getElementById('deck-bio-input').value = deck.bio || '';
    document.getElementById('deck-primer-input').value = deck.primer || '';
    document.getElementById('deck-public-checkbox').checked = deck.isPublic || false;
    
    // Convert cards array back to decklist text
    if (deck.cards && deck.cards.length > 0) {
        const decklistText = deck.cards.map(card => `${card.quantity} ${card.name}`).join('\n');
        document.getElementById('decklist-input').value = decklistText;
    }
    
    // Set editing deck ID
    document.getElementById('editing-deck-id').value = deck.id;
    
    // Update button text
    const submitBtn = document.getElementById('build-deck-btn');
    submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Update Deck';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    showToast('Editing deck: ' + deck.name, 'info');
}

async function deleteDeck(deckId) {
    console.log('Deleting deck:', deckId);
    
    // Check authentication
    if (!user) {
        showToast('Please log in to delete decks.', 'error');
        return;
    }
    
    // Check database connection
    if (!db) {
        showToast('Database connection not available.', 'error');
        return;
    }
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this deck? This action cannot be undone.')) {
        return;
    }
    
    try {
        await db.collection('decks').doc(deckId).delete();
        showToast('Deck deleted successfully!', 'success');
        
        // Reload the decks list
        loadMyDecks();
    } catch (error) {
        console.error('Error deleting deck:', error);
        showToast('Error deleting deck: ' + error.message, 'error');
    }
}

function loadCollectionForDeckBuilder() {
    console.log('Loading collection for deck builder...');
    const collectionContainer = document.getElementById('deck-builder-collection-list');
    if (collectionContainer) {
        collectionContainer.innerHTML = '<p class="text-sm text-gray-500 p-2">Collection loading requires authentication.</p>';
    }
}

console.log('Deck builder script loaded successfully!');
