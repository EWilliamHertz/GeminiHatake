/**
 * HatakeSocial - Admin Dashboard Script
 *
 * This script handles all logic for the admin.html page.
 * It verifies admin status and provides tools to manage users.
 */
window.HatakeSocial.onAuthReady((user) => {    const user = e.detail.user;
    const adminContainer = document.getElementById('admin-dashboard-container');
    const accessDeniedContainer = document.getElementById('admin-access-denied');
    const userTableBody = document.getElementById('user-management-table');

    if (!user) {
        accessDeniedContainer.classList.remove('hidden');
        return;
    }

    // --- Verify Admin Status ---
    const userDoc = await db.collection('users').doc(user.uid).get();
    const isAdmin = userDoc.exists && userDoc.data().isAdmin === true;

    if (!isAdmin) {
        accessDeniedContainer.classList.remove('hidden');
        return;
    }

    // If user is an admin, show the dashboard
    adminContainer.classList.remove('hidden');

    // --- Functions ---
    const loadUsers = async () => {
        userTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Loading users...</td></tr>';
        const usersSnapshot = await db.collection('users').get();
        userTableBody.innerHTML = '';

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const userId = doc.id;
            const userIsAdmin = userData.isAdmin === true;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <img class="h-10 w-10 rounded-full object-cover" src="${userData.photoURL || 'https://placehold.co/40x40'}" alt="">
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-white">${userData.displayName}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">@${userData.handle}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${userData.email}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${userIsAdmin ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        ${userIsAdmin ? 'Admin' : 'User'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button data-uid="${userId}" data-is-admin="${userIsAdmin}" class="toggle-admin-btn text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200">
                        ${userIsAdmin ? 'Revoke Admin' : 'Make Admin'}
                    </button>
                </td>
            `;
            userTableBody.appendChild(row);
        });
    };

    // --- Event Listeners ---
    userTableBody.addEventListener('click', async (e) => {
        if (e.target.classList.contains('toggle-admin-btn')) {
            const button = e.target;
            const userIdToUpdate = button.dataset.uid;
            const currentIsAdmin = button.dataset.isAdmin === 'true';
            
            if (userIdToUpdate === user.uid) {
                alert("You cannot change your own admin status.");
                return;
            }

            const action = currentIsAdmin ? 'revoke admin status from' : 'make';
            if (confirm(`Are you sure you want to ${action} this user?`)) {
                try {
                    await db.collection('users').doc(userIdToUpdate).update({
                        isAdmin: !currentIsAdmin
                    });
                    alert('User role updated successfully.');
                    loadUsers(); // Refresh the list
                } catch (error) {
                    console.error("Error updating user role:", error);
                    alert("Failed to update user role.");
                }
            }
        }
    });

    // --- Initial Load ---
    loadUsers();
});
