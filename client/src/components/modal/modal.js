// Function to create a modal
export function createModal(id, innerHTML) {
  const modal = document.createElement("div");
  modal.id = id;
  modal.style.display = "none";
  modal.innerHTML = innerHTML;
  document.body.appendChild(modal);
  return modal;
}

// Function to show a modal
export function showModal(modal) {
  modal.style.display = "block";
}

// Function to hide a modal
export function hideModal(modal) {
  modal.style.display = "none";
}

// When user cancels the modal
export function onCancelModal(modal) {
  chrome.runtime.sendMessage({ action: "focusModeCancelled" });
  hideModal(modal);
}

// When user confirms duration in the modal
export function onConfirmDuration(modal) {
  const durationSelect = modal.querySelector("#focusModeDuration");
  if (durationSelect) {
    const duration = durationSelect.value;
    console.log(`Focus Mode Duration: ${duration}`);
    chrome.runtime.sendMessage({
      action: "focusModeConfirmed",
      duration: duration,
    });
  }
  hideModal(modal);
}

// When user decides to open a new YouTube tab
export function onOpenNewTab(modal) {
  chrome.runtime.sendMessage({ action: "openNewYouTubeTab" });
  hideModal(modal);
}

// Load CSS for modals
export function loadModalCSS() {
  const link = document.createElement("link");
  link.href = chrome.runtime.getURL("client/src/components/modal/modal.css");
  link.type = "text/css";
  link.rel = "stylesheet";
  document.head.appendChild(link);
}
