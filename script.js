import os
import re

def normalize_auth_forms():
    """
    This script ensures all HTML files have a standardized, hidden login/register modal.
    It removes any existing modal or visible auth forms first, then adds the correct
    hidden modals before the closing </body> tag.
    """
    correct_modals_html = """
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

    # This pattern matches the visible form block which is the inner content of the modal
    visible_form_pattern = re.compile(
        r'<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">.*?(?:id="loginForm"|id="registerForm").*?</div>',
        re.DOTALL
    )

    for root, _, files in os.walk("."):
        for filename in files:
            if filename.endswith('.html'):
                filepath = os.path.join(root, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # --- Cleanup Phase ---
                    # 1. Remove any old modal structures
                    content = re.sub(r'<div id="loginModal".*?</div>', '', content, flags=re.DOTALL)
                    content = re.sub(r'<div id="registerModal".*?</div>', '', content, flags=re.DOTALL)

                    # 2. Remove any visible form blocks that were left over
                    content = visible_form_pattern.sub('', content)
                    
                    # --- Insertion Phase ---
                    # 3. Add the correct, standardized modals before the body closes
                    if '</body>' in content:
                        content = content.replace('</body>', correct_modals_html + '\n</body>')
                    else:
                        content += correct_modals_html # Fallback for incomplete HTML

                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Normalized auth forms in: {filepath}")

                except Exception as e:
                    print(f"Could not process {filepath}: {e}")

if __name__ == '__main__':
    normalize_auth_forms()
