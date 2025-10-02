// MARKETPLACE VISIBILITY DEBUG SCRIPT
// This script will help identify why marketplace listings disappear after refresh

console.log('🔍 MARKETPLACE VISIBILITY DIAGNOSTIC');
console.log('===================================');

async function debugMarketplaceVisibility() {
    const db = firebase.firestore();
    
    console.log('1️⃣ CHECKING RAW FIRESTORE DATA...');
    
    try {
        // Get all marketplace listings directly from Firestore
        const snapshot = await db.collection('marketplaceListings').get();
        console.log(`📊 Total documents in Firestore: ${snapshot.size}`);
        
        if (snapshot.size === 0) {
            console.error('❌ No documents found in marketplaceListings collection');
            return;
        }
        
        // Analyze each document
        console.log('\n📋 ANALYZING EACH DOCUMENT:');
        snapshot.forEach((doc, index) => {
            const data = doc.data();
            console.log(`\n📄 Document ${index + 1} (${doc.id}):`);
            console.log('  ✅ Exists in Firestore');
            
            // Check required fields
            const requiredFields = {
                'sellerId': data.sellerId,
                'sellerData.uid': data.sellerData?.uid,
                'cardData.name': data.cardData?.name,
                'price': data.price,
                'listedAt': data.listedAt
            };
            
            Object.entries(requiredFields).forEach(([field, value]) => {
                if (value !== undefined && value !== null) {
                    console.log(`  ✅ ${field}: ${value}`);
                } else {
                    console.log(`  ❌ ${field}: MISSING`);
                }
            });
            
            // Check data structure
            if (!data.cardData) {
                console.log('  ❌ cardData object is missing');
            }
            if (!data.sellerData) {
                console.log('  ❌ sellerData object is missing');
            }
        });
        
    } catch (error) {
        console.error('❌ Error reading from Firestore:', error);
        return;
    }
    
    console.log('\n2️⃣ CHECKING MARKETPLACE MANAGER LOADING...');
    
    // Check if MarketplaceManager is loading the data
    if (window.marketplaceManager) {
        console.log('✅ MarketplaceManager found');
        
        // Check loaded data
        const allListings = window.marketplaceManager.allListings || [];
        const filteredListings = window.marketplaceManager.filteredListings || [];
        
        console.log(`📊 Loaded in manager - All: ${allListings.length}, Filtered: ${filteredListings.length}`);
        
        if (allListings.length === 0) {
            console.error('❌ MarketplaceManager has no listings loaded');
            console.log('💡 This suggests an issue with the loadMarketplaceData function');
        } else {
            console.log('✅ MarketplaceManager has loaded listings');
            
            // Check if filtering is removing items
            if (filteredListings.length < allListings.length) {
                console.warn(`⚠️ Filtering removed ${allListings.length - filteredListings.length} listings`);
                console.log('💡 Check active filters that might be hiding listings');
            }
        }
        
        // Try to reload marketplace data
        console.log('\n🔄 ATTEMPTING TO RELOAD MARKETPLACE DATA...');
        try {
            await window.marketplaceManager.loadMarketplaceData();
            console.log('✅ Reload completed');
            
            const newAllListings = window.marketplaceManager.allListings || [];
            const newFilteredListings = window.marketplaceManager.filteredListings || [];
            console.log(`📊 After reload - All: ${newAllListings.length}, Filtered: ${newFilteredListings.length}`);
            
        } catch (error) {
            console.error('❌ Error reloading marketplace data:', error);
        }
        
    } else {
        console.error('❌ MarketplaceManager not found');
    }
    
    console.log('\n3️⃣ CHECKING ACTIVE FILTERS...');
    
    // Check for active filters that might hide listings
    const filterElements = {
        'main-search-bar': 'Search query',
        'filter-name': 'Name filter',
        'condition-filter': 'Condition filter',
        'min-price': 'Minimum price',
        'max-price': 'Maximum price',
        'rarity-filter': 'Rarity filter',
        'location-filter': 'Location filter',
        'set-filter': 'Set filter'
    };
    
    let hasActiveFilters = false;
    Object.entries(filterElements).forEach(([id, description]) => {
        const element = document.getElementById(id);
        if (element && element.value && element.value.trim() !== '') {
            console.log(`⚠️ Active filter - ${description}: "${element.value}"`);
            hasActiveFilters = true;
        }
    });
    
    // Check game filters
    const gameCheckboxes = document.querySelectorAll('#game-filter-container input[type="checkbox"]:checked');
    if (gameCheckboxes.length > 0) {
        const checkedGames = Array.from(gameCheckboxes).map(cb => cb.getAttribute('data-game'));
        console.log(`⚠️ Active game filters: ${checkedGames.join(', ')}`);
        hasActiveFilters = true;
    }
    
    // Check continent filters
    const continentCheckboxes = document.querySelectorAll('[id^="continent-"]:checked');
    if (continentCheckboxes.length > 0) {
        const checkedContinents = Array.from(continentCheckboxes).map(cb => cb.value);
        console.log(`⚠️ Active continent filters: ${checkedContinents.join(', ')}`);
        hasActiveFilters = true;
    }
    
    if (!hasActiveFilters) {
        console.log('✅ No active filters detected');
    } else {
        console.log('💡 Try clearing all filters to see if listings appear');
    }
    
    console.log('\n4️⃣ CHECKING DOM RENDERING...');
    
    const marketplaceGrid = document.getElementById('marketplace-grid');
    if (marketplaceGrid) {
        const cardElements = marketplaceGrid.querySelectorAll('.card-container, .marketplace-card');
        console.log(`📊 Rendered cards in DOM: ${cardElements.length}`);
        
        if (cardElements.length === 0) {
            console.log('❌ No cards rendered in DOM');
            console.log('💡 Check if updateDisplay() function is being called');
        } else {
            console.log('✅ Cards are rendered in DOM');
        }
    } else {
        console.error('❌ marketplace-grid element not found');
    }
}

async function testMarketplaceQuery() {
    console.log('\n🧪 TESTING MARKETPLACE QUERY DIRECTLY...');
    
    const db = firebase.firestore();
    
    try {
        // Test the exact query used by MarketplaceManager
        const snapshot = await db.collection('marketplaceListings')
            .orderBy('listedAt', 'desc')
            .get();
        
        console.log(`📊 Query result: ${snapshot.size} documents`);
        
        if (snapshot.size > 0) {
            console.log('✅ Query successful, documents found');
            
            // Show first document structure
            const firstDoc = snapshot.docs[0];
            const data = firstDoc.data();
            console.log('\n📄 First document structure:');
            console.log('  ID:', firstDoc.id);
            console.log('  Card name:', data.cardData?.name);
            console.log('  Seller:', data.sellerData?.displayName);
            console.log('  Price:', data.price);
            console.log('  Listed at:', data.listedAt?.toDate());
            
        } else {
            console.error('❌ Query returned no results');
        }
        
    } catch (error) {
        console.error('❌ Query failed:', error);
        
        if (error.code === 'failed-precondition') {
            console.error('🚫 Index missing - you need to create a composite index for marketplaceListings');
            console.log('💡 Go to Firestore Console > Indexes and create index for:');
            console.log('   Collection: marketplaceListings');
            console.log('   Fields: listedAt (Descending)');
        }
    }
}

function clearAllFilters() {
    console.log('\n🧹 CLEARING ALL FILTERS...');
    
    // Clear text inputs
    const textInputs = ['main-search-bar', 'filter-name', 'min-price', 'max-price', 'set-filter'];
    textInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
            console.log(`✅ Cleared ${id}`);
        }
    });
    
    // Clear select dropdowns
    const selects = ['condition-filter', 'rarity-filter', 'location-filter', 'sort-filter'];
    selects.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
            console.log(`✅ Cleared ${id}`);
        }
    });
    
    // Uncheck all checkboxes
    const checkboxes = document.querySelectorAll('#game-filter-container input[type="checkbox"], [id^="continent-"]');
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            checkbox.checked = false;
            console.log(`✅ Unchecked ${checkbox.id || checkbox.getAttribute('data-game')}`);
        }
    });
    
    // Trigger filter update if MarketplaceManager exists
    if (window.marketplaceManager && typeof window.marketplaceManager.applyFilters === 'function') {
        console.log('🔄 Applying filters...');
        window.marketplaceManager.applyFilters();
    }
    
    console.log('✅ All filters cleared');
}

// Export functions
window.marketplaceVisibilityDebug = {
    debug: debugMarketplaceVisibility,
    testQuery: testMarketplaceQuery,
    clearFilters: clearAllFilters
};

console.log('🛠️ Marketplace visibility debug functions loaded!');
console.log('📝 Available functions:');
console.log('  - marketplaceVisibilityDebug.debug() - Full visibility diagnostic');
console.log('  - marketplaceVisibilityDebug.testQuery() - Test Firestore query directly');
console.log('  - marketplaceVisibilityDebug.clearFilters() - Clear all active filters');
console.log('');
console.log('💡 To diagnose visibility issues, run: marketplaceVisibilityDebug.debug()');
