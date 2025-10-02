// MARKETPLACE TEST DATA POPULATOR
// Run this in browser console to add test listings to marketplace

async function populateMarketplaceTestData() {
    console.log('🚀 POPULATING MARKETPLACE WITH TEST DATA...');
    
    // Check if user is authenticated
    if (!firebase.auth().currentUser) {
        console.error('❌ Must be logged in to create test listings');
        return;
    }
    
    const db = firebase.firestore();
    const currentUser = firebase.auth().currentUser;
    
    const testListings = [
        {
            sellerId: currentUser.uid,
            sellerData: {
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Test User',
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
                prices: {
                    usd: '2.50'
                }
            },
            price: 2.50,
            currency: 'USD',
            listedAt: firebase.firestore.FieldValue.serverTimestamp(),
            originalCollectionCardId: 'test-card-1'
        },
        {
            sellerId: currentUser.uid,
            sellerData: {
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Test User',
                email: currentUser.email,
                country: 'United States'
            },
            cardData: {
                name: 'Black Lotus',
                set_name: 'Limited Edition Alpha',
                collector_number: '232',
                game: 'mtg',
                rarity: 'rare',
                condition: 'lightly_played',
                image_uris: {
                    normal: 'https://cards.scryfall.io/normal/front/b/d/bd8fa327-dd41-4737-8f19-2cf5eb1f7cdd.jpg'
                },
                prices: {
                    usd: '25000.00'
                }
            },
            price: 22500.00,
            currency: 'USD',
            listedAt: firebase.firestore.FieldValue.serverTimestamp(),
            originalCollectionCardId: 'test-card-2'
        },
        {
            sellerId: currentUser.uid,
            sellerData: {
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Test User',
                email: currentUser.email,
                country: 'United States'
            },
            cardData: {
                name: 'Pikachu',
                set_name: 'Base Set',
                collector_number: '25',
                game: 'pokemon',
                rarity: 'rare',
                condition: 'near_mint',
                image_uris: {
                    normal: 'https://images.pokemontcg.io/base1/25_hires.png'
                },
                prices: {
                    usd: '150.00'
                }
            },
            price: 135.00,
            currency: 'USD',
            listedAt: firebase.firestore.FieldValue.serverTimestamp(),
            originalCollectionCardId: 'test-card-3'
        },
        {
            sellerId: currentUser.uid,
            sellerData: {
                uid: currentUser.uid,
                displayName: currentUser.displayName || 'Test User',
                email: currentUser.email,
                country: 'United States'
            },
            cardData: {
                name: 'Elsa - Snow Queen',
                set_name: 'The First Chapter',
                collector_number: '4',
                game: 'lorcana',
                rarity: 'legendary',
                condition: 'mint',
                image_uris: {
                    normal: 'https://example.com/elsa.jpg'
                },
                prices: {
                    usd: '45.00'
                }
            },
            price: 40.00,
            currency: 'USD',
            listedAt: firebase.firestore.FieldValue.serverTimestamp(),
            originalCollectionCardId: 'test-card-4'
        }
    ];
    
    console.log(`📝 Creating ${testListings.length} test listings...`);
    
    const batch = db.batch();
    const createdIds = [];
    
    testListings.forEach((listing, index) => {
        const docRef = db.collection('marketplaceListings').doc();
        batch.set(docRef, listing);
        createdIds.push(docRef.id);
        console.log(`  ${index + 1}. ${listing.cardData.name} - $${listing.price}`);
    });
    
    try {
        await batch.commit();
        console.log('✅ Test listings created successfully!');
        console.log('📋 Created listing IDs:', createdIds);
        console.log('🔄 Refresh the marketplace page to see the test data');
        
        return createdIds;
    } catch (error) {
        console.error('❌ Failed to create test listings:', error);
        throw error;
    }
}

async function cleanupTestData() {
    console.log('🧹 CLEANING UP TEST DATA...');
    
    const db = firebase.firestore();
    const currentUser = firebase.auth().currentUser;
    
    if (!currentUser) {
        console.error('❌ Must be logged in to cleanup test data');
        return;
    }
    
    try {
        // Find all listings by current user with test card names
        const testCardNames = ['Lightning Bolt', 'Black Lotus', 'Pikachu', 'Elsa - Snow Queen'];
        
        const snapshot = await db.collection('marketplaceListings')
            .where('sellerId', '==', currentUser.uid)
            .get();
        
        const batch = db.batch();
        let deleteCount = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const cardName = data.cardData?.name;
            
            if (testCardNames.includes(cardName)) {
                batch.delete(doc.ref);
                deleteCount++;
                console.log(`  Deleting: ${cardName}`);
            }
        });
        
        if (deleteCount > 0) {
            await batch.commit();
            console.log(`✅ Deleted ${deleteCount} test listings`);
        } else {
            console.log('ℹ️ No test listings found to delete');
        }
        
    } catch (error) {
        console.error('❌ Failed to cleanup test data:', error);
    }
}

// Check current marketplace state
async function checkCurrentMarketplace() {
    console.log('📊 CHECKING CURRENT MARKETPLACE STATE...');
    
    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('marketplaceListings').get();
        
        console.log(`📈 Total listings: ${snapshot.size}`);
        
        if (snapshot.size > 0) {
            console.log('📋 Current listings:');
            snapshot.forEach((doc, index) => {
                const data = doc.data();
                console.log(`  ${index + 1}. ${data.cardData?.name || 'Unknown'} - $${data.price || 0} (${data.sellerData?.displayName || 'Unknown seller'})`);
            });
        } else {
            console.log('📭 Marketplace is empty');
        }
        
    } catch (error) {
        console.error('❌ Error checking marketplace:', error);
    }
}

// Export functions
window.marketplaceTestData = {
    populate: populateMarketplaceTestData,
    cleanup: cleanupTestData,
    check: checkCurrentMarketplace
};

console.log('🛠️ Marketplace test data functions loaded!');
console.log('📝 Available functions:');
console.log('  - marketplaceTestData.populate() - Add test listings');
console.log('  - marketplaceTestData.cleanup() - Remove test listings');
console.log('  - marketplaceTestData.check() - Check current state');
console.log('');
console.log('💡 To populate with test data, run: marketplaceTestData.populate()');
