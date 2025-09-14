import os
import glob
from bs4 import BeautifulSoup, Tag

# --- 1. DEFINE THE STANDARDIZED HTML BLOCKS ---

# This is the single, correct header that will be placed in every HTML file.
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
    </div>
</header>
"""

# Standard login modal.
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

# Standard register modal.
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
    Finds all .html files, replaces or adds a standard header,
    and ensures the standard login/register modals are present.
    """
    html_files = glob.glob('*.html')
    
    if not html_files:
        print("No HTML files found in the current directory.")
        return

    print(f"Found {len(html_files)} HTML files to process...")
    
    new_header_soup = BeautifulSoup(STANDARDIZED_HEADER_HTML, 'html.parser').header
    new_login_modal_soup = BeautifulSoup(LOGIN_MODAL_HTML, 'html.parser').div
    new_register_modal_soup = BeautifulSoup(REGISTER_MODAL_HTML, 'html.parser').div

    for file_path in html_files:
        print(f"Processing: {file_path}")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # Handle files that might be just fragments without full HTML structure
                if not content.strip().startswith('<'):
                     print(f"  - Skipping file {file_path} as it does not appear to be a valid HTML document.")
                     continue
                soup = BeautifulSoup(content, 'html.parser')

            # --- 2. UPDATE OR ADD THE HEADER ---
            existing_header = soup.find('header')
            if existing_header:
                existing_header.replace_with(new_header_soup)
                print(f"  - Replaced existing header.")
            else:
                # Find a suitable place to insert the new header
                insertion_point = soup.find('div', class_='flex-1') or soup.body
                if insertion_point:
                    insertion_point.insert(0, new_header_soup)
                    print(f"  - Added new header.")
                else:
                    print(f"  - Warning: Could not find a suitable insertion point for the header.")

            # --- 3. ENSURE MODALS ARE PRESENT AND CORRECT ---
            body_tag = soup.body
            if body_tag:
                # Remove any old versions to prevent duplicates and ensure freshness
                for modal_id in ['loginModal', 'registerModal']:
                    existing_modal = soup.find('div', id=modal_id)
                    if existing_modal:
                        existing_modal.decompose()
                
                # Append the new, standardized modals
                body_tag.append(new_login_modal_soup)
                body_tag.append(new_register_modal_soup)
                print(f"  - Ensured login/register modals are present.")
            else:
                print(f"  - Warning: No <body> tag found. Could not add modals.")

            # --- 4. WRITE THE CHANGES BACK ---
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(soup.prettify())

        except Exception as e:
            print(f"  - ERROR processing file: {e}")

if __name__ == "__main__":
    update_html_files()
    print("\nHTML structure update process finished.")
