// DEBUG MARKETPLACE LISTING CREATION
// This script will help identify why bulk marketplace listings aren't being created

console.log('🔍 DEBUGGING MARKETPLACE LISTING CREATION');
console.log('=========================================');

async function debugMarketplaceCreation() {
    console.log('1️⃣ CHECKING USER AUTHENTICATION...');
    
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error('❌ User not authenticated');
        return false;
    }
    
    console.log('✅ User authenticated:', user.uid);
    
    console.log('\n2️⃣ CHECKING COLLECTION FOR CARDS MARKED FOR SALE...');
    
    try {
        const db = firebase.firestore();
        const collectionRef = db.collection('users').doc(user.uid).collection('collection');
        const forSaleSnapshot = await collectionRef.where('for_sale', '==', true).get();
        
        console.log(`📊 Found ${forSaleSnapshot.size} cards marked for sale in collection`);
        
        if (forSaleSnapshot.size === 0) {
            console.warn('⚠️ No cards marked for sale in collection');
            return false;
        }
        
        // Show the cards marked for sale
        console.log('📋 Cards marked for sale:');
        const cardsForSale = [];
        forSaleSnapshot.forEach((doc, index) => {
            const data = doc.data();
            cardsForSale.push({
                id: doc.id,
                name: data.name,
                sale_price: data.sale_price,
                sale_currency: data.sale_currency,
                for_sale: data.for_sale
            });
            console.log(`  ${index + 1}. ${data.name} - ${data.sale_price} ${data.sale_currency || 'USD'}`);
        });
        
        console.log('\n3️⃣ CHECKING EXISTING MARKETPLACE LISTINGS...');
        
        const marketplaceSnapshot = await db.collection('marketplaceListings')
            .where('sellerData.uid', '==', user.uid)
            .get();
        
        console.log(`📊 Found ${marketplaceSnapshot.size} existing marketplace listings for this user`);
        
        if (marketplaceSnapshot.size > 0) {
            console.log('📋 Existing marketplace listings:');
            marketplaceSnapshot.forEach((doc, index) => {
                const data = doc.data();
                console.log(`  ${index + 1}. ${data.cardData?.name} - ${data.price} (${doc.id})`);
            });
        }
        
        console.log('\n4️⃣ TESTING MARKETPLACE LISTING CREATION...');
        
        // Test creating marketplace listings for the cards marked for sale
        const testListings = [];
        
        for (const card of cardsForSale) {
            const listing = {
                cardData: {
                    name: card.name || 'Unknown Card',
                    game: 'pokemon', // Based on your screenshot
                    set: 'Test Set',
                    set_name: 'Test Set',
                    condition: 'near_mint',
                    collector_number: '1',
                    rarity: 'common',
                    image_uris: {},
                    prices: {}
                },
                sellerData: {
                    uid: user.uid,
                    displayName: user.displayName || 'Test User',
                    photoURL: user.photoURL || null,
                    country: 'Unknown'
                },
                price: card.sale_price || 0,
                currency: card.sale_currency || 'USD',
                quantity: 1,
                listedAt: firebase.firestore.FieldValue.serverTimestamp(),
                originalCollectionCardId: card.id
            };
            testListings.push(listing);
        }
        
        console.log(`🧪 Attempting to create ${testListings.length} test marketplace listings...`);
        
        const batch = db.batch();
        const marketplaceRef = db.collection('marketplaceListings');
        
        testListings.forEach(listing => {
            const docRef = marketplaceRef.doc();
            batch.set(docRef, listing);
            console.log(`  📝 Prepared listing for: ${listing.cardData.name}`);
        });
        
        await batch.commit();
        console.log('✅ Marketplace listings created successfully!');
        
        console.log('\n5️⃣ VERIFYING CREATION...');
        
        // Wait a moment for Firestore to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const verifySnapshot = await db.collection('marketplaceListings')
            .where('sellerData.uid', '==', user.uid)
            .get();
        
        console.log(`📊 Total marketplace listings after creation: ${verifySnapshot.size}`);
        
        if (verifySnapshot.size >= testListings.length) {
            console.log('🎉 SUCCESS: Marketplace listings created and verified!');
            console.log('🔄 Refresh your marketplace page to see the listings');
            return true;
        } else {
            console.warn('⚠️ Some listings may not have been created properly');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error during marketplace creation debug:', error);
        
        if (error.code === 'permission-denied') {
            console.error('🚫 Permission denied - check Firestore rules');
        }
        
        return false;
    }
}

// Function to manually create marketplace listings from collection
async function manualCreateMarketplaceListings() {
    console.log('🔧 MANUALLY CREATING MARKETPLACE LISTINGS...');
    
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error('❌ User not authenticated');
        return false;
    }
    
    try {
        const db = firebase.firestore();
        
        // Get cards marked for sale
        const collectionRef = db.collection('users').doc(user.uid).collection('collection');
        const forSaleSnapshot = await collectionRef.where('for_sale', '==', true).get();
        
        if (forSaleSnapshot.size === 0) {
            console.log('ℹ️ No cards marked for sale in collection');
            return false;
        }
        
        console.log(`📦 Creating marketplace listings for ${forSaleSnapshot.size} cards...`);
        
        const batch = db.batch();
        const marketplaceRef = db.collection('marketplaceListings');
        let createdCount = 0;
        
        forSaleSnapshot.forEach(doc => {
            const cardData = doc.data();
            
            const listing = {
                cardData: {
                    name: cardData.name || 'Unknown Card',
                    game: cardData.game || 'pokemon',
                    set: cardData.set || cardData.set_name || 'Unknown Set',
                    set_name: cardData.set_name || cardData.set || 'Unknown Set',
                    condition: cardData.condition || 'near_mint',
                    collector_number: cardData.collector_number || '',
                    rarity: cardData.rarity || 'common',
                    type_line: cardData.type_line || '',
                    image_uris: cardData.image_uris || {},
                    prices: cardData.prices || {},
                    language: cardData.language || 'en',
                    is_foil: cardData.is_foil || false,
                    api_id: cardData.api_id || ''
                },
                sellerData: {
                    uid: user.uid,
                    displayName: user.displayName || 'Unknown Seller',
                    photoURL: user.photoURL || null,
                    country: 'Unknown'
                },
                price: cardData.sale_price || 0,
                currency: cardData.sale_currency || 'USD',
                quantity: cardData.quantity || 1,
                listedAt: firebase.firestore.FieldValue.serverTimestamp(),
                originalCollectionCardId: doc.id
            };
            
            const docRef = marketplaceRef.doc();
            batch.set(docRef, listing);
            createdCount++;
            
            console.log(`  ✅ ${cardData.name} - ${cardData.sale_price} ${cardData.sale_currency || 'USD'}`);
        });
        
        await batch.commit();
        console.log(`🎉 Successfully created ${createdCount} marketplace listings!`);
        console.log('🔄 Refresh your marketplace page to see them');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error creating marketplace listings:', error);
        return false;
    }
}

// Export functions
window.debugMarketplaceCreation = {
    debug: debugMarketplaceCreation,
    create: manualCreateMarketplaceListings
};

console.log('🛠️ Marketplace creation debug functions loaded!');
console.log('📝 Available functions:');
console.log('  - debugMarketplaceCreation.debug() - Full diagnostic');
console.log('  - debugMarketplaceCreation.create() - Manually create listings');
console.log('');
console.log('💡 To debug marketplace creation, run: debugMarketplaceCreation.debug()');
