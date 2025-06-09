const enableEl = document.getElementById('enable');
const modeEl = document.getElementById('mode');
const sitesEl = document.getElementById('sites');
const statusEl = document.getElementById('status');

function load(){
    chrome.storage.sync.get(['enable', 'mode', 'sites'], (res = {}) => {
        enableEl.checked = (res.enable === undefined) ? true : res.enable;
        mode.value = (res.mode === undefined) ? 'allow' : res.mode;
        sitesEl.value = (Array.isArray(res.sites) ? res.sites : []).join('\n');
    })
}

function save(){
    const data = {
        enable: enableEl.checked,
        mode: modeEl.value,
        sites: sitesEl.value.split(/\n+/).map(s => s.trim()).filter(Boolean)
    };
    chrome.storage.sync.set(data, () => {
        statusEl.textContent = 'Saved ✔';
        setTimeout(() => statusEl.textContent = '', 2000);
    })
}

document.getElementById('save').addEventListener('click', save);
load();