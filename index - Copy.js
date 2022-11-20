const { Client, GatewayIntentBits } = require('discord.js')
const config = require("./config.json");
const fetch = require('node-fetch');
const { Console } = require("console");
const fs = require('fs')
let nodeGeocoder = require('node-geocoder');

const client = new Client({intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
	GatewayIntentBits.GuildMembers,
	]})

let options = {
	provider: 'google',
	apiKey: config.GOOGLE_API_KEY};
let geoCoder = nodeGeocoder(options);
var AllZones = new Object();
const myLogger = new Console({
  stdout: fs.createWriteStream("normalStdout.txt", {flags: 'w'}),
  stderr: fs.createWriteStream("errStdErr.txt", {flags: 'w'}),
});


client.on("ready", () => {
	var AllZones = readTimezoneData();
	for (let name in AllZones) {
		myLogger.log(Date() + ": Name: " + name + " Time Zone: " + AllZones[name]);
	}
	myLogger.log(Date() + ": Initialized!");
});

client.on('messageCreate', async (message) => {
	if(message.author.bot) return; //if message is from bot ignore
	const content = message.content;
	
	if (!message.channel.guild) { 
		myLogger.log(Date() + ": Direct message... Ignoring...")
		return;
	}
	if (!content.startsWith(config.prefix)) {
		myLogger.log(Date() + ": " + content + " : Not a command... Ignoring...")
		return;
	}
	
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if (command === "set") {
		setCommand(message, args)
    } else if (command === "time") {
		timeCommand(message, args)
    } else if (command === "all") {
		allCommand(message, args)
	} else if (command === "check") {
		checkCommand(message, args)
	} else if (command === "remove") {
		removeCommand(message, args)
	} else if (command === "map") {
		mapCommand(message, args)
	} else if (command === "help") {
		helpCommand(message, args)
	} else if (command === "role") {
		roleCommand(message, args)
	}
});

client.login(config.token);

//////////////////////////////SET//////////////////////////////
async function setCommand(message, args) {
	var AllZones = readTimezoneData();
	myLogger.log(Date() + ": " + "Got set command from " + message.author.username)
	
	if (message.mentions.members.first()) {
		var userToChange = message.mentions.users.first()
		args.pop();
		var userZone = args.join(' ');
		if (userToChange != message.author){
				if (message.author.id != "88131430810402816"){
					return message.reply("Only Faymis Paymis has this power.")
				}
			}
	} else {
		var userToChange = message.author
	}
	var userZone = args.join(' ');
	if (!isValidTimeZone(userZone)) {
		var coordinates = await getCoordinates(userZone)
		if (coordinates[0] === false) {
			return message.reply("Could not find shit for " + userZone 
			+ ". Either enter enough info for google to find your city or enter an IANA timezone like America/Chicago. Use *map for a map of IANA timezones.")
		}
		userZone = await getTimeZoneByCoordinates(coordinates)
	} 
	AllZones[userToChange] = userZone
	myLogger.log(Date() + ": " + "Timezone " + userZone + " set for user " + userToChange.username)
	saveTimezoneData(AllZones);
	return message.reply("Timezone " + userZone + " set for user " + userToChange.username)
}
//////////////////////////////TIME//////////////////////////////
async function timeCommand(message, args) {
	var AllZones = readTimezoneData();
	myLogger.log(Date() + ": Sending time to " + message.author.username)
	if (args.length > 2) {
		return message.reply("Too many input arguments.");
	} else if (args.length === 2){
		var time = args[0];
		var user = message.mentions.users.first();
		var setTime = true;
	} else if (args.length === 1) {
		var time = '';
		var user = message.mentions.users.first();
		if (user === undefined) {
			return message.reply("You must mention someone!"); 
		}
		var setTime = false;
	} else {
		myLogger.log(Date() + ": time command failed because no user was given")
		return message.reply("You must mention someone!"); 
	}
	
	if (user in AllZones) {
		return message.reply(getTimeString(AllZones[message.author],AllZones[user],time,setTime));
	} else {
		return message.reply(user.username + " has not defined a timezone.")
	}
}
//////////////////////////////ALL//////////////////////////////
async function allCommand(message, args) {
	var AllZones = readTimezoneData();
	let server = message.guild; 
	var str = "";
	myLogger.log(Date() + ": Sending all to " + message.author.username)
	
	if (args.length === 0){
		var time = '';
		var setTime = false;
	} else if (args.length === 1) {
		if (message.author in AllZones) {
			var time = args[0];
			var setTime = true;
		} else {
			return message.reply("You must first define your timezone with *set");
		}			
	} else {
		return message.reply("Too many input arguments.");
	}
	
	const server_member_map = await server.members.fetch();
	const server_members = server_member_map.map((member) => member);
	myLogger.log(Date() + ": server_members: " + server_members);
	
	for (var i = 0; i < server_members.length; i++) {
		try {
			if (server_members[i] in AllZones) {
				myLogger.log(JSON.stringify(server_members[i], null, 4));
				str += server_members[i].displayName + ": " + getTimeString(AllZones[message.author],AllZones[server_members[i]],time,setTime) + "\n"
			}
		} catch (err) {
			myLogger.error(Date() + ": " + err + " : " + err.lineNumber)
		}
	}

	if (str.length > 0) {
		return message.reply(str);
	} else {
		myLogger.log(Date() + ": No users have set a timezone in this server.")
		return message.reply("No users have set a timezone in this server.");
	}
}
//////////////////////////////CHECK//////////////////////////////
async function checkCommand(message, args) {
	var AllZones = readTimezoneData();
	myLogger.log(Date() + ": Sending check to " + message.author.username)
	if (args.length > 1) {
		return message.reply("Too many input arguments.");
	} else if (args.length === 1) {
		var user = message.mentions.users.first();
		if (user === undefined) {
			return message.reply("You must mention someone!"); 
		}
	} else {
		myLogger.log(Date() + ": check command failed because no user was given")
		return message.reply("You must mention someone!"); 
	}
	
	if (user in AllZones) {
		return message.reply(user.username + ": " + AllZones[user] );
	} else {
		return message.reply(user.username + " has not defined a timezone.")
	}
}
//////////////////////////////REMOVE//////////////////////////////
async function removeCommand(message, args) {
	if (message.author.id === "88131430810402816"){
		var AllZones = readTimezoneData();
		var user = message.mentions.users.first();
		if (user in AllZones) {
			delete AllZones[user]
			saveTimezoneData(AllZones);
			return message.reply("Removed " + user.username)
		} else {
			return message.reply(user.username + " was not found.")
		}
	} else {
		return message.reply("Only Faymis Paymis has this power.")
	}
}
//////////////////////////////MAP//////////////////////////////
async function mapCommand(message, args) {
	myLogger.log(Date() + ": Sending map to " + message.author.username)
	return message.reply("https://i.imgur.com/HEGISo8.jpg")
}
//////////////////////////////HELP//////////////////////////////
async function helpCommand(message, args) {
	myLogger.log(Date() + ": Sending help to " + message.author.username)
	return message.reply("\\*command required_Input [optional_Input]\n\n "
		+ "\\*set city,state or timezone : Sets the timezone for yourself. (i.e. \\*set Dallas, TX) or (i.e. \\*set America/Chicago)\n"
		+ "\\*time [24hrTime] @user : Display the time for mentioned user. You may enter a time with respect to your timezone in 24hr format to be used, if no time is given the current time will be used. (i.e. \\*time 15:45 @user)\n"
		+ "\\*role [24hrTime] @role : Display the time for all users with the mentioned role. You may enter a time with respect to your timezone in 24hr format to be used, if no time is given the current time will be used. (i.e. \\*time 15:45 @role)\n"
		+ "\\*all [24hrTime] : Display the time for all users in this server with a defined timezone. You may enter a time with respect to your timezone in 24hr format to be used, if no time is given the current time will be used. (i.e. \\*all 15:45)\n"
		+ "\\*check @user : Check the mentioned users timezone.\n"
		+ "\*remove @user : Removes the mentioned user from the timezone database.\n"
		+ "\\*map : Displays a map of IANA timezones in the USA. (The only place that matters)");
}
//////////////////////////////ROLE//////////////////////////////
async function roleCommand(message, args) {
		var AllZones = readTimezoneData();
	let server = message.guild; 
	var str = "";
	myLogger.log(Date() + ": Sending role to " + message.author.username)
	
	if (message.mentions.roles.first()) {
		var role = message.mentions.roles.first();
		var role_members = message.guild.roles.cache.get(role.id).members.map(m=>m.user);
		myLogger.log(Date() + ": role_members " + role_members)
	} else {
		return message.reply("You must mention a role!");
	}
	
	if (args.length > 2) {
		return message.reply("Too many input arguments.");
	} else {
		if (args.length === 2) {
			if (message.author in AllZones) {
				var time = args[0];
				var setTime = true;
			} else {
				return message.reply("You must first define your timezone with *set");
			}
		} else {
			var time = '';
			var setTime = false;
		}			
	}
	
	for (var i = 0; i < role_members.length; i++) {
		try {
			if (role_members[i] in AllZones) {
				str += role_members[i].username + ": " + getTimeString(AllZones[message.author],AllZones[role_members[i]],time,setTime) + "\n"
			}
		} catch (err) {
			myLogger.error(Date() + ": " + err + " : " + err.lineNumber)
		}
	}
	
	if (str.length > 0) {
		return message.reply(str);
	} else {
		myLogger.log(Date() + ": No users with this role have set a timezone.")
		return message.reply("No users with this role have set a timezone.");
	}
}

function getTimeString(tz_from,tz_to,time,setTime) {
	myLogger.log(Date() + ": Converting from " + tz_from + " to " + tz_to)
	var offset_from = timeZoneOffsetInMinutes(tz_from)
	var offset_to = timeZoneOffsetInMinutes(tz_to)
	var diff_hours = (offset_to-offset_from)/60;
	var d_from = new Date(new Date().toLocaleString("en-US", {timeZone: tz_from}));
	
	if (setTime) {
		const myArray = time.split(":");
		var curr_min = parseInt(myArray[1],10)
		var to_hours = parseInt(myArray[0],10)+diff_hours;
	} else {
		var to_hours = d_from.getHours()+diff_hours;
		var curr_min = d_from.getMinutes();
	}
		
	if (to_hours < 0) {
		var curr_hour = 24+to_hours
	} else if (to_hours >= 24) {
		var curr_hour = 24-to_hours
	} else {
		var curr_hour = to_hours
	}

	return printTime(curr_hour,curr_min);
}

function readTimezoneData() {
	if (fs.existsSync('data.json')) {
		try {
			const data = fs.readFileSync('./data.json', {encoding:'utf8', flag:'r'});
			return JSON.parse(data);
		} catch (err) {
			myLogger.error(Date() + ": " + err + ": " + err.lineNumber)
			return false
		}
	}
}

function saveTimezoneData(AllZones) {
	myLogger.log(Date() + ": Saving data.json")
	try {
		fs.writeFileSync('./data.json', JSON.stringify(AllZones))
	} catch (err) {
		myLogger.error(Date() + ": " + err + ": " + err.lineNumber)
	}
}

function changeTimeZone(date, timeZone) {
  if (typeof date === 'string') {
    return new Date(new Date(date).toLocaleString('en-US', {timeZone}));
  }
  return new Date(date.toLocaleString('en-US', {timeZone}));
}

function timeZoneOffsetInMinutes(ianaTimeZone) {
	const now = new Date();
	now.setSeconds(0, 0);

	// Format current time in `ianaTimeZone` as `M/DD/YYYY, HH:MM:SS`:
	const tzDateString = now.toLocaleString('en-US', {
		timeZone: ianaTimeZone,
		hourCycle: 'h23',
	});

	// Parse formatted date string:
	const match = /(\d+)\/(\d+)\/(\d+), (\d+):(\d+)/.exec(tzDateString);
	const [_, month, day, year, hour, min] = match.map(Number);

	// Change date string's time zone to UTC and get timestamp:
	const tzTime = Date.UTC(year, month - 1, day, hour, min);

	// Return the offset between UTC and target time zone:
	return Math.floor((tzTime - now.getTime()) / (1000 * 60));
}

function printTime(hr,min) {
	    var a_p = "";
	if (hr < 12) {
	   a_p = "AM";
	} else {
	   a_p = "PM";
	}
	if (hr == 0) {
	   hr = 12;
	}
	if (hr > 12) {
	   hr = hr - 12;
	}
	if (min < 10) {
		var timeString = hr + ":0" + min + " " + a_p
	} else {
		var timeString = hr + ":" + min + " " + a_p
	}
	return timeString;
}

function isValidTimeZone(tz) {
    if (!Intl || !Intl.DateTimeFormat().resolvedOptions().timeZone) {
        throw new Error('Time zones are not available in this environment');
    }

    try {
        Intl.DateTimeFormat(undefined, {timeZone: tz});
        return true;
    }
    catch (err) {
        return false;
    }
}

async function getCoordinates(userInput) {
	myLogger.log(Date() + ": Calling google API for " + userInput)
	const res = await geoCoder.geocode(userInput)
	var coordinates = []
	
	try {
		coordinates[0] = res[0].latitude
		coordinates[1] = res[0].longitude
	} catch (err) {
		myLogger.log(Date() + ": Unable to retrieve results for " + userInput)
		coordinates[0] = false
	}
	return coordinates
}

async function getTimeZoneByCoordinates(google_data) {
	const url = 'http://api.timezonedb.com/v2.1/get-time-zone?key=' 
	+ config.TZ_DB_API_KEY + '&format=json&by=position&lat=' 
	+ google_data[0] + '&lng=' + google_data[1]
	
	myLogger.log(Date() + ": Getting timezone for " + google_data[0] + ", " + google_data[1])
	try {
		const response = await fetch(url);
		const res = await response.json();
		myLogger.log(Date() + ": Got timezone " + res.zoneName);
		return res.zoneName;
	} catch (err) {
		myLogger.error(Date() + ": (TimeZoneDB API) " + err + ": " + err.lineNumber);
	}
}