// Content script for GlobalNoteTA
// Handles text conversion and floating menu

let tables = {};
let currentVariant = 'zh-tw'; // Default to traditional
let conversionEnabled = false;

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
        result += `<GlobalNoteTA class="highlight${conversions % 2}">${replacement}</GlobalNoteTA>`;
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
    if (node.parentElement && node.parentElement.tagName !== 'SCRIPT' && node.parentElement.tagName !== 'STYLE' && node.parentElement.tagName !== 'GLOBALNOTETA') {
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
    const span = document.createElement('span');
    span.innerHTML = converted;
    node.parentElement.replaceChild(span, node);
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
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: white;
        border: 1px solid #ccc;
        padding: 10px;
        z-index: 10000;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        font-family: Arial, sans-serif;
        font-size: 12px;
      }
      #globalnoteta-menu button {
        margin: 2px;
        padding: 5px 10px;
        cursor: pointer;
      }
      .highlight0 { 
        background-color: yellow; /* Change to your preferred color */
        border-radius: 3px;
        padding: 0 2px;
      }
      .highlight1 { 
        background-color: orange; /* Change to your preferred color */
        border-radius: 3px;
        padding: 0 2px;
      }
    </style>
    <div>
      <label><input type="checkbox" id="enable-conversion"> Enable Conversion</label>
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

  document.getElementById('variant-select').addEventListener('change', (e) => {
    currentVariant = e.target.value;
    chrome.storage.local.set({ currentVariant });
    if (conversionEnabled) convertPage();
  });

  document.getElementById('convert-now').addEventListener('click', convertPage);

  // Load settings
  chrome.storage.local.get(['conversionEnabled', 'currentVariant'], (result) => {
    conversionEnabled = result.conversionEnabled || false;
    currentVariant = result.currentVariant || 'zh-tw';
    document.getElementById('enable-conversion').checked = conversionEnabled;
    document.getElementById('variant-select').value = currentVariant;
  });
}

// Initialize on page load
console.log('GlobalNoteTA extension started running on page:', window.location.href);
createFloatingMenu();
// Observe DOM changes for dynamic content
const observer = new MutationObserver(() => {
  if (conversionEnabled) convertPage();
});
observer.observe(document.body, { childList: true, subtree: true });