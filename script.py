import os
import re

def update_html_files():
    """
    This script updates all HTML files in the current directory by replacing the header
    and adding or replacing the login and register modals.
    """
    new_header = """
            <header class="h-28 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div class="flex items-center">
                    <button id="sidebar-toggle" class="lg:hidden mr-4 text-gray-600 dark:text-gray-300">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                    <div class="relative">
                        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input type="text" id="main-search-bar" placeholder="Search for cards, users, or articles..." class="w-full md:w-96 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <div id="main-search-results" class="absolute mt-2 w-full md:w-96 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-10 hidden"></div>
                    </div>
                </div>

                <div id="user-actions" class="flex items-center space-x-5">
                    </div>
            </header>
    """

    modals = """
    <div id="loginModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold">Login</h2>
                <button id="closeLoginModal" class="text-gray-500 hover:text-gray-800 dark:hover:text-white">&times;</button>
            </div>
            <form id="loginForm" class="mt-4 space-y-4">
                <input type="email" id="loginEmail" placeholder="Email" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                <input type="password" id="loginPassword" placeholder="Password" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                <p id="login-error-message" class="text-red-500 text-sm hidden"></p>
                <button type="submit" class="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700">Login</button>
                <button type="button" id="googleLoginButton" class="w-full bg-red-600 text-white font-semibold py-2 rounded-md hover:bg-red-700">Login with Google</button>
            </form>
        </div>
    </div>
     <div id="registerModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold">Register</h2>
                <button id="closeRegisterModal" class="text-gray-500 hover:text-gray-800 dark:hover:text-white">&times;</button>
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
                 <button type="button" id="googleRegisterButton" class="w-full bg-red-600 text-white font-semibold py-2 rounded-md hover:bg-red-700">Register with Google</button>
            </form>
        </div>
    </div>
    """

    for filename in os.listdir('.'):
        if filename.endswith('.html'):
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Replace header
                content = re.sub(r'<header.*?</header>', new_header, content, flags=re.DOTALL)

                # Check if modals exist
                if re.search(r'<div id="loginModal".*?</div>.*?<div id="registerModal".*?</div>', content, re.DOTALL):
                    content = re.sub(r'<div id="loginModal".*?</div>.*?<div id="registerModal".*?</div>', modals, content, flags=re.DOTALL)
                else:
                    # Add modals before closing body tag
                    content = content.replace('</body>', modals + '\n</body>')

                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Updated {filename}")

            except Exception as e:
                print(f"Could not process {filename}: {e}")

if __name__ == '__main__':
    update_html_files()
