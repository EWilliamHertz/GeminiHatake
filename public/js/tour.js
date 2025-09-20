let isTourInitialized = false;

// Helper function to close the login modal
const closeLoginModal = () => {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
    }
    document.body.classList.remove('modal-open');
};

// Attach the main function to the global window object to make it accessible from auth.js
window.initAndStartTour = function(user) {
    if (isTourInitialized) return;
    isTourInitialized = true;

    const db = firebase.firestore();
    const userRef = db.collection('users').doc(user.uid);

    userRef.get().then(doc => {
        if (doc.exists && doc.data().hasCompletedTour) {
            console.log("User has already completed the tour.");
            return;
        }

        const tour = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                classes: 'hatake-tour-popup',
                scrollTo: true,
                cancelIcon: { enabled: true },
            }
        });

        const navigateTo = (stepId, url) => () => {
            sessionStorage.setItem('tour_current_step', stepId);
            window.location.href = url;
        };

        const onTourEnd = () => {
            sessionStorage.removeItem('tour_current_step');
            markTourAsCompleted(userRef);
            closeLoginModal(); // Ensure modal is closed on tour end
        };
        
        tour.on('complete', onTourEnd);
        tour.on('cancel', onTourEnd);

        // --- TOUR STEPS ---
        
        tour.addStep({
            id: 'welcome',
            title: 'Hey! Welcome to Hatake.eu!',
            text: "Thanks for joining our community, designed by & for TCG players. Would you like a quick tour to get started?",
            buttons: [
                { text: 'Skip for now', action: tour.cancel, secondary: true },
                { text: 'Start Tutorial', action: tour.next }
            ]
        });

        tour.addStep({
            id: 'feed',
            title: 'The Community Feed',
            text: "This is your <strong>Feed</strong>. It's where you'll see posts from other players, discover new marketplace listings, and get community updates. It’s the best place to see what’s new.",
            attachTo: { element: '#feed-container', on: 'top' },
            beforeShowPromise: () => {
                return new Promise(resolve => {
                    closeLoginModal(); // Explicitly close modal before showing this step
                    resolve();
                });
            },
            buttons: [
                { text: 'Next →', action: navigateTo('articles', '/articles.html?type=blog') }
            ]
        });

        tour.addStep({
            id: 'articles',
            title: 'Blog Posts & Articles',
            text: "Check out our <strong>Blog</strong> for articles and strategy guides. If you're interested in becoming a content creator, please contact <strong>Williama</strong> or <strong>DynamiteOrc</strong> to get writing permissions!",
            attachTo: { element: '#articles-grid', on: 'top' },
            buttons: [
                { text: '← Previous', action: navigateTo('feed', '/app.html') },
                { text: 'Next →', action: navigateTo('decks', '/deck.html') }
            ]
        });
        
        tour.addStep({
            id: 'decks',
            title: 'Deck Building',
            text: "Build and share your latest creations in the <strong>Decks</strong> section. You can craft your own decks, browse what others are playing, and get inspiration for your next tournament.",
            attachTo: { element: '#deck-container', on: 'top' },
            buttons: [
                 { text: '← Previous', action: navigateTo('articles', '/articles.html?type=blog') },
                 { text: 'Next →', action: navigateTo('collection', '/my_collection.html') }
            ]
        });
        
        tour.addStep({
            id: 'collection',
            title: 'Your Card Collection',
            text: "This is your <strong>Collection</strong>, your personal digital binder. To get started, click here to search for cards and add them to your collection.",
            attachTo: { element: '#add-card-btn', on: 'bottom' },
            buttons: [
                { text: '← Previous', action: navigateTo('decks', '/deck.html') },
                { text: 'Next →', action: navigateTo('marketplace', '/marketplace.html') }
            ]
        });

        tour.addStep({
            id: 'marketplace',
            title: 'The Marketplace',
            text: "This is the <strong>Marketplace</strong>. Use the powerful search and filter tools to find the exact cards you need. <strong>For your security, all transactions are protected by Escrow.com.</strong>",
            attachTo: { element: '#main-search-bar', on: 'bottom' },
            buttons: [
                { text: '← Previous', action: navigateTo('collection', '/my_collection.html') },
                { text: 'Tell me more about fees', action: tour.next }
            ]
        });
        
        tour.addStep({
            id: 'marketplace-fees',
            title: 'Transaction Fees',
            text: "We believe in transparency. A small fee of <strong>3.5%</strong> is applied to each transaction. This consists of a 2.7% service fee for Hatake and a 0.8% protection fee for Escrow.com.",
            attachTo: { element: '#main-search-bar', on: 'bottom' },
            buttons: [
                { text: '← Previous', action: tour.back },
                { text: 'Next →', action: navigateTo('community', '/community.html') }
            ]
        });
        
        tour.addStep({
            id: 'community',
            title: 'Community Hub',
            text: "Connect with other players in the <strong>Community</strong> section. Here you can join groups, manage your friends list, and see what fellow collectors are up to.",
            attachTo: { element: '#community-container', on: 'top' },
            buttons: [
                { text: '← Previous', action: navigateTo('marketplace', '/marketplace.html') },
                { text: 'Next →', action: navigateTo('messages', '/messages.html') }
            ]
        });
        
        tour.addStep({
            id: 'messages',
            title: 'Private Messages',
            text: "Stay in touch using our private <strong>Messages</strong>. You can chat with friends, coordinate trades, and connect with other members of the community.",
            attachTo: { element: '#messenger-container', on: 'top' },
            buttons: [
                { text: '← Previous', action: navigateTo('community', '/community.html') },
                { text: 'Next →', action: navigateTo('profile', '/profile.html') }
            ]
        });

        tour.addStep({
            id: 'profile',
            title: 'Your Profile',
            text: "Finally, this is your <strong>Profile</strong>. Other users can see your trade history and collection stats here. Let's head to your settings to customize your experience.",
            attachTo: { element: '#profile-tabs', on: 'bottom' },
            buttons: [
                { text: '← Previous', action: navigateTo('messages', '/messages.html') },
                { text: 'Go to Settings →', action: navigateTo('settings', '/settings.html') }
            ]
        });

        tour.addStep({
            id: 'settings',
            title: 'Customize Your Experience',
            text: "In your <strong>Settings</strong>, you can update your profile, set your country and currency, and even enable the <strong>Messenger Widget</strong> for quick chat access from any page.",
            attachTo: { element: '#settings-nav', on: 'right' },
            buttons: [
                { text: '← Previous', action: navigateTo('profile', '/profile.html') },
                { text: 'Finish Tour', action: tour.next }
            ]
        });

        tour.addStep({
            id: 'finish',
            title: "You're all set! ✅",
            text: "You've learned the basics. Now go explore, build your collection, and connect with the community. Happy collecting!",
            buttons: [
                { text: "Let's Go!", action: tour.complete }
            ]
        });

        // Logic to automatically start or resume the tour
        const currentStep = sessionStorage.getItem('tour_current_step');
        if (currentStep) {
            sessionStorage.removeItem('tour_current_step'); // Clear it after use
            tour.start();
            // A brief delay to allow the page to fully load before showing the step
            setTimeout(() => tour.show(currentStep), 200);
        } else if (window.location.pathname === '/' || window.location.pathname === '/index.html' || window.location.pathname === '/app.html') {
             tour.start();
        }

    }).catch(error => console.error("Error checking for tour completion:", error));
};

function markTourAsCompleted(userRef) {
    userRef.set({ hasCompletedTour: true }, { merge: true })
        .catch(error => console.error("Error saving tour completion status:", error));
}