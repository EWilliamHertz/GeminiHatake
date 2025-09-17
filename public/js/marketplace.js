/**
 * @file public/js/marketplace.js
 * @description Handles all logic for the TCG Marketplace page for HatakeSocial.
 * @note This script uses the Firebase v9 compat libraries.
 */

// Import currency module for price conversion
import * as Currency from './modules/currency.js';

// --- STATE MANAGEMENT ---
let allListings = [];           // Master list of all listings from Firestore
let filteredListings = [];      // Listings after filters and sorting are applied
let currentView = 'grid';       // 'grid' or 'list'
let isInitialized = false;      // Prevents double initialization

// --- DOM ELEMENT REFERENCES ---
const listingsContainer = document.getElementById('listingsContainer');
const mainSearchInput = document.getElementById('mainSearch');
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
        <div class="text-center p-10">
            <i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i>
            <p class="mt-2 text-gray-600 dark:text-gray-400">Loading Listings...</p>
        </div>`;

    try {
        // Using compat syntax
        const db = firebase.firestore();
        const listingsRef = db.collection('marketplaceListings');
        const querySnapshot = await listingsRef.orderBy('timestamp', 'desc').get();

        allListings = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        filteredListings = [...allListings];

        if (allListings.length === 0) {
            listingsContainer.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 py-10">The marketplace is currently empty.</p>`;
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
        listingsContainer.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 py-10">No cards found. Try adjusting your filters.</p>`;
        return;
    }

    if (currentView === 'grid') {
        renderGridView();
    } else {
        renderListView();
    }
}

function renderGridView() {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4';

    filteredListings.forEach(listing => {
        const cardData = listing.cardData;
        const sellerData = listing.sellerData;
        const imageUrl = cardData.image_uris?.large || cardData.image_uris?.normal || cardData.image_uris?.small || 'https://placehold.co/223x310?text=No+Image';

        // Convert price based on source - SEK prices from marketplace listings
        const displayPrice = Currency.convertFromSekAndFormat(listing.price);

        const cardElement = document.createElement('div');
        cardElement.className = 'group relative rounded-lg overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-200 shadow-lg';

        cardElement.onclick = () => window.location.href = `/card-view.html?id=${listing.id}`;

        cardElement.innerHTML = `
            <img src="${imageUrl}" alt="${cardData.name}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black bg-opacity-80 flex flex-col justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <h3 class="text-sm font-bold text-white truncate">${cardData.name}</h3>
                <p class="text-xs text-blue-400 font-semibold">${displayPrice}</p>
                <p class="text-xs text-gray-300">${listing.condition} ${listing.isFoil ? '• Foil' : ''}</p>
                <div class="mt-1 border-t border-gray-600 pt-1">
                    <a href="/profile.html?uid=${sellerData.uid}" onclick="event.stopPropagation()" class="flex items-center space-x-1 group/seller">
                        <img src="${sellerData.photoURL || 'https://placehold.co/24'}" class="w-5 h-5 rounded-full">
                        <span class="text-xs text-gray-400 group-hover/seller:text-white truncate">${sellerData.displayName}</span>
                    </div>
                </div>
            </div>
        </div>`;

        grid.appendChild(cardElement);
    });

    listingsContainer.appendChild(grid);
}

function renderListView() {
    const tableContainer = document.createElement('div');
    tableContainer.className = 'overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700';

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

        // Convert price based on source - SEK prices from marketplace listings
        const displayPrice = Currency.convertFromSekAndFormat(listing.price);

        tableHTML += `
            <tr class="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick="window.location.href='/card-view.html?id=${listing.id}'">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-8">
                            <img class="h-10 w-8 rounded object-cover" src="${cardData.image_uris?.small || 'https://placehold.co/32'}" alt="">
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-white">${cardData.name} ${listing.isFoil ? '<i class="fas fa-star text-yellow-400 text-xs ml-1" title="Foil"></i>' : ''}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${cardData.set_name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${listing.condition}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400">${displayPrice}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <a href="/profile.html?uid=${sellerData.uid}" onclick="event.stopPropagation()" class="flex items-center space-x-2 group">
                        <img class="h-8 w-8 rounded-full" src="${sellerData.photoURL || 'https://placehold.co/32'}" alt="">
                        <div>
                            <div class="text-sm font-medium text-gray-900 dark:text-white group-hover:underline">${sellerData.displayName}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">${sellerData.country || 'N/A'}</div>
                        </div>
                    </a>
                </td>
            </tr>`;
    });

    tableHTML += `</tbody></table>`;
    tableContainer.innerHTML = tableHTML;
    listingsContainer.appendChild(tableContainer);
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

    if (searchTerm) listings = listings.filter(l => l.cardData.name.toLowerCase().includes(searchTerm));
    if (selectedGame !== 'all') listings = listings.filter(l => l.cardData.game === selectedGame);

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
            listings.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
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
document.addEventListener('DOMContentLoaded', () => {
    // Initialize currency system with SEK as default (Hatake website preference)
    Currency.initCurrency('SEK');
    
    fetchMarketplaceData();

    // Search and filter event listeners
    mainSearchInput.addEventListener('input', debounce(applyFiltersAndSort, 300));
    gameFilter.addEventListener('change', applyFiltersAndSort);
    setFilter.addEventListener('change', applyFiltersAndSort);
    minPriceInput.addEventListener('input', debounce(applyFiltersAndSort, 500));
    maxPriceInput.addEventListener('input', debounce(applyFiltersAndSort, 500));
    foilFilter.addEventListener('change', applyFiltersAndSort);
    locationFilter.addEventListener('input', debounce(applyFiltersAndSort, 300));
    sortOptions.addEventListener('change', applyFiltersAndSort);

    // View toggle event listeners
    gridViewBtn.addEventListener('click', () => {
        currentView = 'grid';
        gridViewBtn.classList.add('bg-blue-500', 'text-white');
        gridViewBtn.classList.remove('bg-gray-200', 'text-gray-700');
        listViewBtn.classList.add('bg-gray-200', 'text-gray-700');
        listViewBtn.classList.remove('bg-blue-500', 'text-white');
        renderListings();
    });

    listViewBtn.addEventListener('click', () => {
        currentView = 'list';
        listViewBtn.classList.add('bg-blue-500', 'text-white');
        listViewBtn.classList.remove('bg-gray-200', 'text-gray-700');
        gridViewBtn.classList.add('bg-gray-200', 'text-gray-700');
        gridViewBtn.classList.remove('bg-blue-500', 'text-white');
        renderListings();
    });

    // Advanced filters toggle
    toggleAdvancedFiltersBtn.addEventListener('click', () => {
        advancedFiltersContainer.classList.toggle('hidden');
        const isHidden = advancedFiltersContainer.classList.contains('hidden');
        toggleAdvancedFiltersBtn.textContent = isHidden ? 'Show Advanced Filters' : 'Hide Advanced Filters';
    });

    // Condition filter checkboxes
    conditionFiltersContainer.addEventListener('change', applyFiltersAndSort);
});

