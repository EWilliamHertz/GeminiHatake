/**
 * HatakeSocial - Complete TCG Social Platform Script (Single File Version)
 *
 * This script manages all frontend logic for the HatakeSocial platform.
 * It is structured to run page-specific logic only after Firebase auth state
 * has been confirmed, preventing UI race conditions.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Hide the body initially to prevent a "flash" of the wrong content
    document.body.style.opacity = '0';

    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
        authDomain: "hatakesocial-88b5e.firebaseapp.com",
        projectId: "hatakesocial-88b5e",
        storageBucket: "hatakesocial-88b5e.appspot.com",
        messagingSenderId: "1091697032506",
        appId: "1:1091697032506:web:6a7cf9f10bd12650b22403"
    };

    // --- Firebase Initialization ---
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- Global Helpers ---
    const openModal = (modal) => { if (modal) modal.classList.add('open'); };
    const closeModal = (modal) => { if (modal) modal.classList.remove('open'); };
    
    // --- Core UI Listeners (Run Immediately) ---
    const setupModalAndFormListeners = () => {
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const logoutButton = document.getElementById('logoutButton');
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        const googleLoginButton = document.getElementById('googleLoginButton');
        const googleRegisterButton = document.getElementById('googleRegisterButton');

        if (loginButton) loginButton.addEventListener('click', () => openModal(loginModal));
        if (registerButton) registerButton.addEventListener('click', () => openModal(registerModal));
        document.getElementById('closeLoginModal')?.addEventListener('click', () => closeModal(loginModal));
        document.getElementById('closeRegisterModal')?.addEventListener('click', () => closeModal(registerModal));

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            auth.signInWithEmailAndPassword(email, password).then(() => closeModal(loginModal)).catch(err => alert(err.message));
        });

        const handleGoogleAuth = () => {
             auth.signInWithPopup(googleProvider).then(result => {
                const user = result.user;
                const userRef = db.collection('users').doc(user.uid);
                return userRef.get().then(doc => {
                    if (!doc.exists) {
                        return userRef.set({
                            displayName: user.displayName,
                            email: user.email,
                            photoURL: user.photoURL,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            handle: user.displayName.toLowerCase().replace(/\s/g, ''),
                            bio: "New HatakeSocial user!",
                            favoriteTcg: "Not set"
                        });
                    }
                });
            }).then(() => {
                closeModal(loginModal);
                closeModal(registerModal);
            }).catch(err => alert(err.message));
        };
        
        if (googleLoginButton) googleLoginButton.addEventListener('click', handleGoogleAuth);
        if (googleRegisterButton) googleRegisterButton.addEventListener('click', handleGoogleAuth);

        document.getElementById('registerForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const city = document.getElementById('registerCity')?.value || '';
            const country = document.getElementById('registerCountry')?.value || '';
            const favoriteTcg = document.getElementById('registerFavoriteTcg')?.value || '';
            const displayName = email.split('@')[0];

            auth.createUserWithEmailAndPassword(email, password)
                .then(cred => {
                    const defaultPhotoURL = `https://ui-avatars.com/api/?name=${displayName.charAt(0)}&background=random&color=fff`;
                    cred.user.updateProfile({ displayName: displayName, photoURL: defaultPhotoURL });
                    return db.collection('users').doc(cred.user.uid).set({
                        displayName: displayName, email: email, photoURL: defaultPhotoURL,
                        city: city, country: country, favoriteTcg: favoriteTcg,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        handle: displayName.toLowerCase().replace(/\s/g, ''),
                        bio: "New HatakeSocial user!"
                    });
                })
                .then(() => closeModal(registerModal))
                .catch(err => alert(err.message));
        });

        if (logoutButton) logoutButton.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
        if (userAvatar) userAvatar.addEventListener('click', () => userDropdown.classList.toggle('hidden'));
    };

    // --- Page-Specific Setup Functions ---

    // Index Page
    const setupIndexPage = (user) => {
        const postsContainer = document.getElementById('postsContainer');
        if (!postsContainer) return;
        // ... (All index page logic)
    };

    // Deck Page
    const setupDeckPage = (user) => {
        const deckBuilderForm = document.getElementById('deck-builder-form');
        if (!deckBuilderForm) return;

        console.log("Deck.js is running!"); // For debugging

        let deckToShare = null;
        const tabs = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        const deckFilters = document.getElementById('deck-filters');
        const tcgFilterButtons = document.getElementById('tcg-filter-buttons');
        const formatFilterContainer = document.getElementById('format-filter-container');
        const formatFilterButtons = document.getElementById('format-filter-buttons');
        const deckTcgSelect = document.getElementById('deck-tcg-select');
        const deckFormatSelectContainer = document.getElementById('deck-format-select-container');
        const deckFormatSelect = document.getElementById('deck-format-select');
        const editingDeckIdInput = document.getElementById('editing-deck-id');
        const builderTitle = document.getElementById('builder-title');
        const buildDeckBtn = document.getElementById('build-deck-btn');
        const deckNameInput = document.getElementById('deck-name-input');
        const deckBioInput = document.getElementById('deck-bio-input');
        const decklistInput = document.getElementById('decklist-input');
        
        const formats = {
            "Magic: The Gathering": ["Standard", "Modern", "Legacy", "Vintage", "Commander", "Pauper", "Oldschool"],
            "Pokémon": ["Standard", "Expanded"],
            "Flesh and Blood": ["Classic Constructed", "Blitz"],
            "Yu-Gi-Oh!": ["Advanced", "Traditional"]
        };

        const switchTab = (tabId) => {
            tabs.forEach(item => {
                const isTarget = item.id === tabId;
                item.classList.toggle('text-blue-600', isTarget);
                item.classList.toggle('border-blue-600', isTarget);
                item.classList.toggle('text-gray-500', !isTarget);
                item.classList.toggle('hover:border-gray-300', !isTarget);
            });
            const targetContentId = tabId.replace('tab-', 'content-');
            tabContents.forEach(content => content.id === targetContentId ? content.classList.remove('hidden') : content.classList.add('hidden'));
            
            if (tabId === 'tab-my-decks' || tabId === 'tab-community-decks') {
                deckFilters.classList.remove('hidden');
            } else {
                deckFilters.classList.add('hidden');
            }
        };
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.id === 'tab-deck-view') return;
                switchTab(tab.id);
                if (tab.id === 'tab-my-decks') loadMyDecks();
                if (tab.id === 'tab-community-decks') loadCommunityDecks();
            });
        });

        deckTcgSelect.addEventListener('change', () => {
            const selectedTcg = deckTcgSelect.value;
            if (formats[selectedTcg]) {
                deckFormatSelect.innerHTML = '<option value="" disabled selected>Select a Format</option>';
                formats[selectedTcg].forEach(format => {
                    deckFormatSelect.innerHTML += `<option value="${format}">${format}</option>`;
                });
                deckFormatSelectContainer.classList.remove('hidden');
            } else {
                deckFormatSelectContainer.classList.add('hidden');
            }
        });

        deckBuilderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!user) { alert("Please log in to build a deck."); return; }

            buildDeckBtn.disabled = true;
            buildDeckBtn.textContent = 'Processing...';

            const deckData = {
                name: deckNameInput.value,
                bio: deckBioInput.value,
                tcg: deckTcgSelect.value,
                format: deckFormatSelect.value,
                authorId: user.uid,
                authorName: user.displayName || 'Anonymous',
                createdAt: new Date(),
                cards: []
            };

            const lines = decklistInput.value.split('\n').filter(line => line.trim() !== '');
            const cardPromises = lines.map(line => {
                const match = line.match(/^(\d+)\s+(.*)/);
                if (!match) return null;
                const cardName = match[2].trim().replace(/\s\/\/.*$/, '');
                return fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(cardData => cardData ? { ...cardData, quantity: parseInt(match[1], 10) } : null);
            }).filter(p => p);

            deckData.cards = (await Promise.all(cardPromises)).filter(c => c);

            const editingId = editingDeckIdInput.value;
            if (editingId) {
                await db.collection('users').doc(user.uid).collection('decks').doc(editingId).update(deckData);
                alert("Deck updated successfully!");
                viewDeck(deckData, editingId);
            } else {
                const docRef = await db.collection('users').doc(user.uid).collection('decks').add(deckData);
                alert("Deck saved successfully!");
                viewDeck(deckData, docRef.id);
            }
            
            buildDeckBtn.disabled = false;
            buildDeckBtn.textContent = 'Build & Price Deck';
        });
        
        const applyFilters = () => {
            const activeTcg = tcgFilterButtons.querySelector('.filter-btn-active').dataset.tcg;
            const activeFormat = formatFilterButtons.querySelector('.filter-btn-active')?.dataset.format || 'all';
            const activeList = document.querySelector('#tab-my-decks.text-blue-600') ? 'my' : 'community';

            if (activeList === 'my') {
                loadMyDecks(activeTcg, activeFormat);
            } else {
                loadCommunityDecks(activeTcg, activeFormat);
            }
        };

        tcgFilterButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('tcg-filter-btn')) {
                tcgFilterButtons.querySelectorAll('.tcg-filter-btn').forEach(btn => btn.classList.remove('filter-btn-active'));
                e.target.classList.add('filter-btn-active');
                
                const selectedTcg = e.target.dataset.tcg;
                formatFilterButtons.innerHTML = '<button class="format-filter-btn filter-btn-active" data-format="all">All Formats</button>';
                if (selectedTcg !== 'all' && formats[selectedTcg]) {
                    formats[selectedTcg].forEach(format => {
                        formatFilterButtons.innerHTML += `<button class="format-filter-btn" data-format="${format}">${format}</button>`;
                    });
                    formatFilterContainer.classList.remove('hidden');
                } else {
                    formatFilterContainer.classList.add('hidden');
                }
                applyFilters();
            }
        });

        formatFilterButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('format-filter-btn')) {
                formatFilterButtons.querySelectorAll('.format-filter-btn').forEach(btn => btn.classList.remove('filter-btn-active'));
                e.target.classList.add('filter-btn-active');
                applyFilters();
            }
        });

        const viewDeck = (deck, deckId) => {
            document.getElementById('tab-deck-view').classList.remove('hidden');
            switchTab('tab-deck-view');
            deckToShare = { ...deck, id: deckId };

            document.getElementById('deck-view-name').textContent = deck.name;
            document.getElementById('deck-view-author').textContent = `by ${deck.authorName || 'Anonymous'}`;
            document.getElementById('deck-view-format').textContent = deck.format || 'N/A';
            const bioEl = document.getElementById('deck-view-bio');
            if (deck.bio) {
                bioEl.textContent = deck.bio;
                bioEl.classList.remove('hidden');
            } else {
                bioEl.classList.add('hidden');
            }
            
            const listEl = document.getElementById('deck-view-list');
            const featuredCardImg = document.getElementById('deck-view-featured-card');
            listEl.innerHTML = '';

            const categorizedCards = {};
            let totalPrice = 0;
            deck.cards.forEach(card => {
                const mainType = card.type_line.split(' // ')[0];
                let category = 'Other';
                if (mainType.includes('Creature')) category = 'Creatures';
                else if (mainType.includes('Planeswalker')) category = 'Planeswalkers';
                else if (mainType.includes('Instant') || mainType.includes('Sorcery')) category = 'Spells';
                else if (mainType.includes('Artifact')) category = 'Artifacts';
                else if (mainType.includes('Enchantment')) category = 'Enchantments';
                else if (mainType.includes('Land')) category = 'Lands';
                
                if (!categorizedCards[category]) categorizedCards[category] = [];
                categorizedCards[category].push(card);
                totalPrice += parseFloat(card.prices.usd || 0) * card.quantity;
            });

            document.getElementById('deck-view-price').textContent = `$${totalPrice.toFixed(2)}`;
            if (deck.cards.length > 0) {
                featuredCardImg.src = deck.cards[0].image_uris?.normal || 'https://placehold.co/223x310?text=No+Image';
            }

            const order = ['Creatures', 'Planeswalkers', 'Spells', 'Artifacts', 'Enchantments', 'Lands', 'Other'];
            order.forEach(category => {
                if (categorizedCards[category]) {
                    const cardCount = categorizedCards[category].reduce((acc, c) => acc + c.quantity, 0);
                    let categoryHTML = `<div class="break-inside-avoid mb-4"><h3 class="font-bold text-lg mb-2">${category} (${cardCount})</h3>`;
                    categorizedCards[category].forEach(card => {
                        categoryHTML += `<p>${card.quantity} <a href="#" class="card-link text-blue-600 hover:underline" data-card-name="${card.name}" data-card-image="${card.image_uris?.normal}">${card.name}</a></p>`;
                    });
                    categoryHTML += `</div>`;
                    listEl.innerHTML += categoryHTML;
                }
            });
        };

        const loadMyDecks = async (tcg = 'all', format = 'all') => {
            const myDecksList = document.getElementById('my-decks-list');
            if (!user) { myDecksList.innerHTML = '<p>Please log in to see your decks.</p>'; return; }
            myDecksList.innerHTML = '<p>Loading...</p>';
            let query = db.collection('users').doc(user.uid).collection('decks');
            if(tcg !== 'all') query = query.where('tcg', '==', tcg);
            if(format !== 'all') query = query.where('format', '==', format);
            const snapshot = await query.orderBy('createdAt', 'desc').get();

            if (snapshot.empty) { myDecksList.innerHTML = '<p>No decks found for the selected filters.</p>'; return; }
            myDecksList.innerHTML = '';
            snapshot.forEach(doc => {
                const deck = doc.data();
                const totalPrice = deck.cards.reduce((acc, card) => acc + parseFloat(card.prices.usd || 0) * card.quantity, 0);
                const deckCard = document.createElement('div');
                deckCard.className = 'bg-white p-4 rounded-lg shadow-md';
                deckCard.innerHTML = `
                    <div class="cursor-pointer hover:opacity-80">
                        <h3 class="text-xl font-bold">${deck.name}</h3>
                        <p class="text-sm text-gray-500">${deck.format || deck.tcg}</p>
                        <p class="text-blue-500 font-semibold mt-2">Value: $${totalPrice.toFixed(2)}</p>
                    </div>
                    <button class="edit-deck-btn mt-2 text-sm text-gray-500 hover:text-black">Edit</button>`;
                
                deckCard.querySelector('.cursor-pointer').addEventListener('click', () => viewDeck(deck, doc.id));
                deckCard.querySelector('.edit-deck-btn').addEventListener('click', () => editDeck(deck, doc.id));
                myDecksList.appendChild(deckCard);
            });
        };
        
        const loadCommunityDecks = async (tcg = 'all', format = 'all') => {
            const communityDecksList = document.getElementById('community-decks-list');
            communityDecksList.innerHTML = '<p>Loading...</p>';
            try {
                let query = db.collectionGroup('decks');
                if(tcg !== 'all') query = query.where('tcg', '==', tcg);
                if(format !== 'all') query = query.where('format', '==', format);
                const snapshot = await query.orderBy('createdAt', 'desc').limit(21).get();

                if (snapshot.empty) { communityDecksList.innerHTML = '<p>No decks found for the selected filters.</p>'; return; }
                communityDecksList.innerHTML = '';
                snapshot.forEach(doc => {
                    const deck = doc.data();
                    const totalPrice = deck.cards.reduce((acc, card) => acc + parseFloat(card.prices.usd || 0) * card.quantity, 0);
                    const deckCard = document.createElement('div');
                    deckCard.className = 'bg-white p-4 rounded-lg shadow-md cursor-pointer hover:shadow-xl';
                    deckCard.innerHTML = `<h3 class="text-xl font-bold">${deck.name}</h3><p class="text-sm text-gray-500">by ${deck.authorName || 'Anonymous'}</p><p class="text-blue-500 font-semibold mt-2">Value: $${totalPrice.toFixed(2)}</p>`;
                    deckCard.addEventListener('click', () => viewDeck(deck, doc.id));
                    communityDecksList.appendChild(deckCard);
                });
            } catch (error) {
                console.error(error);
                communityDecksList.innerHTML = `<p class="text-red-500">Error loading decks. The necessary database index might be missing.</p>`;
            }
        };

        const editDeck = (deck, deckId) => {
            switchTab('tab-builder');
            builderTitle.textContent = "Edit Deck";
            buildDeckBtn.textContent = "Update Deck";
            editingDeckIdInput.value = deckId;

            deckNameInput.value = deck.name;
            deckBioInput.value = deck.bio || '';
            deckTcgSelect.value = deck.tcg;
            
            deckTcgSelect.dispatchEvent(new Event('change'));
            deckFormatSelect.value = deck.format;

            decklistInput.value = deck.cards.map(c => `${c.quantity} ${c.name}`).join('\n');
        };

        const urlParams = new URLSearchParams(window.location.search);
        const deckId = urlParams.get('deckId');
        if (deckId) {
            db.collectionGroup('decks').where(firebase.firestore.FieldPath.documentId(), '==', deckId).limit(1).get()
                .then(snapshot => {
                    if (!snapshot.empty) {
                        const doc = snapshot.docs[0];
                        viewDeck(doc.data(), doc.id);
                    }
                });
        }
    };

    // ... other page setup functions ...

    // --- Main Execution Controller ---
    function runPageSpecificSetup(user) {
        setupIndexPage(user);
        setupDeckPage(user);
        // setupMyCollectionPage(user);
        // setupProfilePage(user);
        // setupMessagesPage(user);
    }

    // --- Initial Call ---
    setupModalAndFormListeners();
});
