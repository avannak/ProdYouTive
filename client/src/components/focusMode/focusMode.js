// focusMode functions to be called in the Content Script to modify DOM elements

// Function to check if a video should be hidden
export function shouldHideVideo(videoElement) {
  const videoId = extractVideoIdFromElement(videoElement);
  return videoClassifications[videoId] === "Distracting";
}

// Update visibility of videos
export function updateVideoVisibility() {
  const videos = document.querySelectorAll("ytd-video-renderer");
  videos.forEach((video) => {
    const videoId = extractVideoIdFromElement(video);
    if (videoId && videoClassifications[videoId] === "Distracting") {
      video.style.display = "none"; // Hide the video
      console.log("Hiding video: ", video, videoId);
    } else {
      video.style.display = ""; // Show the video
    }
  });
}

// Extract video ID from the video element
function extractVideoIdFromElement(videoElement) {
  const link = videoElement.querySelector("a#video-title")?.href;
  return link ? new URL(link).searchParams.get("v") : null;
}
