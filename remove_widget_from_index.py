import os
from bs4 import BeautifulSoup

def remove_widget_from_index():
    """
    Removes the messenger widget container and its script from public/index.html.
    """
    index_file_path = "public/index.html"

    if not os.path.exists(index_file_path):
        print(f"Error: File not found at '{index_file_path}'")
        return

    try:
        with open(index_file_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f, "html.parser")

        # Find and remove the widget's main container div
        widget_container = soup.find("div", id="messenger-widget-container")
        if widget_container:
            widget_container.decompose()
            print("Removed messenger widget container from index.html.")
        else:
            print("Messenger widget container not found in index.html.")

        # Find and remove the widget's script tag
        widget_script = soup.find("script", src="js/messenger.js")
        if widget_script:
            widget_script.decompose()
            print("Removed messenger.js script tag from index.html.")
        else:
            print("messenger.js script not found in index.html.")

        # Write the modified content back to the file
        with open(index_file_path, "w", encoding="utf-8") as f:
            f.write(str(soup))
        
        print(f"Successfully updated '{index_file_path}'.")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    remove_widget_from_index()
