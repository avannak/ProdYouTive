import {
  getCurrentMonth,
  getCurrentMonthKey,
  getStartOfWeek,
} from "./utils/utils";
import {
  fetchVideoDetails,
  fetchVideoDetailsByBatch,
} from "../../server/utils/youtubeDataApi";
import { analyzeVideoForKeywords, classifyVideo } from "./utils/textAnalysis";
import {
  findAndOpenFocusModeModal,
  openYouTubeTabAndShowModal,
} from "./components/focusMode/focusModeToggle/focusModeToggle";

let userSignedIn = false;

// Global variable in the background script to store the current video info
let globalCurrentVideoInfo = {};
// Global variable to store the current video info
let currentVideoInfo = {};
// Global variable to store youtube Tab data
let youtubeTabs = {};
// Tab event listeners
let tabStateCache = {};
// Structure for time data
let watchData = {
  total: { time: 0, videos: 0 },
  daily: {
    monday: { time: 0, videos: 0 },
    tuesday: { time: 0, videos: 0 },
    wednesday: { time: 0, videos: 0 },
    thursday: { time: 0, videos: 0 },
    friday: { time: 0, videos: 0 },
    saturday: { time: 0, videos: 0 },
    sunday: { time: 0, videos: 0 },
  },
  monthly: {
    january: { time: 0, videos: 0 },
    february: { time: 0, videos: 0 },
    march: { time: 0, videos: 0 },
    april: { time: 0, videos: 0 },
    may: { time: 0, videos: 0 },
    june: { time: 0, videos: 0 },
    july: { time: 0, videos: 0 },
    august: { time: 0, videos: 0 },
    september: { time: 0, videos: 0 },
    november: { time: 0, videos: 0 },
    december: { time: 0, videos: 0 },
  },
  categories: {},
  channels: {},
  countedVideos: new Set(), // Initialize as a Set
  lastUpdated: new Date().toISOString(),
  //... other existing fields
};
// Global variable for focus Mode
let focusMode = false;

// Function to set user's sign-in state
export function setUserLoggedInState(loggedIn) {
  userSignedIn = loggedIn;
}

export function isUserAuthenticated() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, function (token) {
      if (chrome.runtime.lastError) {
        // Handle the error - either reject the promise or resolve it with a specific value
        console.error(
          "Error getting auth token:",
          chrome.runtime.lastError.message
        );
        resolve(false);
        // Alternatively, if you want to handle this as a non-error case:
        // resolve(false); // Indicates that the user is not authenticated
      } else {
        resolve(token != null); // Resolve with true if token is not null, indicating the user is authenticated
      }
    });
  });
}

function authenticateUser() {
  console.log("Authenticating user...");
  chrome.identity.getAuthToken({ interactive: true }, function (token) {
    if (chrome.runtime.lastError) {
      console.error("Authentication failed:", chrome.runtime.lastError);
      chrome.runtime.sendMessage({
        type: "authToken",
        error: chrome.runtime.lastError.message,
      });
    } else {
      console.log("Token received after authenticateUser():", token);
      chrome.runtime.sendMessage({
        type: "authToken",
        token: token,
      });
    }
  });
}

// Message Handling
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (sender.tab) {
    console.log("Message from a content script:", sender.tab.id);
    let tabId = sender.tab.id;
    // Debugging: Log received message
    console.log("Received message:", request, "from tab:", tabId);
  } else {
    console.log("Message from the extension:", request);
    // Log specific properties of the request if they exist
    if (request.action) {
      console.log("Action:", request.action);
    }
    if (request.extraParameters) {
      console.log("Extra Parameters:", request.extraParameters);
    }
  }

  let tabId = sender.tab ? sender.tab.id : null;

  // Handling actions
  if (request.action) {
    handleAction(request.action, request, tabId, sendResponse);
    return true; // Indicates that sendResponse will be called asynchronously for actions
  }

  // Handling messages
  try {
    handleMessage(request, sender, sendResponse);
  } catch (error) {
    console.error("Error in message handling:", error);
    sendResponse({ success: false, error: error.message });
  }
  return true; // Keep the message channel open for asynchronous operations
});

// Function to handle messages
function handleMessage(request, sender, sendResponse) {
  let tabId = sender.tab ? sender.tab.id : null;
  switch (request.message) {
    case "updateUserLoggedIn":
      setUserLoggedInState(request.loggedIn);
      sendResponse({ success: true });
      break;
    case "playerState":
      handlePlayerStateChange(tabId, request.state, request.videoId);
      sendResponse({ success: true });
      break;
    case "startTimer":
    case "resumeTimer":
      resumeTimer(tabId, request.videoId);
      sendResponse({ success: true });
      break;
    case "video-play":
      // Determine if it's a new video or the same video resuming
      const isNewVideo = youtubeTabs[tabId]?.currentVideo !== request.videoId;
      if (isNewVideo) {
        // If it's a new video, start the timer for the new video
        startOrResumeTimer(tabId, request.videoId);
      } else {
        // If it's the same video resuming, just resume the timer
        if (!isTimerRunning(tabId)) {
          resumeTimer(tabId, request.videoId);
        }
      }
      break;
    case "pauseTimer":
    case "video-pause":
      if (isTimerRunning(tabId)) {
        pauseTimer(tabId);
      }
      break;
    case "stopTimer":
      stopTimer(tabId, false);
      break;
    case "updateVideoInfo":
      console.log(
        "message: updateVideoInfo: Received video info:",
        request.videoInfo
      );
      currentVideoInfo = request.videoInfo; // Update the current video info
      break;
    case "videoInfo":
      // console.log("message: videoInfo: Received video info:", request.data);
      currentVideoInfo = request.data;
      break;
    case "requestVideoInfo":
      handlePopupRequest(sendResponse);
      return true; // Keeps the message channel open for sendResponse
    case "getTabId":
      sendResponse({ tabId: tabId });
      break;
    case "tabClosing":
      console.log("Closed a tab. Saving data...");
      stopTimer(tabId, true);
      getTotalTimeFromLocalStorage();
      break;
    default:
      sendResponse({ success: false, message: "Unknown request" });
      break;
  }
}

// Function to handle actions
function handleAction(action, request, tabId, sendResponse) {
  switch (action) {
    case "authenticate":
      console.log("authenticating user...");
      authenticateUser();
      return true; // Indicates that sendResponse will be called asynchronously
    case "checkAuthStatus":
      isUserAuthenticated()
        .then((isAuthenticated) => {
          sendResponse({ isAuthenticated });
        })
        .catch((error) => {
          console.error("Authentication check failed:", error);
          sendResponse({ isAuthenticated: false, error: error.message });
        });
      return true; // Keep the message channel open for asynchronous response
    case "handleToken":
      // Send a message to the content script or popup script
      chrome.tabs.sendMessage(
        tabId,
        { action: "handleToken", token: request.token },
        function (response) {
          if (chrome.runtime.lastError) {
            sendResponse({
              success: false,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          sendResponse(response); // Forward the response from the content/popup script
        }
      );
      return true; // Indicates asynchronous response
    case "checkSignInStatus":
      isUserLoggedIn()
        .then((isSignedIn) => {
          console.log("checkSignInStatus: isSigned In is:", isSignedIn);
          sendResponse({ signedIn: isSignedIn });
        })
        .catch((error) => {
          console.error("Error checking sign-in status:", error);
          sendResponse({ signedIn: false, error: error.toString() });
        });
      return true;
    case "fetchWatchData":
      getWatchDataFromServerWithResponse()
        .then((response) => {
          if (response.success) {
            console.log("fetchWatchData: VALID WATCH DATA");
            sendResponse({ success: true, data: response.data });
          } else {
            console.log("fetchWatchData: FAILED TO FETCH WATCH DATA");
            sendResponse({
              success: false,
              message: response.message,
            });
          }
        })
        .catch((error) => {
          console.log("fetchWatchData: CATCH: FAILED TO FETCH WATCH DATA");
          sendResponse({ success: false, message: error.message });
        });
      return true; // Indicates asynchronous response
    case "resetLocalStorage":
      console.log("Received message, resetting local storage...");
      resetLocalStorage();
      break;
    case "toggleFocusMode":
      focusMode = !focusMode;
      chrome.storage.local.set({ focusMode: focusMode }, function () {
        console.log("Focus Mode is set to " + focusMode);

        // Send message to reload page
        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            if (tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "reloadPageForFocusMode",
                focusMode: focusMode,
              });
            }
          }
        );
      });
      break;
    case "focusModeConfirmed":
      console.log("focusModeConfirmed message from modal: ", request);
      focusMode = true;
      chrome.storage.local.set({ focusMode: focusMode }, function () {
        console.log("Focus Mode is set to " + focusMode);
        // Send message to reload page
        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            if (tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "reloadPageForFocusMode",
                focusMode: focusMode,
              });
            }
          }
        );
      });
    case "checkFocusModeStatus":
      sendResponse({ success: true, focusMode: focusMode });
      break;
    case "openNewYouTubeTab":
      chrome.tabs.create({ url: "https://www.youtube.com" }, function (newTab) {
        // Wait for the tab to be fully loaded
        chrome.tabs.onUpdated.addListener(function onUpdated(tabId, info) {
          if (tabId === newTab.id && info.status === "complete") {
            // Stop listening to updates on this tab
            chrome.tabs.onUpdated.removeListener(onUpdated);

            // Inject your content script here if it's not automatically injected
            // chrome.tabs.executeScript(newTab.id, { file: "contentScript.js" });

            // Then send a message to the content script in the new tab
            chrome.tabs.sendMessage(newTab.id, {
              action: "openFocusModeModal",
            });
          }
        });
      });
      break;
    case "scrapedVideoData":
      break;
    case "processVideoBatch":
      console.log("Processing video batch from content script:", request);
      fetchVideoDetailsByBatch(request.data); // Assuming request.data is an array of video IDs
      break;
    // ... other action cases
    default:
      sendResponse({ success: false, message: "Unknown action" });
      break;
  }
}

function isTimerRunning(tabId) {
  return youtubeTabs[tabId] && youtubeTabs[tabId].isRunning;
}

function handlePlayerStateChange(tabId, state, videoId) {
  // Use the stored videoId from youtubeTabs if not provided
  if ((!videoId || videoId === null) && youtubeTabs[tabId]) {
    videoId = youtubeTabs[tabId].currentVideo;
  }

  if (!videoId) {
    console.error("Invalid or missing video ID for tab:", tabId);
    return;
  }

  switch (state) {
    case 1: // Playing
      const isNewVideo = youtubeTabs[tabId]?.currentVideo !== videoId;
      if (isNewVideo) {
        startOrResumeTimer(tabId, videoId);
      } else {
        if (!isTimerRunning(tabId)) {
          resumeTimer(tabId, videoId);
        }
        // Reset videoCounted flag when the same video is resumed
        youtubeTabs[tabId].videoCounted = false;
      }
      break;
    case 2: // Paused
      if (isTimerRunning(tabId)) {
        pauseTimer(tabId, videoId);
      }
      break;
    // Additional state handling if needed
  }
}

// Function to handle requests from popup
function handlePopupRequest(sendResponse) {
  if (currentVideoInfo) {
    sendResponse({ videoInfo: currentVideoInfo });
  } else {
    sendResponse({ videoInfo: null });
  }
}

chrome.tabs.onCreated.addListener(function (tab) {
  console.log(`Tab ${tab.id} was created.`);
});

chrome.tabs.onRemoved.addListener(async function (tabId, removeInfo) {
  if (youtubeTabs[tabId]) {
    // Capture necessary data before stopping the timer
    const timeSpent = youtubeTabs[tabId].timeSpent;
    const channel = youtubeTabs[tabId].channel;
    const categories = youtubeTabs[tabId].categories;
    const videoCounted = youtubeTabs[tabId].videoCounted;

    console.log(
      "Data before stopping timer and closing tab:",
      timeSpent,
      channel,
      categories,
      videoCounted
    );

    // Check if there was any time spent and update data accordingly, and if the video hasn't been counted yet
    if (timeSpent > 0 && !videoCounted) {
      const updatedWatchData = await updateAndSaveWatchData(
        tabId,
        timeSpent,
        channel,
        categories
      );
      await saveWatchDataToLocalStorage(updatedWatchData);

      // Set video as counted
      youtubeTabs[tabId].videoCounted = true;

      // Now that the data is saved, send it to the server
      sendWatchDataToServer();
    }

    // Stop the timer, which also clears the interval and deletes the tab entry
    console.log(`Tab ${tabId} was removed.`);
    stopTimer(tabId, true);
  }
});

chrome.tabs.onDetached.addListener(function (tabId, detachInfo) {
  // Save the state of the tab
  if (youtubeTabs[tabId]) {
    // Include the videoCounted state in tabStateCache
    tabStateCache[tabId] = {
      ...youtubeTabs[tabId],
      videoCounted: youtubeTabs[tabId].videoCounted,
    };
    stopTimer(tabId, false); // Stop the timer but don't delete the tab entry
  }
});

chrome.tabs.onAttached.addListener(function (tabId, attachInfo) {
  // Restore the state of the tab if it exists in the cache
  if (tabStateCache[tabId]) {
    // Restore the videoCounted state along with other data
    youtubeTabs[tabId] = {
      ...tabStateCache[tabId],
      videoCounted: tabStateCache[tabId].videoCounted,
    };
    delete tabStateCache[tabId];
    if (!youtubeTabs[tabId].isRunning) {
      startOrResumeTimer(tabId, youtubeTabs[tabId].currentVideo);
    }
  }
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  // Check if the tab has finished loading
  if (
    changeInfo.status === "complete" &&
    tab.url.includes("youtube.com/watch")
  ) {
    console.log(`Tab ${tabId} has finished loading.`);
  }
  if (tab.url && tab.url.includes("youtube.com/watch")) {
    const newVideoId = new URLSearchParams(new URL(tab.url).search).get("v");
    if (youtubeTabs[tabId]?.currentVideo !== newVideoId) {
      handleNewVideo(tabId, newVideoId);
    }
  } else if (youtubeTabs[tabId]) {
    stopTimer(tabId, true);
  }
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
  // activeInfo.tabId will give the ID of the new active tab
  console.log(`Tab ${activeInfo.tabId} is now active.`);
  if (youtubeTabs[activeInfo.tabId]) {
    const isVideoOngoing =
      youtubeTabs[activeInfo.tabId].currentVideo &&
      !youtubeTabs[activeInfo.tabId].isRunning;
    if (isVideoOngoing) {
      // Resume the timer if the video is ongoing and the timer is not running
      resumeTimer(activeInfo.tabId);
    }
  }
});

// Notification Button Listener
chrome.notifications.onButtonClicked.addListener(function (
  notificationId,
  buttonIndex
) {
  if (notificationId === "notificationId") {
    if (buttonIndex === 0) {
      // User clicked 'Yes', open a new YouTube tab and show the modal
      openYouTubeTabAndShowModal();
    } else {
      // User clicked 'No' or closed the notification
    }
    chrome.notifications.clear(notificationId);
  }
});

// Listener For Closing Browser
chrome.windows.onRemoved.addListener(() => {
  // Set Focus Mode to false
  focusMode = false;
  chrome.storage.local.set({ focusMode: focusMode }, function () {
    console.log("Focus Mode turned off due to window closure.");
  });
});

function createNewTabEntry(videoId) {
  return {
    isRunning: false,
    timeSpent: 0,
    intervalId: null,
    currentVideo: videoId ? videoId : null, // Initially no video is playing
    channel: null,
    categories: [],
    videoCounted: false, // Indicates whether the current video has been counted
    countedCategories: {}, // Used to track counted categories
    videoDetails: null, // New field to store video details
  };
}

let debounceTimer;
let lastProcessedVideoId = null;

async function handleNewVideo(tabId, newVideoId) {
  try {
    const isLoggedIn = await isUserLoggedIn();
    if (!isLoggedIn) {
      console.log(
        "User is not logged in, skipping handleNewVideo(): fetchVideoDetails API fetch."
      );
      return;
    }

    if (!youtubeTabs[tabId]) {
      youtubeTabs[tabId] = createNewTabEntry();
    }

    console.log("Handling New Video!");

    const extractedVideoId = newVideoId.includes("youtube.com")
      ? new URLSearchParams(new URL(newVideoId).search).get("v")
      : newVideoId;

    if (youtubeTabs[tabId].currentVideo !== extractedVideoId) {
      console.log(`New video detected for tab ${tabId}: ${extractedVideoId}`);
      youtubeTabs[tabId].currentVideo = extractedVideoId;
      youtubeTabs[tabId].timeSpent = 0;
      youtubeTabs[tabId].videoCounted = false; // Reset video counted flag

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        console.log("awaiting fetchVideoDetails...");
        const videoInfo = await fetchVideoDetails(extractedVideoId);
        if (videoInfo) {
          const keywordAnalysis = analyzeVideoForKeywords(videoInfo);
          const videoClassification = classifyVideo(videoInfo);

          // Update tab information with new video details
          youtubeTabs[tabId].keywordAnalysis = keywordAnalysis;
          youtubeTabs[tabId].categories = [videoInfo.category];
          youtubeTabs[tabId].channel = videoInfo.channel;
          youtubeTabs[tabId].videoDetails = videoInfo;

          console.log(
            `handleNewVideo: got videoInfo, ${JSON.stringify(
              youtubeTabs[tabId].videoDetails.title
            )}, category: ${youtubeTabs[tabId].categories}, channel: ${
              youtubeTabs[tabId].channel
            }, calculated productivity score: ${JSON.stringify(
              keywordAnalysis
            )}, video classified as: ${videoClassification}`
          );

          startOrResumeTimer(tabId, extractedVideoId);
          lastProcessedVideoId = extractedVideoId;
        }
      }, 1000);
    } else {
      console.log(`Continuing with the same video: ${extractedVideoId}`);
      // Retain the existing categories and state
      youtubeTabs[tabId].categories = youtubeTabs[tabId].categories || [];
    }
  } catch (error) {
    console.error("Error checking user login status:", error);
  }
}

// Timer functions
function startOrResumeTimer(tabId, videoIdOrUrl) {
  isUserLoggedIn()
    .then((isLoggedIn) => {
      if (!isLoggedIn) {
        console.log("User not logged in. Timer not started.");
        return; // Exit if user is not logged in
      }
      if (!videoIdOrUrl || !isValidYouTubeVideo(videoIdOrUrl)) {
        console.error("Invalid YouTube video URL or ID:", videoIdOrUrl);
        return;
      }

      const videoId = videoIdOrUrl.includes("youtube.com")
        ? new URLSearchParams(new URL(videoIdOrUrl).search).get("v")
        : videoIdOrUrl;

      console.log(
        `startOrResumeTimer called for tab ${tabId} and video ${videoId}`
      );

      if (!youtubeTabs[tabId]) {
        youtubeTabs[tabId] = createNewTabEntry();
      }

      youtubeTabs[tabId].currentVideo = videoId;

      if (!youtubeTabs[tabId].isRunning) {
        youtubeTabs[tabId].isRunning = true;
        logAllTimers();
        youtubeTabs[tabId].intervalId = setInterval(() => {
          if (youtubeTabs[tabId]) {
            youtubeTabs[tabId].timeSpent++;
          } else {
            clearInterval(youtubeTabs[tabId].intervalId);
          }
        }, 1000);
      }
    })
    .catch((error) => {
      console.error("Error checking user login status:", error);
    });
}

function isValidYouTubeVideo(urlOrId) {
  // Regular expression for YouTube URL
  const urlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;

  // Regular expression for YouTube video ID
  const idRegex = /^[a-zA-Z0-9_-]{11}$/;

  return urlRegex.test(urlOrId) || idRegex.test(urlOrId);
}

let isUpdatingTotalTime = false;
let pendingTotalTimeUpdate = 0;

// Pause Timer
async function pauseTimer(tabId, videoIdOrUrl) {
  if (youtubeTabs[tabId] && youtubeTabs[tabId].isRunning) {
    youtubeTabs[tabId].isRunning = false;
    if (youtubeTabs[tabId].intervalId) {
      clearInterval(youtubeTabs[tabId].intervalId);
    }

    console.log("pause Timer tab data is:", JSON.stringify(youtubeTabs));

    // Update data
    const timeSpent = youtubeTabs[tabId].timeSpent;
    const channel = youtubeTabs[tabId].channel;
    const categories = youtubeTabs[tabId].categories;

    console.log(
      `Pausing Timer: timeSpent: ${timeSpent}, channel: ${channel}, categories: ${JSON.stringify(
        categories
      )}`
    );
    logAllTimers();

    if (timeSpent > 0) {
      updatePeriodData(timeSpent);
      const updatedWatchData = await updateAndSaveWatchData(
        tabId,
        timeSpent,
        channel,
        categories
      );
      youtubeTabs[tabId].timeSpent = 0; // Reset time spent to 0
      await saveWatchDataToLocalStorage(updatedWatchData);
    }

    handleTotalTimeUpdate();
  }
}

// Resume Timer
function resumeTimer(tabId, videoIdOrUrl) {
  isUserLoggedIn()
    .then((isLoggedIn) => {
      if (!isLoggedIn) {
        console.log("User not logged in. Timer not started.");
        return; // Exit if user is not logged in
      }
      if (!videoIdOrUrl || !isValidYouTubeVideo(videoIdOrUrl)) {
        console.error("Invalid YouTube video URL or ID:", videoIdOrUrl);
        return;
      }

      const videoId = videoIdOrUrl.includes("youtube.com")
        ? new URLSearchParams(new URL(videoIdOrUrl).search).get("v")
        : videoIdOrUrl;

      console.log(`resumeTimer called for tab ${tabId} and video ${videoId}`);

      if (!youtubeTabs[tabId]) {
        youtubeTabs[tabId] = createNewTabEntry();
      }

      youtubeTabs[tabId].currentVideo = videoId;

      if (!youtubeTabs[tabId].isRunning) {
        youtubeTabs[tabId].isRunning = true;
        logAllTimers();
        youtubeTabs[tabId].intervalId = setInterval(() => {
          if (youtubeTabs[tabId]) {
            youtubeTabs[tabId].timeSpent++;
          } else {
            clearInterval(youtubeTabs[tabId].intervalId);
          }
        }, 1000);
      }
    })
    .catch((error) => {
      console.error("Error checking user login status:", error);
    });
}

// Stop Timer
export async function stopTimer(tabId, deleteEntry = false) {
  console.log(`stopTimer called for tab ${tabId}, deleteEntry: ${deleteEntry}`);
  // Check if tab data exists
  if (youtubeTabs[tabId]) {
    youtubeTabs[tabId].isRunning = false;
    // Clear the interval first
    if (youtubeTabs[tabId].intervalId) {
      clearInterval(youtubeTabs[tabId].intervalId);
    }

    // Capture the time spent
    const timeSpent = youtubeTabs[tabId].timeSpent;
    const channel = youtubeTabs[tabId].channel;
    const categories = youtubeTabs[tabId].categories;

    if (timeSpent > 0) {
      // Update period, channel, and total time data
      updatePeriodData(timeSpent);
      const updatedWatchData = await updateAndSaveWatchData(
        tabId,
        timeSpent,
        channel,
        categories
      );
      await saveWatchDataToLocalStorage(updatedWatchData);
      sendWatchDataToServer();

      getTotalTimeFromLocalStorage()
        .then((existingTotalTime) => {
          const newTotalTime = existingTotalTime + timeSpent;
          console.log("total time BEFORE stopping TIMER: ", newTotalTime);
          return saveTotalTimeToLocalStorage(newTotalTime);
        })
        .then(() => {
          // Delete the tab entry if deleteEntry is true
          if (deleteEntry) {
            // Delete the tab entry if it exists
            if (youtubeTabs[tabId]) {
              delete youtubeTabs[tabId];
              console.log("Timer stopped and data saved for tab:", tabId);
            }
          }
        })
        .catch((error) => {
          console.error("Error updating total time:", error);
        });
    } else {
      console.log("Timer stopped, no time spent for tab:", tabId);
      // Delete the tab entry if deleteEntry is true
      if (deleteEntry) {
        // Delete the tab entry if it exists
        if (youtubeTabs[tabId]) {
          delete youtubeTabs[tabId];
          console.log(
            "no time spent, Timer stopped and data saved for tab:",
            tabId
          );
        }
      }
    }
  } else {
    console.error(`No data found for tabId ${tabId} when stopping timer.`);
  }
}

function handleTotalTimeUpdate() {
  if (isUpdatingTotalTime) return; // Skip if an update is already in progress

  isUpdatingTotalTime = true;

  getTotalTimeFromLocalStorage()
    .then((existingTotalTime) => {
      const newTotalTime = existingTotalTime + pendingTotalTimeUpdate;
      console.log("new Total time is: ", newTotalTime);
      pendingTotalTimeUpdate = 0; // Reset the pending update
      return saveTotalTimeToLocalStorage(newTotalTime);
    })
    .then(() => {
      isUpdatingTotalTime = false;
      // Handle next update if pendingTotalTimeUpdate is not zero
      if (pendingTotalTimeUpdate > 0) handleTotalTimeUpdate();
    })
    .catch((error) => {
      console.error("Error updating total time:", error);
      isUpdatingTotalTime = false;
    });
}

// Function to stop all timers and save data
export function stopAllTimersAndSaveData() {
  Object.keys(youtubeTabs).forEach((tabId) => {
    if (youtubeTabs[tabId].isRunning) {
      youtubeTabs[tabId].isRunning = false;
      stopTimer(tabId);
    }
  });
}

// Save Total Time to Local Storage
function saveTotalTimeToLocalStorage(totalTime) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ totalYoutubeTime: totalTime }, function () {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        console.log("Total YouTube time updated in local storage:", totalTime);
        resolve();
      }
    });
  });
}

// Debug all timers
function logAllTimers() {
  console.log("Current state of all timers:");
  for (const tabId in youtubeTabs) {
    if (youtubeTabs.hasOwnProperty(tabId)) {
      console.log(
        `Tab ID: ${tabId}, Time Spent: ${youtubeTabs[tabId].timeSpent} seconds, Is Running: ${youtubeTabs[tabId].isRunning}`
      );
    }
  }
}

// get Tab Data
function getTabTimerData(tabId) {
  if (!youtubeTabs[tabId]) {
    console.error(`No timer data found for tabId: ${tabId}`);
    return null; // Return null if no data is found for the specified tab ID
  }

  // Check if currentVideo is valid
  if (
    !youtubeTabs[tabId].currentVideo ||
    typeof youtubeTabs[tabId].currentVideo !== "string"
  ) {
    console.warn(`Invalid or missing video ID for tabId: ${tabId}`);
    return null;
  }

  return {
    isRunning: youtubeTabs[tabId].isRunning,
    timeSpent: youtubeTabs[tabId].timeSpent,
    currentVideo: youtubeTabs[tabId].currentVideo,
    channel: youtubeTabs[tabId].channel,
    categories: youtubeTabs[tabId].categories,
    videoDetails: youtubeTabs[tabId].videoDetails,
    // Add any other relevant data you might need from youtubeTabs
  };
}

function resetTabTimer(tabId) {
  if (!youtubeTabs[tabId]) {
    console.warn(`No timer to reset for tabId ${tabId}`);
    return;
  }
  youtubeTabs[tabId].timeSpent = 0;
  console.log(`Timer reset for tab ${tabId}`);
}

// Get Total Time from Session Storage
function getTotalTimeFromLocalStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get("totalYoutubeTime", function (data) {
      if (data.totalYoutubeTime) {
        console.log(
          "LOCAL: Total YouTube time retrieved from local storage:",
          data.totalYoutubeTime,
          "seconds"
        );
        // Resolve the promise with the retrieved total time
        resolve(parseInt(data.totalYoutubeTime));
      } else {
        console.log("LOCAL: No YouTube time recorded in local storage.");
        // Resolve the promise with 0 if no time recorded
        resolve(0);
      }
    });
  });
}

// Reset local storage cache
export function resetLocalStorage() {
  console.log("clearing All Data...");
  // Clear chrome storage
  chrome.storage.local.clear(function () {
    if (chrome.runtime.lastError) {
      console.log("Error clearing local storage:", chrome.runtime.lastError);
    } else {
      console.log("Local storage cleared.");

      // Also reset the in-memory object tracking the tabs and other user data
      youtubeTabs = {};
      watchData = {
        total: { time: 0, videos: 0 },
        daily: {
          monday: { time: 0, videos: 0 },
          tuesday: { time: 0, videos: 0 },
          wednesday: { time: 0, videos: 0 },
          thursday: { time: 0, videos: 0 },
          friday: { time: 0, videos: 0 },
          saturday: { time: 0, videos: 0 },
          sunday: { time: 0, videos: 0 },
        },
        monthly: {
          january: { time: 0, videos: 0 },
          february: { time: 0, videos: 0 },
          march: { time: 0, videos: 0 },
          april: { time: 0, videos: 0 },
          may: { time: 0, videos: 0 },
          june: { time: 0, videos: 0 },
          july: { time: 0, videos: 0 },
          august: { time: 0, videos: 0 },
          september: { time: 0, videos: 0 },
          november: { time: 0, videos: 0 },
          december: { time: 0, videos: 0 },
        },
        categories: {},
        channels: {},
        //... other existing fields
      };

      // Reset other user-related data
      totalYoutubeTime = 0;
      userId = null;
      userProfile = null;
    }
  });
}

export function fetchAndStoreUserWatchDataFromServer(userId) {
  return new Promise((resolve, reject) => {
    isUserAuthenticated()
      .then((token) => {
        if (!token) {
          console.log("User is not authenticated.");
          reject("User is not authenticated.");
          return;
        }

        fetch(`http://localhost:3000/get-watch-data/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {
            console.log("Data fetched from server:", data);
            // Process and store the data as needed
            resolve(data);
          })
          .catch((error) => {
            console.error("Error fetching data from server:", error);
            reject(error);
          });
      })
      .catch((error) => {
        console.error("Error in user authentication:", error);
        reject(error);
      });
  });
}

export function getDefaultWatchData() {
  return {
    total: { time: 0, videos: 0 },
    daily: {
      monday: { time: 0, videos: 0 },
      tuesday: { time: 0, videos: 0 },
      wednesday: { time: 0, videos: 0 },
      thursday: { time: 0, videos: 0 },
      friday: { time: 0, videos: 0 },
      saturday: { time: 0, videos: 0 },
      sunday: { time: 0, videos: 0 },
    },
    monthly: {
      january: { time: 0, videos: 0 },
      february: { time: 0, videos: 0 },
      march: { time: 0, videos: 0 },
      april: { time: 0, videos: 0 },
      may: { time: 0, videos: 0 },
      june: { time: 0, videos: 0 },
      july: { time: 0, videos: 0 },
      august: { time: 0, videos: 0 },
      september: { time: 0, videos: 0 },
      november: { time: 0, videos: 0 },
      december: { time: 0, videos: 0 },
    },
    categories: {},
    channels: {},
    countedVideos: new Set(), // Initialize as a Set
    lastUpdated: new Date().toISOString(),
    isFallbackData: true, // Flag indicating this data is a fallback
  };
}

// Ensure that onSuspend listener is working correctly:
chrome.runtime.onSuspend.addListener(() => {
  console.log("Extension is unloading. Saving data...");
  sendWatchDataToServer();
});

// Establish a connection with the popup script
chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === "popup") {
    // Send a message to indicate that the popup is opened
    console.log("Opened Extension Popup");
    port.postMessage("opened");
  }
});

getTotalTimeFromLocalStorage();

// Save current updated watch data to local storage
function saveWatchDataToLocalStorage(updatedWatchData) {
  if (!updatedWatchData || !updatedWatchData.countedVideos) {
    console.error("Invalid updatedWatchData:", updatedWatchData);
    return Promise.reject("Invalid updatedWatchData");
  }

  // Log the data being saved for debugging
  console.log("Saving updated watch data:", updatedWatchData);

  // Convert the Set to an Array for storage
  const storageData = {
    ...updatedWatchData,
    countedVideos: Array.from(updatedWatchData.countedVideos),
    lastUpdated: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ watchData: storageData }, function () {
      if (chrome.runtime.lastError) {
        console.error("Error saving data:", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log("Watch data saved to storage:", storageData);
        resolve();
      }
    });
  });
}

// Update and save watch data
async function updateAndSaveWatchData(tabId, timeSpent, channel, categories) {
  const isLoggedIn = await isUserLoggedIn();
  if (!isLoggedIn) {
    console.log("User not logged in. Data not updated.");
    return null; // Exit if user is not logged in
  }

  if (!youtubeTabs[tabId]) {
    console.error("Tab data not found for tabId:", tabId);
    return null; // Early exit if the tab data is not found
  }

  if (!channel || !Array.isArray(categories) || categories.length === 0) {
    console.log("Refetching video details for tab:", tabId);
    const videoDetails = await fetchVideoDetails(
      youtubeTabs[tabId].currentVideo
    );
    if (videoDetails && videoDetails.items && videoDetails.items.length > 0) {
      channel = videoDetails.items[0].snippet.channelTitle;
      categories = [videoDetails.items[0].snippet.categoryId];
      youtubeTabs[tabId].channel = channel;
      youtubeTabs[tabId].categories = categories;
    } else {
      console.error("Failed to fetch video details for tab:", tabId);
      return null; // Exit if video details could not be fetched
    }
  }

  console.log(
    "updateAndSaveWatchData(): Updating watch data with time spent:",
    timeSpent,
    "channel:",
    channel,
    "categories:",
    categories
  );

  console.log("Entering updateAndSaveWatchData");

  let updatedWatchData;

  // Fetch the latest watch data from local storage
  const latestWatchData = await getWatchDataFromLocalStorage();

  console.log("Latest watch data:", latestWatchData);

  // Check if video has already been counted
  if (!youtubeTabs[tabId].videoCounted) {
    updatedWatchData = combineWatchData(
      [
        {
          timeSpent,
          channel,
          categories,
          videoId: youtubeTabs[tabId].currentVideo,
        },
      ],
      latestWatchData
    );

    if (updatedWatchData) {
      await saveWatchDataToLocalStorage(updatedWatchData);
      youtubeTabs[tabId].videoCounted = true;
    } else {
      console.error("Failed to update watch data for tabId:", tabId);
      return null; // Exit if updatedWatchData is undefined or invalid
    }
  } else {
    console.log("Video already counted for tabId:", tabId);
    updatedWatchData = latestWatchData; // Use the latest data without modification
  }

  // Return the updated watch data
  return updatedWatchData;
}

// Only call this function if you want to increment category video count
function updateCategoryData(tabId, category, timeSpent) {
  console.log(
    `Called updateCategoryData with tabId: ${tabId}, category: ${category}, timeSpent: ${timeSpent}`
  );
  if (!category) {
    console.error("No category ID provided for updating data.");
    return;
  }

  // Check if the video has been counted for this category
  if (!youtubeTabs[tabId].countedCategories[category]) {
    if (!watchData.categories[category]) {
      watchData.categories[category] = { time: 0, videos: 1 }; // Initialize with this video
    } else {
      watchData.categories[category].videos++; // Increment the videos count
    }
    youtubeTabs[tabId].countedCategories[category] = true; // Mark this category as counted for this video
  }

  // Always update the time spent
  watchData.categories[category].time += timeSpent;

  console.log(
    `Updated category data for ${category}: `,
    watchData.categories[category]
  );
}

function updatePeriodData(timeSpent) {
  if (isNaN(timeSpent) || timeSpent == null) {
    console.error("Invalid timeSpent value:", timeSpent);
    return;
  }

  let dayOfWeek = new Date()
    .toLocaleString("en-us", { weekday: "long" })
    .toLowerCase();

  // Update last update date
  watchData.lastUpdate = new Date().toISOString();

  console.log("updatePeriodData is:", watchData.daily[dayOfWeek]);
}

// Reset Period function
function resetDataIfNewPeriod() {
  chrome.storage.local.get(["watchData"], function (result) {
    const watchData = result.watchData || {};
    const today = new Date();
    const lastUpdateDate = new Date(watchData.lastUpdated || today);

    if (
      getStartOfWeek(today).getTime() !==
      getStartOfWeek(lastUpdateDate).getTime()
    ) {
      const daysOfWeek = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      daysOfWeek.forEach((day) => {
        watchData.daily[day] = { time: 0, videos: 0 };
      });

      watchData.categories = {};
      watchData.channels = {};

      watchData.lastUpdated = today.toISOString(); // Update the lastUpdated field

      // Save the reset watchData
      chrome.storage.local.set({ watchData: watchData });
    }
  });
}

// Function to check if user is logged in
export function isUserLoggedIn() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("userId", function (data) {
      if (chrome.runtime.lastError) {
        console.log("User is not logged in!");
        console.error("Error retrieving user ID:", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve(data.userId != null);
      }
    });
  });
}

// Function to collect and save watch data from all tabs
async function saveWatchDataFromAllTabs() {
  try {
    let existingWatchData = await getWatchDataFromLocalStorage();

    if (!existingWatchData || typeof existingWatchData !== "object") {
      existingWatchData = getDefaultWatchData();
    }

    const tabs = await chrome.tabs.query({});

    // Filter out tabs that are not on YouTube watch pages or don't have timer data
    const validTabs = tabs.filter(
      (tab) =>
        tab.url && tab.url.includes("youtube.com/watch") && youtubeTabs[tab.id]
    );

    const watchDataArray = validTabs.map((tab) => getTabTimerData(tab.id));

    // Combine existing data with new data
    const combinedWatchData = combineWatchData(
      watchDataArray,
      existingWatchData
    );

    // Save the combined data
    await saveWatchDataToLocalStorage(combinedWatchData);

    // Reset the timers for valid tabs
    validTabs.forEach((tab) => resetTabTimer(tab.id));

    return combinedWatchData;
  } catch (error) {
    console.error("Error in saveWatchDataFromAllTabs:", error);
    throw error;
  }
}

// Combine watch data from all tabs
function combineWatchData(watchDataArray, existingWatchData) {
  const combined = existingWatchData || getDefaultWatchData();

  // Ensure that countedVideos is a Set
  combined.countedVideos =
    combined.countedVideos instanceof Set
      ? combined.countedVideos
      : new Set(combined.countedVideos || []);

  watchDataArray.forEach((tabData) => {
    const videoId = tabData.videoId ?? tabData.currentVideo; // Use videoId directly as it should be passed in tabData

    if (!videoId) {
      console.warn("Invalid or missing video ID, skipping:", tabData);
      return;
    }

    console.log("Processing video ID:", videoId);

    // Update total time
    const prevTotalTime = combined.total.time;
    combined.total.time += tabData.timeSpent;
    console.log(
      `Total time updated from ${prevTotalTime} to ${combined.total.time}`
    );

    // Update daily data
    let dayOfWeek = new Date()
      .toLocaleString("en-us", { weekday: "long" })
      .toLowerCase();
    combined.daily[dayOfWeek] = combined.daily[dayOfWeek] || {
      time: 0,
      videos: 0,
    };
    const prevDailyTime = combined.daily[dayOfWeek].time;
    combined.daily[dayOfWeek].time += tabData.timeSpent;
    console.log(
      `Daily time for ${dayOfWeek} updated from ${prevDailyTime} to ${combined.daily[dayOfWeek].time}`
    );

    // Update monthly data
    const currentMonthKey = new Date()
      .toLocaleString("en-us", { month: "long" })
      .toLowerCase();
    combined.monthly[currentMonthKey] = combined.monthly[currentMonthKey] || {
      time: 0,
      videos: 0,
    };
    const prevMonthlyTime = combined.monthly[currentMonthKey].time;
    combined.monthly[currentMonthKey].time += tabData.timeSpent;
    console.log(
      `Monthly time for ${currentMonthKey} updated from ${prevMonthlyTime} to ${combined.monthly[currentMonthKey].time}`
    );

    // Check if video is new for counting
    const isNewVideo = !combined.countedVideos.has(videoId);

    if (isNewVideo) {
      combined.total.videos++;
      combined.daily[dayOfWeek].videos++;
      combined.monthly[currentMonthKey].videos++;
      combined.countedVideos.add(videoId);
    }

    // Update categories and channels
    tabData.categories?.forEach((category) => {
      combined.categories[category] = combined.categories[category] || {
        time: 0,
        videos: 0,
      };
      combined.categories[category].time += tabData.timeSpent;
      if (isNewVideo) {
        combined.categories[category].videos++;
      }
    });

    if (tabData.channel) {
      combined.channels[tabData.channel] = combined.channels[
        tabData.channel
      ] || { time: 0, videos: 0, categories: {} };
      combined.channels[tabData.channel].time += tabData.timeSpent;

      if (isNewVideo) {
        combined.channels[tabData.channel].videos++;
      }

      tabData.categories?.forEach((category) => {
        combined.channels[tabData.channel].categories[category] = combined
          .channels[tabData.channel].categories[category] || {
          time: 0,
          videos: 0,
        };
        combined.channels[tabData.channel].categories[category].time +=
          tabData.timeSpent;
        if (isNewVideo) {
          combined.channels[tabData.channel].categories[category].videos++;
        }
      });
    }
  });

  return combined;
}

// Set an interval for periodic sync (e.g., every 15 minutes)
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

function periodicDataSync() {
  // Check if data needs to be reset for a new period before syncing
  resetDataIfNewPeriod();

  isUserLoggedIn()
    .then((isLoggedIn) => {
      if (isLoggedIn) {
        console.log("User is logged in, initiating auto save...");
        saveWatchDataFromAllTabs()
          .then((combinedWatchData) => {
            if (isValidWatchData(combinedWatchData)) {
              sendWatchDataToServer(combinedWatchData);
            } else {
              console.log("Invalid watch data, skipping sync.");
            }
          })
          .catch((error) =>
            console.error("Error in saving watch data:", error)
          );
      } else {
        console.log("User is not logged in, skipping auto save.");
      }
    })
    .catch((error) => {
      console.error("Error checking login status:", error);
    });
}

// Periodic data sync
// Set the interval for periodic sync
setInterval(periodicDataSync, SYNC_INTERVAL_MS);

function getWatchDataFromLocalStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["watchData", "userId"], function (result) {
      if (chrome.runtime.lastError) {
        console.error("Error retrieving data:", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }

      // Default watchData if not present
      let watchData = result.watchData || getDefaultWatchData();

      // Reject only if userId is missing
      if (!result.userId) {
        reject(new Error("userId is missing"));
        return;
      }

      // Ensure countedVideos is iterable before converting to Set
      watchData.countedVideos = Array.isArray(watchData.countedVideos)
        ? new Set(watchData.countedVideos)
        : new Set();

      console.log("getWatchDataFromLocalStorage(): ", result);
      resolve(watchData);
    });
  });
}

function addVideoToCountedVideos(videoId, watchData) {
  // Ensure countedVideos is a Set
  if (!watchData.countedVideos) {
    watchData.countedVideos = new Set();
  }

  // Add the video ID if it's not already present
  if (!watchData.countedVideos.has(videoId)) {
    watchData.countedVideos.add(videoId);
  } else {
    console.log(`Video ID ${videoId} is already in countedVideos`);
  }
}

// Function to send watch data to the server
export async function sendWatchDataToServer() {
  try {
    if (!navigator.onLine) {
      throw new Error("No network connection. Cannot send data to server.");
    }

    const watchData = await getWatchDataFromLocalStorage();
    const userId = await getUserId();

    console.log(
      "sendWatchDataToServer: watchData before sending to server:",
      watchData
    );

    if (!watchData || typeof watchData !== "object" || !watchData.lastUpdated) {
      console.warn("watchData is invalid or missing lastUpdated property.");
      return;
    }

    const response = await fetch(
      `http://localhost:3000/get-server-timestamp/${userId}`
    );
    if (!response.ok) {
      throw new Error(`Error fetching server timestamp: ${response.status}`);
    }
    const serverTimestamp = await response.json();

    // Proceed with sending data to server if server timestamp is invalid or local data is newer
    if (
      !serverTimestamp ||
      !serverTimestamp.timestamp ||
      new Date(watchData.lastUpdated) > new Date(serverTimestamp.timestamp)
    ) {
      const serverUrl = "http://localhost:3000/save-watch-data";
      const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          watchData: watchData,
        }),
        credentials: "include",
      };

      const postResponse = await fetch(serverUrl, requestOptions);
      if (!postResponse.ok) {
        throw new Error(`Server responded with status: ${postResponse.status}`);
      }

      const responseData = await postResponse.json();
      console.log("Data successfully sent to server:", responseData);
      return responseData;
    } else {
      console.log("Server data is more recent or equal, skipping update.");
    }
  } catch (error) {
    console.error("Error in sendWatchDataToServer:", error);
    throw error;
  }
}

// Get watch data from server function
export async function getWatchDataFromServer() {
  try {
    const isLoggedIn = await isUserLoggedIn();
    if (!isLoggedIn) {
      console.log("User is not logged in. Cannot fetch watch data.");
      throw new Error("User not logged in");
    }

    const userId = await getUserId();
    if (!userId) {
      console.log("No user ID found.");
      throw new Error("No user ID found");
    }

    const url = `http://localhost:3000/get-watch-data/${userId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const serverData = await response.json();
    console.log("Server response data:", serverData);

    if (!isValidWatchData(serverData)) {
      console.log(
        "Server data is invalid. Initializing with default empty data."
      );
      return getDefaultWatchData();
    }

    console.log("Using server data.");
    chrome.storage.local.set({ watchData: serverData, userId: userId });
    return serverData;
  } catch (error) {
    console.warn("Error fetching watch data:", error);
    chrome.runtime.sendMessage({
      action: "displayError",
      message: "Failed to fetch data from the server. Please try again later.",
    });

    // Only return default data if user is logged in but there's an error fetching server data
    if (
      error.message === "User not logged in" ||
      error.message === "No user ID found"
    ) {
      return null;
    } else {
      return getDefaultWatchData();
    }
  }
}

export async function getWatchDataFromServerWithResponse() {
  try {
    const isLoggedIn = await isUserLoggedIn();
    if (!isLoggedIn) {
      console.log("User is not logged in. Cannot fetch watch data.");
      return { success: false, message: "User not logged in" };
    }

    const userId = await getUserId();
    if (!userId) {
      console.log("No user ID found.");
      return { success: false, message: "No user ID found" };
    }

    const url = `http://localhost:3000/get-watch-data/${userId}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const serverData = await response.json();
    console.log(
      "getWatchDataFromServerWithResponse(): Server response data:",
      serverData
    );

    if (!isValidWatchData(serverData)) {
      console.log(
        "Server data is invalid. Initializing with default empty data."
      );
      return getDefaultWatchData();
    }

    console.log("Using server data.");
    chrome.storage.local.set({ watchData: serverData, userId: userId });

    return { success: true, data: serverData };
  } catch (error) {
    console.warn("Error fetching watch data:", error);
    return {
      success: false,
      message: "Failed to fetch data from the server. Please try again later.",
    };
  }
}

function isValidWatchData(data) {
  return (
    data &&
    data.total &&
    typeof data.total.time === "number" &&
    data.daily &&
    typeof data.daily === "object" &&
    data.monthly &&
    typeof data.monthly === "object"
    // Add other necessary checks based on your data structure
  );
}

async function getUserId() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("userId", function (data) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(data.userId);
      }
    });
  });
}

function getFocusModeStatus() {
  chrome.storage.local.get(["focusMode"], function (result) {
    focusMode = result.focusMode || false; // Default to false if not set
    console.log("Focus Mode state is set to: " + focusMode);
  });
}

getWatchDataFromServer();
getFocusModeStatus();
