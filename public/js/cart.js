/**
 * HatakeSocial - Global Cart Management Script
 *
 * This script handles all cart functionality across the entire site.
 * It manages cart state in localStorage, renders the cart modal,
 * updates the cart icon count, and handles the checkout process.
 */

// --- Helper Functions ---
const getCart = () => {
    try {
        const cart = JSON.parse(localStorage.getItem('hatakeCart')) || [];
        return Array.isArray(cart) ? cart : [];
    } catch (e) {
        console.error("Error parsing cart from localStorage", e);
        return [];
    }
};

const saveCart = (cart) => {
    localStorage.setItem('hatakeCart', JSON.stringify(cart));
};

const updateCartCount = () => {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountElements = document.querySelectorAll('#cart-counter, #cart-item-count'); // Select all counters
    cartCountElements.forEach(el => {
        if (el) {
            el.textContent = totalItems;
            el.classList.toggle('hidden', totalItems === 0);
        }
    });
};


const renderCartItems = () => {
    const cart = getCart();
    const container = document.getElementById('cart-items-container');
    const subtotalEl = document.getElementById('cart-subtotal');
    const checkoutBtn = document.getElementById('checkout-btn');

    if (!container || !subtotalEl || !checkoutBtn) return;

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Your cart is empty.</p>';
        subtotalEl.textContent = '$0.00';
        checkoutBtn.disabled = true;
        return;
    }

    let subtotal = 0;
    container.innerHTML = ''; // Clear existing items

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;

        const itemElement = document.createElement('div');
        itemElement.className = 'flex items-center justify-between py-4 border-b dark:border-gray-700';
        itemElement.innerHTML = `
            <div class="flex items-center space-x-4">
                <img src="${item.imageUrl || 'https://placehold.co/64x64'}" alt="${item.name}" class="w-16 h-16 object-cover rounded-md">
                <div>
                    <h4 class="font-semibold text-gray-800 dark:text-white">${item.name}</h4>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Quantity: ${item.quantity}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-semibold text-gray-800 dark:text-white">$${itemTotal.toFixed(2)}</p>
                <button class="remove-from-cart-btn text-red-500 hover:text-red-700 text-sm font-medium" data-id="${item.id}">Remove</button>
            </div>
        `;
        container.appendChild(itemElement);
    });

    subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    checkoutBtn.disabled = false;
};

// --- Public Functions ---
function addToCart(productId, productData) {
    const cart = getCart();
    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: productId,
            name: productData.name,
            price: productData.price,
            imageUrl: productData.imageUrl,
            priceId: productData.priceId, // Stripe Price ID
            quantity: 1,
        });
    }

    saveCart(cart);
    updateCartCount();
    renderCartItems(); // Re-render if the modal is open
    // Ensure showToast is available globally or handle it
    if (typeof showToast === 'function') {
        showToast(`${productData.name} added to cart!`, 'success');
    }
}


// --- Checkout Functionality ---
async function proceedToCheckout() {
    const checkoutBtn = document.getElementById('checkout-btn');
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Redirecting...';

    const cartItems = getCart();
    if (cartItems.length === 0) {
        if (typeof showToast === 'function') showToast('Your cart is empty.', 'error');
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'Proceed to Checkout';
        return;
    }

    try {
        // IMPORTANT: Replace with your actual Stripe Publishable Key
        const stripe = Stripe('pk_live_51RKhZCJqRiYlcnGZJyPeVmRjm8QLYOSrCW0ScjmxocdAJ7psdKTKNsS3JzITCJ61vq9lZNJpm2I6gX2eJgCUrSf100Mi7zWfpn');
        const createCheckoutSession = firebase.functions().httpsCallable('createCheckoutSession');

        const response = await createCheckoutSession({
            cartItems: cartItems
            // You can add couponId and referralDiscountPercent here if needed
        });

        const sessionId = response.data.id;
        const { error } = await stripe.redirectToCheckout({ sessionId });

        if (error) {
            console.error('Stripe redirect error:', error);
            if (typeof showToast === 'function') showToast(`Error: ${error.message}`, 'error');
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = 'Proceed to Checkout';
        }
    } catch (error) {
        console.error("Error creating checkout session:", error);
        if (typeof showToast === 'function') showToast('Could not proceed to checkout. Please try again.', 'error');
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = 'Proceed to Checkout';
    }
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const cartModal = document.getElementById('cartModal');
    const closeCartModalBtn = document.getElementById('closeCartModal');
    const checkoutBtn = document.getElementById('checkout-btn');

    // This event listener will be set up on every page by auth.js
    // document.getElementById('cart-btn').addEventListener('click', () => openModal(cartModal));

    if (closeCartModalBtn && cartModal) {
        closeCartModalBtn.addEventListener('click', () => {
             // Basic modal close logic, assuming a 'hidden' class toggles visibility
            cartModal.classList.add('hidden');
        });
    }


    if (cartModal) {
        // Handle removing items from the cart
        cartModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-from-cart-btn')) {
                const productId = e.target.dataset.id;
                let cart = getCart();
                cart = cart.filter(item => item.id !== productId);
                saveCart(cart);
                renderCartItems();
                updateCartCount();
                 if (typeof showToast === 'function') showToast('Item removed from cart.', 'info');
            }
        });
    }

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', proceedToCheckout);
    }


    // Initial render on page load
    updateCartCount();
    renderCartItems();
});