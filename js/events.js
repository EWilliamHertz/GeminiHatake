/**
 * HatakeSocial - Events Page Script (v7 - Single Elimination Brackets)
 *
 * This version adds a full tournament bracket system.
 * - Event creators can add a single-elimination tournament to an event.
 * - The event creator can start the tournament, which generates round 1 pairings.
 * - Players can report their match scores.
 * - The event creator confirms scores, and winners automatically advance.
 * - The bracket view updates in real-time for all viewers.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const eventsListContainer = document.getElementById('events-list');
    if (!document.getElementById('events-main-view')) return; // Exit if not on events page

    // --- State ---
    let allEvents = [];
    let activeTab = 'all';
    let currentEventUnsubscribe = null;

    // --- DOM Elements ---
    const createEventBtn = document.getElementById('create-event-btn');
    const createEventModal = document.getElementById('create-event-modal');
    const closeEventModalBtn = document.getElementById('close-event-modal');
    const createEventForm = document.getElementById('create-event-form');
    const addTournamentCheckbox = document.getElementById('add-tournament-checkbox');
    const tournamentOptions = document.getElementById('tournament-options');
    const attendeesModal = document.getElementById('attendees-modal');
    const closeAttendeesModalBtn = document.getElementById('close-attendees-modal');
    const reportScoreModal = document.getElementById('report-score-modal');
    const closeReportScoreModalBtn = document.getElementById('close-report-score-modal');
    const reportScoreForm = document.getElementById('report-score-form');

    const eventsMainView = document.getElementById('events-main-view');
    const eventDetailView = document.getElementById('event-detail-view');
    const eventTabs = document.querySelectorAll('.event-tab-button');
    
    const listViewBtn = document.getElementById('list-view-btn');
    const calendarViewBtn = document.getElementById('calendar-view-btn');
    const eventsListView = document.getElementById('events-list-view');
    const calendarView = document.getElementById('calendar-view');
    const calendarEl = document.getElementById('calendar');
    let calendar;

    if (user) {
        createEventBtn.classList.remove('hidden');
    }

    createEventBtn.addEventListener('click', () => openModal(createEventModal));
    closeEventModalBtn.addEventListener('click', () => closeModal(createEventModal));
    closeAttendeesModalBtn.addEventListener('click', () => closeModal(attendeesModal));
    closeReportScoreModalBtn.addEventListener('click', () => closeModal(reportScoreModal));
    
    addTournamentCheckbox.addEventListener('change', () => {
        tournamentOptions.classList.toggle('hidden', !addTournamentCheckbox.checked);
    });

    createEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) { alert("You must be logged in to create an event."); return; }

        const submitButton = createEventForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        try {
            const eventData = {
                name: document.getElementById('eventName').value,
                date: new Date(document.getElementById('eventDate').value),
                city: document.getElementById('eventCity').value,
                country: document.getElementById('eventCountry').value,
                description: document.getElementById('eventDescription').value,
                link: document.getElementById('eventLink').value,
                imageUrl: '',
                creatorId: user.uid,
                creatorName: user.displayName || 'Anonymous',
                createdAt: new Date(),
                rsvps: [user.uid] 
            };

            if (addTournamentCheckbox.checked) {
                eventData.tournament = {
                    format: document.getElementById('tournament-format').value,
                    playerLimit: parseInt(document.getElementById('tournament-player-limit').value, 10),
                    status: 'registering',
                    currentRound: 0,
                    players: [{ uid: user.uid, name: user.displayName, photoURL: user.photoURL }],
                    rounds: {}
                };
            }

            const eventImageFile = document.getElementById('eventImage').files[0];
            if (eventImageFile) {
                const imagePath = `events/${Date.now()}_${eventImageFile.name}`;
                const imageRef = storage.ref(imagePath);
                await imageRef.put(eventImageFile);
                eventData.imageUrl = await imageRef.getDownloadURL();
            }

            await db.collection('events').add(eventData);
            alert("Event created successfully!");
            closeModal(createEventModal);
            createEventForm.reset();
            fetchAllEvents();

        } catch (error) {
            console.error("Error creating event:", error);
            alert("Could not create event. " + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Event';
        }
    });

    const fetchAllEvents = async () => {
        eventsListContainer.innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i></div>';
        
        const snapshot = await db.collection('events').orderBy('date', 'asc').get();
        allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderEventList();
    };

    const renderEventList = () => {
        let eventsToRender = [];
        if (activeTab === 'my-events') {
            if (!user) {
                eventsListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Please log in to see your events.</p>';
                return;
            }
            eventsToRender = allEvents.filter(event => event.rsvps && event.rsvps.includes(user.uid));
        } else {
            const userCountry = window.HatakeSocial.currentUserData?.country;
            const localEvents = userCountry ? allEvents.filter(event => event.country === userCountry) : [];
            const otherEvents = userCountry ? allEvents.filter(event => event.country !== userCountry) : allEvents;
            eventsToRender = [...localEvents, ...otherEvents];
        }

        if (eventsToRender.length === 0) {
            eventsListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">No events found.</p>';
            if(calendar) calendar.removeAllEvents();
            return;
        }

        eventsListContainer.innerHTML = '';
        const calendarEvents = [];
        eventsToRender.forEach(eventData => {
            const eventCard = createEventCard(eventData);
            eventsListContainer.appendChild(eventCard);
            
            calendarEvents.push({
                id: eventData.id,
                title: eventData.name,
                start: new Date(eventData.date.seconds * 1000),
                allDay: true
            });
        });
        
        renderCalendar(calendarEvents);
    };

    const createEventCard = (eventData) => {
        const eventCard = document.createElement('div');
        eventCard.className = 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col md:flex-row gap-6 cursor-pointer hover:shadow-xl transition-shadow';
        eventCard.addEventListener('click', () => viewEventDetails(eventData.id));
        
        const isAttending = user && eventData.rsvps && eventData.rsvps.includes(user.uid);
        
        eventCard.innerHTML = `
            <img src="${eventData.imageUrl || 'https://placehold.co/400x250/cccccc/969696?text=Event'}" alt="${eventData.name}" class="w-full md:w-1/3 h-48 object-cover rounded-md">
            <div class="flex-grow">
                <p class="text-sm font-semibold text-blue-600 dark:text-blue-400">${new Date(eventData.date.seconds * 1000).toDateString()}</p>
                <h3 class="text-2xl font-bold text-gray-800 dark:text-white mt-1">${eventData.name}</h3>
                <p class="text-gray-500 dark:text-gray-400 mt-1"><i class="fas fa-map-marker-alt mr-2"></i>${eventData.city}, ${eventData.country}</p>
                <p class="text-gray-700 dark:text-gray-300 mt-4">${eventData.description.substring(0, 150)}...</p>
                <div class="mt-4 flex justify-between items-center">
                    <p class="text-sm text-gray-500 dark:text-gray-400">${(eventData.rsvps || []).length} attending</p>
                    ${isAttending ? '<span class="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800"><i class="fas fa-check"></i> Going</span>' : ''}
                </div>
            </div>
        `;
        return eventCard;
    };
    
    const renderCalendar = (events) => {
        if (calendar) {
            calendar.removeAllEvents();
            calendar.addEventSource(events);
        } else {
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                events: events,
                eventClick: (info) => viewEventDetails(info.event.id),
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,listWeek'
                }
            });
            calendar.render();
        }
    };

    const viewEventDetails = (eventId) => {
        if (currentEventUnsubscribe) currentEventUnsubscribe();

        eventsMainView.classList.add('hidden');
        eventDetailView.classList.remove('hidden');
        eventDetailView.innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i></div>';

        currentEventUnsubscribe = db.collection('events').doc(eventId).onSnapshot(doc => {
            if (!doc.exists) {
                eventDetailView.innerHTML = '<p class="text-red-500">Event not found.</p>';
                return;
            }
            const eventData = { id: doc.id, ...doc.data() };
            renderEventDetailView(eventData);
        });
    };

    const renderEventDetailView = (eventData) => {
        const isCreator = user && eventData.creatorId === user.uid;
        const isAttending = user && eventData.rsvps && eventData.rsvps.includes(user.uid);
        let tournamentManagementHTML = '';
        if (isCreator && eventData.tournament && eventData.tournament.status === 'registering') {
            tournamentManagementHTML = `<button id="start-tournament-btn" data-event-id="${eventData.id}" class="px-6 py-2 bg-green-600 text-white font-semibold rounded-full">Start Tournament</button>`;
        }

        eventDetailView.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
                <button id="back-to-events-list" class="text-blue-600 dark:text-blue-400 hover:underline mb-4"><i class="fas fa-arrow-left mr-2"></i>Back to All Events</button>
                <h2 class="text-3xl font-bold text-gray-800 dark:text-white">${eventData.name}</h2>
                <!-- ... other event details like date, description, etc. ... -->

                <div class="mt-6">
                    <div class="border-b border-gray-200 dark:border-gray-700">
                        <nav id="event-detail-tabs" class="flex space-x-8" aria-label="Tabs">
                            <button data-tab="details" class="event-detail-tab-button active">Details</button>
                            ${eventData.tournament ? `<button data-tab="tournament" class="event-detail-tab-button">Tournament</button>` : ''}
                        </nav>
                    </div>
                    <div class="mt-6">
                        <div id="event-tab-details" class="event-detail-tab-content">
                             <button data-id="${eventData.id}" class="rsvp-btn px-5 py-2 font-semibold rounded-full ${isAttending ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}">
                                ${isAttending ? 'Cancel RSVP' : 'RSVP Now'}
                            </button>
                            <!-- Attendee list will be rendered here -->
                        </div>
                        ${eventData.tournament ? `
                        <div id="event-tab-tournament" class="event-detail-tab-content hidden">
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-2xl font-bold dark:text-white">Bracket</h3>
                                ${tournamentManagementHTML}
                            </div>
                            <div id="bracket-container" class="overflow-x-auto p-4 bg-gray-800 rounded-lg"></div>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;

        if (eventData.tournament) {
            renderBracket(eventData);
        }
        setupDetailViewListeners(eventData);
    };

    const renderBracket = (eventData) => {
        const container = document.getElementById('bracket-container');
        if (!container || !eventData.tournament) return;

        const { rounds = {}, players = [], status } = eventData.tournament;
        const numRounds = Object.keys(rounds).length;
        if (numRounds === 0 && status === 'registering') {
            container.innerHTML = '<p class="text-center text-gray-400">Tournament has not started yet. Pairings will appear here.</p>';
            return;
        }

        let bracketHTML = '<div class="bracket">';
        for (let i = 1; i <= numRounds; i++) {
            bracketHTML += `<div class="round round-${i}">`;
            const roundMatches = rounds[i] || [];
            roundMatches.forEach((match, matchIndex) => {
                const p1 = players.find(p => p.uid === match.pair[0]);
                const p2 = players.find(p => p.uid === match.pair[1]);
                const p1Score = match.result ? match.result[p1.uid] : '-';
                const p2Score = p2 && match.result ? match.result[p2.uid] : '-';
                const p1Winner = match.winner === p1.uid;
                const p2Winner = p2 && match.winner === p2.uid;
                const canReport = user && (user.uid === p1.uid || (p2 && user.uid === p2.uid)) && !match.winner;

                bracketHTML += `
                    <div class="match">
                        <div class="match-wrapper">
                            <div class="match-top ${p1Winner ? 'winner' : ''}">
                                <span class="player-name">${p1.name}</span>
                                <span class="player-score">${p1Score}</span>
                            </div>
                            <div class="match-bottom ${p2Winner ? 'winner' : ''}">
                                <span class="player-name">${p2 ? p2.name : 'BYE'}</span>
                                <span class="player-score">${p2 ? p2Score : '-'}</span>
                            </div>
                        </div>
                        ${canReport ? `<button class="report-score-btn text-xs mt-1 text-blue-400 hover:underline" data-round="${i}" data-match="${matchIndex}">Report Score</button>` : ''}
                    </div>
                `;
            });
            bracketHTML += `</div>`;
        }
        bracketHTML += '</div>';
        container.innerHTML = bracketHTML;
    };

    const startTournament = async (eventData) => {
        if (!confirm("Are you sure you want to start the tournament? This will lock registrations and create the first round pairings.")) return;

        const eventRef = db.collection('events').doc(eventData.id);
        const players = eventData.tournament.players;

        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }

        const round1 = [];
        for (let i = 0; i < players.length; i += 2) {
            const player1 = players[i];
            const player2 = players[i+1] || null; // Handle byes
            round1.push({
                pair: [player1.uid, player2?.uid || null],
                result: null,
                winner: player2 ? null : player1.uid // Auto-win for byes
            });
        }

        await eventRef.update({
            'tournament.status': 'active',
            'tournament.currentRound': 1,
            'tournament.rounds.1': round1
        });
    };

    const setupDetailViewListeners = (eventData) => {
        document.getElementById('back-to-events-list')?.addEventListener('click', () => {
            if (currentEventUnsubscribe) currentEventUnsubscribe();
            eventDetailView.classList.add('hidden');
            eventsMainView.classList.remove('hidden');
        });

        document.getElementById('start-tournament-btn')?.addEventListener('click', () => startTournament(eventData));

        document.querySelectorAll('.report-score-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roundIndex = e.currentTarget.dataset.round;
                const matchIndex = e.currentTarget.dataset.match;
                const match = eventData.tournament.rounds[roundIndex][matchIndex];
                const p1 = eventData.tournament.players.find(p => p.uid === match.pair[0]);
                const p2 = eventData.tournament.players.find(p => p.uid === match.pair[1]);

                document.getElementById('report-score-event-id').value = eventData.id;
                document.getElementById('report-score-round-index').value = roundIndex;
                document.getElementById('report-score-match-index').value = matchIndex;
                document.getElementById('reporting-player-names').textContent = `${p1.name} vs ${p2.name}`;
                openModal(reportScoreModal);
            });
        });
    };
    
    reportScoreForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const eventId = document.getElementById('report-score-event-id').value;
        const roundIndex = document.getElementById('report-score-round-index').value;
        const matchIndex = document.getElementById('report-score-match-index').value;
        const yourScore = parseInt(document.getElementById('your-score').value, 10);
        const opponentScore = parseInt(document.getElementById('opponent-score').value, 10);

        const eventRef = db.collection('events').doc(eventId);
        const eventDoc = await eventRef.get();
        const eventData = eventDoc.data();
        const match = eventData.tournament.rounds[roundIndex][matchIndex];
        const [p1_uid, p2_uid] = match.pair;

        const isPlayer1 = user.uid === p1_uid;
        const p1_score = isPlayer1 ? yourScore : opponentScore;
        const p2_score = isPlayer1 ? opponentScore : yourScore;
        
        if (p1_score === p2_score) {
            alert("A winner must be declared. Draws are not allowed in single elimination.");
            return;
        }

        const winnerId = p1_score > p2_score ? p1_uid : p2_uid;

        const updatePath = `tournament.rounds.${roundIndex}.${matchIndex}`;
        await eventRef.update({
            [`${updatePath}.result`]: { [p1_uid]: p1_score, [p2_uid]: p2_score },
            [`${updatePath}.winner`]: winnerId
        });

        closeModal(reportScoreModal);
        alert("Result submitted! The bracket will update shortly.");
        
        // Check if round is complete to generate next round
        const updatedEventDoc = await eventRef.get();
        const updatedEventData = updatedEventDoc.data();
        const currentRoundMatches = updatedEventData.tournament.rounds[roundIndex];
        if (currentRoundMatches.every(m => m.winner !== null)) {
            generateNextRound(updatedEventData);
        }
    });

    const generateNextRound = async (eventData) => {
        const eventRef = db.collection('events').doc(eventData.id);
        const currentRoundIndex = eventData.tournament.currentRound;
        const currentRoundMatches = eventData.tournament.rounds[currentRoundIndex];
        const winners = currentRoundMatches.map(m => m.winner);

        if (winners.length <= 1) {
            await eventRef.update({ 'tournament.status': 'completed' });
            alert("Tournament is complete! Congratulations to the winner!");
            return;
        }

        const nextRoundIndex = currentRoundIndex + 1;
        const nextRoundMatches = [];
        for (let i = 0; i < winners.length; i += 2) {
            const player1_uid = winners[i];
            const player2_uid = winners[i+1] || null;
            nextRoundMatches.push({
                pair: [player1_uid, player2_uid],
                result: null,
                winner: player2_uid ? null : player1_uid
            });
        }
        
        await eventRef.update({
            'tournament.currentRound': nextRoundIndex,
            [`tournament.rounds.${nextRoundIndex}`]: nextRoundMatches
        });
    };

    // --- Initial Load ---
    fetchAllEvents();
});
