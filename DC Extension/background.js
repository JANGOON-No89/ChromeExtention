let pendingQueue = [];
let opening = false;
const pendingTabs = new Map();

async function fetchExt(url) {
	try {
		const resp = await fetch(url, { method: "HEAD" });
		const cd = resp.headers.get("Content-Disposition");
		if (cd) {
			const match = cd.match(/filename.*\.(\w+)/);
			if (match) return match[1];
		}
		const ct = resp.headers.get("Content-Type");
		if (ct && ct.startsWith("image/")) return ct.split("/")[1];
	} catch (e) {
		console.warn("헤더 요청 실패", url, e);
	}
	return "jpg";
}

function openNext() {
	if (opening || !pendingQueue.length) return;
	opening = true;
	const url = pendingQueue.shift();

	chrome.tabs.create({ url, active: false }, tab => {
		if (chrome.runtime.lastError) console.error("TAB CREATE ERROR:", chrome.runtime.lastError.message);
		else pendingTabs.set(tab.id, true);
		
		setTimeout(() => {
			opening = false;
			openNext();
		}, 500);
	});
}

chrome.runtime.onMessage.addListener(async (msg, sender) => {

	if (msg.type === "OPEN_TAB") {
		pendingQueue.push(msg.url);
		openNext();
		return true;
	}

	if (msg.type === "SET_READY") {
		const tabId = sender.tab?.id;
		pendingTabs.set(tabId, true);
		return true;
	}
	
	if (msg.type === "CONTENT_READY") {
		const tabId = sender.tab?.id;
		if (tabId && pendingTabs.has(tabId)) {
			msg.type = "START_DOWNLOAD";
			chrome.tabs.sendMessage(tabId, msg);
		}
		return true;
	}

	if (msg.type === "DOWNLOAD") {
		const ext = await fetchExt(msg.url);
		const filename = `${msg.folder}/${msg.num}.${ext}`;
		chrome.downloads.download({
			url: msg.url,
			filename,
			conflictAction: "overwrite",
			saveAs: false
		}, id => {
			if (chrome.runtime.lastError) console.error("[BG] DOWNLOAD ERROR", chrome.runtime.lastError.message);
			else console.log("[BG] DOWNLOAD OK", id);
		});
		return true;
	}

	if (msg.type === "COMPLETE") {
		const tabId = sender.tab?.id;
		if (tabId) {
			if (msg.isSelf) pendingTabs.delete(tabId);
			else chrome.tabs.remove(tabId, () => { pendingTabs.delete(tabId); });
		}
		return true;
	}
});

chrome.commands.onCommand.addListener((msg) => {
	if (msg === "IMG_DOWNLOAD") {
		chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
			const tabId =  tabs[0].id;
			chrome.tabs.sendMessage(tabId, { type: "START_DOWNLOAD", isEach: true });
		});
	}
});


