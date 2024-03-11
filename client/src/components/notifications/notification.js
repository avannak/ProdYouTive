export function showNotification() {
  chrome.notifications.create("notificationId", {
    type: "basic",
    iconUrl: "../client/icons/icon48.png", // path to an icon
    title: "ProdYouTive: Enable Focus Mode",
    message: "Would you like to open a new YouTube tab to enable Focus Mode?",
    buttons: [{ title: "Yes" }, { title: "No" }],
    priority: 0,
  });
}
