// FIX MARKETPLACE QUERY TO WORK WITH EXISTING INDEXES
// This will modify the marketplace.js to use a query that works with your indexes

console.log('🔧 FIXING MARKETPLACE QUERY FOR EXISTING INDEXES');
console.log('================================================');

function fixMarketplaceQuery() {
    console.log('🔍 Checking current marketplace manager...');
    
    if (!window.marketplaceManager) {
        console.error('❌ MarketplaceManager not found');
        return false;
    }
    
    console.log('✅ MarketplaceManager found');
    
    // Store the original loadMarketplaceData function
    const originalLoadFunction = window.marketplaceManager.loadMarketplaceData;
    
    // Create a new version that works with your indexes
    window.marketplaceManager.loadMarketplaceData = async function() {
        console.log('🔄 Loading marketplace data with fixed query...');
        
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
            console.log('Querying marketplaceListings collection with compatible query...');

            // FIXED QUERY: Use simple query without orderBy to avoid index issues
            // We'll sort manually after getting the data
            const snapshot = await this.db.collection('marketplaceListings').get();

            this.allListings = [];

            console.log(`Found ${snapshot.size} documents in marketplaceListings`);

            snapshot.forEach(doc => {
                const data = doc.data();
                console.log('Processing listing:', doc.id, data);

                const listing = {
                    id: doc.id,
                    ...data,
                    // Ensure proper data structure
                    cardData: data.cardData || data,
                    sellerData: data.sellerData || { displayName: 'Unknown Seller' },
                    price: data.price || 0,
                    listedAt: data.listedAt?.toDate() || new Date()
                };
                this.allListings.push(listing);
            });

            // MANUAL SORTING: Sort by listedAt descending (newest first)
            this.allListings.sort((a, b) => {
                const dateA = a.listedAt || new Date(0);
                const dateB = b.listedAt || new Date(0);
                return dateB - dateA;
            });

            this.filteredListings = [...this.allListings];
            console.log(`Loaded ${this.allListings.length} marketplace listings`);

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
                grid.innerHTML = `
                    <div class="col-span-full flex flex-col items-center justify-center py-12 text-red-500">
                        <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                        <h3 class="text-xl font-semibold mb-2">Error Loading Marketplace</h3>
                        <p class="text-center">${error.message}</p>
                        <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            Retry
                        </button>
                    </div>
                `;
            }
        } finally {
            if (loadingIndicator) {
                loadingIndicator.classList.add('hidden');
            }

            if (marketplaceDisplay) {
                marketplaceDisplay.classList.remove('hidden');
            }
        }
    };
    
    console.log('✅ Marketplace query fixed to work without problematic orderBy');
    console.log('💡 The marketplace will now use simple queries and sort manually');
    
    return true;
}

// Function to permanently fix the marketplace.js file
function createPermanentFix() {
    console.log('📝 CREATING PERMANENT FIX INSTRUCTIONS...');
    console.log('');
    console.log('To permanently fix this in your marketplace.js file:');
    console.log('');
    console.log('1. Open public/js/marketplace.js');
    console.log('2. Find this line (around line 296):');
    console.log('   const snapshot = await this.db.collection(\'marketplaceListings\')');
    console.log('       .orderBy(\'listedAt\', \'desc\')');
    console.log('       .get();');
    console.log('');
    console.log('3. Replace it with:');
    console.log('   const snapshot = await this.db.collection(\'marketplaceListings\').get();');
    console.log('');
    console.log('4. Add manual sorting after the forEach loop (around line 320):');
    console.log('   // Manual sorting by listedAt descending');
    console.log('   this.allListings.sort((a, b) => {');
    console.log('       const dateA = a.listedAt || new Date(0);');
    console.log('       const dateB = b.listedAt || new Date(0);');
    console.log('       return dateB - dateA;');
    console.log('   });');
    console.log('');
    console.log('This removes the need for the Firestore index and will work with any data.');
}

// Test the fix
async function testMarketplaceFix() {
    console.log('🧪 TESTING MARKETPLACE FIX...');
    
    if (!window.marketplaceManager) {
        console.error('❌ MarketplaceManager not available for testing');
        return false;
    }
    
    try {
        // Apply the fix
        fixMarketplaceQuery();
        
        // Test loading
        await window.marketplaceManager.loadMarketplaceData();
        
        const loadedCount = window.marketplaceManager.allListings?.length || 0;
        console.log(`✅ Test successful: Loaded ${loadedCount} listings`);
        
        if (loadedCount > 0) {
            console.log('📋 Sample listings:');
            window.marketplaceManager.allListings.slice(0, 3).forEach((listing, index) => {
                console.log(`  ${index + 1}. ${listing.cardData?.name} - $${listing.price}`);
            });
        }
        
        return loadedCount > 0;
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

// Main function
async function runMarketplaceFix() {
    console.log('🚀 RUNNING MARKETPLACE FIX...');
    
    // Apply the fix
    const fixApplied = fixMarketplaceQuery();
    
    if (!fixApplied) {
        console.error('❌ Could not apply fix');
        return false;
    }
    
    // Test it
    const testPassed = await testMarketplaceFix();
    
    if (testPassed) {
        console.log('🎉 MARKETPLACE FIX SUCCESSFUL!');
        console.log('✅ Your marketplace should now show all listings');
        console.log('💡 Refresh the page to see the results');
    } else {
        console.log('❌ Fix applied but test failed');
        console.log('💡 Try refreshing the page manually');
    }
    
    // Show permanent fix instructions
    createPermanentFix();
    
    return testPassed;
}

// Export functions
window.marketplaceQueryFix = {
    run: runMarketplaceFix,
    fix: fixMarketplaceQuery,
    test: testMarketplaceFix,
    instructions: createPermanentFix
};

console.log('🛠️ Marketplace query fix loaded!');
console.log('📝 Available functions:');
console.log('  - marketplaceQueryFix.run() - Apply fix and test');
console.log('  - marketplaceQueryFix.fix() - Apply fix only');
console.log('  - marketplaceQueryFix.test() - Test current state');
console.log('  - marketplaceQueryFix.instructions() - Show permanent fix steps');
console.log('');
console.log('💡 To fix the marketplace query issue, run: marketplaceQueryFix.run()');
