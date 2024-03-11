import { retryFetch } from "../popup";
import { fetchUserProfile } from "./authHandlersClient";

const navContainer = document.getElementById("navContainerBottom");

export function displayProfileImage(imageUrl) {
  removePreviousProfileElement(navContainer); // Remove only the profile image/icon

  const image = document.createElement("img");
  image.id = "profileElement";
  image.src = imageUrl;
  image.alt = "Profile Image";
  image.style.width = "35px";
  image.style.height = "35px";
  image.style.borderRadius = "50%";
  image.style.marginRight = "10px"; // Add right margin for spacing

  navContainer.appendChild(image);
}

export function removePreviousProfileElement(container) {
  const existingElement = container.querySelector("#profileElement");
  if (existingElement) {
    container.removeChild(existingElement);
  }
}

export function displayFallbackIcon() {
  removePreviousProfileElement(navContainer); // Remove only the profile image/icon

  const icon = document.createElement("i");
  icon.id = "profileElement";
  icon.className = "fas fa-user-circle";
  icon.style.fontSize = "35px";
  icon.style.color = "#777";
  icon.style.marginRight = "10px"; // Add right margin for spacing

  navContainer.appendChild(icon);
}

export function displayUserSignOutMessage() {
  // Display a message to the user (modify as per your UI logic)
  alert("You have been signed out.");
}

// Fetches the user sign-in status
export function displayButtonsIfSignedIn() {
  chrome.storage.local.get(["userId", "userProfile"], function (data) {
    if (!data.userId) {
      console.log("No user is logged in.");
      showLoginButton();
    } else {
      console.log("A user is logged in, user ID:", data.userId);
      showSignOutButton();

      if (data.userProfile && data.userProfile.profileImageUrl) {
        displayProfileImage(data.userProfile.profileImageUrl);
      } else {
        displayFallbackIcon();
      }
    }
  });
}

export async function handleToken(token) {
  console.log("handleToken(): storing the token:", token);
  try {
    // Store the token securely
    await chrome.storage.local.set({ authToken: token });

    const userProfile = await fetchUserProfile(token);
    console.log("Fetched user profile:", userProfile);

    if (userProfile && userProfile.userId) {
      console.log("User ID is:", userProfile.userId);
      await onSignInSuccess(token, userProfile);
      retryFetch();
    } else {
      console.error("Failed to retrieve user profile");
    }
  } catch (error) {
    console.error("Error during login:", error);
  }
}

export function showLoginButton() {
  // Show the login button and hide the sign-out button
  document.getElementById("loginBtn").style.display = "flex";
  document.getElementById("switchAccountBtn").style.display = "none";
}

export function showSignOutButton() {
  // Show the sign-out button and hide the login button
  document.getElementById("loginBtn").style.display = "none";
  document.getElementById("switchAccountBtn").style.display = "block";
}

// Updates user profile information
export function updateUserProfileDisplay(userInfo) {
  if (userInfo.email && userInfo.imageUrl) {
    displayProfileImage(userInfo.imageUrl);
  } else if (userInfo.email && !userInfo.imageUrl) {
    displayFallbackIcon();
  } else {
    removePreviousProfileElement(document.getElementById("navContainerBottom"));
  }
}
