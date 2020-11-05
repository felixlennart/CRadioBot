// discord dependency
const Discord = require("discord.js");

// bot instance
const bot = new Discord.Client();

// config
const config = require("./config.json");

// db vars
let jsoning = require('jsoning');
let db = new jsoning("database.json");
let songrequests = "songrequests";
let hostrequests = "hostrequests";

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
    constructor(discorduser, start, end) {
        this.discorduser = discorduser;
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
    if (Array.isArray(requests)) {
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
    if (Array.isArray(requests)) {
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




// bot behavior
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
        request.songname = args[0];
        request.songurl = args[1];
        if (!(await getFromDatabase(songrequests))){
            var newList = [request];
            await putInDatabase(songrequests, newList);
        }
        else {
            var list = await getFromDatabase(songrequests);
            list.push(request);
            await setValueInDatabase(songrequests, list);
        }
        message.react("🎵");
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
            else if (start.isSameOrAfter(end) || start.isBefore(moment()){
                message.channel.send("Please check the date arguments");
            }
            else {
                let hostrequest = new HostRequest;
                hostrequest.discorduser = nickname;
                hostrequest.start = start;
                hostrequest.end = end;

                if (!Array.isArray(existingHostrequests)) {
                    existingHostrequests = [hostrequest];
                    await putInDatabase(hostrequests, hostrequest);
                }
                else {
                    existingHostrequests.push(hostrequest);
                    await setValueInDatabase(hostrequests, hostrequest);
                }
                message.react("✅");
            }
        }
    }

    if (message.member.roles.some(role => role.name === config.configrole)) {
        if (command === "show") {
            if (args[0] === songrequests) {
                sendSongRequests(message.channel);
            }
            else if (args[0] === hostrequests) {
                sendHostRequests(message.channel);
            }
        }
    }
});


// login
bot.login(config.token);
