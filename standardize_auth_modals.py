import os
from bs4 import BeautifulSoup

def standardize_modals(reference_file_path, target_file_path):
    """
    Copies the loginModal and registerModal from a reference HTML file
    to a target HTML file, ensuring consistency.
    """
    try:
        # Read the reference file to get the correct modals
        with open(reference_file_path, 'r', encoding='utf-8') as f:
            ref_soup = BeautifulSoup(f, 'html.parser')

        login_modal = ref_soup.find('div', id='loginModal')
        register_modal = ref_soup.find('div', id='registerModal')

        if not login_modal or not register_modal:
            print(f"Error: Could not find loginModal or registerModal in the reference file: {reference_file_path}")
            return

        # Read the target file to replace its modals
        with open(target_file_path, 'r', encoding='utf-8') as f:
            target_soup = BeautifulSoup(f, 'html.parser')

        # Find and replace the old modals in the target file
        old_login_modal = target_soup.find('div', id='loginModal')
        if old_login_modal:
            old_login_modal.replace_with(login_modal)
            print(f"Replaced loginModal in {target_file_path}")
        else:
            # If it doesn't exist, append it to the body
            target_soup.body.append(login_modal)
            print(f"Appended loginModal to {target_file_path}")

        old_register_modal = target_soup.find('div', id='registerModal')
        if old_register_modal:
            old_register_modal.replace_with(register_modal)
            print(f"Replaced registerModal in {target_file_path}")
        else:
            # If it doesn't exist, append it to the body
            target_soup.body.append(register_modal)
            print(f"Appended registerModal to {target_file_path}")

        # Write the updated content back to the target file
        with open(target_file_path, 'w', encoding='utf-8') as f:
            f.write(str(target_soup))
            
        print(f"Successfully standardized auth modals in {target_file_path}")

    except FileNotFoundError as e:
        print(f"Error: {e}. Please ensure file paths are correct.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    # Define the paths relative to the script location
    public_dir = 'public'
    reference_html = os.path.join(public_dir, 'app.html')
    target_html = os.path.join(public_dir, 'index.html')

    if os.path.exists(reference_html) and os.path.exists(target_html):
        standardize_modals(reference_html, target_html)
    else:
        print("Error: Could not find reference file (app.html) or target file (index.html) in the 'public' directory.")
