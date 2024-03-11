import { showNotification } from "../../notifications/notification";

export function handleFocusModeToggle(event) {
  const isFocusModeOn = event.target.checked;
  labelForFocusModeToggle.innerText = `Focus Mode: ${
    isFocusModeOn ? "On" : "Off"
  }`;

  if (isFocusModeOn) {
    // Check if the current tab is a YouTube tab
    chrome.tabs.query(
      { active: true, currentWindow: true },
      function (activeTabs) {
        if (
          activeTabs.length > 0 &&
          activeTabs[0].url.includes("youtube.com")
        ) {
          // Current tab is a YouTube tab, open the modal here
          chrome.tabs.sendMessage(activeTabs[0].id, {
            action: "openFocusModeModal",
          });
        } else {
          // Current tab is not a YouTube tab, find the most recent active YouTube tab
          chrome.tabs.query(
            { url: "*://*.youtube.com/*", lastFocusedWindow: true },
            function (youtubeTabs) {
              if (youtubeTabs.length > 0) {
                const mostRecentTab = youtubeTabs.reduce((a, b) =>
                  a.lastFocusedTime > b.lastFocusedTime ? a : b
                );
                chrome.tabs.update(mostRecentTab.id, { active: true });
                chrome.tabs.sendMessage(mostRecentTab.id, {
                  action: "openFocusModeModal",
                });
              } else {
                // No YouTube tabs in the last focused window, check for any YouTube tab
                chrome.tabs.query(
                  { url: "*://*.youtube.com/*" },
                  function (allYouTubeTabs) {
                    if (allYouTubeTabs.length > 0) {
                      chrome.tabs.update(allYouTubeTabs[0].id, {
                        active: true,
                      });
                      chrome.tabs.sendMessage(allYouTubeTabs[0].id, {
                        action: "openFocusModeModal",
                      });
                    } else {
                      // No YouTube tabs at all, show a notification
                      showNotification();
                    }
                  }
                );
              }
            }
          );
        }
      }
    );
    window.close(); // Close the extension popup
  } else {
    chrome.runtime.sendMessage({ action: "focusModeOff" });
    chrome.runtime.sendMessage({ action: "toggleFocusMode" });
  }
}

function isSpecialPage(url) {
  return url.startsWith("chrome://") || url.startsWith("about:");
}

export function findAndOpenFocusModeModal() {
  // Find a YouTube tab or open a new one
  chrome.tabs.query(
    { url: "*://*.youtube.com/*", active: true, currentWindow: true },
    function (focusedTabs) {
      if (focusedTabs.length > 0) {
        chrome.tabs.sendMessage(focusedTabs[0].id, {
          action: "openFocusModeModal",
        });
      } else {
        chrome.tabs.query({ url: "*://*.youtube.com/*" }, function (tabs) {
          if (tabs.length > 0) {
            chrome.tabs.update(tabs[0].id, { active: true });
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "openFocusModeModal",
            });
          } else {
            chrome.tabs.query(
              { active: true, currentWindow: true },
              function (activeTabs) {
                if (activeTabs.length > 0) {
                  chrome.tabs.sendMessage(activeTabs[0].id, {
                    action: "promptOpenYouTube",
                  });
                }
              }
            );
          }
        });
      }
    }
  );
}

export function openYouTubeTabAndShowModal() {
  chrome.tabs.create({ url: "https://www.youtube.com" }, function (newTab) {
    // Listener for when the tab updates
    const onUpdatedListener = function (tabId, changeInfo, tab) {
      // Check if the updated tab is the one we created and if it has finished loading
      if (tabId === newTab.id && changeInfo.status === "complete") {
        // Send a message to the content script in this tab to open the focus mode modal
        chrome.tabs.sendMessage(newTab.id, { action: "openFocusModeModal" });

        // Remove the event listener as it's no longer needed
        chrome.tabs.onUpdated.removeListener(onUpdatedListener);
      }
    };

    // Add the event listener to the tabs.onUpdated event
    chrome.tabs.onUpdated.addListener(onUpdatedListener);
  });
}
