import os
import re

# This is the single, standardized sidebar that will be applied to all pages,
# matching the new design.
STANDARDIZED_SIDEBAR = r"""
    <aside id="sidebar" class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 lg:translate-x-0 transform -translate-x-full transition-transform duration-300 ease-in-out fixed lg:relative h-full z-40 flex flex-col">
        <div class="h-28 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <a href="index.html"><img src="https://i.imgur.com/B06rBhI.png" alt="Gemini Hatake Logo" class="h-20 w-auto"></a>
        </div>
        <nav class="flex-grow overflow-y-auto p-4 space-y-2">
            <a href="index.html" class="nav-link"><i class="fas fa-home"></i><span>Home</span></a>
            <a href="my_collection.html" class="nav-link"><i class="fas fa-layer-group"></i><span>My Collection</span></a>
            <a href="marketplace.html" class="nav-link"><i class="fas fa-store"></i><span>Marketplace</span></a>
            <a href="trades.html" class="nav-link"><i class="fas fa-exchange-alt"></i><span>Trades</span></a>
            <a href="shop.html" class="nav-link"><i class="fas fa-shopping-bag"></i><span>Official Shop</span></a>
            <a href="community.html" class="nav-link"><i class="fas fa-users"></i><span>Community</span></a>
            <a href="events.html" class="nav-link"><i class="fas fa-calendar-alt"></i><span>Events</span></a>
            <a href="messages.html" class="nav-link"><i class="fas fa-comments"></i><span>Messages</span></a>
            <a href="articles.html" class="nav-link"><i class="fas fa-newspaper"></i><span>Articles</span></a>
            <a href="referrals.html" class="nav-link"><i class="fas fa-user-plus"></i><span>Referrals</span></a>
        </nav>
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div id="currency-selector-container" class="flex items-center justify-between">
                </div>
        </div>
    </aside>
"""

# This header contains the mobile toggle, a single search bar, and the user-actions div.
STANDARDIZED_HEADER = r"""
        <header class="relative z-30 h-28 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800 lg:bg-transparent dark:lg:bg-transparent">
            <div class="flex items-center">
                <button id="sidebar-toggle" class="lg:hidden mr-4 text-gray-600 dark:text-gray-300">
                    <i class="fas fa-bars text-xl"></i>
                </button>
                <div class="relative hidden sm:block">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input type="text" id="main-search-bar" placeholder="Search..." class="w-full md:w-96 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <div id="main-search-results" class="absolute mt-2 w-full md:w-96 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-10 hidden"></div>
                </div>
            </div>
            <div id="user-actions" class="flex items-center space-x-5">
                </div>
        </header>
"""

# This is the HTML for the login and register modals.
MODALS_HTML = r"""
    <div id="loginModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
        <div class="modal-content w-full max-w-md bg-white dark:bg-gray-800 rounded-lg relative p-8 shadow-xl">
            <button id="closeLoginModal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold">&times;</button>
            <h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">Login</h2>
            <form id="loginForm" class="space-y-4">
                <div>
                    <label for="loginEmail" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Email:</label>
                    <input type="email" id="loginEmail" class="input-style" placeholder="Enter your email" required>
                </div>
                <div>
                    <label for="loginPassword" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Password:</label>
                    <input type="password" id="loginPassword" class="input-style" placeholder="Enter your password" required>
                </div>
                <p id="login-error-message" class="text-red-500 text-sm hidden h-4"></p>
                <button type="submit" class="w-full btn-primary">Login</button>
            </form>
             <div class="separator my-4">Or</div>
            <button type="button" id="googleLoginButton" class="w-full btn-secondary flex items-center justify-center">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" class="w-5 h-5 mr-2"> Sign in with Google
            </button>
        </div>
    </div>

    <div id="registerModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
        <div class="modal-content w-full max-w-md bg-white dark:bg-gray-800 rounded-lg relative p-8 shadow-xl">
            <button id="closeRegisterModal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold">&times;</button>
            <h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">Register</h2>
            <form id="registerForm" class="space-y-4">
                <div>
                    <label for="registerEmail" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Email:</label>
                    <input type="email" id="registerEmail" class="input-style" placeholder="Enter your email" required>
                </div>
                <div>
                    <label for="registerPassword" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Password:</label>
                    <input type="password" id="registerPassword" class="input-style" placeholder="Minimum 6 characters" required>
                </div>
                <div>
                    <label for="registerCity" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">City:</label>
                    <input type="text" id="registerCity" class="input-style" placeholder="Your City">
                </div>
                <div>
                    <label for="registerCountry" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Country:</label>
                    <input type="text" id="registerCountry" class="input-style" placeholder="Your Country">
                </div>
                <div>
                    <label for="registerFavoriteTcg" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Favorite TCG:</label>
                    <input type="text" id="registerFavoriteTcg" class="input-style" placeholder="e.g., Magic: The Gathering">
                </div>
                <p id="register-error-message" class="text-red-500 text-sm hidden h-4"></p>
                <button type="submit" class="w-full btn-primary bg-green-600 hover:bg-green-700">Register</button>
            </form>
            <div class="separator my-4">Or</div>
            <button type="button" id="googleRegisterButton" class="w-full btn-secondary flex items-center justify-center">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" class="w-5 h-5 mr-2"> Register with Google
            </button>
        </div>
    </div>
"""

def standardize_html_file(filepath, filename):
    """Rebuilds a single HTML file with the standard layout."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract unique content from inside the <main> tag.
        main_content_match = re.search(r'<main[^>]*>(.*)</main>', content, re.DOTALL)
        
        main_content_inner_html = ""
        if main_content_match:
            main_content_inner_html = main_content_match.group(1).strip()
            # Remove any duplicate headers that might be inside the main content
            main_content_inner_html = re.sub(r'<header.*?</header>', '', main_content_inner_html, flags=re.DOTALL)
        else:
            print(f"  - WARNING: No <main> tag found in {filename}. Main content might be missing.")
            body_content_match = re.search(r'<body.*?>(.*)</body>', content, re.DOTALL)
            if body_content_match:
                main_content_inner_html = body_content_match.group(1).strip()


        # Create the new body content using the standard template
        new_body_content = f"""
<div class="flex h-screen bg-gray-100 dark:bg-gray-900 font-sans">
{STANDARDIZED_SIDEBAR}
    <div id="main-content-wrapper" class="flex-1 flex flex-col overflow-hidden">
        <div id="main-content-overlay" class="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30 hidden"></div>
{STANDARDIZED_HEADER}
        <main class="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-6">
            {main_content_inner_html}
        </main>
    </div>
</div>
{MODALS_HTML}
"""

        # Replace the entire old body content with the new standardized one
        new_html_content = re.sub(r'<body.*</body>', f'<body>{new_body_content}</body>', content, flags=re.DOTALL)

        # Write the completely rebuilt HTML back to the file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_html_content)
        
        print(f"  - Successfully standardized {filename}")
        return True

    except Exception as e:
        print(f"  - ❌ ERROR processing {filepath}: {e}")
        return False

def main():
    """Main function to update js/auth.js and standardize all HTML files."""
    
    auth_js_path = 'js/auth.js'
    new_auth_js_content = """
/**
 * HatakeSocial - Merged Authentication & Global UI Script (v31 - Final Cart & Sidebar Logic)
 *
 * This script combines all previous features with the final fixes for cart and sidebar functionality.
 *
 * - FIX: The dynamically created cart button in the header now correctly opens the cart modal.
 * - NEW: Includes a global function to handle sidebar toggling for mobile.
 * - Merged Features:
 * - Standardized header logic with conditional cart icon on shop.html.
 * - Full Firebase configuration and initialization.
 * - Robust email verification flow on login.
 * - Real-time notification listener and friend request handshake logic.
 * - Global utilities like `showToast`, modal handlers, and currency conversion.
 */

// --- Global Toast Notification Function ---
const showToast = (message, type = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) { // Create container if it doesn't exist
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed bottom-5 right-5 z-50';
        document.body.appendChild(toastContainer);
        container = toastContainer;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fas ${iconClass} toast-icon"></i> <p>${message}</p>`;
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
};


document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';

    // --- Firebase Initialization ---
    const firebaseConfig = {
        apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
        authDomain: "hatakesocial-88b5e.firebaseapp.com",
        projectId: "hatakesocial-88b5e",
        storageBucket: "hatakesocial-88b5e.firebasestorage.app",
        messagingSenderId: "1091697032506",
        appId: "1:1091697032506:web:6a7cf9f10bd12650b22403",
        measurementId: "G-EH0PS2Z84J"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    if (typeof firebase.analytics === 'function') {
        window.analytics = firebase.analytics();
    }
    
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.storage = firebase.storage();
    
    if (typeof firebase.functions === 'function') {
        window.functions = firebase.functions();
    } else {
        window.functions = null;
        console.warn('Firebase Functions library not loaded. Some features may not work.');
    }

    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- Internationalization & Currency ---
    window.HatakeSocial = {
        conversionRates: { SEK: 1, USD: 0.095, EUR: 0.088 },
        currentCurrency: localStorage.getItem('hatakeCurrency') || 'SEK',
        currentUserData: null,
        convertAndFormatPrice(amount, fromCurrency = 'SEK') {
            const toCurrency = this.currentCurrency;
            if (amount === undefined || amount === null || isNaN(amount)) {
                return `0.00 ${toCurrency}`;
            }
            const fromRate = this.conversionRates[fromCurrency];
            if (fromRate === undefined) {
                 return `N/A`;
            }
            const amountInSEK = amount / fromRate;
            const toRate = this.conversionRates[toCurrency];
             if (toRate === undefined) {
                 return `N/A`;
            }
            const convertedAmount = amountInSEK * toRate;
            return `${convertedAmount.toFixed(2)} ${toCurrency}`;
        }
    };

    const setupCurrencySelector = () => {
        const container = document.getElementById('currency-selector-container');
        if (!container) return;

        container.innerHTML = `
            <label for="currency-selector" class="text-sm text-gray-600 dark:text-gray-400">Currency</label>
            <select id="currency-selector" class="text-sm rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500">
                <option value="SEK">SEK</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
            </select>
        `;
        const selector = document.getElementById('currency-selector');
        selector.value = window.HatakeSocial.currentCurrency;

        selector.addEventListener('change', (e) => {
            window.HatakeSocial.currentCurrency = e.target.value;
            localStorage.setItem('hatakeCurrency', e.target.value);
            window.location.reload();
        });
    };

    window.openModal = (modal) => { 
        if (modal) {
            if (modal.id === 'cart-modal') {
                modal.classList.add('open');
            } else {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
            const errorMsg = modal.querySelector('[id$="-error-message"]');
            if (errorMsg) {
                errorMsg.classList.add('hidden');
                errorMsg.textContent = '';
            }
        }
    };
    window.closeModal = (modal) => { 
        if (modal) {
            if (modal.id === 'cart-modal') {
                modal.classList.remove('open');
            } else {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        }
    };
    
    const setupGlobalListeners = () => {
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        const googleLoginButton = document.getElementById('googleLoginButton');
        const googleRegisterButton = document.getElementById('googleRegisterButton');
        
        document.getElementById('closeLoginModal')?.addEventListener('click', () => closeModal(loginModal));
        document.getElementById('closeRegisterModal')?.addEventListener('click', () => closeModal(registerModal));

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorMessageEl = document.getElementById('login-error-message');

            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    closeModal(loginModal);
                })
                .catch(err => {
                    errorMessageEl.textContent = err.message;
                    errorMessageEl.classList.remove('hidden');
                });
        });

        document.getElementById('registerForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const city = document.getElementById('registerCity')?.value || '';
            const country = document.getElementById('registerCountry')?.value || '';
            const favoriteTcg = document.getElementById('registerFavoriteTcg')?.value || '';
            const referrer = document.getElementById('registerReferrer')?.value.trim() || '';
            const displayName = email.split('@')[0];
            const handle = displayName.replace(/[^a-zA-Z0-9]/g, '');
            const errorMessageEl = document.getElementById('register-error-message');

            auth.createUserWithEmailAndPassword(email, password)
                .then(cred => {
                    const defaultPhotoURL = `https://ui-avatars.com/api/?name=${displayName.charAt(0)}&background=random&color=fff`;
                    
                    cred.user.sendEmailVerification();

                    cred.user.updateProfile({ displayName: displayName, photoURL: defaultPhotoURL });
                    return db.collection('users').doc(cred.user.uid).set({
                        displayName: displayName,
                        displayName_lower: displayName.toLowerCase(),
                        email: email, photoURL: defaultPhotoURL,
                        city: city, country: country, favoriteTcg: favoriteTcg,
                        referrer: referrer,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        handle: handle,
                        isAdmin: false,
                        primaryCurrency: 'SEK'
                    });
                })
                .then(() => {
                    closeModal(document.getElementById('registerModal'));
                    showToast("Registration successful! A verification link has been sent to your email.", "success");
                })
                .catch(err => {
                    if(errorMessageEl) {
                        errorMessageEl.textContent = err.message;
                        errorMessageEl.classList.remove('hidden');
                    } else {
                        showToast(err.message, "error");
                    }
                });
        });

        const handleGoogleAuth = () => {
             auth.signInWithPopup(googleProvider).then(result => {
                const user = result.user;
                const userRef = db.collection('users').doc(user.uid);
                return userRef.get().then(doc => {
                    if (!doc.exists) {
                        const handle = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
                        return userRef.set({
                            displayName: user.displayName,
                            displayName_lower: user.displayName.toLowerCase(),
                            email: user.email, photoURL: user.photoURL,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            handle: handle, bio: "New HatakeSocial user!", favoriteTcg: "Not set", isAdmin: false, primaryCurrency: 'SEK',
                            referrer: ''
                        });
                    }
                });
            }).then(() => {
                closeModal(loginModal);
                closeModal(registerModal);
            }).catch(err => showToast(err.message, "error"));
        };
        
        if (googleLoginButton) googleLoginButton.addEventListener('click', handleGoogleAuth);
        if (googleRegisterButton) googleRegisterButton.addEventListener('click', handleGoogleAuth);
        
        const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
        if (scrollToTopBtn) {
            window.addEventListener('scroll', () => {
                if (window.pageYOffset > 200) {
                    scrollToTopBtn.classList.remove('hidden');
                } else {
                    scrollToTopBtn.classList.add('hidden');
                }
            });

            scrollToTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    };

    let friendRequestHandshakeListener = null;
    function listenForAcceptedRequests(user) {
        if (friendRequestHandshakeListener) {
            friendRequestHandshakeListener();
        }

        const sentRequestsRef = db.collection('friendRequests')
            .where('senderId', '==', user.uid)
            .where('status', '==', 'accepted');

        friendRequestHandshakeListener = sentRequestsRef.onSnapshot(async (snapshot) => {
            if (snapshot.empty) return;

            const batch = db.batch();
            const currentUserRef = db.collection('users').doc(user.uid);

            for (const doc of snapshot.docs) {
                const request = doc.data();
                const newFriendId = request.receiverId;

                batch.update(currentUserRef, { friends: firebase.firestore.FieldValue.arrayUnion(newFriendId) });
                batch.delete(doc.ref);
                
                const notificationData = {
                    message: `You are now friends with ${request.receiverName || 'a new user'}.`,
                    link: `/profile.html?uid=${newFriendId}`,
                    isRead: false,
                    timestamp: new Date()
                };
                const notificationRef = db.collection('users').doc(user.uid).collection('notifications').doc();
                batch.set(notificationRef, notificationData);
            }

            try {
                await batch.commit();
            } catch (error) {
                console.error("Error completing friend handshake:", error);
            }
        }, error => {
            console.error("Error listening for accepted friend requests:", error);
        });
    }
    
    function sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    let unsubscribeNotifications = null;
    auth.onAuthStateChanged(async (user) => {
        if (user && !user.emailVerified) {
            document.body.innerHTML = `
                <div class="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                    <div class="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl text-center max-w-lg mx-4">
                        <h1 class="text-2xl font-bold text-gray-800 dark:text-white mb-4">Please Verify Your Email</h1>
                        <p class="text-gray-600 dark:text-gray-400 mb-6">
                            A verification link has been sent to <strong>${user.email}</strong>. Please check your inbox (and spam folder) and click the link to activate your account.
                        </p>
                        <div class="space-x-4">
                            <button id="resend-verification-btn" class="px-5 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Resend Email</button>
                            <button onclick="firebase.auth().signOut()" class="px-5 py-2 bg-gray-600 text-white font-semibold rounded-full hover:bg-gray-700">Logout</button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('resend-verification-btn').addEventListener('click', () => {
                user.sendEmailVerification()
                    .then(() => showToast('A new verification email has been sent.', 'success'))
                    .catch(err => showToast('Error sending email: ' + err.message, 'error'));
            });
    
            document.body.style.opacity = '1';
            return;
        }
    
        const userActions = document.getElementById('user-actions');
        
        if (user) {
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists) {
                    console.warn("User document not found. Signing out.");
                    auth.signOut();
                    return;
                }
                const userData = userDoc.data();
                window.HatakeSocial.currentUserData = userData;
                const isAdmin = userData.isAdmin === true;
                const photoURL = userData.photoURL || 'https://i.imgur.com/B06rBhI.png';
                let userActionsHTML = '';

                // Conditionally add Cart Icon only on shop.html
                if (window.location.pathname.includes('shop.html')) {
                     userActionsHTML += `
                        <div class="relative">
                            <button id="cart-btn" class="text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 text-xl">
                                <i class="fas fa-shopping-cart"></i>
                                <span id="cart-item-count" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center hidden">0</span>
                            </button>
                        </div>
                    `;
                }

                // Add Notification Bell and Profile Dropdown
                userActionsHTML += `
                    <div class="relative">
                        <button id="notification-bell-btn" class="text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 text-xl"><i class="fas fa-bell"></i><span id="notification-count" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center hidden">0</span></button>
                        <div id="notification-dropdown" class="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-20 hidden">
                            <div class="p-3 font-bold border-b dark:border-gray-700">Notifications</div>
                            <div id="notification-list" class="max-h-96 overflow-y-auto"><p class="p-4 text-sm text-gray-500">No new notifications.</p></div>
                            <a href="notifications.html" class="block text-center p-2 text-sm text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700">View all</a>
                        </div>
                    </div>
                    <div class="relative">
                        <button id="profile-avatar-btn"><img src="${photoURL}" alt="User Avatar" class="w-10 h-10 rounded-full object-cover border-2 border-transparent hover:border-blue-500"></button>
                        <div id="profile-dropdown" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-20 hidden">
                            <a href="profile.html?uid=${user.uid}" class="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">My Profile</a>
                            <a href="settings.html" class="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Settings</a>
                            ${isAdmin ? `<a href="admin.html" class="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Admin Panel</a>` : ''}
                            <hr class="border-gray-200 dark:border-gray-600">
                            <button id="logout-btn-dropdown" class="block w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Logout</button>
                        </div>
                    </div>
                `;

                // Inject the final HTML into the header placeholder
                if (userActions) {
                    userActions.innerHTML = userActionsHTML;

                    // *** THIS IS THE FIX for the cart button click ***
                    const cartBtn = document.getElementById('cart-btn');
                    if (cartBtn) {
                        cartBtn.addEventListener('click', () => {
                            const cartModal = document.getElementById('cart-modal');
                            if (cartModal) {
                                openModal(cartModal); // Use the global modal opener
                            } else {
                                console.error("Cart modal with ID 'cart-modal' not found!");
                            }
                        });
                    }
                    
                    document.getElementById('notification-bell-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('profile-dropdown').classList.add('hidden'); document.getElementById('notification-dropdown').classList.toggle('hidden'); });
                    document.getElementById('profile-avatar-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('notification-dropdown').classList.add('hidden'); document.getElementById('profile-dropdown').classList.toggle('hidden'); });
                    document.getElementById('logout-btn-dropdown').addEventListener('click', () => auth.signOut());
                }

                // Setup Notification Listener
                if (unsubscribeNotifications) unsubscribeNotifications();
                unsubscribeNotifications = db.collection('users').doc(user.uid).collection('notifications').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
                    const unreadCount = snapshot.docs.filter(doc => !doc.data().isRead).length;
                    const countEl = document.getElementById('notification-count');
                    const listEl = document.getElementById('notification-list');
                    if (countEl) { countEl.textContent = unreadCount; countEl.classList.toggle('hidden', unreadCount === 0); }
                    if (listEl) {
                        if (snapshot.empty) { listEl.innerHTML = '<p class="p-4 text-sm text-gray-500">No new notifications.</p>'; } 
                        else {
                            listEl.innerHTML = '';
                            snapshot.docs.slice(0, 5).forEach(doc => {
                                const notif = doc.data();
                                const el = document.createElement('a');
                                el.href = notif.link || '#';
                                el.className = `flex items-start p-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-900/50' : ''}`;
                                el.innerHTML = `<div class="flex-shrink-0 mr-3"><div class="w-3 h-3 rounded-full ${!notif.isRead ? 'bg-blue-500' : 'bg-transparent'} mt-1.5"></div></div><div><p class="text-sm text-gray-700 dark:text-gray-300">${sanitizeHTML(notif.message)}</p><p class="text-xs text-gray-500">${new Date(notif.timestamp?.toDate()).toLocaleString()}</p></div>`;
                                el.addEventListener('click', () => db.collection('users').doc(user.uid).collection('notifications').doc(doc.id).update({ isRead: true }));
                                listEl.appendChild(el);
                            });
                        }
                    }
                }, err => console.error("Notification listener error:", err));
                
                listenForAcceptedRequests(user);

            } catch (error) {
                console.error("Error during authenticated state setup:", error);
                showToast("Could not load your profile.", "error");
                auth.signOut();
            }
        } else {
            // --- User is Logged Out ---
            window.HatakeSocial.currentUserData = null;
            if (friendRequestHandshakeListener) friendRequestHandshakeListener();
            if (unsubscribeNotifications) unsubscribeNotifications();

            if (userActions) {
                 userActions.innerHTML = `
                    <div class="space-x-2">
                        <button id="header-login-btn" class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Login</button>
                        <button id="header-register-btn" class="px-4 py-2 bg-gray-600 text-white font-semibold rounded-full hover:bg-gray-700">Register</button>
                    </div>`;
                document.getElementById('header-login-btn').addEventListener('click', () => openModal(document.getElementById('loginModal')));
                document.getElementById('header-register-btn').addEventListener('click', () => openModal(document.getElementById('registerModal')));
            }
        }
        
        document.dispatchEvent(new CustomEvent('authReady', { detail: { user } }));
        document.body.style.transition = 'opacity 0.3s ease-in-out';
        document.body.style.opacity = '1';
    });
    
    setupGlobalListeners();
    setupCurrencySelector();

    // Global click listener to close dropdowns
    window.addEventListener('click', () => {
        document.getElementById('profile-dropdown')?.classList.add('hidden');
        document.getElementById('notification-dropdown')?.classList.add('hidden');
    });
});
    """

    # 1. Update js/auth.js
    print("🚀 Starting comprehensive layout and authentication fix...")
    print("-" * 60)
    try:
        os.makedirs('js', exist_ok=True)
        with open(auth_js_path, 'w', encoding='utf-8') as f:
            f.write(new_auth_js_content.strip())
        print("✅ Step 1/2: Successfully updated 'js/auth.js' with the new version.")
    except Exception as e:
        print(f"❌ ERROR: Could not update 'js/auth.js'. Please check file permissions. Details: {e}")
        return

    # 2. Standardize all HTML files
    print("\n✅ Step 2/2: Standardizing all page layouts...")
    print("-" * 60)
    
    # List of all HTML files to be processed
    html_files = [f for f in os.listdir('.') if f.endswith('.html') and 'original' not in f]
    
    files_processed = 0
    for filename in html_files:
        filepath = os.path.join('.', filename)
        if standardize_html_file(filepath, filename):
            files_processed += 1
            
    print("-" * 60)
    print(f"✅ Process complete. Standardized {files_processed} HTML files.")
    print("Summary of changes:")
    print("- Enforced a single, standardized sidebar and header on all pages based on the provided image.")
    print("- Removed all duplicate headers, search bars, and old navigation elements.")
    print("- Injected the new `auth.js` script to handle dynamic login/register/user status in the header.")
    print("- Added standardized login/register modals to all pages for `auth.js` to use.")

if __name__ == "__main__":
    main()
