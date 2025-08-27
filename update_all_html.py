import os
import re

def update_all_html_files_for_firebase_hosting():
    """
    This script intelligently updates all HTML files in the current
    directory to use Firebase Hosting's reserved URLs.
    """
    new_firebase_scripts = """
  <script src="/__/firebase/9.6.1/firebase-app-compat.js"></script>
  <script src="/__/firebase/9.6.1/firebase-auth-compat.js"></script>
  <script src="/__/firebase/9.6.1/firebase-firestore-compat.js"></script>
  <script src="/__/firebase/9.6.1/firebase-storage-compat.js"></script>
  <script src="/__/firebase/9.6.1/firebase-functions-compat.js"></script>
  <script src="/__/firebase/init.js"></script>
"""

    # Regex to find the old Firebase script block
    old_firebase_script_pattern = re.compile(
        r'<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>.*?<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-functions.js"></script>',
        re.DOTALL
    )

    for filename in os.listdir('.'):
        if filename.endswith('.html'):
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    content = f.read()

                # 1. Check if the new scripts are already there
                if '/__/firebase/init.js' in content:
                    print(f"Skipping {filename}: Already has the new Firebase scripts.")
                    continue

                # 2. Try to replace the old scripts
                content, replacements = old_firebase_script_pattern.subn(new_firebase_scripts, content)

                if replacements > 0:
                    with open(filename, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Updated Firebase scripts in {filename}")
                else:
                    # 3. If no old scripts were found, add the new scripts before </body>
                    if '</body>' in content:
                        content = content.replace('</body>', f'{new_firebase_scripts}\n</body>')
                        with open(filename, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"Added Firebase scripts to {filename}")
                    else:
                        print(f"Could not find </body> tag in {filename}. Please add the scripts manually.")

            except Exception as e:
                print(f"Could not process {filename}: {e}")

if __name__ == '__main__':
    update_all_html_files_for_firebase_hosting()
