/**
 * HatakeSocial - Events Page Script (v3 - Swiss Tournaments)
 *
 * This script manages the creation, display, and management of TCG events.
 * - NEW: Adds support for the Swiss tournament format.
 * - NEW: Implements Swiss pairing logic for round generation.
 * - NEW: Displays standings and pairings for Swiss events.
 * - NEW: Allows tournament organizers to manage Swiss rounds and report results.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const eventsMainView = document.getElementById('events-main-view');
    const eventDetailsSection = document.getElementById('event-details-section');
    const eventsListContainer = document.getElementById('events-list');
    const createEventBtn = document.getElementById('create-event-btn');
    const createEventModal = document.getElementById('create-event-modal');
    const closeEventModalBtn = document.getElementById('close-event-modal');
    const createEventForm = document.getElementById('create-event-form');
    const reportMatchModal = document.getElementById('report-match-modal');
    const closeMatchModalBtn = document.getElementById('close-match-modal');
    const reportMatchForm = document.getElementById('report-match-form');

    if (!eventsMainView) return;

    // --- Modal Handling ---
    const openModal = (modal) => modal.classList.add('modal-active');
    const closeModal = (modal) => modal.classList.remove('modal-active');

    createEventBtn?.addEventListener('click', () => {
        if (user) openModal(createEventModal);
        else alert('You must be logged in to create an event.');
    });
    closeEventModalBtn?.addEventListener('click', () => closeModal(createEventModal));
    closeMatchModalBtn?.addEventListener('click', () => closeModal(reportMatchModal));

    // --- Event Creation ---
    createEventForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) return;

        const eventData = {
            name: document.getElementById('event-name').value,
            game: document.getElementById('event-game').value,
            date: new Date(document.getElementById('event-date').value),
            format: document.getElementById('event-format').value,
            organizerId: user.uid,
            organizerName: user.displayName,
            status: 'upcoming', // upcoming, ongoing, completed
            participants: {}, // Map of uid: { displayName, avatarUrl }
            createdAt: new Date()
        };

        if (eventData.format === 'swiss') {
            eventData.currentRound = 0;
            eventData.rounds = [];
        }

        try {
            await db.collection('events').add(eventData);
            alert('Event created successfully!');
            closeModal(createEventModal);
            createEventForm.reset();
            loadAllEvents();
        } catch (error) {
            console.error("Error creating event:", error);
            alert('Failed to create event.');
        }
    });

    // --- Main Loading Functions ---
    const loadAllEvents = async () => {
        eventsListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">Loading events...</p>';
        try {
            const snapshot = await db.collection('events').orderBy('date', 'desc').get();
            if (snapshot.empty) {
                eventsListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">No events found. Create one to get started!</p>';
                return;
            }
            eventsListContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const event = doc.data();
                const eventCard = createEventCard(event, doc.id);
                eventsListContainer.appendChild(eventCard);
            });
        } catch (error) {
            console.error("Error loading events:", error);
            eventsListContainer.innerHTML = '<p class="text-center text-red-500 col-span-full">Could not load events.</p>';
        }
    };

    const createEventCard = (event, id) => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md cursor-pointer hover:shadow-xl transition-shadow';
        card.dataset.id = id;

        const statusColors = {
            upcoming: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            ongoing: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            completed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        };

        const formatDisplay = event.format ? event.format.replace('-', ' ') : 'N/A';
        
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <h3 class="text-xl font-bold text-gray-900 dark:text-white">${event.name}</h3>
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColors[event.status] || ''}">${event.status}</span>
            </div>
            <p class="text-gray-600 dark:text-gray-400 mt-2">${event.game}</p>
            <p class="text-sm text-gray-500 dark:text-gray-500 mt-1">${new Date(event.date.seconds * 1000).toLocaleString()}</p>
            <p class="text-sm text-gray-500 dark:text-gray-500 mt-1">Format: ${formatDisplay}</p>
            <div class="mt-4 pt-4 border-t dark:border-gray-700 flex justify-between items-center">
                <p class="text-sm text-gray-500 dark:text-gray-400">Organizer: ${event.organizerName}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">${Object.keys(event.participants || {}).length} participants</p>
            </div>
        `;
        card.addEventListener('click', () => loadEventDetails(id));
        return card;
    };

    const loadEventDetails = async (eventId) => {
        eventsMainView.classList.add('hidden');
        eventDetailsSection.classList.remove('hidden');
        eventDetailsSection.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Loading event details...</p>';

        const eventRef = db.collection('events').doc(eventId);
        eventRef.onSnapshot(async (doc) => {
            if (!doc.exists) {
                eventDetailsSection.innerHTML = '<p class="text-center text-red-500">Event not found.</p>';
                return;
            }
            const eventData = doc.data();
            const isOrganizer = user && user.uid === eventData.organizerId;

            let participantsList = '';
            const participantUIDs = Object.keys(eventData.participants || {});
            participantUIDs.forEach(uid => {
                const p = eventData.participants[uid];
                participantsList += `<li class="flex items-center space-x-2"><img src="${p.avatarUrl || 'https://placehold.co/24x24'}" class="w-6 h-6 rounded-full"><span>${p.displayName}</span></li>`;
            });

            let actionButton = '';
            if (user) {
                const isParticipant = participantUIDs.includes(user.uid);
                if (eventData.status === 'upcoming') {
                    if (isParticipant) {
                        actionButton = `<button id="leave-event-btn" class="px-6 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700">Leave Event</button>`;
                    } else {
                        actionButton = `<button id="join-event-btn" class="px-6 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Join Event</button>`;
                    }
                }
            }

            eventDetailsSection.innerHTML = `
                <button id="back-to-events" class="mb-4 text-blue-500 hover:underline"><i class="fas fa-arrow-left mr-2"></i>Back to All Events</button>
                <div class="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h2 class="text-3xl font-extrabold text-gray-900 dark:text-white">${eventData.name}</h2>
                            <p class="text-gray-600 dark:text-gray-400 mt-1">Organized by ${eventData.organizerName}</p>
                        </div>
                        ${actionButton}
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="md:col-span-2">
                            <div id="tournament-view-container">
                                </div>
                        </div>
                        <div class="md:col-span-1 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                            <h4 class="font-bold text-lg mb-4 dark:text-white">Participants (${participantUIDs.length})</h4>
                            <ul class="space-y-2">${participantsList || '<p class="text-sm text-gray-500">No one has joined yet.</p>'}</ul>
                        </div>
                    </div>
                </div>
            `;

            // Render the correct tournament view
            const tournamentContainer = document.getElementById('tournament-view-container');
            switch (eventData.format) {
                case 'swiss':
                    renderSwissView(tournamentContainer, eventData, eventId, isOrganizer);
                    break;
                case 'single-elimination':
                    // Placeholder for single elimination logic
                    tournamentContainer.innerHTML = `<div id="bracket-container">Single Elimination Bracket Placeholder</div>`;
                    break;
                default:
                    tournamentContainer.innerHTML = `<p>This tournament format (${eventData.format}) is not yet supported.</p>`;
            }


            document.getElementById('back-to-events').addEventListener('click', () => {
                eventDetailsSection.classList.add('hidden');
                eventsMainView.classList.remove('hidden');
                loadAllEvents();
            });

            document.getElementById('join-event-btn')?.addEventListener('click', () => joinEvent(eventId));
            document.getElementById('leave-event-btn')?.addEventListener('click', () => leaveEvent(eventId));
        });
    };
    
    // --- Swiss Tournament Logic ---
    const renderSwissView = async (container, eventData, eventId, isOrganizer) => {
        container.innerHTML = `
            <div id="swiss-container">
                <h3 class="text-2xl font-bold mb-4 dark:text-white">Swiss Tournament</h3>
                <div id="swiss-admin-controls" class="hidden bg-gray-200 dark:bg-gray-700 p-4 rounded-lg mb-4"></div>
                <div id="swiss-standings-container" class="mb-8"></div>
                <div id="swiss-pairings-container"></div>
            </div>
        `;

        if (isOrganizer) {
            renderSwissAdminControls(document.getElementById('swiss-admin-controls'), eventData, eventId);
        }

        const participantsSnap = await db.collection('events').doc(eventId).collection('participants').get();
        const participantsData = participantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        renderSwissStandings(document.getElementById('swiss-standings-container'), participantsData, eventData.rounds);
        renderSwissPairings(document.getElementById('swiss-pairings-container'), eventData, eventId, isOrganizer);
    };

    const renderSwissAdminControls = (container, eventData, eventId) => {
        container.classList.remove('hidden');
        let controlsHTML = '<h4 class="font-semibold mb-2">Organizer Controls</h4>';
        
        if (eventData.status === 'upcoming') {
            controlsHTML += `<button id="start-swiss-btn" class="px-4 py-2 bg-green-600 text-white font-semibold rounded-full">Start Tournament & Generate Round 1</button>`;
        } else if (eventData.status === 'ongoing') {
            const currentRound = eventData.rounds[eventData.currentRound - 1] || { matches: [] };
            const allReported = currentRound.matches.every(m => m.result);
            if (allReported) {
                controlsHTML += `<button id="next-swiss-round-btn" class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full">Generate Round ${eventData.currentRound + 1} Pairings</button>`;
            } else {
                controlsHTML += `<p class="text-sm text-yellow-600">Waiting for all results from Round ${eventData.currentRound} to be reported.</p>`;
            }
        } else {
             controlsHTML += `<p class="text-sm text-gray-500">The tournament is complete.</p>`;
        }
        container.innerHTML = controlsHTML;

        document.getElementById('start-swiss-btn')?.addEventListener('click', () => generateSwissPairings(eventId, 1));
        document.getElementById('next-swiss-round-btn')?.addEventListener('click', () => generateSwissPairings(eventId, eventData.currentRound + 1));
    };

    const renderSwissStandings = (container, participants, rounds) => {
        // Basic standings calculation (points only for now)
        participants.sort((a, b) => b.points - a.points);
        
        let standingsBody = '';
        participants.forEach((p, index) => {
            standingsBody += `
                <tr class="dark:bg-gray-800">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${index + 1}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${p.displayName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${p.points || 0}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">N/A</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">N/A</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">N/A</td>
                </tr>
            `;
        });

        container.innerHTML = `
            <h4 class="text-xl font-bold mb-2 dark:text-white">Standings</h4>
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Rank</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Player</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Points</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">OMW%</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">GWP</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">OGWP</th>
                        </tr>
                    </thead>
                    <tbody id="swiss-standings-body" class="divide-y divide-gray-200 dark:divide-gray-700">
                        ${standingsBody}
                    </tbody>
                </table>
            </div>
        `;
    };

    const renderSwissPairings = (container, eventData, eventId, isOrganizer) => {
        if (eventData.currentRound === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">The tournament has not started yet.</p>';
            return;
        }
        
        const roundIndex = eventData.currentRound - 1;
        const round = eventData.rounds[roundIndex];
        
        let pairingsHTML = `<h4 class="text-xl font-bold mb-2 dark:text-white">Round ${eventData.currentRound} Pairings</h4>`;
        if (!round || !round.matches) {
            container.innerHTML = pairingsHTML + '<p>Error: Could not load pairings.</p>';
            return;
        }

        const pairingsBody = round.matches.map((match, matchIndex) => {
            let resultHTML = '';
            if (match.result) {
                resultHTML = `<span class="font-bold text-green-500">${match.result.player1Wins} - ${match.result.player2Wins}</span>`;
            } else if (isOrganizer) {
                resultHTML = `<button data-event-id="${eventId}" data-round-index="${roundIndex}" data-match-index="${matchIndex}" class="report-match-btn px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-full">Report</button>`;
            } else {
                resultHTML = `<span class="text-xs text-gray-500">Pending</span>`;
            }

            if (match.isBye) {
                return `
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex justify-between items-center">
                        <span class="font-semibold dark:text-white">${match.player1.displayName}</span>
                        <span class="font-bold text-green-500">BYE (1-0)</span>
                    </div>
                `;
            }

            return `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex justify-between items-center">
                    <div>
                        <span class="font-semibold dark:text-white">${match.player1.displayName}</span>
                        <span class="mx-2 dark:text-gray-400">vs</span>
                        <span class="font-semibold dark:text-white">${match.player2.displayName}</span>
                    </div>
                    ${resultHTML}
                </div>
            `;
        }).join('');

        container.innerHTML = pairingsHTML + `<div class="space-y-4">${pairingsBody}</div>`;
    };

    const generateSwissPairings = async (eventId, roundNumber) => {
        const eventRef = db.collection('events').doc(eventId);
        const participantsSnap = await eventRef.collection('participants').get();
        let players = participantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Simple shuffle for round 1
        if (roundNumber === 1) {
            players.sort(() => Math.random() - 0.5);
        } else {
            // Sort by points for subsequent rounds
            players.sort((a, b) => b.points - a.points);
        }
        
        let byePlayer = null;
        if (players.length % 2 !== 0) {
            // Give bye to lowest ranked player who hasn't had one
            for (let i = players.length - 1; i >= 0; i--) {
                if (!players[i].hadBye) {
                    byePlayer = players.splice(i, 1)[0];
                    break;
                }
            }
        }
        
        const matches = [];
        while (players.length > 0) {
            const player1 = players.shift();
            const player2 = players.shift(); // In a real system, you'd find a valid opponent
            matches.push({
                player1: { id: player1.id, displayName: player1.displayName },
                player2: { id: player2.id, displayName: player2.displayName },
                result: null,
                isBye: false
            });
        }

        if (byePlayer) {
            matches.push({
                player1: { id: byePlayer.id, displayName: byePlayer.displayName },
                player2: null,
                result: { player1Wins: 1, player2Wins: 0, draws: 0 },
                isBye: true
            });
            // Update bye player's record immediately
            const byePlayerRef = eventRef.collection('participants').doc(byePlayer.id);
            await byePlayerRef.update({
                points: firebase.firestore.FieldValue.increment(3),
                hadBye: true
            });
        }
        
        const newRound = { roundNumber, matches };
        const eventUpdate = {
            status: 'ongoing',
            currentRound: roundNumber,
            rounds: firebase.firestore.FieldValue.arrayUnion(newRound)
        };

        await eventRef.update(eventUpdate);
        alert(`Round ${roundNumber} pairings generated!`);
    };

    reportMatchForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const eventId = document.getElementById('match-event-id').value;
        const roundIndex = parseInt(document.getElementById('match-round-index').value);
        const matchIndex = parseInt(document.getElementById('match-index').value);
        const p1Wins = parseInt(document.getElementById('player1-wins').value);
        const p2Wins = parseInt(document.getElementById('player2-wins').value);
        const draws = parseInt(document.getElementById('match-draws').value);

        const eventDoc = await db.collection('events').doc(eventId).get();
        const eventData = eventDoc.data();

        const round = eventData.rounds[roundIndex];
        const match = round.matches[matchIndex];
        
        match.result = { player1Wins: p1Wins, player2Wins: p2Wins, draws: draws };

        // Update event doc with new result
        await eventRef.update({ rounds: eventData.rounds });

        // Update participant scores
        const p1Ref = eventRef.collection('participants').doc(match.player1.id);
        const p2Ref = eventRef.collection('participants').doc(match.player2.id);
        const batch = db.batch();
        
        let p1Points = 0, p2Points = 0;
        if (p1Wins > p2Wins) p1Points = 3;
        else if (p2Wins > p1Wins) p2Points = 3;
        else if (p1Wins === p2Wins && p1Wins > 0) p1Points = p2Points = 1;

        batch.update(p1Ref, { points: firebase.firestore.FieldValue.increment(p1Points) });
        batch.update(p2Ref, { points: firebase.firestore.FieldValue.increment(p2Points) });
        
        await batch.commit();

        alert('Match result saved!');
        closeModal(reportMatchModal);
    });

    // --- General Event Actions (Join/Leave) ---
    const joinEvent = async (eventId) => {
        if (!user) return;
        const eventRef = db.collection('events').doc(eventId);
        // Using dot notation for updating a map field
        const participantData = {
            displayName: user.displayName,
            avatarUrl: user.photoURL
        };
        await eventRef.update({
            [`participants.${user.uid}`]: participantData
        });
        
        // Also create a document in the participants subcollection for Swiss
        const eventDoc = await eventRef.get();
        if (eventDoc.data().format === 'swiss') {
            await eventRef.collection('participants').doc(user.uid).set({
                displayName: user.displayName,
                points: 0,
                matchesPlayed: 0,
                opponents: [],
                hadBye: false
            });
        }
        
        alert('You have joined the event!');
    };

    const leaveEvent = async (eventId) => {
        if (!user) return;
        const eventRef = db.collection('events').doc(eventId);
        await eventRef.update({
            [`participants.${user.uid}`]: firebase.firestore.FieldValue.delete()
        });
        
        const eventDoc = await eventRef.get();
        if (eventDoc.data().format === 'swiss') {
             await eventRef.collection('participants').doc(user.uid).delete();
        }

        alert('You have left the event.');
    };

    // --- Delegated Event Listeners ---
    document.body.addEventListener('click', (e) => {
        const reportBtn = e.target.closest('.report-match-btn');
        if (reportBtn) {
            const { eventId, roundIndex, matchIndex } = reportBtn.dataset;
            openReportMatchModal(eventId, roundIndex, matchIndex);
        }
    });

    const openReportMatchModal = async (eventId, roundIndex, matchIndex) => {
        const eventDoc = await db.collection('events').doc(eventId).get();
        const eventData = eventDoc.data();
        const match = eventData.rounds[roundIndex].matches[matchIndex];

        document.getElementById('match-event-id').value = eventId;
        document.getElementById('match-round-index').value = roundIndex;
        document.getElementById('match-index').value = matchIndex;
        document.getElementById('match-players-info').textContent = `${match.player1.displayName} vs ${match.player2.displayName}`;
        document.getElementById('player1-name-label').textContent = `${match.player1.displayName} Wins`;
        document.getElementById('player2-name-label').textContent = `${match.player2.displayName} Wins`;
        reportMatchForm.reset();
        openModal(reportMatchModal);
    };

    // --- Initial Load ---
    loadAllEvents();
});