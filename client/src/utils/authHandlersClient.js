import { loadHomePage, retryFetch } from "../popup";
import {
  displayFallbackIcon,
  showSignOutButton,
  showLoginButton,
  displayProfileImage,
  displayUserSignOutMessage,
} from "./uiUtils";

// Fetches the user Profile using the token
export async function fetchUserProfile(token) {
  const userInfoUrl = "https://www.googleapis.com/oauth2/v3/userinfo";

  try {
    const response = await fetch(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const userInfo = await response.json();
    if (userInfo && userInfo.sub) {
      return {
        userId: userInfo.sub, // User ID from Google's OAuth
        profileImageUrl: userInfo.picture, // User's profile image URL
      };
    } else {
      throw new Error("User info not available or invalid response");
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw error;
  }
}

// Updates user profile information
export function updateUserProfileInfo() {
  chrome.identity.getProfileUserInfo(function (userInfo) {
    if (userInfo.email && userInfo.imageUrl) {
      // User is signed in and has an image URL
      console.log("Profile image detected.");
      displayProfileImage(userInfo.imageUrl);
    } else if (userInfo.email && !userInfo.imageUrl) {
      // User is signed in but does not have an image URL
      console.log("Profile image not available. Using FontAwesome icon.");
      displayFallbackIcon();
    } else {
      // User is not signed in
      console.log("User is not signed in. Icon will not be displayed.");
      removePreviousProfileElement(
        document.getElementById("navContainerBottom")
      );
    }
  });
}

// Handles successful login
export async function onSignInSuccess(token, userProfile) {
  if (userProfile && userProfile.userId) {
    await chrome.storage.local.set({
      userId: userProfile.userId,
      userProfile: userProfile,
      authToken: token, // Storing the token securely
    });
    console.log("User profile stored in local storage:", userProfile.userId);

    // Send a message to background script to fetch and store user watch data
    console.log("onSignInSuccess(): fetching Watch Data From Server");
    chrome.runtime.sendMessage({
      action: "fetchWatchData",
      userId: userProfile.userId,
    });

    // Update insights page and UI
    retryFetch();
    showSignOutButton();
    if (userProfile.profileImageUrl) {
      displayProfileImage(userProfile.profileImageUrl);
    } else {
      displayFallbackIcon();
    }
  } else {
    console.error("User profile information is not available");
  }
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
    } else {
      console.error("Failed to retrieve user profile");
    }
  } catch (error) {
    console.error("Error during login:", error);
  }
}

// Function to get the stored token
export async function getStoredToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("authToken", function (data) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(data.authToken);
      }
    });
  });
}

// Signs out the user
export function signOut() {
  chrome.identity.getAuthToken({ interactive: false }, async function (token) {
    if (chrome.runtime.lastError || !token) {
      // No valid token, proceed with local sign-out
      console.log(
        "No valid token for sign-out, proceeding with local cleanup."
      );
      completeLocalSignOut();
      displayUserSignOutMessage(); // Inform the user
      return;
    }

    // Check if the token is valid before revoking
    const isValidToken = await isTokenValid(token);
    if (!isValidToken) {
      console.log("Invalid token, proceeding with local cleanup.");
      completeLocalSignOut();
      displayUserSignOutMessage(); // Inform the user
      return;
    }

    // Revoke the token and proceed with local sign-out
    revokeToken(token, completeLocalSignOut);
  });
}

function revokeToken(token, callback) {
  const revokeUrl = `https://accounts.google.com/o/oauth2/revoke?token=${token}`;

  fetch(revokeUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Token revocation failed: ${response.status}`);
      }
      console.log("Token successfully revoked");
      chrome.identity.removeCachedAuthToken({ token: token }, callback);
    })
    .catch((error) => {
      console.error("Error during token revocation:", error);
      callback(); // Proceed with local sign-out even if revocation fails
    });
}

function completeLocalSignOut() {
  // Clear local storage and update UI
  chrome.storage.local.remove(
    ["authToken", "userId", "userProfile", "watchData", "totalYoutubeTime"],
    function () {
      if (chrome.runtime.lastError) {
        console.error(
          "Error clearing local storage:",
          chrome.runtime.lastError
        );
      } else {
        console.log("User signed out and session data cleared.");
        displayUserSignOutMessage(); // Inform the user
        showLoginButton();
        displayFallbackIcon(); // Reset to default icon
        retryFetch();
      }
    }
  );
}

async function isTokenValid(token) {
  const tokenInfoUrl = `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(
    token
  )}`;

  try {
    const response = await fetch(tokenInfoUrl);
    const data = await response.json();

    // If there's an error field in the response, the token is invalid.
    if (data.error_description) {
      console.error("Token is invalid:", data.error_description);
      return false;
    }

    // Optionally, you can check if the token is for the correct scopes, etc.
    // Example: if (data.scope.includes("https://www.googleapis.com/auth/youtube.readonly")) { ... }

    console.log("Token is valid. Token info:", data);
    return true;
  } catch (error) {
    console.error("Error checking token validity:", error);
    return false;
  }
}
