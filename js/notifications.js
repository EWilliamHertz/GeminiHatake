/**
 * HatakeSocial - Real-Time Notification System
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer || !user) return;

    const bellBtn = document.getElementById('notification-bell-btn');
    const countBadge = document.getElementById('notification-count');
    const dropdown = document.getElementById('notification-dropdown');
    const listEl = document.getElementById('notification-list');

    let unreadCount = 0;
    let notificationListener = null;

    const updateBadge = () => {
        if (unreadCount > 0) {
            countBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            countBadge.classList.remove('hidden');
        } else {
            countBadge.classList.add('hidden');
        }
    };

    const listenForNotifications = () => {
        if (notificationListener) notificationListener(); // Unsubscribe from previous listener

        const notificationsRef = db.collection('users').doc(user.uid).collection('notifications')
                                   .orderBy('timestamp', 'desc')
                                   .limit(20);

        notificationListener = notificationsRef.onSnapshot(snapshot => {
            unreadCount = 0;
            listEl.innerHTML = '';

            if (snapshot.empty) {
                listEl.innerHTML = '<p class="p-4 text-sm text-center text-gray-500 dark:text-gray-400">No new notifications.</p>';
                updateBadge();
                return;
            }

            snapshot.forEach(doc => {
                const notif = doc.data();
                if (!notif.isRead) {
                    unreadCount++;
                }

                const notifEl = document.createElement('a');
                notifEl.href = notif.link || '#';
                notifEl.className = `block p-3 border-b dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-900/50' : ''}`;
                notifEl.innerHTML = `
                    <p class="text-sm text-gray-800 dark:text-gray-200">${notif.message}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${new Date(notif.timestamp.toDate()).toLocaleString()}</p>
                `;
                listEl.appendChild(notifEl);
            });
            updateBadge();
        });
    };

    const markNotificationsAsRead = () => {
        const batch = db.batch();
        const notificationsRef = db.collection('users').doc(user.uid).collection('notifications');
        
        db.collection('users').doc(user.uid).collection('notifications')
          .where('isRead', '==', false).get().then(snapshot => {
            if (snapshot.empty) return;
            snapshot.forEach(doc => {
                batch.update(doc.ref, { isRead: true });
            });
            batch.commit();
          });
    };

    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            // Mark as read after a short delay to allow UI to update
            setTimeout(markNotificationsAsRead, 2000);
        }
    });

    // Close dropdown if clicking outside
    document.addEventListener('click', (e) => {
        if (!notificationContainer.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    listenForNotifications();
});
