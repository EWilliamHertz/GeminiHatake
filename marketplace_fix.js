/**
 * COMPREHENSIVE MARKETPLACE FIX
 * 
 * This file contains the fixes for the critical marketplace functionality issues:
 * 1. Cards marked for sale in collections not appearing in marketplace
 * 2. Bulk marketplace operations not working
 * 3. Individual marketplace actions not functioning
 * 4. Currency handling issues in marketplace listings
 */

// ===== FIX 1: API.JS - Fix batchCreateMarketplaceListings function =====

// PROBLEM: The function signature doesn't match what's being called
// CURRENT: export async function batchCreateMarketplaceListings(listings)
// EXPECTED: Should handle the listing objects properly

const fixedBatchCreateMarketplaceListings = `
export async function batchCreateMarketplaceListings(listings) {
    if (!listings || listings.length === 0) {
        console.log('[API] No listings to create');
        return;
    }

    console.log('[API] Creating', listings.length, 'marketplace listings');
    const batch = db.batch();
    const marketplaceRef = db.collection('marketplaceListings');
    
    listings.forEach(listing => {
        const docRef = marketplaceRef.doc(); // Auto-generate ID
        console.log('[API] Adding listing to batch:', listing.cardData?.name);
        batch.set(docRef, {
            ...listing,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
    
    await batch.commit();
    console.log('[API] Successfully created', listings.length, 'marketplace listings');
}`;

// ===== FIX 2: COLLECTION.JS - Fix batchCreateMarketplaceListings function =====

const fixedCollectionBatchCreateMarketplaceListings = `
export async function batchCreateMarketplaceListings(updates) {
    if (!state.currentUser) throw new Error("User not logged in.");
    
    console.log('[Collection] Creating marketplace listings for', updates.length, 'cards');
    const userProfile = await API.getUserProfile(state.currentUser.uid);
    const listings = [];
    
    for (const update of updates) {
        const card = state.fullCollection.find(c => c.id === update.id);
        if (card && update.data.for_sale) {
            console.log('[Collection] Processing card for marketplace:', card.name);
            
            const listing = {
                // Card information
                cardData: {
                    name: card.name || '',
                    game: card.game || 'mtg',
                    set: card.set || '',
                    set_name: card.set_name || '',
                    condition: card.condition || 'near_mint',
                    collector_number: card.collector_number || '',
                    rarity: card.rarity || '',
                    type_line: card.type_line || '',
                    mana_cost: card.mana_cost || null,
                    cmc: card.cmc || 0,
                    color_identity: card.color_identity || [],
                    image_uris: card.image_uris || {},
                    prices: card.prices || {},
                    language: card.language || 'en',
                    foil: card.is_foil || card.isFoil || false,
                    isGraded: card.is_graded || card.isGraded || false,
                    gradingCompany: card.grading_company || null,
                    grade: card.grade || null,
                    api_id: card.api_id || ''
                },
                // Seller information
                sellerData: {
                    uid: state.currentUser.uid,
                    displayName: userProfile?.displayName || 'Unknown Seller',
                    photoURL: userProfile?.photoURL || null,
                    country: userProfile?.country || 'Unknown'
                },
                // Listing details
                sellerId: state.currentUser.uid,
                price: update.data.sale_price,
                currency: update.data.sale_currency || 'USD',
                quantity: card.quantity || 1,
                listedAt: firebase.firestore.FieldValue.serverTimestamp(),
                originalCollectionCardId: card.id,
                // Additional fields for marketplace functionality
                status: 'active',
                views: 0,
                watchers: []
            };
            listings.push(listing);
        }
    }
    
    if (listings.length > 0) {
        console.log('[Collection] Sending', listings.length, 'listings to API');
        await API.batchCreateMarketplaceListings(listings);
        console.log('[Collection] Successfully created marketplace listings');
    } else {
        console.log('[Collection] No valid listings to create');
    }
}`;

// ===== FIX 3: MARKETPLACE.JS - Fix marketplace loading query =====

const fixedMarketplaceLoadData = `
async loadMarketplaceData() {
    console.log('Loading marketplace data...');
    const loadingIndicator = document.getElementById('loading-indicator');
    const marketplaceDisplay = document.getElementById('marketplace-display');

    if (loadingIndicator) {
        loadingIndicator.classList.remove('hidden');
    }

    // Ensure currency is loaded before proceeding
    if (!convertAndFormat) {
        console.log('Waiting for currency module to load...');
        await new Promise(resolve => {
            const checkCurrency = () => {
                if (convertAndFormat) {
                    resolve();
                } else {
                    setTimeout(checkCurrency, 100);
                }
            };
            checkCurrency();
        });
    }

    if (marketplaceDisplay) {
        marketplaceDisplay.classList.add('hidden');
    }

    try {
        console.log('Querying marketplaceListings collection...');

        // FIXED: Simple query without orderBy to avoid index issues
        const snapshot = await this.db.collection('marketplaceListings')
            .where('status', '==', 'active') // Only get active listings
            .get();

        this.allListings = [];

        console.log(\`Found \${snapshot.size} documents in marketplaceListings\`);

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log('Processing listing:', doc.id, data);

            // FIXED: Ensure proper data structure with all required fields
            const listing = {
                id: doc.id,
                ...data,
                // Ensure proper data structure
                cardData: data.cardData || data,
                sellerData: data.sellerData || { displayName: 'Unknown Seller' },
                price: data.price || 0,
                currency: data.currency || 'USD',
                listedAt: data.listedAt?.toDate() || new Date(),
                sellerId: data.sellerId || data.sellerData?.uid
            };
            this.allListings.push(listing);
        });

        // Manual sorting by listedAt descending (newest first)
        this.allListings.sort((a, b) => {
            const dateA = a.listedAt || new Date(0);
            const dateB = b.listedAt || new Date(0);
            return dateB - dateA;
        });

        this.filteredListings = [...this.allListings];
        console.log(\`Loaded \${this.allListings.length} marketplace listings\`);

        // Clean up orphaned listings
        await this.cleanupOrphanedListings();
        
        // Populate dynamic filters
        this.populateCountryFilter();
        this.populateRarityFilter();
        this.populateConditionFilter();
        
        this.updateStats();
        this.applyFilters();

    } catch (error) {
        console.error('Error loading marketplace data:', error);
        this.showToast('Failed to load marketplace listings: ' + error.message, 'error');

        // Show error in the UI
        const grid = document.getElementById('marketplace-grid');
        if (grid) {
            grid.innerHTML = \`
                <div class="col-span-full flex flex-col items-center justify-center py-12 text-red-500">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <h3 class="text-xl font-semibold mb-2">Error Loading Marketplace</h3>
                    <p class="text-center">\${error.message}</p>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Retry
                    </button>
                </div>
            \`;
        }
    } finally {
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }

        if (marketplaceDisplay) {
            marketplaceDisplay.classList.remove('hidden');
        }
    }
}`;

// ===== FIX 4: Individual marketplace actions in collection-app.js =====

const fixedIndividualMarketplaceActions = `
// Add this to the card action handlers in collection-app.js

async function handleIndividualListForSale(cardId) {
    const card = Collection.getCardById(cardId);
    if (!card) {
        UI.showToast("Card not found", "error");
        return;
    }

    // Open individual sale modal
    const modal = document.getElementById('individual-sale-modal');
    if (!modal) {
        // Create the modal if it doesn't exist
        createIndividualSaleModal();
    }

    // Populate modal with card data
    document.getElementById('individual-sale-card-name').textContent = card.name;
    document.getElementById('individual-sale-card-image').src = getCardImageUrl(card);
    
    // Set market price as default
    const marketPrice = Currency.getNormalizedPriceUSD(card.prices) || 0;
    document.getElementById('individual-sale-price').value = marketPrice.toFixed(2);
    
    // Store card ID for later use
    modal.dataset.cardId = cardId;
    
    UI.openModal(modal);
}

async function handleIndividualRemoveFromSale(cardId) {
    const confirmed = confirm("Remove this card from marketplace?");
    if (!confirmed) return;

    try {
        await Collection.removeCardFromSale(cardId);
        UI.showToast("Card removed from marketplace", "success");
        applyAndRender({});
    } catch (error) {
        UI.showToast(\`Error: \${error.message}\`, "error");
    }
}

async function finalizeIndividualSale() {
    const modal = document.getElementById('individual-sale-modal');
    const cardId = modal.dataset.cardId;
    const price = parseFloat(document.getElementById('individual-sale-price').value);
    const currency = document.getElementById('individual-sale-currency').value || 'USD';

    if (!cardId || isNaN(price) || price <= 0) {
        UI.showToast("Please enter a valid price", "error");
        return;
    }

    const finalizeBtn = document.getElementById('finalize-individual-sale-btn');
    UI.setButtonLoading(finalizeBtn, true);

    try {
        // Update card sale status
        await Collection.batchUpdateSaleStatus([{
            id: cardId,
            data: { 
                for_sale: true, 
                sale_price: price,
                sale_currency: currency
            }
        }]);

        // Create marketplace listing
        await Collection.batchCreateMarketplaceListings([{
            id: cardId,
            data: { 
                for_sale: true, 
                sale_price: price,
                sale_currency: currency
            }
        }]);

        UI.showToast("Card listed for sale!", "success");
        UI.closeModal(modal);
        applyAndRender({});
    } catch (error) {
        UI.showToast(\`Error: \${error.message}\`, "error");
    } finally {
        UI.setButtonLoading(finalizeBtn, false, "List for Sale");
    }
}

function createIndividualSaleModal() {
    const modalHtml = \`
        <div id="individual-sale-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
            <div class="flex items-center justify-center min-h-screen p-4">
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold">List Card for Sale</h3>
                        <button data-modal-close="individual-sale-modal" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="mb-4">
                        <img id="individual-sale-card-image" src="" alt="Card" class="w-32 h-auto mx-auto rounded">
                        <h4 id="individual-sale-card-name" class="text-center mt-2 font-medium"></h4>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Sale Price</label>
                            <input type="number" id="individual-sale-price" step="0.01" min="0" 
                                   class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-1">Currency</label>
                            <select id="individual-sale-currency" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                                <option value="USD">USD</option>
                                <option value="SEK">SEK</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                                <option value="NOK">NOK</option>
                                <option value="DKK">DKK</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex space-x-3 mt-6">
                        <button data-modal-close="individual-sale-modal" 
                                class="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                            Cancel
                        </button>
                        <button id="finalize-individual-sale-btn" onclick="finalizeIndividualSale()"
                                class="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                            List for Sale
                        </button>
                    </div>
                </div>
            </div>
        </div>
    \`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}`;

console.log("=== MARKETPLACE FIX SUMMARY ===");
console.log("1. Fixed API batchCreateMarketplaceListings function");
console.log("2. Fixed Collection batchCreateMarketplaceListings function");
console.log("3. Fixed marketplace loading query");
console.log("4. Added individual marketplace action handlers");
console.log("5. Fixed currency handling in marketplace listings");
console.log("6. Added proper error handling and logging");
console.log("================================");
