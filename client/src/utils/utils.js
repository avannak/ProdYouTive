export function formatTime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  let timeString = "";

  if (days > 0) {
    timeString += `${days} day${days > 1 ? "s" : ""}, `;
  }
  if (hours > 0 || days > 0) {
    timeString += `${hours} hour${hours > 1 ? "s" : ""}, `;
  }
  timeString += `${minutes} minute${minutes > 1 ? "s" : ""}`;

  return timeString;
}

// Calculate Start Of Week
export function getStartOfWeek(date) {
  const clone = new Date(date);
  clone.setDate(clone.getDate() - clone.getDay()); // Go back to the last Sunday
  clone.setHours(0, 0, 0, 0); // Start of the day
  return clone;
}

// Calculate Start of Month
export function getStartOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getTodayAndYesterdayKeys() {
  const weekDays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const todayKey = weekDays[today.getDay()].toLowerCase();
  const yesterdayKey = weekDays[yesterday.getDay()].toLowerCase();

  return { todayKey, yesterdayKey };
}

export function getCurrentMonth() {
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const currentMonthIndex = new Date().getMonth();
  return monthNames[currentMonthIndex];
}

export function getCurrentMonthKey() {
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const currentMonthIndex = new Date().getMonth();
  return monthNames[currentMonthIndex];
}

// Define Youtube API Categories
const categoryMap = {
  2: "Autos & Vehicles",
  1: "Film & Animation",
  10: "Music",
  15: "Pets & Animals",
  17: "Sports",
  18: "Short Movies",
  19: "Travel & Events",
  20: "Gaming",
  21: "Videoblogging",
  22: "People & Blogs",
  23: "Comedy",
  24: "Entertainment",
  25: "News & Politics",
  26: "Howto & Style",
  27: "Education",
  28: "Science & Technology",
  29: "Nonprofits & Activism",
  30: "Movies",
  31: "Anime/Animation",
  32: "Action/Adventure",
  33: "Classics",
  34: "Comedy",
  35: "Documentary",
  36: "Drama",
  37: "Family",
  38: "Foreign",
  39: "Horror",
  40: "Sci-Fi/Fantasy",
  41: "Thriller",
  42: "Shorts",
  43: "Shows",
  44: "Trailers",
};

export function getCategoryName(categoryId) {
  return categoryMap[categoryId] || "Unknown Category";
}

export const productiveCategories = new Set([
  "27", // Education
  "28", // Science & Technology
  "25", // News & Politics
  "35", // Documentary
  "29", // Nonprofits & Activism
]);
