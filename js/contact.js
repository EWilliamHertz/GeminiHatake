/**
 * HatakeSocial - Contact Page Script
 *
 * This script handles the logic for the contact.html page.
 * It prefills the form if the user is logged in and saves
 * submissions to a 'contacts' collection in Firestore.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const contactForm = document.getElementById('contact-form');
    
    // Exit if not on the contact page
    if (!contactForm) {
        return;
    }

    const nameInput = document.getElementById('contact-name');
    const emailInput = document.getElementById('contact-email');
    const subjectInput = document.getElementById('contact-subject');
    const messageInput = document.getElementById('contact-message');
    const submitButton = document.getElementById('submit-contact-form');
    const formStatusMessage = document.getElementById('form-status-message');

    // If a user is logged in, pre-fill their name and email
    if (user) {
        nameInput.value = user.displayName || '';
        emailInput.value = user.email || '';
    }

    // Handle form submission
    contactForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        // Disable the button to prevent multiple submissions
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
        formStatusMessage.textContent = '';
        formStatusMessage.classList.remove('text-green-600', 'text-red-600');

        // Get form data
        const formData = {
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            subject: subjectInput.value,
            message: messageInput.value.trim(),
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: user ? user.uid : 'guest', // Track if the message is from a logged-in user
            status: 'new' // To track if the message has been read/replied to
        };

        try {
            // Add the form data to the 'contacts' collection in Firestore
            await db.collection('contacts').add(formData);

            // Show success message
            formStatusMessage.textContent = "Thank you for your message! We'll get back to you soon.";
            formStatusMessage.classList.add('text-green-600', 'dark:text-green-400');
            
            // Reset the form
            contactForm.reset();

            // If the user was a guest, clear the fields
            if (!user) {
                nameInput.value = '';
                emailInput.value = '';
            }

        } catch (error) {
            console.error("Error submitting contact form:", error);
            // Show error message
            formStatusMessage.textContent = "Sorry, there was an error sending your message. Please try again later.";
            formStatusMessage.classList.add('text-red-600', 'dark:text-red-400');
        } finally {
            // Re-enable the button
            submitButton.disabled = false;
            submitButton.textContent = 'Send Message';
        }
    });
});
