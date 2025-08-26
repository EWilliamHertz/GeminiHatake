# remove_all_forms.py
import os
from bs4 import BeautifulSoup

def remove_elements_from_file(file_path):
    """
    Opens an HTML file, removes multiple specific form and modal elements by their ID,
    and saves the modified file.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as html_file:
            content = html_file.read()

        soup = BeautifulSoup(content, 'html.parser')
        
        # List of element IDs to find and remove
        element_ids_to_remove = [
            'login-form', 
            'register-form', 
            'loginForm', # This ID is duplicated, BeautifulSoup will find all
            'registerForm', # This ID is also duplicated
            'loginModal', 
            'registerModal'
        ]
        
        elements_removed = False
        for element_id in element_ids_to_remove:
            # Find all tags with the specified ID
            tags_to_remove = soup.find_all(id=element_id)
            for tag in tags_to_remove:
                tag.decompose()
                elements_removed = True
                print(f" - Removed element with id='{element_id}' from {file_path}")

        if elements_removed:
            # Write the modified HTML back to the file
            with open(file_path, 'w', encoding='utf-8') as new_html_file:
                new_html_file.write(str(soup.prettify()))
        else:
            print(f"No targeted form elements found to remove in: {file_path}")

    except Exception as e:
        print(f"An error occurred while processing {file_path}: {e}")

def main():
    """
    Scans the current directory for all .html files and runs the
    element removal function on each one.
    """
    print("Starting the new process to remove all authentication forms and modals...")
    # Walk through the current directory and all subdirectories
    for root, dirs, files in os.walk("."):
        # Exclude the 'functions' directory
        if 'functions' in dirs:
            dirs.remove('functions')
            
        for file in files:
            if file.endswith(".html"):
                file_path = os.path.join(root, file)
                remove_elements_from_file(file_path)
    print("Cleanup process completed.")

if __name__ == "__main__":
    main()
