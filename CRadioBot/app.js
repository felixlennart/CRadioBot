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


// classes
class SongRequest {
    constructor(discorduser, songname, songurl) {
        this.discorduser = discorduser;
        this.songname = songname;
        this.songurl = songurl;
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




// bot behavior
bot.on("message", async message => {

    // return when message comes from the bot
    if (message.author.bot) return;

    // ignore messages without prefix
    if (!message.content.toLowerCase().startsWith(config.prefix)) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if (command === "request") {

        let guild = message.guild;
        let member = guild.member(message.author);
        let nickname = member ? member.displayName : null;
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
});


// login
bot.login(config.token);