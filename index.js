/*
Project Name: AuroraX Anti-Cheat (aurorav.net)
Language Used: NodeJS
Framework: Electron
Developer/s: Curt (curt.sg / curtcreation.net)
All Reserve Rights Curt Creation 2019 - 2020
*/

const {app, BrowserWindow, dialog, shell, clipboard} = require("electron");
const gotTheLock = app.requestSingleInstanceLock()
const url = require("url");
const path = require('path')
const log = require('electron-log');
var request = require('request');
var convertxmljs = require('xml-js');
var fs = require('fs');
var chokidar = require('chokidar');
var cwd = path.join(__dirname, '..');
const { fork } = require('child_process');

const isReachable = require('is-reachable');
const md5File = require('md5-file');
const exec = require('child_process').exec;
const psList = require('ps-list');
const Store = require('electron-store');
const dirTree = require("directory-tree");
const jsonFind = require('json-find');
const keytar = require('keytar');
const store = new Store();

let mainwindow = null
let splashwindow =  null
var serialKey = ""
var theBlacklistedCheat = null
var steamName = "AuroraXUnknown"
var oldSteamName = ""
var os = require("os");
var timerExisting = false;
var ipc = require('electron').ipcMain;
let waitingUserResposne = false
let toggleChangeUser = false
let dontAnnoyMeAgainWithThisMsg = false
var authirization;
log.info('======================> '+app.getVersion()+' <======================');
log.info('AuroraX Client version '+app.getVersion()+' Started.');

if (!gotTheLock) {
    app.quit();
	return;
} else {
	app.on('second-instance', (event, commandLine, workingDirectory) => {
		if (mainwindow) {
			if (mainwindow.isVisible()) {
				if (mainwindow.isMinimized()) mainwindow.restore(); mainwindow.show()
				mainwindow.focus()
			} else {
				if (splashwindow.isMinimized()) splashwindow.restore(); splashwindow.show()
				splashwindow.focus()
			}
		}
	});
}

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

function doUpdateStartup () {
	log.info('Loading startup sequence.');
	(async () => {
		log.info('Loading startup async passed.');
		if (splashwindow.isVisible()) {
			if (await isReachable('api.aurorav.net') == true) {
				log.info('Loading startup reachable.');
				splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Checking Updates';");
				request.post('https://api.aurorav.net/get.php?tx=ver', {form: {genx: authirization}}, function (error, response, body) {
					if (error) {
						log.error('Got error from update sequence. Retrying again in 5000ms.');
						splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Seems offline :( Trying again';");
						setTimeout(doUpdateStartup, 5000);
						return;
					}
					log.info('Loading updates got response with code '+response.statusCode+' got '+body+'.');
					if (response.statusCode == 200) {
						var jsonResponse = JSON.parse(body);
						log.info('Loaded updates got response with code json '+jsonResponse.status+'.');
						if (jsonResponse.status != 200) {
							splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Cannot check update';");
							setTimeout(doUpdateStartup, 5000);
							return;
						}
						if (jsonResponse.version != app.getVersion()) {
							splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Update Required';");
							const options = {
			                   type: 'info',
			                   defaultId: 2,
			                   title: 'Update Required',
			                   message: "Please update the AuroraX.",
			                 };
							const response = dialog.showMessageBox(null, options, (response, checkboxChecked) => {
								shell.openExternal(jsonResponse.download);
								app.quit()
							})
						} else {
							splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Authenticating';");
							proccessAuthenticationStartup()
						}
					} else {
						splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Seems offline :( Trying again';");
						setTimeout(doUpdateStartup, 5000);
					}
				})
			} else {
				log.error('Loading startup offline checker failed due to domain is offline. Retrying sequence.');
				splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Seems offline :( Trying again';");
				setTimeout(doUpdateStartup, 5000);
			}
		}
	})();
}

function proccessAuthenticationStartup () {
	log.info('Authenticating with server from client hardware id.');
	require("machine-uuid")(function(uuid) {
		log.info('Got hardware id. Contacting server.');
		log.info('Used new auth system.');
		const serialKeySecret = keytar.getPassword("AuroraX", "serialKey");
		serialKeySecret.then((serialKeyResult) => {
			log.info('Success got data.');
			if (serialKeyResult == null) {
				const randomUserIDSecret = keytar.getPassword("AuroraX", "randomuserid");
				randomUserIDSecret.then((randomUserIDResult) => {
					serialKey = uuid+randomUserIDResult;
				});
			} else {
				serialKey = serialKeyResult;
			}
		});
		log.info('Contacting server.');
		splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Waiting Response';");
		request.post("https://api.aurorav.net/get.php?tx=appauth", { form: { genx: authirization, authkey: serialKey } }, function (error, response, body) {
			if (error) {
				log.error('Server app authentication failed. Retrying in 1000ms.');
				splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Failed. Trying..';");
				setTimeout(proccessAuthenticationStartup, 1000);
				return;
			}
			log.log('Server app auth success.');
			if (toggleChangeUser == true) {
				log.log('Toggled change user!');
				toggleChangeUser = false
				setTimeout(proccessAuthenticationStartup, 1000);
				const options = {
					type: 'info',
					defaultId: 2,
					title: 'Authentication Required',
					message: "Please authenticate your steam account. Press ok to get redirected.\n\nBrowser Redirect Doesn't Work? \nWe also pasted the url at your pastebin, just CTRL+V to paste the url.",
				};
				const response = dialog.showMessageBox(null, options, (response, checkboxChecked) => {
					shell.openExternal('https://api.aurorav.net/authenticate-user.php?switch=sv&authkey='+serialKey);
					clipboard.writeText('https://api.aurorav.net/authenticate-user.php?switch=sv&authkey='+serialKey);
					waitingUserResposne = true
				})
				return;
			}
			request.post("https://api.aurorav.net/get.php?tx=appinfo", { form: { genx: authirization, authkey: serialKey } }, function (error, response, body) {
				if (error) {
					log.error('Server app info failed. Retrying in 1000ms.');
					splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Failed. Trying..';");
					setTimeout(proccessAuthenticationStartup, 1000);
					return;
				}
				log.log('Server app info got response '+response.statusCode+'.');
				if (response.statusCode == 200) {
					var jsonResponse = JSON.parse(body);
					log.log('Server app info got response json '+jsonResponse.status+'.');
					steamName = jsonResponse.steamname
					log.log('Server app info got json '+steamName+' '+oldSteamName+'.');
					if (steamName != oldSteamName) {
						log.log('Two Steam did not matched.');
						if (jsonResponse.status == 400) {
							if (waitingUserResposne == false) {
								const options = {
									type: 'info',
									defaultId: 2,
									title: 'Authentication Required',
									message: "Please authenticate your steam account. Press ok to get redirected.\n\nBrowser Redirect Doesn't Work? \nWe also pasted the url at your pastebin, just CTRL+V to paste the url.",
								};
								const response = dialog.showMessageBox(null, options, (response, checkboxChecked) => {
									shell.openExternal('https://api.aurorav.net/authenticate-user.php?authkey='+serialKey);
									clipboard.writeText('https://api.aurorav.net/authenticate-user.php?authkey='+serialKey);
									waitingUserResposne = true
									proccessAuthenticationStartup ();
								})
							} else {
								setTimeout(proccessAuthenticationStartup, 1000);
							}
						} else if (jsonResponse.status == 200) {
							log.log('Scanning computer.');
							theBlacklistedCheat = jsonResponse.blacklist
							splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Starting Background<br>Computer Scan';");
							if (jsonResponse.scanPlayer == 0) {
								setTimeout(preprocessMainWindow, 2000);
							} else {
								setTimeout(timeUpdateFuncsDir, 2000);
							}
						} else if (jsonResponse.status == 300) {
							log.log('Regenerating new serial key due to serial key is being used.');
							const randomUserIDSeret2 = keytar.getPassword("AuroraX", "randomuserid");
							randomUserIDSeret2.then((result) => {
								if (result == null) {
									var theRID = makeid(12);
									keytar.setPassword("AuroraX", "randomuserid", theRID)
									serialKey = uuid+theRID
								}
							});
							setTimeout(proccessAuthenticationStartup, 1000);
						} else if (jsonResponse.status == 500) {
							const options = {
								type: 'error',
								defaultId: 2,
								title: 'AuroraX Client',
								message: "Your account is banned! Please contact our staff team.",
							};
							const response = dialog.showMessageBox(null, options, (response, checkboxChecked) => {
								log.error('Banned User. Please contact staff.');
								app.quit();
							})
						} else {
							splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Failed. Trying..';");
							log.error('Failed app info retrying in 1000ms.');
							setTimeout(proccessAuthenticationStartup, 1000);
						}
					} else {
						log.log('Two Steam did matched.');
						setTimeout(proccessAuthenticationStartup, 1000);
					}
				}
			})
		})
	})
}

function getInformationUser () {
	request.post("https://api.aurorav.net/get.php?tx=appinfo", { form: { genx: authirization, authkey: serialKey } }, function (error, response, body) {
		if (error) {
			setTimeout(getInformationUser, 1000);
			return;
		}
		if (response.statusCode == 200) {
			var jsonResponse = JSON.parse(body);
			if (jsonResponse.status == 200) {
				mainwindow.webContents.executeJavaScript("steamID.innerHTML = '"+jsonResponse.steamid+"';");
				mainwindow.webContents.executeJavaScript("steamUsername.innerHTML = '"+jsonResponse.steamname+"';");
				oldSteamName = jsonResponse.steamname;
				if (jsonResponse.shared == 1) {
					mainwindow.webContents.executeJavaScript("switchuser.style.display = 'block';");
				}
			} else {
				mainwindow.webContents.executeJavaScript("steamID.innerHTML = 'Failed to get';");
				mainwindow.webContents.executeJavaScript("steamUsername.innerHTML = 'Failed to get';");
				setTimeout(getInformationUser, 1000);
			}
		} else {
			mainwindow.webContents.executeJavaScript("steamID.innerHTML = 'Failed to get';");
			mainwindow.webContents.executeJavaScript("steamUsername.innerHTML = 'Failed to get';");
			setTimeout(getInformationUser, 1000);
		}
	})
}

function preprocessMainWindow () {
	log.log('Generating UI.');
	splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Loading App';");
	mainwindow.loadFile('index.html', {userAgent: 'AuroraX'})
	mainwindow.webContents.once('dom-ready', () => {
		log.log('Success opening up stuff.');
		splashwindow.hide()
		mainwindow.show()

		getInformationUser();
		mainwindow.webContents.executeJavaScript("ver.innerHTML = 'Version "+app.getVersion()+"';");
		mainwindow.webContents.executeJavaScript("theNote.innerHTML = 'Background file scanning';");
		if (timerExisting == false) {
			timeUpdateFuncs();
			timeUpdateFuncsProcess();
			timeCheckUpdate();
			timeScreeniesPromt();
			timerExisting = true;
		}
	});
}

ipc.on('uploadServer', function(event, img) {
    request.post({url:'https://api.aurorav.net/heartbeat.php?tx=upp', form: {genx: authirization, authkey: serialKey, fileToUpload: img} }, function optionalCallback(err, httpResponse, body) {
	  if (err) {
	    return;
	  }
	});
});

var alreadyToggledSwitchUser = false
ipc.on('switchUser', function(event) {
	if (alreadyToggledSwitchUser) { return; }
	alreadyToggledSwitchUser = true
    request.post("https://api.aurorav.net/get.php?tx=appinfo", { form: { genx: authirization, authkey: serialKey } }, function (error, response, body) {
		if (error) {
			const options = {
				type: 'error',
				defaultId: 2,
				title: 'An error occured',
				message: "There was an error while processing your request.",
			};
			const response = dialog.showMessageBox(null, options, (response, checkboxChecked) => {
			});
			return;
		}
		if (response.statusCode == 200) {
			var jsonResponse = JSON.parse(body);
			if (jsonResponse.status == 200) {
				let options  = {
					type: 'info',
					buttons: ["Yes","No"],
					message: "Do you really want switch user?"
				}
				const response = dialog.showMessageBox(null, options, (response, checkboxChecked) => {
					alreadyToggledSwitchUser = false
					if (response === 0) {
						toggleChangeUser = true
						mainwindow.hide()
						boot()
					}
				});
			} else {
				const options = {
					type: 'error',
					defaultId: 2,
					title: 'An error occured',
					message: "You don't have the right permission to switch user. This incident has been recorded.",
				};
				const response = dialog.showMessageBox(null, options, (response, checkboxChecked) => {
					alreadyToggledSwitchUser = false
				});
				mainwindow.webContents.executeJavaScript("switchuser.style.display = 'none';");
			}
		}
	})
});


function timeUpdateFuncs () {
    isRunning('FiveM_GTAProcess.exe', (status) => {
	    if (status == true) {
			mainwindow.webContents.executeJavaScript("fivemrunning.innerHTML = 'Running';");
		} else {
			mainwindow.webContents.executeJavaScript("fivemrunning.innerHTML = 'Nope';");
		}
	})
	setTimeout(timeUpdateFuncs, 10000);
}

function timeScreeniesPromt () {
    //isRunning('FiveM_GTAProcess.exe', (status) => {
	    //if (status == true) {
	    	setTimeout(timeScreeniesPromt, 5000);
			request.post("https://api.aurorav.net/get.php?tx=appinfo", { form: { genx: authirization, authkey: serialKey } }, function (error, response, body) {
				if (error) {
					return;
				}
				if (response.statusCode == 200) {
					try {
						var jsonResponse = JSON.parse(body);
				        if (jsonResponse.stoggle == 1) {
							mainwindow.webContents.executeJavaScript("screeniesTake();");
						}
					} catch (e) {
						log.error('Failed get info. Retrying..');
					}
				}
		    });
		//}
	//})
}

function timeUpdateFuncsProcess () {
	(async () => {
		var listProcess = await psList()
		var filteredProcess = []
		listProcess.forEach(function(item, index, array) {
			filteredProcess.push(item.name)
			theBlacklistedCheat.forEach(function(theCheat) {
	    		if (item.name.search(theCheat) >= 0) {
		    		banMe(item.name, "process");
			    	return;
			    }
	    	});
		});
		request.post(
		    'https://api.aurorav.net/heartbeat.php?tx=hb',
		    { form: { genx: authirization, authkey: serialKey, processes: JSON.stringify(filteredProcess), steam: steamName, cpu: os.cpus()[0].model, ram: (os.totalmem()/1048576), ver: app.getVersion() } },
		    function (error, response, body) {
		    	if (error) {
					return;
				}
				try {
					var jsonResponse = JSON.parse(body);
			        if (jsonResponse.status == 200) {
						theBlacklistedCheat = jsonResponse.blacklist
					}
				}  catch (e) {
					log.error("Error on json response: "+e);
				}
		    }
		);
		setTimeout(timeUpdateFuncsProcess, 5000);
	})();
}

function banMe (theCheat, thePath) {
	console.log("Requesting to ban the user.")
	request.post(
	    'https://api.aurorav.net/heartbeat.php?tx=bam',
	    { form: { genx: authirization, authkey: serialKey, theNote: "Banned for "+theCheat+" ("+thePath+")"} },
	    function (error, response, body) {
	    	if (error) {
				banMe();
				console.log("Re-requesting to ban the user.")
				return;
			}
			console.log("Banned! Exiting process.")
			app.quit()
	    }
	);
}

function timeUpdateFuncsDir () {
	preprocessMainWindow();

	if (fs.existsSync(path.join(cwd, 'app.asar'))) {
		cp_path = 'app.asar/scan.js';
	} else {
		cp_path = './scan.js';
		cwd = null;
	}

	const scanProcess = fork(cp_path, [], {
    	cwd : cwd
	});

	scanProcess.send({gotBlacklistedCheat: theBlacklistedCheat, authirization: authirization, serialKey: serialKey});

	scanProcess.on('message', (message) => {
		if (message.status == 500) {
			banMe(message.output, message.output2)
		} else if (message.status == 200) {
			if (mainwindow) {
				if (mainwindow.isVisible()) {
					mainwindow.webContents.executeJavaScript("theNote.innerHTML = 'Successfully done an background scan!';");
				}
			}
		} else if (message.status == 100) {
			dialog.showMessageBox(null, {
				type: 'warning',
				defaultId: 2,
				title: 'AuroraX',
				message: message.output,
			}, (response, checkboxChecked) => {})
		} else {
			log.log("Unknown service callback status!")
		}
	});

}

function timeCheckUpdate () {
	request.post('https://api.aurorav.net/get.php?tx=ver', {form: {genx: authirization}}, function (error, response, body) {
		if (error) {
			const options = {
               type: 'error',
               defaultId: 2,
               title: 'Offline',
               message: "Error. Your connection is offline!",
             };
			const response = dialog.showMessageBox(null, options, (response, checkboxChecked) => {
				mainwindow.hide()
				boot()
			})
			return;
		}
		if (response.statusCode == 200) {
			try {
				var jsonResponse = JSON.parse(body);
				if (jsonResponse.statusCode == 200) {
					if (jsonResponse.version != app.getVersion()) {
						splashwindow.webContents.executeJavaScript("labelA.innerHTML = 'Update Required';");
						const options = {
		                   type: 'info',
		                   defaultId: 2,
		                   title: 'Update Required',
		                   message: "Please update the AuroraX.",
		                 };
						const response = dialog.showMessageBox(null, options, (response, checkboxChecked) => {
							shell.openExternal(jsonResponse.download);
							mainwindow.close()
							splashwindow.close()
							app.quit()
						})
					}
				}
			}  catch (e) {
				log.error("Error on json response: "+e);
			}
		}
		setTimeout(timeCheckUpdate, 30000);
	})
}

function makeid(length) {
   var result           = '';
   var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

function authirizationAPI () {
	request('http://api.aurorav.net/authkey.php', function (error, response, body) {
		if (error) {
			log.error('Failed authorization. Code: '+error+' | '+body+' . Retrying..');
			setTimeout(authirizationAPI, 2000);
			return;
		}
		if (response.statusCode == 200) {
			var jsonResponse = JSON.parse(body);
			authirization = jsonResponse.serv;
		}
	});
	setTimeout(authirizationAPI, 2000);
}


function boot() {
	log.info('Doing boot sequence.');
	app.on("uncaughtException", (err) => {});
	const randomUserIDSeret2 = keytar.getPassword("AuroraX", "randomuserid");
	randomUserIDSeret2.then((result) => {
		if (result == null) {
			keytar.setPassword("AuroraX", "randomuserid", makeid(6))
		}
	});

	const serialKeySecret = keytar.getPassword("AuroraX", "serialKey");

	splashwindow = new BrowserWindow({width: 300, height: 300, frame: false, show:false, resizable: false, fullscreen: false, devTools: false});
	splashwindow.loadFile('slpash.html');
	authirizationAPI();

	mainwindow = new BrowserWindow({
		width: 330,
		height: 423,
		titleBarStyle: 'hiddenInset',
		icon: path.join(__dirname, 'img/logo.png'),
		show: false,
		frame: false,
		devTools: false,
		webPreferences: {
			nodeIntegration: true
		}
	})
	mainwindow.webContents.on("devtools-opened", () => { 
        mainwindow.webContents.closeDevTools(); 
    });

    splashwindow.webContents.on("devtools-opened", () => { 
        splashwindow.webContents.closeDevTools(); 
    });

    mainwindow.webContents.on('new-window', function(event, url){
	   event.preventDefault();
	   shell.openExternal(url);
	});

	splashwindow.webContents.once('dom-ready', () => {
		splashwindow.show()
		splashwindow.focus()
		doUpdateStartup()
	});

	splashwindow.on('closed', () => {
		app.quit()
	})
	mainwindow.on('closed', () => {
		app.quit()
	})

	app.on('window-all-closed', () => {
	  if (process.platform !== 'darwin') {
	    mainwindow.close()
		splashwindow.close()
		app.quit()
	  }
	})
}



app.on('open-url', function (event, data) {
	event.preventDefault();
	splashwindow.focus()
});
app.disableHardwareAcceleration();
app.on('ready', boot);
app.setAsDefaultProtocolClient('aurorax');
