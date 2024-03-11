// Define disableTags array globally or in the appropriate scope
let disableTags = [];
let enableTags = [];

// Function to add a disable tag to the list
export function addDisableTag(tagName) {
  disableTags.push(tagName);
  displayDisableTags();
}

// Function to add an enable tag to the list
export function addEnableTag(tagName) {
  enableTags.push(tagName);
  displayEnableTags();
}

// Function to remove a tag from the list
export function removeTag(tagName, type) {
  if (type === "disable") {
    disableTags = disableTags.filter((tag) => tag !== tagName);
    displayDisableTags();
  } else if (type === "enable") {
    enableTags = enableTags.filter((tag) => tag !== tagName);
    displayEnableTags();
  }
}

// Function to display the list of disable tags
export function displayDisableTags() {
  const tagList = document.getElementById("disableTagList");
  tagList.innerHTML = ""; // Clear existing tags

  disableTags.forEach((tagName) => {
    const li = document.createElement("li");
    li.textContent = tagName; // Use tag name

    const closeIcon = document.createElement("span");
    closeIcon.innerHTML = "&times;"; // Add "X" symbol
    closeIcon.classList.add("close-icon");
    closeIcon.addEventListener("click", () => removeTag(tagName, "disable")); // Pass tag name and type to remove function

    li.appendChild(closeIcon);
    li.classList.add("tag");
    li.classList.add("disable-tag"); // Optionally, add a class to distinguish disable tags
    tagList.appendChild(li);
  });
}

// Function to display the list of enable tags
export function displayEnableTags() {
  const tagList = document.getElementById("enableTagList");
  tagList.innerHTML = ""; // Clear existing tags

  enableTags.forEach((tagName) => {
    const li = document.createElement("li");
    li.textContent = tagName; // Use tag name

    const closeIcon = document.createElement("span");
    closeIcon.innerHTML = "&times;"; // Add "X" symbol
    closeIcon.classList.add("close-icon");
    closeIcon.addEventListener("click", () => removeTag(tagName, "enable")); // Pass tag name and type to remove function

    li.appendChild(closeIcon);
    li.classList.add("tag");
    li.classList.add("enable-tag"); // Optionally, add a class to distinguish enable tags
    tagList.appendChild(li);
  });
}
