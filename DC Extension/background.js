let pendingQueue = [];
let opening = false;
const pendingTabs = new Map();

function openNext() {
	if (opening || !pendingQueue.length) return;
	opening = true;
	const url = pendingQueue.shift();

	chrome.tabs.create({ url, active: false }, tab => {
		if (!chrome.runtime.lastError) pendingTabs.set(tab.id, true);
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
		const ext = await getReliableExtension(msg.url);
		const filename = `${msg.folder}/${msg.num}.${ext}`;
		chrome.downloads.download({
			url: msg.url,
			filename,
			conflictAction: "overwrite",
			saveAs: false
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

const extensionMap = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/gif': '.gif',
	'image/webp': '.webp',
	'image/svg+xml': '.svg'
};

function getExtensionFromMime(mimeType) {
	const cleanMime = mimeType ? mimeType.split(';')[0].toLowerCase() : '';
	return extensionMap[cleanMime] || null;
}

function extractExtFromDisposition(contentDisposition) {
	if (!contentDisposition) return null;
	
	const filenameMatch = contentDisposition.match(/filename\*?=["']?([^"';]+)["']?/i);
	if (filenameMatch && filenameMatch[1]) {
		const filenameFromHeader = decodeURIComponent(filenameMatch[1].trim());
		const lastDotIndex = filenameFromHeader.lastIndexOf('.');
		
		if (lastDotIndex > -1) {
			const ext = filenameFromHeader.substring(lastDotIndex).split('?')[0].toLowerCase();
			if (ext.length > 1 && ext.length <= 5 && /^\.[a-z0-9]+$/i.test(ext)) {
				return ext;
			}
		}
	}
	return null;
}

async function getReliableExtension(url) {
	const fallbackExtension = '.jpg';
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 5000);
	
	try {
		const response = await fetch(url, { 
			method: 'GET',
			signal: controller.signal
		});
		clearTimeout(timeoutId);

		if (response.ok) {
			const contentDisposition = response.headers.get('content-disposition');
			const contentType = response.headers.get('content-type');
			let actualExtension = extractExtFromDisposition(contentDisposition);

			if (!actualExtension && contentType) {
				actualExtension = getExtensionFromMime(contentType);
			}
			
			controller.abort();
			if (actualExtension) return actualExtension;
		}
	} catch (e) {
		clearTimeout(timeoutId);
	}
	return fallbackExtension;	
}
