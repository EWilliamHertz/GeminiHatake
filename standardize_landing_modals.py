import os
from bs4 import BeautifulSoup

def standardize_modals(reference_file_path, target_file_path):
    """
    Copies the loginModal and registerModal from a reference HTML file
    to a target HTML file to ensure consistency.
    """
    try:
        # --- Read the reference file to get the correct modals ---
        with open(reference_file_path, 'r', encoding='utf-8') as f:
            ref_soup = BeautifulSoup(f, 'html.parser')

        # Find the correct login and register modals
        login_modal_correct = ref_soup.find('div', id='loginModal')
        register_modal_correct = ref_soup.find('div', id='registerModal')

        if not login_modal_correct or not register_modal_correct:
            print(f"Error: Could not find one or both modals in the reference file: {reference_file_path}")
            return

        # --- Read the target file to replace its modals ---
        with open(target_file_path, 'r', encoding='utf-8') as f:
            target_soup = BeautifulSoup(f, 'html.parser')

        # Find and replace the old login modal in the target file
        old_login_modal = target_soup.find('div', id='login-modal') # Note the different ID on the landing page
        if old_login_modal:
            # We need to give the new modal the correct ID for the landing page's script
            login_modal_correct['id'] = 'login-modal'
            old_login_modal.replace_with(login_modal_correct)
            print(f"Replaced loginModal in {target_file_path}")
        else:
            print(f"Warning: Did not find the login modal in {target_file_path}.")


        # Find and replace the old register modal in the target file
        old_register_modal = target_soup.find('div', id='register-modal') # Note the different ID
        if old_register_modal:
            # Adjust the ID for the new modal
            register_modal_correct['id'] = 'register-modal'
            old_register_modal.replace_with(register_modal_correct)
            print(f"Replaced registerModal in {target_file_path}")
        else:
             print(f"Warning: Did not find the register modal in {target_file_path}.")


        # --- Write the updated content back to the target file ---
        with open(target_file_path, 'w', encoding='utf-8') as f:
            f.write(str(target_soup))
            
        print(f"Successfully standardized auth modals in {target_file_path}")

    except FileNotFoundError as e:
        print(f"Error: {e}. Please ensure file paths are correct.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    public_dir = 'public'
    # Use about.html as the source of truth
    reference_file = os.path.join(public_dir, 'about.html') 
    # The landing page is the one we need to fix
    target_file = os.path.join(public_dir, 'index.html')

    if os.path.exists(reference_file) and os.path.exists(target_file):
        standardize_modals(reference_file, target_file)
    else:
        print("Error: Could not find the reference file (about.html) or the target file (index.html).")
