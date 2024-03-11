import {
  Chart,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PieController,
  ArcElement,
} from "chart.js";
import "@fortawesome/fontawesome-free/css/all.min.css";

import {
  handleToken,
  updateUserProfileInfo,
  signOut,
} from "./utils/authHandlersClient";

import { displayButtonsIfSignedIn } from "./utils/uiUtils";

import {
  formatTime,
  getCurrentMonthKey,
  getCategoryName,
  productiveCategories,
  getTodayAndYesterdayKeys,
} from "./utils/utils";

// Register Chart.js components
Chart.register(
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PieController,
  ArcElement
);

// Import tag management functions
import {
  addEnableTag,
  addDisableTag,
  removeTag,
} from "./components/tagManager/tagManager";
import { handleFocusModeToggle } from "./components/focusMode/focusModeToggle/focusModeToggle";

// Position the tooltips
function positionTooltips() {
  const tooltips = document.querySelectorAll(".tooltip-icon");

  tooltips.forEach((tooltip) => {
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipAfter = window.getComputedStyle(tooltip, "::after");
    const tooltipAfterWidth = parseFloat(tooltipAfter.width);
    const tooltipAfterHeight = parseFloat(tooltipAfter.height);

    let left = tooltipRect.left + tooltipRect.width / 2 - tooltipAfterWidth / 2;
    let top = tooltipRect.top + window.scrollY - tooltipAfterHeight - 10; // 10px above the icon

    // Adjust horizontally if tooltip goes beyond the viewport
    if (left < 0) {
      left = 5; // 5px from left edge
    } else if (left + tooltipAfterWidth > window.innerWidth) {
      left = window.innerWidth - tooltipAfterWidth - 5; // 5px from right edge
    }

    // Adjust vertically if tooltip is too high
    if (top < 0) {
      top = tooltipRect.bottom + window.scrollY + 10; // 10px below the icon
    }

    tooltip.style.setProperty("--tooltip-left", `${left}px`);
    tooltip.style.setProperty("--tooltip-top", `${top}px`);
  });
}

// Function to fetch and display total time
export function fetchAndDisplayAllTimes() {
  console.log("Fetching Times...");

  // Elements to display watch time data
  const displayTimeToday = document.getElementById("watchTimeToday");
  const displayTimeYesterday = document.getElementById("watchTimeYesterday");
  const displayTimeThisWeek = document.getElementById("watchTimeThisWeek");
  const displayTimeThisMonth = document.getElementById("watchTimeThisMonth");
  const displayTimeTotal = document.getElementById("watchTimeTotal");

  // Elements to display number of videos data
  const displayVideosToday = document.getElementById("videosToday");
  const displayVideosYesterday = document.getElementById("videosYesterday");
  const displayVideosThisWeek = document.getElementById("videosThisWeek");
  const displayVideosThisMonth = document.getElementById("videosThisMonth");
  const displayVideosTotal = document.getElementById("videosTotal");

  chrome.storage.local.get("watchData", function (data) {
    if (chrome.runtime.lastError) {
      console.log("Error retrieving watch data:", chrome.runtime.lastError);
      displayTimeToday.textContent = "Error!";
      displayTimeYesterday.textContent = "Error!";
      displayTimeThisWeek.textContent = "Error!";
      displayTimeThisMonth.textContent = "Error!";
      displayTimeTotal.textContent = "Error!";
      // Set error for video # data
      displayVideosToday.textContent = "Error!";
      displayVideosYesterday.textContent = "Error!";
      displayVideosThisWeek.textContent = "Error!";
      displayVideosThisMonth.textContent = "Error!";
      displayVideosTotal.textContent = "Error!";
      return;
    }

    console.log("Retrieved watchData from local storage:", data.watchData);

    // Default structure if no data is found
    const watchData = data.watchData || {
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

    // Function to get today's and yesterday's, months,  keys based on current day
    const { todayKey, yesterdayKey } = getTodayAndYesterdayKeys();
    const currentMonthKey = getCurrentMonthKey();

    // Calculate this week's data by summing each day
    const weekDays = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const thisWeekData = weekDays.reduce(
      (acc, day) => {
        return {
          time: acc.time + (watchData.daily[day]?.time || 0),
          videos: acc.videos + (watchData.daily[day]?.videos || 0),
        };
      },
      { time: 0, videos: 0 }
    );

    console.log("This week's data:", thisWeekData); // Logging the aggregated data

    // Update the DOM elements with the fetched data
    if (watchData.daily[todayKey]) {
      displayTimeToday.textContent = formatTime(watchData.daily[todayKey].time);
      displayVideosToday.textContent = watchData.daily[todayKey].videos;
    } else {
      displayTimeToday.textContent = "0s";
      displayVideosToday.textContent = "0";
    }

    displayTimeYesterday.textContent = formatTime(
      watchData.daily[yesterdayKey]?.time || 0
    );
    displayVideosYesterday.textContent =
      watchData.daily[yesterdayKey]?.videos || 0;

    displayTimeThisWeek.textContent = formatTime(thisWeekData.time);
    displayVideosThisWeek.textContent = thisWeekData.videos;

    // Display this month's data
    displayTimeThisMonth.textContent = formatTime(
      watchData.monthly[currentMonthKey]?.time || 0
    );
    displayVideosThisMonth.textContent =
      watchData.monthly[currentMonthKey]?.videos || 0;

    // Display total time and videos
    displayTimeTotal.textContent = formatTime(watchData.total.time);
    displayVideosTotal.textContent = watchData.total.videos;
  });
}

// Fetch and Draw Charts
export function fetchWeekDataAndDrawChart() {
  chrome.storage.local.get("watchData", function (data) {
    if (data.watchData) {
      // Construct weekData array with correct time values for each day
      const weekData = [
        data.watchData.daily.sunday?.time || 0,
        data.watchData.daily.monday?.time || 0,
        data.watchData.daily.tuesday?.time || 0,
        data.watchData.daily.wednesday?.time || 0,
        data.watchData.daily.thursday?.time || 0,
        data.watchData.daily.friday?.time || 0,
        data.watchData.daily.saturday?.time || 0,
      ];

      console.log("Week data for chart:", weekData); // Debugging
      drawWeeklyChart(weekData);
    } else {
      console.log("No data available for the week.");
      drawWeeklyChart([0, 0, 0, 0, 0, 0, 0]); // Draw chart with zero data
    }
  });
}

export function fetchChannelDataAndDrawTopTenChannelsPieChart() {
  chrome.storage.local.get("watchData", function (data) {
    let formattedData = [];

    if (data.watchData && data.watchData.channels) {
      formattedData = prepareChannelDataForPieChart(data.watchData.channels);
      console.log("prepared formatted Data for pie chart: ", formattedData);
    } else {
      console.log("No channel data available for the pie chart.");
    }

    // Redraw the chart with the new data
    drawTopTenChannelsPieChart(formattedData);
  });
}

export function fetchCategoryDataAndDrawCategoryTrendsPieChart() {
  chrome.storage.local.get("watchData", function (data) {
    let formattedData = [];

    if (data.watchData && data.watchData.channels) {
      formattedData = prepareCategoryDataForPieChart(data.watchData.categories);
      console.log("prepared formatted Data for pie chart: ", formattedData);
    } else {
      console.log("No channel data available for the pie chart.");
    }

    // Redraw the chart with the new data
    drawCategoryTrendsPieChart(formattedData);
  });
}

export function fetchUpdateProductivityScore() {
  chrome.storage.local.get("watchData", function (data) {
    if (data.watchData) {
      updateProductivityScore(data.watchData);
    } else {
      console.log("No watch data available.");
    }
  });
}

// Fetch Video Info
function fetchAndDisplayCurrentVideoInfo() {
  console.log("fetchAndDisplayCurrentVideoInfo");
  // Retrieve the video information from the background script
  chrome.runtime.sendMessage(
    { message: "requestVideoInfo" },
    function (response) {
      // Check if the response contains valid video information
      if (response && response.videoInfo) {
        // Extract the video title, channel, and category from the response
        const videoTitle = response.videoInfo.title;
        const videoChannel = response.videoInfo.channel;
        // const videoCategory = response.videoInfo.category;
        console.log(
          "response for fetchAndDisplayCurrentVideoInfo is:",
          videoTitle,
          videoChannel
        );
        // Update the text content of the corresponding HTML elements
        const displayVideoTitle = document.getElementById("videoTitle");
        const displayVideoChannel = document.getElementById("videoChannel");
        // const displayVideoCategory = document.getElementById("videoCategory");

        displayVideoTitle.textContent = videoTitle;
        displayVideoChannel.textContent = videoChannel;
        // displayVideoCategory.textContent = videoCategory; // Add this if you want to display the video category
      } else {
        // Handle the case where no video info is available
        console.log("No current video info available.");
      }
    }
  );
}

// Declare and Draw Charts
let weeklyUsageChart;
let trendsPieChart;
let categoryTrendsPieChart;

// Weekly Chart
function drawWeeklyChart(weekData) {
  const ctx = document.getElementById("weeklyUsageChart").getContext("2d");
  // Destroy existing chart
  if (weeklyUsageChart) {
    weeklyUsageChart.destroy();
  }

  // Convert seconds to minutes for each day
  const minutesData = weekData.map((seconds) => Math.round(seconds / 60));

  // Create a gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, "rgba(255, 99, 132, 1)");
  gradient.addColorStop(1, "rgba(54, 162, 235, 1)");
  weeklyUsageChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Sun", "Mon", "Tues", "Wed", "Thurs", "Fri", "Sat"],
      datasets: [
        {
          label: "Average watchtime/day",
          data: minutesData,
          backgroundColor: gradient,
          borderColor: ["rgba(255, 99, 132, 1)"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          ticks: {
            color: "white",
            fontSize: 18,
            beginAtZero: true,
            callback: function (value) {
              // Convert value from minutes to hours and minutes
              const hours = Math.floor(value / 60);
              const minutes = value % 60;
              return `${hours}h ${minutes}m`;
            },
          },
        },
        x: {
          ticks: {
            color: "white",
            fontSize: 14,
            beginAtZero: true,
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "white",
            fontSize: 18,
          },
        },
        title: {
          display: true,
          text: "Weekly Watch Time (Minutes)",
          color: "white",
          fontSize: 18,
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: (tooltipItem) => {
              const value = tooltipItem.parsed.y;
              const hours = Math.floor(value / 60);
              const minutes = value % 60;
              return `${tooltipItem.label}: ${hours}h ${minutes}m`;
            },
          },
          titleFontColor: "white",
          bodyFontColor: "white",
        },
      },
    },
  });
}

// Activity Trends Pie Chart
function drawTopTenChannelsPieChart(data) {
  const ctx = document.getElementById("trendsPieChart").getContext("2d");
  // Destroy existing chart
  if (trendsPieChart) {
    trendsPieChart.destroy();
  }

  const colors = [
    "rgba(255, 99, 132, 0.8)", // Red
    "rgba(54, 162, 235, 0.8)", // Blue
    "rgba(255, 206, 86, 0.8)", // Yellow
    "rgba(75, 192, 192, 0.8)", // Green
    "rgba(153, 102, 255, 0.8)", // Purple
    "rgba(255, 159, 64, 0.8)", // Orange
    "rgba(199, 199, 199, 0.8)", // Grey
    "rgba(83, 102, 255, 0.8)", // Indigo
    "rgba(255, 99, 132, 0.8)", // Pink
    "rgba(255, 159, 64, 0.8)", // Peach
  ];
  trendsPieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: data.map((item) => item.channel),
      datasets: [
        {
          data: data.map((item) => item.time),
          backgroundColor: colors,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: {
            color: "white",
            fontSize: 18,
          },
        },
        title: {
          display: true,
          text: "Top 10 Channels Watched",
          color: "white",
          fontSize: 18,
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function (tooltipItem) {
              const label = tooltipItem.label;
              const time = tooltipItem.raw;
              const hours = Math.floor(time / 3600);
              const minutes = Math.floor((time % 3600) / 60);
              return `${label}: ${hours}h ${minutes}m`;
            },
          },
          titleFontColor: "white",
          bodyFontColor: "white",
        },
      },
    },
  });
}

// Category Trends Pie Chart
function drawCategoryTrendsPieChart(data) {
  const ctx = document.getElementById("trendsCategoryChart").getContext("2d");
  // Destroy existing chart
  if (categoryTrendsPieChart) {
    categoryTrendsPieChart.destroy();
  }

  const colors = [
    "rgba(255, 99, 132, 0.8)", // Red
    "rgba(54, 162, 235, 0.8)", // Blue
    "rgba(255, 206, 86, 0.8)", // Yellow
    "rgba(75, 192, 192, 0.8)", // Green
    "rgba(153, 102, 255, 0.8)", // Purple
    "rgba(255, 159, 64, 0.8)", // Orange
    "rgba(199, 199, 199, 0.8)", // Grey
    "rgba(83, 102, 255, 0.8)", // Indigo
    "rgba(255, 99, 132, 0.8)", // Pink
    "rgba(255, 159, 64, 0.8)", // Peach
  ];
  categoryTrendsPieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: data.map((item) => `${item.category}`),
      datasets: [
        {
          data: data.map((item) => item.time),
          backgroundColor: colors,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: {
            color: "white",
            fontSize: 18,
          },
        },
        title: {
          display: true,
          text: "Category Trends",
          color: "white",
          fontSize: 18,
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: function (tooltipItem) {
              const label = tooltipItem.label;
              const time = tooltipItem.raw;
              const hours = Math.floor(time / 3600);
              const minutes = Math.floor((time % 3600) / 60);
              return `${label}: ${hours}h ${minutes}m`;
            },
          },
          titleFontColor: "white",
          bodyFontColor: "white",
        },
      },
    },
  });
}

function prepareChannelDataForPieChart(channelsData) {
  // Convert channelsData object to array and sort by watch time
  let formattedData = Object.entries(channelsData)
    .map(([channel, data]) => ({ channel, time: data.time }))
    .sort((a, b) => b.time - a.time)
    .slice(0, 10); // Get the top 10 channels

  return formattedData;
}

function prepareCategoryDataForPieChart(categoryData) {
  let aggregatedCategoryData = [];

  // Aggregate time for each category
  for (const [categoryId, data] of Object.entries(categoryData)) {
    aggregatedCategoryData.push({
      category: getCategoryName(categoryId),
      time: data.time,
    });
  }

  // Sort the categories by time in descending order
  aggregatedCategoryData.sort((a, b) => b.time - a.time);

  return aggregatedCategoryData;
}

// Productivity Score
function getProductiveWatchTimeData(watchData) {
  let productiveTime = 0;
  let totalWatchTime = 0;

  // Check if watchData and watchData.categories are defined and not empty
  if (
    watchData &&
    watchData.categories &&
    Object.keys(watchData.categories).length > 0
  ) {
    for (const [categoryId, categoryData] of Object.entries(
      watchData.categories
    )) {
      const timeSpent = categoryData.time;
      totalWatchTime += timeSpent;

      if (productiveCategories.has(categoryId)) {
        productiveTime += timeSpent;
      }
    }
  }

  return { productiveTime, totalWatchTime };
}

// Update Productivity Score
function updateProductivityScore(watchData) {
  const { productiveTime, totalWatchTime } =
    getProductiveWatchTimeData(watchData);
  const score = (productiveTime / totalWatchTime) * 100;
  document.getElementById("productivityScoreDisplay").textContent = `Score: ${
    score.toFixed(2) ?? "No Score"
  }%`;

  // Update tips based on score
  updateProductivityTips(score);
}

function updateProductivityTips(score) {
  const tipsElement = document.getElementById("productivityTips");
  tipsElement.innerHTML = ""; // Clear existing tips

  if (score < 50) {
    tipsElement.innerHTML +=
      "<li>Try to focus more on educational content.</li>";
  } else {
    tipsElement.innerHTML +=
      "<li>Keep up the good work and maintain your habits!</li>";
  }
}

// Function to show/hide elements based on the container ID
export function toggleElementsVisibility(visibleContainerId) {
  const containers = [
    "homeContainer",
    "insightsContainer",
    "focusModeSettingsPageContainer",
    "settingsContainer",
  ]; // Add more container IDs as needed
  containers.forEach((containerId) => {
    const container = document.getElementById(containerId);
    if (containerId === visibleContainerId) {
      container.style.display = "block";
    } else {
      container.style.display = "none";
    }
  });
}

// Function to toggle the state of the buttons based on the visible container ID
function toggleButtonState(visibleContainerId) {
  const buttons = {
    insightsBtn: "insightsContainer",
    focusModeSettingsPageBtn: "focusModeSettingsPageContainer",
    settingsBtn: "settingsContainer",
    backToHomeBtn: "homeContainer",
  };

  Object.entries(buttons).forEach(([buttonId, containerId]) => {
    const button = document.getElementById(buttonId);
    if (button) {
      if (containerId === visibleContainerId) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    }
  });
}

// Function to load Insights page into popup
export function loadInsightsPage() {
  // Hide elements when Insights page is loaded
  toggleElementsVisibility("insightsContainer");
  toggleButtonState("insightsContainer");
  // Fetch data and create Insights Charts
  fetchAndDisplayAllTimes();
  fetchWeekDataAndDrawChart();
  fetchChannelDataAndDrawTopTenChannelsPieChart();
  fetchCategoryDataAndDrawCategoryTrendsPieChart();
}

export function updateInsightsPage(data) {
  const insightsContent = document.getElementById("insightsContent");

  if (data && Object.keys(data).length > 0) {
    // User is signed in
    insightsContent.style.display = "block";
    // Fetch and display insights data
    fetchAndDisplayAllTimes();
    fetchWeekDataAndDrawChart();
    fetchChannelDataAndDrawTopTenChannelsPieChart();
    fetchCategoryDataAndDrawCategoryTrendsPieChart();
  } else {
    // Data is not available
    insightsContent.style.display = "none";
  }
}

// Function to load Focus Mode settings page into popup
function loadFocusModeSettingsPage() {
  toggleElementsVisibility("focusModeSettingsPageContainer");
  toggleButtonState("focusModeSettingsPageContainer");
}

// Function to load Settings page into popup
function loadSettingsPage() {
  // Change visibility to show only the settings container
  toggleElementsVisibility("settingsContainer");
  toggleButtonState("settingsContainer");
  // Additional code to initialize settings page
}

// Function to load Home page into the popup
export function loadHomePage() {
  console.log("clicked on back button...");
  toggleElementsVisibility("homeContainer");
  toggleButtonState("homeContainer");
  // Fetch data and create Productivity Info
  fetchUpdateProductivityScore();
}

// Add styles to the navContainer
const navContainer = document.getElementById("navContainerBottom");
navContainer.style.display = "flex";
navContainer.style.justifyContent = "flex-end"; // Align items to the right
navContainer.style.alignItems = "center"; // Center items vertically
navContainer.style.padding = "10px"; // Add padding around the container

function toggleSignInMessage(show) {
  const signInMessageSection = document.querySelector(".signInMessage");
  if (signInMessageSection) {
    signInMessageSection.style.display = show ? "block" : "none";
  }
}

function toggleMainNavigationButtons(show) {
  const mainNavigationButtons = document.querySelectorAll(
    "#navContainer button:not(#closeBtn)"
  );

  console.log("toggleMainNavigationButtons called, show:", show);

  mainNavigationButtons.forEach((button) => {
    button.style.display = show ? "block" : "none"; // Use 'flex' or other display value if needed
  });
}

function toggleHomeContent(show) {
  const homeContent = document.getElementById("homeContent");
  homeContent.style.display = show ? "block" : "none";
}

export function toggleFocusModeSettingsPageContent(show) {
  const focusModeSettingsPageContent = document.getElementById(
    "focusModeSettingsPageContent"
  );
  focusModeSettingsPageContent.style.display = show ? "block" : "none";
}

function showFocusModeSwitch(show) {
  console.log("focus mode toggled!");
  const focusModeSwitchContainer = document.getElementById(
    "focusModeToggleSwitchContainer"
  );
  if (focusModeSwitchContainer) {
    focusModeSwitchContainer.style.display = show ? "flex" : "none";
  }
}

// Function to add event listeners to all elements with the 'backToHomeBtn' class
export function addBackButtonEventListeners() {
  const backButtons = document.querySelectorAll(".backToHomeBtn");
  backButtons.forEach((button) => {
    button.addEventListener("click", loadHomePage);
  });
}

/* DOM LOAD */

// When the popup is loaded
window.addEventListener("DOMContentLoaded", (event) => {
  // Initially hide the insights content
  document.getElementById("insightsContainer").style.display = "none";

  // Other initial setup...
  addBackButtonEventListeners();
  displayButtonsIfSignedIn();
  updateUserProfileInfo();

  // // Call the function on load and on window resize
  window.addEventListener("load", positionTooltips);
  window.addEventListener("resize", positionTooltips);

  // ... other initial setup

  /* Main Navigation Button event Listeners */

  const buttons = document.querySelectorAll("#navContainer button");
  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      buttons.forEach(function (btn) {
        btn.classList.remove("active");
      });
      this.classList.add("active");
    });
  });

  // Listener for the "View Insights" button
  document.getElementById("insightsBtn").addEventListener("click", function () {
    chrome.storage.local.get("userId", function (data) {
      if (data.userId) {
        // User is signed in, show insights content
        loadInsightsPage();
        document.getElementById("insightsContent").style.display = "block";
      } else {
        // User is not signed in, show sign-in message and hide home content
        toggleElementsVisibility("insightsContainer");
        document.getElementById("insightsContent").style.display = "none";
      }
    });
  });

  // Listener for "View Settings" button
  document.getElementById("settingsBtn").addEventListener("click", function () {
    loadSettingsPage();
  });

  // Listener for "Focus Mode Settings Page" button
  document
    .getElementById("focusModeSettingsPageBtn")
    .addEventListener("click", function () {
      loadFocusModeSettingsPage();
    });

  // Close Button
  document.getElementById("closeBtn").addEventListener("click", function () {
    window.close();
  });

  // Add event listener to button to reset local storage
  document
    .getElementById("clearStorageBtn")
    .addEventListener("click", function () {
      chrome.runtime.sendMessage({ action: "resetLocalStorage" });
      console.log("sent message: Resetted local cache!");
    });

  document.getElementById("loginBtn").addEventListener("click", function () {
    chrome.runtime.sendMessage({ action: "authenticate" });
  });

  document
    .getElementById("switchAccountBtn")
    .addEventListener("click", function () {
      signOut();
    });

  // Event Listener for Tags

  // Event listener for adding tags to the disable filter
  document
    .getElementById("disableAddFilterBtn")
    .addEventListener("click", () => {
      const filterInput = document.getElementById("disableFilterInput");
      const tagName = filterInput.value.trim();
      if (tagName) {
        addDisableTag(tagName); // Updated function name to addDisableTag
        filterInput.value = ""; // Clear the input field after adding tag
      }
    });

  // Event listener for adding tags to the enable filter
  document
    .getElementById("enableAddFilterBtn")
    .addEventListener("click", () => {
      const filterInput = document.getElementById("enableFilterInput");
      const tagName = filterInput.value.trim();
      if (tagName) {
        addEnableTag(tagName); // Updated function name to addEnableTag
        filterInput.value = ""; // Clear the input field after adding tag
      }
    });

  // Optionally, listen for the Enter key press in the input fields
  document
    .getElementById("disableFilterInput")
    .addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const filterInput = document.getElementById("disableFilterInput");
        const tagName = filterInput.value.trim();
        if (tagName) {
          addDisableTag(tagName); // Updated function name to addDisableTag
          filterInput.value = ""; // Clear the input field after adding tag
        }
      }
    });

  document
    .getElementById("enableFilterInput")
    .addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const filterInput = document.getElementById("enableFilterInput");
        const tagName = filterInput.value.trim();
        if (tagName) {
          addEnableTag(tagName); // Updated function name to addEnableTag
          filterInput.value = ""; // Clear the input field after adding tag
        }
      }
    });

  // Listener for the retry fetch button
  document.getElementById("retryButton").addEventListener("click", () => {
    retryFetch();
  });

  // Event Listener for Focus Mode Toggle

  // Check the stored focusMode state and update the toggle button
  chrome.storage.local.get(["focusMode"], function (result) {
    focusModeToggle.checked = result.focusMode || false; // Set toggle based on stored value
    labelForFocusModeToggle.innerText = `Focus Mode: ${
      focusModeToggle.checked ? "On" : "Off"
    }`;
  });

  // Attach event listeners...
  focusModeToggle.addEventListener("click", handleFocusModeToggle);
});

const focusModeToggle = document.getElementById("toggleSwitch");
const labelForFocusModeToggle = document.getElementById(
  "labelForFocusModeToggle"
);

// When the popup opens, check if the user is logged in
window.onload = function () {
  console.log("window onload: popup opened!");
  checkSignInStatus();
};

window.onunload = function () {
  console.log("window unload: popup closing!");
  chrome.runtime.sendMessage({ action: "popupClosing" });
};

// Establish a connection with the background script
const port = chrome.runtime.connect({ name: "popup" });

// Add listener for the connection
port.onMessage.addListener(function (msg) {
  switch (msg) {
    case "opened":
      console.log("background to popup script port connection: OPEN");
      updateUserProfileInfo();
      retryFetch();
      break;

    // Additional cases here if needed

    default:
      console.log("Received unknown message:", msg);
      break;
  }
});

// Handle content visibility if signed in

let userSignedIn = false;
let tokenHandled = false; // Flag to track token handling

// Function to check if user is signed in
async function checkSignInStatus() {
  const response = await sendMessageAsync({ action: "checkSignInStatus" });
  if (response && response.signedIn) {
    userSignedIn = true;
    // Handle token only if it hasn't been handled yet
    if (!tokenHandled && response.token) {
      handleToken(response.token);
      tokenHandled = true; // Set flag to true after handling token
    }
    // Handle UI changes for signed-in user
    retryFetch();
  } else {
    userSignedIn = false;
    tokenHandled = false; // Reset flag on sign-out
    // Handle UI changes for signed-out user
    retryFetch();
  }
}

// This function wraps chrome.runtime.sendMessage in a promise for easier async/await usage
function sendMessageAsync(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type || message.action) {
    case "authToken":
      if (message.token) {
        console.log("Token received in popup:", message.token);
        handleToken(message.token);
        userSignedIn = true;
      } else {
        console.error("Error receiving token:", message.error);
        userSignedIn = false;
      }
      checkSignInStatus();
      break;

    case "updateUserLoggedIn":
      userSignedIn = message.userSignedIn;
      if (userSignedIn) {
        updateUIForLoggedInUser();
      } else {
        updateUIForLoggedOutUser();
      }
      break;

    case "focusModeCancelled":
      focusModeToggle.checked = false;
      console.log("Focus mode cancelled.");
      break;
    case "displayError":
      showErrorPage(message.message);
      break;

    // Add more cases as needed
    default:
      console.log("Received unknown message:", message);
  }
});

// Function to show error message or page
function showErrorPage(message) {
  const errorSection = document.getElementById("errorDisplaySection");
  const errorMessage = document.getElementById("errorMessage");
  if (errorSection && errorMessage) {
    errorMessage.textContent = message;
    errorImage.src = "src/components/icons/server_down.svg";
    errorSection.style.display = "flex";
    // Hide other sections or elements as needed
    // For example, hide the main content section
    document.getElementById("content").style.display = "none";
  }
}

function hideErrorPage() {
  const errorSection = document.getElementById("errorDisplaySection");
  if (errorSection) {
    errorSection.style.display = "none";
  }
}

// Function to retry fetching data
export function retryFetch() {
  requestWatchDataFromBackground();
}

// Display Loading Screen
function showLoadingScreen() {
  document.getElementById("loadingScreen").style.display = "flex";
}

function hideLoadingScreen() {
  document.getElementById("loadingScreen").style.display = "none";
}

function requestWatchDataFromBackground() {
  showLoadingScreen();
  chrome.runtime.sendMessage({ action: "fetchWatchData" }, (response) => {
    hideLoadingScreen();
    if (response.success) {
      console.log("Data successfully fetched.");
      handleContentVisibility(true); // Indicate successful data fetch
      loadHomePageWithData(response.data); // Reload page content with new data
    } else {
      console.log("Data fetch failed:", response.message);
      showErrorPage(response.message);
      handleContentVisibility(false); // Indicate data fetch failure
    }
  });
}

// Handle content visibility based on user sign-in status
export async function handleContentVisibility(dataFetchedSuccessfully) {
  try {
    const response = await sendMessageAsync({ action: "checkSignInStatus" });
    const contentSection = document.getElementById("content");

    if (response && response.signedIn) {
      console.log("User is logged in.");
      if (dataFetchedSuccessfully) {
        // Show content only if data was fetched successfully
        if (contentSection) contentSection.style.display = "block";
        updateUIForLoggedInUser();
        showFocusModeSwitch(true);
      } else {
        // Hide content if data fetch failed
        if (contentSection) contentSection.style.display = "none";
        updateUIForLoggedInUser();
      }
    } else {
      console.log("User is not logged in.");
      if (contentSection) contentSection.style.display = "none";
      updateUIForLoggedOutUser();
    }
  } catch (error) {
    console.error("Error checking user login status:", error);
    if (contentSection) contentSection.style.display = "none";
    updateUIForLoggedOutUser();
  }
}

function updateUIForLoggedInUser() {
  // Show main content section only if data fetch was successful
  // The visibility of contentSection is already handled in handleContentVisibility
  toggleHomeContent(true);
  toggleFocusModeSettingsPageContent(true);
  toggleSignInMessage(false);
  toggleMainNavigationButtons(true);
  // Any additional UI updates for logged-in user
}

function updateUIForLoggedOutUser() {
  toggleHomeContent(false);
  toggleFocusModeSettingsPageContent(false);
  toggleSignInMessage(true);
  toggleMainNavigationButtons(false);
  showFocusModeSwitch(false);
  hideErrorPage();
}

function loadHomePageWithData(data) {
  // Populate home page content with the provided data
  // For example, updating charts, tables, or lists based on watch data
  // ...
  console.log("Reloading page content with new data:", data);
  // Update necessary elements in the DOM with the new data
  // ...
  updateInsightsPage(data);
}
