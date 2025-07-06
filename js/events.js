/**
 * HatakeSocial - Events Page Script (v3 - Complete with Delete Fix)
 *
 * This is the full version of the events script, with a fix
 * to properly display the delete button for event creators.
 window.HatakeSocial.onAuthReady((user) => {
    const user = user;
    const eventsListContainer = document.getElementById('events-list');
    if (!eventsListContainer) return;

    const createEventBtn = document.getElementById('create-event-btn');
    const createEventModal = document.getElementById('create-event-modal');
    const closeEventModalBtn = document.getElementById('close-event-modal');
    const createEventForm = document.getElementById('create-event-form');

    if (user) {
        createEventBtn.classList.remove('hidden');
    }

    createEventBtn.addEventListener('click', () => openModal(createEventModal));
    closeEventModalBtn.addEventListener('click', () => closeModal(createEventModal));

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
                attendees: []
            };

            await db.collection('events').add(eventData);

            alert("Event created successfully!");
            closeModal(createEventModal);
            createEventForm.reset();
            loadEvents();

        } catch (error) {
            console.error("Error creating event:", error);
            alert("Could not create event. " + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Event';
        }
    });

    const loadEvents = async () => {
        eventsListContainer.innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i></div>';
        
        const snapshot = await db.collection('events').orderBy('date', 'asc').get();
        if (snapshot.empty) {
            eventsListContainer.innerHTML = '<p class="text-center text-gray-500">No upcoming events. Why not create one?</p>';
            return;
        }

        eventsListContainer.innerHTML = '';
        snapshot.forEach(doc => {
            const event = doc.data();
            const eventId = doc.id;
            const eventCard = document.createElement('div');
            eventCard.className = 'bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row gap-6';

            const isAttending = user ? event.attendees.includes(user.uid) : false;
            const isCreator = user && event.creatorId === user.uid;

            eventCard.innerHTML = `
                <img src="${event.imageUrl || 'https://placehold.co/400x250/cccccc/969696?text=Event'}" alt="${event.name}" class="w-full md:w-1/3 h-48 object-cover rounded-md">
                <div class="flex-grow">
                     <div class="flex justify-between items-start">
                        <p class="text-sm font-semibold text-blue-600">${new Date(event.date.seconds * 1000).toDateString()}</p>
                        ${isCreator ? `<button data-id="${eventId}" class="delete-event-btn text-gray-400 hover:text-red-500 text-xs" title="Delete Event"><i class="fas fa-trash fa-lg"></i></button>` : ''}
                    </div>
                    <h3 class="text-2xl font-bold text-gray-800 mt-1">${event.name}</h3>
                    <p class="text-gray-500 mt-1"><i class="fas fa-map-marker-alt mr-2"></i>${event.city}, ${event.country}</p>
                    <p class="text-gray-700 mt-4">${event.description}</p>
                    <div class="mt-4 flex justify-between items-center">
                        <div>
                            <a href="${event.link}" target="_blank" class="text-blue-600 hover:underline font-semibold" ${!event.link ? 'hidden' : ''}>Visit Website <i class="fas fa-external-link-alt ml-1 text-xs"></i></a>
                            <p class="text-sm text-gray-500 mt-1">Created by: ${event.creatorName}</p>
                        </div>
                        <div class="text-right">
                            <button data-id="${eventId}" class="attend-btn px-5 py-2 font-semibold rounded-full ${isAttending ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'}">
                                ${isAttending ? '<i class="fas fa-check mr-2"></i>Attending' : 'Attend'}
                            </button>
                            <p class="text-sm text-gray-500 mt-1">${event.attendees.length} attending</p>
                        </div>
                    </div>
                </div>
            `;
            eventsListContainer.appendChild(eventCard);
        });
    };

    eventsListContainer.addEventListener('click', async (e) => {
        const attendBtn = e.target.closest('.attend-btn');
        const deleteBtn = e.target.closest('.delete-event-btn');

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
            loadEvents();
        }

        if (deleteBtn) {
            if (!user) return;
            const eventId = deleteBtn.dataset.id;
            if (confirm("Are you sure you want to delete this event? This cannot be undone.")) {
                try {
                    await db.collection('events').doc(eventId).delete();
                    alert("Event deleted.");
                    loadEvents();
                } catch (error) {
                    console.error("Error deleting event:", error);
                    alert("Could not delete event. Check security rules in Firebase.");
                }
            }
        }
    });

    const seedInitialEvents = async () => {
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef.limit(1).get();

        if (snapshot.empty && user) {
            console.log("No events found, seeding initial data...");
            const initialEvents = [
                { name: 'Need to be Geek Convention', date: new Date('2025-09-27'), city: 'Skara', country: 'Sweden', description: 'This geek culture event features everything from Pokémon and Star Wars to Warhammer and DnD.', link: 'https://needtobegeek.se', imageUrl: '', creatorId: user.uid, creatorName: user.displayName, createdAt: new Date(), attendees: [] },
                { name: 'SweCard Expo', date: new Date('2025-10-11'), city: 'Svedala', country: 'Sweden', description: 'Join us at SweCard in Svedala, just 20 minutes from Malmö.', link: 'http://swecard.org/', imageUrl: '', creatorId: user.uid, creatorName: user.displayName, createdAt: new Date(), attendees: [] }
            ];
            const batch = db.batch();
            initialEvents.forEach(event => {
                const docRef = eventsRef.doc();
                batch.set(docRef, event);
            });
            await batch.commit();
            console.log("Initial events seeded successfully.");
        }
    };

    seedInitialEvents().then(loadEvents);
});
