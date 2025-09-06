import os
from bs4 import BeautifulSoup

def copy_modals_from_articles():
    """
    Copies the login and register modals from articles.html to all other
    HTML files in the public directory to ensure consistency and functionality.
    """
    public_dir = 'public'
    source_file = os.path.join(public_dir, 'articles.html')

    if not os.path.exists(source_file):
        print(f"ERROR: Source file '{source_file}' not found. Cannot proceed.")
        return

    try:
        print(f"Reading working modals from '{source_file}'...")
        with open(source_file, 'r', encoding='utf-8') as f:
            soup_source = BeautifulSoup(f.read(), 'html.parser')

        # 1. Extract the working modals from articles.html
        working_login_modal = soup_source.find('div', id='loginModal')
        working_register_modal = soup_source.find('div', id='registerModal')

        if not working_login_modal or not working_register_modal:
            print(f"ERROR: Could not find both #loginModal and #registerModal in '{source_file}'.")
            return
            
    except Exception as e:
        print(f"An error occurred while reading the source file: {e}")
        return

    print("Successfully copied modal templates. Applying to all pages...")

    # 2. Iterate through all HTML files and apply the working modals
    for filename in os.listdir(public_dir):
        if filename.endswith('.html'):
            file_path = os.path.join(public_dir, filename)
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    soup_target = BeautifulSoup(f.read(), 'html.parser')

                # Remove any old versions of the modals
                for modal_id in ['loginModal', 'registerModal']:
                    existing_modal = soup_target.find('div', id=modal_id)
                    if existing_modal:
                        existing_modal.decompose()

                # Append the correct modals to the end of the body
                if soup_target.body:
                    soup_target.body.append(working_login_modal)
                    soup_target.body.append(working_register_modal)
                else:
                    print(f"  - Warning: No <body> tag in {filename}. Skipping.")
                    continue

                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(str(soup_target))
                
                print(f"Updated modals in: {filename}")

            except Exception as e:
                print(f"  - ERROR processing {filename}: {e}")

    print("\nProcess complete. All pages should now have the correct modals.")

if __name__ == '__main__':
    copy_modals_from_articles()
