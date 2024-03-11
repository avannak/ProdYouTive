import {
  createModal,
  hideModal,
  loadModalCSS,
  onConfirmDuration,
  onOpenNewTab,
  showModal,
} from "./components/modal/modal";

let currentVideoId = null;
let videoPlayer = null;
let isSeeking = false;

function isYouTube() {
  return window.location.href.includes("youtube.com/");
}

function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("v");
}

function captureVideoInfo() {
  const videoTitleElement = document.querySelector("#container h1.title");
  const videoChannelElement = document.querySelector(
    "ytd-video-owner-renderer #text > a"
  );
  const videoDescriptionElement = document.querySelector(
    'meta[name="description"]'
  );

  if (videoTitleElement && videoChannelElement && videoDescriptionElement) {
    let videoId = getVideoId();
    const videoInfo = {
      title: videoTitleElement.innerText.trim(),
      channel: videoChannelElement.innerText.trim(),
      description: videoDescriptionElement.getAttribute("content"),
      id: videoId,
    };

    chrome.runtime.sendMessage({ message: "videoInfo", data: videoInfo });
  }
}

function attachVideoEventListeners() {
  if (!videoPlayer) return;

  videoPlayer.addEventListener("play", () => {
    const videoId = getVideoId();
    if (currentVideoId !== videoId) {
      currentVideoId = videoId;
      chrome.runtime.sendMessage({ message: "video-play", videoId: videoId });
    }
  });

  videoPlayer.addEventListener("pause", () => {
    const videoId = getVideoId();
    if (currentVideoId !== videoId) {
      currentVideoId = videoId;
      chrome.runtime.sendMessage({ message: "pauseTimer", videoId: videoId });
    }
  });

  videoPlayer.addEventListener("seeking", () => {
    isSeeking = true;
    const videoId = getVideoId();
    if (currentVideoId !== videoId) {
      currentVideoId = videoId;
      chrome.runtime.sendMessage({ message: "pauseTimer", videoId: videoId });
    }
  });

  videoPlayer.addEventListener("seeked", () => {
    const videoId = getVideoId();
    if (currentVideoId !== videoId) {
      currentVideoId = videoId;
      if (!videoPlayer.paused && isSeeking) {
        chrome.runtime.sendMessage({
          message: "resumeTimer",
          videoId: videoId,
        });
        isSeeking = false;
      }
    }
  });
}

function isAdPlaying() {
  return document.querySelector("div.ad-showing") !== null;
}

function handlePlayerStateChange() {
  if (!videoPlayer || !isYouTube()) return;

  if (isAdPlaying()) {
    chrome.runtime.sendMessage({ message: "pauseTimer" });
  } else {
    const state = videoPlayer.paused ? 2 : 1;
    chrome.runtime.sendMessage({ message: "playerState", state: state });
  }
}

let cleanupIdsInterval;

function initializeContentScript() {
  console.log("Content script initializing...");

  // Check if on a YouTube page
  if (!isYouTube()) {
    console.log("Not a YouTube page. Initialization stopped.");
    return;
  }
  // applyBlurEffectImmediately();

  // Check Feed
  checkFocusModeStatusAndInitialize();

  // Initialize only once operations
  if (cleanupIdsInterval) {
    clearInterval(cleanupIdsInterval);
  }
  cleanupIdsInterval = setInterval(
    cleanupProcessedVideoIds,
    24 * 60 * 60 * 1000
  ); // Cleanup every 24 hours

  // Check for the video player and attach event listeners if found
  videoPlayer = document.querySelector("video");
  if (videoPlayer && !videoPlayer.initialized) {
    console.log("Video player found. Attaching event listeners.");
    attachVideoEventListeners();
    videoPlayer.initialized = true;
    captureVideoInfo();
    videoPlayer.addEventListener("playing", handlePlayerStateChange);
    videoPlayer.addEventListener("pause", handlePlayerStateChange);
    videoPlayer.addEventListener("ended", handlePlayerStateChange);
  } else if (!videoPlayer) {
    console.log("Video player not found.");
  }

  // Set up the start focus mode button event listener
  const startFocusModeBtn = document.getElementById("startFocusMode");
  if (startFocusModeBtn) {
    startFocusModeBtn.addEventListener("click", () => {
      onConfirmDuration(focusModeModal);
    });
  }

  // Update the focus mode status
  updateFocusModeStatus();
}

// Improved Observer Setup
const videoContainerSelector = "div#primary > ytd-rich-grid-renderer"; // Adjust as needed
const videoContainer = document.querySelector(videoContainerSelector);

// Initialize Setup Once
const BATCH_SIZE = 50;
const BATCH_INTERVAL = 30000; // 30 seconds
let videoIdBatch = [];
let processedVideoIds = new Set(); // Set to track processed video IDs
let processedVideoDates = {}; // Set to track processed video ID Dates
let videoClassifications = {}; // Map video IDs to their classifications
let isFocusModeOn = false;
let blurEffectInterval;

// Check Focus Mode Status Immediately
function checkFocusModeStatusAndInitialize() {
  if (isFocusModeOn) {
    observeVideoLoads(); // Start observing for new video loads
  }

  loadAndApplyClassifications(); // Load classifications and recheck videos
}

function debounce(func, delay) {
  let inDebounce;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(inDebounce);
    inDebounce = setTimeout(() => func.apply(context, args), delay);
  };
}

// Home Page and Search Page Selector Observer
const homePageSelector =
  "div#primary > ytd-rich-grid-renderer ytd-rich-item-renderer, div#primary > ytd-rich-grid-renderer ytd-video-renderer";
const searchPageSelector =
  "ytd-section-list-renderer ytd-rich-item-renderer, ytd-section-list-renderer ytd-video-renderer";

function observeVideoLoads() {
  // Clear any existing interval
  if (blurEffectInterval) {
    clearInterval(blurEffectInterval);
  }

  const homePageContainer = document.querySelector(homePageSelector);
  const searchPageContainer = document.querySelector(searchPageSelector);
  console.log("Search Page Container: ", searchPageContainer);

  const observerCallback = (mutations) => {
    console.log("Mutation observed"); // Debugging line
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        console.log("Applying blur effect immediately"); // Debugging line
        applyBlurEffectImmediately();
        handleVideoScraping();
      }
    });
  };

  const observerOptions = { childList: true, subtree: true };

  if (homePageContainer) {
    const homeObserver = new MutationObserver(observerCallback);
    homeObserver.observe(homePageContainer, observerOptions);
  }

  if (searchPageContainer) {
    const searchObserver = new MutationObserver(observerCallback);
    searchObserver.observe(searchPageContainer, observerOptions);
  }

  // Additional interval-based check to cover rapid dynamic changes
  blurEffectInterval = setInterval(applyBlurEffectImmediately, 100);
}

// Update visibility of videos
function updateVideoVisibility() {
  const videos = document.querySelectorAll(
    "ytd-rich-item-renderer, ytd-video-renderer"
  );

  videos.forEach((video) => {
    const videoId = extractVideoIdFromElement(video);
    if (videoId && videoClassifications[videoId] !== "Productive") {
      video.style.display = "none";
    } else {
      video.style.display = ""; // Show videos after classification
    }
  });
}

// Apply Blur Effect Function
function applyBlurEffect() {
  if (!isFocusModeOn) {
    console.log("Focus Mode is off, skipping blur effect.");
    return;
  }
  // Selectors for home page and search results page
  const homePageSelector =
    "div#primary > ytd-rich-grid-renderer ytd-rich-item-renderer, div#primary > ytd-rich-grid-renderer ytd-video-renderer";
  const searchPageSelector =
    "ytd-section-list-renderer ytd-rich-item-renderer, ytd-section-list-renderer ytd-video-renderer";

  // Query videos from both home page and search results page
  const videos = document.querySelectorAll(
    `${homePageSelector}, ${searchPageSelector}`
  );

  videos.forEach((video) => {
    const videoId = extractVideoIdFromElement(video);
    if (videoId) {
      if (videoClassifications[videoId] !== "Productive") {
        video.classList.add("blur-video", "blurred");
      } else {
        video.classList.remove("blur-video");
      }
      video.style.display = ""; // Show the video
    }
  });
}

// Function to apply blur effect immediately to all video elements
function applyBlurEffectImmediately() {
  if (!isFocusModeOn) {
    console.log("Focus Mode is off, skipping blur effect.");
    return;
  }

  const videos = document.querySelectorAll(
    `${homePageSelector}, ${searchPageSelector}`
  );

  videos.forEach((video) => {
    const videoId = extractVideoIdFromElement(video);
    if (videoId) {
      if (videoClassifications[videoId] !== "Productive") {
        video.classList.add("blur-video", "blurred");
      } else {
        video.classList.remove("blur-video", "blurred");
      }
    } else {
      // If videoId is not found, or not yet classified, apply blur
      video.classList.add("blur-video", "blurred");
    }

    if (document.activeElement === video) {
      video.blur();
    }
  });
}

// Extract video ID from the video element
function extractVideoIdFromElement(videoElement) {
  // Adjust the selector if necessary
  const linkElement = videoElement.querySelector(
    "a#video-title-link, a#video-title"
  );
  if (!linkElement) {
    console.log("Link element not found in video element:", videoElement);
    return null;
  }

  const href = linkElement.href;
  if (!href) {
    console.log("Href not found in link element:", linkElement);
    return null;
  }

  const url = new URL(href);
  const videoId = url.searchParams.get("v");

  if (!videoId) {
    console.log("Video ID not found in URL:", href);
  } else {
    console.log("Extracted video ID:", videoId);
  }

  return videoId;
}

// Function to check if video ID has already been processed
function isVideoIdProcessed(videoId) {
  return processedVideoIds.has(videoId);
}

// Function to add a video ID to the batch
function addToBatch(videoId) {
  // Check if the video ID is already processed
  if (!isVideoIdProcessed(videoId)) {
    videoIdBatch.push(videoId);
    processedVideoIds.add(videoId); // Mark the video ID as processed
    processedVideoDates[videoId] = new Date(); // Record the processing date

    console.log("Added video ID to batch:", videoId);

    if (videoIdBatch.length >= BATCH_SIZE) {
      console.log("Batch size reached, sending batch:", videoIdBatch);
      sendBatchToAPI(videoIdBatch);
      videoIdBatch = [];
    }
  }
}

// Scrape Video Data from both home and search feeds
function scrapeVideoData() {
  // Selectors for home page and search results page videos
  const homePageVideosSelector =
    "div#primary > ytd-rich-grid-renderer ytd-rich-item-renderer:not(.processed), div#primary > ytd-rich-grid-renderer ytd-video-renderer:not(.processed)";
  const searchPageVideosSelector =
    "ytd-section-list-renderer ytd-rich-item-renderer:not(.processed), ytd-section-list-renderer ytd-video-renderer:not(.processed)";

  // Query videos from both home page and search results page
  const videoElements = document.querySelectorAll(
    `${homePageVideosSelector}, ${searchPageVideosSelector}`
  );

  console.log("Found video elements:", videoElements.length); // Log the number of video elements found

  return Array.from(videoElements).map((videoElement) => {
    // Mark the element as processed to avoid duplicate processing
    videoElement.classList.add("processed");
    videoElement.style.display = "none"; // Initially hide videos for processing

    // Extract relevant data from the video elements
    const titleElement = videoElement.querySelector(
      "#video-title-link, #video-title"
    );
    const channelElement = videoElement.querySelector(
      "#channel-name, .ytd-channel-name"
    );
    const thumbnailElement = videoElement.querySelector("#img");

    let videoId = null;
    if (titleElement && titleElement.href) {
      const urlParams = new URLSearchParams(new URL(titleElement.href).search);
      videoId = urlParams.get("v");
    }

    // Log details for debugging
    console.log("Title:", titleElement?.textContent.trim() || "N/A");
    console.log("Channel:", channelElement?.textContent.trim() || "N/A");
    console.log("Thumbnail URL:", thumbnailElement?.src || "N/A");
    console.log("Video ID:", videoId || "N/A");

    return {
      title: titleElement?.textContent.trim() || "",
      channel: channelElement?.textContent.trim() || "",
      thumbnailUrl: thumbnailElement?.src || "",
      videoId: videoId,
    };
  });
}

// Handle Sending Scraped Data for Videos To Background Script
function handleVideoScraping() {
  if (!isFocusModeOn) {
    console.log("Focus mode not on, video scraping disabled...");
    return;
  }
  const videoData = scrapeVideoData();
  videoData.forEach((video) => {
    if (video.videoId && !isVideoIdProcessed(video.videoId)) {
      addToBatch(video.videoId);
    }
  });
  console.log("Sending scraped video data to background script", videoData);
  chrome.runtime.sendMessage({
    action: "scrapedVideoData",
    data: videoData,
  });
}

// Send batched video IDs to Background Script to call API
function sendBatchToAPI(videoIds) {
  if (isFocusModeOn) {
    console.log("Sending batch to API:", videoIds);
    chrome.runtime.sendMessage({ action: "processVideoBatch", data: videoIds });

    // Mark these video IDs as processed
    videoIds.forEach((id) => processedVideoIds.add(id));
  } else {
    console.log("Focus Mode is off. Skipping API call for batch:", videoIds);
  }
}

function loadAndApplyClassifications() {
  chrome.storage.local.get(["videoClassifications"], function (result) {
    if (result.videoClassifications) {
      videoClassifications = result.videoClassifications;
      applyBlurEffectImmediately();
    }
  });
}

function cleanupProcessedVideoIds() {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - 7); // Example: 7 days old

  Object.keys(processedVideoDates).forEach((id) => {
    if (shouldRemoveVideoId(id, thresholdDate)) {
      delete processedVideoDates[id]; // Remove the entry from the map
      processedVideoIds.delete(id); // Remove the ID from the set
    }
  });
}

function shouldRemoveVideoId(id, thresholdDate) {
  return processedVideoDates[id] && processedVideoDates[id] < thresholdDate;
}

// Creating the Focus Mode Modal
const focusModeModal = createModal(
  "focusModeModal",
  `
<div class="modal-content">
 <span class="close">&times;</span>
 <h2>Set Focus Mode Duration</h2>
 <p>Select how long you want Focus Mode to be active:</p>
 <select id="focusModeDuration">
     <option value="15">15 minutes</option>
     <option value="30">30 minutes</option>
     <option value="45">45 minutes</option>
     <option value="60">1 hour</option>
     <option value="custom">Custom</option>
 </select>
 <button id="startFocusMode">Start Focus Mode</button>
</div>
`
);

// Add event listeners for Focus Mode Modal
focusModeModal
  .querySelector(".close")
  .addEventListener("click", () => hideModal(focusModeModal));

// Create the New Open Youtube Tab Modal
const newYoutubeTabModal = createModal(
  "newYoutubeTabModal",
  `
<div class="modal-content">
<span class="close">&times;</span>
<p>No YouTube tab is open. Would you like to open one to enable Focus Mode?</p>
<button id="yesBtn">Yes</button>
<button id="noBtn">No</button>
</div>
`
);

// Add event listeners for the New YouTube Tab Modal
newYoutubeTabModal
  .querySelector(".close")
  .addEventListener("click", () => hideModal(newYoutubeTabModal));
newYoutubeTabModal
  .querySelector("#yesBtn")
  .addEventListener("click", () => onOpenNewTab(newYoutubeTabModal));
newYoutubeTabModal
  .querySelector("#noBtn")
  .addEventListener("click", () => hideModal(newYoutubeTabModal));

// Function to check sign-in status and update the display of sign-in message
function updateSignInMessage(isSignedIn) {
  const displayStyle = isSignedIn ? "none" : "block";
  const signInMessages = document.querySelectorAll("div.signInMessage");
  signInMessages.forEach((div) => {
    div.style.display = displayStyle;
  });
}

// Request sign-in status from background script
chrome.runtime.sendMessage(
  { action: "checkSignInStatus" },
  function (response) {
    if (response && typeof response.signedIn !== "undefined") {
      updateSignInMessage(response.signedIn);
    } else {
      console.error("Error or no response received for checkSignInStatus");
      updateSignInMessage(false); // Show sign-in message as default
    }
  }
);

// Message handler
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "openFocusModeModal") {
    showModal(focusModeModal);
  } else if (request.action === "promptOpenYouTube") {
    console.log("OPEN NEW YOUTUBE MODAL");
    showModal(newYoutubeTabModal);
  } else if (request.action === "updateClassifications") {
    console.log(
      "Response from background: Update Video Classifications:",
      request.classifiedVideos
    );

    // Ensure that the request contains an array of classified videos
    if (Array.isArray(request.classifiedVideos)) {
      videoClassifications = request.classifiedVideos.reduce((acc, video) => {
        if (
          video &&
          video.videoId &&
          typeof video.classification === "string"
        ) {
          acc[video.videoId] = video.classification;
        }
        return acc;
      }, {});
      // Load existing classifications and merge with new data
      chrome.storage.local.get("videoClassifications", (result) => {
        const existingClassifications = result.videoClassifications || {};
        const newClassifications = request.classifiedVideos.reduce(
          (acc, video) => {
            acc[video.videoId] = video.classification;
            return acc;
          },
          {}
        );

        // Merge and save the classifications
        const updatedClassifications = {
          ...existingClassifications,
          ...newClassifications,
        };
        chrome.storage.local.set({
          videoClassifications: updatedClassifications,
        });

        // Update the local copy of classifications and apply blur effect
        videoClassifications = updatedClassifications;
        // Update blur effect based on new classifications
        updateVideoBlurStatus();
        applyBlurEffectImmediately();
      });
    }
  } else if (request.action === "reloadPageForFocusMode") {
    console.log("Focus Mode state changed. Reloading page.");
    window.location.reload();
  }
});

// Update blur effect based on new classifications
function updateVideoBlurStatus() {
  document
    .querySelectorAll("ytd-rich-item-renderer, ytd-video-renderer")
    .forEach((video) => {
      const videoId = extractVideoIdFromElement(video);

      if (videoId && videoClassifications[videoId] === "Productive") {
        video.classList.remove("blur-video", "blurred");
      }
    });
}

// Function to get Focus Mode Status and update isFocusModeOn variable
function updateFocusModeStatus() {
  chrome.storage.local.get(["focusMode"], function (result) {
    isFocusModeOn = result.focusMode || false;
    console.log("Focus Mode state is set to: " + isFocusModeOn);

    // Only apply blur effect and scrape videos when focus mode is active
    if (isFocusModeOn) {
      loadAndApplyClassifications();
      handleVideoScraping();
    }
  });
}
// Load Styles
loadModalCSS();

function loadContentScriptCSS() {
  const link = document.createElement("link");
  link.href = chrome.runtime.getURL("client/src/contentScript.css");
  link.type = "text/css";
  link.rel = "stylesheet";
  (document.head || document.documentElement).appendChild(link);
}

loadContentScriptCSS();

// Initialize
applyBlurEffectImmediately();
initializeContentScript();
observeVideoLoads();
