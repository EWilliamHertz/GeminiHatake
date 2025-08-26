# add_modal.py
import os
from bs4 import BeautifulSoup

# The HTML block for the modal
modal_html = """
<div id="authModal" class="modal">
    <div class="modal-content">
        <span class="close-button">&times;</span>
        <div id="login-form-modal" class="auth-form">
            <h2>Login</h2>
            <form>
                <input type="email" id="loginEmail" placeholder="Email" required/>
                <input type="password" id="loginPassword" placeholder="Password" required/>
                <button type="button" id="loginUser">Login</button>
            </form>
        </div>
        <div id="register-form-modal" class="auth-form" style="display:none;">
            <h2>Register</h2>
            <form>
                <input type="text" id="registerUsername" placeholder="Username" required/>
                <input type="email" id="registerEmail" placeholder="Email" required/>
                <input type="password" id="registerPassword" placeholder="Password" required/>
                <button type="button" id="registerUser">Register</button>
            </form>
        </div>
        <div class="modal-switch">
            <p id="switchToRegister">Don't have an account? <a href="#">Register</a></p>
            <p id="switchToLogin" style="display:none;">Already have an account? <a href="#">Login</a></p>
        </div>
    </div>
</div>
"""

def add_modal_to_file(file_path):
    """
    Opens an HTML file, adds the auth modal HTML just before the closing
    </body> tag, and saves the modified file.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as html_file:
            content = html_file.read()

        soup = BeautifulSoup(content, 'html.parser')

        # Check if the modal already exists to avoid duplicates
        if soup.find('div', id='authModal'):
            print(f"Modal already exists in: {file_path}. Skipping.")
            return
            
        # Find the body tag and append the modal
        body = soup.find('body')
        if body:
            print(f"Adding auth modal to: {file_path}")
            body.append(BeautifulSoup(modal_html, 'html.parser'))
            
            with open(file_path, 'w', encoding='utf-8') as new_html_file:
                new_html_file.write(str(soup.prettify()))
        else:
            print(f"Could not find <body> tag in: {file_path}")

    except Exception as e:
        print(f"An error occurred while processing {file_path}: {e}")

def main():
    """
    Scans the current directory for all .html files and runs the
    modal adding function on each one.
    """
    print("Starting to add the authentication modal to HTML files...")
    for root, dirs, files in os.walk("."):
        for file in files:
            if file.endswith(".html"):
                file_path = os.path.join(root, file)
                add_modal_to_file(file_path)
    print("Process completed.")

if __name__ == "__main__":
    main()
