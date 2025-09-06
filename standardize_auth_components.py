import os
from bs4 import BeautifulSoup

def standardize_auth_components():
    """
    Standardizes the navbar and auth modals across all HTML files
    using index.html as the source of truth.
    """
    public_dir = 'public'
    template_path = os.path.join(public_dir, 'index.html')

    if not os.path.exists(template_path):
        print(f"ERROR: Main template file 'public/index.html' not found.")
        return

    print(f"Reading master components from {template_path}...")

    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            soup_template = BeautifulSoup(f.read(), 'html.parser')

        # 1. Extract the "golden" components from index.html
        golden_navbar = soup_template.find('nav', class_='navbar')
        golden_login_modal = soup_template.find('div', id='loginModal')
        golden_register_modal = soup_template.find('div', id='registerModal')

        if not all([golden_navbar, golden_login_modal, golden_register_modal]):
            print("ERROR: Could not find one or more master components (navbar, loginModal, registerModal) in index.html.")
            return

    except Exception as e:
        print(f"ERROR reading or parsing template file: {e}")
        return

    print("Master components extracted successfully. Now standardizing all pages...")

    # 2. Iterate through all HTML files and apply the golden components
    for filename in os.listdir(public_dir):
        if filename.endswith('.html'):
            file_path = os.path.join(public_dir, filename)
            print(f"Processing {file_path}...")
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    soup_target = BeautifulSoup(f.read(), 'html.parser')

                # --- Replace Navbar ---
                current_navbar = soup_target.find('nav', class_='navbar')
                if current_navbar:
                    current_navbar.replace_with(golden_navbar)
                else:
                    print(f"  - Warning: No navbar found in {filename}. Adding one.")
                    # If no navbar, add it to the start of the body
                    if soup_target.body:
                        soup_target.body.insert(0, golden_navbar)

                # --- Replace Modals ---
                for modal_id in ['loginModal', 'registerModal']:
                    modal = soup_target.find('div', id=modal_id)
                    if modal:
                        modal.decompose() # Remove old one if it exists
                
                # Add the new golden modals to the end of the body
                if soup_target.body:
                    soup_target.body.append(golden_login_modal)
                    soup_target.body.append(golden_register_modal)

                # --- Save the updated file ---
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(str(soup_target))

            except Exception as e:
                print(f"  - ERROR processing {filename}: {e}")

    print("\nStandardization complete. All pages should now have a consistent navbar and working auth modals.")

if __name__ == '__main__':
    standardize_auth_components()
