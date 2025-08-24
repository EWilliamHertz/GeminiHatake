// js/shop.js

document.addEventListener('DOMContentLoaded', () => {
    // This script now runs when the page structure is loaded, which is more reliable.

    // DOM Elements
    const productGrid = document.getElementById('product-grid');
    const cartBtn = document.getElementById('cart-btn');
    const mobileCartBtn = document.getElementById('mobile-cart-btn');
    const cartModal = document.getElementById('cart-modal');
    const closeModalBtn = document.getElementById('close-cart-modal');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTotalElement = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    const applyCouponBtn = document.getElementById('apply-coupon-btn');
    const couponCodeInput = document.getElementById('coupon-code-input');
    const couponStatus = document.getElementById('coupon-status');
    const referralDiscountSlider = document.getElementById('referral-discount-slider');
    const referralDiscountValue = document.getElementById('referral-discount-value');
    const referralDiscountSection = document.getElementById('referral-discount-section');
    const productDetailModal = document.getElementById('product-detail-modal');
    const closeProductModalBtn = document.getElementById('close-product-modal');
    const modalBody = document.getElementById('modal-body');


    // State
    let cart = JSON.parse(localStorage.getItem('geminiHatakeCart')) || [];
    let products = [];
    let appliedCoupon = null;
    let referralDiscountPercent = 0;
    
    // Firebase services are initialized in auth.js, we just need to access them.
    // We wait for the auth state to be known before accessing them.
    let db, functions;
    firebase.auth().onAuthStateChanged(() => {
        if (!db) { // Initialize only once
            db = firebase.firestore();
            functions = firebase.functions();
            initShop();
        }
    });


    // --- RENDER FUNCTIONS ---
    const renderProducts = () => {
        if (!productGrid) return;
        productGrid.innerHTML = '';
        if (products.length === 0) {
            productGrid.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">No products available at the moment.</p>';
            return;
        }

        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card dark:bg-gray-800 cursor-pointer';
            card.dataset.id = product.id; // Set the product ID on the card itself
            
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

    // --- PRODUCT DETAIL MODAL ---
    const openProductModal = (productId) => {
        const product = products.find(p => p.id === productId);
        if (!product || !modalBody) return;

        let imageGalleryHtml = '';
        if (product.galleryImageUrls && product.galleryImageUrls.length > 0) {
            const mainImage = `<img src="${product.galleryImageUrls[0]}" alt="${product.name}" class="w-full h-64 object-cover rounded-lg mb-4 main-modal-image">`;
            const thumbnails = product.galleryImageUrls.map(url =>
                `<img src="${url}" alt="Thumbnail" class="w-16 h-16 object-cover rounded-md cursor-pointer border-2 border-transparent hover:border-blue-500 thumbnail-image">`
            ).join('');
            imageGalleryHtml = `${mainImage}<div class="flex gap-2 overflow-x-auto">${thumbnails}</div>`;
        } else {
            imageGalleryHtml = `<img src="https://placehold.co/600x400?text=No+Image" alt="${product.name}" class="w-full h-64 object-cover rounded-lg mb-4">`;
        }

        modalBody.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    ${imageGalleryHtml}
                </div>
                <div>
                    <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">${product.name}</h2>
                    <p class="text-3xl font-extrabold text-blue-600 dark:text-blue-400 mb-4">$${product.price.toFixed(2)}</p>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">${product.description || 'No description available.'}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-300 mb-4">${product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}</p>
                    <button data-id="${product.id}" class="add-to-cart-btn-modal w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors ${product.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${product.stock === 0 ? 'disabled' : ''}>
                        ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                </div>
            </div>
        `;

        modalBody.querySelectorAll('.thumbnail-image').forEach(thumb => {
            thumb.addEventListener('click', () => {
                modalBody.querySelector('.main-modal-image').src = thumb.src;
            });
        });
        
        modalBody.querySelector('.add-to-cart-btn-modal').addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            addToCart(id);
        });

        productDetailModal.classList.add('open');
    };

    // --- CART LOGIC ---
    const saveCart = () => {
        localStorage.setItem('geminiHatakeCart', JSON.stringify(cart));
        updateCartUI();
    };

    const updateCartUI = () => {
        renderCartItems();
        updateCartTotal();
        updateCartButton();
    };

    const updateCartTotal = () => {
        if (!cartTotalElement) return;
        const subtotal = cart.reduce((sum, item) => {
            const product = products.find(p => p.id === item.id);
            return sum + (product ? product.price * item.quantity : 0);
        }, 0);

        let discount = 0;
        if (appliedCoupon) {
            discount = (subtotal * (appliedCoupon.percent_off / 100));
        } else if (referralDiscountPercent > 0) {
            discount = (subtotal * (referralDiscountPercent / 100));
        }

        const total = subtotal - discount;

        document.getElementById('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
        const discountLine = document.getElementById('discount-line');
        if (discount > 0) {
            document.getElementById('cart-discount').textContent = `$${discount.toFixed(2)}`;
            discountLine.classList.remove('hidden');
        } else {
            discountLine.classList.add('hidden');
        }
        cartTotalElement.textContent = `$${total.toFixed(2)}`;
        checkoutBtn.disabled = cart.length === 0;
    };

    const updateCartButton = () => {
        const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        const cartCounter = document.getElementById('cart-counter');
        const mobileCartCounter = document.getElementById('mobile-cart-counter'); // Assuming you might add one
        
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
        if (!product) return;

        if (product.stock <= 0) {
            alert("This item is out of stock.");
            return;
        }

        const existingItem = cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            cart.push({ id: productId, quantity: 1, priceId: product.stripePriceId });
        }
        saveCart();
        alert(`${product.name} has been added to your cart.`);
    };

    const removeFromCart = (productId) => {
        cart = cart.filter(item => item.id !== productId);
        saveCart();
    };

    // --- COUPON & DISCOUNT LOGIC ---
    const applyCoupon = async () => {
        const code = couponCodeInput.value.trim();
        if (!code) {
            couponStatus.textContent = "Please enter a coupon code.";
            couponStatus.className = "text-sm mt-2 h-5 text-red-500";
            return;
        }

        try {
            const validateCoupon = functions.httpsCallable('validateCoupon');
            const result = await validateCoupon({ code });

            if (result.data.success) {
                appliedCoupon = result.data.coupon;
                couponStatus.textContent = `Coupon "${code.toUpperCase()}" applied!`;
                couponStatus.className = "text-sm mt-2 h-5 text-green-500";
                referralDiscountSlider.value = 0;
                referralDiscountPercent = 0;
                referralDiscountValue.textContent = '0%';
                updateCartTotal();
            } else {
                appliedCoupon = null;
                couponStatus.textContent = result.data.message;
                couponStatus.className = "text-sm mt-2 h-5 text-red-500";
                updateCartTotal();
            }
        } catch (error) {
            console.error("Error validating coupon:", error);
            couponStatus.textContent = "Could not validate coupon.";
            couponStatus.className = "text-sm mt-2 h-5 text-red-500";
        }
    };

    // --- CHECKOUT LOGIC ---
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

        const createCheckoutSession = functions.httpsCallable('createCheckoutSession');
        
        const cartItems = cart.map(item => {
            const product = products.find(p => p.id === item.id);
            if (!product || !product.stripePriceId) {
                throw new Error(`Product "${product.name}" is missing a Stripe Price ID.`);
            }
            return {
                priceId: product.stripePriceId,
                quantity: item.quantity
            };
        });

        try {
            const checkoutData = { cartItems };
            if (appliedCoupon) {
                checkoutData.couponId = appliedCoupon.id;
            } else if (referralDiscountPercent > 0) {
                checkoutData.referralDiscountPercent = referralDiscountPercent;
            }

            const result = await createCheckoutSession(checkoutData);

            if (result.data && result.data.id) {
                const stripe = Stripe('pk_live_51RKhZCJqRiYlcnGZJyPeVmRjm8QLYOSrCW0ScjmxocdAJ7psdKTKNsS3JzITCJ61vq9lZNJpm2I6gX2eJgCUrSf100Mi7zWfpn'); 
                await stripe.redirectToCheckout({ sessionId: result.data.id });
            } else {
                throw new Error(result.data.message || 'Failed to create checkout session.');
            }
        } catch (error) {
            console.error("Error creating checkout session:", error);
            alert(`Checkout Error: ${error.message}`);
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = 'Checkout';
        }
    };

    // --- EVENT LISTENERS ---
    if (productGrid) {
        productGrid.addEventListener('click', (e) => {
            // Handle 'Add to Cart' button click specifically
            if (e.target.matches('.add-to-cart-btn')) {
                const productId = e.target.dataset.id;
                addToCart(productId);
                return; // Stop further processing
            }
            
            // Handle click on the card itself to open the modal
            const card = e.target.closest('.product-card');
            if (card && card.dataset.id) {
                openProductModal(card.dataset.id);
            }
        });
    }

    cartBtn?.addEventListener('click', () => cartModal.classList.add('open'));
    mobileCartBtn?.addEventListener('click', () => cartModal.classList.add('open'));
    closeModalBtn?.addEventListener('click', () => cartModal.classList.remove('open'));
    closeProductModalBtn?.addEventListener('click', () => productDetailModal.classList.remove('open'));
    checkoutBtn?.addEventListener('click', handleCheckout);
    applyCouponBtn?.addEventListener('click', applyCoupon);

    referralDiscountSlider?.addEventListener('input', (e) => {
        referralDiscountPercent = e.target.value;
        referralDiscountValue.textContent = `${referralDiscountPercent}%`;
        couponCodeInput.value = '';
        appliedCoupon = null;
        couponStatus.textContent = '';
        updateCartTotal();
    });

    if (cartItemsContainer) {
        cartItemsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-item-btn')) {
                const productId = e.target.dataset.id;
                removeFromCart(productId);
            }
        });
    }

    // --- INITIALIZATION ---
    const initShop = () => {
        if (!db) return; // Don't run if firebase isn't ready
        
        db.collection('products').onSnapshot(snapshot => {
            products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderProducts();
            updateCartUI();
        }, err => {
            console.error("Error fetching products:", err);
            if(productGrid) productGrid.innerHTML = '<p class="text-center text-red-500 col-span-full">Could not load products.</p>';
        });

        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                db.collection('users').doc(user.uid).onSnapshot(doc => {
                    if (doc.exists && doc.data().shopDiscountPercent > 0) {
                        referralDiscountSection.classList.remove('hidden');
                        referralDiscountSlider.max = doc.data().shopDiscountPercent;
                    } else {
                        referralDiscountSection.classList.add('hidden');
                    }
                });
            } else {
                referralDiscountSection.classList.add('hidden');
            }
        });
    };
});