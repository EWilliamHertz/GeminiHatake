# fix_modals_and_buttons.py
import os
from bs4 import BeautifulSoup

# Standardized HTML for the modals
MODALS_HTML = """
    <div id="loginModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold">Login</h2>
                <button id="closeLoginModal" class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <form id="loginForm" class="mt-4 space-y-4">
                <input type="email" id="loginEmail" placeholder="Email" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" required>
                <input type="password" id="loginPassword" placeholder="Password" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" required>
                <p id="login-error-message" class="text-red-500 text-sm hidden"></p>
                <button type="submit" class="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700">Login</button>
                <button type="button" id="googleLoginButton" class="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-2 rounded-md border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center">
                    <img class="w-5 h-5 mr-2" src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google icon">
                    Sign in with Google
                </button>
            </form>
        </div>
    </div>
    <div id="registerModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold">Register</h2>
                <button id="closeRegisterModal" class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold">&times;</button>
            </div>
            <form id="registerForm" class="mt-4 space-y-4">
                 <input type="email" id="registerEmail" placeholder="Email" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" required>
                 <input type="password" id="registerPassword" placeholder="Password" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" required>
                 <input type="text" id="registerCity" placeholder="City" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                 <input type="text" id="registerCountry" placeholder="Country" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                 <input type="text" id="registerFavoriteTcg" placeholder="Favorite TCG" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                 <input type="text" id="registerReferrer" placeholder="Referrer (Optional)" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                 <p id="register-error-message" class="text-red-500 text-sm hidden"></p>
                 <button type="submit" class="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700">Register</button>
                 <button type="button" id="googleRegisterButton" class="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-2 rounded-md border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center">
                    <img class="w-5 h-5 mr-2" src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google icon">
                    Register with Google
                 </button>
            </form>
        </div>
    </div>
"""

# Standardized HTML for the logged-out buttons
LOGGED_OUT_BUTTONS_HTML = """
<div class="space-x-2">
    <button id="header-login-btn" class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Login</button>
    <button id="header-register-btn" class="px-4 py-2 bg-gray-600 text-white font-semibold rounded-full hover:bg-gray-700">Register</button>
</div>
"""

def process_html_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        soup = BeautifulSoup(content, 'html.parser')
        body = soup.find('body')
        if not body:
            print(f" - Skipping {file_path} (no body tag found).")
            return

        # --- Add Modals if they don't exist ---
        if not soup.find('div', id='loginModal'):
            body.append(BeautifulSoup(MODALS_HTML, 'html.parser'))
            print(f" - Added modals to {file_path}")

        # --- Fix Header Buttons ---
        user_actions = soup.find('div', id='user-actions')
        if user_actions:
            user_actions.clear()
            user_actions.append(BeautifulSoup(LOGGED_OUT_BUTTONS_HTML, 'html.parser'))
            print(f" - Fixed header buttons in {file_path}")
        
        # --- Save the updated file ---
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(str(soup.prettify()))

    except Exception as e:
        print(f"An error occurred while processing {file_path}: {e}")

def main():
    print("Starting process to add modals and fix login/register buttons...")
    for root, dirs, files in os.walk("."):
        if 'functions' in dirs:
            dirs.remove('functions')
        
        for file in files:
            if file.endswith(".html"):
                file_path = os.path.join(root, file)
                process_html_file(file_path)
    print("\nProcess completed.")

if __name__ == "__main__":
    main()
