// In public/js/tournaments.js

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('tournaments-panel')) {
        return;
    }

    const upcomingList = document.getElementById('upcoming-tournaments-list');
    const ongoingList = document.getElementById('ongoing-tournaments-list');
    const previousList = document.getElementById('previous-tournaments-list');

    // UPDATED: Use a standard fetch call to the function URL
    const loadTournaments = async () => {
        setLoadingState();
        try {
            // Replace with your actual cloud function URL
            const functionUrl = 'https://us-central1-hatakesocial-88b5e.cloudfunctions.net/fetchTournaments';
            const response = await fetch(functionUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const tournaments = await response.json();

            // Clear existing lists
            upcomingList.innerHTML = '';
            ongoingList.innerHTML = '';
            previousList.innerHTML = '';

            const categorized = {
                upcoming: [],
                ongoing: [],
                previous: []
            };

            tournaments.forEach(tourney => {
                if (tourney.status === 'Upcoming') {
                    categorized.upcoming.push(tourney);
                } else if (tourney.status === 'Ongoing') {
                    categorized.ongoing.push(tourney);
                } else if (tourney.status === 'Completed') {
                    categorized.previous.push(tourney);
                }
            });

            renderTournaments(categorized.upcoming, upcomingList, 'No upcoming tournaments found.');
            renderTournaments(categorized.ongoing, ongoingList, 'No on-going tournaments right now.');
            renderTournaments(categorized.previous, previousList, 'No previous tournaments found.');

        } catch (error) {
            console.error('Error fetching tournaments:', error);
            setErrorState('Failed to load tournament data. Please try again later.');
        }
    };

    const renderTournaments = (list, container, emptyMessage) => {
        if (list.length === 0) {
            container.innerHTML = `<p class="text-gray-500 dark:text-gray-400">${emptyMessage}</p>`;
            return;
        }
        container.innerHTML = list.map(tourney => createTournamentCard(tourney)).join('');
    };

    const createTournamentCard = (tourney) => {
        const date = new Date(tourney.startDate).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        return `
            <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div class="flex-grow">
                    <h4 class="text-lg font-bold text-gray-900 dark:text-white">${tourney.name}</h4>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <span><i class="fas fa-calendar-alt mr-1.5"></i>${date}</span>
                        <span><i class="fas fa-map-marker-alt mr-1.5"></i>${tourney.location}</span>
                    </div>
                </div>
                <div class="mt-3 sm:mt-0 sm:ml-4 flex-shrink-0">
                    ${tourney.winner ? 
                        `<p class="text-sm text-gray-600 dark:text-gray-300"><i class="fas fa-trophy mr-1.5 text-yellow-500"></i>Winner: <strong>${tourney.winner}</strong></p>` : 
                        '<p class="text-sm text-gray-500 dark:text-gray-400">Winner not determined</p>'
                    }
                </div>
            </div>
        `;
    };

    const setLoadingState = () => {
        const loadingHTML = '<div class="text-center text-gray-500 dark:text-gray-400 p-4">Loading tournaments...</div>';
        upcomingList.innerHTML = loadingHTML;
        ongoingList.innerHTML = loadingHTML;
        previousList.innerHTML = loadingHTML;
    };
    
    const setErrorState = (message) => {
        const errorHTML = `<div class="text-center text-red-500 p-4">${message}</div>`;
        upcomingList.innerHTML = errorHTML;
        ongoingList.innerHTML = errorHTML;
        previousList.innerHTML = errorHTML;
    };

    document.getElementById('tournaments-tab').addEventListener('click', () => {
        if (!previousList.innerHTML.trim()) {
            loadTournaments();
        }
    });
});