/**
 * HatakeSocial - Marketplace Page Logic (FULLY RESTORED & FIXED)
 *
 * Fetches, filters, and displays card listings from all users.
 * Uses the centralized currency module for all price conversions and display.
 * Includes the restored card hover-preview functionality.
 */

// --- CORRECTED IMPORT PATH ---
import { convertAndFormat } from './modules/currency.js';

// --- STATE MANAGEMENT ---
let allListings = [];
let filteredListings = [];
let currentView = 'grid';

// --- DOM ELEMENT REFERENCES ---
const listingsContainer = document.getElementById('listingsContainer');
const mainSearchInput = document.getElementById('main-search-bar');
const gameFilter = document.getElementById('gameFilter');
const setFilter = document.getElementById('setFilter');
const minPriceInput = document.getElementById('minPrice');
const maxPriceInput = document.getElementById('maxPrice');
const conditionFiltersContainer = document.getElementById('conditionFilters');
const foilFilter = document.getElementById('foilFilter');
const locationFilter = document.getElementById('locationFilter');
const sortOptions = document.getElementById('sortOptions');
const gridViewBtn = document.getElementById('gridViewBtn');
const listViewBtn = document.getElementById('listViewBtn');
const toggleAdvancedFiltersBtn = document.getElementById('toggleAdvancedFilters');
const advancedFiltersContainer = document.getElementById('advancedFilters');
const tooltip = document.getElementById('card-preview-tooltip');


// --- UTILITY FUNCTIONS ---
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};

// --- DATA FETCHING ---
async function fetchMarketplaceData() {
    listingsContainer.innerHTML = `
        <div class="col-span-full text-center p-10">
            <i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i>
            <p class="mt-2 text-gray-600 dark:text-gray-400">Loading Listings...</p>
        </div>`;

    try {
        const db = firebase.firestore();
        const listingsRef = db.collectionGroup('forSale');
        const querySnapshot = await listingsRef.orderBy('listedAt', 'desc').get();

        allListings = querySnapshot.docs.map(doc => ({
            id: doc.id,
            sellerId: doc.ref.parent.parent.id, // Get sellerId from path
            ...doc.data()
        }));
        
        // Post-process to add seller data
        const sellerIds = [...new Set(allListings.map(l => l.sellerId))];
        const sellerPromises = sellerIds.map(id => db.collection('users').doc(id).get());
        const sellerDocs = await Promise.all(sellerPromises);
        const sellerMap = new Map();
        sellerDocs.forEach(doc => {
            if(doc.exists) sellerMap.set(doc.id, doc.data());
        });

        allListings.forEach(listing => {
            const seller = sellerMap.get(listing.sellerId) || {};
            listing.sellerData = {
                uid: listing.sellerId,
                displayName: seller.displayName || 'Unknown Seller',
                photoURL: seller.photoURL || 'https://placehold.co/32',
                country: seller.address?.country || 'N/A'
            };
        });


        filteredListings = [...allListings];

        if (allListings.length === 0) {
            listingsContainer.innerHTML = `<p class="col-span-full text-center text-gray-500 dark:text-gray-400 py-10">The marketplace is currently empty.</p>`;
        } else {
            populateSetFilter();
            renderListings();
        }

    } catch (error) {
        console.error("Error fetching marketplace listings:", error);
        listingsContainer.innerHTML = `<p class="text-center text-red-500 py-10">Could not load listings. Please try again later.</p>`;
    }
}

// --- RENDERING LOGIC ---
function renderListings() {
    listingsContainer.innerHTML = '';
    if (filteredListings.length === 0) {
        listingsContainer.innerHTML = `<p class="col-span-full text-center text-gray-500 dark:text-gray-400 py-10">No cards found. Try adjusting your filters.</p>`;
        return;
    }
    if (currentView === 'grid') {
        renderGridView();
    } else {
        renderListView();
    }
}

function renderGridView() {
    listingsContainer.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4';
    const fragment = document.createDocumentFragment();

    filteredListings.forEach(listing => {
        const imageUrl = listing.image_uris?.normal || 'https://placehold.co/223x310?text=No+Image';
        const displayPrice = convertAndFormat(listing.salePrice);

        const cardElement = document.createElement('div');
        cardElement.className = 'card-container group relative rounded-lg overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-200 shadow-lg bg-white dark:bg-gray-800';
        cardElement.dataset.imageUrl = imageUrl;
        cardElement.onclick = () => window.location.href = `listing.html?sellerId=${listing.sellerId}&listingId=${listing.id}`;

        cardElement.innerHTML = `
            <img src="${imageUrl}" alt="${listing.name}" class="w-full h-auto object-cover">
            <div class="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">${displayPrice}</div>
            <div class="p-2">
                <h3 class="font-bold text-sm truncate">${listing.name}</h3>
                <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1 mt-1">
                    <p><strong>Condition:</strong> ${listing.condition}</p>
                    ${listing.is_foil ? '<p class="text-blue-400 font-semibold">Foil</p>' : ''}
                </div>
            </div>
        `;
        fragment.appendChild(cardElement);
    });
    listingsContainer.appendChild(fragment);
}

function renderListView() {
    listingsContainer.className = 'overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700';
    let tableHTML = `
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Card Name</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Set</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Condition</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Price</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Seller</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">`;

    filteredListings.forEach(listing => {
        const sellerData = listing.sellerData;
        const displayPrice = convertAndFormat(listing.salePrice);
        const imageUrl = listing.image_uris?.small || 'https://placehold.co/32';

        tableHTML += `
            <tr class="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick="window.location.href='listing.html?sellerId=${listing.sellerId}&listingId=${listing.id}'">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-8"><img class="h-10 w-8 rounded object-cover card-preview-trigger" src="${imageUrl}" alt=""></div>
                        <div class="ml-4"><div class="text-sm font-medium text-gray-900 dark:text-white">${listing.name} ${listing.is_foil ? '<i class="fas fa-star text-yellow-400 text-xs ml-1" title="Foil"></i>' : ''}</div></div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${listing.set_name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${listing.condition}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400">${displayPrice}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <a href="/profile.html?uid=${sellerData.uid}" onclick="event.stopPropagation()" class="flex items-center space-x-2 group">
                        <img class="h-8 w-8 rounded-full" src="${sellerData.photoURL}" alt="">
                        <div>
                            <div class="text-sm font-medium text-gray-900 dark:text-white group-hover:underline">${sellerData.displayName}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">${sellerData.country}</div>
                        </div>
                    </a>
                </td>
            </tr>`;
    });

    tableHTML += `</tbody></table>`;
    listingsContainer.innerHTML = tableHTML;
}


// --- FILTERING AND SORTING LOGIC ---
function applyFiltersAndSort() {
    let listings = [...allListings];

    const searchTerm = mainSearchInput.value.toLowerCase();
    const selectedGame = gameFilter.value;
    const selectedSet = setFilter.value;
    const minPrice = parseFloat(minPriceInput.value);
    const maxPrice = parseFloat(maxPriceInput.value);
    const selectedConditions = Array.from(conditionFiltersContainer.querySelectorAll('input:checked')).map(cb => cb.value);
    const showFoilOnly = foilFilter.checked;
    const sellerLocation = locationFilter.value.toLowerCase();

    if (searchTerm) listings = listings.filter(l => l.name.toLowerCase().includes(searchTerm));
    if (selectedGame !== 'all') listings = listings.filter(l => l.game === selectedGame);

    populateSetFilter(listings);

    if (selectedSet !== 'all') listings = listings.filter(l => l.set_name === selectedSet);
    if (!isNaN(minPrice)) listings = listings.filter(l => l.salePrice >= minPrice);
    if (!isNaN(maxPrice)) listings = listings.filter(l => l.salePrice <= maxPrice);
    if (selectedConditions.length > 0) listings = listings.filter(l => selectedConditions.includes(l.condition));
    if (showFoilOnly) listings = listings.filter(l => l.is_foil);
    if (sellerLocation) listings = listings.filter(l => l.sellerData.country && l.sellerData.country.toLowerCase().includes(sellerLocation));

    const sortBy = sortOptions.value;
    switch (sortBy) {
        case 'price-asc':
            listings.sort((a, b) => a.salePrice - b.salePrice);
            break;
        case 'price-desc':
            listings.sort((a, b) => b.salePrice - a.salePrice);
            break;
        case 'newly-listed':
        default:
            listings.sort((a, b) => b.listedAt.seconds - a.listedAt.seconds);
    }

    filteredListings = listings;
    renderListings();
}

function populateSetFilter(listings = allListings) {
    const currentSetValue = setFilter.value;
    const setNames = [...new Set(listings.map(l => l.set_name))].sort();

    setFilter.innerHTML = '<option value="all">All Sets</option>';
    setNames.forEach(setName => {
        const option = document.createElement('option');
        option.value = setName;
        option.textContent = setName;
        setFilter.appendChild(option);
    });

    if (setNames.includes(currentSetValue)) {
        setFilter.value = currentSetValue;
    }
}

// --- EVENT LISTENERS ---
document.addEventListener('authReady', ({ detail: { user } }) => {
    if (!user) {
        listingsContainer.innerHTML = `<div class="col-span-full text-center p-8"><h2 class="text-xl font-bold">Please log in to view the marketplace.</h2></div>`;
        return;
    }
    
    fetchMarketplaceData();

    mainSearchInput.addEventListener('input', debounce(applyFiltersAndSort, 300));
    gameFilter.addEventListener('change', applyFiltersAndSort);
    setFilter.addEventListener('change', applyFiltersAndSort);
    minPriceInput.addEventListener('input', debounce(applyFiltersAndSort, 500));
    maxPriceInput.addEventListener('input', debounce(applyFiltersAndSort, 500));
    foilFilter.addEventListener('change', applyFiltersAndSort);
    locationFilter.addEventListener('input', debounce(applyFiltersAndSort, 300));
    sortOptions.addEventListener('change', applyFiltersAndSort);
    conditionFiltersContainer.addEventListener('change', applyFiltersAndSort);

    gridViewBtn.addEventListener('click', () => {
        currentView = 'grid';
        gridViewBtn.classList.add('bg-blue-600', 'text-white');
        listViewBtn.classList.remove('bg-blue-600', 'text-white');
        renderListings();
    });

    listViewBtn.addEventListener('click', () => {
        currentView = 'list';
        listViewBtn.classList.add('bg-blue-600', 'text-white');
        gridViewBtn.classList.remove('bg-blue-600', 'text-white');
        renderListings();
    });

    toggleAdvancedFiltersBtn.addEventListener('click', () => {
        advancedFiltersContainer.classList.toggle('hidden');
        const isHidden = advancedFiltersContainer.classList.contains('hidden');
        toggleAdvancedFiltersBtn.innerHTML = isHidden 
            ? 'Show Advanced Filters <i class="fas fa-chevron-down ml-1"></i>' 
            : 'Hide Advanced Filters <i class="fas fa-chevron-up ml-1"></i>';
    });

    // --- RESTORED: Card hover preview functionality ---
    const handleMouseOver = (e) => {
        const cardElement = e.target.closest('.card-container');
        const listCardElement = e.target.closest('.card-preview-trigger');
        let imageUrl = null;
        if (cardElement && cardElement.dataset.imageUrl) {
            imageUrl = cardElement.dataset.imageUrl;
        } else if (listCardElement) {
            imageUrl = listCardElement.src.replace('small', 'large');
        }
        if (imageUrl && tooltip) {
            let img = tooltip.querySelector('img');
            if (!img) {
                tooltip.innerHTML = '<img alt="Card Preview" class="w-full rounded-lg" src=""/>';
                img = tooltip.querySelector('img');
            }
            img.src = imageUrl;
            tooltip.classList.remove('hidden');
        }
    };
    
    listingsContainer.addEventListener('mouseover', handleMouseOver);
    listingsContainer.addEventListener('mouseout', () => {
        if (tooltip) tooltip.classList.add('hidden');
    });
    listingsContainer.addEventListener('mousemove', (e) => {
        if (tooltip && !tooltip.classList.contains('hidden')) {
            const mouseX = e.clientX, mouseY = e.clientY;
            const tooltipWidth = 240;
            const aspectRatio = 3.5 / 2.5;
            const tooltipHeight = tooltipWidth * aspectRatio;
            let left = mouseX + 20;
            let top = mouseY + 20;

            if (left + tooltipWidth > window.innerWidth - 15) left = mouseX - tooltipWidth - 20;
            if (top + tooltipHeight > window.innerHeight - 15) top = window.innerHeight - tooltipHeight - 15;
            if (left < 15) left = 15;
            if (top < 15) top = 15;

            tooltip.style.width = `${tooltipWidth}px`;
            tooltip.style.height = `auto`;
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        }
    });

    // Re-render when currency changes
    document.addEventListener('currencyChange', renderListings);
});

