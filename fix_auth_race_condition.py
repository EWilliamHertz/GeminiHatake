import os

# A list of JavaScript files that need to wait for the user's authentication status to be confirmed.
files_to_modify = [
    'public/js/admin.js',
    'public/js/articles.js',
    'public/js/profile.js',
    'public/js/settings.js',
    'public/js/trades.js',
    'public/js/shop.js',
    'public/js/collection.js',
    'public/js/notifications.js',
    'public/js/messages.js',
    'public/js/deck.js',
    'public/js/events.js',
    'public/js/community.js',
    'public/js/referrals.js',
    'public/js/marketplace.js'
]

def wrap_script_in_auth_listener(file_path):
    """
    Wraps the entire content of a JS file in a 'authReady' event listener
    to prevent it from running before Firebase Auth has been initialized.
    """
    if not os.path.exists(file_path):
        print(f"Skipping: File not found at '{file_path}'")
        return

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read().strip()

        # Don't wrap a file that's already been wrapped or is empty
        if not original_content or "document.addEventListener('authReady'" in original_content:
            print(f"Skipping: '{os.path.basename(file_path)}' is empty or already wrapped.")
            return

        # Indent the original code to fit nicely inside the new listener
        indented_content = "\\n".join(["    " + line for line in original_content.split('\\n')])

        # Create the new content with the wrapper
        wrapped_content = f"""document.addEventListener('authReady', ({{ detail: {{ user }} }}) => {{
    console.log("Auth is ready for {os.path.basename(file_path)}");

    // Original script content starts here
{indented_content}
    // Original script content ends here
}});
"""

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(wrapped_content)

        print(f"Successfully wrapped '{os.path.basename(file_path)}' in an auth listener.")

    except Exception as e:
        print(f"Error processing {file_path}: {e}")

def main():
    print("Starting script to fix authentication race conditions...")
    print("This will ensure page-specific scripts wait for login confirmation.")
    
    for path in files_to_modify:
        wrap_script_in_auth_listener(path)
    
    print("\\nProcess complete. The redirection issue should now be resolved.")
    print("Clear your browser cache before testing.")

if __name__ == "__main__":
    main()
