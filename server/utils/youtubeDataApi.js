import { classifyMultipleVideos } from "../../client/src/utils/textAnalysis";
import config from "../config/config";

const YOUTUBE_API_KEY = config.YOUTUBE_API_KEY;

async function fetchVideoDetails(videoId) {
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails,statistics`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const videoDetails = await response.json();

    if (videoDetails.items.length > 0) {
      const videoItem = videoDetails.items[0];
      const videoInfo = {
        title: videoItem.snippet.title,
        channel: videoItem.snippet.channelTitle,
        category: videoItem.snippet.categoryId,
        description: videoItem.snippet.description,
        tags: videoItem.snippet.tags || [], // Some videos may not have tags
        duration: videoItem.contentDetails.duration,
        thumbnailUrl: videoItem.snippet.thumbnails.default.url,
        // Add other relevant details
      };
      return videoInfo;
    } else {
      console.log("No video details found for video ID:", videoId);
      return null;
    }
  } catch (error) {
    console.error("Error fetching video details:", error);
    return null;
  }
}

async function fetchVideoDetailsByBatch(videoIds) {
  const baseUrl = "https://www.googleapis.com/youtube/v3/videos";
  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    id: videoIds.join(","),
    key: YOUTUBE_API_KEY,
  });

  const url = `${baseUrl}?${params.toString()}`;

  console.log("Sending YouTube API Request:", url); // Log the request URL

  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("YouTube API Response Data:", data); // Detailed response data

      const classifiedVideos = classifyMultipleVideos(data.items);
      console.log(
        "fetchVideoDetailsByBatch(): Classified Videos:",
        classifiedVideos
      );

      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "updateClassifications",
            classifiedVideos: classifiedVideos,
          });
        }
      });
    })
    .catch((error) => {
      console.error("Error fetching YouTube data:", error);
      // It might be helpful to also log the actual response or error details
      // if they are available in the error object.
    });
}

async function fetchCategoryName(categoryId) {
  const apiUrl = `https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&id=${categoryId}&key=${YOUTUBE_API_KEY}&regionCode=US`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].snippet.title; // Returns the category name
    }
    return null;
  } catch (error) {
    console.error("Error fetching category name:", error);
    return null;
  }
}

export { fetchVideoDetails, fetchCategoryName, fetchVideoDetailsByBatch };
