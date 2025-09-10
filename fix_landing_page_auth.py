import os
from bs4 import BeautifulSoup

def fix_landing_page_scripts(reference_file_path, target_file_path):
    """
    Overhauls the target file's scripts and auth buttons to match the reference file.
    """
    try:
        # 1. Read the reference file to get the correct script block
        with open(reference_file_path, 'r', encoding='utf-8') as f:
            ref_soup = BeautifulSoup(f, 'html.parser')

        # Find all the necessary script tags from the reference file
        # This includes Firebase compat libraries, init script, and your custom JS files
        correct_scripts = ref_soup.find_all('script', {'src': True})
        
        # We need to find the firebase init script specifically
        firebase_init_script = ref_soup.find('script', src='/__/firebase/init.js')
        
        # We need the global auth.js script
        auth_script_tag = ref_soup.find('script', src='js/auth.js')

        if not correct_scripts or not firebase_init_script or not auth_script_tag:
            print(f"Error: Could not find all necessary script tags in reference file: {reference_file_path}")
            return

        # 2. Read the target file (index.html) to modify it
        with open(target_file_path, 'r', encoding='utf-8') as f:
            target_soup = BeautifulSoup(f, 'html.parser')

        # 3. Remove the broken inline module script
        inline_script = target_soup.find('script', type='module')
        if inline_script:
            inline_script.decompose()
            print(f"Removed broken inline module script from {target_file_path}")

        # 4. Remove all existing src-based script tags at the bottom to avoid conflicts
        for s in target_soup.find_all('script', {'src': True}):
            s.decompose()
        print(f"Removed old script tags from {target_file_path}")
        
        # Remove the modals that are causing issues
        login_modal = target_soup.find('div', id='login-modal')
        if login_modal:
            login_modal.decompose()
            print(f"Removed old login modal from {target_file_path}")
        register_modal = target_soup.find('div', id='register-modal')
        if register_modal:
            register_modal.decompose()
            print(f"Removed old register modal from {target_file_path}")

        # 5. Add the correct scripts to the end of the body
        # Get the correct modals from the reference file
        correct_login_modal = ref_soup.find('div', id='loginModal')
        correct_register_modal = ref_soup.find('div', id='registerModal')
        
        if correct_login_modal:
             target_soup.body.append(correct_login_modal)
        if correct_register_modal:
             target_soup.body.append(correct_register_modal)

        # Append all the correct scripts
        for script in correct_scripts:
            target_soup.body.append(script)
        
        print(f"Appended correct scripts and modals to {target_file_path}")


        # 6. Fix the button IDs in the header
        login_btn = target_soup.find('button', id='login-btn-nav')
        if login_btn:
            login_btn['id'] = 'header-login-btn'
            print("Updated login button ID.")
            
        register_btn = target_soup.find('button', id='register-btn-nav')
        if register_btn:
            register_btn['id'] = 'header-register-btn'
            print("Updated register button ID.")

        # 7. Write the fully corrected HTML back to the file
        with open(target_file_path, 'w', encoding='utf-8') as f:
            f.write(str(target_soup))
            
        print(f"Successfully fixed authentication scripts and buttons on {target_file_path}")

    except FileNotFoundError as e:
        print(f"Error: {e}. Please ensure file paths are correct.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    public_dir = 'public'
    # Use 'about.html' as the correct reference
    reference_html = os.path.join(public_dir, 'about.html')
    # The file to fix is 'index.html'
    target_html = os.path.join(public_dir, 'index.html')

    if os.path.exists(reference_html) and os.path.exists(target_html):
        fix_landing_page_scripts(reference_html, target_html)
    else:
        print("Error: Could not find reference (about.html) or target (index.html) file.")
