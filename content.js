async function init() {
  await loadTabl();

  loadPref();

  await readMenu();

  console.log(new Date().toISOString());
  console.log('Ready');

  if (conversionEnabled) convPage();
  new MutationObserver(() => {
    if (conversionEnabled) convPage();
  })
    .observe(document.body, { childList: true, subtree: true });
}

function loadTabl() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'getTables' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      tables = response?.tables || {};
      console.log('Tables loaded');

      resolve(tables);
    });
  });
}


function loadPref() {
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
  });
}

async function readMenu() {
  await loadMenu();
  loadStyl();
  readPopup();

  const menuEnableConversion = document.getElementById('enable-conversion');
  menuEnableConversion.checked = conversionEnabled;
  menuEnableConversion.addEventListener('change', (e) => {
    conversionEnabled = e.target.checked;
    chrome.storage.local.set({ conversionEnabled });
    if (conversionEnabled) convPage();
  });

  const menuShowOriginal = document.getElementById('show-original');
  menuShowOriginal.checked = showOriginal;
  menuShowOriginal.addEventListener('change', (e) => {
    showOriginal = e.target.checked;
    chrome.storage.local.set({ showOriginal });
    loadStyl();
  });

  const menuEnableHighlight = document.getElementById('enable-highlight');
  menuEnableHighlight.checked = highlightEnabled;
  menuEnableHighlight.addEventListener('change', (e) => {
    highlightEnabled = e.target.checked;
    chrome.storage.local.set({ highlightEnabled });
    loadStyl();
  });

  const menuVarientSelect = document.getElementById('variant-select');
  menuVarientSelect.value = currentVariant;
  menuVarientSelect.addEventListener('change', (e) => {
    currentVariant = e.target.value;
    chrome.storage.local.set({ currentVariant });
    loadStyl();
    if (conversionEnabled) convPage();
  });

  const closeBtn = document.querySelector('close-btn');
  closeBtn.addEventListener('click', () => {
    document.getElementById("globalnoteta-menu").style.display = "none";
  });

  document.getElementById('convert-now').addEventListener('click', () => {
    convPage()
  });
}

function loadMenu() {
  return new Promise((resolve, reject) => {
    const url = chrome.runtime.getURL("menu.html");

    fetch(chrome.runtime.getURL("menu.html"))
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load menu.html: ${response.status}`);
        }
        return response.text();
      })
      .then(html => {
        const menu = document.createElement("div");
        menu.id = "globalnoteta-menu";
        menu.innerHTML = html;
        document.body.appendChild(menu);
        console.log('Menu loaded')
        resolve(menu);
      })
      .catch(err => reject(err));
  });
}

function loadStyl() {
  docStyle = document.documentElement.style;
  const vs = ['hans', 'hant', 'cn', 'tw', 'hk', 'my', 'sg', 'mo']
  if (showOriginal) {
    docStyle.setProperty('--show-org', 'inline');
    for (v of vs) {
      docStyle.setProperty(`--show-${v}`, 'none');
    }
  } else {
    docStyle.setProperty('--show-org', 'none');
    for (v of vs) {
      docStyle.setProperty(`--show-${v}`, 'none');
    }
    docStyle.setProperty(`--show-${currentVariant.split("-")[1]}`, 'inline');
  }

  if (highlightEnabled) {
    docStyle.setProperty('--debug-color0', 'orange');
    docStyle.setProperty('--debug-color1', 'yellow');
    docStyle.setProperty('--debug-text', 'black');
  } else {
    docStyle.setProperty('--debug-color0', '');
    docStyle.setProperty('--debug-color1', '');
    docStyle.setProperty('--debug-text', '');
  }
}

function readPopup() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateSettings') {
      conversionEnabled = request.conversionEnabled;
      document.getElementById('enable-conversion').checked = conversionEnabled;
      // currentVariant = request.currentVariant; // if needed
      chrome.storage.local.set({ conversionEnabled });
      if (conversionEnabled) convPage();
      sendResponse({ success: true });
    }
    if (request.action === 'openMenu') {
      document.getElementById("globalnoteta-menu").style.display = "block";
    }
  });
}

function convPage() { // todo: cleanup
  if (!conversionEnabled) return;
  // console.log('Converting page to variant:', currentVariant);
  const start = performance.now();
  
  const skipList = [
    'SCRIPT', 'STYLE',
    'GLOBALNOTETA_PHRASE', 'GLOBALNOTETA_O_NODE',
    'GLOBALNOTETA_C_NODE_ZH-CN', 'GLOBALNOTETA_C_NODE_ZH-TW', 'GLOBALNOTETA_C_NODE_ZH-HK',
    'GLOBALNOTETA_C_NODE_ZH-MY', 'GLOBALNOTETA_C_NODE_ZH-SG', 'GLOBALNOTETA_C_NODE_ZH-MO',
    'GLOBALNOTETA_C_NODE_ZH-HANS', 'GLOBALNOTETA_C_NODE_ZH-HANT'
  ];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    { 
      acceptNode(node) { 
        if (node.nodeType === Node.TEXT_NODE) {               // handle untouched text
          if (skipList.includes(node.parentNode.nodeName)) {  // skip skipList
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.textContent.trim()) {                     // skip whitespace text
            return NodeFilter.FILTER_REJECT;
          }
          let ancestor = node.parentNode;                     // skip globalnoteta menu
          while (ancestor) {
            if (ancestor.id === "globalnoteta-menu") {
              return NodeFilter.FILTER_REJECT;
            }
            ancestor = ancestor.parentNode;
          }
          // console.log("'"+node.textContent+"'");
          // console.log(node.parentElement.nodeName);
          // console.log(node.parentNode.nodeName);
          return NodeFilter.FILTER_ACCEPT; 
        }
        if (node.nodeType === Node.ELEMENT_NODE) {            // handle converted text
          if (node.nodeName === 'GLOBALNOTETA_W_NODE') {
            // console.log("added");
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    },
    false
  );

  [nodesConv, charsConv, nodesHand, charsHand] = convNode(walker);

  const end = performance.now();
  const duration = end - start;
  console.log(
    `Handled   `+
    nodesHand.toString().padStart(5, " ")+` nodes with `+
    charsHand.toString().padStart(7, " ")+` chars in `+
    duration.toFixed(2).toString().padStart(7, " ")+` ms.`
  );
  // console.log(
  //   `Converted `+
  //   nodesConv.toString().padStart(5, " ")+` nodes with `+
  //   charsConv.toString().padStart(7, " ")+` chars in `
  // );
}

function convNode(walker) { // todo: cleanup
  const table = tables[currentVariant];
  const keys = Object.keys(table);
  const longestKey = keys.reduce((a, b) => (b.length > a.length ? b : a), "");
  const nodesToUpdate = [];
  let node;
  let nodesHand = 0;
  let charsHand = 0;
  let nodesConv = 0;
  let charsConv = 0;

  while (node = walker.nextNode()) {
    if (node.nodeName === 'GLOBALNOTETA_W_NODE') {
      if (node.querySelector(`GlobalNoteTA_c_node_${currentVariant}`)) {  // converted to this var
        continue;
      }
      original = node.querySelector("GlobalNoteTA_o_node").textContent;   // converted but not this var
      // console.log(original);
    } else {
      original = node.textContent;                                        // never converted
    }
    const converted = convText(original, table, longestKey.length);
    if (
      (node.nodeName === 'GLOBALNOTETA_W_NODE') ||
      (converted !== original)
    ) {
      nodesToUpdate.push({ node, converted });
      nodesConv++;
      charsConv += original.length;
    }
    // console.log(original);
    nodesHand++;
    charsHand += original.length;
  }

  // Replace text nodes with HTML spans
  nodesToUpdate.forEach(({ node, converted }) => {
    if (node.nodeName === 'GLOBALNOTETA_W_NODE') {
      if (node.querySelector(`GlobalNoteTA_c_node_${currentVariant}`)) {
        // console.log('skipping same var');
        return;
      }
      w_node = node;
    } else {
      w_node = document.createElement('GlobalNoteTA_w_node');

      const o_node = document.createElement('GlobalNoteTA_o_node');
      o_node.textContent = node.textContent;
      w_node.appendChild(o_node);
    }
    const c_node = document.createElement(`GlobalNoteTA_c_node_${currentVariant}`);
    c_node.innerHTML = converted;
    w_node.appendChild(c_node);

    node.parentElement.replaceChild(w_node, node);
    // console.log(node.parentElement);
  });
  return [nodesConv, charsConv, nodesHand, charsHand];
}

function convText(text, table, maxLength) {
  let result = '';
  let conversions = 0;
  let i = 0;
  while (i < text.length) {  // todo: rewrite and use strstr
    let matched = false;
    // Try longest match first (up to longestKey.length chars)
    for (let len = Math.min(maxLength, text.length - i); len > 0; len--) {
      const phrase = text.substr(i, len);
      if (table[phrase]) {
        const replacement = Array.isArray(table[phrase]) ? table[phrase][0] : table[phrase]; // isArray should always be false, will confirm later
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
  // if (conversions > 0) {
  //   console.log(`Converted ${conversions} phrases in text: "${text.substring(0, 30)}..." to "${result.substring(0, 30)}..."`);
  // }
  return result;
}

console.log(new Date().toISOString());
console.log('GlobalNoteTA extension started running on page:', window.location.href);
init();
