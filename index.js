/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */



var self = require('sdk/self');
var IO = require("sdk/io/file");
const { Cc, Ci, Cu } = require("chrome");

exports.button = require('sdk/ui/button/action').ActionButton({
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
	var tab = require("sdk/tabs").activeTab;
	var { viewFor } = require("sdk/view/core");
	var lowLevelTab = viewFor(tab);
	var browser = require("sdk/tabs/utils").getBrowserForTab(lowLevelTab);
	var document = browser.contentDocument;

	var downloadDir = Cc["@mozilla.org/file/directory_service;1"].
		getService(Ci.nsIProperties).
		get("DfltDwnld", Ci.nsIFile);

	var dateStr = new Date().toISOString().replace(/:/g,"-");
	var newDirName = IO.join(downloadDir.path, "Snapshot_" + document.title + "_" + dateStr);
	IO.mkpath(newDirName);

	takeScreenshot(document, newDirName);
	saveDocument(document, newDirName);
	saveSource(document, newDirName);
	
	var ipUpdated = false, 
		networkTimeUpdated = false;
	var filename = IO.join(newDirName, "IpAndTimeLog.txt");
	var outFile = IO.open(filename,'w');
	getIp(function(err,ip){
		if (err) throw err;
		console.log("Browser's IP address, as seen from bot.whatismyipaddress.com:",ip);
		outFile.write("IP address, from bot.whatismyipaddress.com: "+ip+"\n");
		console.log("Browser time:", new Date().toISOString());
		outFile.write("Browser time: "+ new Date().toISOString()+"\n");
		ipUpdated = true;
		if (networkTimeUpdated) outFile.close();
	});
	getNetworkTime(function(err,time){
		if (err) throw err;
		console.log("Network Time:",time);
		outFile.write("Network Time, from nist.time.gov: "+time+"\n");
		console.log("Time and IP loggged to "+filename);
		networkTimeUpdated = true;
		if (ipUpdated) outFile.close();
	});
}

function saveSource(doc,dir){
	var filename = IO.join(dir,'document_source.html');
	var outFile = IO.open(filename,'w');

	var oSerializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Ci.nsIDOMSerializer);
	var xmlStr = oSerializer.serializeToString(doc);

	outFile.write(xmlStr);
	outFile.close();
	console.log("Document source saved to "+filename);
}

function saveDocument(document,newDir){
	var filename = IO.join(newDir,'document_location.json'); 
	var outFile = IO.open(filename,'w');
	var out = {};
	for (var key in document.location) {
		out[key] = (key=='password')? "***" : document.location[key];
	}
	outFile.write(JSON.stringify(out));
	outFile.close();
	console.log("Document metadata saved to "+filename);
}

function getIp(callback){
	ipRequest = require("sdk/request").Request({
		url: "http://bot.whatismyipaddress.com/",
		onComplete: function (response) {
			if (response.status!=200){
				callback(new Error("Error getting browser's IP from bot.whatismyipaddress.com/. RESPONSE STATUS: "+response.status));
			} else {
				callback(null, response.text);
			}
		}
	}).get();

}

function getNetworkTime(callback){
	require("sdk/request").Request({
		url: "http://nist.time.gov",
		onComplete: function (response) {
			if (response.status!=200){
				callback(new Error("Error getting response from http://nist.time.gov. RESPONSE STATUS: "+response.status));
			} else {
				var utcString = new Date(response.headers["Date"]).toISOString();
				callback(null, utcString);
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

	let loadContext = document.defaultView
		.QueryInterface(Ci.nsIInterfaceRequestor)
		.getInterface(Ci.nsIWebNavigation)
		.QueryInterface(Ci.nsILoadContext);

	let ioService = Cc["@mozilla.org/network/io-service;1"]
		.getService(Ci.nsIIOService);
	let source = ioService.newURI(data, "UTF8", null);

	let Persist = Ci.nsIWebBrowserPersist;
	let persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
		.createInstance(Persist);
	persist.persistFlags = Persist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
	Persist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

	var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
	file.initWithPath(IO.join(newDir, "Screenshot.png"));

	persist.saveURI(source, null, null, 0, null, null, file, loadContext);
	console.log("Saved screenshot to file "+file.path);
	
	notify(file.path);
}

function notify(filename){

	var notifications = require("sdk/notifications");
	notifications.notify({
		text: "Screenshot saved saved to \n"+filename,
		title: "Screenshot",
		data: filename,
		onClick: function (data) {
			console.log("Saved to ",data);
			// console.log(this.data) would produce the same result.
			
			// On click open screenshot directory
			const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
			file.initWithPath(filename);
			file.reveal();
		}
	});
	
}