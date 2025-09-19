/**
 * HatakeSocial - Marketplace Page Logic (FULLY RESTORED & FIXED)
 *
 * Fetches, filters, and displays card listings from all users.
 * Uses the centralized currency module for all price conversions and display.
 * Includes the restored card hover-preview functionality and corrected card view links.
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
        // Correctly query the 'marketplaceListings' collection.
        const listingsRef = db.collection('marketplaceListings');
        const querySnapshot = await listingsRef.orderBy('listedAt', 'desc').get();

        allListings = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

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
        const cardData = listing.cardData;
        const sellerData = listing.sellerData;
        const imageUrl = cardData.image_uris?.normal || 'https://placehold.co/223x310?text=No+Image';
        const displayPrice = convertAndFormat(listing.price);

        const cardElement = document.createElement('div');
        cardElement.className = 'card-container group relative rounded-lg overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-200 shadow-lg bg-white dark:bg-gray-800 flex flex-col';
        cardElement.dataset.imageUrl = imageUrl;
        // Corrected link to match card-view.js expectations
        cardElement.onclick = () => window.location.href = `card-view.html?id=${listing.id}`;

        cardElement.innerHTML = `
            <div class="relative">
                <img src="${imageUrl}" alt="${cardData.name}" class="w-full h-auto object-cover">
                <div class="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">${displayPrice}</div>
            </div>
            <div class="p-2 flex-grow flex flex-col justify-between">
                <div>
                    <h3 class="font-bold text-sm truncate">${cardData.name}</h3>
                    <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1 mt-1">
                        <p><strong>Condition:</strong> ${listing.condition}</p>
                        ${listing.isFoil ? '<p class="text-blue-400 font-semibold">Foil</p>' : ''}
                    </div>
                </div>
                <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center space-x-2">
                    <img src="${sellerData.photoURL}" alt="${sellerData.displayName}" class="w-6 h-6 rounded-full">
                    <span class="text-xs font-semibold truncate">${sellerData.displayName}</span>
                    <span class="text-xs" title="${sellerData.country}"><i class="fas fa-globe-americas"></i></span>
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
        const cardData = listing.cardData;
        const sellerData = listing.sellerData;
        const displayPrice = convertAndFormat(listing.price);
        const imageUrl = cardData.image_uris?.small || 'https://placehold.co/32';

        tableHTML += `
            <tr class="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick="window.location.href='card-view.html?id=${listing.id}'">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-8"><img class="h-10 w-8 rounded object-cover card-preview-trigger" src="${imageUrl}" alt=""></div>
                        <div class="ml-4"><div class="text-sm font-medium text-gray-900 dark:text-white">${cardData.name} ${listing.isFoil ? '<i class="fas fa-star text-yellow-400 text-xs ml-1" title="Foil"></i>' : ''}</div></div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${cardData.set_name}</td>
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
    const selectedGameValue = gameFilter.value;
    let gameToFilter = selectedGameValue;
    if (selectedGameValue === 'Magic: The Gathering') {
        gameToFilter = 'mtg';
    } else if (selectedGameValue === 'Pokémon') {
        gameToFilter = 'pokemon';
    }
    const selectedSet = setFilter.value;
    const minPrice = parseFloat(minPriceInput.value);
    const maxPrice = parseFloat(maxPriceInput.value);
    const selectedConditions = Array.from(conditionFiltersContainer.querySelectorAll('input:checked')).map(cb => cb.value);
    const showFoilOnly = foilFilter.checked;
    const sellerLocation = locationFilter.value.toLowerCase();

    if (searchTerm) listings = listings.filter(l => l.cardData.name.toLowerCase().includes(searchTerm));
    if (gameToFilter !== 'all') listings = listings.filter(l => l.cardData.game === gameToFilter);

    populateSetFilter(listings);

    if (selectedSet !== 'all') listings = listings.filter(l => l.cardData.set_name === selectedSet);
    if (!isNaN(minPrice)) listings = listings.filter(l => l.price >= minPrice);
    if (!isNaN(maxPrice)) listings = listings.filter(l => l.price <= maxPrice);
    if (selectedConditions.length > 0) listings = listings.filter(l => selectedConditions.includes(l.condition));
    if (showFoilOnly) listings = listings.filter(l => l.isFoil);
    if (sellerLocation) listings = listings.filter(l => l.sellerData.country && l.sellerData.country.toLowerCase().includes(sellerLocation));

    const sortBy = sortOptions.value;
    switch (sortBy) {
        case 'price-asc':
            listings.sort((a, b) => a.price - b.price);
            break;
        case 'price-desc':
            listings.sort((a, b) => b.price - a.price);
            break;
        case 'newly-listed':
        default:
             listings.sort((a, b) => (b.listedAt?.seconds || 0) - (a.listedAt?.seconds || 0));
    }

    filteredListings = listings;
    renderListings();
}

function populateSetFilter(listings = allListings) {
    const currentSetValue = setFilter.value;
    const setNames = [...new Set(listings.map(l => l.cardData.set_name))].sort();

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

    document.addEventListener('currencyChanged', renderListings);
});