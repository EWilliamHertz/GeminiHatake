
/**
 * HatakeSocial - Integrated Events & Tournaments Script
 *
 * This script now manages both "Local Events" and user-created "Tournaments".
 * - It fetches all events from Firestore and filters them into the correct tabs based on the 'eventType' field.
 * - All existing functionality for creating, viewing details, joining, and managing events/tournaments is preserved and works across both tabs.
 * - Includes logic to link completed drafts to a deck builder and tournament pairings to a live game room.
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
    const tournamentsListContainer = document.getElementById('tournaments-list'); // Container for tournaments
    const createEventBtn = document.getElementById('create-event-btn');
    const createEventModal = document.getElementById('create-event-modal');
    const closeEventModalBtn = document.getElementById('close-event-modal');
    const createEventForm = document.getElementById('create-event-form');
    const reportMatchModal = document.getElementById('report-match-modal');
    const closeMatchModalBtn = document.getElementById('close-match-modal');
    const reportMatchForm = document.getElementById('report-match-form');
    
    let currentEditEventId = null; // State for editing

    if (!eventsMainView) return;

    // --- Modal Handling & Form Logic ---
    const openModal = (modal) => modal.classList.add('modal-active');
    const closeModal = (modal) => {
        modal.classList.remove('modal-active');
        // Reset form to "create" mode when closing
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
            currentEditEventId = null; // Ensure it's in create mode
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

    // --- Event Creation & Editing ---
    createEventForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
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
                // UPDATE existing event
                await db.collection('events').doc(currentEditEventId).update(eventData);
                alert('Event updated successfully!');
            } else {
                // CREATE new event
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
            if (!currentEditEventId) {
                loadAllEvents(); // Full reload only on create
            } else {
                loadEventDetails(currentEditEventId); // Just refresh the details view on edit
            }
        } catch (error) {
            console.error("Error saving event:", error);
            alert('Failed to save event.');
        }
    });

    // --- Main Loading Function (UPDATED) ---
    const loadAllEvents = async () => {
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

    // --- Date Formatting Helpers ---
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

    // --- UI Rendering ---
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
                                <p><i class="fas fa-map-marker-alt fa-fw mr-3 text-blue-500"></i><strong>Location:</strong> ${eventData.city || 'N/A'}, ${eventData.country || 'N/A'}</p>
                                ${eventData.game ? `<p><i class="fas fa-gamepad fa-fw mr-3 text-blue-500"></i><strong>Game:</strong> ${eventData.game}</p>` : ''}
                                ${eventData.link ? `<p><i class="fas fa-link fa-fw mr-3 text-blue-500"></i><strong>Link:</strong> <a href="${eventData.link}" target="_blank" class="text-blue-500 hover:underline">${eventData.link}</a></p>` : ''}
                                <p><i class="fas fa-info-circle fa-fw mr-3 text-blue-500"></i><strong>Description:</strong> ${eventData.description || 'No description provided.'}</p>
                            </div>
                        </div>
                        <div class="md:col-span-1">
                            <h4 class="font-bold text-lg mb-2 dark:text-white">Participants (${participantUIDs.length})</h4>
                            <ul class="space-y-2">${participantsList}</ul>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('back-to-events').addEventListener('click', loadAllEvents);
        document.getElementById('join-event-btn')?.addEventListener('click', () => joinEvent(eventId));
        document.getElementById('leave-event-btn')?.addEventListener('click', () => leaveEvent(eventId));

        if (isOrganizer || currentUserIsAdmin) {
            const adminActionsContainer = document.getElementById('admin-actions-container');
            adminActionsContainer.innerHTML = `
                <h4 class="font-bold text-lg mb-2 dark:text-white">Organizer Actions</h4>
                <div class="flex space-x-2">
                    <button id="edit-event-btn" class="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-full hover:bg-yellow-600">Edit Event</button>
                    <button id="delete-event-btn" class="px-4 py-2 bg-red-500 text-white font-semibold rounded-full hover:bg-red-600">Delete Event</button>
                </div>
            `;
            document.getElementById('edit-event-btn')?.addEventListener('click', () => editEvent(eventId, eventData));
            document.getElementById('delete-event-btn')?.addEventListener('click', () => deleteEvent(eventId, eventData.name));
        }
    };

    const renderTournamentDetails = (eventData, eventId, isOrganizer) => {
        const participantUIDs = Object.keys(eventData.participants || {});
        let participantsList = participantUIDs.map(uid => {
            const p = eventData.participants[uid];
            return `<li class="flex items-center space-x-2"><img src="${p.avatarUrl || 'https://placehold.co/24x24'}" class="w-6 h-6 rounded-full"><span>${p.displayName}</span></li>`;
        }).join('');

        let actionButtonHTML = '';
        if (eventData.draftId && eventData.status === 'completed' && user && participantUIDs.includes(user.uid)) {
            actionButtonHTML = `<a href="draft-deck.html?draftId=${eventData.draftId}" class="btn btn-primary px-6 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Build Your Draft Deck</a>`;
        } else if (user && eventData.status === 'upcoming') {
            const isParticipant = participantUIDs.includes(user.uid);
            actionButtonHTML = isParticipant 
                ? `<button id="leave-event-btn" class="px-6 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700">Leave Event</button>`
                : `<button id="join-event-btn" class="px-6 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Join Event</button>`;
        }

        const eventDate = formatEventDate(eventData.date, eventData.endDate);

        eventDetailsSection.innerHTML = `
            <button id="back-to-events" class="mb-4 text-blue-500 hover:underline"><i class="fas fa-arrow-left mr-2"></i>Back to All Events</button>
            <div class="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h2 class="text-3xl font-bold dark:text-white">${eventData.name}</h2>
                        <p class="text-gray-500 dark:text-gray-400">Organized by ${eventData.organizerName || eventData.creatorName || 'N/A'}</p>
                        <p class="text-gray-500 dark:text-gray-400">Format: ${eventData.format || 'N/A'}</p>
                    </div>
                    ${actionButtonHTML}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="md:col-span-2">
                        <div id="admin-actions-container" class="mb-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"></div>
                        <div id="tournament-view-container"></div>
                    </div>
                    <div class="md:col-span-1">
                        <h4 class="font-bold text-lg mb-2 dark:text-white">Participants (${participantUIDs.length})</h4>
                        <ul class="space-y-2">${participantsList}</ul>
                    </div>
                </div>
            </div>`;

        document.getElementById('back-to-events').addEventListener('click', loadAllEvents);
        document.getElementById('join-event-btn')?.addEventListener('click', () => joinEvent(eventId));
        document.getElementById('leave-event-btn')?.addEventListener('click', () => leaveEvent(eventId));

        if (isOrganizer || currentUserIsAdmin) {
            const adminActionsContainer = document.getElementById('admin-actions-container');
            let adminButtons = `
                <h4 class="font-bold text-lg mb-2 dark:text-white">Organizer Actions</h4>
                <div class="flex flex-wrap gap-2">
                    <button id="edit-event-btn" class="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-full hover:bg-yellow-600">Edit Event</button>
                    <button id="delete-event-btn" class="px-4 py-2 bg-red-500 text-white font-semibold rounded-full hover:bg-red-600">Delete Event</button>
            `;
            if (eventData.format === 'swiss') {
                if (eventData.status === 'upcoming' && participantUIDs.length >= 2) {
                    adminButtons += `<button id="start-tournament-btn" class="px-4 py-2 bg-green-500 text-white font-semibold rounded-full hover:bg-green-600">Start Tournament</button>`;
                } else if (eventData.status === 'ongoing') {
                    adminButtons += `<button id="generate-next-round-btn" class="px-4 py-2 bg-purple-500 text-white font-semibold rounded-full hover:bg-purple-600">Generate Next Round</button>`;
                    adminButtons += `<button id="end-tournament-btn" class="px-4 py-2 bg-red-700 text-white font-semibold rounded-full hover:bg-red-800">End Tournament</button>`;
                }
            }
            adminButtons += `</div>`;
            adminActionsContainer.innerHTML = adminButtons;

            document.getElementById('edit-event-btn')?.addEventListener('click', () => editEvent(eventId, eventData));
            document.getElementById('delete-event-btn')?.addEventListener('click', () => deleteEvent(eventId, eventData.name));
            document.getElementById('start-tournament-btn')?.addEventListener('click', () => startTournament(eventId));
            document.getElementById('generate-next-round-btn')?.addEventListener('click', () => generateNextRound(eventId, eventData.currentRound + 1));
            document.getElementById('end-tournament-btn')?.addEventListener('click', () => endTournament(eventId));
        }

        renderSwissView(document.getElementById('tournament-view-container'), eventData, eventId, isOrganizer);
    };

    const renderSwissView = (container, eventData, eventId, isOrganizer) => {
        let viewHTML = `
            <h3 class="text-xl font-bold border-b pb-2 mb-4 dark:text-white dark:border-gray-600">Tournament Details</h3>
            <div class="space-y-4 text-gray-700 dark:text-gray-300 mb-6">
                <p><i class="fas fa-calendar-alt fa-fw mr-3 text-blue-500"></i><strong>Date:</strong> ${formatEventDate(eventData.date, eventData.endDate)}</p>
                <p><i class="fas fa-map-marker-alt fa-fw mr-3 text-blue-500"></i><strong>Location:</strong> ${eventData.city || 'N/A'}, ${eventData.country || 'N/A'}</p>
                <p><i class="fas fa-gamepad fa-fw mr-3 text-blue-500"></i><strong>Game:</strong> ${eventData.game || 'N/A'}</p>
                <p><i class="fas fa-info-circle fa-fw mr-3 text-blue-500"></i><strong>Description:</strong> ${eventData.description || 'No description provided.'}</p>
                <p><i class="fas fa-trophy fa-fw mr-3 text-blue-500"></i><strong>Format:</strong> ${eventData.format || 'N/A'}</p>
                <p><i class="fas fa-hourglass-half fa-fw mr-3 text-blue-500"></i><strong>Status:</strong> ${eventData.status}</p>
                ${eventData.currentRound ? `<p><i class="fas fa-redo fa-fw mr-3 text-blue-500"></i><strong>Current Round:</strong> ${eventData.currentRound}</p>` : ''}
            </div>
        `;

        if (eventData.status === 'completed') {
            viewHTML += `<div class="mb-6">`;
            renderSwissStandings(container, eventData);
            viewHTML += `</div>`;
        } else if (eventData.status === 'ongoing' && eventData.currentRound > 0) {
            viewHTML += `<div class="mb-6">`;
            renderSwissPairings(container, eventData, eventId, isOrganizer);
            viewHTML += `</div>`;
            viewHTML += `<div class="mb-6">`;
            renderSwissStandings(container, eventData);
            viewHTML += `</div>`;
        } else {
            viewHTML += '<p class="text-center text-gray-500 dark:text-gray-400">Tournament has not started yet or no rounds generated.</p>';
        }
        container.innerHTML = viewHTML;

        // Re-attach event listeners for dynamically added buttons
        document.querySelectorAll('.report-match-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const { eventId, roundIndex, matchIndex } = e.target.dataset;
                openReportMatchModal(eventId, roundIndex, matchIndex);
            });
        });
        document.querySelectorAll('.start-game-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const { eventId, roundIndex, matchIndex, draftId } = e.target.dataset;
                try {
                    e.target.textContent = 'Starting...';
                    e.target.disabled = true;
                    const result = await createGameFromMatch({ eventId, roundIndex, matchIndex, draftId });
                    window.location.href = `mtg-gaming.html?gameId=${result.data.gameId}`;
                } catch (error) {
                    console.error("Error creating game:", error);
                    alert("Could not start the game: " + error.message);
                    e.target.textContent = 'Start Game';
                    e.target.disabled = false;
                }
            });
        });
    };

    const renderSwissStandings = async (container, eventData) => {
        const eventRef = db.collection('events').doc(eventData.id);
        const participantsSnap = await eventRef.collection('participants').orderBy('points', 'desc').get();
        const standings = participantsSnap.docs.map((doc, index) => ({ rank: index + 1, ...doc.data() }));

        const standingsBody = standings.map(p => `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${p.rank}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 flex items-center space-x-2">
                    <img src="${p.avatarUrl || 'https://placehold.co/24x24'}" class="w-6 h-6 rounded-full">
                    <span>${p.displayName}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${p.points}</td>
            </tr>
        `).join('');

        container.innerHTML += `
            <h4 class="text-xl font-bold mb-2 dark:text-white">Standings</h4>
            <div class="overflow-x-auto shadow rounded-lg">
                <table class="min-w-full bg-white dark:bg-gray-800">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rank</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Player</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Points</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">${standingsBody}</tbody>
                </table>
            </div>
        `;
    };

    const renderSwissPairings = (container, eventData, eventId, isOrganizer) => {
        if (!eventData.rounds || eventData.currentRound === 0) {
            container.innerHTML = '<div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center text-gray-500 dark:text-gray-400">The tournament has not started yet.</div>';
            return;
        }
        
        const roundIndex = eventData.currentRound - 1;
        const round = eventData.rounds[roundIndex];
        
        let pairingsHTML = `<h4 class="text-xl font-bold mb-2 dark:text-white">Round ${eventData.currentRound} Pairings</h4>`;
        if (!round || !round.matches) {
            container.innerHTML = pairingsHTML + '<p class="text-red-500">Error: Could not load pairings for this round.</p>';
            return;
        }

        const pairingsBody = round.matches.map((match, matchIndex) => {
            let resultHTML;
            const isPlayerInMatch = user && (user.uid === match.player1.id || (match.player2 && user.uid === match.player2.id));

            if (match.result) {
                resultHTML = `<span class="font-bold text-green-500">${match.result.player1Wins} - ${match.result.player2Wins}</span>`;
            } else if (eventData.isDraftEvent && isPlayerInMatch) {
                resultHTML = `<button data-event-id="${eventId}" data-draft-id="${eventData.draftId}" data-round-index="${roundIndex}" data-match-index="${matchIndex}" class="start-game-btn px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full hover:bg-blue-600">Start Game</button>`;
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

        container.innerHTML += pairingsHTML + `<div class="space-y-4">${pairingsBody}</div>`;
    };

    const startTournament = async (eventId) => {
        if (!confirm('Are you sure you want to start this tournament? This will generate the first round pairings.')) return;
        try {
            await db.collection('events').doc(eventId).update({ status: 'ongoing', currentRound: 1 });
            await generateSwissPairings(eventId, 1);
            alert('Tournament started and Round 1 pairings generated!');
        } catch (error) {
            console.error("Error starting tournament:", error);
            alert('Failed to start tournament: ' + error.message);
        }
    };

    const generateNextRound = async (eventId, nextRoundNumber) => {
        if (!confirm(`Are you sure you want to generate Round ${nextRoundNumber} pairings?`)) return;
        try {
            await generateSwissPairings(eventId, nextRoundNumber);
            await db.collection('events').doc(eventId).update({ currentRound: nextRoundNumber });
            alert(`Round ${nextRoundNumber} pairings generated!`);
        } catch (error) {
            console.error("Error generating next round:", error);
            alert('Failed to generate next round: ' + error.message);
        }
    };

    const endTournament = async (eventId) => {
        if (!confirm('Are you sure you want to end this tournament?')) return;
        try {
            await db.collection('events').doc(eventId).update({ status: 'completed' });
            alert('Tournament ended!');
        } catch (error) {
            console.error("Error ending tournament:", error);
            alert('Failed to end tournament: ' + error.message);
        }
    };

    const generateSwissPairings = async (eventId, roundNumber) => {
        const eventRef = db.collection('events').doc(eventId);
        const participantsSnap = await eventRef.collection('participants').get();
        let players = participantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Simple shuffle for round 1, sort by points for subsequent rounds
        if (roundNumber === 1) {
            players.sort(() => Math.random() - 0.5);
        } else {
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
            if (!byePlayer) { // If everyone had a bye, give it to the lowest ranked player again
                byePlayer = players.pop();
            }
        }
        
        const matches = [];
        while (players.length > 0) {
            const player1 = players.shift();
            // In a real system, you'd find a valid opponent they haven't played yet
            const player2 = players.shift(); 
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
    
    const joinEvent = async (eventId) => {
        if (!user) return alert('You must be logged in to join.');
        const eventRef = db.collection('events').doc(eventId);
        const participantData = {
            displayName: user.displayName,
            avatarUrl: user.photoURL
        };
        await eventRef.update({
            [`participants.${user.uid}`]: participantData
        });
        
        const eventDoc = await eventRef.get();
        if (eventDoc.data().eventType === 'tournament' && eventDoc.data().format === 'swiss') {
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
        if (eventDoc.data().eventType === 'tournament' && eventDoc.data().format === 'swiss') {
             await eventRef.collection('participants').doc(user.uid).delete();
        }
        alert('You have left the event.');
    };

    const editEvent = async (eventId, eventData) => {
        currentEditEventId = eventId;
        document.querySelector('#create-event-modal h2').textContent = 'Edit Event';
        document.querySelector('#create-event-form button[type="submit"]').textContent = 'Update Event';

        document.getElementById('event-name').value = eventData.name;
        document.getElementById('event-type').value = eventData.eventType;
        document.getElementById('event-game').value = eventData.game;
        document.getElementById('event-date').value = formatTimestampForInput(eventData.date);
        document.getElementById('event-end-date').value = formatTimestampForInput(eventData.endDate);
        document.getElementById('event-city').value = eventData.city;
        document.getElementById('event-country').value = eventData.country;
        document.getElementById('event-description').value = eventData.description;
        document.getElementById('event-image-url').value = eventData.imageUrl;
        document.getElementById('event-link').value = eventData.link;

        if (eventData.eventType === 'tournament') {
            document.getElementById('tournament-format-container').classList.remove('hidden');
            document.getElementById('event-format').value = eventData.format;
        } else {
            document.getElementById('tournament-format-container').classList.add('hidden');
        }
        openModal(createEventModal);
    };

    const deleteEvent = async (eventId, eventName) => {
        if (confirm(`Are you sure you want to delete the event: ${eventName}?`)) {
            try {
                await db.collection('events').doc(eventId).delete();
                alert('Event deleted successfully!');
                loadAllEvents();
            } catch (error) {
                console.error("Error deleting event:", error);
                alert('Failed to delete event.');
            }
        }
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
        const eventRef = db.collection('events').doc(eventId);

        const round = eventData.rounds[roundIndex];
        const match = round.matches[matchIndex];
        
        match.result = { player1Wins: p1Wins, player2Wins: p2Wins, draws: draws };

        await eventRef.update({ rounds: eventData.rounds });

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

    // --- Delegated Event Listeners & Initial Load ---
    document.body.addEventListener('click', (e) => {
        const reportBtn = e.target.closest('.report-match-btn');
        if (reportBtn) {
            const { eventId, roundIndex, matchIndex } = reportBtn.dataset;
            openReportMatchModal(eventId, roundIndex, matchIndex);
        }
    });

    loadAllEvents();
});

// --- Tab switching logic ---
document.addEventListener('DOMContentLoaded', () => {
    const localEventsTab = document.getElementById('local-events-tab');
    if (!localEventsTab) return; 

    const tabs = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => {
                t.classList.remove('text-blue-600', 'border-blue-600', 'dark:text-blue-400', 'dark:border-blue-400');
                t.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'dark:text-gray-400', 'dark:hover:text-gray-300', 'dark:hover:border-gray-500');
            });

            tab.classList.add('text-blue-600', 'border-blue-600', 'dark:text-blue-400', 'dark:border-blue-400');
            tab.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'dark:text-gray-400', 'dark:hover:text-gray-300', 'dark:hover:border-gray-500');
            
            panels.forEach(panel => panel.classList.add('hidden'));

            const panelId = tab.getAttribute('data-tab');
            document.getElementById(panelId).classList.remove('hidden');
        });
    });
});
