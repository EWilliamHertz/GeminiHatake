// public/js/draft.js
document.addEventListener('authReady', ({ detail: { user } }) => {
    if (!user) {
        document.body.innerHTML = '<div class="flex items-center justify-center h-screen"><div class="text-center"><h1 class="text-2xl font-bold">Please log in to participate in a draft.</h1><a href="/index.html" class="btn btn-primary mt-4">Go to Home</a></div></div>';
        return;
    }

    const db = firebase.firestore();
    const functions = firebase.functions();
    let currentDraftId = null;
    let unsubscribeDraft = null;
    let unsubscribePlayerState = null;

    // --- Page Identification ---
    const isLobbyPage = !!document.getElementById('draft-list-container');
    const isRoomPage = !!document.getElementById('current-pack-container');

    // --- Cloud Function Callers ---
    const createDraft = functions.httpsCallable('createDraft');
    const joinDraft = functions.httpsCallable('joinDraft');
    const startDraft = functions.httpsCallable('startDraft');
    const pickCard = functions.httpsCallable('pickCard');

    // ===================================================================
    // LOBBY PAGE LOGIC
    // ===================================================================
    if (isLobbyPage) {
        const createDraftBtn = document.getElementById('create-draft-btn');
        const draftListContainer = document.getElementById('draft-list-container');
        const currentDraftLobby = document.getElementById('current-draft-lobby');
        const draftSetName = document.getElementById('draft-set-name');
        const playerList = document.getElementById('player-list');
        const startDraftBtn = document.getElementById('start-draft-btn');

        createDraftBtn.addEventListener('click', async () => {
            const setCode = prompt("Enter Set Code (e.g., MKM for Murders at Karlov Manor):", "MKM");
            if (setCode) {
                const setName = "Murders at Karlov Manor"; // This would ideally be fetched from an API
                try {
                    createDraftBtn.disabled = true;
                    const result = await createDraft({ setCode: setCode.toUpperCase(), setName });
                    window.location.hash = result.data.draftId;
                } catch (error) {
                    console.error("Error creating draft:", error);
                    alert("Could not create draft: " + error.message);
                } finally {
                    createDraftBtn.disabled = false;
                }
            }
        });

        startDraftBtn.addEventListener('click', async () => {
            if (currentDraftId && confirm("Are you sure you want to start the draft? No one else will be able to join.")) {
                try {
                    startDraftBtn.disabled = true;
                    startDraftBtn.textContent = "Starting...";
                    await startDraft({ draftId: currentDraftId });
                } catch (error) {
                    console.error("Error starting draft:", error);
                    alert("Could not start draft: " + error.message);
                    startDraftBtn.disabled = false;
                    startDraftBtn.textContent = "Start Draft";
                }
            }
        });

        const listenToDraftLobby = (draftId) => {
            if (unsubscribeDraft) unsubscribeDraft();
            currentDraftId = draftId;
            unsubscribeDraft = db.collection('drafts').doc(draftId).onSnapshot(doc => {
                if (!doc.exists) {
                    alert("This draft no longer exists.");
                    window.location.hash = '';
                    return;
                }
                const data = doc.data();
                if (data.status === 'drafting') {
                    window.location.href = `draft-room.html?id=${draftId}`;
                } else {
                    updateLobbyUI(data);
                }
            });
        };

        const updateLobbyUI = (draftData) => {
            draftListContainer.classList.add('hidden');
            currentDraftLobby.classList.remove('hidden');
            draftSetName.textContent = draftData.setName || draftData.set;
            playerList.innerHTML = draftData.players.map(p => `
                <li class="flex items-center space-x-2 p-2 bg-gray-700 rounded">
                    <img src="${p.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-8 h-8 rounded-full">
                    <span>${p.displayName}</span>
                </li>
            `).join('');
            startDraftBtn.classList.toggle('hidden', user.uid !== draftData.hostId);
        };
        
        const checkUrlForDraft = () => {
            const draftId = window.location.hash.substring(1);
            if (draftId) {
                joinDraft({ draftId })
                    .then(() => listenToDraftLobby(draftId))
                    .catch(err => {
                        alert("Could not join draft: " + err.message);
                        window.location.hash = '';
                    });
            } else {
                currentDraftLobby.classList.add('hidden');
                draftListContainer.classList.remove('hidden');
                db.collection('drafts').where('status', '==', 'lobby').onSnapshot(snapshot => {
                     draftListContainer.innerHTML = snapshot.docs.length === 0 
                     ? '<p>No open drafts found. Why not create one?</p>'
                     : snapshot.docs.map(doc => `
                        <div class="p-4 bg-gray-800 rounded mb-2 flex justify-between items-center">
                            <div>
                                <p class="font-bold">${doc.data().setName}</p>
                                <p class="text-sm text-gray-400">Host: ${doc.data().hostName} | Players: ${doc.data().players.length}/8</p>
                            </div>
                            <a href="#${doc.id}" class="btn btn-secondary">Join</a>
                        </div>
                     `).join('');
                });
            }
        };

        window.addEventListener('hashchange', checkUrlForDraft);
        checkUrlForDraft();
    }

    // ===================================================================
    // DRAFT ROOM LOGIC
    // ===================================================================
    if (isRoomPage) {
        const draftSetName = document.getElementById('draft-set-name');
        const packNumEl = document.getElementById('pack-number');
        const pickNumEl = document.getElementById('pick-number');
        const currentPackCards = document.getElementById('current-pack-cards');
        const pickedCardsContainer = document.getElementById('picked-cards-container');
        const pickedCount = document.getElementById('picked-count');
        
        const urlParams = new URLSearchParams(window.location.search);
        const draftId = urlParams.get('id');

        if (!draftId) {
            document.body.innerHTML = '<h1>Error: No Draft ID specified.</h1>';
            return;
        }

        const listenToDraftRoom = () => {
            unsubscribeDraft = db.collection('drafts').doc(draftId).onSnapshot(doc => {
                if (!doc.exists) return;
                const data = doc.data();
                draftSetName.textContent = `Drafting: ${data.setName}`;
                packNumEl.textContent = data.currentPackNumber;
                pickNumEl.textContent = data.currentPickNumber;
            });

            unsubscribePlayerState = db.collection('drafts').doc(draftId).collection('playerState').doc(user.uid)
                .onSnapshot(doc => {
                    if (!doc.exists) return;
                    const data = doc.data();
                    renderCurrentPack(data.currentPack);
                    renderPickedCards(data.pickedCards);
                });
        };

        const renderCurrentPack = (cards) => {
            if (!cards || cards.length === 0) {
                currentPackCards.innerHTML = '<p class="col-span-full text-center text-xl animate-pulse">Waiting for the next pack...</p>';
                return;
            }
            currentPackCards.innerHTML = cards.map(card => `
                <div class="cursor-pointer transform hover:scale-105 transition-transform duration-150" data-card-id="${card.id}">
                    <img src="${card.imageUrl}" alt="${card.name}" class="rounded-md w-full">
                </div>
            `).join('');
            
            currentPackCards.querySelectorAll('[data-card-id]').forEach(el => {
                el.addEventListener('click', async () => {
                    const selectedCardId = el.dataset.cardId;
                    currentPackCards.innerHTML = '<p class="col-span-full text-center text-xl animate-pulse">Passing pack...</p>';
                    try {
                        await pickCard({ draftId, selectedCardId });
                    } catch (error) {
                        console.error("Error picking card:", error);
                        alert("Error picking card: " + error.message);
                        // Reload state to get a fresh pack if something went wrong
                        db.collection('drafts').doc(draftId).collection('playerState').doc(user.uid).get().then(doc => {
                             if (doc.exists) renderCurrentPack(doc.data().currentPack);
                        });
                    }
                });
            });
        };

        const renderPickedCards = (cards) => {
            pickedCount.textContent = cards.length;
            if (cards.length === 0) {
                 pickedCardsContainer.innerHTML = '<p class="text-sm text-gray-500">Your drafted cards will appear here.</p>';
                 return;
            }
            pickedCardsContainer.innerHTML = cards.map(card => `
                <img src="${card.imageUrl}" alt="${card.name}" class="h-full rounded-md flex-shrink-0">
            `).join('');
             // Scroll to the end
            pickedCardsContainer.scrollLeft = pickedCardsContainer.scrollWidth;
        };
        
        listenToDraftRoom();
    }
});