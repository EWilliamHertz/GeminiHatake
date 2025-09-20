// A simple flag to prevent the tour from being initialized more than once
let isTourInitialized = false;

// Function to initialize and start the guided tour for new users
function initAndStartTour(user) {
    // Prevent re-initialization
    if (isTourInitialized) {
        return;
    }
    isTourInitialized = true;

    const db = firebase.firestore();
    const userRef = db.collection('users').doc(user.uid);

    // Check if the user has already completed the tour
    userRef.get().then(doc => {
        if (doc.exists && doc.data().hasCompletedTour) {
            console.log("User has already completed the tour.");
            return;
        }

        // If the user is new or hasn't completed the tour, start it
        const tour = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                classes: 'shadow-md bg-gray-800 text-white',
                scrollTo: true,
                cancelIcon: {
                    enabled: true
                },
            }
        });

        // --- DEFINE ALL THE STEPS FOR THE TOUR ---

        const steps = [
            // Step 0: Welcome Modal (attached to the body as it's a general welcome)
            {
                id: 'welcome',
                title: 'Hey! Welcome to Hatake.eu!',
                text: "Thanks for joining our community, designed by & for TCG players. Would you like a quick tour to get started?",
                buttons: [
                    {
                        text: 'Skip for now',
                        action: () => {
                            tour.cancel();
                            markTourAsCompleted(userRef);
                        },
                        secondary: true
                    },
                    {
                        text: 'Start Tutorial',
                        action: tour.next
                    }
                ]
            },
            // Step 1: The Feed
            {
                id: 'feed',
                title: 'The Community Feed',
                text: "This is your <strong>Feed</strong>. It's where you'll see posts from other players, discover new marketplace listings, and get community updates. It’s the best place to see what’s new.",
                attachTo: { element: 'main', on: 'top' },
                buttons: [{ text: 'Next →', action: tour.next }],
                when: {
                    show: () => {
                        if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
                            window.location.href = '/index.html';
                        }
                    }
                }
            },
            // Step 2: Blog Posts & Articles
            {
                id: 'articles',
                title: 'Blog Posts & Articles',
                text: "Check out our <strong>Blog</strong> for articles and strategy guides. If you're interested in becoming a content creator, please contact <strong>Williama</strong> or <strong>DynamiteOrc</strong> to get writing permissions!",
                attachTo: { element: 'main', on: 'top' },
                buttons: [
                    { text: '← Previous', action: tour.back },
                    { text: 'Next →', action: tour.next }
                ],
                when: {
                    show: () => {
                        if (window.location.pathname !== '/articles.html') {
                            window.location.href = '/articles.html';
                        }
                    }
                }
            },
            // Step 3: Deck Building
            {
                id: 'decks',
                title: 'Deck Building',
                text: "Build and share your latest creations in the <strong>Decks</strong> section. You can craft your own decks, browse what others are playing, and get inspiration for your next tournament.",
                attachTo: { element: 'main', on: 'top' },
                buttons: [
                    { text: '← Previous', action: tour.back },
                    { text: 'Next →', action: tour.next }
                ],
                when: {
                    show: () => {
                        if (window.location.pathname !== '/deck.html') {
                            window.location.href = '/deck.html';
                        }
                    }
                }
            },
            // Step 4: Your Card Collection
            {
                id: 'collection',
                title: 'Your Card Collection',
                text: "This is your <strong>Collection</strong>, your personal digital binder. To get started, click here to search for cards and add them to your collection.",
                attachTo: { element: '#add-card-btn', on: 'bottom' },
                buttons: [
                    { text: '← Previous', action: tour.back },
                    { text: 'Next →', action: tour.next }
                ],
                when: {
                    show: () => {
                        if (window.location.pathname !== '/my_collection.html') {
                            window.location.href = '/my_collection.html';
                        }
                    }
                }
            },
            // Step 5: The Marketplace
            {
                id: 'marketplace',
                title: 'The Marketplace',
                text: "This is the <strong>Marketplace</strong>. Use the powerful search and filter tools to find the exact cards you need. <strong>For your security, all transactions are protected by Escrow.com.</strong>",
                attachTo: { element: '#main-search-bar', on: 'bottom' },
                buttons: [
                    { text: '← Previous', action: tour.back },
                    { text: 'Tell me more about fees', action: tour.next }
                ],
                when: {
                    show: () => {
                        if (window.location.pathname !== '/marketplace.html') {
                            window.location.href = '/marketplace.html';
                        }
                    }
                }
            },
            // Step 5b: Marketplace Fees
            {
                id: 'marketplace-fees',
                title: 'Transaction Fees',
                text: "We believe in transparency. A small fee of <strong>3.5%</strong> is applied to each transaction. This consists of a 2.7% service fee for Hatake and a 0.8% protection fee for Escrow.com.",
                attachTo: { element: '#main-search-bar', on: 'bottom' },
                buttons: [
                    { text: '← Previous', action: tour.back },
                    { text: 'Next →', action: tour.next }
                ]
            },
            // Step 6: Community
            {
                id: 'community',
                title: 'Community Hub',
                text: "Connect with other players in the <strong>Community</strong> section. Here you can join groups, manage your friends list, and see what fellow collectors are up to.",
                attachTo: { element: 'main', on: 'top' },
                buttons: [
                    { text: '← Previous', action: tour.back },
                    { text: 'Next →', action: tour.next }
                ],
                when: {
                    show: () => {
                        if (window.location.pathname !== '/community.html') {
                            window.location.href = '/community.html';
                        }
                    }
                }
            },
            // Step 7: Messaging
            {
                id: 'messages',
                title: 'Private Messages',
                text: "Stay in touch using our private <strong>Messages</strong>. You can chat with friends, coordinate trades, and connect with other members of the community.",
                attachTo: { element: 'main', on: 'top' },
                buttons: [
                    { text: '← Previous', action: tour.back },
                    { text: 'Next →', action: tour.next }
                ],
                when: {
                    show: () => {
                        if (window.location.pathname !== '/messages.html') {
                            window.location.href = '/messages.html';
                        }
                    }
                }
            },
            // Step 8: Profile
            {
                id: 'profile',
                title: 'Your Profile',
                text: "Finally, this is your <strong>Profile</strong>. Other users can see your trade history and collection stats here. Let's head to your settings to customize your experience.",
                attachTo: { element: '#profile-tabs', on: 'bottom' },
                buttons: [
                    { text: '← Previous', action: tour.back },
                    { text: 'Go to Settings →', action: tour.next }
                ],
                when: {
                    show: () => {
                        if (window.location.pathname !== '/profile.html') {
                            window.location.href = '/profile.html';
                        }
                    }
                }
            },
            // Step 8b: Settings
            {
                id: 'settings',
                title: 'Customize Your Experience',
                text: "In your <strong>Settings</strong>, you can update your profile, set your country and currency, and even enable the <strong>Messenger Widget</strong> for quick chat access from any page.",
                attachTo: { element: '#settings-nav', on: 'right' },
                buttons: [
                    { text: '← Previous', action: tour.back },
                    { text: 'Finish Tour', action: tour.next }
                ],
                when: {
                    show: () => {
                        if (window.location.pathname !== '/settings.html') {
                            window.location.href = '/settings.html';
                        }
                    }
                }
            },
             // Step 9: Final Modal
            {
                id: 'finish',
                title: "You're all set! ✅",
                text: "You've learned the basics. Now go explore, build your collection, and connect with the community. Happy collecting!",
                 buttons: [
                    {
                        text: "Let's Go!",
                        action: tour.complete
                    }
                ]
            }
        ];

        tour.addSteps(steps);

        // When the tour is finished or canceled, mark it as completed
        tour.on('complete', () => markTourAsCompleted(userRef));
        tour.on('cancel', () => markTourAsCompleted(userRef));

        // Start the tour!
        tour.start();

    }).catch(error => {
        console.error("Error checking for tour completion:", error);
    });
}

// Function to update the user's profile in Firestore
function markTourAsCompleted(userRef) {
    userRef.set({ hasCompletedTour: true }, { merge: true })
        .then(() => console.log("Tour completion status saved."))
        .catch(error => console.error("Error saving tour completion status:", error));
}