import os
from bs4 import BeautifulSoup

def add_search_form_to_html(file_path):
    """
    Reads an HTML file, finds the main search bar, and wraps it in a form tag
    if it's not already in one.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f, 'html.parser')

        search_input = soup.find('input', {'id': 'main-search-bar'})

        if search_input and not search_input.find_parent('form'):
            print(f"Updating search bar in: {file_path}")
            form_tag = soup.new_tag('form', id='header-search-form', attrs={'class': 'relative'})
            search_input.wrap(form_tag)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(str(soup))
        else:
            print(f"Search bar already in a form or not found in: {file_path}")

    except Exception as e:
        print(f"Could not process {file_path}: {e}")


def main():
    """
    Walks through the 'public' directory and applies the search form update
    to all .html files.
    """
    public_dir = 'public'
    if not os.path.isdir(public_dir):
        print(f"Error: '{public_dir}' directory not found.")
        return

    for root, _, files in os.walk(public_dir):
        for file in files:
            if file.endswith('.html'):
                file_path = os.path.join(root, file)
                add_search_form_to_html(file_path)
    
    print("\nScript finished. All applicable HTML files have been updated.")

if __name__ == '__main__':
    main()
