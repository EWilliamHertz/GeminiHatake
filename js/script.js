document.addEventListener('DOMContentLoaded', () => {
    // Firebase Configuration
    const firebaseConfig = {
        apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
        authDomain: "hatakesocial-88b5e.firebaseapp.com",
        projectId: "hatakesocial-88b5e",
        storageBucket: "hatakesocial-88b5e.appspot.com",
        messagingSenderId: "1091697032506",
        appId: "1:1091697032506:web:YOUR_WEB_APP_ID" // You might need to replace 'YOUR_WEB_APP_ID' with your actual web app ID from Firebase project settings.
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // Initialize Stripe with your publishable key
    const stripe = Stripe('pk_live_51RKhZCJqRiYlcnGZJyPeVmRjm8QLYOSrCW0ScjmxocdAJ7psdKTKNsS3JzITCJ61vq9lZNJpm2I6gX2eJgCUrSf100Mi7zWfpn');

    // --- Global Elements (from index.html and shop.html) ---
    // These elements might not exist on all pages, so check for their existence before using.
    const navHome = document.getElementById('nav-home');
    const navShop = document.getElementById('nav-shop');
    const navMyCollection = document.getElementById('nav-my-collection');
    const cartButton = document.getElementById('cartButton');
    const cartItemCount = document.getElementById('cartItemCount');

    // --- Auth Modals & Functionality (primarily for index.html) ---
    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');
    const logoutButton = document.getElementById('logoutButton');
    const userAvatar = document.getElementById('userAvatar');
    const userDropdown = document.getElementById('userDropdown');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const closeLoginModal = document.getElementById('closeLoginModal');
    const closeRegisterModal = document.getElementById('closeRegisterModal');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const registerEmail = document.getElementById('registerEmail');
    const registerPassword = document.getElementById('registerPassword');
    const loginMessage = document.getElementById('loginMessage');
    const registerMessage = document.getElementById('registerMessage');
    const googleLoginButton = document.getElementById('googleLoginButton');
    const googleRegisterButton = document.getElementById('googleRegisterButton');


    // --- Sidebar Elements (primarily for index.html) ---
    const sidebarUserInfo = document.getElementById('sidebar-user-info');
    const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
    const sidebarUserName = document.getElementById('sidebar-user-name');
    const sidebarUserHandle = document.getElementById('sidebar-user-handle');
    const createPostSection = document.getElementById('create-post-section');

    // --- Post Creation Elements (primarily for index.html) ---
    const postContentInput = document.getElementById('postContent');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const uploadVideoBtn = document.getElementById('uploadVideoBtn');
    const postImageUpload = document.getElementById('postImageUpload');
    const submitPostBtn = document.getElementById('submitPostBtn');
    const postStatusMessage = document.getElementById('postStatusMessage');
    const postsContainer = document.getElementById('postsContainer');
    let selectedFile = null; // For post media upload

    // --- Shop Elements (primarily for shop.html) ---
    const shopProductGrid = document.getElementById('product-grid');
    const productDetailModal = document.getElementById('product-detail-modal');
    const closeProductDetailModalBtn = document.getElementById('closeProductDetailModal');
    const modalMainImage = document.getElementById('modal-main-image');
    const modalThumbnailsContainer = document.getElementById('modal-thumbnails');
    const modalProductName = document.getElementById('modal-product-name');
    const modalProductPrice = document.getElementById('modal-product-price');
    const modalProductSku = document.getElementById('modal-product-sku');
    const modalProductCategory = document.getElementById('modal-product-category');
    const modalProductAvailability = document.getElementById('modal-product-availability');
    const modalProductUnits = document.getElementById('modal-product-units');
    const modalProductDescription = document.getElementById('modal-product-description');
    const modalProductFeatures = document.getElementById('modal-product-features');
    const modalProductSpecifications = document.getElementById('modal-product-specifications');
    const modalAddToCartButton = document.getElementById('modal-add-to-cart-button');

    // --- Cart Modal Elements (primarily for shop.html) ---
    const cartModal = document.getElementById('cart-modal');
    const closeCartModalBtn = document.getElementById('closeCartModal');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const emptyCartMessage = document.getElementById('empty-cart-message');
    const cartTotalSpan = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    // --- Profile Page Elements (primarily for profile.html) ---
    const profileBanner = document.getElementById('profileBanner');
    const bannerUploadInput = document.getElementById('bannerUploadInput');
    const editBannerBtn = document.getElementById('editBannerBtn');
    const profileAvatar = document.getElementById('profileAvatar');
    const avatarUploadInput = document.getElementById('avatarUploadInput');
    const editAvatarBtn = document.getElementById('editAvatarBtn');
    const profileDisplayName = document.getElementById('profileDisplayName');
    const profileHandle = document.getElementById('profileHandle');
    const profileVerificationBadge = document.getElementById('profileVerificationBadge');
    const editProfileButton = document.getElementById('editProfileButton');
    const tabOverview = document.getElementById('tabOverview');
    const tabCollection = document.getElementById('tabCollection');
    const tabAchievements = document.getElementById('tabAchievements');
    const overviewContent = document.getElementById('overviewContent');
    const collectionContent = document.getElementById('collectionContent');
    const achievementsContent = document.getElementById('achievementsContent');
    const profileBio = document.getElementById('profileBio');
    const profileLocation = document.getElementById('profileLocation');
    const profileInterests = document.getElementById('profileInterests');
    const profileFavoriteGames = document.getElementById('profileFavoriteGames');

    const editProfileModal = document.getElementById('editProfileModal');
    const closeEditProfileModal = document.getElementById('closeEditProfileModal');
    const editProfileForm = document.getElementById('editProfileForm');
    const editAvatarPreview = document.getElementById('editAvatarPreview');
    const selectEditAvatarBtn = document.getElementById('selectEditAvatarBtn');
    const editBannerPreview = document.getElementById('editBannerPreview');
    const selectEditBannerBtn = document.getElementById('selectEditBannerBtn');
    const editDisplayName = document.getElementById('editDisplayName');
    const editBio = document.getElementById('editBio');
    const editLocation = document.getElementById('editLocation');
    const editInterests = document.getElementById('editInterests');
    const editFavoriteGames = document.getElementById('editFavoriteGames');
    const saveProfileChangesBtn = document.getElementById('saveProfileChangesBtn');
    const editProfileMessage = document.getElementById('editProfileMessage');

    let currentAvatarFile = null;
    let currentBannerFile = null;


    // --- Product Data (for shop.html) ---
    const products = [
        {
            id: 1,
            name: "Matte sleeves",
            price: 89.00, // SEK
            sku: "0.01",
            category: "Sleeves",
            availability: "Pre-order Releasing 15 October",
            unitsAvailable: 1000,
            description: "Hatake TCG Matte Sleeves offer premium protection with a sophisticated matte finish that reduces glare and enhances the handling experience. Each pack contains 100 high-quality black sleeves (66x91mm) designed to fit standard TCG cards perfectly.",
            features: [
                "Premium matte finish for reduced glare and improved shuffling",
                "Acid-free and archival safe materials",
                "Perfect clarity on the card face side",
                "Consistent sizing for tournament play",
                "Durable construction that resists splitting and peeling",
                "Compatible with all standard TCG cards"
            ],
            specifications: {
                dimensions: "66x91mm",
                quantity: "100 sleeves per pack",
                color: "Black backing with clear front",
                material: "Acid-free polypropylene",
                finish: "Matte"
            },
            image: "/images/IMG_9962.jpg", // Using one of the provided image names as main
            thumbnails: [
                "/images/IMG_9962.jpg",
                "/images/IMG_9958.jpg",
                "/images/IMG_9966.jpg",
                "/images/IMG_9967.jpg",
                "/images/IMG_9965.jpg",
                "/images/IMG_9963.jpg",
                "/images/IMG_9969.jpg",
                "/images/IMG_9956.jpg"
            ]
        },
        {
            id: 2,
            name: "480-Slot Binder",
            price: 360.00, // SEK
            sku: "0.02",
            category: "Binder",
            availability: "Pre-order Releasing 15 October",
            unitsAvailable: 100,
            description: "The Hatake TCG 480-Slot Binder is the ultimate storage solution for serious collectors. This premium zippered binder features side-loading pockets to keep your valuable cards secure and protected while showcasing your collection in style.",
            features: [
                "Premium zippered closure for maximum security",
                "Side-loading pockets to prevent cards from falling out",
                "480 card capacity (60 double-sided pages with 4 cards per side)",
                "Acid-free, PVC-free, and archival safe materials",
                "Reinforced spine and corners for durability",
                "Elegant Nordic-inspired design with embossed Hatake logo"
            ],
            specifications: {
                capacity: "480 standard-sized cards",
                material: "Premium PU leather exterior, acid-free polypropylene pages",
                color: "Black with blue interior",
                closure: "Heavy-duty zipper",
                pageConfiguration: "60 double-sided pages with 4 card slots per side"
            },
            image: "/images/IMG_9839.jpg", // Using one of the provided image names as main
            thumbnails: [
                "/images/IMG_9839.jpg",
                "/images/IMG_9814.jpg",
                "/images/IMG_9818.jpg",
                "/images/IMG_9816.jpg",
                "/images/IMG_9819.jpg",
                "/images/IMG_9820.jpg",
                "/images/IMG_9823.jpg",
                "/images/IMG_9824.jpg",
                "/images/IMG_9825.jpg",
                "/images/IMG_9826.jpg",
                "/images/IMG_9827.jpg"
            ]
        },
        {
            id: 3,
            name: "25x 35pt Top-Loaders",
            price: 30.00, // SEK
            sku: "0.031",
            category: "Top-Loaders",
            availability: "Pre-order 15 October",
            unitsAvailable: 550,
            description: "Hatake TCG 35pt Top-Loaders provide superior protection for your most valuable standard-sized trading cards. Each pack contains 25 crystal-clear rigid sleeves designed to preserve your cards in pristine condition.",
            features: [
                "Crystal-clear PVC construction for maximum visibility",
                "35pt thickness provides rigid protection against bending and damage",
                "Acid-free and archival safe materials",
                "Precision-cut edges to prevent card damage",
                "Perfect for storing valuable singles and graded cards",
                "Compatible with standard TCG cards in sleeves"
            ],
            specifications: {
                thickness: "35pt (standard)",
                quantity: "25 top-loaders per pack",
                material: "Acid-free PVC",
                dimensions: "Fits standard TCG cards (including those in sleeves)",
                finish: "Crystal clear"
            },
            image: "/images/IMG_9971.jpg", // Using one of the provided image names as main
            thumbnails: [
                "/images/IMG_9971.jpg",
                "/images/IMG_9970.jpg",
                "/images/IMG_9972.jpg",
                "/images/IMG_9973.jpg",
                "/images/IMG_9974.jpg",
                "/images/IMG_9975.jpg",
                "/images/IMG_9976.jpg",
                "/images/IMG_9978.jpg"
            ]
        },
        {
            id: 4,
            name: "10x 130pt Top-Loaders",
            price: 35.00, // SEK
            sku: "0.032",
            category: "Top-Loaders",
            availability: "Pre-order Releasing 15 October",
            unitsAvailable: 200,
            description: "Hatake TCG 130pt Top-Loaders are designed for maximum protection of multiple cards or oversized collectibles. Each pack contains 10 extra-thick, crystal-clear rigid sleeves that provide superior protection for your most valuable items.",
            features: [
                "Extra-thick 130pt construction for maximum rigidity and protection",
                "Crystal-clear PVC for perfect visibility of your collectibles",
                "Acid-free and archival safe materials",
                "Precision-cut edges to prevent damage",
                "Perfect for storing multiple cards together or oversized collectibles",
                "Ideal for high-value cards requiring additional protection"
            ],
            specifications: {
                thickness: "130pt (extra thick)",
                quantity: "10 top-loaders per pack",
                material: "Acid-free PVC",
                dimensions: "Fits multiple standard TCG cards or oversized collectibles",
                finish: "Crystal clear"
            },
            image: "/images/IMG_9979.jpg", // Using one of the provided image names as main
            thumbnails: [
                "/images/IMG_9979.jpg",
                "/images/IMG_9980.jpg",
                "/images/IMG_9981.jpg",
                "/images/IMG_9982.jpg",
                "/images/IMG_9983.jpg",
                "/images/IMG_9984.jpg",
                "/images/IMG_9985.jpg",
                "/images/IMG_9986.jpg",
                "/images/IMG_9987.jpg"
            ]
        },
        {
            id: 5,
            name: "PU DeckBox",
            price: 300.00, // SEK
            sku: "0.4",
            category: "Deckbox",
            availability: "Pre-order Releasing 15 October",
            unitsAvailable: 100,
            description: "The Hatake TCG PU DeckBox combines elegant Nordic design with practical functionality. With a generous 160+ card capacity and secure magnetic closure, this premium deck box keeps your valuable cards protected in style.",
            features: [
                "Premium PU leather exterior with elegant stitching",
                "Strong magnetic closure for secure transport",
                "Soft interior lining to prevent card damage",
                "Reinforced corners for durability",
                "Separate compartments for main deck and sideboard",
                "Embossed Hatake logo"
            ],
            specifications: {
                capacity: "160+ double-sleeved cards",
                material: "High-quality PU leather exterior, microfiber interior",
                color: "Black with blue interior",
                closure: "Magnetic",
                dimensions: "168 x 115 x 94 mm"
            },
            image: "/images/IMG_9924.jpg", // Using one of the provided image names as main
            thumbnails: [
                "/images/IMG_9924.jpg",
                "/images/IMG_9895.jpg",
                "/images/IMG_9899.jpg",
                "/images/IMG_9900.jpg",
                "/images/IMG_9901.jpg",
                "/images/IMG_9903.jpg",
                "/images/IMG_9904.jpg",
                "/images/IMG_9912.jpg",
                "/images/IMG_9941.jpg",
                "/images/IMG_9943.jpg",
                "/images/IMG_9947.jpg",
                "/images/IMG_9948.jpg",
                "/images/IMG_9949.jpg",
                "/images/IMG_9951.jpg"
            ]
        },
        {
            id: 6,
            name: "Duffel Bag",
            price: 300.00, // SEK
            sku: "0.5",
            category: "Bag",
            availability: "Pre-order Releasing 15 July",
            unitsAvailable: 22,
            description: "The Hatake TCG Duffel Bag is the ultimate tournament companion, designed specifically for TCG players who demand both functionality and style. With dimensions of 47*28*55cm, this spacious bag provides ample room for all your gaming essentials.",
            features: [
                "Durable water-resistant exterior",
                "Padded interior compartments for deck boxes and binders",
                "Dedicated sleeve pocket to keep your cards protected",
                "Adjustable shoulder strap with comfort padding",
                "Side pockets for quick access to frequently used items",
                "Premium YKK zippers for long-lasting performance"
            ],
            specifications: {
                dimensions: "47*28*55cm",
                material: "High-quality polyester with water-resistant coating",
                color: "Black with Nordic blue accents",
                capacity: "Fits up to 4 binders, 8 deck boxes, playmats, and accessories"
            },
            image: "/images/IMG_3159.jpeg", // Using the provided image name as main
            thumbnails: [
                "/images/IMG_3159.jpeg"
            ]
        },
        {
            id: 7,
            name: "PetDragon Playmat",
            price: 120.00, // SEK
            sku: "0.6", // Assigned a new SKU as it was missing
            category: "Playmat",
            availability: "In Stock", // Assumed, as only price and dimensions provided
            unitsAvailable: "Unlimited", // Assumed, as no stock info provided
            description: "A unique playmat designed by Discus, CEO from our partnered website selling high quality Commander decks. Features PetDragon and Hatake logo.",
            features: [
                "Unique design by Discus (partnered website CEO)",
                "Shipped inside of a usable tube",
                "Features PetDragon and Hatake logo"
            ],
            specifications: {
                dimensions: "14x24 inches",
                shipping: "Shipped inside of a usable tube"
            },
            image: "https://i.imgur.com/1NnbV67.png", // Main image provided
            thumbnails: [
                "https://i.imgur.com/1NnbV67.png", // Main image as thumbnail
                "/images/logo.png" // Hatake logo as another thumbnail
            ]
        }
    ];

    let cart = JSON.parse(localStorage.getItem('cart')) || [];

    // --- Helper Functions ---
    function openModal(modal) {
        modal.classList.add('open');
    }

    function closeModal(modal) {
        modal.classList.remove('open');
        // Clear any previous messages for auth modals
        if (modal === loginModal) {
            loginMessage.textContent = '';
            loginForm.reset();
        } else if (modal === registerModal) {
            registerMessage.textContent = '';
            registerForm.reset();
        } else if (modal === editProfileModal) {
            editProfileMessage.textContent = '';
            editProfileForm.reset();
            currentAvatarFile = null;
            currentBannerFile = null;
            // Reset image previews to current profile images
            if (profileAvatar) editAvatarPreview.src = profileAvatar.src;
            if (profileBanner) editBannerPreview.src = profileBanner.src;
        }
    }

    function formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    }

    // --- Auth Modals & Functionality ---
    // Check if elements exist before adding event listeners to prevent errors on pages where they don't exist
    if (loginButton) loginButton.addEventListener('click', () => openModal(loginModal));
    if (registerButton) registerButton.addEventListener('click', () => openModal(registerModal));
    if (closeLoginModal) closeLoginModal.addEventListener('click', () => closeModal(loginModal));
    if (closeRegisterModal) closeRegisterModal.addEventListener('click', () => closeModal(registerModal));

    // Close modals if clicking outside content
    if (loginModal) loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) closeModal(loginModal);
    });
    if (registerModal) registerModal.addEventListener('click', (e) => {
        if (e.target === registerModal) closeModal(registerModal);
    });
    if (productDetailModal) productDetailModal.addEventListener('click', (e) => {
        if (e.target === productDetailModal) closeModal(productDetailModal);
    });
    if (cartModal) cartModal.addEventListener('click', (e) => {
        if (e.target === cartModal) closeModal(cartModal);
    });
    if (editProfileModal) editProfileModal.addEventListener('click', (e) => {
        if (e.target === editProfileModal) closeModal(editProfileModal);
    });

    // Firebase Email/Password Registration
    if (registerForm) registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = registerEmail.value;
        const password = registerPassword.value;
        registerMessage.textContent = '';

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            // Create a user profile in Firestore
            await db.collection('users').doc(userCredential.user.uid).set({
                email: userCredential.user.email,
                displayName: userCredential.user.email.split('@')[0], // Default display name
                avatarUrl: '/images/user_profile.png', // Default avatar
                bannerUrl: '/images/default_banner.png', // Default banner
                bio: '',
                location: '',
                tcgInterests: [],
                favoriteGames: [],
                isVerified: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            registerMessage.textContent = 'Registration successful! You are now logged in.';
            registerMessage.classList.remove('text-red-500');
            registerMessage.classList.add('text-green-500');
            setTimeout(() => {
                closeModal(registerModal);
            }, 1500);
        } catch (error) {
            registerMessage.textContent = `Error: ${error.message}`;
            registerMessage.classList.remove('text-green-500');
            registerMessage.classList.add('text-red-500');
        }
    });

    // Firebase Email/Password Login
    if (loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginEmail.value;
        const password = loginPassword.value;
        loginMessage.textContent = '';

        try {
            await auth.signInWithEmailAndPassword(email, password);
            loginMessage.textContent = 'Login successful!';
            loginMessage.classList.remove('text-red-500');
            loginMessage.classList.add('text-green-500');
            setTimeout(() => {
                closeModal(loginModal);
            }, 1500);
        } catch (error) {
            loginMessage.textContent = `Error: ${error.message}`;
            loginMessage.classList.remove('text-green-500');
            loginMessage.classList.add('text-red-500');
        }
    });

    // Firebase Google Login/Register
    if (googleLoginButton) googleLoginButton.addEventListener('click', async () => {
        try {
            const result = await auth.signInWithPopup(googleProvider);
            // Check if it's a new user and create profile
            if (result.additionalUserInfo.isNewUser) {
                await db.collection('users').doc(result.user.uid).set({
                    email: result.user.email,
                    displayName: result.user.displayName || result.user.email.split('@')[0],
                    avatarUrl: result.user.photoURL || '/images/user_profile.png',
                    bannerUrl: '/images/default_banner.png', // Default banner for new Google users
                    bio: '',
                    location: '',
                    tcgInterests: [],
                    favoriteGames: [],
                    isVerified: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            loginMessage.textContent = 'Signed in with Google successfully!';
            loginMessage.classList.remove('text-red-500');
            loginMessage.classList.add('text-green-500');
            setTimeout(() => {
                closeModal(loginModal);
            }, 1500);
        } catch (error) {
            loginMessage.textContent = `Error: ${error.message}`;
            loginMessage.classList.remove('text-green-500');
            loginMessage.classList.add('text-red-500');
            console.error("Google login error:", error);
        }
    });

    if (googleRegisterButton) googleRegisterButton.addEventListener('click', async () => {
        try {
            const result = await auth.signInWithPopup(googleProvider);
            // Check if it's a new user and create profile
            if (result.additionalUserInfo.isNewUser) {
                await db.collection('users').doc(result.user.uid).set({
                    email: result.user.email,
                    displayName: result.user.displayName || result.user.email.split('@')[0],
                    avatarUrl: result.user.photoURL || '/images/user_profile.png',
                    bannerUrl: '/images/default_banner.png', // Default banner for new Google users
                    bio: '',
                    location: '',
                    tcgInterests: [],
                    favoriteGames: [],
                    isVerified: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            registerMessage.textContent = 'Registered and signed in with Google successfully!';
            registerMessage.classList.remove('text-red-500');
            registerMessage.classList.add('text-green-500');
            setTimeout(() => {
                closeModal(registerModal);
            }, 1500);
        } catch (error) {
            registerMessage.textContent = `Error: ${error.message}`;
            registerMessage.classList.remove('text-green-500');
            registerMessage.classList.add('text-red-500');
            console.error("Google registration error:", error);
        }
    });

    // Firebase Logout
    if (logoutButton) logoutButton.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await auth.signOut();
            console.log('User logged out');
            // Redirect to home or update UI (onAuthStateChanged handles it)
            if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
                window.location.href = 'index.html'; // Redirect to home if on another page
            }
        } catch (error) {
            console.error('Logout Error:', error.message);
        }
    });

    // Auth state change listener: Crucial for updating UI based on login status
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in
            if (loginButton) loginButton.classList.add('hidden');
            if (registerButton) registerButton.classList.add('hidden');
            if (userAvatar) userAvatar.classList.remove('hidden');
            if (userAvatar) userAvatar.src = user.photoURL || '/images/user_avatar.png'; // Update header avatar

            // Update sidebar info on index.html
            if (sidebarUserInfo) sidebarUserInfo.classList.remove('hidden');
            if (createPostSection) createPostSection.classList.remove('hidden');

            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (sidebarUserAvatar) sidebarUserAvatar.src = userData.avatarUrl || '/images/user_profile.png';
                if (sidebarUserName) sidebarUserName.textContent = userData.displayName || user.email.split('@')[0];
                if (sidebarUserHandle) sidebarUserHandle.textContent = `@${(userData.displayName || user.email.split('@')[0]).toLowerCase().replace(/\s/g, '')}`;

                // If on profile.html, render profile details
                if (window.location.pathname.includes('profile.html')) {
                    renderProfile(userData);
                }
            } else {
                // Fallback if user document doesn't exist yet (e.g., new user)
                if (sidebarUserAvatar) sidebarUserAvatar.src = '/images/user_profile.png';
                if (sidebarUserName) sidebarUserName.textContent = user.email.split('@')[0];
                if (sidebarUserHandle) sidebarUserHandle.textContent = `@${user.email.split('@')[0].toLowerCase()}`;
            }
            // Only render posts if on the index.html page
            if (postsContainer && (window.location.pathname.includes('index.html') || window.location.pathname === '/')) {
                renderPosts();
            }
        } else {
            // User is signed out
            if (loginButton) loginButton.classList.remove('hidden');
            if (registerButton) registerButton.classList.remove('hidden');
            if (userAvatar) userAvatar.classList.add('hidden');
            if (userDropdown) userDropdown.classList.add('hidden'); // Hide dropdown if user logs out
            if (sidebarUserInfo) sidebarUserInfo.classList.add('hidden');
            if (createPostSection) createPostSection.classList.add('hidden');
            // Only update posts container if on the index.html page
            if (postsContainer && (window.location.pathname.includes('index.html') || window.location.pathname === '/')) {
                postsContainer.innerHTML = '<p class="text-center text-gray-500">Please log in to see posts.</p>';
            }
            // If on profile.html and not logged in, redirect to index or show message
            if (window.location.pathname.includes('profile.html')) {
                // For now, we'll just clear content and show a message.
                // In a real app, you might redirect to login page.
                if (profileDisplayName) profileDisplayName.textContent = 'Please Log In';
                if (profileHandle) profileHandle.textContent = '';
                if (profileBio) profileBio.textContent = 'You must be logged in to view your profile.';
                if (profileLocation) profileLocation.textContent = 'N/A';
                if (profileInterests) profileInterests.textContent = 'N/A';
                if (profileFavoriteGames) profileFavoriteGames.textContent = 'N/A';
                if (profileAvatar) profileAvatar.src = '/images/user_profile.png';
                if (profileBanner) profileBanner.src = '/images/default_banner.png';
                if (profileVerificationBadge) profileVerificationBadge.classList.add('hidden');
                if (editProfileButton) editProfileButton.classList.add('hidden');
            }
        }
    });

    // --- Post Creation Functionality (only on index.html) ---
    if (uploadImageBtn) uploadImageBtn.addEventListener('click', () => {
        postImageUpload.setAttribute('accept', 'image/*');
        postImageUpload.click();
    });

    if (uploadVideoBtn) uploadVideoBtn.addEventListener('click', () => {
        postImageUpload.setAttribute('accept', 'video/*');
        postImageUpload.click();
    });

    if (postImageUpload) postImageUpload.addEventListener('change', (e) => {
        selectedFile = e.target.files[0];
        if (selectedFile) {
            postStatusMessage.textContent = `File selected: ${selectedFile.name}`;
            postStatusMessage.style.color = 'green';
        } else {
            postStatusMessage.textContent = '';
        }
    });

    if (submitPostBtn) submitPostBtn.addEventListener('click', async () => {
        const content = postContentInput.value.trim();
        if (!content && !selectedFile) {
            postStatusMessage.textContent = 'Please enter some content or select a file.';
            postStatusMessage.style.color = 'red';
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            postStatusMessage.textContent = 'You must be logged in to create a post.';
            postStatusMessage.style.color = 'red';
            return;
        }

        postStatusMessage.textContent = 'Posting...';
        postStatusMessage.style.color = 'blue';

        try {
            let fileUrl = null;
            if (selectedFile) {
                const fileExtension = selectedFile.name.split('.').pop();
                const fileName = `${user.uid}/posts/${Date.now()}.${fileExtension}`;
                const fileRef = storage.ref().child(fileName);
                await fileRef.put(selectedFile);
                fileUrl = await fileRef.getDownloadURL();
            }

            const userDoc = await db.collection('users').doc(user.uid).get();
            const userData = userDoc.exists ? userDoc.data() : { displayName: user.email.split('@')[0], avatarUrl: '/images/user_avatar.png' };

            await db.collection('posts').add({
                authorId: user.uid,
                authorDisplayName: userData.displayName,
                authorAvatarUrl: userData.avatarUrl,
                content: content,
                mediaUrl: fileUrl,
                mediaType: selectedFile ? (selectedFile.type.startsWith('image') ? 'image' : 'video') : null,
                likes: 0,
                commentsCount: 0,
                shares: 0,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            postStatusMessage.textContent = 'Post created successfully!';
            postStatusMessage.style.color = 'green';
            postContentInput.value = '';
            postImageUpload.value = ''; // Clear file input
            selectedFile = null;
            renderPosts(); // Refresh posts after new creation
        } catch (error) {
            console.error("Error creating post:", error);
            postStatusMessage.textContent = `Error creating post: ${error.message}`;
            postStatusMessage.style.color = 'red';
        }
    });

    // Function to render posts (replaces dummy posts)
    async function renderPosts() {
        if (!postsContainer) return; // Ensure element exists (only on index.html)
        postsContainer.innerHTML = '<p class="text-center text-gray-500">Loading posts...</p>';
        try {
            const postsSnapshot = await db.collection('posts').orderBy('timestamp', 'desc').get();
            if (postsSnapshot.empty) {
                postsContainer.innerHTML = '<p class="text-center text-gray-500">No posts yet. Be the first to post!</p>';
                return;
            }

            postsContainer.innerHTML = ''; // Clear loading message and old posts
            postsSnapshot.forEach(doc => {
                const post = doc.data();
                const date = post.timestamp ? new Date(post.timestamp.toDate()) : new Date();
                const timeAgo = formatTimeAgo(date);

                const postElement = document.createElement('div');
                postElement.classList.add('bg-white', 'p-6', 'rounded-lg', 'shadow-md');
                postElement.innerHTML = `
                    <div class="flex items-center mb-4">
                        <img src="${post.authorAvatarUrl || '/images/user_avatar.png'}" onerror="this.onerror=null;this.src='/images/user_avatar.png';" alt="Author Avatar" class="h-12 w-12 rounded-full border-2 border-blue-400 mr-4">
                        <div>
                            <h3 class="font-bold text-gray-800 text-lg">${post.authorDisplayName || 'Anonymous'}</h3>
                            <p class="text-gray-500 text-sm">@${(post.authorDisplayName || 'anonymous').toLowerCase().replace(/\s/g, '')} • ${timeAgo}</p>
                        </div>
                    </div>
                    <p class="text-gray-700 mb-4">${post.content}</p>
                    ${post.mediaUrl ? (post.mediaType === 'image' ? `<img src="${post.mediaUrl}" onerror="this.onerror=null;this.src='https://placehold.co/400x300?text=Image+Error';" alt="Post Image" class="w-full h-auto rounded-lg mb-4">` : `<video controls src="${post.mediaUrl}" class="w-full h-auto rounded-lg mb-4"></video>`) : ''}
                    <div class="flex justify-between items-center text-gray-600 text-sm">
                        <div class="flex space-x-4">
                            <button class="flex items-center hover:text-blue-600"><i class="fas fa-heart mr-1"></i> ${post.likes} Likes</button>
                            <button class="flex items-center hover:text-blue-600"><i class="fas fa-comment mr-1"></i> ${post.commentsCount} Comments</button>
                            <button class="flex items-center hover:text-blue-600"><i class="fas fa-share mr-1"></i> ${post.shares} Shares</button>
                        </div>
                    </div>
                `;
                postsContainer.appendChild(postElement);
            });
        } catch (error) {
            console.error("Error fetching posts:", error);
            postsContainer.innerHTML = '<p class="text-center text-red-500">Error loading posts.</p>';
        }
    }


    // --- Shop Page Functionality (only on shop.html) ---
    function renderShopProducts() {
        if (!shopProductGrid) return; // Ensure element exists (only on shop.html)
        shopProductGrid.innerHTML = ''; // Clear existing products
        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.classList.add('product-card');
            productCard.dataset.productId = product.id; // Store product ID

            productCard.innerHTML = `
                <img src="${product.image}" onerror="this.onerror=null;this.src='https://placehold.co/400x300?text=Image+Not+Found';" alt="${product.name}">
                <div class="product-info">
                    <div>
                        <h3>${product.name}</h3>
                        <p class="availability">Availability: ${product.availability}</p>
                        <p class="units-available">Units Available: Only ${product.unitsAvailable} left for preorder</p>
                    </div>
                    <p class="price">${product.price.toFixed(2)} SEK</p>
                    <div class="product-actions">
                        <button class="add-to-cart-btn" data-product-id="${product.id}">
                            <i class="fas fa-cart-plus mr-2"></i> Add to Cart
                        </button>
                        <button class="view-more-btn" data-product-id="${product.id}">
                            <i class="fas fa-eye mr-2"></i> View More
                        </button>
                    </div>
                </div>
            `;
            shopProductGrid.appendChild(productCard);
        });

        // Add event listeners for "Add to Cart" and "View More" buttons
        shopProductGrid.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click from triggering modal
                const productId = parseInt(e.currentTarget.dataset.productId);
                addToCart(productId);
            });
        });

        shopProductGrid.querySelectorAll('.view-more-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click from triggering modal
                const productId = parseInt(e.currentTarget.dataset.productId);
                openProductDetailModal(productId);
            });
        });
    }

    function openProductDetailModal(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        modalMainImage.src = product.image;
        modalMainImage.alt = product.name;
        modalProductName.textContent = product.name;
        modalProductPrice.textContent = `${product.price.toFixed(2)} SEK`;
        modalProductSku.textContent = product.sku;
        modalProductCategory.textContent = product.category;
        modalProductAvailability.textContent = product.availability;
        modalProductUnits.textContent = `Only ${product.unitsAvailable} left for preorder`;
        modalProductDescription.textContent = product.description;

        modalAddToCartButton.dataset.productId = product.id; // Set product ID for the add to cart button

        // Clear previous features and specifications
        modalProductFeatures.innerHTML = '';
        modalProductSpecifications.innerHTML = '';
        modalThumbnailsContainer.innerHTML = '';

        // Populate features
        if (product.features && product.features.length > 0) {
            product.features.forEach(feature => {
                const li = document.createElement('li');
                li.textContent = feature;
                modalProductFeatures.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = "No features listed.";
            modalProductFeatures.appendChild(li);
        }

        // Populate specifications
        if (product.specifications) {
            for (const key in product.specifications) {
                if (Object.hasOwnProperty.call(product.specifications, key)) {
                    const li = document.createElement('li');
                    li.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}: ${product.specifications[key]}`;
                    modalProductSpecifications.appendChild(li);
                }
            }
        } else {
            const li = document.createElement('li');
            li.textContent = "No specifications listed.";
            modalProductSpecifications.appendChild(li);
        }

        // Populate thumbnails
        if (product.thumbnails && product.thumbnails.length > 0) {
            modalThumbnailsContainer.style.display = 'flex'; // Ensure strip is visible
            product.thumbnails.forEach(thumbnailSrc => {
                const img = document.createElement('img');
                img.src = thumbnailSrc;
                img.alt = product.name + ' thumbnail';
                img.onerror = function() { this.onerror=null; this.src='https://placehold.co/100x100?text=Thumb+Error'; }; // Fallback for thumbnails
                img.classList.add('product-image-thumbnail');
                img.addEventListener('click', () => {
                    modalMainImage.src = thumbnailSrc;
                    // Remove active class from all and add to clicked
                    Array.from(modalThumbnailsContainer.children).forEach(thumb => thumb.classList.remove('active'));
                    img.classList.add('active');
                });
                modalThumbnailsContainer.appendChild(img);
            });
            // Set the first thumbnail as active by default
            if (modalThumbnailsContainer.firstChild) {
                modalThumbnailsContainer.firstChild.classList.add('active');
            }
        } else {
            // If no thumbnails, hide the strip
            modalThumbnailsContainer.style.display = 'none';
        }

        openModal(productDetailModal); // Show modal
    }

    if (closeProductDetailModalBtn) closeProductDetailModalBtn.addEventListener('click', () => closeModal(productDetailModal));

    // --- Cart Functionality ---
    function updateCartCount() {
        if (cartItemCount) {
            const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
            cartItemCount.textContent = totalItems;
        }
    }

    function addToCart(productId, quantity = 1) {
        const product = products.find(p => p.id === productId);
        if (!product) {
            console.error('Product not found:', productId);
            return;
        }

        const existingItemIndex = cart.findIndex(item => item.id === productId);

        if (existingItemIndex > -1) {
            cart[existingItemIndex].quantity += quantity;
        } else {
            cart.push({ ...product, quantity: quantity });
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        console.log('Cart updated:', cart);
        alert(`${product.name} added to cart!`); // Simple alert for confirmation
        renderCartItems(); // Update cart modal content if it's open
    }

    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        renderCartItems();
    }

    function renderCartItems() {
        if (!cartItemsContainer) return; // Ensure element exists

        cartItemsContainer.innerHTML = '';
        let total = 0;

        if (cart.length === 0) {
            emptyCartMessage.classList.remove('hidden');
        } else {
            emptyCartMessage.classList.add('hidden');
            cart.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('cart-item', 'flex', 'items-center', 'justify-between', 'py-3', 'border-b', 'last:border-b-0');
                itemDiv.innerHTML = `
                    <div class="flex items-center">
                        <img src="${item.image}" onerror="this.onerror=null;this.src='https://placehold.co/64x64?text=Item+Image';" alt="${item.name}" class="h-16 w-16 object-cover rounded-md mr-4">
                        <div class="cart-item-details">
                            <h4 class="font-semibold text-gray-800">${item.name}</h4>
                            <p class="text-gray-600 text-sm">Quantity: ${item.quantity}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4 cart-item-actions">
                        <span class="font-bold text-blue-600 item-price">${(item.price * item.quantity).toFixed(2)} SEK</span>
                        <button class="text-red-500 hover:text-red-700 remove-from-cart-btn" data-product-id="${item.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                cartItemsContainer.appendChild(itemDiv);
                total += item.price * item.quantity;
            });
        }
        if (cartTotalSpan) cartTotalSpan.textContent = `${total.toFixed(2)} SEK`;

        // Add event listeners for remove buttons
        cartItemsContainer.querySelectorAll('.remove-from-cart-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = parseInt(e.currentTarget.dataset.productId);
                removeFromCart(productId);
            });
        });
    }

    // Event listener for "Add to Cart" button inside product detail modal
    if (modalAddToCartButton) modalAddToCartButton.addEventListener('click', (e) => {
        const productId = parseInt(e.currentTarget.dataset.productId);
        addToCart(productId);
        closeModal(productDetailModal); // Close modal after adding to cart
    });

    // Event listener for opening cart modal (only on shop.html)
    if (cartButton) cartButton.addEventListener('click', () => {
        renderCartItems(); // Render items before opening
        openModal(cartModal);
    });

    if (closeCartModalBtn) closeCartModalBtn.addEventListener('click', () => closeModal(cartModal));

    // Placeholder for checkout (Stripe integration would go here)
    if (checkoutBtn) checkoutBtn.addEventListener('click', async () => {
        if (cart.length > 0) {
            alert('Proceeding to checkout! (Stripe integration needs backend)');
            // In a real application, you would send the cart data to your backend
            // to create a Stripe Checkout Session or Payment Intent.
            /*
            try {
                const response = await fetch('/create-checkout-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ cartItems: cart }),
                });
                const session = await response.json();
                const result = await stripe.redirectToCheckout({
                    sessionId: session.id,
                });
                if (result.error) {
                    alert(result.error.message);
                }
            } catch (error) {
                console.error('Error initiating checkout:', error);
                alert('Failed to initiate checkout.');
            }
            */
        } else {
            alert('Your cart is empty!');
        }
    });


    // --- My Collection Page Functionality (Placeholder for future implementation) ---
    // These elements and functions are expected to be on my_collection.html
    const manaboxCsvUpload = document.getElementById('manaboxCsvUpload');
    const uploadCollectionBtn = document.getElementById('uploadCollectionBtn');
    const collectionUploadStatus = document.getElementById('collectionUploadStatus');
    const userCollectionDisplay = document.getElementById('userCollectionDisplay');
    const emptyCollectionMessage = document.getElementById('emptyCollectionMessage');

    if (manaboxCsvUpload) manaboxCsvUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            collectionUploadStatus.textContent = `Selected file: ${file.name}. Click Upload to process.`;
            collectionUploadStatus.style.color = 'blue';
        } else {
            collectionUploadStatus.textContent = '';
        }
    });

    if (uploadCollectionBtn) uploadCollectionBtn.addEventListener('click', async () => {
        const file = manaboxCsvUpload.files[0];
        if (!file) {
            collectionUploadStatus.textContent = 'Please select a CSV file to upload.';
            collectionUploadStatus.style.color = 'red';
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            collectionUploadStatus.textContent = 'You must be logged in to upload a collection.';
            collectionUploadStatus.style.color = 'red';
            return;
        }

        collectionUploadStatus.textContent = 'Processing CSV... This may take a moment.';
        collectionUploadStatus.style.color = 'blue';

        PapaParse.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const cards = results.data;
                const batch = db.batch();
                const userCardsRef = db.collection('users').doc(user.uid).collection('cards');
                let cardsAdded = 0;

                for (const cardData of cards) {
                    const cardName = cardData['Card Name'] || cardData['Name'];
                    const setCode = cardData['Set'] || cardData['setCode'];
                    const collectorNumber = cardData['Collector Number'] || cardData['collectorNumber'];
                    const count = parseInt(cardData['Count']) || 1;
                    const foil = (cardData['Foil'] && cardData['Foil'].toLowerCase() === 'foil');
                    const condition = cardData['Condition'] || 'Near Mint';

                    if (!cardName) {
                        console.warn('Skipping card due to missing name:', cardData);
                        continue;
                    }

                    // Placeholder for Scryfall API call - in a real app, this might be a Cloud Function
                    let scryfallData = null;
                    try {
                        let scryfallUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;
                        if (setCode && collectorNumber) {
                            scryfallUrl = `https://api.scryfall.com/cards/${setCode.toLowerCase()}/${collectorNumber}`;
                        }
                        const response = await fetch(scryfallUrl);
                        if (response.ok) {
                            scryfallData = await response.json();
                        } else {
                            console.warn(`Scryfall lookup failed for ${cardName} (Set: ${setCode}, Num: ${collectorNumber}): ${response.statusText}`);
                            const fallbackResponse = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=cards`);
                            if (fallbackResponse.ok) {
                                const fallbackData = await fallbackResponse.json();
                                if (fallbackData.data && fallbackData.data.length > 0) {
                                    scryfallData = fallbackData.data[0];
                                    console.log(`Found fallback for ${cardName}`);
                                }
                            }
                        }
                    } catch (apiError) {
                        console.error(`Error fetching from Scryfall for ${cardName}:`, apiError);
                    }

                    const cardRef = userCardsRef.doc();
                    batch.set(cardRef, {
                        name: cardName,
                        set: setCode,
                        collectorNumber: collectorNumber,
                        count: count,
                        foil: foil,
                        condition: condition,
                        scryfallId: scryfallData ? scryfallData.id : null,
                        imageUrl: scryfallData && scryfallData.image_uris ? scryfallData.image_uris.normal : 'https://placehold.co/150x200?text=No+Image',
                        manaCost: scryfallData ? scryfallData.mana_cost : null,
                        typeLine: scryfallData ? scryfallData.type_line : null,
                        rarity: scryfallData ? scryfallData.rarity : null,
                        addedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    cardsAdded++;
                    await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit Scryfall API
                }

                try {
                    await batch.commit();
                    collectionUploadStatus.textContent = `Collection uploaded successfully! ${cardsAdded} cards processed.`;
                    collectionUploadStatus.style.color = 'green';
                    manaboxCsvUpload.value = '';
                    renderUserCollection();
                } catch (batchError) {
                    console.error("Error committing batch:", batchError);
                    collectionUploadStatus.textContent = `Error uploading collection: ${batchError.message}`;
                    collectionUploadStatus.style.color = 'red';
                }
            },
            error: (err) => {
                console.error("CSV parsing error:", err);
                collectionUploadStatus.textContent = `Error parsing CSV: ${err.message}`;
                collectionUploadStatus.style.color = 'red';
            }
        });
    });

    async function renderUserCollection() {
        if (!userCollectionDisplay) return; // Ensure element exists

        userCollectionDisplay.innerHTML = '';
        if (emptyCollectionMessage) emptyCollectionMessage.classList.add('hidden');

        const user = auth.currentUser;
        if (!user) {
            userCollectionDisplay.innerHTML = '<p class="text-center text-gray-500 col-span-full">Please log in to view your collection.</p>';
            return;
        }

        try {
            const collectionSnapshot = await db.collection('users').doc(user.uid).collection('cards').orderBy('name').get();
            if (collectionSnapshot.empty) {
                if (emptyCollectionMessage) emptyCollectionMessage.classList.remove('hidden');
                return;
            }

            collectionSnapshot.forEach(doc => {
                const card = doc.data();
                const cardElement = document.createElement('div');
                cardElement.classList.add('bg-white', 'p-4', 'rounded-lg', 'shadow-md', 'flex', 'flex-col', 'items-center');
                cardElement.innerHTML = `
                    <img src="${card.imageUrl || 'https://placehold.co/150x200?text=No+Image'}" onerror="this.onerror=null;this.src='https://placehold.co/150x200?text=Image+Error';" alt="${card.name}" class="w-full h-auto object-cover rounded-md mb-2">
                    <h3 class="font-semibold text-gray-800 text-center">${card.name}</h3>
                    <p class="text-gray-600 text-sm">Set: ${card.set || 'N/A'}</p>
                    <p class="text-gray-600 text-sm">Count: ${card.count}</p>
                    <p class="text-gray-600 text-sm">Condition: ${card.condition}</p>
                    ${card.foil ? '<span class="text-yellow-600 text-sm font-bold">FOIL</span>' : ''}
                `;
                userCollectionDisplay.appendChild(cardElement);
            });
        } catch (error) {
            console.error("Error fetching user collection:", error);
            userCollectionDisplay.innerHTML = '<p class="text-center text-red-500 col-span-full">Error loading collection.</p>';
        }
    }

    // --- Profile Page Functions ---
    async function renderProfile(userData) {
        if (!profileDisplayName) return; // Ensure elements exist on profile.html

        profileDisplayName.textContent = userData.displayName || 'User';
        profileHandle.textContent = `@${(userData.displayName || 'user').toLowerCase().replace(/\s/g, '')}`;
        profileBio.textContent = userData.bio || 'No bio provided yet.';
        profileLocation.textContent = userData.location || 'Not specified';
        profileInterests.textContent = (userData.tcgInterests && userData.tcgInterests.length > 0) ? userData.tcgInterests.join(', ') : 'None';
        profileFavoriteGames.textContent = (userData.favoriteGames && userData.favoriteGames.length > 0) ? userData.favoriteGames.join(', ') : 'None';
        profileAvatar.src = userData.avatarUrl || '/images/user_profile.png';
        profileBanner.src = userData.bannerUrl || '/images/default_banner.png';

        if (userData.isVerified) {
            profileVerificationBadge.classList.remove('hidden');
        } else {
            profileVerificationBadge.classList.add('hidden');
        }

        // Initialize edit modal with current data
        editDisplayName.value = userData.displayName || '';
        editBio.value = userData.bio || '';
        editLocation.value = userData.location || '';
        editInterests.value = (userData.tcgInterests && userData.tcgInterests.length > 0) ? userData.tcgInterests.join(', ') : '';
        editFavoriteGames.value = (userData.favoriteGames && userData.favoriteGames.length > 0) ? userData.favoriteGames.join(', ') : '';
        editAvatarPreview.src = userData.avatarUrl || '/images/user_profile.png';
        editBannerPreview.src = userData.bannerUrl || '/images/default_banner.png';
    }

    if (editProfileButton) editProfileButton.addEventListener('click', () => {
        openModal(editProfileModal);
    });

    if (closeEditProfileModal) closeEditProfileModal.addEventListener('click', () => closeModal(editProfileModal));

    if (selectEditAvatarBtn) selectEditAvatarBtn.addEventListener('click', () => avatarUploadInput.click());
    if (selectEditBannerBtn) selectEditBannerBtn.addEventListener('click', () => bannerUploadInput.click());

    if (avatarUploadInput) avatarUploadInput.addEventListener('change', (e) => {
        currentAvatarFile = e.target.files[0];
        if (currentAvatarFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                editAvatarPreview.src = event.target.result;
            };
            reader.readAsDataURL(currentAvatarFile);
        }
    });

    if (bannerUploadInput) bannerUploadInput.addEventListener('change', (e) => {
        currentBannerFile = e.target.files[0];
        if (currentBannerFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                editBannerPreview.src = event.target.result;
            };
            reader.readAsDataURL(currentBannerFile);
        }
    });

    if (editProfileForm) editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            editProfileMessage.textContent = 'You must be logged in to edit your profile.';
            editProfileMessage.style.color = 'red';
            return;
        }

        editProfileMessage.textContent = 'Saving changes...';
        editProfileMessage.style.color = 'blue';

        try {
            let avatarUrl = profileAvatar.src; // Start with current URLs
            let bannerUrl = profileBanner.src;

            if (currentAvatarFile) {
                const avatarRef = storage.ref().child(`users/${user.uid}/avatar/${currentAvatarFile.name}`);
                await avatarRef.put(currentAvatarFile);
                avatarUrl = await avatarRef.getDownloadURL();
            }

            if (currentBannerFile) {
                const bannerRef = storage.ref().child(`users/${user.uid}/banner/${currentBannerFile.name}`);
                await bannerRef.put(currentBannerFile);
                bannerUrl = await bannerRef.getDownloadURL();
            }

            const interestsArray = editInterests.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
            const gamesArray = editFavoriteGames.value.split(',').map(s => s.trim()).filter(s => s.length > 0);

            await db.collection('users').doc(user.uid).update({
                displayName: editDisplayName.value,
                bio: editBio.value,
                location: editLocation.value,
                tcgInterests: interestsArray,
                favoriteGames: gamesArray,
                avatarUrl: avatarUrl,
                bannerUrl: bannerUrl
            });

            editProfileMessage.textContent = 'Profile updated successfully!';
            editProfileMessage.style.color = 'green';
            currentAvatarFile = null; // Clear selected files after successful upload
            currentBannerFile = null;
            setTimeout(() => {
                closeModal(editProfileModal);
                // Re-render profile with new data
                auth.currentUser.reload().then(() => { // Reload user object to get latest photoURL
                    auth.onAuthStateChanged(auth.currentUser); // Trigger auth state change to update UI
                });
            }, 1000);

        } catch (error) {
            console.error("Error saving profile:", error);
            editProfileMessage.textContent = `Error saving profile: ${error.message}`;
            editProfileMessage.style.color = 'red';
        }
    });

    // Profile Tabs functionality
    const tabButtons = [tabOverview, tabCollection, tabAchievements];
    const tabContents = [overviewContent, collectionContent, achievementsContent];

    tabButtons.forEach(button => {
        if (button) {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => {
                    btn.classList.remove('text-blue-600', 'border-blue-600');
                    btn.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
                });
                button.classList.add('text-blue-600', 'border-blue-600');
                button.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');

                tabContents.forEach(content => content.classList.add('hidden'));
                const targetContentId = button.id.replace('tab', '').toLowerCase() + 'Content';
                document.getElementById(targetContentId).classList.remove('hidden');
            });
        }
    });


    // --- Initial Load Logic ---
    // This runs when the script is loaded on any page (index.html, shop.html, profile.html, etc.)
    // It checks the current URL to decide what to render/initialize.
    const currentPath = window.location.pathname;

    if (currentPath.includes('shop.html')) {
        renderShopProducts();
        updateCartCount(); // Update cart count on shop page load
    } else if (currentPath.includes('index.html') || currentPath === '/') {
        // Auth state change listener will trigger renderPosts on index.html
        // Initial state for sidebar and create post section is handled by onAuthStateChanged
    } else if (currentPath.includes('my_collection.html')) {
        // This is a placeholder for when my_collection.html is created
        // You would call renderUserCollection() here, but it needs to be guarded by auth state.
        // For now, it will be handled by the auth.onAuthStateChanged listener.
    } else if (currentPath.includes('profile.html')) {
        // Profile page logic is handled by auth.onAuthStateChanged, which calls renderProfile
    }

    // Global UI elements for header (user avatar, dropdown)
    if (userAvatar) userAvatar.addEventListener('click', () => {
        userDropdown.classList.toggle('hidden');
    });
    // Close dropdown if clicked outside
    window.addEventListener('click', (e) => {
        if (userAvatar && userDropdown && !userAvatar.contains(e.target) && !userDropdown.contains(e.target) && !userAvatar.classList.contains('hidden')) {
            userDropdown.classList.add('hidden');
        }
    });

});
