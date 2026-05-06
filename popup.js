// Popup script for GlobalNoteTA
// Handles settings in the extension popup

document.addEventListener("DOMContentLoaded", () => {
  const enableCheckbox = document.getElementById("global-enable");
  // const variantSelect = document.getElementById('default-variant');
  const saveButton = document.getElementById("save");
  const menuButton = document.getElementById("menu");

  // Load current settings
  chrome.storage.local.get(
    ["conversionEnabled", "currentVariant"],
    (result) => {
      enableCheckbox.checked = result.conversionEnabled || false;
      // variantSelect.value = result.currentVariant || 'zh-hk';
    },
  );

  // Save settings
  saveButton.addEventListener("click", () => {
    const enabled = enableCheckbox.checked;
    // const variant = variantSelect.value;
    chrome.storage.local.set(
      {
        conversionEnabled: enabled,
        // currentVariant: variant
      },
      () => {
        // Notify content scripts to update
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          console.log("Sending message to background...");
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "updateSettings",
            conversionEnabled: enabled,
            // currentVariant: variant
          });
        });
        window.close();
      },
    );
  });

  // Bring up menu
  menuButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "openMenu" });
    });
    window.close();
  });
});
