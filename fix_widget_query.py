import os

def fix_messenger_timestamp_field():
    """
    Corrects the Firestore query in messenger.js to use the 'lastUpdated'
    field for timestamps, matching the logic in messages.js.
    """
    messenger_js_path = "public/js/messenger.js"
    
    if not os.path.exists(messenger_js_path):
        print(f"Error: Could not find '{messenger_js_path}'.")
        return

    try:
        with open(messenger_js_path, "r", encoding="utf-8") as f:
            content = f.read()

        if 'lastMessageTimestamp' not in content:
            print("It looks like the timestamp field has already been corrected. No changes made.")
            return

        # Replace the incorrect field name with the correct one
        updated_content = content.replace('lastMessageTimestamp', 'lastUpdated')

        with open(messenger_js_path, "w", encoding="utf-8") as f:
            f.write(updated_content)
        
        print(f"Successfully updated '{messenger_js_path}'.")
        print("Replaced 'lastMessageTimestamp' with 'lastUpdated' to synchronize the widget with the main messages page.")

    except IOError as e:
        print(f"An error occurred while accessing the file: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    fix_messenger_timestamp_field()
