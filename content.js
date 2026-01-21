// Content script for GlobalNoteTA
// Handles text conversion and floating menu

let tables = {};
let currentVariant = 'zh-hk'; // Default to Hong Kong variant
let conversionEnabled = false;
let showOriginal = false;
let highlightEnabled = false;

// Load tables from storage
chrome.runtime.sendMessage({ action: 'getTables' }, (response) => {
  tables = response.tables || {};
  console.log('Tables loaded in content script.');
  console.log('Available variants:', Object.keys(tables));
  for (const variant in tables) {
    console.log(`Tables for ${variant}: ${Object.keys(tables[variant]).length} entries`);
  }
});

// Function to convert text
function convertText(text, fromVariant, toVariant) {
  if (!tables[toVariant]) {
    console.log('No table for variant:', toVariant);
    return text;
  }
  const table = tables[toVariant];
  let result = '';
  let i = 0;
  let conversions = 0;
  while (i < text.length) {
    let matched = false;
    // Try longest match first (up to 10 chars)
    for (let len = Math.min(10, text.length - i); len > 0; len--) {
      const phrase = text.substr(i, len);
      if (table[phrase]) {
        const replacement = Array.isArray(table[phrase]) ? table[phrase][0] : table[phrase];
        // Wrap replacement in a span with highlight class
        result += `<GlobalNoteTA_phrase>${replacement}</GlobalNoteTA_phrase>`;
        i += len;
        matched = true;
        conversions++;
        break;
      }
    }
    if (!matched) {
      result += text[i];
      i++;
    }
  }
  if (conversions > 0) {
    console.log(`Converted ${conversions} phrases in text: "${text.substring(0, 30)}..." to "${result.substring(0, 30)}..."`);
  }
  return result;
}

// Traverse and convert DOM text nodes
function convertPage() {
  if (!conversionEnabled) return;
  console.log('Converting page to variant:', currentVariant);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  let nodesConverted = 0;
  const nodesToUpdate = [];

  while (node = walker.nextNode()) {
    if (
      node.parentElement
      && node.parentElement.tagName !== 'SCRIPT'
      && node.parentElement.tagName !== 'STYLE'
      && node.parentElement.tagName !== 'GLOBALNOTETA_O_NODE'
      && node.parentElement.tagName !== 'GLOBALNOTETA_C_NODE'
      && node.parentElement.tagName !== 'GLOBALNOTETA_PHRASE'
    ) {
      const original = node.textContent;
      const converted = convertText(original, 'auto', currentVariant);
      if (converted !== original) {
        nodesToUpdate.push({ node, converted });
        nodesConverted++;
      }
    }
  }

  // Replace text nodes with HTML spans
  nodesToUpdate.forEach(({ node, converted }) => {
    const w_node = document.createElement('GlobalNoteTA_w_node');

    const o_node = document.createElement('GlobalNoteTA_o_node');
    o_node.textContent = node.textContent;
    w_node.appendChild(o_node);

    const c_node = document.createElement('GlobalNoteTA_c_node');
    c_node.innerHTML = converted;
    w_node.appendChild(c_node);

    node.parentElement.replaceChild(w_node, node);

    // console.log(node.parentElement);
  });

  console.log(`Converted ${nodesConverted} text nodes.`);
}

// Create floating menu
function createFloatingMenu() {
  const menu = document.createElement('div');
  menu.id = 'globalnoteta-menu';
  menu.innerHTML = `
    <style>
      #globalnoteta-menu {
        user-select: none;
        position: fixed;
        bottom: 10px;
        left: 10px;
        background-color: Canvas;
        color: CanvasText;
        border-radius: 10px;
        border: 5px solid #177860;
        padding: 10px;
        z-index: 1000;
        font-size: 12px;
        font-family: sans-serif;
      }
      #globalnoteta-menu button {
        margin: 2px;
        padding: 5px 10px;
        cursor: pointer;
      }
      #globalnoteta-menu close-btn {
        position: absolute;
        top: 0px;
        right: 0px;
        background: none;
        border: none;
        padding: 0px;
        line-height: 18px;
        font-size: 32px;
        font-weight: bold;
        color: #808080;
        cursor: pointer;
      }
      GlobalNoteTA_phrase:nth-child(2n) {
        background-color: var(--debug-color0, none);
        color: var(--debug-text);
      }
      GlobalNoteTA_phrase:nth-child(2n+1) {
        background-color: var(--debug-color1, none);
        color: var(--debug-text);
      }
      globalnoteta_o_node {
        display: var(--original-display, none);
      }
      globalnoteta_c_node {
        display: var(--converted-display, inline);
      }
    </style>
    <close-btn id="close-btn"">×</close-btn>
    <div>
      <label><input type="checkbox" id="enable-conversion"> Enable Conversion</label>
    </div>
    <div>
      <label><input type="checkbox" id="show-original"> Show Original</label>
    </div>
    <div>
      <label><input type="checkbox" id="enable-highlight"> Enable Debug Highlight</label>
    </div>
    <div>
      <label>Target Variant:</label>
      <select id="variant-select">
        <option value="zh-cn">Simplified (China)</option>
        <option value="zh-tw" selected>Traditional (Taiwan)</option>
        <option value="zh-hk">Traditional (Hong Kong)</option>
        <option value="zh-sg">Simplified (Singapore)</option>
        <option value="zh-my">Simplified (Malaysia)</option>
        <option value="zh-mo">Traditional (Macau)</option>
      </select>
    </div>
    <button id="convert-now">Convert Now</button>
  `;
  document.body.appendChild(menu);

  // Event listeners
  document.getElementById('enable-conversion').addEventListener('change', (e) => {
    conversionEnabled = e.target.checked;
    chrome.storage.local.set({ conversionEnabled });
    if (conversionEnabled) convertPage();
  });

  document.getElementById('show-original').addEventListener('change', (e) => {
    showOriginal = e.target.checked;
    chrome.storage.local.set({ showOriginal });
    loadPref();
  });

  document.getElementById('enable-highlight').addEventListener('change', (e) => {
    highlightEnabled = e.target.checked;
    chrome.storage.local.set({ highlightEnabled });
    loadPref();
  });

  document.getElementById('variant-select').addEventListener('change', (e) => {
    currentVariant = e.target.value;
    chrome.storage.local.set({ currentVariant });
    if (conversionEnabled) convertPage();
  });

  function closeMenu() { document.getElementById("globalnoteta-menu").style.display = "none"; }

  document.getElementById('close-btn').addEventListener('click', closeMenu);

  document.getElementById('convert-now').addEventListener('click', convertPage);

  // Load settings
  chrome.storage.local.get([ 
    'currentVariant',
    'conversionEnabled',
    'showOriginal',
    'highlightEnabled'
  ], (result) => {
    currentVariant = result.currentVariant || 'zh-hk';
    conversionEnabled = result.conversionEnabled || false;
    showOriginal = result.showOriginal || false;
    highlightEnabled = result.highlightEnabled || false;
    document.getElementById('variant-select').value = currentVariant;
    document.getElementById('enable-conversion').checked = conversionEnabled;
    document.getElementById('show-original').checked = showOriginal;
    document.getElementById('enable-highlight').checked = highlightEnabled;
    loadPref();
  });
}

// load css
function loadPref() {
  // Show original
  if (showOriginal) {
    document.documentElement.style.setProperty('--original-display', 'inline');
    document.documentElement.style.setProperty('--converted-display', 'none');
  } else {
    document.documentElement.style.setProperty('--original-display', 'none');
    document.documentElement.style.setProperty('--converted-display', 'inline');
  }

  // Debug highlight
  if (highlightEnabled) {
    document.documentElement.style.setProperty('--debug-color0', 'orange');
    document.documentElement.style.setProperty('--debug-color1', 'yellow');
    document.documentElement.style.setProperty('--debug-text', 'black'); // dark mode compatibility
  } else {
    document.documentElement.style.setProperty('--debug-color0', '');
    document.documentElement.style.setProperty('--debug-color1', '');
    document.documentElement.style.setProperty('--debug-text', '');
  }
}

// Initialize on page load
console.log('GlobalNoteTA extension started running on page:', window.location.href);
createFloatingMenu();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateSettings') {
    conversionEnabled = request.conversionEnabled;
    // currentVariant = request.currentVariant; // if needed
    chrome.storage.local.set({ conversionEnabled });
    if (conversionEnabled) convertPage();
    sendResponse({ success: true });
  }
  if (request.action === 'openMenu') {
    // Open menu logic here
    document.getElementById("globalnoteta-menu").style.display = "block";
  }
});

// Observe DOM changes for dynamic content
const observer = new MutationObserver(() => {
  if (conversionEnabled) convertPage();
});
observer.observe(document.body, { childList: true, subtree: true });