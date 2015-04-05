var self = require('sdk/self');
var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var tab_utils = require("sdk/tabs/utils");
var io = require("sdk/io/file");

var { viewFor } = require("sdk/view/core");
const { Cc, Ci, Cu } = require("chrome");

exports.button = buttons.ActionButton({
  id: "ssb-button",
  label: "Screenshot",
  icon: {
    "16": "./icon-16.png",
    "32": "./icon-32.png",
    "64": "./icon-64.png"
  },
  onClick: handleClick
});

function handleClick(state) {
	var tab = tabs.activeTab;
	var lowLevelTab = viewFor(tab);
	var browser = tab_utils.getBrowserForTab(lowLevelTab);
	var document = browser.contentDocument;

	let window = document.defaultView;
	let canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
	let left = 0;
	let top = 0;
	let width;
	let height;
	let div = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
	let currentX = window.scrollX;
	let currentY = window.scrollY;

	window.scrollTo(0,0);
	width = window.innerWidth + window.scrollMaxX;
	height = window.innerHeight + window.scrollMaxY;

	let winUtils = window.QueryInterface(Ci.nsIInterfaceRequestor)
		.getInterface(Ci.nsIDOMWindowUtils);
	let scrollbarHeight = {};
	let scrollbarWidth = {};
	winUtils.getScrollbarSize(false, scrollbarWidth, scrollbarHeight);
	width -= scrollbarWidth.value;
	height -= scrollbarHeight.value;

	canvas.width = width;
	canvas.height = height;
	let ctx = canvas.getContext("2d");
	ctx.drawWindow(window, left, top, width, height, "#fff");
	let data = canvas.toDataURL("image/png", "");

	window.scrollTo(currentX, currentY);

	var file = Cc["@mozilla.org/file/directory_service;1"].
		getService(Ci.nsIProperties).
		get("DfltDwnld", Ci.nsIFile);

	file.append("Screenshot_"+new Date().toISOString()+".png");

	let loadContext = document.defaultView
		.QueryInterface(Ci.nsIInterfaceRequestor)
		.getInterface(Ci.nsIWebNavigation)
		.QueryInterface(Ci.nsILoadContext);

	let ioService = Cc["@mozilla.org/network/io-service;1"]
		.getService(Ci.nsIIOService);

	let Persist = Ci.nsIWebBrowserPersist;
	let persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
		.createInstance(Persist);
	persist.persistFlags = Persist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
	Persist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

	let source = ioService.newURI(data, "UTF8", null);
	persist.saveURI(source, null, null, 0, null, null, file, loadContext);
	console.log("Saved screenshot to file "+file.path);
}