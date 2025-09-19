document.addEventListener('authReady', ({ detail: { user } }) => {
    if (!user) {
        document.body.innerHTML = '<h1>Please log in to play.</h1>';
        return;
    }

    const db = firebase.firestore();
    const functions = firebase.functions();

    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('gameId');

    if (!gameId) {
        document.body.innerHTML = '<h1>Error: No game ID specified.</h1>';
        return;
    }

    let opponentId = null;
    let unsubscribeGame = null;

    const gameRef = db.collection('games').doc(gameId);

    // --- DOM Elements ---
    const playerInfoEl = document.getElementById('player-info');
    const opponentInfoEl = document.getElementById('opponent-info');
    const playerBattlefieldEl = document.getElementById('player-battlefield');
    const opponentBattlefieldEl = document.getElementById('opponent-battlefield');
    const playerHandEl = document.getElementById('player-hand');
    const opponentHandCountEl = document.getElementById('opponent-hand-count');
    const gamePhaseEl = document.getElementById('game-phase');
    const nextPhaseBtn = document.getElementById('next-phase-btn');

    // --- Game State Rendering ---
    function renderGameState(gameData) {
        if (!gameData) return;

        const playerKey = gameData.players.player1.uid === user.uid ? 'player1' : 'player2';
        const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
        opponentId = gameData.players[opponentKey].uid;

        // Render player info
        playerInfoEl.innerHTML = `<span>${gameData.players[playerKey].displayName} | Life: ${gameData.players[playerKey].life}</span>`;
        opponentInfoEl.innerHTML = `<span>${gameData.players[opponentKey].displayName} | Life: ${gameData.players[opponentKey].life}</span>`;

        // Render hands
        opponentHandCountEl.textContent = gameData.hand[opponentKey].length;
        playerHandEl.innerHTML = gameData.hand[playerKey].map(card => `
            <div class="card-in-play h-full" data-card-id="${card.id}">
                <img src="${card.imageUrl}" class="h-full rounded-md">
            </div>
        `).join('');
        
        // Render battlefields
        playerBattlefieldEl.innerHTML = gameData.battlefield[playerKey].map(card => `<div class="card-in-play h-24 ${card.tapped ? 'tapped' : ''}"><img src="${card.imageUrl}" class="h-full rounded-md"></div>`).join('');
        opponentBattlefieldEl.innerHTML = gameData.battlefield[opponentKey].map(card => `<div class="card-in-play h-24 ${card.tapped ? 'tapped' : ''}"><img src="${card.imageUrl}" class="h-full rounded-md"></div>`).join('');

        // Update phase
        gamePhaseEl.textContent = gameData.phase;
        nextPhaseBtn.disabled = gameData.turn !== user.uid;
    }

    // --- Firestore Listener ---
    function listenToGame() {
        unsubscribeGame = gameRef.onSnapshot(doc => {
            if (doc.exists) {
                renderGameState(doc.data());
            } else {
                alert("Game not found or has been deleted.");
                window.location.href = '/events.html';
            }
        });
    }

    listenToGame();
});
