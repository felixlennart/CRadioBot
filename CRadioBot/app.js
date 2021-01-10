// discord dependency
const Discord = require("discord.js");

// cron dependency
var CronJob = require('cron').CronJob;

// bot instance
const bot = new Discord.Client();

// config
const config = require("./config.json");

// db vars
let jsoning = require('jsoning');
let db = new jsoning("database.json");
let songrequests = "songrequests";
let hostrequests = "hostrequests";
let approvedHosts = "approvedHosts";
let approvedHostList = [];

// other vars
let currentHost;
let currentSession;

// moment.js
const moment = require("moment");
let dateformat = "YYYY-MM-DD-HH:mm:ss";


// classes
class SongRequest {
    constructor(discorduser, songname, songurl) {
        this.discorduser = discorduser;
        this.songname = songname;
        this.songurl = songurl;
    }
}

class HostRequest {
    constructor(discorduser, discordId, start, end) {
        this.discorduser = discorduser;
        this.discordId = discordId;
        this.start = start;
        this.end = end;
    }
}


// db functions

    async function putInDatabase(key, value) { 
        await db.push(key, value);
    }

    async function getFromDatabase(query) {
        return await db.get(query);
    }

    async function deleteFromDatabase(query){
        await db.delete(query);
    }

    async function setValueInDatabase(key, value) {
        await db.set(key, value);
}


// misc functions

async function sendSongRequests(channel) {
    let requests = await getFromDatabase(songrequests);
    let content = "";
    if (Array.isArray(requests) && requests.length > 0) {
        content += "Song requests \n";
        requests.forEach(e => {
            content += "User: " + e.discorduser + " Song: " + e.songname + " URL: " + e.songurl + "\n";
        });
    }
    else {
       content = "No song requests available";
    }
    channel.send(content);
}

async function sendHostRequests(channel) {
    let requests = await getFromDatabase(hostrequests);
    let content = "";
    if (Array.isArray(requests) && requests.length > 0) {
        content += "Host requests \n";
        requests.forEach(e => {
            content += "User: " + e.discorduser + " Start: " + e.start + " End: " + e.end + "\n";
        });
    }
    else {
        content = "No host requests available";
    }
    channel.send(content);
}

async function sendApprovedHostRequests(channel) {
    let requests = await getFromDatabase(approvedHosts);
    let content = "";
    if (Array.isArray(requests) && requests.length > 0) {
        content += "Upcoming radio sessions \n";
        requests.forEach(e => {
            content += "User: " + e.discorduser + " Start: " + e.start + " End: " + e.end + "\n";
        });
    }
    else {
        content = "No upcoming radio sessions. Maybe there are open host requests";
    }
    channel.send(content);
}

async function approveHost(message, username) {
    let found = false;
    let requests = await getFromDatabase(hostrequests);
    if (Array.isArray(requests)) {
        for (e of requests) {
            if (e.discorduser.toLowerCase() === username.toLowerCase()) {
                    approvedHostList.push(e);
                    setValueInDatabase(approvedHosts, approvedHostList);
                found = true;
                break;
            }
        }
        if (found) {
            message.react("✅");
            let updateList = await getFromDatabase(hostrequests);
            updateList = updateList.filter(e => e.discorduser !== username);
            await setValueInDatabase(hostrequests, updateList);
        }
        else {
            message.channel.send("No pending host requests for user " + username);
        }
    }
}

async function deleteHost(message, username) {
    let found = false;
    let requests = await getFromDatabase(hostrequests);
    if (Array.isArray(requests)) {
        for (e of requests) {
            if (e.discorduser.toLowerCase() === username.toLowerCase()) {
                found = true;
                break;
            }
        }
        if (found) {
            message.react("🗑️");
            let updateList = await getFromDatabase(hostrequests);
            updateList = updateList.filter(e => e.discorduser !== username);
            await setValueInDatabase(hostrequests, updateList);
        }
        else {
            message.channel.send("No pending host requests for user " + username);
        }
    }
}

async function deleteShow(message, username) {
    let found = false;
    let requests = await getFromDatabase(approvedHosts);
    if (Array.isArray(requests)) {
        for (e of requests) {
            if (e.discorduser.toLowerCase() === username.toLowerCase()) {
                found = true;
                break;
            }
        }
        if (found) {
            message.react("🗑️");
            let updateList = await getFromDatabase(approvedHosts);
            updateList = updateList.filter(e => e.discorduser !== username);
            await setValueInDatabase(approvedHosts, updateList);
            approvedHostList = updateList;
        }
        else {
            message.channel.send("No approved show with user " + username);
        }
    }
}

async function startShow() {
    let l = [];
    approvedHostList.forEach(e => l.push(e.start));
    l.sort(function (a, b) { return a - b });
    const criterion = (element) => element.start === l[0];
    let index = approvedHostList.findIndex(criterion);
    currentSession = approvedHostList[index];
    approvedHostList.splice(index, 1);
    await setValueInDatabase(approvedHosts, approvedHostList);
    currentHost = currentSession.discordId;
    bot.users.fetch(currentHost.id).then(usr => {
        usr.send("Your radio session has started. Let's start the stream!")
        sendSongRequests(usr)
    });
    deleteFromDatabase(songrequests);
}

// bot behavior

bot.on("ready", async () => {
    let approved = getFromDatabase(approvedHosts);
    if (Array.isArray(approved)){
        approvedHostList = approved;
    } else {
        setValueInDatabase(approvedHosts, approvedHostList);
    }
});



bot.on("message", async message => {

    // return when message comes from the bot
    if (message.author.bot) return;

    // ignore messages without prefix
    if (!message.content.toLowerCase().startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    let guild = message.guild;
    let member = guild.member(message.author);
    let nickname = member ? member.displayName : null;

    if (command === "request") {
        let request = new SongRequest;
        request.discorduser = nickname;
        let req = message.content.substring(config.prefix.length + command.length + 2);

        request.songname = req.indexOf("http") == -1 ? req : req.substring(0, req.indexOf("http") - 1);
        request.songurl = req.indexOf("http") == -1 ? "" : req.substring(req.indexOf("http") - 1);
        if (!(await getFromDatabase(songrequests))){
            var newList = request;
            await putInDatabase(songrequests, newList);
        }
        else {
            var list = await getFromDatabase(songrequests);
            list.push(request);
            await setValueInDatabase(songrequests, list);
        }
        message.react("🎵");
    }

    if (command === "help") {
        message.channel.send("**How to use the CRadioBot**\n------------------------------------\n`cradio request [name of song] [song URL (has to begin with 'http')]` \nRequests a song for the next radio session\n\n`cradio requesthost [start time] [end time]`\nSends a radio host request. Please use the following time format: YYYY-MM-DD-HH:mm:ss\n\n`cradio show upcoming`\nShows all upcoming radio sessions\n\n`cradio show songrequests` (authorized users only)\nShows all song requests\n\n`cradio show hostrequests` (authorized users only)\nShows all pending radio host requests\n\n`cradio approve [username]` (authorized users only)\nApproves the host request of a user and adds him to the upcoming session list\n\n`cradio start` (authorized users only)\nStarts the next radio session. The host will be notified and receives all song requests. The song requests will be cleared\n\n`cradio deletehost [username]` (authorized users only)\nDeletes the host request of a user\n\n`cradio deleteshow [username]` (authorized users only)\nDeletes the show of a user")
    }

    if (command === "requesthost") {
        let existingHostrequests = await getFromDatabase(hostrequests);
        if (Array.isArray(existingHostrequests) && existingHostrequests.filter(e => e.discorduser === nickname).length > 0) {
            message.channel.send("You've already sent a host request!");
        }
        else {
            let start = moment(args[0] + ":00", dateformat);
            let end = moment(args[1] + ":00", dateformat);
            if (!(start.isValid() && end.isValid())) {
                message.channel.send("Please use the following command: `" + config.prefix + " requesthost " + dateformat.substring(0, 16) + " " + dateformat.substring(0, 16) + "`");
            }
            else if (start.isSameOrAfter(end) || start.isBefore(moment())){
                message.channel.send("Please check the date arguments");
            }
            else {
                let hostrequest = new HostRequest;
                hostrequest.discorduser = nickname;
                hostrequest.discordId = message.author;
                hostrequest.start = start;
                hostrequest.end = end;

                if (!Array.isArray(existingHostrequests)) {
                    existingHostrequests = hostrequest;
                    await putInDatabase(hostrequests, existingHostrequests);
                }
                else {
                    existingHostrequests.push(hostrequest);
                    await setValueInDatabase(hostrequests, existingHostrequests);
                }
                message.react("✅");
            }
        }
    }

    if (command === "show" && args[0] === "upcoming") {
        sendApprovedHostRequests(message.channel);
    }

    if (message.member.roles.cache.find(role => role.name === config.configrole) !== undefined) {
        if (command === "show") {
            if (args[0] === songrequests) {
                sendSongRequests(message.channel);
            }
            else if (args[0] === hostrequests) {
                sendHostRequests(message.channel);
            }
        }
        else if (command === "approve") {
            if (message.content.substring(config.prefix.length + command.length + 2).length > 0) approveHost(message, message.content.substring(config.prefix.length + command.length + 2));
        }
        else if (command === "start") {
            if (approvedHostList.length > 0) {
                startShow();
                message.react("🎵");
            }
            else {
                message.channel.send("No approved hosts");
            }
        }
        else if (command === "deletehost") {
            if (message.content.substring(config.prefix.length + command.length + 2).length > 0) deleteHost(message, message.content.substring(config.prefix.length + command.length + 2));
        }
        else if (command === "deleteshow") {
            if (message.content.substring(config.prefix.length + command.length + 2).length > 0) deleteShow(message, message.content.substring(config.prefix.length + command.length + 2));
        }
    }
    else {
        message.channel.send("You have no right to execute this command");
    }
});


// login
bot.login(config.token);
