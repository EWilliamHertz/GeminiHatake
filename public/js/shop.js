/**
 * HatakeSocial - Shop Page Script
 *
 * This script handles all logic specific to the shop.html page.
 * It focuses on fetching and displaying products, showing product details,
 * and initiating the checkout process. It relies on the global `js/cart.js`
 * for all cart manipulation logic.
 */

let Currency = null;

const initializeShop = async () => {
    // Import currency module
    try {
        Currency = await import('./modules/currency.js');
        await Currency.initCurrency();
    } catch (error) {
        console.error('Failed to load currency module:', error);
    }
    // --- DOM Elements ---
    const productGrid = document.getElementById('product-grid');
    const productDetailModal = document.getElementById('product-detail-modal');
    const closeProductModalBtn = document.getElementById('close-product-modal');
    const modalBody = document.getElementById('modal-body');
    // Note: Cart-specific elements are now managed by js/cart.js

    // --- State ---
    let products = [];

    // --- Firebase Services ---
    let db, functions;
    if (firebase.apps.length) {
        db = firebase.firestore();
        functions = firebase.functions();
    } else {
        console.error("Firebase is not initialized. Shop cannot function.");
        return;
    }

    // --- RENDER FUNCTIONS ---
    const renderProducts = () => {
        if (!productGrid) return;
        productGrid.innerHTML = '';
        if (products.length === 0) {
            // Display a skeleton loader while waiting for products
            for (let i = 0; i < 8; i++) {
                const skeletonCard = document.createElement('div');
                skeletonCard.className = 'product-card bg-white dark:bg-gray-800 animate-pulse';
                skeletonCard.innerHTML = `
                    <div class="product-image-container bg-gray-300 dark:bg-gray-700"></div>
                    <div class="product-info">
                        <div>
                            <div class="h-6 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                            <div class="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                            <div class="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/4"></div>
                        </div>
                        <div class="mt-4">
                            <div class="h-10 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                        </div>
                    </div>
                `;
                productGrid.appendChild(skeletonCard);
            }
            return;
        }

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card bg-white dark:bg-gray-800 cursor-pointer shadow-md hover:shadow-xl transition-shadow duration-300';
            card.dataset.id = product.id;

            const thumbnailUrl = (product.galleryImageUrls && product.galleryImageUrls.length > 0) ? product.galleryImageUrls[0] : 'https://placehold.co/300x300/2d3748/ffffff?text=No+Image';

            card.innerHTML = `
                <div class="product-image-container">
                    <img src="${thumbnailUrl}" alt="${product.name}" class="product-image">
                </div>
                <div class="product-info">
                    <div>
                        <h3 class="text-lg font-bold text-gray-900 dark:text-white truncate">${product.name}</h3>
                        <p class="text-2xl font-extrabold text-blue-600 dark:text-blue-400">${Currency ? Currency.convertAndFormat({ usd: product.price }) : '$' + product.price.toFixed(2)}</p>
                        <p class="text-sm ${product.stock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}">${product.stock > 0 ? `${product.stock} available` : 'Out of Stock'}</p>
                    </div>
                    <div class="mt-4">
                        <button data-id="${product.id}" class="add-to-cart-btn w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors ${product.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${product.stock === 0 ? 'disabled' : ''}>
                            <i class="fas fa-shopping-cart mr-2"></i>
                            ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                        </button>
                    </div>
                </div>
            `;
            productGrid.appendChild(card);
        });
    };

    // --- PRODUCT DETAIL MODAL ---
    const openProductModal = (productId) => {
        const product = products.find(p => p.id === productId);
        if (!product || !modalBody || !productDetailModal) return;

        let imageGalleryHtml = '';
        if (product.galleryImageUrls && product.galleryImageUrls.length > 0) {
            const mainImage = `<img src="${product.galleryImageUrls[0]}" alt="${product.name}" class="w-full h-64 md:h-80 object-cover rounded-lg mb-4 main-modal-image">`;
            const thumbnails = product.galleryImageUrls.map(url =>
                `<img src="${url}" alt="Thumbnail" class="w-16 h-16 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-blue-500 thumbnail-image">`
            ).join('');
            imageGalleryHtml = `${mainImage}<div class="flex gap-2 overflow-x-auto pb-2">${thumbnails}</div>`;
        } else {
            imageGalleryHtml = `<div class="w-full h-64 md:h-80 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center"><p class="text-gray-500">No Image</p></div>`;
        }

        modalBody.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    ${imageGalleryHtml}
                </div>
                <div>
                    <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">${product.name}</h2>
                    <p class="text-3xl font-extrabold text-blue-600 dark:text-blue-400">${Currency ? Currency.convertAndFormat({ usd: product.price }) : '$' + product.price.toFixed(2)}</p>
                    <p class="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">${product.description || 'No description available.'}</p>
                    <p class="text-sm font-medium ${product.stock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'} mb-4">${product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}</p>
                    <button data-id="${product.id}" class="add-to-cart-btn-modal w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors ${product.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${product.stock === 0 ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart mr-2"></i>
                        ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                </div>
            </div>
        `;

        // Add event listeners for new modal content
        modalBody.querySelectorAll('.thumbnail-image').forEach(thumb => {
            thumb.addEventListener('click', () => {
                modalBody.querySelector('.main-modal-image').src = thumb.src;
            });
        });

        modalBody.querySelector('.add-to-cart-btn-modal').addEventListener('click', (e) => {
            const id = e.target.closest('button').dataset.id;
            const productToAdd = products.find(p => p.id === id);
            if (productToAdd) {
                // Use the global addToCart function from js/cart.js
                window.addToCart(id, {
                    name: productToAdd.name,
                    price: productToAdd.price,
                    imageUrl: (productToAdd.galleryImageUrls && productToAdd.galleryImageUrls.length > 0) ? productToAdd.galleryImageUrls[0] : null,
                    priceId: productToAdd.stripePriceId
                });
            }
        });

        // Use the 'open' class for the modal overlay to ensure it displays correctly
        productDetailModal.classList.add('open');
    };

    // --- EVENT LISTENERS ---
    if (productGrid) {
        productGrid.addEventListener('click', (e) => {
            const button = e.target.closest('.add-to-cart-btn');
            if (button) {
                e.stopPropagation(); // Prevent modal from opening when clicking the button
                const productId = button.dataset.id;
                const product = products.find(p => p.id === productId);
                if (product) {
                    // Use the global addToCart function from js/cart.js
                    window.addToCart(productId, {
                        name: product.name,
                        price: product.price,
                        imageUrl: (product.galleryImageUrls && product.galleryImageUrls.length > 0) ? product.galleryImageUrls[0] : null,
                        priceId: product.stripePriceId
                    });
                }
                return;
            }

            const card = e.target.closest('.product-card');
            if (card && card.dataset.id) {
                openProductModal(card.dataset.id);
            }
        });
    }

    if (closeProductModalBtn) {
        closeProductModalBtn.addEventListener('click', () => {
            // Use the 'open' class for the modal overlay to ensure it closes correctly
            productDetailModal.classList.remove('open');
        });
    }

    // --- INITIALIZATION ---
    const initShop = () => {
        if (!db) {
            console.error("Firestore is not available. Shop cannot load products.");
            if(productGrid) productGrid.innerHTML = '<p class="text-center text-red-500 col-span-full">Error: Could not connect to the database.</p>';
            return;
        }

        // Initially render skeleton loaders
        renderProducts();

        db.collection('products').onSnapshot(snapshot => {
            products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderProducts();
        }, err => {
            console.error("Error fetching products:", err);
            if(productGrid) productGrid.innerHTML = '<p class="text-center text-red-500 col-span-full">Could not load products. Please try again later.</p>';
        });
    };

    initShop();
    
    // Add currency change event listener
    document.addEventListener('currencyChanged', async (event) => {
        console.log('Currency changed in shop:', event.detail);
        // Re-render products with new currency
        renderProducts();
    });
};

// --- SCRIPT EXECUTION ---
// This robust check ensures the shop initializes correctly after Firebase auth is ready.
if (window.authReady) {
    initializeShop();
} else {
    document.addEventListener('authReady', initializeShop, { once: true });
}