// Background service worker for GlobalNoteTA
// Fetches and caches conversion tables from Wikipedia

const variants = ["zh-cn", "zh-tw", "zh-hk", "zh-sg", "zh-my", "zh-mo"];

const tables = {};

async function fetchGlobalTables() {
  try {
    const url =
      "https://phabricator.wikimedia.org/source/mediawiki/browse/master/includes/Languages/Data/ZhConversion.php?view=raw";
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const phpContent = await response.text();
    console.log("Fetched ZhConversion.php, length:", phpContent.length);
    return parseGlobalTables(phpContent);
  } catch (error) {
    console.error("Failed to fetch global tables:", error);
    return {};
  }
}

function parseGlobalTables(phpContent) {
  const globalTables = {};
  const constNames = [
    "ZH_TO_HANT",
    "ZH_TO_HANS",
    "ZH_TO_TW",
    "ZH_TO_HK",
    "ZH_TO_CN",
  ];
  const keyMap = {
    ZH_TO_HANT: "hant",
    ZH_TO_HANS: "hans",
    ZH_TO_TW: "tw",
    ZH_TO_HK: "hk",
    ZH_TO_CN: "cn",
  };
  for (const constName of constNames) {
    const regex = new RegExp(
      `public const ${constName} = \\[([\\s\\S]*?)\\];`,
      "m",
    );
    const match = phpContent.match(regex);
    if (match) {
      const arrayContent = match[1];
      const table = parsePHPArray(arrayContent);
      globalTables[keyMap[constName]] = table;
      console.log(`Parsed ${constName}: ${Object.keys(table).length} mappings`);
    } else {
      console.warn(`Could not find ${constName} in PHP content`);
    }
  }
  return globalTables;
}

function parsePHPArray(arrayContent) {
  const table = {};
  const lines = arrayContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("//") && trimmed.includes("=>")) {
      // Match 'key' => 'value',
      const match = trimmed.match(/^'([^']+)' => '([^']+)',?$/);
      if (match) {
        const key = match[1];
        const value = match[2];
        table[key] = value;
      }
    }
  }
  return table;
}

async function fetchTable(variant) {
  try {
    const url = `https://zh.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&titles=MediaWiki:Conversiontable/${variant}&format=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const page = data.query.pages[Object.keys(data.query.pages)[0]];
    if (page.missing || !page.revisions || page.revisions.length === 0) {
      console.log(`Page missing or no revisions for ${variant}`);
      return {}; // Page doesn't exist or has no revisions
    }
    const content = page.revisions[0]["*"] || "";
    console.log(`Fetched content for ${variant}, length: ${content.length}`);
    const table = parseTable(content, variant);
    console.log(`Parsed ${Object.keys(table).length} mappings for ${variant}`);
    return table;
  } catch (error) {
    console.error(`Failed to fetch table for ${variant}:`, error);
    return {};
  }
}

function parseTable(content, variant) {
  const table = {};
  // Find all -{ ... }-
  const regex = /-\{([\s\S]*?)\}-/g;
  let match;
  let blockCount = 0;
  while ((match = regex.exec(content)) !== null) {
    blockCount++;
    const block = match[1];
    const lines = block.split("\n");
    lines.forEach((line) => {
      line = line.trim();
      if (line.startsWith("*")) {
        line = line.substring(1).trim(); // remove *
        const parts = line.split("=>");
        if (parts.length === 2) {
          let source = parts[0].trim().replace(/\[\[|\]\]/g, "");
          let targetPart = parts[1].trim();
          // Remove ; and comments
          targetPart = targetPart.split("//")[0].replace(/;$/, "").trim();
          const targets = targetPart
            .split(";")
            .map((t) => t.trim().replace(/\[\[|\]\]/g, ""))
            .filter((t) => t);
          if (targets.length > 0) {
            if (targets.length > 1) console.log(targets); // shouldnt happen, just incase
            table[source] = targets.length === 1 ? targets[0] : targets;
          }
        }
      }
    });
  }
  console.log(
    `Total blocks for ${variant}: ${blockCount}, total mappings: ${Object.keys(table).length}`,
  );
  return table;
}

async function loadTables() {
  console.log("Loading global conversion tables...");
  const globalTables = await fetchGlobalTables();
  console.log("Global tables loaded:", Object.keys(globalTables));

  console.log("Loading variant tables...");
  for (const variant of variants) {
    const wikiTable = await fetchTable(variant);
    let base = {};
    switch (variant) {
      case "zh-cn":
        base = { ...globalTables.hans, ...globalTables.cn };
        break;

      case "zh-tw":
        base = { ...globalTables.hant, ...globalTables.tw };
        break;

      case "zh-hk":
        base = { ...globalTables.hant, ...globalTables.hk };
        break;

      case "zh-sg":
      case "zh-my":
        base = { ...globalTables.hans };
        break;

      case "zh-mo":
        base = { ...globalTables.hant };
        break;

      default:
        console.warn("Unknown variant:", variant);
        break;
    }

    tables[variant] = { ...base, ...wikiTable };
    console.log(
      `Merged table for ${variant}: ${Object.keys(tables[variant]).length} mappings`,
    );
  }

  tables["hant"] = globalTables.hant || {};
  tables["hans"] = globalTables.hans || {};
  chrome.storage.local.set({ tables, lastUpdated: Date.now() });
  console.log("Tables loaded and cached.");
}

// Load tables on install and startup
chrome.runtime.onInstalled.addListener(loadTables);
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(["lastUpdated"], (result) => {
    const now = Date.now();
    if (!result.lastUpdated || now - result.lastUpdated > 24 * 60 * 60 * 1000) {
      // Refresh daily
      loadTables();
    }
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTables") {
    chrome.storage.local.get(["tables"], (result) => {
      sendResponse({ tables: result.tables || {} });
    });
    return true; // Keep message channel open for async response
  }
});
