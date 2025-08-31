import os
import re

def fix_auth_js():
    file_path = 'public/js/auth.js'
    print(f"--- Processing {file_path} ---")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # --- Change 1: Add the new page protection function at the end of the file ---
        handle_admin_function = """
function handleAdminAccess(isAdmin) {
    const currentPage = window.location.pathname.split('/').pop();

    // Redirect non-admins from protected pages
    if ((currentPage === 'admin.html' || currentPage === 'create-article.html') && !isAdmin) {
        console.log('User is not an admin. Redirecting to home.');
        window.location.href = 'index.html';
    }

    // Show/hide the "Write New Post" button on the articles page
    const writeArticleBtn = document.getElementById('write-new-article-btn');
    if (writeArticleBtn) {
        if (isAdmin) {
            writeArticleBtn.classList.remove('hidden');
        } else {
            writeArticleBtn.classList.add('hidden');
        }
    }
}
"""
        # Add the function only if it doesn't already exist
        if 'function handleAdminAccess' not in content:
            content += "\n\n" + handle_admin_function
            print("  -> Added handleAdminAccess function.")

        # --- Change 2: Surgically insert the token check and comment out the old check ---
        
        # This is the line where the original code starts fetching user data
        original_try_line = "const userDoc = await db.collection('users').doc(user.uid).get();"
        
        # This is the new logic we need to insert
        new_logic_insertion = """
            const idTokenResult = await user.getIdTokenResult(true);
            const isAdmin = idTokenResult.claims.isAdmin === true;
            
            // Centralized access control check
            handleAdminAccess(isAdmin);
            
            """
        
        # Check if the fix has already been applied
        if "const idTokenResult = await user.getIdTokenResult(true);" not in content:
            # Insert our new logic right before the original line
            target_to_replace = f"try {{\n                {original_try_line}"
            replacement = f"try {{\n                {new_logic_insertion}{original_try_line}"

            if target_to_replace in content:
                content = content.replace(target_to_replace, replacement, 1)
                print("  -> Inserted admin token check logic.")
                
                # Now comment out the old, incorrect check
                content = content.replace(
                    "const isAdmin = userData.isAdmin === true;",
                    "// const isAdmin = userData.isAdmin === true; // This is now handled by the token check above"
                )
                print("  -> Commented out old isAdmin check from Firestore.")
            else:
                 print("  -> Could not find the target 'try {' block to insert code. No changes made.")

        # --- Change 3: Add handleAdminAccess check for the logged-out state ---
        logged_out_target = "if (unsubscribeNotifications) unsubscribeNotifications();"
        logged_out_replacement = f"{logged_out_target}\n            handleAdminAccess(false); // No user, so not an admin"
        
        if logged_out_target in content and logged_out_replacement not in content:
             content = content.replace(logged_out_target, logged_out_replacement, 1)
             print("  -> Added admin check for logged-out state.")

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"Successfully modified {file_path}.")
        return True

    except Exception as e:
        print(f"An error occurred while processing {file_path}: {e}")
        return False

def main():
    if fix_auth_js():
        print("\nAdmin authentication logic has been fixed in auth.js.")
        print("Please clear your browser cache and test the admin login again.")
    else:
        print("\nCould not apply fixes. No files were changed.")

if __name__ == "__main__":
    main()
