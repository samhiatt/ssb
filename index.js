/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var self = require('sdk/self');
var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var tab_utils = require("sdk/tabs/utils");
var Request = require("sdk/request").Request;
var io = require("sdk/io/file");

var { viewFor } = require("sdk/view/core");
const { Cc, Ci, Cu } = require("chrome");

var ipLastUpdated, ip;

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

	const {OS} = Cu.import("resource://gre/modules/osfile.jsm", {});
	const FileUtils = Cu.import("resource://gre/modules/FileUtils.jsm", {});
	var downloadDir = Cc["@mozilla.org/file/directory_service;1"].
		getService(Ci.nsIProperties).
		get("DfltDwnld", Ci.nsIFile);

	var dateStr = new Date().toISOString().replace(/:/g,"-");
	var newDir = downloadDir.clone();
	newDir.append("SSB_snapshot_"+dateStr);

	// TODO: Add callback function, if supported, or try using newDirHandle
	var newDirHandle = OS.File.makeDir(newDir.path);

	updateIp(function(err,ip,updated){
		if (err) throw err;
		console.log("Browser's IP address, as seen from bot.whatismyipaddress.com:",ip,"Last updated:"+updated.toISOString());
		var ipLogFile = newDir.clone();
		ipLogFile.append('BrowserIpAddress_'+updated.toISOString().replace(/:/g,"-")+".txt");
		var outFile = require('sdk/io/file').open(ipLogFile.path,'w');
		outFile.write(ip);
		outFile.close();

		console.log("Browser IP loggged to "+ipLogFile.path);

		saveDocument(document, newDir);
	});
	takeScreenshot(document, newDir);
}

function saveDocument(document,newDir){
	var docLogFile = newDir.clone();
	docLogFile.append('document_metadata.json');
	var outFile = require('sdk/io/file').open(docLogFile.path,'w');
	outFile.write(JSON.stringify(document));
	outFile.close();

	console.log("Document metadata saved to "+docLogFile.path);
}

function updateIp(callback){
	if (ip && (new Date()-ipLastUpdated < 1000*60*15)) {
		callback(null, ip,ipLastUpdated);
		return;
	}
	ipRequest = Request({
		url: "http://bot.whatismyipaddress.com/",
		onComplete: function (response) {
			if (response.status!=200){
				callback(new Error("Error getting browser's IP from bot.whatismyipaddress.com. RESPONSE STATUS: "+response.status));
			} else {
				ip = response.text;
				ipLastUpdated = new Date();
				callback(null, ip, ipLastUpdated);
			}
		}
	}).get();

}

function takeScreenshot(document,newDir) {
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

	var file = newDir.clone();
	file.append("Screenshot.png");

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