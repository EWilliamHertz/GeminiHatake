from bs4 import BeautifulSoup

def add_modals_and_scripts(file_path):
    # HTML content for the modals
    modals_html = """
    <div class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50" id="loginModal">
       <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div class="flex justify-between items-center">
         <h2 class="text-xl font-bold">
          Login
         </h2>
         <button class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold" id="closeLoginModal">
          ×
         </button>
        </div>
        <form class="mt-4 space-y-4" id="loginForm">
         <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="loginEmail" placeholder="Email" required="" type="email"/>
         <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="loginPassword" placeholder="Password" required="" type="password"/>
         <p class="text-red-500 text-sm hidden" id="login-error-message">
         </p>
         <button class="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700" type="submit">
          Login
         </button>
         <button class="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-2 rounded-md border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center" id="googleLoginButton" type="button">
          <img alt="Google icon" class="w-5 h-5 mr-2" src="https://www.svgrepo.com/show/475656/google-color.svg"/>
          Sign in with Google
         </button>
        </form>
       </div>
      </div>
      <div class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50" id="registerModal">
       <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div class="flex justify-between items-center">
         <h2 class="text-xl font-bold">
          Register
         </h2>
         <button class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold" id="closeRegisterModal">
          ×
         </button>
        </div>
        <form class="mt-4 space-y-4" id="registerForm">
         <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerEmail" placeholder="Email" required="" type="email"/>
         <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerPassword" placeholder="Password" required="" type="password"/>
         <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerCity" placeholder="City" type="text"/>
         <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerCountry" placeholder="Country" type="text"/>
         <input class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" id="registerFavoriteTcg" placeholder="Favorite TCG" type="text"/>
         <p class="text-red-500 text-sm hidden" id="register-error-message">
         </p>
         <button class="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700" type="submit">
          Register
         </button>
         <button class="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-2 rounded-md border dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center" id="googleRegisterButton" type="button">
          <img alt="Google icon" class="w-5 h-5 mr-2" src="https://www.svgrepo.com/show/475656/google-color.svg"/>
          Register with Google
         </button>
        </form>
       </div>
      </div>
    """

    # HTML content for the cart modal
    cart_modal_html = """
    <div class="fixed inset-0 bg-black bg-opacity-60 hidden items-center justify-center z-[1001]" id="cartModal">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg flex flex-col" style="height: 90vh; max-height: 800px;">
            <div class="flex justify-between items-center p-4 border-b dark:border-gray-700">
                <h2 class="text-xl font-bold">Your Cart</h2>
                <button class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold" id="closeCartModal">×</button>
            </div>
            <div class="p-6 flex-grow overflow-y-auto" id="cart-items-container">
                <p class="text-center text-gray-500 dark:text-gray-400">Your cart is empty.</p>
            </div>
            <div class="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div class="flex justify-between items-center font-bold text-lg">
                    <span>Subtotal</span>
                    <span id="cart-subtotal">$0.00</span>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Shipping & taxes calculated at checkout.</p>
                <button class="w-full mt-4 bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400" disabled id="checkout-btn">
                    Proceed to Checkout
                </button>
            </div>
        </div>
    </div>
    """
    
    with open(file_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    body = soup.body
    if body:
        # Add modals and cart
        body.append(BeautifulSoup(modals_html, 'html.parser'))
        body.append(BeautifulSoup(cart_modal_html, 'html.parser'))

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(str(soup))
    print(f"Added modals to {file_path}")


if __name__ == "__main__":
    add_modals_and_scripts('public/marketplace.html')
