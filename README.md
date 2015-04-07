#Simple Screenshot Button
Simple screenshot button add-on for Firefox.

Saves a full-page screenshot of the current tab to a new folder in the default Download location. Also grabs the browser's
IP address from bot.whatismyipaddress.com and saves to text file.

### installation

Install [mozilla-addon-sdk](http://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation).
On Mac OS X with homebrew it's as easy as:  
`brew install mozilla-addon-sdk`

To build new xpi:  
`cfx xpi`

Run in sdk dev environment:  
`cfx run`

### source
Code adapted from: http://mxr.mozilla.org/mozilla-central/source/toolkit/devtools/gcli/commands/screenshot.js

### license
Mozilla Public License, v. 2.0. http://mozilla.org/MPL/2.0/