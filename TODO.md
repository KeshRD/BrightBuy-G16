# Update Navbar for Guest and Logged-in Users

## Tasks
- [x] Modify HomePage.js to remove token check and redirect, allowing guests to access the home page
- [x] Update App.js to set HomePage as the default route ("/") and move AuthPage to "/auth"
- [x] Update Navbar.js to make the user dropdown conditional: show "Log in/Sign up" for guests, "My Profile" and "Sign out" for logged-in users
- [x] Rename "Profile" to "My Profile" and "Logout" to "Sign out" in Navbar.js
- [x] Add alert for guests clicking cart icon or product cards: "Sign up/Log in to enjoy the full benefits of our service"
- [ ] Test guest access: launch website as guest, verify profile icon shows "Log in/Sign up" leading to auth page
- [ ] Test logged-in access: after login, verify profile icon shows "My Profile" and "Sign out"

## Notes
- Ensure cart count and search functionality work for guests
- Maintain responsive design and existing styles
