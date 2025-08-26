import os
import re

# This is the single, standardized header that will be applied to all pages.
# It contains one search bar and the #user-actions div that auth.js populates.
# The `auth.js` script handles showing either login/register buttons or the user's avatar.
STANDARDIZED_HEADER = r"""
        <header class="relative z-30 h-28 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div class="flex items-center">
                <button id="sidebar-toggle" class="lg:hidden mr-4 text-gray-600 dark:text-gray-300">
                    <i class="fas fa-bars text-xl"></i>
                </button>
                <div class="relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input type="text" id="main-search-bar" placeholder="Search..." class="w-full md:w-96 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <div id="main-search-results" class="absolute mt-2 w-full md:w-96 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-10 hidden"></div>
                </div>
            </div>
            <div id="user-actions" class="flex items-center space-x-5">
                </div>
        </header>
"""

# This is the HTML for the login and register modals.
# It will be appended to the end of each HTML file before the closing </body> tag.
# The provided auth.js script expects these modals to be present in the DOM.
MODALS_HTML = r"""
    <div id="loginModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center">
        <div class="modal-content w-full max-w-md bg-white dark:bg-gray-800 rounded-lg relative p-8">
            <button id="closeLoginModal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold">&times;</button>
            <h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">Login</h2>
            <form id="loginForm" class="space-y-4">
                <div>
                    <label for="loginEmail" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Email:</label>
                    <input type="email" id="loginEmail" class="input-style" placeholder="Enter your email" required>
                </div>
                <div>
                    <label for="loginPassword" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Password:</label>
                    <input type="password" id="loginPassword" class="input-style" placeholder="Enter your password" required>
                </div>
                <p id="login-error-message" class="text-red-500 text-sm hidden h-4"></p>
                <button type="submit" class="w-full btn-primary">Login</button>
            </form>
             <div class="separator">Or</div>
            <button type="button" id="googleLoginButton" class="w-full btn-secondary flex items-center justify-center">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" class="w-5 h-5 mr-2"> Sign in with Google
            </button>
        </div>
    </div>

    <div id="registerModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center">
        <div class="modal-content w-full max-w-md bg-white dark:bg-gray-800 rounded-lg relative p-8">
            <button id="closeRegisterModal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold">&times;</button>
            <h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">Register</h2>
            <form id="registerForm" class="space-y-4">
                <div>
                    <label for="registerEmail" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Email:</label>
                    <input type="email" id="registerEmail" class="input-style" placeholder="Enter your email" required>
                </div>
                <div>
                    <label for="registerPassword" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Password:</label>
                    <input type="password" id="registerPassword" class="input-style" placeholder="Minimum 6 characters" required>
                </div>
                <div>
                    <label for="registerCity" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">City:</label>
                    <input type="text" id="registerCity" class="input-style" placeholder="Your City">
                </div>
                <div>
                    <label for="registerCountry" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Country:</label>
                    <input type="text" id="registerCountry" class="input-style" placeholder="Your Country">
                </div>
                <div>
                    <label for="registerFavoriteTcg" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Favorite TCG:</label>
                    <input type="text" id="registerFavoriteTcg" class="input-style" placeholder="e.g., Magic: The Gathering">
                </div>
                <p id="register-error-message" class="text-red-500 text-sm hidden h-4"></p>
                <button type="submit" class="w-full btn-primary bg-green-600 hover:bg-green-700">Register</button>
            </form>
            <div class="separator">Or</div>
            <button type="button" id="googleRegisterButton" class="w-full btn-secondary flex items-center justify-center">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" class="w-5 h-5 mr-2"> Register with Google
            </button>
        </div>
    </div>
"""

def process_html_file(filepath):
    """Applies all fixes to a single HTML file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # 1. Find the main content wrapper to locate all headers.
        # This wrapper is consistent across the layout.
        wrapper_pattern = re.compile(r'<div id="main-content-wrapper".*?>\s*(.*?)\s*</main>', re.DOTALL)
        wrapper_match = re.search(wrapper_pattern, content)

        if not wrapper_match:
            print(f"  - No main content wrapper in {filepath}, skipping header replacement.")
            new_content = content
        else:
            wrapper_content = wrapper_match.group(1)
            
            # 2. Find all <header>...</header> blocks within the main wrapper.
            header_pattern = re.compile(r'<header.*?</header>', re.DOTALL)
            headers = header_pattern.findall(wrapper_content)
            
            # 3. Replace the first header and remove all subsequent ones.
            if headers:
                # Replace the first found header with the standardized one
                wrapper_content = header_pattern.sub(STANDARDIZED_HEADER, wrapper_content, 1)
                
                # To be safe, let's remove any that might linger if sub only did one.
                remaining_headers = header_pattern.findall(wrapper_content)
                for header in remaining_headers:
                    wrapper_content = wrapper_content.replace(header, '')

                # Reconstruct the full HTML content
                new_content = content.replace(wrapper_match.group(1), wrapper_content)
                print(f"  - Standardized header and removed {len(headers) - 1} duplicate(s) in {filepath}")
            else:
                new_content = content
                print(f"  - No header found inside wrapper in {filepath}")

        # 4. Add modals if they don't exist.
        if 'id="loginModal"' not in new_content:
            if '</body>' in new_content:
                new_content = new_content.replace('</body>', MODALS_HTML + '\n</body>')
                print(f"  - Added login/register modals to {filepath}")
            else:
                new_content += MODALS_HTML
                print(f"  - Appended login/register modals to {filepath} (no body tag found)")

        # Write the changes back to the file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
            
        return True

    except Exception as e:
        print(f"❌ Error processing {filepath}: {e}")
        return False

def main():
    """Main function to iterate through HTML files and fix them."""
    project_root = '.'
    files_processed = 0
    
    print("🚀 Starting script to fix search bars and login/register functionality...")
    print("-" * 60)

    for filename in os.listdir(project_root):
        if filename.endswith(".html"):
            filepath = os.path.join(project_root, filename)
            print(f"Processing: {filename}")
            if process_html_file(filepath):
                files_processed += 1

    print("-" * 60)
    print(f"✅ Process complete. Modified {files_processed} HTML files.")
    print("Summary of changes:")
    print("- Enforced a single, standardized header.")
    print("- Removed all duplicate search bars from main content areas.")
    print("- Added login and register modals to all pages for `auth.js` to use.")
    print("- The `auth.js` script will now correctly handle showing login/register buttons and their modal popups.")

if __name__ == "__main__":
    main()
