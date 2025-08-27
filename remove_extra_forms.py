
import os
import re

def remove_unwanted_auth_forms(directory="."):
    div_regex = re.compile(r'<div class="modal" id="authModal">.*?</div>\s*</div>', re.DOTALL)

    for filename in os.listdir(directory):
        if filename.endswith(".html"):
            filepath = os.path.join(directory, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = div_regex.sub('', content)

                if content != new_content:
                    print(f"Removed authModal from {filename}")
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                else:
                    print(f"No authModal found in {filename}")
            except Exception as e:
                print(f"Could not process {filename}: {e}")

if __name__ == "__main__":
    remove_unwanted_auth_forms()
