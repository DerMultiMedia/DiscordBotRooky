// Requirements
const sqlite3 = require('sqlite3').verbose();
const Discord = require('discord.js');
const config = require ('./config.json');
const prefix = require('discord-prefix');

// Start Discord client
const client = new Discord.Client();

// Set Discord Bot Token
client.login(config.token);

// Load infractions database
let db = new sqlite3.Database(config.db);

// Command prefix
const defaultPrefix = '!';

// Banned words
let bannedWords = [];

// Fetch banned words from database and insert into array every second
setInterval(() => {
  db.all('SELECT * FROM bannedwords', [], (err, rows) => {
    if (err)
      console.log("Error: " + err);

    rows.forEach((row) => {
      if (!bannedWords.find(o => o === row.word))
        bannedWords.push(row.word);
    });
  });
}, 1000)

// Log into bot
client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

// Discord Message event
client.on("message", msg => {
  if (!msg.guild) return;
  if (msg.author.bot) return;

  //get the prefix for the discord server
  let guildPrefix = prefix.getPrefix(msg.guild.id);

  //set prefix to the default prefix if there isn't one
  if (!guildPrefix) guildPrefix = defaultPrefix;

  // Add Rolecheck only Mods. Admins can edit banned word list
  if (msg.member.roles.cache.some(role => role.name === 'cool') || msg.member.roles.cache.some(role => role.name === "new role")){

  // Command: addbannedword 
  let args = msg.content.slice(guildPrefix.length).split(' ');
    if (args[0].toLowerCase() === "addbannedword") {
        db.run(`INSERT INTO bannedwords (word) VALUES ("${msg.content.split(' ')[1]}")`);
        msg.reply("Successfully added `" + msg.content.split(' ')[1] + "` to the banned word list.");
    };

    // Command : unmute User
    if (args[0].toLowerCase() === "unmute"){
      let user = msg.mentions.users.first();
      db.all(`SELECT uid, username, infractions FROM infractions WHERE uid = ${user.id}`, function(err, rows) {
        rows.forEach((row) => {
          // Setting infractions to 0
          db.run(`UPDATE infractions SET infractions = 0 WHERE uid = ${row.uid}`);

          // Logging to console
          console.log(`User ${user.username}(${user.id}) exists. Updated infractions to 0.`);

          // Replying success message to discord
          msg.reply(`User <@${row.uid}> has been unmuted.`);

          // Removing muted role
          user = msg.guild.member(user);
          user.roles
          .remove(config.mutedRole)
          .catch(console.error);
        });
      });
    };
  }

  let args = msg.content.slice(guildPrefix.length).split(' ');
  // Remove Word from bannedWord List
  if(args[0].toLowerCase() === "removeword"){
    db.all(`SELECT word FROM bannedwords WHERE word = ("${msg.content.split(' ')[1]}")`, (err, rows) => {
      if (!rows.length == 0) {
        db.run(`DELETE FROM bannedwords WHERE word = ("${msg.content.split(' ')[1]}")`);
        let word = "`"+msg.content.split(' ')[1]+"`"
        msg.reply(`${word} has been successfully removed from the banned words list.`);
      } else {
        let word = "`"+msg.content.split(' ')[1]+"`"
        msg.reply(`${word} couldn't be removed as it's not in the banned words list.`);
      }
    });
  }

  // Add Rolecheck for Mods, Admin etc..  
  if (msg.member.roles.cache.some(role => role.name === 'cool') || msg.member.roles.cache.some(role => role.name === "new role")) return;

  // Check if message contains a banned word
  if (bannedWords.some(v => msg.content.toLowerCase().includes(v))) {
    db.all(`SELECT uid, username, infractions FROM infractions WHERE uid = ${msg.author.id}`, function(err, rows) { 
      if (rows.length == 0) {
        // Insert user into database and set infractions to 1
        db.run(`INSERT INTO infractions (uid, username, infractions) VALUES (${msg.author.id}, '${msg.author.username}', 1)`);

        // Log to console
        console.log(`User ${msg.author.username}(${msg.author.id}) doesn't exist, creating entry.`);
      } else {
        rows.forEach((row) => {
          // Parse infractions to Integer
          let infractions = parseInt(row.infractions);

          // Update infractions in database
          db.run(`UPDATE infractions SET infractions = ${infractions + 1} WHERE uid = ${msg.author.id}`)

          // Log to console
          console.log(`User ${msg.author.username}(${msg.author.id}) exists. Updated infractions from ${infractions} to ${infractions + 1}.`);

          // Check if infractions > 3
          if (infractions +1 >= 3) {
            // Add user to muted role
            let user = msg.author;
            user = msg.guild.member(user);
            user.roles
              .add(config.mutedRole)
              .then(msg.reply(`You have been muted due to exceeding infraction limit (3).`))
              .catch(console.error);
          } else {
            // Reply to user
            msg.reply(`please refrain from asking for features. (Warning #${infractions +1})`)
            .then(msg => console.log(`Replied to ${msg.author.username}`));
          }
        });
      }
      // Delete message
      msg.delete({ timeout: 1000 })
      .then(msg => console.log(`Deleted message from ${msg.author.username} after 1 seconds`))
      .catch(console.error); 
    });
  }
});

// Any Ideas?