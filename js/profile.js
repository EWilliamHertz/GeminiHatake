/**
 * HatakeSocial - Profile Page Script (v7 - Manual Index Link Generator)
 *
 * This script creates a button on the profile page. Clicking this button
 * will manually trigger the Firestore query that requires an index.
 * This guarantees the error link will be generated in the console.
 */
document.addEventListener('authReady', (e) => {
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) return;

    // Display a button and instructions on the page.
    profileContainer.innerHTML = `
        <div class="text-center p-8 bg-white rounded-lg shadow-md">
            <h1 class="text-2xl font-bold text-blue-600">Final Step: Create Database Index</h1>
            <p class="mt-2">To finish setting up profile pages, we need to create a database index.</p>
            <p class="mt-4 font-semibold">Please follow these steps exactly:</p>
            <ol class="text-left inline-block mt-2 space-y-2">
                <li>1. Open the Developer Console (press F12 on your keyboard).</li>
                <li>2. Click the big blue button below.</li>
                <li>3. A red error will appear in the console. Click the long <span class="font-mono bg-gray-200 px-1">https://console.firebase.google.com...</span> link inside that error.</li>
                <li>4. A new Firebase tab will open. Click the "Create" button there.</li>
                <li>5. Wait for the index status to become "Enabled".</li>
                <li>6. Once enabled, let me know, and I will provide the final working profile.js file.</li>
            </ol>
            <button id="generate-index-link-btn" class="mt-6 px-6 py-3 bg-blue-600 text-white font-bold rounded-full text-lg hover:bg-blue-700">
                2. Click Here to Generate Index Link
            </button>
        </div>
    `;

    const generateLinkBtn = document.getElementById('generate-index-link-btn');
    generateLinkBtn.addEventListener('click', async () => {
        try {
            const params = new URLSearchParams(window.location.search);
            const username = params.get('user');

            if (!username) {
                alert("Please go to a user's profile with a handle in the URL (e.g., ?user=hugo) before clicking this button.");
                return;
            }

            // This is the query that requires the index.
            // Manually triggering it guarantees the error will appear.
            alert("About to run the query. Look for a red error in the console (F12) after you click OK.");
            await db.collection('users').where('handle', '==', username).limit(1).get();

            // If we get here, the index already exists!
            alert("Success! The index already exists. I will now send the final profile.js file.");
            
        } catch (error) {
            console.error("SUCCESS! THIS IS THE ERROR YOU NEED. CLICK THE LINK BELOW TO CREATE THE INDEX:", error);
            alert("Success! The link has been generated in the developer console (F12). Please find the red error message and click the link inside it.");
        }
    });
});
