import { updateInsightsPage } from "../../client/src/popup";

// Fetch user Id using the token
export async function fetchUserId(token) {
  return fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((response) => response.json())
    .then((userInfo) => {
      if (userInfo && userInfo.sub) {
        return userInfo.sub; // 'sub' is the user ID in Google's OAuth
      } else {
        throw new Error("User info not available or invalid response");
      }
    });
}

// Initiates user logout
export function onSignOut() {
  Object.keys(youtubeTabs).forEach((tabId) => {
    if (youtubeTabs[tabId] && youtubeTabs[tabId].isRunning) {
      clearInterval(youtubeTabs[tabId].intervalId);
      delete youtubeTabs[tabId]; // Optional, to clean up
    }
  });
  chrome.storage.local.remove(["userId", "watchData"], function () {
    if (chrome.runtime.lastError) {
      console.error(
        "Error during local storage clear on sign out:",
        chrome.runtime.lastError
      );
    } else {
      console.log("Local storage cleared on sign out.");
      // Now that the data is cleared, update the insights page
      updateInsightsPage();
    }
  });
}
