async function init() {
  await loadTabl();

  loadPref();

  await readMenu();

  console.log(new Date().toISOString());
  console.log('Ready');

  nodeList = initScan();
  if (conversionEnabled) nodeList = convPage(nodeList);

  new MutationObserver((mutationsList) => {
    // console.log('mut');
    for (const mutation of mutationsList) {
      if (
        mutation.addedNodes[0] &&
        mutation.addedNodes[0].nodeName !== 'GLOBALNOTETA_W_NODE'
      ) {
        if (mutation.type === "childList") {
          // console.log(mutation);
          mutation.addedNodes.forEach(node => {
            // console.log(node);
            const walker = document.createTreeWalker(
              node,
              NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
              { acceptNode: treeFilter },
              false
            );
            while (node = walker.nextNode()) {
              // console.log('pushing');
              // console.log(node);
              nodeList.push(node);
            }
          });
        }
      }
    }
    // console.log('done');
    if (conversionEnabled) nodeList = convPage(nodeList);
  }).observe(document.body, { childList: true, subtree: true });
}

const skipList = [
  'SCRIPT', 'STYLE',
  'GLOBALNOTETA_PHRASE', 'GLOBALNOTETA_O_NODE',
  'GLOBALNOTETA_C_NODE_ZH-CN', 'GLOBALNOTETA_C_NODE_ZH-TW', 'GLOBALNOTETA_C_NODE_ZH-HK',
  'GLOBALNOTETA_C_NODE_ZH-MY', 'GLOBALNOTETA_C_NODE_ZH-SG', 'GLOBALNOTETA_C_NODE_ZH-MO',
  'GLOBALNOTETA_C_NODE_ZH-HANS', 'GLOBALNOTETA_C_NODE_ZH-HANT'
];

function treeFilter(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (skipList.includes(node.parentNode.nodeName)) {
      return NodeFilter.FILTER_REJECT;    // reject skipList
    }
    if (!node.textContent.trim()) {
      return NodeFilter.FILTER_REJECT;    // reject whitespace text
    }
    let ancestor = node.parentNode;
    while (ancestor) {
      if (ancestor.id === "globalnoteta-menu") {
        return NodeFilter.FILTER_REJECT;  // reject globalnoteta menu
      }
      ancestor = ancestor.parentNode;
    }
    if (node.parentElement == null) {
        return NodeFilter.FILTER_REJECT;  // dont know how to deal with this
    }
    // console.log('accepting');
    // console.log(node);
    return NodeFilter.FILTER_ACCEPT;      // accept untouched text
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.parentElement == null) {
        return NodeFilter.FILTER_REJECT;  // dont know how to deal with this
    }
    if (node.nodeName === 'GLOBALNOTETA_W_NODE') {
      if (!node.querySelector(`GlobalNoteTA_c_node_${currentVariant}`)){
        // console.log('accepting');
        // console.log(node);
        return NodeFilter.FILTER_ACCEPT;  // accept converted text, not current variant
      } else {
        return NodeFilter.FILTER_REJECT;  // reject converted text, current variant
      }
    }
    return NodeFilter.FILTER_SKIP;        // skip non noteta element
  }
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

function initScan() {
  console.log('init scan');

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    { acceptNode: treeFilter },
    false
  );

  newList = [];
  while (node = walker.nextNode()) {
    newList.push(node);
  }

  return newList;
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
    nodeList = initScan();
    if (conversionEnabled) nodeList = convPage(nodeList);
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
    nodeList = initScan();
    if (conversionEnabled) nodeList = convPage(nodeList);
  });

  const closeBtn = document.querySelector('close-btn');
  closeBtn.addEventListener('click', () => {
    document.getElementById("globalnoteta-menu").style.display = "none";
  });

  document.getElementById('convert-now').addEventListener('click', () => {
    nodeList = initScan();
    nodeList = convPage(nodeList);
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
  
  if (showOriginal) {
    document.body.setAttribute("gnta-var", "org");
  } else {
    document.body.setAttribute("gnta-var", currentVariant);
  }

  if (highlightEnabled) {
    document.body.setAttribute("gnta-high", "on");
  } else {
    document.body.setAttribute("gnta-high", "off");
  }
}

function readPopup() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateSettings') {
      conversionEnabled = request.conversionEnabled;
      document.getElementById('enable-conversion').checked = conversionEnabled;
      // currentVariant = request.currentVariant; // if needed
      chrome.storage.local.set({ conversionEnabled });
      nodeList = initScan();
      if (conversionEnabled) nodeList = convPage(nodeList);
      sendResponse({ success: true });
    }
    if (request.action === 'openMenu') {
      document.getElementById("globalnoteta-menu").style.display = "block";
    }
  });
}

function convPage(nodeList) {
  // console.log(nodeList.length);
  const table = tables[currentVariant];
  const keys = Object.keys(table);
  const longestKey = keys.reduce((a, b) => (b.length > a.length ? b : a), "");

  const observer = new IntersectionObserver((entries) => {
    const start = performance.now();
    nodesHand = 0;
    charsHand = 0;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        if (entry.target.nodeName === 'GLOBALNOTETA_W_NODE') {
          if (!entry.target.querySelector(`GlobalNoteTA_c_node_${currentVariant}`)) {
            nodesHand++;
            charsHand += entry.target.firstChild.textContent.length;
            entry.target.appendChild(convNode(entry.target, table, longestKey));
          }
        } else {
          // console.log(entry.target);
          for (child of entry.target.childNodes) {
            // console.log(child);
            if (child.nodeType === Node.TEXT_NODE) {
              if (child.textContent.trim()) {
                nodesHand++;
                charsHand += child.textContent.length;
                newChild = convNode(child, table, longestKey);
                if (newChild !== child) {
                  entry.target.replaceChild(newChild, child);
                }
              }
            }
          }
        }
      }
    });
    const end = performance.now();
    const duration = end - start;
    console.log(
      `Handled   `+
      nodesHand.toString().padStart(5, " ")+` nodes with `+
      charsHand.toString().padStart(7, " ")+` chars in `+
      duration.toFixed(2).toString().padStart(7, " ")+` ms.`
    );
  }, {
    threshold: 0,
    rootMargin: "100%"
  });

  for (node of nodeList) {
    if (node.nodeName === 'GLOBALNOTETA_W_NODE') {
      if (!node.querySelector(`GlobalNoteTA_c_node_${currentVariant}`)) {
        observer.observe(node);
      }
    } else {
      if (node.parentElement == null) {
        // console.log('observing');
        // console.log(node);
        continue;
      }
      observer.observe(node.parentElement);
    }
  }
  return [];
  // return nodeList;
}

function convNode(node, table, longestKey) {
  if (node.nodeName === 'GLOBALNOTETA_W_NODE') {
    original = node.firstChild.textContent;
  } else {
    original = node.textContent;
  }
  const converted = convText(original, table, longestKey.length);
  if (
    (node.nodeName === 'GLOBALNOTETA_W_NODE') ||
    (converted !== original)
  ) {
    const c_node = document.createElement(`GlobalNoteTA_c_node_${currentVariant}`);
    c_node.innerHTML = converted;
    if (node.nodeName === 'GLOBALNOTETA_W_NODE') {
      return c_node;
    } else {
      w_node = document.createElement('GlobalNoteTA_w_node');
      const o_node = document.createElement('GlobalNoteTA_o_node');
      o_node.textContent = original;
      w_node.appendChild(o_node);
      w_node.appendChild(c_node);
      return w_node;
    }
  } else {
    return node;
  }
}

function convText(text, table, maxLength) {
  let result = '';
  let conversions = 0;
  let i = 0;
  while (i < text.length) {  // todo: rewrite and use strstr
    let matched = false;
    for (let len = Math.min(maxLength, text.length - i); len > 0; len--) {
      const phrase = text.substr(i, len);
      if (table[phrase]) {
        const replacement = Array.isArray(table[phrase]) ? table[phrase][0] : table[phrase]; // isArray should always be false, will confirm later
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
  return result;
}

console.log(new Date().toISOString());
console.log('GlobalNoteTA extension started running on page:', window.location.href);
init();
