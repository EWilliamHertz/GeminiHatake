/**
 * HatakeSocial - Profile Page Script (v6 - Index Link Generator)
 *
 * This script is designed to intentionally trigger a Firestore error
 * in the developer console. That error will contain a link that can be
 * clicked to automatically create the required database index.
 */
document.addEventListener('authReady', (e) => {
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) return;

    const setupProfilePage = async () => {
        try {
            const params = new URLSearchParams(window.location.search);
            const username = params.get('user');

            // This is the query that will fail and generate the link in the console.
            // It will only run if there is a 'user' parameter in the URL.
            if (username) {
                console.log(`Attempting to query for user with handle: ${username}. This will fail if the index is missing, which is what we want.`);
                await db.collection('users').where('handle', '==', username).limit(1).get();
            } else {
                 profileContainer.innerHTML = `<div class="text-center p-8">
                    <h1 class="text-2xl font-bold">Ready to Generate Index</h1>
                    <p class="mt-2">Please go to a user's profile page (e.g., by adding <span class="font-mono bg-gray-200 px-1">?user=hugo</span> to the URL) to generate the index link.</p>
                </div>`;
                return;
            }
            
            // If the code reaches here, it means the index already exists.
            profileContainer.innerHTML = `<div class="text-center p-8">
                <h1 class="text-2xl font-bold text-green-600">Success!</h1>
                <p class="mt-2">The database index seems to exist. Please replace this temporary script with the final version now.</p>
            </div>`;

        } catch (error) {
            // This is the expected outcome if the index is missing.
            console.error("THIS IS THE EXPECTED ERROR. CLICK THE LINK IN THIS ERROR MESSAGE TO CREATE THE INDEX:", error);
            profileContainer.innerHTML = `<div class="text-center p-8">
                <h1 class="text-2xl font-bold text-red-600">Action Required</h1>
                <p class="mt-2">The database needs a one-time setup to show this page.</p>
                <p class="mt-4 font-semibold">Please follow these steps:</p>
                <ol class="text-left inline-block mt-2 space-y-1">
                    <li>1. Open the Developer Console (press F12).</li>
                    <li>2. Find the red error message that starts with "THIS IS THE EXPECTED ERROR".</li>
                    <li>3. Click the long <span class="font-mono bg-gray-200 px-1">https://console.firebase.google.com...</span> link inside that error message.</li>
                    <li>4. A new tab will open. Click the "Create" button there.</li>
                    <li>5. Wait for the index to build (status becomes "Enabled"), then proceed to Step 2 below.</li>
                </ol>
            </div>`;
        }
    };
    
    setupProfilePage();
});
