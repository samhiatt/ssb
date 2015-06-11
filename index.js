/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */



var self = require('sdk/self');
var IO = require("sdk/io/file");
const { Cc, Ci, Cu } = require("chrome");
const {TextDecoder, TextEncoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {});
var dirNames;

// Set up button and click handler
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
	// get active tab and document reference
	var tab = require("sdk/tabs").activeTab;
	var { viewFor } = require("sdk/view/core");
	var lowLevelTab = viewFor(tab);
	var browser = require("sdk/tabs/utils").getBrowserForTab(lowLevelTab);
	var document = browser.contentDocument;

	// get default Firefox download directory
	var downloadDir = Cc["@mozilla.org/file/directory_service;1"].
		getService(Ci.nsIProperties).
		get("DfltDwnld", Ci.nsIFile);

	// Make new directory, named "Downloads/Snapshot_<document title>_<ISO date>"
	var dateStr = new Date().toISOString().replace(/:/g,"-");
	var screenshotDir = IO.join(downloadDir.path, "Snapshot_" + document.title + "_" + dateStr);
	
	dirNames = makeDirStructure(screenshotDir);

	takeScreenshot(document, dirNames.screenshots);
	// Save document location metadata to screenshot directory
	saveDocumentLocation(document, dirNames.sourceCode);
	// Save DOM state to screenshot directory
	saveDomState(document, dirNames.sourceCode);
	
	// Open new file in which to log IP address and network time.
	var filename = IO.join(dirNames.timeAndIp, "IpAndTimeLog.txt");
	var outFile = IO.open(filename,'w');

	// Log browser time to file, ISO format.
	console.log("Browser UTC time:", new Date().toISOString());
	outFile.write("Browser UTC time: "+ new Date().toISOString()+"\n");
	// Log browser's local time (including timezone offset)
	console.log("Browser Local time:", new Date().toString());
	outFile.write("Browser Local time: "+ new Date().toString()+"\n");
	
	notify(dirNames.proofs);
	
	var ipUpdated = false,
		networkTimeUpdated = false;
	// get IP address, then handle response
	getIp(function(err,ip){
		if (err) throw err;
		// Log IP address to file
		console.log("Browser's IP address, as seen from bot.whatismyipaddress.com:",ip);
		outFile.write("IP address, from bot.whatismyipaddress.com: "+ip+"\n");
		// Mark IP updated flag, and close file if network also updated.
		ipUpdated = true;
		if (networkTimeUpdated) {
			console.log("Time and IP loggged to "+filename);
			outFile.close();
		}
	});
	// get network time, then handle response
	getNetworkTime(function(err,time){
		if (err) throw err;
		// Log network time to file
		console.log("Network Time:",time);
		outFile.write("Network Time, from nist.time.gov: "+time+"\n");
		// Mark network time updated flag, and close file if IP also updated.
		networkTimeUpdated = true;
		if (ipUpdated) {
			console.log("Time and IP loggged to "+filename);
			outFile.close();
		}
	});
}

// Makes the following directory structure in the snapshot directory
// - For Registration
// - Hashes
// - Proofs
//   - Source Code
//   - Screenshots
//   - Date, Time & IP Verification
function makeDirStructure(snapshotDir){
	IO.mkpath(snapshotDir);
	IO.mkpath(IO.join(snapshotDir,"For Registration"));
	var hashesDir = IO.join(snapshotDir,"Hashes");
	IO.mkpath(hashesDir);
	var proofsDir = IO.join(snapshotDir,"Proofs");
	IO.mkpath(proofsDir);
	var sourceCodeDir = IO.join(proofsDir,"Source Code");
	IO.mkpath(sourceCodeDir);
	var screenshotsDir = IO.join(proofsDir,"Screenshots");
	IO.mkpath(screenshotsDir);
	var timeIpDir = IO.join(proofsDir,"Date, Time & IP Verification");
	IO.mkpath(timeIpDir);
	return {
		hashes: hashesDir,
		proofs: proofsDir,
		sourceCode: sourceCodeDir,
		screenshots: screenshotsDir,
		timeAndIp: timeIpDir
	};
}

// Save DOM state in screenshot directory
function saveDomState(doc,dir){
	var filename = IO.join(dir,'document_source.html');
	var outFile = IO.open(filename,'w');

	// Serialize current DOM state to string
	var oSerializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Ci.nsIDOMSerializer);
	var xmlStr = oSerializer.serializeToString(doc);

	outFile.write(xmlStr);
	outFile.close();
	console.log("Document source saved to "+filename);
}

// Save document location metadata
function saveDocumentLocation(document,newDir){
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

// Get IP address from bot.whatismyipaddress.com
function getIp(callback){
	ipRequest = require("sdk/request").Request({
		url: "http://bot.whatismyipaddress.com/",
		onComplete: function (response) {
			// callback with an error if bad response, otherwise trigger callback with response.text
			if (response.status!=200){
				callback(new Error("Error getting browser's IP from bot.whatismyipaddress.com/. RESPONSE STATUS: "+response.status));
			} else {
				callback(null, response.text);
			}
		}
	}).get();

}

// Get network time from nist.time.gov
function getNetworkTime(callback){
	require("sdk/request").Request({
		url: "http://nist.time.gov",
		onComplete: function (response) {
			// callback with an error if bad response, otherwise trigger callback with time/date fom response header
			if (response.status!=200){
				callback(new Error("Error getting response from nist.time.gov. RESPONSE STATUS: "+response.status));
			} else {
				try {
					// Get date from response header
					var isoString = new Date(response.headers["Date"]).toISOString();
					callback(null, isoString);
				} catch (err) {
					// callback with error if unable to get date
					callback(new Error("Error getting date from http://nist.time.gov response header."));
				}
			}
		}
	}).get();
}

function takeScreenshot(document,newDir) {
	// Screenshot code adapted from http://mxr.mozilla.org/mozilla-central/source/toolkit/devtools/gcli/commands/screenshot.js
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
	// account for scrollbar size
	let scrollbarHeight = {};
	let scrollbarWidth = {};
	winUtils.getScrollbarSize(false, scrollbarWidth, scrollbarHeight);
	width -= scrollbarWidth.value;
	height -= scrollbarHeight.value;

	// Paint document on new canvas
	canvas.width = width;
	canvas.height = height;
	let ctx = canvas.getContext("2d");
	ctx.drawWindow(window, left, top, width, height, "#fff");
	// Get a data base 64 encoded png image URL
	let data = canvas.toDataURL("image/png", "");

	// scroll back to original position
	window.scrollTo(currentX, currentY);

	// Get png image as UTF8
	let ioService = Cc["@mozilla.org/network/io-service;1"]
		.getService(Ci.nsIIOService);
	let source = ioService.newURI(data, "UTF8", null);

	var str = source.path.replace(/^.*?;base64,/, "");
	// Decode to a byte string
	str = window.atob(str);
	// Decode to an Uint8Array, because OS.File.writeAtomic expects an ArrayBuffer(View).
	var decodedData = new Uint8Array(str.length);
	for (var i = 0, e = str.length; i < e; ++i) {
		decodedData[i] = str.charCodeAt(i);
	}
	var screenshotFilename = IO.join(newDir, "Screenshot.png");
	OS.File.writeAtomic(screenshotFilename,decodedData).then(
		function() {
			// Success!
			console.log("Saved screenshot to ", screenshotFilename);
			//var hash = getMD5Hash(screenshotFilename);
			//console.log("Got hash",hash);
		},
		function(ex) {
			// Failed. Error information in ex
			console.error("Error saving screenshot to ", screenshotFilename);
		}
	);
}

function getMD5Hash(filename){
	let md5 = require('MD5');
	//var file = IO.read(filename,'b');
	let decoder = new TextDecoder();
	OS.File.read(filename, { encoding: "utf-8" }).then(function(contents){
		console.log("Got file contents:",contents);
		var hash = md5(contents);
		console.log("Hash is",hash);
	});
}

function notify(filename){
	// notify with screenshot filename, open directory on notification click
	var notifications = require("sdk/notifications");
	notifications.notify({
		text: "Screenshot saved saved to \n"+filename,
		title: "Screenshot",
		onClick: function () {
			// On click, open screenshot directory
			const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
			file.initWithPath(filename);
			file.reveal();
		}
	});
	
}