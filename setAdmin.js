const admin = require('firebase-admin');

// This looks for the key file in the same directory.
// Make sure you have uploaded hatakesocial-key.json to Cloud Shell.
const serviceAccount = require('./hatakesocial-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// -------------------------------------------------------------------
// IMPORTANT: Change this email to the user you want to make an admin.
const userEmail = 'ewilliamhe@gmail.com'; 
// -------------------------------------------------------------------

async function grantAdminRole() {
  if (userEmail === 'YOUR_EMAIL_HERE@example.com') {
    console.error('Error: Please open setAdmin.js and replace "YOUR_EMAIL_HERE@example.com" with the email address of the user you want to make an admin.');
    process.exit(1);
  }

  try {
    const user = await admin.auth().getUserByEmail(userEmail);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    console.log(`\n✅ Success! User "${userEmail}" has been granted admin privileges.`);
    console.log(`\nNext steps:`);
    console.log(`1. Go back to your website.`);
    console.log(`2. Log out completely.`);
    console.log(`3. Log back in. Your new admin role will now be active.`);
    process.exit(0);

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`Error: User with email "${userEmail}" not found in Firebase Authentication.`);
    } else {
      console.error('An unexpected error occurred:', error.message);
    }
    process.exit(1);
  }
}

grantAdminRole();