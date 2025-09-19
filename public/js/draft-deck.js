document.addEventListener('authReady', ({ detail: { user } }) => {
    if (!user) {
        document.body.innerHTML = '<h1>Please log in to build your deck.</h1>';
        return;
    }

    const db = firebase.firestore();
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('draftId');

    if (!draftId) {
        document.body.innerHTML = '<h1>Error: No Draft ID specified.</h1>';
        return;
    }

    const playerStateRef = db.collection('drafts').doc(draftId).collection('playerState').doc(user.uid);

    // DOM Elements
    const draftPoolList = document.getElementById('draft-pool-list');
    const mainDeckList = document.getElementById('main-deck-list');
    const draftPoolCount = document.getElementById('draft-pool-count');
    const mainDeckCount = document.getElementById('main-deck-count');
    const saveDeckBtn = document.getElementById('save-deck-btn');

    let draftPool = [];
    let mainDeck = [];

    const renderCards = () => {
        draftPoolList.innerHTML = draftPool.map(card => createCardElement(card, 'pool')).join('');
        mainDeckList.innerHTML = mainDeck.map(card => createCardElement(card, 'deck')).join('');

        draftPoolCount.textContent = draftPool.length;
        mainDeckCount.textContent = mainDeck.length;

        mainDeckCount.classList.toggle('text-green-400', mainDeck.length >= 40);
        mainDeckCount.classList.toggle('text-red-400', mainDeck.length < 40);
    };

    const createCardElement = (card, from) => `
        <div class="card-item cursor-pointer" data-card-id="${card.id}" data-from="${from}">
            <img src="${card.imageUrl}" alt="${card.name}" class="rounded-md w-full">
        </div>
    `;

    document.addEventListener('click', (e) => {
        const cardEl = e.target.closest('.card-item');
        if (!cardEl) return;

        const cardId = cardEl.dataset.cardId;
        const from = cardEl.dataset.from;

        if (from === 'pool') {
            const cardIndex = draftPool.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                mainDeck.push(draftPool[cardIndex]);
                draftPool.splice(cardIndex, 1);
            }
        } else if (from === 'deck') {
            const cardIndex = mainDeck.findIndex(c => c.id === cardId);
            if (cardIndex > -1) {
                draftPool.push(mainDeck[cardIndex]);
                mainDeck.splice(cardIndex, 1);
            }
        }
        renderCards();
    });

    saveDeckBtn.addEventListener('click', async () => {
        if (mainDeck.length < 40) {
            alert('Your main deck must contain at least 40 cards.');
            return;
        }
        try {
            saveDeckBtn.disabled = true;
            saveDeckBtn.textContent = "Saving...";
            await playerStateRef.update({
                mainDeck: mainDeck,
                sideboard: draftPool // The rest of the pool becomes the sideboard
            });
            alert('Deck saved successfully! You can now start your matches from the Events page.');
            window.location.href = `/events.html`; // Redirect back to events to see pairings
        } catch (error) {
            console.error("Error saving deck:", error);
            alert("Could not save deck: " + error.message);
        } finally {
            saveDeckBtn.disabled = false;
            saveDeckBtn.textContent = "Save and Finish";
        }
    });

    // Initial Load
    playerStateRef.get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            draftPool = data.pickedCards || [];
            mainDeck = data.mainDeck || [];
            renderCards();
        } else {
            alert("Could not find your draft data.");
        }
    }).catch(err => {
        console.error("Error fetching draft pool:", err);
        alert("Error fetching your drafted cards.");
    });
});

