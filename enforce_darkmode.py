import os
from bs4 import BeautifulSoup

def ensure_darkmode_script(file_path):
    """
    Checks if a given HTML file includes the darkmode.js script.
    If not, it adds the script to the <head> section.

    Args:
        file_path (str): The path to the HTML file.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    soup = BeautifulSoup(content, 'html.parser')

    # Check if the script is already present
    script_exists = soup.find('script', src='js/darkmode.js')
    if script_exists:
        print(f"Dark mode script already exists in {file_path}")
        return

    # Add the script to the head
    if soup.head:
        new_script_tag = soup.new_tag('script', src='js/darkmode.js')
        soup.head.append(new_script_tag)
        print(f"Added dark mode script to {file_path}")
    else:
        print(f"Could not find head tag in {file_path}")
        return

    # Write the modified HTML back to the file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(str(soup))

def main():
    """
    Iterates through all HTML files in the current directory and
    ensures the dark mode script is included.
    """
    for filename in os.listdir('.'):
        if filename.endswith('.html'):
            ensure_darkmode_script(filename)

if __name__ == '__main__':
    main()
