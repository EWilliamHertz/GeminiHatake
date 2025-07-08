/**
 * HatakeSocial - Events Page Script (v6 - RSVP & My Events)
 *
 * This version adds a full RSVP system, an attendee list modal,
 * and a "My Events" tab to filter for events the user is attending.
 * It also prioritizes events in the user's country.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const eventsListContainer = document.getElementById('events-list');
    if (!eventsListContainer) return;

    // --- State ---
    let allEvents = [];
    let activeTab = 'all';

    // --- DOM Elements ---
    const createEventBtn = document.getElementById('create-event-btn');
    const createEventModal = document.getElementById('create-event-modal');
    const closeEventModalBtn = document.getElementById('close-event-modal');
    const createEventForm = document.getElementById('create-event-form');
    const attendeesModal = document.getElementById('attendees-modal');
    const closeAttendeesModalBtn = document.getElementById('close-attendees-modal');
    const eventTabs = document.querySelectorAll('.event-tab-button');
    
    // View toggle elements
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

    createEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) {
            alert("You must be logged in to create an event.");
            return;
        }

        const eventImageFile = document.getElementById('eventImage').files[0];
        let imageUrl = '';

        const submitButton = createEventForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        try {
            if (eventImageFile) {
                const imagePath = `events/${Date.now()}_${eventImageFile.name}`;
                const imageRef = storage.ref(imagePath);
                await imageRef.put(eventImageFile);
                imageUrl = await imageRef.getDownloadURL();
            }

            const eventData = {
                name: document.getElementById('eventName').value,
                date: new Date(document.getElementById('eventDate').value),
                city: document.getElementById('eventCity').value,
                country: document.getElementById('eventCountry').value,
                description: document.getElementById('eventDescription').value,
                link: document.getElementById('eventLink').value,
                imageUrl: imageUrl,
                creatorId: user.uid,
                creatorName: user.displayName || 'Anonymous',
                createdAt: new Date(),
                attendees: [user.uid] // Creator automatically attends
            };

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
        if (snapshot.empty) {
            allEvents = [];
        } else {
            allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        renderEvents();
    };

    const renderEvents = () => {
        let eventsToRender = [];
        if (activeTab === 'my-events') {
            if (!user) {
                eventsListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Please log in to see your events.</p>';
                return;
            }
            eventsToRender = allEvents.filter(event => event.attendees.includes(user.uid));
        } else {
            // Prioritize local events
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
            const eventId = eventData.id;
            const eventDate = new Date(eventData.date.seconds * 1000);
            
            const eventCard = document.createElement('div');
            eventCard.className = 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col md:flex-row gap-6';
            const isAttending = user ? eventData.attendees.includes(user.uid) : false;
            const isCreator = user && eventData.creatorId === user.uid;
            eventCard.innerHTML = `
                <img src="${eventData.imageUrl || 'https://placehold.co/400x250/cccccc/969696?text=Event'}" alt="${eventData.name}" class="w-full md:w-1/3 h-48 object-cover rounded-md">
                <div class="flex-grow">
                     <div class="flex justify-between items-start">
                        <p class="text-sm font-semibold text-blue-600 dark:text-blue-400">${eventDate.toDateString()}</p>
                        ${isCreator ? `<button data-id="${eventId}" class="delete-event-btn text-gray-400 hover:text-red-500 text-xs" title="Delete Event"><i class="fas fa-trash fa-lg"></i></button>` : ''}
                    </div>
                    <h3 class="text-2xl font-bold text-gray-800 dark:text-white mt-1">${eventData.name}</h3>
                    <p class="text-gray-500 dark:text-gray-400 mt-1"><i class="fas fa-map-marker-alt mr-2"></i>${eventData.city}, ${eventData.country}</p>
                    <p class="text-gray-700 dark:text-gray-300 mt-4">${eventData.description}</p>
                    <div class="mt-4 flex justify-between items-center">
                        <div>
                            <a href="${eventData.link}" target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline font-semibold" ${!eventData.link ? 'hidden' : ''}>Visit Website <i class="fas fa-external-link-alt ml-1 text-xs"></i></a>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Created by: ${eventData.creatorName}</p>
                        </div>
                        <div class="text-right">
                            <button data-id="${eventId}" class="attend-btn px-5 py-2 font-semibold rounded-full ${isAttending ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}">
                                ${isAttending ? '<i class="fas fa-check mr-2"></i>Going' : 'RSVP'}
                            </button>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1"><a href="#" class="view-attendees-btn" data-id="${eventId}">${eventData.attendees.length} attending</a></p>
                        </div>
                    </div>
                </div>
            `;
            eventsListContainer.appendChild(eventCard);
            
            calendarEvents.push({
                id: eventId,
                title: eventData.name,
                start: eventDate,
                allDay: true
            });
        });
        
        renderCalendar(calendarEvents);
    };
    
    const renderCalendar = (events) => {
        if (calendar) {
            calendar.removeAllEvents();
            calendar.addEventSource(events);
        } else {
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                events: events,
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,listWeek'
                }
            });
            calendar.render();
        }
    };

    const showAttendeesModal = async (eventId) => {
        const attendeesListContainer = document.getElementById('attendees-list-container');
        attendeesListContainer.innerHTML = '<p>Loading attendees...</p>';
        openModal(attendeesModal);

        try {
            const eventDoc = await db.collection('events').doc(eventId).get();
            if (!eventDoc.exists) throw new Error("Event not found.");
            
            const attendeeIds = eventDoc.data().attendees;
            if (attendeeIds.length === 0) {
                attendeesListContainer.innerHTML = '<p>No one is attending yet.</p>';
                return;
            }

            attendeesListContainer.innerHTML = '';
            for (const userId of attendeeIds) {
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const attendeeEl = document.createElement('a');
                    attendeeEl.href = `profile.html?uid=${userId}`;
                    attendeeEl.className = 'flex items-center space-x-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md';
                    attendeeEl.innerHTML = `
                        <img src="${userData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${userData.displayName}" class="w-12 h-12 rounded-full object-cover">
                        <div>
                            <p class="font-bold text-gray-800 dark:text-white">${userData.displayName}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">@${userData.handle}</p>
                        </div>
                    `;
                    attendeesListContainer.appendChild(attendeeEl);
                }
            }
        } catch (error) {
            console.error("Error loading attendees:", error);
            attendeesListContainer.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        }
    };


    eventsListContainer.addEventListener('click', async (e) => {
        const attendBtn = e.target.closest('.attend-btn');
        const deleteBtn = e.target.closest('.delete-event-btn');
        const viewAttendeesBtn = e.target.closest('.view-attendees-btn');

        if (attendBtn) {
            if (!user) {
                alert("Please log in to attend events.");
                return;
            }
            const eventId = attendBtn.dataset.id;
            const eventRef = db.collection('events').doc(eventId);
            await db.runTransaction(async (transaction) => {
                const eventDoc = await transaction.get(eventRef);
                if (!eventDoc.exists) throw "Event does not exist!";
                const attendees = eventDoc.data().attendees || [];
                if (attendees.includes(user.uid)) {
                    transaction.update(eventRef, { attendees: firebase.firestore.FieldValue.arrayRemove(user.uid) });
                } else {
                    transaction.update(eventRef, { attendees: firebase.firestore.FieldValue.arrayUnion(user.uid) });
                }
            });
            fetchAllEvents(); // Refetch all events to update the UI
        }

        if (deleteBtn) {
            if (!user) return;
            const eventId = deleteBtn.dataset.id;
            if (confirm("Are you sure you want to delete this event? This cannot be undone.")) {
                try {
                    await db.collection('events').doc(eventId).delete();
                    alert("Event deleted.");
                    fetchAllEvents();
                } catch (error) {
                    console.error("Error deleting event:", error);
                    alert("Could not delete event. Check security rules in Firebase.");
                }
            }
        }
        
        if (viewAttendeesBtn) {
            e.preventDefault();
            const eventId = viewAttendeesBtn.dataset.id;
            showAttendeesModal(eventId);
        }
    });
    
    // View Toggle Logic
    listViewBtn.addEventListener('click', () => {
        listViewBtn.classList.add('bg-white', 'dark:bg-gray-800', 'shadow');
        calendarViewBtn.classList.remove('bg-white', 'dark:bg-gray-800', 'shadow');
        eventsListView.classList.remove('hidden');
        calendarView.classList.add('hidden');
    });

    calendarViewBtn.addEventListener('click', () => {
        calendarViewBtn.classList.add('bg-white', 'dark:bg-gray-800', 'shadow');
        listViewBtn.classList.remove('bg-white', 'dark:bg-gray-800', 'shadow');
        calendarView.classList.remove('hidden');
        eventsListView.classList.add('hidden');
    });

    // Event Tab Logic
    eventTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            eventTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.dataset.tab;
            renderEvents(); // Re-render the list based on the new tab
        });
    });

    fetchAllEvents();
});
