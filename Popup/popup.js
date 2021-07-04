const GET = "getColors";
const HIGHLIGHT = "highlightColor";
const SELECTED = "selected";

const content = document.getElementById("content");

const textColorsDiv = document.getElementById("textColors");
const backgroundsDiv = document.getElementById("backgrounds");
const svgsDiv = document.getElementById("svgs");

const spinner = document.getElementById("loader");

const hover = document.getElementById("hover");

const modeInput = document.getElementById("mode-input");
var modeNodes = document.getElementsByClassName("mode-selector")[0];
var modeChildren = modeNodes.getElementsByTagName("span");
const copyModeText = modeChildren[0];
const showModeText = modeChildren[modeChildren.length - 1];
const clipboardInput = document.getElementById("clipboard-input");
let isCopyMode = true;

modeInput.addEventListener("change", (event) => {
  setMode(!event.target.checked);
});

sendGetColorsMessage();
sendGetSelectedMessage();

const copiedBlob = document.createElement("div");
copiedBlob.innerText = "Copied";
copiedBlob.className = "copied";
let copiedTimeoutId;

function copyToClipboard(element, text) {
  if (copiedTimeoutId) clearTimeout(copiedTimeoutId);

  element.classList.add("copied");
  document.body.append(copiedBlob);
  const posData = element.getBoundingClientRect();
  const posData2 = copiedBlob.getBoundingClientRect();
  copiedBlob.style.left = pixelString(posData.left);
  copiedBlob.style.top = pixelString(
    posData.top + window.scrollY - posData2.height
  );

  setTimeout(() => {
    element.classList.remove("copied");
  }, 200);
  copiedTimeoutId = setTimeout(() => {
    copiedBlob.remove();
  }, 1000);
  clipboardInput.value = text;
  clipboardInput.select();
  document.execCommand("copy");
  clipboardInput.blur();
}

function setMode(mode) {
  isCopyMode = mode;
  if (isCopyMode && currentSelection) {
    toggleHighlights(
      currentSelection,
      currentSelection.dataset.color,
      currentSelection.dataset.type
    );
    setTimeout(toggleModeTransition, 200);
  } else {
    toggleModeTransition();
  }
}

function toggleModeTransition() {
  if (isCopyMode) {
    colorBlocks.forEach((block) => block.classList.add("copy-mode"));
    copyModeText.classList.add("active");
    showModeText.classList.remove("active");
  } else {
    colorBlocks.forEach((block) => block.classList.remove("copy-mode"));
    showModeText.classList.add("active");
    copyModeText.classList.remove("active");
  }
}

async function sendGetSelectedMessage() {
  let result = await sendMessage({ message: SELECTED });
  if (result) handleGetSelectedResponse(result);
}

async function sendGetColorsMessage() {
  let result = await sendMessage({ message: GET });
  if (result) handleGetColorsResponse(result);
}

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0] ?? null;
}

async function sendMessage(obj) {
  try {
    const tab = await getActiveTab();
    return await browser.tabs.sendMessage(tab.id, obj);
  } catch (_) {
    showError();
    return null;
  }
}

function showError() {
  spinner.remove();
  content.remove();
  document.getElementById("error").hidden = false;
}

function sendHighlightRequest(data) {
  return sendMessage({ message: HIGHLIGHT, ...data });
}

let colorBlocks = [];

function handleGetColorsResponse(response) {
  spinner.remove();
  content.hidden = false;

  let { text, backgrounds, svgs } = response;
  if (text.length > 0) {
    text.sort(sortByColor).forEach((color) => {
      addColorNode(color, textColorsDiv, "color");
    });
  } else {
    document.getElementById("textContainer").remove();
  }

  if (backgrounds.length > 0) {
    backgrounds.sort(sortByColor).forEach((color) => {
      addColorNode(color, backgroundsDiv, "background");
    });
  } else {
    document.getElementById("backgroundsContainer").remove();
  }

  if (svgs.length > 0) {
    svgs.sort(sortByColor).forEach((color) => {
      addColorNode(color, svgsDiv, "fill");
    });
  } else {
    document.getElementById("svgsContainer").remove();
  }

  return true;
}

function handleGetSelectedResponse(response) {
  let { type, color } = response;
  if (type && color) {
    modeInput.checked = true;
    setMode(false);
    currentSelection = colorBlocks.find((block) => {
      return block.dataset.type === type && block.dataset.color === color;
    });
    toggleSelection(currentSelection, true);
  }
  return true;
}

const regex =
  /rgba?\s*\(\s*(?<r>\d+)\s*,\s*(?<g>\d+)\s*,\s*(?<b>\d+)(\s*,\s*(?<a>\d+\.?\d*))?\s*\)/;

function sortByColor(a, b) {
  return compareDecomposedColors(decomposeColor(a), decomposeColor(b));
}

function decomposeColor(color) {
  const match = color.match(regex);
  if (!match) return [0, 0, 0, 0];
  const groups = match.groups;
  return [
    Number.parseInt(groups.r),
    Number.parseInt(groups.g),
    Number.parseInt(groups.b),
    Number.parseFloat(groups.a ?? "1"),
  ];
}

function compareDecomposedColors(a, b) {
  const typeComp = compareColorType(a, b);
  if (typeComp !== 0) return typeComp;
  return getBrightness(b) - getBrightness(a);
}

function compareColorType(a, b) {
  return getColorType(b) - getColorType(a);
}

function getColorType([r, g, b, _]) {
  if (r > g && r > b) return 4;
  if (g > r && g > b) return 3;
  if (b > r && b > g) return 2;
  return 1;
}

function getBrightness([r, g, b, a]) {
  return r + g + b + a * 255;
}
let currentSelection;

function addColorNode(color, parent, type) {
  const element = createColorNode(color);
  element.dataset.type = type;
  element.dataset.color = color;
  element.addEventListener("mousedown", () => {
    if (isCopyMode) {
      copyToClipboard(element, color);
    } else {
      toggleHighlights(element, color, type);
    }
  });
  element.addEventListener("mouseleave", () => {
    hover.hidden = true;
  });
  element.addEventListener("mousemove", (event) => {
    if (hover.hidden) {
      hover.hidden = false;
      hover.innerText = color;
    }
    const size = hover.getBoundingClientRect();
    hover.style.top = pixelString(getWithinBoundsY(event.y, size));
    hover.style.left = pixelString(getWithinBoundsX(event.x, size));
  });
  colorBlocks.push(element);
  parent.append(element);
}

function getWithinBoundsY(y, { height }) {
  const total = document.body.clientHeight;
  return Math.min(window.scrollY + y, total - height);
}

function getWithinBoundsX(ex, { width }) {
  const total = document.body.clientWidth;
  return Math.min(Math.max(ex, width / 2), total - (width / 3) * 2);
}

function pixelString(pixels) {
  return `${pixels}px`;
}

function toggleHighlights(element, color, type) {
  const msg = {};
  msg[type] = color;
  sendHighlightRequest(msg);

  if (currentSelection) {
    toggleSelection(currentSelection, false);
  }

  if (currentSelection === element) {
    currentSelection = null;
    return;
  }

  currentSelection = element;
  toggleSelection(element);
}

function toggleSelection(element, value) {
  element.classList.toggle("selected", value);
}

function createColorNode(color) {
  const container = document.createElement("div");
  container.className = "color-container";
  if (isCopyMode) container.classList.add("copy-mode");

  const colorBlock = document.createElement("div");
  colorBlock.className = "color-block";
  colorBlock.style.background = color;

  container.append(colorBlock);

  return container;
}
