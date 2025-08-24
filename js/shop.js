// js/shop.js

document.addEventListener('authReady', () => {
    const productGrid = document.getElementById('product-grid');
    const cartBtn = document.getElementById('cart-btn');
    const cartModal = document.getElementById('cart-modal');
    const closeModalBtn = document.getElementById('close-cart-modal');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTotalElement = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    const referralCodeInput = document.getElementById('referral-code-input');


    // --- State ---
    let cart = JSON.parse(localStorage.getItem('geminiHatakeCart')) || [];
    let products = [];

    // --- Stripe Products ---
    const allProducts = [
        {
            id: 'prod_SYIMa7icigLFOp',
            priceId: 'price_1RdBmDJqRiYlcnGZjbTO4Lkb',
            name: 'Duffel Bag',
            price: 50.00,
            imageUrl: 'images/IMG_9987.jpg',
            description: 'A spacious and durable duffel bag, perfect for carrying all your TCG essentials to tournaments and game nights.',
            stock: 50
        },
        {
            id: 'prod_SYIGjmh8j3aosd',
            priceId: 'price_1RdBfYJqRiYlcnGZnW0ratRw',
            name: 'Playmat',
            price: 25.00,
            imageUrl: 'images/IMG_9986.jpg',
            description: 'A high-quality playmat with a smooth surface and non-slip rubber bottom, featuring exclusive artwork.',
            stock: 100
        },
        {
            id: 'prod_SYIJR6CJeSjYKN',
            priceId: 'price_1RdBiwJqRiYlcnGZAI2AggRJ',
            name: 'Binder',
            price: 30.00,
            imageUrl: 'images/IMG_9985.jpg',
            description: 'A premium 9-pocket binder to protect and display your valuable card collection.',
            stock: 75
        },
        {
            id: 'prod_SYII4oT6w0FZpK',
            priceId: 'price_1RdBhqJqRiYlcnGZNWJN5C5v',
            name: '35pt Toploader (10-pack)',
            price: 5.00,
            imageUrl: 'images/IMG_9984.jpg',
            description: 'Protect your standard size cards with these durable 35pt toploaders.',
            stock: 200
        },
        {
            id: 'prod_SYIHrXHfMIj8ze',
            priceId: 'price_1RdBgqJqRiYlcnGZdYZdPuXG',
            name: '130pt Toploader (5-pack)',
            price: 5.00,
            imageUrl: 'images/IMG_9983.jpg',
            description: 'Thicker toploaders for your most valuable and thicker cards, ensuring maximum protection.',
            stock: 150
        },
        {
            id: 'prod_SYIGcf4R4QB3gm',
            priceId: 'price_1RdBgJJqRiYlcnGZOWNzzejD',
            name: 'Deckbox - Susanoo',
            price: 15.00,
            imageUrl: 'images/IMG_9982.jpg',
            description: 'A stylish and sturdy deckbox featuring the powerful Susanoo, to keep your deck safe.',
            stock: 100
        }
    ];

    // --- Functions ---
    const renderProducts = () => {
        if (!productGrid) return;
        productGrid.innerHTML = '';
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card dark:bg-gray-800';
            card.innerHTML = `
                <div class="product-image-container">
                    <img src="${product.imageUrl}" alt="${product.name}" class="product-image">
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
                const itemElement = document.createElement('div');
                itemElement.className = 'cart-item';
                itemElement.innerHTML = `
                    <img src="${product.imageUrl}" alt="${product.name}">
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
        const existingItem = cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({ id: productId, quantity: 1 });
        }
        saveCart();
    };

    const removeFromCart = (productId) => {
        cart = cart.filter(item => item.id !== productId);
        saveCart();
    };

    const handleCheckout = async () => {
        if (cart.length === 0) {
            alert("Your cart is empty.");
            return;
        }

        const user = firebase.auth().currentUser;
        if (!user) {
            alert("Please log in to proceed to checkout.");
            return;
        }
        
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Processing...';

        const createCheckoutSession = firebase.functions().httpsCallable('createCheckoutSession');
        
        const cartItems = cart.map(item => {
            const product = products.find(p => p.id === item.id);
            return {
                priceId: product.priceId,
                quantity: item.quantity
            };
        });

        try {
            const result = await createCheckoutSession({ 
                cartItems: cartItems,
            });
            
            // Redirect to Stripe Checkout using your LIVE publishable key
            const stripe = Stripe('pk_live_51RKhZCJqRiYlcnGZJyPeVmRjm8QLYOSrCW0ScjmxocdAJ7psdKTKNsS3JzITCJ61vq9lZNJpm2I6gX2eJgCUrSf100Mi7zWfpn');
            await stripe.redirectToCheckout({ sessionId: result.data.id });

        } catch (error) {
            console.error("Error creating checkout session:", error);
            alert(`Error: ${error.message}`);
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

    cartBtn?.addEventListener('click', () => cartModal?.classList.add('open'));
    closeModalBtn?.addEventListener('click', () => cartModal?.classList.remove('open'));
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
        products = allProducts;
        renderProducts();
        updateCartUI();
    };

    initShop();
});
