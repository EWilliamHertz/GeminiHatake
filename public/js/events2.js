/**
 * HatakeSocial - Integrated Events & Tournaments Script
 *
 * This script now manages both "Local Events" and user-created "Tournaments".
 * It fetches all events from Firestore and filters them into the correct tabs.
 * It includes logic to link completed drafts to a deck builder and tournament
 * pairings to a live game room.
 */
document.addEventListener('authReady', (e) => {
    const { user } = e.detail;
    let currentUserIsAdmin = false;
    if (user) {
        user.getIdTokenResult().then(idTokenResult => {
            currentUserIsAdmin = idTokenResult.claims.admin === true;
        });
    }

    const db = firebase.firestore();
    const functions = firebase.functions();
    const createGameFromMatch = functions.httpsCallable('createGameFromMatch');

    const eventsMainView = document.getElementById('events-main-view');
    const eventDetailsSection = document.getElementById('event-details-section');
    const eventsListContainer = document.getElementById('events-list');
    const tournamentsListContainer = document.getElementById('tournaments-list');
    const createEventBtn = document.getElementById('create-event-btn');
    const createEventModal = document.getElementById('create-event-modal');
    const closeEventModalBtn = document.getElementById('close-event-modal');
    const createEventForm = document.getElementById('create-event-form');
    const reportMatchModal = document.getElementById('report-match-modal');
    const closeMatchModalBtn = document.getElementById('close-match-modal');
    const reportMatchForm = document.getElementById('report-match-form');

    let currentEditEventId = null;

    if (!eventsMainView) return;

    // --- Modal Handling & Form Logic ---
    const openModal = (modal) => modal.classList.add('modal-active');
    const closeModal = (modal) => {
        modal.classList.remove('modal-active');
        if (modal === createEventModal) {
            currentEditEventId = null;
            createEventForm.reset();
            document.querySelector('#create-event-modal h2').textContent = 'Create New Event';
            document.querySelector('#create-event-form button[type="submit"]').textContent = 'Create Event';
            document.getElementById('tournament-format-container').classList.add('hidden');
        }
    };

    createEventBtn?.addEventListener('click', () => {
        if (user) {
            currentEditEventId = null;
            openModal(createEventModal);
        } else {
            alert('You must be logged in to create an event.');
        }
    });
    closeEventModalBtn?.addEventListener('click', () => closeModal(createEventModal));
    closeMatchModalBtn?.addEventListener('click', () => closeModal(reportMatchModal));

    const eventTypeSelector = document.getElementById('event-type');
    const tournamentFormatContainer = document.getElementById('tournament-format-container');
    eventTypeSelector?.addEventListener('change', () => {
        tournamentFormatContainer.classList.toggle('hidden', eventTypeSelector.value !== 'tournament');
    });

    createEventForm?.addEventListener('submit', async (formEvent) => {
        formEvent.preventDefault();
        if (!user) return;

        const eventType = document.getElementById('event-type').value;
        const eventData = {
            name: document.getElementById('event-name').value,
            eventType: eventType,
            game: document.getElementById('event-game').value,
            date: new Date(document.getElementById('event-date').value),
            endDate: document.getElementById('event-end-date').value ? new Date(document.getElementById('event-end-date').value) : null,
            city: document.getElementById('event-city').value,
            country: document.getElementById('event-country').value,
            description: document.getElementById('event-description').value,
            imageUrl: document.getElementById('event-image-url').value,
            link: document.getElementById('event-link').value,
            organizerId: user.uid,
            organizerName: user.displayName,
            status: 'upcoming',
        };

        if (eventType === 'tournament') {
            eventData.format = document.getElementById('event-format').value;
        }

        try {
            if (currentEditEventId) {
                await db.collection('events').doc(currentEditEventId).update(eventData);
                alert('Event updated successfully!');
            } else {
                eventData.participants = {};
                eventData.createdAt = new Date();
                if (eventType === 'tournament' && eventData.format === 'swiss') {
                    eventData.currentRound = 0;
                    eventData.rounds = [];
                }
                await db.collection('events').add(eventData);
                alert('Event created successfully!');
            }
            closeModal(createEventModal);
            loadAllEvents();
        } catch (error) {
            console.error("Error saving event:", error);
            alert('Failed to save event.');
        }
    });

        eventsMainView.classList.remove('hidden');
        eventDetailsSection.classList.add('hidden');
        
        const loadingHTML = '<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">Loading...</p>';
        eventsListContainer.innerHTML = loadingHTML;
        tournamentsListContainer.innerHTML = loadingHTML;

        try {
            // Create two separate queries
            const generalEventsQuery = db.collection('events').where('eventType', '==', 'general').orderBy('date', 'desc').get();
            const tournamentEventsQuery = db.collection('events').where('eventType', '==', 'tournament').orderBy('date', 'desc').get();

            const [generalSnapshot, tournamentSnapshot] = await Promise.all([generalEventsQuery, tournamentEventsQuery]);

            // Populate General Events Tab
            eventsListContainer.innerHTML = '';
            if (generalSnapshot.empty) {
                eventsListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">No local events found. Create one to get started!</p>';
            } else {
                generalSnapshot.forEach(doc => {
                    const event = doc.data();
                    const eventCard = createEventCard(event, doc.id);
                    eventsListContainer.appendChild(eventCard);
                });
            }

            // Populate Tournaments Tab
            tournamentsListContainer.innerHTML = '';
             if (tournamentSnapshot.empty) {
                tournamentsListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">No tournaments found. Create one to get started!</p>';
            } else {
                tournamentSnapshot.forEach(doc => {
                    const event = doc.data();
                    const eventCard = createEventCard(event, doc.id);
                    tournamentsListContainer.appendChild(eventCard);
                });
            }

        } catch (error) {
            console.error("Error loading events:", error);
            const errorHTML = '<p class="text-center text-red-500 col-span-full">Could not load events.</p>';
            eventsListContainer.innerHTML = errorHTML;
            tournamentsListContainer.innerHTML = errorHTML;
        }
    };


    // --- Date Formatting Helpers (No changes needed) ---
    const formatSingleTimestamp = (timestamp) => {
        if (!timestamp || !timestamp.seconds) return '';
        const date = new Date(timestamp.seconds * 1000);
        const userDateFormat = localStorage.getItem('userDateFormat') || 'dmy';

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        if (userDateFormat === 'mdy') {
            return `${month}/${day}/${year}`;
        }
        return `${day}/${month}/${year}`;
    };

    const formatEventDate = (start, end) => {
        if (!start || !start.seconds) return 'Date not available';
        const startDate = new Date(start.seconds * 1000);
        const formattedStartDate = formatSingleTimestamp(start);

        if (end && end.seconds) {
            const endDate = new Date(end.seconds * 1000);
            const formattedEndDate = formatSingleTimestamp(end);
            if (startDate.toDateString() === endDate.toDateString()) {
                return `${formattedStartDate} at ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }
            return `${formattedStartDate} - ${formattedEndDate}`;
        }

        return `${formattedStartDate} at ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };

    const formatTimestampForInput = (timestamp) => {
        if (!timestamp || !timestamp.seconds) return '';
        const date = new Date(timestamp.seconds * 1000);
        const timezoneOffset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - timezoneOffset);
        return localDate.toISOString().slice(0, 16);
    };


   // --- UI Rendering (No changes needed, it's generic) ---
    const createEventCard = (event, id) => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md cursor-pointer hover:shadow-xl transition-shadow overflow-hidden flex flex-col';
        card.dataset.id = id;

        const statusColors = {
            upcoming: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            ongoing: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            completed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        };
        const eventDate = formatEventDate(event.date, event.endDate);
        const descriptionSnippet = event.description ? (event.description.length > 100 ? event.description.substring(0, 97) + '...' : event.description) : 'No description provided.';
        const imageUrl = event.imageUrl || 'https://placehold.co/600x400?text=Event';

        card.innerHTML = `
            <img src="${imageUrl}" alt="${event.name}" class="w-full h-48 object-cover">
            <div class="p-6 flex-grow flex flex-col">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white">${event.name}</h3>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColors[event.status] || ''} whitespace-nowrap">${event.status}</span>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-2"><i class="fas fa-map-marker-alt mr-2"></i>${event.city || 'N/A'}, ${event.country || 'N/A'}</p>
                <p class="text-gray-600 dark:text-gray-300 text-sm mb-4 flex-grow">${descriptionSnippet}</p>
                <div class="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <p><strong><i class="fas fa-calendar-alt mr-2"></i></strong>${eventDate}</p>
                    ${event.game ? `<p><strong><i class="fas fa-gamepad mr-2"></i></strong>${event.game}</p>` : ''}
                </div>
                <div class="mt-auto pt-4 border-t dark:border-gray-700 flex justify-between items-center text-sm">
                    <p class="text-gray-500 dark:text-gray-400" title="Organizer"><i class="fas fa-user-tie mr-1"></i> ${event.organizerName || event.creatorName || 'N/A'}</p>
                    <p class="text-gray-500 dark:text-gray-400" title="Participants"><i class="fas fa-users mr-1"></i> ${Object.keys(event.participants || {}).length} participants</p>
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            loadEventDetails(id);
        });
        return card;
    };

 
    const loadEventDetails = (eventId) => {
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

            if (eventData.eventType === 'tournament') {
                renderTournamentDetails(eventData, eventId, isOrganizer);
            } else {
                renderGeneralEventDetails(eventData, eventId, isOrganizer);
            }
        });
    };
    
    const renderGeneralEventDetails = (eventData, eventId, isOrganizer) => {
        const participantUIDs = Object.keys(eventData.participants || {});
        let participantsList = '';
        participantUIDs.forEach(uid => {
            const p = eventData.participants[uid];
            participantsList += `<li class="flex items-center space-x-2"><img src="${p.avatarUrl || 'https://placehold.co/24x24'}" class="w-6 h-6 rounded-full"><span>${p.displayName}</span></li>`;
        });

        let actionButton = '';
        if (user && eventData.status === 'upcoming') {
            const isParticipant = participantUIDs.includes(user.uid);
            actionButton = isParticipant 
                ? `<button id="leave-event-btn" class="px-6 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700">Leave Event</button>`
                : `<button id="join-event-btn" class="px-6 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Join Event</button>`;
        }
        
        const eventDate = formatEventDate(eventData.date, eventData.endDate);

        eventDetailsSection.innerHTML = `
            <button id="back-to-events" class="mb-4 text-blue-500 hover:underline"><i class="fas fa-arrow-left mr-2"></i>Back to All Events</button>
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                <img src="${eventData.imageUrl || 'https://placehold.co/1200x400?text=Event'}" alt="${eventData.name}" class="w-full h-64 object-cover">
                <div class="p-8">
                    <div class="flex flex-col md:flex-row justify-between items-start mb-4">
                        <div class="mb-4 md:mb-0">
                            <h2 class="text-3xl font-extrabold text-gray-900 dark:text-white">${eventData.name}</h2>
                            <p class="text-gray-600 dark:text-gray-400 mt-1">Organized by ${eventData.organizerName || eventData.creatorName || 'N/A'}</p>
                        </div>
                        ${actionButton}
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div class="md:col-span-2">
                            <div id="admin-actions-container" class="mb-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"></div>
                            <h3 class="text-xl font-bold border-b pb-2 mb-4 dark:text-white dark:border-gray-600">Event Details</h3>
                            <div class="space-y-4 text-gray-700 dark:text-gray-300">
                                <p><i class="fas fa-calendar-alt fa-fw mr-3 text-blue-500"></i><strong>Date:</strong> ${eventDate}</p>
                                <p><i class="fas fa-map-marker-alt fa-fw mr-3 text-blue-500"></i><strong>Location:</strong> ${eventData.city}, ${eventData.country}</p>
                                ${eventData.game ? `<p><i class="fas fa-gamepad fa-fw mr-3 text-blue-500"></i><strong>Game:</strong> ${eventData.game}</p>` : ''}
                                <h4 class="font-bold pt-4">Description</h4>
                                <p class="whitespace-pre-wrap">${eventData.description || 'No description provided.'}</p>
                                ${eventData.link ? `<a href="${eventData.link}" target="_blank" rel="noopener noreferrer" class="inline-block mt-4 px-5 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Visit Event Website <i class="fas fa-external-link-alt ml-2"></i></a>` : ''}
                            </div>
                        </div>
                        <div class="md:col-span-1 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                            <h4 class="font-bold text-lg mb-4 dark:text-white">Participants (${participantUIDs.length})</h4>
                            <ul class="space-y-2 max-h-96 overflow-y-auto">${participantsList || '<p class="text-sm text-gray-500">No one has joined yet.</p>'}</ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
        addCommonEventListeners(eventId, eventData, isOrganizer);
    };


    const renderTournamentDetails = (eventData, eventId, isOrganizer) => {
        const isDraftEvent = eventData.draftId && eventData.status === 'completed';
        const participantUIDs = Object.keys(eventData.participants || {});
        let participantsList = participantUIDs.map(uid => {
            const p = eventData.participants[uid];
            return `<li class="flex items-center space-x-2"><img src="${p.avatarUrl || 'https://placehold.co/24x24'}" class="w-6 h-6 rounded-full"><span>${p.displayName}</span></li>`;
        }).join('');

        let actionButtonHTML = '';
        if(isDraftEvent) {
            actionButtonHTML = `<a href="draft-deck.html?draftId=${eventData.draftId}" class="btn btn-primary">Build Your Draft Deck</a>`;
        } else if (user && eventData.status === 'upcoming') {
            const isParticipant = participantUIDs.includes(user.uid);
            actionButtonHTML = isParticipant 
                ? `<button id="leave-event-btn" class="px-6 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700">Leave Event</button>`
                : `<button id="join-event-btn" class="px-6 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Join Event</button>`;
        }

        eventDetailsSection.innerHTML = `
            <button id="back-to-events" class="mb-4 text-blue-500 hover:underline"><i class="fas fa-arrow-left mr-2"></i>Back to All Events</button>
            <div class="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
                <div class="flex flex-col md:flex-row justify-between items-start mb-4">
                    <div class="mb-4 md:mb-0">
                        <h2 class="text-3xl font-extrabold text-gray-900 dark:text-white">${eventData.name}</h2>
                        <p class="text-gray-600 dark:text-gray-400 mt-1">Organized by ${eventData.organizerName}</p>
                    </div>
                    ${actionButtonHTML}
                </div>
                <div id="admin-actions-container" class="mb-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"></div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="md:col-span-2" id="tournament-view-container"></div>
                    <div class="md:col-span-1 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <h4 class="font-bold text-lg mb-4 dark:text-white">Participants (${participantUIDs.length})</h4>
                        <ul class="space-y-2">${participantsList || '<p class="text-sm text-gray-500">No one has joined yet.</p>'}</ul>
                    </div>
                </div>
            </div>
        `;
        
        const tournamentContainer = document.getElementById('tournament-view-container');
        if (eventData.format === 'swiss') {
            renderSwissView(tournamentContainer, eventData, eventId, isOrganizer);
        } else {
             tournamentContainer.innerHTML = `<p>This tournament format is not yet supported.</p>`;
        }
        
        addCommonEventListeners(eventId, eventData, isOrganizer);
    };

    const renderSwissPairings = (container, eventData, eventId, isOrganizer) => {
        if (!eventData.rounds || eventData.currentRound === 0) {
            container.innerHTML = '<div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center text-gray-500 dark:text-gray-400">The tournament has not started yet.</div>';
            return;
        }
        
        const roundIndex = eventData.currentRound - 1;
        const round = eventData.rounds[roundIndex];
        
        let pairingsHTML = `<h4 class="text-xl font-bold mb-2 dark:text-white">Round ${eventData.currentRound} Pairings</h4>`;
        if (!round || !round.matches) return;

        const pairingsBody = round.matches.map((match, matchIndex) => {
            let resultHTML;
            const isPlayerInMatch = user && (user.uid === match.player1.id || user.uid === match.player2.id);

            if (match.result) {
                resultHTML = `<span class="font-bold text-green-500">${match.result.player1Wins} - ${match.result.player2Wins}</span>`;
            } else if (eventData.draftId && isPlayerInMatch) {
                resultHTML = `<button data-event-id="${eventId}" data-draft-id="${eventData.draftId}" data-round-index="${roundIndex}" data-match-index="${matchIndex}" class="start-game-btn px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full hover:bg-green-600">Start Game</button>`;
            } else if (isOrganizer || currentUserIsAdmin) {
                resultHTML = `<button data-event-id="${eventId}" data-round-index="${roundIndex}" data-match-index="${matchIndex}" class="report-match-btn px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-full hover:bg-yellow-600">Report</button>`;
            } else {
                resultHTML = `<span class="text-xs text-gray-500 dark:text-gray-400">Pending</span>`;
            }

            if (match.isBye) {
                return `<div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex justify-between items-center"><span class="font-semibold dark:text-white">${match.player1.displayName}</span><span class="font-bold text-green-500">BYE (1-0)</span></div>`;
            }

            return `<div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex justify-between items-center"><div><span class="font-semibold dark:text-white">${match.player1.displayName}</span><span class="mx-2 dark:text-gray-400">vs</span><span class="font-semibold dark:text-white">${match.player2.displayName}</span></div>${resultHTML}</div>`;
        }).join('');

        container.innerHTML = pairingsHTML + `<div class="space-y-4">${pairingsBody}</div>`;
    };

    // --- Delegated Event Listeners & Initial Load ---
    document.body.addEventListener('click', async (e) => {
        const reportBtn = e.target.closest('.report-match-btn');
        if (reportBtn) {
            const { eventId, roundIndex, matchIndex } = reportBtn.dataset;
            openReportMatchModal(eventId, roundIndex, matchIndex);
        }

        const startBtn = e.target.closest('.start-game-btn');
        if (startBtn) {
            const { eventId, roundIndex, matchIndex, draftId } = startBtn.dataset;
            try {
                startBtn.textContent = 'Starting...';
                startBtn.disabled = true;
                const result = await createGameFromMatch({ eventId, roundIndex, matchIndex, draftId });
                window.location.href = `mtg-gaming.html?gameId=${result.data.gameId}`;
            } catch (error) {
                console.error("Error creating game:", error);
                alert("Could not start the game: " + error.message);
                startBtn.textContent = 'Start Game';
                startBtn.disabled = false;
            }
        }
    });

    loadAllEvents();
});

