// COMPREHENSIVE MARKETPLACE DIAGNOSTIC SCRIPT
// Paste this into your browser console on the marketplace page

console.log('🔍 STARTING COMPREHENSIVE MARKETPLACE DIAGNOSTIC');
console.log('================================================');

// Global variables for testing
let db, auth, testResults = {};

async function initializeFirebase() {
    console.log('1️⃣ CHECKING FIREBASE INITIALIZATION...');
    
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase SDK not loaded');
        return false;
    }
    
    try {
        db = firebase.firestore();
        auth = firebase.auth();
        console.log('✅ Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        return false;
    }
}

async function checkAuthentication() {
    console.log('\n2️⃣ CHECKING AUTHENTICATION...');
    
    const user = auth.currentUser;
    if (user) {
        console.log('✅ User authenticated:', user.uid);
        console.log('📧 Email:', user.email);
        testResults.authenticated = true;
    } else {
        console.log('⚠️ No user authenticated (this is OK for browsing marketplace)');
        testResults.authenticated = false;
    }
}

async function checkMarketplaceCollection() {
    console.log('\n3️⃣ CHECKING MARKETPLACE COLLECTION...');
    
    try {
        // Test basic read permission
        console.log('📊 Testing read permissions...');
        const testDoc = await db.collection('marketplaceListings').limit(1).get();
        console.log('✅ Read permission granted');
        
        // Get total count
        const allDocs = await db.collection('marketplaceListings').get();
        console.log(`📈 Total documents in marketplaceListings: ${allDocs.size}`);
        
        if (allDocs.size === 0) {
            console.warn('⚠️ MARKETPLACE IS EMPTY - No documents found in marketplaceListings collection');
            testResults.hasListings = false;
            
            // Check if there are any collections at all
            console.log('🔍 Checking for other collections...');
            
            // Try to find collections that might have marketplace data
            const possibleCollections = ['marketplace', 'listings', 'cards_for_sale'];
            for (const collectionName of possibleCollections) {
                try {
                    const snapshot = await db.collection(collectionName).limit(1).get();
                    if (snapshot.size > 0) {
                        console.log(`📁 Found data in ${collectionName} collection (${snapshot.size} docs)`);
                    }
                } catch (error) {
                    // Collection doesn't exist or no permission
                }
            }
        } else {
            testResults.hasListings = true;
            
            // Analyze the first few documents
            console.log('\n📋 ANALYZING SAMPLE DOCUMENTS:');
            allDocs.docs.slice(0, 3).forEach((doc, index) => {
                const data = doc.data();
                console.log(`\n📄 Document ${index + 1} (${doc.id}):`);
                console.log('  - Seller ID:', data.sellerId || data.sellerData?.uid || 'MISSING');
                console.log('  - Card Name:', data.cardData?.name || data.name || 'MISSING');
                console.log('  - Price:', data.price || 'MISSING');
                console.log('  - Listed At:', data.listedAt ? data.listedAt.toDate() : 'MISSING');
                console.log('  - Game:', data.cardData?.game || data.game || 'MISSING');
                
                // Check for required fields
                const requiredFields = ['sellerId', 'cardData', 'price'];
                const missingFields = requiredFields.filter(field => {
                    if (field === 'sellerId') {
                        return !data.sellerId && !data.sellerData?.uid;
                    }
                    return !data[field];
                });
                
                if (missingFields.length > 0) {
                    console.warn(`  ⚠️ Missing fields: ${missingFields.join(', ')}`);
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Error accessing marketplaceListings:', error);
        
        if (error.code === 'permission-denied') {
            console.error('🚫 PERMISSION DENIED - Check Firestore rules');
            console.log('💡 Your rules should include: allow read, list: if true; for marketplaceListings');
        }
        
        testResults.hasListings = false;
        return false;
    }
    
    return true;
}

async function checkMarketplaceManager() {
    console.log('\n4️⃣ CHECKING MARKETPLACE MANAGER...');
    
    // Check if MarketplaceManager exists
    if (typeof MarketplaceManager === 'undefined') {
        console.error('❌ MarketplaceManager class not found');
        return false;
    }
    
    // Check if instance exists
    if (typeof window.marketplaceManager === 'undefined') {
        console.warn('⚠️ MarketplaceManager instance not found on window');
        
        // Try to find it in other places
        const possibleLocations = ['marketplaceManager', 'marketplace', 'manager'];
        for (const location of possibleLocations) {
            if (window[location]) {
                console.log(`✅ Found marketplace manager at window.${location}`);
                window.marketplaceManager = window[location];
                break;
            }
        }
    }
    
    if (window.marketplaceManager) {
        console.log('✅ MarketplaceManager instance found');
        console.log('📊 All listings:', window.marketplaceManager.allListings?.length || 0);
        console.log('🔍 Filtered listings:', window.marketplaceManager.filteredListings?.length || 0);
        
        testResults.managerWorking = true;
    } else {
        console.error('❌ MarketplaceManager instance not accessible');
        testResults.managerWorking = false;
    }
}

function checkDOMElements() {
    console.log('\n5️⃣ CHECKING DOM ELEMENTS...');
    
    const criticalElements = {
        'marketplace-grid': 'Main grid container',
        'marketplace-display': 'Display container',
        'loading-indicator': 'Loading indicator',
        'main-search-bar': 'Search bar'
    };
    
    let allElementsFound = true;
    
    Object.entries(criticalElements).forEach(([id, description]) => {
        const element = document.getElementById(id);
        if (element) {
            console.log(`✅ ${description} (${id}) found`);
            
            // Check if element is visible
            const isVisible = !element.classList.contains('hidden') && 
                             element.style.display !== 'none';
            console.log(`   Visible: ${isVisible ? '✅' : '❌'}`);
        } else {
            console.error(`❌ ${description} (${id}) NOT FOUND`);
            allElementsFound = false;
        }
    });
    
    testResults.domElementsOk = allElementsFound;
}

function checkConsoleErrors() {
    console.log('\n6️⃣ CHECKING FOR JAVASCRIPT ERRORS...');
    
    // Override console.error temporarily to catch errors
    const originalError = console.error;
    const errors = [];
    
    console.error = function(...args) {
        errors.push(args.join(' '));
        originalError.apply(console, arguments);
    };
    
    // Restore after a short delay
    setTimeout(() => {
        console.error = originalError;
        
        if (errors.length > 0) {
            console.warn(`⚠️ Found ${errors.length} console errors:`);
            errors.forEach((error, index) => {
                console.warn(`  ${index + 1}. ${error}`);
            });
        } else {
            console.log('✅ No console errors detected');
        }
    }, 1000);
}

async function testMarketplaceLoad() {
    console.log('\n7️⃣ TESTING MARKETPLACE LOAD FUNCTION...');
    
    if (window.marketplaceManager && typeof window.marketplaceManager.loadMarketplaceData === 'function') {
        try {
            console.log('🔄 Attempting to reload marketplace data...');
            await window.marketplaceManager.loadMarketplaceData();
            console.log('✅ Marketplace load function executed successfully');
        } catch (error) {
            console.error('❌ Error in marketplace load function:', error);
        }
    } else {
        console.warn('⚠️ Cannot test marketplace load - function not available');
    }
}

function generateSummary() {
    console.log('\n📋 DIAGNOSTIC SUMMARY');
    console.log('====================');
    
    const issues = [];
    const recommendations = [];
    
    if (!testResults.hasListings) {
        issues.push('No marketplace listings found');
        recommendations.push('Check if cards have been properly listed for sale');
        recommendations.push('Verify that individual marketplace actions are creating listings');
    }
    
    if (!testResults.managerWorking) {
        issues.push('MarketplaceManager not working properly');
        recommendations.push('Check browser console for JavaScript errors');
        recommendations.push('Ensure marketplace.js is loaded correctly');
    }
    
    if (!testResults.domElementsOk) {
        issues.push('Missing DOM elements');
        recommendations.push('Check that marketplace.html has all required elements');
    }
    
    if (issues.length === 0) {
        console.log('✅ No major issues detected');
        console.log('💡 If marketplace is still empty, try:');
        console.log('   1. Hard refresh (Ctrl+F5)');
        console.log('   2. Clear browser cache');
        console.log('   3. Check network tab for failed requests');
    } else {
        console.log('❌ Issues found:');
        issues.forEach((issue, index) => {
            console.log(`   ${index + 1}. ${issue}`);
        });
        
        console.log('\n💡 Recommendations:');
        recommendations.forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec}`);
        });
    }
}

// Manual functions for testing
function manualCreateTestListing() {
    console.log('\n🧪 CREATING TEST LISTING...');
    
    if (!auth.currentUser) {
        console.error('❌ Must be authenticated to create test listing');
        return;
    }
    
    const testListing = {
        sellerId: auth.currentUser.uid,
        sellerData: {
            uid: auth.currentUser.uid,
            displayName: auth.currentUser.displayName || 'Test User',
            email: auth.currentUser.email
        },
        cardData: {
            name: 'Test Card',
            set_name: 'Test Set',
            game: 'mtg',
            rarity: 'rare',
            condition: 'near_mint'
        },
        price: 10.00,
        currency: 'USD',
        listedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    return db.collection('marketplaceListings').add(testListing)
        .then(docRef => {
            console.log('✅ Test listing created:', docRef.id);
            console.log('🔄 Reload the marketplace to see it');
        })
        .catch(error => {
            console.error('❌ Failed to create test listing:', error);
        });
}

// Run all diagnostics
async function runFullDiagnostic() {
    const firebaseOk = await initializeFirebase();
    if (!firebaseOk) return;
    
    await checkAuthentication();
    await checkMarketplaceCollection();
    await checkMarketplaceManager();
    checkDOMElements();
    checkConsoleErrors();
    await testMarketplaceLoad();
    
    setTimeout(generateSummary, 2000);
}

// Export functions for manual use
window.marketplaceDiagnostic = {
    runFullDiagnostic,
    checkMarketplaceCollection,
    checkMarketplaceManager,
    manualCreateTestListing,
    testResults
};

// Auto-run the diagnostic
runFullDiagnostic();
