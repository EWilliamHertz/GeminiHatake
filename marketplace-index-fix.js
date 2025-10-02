// MARKETPLACE INDEX FIX
// This script will bypass the index issue and load marketplace listings directly

console.log('🔧 MARKETPLACE INDEX FIX');
console.log('========================');

async function fixMarketplaceLoading() {
    console.log('🔍 Checking marketplace data...');
    
    const db = firebase.firestore();
    
    try {
        // First, check if data exists without orderBy
        console.log('📊 Checking raw data...');
        const rawSnapshot = await db.collection('marketplaceListings').get();
        console.log(`Found ${rawSnapshot.size} documents in marketplaceListings`);
        
        if (rawSnapshot.size === 0) {
            console.error('❌ No documents found in marketplaceListings collection');
            return false;
        }
        
        // Show what we found
        console.log('📋 Documents found:');
        rawSnapshot.forEach((doc, index) => {
            const data = doc.data();
            console.log(`  ${index + 1}. ${data.cardData?.name || 'Unknown'} - $${data.price || 0}`);
        });
        
        // Now try to load them into the marketplace manager
        if (window.marketplaceManager) {
            console.log('🔄 Loading data into marketplace manager...');
            
            // Convert documents to the format expected by marketplace manager
            const listings = [];
            rawSnapshot.forEach(doc => {
                const data = doc.data();
                const listing = {
                    id: doc.id,
                    ...data,
                    // Ensure proper data structure
                    cardData: data.cardData || data,
                    sellerData: data.sellerData || { displayName: 'Unknown Seller' },
                    price: data.price || 0,
                    listedAt: data.listedAt?.toDate() || new Date()
                };
                listings.push(listing);
            });
            
            // Sort by date manually (newest first)
            listings.sort((a, b) => b.listedAt - a.listedAt);
            
            // Update marketplace manager
            window.marketplaceManager.allListings = listings;
            window.marketplaceManager.filteredListings = [...listings];
            
            // Update the display
            if (typeof window.marketplaceManager.updateDisplay === 'function') {
                window.marketplaceManager.updateDisplay();
                console.log('✅ Marketplace display updated');
            } else if (typeof window.marketplaceManager.applyFilters === 'function') {
                window.marketplaceManager.applyFilters();
                console.log('✅ Marketplace filters applied');
            }
            
            // Update stats if available
            if (typeof window.marketplaceManager.updateStats === 'function') {
                window.marketplaceManager.updateStats();
            }
            
            console.log(`🎉 Successfully loaded ${listings.length} marketplace listings!`);
            return true;
            
        } else {
            console.error('❌ MarketplaceManager not found');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error fixing marketplace:', error);
        return false;
    }
}

// Alternative method: Override the loadMarketplaceData function
function overrideMarketplaceLoader() {
    console.log('🔧 Overriding marketplace loader...');
    
    if (!window.marketplaceManager) {
        console.error('❌ MarketplaceManager not found');
        return false;
    }
    
    // Store original function
    const originalLoad = window.marketplaceManager.loadMarketplaceData;
    
    // Override with our fixed version
    window.marketplaceManager.loadMarketplaceData = async function() {
        console.log('🔄 Using fixed marketplace loader...');
        
        const loadingIndicator = document.getElementById('loading-indicator');
        const marketplaceDisplay = document.getElementById('marketplace-display');
        
        if (loadingIndicator) {
            loadingIndicator.classList.remove('hidden');
        }
        
        if (marketplaceDisplay) {
            marketplaceDisplay.classList.add('hidden');
        }
        
        try {
            // Use simple query without orderBy
            const snapshot = await firebase.firestore().collection('marketplaceListings').get();
            
            this.allListings = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                const listing = {
                    id: doc.id,
                    ...data,
                    cardData: data.cardData || data,
                    sellerData: data.sellerData || { displayName: 'Unknown Seller' },
                    price: data.price || 0,
                    listedAt: data.listedAt?.toDate() || new Date()
                };
                this.allListings.push(listing);
            });
            
            // Sort manually
            this.allListings.sort((a, b) => b.listedAt - a.listedAt);
            this.filteredListings = [...this.allListings];
            
            console.log(`✅ Loaded ${this.allListings.length} listings with fixed loader`);
            
            // Update display
            this.updateStats();
            this.applyFilters();
            
        } catch (error) {
            console.error('❌ Error in fixed loader:', error);
        } finally {
            if (loadingIndicator) {
                loadingIndicator.classList.add('hidden');
            }
            
            if (marketplaceDisplay) {
                marketplaceDisplay.classList.remove('hidden');
            }
        }
    };
    
    console.log('✅ Marketplace loader overridden');
    return true;
}

// Check current marketplace state
function checkMarketplaceState() {
    console.log('📊 CURRENT MARKETPLACE STATE:');
    
    if (window.marketplaceManager) {
        const allCount = window.marketplaceManager.allListings?.length || 0;
        const filteredCount = window.marketplaceManager.filteredListings?.length || 0;
        
        console.log(`  All listings: ${allCount}`);
        console.log(`  Filtered listings: ${filteredCount}`);
        
        if (allCount > 0) {
            console.log('  Sample listings:');
            window.marketplaceManager.allListings.slice(0, 3).forEach((listing, index) => {
                console.log(`    ${index + 1}. ${listing.cardData?.name} - $${listing.price}`);
            });
        }
    } else {
        console.log('  MarketplaceManager not found');
    }
    
    // Check DOM
    const grid = document.getElementById('marketplace-grid');
    if (grid) {
        const cards = grid.querySelectorAll('.card-container, .marketplace-card');
        console.log(`  Cards in DOM: ${cards.length}`);
    }
}

// Main fix function
async function runMarketplaceFix() {
    console.log('🚀 Running marketplace fix...');
    
    // Check current state
    checkMarketplaceState();
    
    // Try direct fix first
    const directFixSuccess = await fixMarketplaceLoading();
    
    if (directFixSuccess) {
        console.log('✅ Direct fix successful!');
        checkMarketplaceState();
        return true;
    }
    
    // Try override method
    console.log('🔄 Trying override method...');
    const overrideSuccess = overrideMarketplaceLoader();
    
    if (overrideSuccess && window.marketplaceManager) {
        await window.marketplaceManager.loadMarketplaceData();
        checkMarketplaceState();
        return true;
    }
    
    console.error('❌ All fix attempts failed');
    return false;
}

// Export functions
window.marketplaceIndexFix = {
    run: runMarketplaceFix,
    fix: fixMarketplaceLoading,
    override: overrideMarketplaceLoader,
    check: checkMarketplaceState
};

console.log('🛠️ Marketplace index fix loaded!');
console.log('📝 Available functions:');
console.log('  - marketplaceIndexFix.run() - Run complete fix');
console.log('  - marketplaceIndexFix.fix() - Direct data loading fix');
console.log('  - marketplaceIndexFix.override() - Override loader function');
console.log('  - marketplaceIndexFix.check() - Check current state');
console.log('');
console.log('💡 To fix marketplace loading, run: marketplaceIndexFix.run()');
