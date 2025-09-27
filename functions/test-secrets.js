const functions = require("firebase-functions");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");

const secretClient = new SecretManagerServiceClient();

/**
 * A simple function to test secret access.
 */
exports.testSecretAccess = functions.https.onCall(async (data, context) => {
    const secretName = 'scrydex-api-key'; // The secret we want to test
    const secretResourceName = `projects/hatakesocial-88b5e/secrets/${secretName}/versions/latest`;

    try {
        console.log(`[Test Function] Attempting to access secret: ${secretResourceName}`);

        const [version] = await secretClient.accessSecretVersion({
            name: secretResourceName,
        });

        const payload = version.payload.data.toString();
        
        if (payload) {
            console.log(`[Test Function] SUCCESS! Secret payload retrieved.`);
            return { success: true, message: "Successfully accessed the secret!" };
        } else {
            console.log(`[Test Function] WARNING! Secret payload was empty.`);
            return { success: false, message: "Secret was accessed, but it is empty." };
        }

    } catch (error) {
        console.error(`[Test Function] FAILED to access secret. Error: ${error.message}`, error);
        throw new functions.https.HttpsError(
            'internal',
            `Failed to access secret. Error details: ${error.message}`
        );
    }
});