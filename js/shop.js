// js/shop.js

document.addEventListener('authReady', () => {
    const productGrid = document.getElementById('product-grid');
    const cartBtn = document.getElementById('cart-btn');
    const cartModal = document.getElementById('cart-modal');
    const closeModalBtn = document.getElementById('close-cart-modal');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTotalElement = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    let cart = JSON.parse(localStorage.getItem('geminiHatakeCart')) || [];
    let products = [];

    const renderProducts = () => {
        if (!productGrid) return;
        productGrid.innerHTML = '';
        if (products.length === 0) {
            productGrid.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">No products available at the moment.</p>';
            return;
        }

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card dark:bg-gray-800';
            const thumbnailUrl = (product.galleryImageUrls && product.galleryImageUrls.length > 0) ? product.galleryImageUrls[0] : 'https://placehold.co/300x300?text=No+Image';
            
            card.innerHTML = `
                <div class="product-image-container">
                    <img src="${thumbnailUrl}" alt="${product.name}" class="product-image">
                </div>
                <div class="product-info">
                    <div>
                        <h3 class="text-lg font-bold text-gray-900 dark:text-white">${product.name}</h3>
                        <p class="text-2xl font-extrabold text-blue-600 dark:text-blue-400">$${product.price.toFixed(2)}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${product.stock > 0 ? `${product.stock} available` : 'Out of Stock'}</p>
                    </div>
                    <div class="mt-4">
                        <button data-id="${product.id}" class="add-to-cart-btn w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors ${product.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${product.stock === 0 ? 'disabled' : ''}>
                            ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                        </button>
                    </div>
                </div>
            `;
            productGrid.appendChild(card);
        });
    };

    const saveCart = () => {
        localStorage.setItem('geminiHatakeCart', JSON.stringify(cart));
        updateCartUI();
    };

    const updateCartUI = () => {
        renderCartItems();
        updateCartTotal();
        updateCartButton();
    };

    const renderCartItems = () => {
        if (!cartItemsContainer) return;
        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Your cart is empty.</p>';
            return;
        }

        cart.forEach(item => {
            const product = products.find(p => p.id === item.id);
            if (product) {
                const thumbnailUrl = (product.galleryImageUrls && product.galleryImageUrls.length > 0) ? product.galleryImageUrls[0] : 'https://placehold.co/64x64';
                const itemElement = document.createElement('div');
                itemElement.className = 'cart-item';
                itemElement.innerHTML = `
                    <img src="${thumbnailUrl}" alt="${product.name}">
                    <div class="cart-item-details">
                        <h4 class="font-semibold dark:text-white">${product.name}</h4>
                        <p class="text-gray-600 dark:text-gray-400">$${product.price.toFixed(2)} x ${item.quantity}</p>
                    </div>
                    <div class="cart-item-actions">
                        <span class="item-price font-bold dark:text-blue-400">$${(product.price * item.quantity).toFixed(2)}</span>
                        <button class="remove-item-btn text-red-500 hover:text-red-700" data-id="${item.id}">&times;</button>
                    </div>
                `;
                cartItemsContainer.appendChild(itemElement);
            }
        });
    };

    const updateCartTotal = () => {
        if (!cartTotalElement) return;
        const total = cart.reduce((sum, item) => {
            const product = products.find(p => p.id === item.id);
            return sum + (product ? product.price * item.quantity : 0);
        }, 0);
        cartTotalElement.textContent = `$${total.toFixed(2)}`;
    };

    const updateCartButton = () => {
        const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        const cartCounter = document.getElementById('cart-counter');
        if (cartCounter) {
            if (cartItemCount > 0) {
                cartCounter.textContent = cartItemCount;
                cartCounter.classList.remove('hidden');
            } else {
                cartCounter.classList.add('hidden');
            }
        }
    };

    const addToCart = (productId) => {
        const product = products.find(p => p.id === productId);
        if (product.stock <= 0) {
            showToast("This item is out of stock.", "error");
            return;
        }
        const existingItem = cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({ id: productId, quantity: 1 });
        }
        saveCart();
        showToast(`${product.name} added to cart!`, "success");
    };

    const removeFromCart = (productId) => {
        cart = cart.filter(item => item.id !== productId);
        saveCart();
    };

    const handleCheckout = async () => {
        if (cart.length === 0) {
            showToast("Your cart is empty.", "info");
            return;
        }
        const user = firebase.auth().currentUser;
        if (!user) {
            showToast("Please log in to proceed to checkout.", "info");
            return;
        }
        
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Processing...';

        const createCheckoutSession = firebase.functions().httpsCallable('createCheckoutSession');
        
        const cartItems = cart.map(item => {
            const product = products.find(p => p.id === item.id);
            if (!product || !product.stripePriceId) {
                throw new Error(`Product "${product.name}" is missing a Stripe Price ID and cannot be purchased.`);
            }
            return {
                priceId: product.stripePriceId,
                quantity: item.quantity
            };
        });

        try {
            const result = await createCheckoutSession({ cartItems: cartItems });
            const stripe = Stripe('pk_live_51RKhZCJqRiYlcnGZJyPeVmRjm8QLYOSrCW0ScjmxocdAJ7psdKTKNsS3JzITCJ61vq9lZNJpm2I6gX2eJgCUrSf100Mi7zWfpn');
            await stripe.redirectToCheckout({ sessionId: result.data.id });
        } catch (error) {
            console.error("Error creating checkout session:", error);
            showToast(`Checkout Error: ${error.message}`, "error");
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = 'Proceed to Checkout';
        }
    };

    // --- Event Listeners ---
    if (productGrid) {
        productGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-to-cart-btn')) {
                const productId = e.target.dataset.id;
                addToCart(productId);
            }
        });
    }

    cartBtn?.addEventListener('click', () => openModal(cartModal));
    closeModalBtn?.addEventListener('click', () => closeModal(cartModal));
    checkoutBtn?.addEventListener('click', handleCheckout);

    if (cartItemsContainer) {
        cartItemsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-item-btn')) {
                const productId = e.target.dataset.id;
                removeFromCart(productId);
            }
        });
    }

    // --- Initialization ---
    const initShop = () => {
        db.collection('products').onSnapshot(snapshot => {
            products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderProducts();
            updateCartUI();
        }, err => {
            console.error("Error fetching products:", err);
            productGrid.innerHTML = '<p class="text-center text-red-500 col-span-full">Could not load products.</p>';
        });
    };

    initShop();
});
