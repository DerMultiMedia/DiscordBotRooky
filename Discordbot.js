// Requirements
const sqlite3 = require("sqlite3").verbose();
const Discord = require("discord.js");
const config = require("./config.json");
const prefix = require("discord-prefix");
const cron = require("node-cron");
const methods = require("./methods.js");

// Start Discord client
let client = new Discord.Client();

// Set Discord Bot Token
client.login(config.token);

// Load infractions database
let db = new sqlite3.Database(config.db);

// Banned words
let bannedWords = [];

// Log channel
const channel = client.channels.cache.get(config.channelID);

// Fetch banned words from database and insert into array every second
setInterval(() => {
  db.all("SELECT * FROM bannedwords", [], (err, rows) => {
    if (err) console.log("Error: " + err);

    rows.forEach((row) => {
      if (!bannedWords.find((o) => o === row.word)) bannedWords.push(row.word);
    });
  });
}, 1000);

cron.schedule(
  `0 1 * * *`,
  function () {
    check_for_verified_users();
    channel.send("Checked for unverified users next check in 24 Hours.");
  },
  {
    scheduled: true,
    timezone: "Europe/Berlin",
  }
);

// Log into bot
client.on("ready", () => {
  const channel = client.channels.cache.get(config.channelID);

  let output = `Logged in as ${client.user.tag}!`;
  console.log(output);

  channel.send(output);
});

// Discord Message event
client.on("message", (msg) => {

  const channel = client.channels.cache.get(config.channelID);
  if (!msg.guild) return;
  if (msg.author.bot) return;
  console.log(`Received Message from ${msg.author.tag}`);
  //get the prefix for the discord server
  let guildPrefix = config.prefix;

  // Args
  let args = msg.content.slice(guildPrefix.length).split(" ");

  // Add Rolecheck only Mods, Admins can use mute and banword commands
  if (
      msg.member.roles.cache.some((role) => config.excludedRoles.toString().includes(role.name))
  ) {
    const channel = client.channels.cache.get(config.channelID);

    // Check for unregistered user
    if (args[0].toLowerCase() === "check") {
      methods.check_for_verified_users(client, msg);
    }

    // Command: banword
    if (args[0].toLowerCase() === "banword") {
      methods.banword(client, msg, db, bannedWords);
    }

    // Command : tempmute
    if (args[0].toLowerCase() === "tempmute") {
      methods.tempmute(client, msg, db);
    }

    // Command : mute User
    if (args[0].toLowerCase() === "mute") {
      methods.muteUser(client, msg, db);
    }

    // Command : unmute User
    if (args[0].toLowerCase() === "unmute") {
      methods.unmuteUser(client, msg, db);
    }

    // Remove Word from bannedWord List
    if (args[0].toLowerCase() === "removeword") {
      methods.removeWordFromBannedWordList(client, msg, db, bannedWords);
    }
  }

  // Ignore message if it is from an Admin, Moderator
  if (
      msg.member.roles.cache.some((role) => config.excludedRoles.toString().includes(role.name))
  )
    return;

  // Ignore Message if it is written in an excluded channel.
  if (
      config.excludedChannels.toString().includes(msg.channel.id)
  ){
    return;}

  // Check if message contains a banned word

  methods.checkForBannedWords(client, msg, db, bannedWords);
});


