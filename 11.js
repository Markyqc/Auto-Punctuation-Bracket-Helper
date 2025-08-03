// ------------------------------------------ Constants ------------------------------------------
const zh2en = {
  '，': ',', '。': '.', '：': ':', '；': ';', '！': '!', '？': '?',
  '“': '"', '”': '"', '‘': "'", '’': "'", '（': '(', '）': ')',
  '【': '[', '】': ']', '《': '<', '》': '>', '、': '\\', '「':'{',
  '」':'}','～':'~', '｜':'|', '——': '_'
};

const pairMap = {
  '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '<': '>',
  '（': ')', '【': ']', '「': '}', '“': '"', "‘": "'",'《': '>'
};

const zhRegex = new RegExp('[' + Object.keys(zh2en).map(c => c.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')).join('') + ']', 'g');

default_setting = {
    enable: true,
    mode: 'allow',
    sites: []
}

settings = default_setting;

// ------------------------------------------- Helpers -------------------------------------------

function punctuation_converter(str) {
    return str.replace(zhRegex, ch => zh2en[ch]);
}

function isEditable(el) {
  return (el.tagName === 'INPUT' && /text|search|url|email|tel/.test(el.type)) ||
         el.tagName === 'TEXTAREA' ||
         el.isContentEditable;
}

function whether_process_this_site(){
    const host = location.hostname;
    if(!settings.enable)return false;
    if(settings.mode === 'allow'){
        return settings.sites.length === 0 || settings.sites.includes(host);
    } else {
        return !settings.sites.includes(host);
    }
}

function getSelectionData(el){
    if (el.isContentEditable) {
        const sel   = window.getSelection();
        const range = sel.getRangeAt(0);
        return{
            hasSelection : !sel.isCollapsed,
            range        : range,
            start        : range.startOffset,
            end          : range.endOffset,
            startNode    : range.startContainer,
            endNode      : range.endContainer,
            text         : sel.toString(),
        };
    } else {
        return {
            start        : el.selectionStart,
            end          : el.selectionEnd,
            text         : el.value.slice(el.selectionStart, el.selectionEnd),
            hasSelection : el.selectionStart !== el.selectionEnd,
        };
    }
}

function replaceRange(el, selInfo, insertText, caretAfter) {
    if (el.isContentEditable) {
        const range = selInfo.range.cloneRange();
        range.deleteContents();
        range.insertNode(document.createTextNode(insertText));

        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.collapse(range.endContainer, range.endOffset);
    } else {
        const {start,end} = selInfo;
        const value = el.value;
        el.value = value.slice(0, start) + insertText + value.slice(end);

        const pos = caretAfter !== null ? caretAfter : start + insertText.length;
        el.setSelectionRange(pos, pos);
    }
    return;
}

// ------------------------------------------ Handler ------------------------------------------

function input_handler(e){
    if(!whether_process_this_site())return;
    const el = e.target;
    if(el.isContentEditable){
        const sel = window.getSelection();
        if(!sel || !sel.rangeCount)return;
        const range = sel.getRangeAt(0).cloneRange();
        range.setStart(range.endContainer, Math.max(0,range.endOffset-1));
        const text = range.toString();
        const replaced = punctuation_converter(text);
        if(text !== replaced){
            range.deleteContents();
            const textNode = document.createTextNode(replaced);
            range.insertNode(textNode);
            const newRange = document.createRange();
            newRange.setStart(textNode, replaced.length);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
        }
    } else {
        const value = el.value;
        const replaced = punctuation_converter(value);
        if(value !== replaced){
            const pos = el.selectionStart;
            el.value = replaced;
            el.setSelectionRange(pos,pos);
        }
    }
    return;
}

function pair_handler(e) {
    if (!whether_process_this_site()) return;
    const el = e.target;
    if (!isEditable(el)) return;

    const leftIns = e.key;
    const rightChar = pairMap[leftIns] || pairMap[zh2en[leftIns]];
    const leftChar = zh2en[leftIns] || leftIns;
    if (!rightChar) return;

    e.preventDefault();
    const selInfo = getSelectionData(el);

    if (selInfo.hasSelection) {
        replaceRange(
        el,
        selInfo,
        leftChar + selInfo.text + rightChar,
        null
        );
    } else {
        replaceRange(
        el,
        selInfo,
        leftChar + rightChar,
        selInfo.start + 1
        );
    }
}

// ------------------------------------------ Listener ------------------------------------------

window.addEventListener('input', input_handler, true);
window.addEventListener('keydown', pair_handler, true);

// ---------------------------------------- Load Settings ----------------------------------------

function loadSettings() {
  chrome.storage.sync.get(['enable', 'mode', 'sites'], res => {
    settings.enable = res.enable !== undefined ? res.enable : true;
    settings.mode = res.mode || 'allow';
    settings.sites = Array.isArray(res.sites) ? res.sites : [];
  });
}

chrome.storage.onChanged.addListener(loadSettings);
loadSettings();
