// ----------------------------- Constants -----------------------------
const zh2en = {
  "，": ",", "。": ".", "：": ":", "；": ";", "！": "!", "？": "?",
  "“": "\"", "”": "\"", "‘": "'", "’": "'", "（": "(", "）": ")",
  "【": "[", "】": "]", "《": "<", "》": ">", "、": "\\", "「": "{",
  "」": "}", "～": "~", "｜": "|", "——": "_"
};

const pairMap = {
  "(": ")", "[": "]", "{": "}", "\"": "\"", "'": "'", "<": ">",
  "（": ")", "【": "]", "「": "}", "“": "\"", "‘": "'", "《": ">"
};

// 预计算：最长 token 长度，用于 ContentEditable 回看
const MAX_TOKEN_LEN = Math.max(...Object.keys(zh2en).map(k => k.length));

const escapeRegex = s => s.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");

/**
 * Alternation‑RegExp 按长度降序，确保多字符（如 "——"）先被匹配。
 */
const zhRegex = new RegExp(
  Object.keys(zh2en)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join("|"),
  "g"
);

// --------------------------- 默认设置 & 缓存 ---------------------------

const default_setting = { enable: true, mode: "allow", sites: [] };
let settings = { ...default_setting };

// ------------------------------- Helpers ------------------------------

const punctuation_converter = str => str.replace(zhRegex, m => zh2en[m]);

const isEditable = el => (
  (el.tagName === "INPUT" && /text|search|url|email|tel/.test(el.type)) ||
  el.tagName === "TEXTAREA" ||
  el.isContentEditable
);

function whether_process_this_site() {
  const host = location.hostname;
  if (!settings.enable) return false;
  if (settings.mode === "allow") {
    return settings.sites.length === 0 || settings.sites.includes(host);
  } else {
    return !settings.sites.includes(host);
  }
}

/**
 * 获取当前选区信息（Collapsed / 非Collapsed 通用）。
 */
function getSelectionData(el) {
  if (el.isContentEditable) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    return {
      hasSelection: !sel.isCollapsed,
      range: range,
      start: range.startOffset,
      end: range.endOffset,
      startNode: range.startContainer,
      endNode: range.endContainer,
      text: sel.toString()
    };
  }
  // INPUT / TEXTAREA
  return {
    start: el.selectionStart,
    end: el.selectionEnd,
    text: el.value.slice(el.selectionStart, el.selectionEnd),
    hasSelection: el.selectionStart !== el.selectionEnd
  };
}

/**
 * 在给定选区内替换文本，并根据 caretAfter 设置新光标位置。
 * caretAfter === null → 维持默认（文本末尾 / 保持选区）。
 */
function replaceRange(el, selInfo, insertText, caretAfter) {
  if (el.isContentEditable) {
    const range = selInfo.range.cloneRange();
    range.deleteContents();
    const textNode = document.createTextNode(insertText);
    range.insertNode(textNode);

    const sel = window.getSelection();
    sel.removeAllRanges();
    const pos = caretAfter !== null ? caretAfter : insertText.length;
    sel.collapse(textNode, pos); //
  } else {
    // INPUT / TEXTAREA
    const { start, end } = selInfo;
    const value = el.value;
    el.value = value.slice(0, start) + insertText + value.slice(end);
    const pos = caretAfter !== null ? caretAfter : start + insertText.length;
    el.setSelectionRange(pos, pos);
  }
}

// ------------------------------- Handlers -----------------------------

/**
 * 自动中文→英文符号转换（input/textarea 整串；contentEditable 回看 MAX_TOKEN_LEN）。
 */
function input_handler(e) {
  if (!whether_process_this_site()) return;
  const el = e.target;
  if (!isEditable(el)) return;

  // INPUT / TEXTAREA：一次性转换整串文本
  if (!el.isContentEditable) {
    const value = el.value;
    const converted = punctuation_converter(value);
    if (value !== converted) {
      const pos = el.selectionStart;
      el.value = converted;
      el.setSelectionRange(pos, pos);
    }
    return;
  }

  // contentEditable：仅回看 MAX_TOKEN_LEN 个字符，避免全量重排 DOM。
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const { startContainer, startOffset } = range;
  if (startContainer.nodeType !== Node.TEXT_NODE) return;

  const textNode = startContainer;
  const lookStart = Math.max(0, startOffset - MAX_TOKEN_LEN);
  const frag = textNode.textContent.slice(lookStart, startOffset);
  const replaced = punctuation_converter(frag);
  if (frag === replaced) return; // 无变化

  // 直接替换 textContent，对应区段大小不变（因为映射 1:1）
  textNode.textContent =
    textNode.textContent.slice(0, lookStart) +
    replaced +
    textNode.textContent.slice(startOffset);

  // 重设光标位置
  const newCaretPos = lookStart + replaced.length;
  sel.collapse(textNode, newCaretPos); //
}

/**
 * 括号/引号自动补全。
 */
function pair_handler(e) {
  if (!whether_process_this_site()) return;
  if (e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;

  const el = e.target;
  if (!isEditable(el)) return;

  const pressed = e.key;
  const rightChar = pairMap[pressed] || pairMap[zh2en[pressed]];
  if (!rightChar) return; // 非成对符号

  e.preventDefault();

  const leftChar = zh2en[pressed] || pressed;
  const selInfo = getSelectionData(el);
  if (!selInfo) return;

  if (selInfo.hasSelection) {
    // 包围选区
    replaceRange(el, selInfo, leftChar + selInfo.text + rightChar, null);
  } else {
    // 插入并把光标放中间
  //   replaceRange(el, selInfo, leftChar + rightChar, selInfo.start + 1);
      const caretPos = el.isContentEditable ? 1 : selInfo.start + 1;
      replaceRange(el, selInfo, leftChar + rightChar, caretPos);
  }
}

// ------------------------------- Listeners ----------------------------

window.addEventListener("input", input_handler, true);
window.addEventListener("keydown", pair_handler, true);

// --------------------------- Settings Sync ----------------------------

function loadSettings() {
  chrome.storage.sync.get(["enable", "mode", "sites"], res => {
    settings.enable = res.enable !== undefined ? res.enable : true;
    settings.mode = res.mode || "allow";
    settings.sites = Array.isArray(res.sites) ? res.sites : [];
  });
}

chrome.storage.onChanged.addListener(loadSettings);
loadSettings();
