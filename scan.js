/*
Project Name: AuroraX Anti-Cheat (aurorav.net)
Language Used: NodeJS
Framework: Electron
Developer/s: Curt (curt.sg / curtcreation.net)
All Reserve Rights Curt Creation 2019 - 2020
*/

const log = require('electron-log');
const md5File = require('md5-file');
const jsonFind = require('json-find');
const dirTree = require("directory-tree");
var convertxmljs = require('xml-js');
var fs = require('fs');
var os = require("os");
var chokidar = require('chokidar');
var request = require('request');
var theBlacklistedCheat = null
let dontAnnoyMeAgainWithThisMsg = false

const isRunning = (query, cb) => {
    let platform = process.platform;
    let cmd = '';
    switch (platform) {
        case 'win32' : cmd = `tasklist`; break;
        case 'darwin' : cmd = `ps -ax | grep ${query}`; break;
        case 'linux' : cmd = `ps -A`; break;
        default: break;
    }
    exec(cmd, (err, stdout, stderr) => {
        cb(stdout.toLowerCase().indexOf(query.toLowerCase()) > -1);
    });
}

function callbackMainProcess (status, output, output2) {
	process.send({ status: status, output: output, output2: output2 });
}

function scanDirectory (theDir) {
	(async () => {
		theDir.forEach(function(theTable) {
		    var tableName = theTable.name;
		    if (typeof theTable.children == "object") {
		    	scanDirectory(theTable.children);
		    } else {
		    	if (tableName.search("settings.xml") >= 0) {
		    		if (theTable.path.includes("GTA V")) {
		    			log.log('Found GTA V settings.xml');
		    			fs.readFile(theTable.path, function(err, data) {
		    				if (err) {
		    					log.error('Failed to read GTA V settings.xml');
		    					callbackMainProcess(100, "We cannot read your GTA V Settings! Your game will hang due vehicle graphics issue. \n To resolve this issue, please manually go to your GTA V Settings > Graphics and change your Texture Quality to Normal.\n\nIf you already did that, please ignore this message.")
		    					return;
		    				}
		    				try {
		    					var theSettings = convertxmljs.xml2js(data);
		    					theSettings.elements.forEach(function(theDataSettings, currValueDataSettings) {
		    						if (theDataSettings.name == "Settings") {
		    							theDataSettings.elements.forEach(function(theGameSettings, currValueGameSettings) {
		    								if (theGameSettings.name == "graphics") {
		    									theGameSettings.elements.forEach(function(theVideoSettings, currValueVideoSettings) {
		    										if (theVideoSettings.name == "TextureQuality") {
			    										if (theVideoSettings.attributes.value != 0) {
		    												isRunning('FiveM_GTAProcess.exe', (status) => {
			    												if (status == true) {
			    													if (dontAnnoyMeAgainWithThisMsg == false) {
			    														dontAnnoyMeAgainWithThisMsg = true;
				    													callbackMainProcess(100, "We just changed your GTA V Settings! Please restart FiveM to take effect.")
				    												}
			    												}
		    												});
			    											theSettings.elements[currValueDataSettings].elements[currValueGameSettings].elements[currValueVideoSettings].attributes.value = 0;
			    											var theSettingsInXML = convertxmljs.js2xml(theSettings, {compact: false})
			    											fs.writeFile(theTable.path, theSettingsInXML, function(err) {
			    												if (err) {
			    													callbackMainProcess(100, "We cannot read your GTA V Settings! Your game will hang due vehicle graphics issue. \n To resolve this issue, please manually go to your GTA V Settings > Graphics and change your Texture Quality to Normal.\n\nIf you already did that, please ignore this message.")
											    					log.error('Failed to write the new GTA V settings.xml');
											    					return;
											    				}
											    				log.log("Updated GTA V settings.xml > Settings > Graphics > TextureQuality to 0.");
			    											});
			    										} else {
			    											log.log("No need update for GTA V settings.xml > Settings > Graphics > TextureQuality to 0.");
			    										}
			    									}
		    									});
		    								}
		    							});
		    						}
		    					});
		    				}  catch (e) {
								log.error("Error on json convertxmljs response: "+e);
								callbackMainProcess(100, "We cannot read your GTA V Settings! Your game will hang due vehicle graphics issue. \n To resolve this issue, please manually go to your GTA V Settings > Graphics and change your Texture Quality to Normal.\n\nIf you already did that, please ignore this message.")
							}
						});
		    		}
		    	}
		    	theBlacklistedCheat.forEach(function(theCheat) {
		    		if (tableName.search(theCheat) >= 0) {
			    		callbackMainProcess(500, theTable.name, theTable.path);
				    	console.log("Cheat Found File: "+theTable.name+" | DIR: "+theTable.path);
				    	return;
				    }
		    	});
		    }
		});
	})();
}



process.on('message', async (message) => {
	callbackMainProcess(300, null, null);
	theBlacklistedCheat = message.gotBlacklistedCheat;
	(async () => {
		var watcher = chokidar.watch('C:\\Users\\'+os.userInfo().username, {persistent: true, ignorePermissionErrors: true, ignoreInitial: false});
		watcher
		  .on('add', function(path) {
		  	theBlacklistedCheat.forEach(function(theCheat) {
			  	if (path.search(theCheat) >= 0) {
		    		callbackMainProcess(500, theCheat, path);
			    	console.log("Cheat Found File: "+theCheat+" | DIR: "+path);
			    	return;
			    }
			});
		  })
		  .on('change', function(path) {
		  	theBlacklistedCheat.forEach(function(theCheat) {
			  	if (path.search(theCheat) >= 0) {
		    		callbackMainProcess(500, theCheat, path);
			    	console.log("Cheat Found File: "+theCheat+" | DIR: "+path);
			    	return;
			    }
			});
		  })
		  .on('unlink', function(path) {
		  	theBlacklistedCheat.forEach(function(theCheat) {
			  	if (path.search(theCheat) >= 0) {
		    		callbackMainProcess(500, theCheat, path);
			    	console.log("Cheat Found File: "+theCheat+" | DIR: "+path);
			    	return;
			    }
			});
		  })
		  .on('error', function(error) {console.error('Error happened', error);});

		log.log('Scanning computer async loaded.');
		const tree = dirTree('C:\\Users\\'+os.userInfo().username, { exclude: [/AppData/, /GitHub/] }, null, (item, thePath, status) => {
			scanDirectory(item.children);
		});
		log.log('Scanning done.');
		log.log('Posting data to heartbeat.');
		request.post(
		    'https://api.aurorav.net/heartbeat.php?tx=str',
		    { form: { genx: message.authirization, authkey: message.serialKey, download: JSON.stringify(tree) } },
		    function (error, response, body) {
		    	if (error) {
		    		log.error('Got error on heartbeat.');
					return;
				}
		    	log.log('Posted data to heartbeat.');
		    	callbackMainProcess(200, true)
		    }
		);
	})();
});