import os
import glob
from bs4 import BeautifulSoup

# --- 1. DEFINE THE STANDARDIZED HTML BLOCKS ---

# This is the single, correct header that will be placed in every HTML file.
# It contains the search bar and the #user-actions div that auth.js needs.
STANDARDIZED_HEADER_HTML = """
<header class="h-28 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
    <div class="flex items-center">
        <button class="lg:hidden mr-4 text-gray-600 dark:text-gray-300" id="sidebar-toggle">
            <i class="fas fa-bars text-xl"></i>
        </button>
        <div class="relative">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input class="w-full md:w-96 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" id="main-search-bar" placeholder="Search for cards, users, or articles..." type="text"/>
        </div>
    </div>
    <div class="flex items-center space-x-5" id="user-actions">
        <!-- This container is dynamically filled by auth.js -->
        <!-- It will show Login/Register buttons or user icons (cart, bell, avatar) -->
    </div>
</header>
"""

# This is the standard login modal.
LOGIN_MODAL_HTML = """
<div class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50" id="loginModal">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div class="flex justify-between items-center">
            <h2 class="text-xl font-bold">Login</h2>
            <button class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold" id="closeLoginModal">&times;</button>
        </div>
        <form class="mt-4 space-y-4" id="loginForm">
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="loginEmail" placeholder="Email" required="" type="email"/>
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="loginPassword" placeholder="Password" required="" type="password"/>
            <p class="text-red-500 text-sm hidden" id="login-error-message"></p>
            <button class="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700" type="submit">Login</button>
            <button class="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-2 rounded-md border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center" id="googleLoginButton" type="button">
                <img alt="Google icon" class="w-5 h-5 mr-2" src="https://www.svgrepo.com/show/475656/google-color.svg"/> Sign in with Google
            </button>
        </form>
    </div>
</div>
"""

# This is the standard register modal.
REGISTER_MODAL_HTML = """
<div class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50" id="registerModal">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div class="flex justify-between items-center">
            <h2 class="text-xl font-bold">Register</h2>
            <button class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold" id="closeRegisterModal">&times;</button>
        </div>
        <form class="mt-4 space-y-4" id="registerForm">
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerEmail" placeholder="Email" required="" type="email"/>
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerPassword" placeholder="Password" required="" type="password"/>
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerCity" placeholder="City" type="text"/>
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerCountry" placeholder="Country" type="text"/>
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerFavoriteTcg" placeholder="Favorite TCG" type="text"/>
            <p class="text-red-500 text-sm hidden" id="register-error-message"></p>
            <button class="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700" type="submit">Register</button>
            <button class="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-2 rounded-md border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center" id="googleRegisterButton" type="button">
                <img alt="Google icon" class="w-5 h-5 mr-2" src="https://www.svgrepo.com/show/475656/google-color.svg"/> Register with Google
            </button>
        </form>
    </div>
</div>
"""

def update_html_files():
    """
    Finds all .html files in the current directory, replaces their <header>,
    and ensures the standard login/register modals are present.
    """
    html_files = glob.glob('*.html')
    
    if not html_files:
        print("No HTML files found in the current directory.")
        return

    print(f"Found {len(html_files)} HTML files to process...")
    
    # Create BeautifulSoup objects from the standard HTML strings for easy insertion
    new_header_soup = BeautifulSoup(STANDARDIZED_HEADER_HTML, 'html.parser')
    new_login_modal_soup = BeautifulSoup(LOGIN_MODAL_HTML, 'html.parser')
    new_register_modal_soup = BeautifulSoup(REGISTER_MODAL_HTML, 'html.parser')

    for file_path in html_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                soup = BeautifulSoup(f, 'html.parser')

            # --- 2. UPDATE THE HEADER ---
            existing_header = soup.find('header')
            if existing_header:
                # Replace the old header with the new, standardized one
                existing_header.replace_with(new_header_soup)
                print(f"  - Updated header in: {file_path}")
            else:
                print(f"  - Warning: No <header> tag found in {file_path}. Skipping header replacement.")

            # --- 3. UPDATE THE MODALS ---
            body_tag = soup.body
            if body_tag:
                # Remove any old versions of the modals to prevent duplicates
                for modal_id in ['loginModal', 'registerModal']:
                    existing_modal = soup.find('div', id=modal_id)
                    if existing_modal:
                        existing_modal.decompose()
                
                # Append the new, standardized modals to the end of the body
                body_tag.append(new_login_modal_soup)
                body_tag.append(new_register_modal_soup)
                print(f"  - Ensured login/register modals are present in: {file_path}")
            else:
                print(f"  - Warning: No <body> tag found in {file_path}. Could not add modals.")

            # --- 4. WRITE THE CHANGES BACK TO THE FILE ---
            with open(file_path, 'w', encoding='utf-8') as f:
                # Use prettify() to maintain nice formatting
                f.write(soup.prettify())

        except Exception as e:
            print(f"  - Error processing {file_path}: {e}")

if __name__ == "__main__":
    update_html_files()
    print("\nHTML structure update process finished.")
    print("All pages should now have the correct header and modals.")
