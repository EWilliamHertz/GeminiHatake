// public/js/marketplace.js

/**
 * @file public/js/marketplace.js
 * @description Handles all logic for the TCG Marketplace page for HatakeSocial.
 * @note This script uses the Firebase v9 compat libraries.
 */

// Import currency module for price conversion
import * as Currency from './modules/currency.js';
import { createCurrencySelector } from './modules/ui.js';

// --- STATE MANAGEMENT ---
let allListings = [];           // Master list of all listings from Firestore
let filteredListings = [];      // Listings after filters and sorting are applied
let currentView = 'grid';       // 'grid' or 'list'

// --- DOM ELEMENT REFERENCES ---
const listingsContainer = document.getElementById('listingsContainer');
const mainSearchInput = document.getElementById('main-search-bar'); // Use the header search bar
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
        const imageUrl = cardData.image_uris?.large || cardData.image_uris?.normal || 'https://placehold.co/223x310?text=No+Image';
        const displayPrice = Currency.convertAndFormat(listing.price);

        const cardElement = document.createElement('div');
        cardElement.className = 'card-container group relative rounded-lg overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-200 shadow-lg bg-gray-200 dark:bg-gray-800';
        cardElement.dataset.imageUrl = imageUrl;

        cardElement.onclick = () => window.location.href = `/card-view.html?id=${listing.id}`;

        cardElement.innerHTML = `
            <img src="${imageUrl}" alt="${cardData.name}" class="w-full h-auto object-cover rounded-t-lg">
            <div class="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">${displayPrice}</div>
            <div class="p-2">
                <h3 class="font-bold text-sm truncate">${cardData.name}</h3>
                <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1 mt-1">
                    <p><strong>Condition:</strong> ${listing.condition}</p>
                    ${listing.isFoil ? '<p class="text-blue-400 font-semibold">Foil</p>' : ''}
                    <p class="truncate"><strong>Notes:</strong> ${listing.notes || 'None'}</p>
                </div>
            </div>
        `;
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
        const displayPrice = Currency.convertAndFormat(listing.price);
        const imageUrl = cardData.image_uris?.small || 'https://placehold.co/32';

        tableHTML += `
            <tr class="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onclick="window.location.href='/card-view.html?id=${listing.id}'">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-8">
                            <img class="h-10 w-8 rounded object-cover card-preview-trigger" src="${imageUrl}" alt="">
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
document.addEventListener('DOMContentLoaded', async () => {
    await Currency.initCurrency();
    createCurrencySelector('user-actions');
    
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
        gridViewBtn.classList.add('bg-blue-600', 'text-white');
        gridViewBtn.classList.remove('text-gray-500', 'dark:text-gray-400', 'hover:bg-gray-300', 'dark:hover:bg-gray-600');
        listViewBtn.classList.add('text-gray-500', 'dark:text-gray-400', 'hover:bg-gray-300', 'dark:hover:bg-gray-600');
        listViewBtn.classList.remove('bg-blue-600', 'text-white');
        renderListings();
    });

    listViewBtn.addEventListener('click', () => {
        currentView = 'list';
        listViewBtn.classList.add('bg-blue-600', 'text-white');
        listViewBtn.classList.remove('text-gray-500', 'dark:text-gray-400', 'hover:bg-gray-300', 'dark:hover:bg-gray-600');
        gridViewBtn.classList.add('text-gray-500', 'dark:text-gray-400', 'hover:bg-gray-300', 'dark:hover:bg-gray-600');
        gridViewBtn.classList.remove('bg-blue-600', 'text-white');
        renderListings();
    });
    
    // Card hover preview functionality
    const tooltip = document.getElementById('card-preview-tooltip');
    
    // Updated mouseover event listener to handle card preview
    const handleMouseOver = (e) => {
        const cardElement = e.target.closest('.card-container');
        const listCardElement = e.target.closest('.card-preview-trigger');

        let imageUrl = null;
        if (cardElement && cardElement.dataset.imageUrl) {
            imageUrl = cardElement.dataset.imageUrl;
        } else if (listCardElement) {
            imageUrl = listCardElement.src.replace('small', 'large');
        }

        if (imageUrl) {
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
        tooltip.classList.add('hidden');
    });
    listingsContainer.addEventListener('mousemove', (e) => {
        if (!tooltip.classList.contains('hidden')) {
            const mouseX = e.clientX, mouseY = e.clientY;
            
            // Calculate tooltip size based on viewport width
            const viewportWidth = window.innerWidth;
            let tooltipWidth = 260; // Default width
            if (viewportWidth < 640) {
                tooltipWidth = viewportWidth * 0.5; // 50% of viewport width on small screens
            } else if (viewportWidth < 1024) {
                tooltipWidth = 220; // A bit smaller on medium screens
            }

            const aspectRatio = 2.5/3.5; // Standard card aspect ratio
            const tooltipHeight = tooltipWidth / aspectRatio;

            let left = mouseX + 15;
            let top = mouseY + 15;

            // Prevent tooltip from going off-screen to the right
            if (left + tooltipWidth > window.innerWidth - 10) {
                left = mouseX - tooltipWidth - 15;
            }

            // Prevent tooltip from going off-screen to the bottom
            if (top + tooltipHeight > window.innerHeight - 10) {
                top = mouseY - tooltipHeight - 15;
            }

            // Adjust position if it goes off-screen to the left
            if (left < 10) {
                left = 10;
            }

            // Adjust position if it goes off-screen to the top
            if (top < 10) {
                top = 10;
            }

            tooltip.style.width = `${tooltipWidth}px`;
            tooltip.style.height = `${tooltipHeight}px`;
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        }
    });

    // Advanced filters toggle
    toggleAdvancedFiltersBtn.addEventListener('click', () => {
        advancedFiltersContainer.classList.toggle('hidden');
        const isHidden = advancedFiltersContainer.classList.contains('hidden');
        toggleAdvancedFiltersBtn.innerHTML = isHidden 
            ? 'Show Advanced Filters <i class="fas fa-chevron-down ml-1 transition-transform inline-block"></i>' 
            : 'Hide Advanced Filters <i class="fas fa-chevron-up ml-1 transition-transform inline-block"></i>';
    });

    // Condition filter checkboxes
    conditionFiltersContainer.addEventListener('change', applyFiltersAndSort);
    
    // Re-render on currency change
    document.addEventListener('currencyChanged', renderListings);
});