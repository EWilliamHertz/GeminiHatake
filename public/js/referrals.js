/**
 * HatakeSocial - Referrals Page Script
 *
 * This script handles all logic for the referrals.html page.
 * - Checks if a user is logged in before proceeding.
 * - Fetches the logged-in user's referral statistics (total referrals, discount).
 * - Queries and displays a list of all users they have referred, along with their status.
 * - Populates the referral link and handles the copy-to-clipboard functionality.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const referralsListContainer = document.getElementById('referrals-list-container');

    if (!currentUser) {
        // If no user is logged in, show a message and stop.
        document.querySelector('main .max-w-4xl').innerHTML = `
            <div class="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <h1 class="text-2xl font-bold text-gray-800 dark:text-white">Access Denied</h1>
                <p class="mt-2 text-gray-600 dark:text-gray-400">Please log in to view your referrals.</p>
            </div>
        `;
        return;
    }

    const loadReferralData = async () => {
        try {
            // --- 1. Populate Stats and Referral Link ---
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            const userData = userDoc.data();

            document.getElementById('total-referrals-stat').textContent = userData.referralCount || 0;
            document.getElementById('current-discount-stat').textContent = `${userData.shopDiscountPercent || 0}%`;
            
            const referralLinkInput = document.getElementById('referral-link-input');
            const copyReferralBtn = document.getElementById('copy-referral-link-btn');
            const copyFeedback = document.getElementById('copy-feedback');
            
            const referralLink = `${window.location.origin}/index.html?ref=${currentUser.uid}`;
            referralLinkInput.value = referralLink;

            copyReferralBtn.addEventListener('click', () => {
                referralLinkInput.select();
                document.execCommand('copy');
                copyFeedback.classList.remove('hidden');
                setTimeout(() => copyFeedback.classList.add('hidden'), 2000);
            });

            // --- 2. Fetch and Display Referred Users ---
            const referralsSnapshot = await db.collection('users').doc(currentUser.uid).collection('referrals').orderBy('referredAt', 'desc').get();

            if (referralsSnapshot.empty) {
                referralsListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">You haven\'t referred anyone yet. Share your link to get started!</p>';
                document.getElementById('completed-referrals-stat').textContent = '0';
                return;
            }

            let completedCount = 0;
            let listHTML = '<ul class="divide-y divide-gray-200 dark:divide-gray-700">';
            
            for (const doc of referralsSnapshot.docs) {
                const referral = doc.data();
                
                // We need to fetch the referred user's main document to check their verification status
                const referredUserDoc = await db.collection('users').doc(referral.userId).get();
                const referredUserData = referredUserDoc.exists ? referredUserDoc.data() : {};

                let statusBadge = '';
                // Logic to determine status. For now, we assume 'isVerified' field exists.
                // This would be set to true by a separate process (e.g., a Cloud Function after phone verification).
                if (referredUserData.isVerified) {
                    statusBadge = '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">Completed</span>';
                    completedCount++;
                } else {
                    statusBadge = '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">Pending Verification</span>';
                }

                listHTML += `
                    <li class="p-4 flex justify-between items-center">
                        <div>
                            <p class="font-semibold text-gray-800 dark:text-white">${referral.displayName}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">@${referral.handle}</p>
                            <p class="text-xs text-gray-400 mt-1">Referred on: ${new Date(referral.referredAt.toDate()).toLocaleDateString()}</p>
                        </div>
                        <div>
                            ${statusBadge}
                        </div>
                    </li>
                `;
            }
            listHTML += '</ul>';
            
            referralsListContainer.innerHTML = listHTML;
            document.getElementById('completed-referrals-stat').textContent = completedCount;

        } catch (error) {
            console.error("Error loading referral data:", error);
            referralsListContainer.innerHTML = `<p class="text-center text-red-500 p-8">Error: Could not load your referral data. Please try again later.</p>`;
        }
    };

    loadReferralData();
});
