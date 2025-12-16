(() => {
	const box = document.querySelector("div .appending_file_box");
	const wrap = document.querySelector("div .view_content_wrap");
	if (!box || !wrap) return;

	const firstChild = wrap.children[0];
	if (!firstChild) return;
	
	const STORAGE_KEY = "ElementMove";
	chrome.storage.sync.get(STORAGE_KEY, (data) => {
		const isEnabled = data[STORAGE_KEY];
		if (isEnabled) wrap.insertBefore(box, firstChild.nextSibling);
	});

	const a = document.querySelector("a.btn_file_dw");
	if (!a) return;

	const btn = createBtn("다운로드 후 종료", "Later_Exit");
	a.nextElementSibling.after(btn);
	
	btn.onclick = () => {
		a.click();
		observeBtn(a);
	};
	
	function createBtn(text, cls) {
		const btn = document.createElement("button");
		btn.textContent = text;
		btn.classList.add(cls);
		btn.style.fontSize = "11px";
		btn.style.color = "#ffffff";
		btn.style.backgroundColor = "#66ccff";
		btn.style.border = "1px solid #3399ff";
		btn.style.borderRadius = "4px";
		btn.style.padding = "0px 2px";
		btn.style.marginLeft = "15px";
		btn.style.cursor = "pointer";
		btn.addEventListener("mouseover", () => btn.style.backgroundColor = "#5ab0e6");
		btn.addEventListener("mouseout", () => btn.style.backgroundColor = "#66ccff");
		return btn;
	}
	
	function observeBtn(btn) {
		const obs = new MutationObserver(() => {
			if (!btn.style.display) {
				obs.disconnect();
				chrome.runtime.sendMessage({ type: "COMPLETE" });
			}
		});
		obs.observe(btn, { attributes: true, attributeFilter: ["style"] });
	}

})();

(() => {
	const dcSeries = document.querySelector("div.dc_series");
	if (!dcSeries) return;
	
	const linkList = dcSeries.querySelectorAll("a[href]");
	linkList.forEach(a => {
		const btn = createBtn("다운로드");
		a.style.display = "inline";
		btn.style.display = "inline";
		a.parentNode.insertBefore(btn, a);
		btn.style.marginRight = "6px";
		btn.onclick = () => {
			chrome.runtime.sendMessage({ type: "OPEN_TAB", url: a.href });
		};
	});

	function createBtn(text) {
		const btn = document.createElement("button");
		btn.textContent = text;
		btn.style.fontSize = "11px";
		btn.style.color = "#ffffff";
		btn.style.backgroundColor = "#66ccff";
		btn.style.border = "1px solid #3399ff";
		btn.style.borderRadius = "4px";
		btn.style.padding = "0px 2px";
		btn.style.marginBottom = "4px";
		btn.style.cursor = "pointer";
		btn.addEventListener("mouseover", () => btn.style.backgroundColor = "#5ab0e6");
		btn.addEventListener("mouseout", () => btn.style.backgroundColor = "#66ccff");
		return btn;
	}
})();

(() => {
	const box = document.querySelector("div.gallview_head .fr > :first-Child");
	if (!box) return;

	const btn = createBtn("본문 이미지 다운로드");
	box.before(btn);
	
	btn.onclick = () => {
		chrome.runtime.sendMessage({ type: "SET_READY" });
		chrome.runtime.sendMessage({ type: "CONTENT_READY", isEach: true, isSelf: true });
	};
	
	function createBtn(text) {
		const btn = document.createElement("button");
		btn.textContent = text;
		btn.style.fontSize = "12px";
		btn.style.color = "#ffffff";
		btn.style.backgroundColor = "#66ccff";
		btn.style.border = "1px solid #3399ff";
		btn.style.borderRadius = "4px";
		btn.style.padding = "1px 2px";
		btn.style.marginBottom = "4px";
		btn.style.marginRight = "6px";
		btn.style.cursor = "pointer";
		btn.addEventListener("mouseover", () => btn.style.backgroundColor = "#5ab0e6");
		btn.addEventListener("mouseout", () => btn.style.backgroundColor = "#66ccff");
		return btn;
	}
})();

(() => {
	let folderRule;
	let isEach;
	
	chrome.storage.sync.get({ 
		"IgnoreAttachment": false, 
		"filenamePattern": "[download] " 
	}, (data) => {
		isEach = data.IgnoreAttachment;
		folderRule = data.filenamePattern;
		chrome.runtime.sendMessage({ type: "CONTENT_READY" });
	});

	chrome.runtime.onMessage.addListener(msg => {
		if (msg.type === "START_DOWNLOAD") {
			startDownloadLogic(msg);
		}
	});
	
	function startDownloadLogic(options) {
		const btnA = document.querySelector("a.btn_file_dw");
		const btnB = document.querySelector(".Later_Exit");
		const lis = document.querySelectorAll("ul.appending_file li");
		const imgs = Array.from(document.querySelectorAll(".write_div img"));
		
		const urlLoading = "https://nstatic.dcinside.com/dc/m/img/gallview_loading_ori.gif";
		const urlDCcon = "https://dcimg5.dcinside.com/dccon.php?no=";
		
		const imageUrls = imgs.map(img => img.src == urlLoading ? img.dataset.original : img.src)
										.filter(src => src && !src.startsWith(urlDCcon));
		
		if (!options.isSelf && isEach) options.isEach = true;
		
		if (!options.isEach && btnA && lis.length === imgs.length) {
			btnB.click();
		} else downloadImages(imageUrls, options);
	}
	
	function downloadImages(urls, options) {
		let folder = folderRule;
		
		if (folder.includes("?title")) {
			const a = document.querySelector(".title_subject");
			let b = a ? a.textContent.trim() : document.title.trim() || "Unknown";
			b = b.replace(/[/\\?%*:|"<>]/g, '_').substring(0, 100);
			folder = folder.replaceAll("?title", b); 
		}
		
		if (folder.includes("?id")) {
			const a = new URLSearchParams(window.location.search).get('no') || "0";
			folder = folder.replaceAll("?id", a); 
		}
		
		if (folder.includes("?gall")) {
			const a = document.querySelector(".page_head h2 > a");
			let b = a ? a.textContent.trim() : document.title.trim() || "UnknownGall";
			folder = folder.replaceAll("?gall", b.replace(" 갤러리미니", "").replace(" 갤러리", "")); 
		}
		
		let completedCount = 0;
		const total = urls.length;

		urls.forEach((url, index) => {
			const num = (index + 1).toString().padStart(3, "0");
			chrome.runtime.sendMessage({ type: "DOWNLOAD", url, folder, num });

			completedCount++;
			if (completedCount === total) {
				options.type = "COMPLETE";
				options.url = window.location.href;
				chrome.runtime.sendMessage(options);
			}
		});
	}
})();

