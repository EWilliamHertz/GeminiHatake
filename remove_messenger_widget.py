import os

def remove_messenger_widget(directory):
    """
    Removes the messenger widget container from all HTML files in a directory.
    """
    for filename in os.listdir(directory):
        if filename.endswith(".html"):
            filepath = os.path.join(directory, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            start_tag = '<div id="messenger-widget-container">'
            end_tag = '</div>\n</div>\n</div>'
            
            start_index = content.find(start_tag)
            
            if start_index != -1:
                # Find the end of the widget container to remove it completely
                end_index = content.find(end_tag, start_index)
                if end_index != -1:
                    content = content[:start_index] + content[end_index + len(end_tag):]
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Removed messenger widget from {filename}")

if __name__ == '__main__':
    public_directory = 'public'
    if os.path.exists(public_directory):
        remove_messenger_widget(public_directory)
        print("\nMessenger widget removal process complete.")
    else:
        print(f"Directory '{public_directory}' not found.")
