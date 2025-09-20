let isTourInitialized = false;

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

        const navigateTo = (url) => () => {
            sessionStorage.setItem('tour_step', 'true');
            window.location.href = url;
        };

        const steps = [
            { id: 'welcome', title: 'Hey! Welcome to Hatake.eu!', text: "Thanks for joining our community, designed by & for TCG players. Would you like a quick tour to get started?", buttons: [{ text: 'Skip for now', action: () => { tour.cancel(); markTourAsCompleted(userRef); }, secondary: true }, { text: 'Start Tutorial', action: tour.next }] },
            { id: 'feed', title: 'The Community Feed', text: "This is your <strong>Feed</strong>. It's where you'll see posts from other players, discover new marketplace listings, and get community updates. It’s the best place to see what’s new.", attachTo: { element: '#feed-container', on: 'top' }, buttons: [{ text: 'Next →', action: navigateTo('/articles.html') }] },
            { id: 'articles', title: 'Blog Posts & Articles', text: "Check out our <strong>Blog</strong> for articles and strategy guides. If you're interested in becoming a content creator, please contact <strong>Williama</strong> or <strong>DynamiteOrc</strong> to get writing permissions!", attachTo: { element: '#articles-grid', on: 'top' }, buttons: [{ text: '← Previous', action: navigateTo('/app.html') }, { text: 'Next →', action: navigateTo('/deck.html') }] },
            { id: 'decks', title: 'Deck Building', text: "Build and share your latest creations in the <strong>Decks</strong> section. You can craft your own decks, browse what others are playing, and get inspiration for your next tournament.", attachTo: { element: '#deck-container', on: 'top' }, buttons: [{ text: '← Previous', action: navigateTo('/articles.html') }, { text: 'Next →', action: navigateTo('/my_collection.html') }] },
            { id: 'collection', title: 'Your Card Collection', text: "This is your <strong>Collection</strong>, your personal digital binder. To get started, click here to search for cards and add them to your collection.", attachTo: { element: '#add-card-btn', on: 'bottom' }, buttons: [{ text: '← Previous', action: navigateTo('/deck.html') }, { text: 'Next →', action: navigateTo('/marketplace.html') }] },
            { id: 'marketplace', title: 'The Marketplace', text: "This is the <strong>Marketplace</strong>. Use the powerful search and filter tools to find the exact cards you need. <strong>For your security, all transactions are protected by Escrow.com.</strong>", attachTo: { element: '#main-search-bar', on: 'bottom' }, buttons: [{ text: '← Previous', action: navigateTo('/my_collection.html') }, { text: 'Tell me more about fees', action: tour.next }] },
            { id: 'marketplace-fees', title: 'Transaction Fees', text: "We believe in transparency. A small fee of <strong>3.5%</strong> is applied to each transaction. This consists of a 2.7% service fee for Hatake and a 0.8% protection fee for Escrow.com.", attachTo: { element: '#main-search-bar', on: 'bottom' }, buttons: [{ text: '← Previous', action: tour.back }, { text: 'Next →', action: navigateTo('/community.html') }] },
            { id: 'community', title: 'Community Hub', text: "Connect with other players in the <strong>Community</strong> section. Here you can join groups, manage your friends list, and see what fellow collectors are up to.", attachTo: { element: '#community-container', on: 'top' }, buttons: [{ text: '← Previous', action: navigateTo('/marketplace.html') }, { text: 'Next →', action: navigateTo('/messages.html') }] },
            { id: 'messages', title: 'Private Messages', text: "Stay in touch using our private <strong>Messages</strong>. You can chat with friends, coordinate trades, and connect with other members of the community.", attachTo: { element: '#messenger-container', on: 'top' }, buttons: [{ text: '← Previous', action: navigateTo('/community.html') }, { text: 'Next →', action: navigateTo('/profile.html') }] },
            { id: 'profile', title: 'Your Profile', text: "Finally, this is your <strong>Profile</strong>. Other users can see your trade history and collection stats here. Let's head to your settings to customize your experience.", attachTo: { element: '#profile-tabs', on: 'bottom' }, buttons: [{ text: '← Previous', action: navigateTo('/messages.html') }, { text: 'Go to Settings →', action: navigateTo('/settings.html') }] },
            { id: 'settings', title: 'Customize Your Experience', text: "In your <strong>Settings</strong>, you can update your profile, set your country and currency, and even enable the <strong>Messenger Widget</strong> for quick chat access from any page.", attachTo: { element: '#settings-nav', on: 'right' }, buttons: [{ text: '← Previous', action: navigateTo('/profile.html') }, { text: 'Finish Tour', action: tour.next }] },
            { id: 'finish', title: "You're all set! ✅", text: "You've learned the basics. Now go explore, build your collection, and connect with the community. Happy collecting!", buttons: [{ text: "Let's Go!", action: tour.complete }] }
        ];

        tour.addSteps(steps);

        const onTourEnd = () => {
            sessionStorage.removeItem('tour_step');
            markTourAsCompleted(userRef);
        };
        tour.on('complete', onTourEnd);
        tour.on('cancel', onTourEnd);

        // Logic to automatically resume the tour on the correct page
        const currentPage = window.location.pathname.toLowerCase();
        let startStep = 'welcome';
        if (sessionStorage.getItem('tour_step')) {
            if (currentPage.includes('articles.html')) startStep = 'articles';
            else if (currentPage.includes('deck.html')) startStep = 'decks';
            else if (currentPage.includes('my_collection.html')) startStep = 'collection';
            else if (currentPage.includes('marketplace.html')) startStep = 'marketplace';
            else if (currentPage.includes('community.html')) startStep = 'community';
            else if (currentPage.includes('messages.html')) startStep = 'messages';
            else if (currentPage.includes('profile.html')) startStep = 'profile';
            else if (currentPage.includes('settings.html')) startStep = 'settings';
            else startStep = 'feed'; // Default to feed if navigating
        }
        
        // Only start the tour if it hasn't been completed.
        tour.start(startStep);

    }).catch(error => console.error("Error checking for tour completion:", error));
}

function markTourAsCompleted(userRef) {
    userRef.set({ hasCompletedTour: true }, { merge: true })
        .catch(error => console.error("Error saving tour completion status:", error));
}