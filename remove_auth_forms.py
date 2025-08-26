# remove_auth_forms.py
import os
from bs4 import BeautifulSoup

def remove_auth_forms_from_file(file_path):
    """
    Opens an HTML file, removes all <div> elements with the class 'auth-container',
    and saves the modified file.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as html_file:
            content = html_file.read()

        soup = BeautifulSoup(content, 'html.parser')
        
        # Find all div elements with the class "auth-container"
        auth_containers = soup.find_all('div', class_='auth-container')
        
        if auth_containers:
            print(f"Found and removing auth forms from: {file_path}")
            # Remove each found container from the HTML tree
            for container in auth_containers:
                container.decompose()
            
            # Write the modified HTML back to the file
            with open(file_path, 'w', encoding='utf-8') as new_html_file:
                new_html_file.write(str(soup.prettify()))
        else:
            print(f"No auth forms to remove in: {file_path}")

    except Exception as e:
        print(f"An error occurred while processing {file_path}: {e}")

def main():
    """
    Scans the current directory for all .html files and runs the
    form removal function on each one.
    """
    print("Starting the process to remove authentication forms from HTML files...")
    # Walk through the current directory and all subdirectories
    for root, dirs, files in os.walk("."):
        for file in files:
            if file.endswith(".html"):
                file_path = os.path.join(root, file)
                remove_auth_forms_from_file(file_path)
    print("Process completed.")

if __name__ == "__main__":
    main()
