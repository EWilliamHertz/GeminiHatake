document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const mainContainer = document.querySelector('main.container');
    const marketplaceGrid = document.getElementById('marketplace-grid');

    if (!marketplaceGrid) return; // Exit if not on the marketplace page

    if (!user) {
        mainContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to view the marketplace.</p>';
        return;
    }

    // --- DOM Elements ---
    const searchForm = document.getElementById('marketplace-search-form');
    const sortByEl = document.getElementById('sort-by');
    const loadMoreContainer = document.getElementById('load-more-container');
    const messageContainer = document.getElementById('marketplace-message');

    // --- State ---
    let lastVisible = null;
    let isLoading = false;
    const PAGE_SIZE = 18;

    // --- Helper Functions ---
    const generateIndexLink = (fields) => {
        const projectId = db.app.options.projectId;
        let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=collection`;
        fields.forEach(field => {
            url += `&fields=${field.name},${field.order.toUpperCase()}`;
        });
        return url;
    };
    
    const showMessage = (html) => {
        marketplaceGrid.innerHTML = '';
        messageContainer.innerHTML = html;
        loadMoreContainer.innerHTML = '';
    };

    const renderSkeletonLoader = () => {
        let skeletons = '';
        for (let i = 0; i < PAGE_SIZE; i++) {
            skeletons += `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 flex flex-col">
                    <div class="relative w-full aspect-[5/7] skeleton mb-2 rounded-md"></div>
                    <div class="h-4 skeleton w-3/4 mb-2 rounded"></div>
                    <div class="h-6 skeleton w-1/2 mb-2 rounded"></div>
                    <div class="h-3 skeleton w-full rounded"></div>
                </div>
            `;
        }
        marketplaceGrid.innerHTML += skeletons;
    };

    const renderCard = (card) => {
        const seller = card.sellerData;
        if (!seller) return null; // Don't render if seller data is missing

        const overallRating = (((seller.averageAccuracy || 0) + (seller.averagePackaging || 0)) / 2).toFixed(1);
        const priceDisplay = card.salePrice > 0 
            ? window.HatakeSocial.convertAndFormatPrice(card.salePrice, seller.primaryCurrency || 'SEK')
            : 'For Trade';
        
        const cardEl = document.createElement('div');
        cardEl.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 flex flex-col group transition hover:shadow-xl hover:-translate-y-1';
        
        // Disable trade button if the user is the seller
        const tradeButtonDisabled = user.uid === card.sellerData.uid ? 'disabled' : '';
        const tradeButtonClasses = tradeButtonDisabled
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700';

        cardEl.innerHTML = `
            <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block h-full flex flex-col">
                <div class="relative w-full">
                    <img src="${card.imageUrl}" alt="${card.name}" 
                         class="w-full rounded-md mb-2 aspect-[5/7] object-cover" 
                         onerror="this.onerror=null;this.src='https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';">
                </div>
                <div class="flex-grow flex flex-col p-1">
                    <h4 class="font-bold text-sm truncate flex-grow text-gray-800 dark:text-white" title="${card.name}">
                        ${card.name}
                    </h4>
                    <p class="text-blue-600 dark:text-blue-400 font-semibold text-lg mt-1">
                        ${priceDisplay}
                    </p>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                         <a href="profile.html?uid=${seller.uid}" class="hover:underline" title="View Seller Profile">
                             ★ ${overallRating} | from ${seller.city || 'N/A'}, ${seller.country || 'N/A'}
                         </a>
                    </div>
                </div>
            </a>
            <a href="trades.html?propose_to_card=${card.id}" 
               class="propose-trade-btn mt-2 w-full text-center text-white text-xs font-bold py-1 rounded-full ${tradeButtonClasses}" ${tradeButtonDisabled}>
                ${tradeButtonDisabled ? 'Your Listing' : 'Propose Trade'}
            </a>
        `;
        return cardEl;
    };

    // --- Main Data Fetching Function ---
    const loadMarketplaceCards = async (isNewSearch = false) => {
        if (isLoading) return;
        isLoading = true;
        
        if (isNewSearch) {
            lastVisible = null;
            marketplaceGrid.innerHTML = '';
            messageContainer.innerHTML = '';
        }

        loadMoreContainer.innerHTML = '';
        renderSkeletonLoader();

        try {
            // 1. Build the base query
            let query = db.collectionGroup('collection').where('forSale', '==', true);
            let indexFields = [{ name: 'forSale', order: 'asc' }];
            
            // 2. Add filters
            const tcgFilter = document.getElementById('filter-tcg').value;
            if (tcgFilter !== 'all') {
                query = query.where('tcg', '==', tcgFilter);
                indexFields.push({ name: 'tcg', order: 'asc' });
            }
            
            // 3. Add sorting
            const [sortField, sortDirection] = sortByEl.value.split('_');
            query = query.orderBy(sortField, sortDirection);
            indexFields.push({ name: sortField, order: sortDirection });

            // 4. Add pagination
            if (lastVisible) {
                query = query.startAfter(lastVisible);
            }
            
            query = query.limit(PAGE_SIZE);

            // 5. Execute the query
            const snapshot = await query.get();
            lastVisible = snapshot.docs[snapshot.docs.length - 1];
            
            // On first load, clear the skeleton loader
            if (isNewSearch) {
                marketplaceGrid.innerHTML = '';
            } else {
                // Remove skeleton loaders from subsequent loads
                document.querySelectorAll('.skeleton').forEach(el => el.parentElement.remove());
            }

            if (snapshot.empty && isNewSearch) {
                showMessage('<p class="text-gray-500 dark:text-gray-400">No cards found for the current filters.</p>');
                return;
            }

            // 6. Fetch seller data efficiently
            const sellerIds = [...new Set(snapshot.docs.map(doc => doc.ref.parent.parent.id))];
            if (sellerIds.length === 0) {
                 if (isNewSearch) showMessage('<p class="text-gray-500 dark:text-gray-400">No cards found.</p>');
                 return;
            }

            const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
            const sellerDocs = await Promise.all(sellerPromises);
            
            const sellers = new Map();
            sellerDocs.forEach(doc => {
                if (doc.exists) sellers.set(doc.id, { uid: doc.id, ...doc.data() });
            });

            // 7. Combine data and render cards
            snapshot.docs.forEach(doc => {
                const cardData = {
                    id: doc.id,
                    sellerData: sellers.get(doc.ref.parent.parent.id) || null,
                    ...doc.data()
                };
                const cardElement = renderCard(cardData);
                if (cardElement) {
                    marketplaceGrid.appendChild(cardElement);
                }
            });

            // 8. Add "Load More" button if needed
            if (snapshot.docs.length === PAGE_SIZE) {
                const newLoadMoreBtn = document.createElement('button');
                newLoadMoreBtn.id = 'load-more-btn';
                newLoadMoreBtn.className = 'px-6 py-3 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 transition';
                newLoadMoreBtn.textContent = 'Load More Cards';
                loadMoreContainer.appendChild(newLoadMoreBtn);
            }

        } catch (error) {
            console.error("Error loading marketplace:", error);
            let errorMessage;
            if (error.code === 'failed-precondition') {
                 // Missing Index Error
                 const indexLink = generateIndexLink(indexFields);
                 errorMessage = `
                    <div class="col-span-full text-center p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
                        <p class="font-bold text-yellow-800 dark:text-yellow-200">Database Index Required</p>
                        <p class="text-yellow-700 dark:text-yellow-300 mt-2">To sort and filter this way, a new database index must be created. This is a one-time setup for this specific query.</p>
                        <a href="${indexLink}" target="_blank" rel="noopener noreferrer" 
                           class="mt-4 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700">
                           Click Here to Create the Index
                        </a>
                        <p class="text-xs text-gray-500 mt-2">This link opens the Firebase console. Click "Save", wait a few minutes for the index to build, then refresh this page.</p>
                    </div>`;
            } else {
                // Permissions or other errors
                errorMessage = `
                    <div class="col-span-full text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">
                        <p class="font-bold text-red-700 dark:text-red-300">An Error Occurred</p>
                        <p class="text-red-600 dark:text-red-400 mt-2">Error: ${error.message}</p>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-4">This is likely due to a security rule preventing access. Please ensure your Firestore rules allow public reads on cards for sale.</p>
                    </div>`;
            }
            showMessage(errorMessage);
        } finally {
            isLoading = false;
             // Ensure any remaining skeletons are removed
            document.querySelectorAll('.skeleton').forEach(el => el.parentElement.remove());
        }
    };
    
    // --- Event Listeners ---
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loadMarketplaceCards(true); // isNewSearch = true
    });
    
    sortByEl.addEventListener('change', () => loadMarketplaceCards(true));
    
    // Use event delegation for the "Load More" button
    document.body.addEventListener('click', (e) => {
        if (e.target.id === 'load-more-btn') {
            e.target.disabled = true;
            e.target.textContent = 'Loading...';
            loadMarketplaceCards(false); // isNewSearch = false
        }
    });
    
    // --- Initial Load ---
    loadMarketplaceCards(true);
});
