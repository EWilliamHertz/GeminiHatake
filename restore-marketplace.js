// MARKETPLACE RESTORATION SCRIPT
// This script will restore the marketplace by finding cards marked for sale in user collections
// and recreating the marketplace listings

console.log('🔄 MARKETPLACE RESTORATION SCRIPT');
console.log('=================================');

async function restoreMarketplaceFromCollections() {
    console.log('🔍 Scanning user collections for cards marked for sale...');
    
    const db = firebase.firestore();
    const batch = db.batch();
    let restoredCount = 0;
    
    try {
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        console.log(`👥 Found ${usersSnapshot.size} users to check`);
        
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            
            console.log(`🔍 Checking user: ${userData.displayName || userId}`);
            
            // Get user's collection
            const collectionSnapshot = await db.collection('users').doc(userId).collection('collection')
                .where('for_sale', '==', true)
                .get();
            
            if (collectionSnapshot.size > 0) {
                console.log(`  📦 Found ${collectionSnapshot.size} cards for sale`);
                
                collectionSnapshot.forEach(cardDoc => {
                    const cardData = cardDoc.data();
                    
                    // Create marketplace listing
                    const listingData = {
                        // Seller information
                        sellerId: userId,
                        sellerData: {
                            uid: userId,
                            displayName: userData.displayName || 'Unknown User',
                            email: userData.email || '',
                            country: userData.country || 'Unknown',
                            profilePicture: userData.profilePicture || ''
                        },
                        
                        // Card information
                        cardData: {
                            name: cardData.name,
                            set_name: cardData.set_name || cardData.set,
                            collector_number: cardData.collector_number,
                            game: cardData.game,
                            rarity: cardData.rarity,
                            condition: cardData.condition,
                            image_uris: cardData.image_uris,
                            prices: cardData.prices,
                            quantity: cardData.quantity || 1
                        },
                        
                        // Sale information
                        price: cardData.sale_price || 0,
                        currency: cardData.sale_currency || 'USD',
                        originalCollectionCardId: cardDoc.id,
                        
                        // Timestamps
                        listedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    // Add to batch
                    const listingRef = db.collection('marketplaceListings').doc();
                    batch.set(listingRef, listingData);
                    restoredCount++;
                    
                    console.log(`    ✅ ${cardData.name} - $${cardData.sale_price || 0}`);
                });
            }
        }
        
        if (restoredCount > 0) {
            console.log(`💾 Committing ${restoredCount} marketplace listings...`);
            await batch.commit();
            console.log('✅ Marketplace restoration completed!');
            console.log(`📊 Restored ${restoredCount} listings to marketplace`);
        } else {
            console.log('ℹ️ No cards marked for sale found in any collections');
            console.log('💡 You may need to list some cards for sale first');
        }
        
        return restoredCount;
        
    } catch (error) {
        console.error('❌ Error restoring marketplace:', error);
        throw error;
    }
}

async function createSampleMarketplaceData() {
    console.log('🎨 Creating sample marketplace data...');
    
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        console.error('❌ Must be logged in to create sample data');
        return;
    }
    
    const db = firebase.firestore();
    const sampleListings = [
        {
            sellerId: currentUser.uid,
            sellerData: {
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Sample User',
                email: currentUser.email,
                country: 'United States'
            },
            cardData: {
                name: 'Lightning Bolt',
                set_name: 'Masters 25',
                collector_number: '141',
                game: 'mtg',
                rarity: 'common',
                condition: 'near_mint',
                image_uris: {
                    normal: 'https://cards.scryfall.io/normal/front/e/3/e3285e6b-3e79-4d7c-bf96-d920f973b122.jpg'
                },
                prices: { usd: '2.50' },
                quantity: 1
            },
            price: 2.25,
            currency: 'USD',
            originalCollectionCardId: 'sample-1',
            listedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        {
            sellerId: currentUser.uid,
            sellerData: {
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Sample User',
                email: currentUser.email,
                country: 'United States'
            },
            cardData: {
                name: 'Counterspell',
                set_name: 'Masters 25',
                collector_number: '267',
                game: 'mtg',
                rarity: 'common',
                condition: 'lightly_played',
                image_uris: {
                    normal: 'https://cards.scryfall.io/normal/front/c/c/cca8eb95-d071-46a4-885c-3da25b401806.jpg'
                },
                prices: { usd: '1.50' },
                quantity: 2
            },
            price: 1.35,
            currency: 'USD',
            originalCollectionCardId: 'sample-2',
            listedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
    ];
    
    const batch = db.batch();
    sampleListings.forEach(listing => {
        const docRef = db.collection('marketplaceListings').doc();
        batch.set(docRef, listing);
    });
    
    try {
        await batch.commit();
        console.log(`✅ Created ${sampleListings.length} sample marketplace listings`);
        return sampleListings.length;
    } catch (error) {
        console.error('❌ Error creating sample data:', error);
        throw error;
    }
}

async function verifyMarketplaceRestoration() {
    console.log('🔍 Verifying marketplace restoration...');
    
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('marketplaceListings').get();
        
        console.log(`📊 Total marketplace listings: ${snapshot.size}`);
        
        if (snapshot.size > 0) {
            console.log('📋 Current marketplace listings:');
            snapshot.docs.slice(0, 5).forEach((doc, index) => {
                const data = doc.data();
                console.log(`  ${index + 1}. ${data.cardData?.name} - $${data.price} (${data.sellerData?.displayName})`);
            });
            
            if (snapshot.size > 5) {
                console.log(`  ... and ${snapshot.size - 5} more listings`);
            }
        }
        
        return snapshot.size;
        
    } catch (error) {
        console.error('❌ Error verifying marketplace:', error);
        return 0;
    }
}

// Main restoration function
async function runMarketplaceRestoration() {
    console.log('🚀 Starting marketplace restoration process...');
    
    try {
        // First, try to restore from existing collections
        const restoredCount = await restoreMarketplaceFromCollections();
        
        // If no cards were found, create sample data
        if (restoredCount === 0) {
            console.log('💡 No cards for sale found, creating sample data...');
            await createSampleMarketplaceData();
        }
        
        // Verify the restoration
        const totalListings = await verifyMarketplaceRestoration();
        
        if (totalListings > 0) {
            console.log('🎉 Marketplace restoration successful!');
            console.log('🔄 Please refresh the marketplace page to see the restored listings');
        } else {
            console.log('⚠️ Marketplace is still empty after restoration attempt');
        }
        
        return totalListings;
        
    } catch (error) {
        console.error('❌ Marketplace restoration failed:', error);
        return 0;
    }
}

// Export functions for manual use
window.marketplaceRestore = {
    restore: runMarketplaceRestoration,
    restoreFromCollections: restoreMarketplaceFromCollections,
    createSample: createSampleMarketplaceData,
    verify: verifyMarketplaceRestoration
};

console.log('🛠️ Marketplace restoration functions loaded!');
console.log('📝 Available functions:');
console.log('  - marketplaceRestore.restore() - Full restoration process');
console.log('  - marketplaceRestore.restoreFromCollections() - Restore from user collections');
console.log('  - marketplaceRestore.createSample() - Create sample listings');
console.log('  - marketplaceRestore.verify() - Check current marketplace state');
console.log('');
console.log('💡 To restore the marketplace, run: marketplaceRestore.restore()');
