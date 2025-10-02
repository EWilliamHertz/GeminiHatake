// MARKETPLACE QUICK FIXES
// Common solutions for marketplace visibility issues

console.log('⚡ MARKETPLACE QUICK FIXES');
console.log('=========================');

// Fix 1: Check for missing Firestore index
async function checkFirestoreIndex() {
    console.log('🔍 Checking Firestore index...');
    
    const db = firebase.firestore();
    
    try {
        // Test the orderBy query that requires an index
        const snapshot = await db.collection('marketplaceListings')
            .orderBy('listedAt', 'desc')
            .limit(1)
            .get();
        
        console.log('✅ Firestore index is working');
        return true;
        
    } catch (error) {
        if (error.code === 'failed-precondition') {
            console.error('❌ MISSING FIRESTORE INDEX');
            console.log('🔧 SOLUTION:');
            console.log('1. Go to Firebase Console > Firestore Database > Indexes');
            console.log('2. Click "Create Index"');
            console.log('3. Collection ID: marketplaceListings');
            console.log('4. Add field: listedAt (Descending)');
            console.log('5. Click "Create Index"');
            console.log('6. Wait for index to build (can take a few minutes)');
            return false;
        } else {
            console.error('❌ Other Firestore error:', error);
            return false;
        }
    }
}

// Fix 2: Force reload marketplace without orderBy
async function forceReloadWithoutOrderBy() {
    console.log('🔄 Force reloading marketplace without orderBy...');
    
    const db = firebase.firestore();
    
    try {
        // Query without orderBy to avoid index issues
        const snapshot = await db.collection('marketplaceListings').get();
        console.log(`📊 Found ${snapshot.size} listings without orderBy`);
        
        if (snapshot.size > 0 && window.marketplaceManager) {
            // Manually populate the marketplace manager
            const listings = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                listings.push({
                    id: doc.id,
                    ...data,
                    cardData: data.cardData || data,
                    sellerData: data.sellerData || { displayName: 'Unknown Seller' },
                    price: data.price || 0,
                    listedAt: data.listedAt?.toDate() || new Date()
                });
            });
            
            // Sort manually by date
            listings.sort((a, b) => b.listedAt - a.listedAt);
            
            // Update marketplace manager
            window.marketplaceManager.allListings = listings;
            window.marketplaceManager.filteredListings = [...listings];
            
            // Update display
            if (typeof window.marketplaceManager.updateDisplay === 'function') {
                window.marketplaceManager.updateDisplay();
            }
            
            console.log('✅ Marketplace manually reloaded');
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('❌ Error in force reload:', error);
        return false;
    }
}

// Fix 3: Reset marketplace manager
function resetMarketplaceManager() {
    console.log('🔄 Resetting marketplace manager...');
    
    if (window.marketplaceManager) {
        // Reset data
        window.marketplaceManager.allListings = [];
        window.marketplaceManager.filteredListings = [];
        window.marketplaceManager.currentPage = 1;
        
        // Clear any cached data
        if (window.marketplaceManager.searchTimeout) {
            clearTimeout(window.marketplaceManager.searchTimeout);
        }
        
        console.log('✅ Marketplace manager reset');
        return true;
    } else {
        console.error('❌ Marketplace manager not found');
        return false;
    }
}

// Fix 4: Check for JavaScript errors blocking execution
function checkForJSErrors() {
    console.log('🔍 Checking for JavaScript errors...');
    
    // Override console.error to catch errors
    const originalError = console.error;
    const errors = [];
    let errorCount = 0;
    
    console.error = function(...args) {
        errorCount++;
        errors.push(args.join(' '));
        originalError.apply(console, arguments);
    };
    
    // Restore after a delay and report
    setTimeout(() => {
        console.error = originalError;
        
        if (errorCount > 0) {
            console.warn(`⚠️ Found ${errorCount} JavaScript errors that might be blocking marketplace:`);
            errors.slice(0, 5).forEach((error, index) => {
                console.warn(`  ${index + 1}. ${error}`);
            });
            
            if (errors.length > 5) {
                console.warn(`  ... and ${errors.length - 5} more errors`);
            }
        } else {
            console.log('✅ No JavaScript errors detected');
        }
    }, 2000);
}

// Fix 5: Manual marketplace refresh
async function manualMarketplaceRefresh() {
    console.log('🔄 Manual marketplace refresh...');
    
    try {
        // Step 1: Check index
        const indexOk = await checkFirestoreIndex();
        
        // Step 2: Reset manager
        resetMarketplaceManager();
        
        // Step 3: Try normal reload first
        if (indexOk && window.marketplaceManager && typeof window.marketplaceManager.loadMarketplaceData === 'function') {
            console.log('🔄 Attempting normal reload...');
            await window.marketplaceManager.loadMarketplaceData();
            
            const loadedCount = window.marketplaceManager.allListings?.length || 0;
            if (loadedCount > 0) {
                console.log(`✅ Normal reload successful: ${loadedCount} listings`);
                return true;
            }
        }
        
        // Step 4: Try force reload without orderBy
        console.log('🔄 Attempting force reload...');
        const forceReloadSuccess = await forceReloadWithoutOrderBy();
        
        if (forceReloadSuccess) {
            console.log('✅ Force reload successful');
            return true;
        }
        
        console.error('❌ All reload attempts failed');
        return false;
        
    } catch (error) {
        console.error('❌ Error in manual refresh:', error);
        return false;
    }
}

// Main fix function
async function runQuickFixes() {
    console.log('🚀 Running marketplace quick fixes...');
    
    // Check for common issues
    checkForJSErrors();
    
    // Try to fix the marketplace
    const success = await manualMarketplaceRefresh();
    
    if (success) {
        console.log('🎉 Marketplace fixes applied successfully!');
        console.log('🔄 The marketplace should now show your listings');
    } else {
        console.log('❌ Quick fixes were not sufficient');
        console.log('💡 Try running the full diagnostic: marketplaceVisibilityDebug.debug()');
    }
    
    return success;
}

// Export functions
window.marketplaceQuickFixes = {
    run: runQuickFixes,
    checkIndex: checkFirestoreIndex,
    forceReload: forceReloadWithoutOrderBy,
    reset: resetMarketplaceManager,
    refresh: manualMarketplaceRefresh
};

console.log('⚡ Marketplace quick fixes loaded!');
console.log('📝 Available functions:');
console.log('  - marketplaceQuickFixes.run() - Run all quick fixes');
console.log('  - marketplaceQuickFixes.checkIndex() - Check Firestore index');
console.log('  - marketplaceQuickFixes.forceReload() - Force reload without orderBy');
console.log('  - marketplaceQuickFixes.reset() - Reset marketplace manager');
console.log('  - marketplaceQuickFixes.refresh() - Manual refresh');
console.log('');
console.log('💡 To fix marketplace visibility, run: marketplaceQuickFixes.run()');
