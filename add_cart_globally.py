import os
from bs4 import BeautifulSoup

def add_cart_to_html_files():
    """
    This script adds the cart modal and a dedicated cart script to all HTML
    files in the current directory, making the cart a global feature.
    """
    # HTML for the cart modal, taken from shop.html
    cart_modal_html = """
    <div class="fixed inset-0 bg-black bg-opacity-60 hidden items-center justify-center z-[1001]" id="cartModal">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col" style="height: 90vh; max-height: 800px;">
            <div class="flex justify-between items-center p-4 border-b dark:border-gray-700">
                <h2 class="text-xl font-bold">Your Cart</h2>
                <button class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold" id="closeCartModal">&times;</button>
            </div>
            <div class="p-6 flex-grow overflow-y-auto" id="cart-items-container">
                <!-- Cart items will be dynamically inserted here -->
                <p class="text-center text-gray-500 dark:text-gray-400">Your cart is empty.</p>
            </div>
            <div class="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div class="flex justify-between items-center font-bold text-lg">
                    <span>Subtotal</span>
                    <span id="cart-subtotal">$0.00</span>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Shipping & taxes calculated at checkout.</p>
                <button class="w-full mt-4 bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400" id="checkout-btn" disabled>
                    Proceed to Checkout
                </button>
            </div>
        </div>
    </div>
    """

    # The new script tag for our global cart logic
    cart_script_tag_str = '<script src="js/cart.js"></script>'

    for filename in os.listdir('.'):
        if filename.endswith('.html'):
            try:
                with open(filename, 'r', encoding='utf-8') as f:
                    soup = BeautifulSoup(f.read(), 'html.parser')

                # --- Add Cart Modal ---
                if soup.body and not soup.find(id="cartModal"):
                    # We add it at the end of the body
                    soup.body.append(BeautifulSoup(cart_modal_html, 'html.parser'))
                    print(f"Added cart modal to {filename}")

                # --- Add Cart Script ---
                # Check if the script is already there
                script_exists = any(
                    s.get('src') == 'js/cart.js' for s in soup.find_all('script')
                )
                if soup.body and not script_exists:
                    # Add it before the closing body tag
                    soup.body.append(BeautifulSoup(cart_script_tag_str, 'html.parser'))
                    print(f"Added cart script to {filename}")

                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(str(soup))

            except Exception as e:
                print(f"Could not process {filename}: {e}")

if __name__ == '__main__':
    add_cart_to_html_files()
    print("\nCart update process complete.")
