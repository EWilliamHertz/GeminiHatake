import os
import re

def update_html_files_for_firebase_hosting():
    """
    This script updates all HTML files in the current directory to use
    Firebase Hosting's reserved URLs for the Firebase SDKs.
    """
    # Note: Using the compat libraries to minimize code changes in the JS files
    new_firebase_scripts = """
  <script src="/__/firebase/9.6.1/firebase-app-compat.js"></script>
  <script src="/__/firebase/9.6.1/firebase-auth-compat.js"></script>
  <script src="/__/firebase/9.6.1/firebase-firestore-compat.js"></script>
  <script src="/__/firebase/9.6.1/firebase-storage-compat.js"></script>
  <script src="/__/firebase/9.6.1/firebase-functions-compat.js"></script>
  <script src="/__/firebase/init.js"></script>
"""

    # Regex to find the old Firebase script block
    firebase_script_pattern = re.compile(
        r'<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>.*?<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-functions.js"></script>',
        re.DOTALL
    )

    for filename in os.listdir('.'):
        if filename.endswith('.html'):
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Replace the old Firebase script block with the new one
                content, replacements = firebase_script_pattern.subn(new_firebase_scripts, content)

                if replacements > 0:
                    with open(filename, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Updated Firebase scripts in {filename}")
                else:
                    print(f"No Firebase script block found to replace in {filename}. You may need to add the scripts manually.")

            except Exception as e:
                print(f"Could not process {filename}: {e}")

if __name__ == '__main__':
    update_html_files_for_firebase_hosting()
