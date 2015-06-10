# Screenshot Button
Screenshot logging button add-on for Firefox.

* Saves a full-page screenshot of the current tab to a new folder in the default Firefox Download folder. 
* Logs the public IP address from whatismyipaddress.com, and the server time from nist.time.gov
 
## Instalation instructions
* Download https://github.com/samhiatt/ssb/blob/master/ssb.xpi?raw=true
* From Firefox menu, open Tools -> Add-ons
* Click the gear icon on the top of the page, next to the add-ons search box
* Click "Install Add-on From File"
* Select Downloads/ssb.xpi

### build instructions

##### Install Mozilla SDK
Install [mozilla-addon-sdk](http://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation).
On Mac OS X with homebrew it's as easy as:  
`brew install mozilla-addon-sdk`

##### Download the code
```
git clone https://github.com/samhiatt/ssb.git
cd ssb
```

##### To build installable xpi
`cfx xpi`

##### To run in sdk test environment
`cfx run`

## source
Screenshot code adapted from: http://mxr.mozilla.org/mozilla-central/source/toolkit/devtools/gcli/commands/screenshot.js

## license
Mozilla Public License, v. 2.0. http://mozilla.org/MPL/2.0/
