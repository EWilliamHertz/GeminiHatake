// This file is unchanged from the previous version as the logic was already correct.
// The primary issue was in the HTML file's setup.

import {
    getFirestore, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();
let currentUser = null;

// --- DOM Elements ---
const listingsContainer = document.getElementById('listings-container');
const noResultsDiv = document.getElementById('no-results');
const searchInput = document.getElementById('search-input');
const sortOrderSelect = document.getElementById('sort-order') || document.getElementById('sort-by');
const gameFilterContainer = document.getElementById('game-filter-container');
const rarityFilterContainer = document.getElementById('rarity-filter-container');
const gradedFilterCheckbox = document.getElementById('filter-graded');
const gameSpecificFiltersContainer = document.getElementById('game-specific-filters');
const createListingBtn = document.getElementById('create-listing-btn');
const createListingModal = document.getElementById('create-listing-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-btn');
const createListingForm = document.getElementById('create-listing-form');

// --- Configuration ---
const supportedGames = {
    'mtg': 'Magic: The Gathering',
    'pokemon': 'Pokémon',
    'lorcana': 'Lorcana',
    'gundam': 'Gundam'
};
const rarities = ['common', 'uncommon', 'rare', 'mythic', 'promo'];

// --- State ---
let activeFilters = {
    searchText: '',
    games: [],
    rarities: [],
    isGraded: false,
    mtgColors: [],
    pokemonTypes: []
};

// --- Initialization ---
const init = () => {
    onAuthStateChanged(auth, user => {
        currentUser = user;
        setupUI();
        addEventListeners();
        fetchListings();
    });
};

// --- UI Setup ---
const setupUI = () => {
    if (gameFilterContainer) {
        // Clear previous content but keep the title
        gameFilterContainer.innerHTML = '<h3 class="font-semibold">Game</h3>';
        for (const [id, name] of Object.entries(supportedGames)) {
            gameFilterContainer.innerHTML += `
                <label class="flex items-center space-x-2 text-sm font-medium">
                    <input type="checkbox" class="game-filter rounded" value="${id}">
                    <span>${name}</span>
                </label>
            `;
        }
    }

    if (rarityFilterContainer) {
        rarityFilterContainer.innerHTML = '';
        rarities.forEach(rarity => {
            rarityFilterContainer.innerHTML += `
                <label class="flex items-center space-x-2 text-sm font-medium">
                    <input type="checkbox" class="rarity-filter rounded" value="${rarity}">
                    <span class="capitalize">${rarity}</span>
                </label>
            `;
        });
    }

    const gameSelect = document.getElementById('game-select');
    if (gameSelect) {
        gameSelect.innerHTML = '<option value="" disabled selected>Select a game</option>';
        for (const [id, name] of Object.entries(supportedGames)) {
            gameSelect.innerHTML += `<option value="${id}">${name}</option>`;
        }
    }
};

// --- Event Handling ---
const addEventListeners = () => {
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                activeFilters.searchText = searchInput.value.toLowerCase();
                fetchListings();
            }, 300);
        });
    }

    if (sortOrderSelect) sortOrderSelect.addEventListener('change', fetchListings);
    
    if (gradedFilterCheckbox) {
        gradedFilterCheckbox.addEventListener('change', () => {
            activeFilters.isGraded = gradedFilterCheckbox.checked;
            fetchListings();
        });
    }

    if (gameFilterContainer) {
        gameFilterContainer.addEventListener('change', e => {
            if (e.target.classList.contains('game-filter')) {
                activeFilters.games = Array.from(gameFilterContainer.querySelectorAll('.game-filter:checked')).map(el => el.value);
                renderGameSpecificFilters();
                fetchListings();
            }
        });
    }

    if (rarityFilterContainer) {
        rarityFilterContainer.addEventListener('change', e => {
            if (e.target.classList.contains('rarity-filter')) {
                activeFilters.rarities = Array.from(rarityFilterContainer.querySelectorAll('.rarity-filter:checked')).map(el => el.value);
                fetchListings();
            }
        });
    }
    
    if (gameSpecificFiltersContainer) {
        gameSpecificFiltersContainer.addEventListener('change', e => {
            if (e.target.classList.contains('mtg-color-filter')) {
                 activeFilters.mtgColors = Array.from(gameSpecificFiltersContainer.querySelectorAll('.mtg-color-filter:checked')).map(el => el.value);
            }
            if (e.target.id === 'pokemon-type-filter') {
                activeFilters.pokemonTypes = e.target.value ? [e.target.value] : [];
            }
            fetchListings();
        });
    }

    // Modal listeners
    if (createListingBtn) {
        createListingBtn.addEventListener('click', () => {
            if (!currentUser) {
                alert("Please log in to create a listing.");
                window.location.href = '/auth.html';
                return;
            }
            createListingModal.classList.remove('hidden');
        });
    }
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => createListingModal.classList.add('hidden'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => createListingModal.classList.add('hidden'));
    if (createListingModal) createListingModal.addEventListener('click', (e) => {
        if (e.target === createListingModal) {
            createListingModal.classList.add('hidden');
        }
    });
    if (createListingForm) createListingForm.addEventListener('submit', handleCreateListing);
};

const renderGameSpecificFilters = () => {
    if (!gameSpecificFiltersContainer) return;
    gameSpecificFiltersContainer.innerHTML = '';
    activeFilters.mtgColors = [];
    activeFilters.pokemonTypes = [];

    if (activeFilters.games.includes('mtg')) {
        const colors = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
        let colorsHtml = '<div class="pt-4 border-t dark:border-gray-700"><h3 class="font-semibold mb-2">Magic Colors</h3><div class="flex flex-wrap gap-2">';
        for (const [code, name] of Object.entries(colors)) {
            colorsHtml += `
                <label class="flex items-center space-x-1 text-sm">
                    <input type="checkbox" class="mtg-color-filter rounded" value="${code}">
                    <span>${name}</span>
                </label>
            `;
        }
        colorsHtml += '</div></div>';
        gameSpecificFiltersContainer.innerHTML += colorsHtml;
    }

    if (activeFilters.games.includes('pokemon')) {
        const types = ['Colorless', 'Darkness', 'Dragon', 'Fairy', 'Fighting', 'Fire', 'Grass', 'Lightning', 'Metal', 'Psychic', 'Water'];
        let typesHtml = '<div class="pt-4 border-t dark:border-gray-700"><h3 class="font-semibold mb-2">Pokémon Type</h3>';
        typesHtml += '<select id="pokemon-type-filter" class="w-full p-2 rounded bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">';
        typesHtml += '<option value="">All Types</option>';
        types.forEach(type => {
            typesHtml += `<option value="${type}">${type}</option>`;
        });
        typesHtml += '</select></div>';
        gameSpecificFiltersContainer.innerHTML += typesHtml;
    }
};

// --- Core Logic ---
const fetchListings = async () => {
    if (!listingsContainer) return;
    listingsContainer.innerHTML = '<div class="text-center py-10 col-span-full"><p class="text-gray-500">Loading listings...</p></div>';
    if(noResultsDiv) noResultsDiv.classList.add('hidden');

    try {
        let q = query(collection(db, 'marketplaceListings'));

        if (activeFilters.games.length > 0) {
            q = query(q, where('game', 'in', activeFilters.games));
        }
        if (activeFilters.searchText) {
            q = query(q, 
                where('cardName_lowercase', '>=', activeFilters.searchText),
                where('cardName_lowercase', '<=', activeFilters.searchText + '\uf8ff')
            );
        }

        const querySnapshot = await getDocs(q);
        let allListings = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const filteredListings = allListings.filter(listing => {
            const cardData = listing.cardData || {};
            if (activeFilters.rarities.length > 0 && !activeFilters.rarities.includes(cardData.rarity)) return false;
            if (activeFilters.isGraded && !cardData.is_graded) return false;
            if (activeFilters.games.includes('mtg') && activeFilters.mtgColors.length > 0 && !activeFilters.mtgColors.some(c => (cardData.colors || []).includes(c))) return false;
            if (activeFilters.games.includes('pokemon') && activeFilters.pokemonTypes.length > 0 && !activeFilters.pokemonTypes.some(t => (cardData.types || []).includes(t))) return false;
            return true;
        });
        
        const sortValue = sortOrderSelect?.value || 'date-desc';
        filteredListings.sort((a, b) => {
             const aDate = a.listedAt?.toMillis() || 0;
             const bDate = b.listedAt?.toMillis() || 0;
             const aPrice = a.price || 0;
             const bPrice = b.price || 0;
            switch (sortValue) {
                case 'price-asc': return aPrice - bPrice;
                case 'price-desc': return bPrice - aPrice;
                case 'date-asc': return aDate - bDate;
                default: return bDate - aDate;
            }
        });

        renderListings(filteredListings);

    } catch (error) {
        console.error("Error fetching marketplace listings:", error);
        listingsContainer.innerHTML = `<div class="text-center py-10 bg-red-100 text-red-700 p-4 rounded-lg col-span-full"><p class="font-bold">Error loading listings.</p><p class="text-sm">Please check the browser console for details.</p></div>`;
    }
};

const renderListings = (listings) => {
    if (!listingsContainer) return;
    listingsContainer.innerHTML = '';
    
    if (listings.length === 0) {
        if(noResultsDiv) noResultsDiv.classList.remove('hidden');
        return;
    }

    listings.forEach(listing => {
        const card = listing.cardData || listing;
        const imageUrl = card.imageUrl || card.image_uris?.normal || 'https://placehold.co/600x400/2d3748/ffffff?text=No+Image';
        const price = listing.price ? `$${Number(listing.price).toFixed(2)}` : 'N/A';
        const cardName = card.cardName || card.name || 'Untitled';

        const contactButtonHtml = currentUser && currentUser.uid !== listing.sellerId
            ? `<button class="contact-seller-btn mt-auto w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700" data-seller-id="${listing.sellerId}" data-card-name="${cardName}">Contact Seller</button>`
            : '';

        const cardElement = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col">
                <div class="aspect-[3/4] w-full">
                    <img src="${imageUrl}" alt="${cardName}" class="w-full h-full object-cover">
                </div>
                <div class="p-4 flex flex-col flex-grow">
                    <h3 class="font-bold text-lg truncate">${cardName}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 capitalize mb-2">${card.set_name || ''}</p>
                    <p class="text-lg font-semibold mt-auto">${price}</p>
                    ${contactButtonHtml}
                </div>
            </div>
        `;
        listingsContainer.innerHTML += cardElement;
    });
    
    document.querySelectorAll('.contact-seller-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            if (!currentUser) {
                alert('Please log in to contact sellers.');
                return;
            }
            const sellerId = e.target.dataset.sellerId;
            const cardName = e.target.dataset.cardName;
            window.location.href = `/messages.html?recipient=${sellerId}&card=${encodeURIComponent(cardName)}`;
        });
    });
};

const handleCreateListing = async (e) => {
    e.preventDefault();
    if (!currentUser) {
        alert("You must be logged in to create a listing.");
        return;
    }
    const form = e.target;
    const cardName = form['card-name'].value;
    const price = Number(form['price'].value);

    try {
        await addDoc(collection(db, 'marketplaceListings'), {
            cardName: cardName,
            cardName_lowercase: cardName.toLowerCase(),
            price: price,
            description: form['description'].value,
            imageUrl: form['image-url'].value,
            game: form['game-select'].value,
            sellerId: currentUser.uid,
            sellerName: currentUser.displayName || 'Anonymous',
            listedAt: serverTimestamp(),
            cardData: {} 
        });
        
        form.reset();
        createListingModal.classList.add('hidden');
        fetchListings(); 
        alert("Listing created successfully!");

    } catch (error) {
        console.error("Error creating listing: ", error);
        alert("Failed to create listing. Please try again.");
    }
};

document.addEventListener('DOMContentLoaded', init);

