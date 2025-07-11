/**
 * HatakeSocial - Marketplace Page Script (v30 - Final Merge & Fix)
 *
 * This version provides a complete, merged script to fix all outstanding marketplace issues.
 * - FIX: Correctly fetches and displays seller city and country, resolving the "from N/A" bug.
 * - FIX: Ensures the "Propose Trade" button link is correctly generated so the trade modal opens automatically.
 * - Retains all advanced search and filtering functionality.
 * - Includes robust error handling for missing database indexes.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const marketplaceGrid = document.getElementById('marketplace-grid');
    if (!marketplaceGrid) return;

    if (!user) {
        document.querySelector('main.container').innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">Please log in to view the marketplace.</p>';
        return;
    }

    const loader = document.getElementById('marketplace-loader');
    const searchForm = document.getElementById('marketplace-search-form');
    const sortByEl = document.getElementById('sort-by');
    const currencyLabel = document.getElementById('currency-label');

    if(currencyLabel) currencyLabel.textContent = window.HatakeSocial.currentCurrency;

    let lastVisible = null;
    const PAGE_SIZE = 24;
    let isLoading = false;

    const generateIndexCreationLink = (fields) => {
        const projectId = db.app.options.projectId;
        let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=collection`;
        fields.forEach(field => {
            url += `&fields=${field.name},${field.order.toUpperCase()}`;
        });
        return url;
    };

    const resetAndLoadCards = () => {
        lastVisible = null;
        marketplaceGrid.innerHTML = '';
        const existingBtn = document.getElementById('load-more-btn');
        if (existingBtn) existingBtn.remove();
        loadMarketplaceCards(true);
    };

    const loadMarketplaceCards = async (isNewSearch = false) => {
        if (isLoading) return;
        isLoading = true;
        loader.style.display = 'block';

        if (isNewSearch) {
            lastVisible = null;
            marketplaceGrid.innerHTML = '';
        }

        const loadMoreBtn = document.getElementById('load-more-btn');
        if(loadMoreBtn) loadMoreBtn.remove();
        
        let indexFields = [{ name: 'forSale', order: 'asc' }];

        try {
            let query = db.collectionGroup('collection').where('forSale', '==', true);
            
            const tcgFilter = document.getElementById('filter-tcg').value;
            if (tcgFilter !== 'all') {
                query = query.where('tcg', '==', tcgFilter);
                indexFields.push({ name: 'tcg', order: 'asc' });
            }

            const [sortField, sortDirection] = sortByEl.value.split('_');
            query = query.orderBy(sortField, sortDirection);
            indexFields.push({ name: sortField, order: sortDirection });

            if (lastVisible) {
                query = query.startAfter(lastVisible);
            }
            
            query = query.limit(PAGE_SIZE);

            const snapshot = await query.get();
            
            if (snapshot.empty && isNewSearch) {
                 marketplaceGrid.innerHTML = `<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">No cards found for the current filters.</p>`;
                 return;
            }

            lastVisible = snapshot.docs[snapshot.docs.length - 1];
            
            const sellerIds = [...new Set(snapshot.docs.map(doc => doc.ref.parent.parent.id))];
            if (sellerIds.length === 0) {
                 if (isNewSearch) marketplaceGrid.innerHTML = `<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">No cards found for the current filters.</p>`;
                 return;
            }

            const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
            const sellerDocs = await Promise.all(sellerPromises);
            
            const sellers = new Map();
            sellerDocs.forEach(doc => {
                if (doc.exists) sellers.set(doc.id, doc.data());
            });

            let cards = snapshot.docs.map(doc => ({
                id: doc.id,
                sellerData: sellers.get(doc.ref.parent.parent.id) || null,
                ...doc.data(),
            })).filter(card => card.sellerData);

            const cardName = document.getElementById('search-card-name').value.trim().toLowerCase();
            const condition = document.getElementById('filter-condition').value;
            const country = document.getElementById('filter-country').value.trim().toLowerCase();
            const foil = document.getElementById('filter-foil').value;
            const maxPrice = parseFloat(document.getElementById('filter-price').value);

            if (cardName) cards = cards.filter(c => c.name.toLowerCase().includes(cardName));
            if (condition !== 'any') cards = cards.filter(c => c.condition === condition);
            if (country) cards = cards.filter(c => c.sellerData.country?.toLowerCase().includes(country));
            if (foil !== 'any') cards = cards.filter(c => c.isFoil === (foil === 'yes'));
            if (!isNaN(maxPrice) && maxPrice > 0) {
                 cards = cards.filter(c => {
                    const priceInUserCurrency = parseFloat(window.HatakeSocial.convertAndFormatPrice(c.salePrice, c.sellerData.primaryCurrency).split(' ')[0]);
                    return priceInUserCurrency <= maxPrice;
                });
            }

            renderMarketplace(cards, snapshot.docs.length === PAGE_SIZE);

        } catch (error) {
            console.error("Error loading marketplace:", error);
            let errorMessage;
            if (error.code === 'failed-precondition') {
                 const indexLink = generateIndexCreationLink(indexFields);
                 errorMessage = `
                    <div class="col-span-full text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">
                        <p class="font-bold text-red-700 dark:text-red-300">Database Error: Missing Index</p>
                        <p class="text-red-600 dark:text-red-400 mt-2">To perform this search or sort, a database index is required.</p>
                        <a href="${indexLink}" target="_blank" rel="noopener noreferrer" 
                           class="mt-4 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700">
                           Click Here to Create the Index
                        </a>
                        <p class="text-xs text-gray-500 mt-2">This opens the Firebase console. Click "Save" to create the index (it may take a few minutes), then refresh this page.</p>
                    </div>
                 `;
            } else {
                errorMessage = `<p class="text-red-500 p-4 text-center col-span-full">An error occurred: ${error.message}</p>`;
            }
            marketplaceGrid.innerHTML = errorMessage;
        } finally {
            isLoading = false;
            loader.style.display = 'none';
        }
    };

    const renderMarketplace = (cards, hasMore) => {
        if (cards.length === 0 && marketplaceGrid.children.length === 0) {
            marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500 dark:text-gray-400 p-8">No cards matched your specific filters.</p>';
            return;
        }
        
        cards.forEach(card => {
            const seller = card.sellerData;
            const overallRating = (((seller.averageAccuracy || 0) + (seller.averagePackaging || 0)) / 2).toFixed(1);
            const priceDisplay = card.salePrice > 0 
                ? window.HatakeSocial.convertAndFormatPrice(card.salePrice, seller.primaryCurrency || 'SEK')
                : 'For Trade';
            
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 flex flex-col group transition hover:shadow-xl hover:-translate-y-1';
            cardEl.innerHTML = `
                <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block h-full flex flex-col">
                    <div class="relative w-full">
                        <img src="${card.imageUrl}" alt="${card.name}" 
                             class="w-full rounded-md mb-2 aspect-[5/7] object-cover" 
                             onerror="this.onerror=null;this.src='https://placehold.co/223x310';">
                    </div>
                    <div class="flex-grow flex flex-col p-1">
                        <h4 class="font-bold text-sm truncate flex-grow text-gray-800 dark:text-white" title="${card.name}">
                            ${card.name}
                        </h4>
                        <p class="text-blue-600 dark:text-blue-400 font-semibold text-lg mt-1">
                            ${priceDisplay}
                        </p>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                             <p title="Seller Rating: ${overallRating}">★ ${overallRating} | from ${seller.city || 'N/A'}, ${seller.country || 'N/A'}</p>
                        </div>
                    </div>
                </a>
                <a href="trades.html?propose_to_card=${card.id}" 
                   class="propose-trade-btn mt-2 w-full text-center bg-green-600 text-white text-xs font-bold py-1 rounded-full hover:bg-green-700">
                    Propose Trade
                </a>
            `;
            marketplaceGrid.appendChild(cardEl);
        });

        if (hasMore) {
            const newLoadMoreBtn = document.createElement('button');
            newLoadMoreBtn.id = 'load-more-btn';
            newLoadMoreBtn.className = 'col-span-full mt-6 px-6 py-3 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 transition';
            newLoadMoreBtn.textContent = 'Load More Cards';
            newLoadMoreBtn.addEventListener('click', () => loadMarketplaceCards());
            marketplaceGrid.insertAdjacentElement('afterend', newLoadMoreBtn);
        }
    };

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        resetAndLoadCards();
    });
    
    sortByEl.addEventListener('change', resetAndLoadCards);
    
    resetAndLoadCards();
});
