const GET = "getColors";
const HIGHLIGHT = "highlightColor";
const SELECTED = "selected";

let colors = new Map();
let backgrounds = new Map();
let svgs = new Map();

let visited = new Map();

const outlinesContainer = document.createElement("div");
outlinesContainer.style.position = "absolute";
outlinesContainer.style.top = 0;
outlinesContainer.style.left = 0;
document.body.append(outlinesContainer);

function findColors() {
  const defaultBackgroundColor = getDefaultBackgroundColor();
  forAllNodes((node) => {
    if (visited.has(node) || !elementHasSize(node)) return;

    let style = window.getComputedStyle(node);

    if (hasDirectText(node)) {
      tryLinkNodeToColor(colors, style.color, node);
    }

    tryLinkNodeToColor(backgrounds, style.background, node);

    if (defaultBackgroundColor !== style.backgroundColor)
      tryLinkNodeToColor(backgrounds, style.backgroundColor, node);

    if (node instanceof SVGElement || node.tagName.toLowerCase() === "svg") {
      tryLinkNodeToColor(svgs, style.color, node);
      tryLinkNodeToColor(svgs, style.fill, node);
    }

    visited.set(node, true);
  });

  return {
    text: getKeysOfMap(colors),
    backgrounds: getKeysOfMap(backgrounds),
    svgs: getKeysOfMap(svgs),
  };
}

function getDefaultBackgroundColor() {
  const dummyElement = document.createElement("div");
  document.body.append(dummyElement);
  const defaultBackgroundColor =
    window.getComputedStyle(dummyElement).backgroundColor;
  dummyElement.remove();
  return defaultBackgroundColor;
}

function hasDirectText(node) {
  if (!node.innerText) return false;

  let directText = node.innerText;
  [...node.children].forEach((child) => {
    const childText = child.innerText;
    if (!childText) return;

    const index = directText.indexOf(childText);
    if (index !== -1) {
      directText =
        directText.substring(0, index) +
        directText.substring(index + childText.length);
    }
  });
  return directText.trim().length !== 0;
}

function elementHasSize(node) {
  const { height, width } = node.getBoundingClientRect();
  return height > 0 && width > 0;
}

function getKeysOfMap(map) {
  const keys = [];
  for (let [key, _] of map) {
    keys.push(key);
  }
  return keys;
}

function tryLinkNodeToColor(map, color, node) {
  if (!color || color === "none") return;
  map.set(color, [...(map.get(color) || []), node]);
}

function forAllNodes(func) {
  let nodeQueue = [document.body];
  while (nodeQueue.length !== 0) {
    let node = nodeQueue[0];
    if (node === outlinesContainer) {
      nodeQueue = nodeQueue.slice(1);
    } else {
      nodeQueue = [...nodeQueue.slice(1), ...node.children];
      func(node);
    }
  }
}

let currentOutlines = [];
let currentSelection = { type: null, color: null };

browser.runtime.onMessage.addListener(({ message, ...rest }, _) => {
  if (message === GET) {
    return Promise.resolve(findColors());
  }
  if (message === SELECTED) {
    return Promise.resolve(currentSelection);
  }
  if (message === HIGHLIGHT) {
    return Promise.resolve(highlightSelection(rest));
  }

  return Promise.resolve(false);
});

function highlightSelection(rest) {
  removeOutlines();

  if (matchesCurrentSelection(rest)) {
    resetSelection();
    return true;
  }

  setSelection(rest);

  let nodes;

  if (rest.color) {
    nodes = colors.get(rest.color);
  } else if (rest.background) {
    nodes = backgrounds.get(rest.background);
  } else if (rest.fill) {
    nodes = svgs.get(rest.fill);
  }

  addOutlines(nodes);
  return true;
}

function resetSelection() {
  currentSelection = { type: null, color: null };
}

function setSelection(obj) {
  const keys = Object.keys(obj);
  const type = keys[0];
  currentSelection = { type, color: obj[type] };
}

function matchesCurrentSelection(obj) {
  return obj[currentSelection.type] === currentSelection.color;
}

function matchesSelection(type, color) {
  if (currentSelection.type === type && color === currentSelection.color) {
    removeOutlines();
    return true;
  }
}

function addOutlines(nodes) {
  currentOutlines = [];
  for (let node of nodes) {
    let element = createPositionedElement(node);
    currentOutlines.push(element);
  }
}

function removeOutlines() {
  for (let node of currentOutlines) {
    node.remove();
  }
}

function createPositionedElement(node) {
  const position = node.getBoundingClientRect();

  const element = document.createElement("div");
  if (isFixedOrSticky(node)) {
    element.style.position = "fixed";
    element.style.top = `${position.top - 2}px`;
  } else {
    element.style.position = "absolute";
    element.style.top = `${position.top - 2 + window.scrollY}px`;
  }
  element.style.left = `${position.left - 2}px`;
  element.style.width = `${position.width + 2}px`;
  element.style.height = `${position.height + 2}px`;
  element.style.border = "2px solid red";
  element.style.pointerEvents = "none";
  element.style.zIndex = 1000000;

  outlinesContainer.append(element);

  return element;
}

function isFixedOrSticky(node) {
  return node.style.position === "fixed" || node.style.position === "sticky";
}

function parentIsFixedOrSticky(node) {
  let current = node;
  while (current != document.body) {
    if (
      current.style.position === "fixed" ||
      current.style.position === "sticky"
    ) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
}
