/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var self = require('sdk/self');
var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var tab_utils = require("sdk/tabs/utils");
var Request = require("sdk/request").Request;
var IO = require("sdk/io/file");

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

	var downloadDir = Cc["@mozilla.org/file/directory_service;1"].
		getService(Ci.nsIProperties).
		get("DfltDwnld", Ci.nsIFile);

	var dateStr = new Date().toISOString().replace(/:/g,"-");
	var newDirName = IO.join(downloadDir.path, "Snapshot_" + document.title + "_" + dateStr);
	IO.mkpath(newDirName);

	takeScreenshot(document, newDirName);
	saveDocument(document, newDirName);
	saveSource(document, newDirName);
	updateIp(function(err,ip,updated){
		if (err) throw err;
		console.log("Browser's IP address, as seen from bot.whatismyipaddress.com:",ip,"Last updated:"+updated.toISOString());
		var filename = IO.join(newDirName, "BrowserIpAddress_updated_" + updated.toISOString().replace(/:/g, "-") + ".txt");
		var outFile = IO.open(filename,'w');
		outFile.write("IP address, from bot.whatismyipaddress.com: "+ip+"\n");
		console.log("Browser time:", new Date().toISOString());
		outFile.write("Browser time: "+ new Date().toISOString()+"\n");
		getNetworkTime(function(err,time){
			if (err) throw err;
			console.log("Network Time:",time);
			outFile.write("Network Time, from Date in http://nist.time.gov response header: "+time+"\n");
			outFile.close();
			console.log("Time and IP loggged to "+filename);
		});
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

function updateIp(callback){
	if (ip && (new Date()-ipLastUpdated < 1000*60*15)) {
		callback(null, ip,ipLastUpdated);
		return;
	}
	ipRequest = Request({
		url: "http://bot.whatismyipaddress.com/",
		onComplete: function (response) {
			if (response.status!=200){
				callback(new Error("Error getting browser's IP from bot.whatismyipaddress.com/. RESPONSE STATUS: "+response.status));
			} else {
				ip = response.text;
				ipLastUpdated = new Date();
				callback(null, ip, ipLastUpdated);
			}
		}
	}).get();

}

function getNetworkTime(callback){
	Request({
		url: "http://nist.time.gov",
		onComplete: function (response) {
			if (response.status!=200){
				callback(new Error("Error getting response from http://nist.time.gov. RESPONSE STATUS: "+response.status));
			} else {
				var utcString = new Date(response.headers["Date"]).toISOString();
				//var respTxt = response.text;
				//var timeStr = respTxt.match(/>(\d\d\:\d\d:\d\d)<\/span>/);
				//var dateStr = respTxt.match(/id=ctdat>(.*?)<\/span>/);
				//var parsedTime;
				//try{
				//	parsedTime = new Date(dateStr[1]+' '+timeStr[1]+' UTC').toISOString();
				//} catch(err) {
				//	console.error("Error parsing time from www.timenaddate.com/worldclock/timezone/utc.");
				//}
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