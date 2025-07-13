/**
 * HatakeSocial - Shop Page Script (v5 - Cart & Coupon Fix)
 *
 * This script is responsible for the shop page functionality.
 * - FIX: Corrects event delegation for "Add to Cart" and "View More" buttons.
 * - NEW: Implements client-side logic for a coupon code system.
 * - NOTE: Applying coupons securely requires a backend Firebase Function.
 * This script includes a placeholder for that function call.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const productGrid = document.getElementById('product-grid');
    if (!productGrid) return; // Exit if not on the shop page

    // --- DOM Elements ---
    const productModal = document.getElementById('product-detail-modal');
    const cartModal = document.getElementById('cart-modal');
    const checkoutBtn = document.getElementById('checkout-btn');
    const cartButton = document.getElementById('cart-button');
    const applyCouponBtn = document.getElementById('apply-coupon-btn');
    const couponStatusEl = document.getElementById('coupon-status');

    // --- Product Data ---
    const products = [
        { id: 'matte-sleeves', name: 'Matte Sleeves', price: 89, availability: 'Pre-order Releasing 15 October', sku: '0.01', category: 'Sleeves', unitsAvailable: 1000, description: 'Hatake TCG Matte Sleeves offer premium protection with a sophisticated matte finish that reduces glare and enhances the handling experience. Each pack contains 100 high-quality black sleeves (66x91mm) designed to fit standard TCG cards perfectly.', features: ['Premium matte finish for reduced glare and improved shuffling', 'Acid-free and archival safe materials', 'Perfect clarity on the card face side', 'Consistent sizing for tournament play', 'Durable construction that resists splitting and peeling', 'Compatible with all standard TCG cards'], specifications: { Dimensions: '66x91mm', Quantity: '100 sleeves per pack', Color: 'Black backing with clear front', Material: 'Acid-free polypropylene', Finish: 'Matte' }, images: ['IMG_9962.jpg', 'IMG_9958.jpg', 'IMG_9966.jpg', 'IMG_9967.jpg', 'IMG_9965.jpg', 'IMG_9963.jpg', 'IMG_9969.jpg', 'IMG_9956.jpg'] },
        { id: '480-slot-binder', name: '480-Slot Binder', price: 360, availability: 'Pre-order Releasing 15 October', sku: '0.02', category: 'Binder', unitsAvailable: 100, description: 'The Hatake TCG 480-Slot Binder is the ultimate storage solution for serious collectors. This premium zippered binder features side-loading pockets to keep your valuable cards secure and protected while showcasing your collection in style.', features: ['Premium zippered closure for maximum security', 'Side-loading pockets to prevent cards from falling out', '480 card capacity (60 double-sided pages with 4 cards per side)', 'Acid-free, PVC-free, and archival safe materials', 'Reinforced spine and corners for durability', 'Elegant Nordic-inspired design with embossed Hatake logo'], specifications: { Capacity: '480 standard-sized cards', Material: 'Premium PU leather exterior, acid-free polypropylene pages', Color: 'Black with blue interior', Closure: 'Heavy-duty zipper', 'Page Configuration': '60 double-sided pages with 4 card slots per side' }, images: ['IMG_9839.jpg', 'IMG_9814.jpg', 'IMG_9818.jpg', 'IMG_9816.jpg', 'IMG_9819.jpg', 'IMG_9820.jpg', 'IMG_9823.jpg', 'IMG_9824.jpg', 'IMG_9825.jpg', 'IMG_9826.jpg', 'IMG_9827.jpg'] },
        { id: '25x-35pt-top-loaders', name: '25x 35pt Top-Loaders', price: 30, availability: 'Pre-order 15 October', sku: '0.031', category: 'Top-Loaders', unitsAvailable: 550, description: 'Hatake TCG 35pt Top-Loaders provide superior protection for your most valuable standard-sized trading cards. Each pack contains 25 crystal-clear rigid sleeves designed to preserve your cards in pristine condition.', features: ['Crystal-clear PVC construction for maximum visibility', '35pt thickness provides rigid protection against bending and damage', 'Acid-free and archival safe materials', 'Precision-cut edges to prevent card damage', 'Perfect for storing valuable singles and graded cards', 'Compatible with standard TCG cards in sleeves'], specifications: { Thickness: '35pt (standard)', Quantity: '25 top-loaders per pack', Material: 'Acid-free PVC', Dimensions: 'Fits standard TCG cards (including those in sleeves)', Finish: 'Crystal clear' }, images: ['IMG_9971.jpg', 'IMG_9970.jpg', 'IMG_9972.jpg', 'IMG_9973.jpg', 'IMG_9974.jpg', 'IMG_9975.jpg', 'IMG_9976.jpg', 'IMG_9978.jpg'] },
        { id: '10x-130pt-top-loaders', name: '10x 130pt Top-Loaders', price: 35, availability: 'Pre-order Releasing 15 October', sku: '0.032', category: 'Top-Loaders', unitsAvailable: 200, description: 'Hatake TCG 130pt Top-Loaders are designed for maximum protection of multiple cards or oversized collectibles. Each pack contains 10 extra-thick, crystal-clear rigid sleeves that provide superior protection for your most valuable items.', features: ['Extra-thick 130pt construction for maximum rigidity and protection', 'Crystal-clear PVC for perfect visibility of your collectibles', 'Acid-free and archival safe materials', 'Precision-cut edges to prevent damage', 'Perfect for storing multiple cards together or oversized collectibles', 'Ideal for high-value cards requiring additional protection'], specifications: { Thickness: '130pt (extra thick)', Quantity: '10 top-loaders per pack', Material: 'Acid-free PVC', Dimensions: 'Fits multiple standard TCG cards or oversized collectibles', Finish: 'Crystal clear' }, images: ['IMG_9979.jpg', 'IMG_9980.jpg', 'IMG_9981.jpg', 'IMG_9982.jpg', 'IMG_9983.jpg', 'IMG_9984.jpg', 'IMG_9985.jpg', 'IMG_9986.jpg', 'IMG_9987.jpg'] },
        { id: 'pu-deckbox', name: 'PU DeckBox', price: 300.00, availability: 'Pre-order Releasing 15 October', sku: '0.4', category: 'Deckbox', unitsAvailable: 100, description: 'The Hatake TCG PU DeckBox combines elegant Nordic design with practical functionality. With a generous 160+ card capacity and secure magnetic closure, this premium deck box keeps your valuable cards protected in style.', features: ['Premium PU leather exterior with elegant stitching', 'Strong magnetic closure for secure transport', 'Soft interior lining to prevent card damage', 'Reinforced corners for durability', 'Separate compartments for main deck and sideboard', 'Embossed Hatake logo'], specifications: { Capacity: '160+ double-sleeved cards', Material: 'High-quality PU leather exterior, microfiber interior', Color: 'Black with blue interior', Closure: 'Magnetic', Dimensions: '168 x 115 x 94 mm' }, images: ['IMG_9924.jpg', 'IMG_9895.jpg', 'IMG_9899.jpg', 'IMG_9900.jpg', 'IMG_9901.jpg', 'IMG_9903.jpg', 'IMG_9904.jpg', 'IMG_9912.jpg', 'IMG_9941.jpg', 'IMG_9943.jpg', 'IMG_9947.jpg', 'IMG_9948.jpg', 'IMG_9949.jpg', 'IMG_9951.jpg'] },
        { id: 'duffel-bag', name: 'Duffel Bag', price: 300.00, availability: 'Pre-order Releasing 15 July', sku: '0.5', category: 'Bag', unitsAvailable: 22, description: 'The Hatake TCG Duffel Bag is the ultimate tournament companion, designed specifically for TCG players who demand both functionality and style. With dimensions of 47*28*55cm, this spacious bag provides ample room for all your gaming essentials.', features: ['Durable water-resistant exterior', 'Padded interior compartments for deck boxes and binders', 'Dedicated sleeve pocket to keep your cards protected', 'Adjustable shoulder strap with comfort padding', 'Side pockets for quick access to frequently used items', 'Premium YKK zippers for long-lasting performance'], specifications: { Dimensions: '47*28*55cm', Material: 'High-quality polyester with water-resistant coating', Color: 'Black with Nordic blue accents', Capacity: 'Fits up to 4 binders, 8 deck boxes, playmats, and accessories’' }, images: ['IMG_3159.jpeg'] },
        { id: 'petdragon-playmat', name: 'PetDragon Playmat', price: 120, availability: 'In Stock', description: 'A unique playmat designed by Discus, CEO from our partnered website selling high quality Commander decks. PetDragon and Hatake logo.', features: [], specifications: { Dimensions: '14*24 inches', Shipping: 'Shipped inside of a useable tube' }, images: ['IMG_3989.jpeg'] }
    ];

    // --- State ---
    let cart = JSON.parse(localStorage.getItem('hatakeCart')) || [];
    let appliedCoupon = null;
    
    const stripe = Stripe('pk_live_51RKhZCJqRiYlcnGZJyPeVmRjm8QLYOSrCW0ScjmxocdAJ7psdKTKNsS3JzITCJ61vq9lZNJpm2I6gX2eJgCUrSf100Mi7zWfpn');

    // --- Functions ---

    function renderProducts() {
        productGrid.innerHTML = '';
        products.forEach(product => {
            const imagePath = `images/${product.images[0]}`;
            const productCardHTML = `
                <div class="product-card">
                    <div class="product-image-container">
                         <img src="${imagePath}" alt="${product.name}" class="product-image" onerror="this.onerror=null;this.src='https://placehold.co/300x300/cccccc/969696?text=Image+Not+Found';">
                    </div>
                    <div class="product-info">
                        <h3>${product.name}</h3>
                        <p class="price">${product.price.toFixed(2)} SEK</p>
                        <p class="availability">${product.availability}</p>
                        <div class="product-actions">
                            <button class="add-to-cart-btn" data-id="${product.id}"><i class="fas fa-cart-plus mr-2"></i>Add to Cart</button>
                            <button class="view-more-btn" data-id="${product.id}">View More</button>
                        </div>
                    </div>
                </div>
            `;
            productGrid.innerHTML += productCardHTML;
        });
    }

    function showProductDetail(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const modalBody = document.getElementById('modal-body');
        
        const thumbnailsHTML = product.images.map(image => 
            `<img src="images/${image}" alt="${product.name}" class="thumbnail cursor-pointer w-16 h-16 object-cover rounded-md border-2 border-transparent hover:border-blue-500">`
        ).join('');

        modalBody.innerHTML = `
            <div class="product-image-gallery">
                <img src="images/${product.images[0]}" alt="${product.name}" id="modal-main-image" class="w-full h-auto max-h-96 object-contain rounded-lg mb-4">
                <div class="thumbnail-strip flex flex-wrap gap-2 justify-center">
                    ${thumbnailsHTML}
                </div>
            </div>
            <div class="product-details-content">
                <h2 class="text-3xl font-bold dark:text-white">${product.name}</h2>
                <p class="modal-product-price text-2xl font-extrabold text-blue-600 my-2 dark:text-blue-400">${product.price.toFixed(2)} SEK</p>
                <p class="dark:text-gray-300"><strong>Availability:</strong> ${product.availability}</p>
                ${product.unitsAvailable ? `<p class="dark:text-gray-300"><strong>Units Available:</strong> Only ${product.unitsAvailable} left for preorder</p>` : ''}
                <p class="mt-4 dark:text-gray-300">${product.description}</p>
                ${product.features && product.features.length > 0 ? `
                    <h4 class="font-bold mt-4 dark:text-white">Features</h4>
                    <ul class="list-disc list-inside dark:text-gray-300">${product.features.map(f => `<li>${f}</li>`).join('')}</ul>
                ` : ''}
                <h4 class="font-bold mt-4 dark:text-white">Specifications</h4>
                <ul class="list-disc list-inside dark:text-gray-300">${Object.entries(product.specifications).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}</ul>
                <button class="modal-add-to-cart-button w-full mt-6 bg-green-600 text-white font-bold py-3 rounded-full hover:bg-green-700" data-id="${product.id}">Add to Cart</button>
            </div>
        `;
        openModal(productModal);

        const mainImage = document.getElementById('modal-main-image');
        document.querySelectorAll('.thumbnail').forEach(thumb => {
            thumb.addEventListener('click', () => {
                document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('border-blue-500'));
                thumb.classList.add('border-blue-500');
                mainImage.src = thumb.src;
            });
        });
    }
    
    function addToCart(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const cartItem = { ...product, cartInstanceId: Date.now() + Math.random() };
        cart.push(cartItem);
        updateCart();
    }

    function removeFromCart(cartInstanceId) {
        const itemIndex = cart.findIndex(item => item.cartInstanceId === cartInstanceId);
        if (itemIndex > -1) {
            cart.splice(itemIndex, 1);
        }
        updateCart();
    }
    
    function updateCart() {
        localStorage.setItem('hatakeCart', JSON.stringify(cart));
        const cartCountEl = document.getElementById('cart-count');
        const cartItemsContainer = document.getElementById('cart-items-container');
        const cartSubtotalEl = document.getElementById('cart-subtotal');
        const cartTotalEl = document.getElementById('cart-total');
        const discountLine = document.getElementById('discount-line');
        const cartDiscountEl = document.getElementById('cart-discount');
        
        if(cartCountEl) {
            cartCountEl.textContent = cart.length;
            cartCountEl.classList.toggle('hidden', cart.length === 0);
        }
        
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Your cart is empty.</p>';
            checkoutBtn.disabled = true;
        } else {
            cartItemsContainer.innerHTML = '';
            cart.forEach(item => {
                const cartItemHTML = `
                    <div class="cart-item flex items-center justify-between py-2 border-b dark:border-gray-600">
                        <img src="images/${item.images[0]}" alt="${item.name}" class="w-16 h-16 object-cover rounded-md mr-4">
                        <div class="cart-item-details flex-grow">
                            <h4 class="font-semibold dark:text-white">${item.name}</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-400">${item.price.toFixed(2)} SEK</p>
                        </div>
                        <div class="cart-item-actions">
                            <button class="remove-item-btn text-red-500 hover:text-red-700" data-instance-id="${item.cartInstanceId}" title="Remove item">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                `;
                cartItemsContainer.innerHTML += cartItemHTML;
            });
            checkoutBtn.disabled = false;
        }
        
        const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
        let total = subtotal;
        let discountAmount = 0;

        if (appliedCoupon) {
            if (appliedCoupon.percent_off) {
                discountAmount = subtotal * (appliedCoupon.percent_off / 100);
            } else if (appliedCoupon.amount_off) {
                // Convert amount_off (in öre) to SEK for calculation
                discountAmount = appliedCoupon.amount_off / 100;
            }
            total = Math.max(0, subtotal - discountAmount);
            discountLine.classList.remove('hidden');
            cartDiscountEl.textContent = discountAmount.toFixed(2);
        } else {
            discountLine.classList.add('hidden');
        }

        cartSubtotalEl.textContent = subtotal.toFixed(2);
        cartTotalEl.textContent = total.toFixed(2);
    }
    
    async function handleCheckout() {
        if (!user) {
            alert("Please log in or register to check out.");
            openModal(document.getElementById('loginModal'));
            return;
        }

        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Redirecting to payment...';

        const groupedCart = cart.reduce((acc, item) => {
            if (!acc[item.id]) {
                acc[item.id] = { ...item, quantity: 0 };
            }
            acc[item.id].quantity += 1;
            return acc;
        }, {});

        const line_items = Object.values(groupedCart).map(item => ({
            price_data: {
                currency: 'sek',
                product_data: {
                    name: item.name,
                    images: [`https://hatake.eu/images/${item.images[0]}`],
                },
                unit_amount: item.price * 100,
            },
            quantity: item.quantity,
        }));

        try {
            const functions = firebase.functions();
            const createStripeCheckout = functions.httpsCallable('createStripeCheckout');
            
            const result = await createStripeCheckout({ 
                line_items,
                couponId: appliedCoupon ? appliedCoupon.id : null, // Pass coupon ID
                success_url: window.location.origin + '/shop.html?success=true',
                cancel_url: window.location.origin + '/shop.html?canceled=true'
            });

            if (result.data && result.data.id) {
                const { error } = await stripe.redirectToCheckout({ sessionId: result.data.id });
                if (error) {
                    alert(error.message);
                }
            } else {
                 throw new Error("Failed to create Stripe session.");
            }

        } catch (error) {
            console.error("Error during checkout: ", error);
            alert("Could not initiate checkout. The payment service may be temporarily unavailable. Please try again later.");
        } finally {
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = 'Checkout';
        }
    }

    async function handleApplyCoupon() {
        const couponCode = document.getElementById('coupon-code-input').value.trim().toUpperCase();
        if (!couponCode) {
            couponStatusEl.textContent = 'Please enter a code.';
            couponStatusEl.className = 'text-sm mt-2 text-yellow-500';
            return;
        }

        applyCouponBtn.disabled = true;
        applyCouponBtn.textContent = '...';
        
        try {
            // In a real app, this would be a call to a secure backend function.
            // For now, we'll simulate it.
            const validateCoupon = firebase.functions().httpsCallable('validateCoupon');
            const result = await validateCoupon({ code: couponCode });

            if (result.data.success) {
                appliedCoupon = result.data.coupon;
                couponStatusEl.textContent = `Success! ${result.data.coupon.name} applied.`;
                couponStatusEl.className = 'text-sm mt-2 text-green-600';
                updateCart();
            } else {
                appliedCoupon = null;
                couponStatusEl.textContent = result.data.error || 'Invalid coupon code.';
                couponStatusEl.className = 'text-sm mt-2 text-red-500';
                updateCart();
            }
        } catch (error) {
            console.error("Error validating coupon:", error);
            appliedCoupon = null;
            couponStatusEl.textContent = 'Could not validate coupon. Please try again.';
            couponStatusEl.className = 'text-sm mt-2 text-red-500';
            updateCart();
        } finally {
            applyCouponBtn.disabled = false;
            applyCouponBtn.textContent = 'Apply';
        }
    }

    function checkCheckoutStatus() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('success')) {
            alert('Order placed! You will receive an email confirmation.');
            cart = [];
            appliedCoupon = null;
            updateCart();
            // Clean up URL
            window.history.replaceState({}, document.title, "/shop.html");
        }
        if (params.get('canceled')) {
            alert('Order canceled. Your cart has been saved.');
             window.history.replaceState({}, document.title, "/shop.html");
        }
    }

    // --- Event Listeners ---
    productGrid.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.add-to-cart-btn');
        const viewBtn = e.target.closest('.view-more-btn');
        if (addBtn) {
            addToCart(addBtn.dataset.id);
        } else if (viewBtn) {
            showProductDetail(viewBtn.dataset.id);
        }
    });

    document.getElementById('modal-body').addEventListener('click', (e) => {
        const addBtn = e.target.closest('.modal-add-to-cart-button');
        if (addBtn) {
            addToCart(addBtn.dataset.id);
            closeModal(productModal);
            openModal(cartModal);
        }
    });

    document.getElementById('cart-items-container').addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-item-btn');
        if (removeBtn) {
            const instanceId = parseFloat(removeBtn.dataset.instanceId);
            removeFromCart(instanceId);
        }
    });

    document.getElementById('close-product-modal').addEventListener('click', () => closeModal(productModal));
    if (cartButton) cartButton.addEventListener('click', () => openModal(cartModal));
    document.getElementById('close-cart-modal').addEventListener('click', () => closeModal(cartModal));
    checkoutBtn.addEventListener('click', handleCheckout);
    applyCouponBtn.addEventListener('click', handleApplyCoupon);

    // --- Initial Load ---
    renderProducts();
    updateCart();
    checkCheckoutStatus();
});
