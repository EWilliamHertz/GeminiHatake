import os
from bs4 import BeautifulSoup

# The HTML for the modals, extracted from your my_collection.html
# The 'Referrer' input field has been removed from the register modal here.
LOGIN_MODAL_HTML = """
<!-- Login Modal -->
<div class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50" id="loginModal">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div class="flex justify-between items-center">
            <h2 class="text-xl font-bold">
                Login
            </h2>
            <button class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold" id="closeLoginModal">
                ×
            </button>
        </div>
        <form class="mt-4 space-y-4" id="loginForm">
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="loginEmail" placeholder="Email" required="" type="email"/>
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="loginPassword" placeholder="Password" required="" type="password"/>
            <p class="text-red-500 text-sm hidden" id="login-error-message">
            </p>
            <button class="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700" type="submit">
                Login
            </button>
            <button class="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-2 rounded-md border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center" id="googleLoginButton" type="button">
                <img alt="Google icon" class="w-5 h-5 mr-2" src="https://www.svgrepo.com/show/475656/google-color.svg"/>
                Sign in with Google
            </button>
        </form>
    </div>
</div>
"""

REGISTER_MODAL_HTML = """
<!-- Register Modal -->
<div class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50" id="registerModal">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div class="flex justify-between items-center">
            <h2 class="text-xl font-bold">
                Register
            </h2>
            <button class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold" id="closeRegisterModal">
                ×
            </button>
        </div>
        <form class="mt-4 space-y-4" id="registerForm">
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerEmail" placeholder="Email" required="" type="email"/>
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerPassword" placeholder="Password" required="" type="password"/>
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerCity" placeholder="City" type="text"/>
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerCountry" placeholder="Country" type="text"/>
            <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerFavoriteTcg" placeholder="Favorite TCG" type="text"/>
            <p class="text-red-500 text-sm hidden" id="register-error-message">
            </p>
            <button class="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700" type="submit">
                Register
            </button>
            <button class="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-2 rounded-md border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center" id="googleRegisterButton" type="button">
                <img alt="Google icon" class="w-5 h-5 mr-2" src="https://www.svgrepo.com/show/475656/google-color.svg"/>
                Register with Google
            </button>
        </form>
    </div>
</div>
"""

def find_html_files(directory):
    """Finds all HTML files in a given directory."""
    html_files = []
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".html"):
                html_files.append(os.path.join(root, file))
    return html_files

def process_html_file(file_path):
    """Ensures modals are present and removes the referrer field."""
    print(f"Processing {file_path}...")
    made_changes = False

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    soup = BeautifulSoup(content, 'html.parser')

    # --- 1. Remove Referrer Field ---
    referrer_input = soup.find('input', {'id': 'registerReferrer'})
    if referrer_input:
        # Assuming the input is wrapped in a div or some other container that should also be removed.
        # If it's just the input, use referrer_input.decompose()
        # This is safer as it removes the input and its direct parent if it's a simple wrapper.
        parent = referrer_input.parent
        parent.decompose()
        print(f"  - Removed referrer field from {file_path}")
        made_changes = True


    # --- 2. Check for and add Login Modal ---
    if not soup.find('div', {'id': 'loginModal'}):
        if soup.body:
            # Parse the modal HTML and append it to the body
            login_modal_soup = BeautifulSoup(LOGIN_MODAL_HTML, 'html.parser')
            soup.body.append(login_modal_soup)
            print(f"  - Added Login Modal to {file_path}")
            made_changes = True
        else:
            print(f"  - WARNING: No <body> tag found in {file_path}. Cannot add Login Modal.")


    # --- 3. Check for and add Register Modal ---
    if not soup.find('div', {'id': 'registerModal'}):
        if soup.body:
            register_modal_soup = BeautifulSoup(REGISTER_MODAL_HTML, 'html.parser')
            soup.body.append(register_modal_soup)
            print(f"  - Added Register Modal to {file_path}")
            made_changes = True
        else:
            print(f"  - WARNING: No <body> tag found in {file_path}. Cannot add Register Modal.")


    # --- 4. Write changes back to file ---
    if made_changes:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(str(soup))
        print(f"  - Saved changes to {file_path}")
    else:
        print("  - No changes needed.")


def main():
    """Main function to run the script."""
    public_directory = 'public'
    if not os.path.isdir(public_directory):
        print(f"Error: Directory '{public_directory}' not found.")
        return

    html_files = find_html_files(public_directory)
    if not html_files:
        print("No HTML files found to process.")
        return

    for file_path in html_files:
        process_html_file(file_path)

    print("\nScript finished.")

if __name__ == "__main__":
    main()
