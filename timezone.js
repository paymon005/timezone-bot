const { Client, GatewayIntentBits } = require('discord.js')
const config = require("./config.json");
const fetch = require('node-fetch');
const { Console } = require("console");
const fs = require('fs')
let nodeGeocoder = require('node-geocoder');
const mods_ids = ["88131430810402816","90737077137723392"];

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
	} else if (command === "timer") {
		timerCommand(message, args)
	} else if (command === "alarm") {
		alarmCommand(message, args)
	}
});

////////////////////////////SLASH COMMANDS////////////////////////////
// The command functions below take a discord.js Message plus a positional args
// array. Rather than rewrite them, an interaction is wrapped in a message-shaped
// adapter and its typed options are flattened back into the same positional args
// each function already parses. The prefix commands above keep working unchanged.

const { REST, Routes, ApplicationCommandOptionType: OptType, Role } = require('discord.js');

const TIME_HINT = '24hr time, e.g. 15:45';

const SLASH_COMMANDS = [
	{ name: 'set', description: 'Set your timezone (city/state or IANA name)', options: [
		{ name: 'zone', description: 'Dallas, TX  or  America/Chicago', type: OptType.String, required: true },
		{ name: 'user', description: 'Set it for someone else (mods only)', type: OptType.User },
	]},
	{ name: 'time', description: "Show a user's local time", options: [
		{ name: 'user', description: 'Whose time to show', type: OptType.User, required: true },
		{ name: 'time', description: TIME_HINT, type: OptType.String },
	]},
	{ name: 'all', description: 'Show the time for everyone with a timezone set', options: [
		{ name: 'time', description: TIME_HINT, type: OptType.String },
	]},
	{ name: 'check', description: "Check a user's configured timezone", options: [
		{ name: 'user', description: 'Whose timezone to check', type: OptType.User, required: true },
	]},
	{ name: 'remove', description: 'Remove a timezone from the database', options: [
		{ name: 'user', description: 'Remove someone else (mods only)', type: OptType.User },
	]},
	{ name: 'map', description: 'Map of IANA timezones in the USA' },
	{ name: 'help', description: 'List the commands' },
	{ name: 'role', description: 'Show the time for everyone with a role', options: [
		{ name: 'role', description: 'Which role', type: OptType.Role, required: true },
		{ name: 'time', description: TIME_HINT, type: OptType.String },
	]},
	{ name: 'timer', description: 'Ping after a number of minutes', options: [
		{ name: 'duration', description: 'Minutes (max 1440)', type: OptType.Integer, required: true },
		{ name: 'target', description: 'Who to ping (defaults to you)', type: OptType.Mentionable },
	]},
	{ name: 'alarm', description: 'Ping at a given time', options: [
		{ name: 'time', description: TIME_HINT, type: OptType.String, required: true },
		{ name: 'target', description: 'Who to ping (defaults to you)', type: OptType.Mentionable },
	]},
];

// A Mentionable option is a User, a GuildMember or a Role; the commands ask for
// users and roles separately, so split it back apart.
function splitMentionable(target) {
	if (!target) return [null, null];
	if (target instanceof Role) return [null, target];
	return [target.user || target, null];
}

// Pure: turn a slash command's named options back into the positional args the
// matching *Command function parses. Each case mirrors that function's own
// arg-length branching, which is what makes this worth isolating and testing.
function buildArgs(name, o) {
	const userMention = o.userId ? '<@' + o.userId + '>' : null;
	const roleMention = o.roleId ? '<@&' + o.roleId + '>' : null;
	switch (name) {
		// setCommand pops the mention off the end, then joins the rest as the zone.
		case 'set':    return userMention ? o.zone.split(/ +/g).concat(userMention) : o.zone.split(/ +/g);
		// timeCommand: 2 args means "time + mention", 1 means "mention only".
		case 'time':   return o.time ? [o.time, userMention] : [userMention];
		case 'all':    return o.time ? [o.time] : [];
		case 'check':  return [userMention];
		// removeCommand reads the mention only, never args.
		case 'remove': return [];
		// roleCommand also branches on length 2 vs anything else.
		case 'role':   return o.time ? [o.time, roleMention] : [roleMention];
		// timer/alarm only check args.length > 1 to decide whether to look for a
		// mention, so the second element's value is irrelevant — only its presence.
		case 'timer':  return (userMention || roleMention) ? [String(o.duration), 'mention'] : [String(o.duration)];
		case 'alarm':  return (userMention || roleMention) ? [o.time, 'mention'] : [o.time];
		default:       return [];
	}
}

function messageAdapter(interaction, user, role) {
	let usedInteraction = false;
	let repliedAtAll = false;
	return {
		author: interaction.user,
		guild: interaction.guild,
		channel: interaction.channel,
		member: interaction.member,
		mentions: {
			users:   { first: () => user || undefined },
			members: { first: () => (user ? interaction.guild.members.cache.get(user.id) || user : undefined) },
			roles:   { first: () => role || undefined },
		},
		didReply: () => repliedAtAll,
		reply: async (content) => {
			repliedAtAll = true;
			if (!usedInteraction) {
				usedInteraction = true;
				try {
					return (interaction.deferred || interaction.replied)
						? await interaction.editReply(content)
						: await interaction.reply(content);
				} catch (err) {
					myLogger.log(Date() + ": interaction reply failed, falling back to channel: " + err);
				}
			}
			return interaction.channel.send(content);
		},
	};
}

client.on('interactionCreate', async (interaction) => {
	if (!interaction.isChatInputCommand()) return;
	if (!interaction.guild) {
		return interaction.reply({ content: 'Use me in a server, not a DM.', ephemeral: true });
	}

	const name = interaction.commandName;
	const str = (n) => {
		const v = interaction.options.getString(n);
		return v === null || v === undefined ? null : String(v).trim();
	};
	if (!SLASH_COMMANDS.some((c) => c.name === name)) {
		return interaction.reply({ content: 'Unknown command.', ephemeral: true });
	}

	let user = null;
	let role = null;
	if (name === 'timer' || name === 'alarm') {
		[user, role] = splitMentionable(interaction.options.getMentionable('target'));
	} else {
		if (name === 'role') role = interaction.options.getRole('role');
		else user = interaction.options.getUser('user');
	}

	const args = buildArgs(name, {
		zone: str('zone'),
		time: str('time'),
		duration: interaction.options.getInteger('duration'),
		userId: user ? user.id : null,
		roleId: role ? role.id : null,
	});

	// members.fetch and the geocoding lookup both routinely take longer than the
	// three seconds an interaction gets before Discord marks it failed.
	try {
		await interaction.deferReply();
	} catch (err) {
		myLogger.log(Date() + ": could not defer " + name + ": " + err);
		return;
	}

	const shim = messageAdapter(interaction, user, role);
	const handlers = {
		set: setCommand, time: timeCommand, all: allCommand, check: checkCommand,
		remove: removeCommand, map: mapCommand, help: helpCommand, role: roleCommand,
		timer: timerCommand, alarm: alarmCommand,
	};

	try {
		await handlers[name](shim, args);
	} catch (err) {
		myLogger.log(Date() + ": /" + name + " threw: " + (err && err.stack ? err.stack : err));
	}
	// A deferred interaction left unanswered shows "thinking..." forever.
	if (!shim.didReply()) {
		try { await interaction.editReply('Something went wrong running that.'); } catch (e) {}
	}
});

client.once('ready', async () => {
	// Registered per guild rather than globally: a global registration can take
	// an hour to appear, a guild one is immediate.
	const rest = new REST({ version: '10' }).setToken(config.token);
	for (const [guildId, guild] of client.guilds.cache) {
		try {
			await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: SLASH_COMMANDS });
			myLogger.log(Date() + ": registered " + SLASH_COMMANDS.length + " slash commands in " + guild.name);
		} catch (err) {
			myLogger.log(Date() + ": could not register slash commands in " + guild.name + ": " + err
				+ " (re-invite with the applications.commands scope; prefix commands still work)");
		}
	}
});

// Only connect when run as the entry point, so the arg mapping above can be
// required and tested without logging a second client into Discord.
if (require.main === module) {
	client.login(config.token);
}
module.exports = { buildArgs, splitMentionable, SLASH_COMMANDS };

//////////////////////////////SET//////////////////////////////
async function setCommand(message, args) {
	var AllZones = readTimezoneData();
	myLogger.log(Date() + ": " + "Got set command from " + message.author.username)
	
	if (message.mentions.members.first()) {
		var userToChange = message.mentions.users.first()
		args.pop();
		var userZone = args.join(' ');
		if (userToChange != message.author){
				if (mods_ids.indexOf(message.author.id) === -1){
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
			return message.reply("Could not find SHIT for " + userZone 
			+ ". Either enter enough info for google to find your city or enter an IANA timezone like America/Chicago. Use *map for a map of IANA timezones.")
		}
		userZone = await calculateTimeZoneByCoordinates(coordinates)
	} 
	AllZones[userToChange] = userZone
	myLogger.log(Date() + ": " + "Timezone " + userZone + " set for user " + userToChange.username)
	saveTimezoneData(AllZones);
	return message.reply("Timezone " + userZone + " set for user " + userToChange.username)
}
//////////////////////////////TIME//////////////////////////////
async function timeCommand(message, args) {
	var AllZones = readTimezoneData();
	var mins = [];
	var names = [];
	var offset = [];
	
	myLogger.log(Date() + ": Sending time to " + message.author.username)
	if (args.length > 2) {
		return message.reply("Too many input arguments.");
	} else if (args.length === 2){
		if ( !checkTime(args[0]) ) {
			return message.reply("You fucked up your input dumbass. Use *help");
		} else {
			var time = args[0];
			var setTime = true;
			var user = message.mentions.users.first();
		}
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
		[hours, mins, _, offset] = calculateTime(AllZones[message.author],AllZones[user],time,setTime)
		return message.reply(printTime(hours, mins));
	} else {
		return message.reply(user.username + " has not defined a timezone.")
	}
}
//////////////////////////////ALL//////////////////////////////
async function allCommand(message, args) {
	var AllZones = readTimezoneData();
	let server = message.guild; 
	myLogger.log(Date() + ": Sending all to " + message.author.username)
	
	if (args.length === 0){
		var time = '';
		var setTime = false;
	} else if (args.length === 1) {
		if (message.author in AllZones) {
			if ( !checkTime(args[0]) ) {
				return message.reply("You fucked up your input dumbass. Use *help");
			} else {
				var time = args[0];
				var setTime = true;
			}
		} else {
			return message.reply("You must first define your timezone with *set");
		}			
	} else {
		return message.reply("Too many input arguments.");
	}
	
	const server_member_map = await server.members.fetch();
	const server_members = server_member_map.map((member) => member);

	var time_data = parseGroup(server_members,time,setTime,message,AllZones,'all');
	var str = sortAndGetString(time_data)
	
	if (str.length > 0) {
		return sendStringToDiscord(message,str)
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
	var user = message.mentions.users.first();
	if (user != undefined) {
		if (mods_ids.indexOf(message.author.id) === -1) {
			return message.reply("Only Faymis Paymis has this power.")
		} else {
			var AllZones = readTimezoneData();
			var user = message.mentions.users.first();
		}
	} else {
		user = message.author;
	}
	
	if (user in AllZones) {
		delete AllZones[user]
		saveTimezoneData(AllZones);
		return message.reply("Removed " + user.username)
	} else {
		return message.reply(user.username + " was not found.")
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
	return message.reply("**\\*command required_Input [optional_Input]**\n\n"
		+ "\\*set city,state or timezone : Sets the timezone for yourself. (i.e. \\*set Dallas, TX) or (i.e. \\*set America/Chicago)\n"
		+ "\\*time [24hrTime] @user : Display the time for mentioned user. You may enter a time with respect to your timezone in 24hr format to be used, if no time is given the current time will be used. (i.e. \\*time 15:45 @user)\n"
		+ "\\*role [24hrTime] @role : Display the time for all users with the mentioned role. You may enter a time with respect to your timezone in 24hr format to be used, if no time is given the current time will be used. (i.e. \\*time 15:45 @role)\n"
		+ "\\*all [24hrTime] : Display the time for all users in this server with a defined timezone. You may enter a time with respect to your timezone in 24hr format to be used, if no time is given the current time will be used. (i.e. \\*all 15:45)\n"
		+ "\\*check @user : Check the mentioned users timezone.\n"
		+ "\*remove : Remove yourself from the timezone database.\n"
		+ "\\*map : Displays a map of IANA timezones in the USA. (The only place that matters)");
}
//////////////////////////////ROLE//////////////////////////////
async function roleCommand(message, args) {
		var AllZones = readTimezoneData();
	let server = message.guild; 
	var str = "";
	myLogger.log(Date() + ": Sending role to " + message.author.username)
	
	if (message.mentions.roles.first()) {
		const server_member_map = await server.members.fetch();
		const server_members = server_member_map.map((member) => member);
		const role = message.mentions.roles.first();
		var role_members = [];

		cnt = 0;
		for(var i = 0; i < server_members.length; i++){
			var userRoles = server_members[i].roles.cache;
			for(var j = 0; j < userRoles.size; j++) {
				if (parseInt(userRoles.at(j).id) == parseInt(role.id)){
					role_members[cnt] = server_members[i];
					cnt += 1;
					break;
				}
			}
		}

	} else {
		return message.reply("You must mention a role!");
	}
	
	if (args.length > 2) {
		return message.reply("Too many input arguments.");
	} else {
		if (args.length === 2) {
			if (message.author in AllZones) {
				if ( !checkTime(args[0]) ) {
					return message.reply("You fucked up your input dumbass. Use *help");
				} else {
					var time = args[0];
					var setTime = true;
				}
			} else {
				return message.reply("You must first define your timezone with *set");
			}
		} else {
			var time = '';
			var setTime = false;
		}			
	}
	
	var time_data = parseGroup(role_members,time,setTime,message,AllZones,'all');
	var str = sortAndGetString(time_data)
	
	if (str.length > 0) {
		return sendStringToDiscord(message,str)
	} else {
		myLogger.log(Date() + ": No users with this role have set a timezone.")
		return message.reply("No users with this role have set a timezone.");
	}
}
//////////////////////////////TIMER//////////////////////////////
async function timerCommand(message, args) {
	var mention_prefix = ''
	myLogger.log(Date() + ": Creating timer for " + message.author.username)
	if (args.length > 2) {
		return message.reply("Too many input arguments.");
	} else if (args.length > 0){
		if ( !Number.isInteger(parseInt(args[0],10)) ) {
			return message.reply("You fucked up your input dumbass. Use *help");
		} else {
			var duration = parseInt(args[0],10);
			if (args.length > 1) {
				var mention = message.mentions.users.first();
				myLogger.log(Date() + ": mention " + mention)
				if (mention === undefined) {
					mention = message.mentions.roles.first();
					mention_prefix = '&'
					myLogger.log(Date() + ": mention " + mention)
					if (mention === undefined) {
						return message.reply("You fucked up your input dumbass. Use *help");
					}
				} 
				var id_to_mention = mention.id;
				myLogger.log(Date() + ": mention.id " + mention.id)
			} else {
				var id_to_mention = message.author.id;
			}
		}
	} else {
		return message.reply("You must enter a duration!");
	}
	
	if (duration > 1440) {
		return message.reply("You cannot set a timer for longer than a day");
	}
	
	if (duration > 1){
		message.reply("Alerting <@" + mention_prefix + id_to_mention + "> in " + duration + " minutes."); 
	} else {
		message.reply("Alerting <@" + mention_prefix + id_to_mention + "> in " + duration + " minute."); 
	}
	await new Promise(r => setTimeout(r, duration*1000*60));
	message.reply("Time is up! <@" + mention_prefix + id_to_mention + ">");
}
//////////////////////////////ALARM//////////////////////////////
async function alarmCommand(message, args) {
	var AllZones = readTimezoneData();
	var hours_start = 0;
	var mins_start = 0;
	var sec_start = 0;
	var hours_end = 0;
	var mins_end = 0;
	var sec_end = 0;
	var mention_prefix = '';
	var user = message.author;
	
	myLogger.log(Date() + ": Creating timer for " + message.author.username)
	if (args.length > 2) {
		return message.reply("Too many input arguments.");
	} else if (args.length > 0){
		if ( !checkTime(args[0]) ) {
			return message.reply("You fucked up your input dumbass. Use *help");
		} else {
			var time = args[0];
			if (args.length > 1) {
				var mention = message.mentions.users.first();
				myLogger.log(Date() + ": mention " + mention)
				if (mention === undefined) {
					mention = message.mentions.roles.first();
					mention_prefix = '&'
					myLogger.log(Date() + ": mention " + mention)
					if (mention === undefined) {
						return message.reply("You fucked up your input dumbass. Use *help");
					}
				} 
				var id_to_mention = mention.id;
				myLogger.log(Date() + ": mention.id " + mention.id)
			} else {
				var id_to_mention = message.author.id;
			}
		}
	} else {
		return message.reply("You must enter a time!");
	}
	
	
	if (user in AllZones) {
		[hours_start, mins_start, sec_start] = calculateTime(AllZones[message.author],'America/Phoenix','',false);
		[hours_end, mins_end] = calculateTime(AllZones[message.author],'America/Phoenix',time,true)
		var hour_diff = 0
		if (hours_end < hours_start) {
			hour_diff = 24 - hours_start
			hour_diff += hours_end
		} else if (hours_end === hours_start) {
			if (mins_end < mins_start) {
				hour_diff = 23
			} else {
				hour_diff = 0
			}
		} else {
			hour_diff = hours_end - hours_start
		}
		var min_diff = 0
		if (mins_end < mins_start) {
			min_diff = 60 - mins_start
			min_diff += mins_end
		} else if (mins_end === mins_start){
			min_diff = 0
		} else {
			min_diff = mins_end - mins_start - 1
		}
		var sec_diff = 60 - sec_start
		var duration = hour_diff*60*60 + min_diff*60 + sec_diff
	} else {
		return message.reply("You have not defined a timezone.")
	}
	
	if (duration/60 > 1440) {
		return message.reply("You cannot set an alarm for further than a day away.");
	}
	
	if (duration/60 > 1){
		message.reply("Alerting <@" + mention_prefix + id_to_mention + "> at " + time + " or in " + Math.round(duration/60) + " minutes."); 
	} else {
		message.reply("Alerting <@" + mention_prefix + id_to_mention + "> at " + time + " or in " + Math.round(duration/60) + " minute."); 
	}
	await new Promise(r => setTimeout(r, duration*1000));
	message.reply("Time is up! <@" + mention_prefix + id_to_mention + ">");
}
////////////////////////OTHER FUNCTIONS/////////////////////////////

function calculateTime(tz_from,tz_to,time,setTime) {
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
		var curr_hour = to_hours-24
	} else {
		var curr_hour = to_hours
	}
	
	curr_sec = d_from.getSeconds();
	myLogger.log(Date() + ": curr_hour = " + curr_hour)
	myLogger.log(Date() + ": curr_min = " + curr_min)
	myLogger.log(Date() + ": curr_sec = " + curr_sec)
	return [curr_hour, curr_min, curr_sec, diff_hours, tz_to]
}

function readTimezoneData() {
	if (fs.existsSync('data.json')) {
		try {
			const data = fs.readFileSync('./data.json', {encoding:'utf8', flag:'r'});
			return JSON.parse(data);
		} catch (err) {
			myLogger.error(Date() + ": (readTimezoneData) " + err)
			return false
		}
	}
}

function saveTimezoneData(AllZones) {
	myLogger.log(Date() + ": Saving data.json")
	try {
		fs.writeFileSync('./data.json', JSON.stringify(AllZones))
	} catch (err) {
		myLogger.error(Date() + ": (saveTimezoneData) " + err)
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
		myLogger.error(Date() + ": (getCoordinates) " + err);
		coordinates[0] = false
	}
	return coordinates
}

async function calculateTimeZoneByCoordinates(google_data) {
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
		myLogger.error(Date() + ": (TimeZoneDB API) " + err);
	}
}

function parseGroup(group,time,setTime,message,AllZones,groupType) {
	var data_list = [];
	var cnt = 0;
	
	try {
		for (var i = 0; i < group.length; i++) {
			if (group[i] in AllZones) {
				data_list[cnt] = {};
				[data_list[cnt].hour, data_list[cnt].min, _, data_list[cnt].offset, data_list[cnt].tz] = calculateTime(AllZones[message.author],AllZones[group[i]],time,setTime);
				if (groupType === 'all') {
					data_list[cnt].name = group[i].displayName //server members object
				} else {
					data_list[cnt].name = group[i].username // role members object
				}
				cnt += 1;
			}
		}
	} catch (err) {
			myLogger.error(Date() + ": (parseGroup) " + err)
		}
	return data_list
}

function sortAndGetString(time_data) {
	var str = "";
	time_data.sort(function(a, b) {return ((a.offset < b.offset) ? -1 : ((a.offset == b.offset) ? 0 : 1))});
	var last_tz = [];
	for (var i = 0; i < time_data.length; i++) {
		if (time_data[i].tz != last_tz) {
			str += "__**" + time_data[i].tz + "**__\n";
			last_tz = time_data[i].tz;
		}
		str += time_data[i].name + " : " + printTime(time_data[i].hour, time_data[i].min) + "\n";
	}
	return str;
}

function sendStringToDiscord(message,str) {
	var str_array = [];
	if (str.length > 2000) {
		var delim = "\n"
		const str_array = str.split(delim);
		var str_section = "";
		myLogger.log(Date() + ": total str " + str_array.length)
		
		for(var i = 0; i < str_array.length; i++){
			if ( (str_section.length+str_array[i].length) > 2000 ) {
				myLogger.log(Date() + ": str " + str_section.length)
				message.reply(str_section);
				str_section = "";
			}
			str_section += str_array[i] + delim
		}
		message.reply(str_section);
	} else {
		message.reply(str)
	}
	
}

function checkTime(time) {
	const myArray = time.split(":");
	if (myArray.length != 2){
		return false
	}
	if (myArray[0].length > 2 || myArray[1].length != 2){
		return false
	}
	if ( !isNumeric(myArray[0]) || !isNumeric(myArray[1]) ){
		return false
	}
	if ( parseInt(myArray[0],10) < 0 || parseInt(myArray[1],10) < 0 ){
		return false
	}
	if ( parseInt(myArray[0],10) > 23 || parseInt(myArray[1],10) > 59 ){
		return false
	}
	return true
}

function isNumeric(str) {
  if (typeof str != "string") return false // we only process strings!  
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
         !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

function calc_time_diff(hours_start, min_start, hours_end, min_end){
	
	
}