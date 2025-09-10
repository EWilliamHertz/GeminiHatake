import os

def fix_modal_centering(css_file_path):
    """
    Appends a CSS rule to a file to ensure the terms-modal is centered.
    """
    css_rule = """
/* Force centering for the dynamically created terms modal */
#terms-modal {
    display: flex;
    align-items: center;
    justify-content: center;
}
"""
    try:
        # Check if the rule already exists to avoid duplicates
        with open(css_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if '#terms-modal' in content:
                print(f"Centering rule for #terms-modal already exists in {css_file_path}. No changes made.")
                return

        # Append the new rule to the end of the file
        with open(css_file_path, 'a', encoding='utf-8') as f:
            f.write(css_rule)
            
        print(f"Successfully added centering rule to {css_file_path}")

    except FileNotFoundError:
        print(f"Error: CSS file not found at {css_file_path}. Please check the path.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    css_file = os.path.join('public', 'css', 'style.css')
    
    if os.path.exists(css_file):
        fix_modal_centering(css_file)
    else:
        print(f"Error: Could not find the stylesheet at {css_file}.")
