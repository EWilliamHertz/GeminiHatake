// Marketplace Debug Script
// Run this in the browser console on the marketplace page to diagnose issues

console.log('=== MARKETPLACE DEBUG SCRIPT ===');

// Check if Firebase is initialized
if (typeof firebase === 'undefined') {
    console.error('❌ Firebase is not loaded');
} else {
    console.log('✅ Firebase is loaded');
}

// Check if Firestore is available
if (typeof firebase.firestore === 'undefined') {
    console.error('❌ Firestore is not available');
} else {
    console.log('✅ Firestore is available');
}

// Test marketplace listings query
async function testMarketplaceQuery() {
    try {
        console.log('🔍 Testing marketplace listings query...');
        
        const db = firebase.firestore();
        
        // First, try to get a simple count
        const snapshot = await db.collection('marketplaceListings').limit(1).get();
        console.log(`📊 Found ${snapshot.size} listings (limited to 1 for test)`);
        
        if (snapshot.size > 0) {
            const firstDoc = snapshot.docs[0];
            console.log('📄 First document ID:', firstDoc.id);
            console.log('📄 First document data:', firstDoc.data());
        }
        
        // Try to get all listings
        const allSnapshot = await db.collection('marketplaceListings').get();
        console.log(`📊 Total listings in collection: ${allSnapshot.size}`);
        
        if (allSnapshot.size === 0) {
            console.warn('⚠️ No listings found in marketplaceListings collection');
            
            // Check if there are any documents at all
            const collections = await db.listCollections();
            console.log('📁 Available collections:', collections.map(c => c.id));
        }
        
        return allSnapshot;
        
    } catch (error) {
        console.error('❌ Error querying marketplace listings:', error);
        
        if (error.code === 'permission-denied') {
            console.error('🚫 Permission denied - check Firestore rules');
            console.log('💡 Make sure your Firestore rules allow reading marketplaceListings');
        }
        
        return null;
    }
}

// Test authentication
function testAuth() {
    const auth = firebase.auth();
    const user = auth.currentUser;
    
    if (user) {
        console.log('👤 User is authenticated:', user.uid);
        console.log('📧 User email:', user.email);
    } else {
        console.log('👤 No user authenticated');
    }
}

// Check marketplace manager
function checkMarketplaceManager() {
    if (typeof window.marketplaceManager !== 'undefined') {
        console.log('✅ MarketplaceManager is available');
        console.log('📊 Current listings count:', window.marketplaceManager.allListings?.length || 0);
        console.log('🔍 Filtered listings count:', window.marketplaceManager.filteredListings?.length || 0);
    } else {
        console.log('❌ MarketplaceManager not found on window object');
    }
}

// Check DOM elements
function checkDOMElements() {
    const elements = [
        'marketplace-grid',
        'marketplace-display',
        'loading-indicator',
        'main-search-bar'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log(`✅ Element found: ${id}`);
        } else {
            console.log(`❌ Element missing: ${id}`);
        }
    });
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Running marketplace diagnostics...');
    
    testAuth();
    checkDOMElements();
    checkMarketplaceManager();
    
    const snapshot = await testMarketplaceQuery();
    
    if (snapshot && snapshot.size > 0) {
        console.log('✅ Marketplace query successful');
        
        // Show sample data structure
        const sampleDoc = snapshot.docs[0].data();
        console.log('📋 Sample listing structure:');
        console.log('- ID:', snapshot.docs[0].id);
        console.log('- Seller ID:', sampleDoc.sellerId || sampleDoc.sellerData?.uid);
        console.log('- Card name:', sampleDoc.cardData?.name || sampleDoc.name);
        console.log('- Price:', sampleDoc.price);
        console.log('- Listed at:', sampleDoc.listedAt);
        
    } else {
        console.log('❌ No marketplace listings found or query failed');
    }
    
    console.log('=== END MARKETPLACE DEBUG ===');
}

// Auto-run the tests
runAllTests();

// Export functions for manual testing
window.marketplaceDebug = {
    testMarketplaceQuery,
    testAuth,
    checkMarketplaceManager,
    checkDOMElements,
    runAllTests
};
