# GlobalNoteTA

A browser extension that converts webpage text between simplified and traditional Chinese using conversion tables fetched from Wikipedia.

## Features

- Converts text on web pages between various Chinese variants (China, Taiwan, Hong Kong, etc.)
- Floating menu for per-page control
- Fetches and caches conversion tables from Wikipedia's MediaWiki API
- Supports Firefox and Chrome (with separate manifests)

## Installation

1. For Chrome: Load the extension in developer mode by selecting the folder containing manifest.json.
2. For Firefox: Use `web-ext` tool or adapt manifest to v2.

## Usage

- Click the extension icon to open settings.
- On a webpage, use the floating menu to enable conversion and select variant.
- Conversion applies to text content on the page.

## Development

- Tables are fetched on install and cached locally.
- Conversion uses greedy phrase matching for efficiency.
- Handles dynamic content with MutationObserver.

## License

Open-source, align with Wikipedia's terms.

## Human written stuff

### What is this

- vibe coded with Grok Code Fast 1 in vscode
- NoteTA is one of the 4 layers of "Chinese variant conversion" used in the Chinese Wikipedia (zhwiki)
- this plugin will implement the first 3 layers, and a final "Custom" layer will be added, which is basically layer 3 (NoteTA) again but this time not fetched from zhwiki but created by the user

### How is this "made"

- havn't really read the code yet
- havn't done much testing yet
- current state is basically Minimum Viable Product
- already used 48% of free tier credit, will start using non vscode ai to vibe

### todo

- [ ] bugs
  - [ ] css for debug highlight and show original might not be loaded
    - [ ] seems to be fixed, but conversion can happen earlier
- [ ] clean up ai mess
  - [ ] tables loading slowly
  - [ ] table names (s2t, t2s)
- [ ] performance issue
- [ ] floating menu
  - [ ] progress bar
  - [x] dark mode
  - [x] toggle debug highlight
  - [x] allow quick un-convert
  - [ ] <del>draggble</del>
- [ ] noteTA support
- [ ] custom rules support
