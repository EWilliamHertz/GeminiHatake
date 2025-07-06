/**
 * HatakeSocial - Admin Dashboard Script (v2 - Report Management)
 *
 * This script handles all logic for the admin.html page.
 * - Verifies admin status.
 * - Provides tools to manage users.
 * - NEW: Fetches and displays reported posts from the 'reports' collection.
 * - NEW: Allows admins to dismiss reports or delete the offending post.
 */
document.addEventListener('authReady', async (e) => {
    const user = e.detail.user;
    const adminContainer = document.getElementById('admin-dashboard-container');
    const accessDeniedContainer = document.getElementById('admin-access-denied');
    const userTableBody = document.getElementById('user-management-table');
    const reportTableBody = document.getElementById('report-management-table'); // NEW

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

    // --- NEW: Function to load and display reports ---
    const loadReports = async () => {
        reportTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Loading reports...</td></tr>';
        const reportsSnapshot = await db.collection('reports').where('status', '==', 'pending').orderBy('timestamp', 'desc').get();
        
        if (reportsSnapshot.empty) {
            reportTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-500 dark:text-gray-400">No pending reports. Great job!</td></tr>';
            return;
        }

        reportTableBody.innerHTML = '';
        for (const doc of reportsSnapshot.docs) {
            const report = doc.data();
            const reportId = doc.id;

            // Fetch related data
            const reporterDoc = await db.collection('users').doc(report.reportedBy).get();
            const postDoc = await db.collection('posts').doc(report.postId).get();

            const reporterName = reporterDoc.exists ? reporterDoc.data().displayName : 'Unknown User';
            const postContent = postDoc.exists ? postDoc.data().content.substring(0, 100) + '...' : '[Post Deleted]';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${reporterName}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <p class="text-sm font-semibold text-gray-900 dark:text-white">${report.reason}</p>
                    <p class="text-sm text-gray-500">${report.details || 'No details provided.'}</p>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${postContent}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button data-report-id="${reportId}" class="dismiss-report-btn text-green-600 hover:text-green-900">Dismiss</button>
                    ${postDoc.exists ? `<button data-report-id="${reportId}" data-post-id="${report.postId}" class="delete-post-btn text-red-600 hover:text-red-900">Delete Post</button>` : ''}
                </td>
            `;
            reportTableBody.appendChild(row);
        }
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

    // --- NEW: Event listener for report actions ---
    reportTableBody.addEventListener('click', async (e) => {
        const dismissBtn = e.target.closest('.dismiss-report-btn');
        const deleteBtn = e.target.closest('.delete-post-btn');

        if (dismissBtn) {
            const reportId = dismissBtn.dataset.reportId;
            if (confirm("Are you sure you want to dismiss this report?")) {
                await db.collection('reports').doc(reportId).update({ status: 'dismissed' });
                loadReports();
            }
        }

        if (deleteBtn) {
            const reportId = deleteBtn.dataset.reportId;
            const postId = deleteBtn.dataset.postId;
            if (confirm("Are you sure you want to DELETE the post and dismiss the report? This cannot be undone.")) {
                const postRef = db.collection('posts').doc(postId);
                const reportRef = db.collection('reports').doc(reportId);
                
                const batch = db.batch();
                batch.delete(postRef);
                batch.update(reportRef, { status: 'resolved_deleted' });
                
                await batch.commit();
                loadReports();
            }
        }
    });

    // --- Initial Load ---
    loadUsers();
    loadReports(); // NEW
});
