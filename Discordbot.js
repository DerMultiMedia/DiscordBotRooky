// Requirements
const sqlite3 = require('sqlite3').verbose();
const Discord = require('discord.js');
const config = require ('./config.json');
const prefix = require('discord-prefix');
const cron = require('node-cron');

// Start Discord client
const client = new Discord.Client();

// Set Discord Bot Token
client.login(config.token);

// Load infractions database
let db = new sqlite3.Database(config.db);

// Banned words
let bannedWords = [];

// Kicked Users
 let kickedUsers = []

// Log channel
const channel = client.channels.cache.get(config.channelName)

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

cron.schedule(
    `0 1 * * *`,
    function () {
      check_for_verified_users()
      channel.send("Checked for unverified users next check in 24 Hours.")
    },
    {
      scheduled: true,
      timezone: "Europe/Berlin",
    }
);

// Log into bot
client.on('ready', () => {
  const channel = client.channels.cache.get(config.channelName);
	console.log(`Logged in as ${client.user.tag}!`);
  output = `Logged in as ${client.user.tag}!`;
  channel.send(output)
});

// Discord Message event
client.on("message", msg => {
  const channel = client.channels.cache.get(config.channelName);
  if (!msg.guild) return;
  if (msg.author.bot) return;

  //get the prefix for the discord server
  let guildPrefix = prefix.getPrefix(msg.guild.id);

  //set prefix to the default prefix if there isn't one
  if (!guildPrefix) guildPrefix = config.prefix;

  // Args
  let args = msg.content.slice(guildPrefix.length).split(' ');


  // Add Rolecheck only Mods. Admins can edit banned word list
  if (msg.member.roles.cache.some(role => role.name === 'cool') || msg.member.roles.cache.some(role => role.name === "new role"))
  {
    // Check for unregistered user
    if(args[0].toLowerCase() === "check")
    {
      let kickedUsers = []
      check_for_verified_users(msg)
    }

    // Command: addbannedword

    if (args[0].toLowerCase() === "banword") {
      db.all(`SELECT word FROM bannedwords WHERE word = ("${msg.content.split(' ')[1]}")`, (err, rows) => {
        let word = "`"+msg.content.split(' ')[1]+"`"
        if (!rows.length == 0) {
          // Word already exists
          msg.reply(`Word:  ${word}  already exists.`);
        } else {
          // Word is not existent in the current Database
          db.run(`INSERT INTO bannedwords (word) VALUES ("${msg.content.split(' ')[1]}")`);

          // Replying sucess message to Discord
          msg.reply(`Successfully added  ${word}  to the banned word list.`);
        };
      })
    }

    // Command : mute User
    if (args[0].toLowerCase() === "mute") {
      let user = msg.mentions.users.first()
      db.all(`SELECT uid, username, infractions FROM infractions WHERE uid = ${user.id}`, function(err, rows) {
        if (rows.length == 0) {
        // Insert user into database and set infractions to 1
        db.run(`INSERT INTO infractions (uid, username, infractions)
                VALUES (${user.id}, '${user.username}', 3)`);
        user = msg.guild.member(user);
        user.roles
            .add(config.mutedRole)
            .then(msg.reply(`Muted ${user}`))
            .catch(console.error);
        let date = new Date().toLocaleString()
        let textembed = new Discord.MessageEmbed()
            .setTitle(`${msg.author.username}`)
            .setColor(15105570)
            .setDescription(`${user} got muted \n ${date}`)
        msg.reply(textembed)

        // Log to console
        output = `User ${user.username}(${user.id}) doesn't exist, creating entry.`;
        console.log(output);
      } else {
        db.all(`SELECT uid, username, infractions
                FROM infractions
                WHERE uid = ${user.id}`, function (err, rows) {
          rows.forEach((row) => {
            // Setting infractions for mentioned user to 3
            db.run(`UPDATE infractions
                    SET infractions = 3
                    WHERE uid = ${row.uid}`);
            console.log(`Updated Infractions to 3 for ${user.id}`)
            // Setting Muted Role to user
            user = msg.guild.member(user);
            user.roles
                .add(config.mutedRole)
                .then(msg.reply(`Muted ${user}`))
                .catch(console.error);
            let date = new Date().toLocaleString()
            let textembed = new Discord.MessageEmbed()
                .setTitle(`${msg.author.username}`)
                .setColor(15105570)
                .setDescription(`${user} got muted \n ${date}`)
            msg.reply(textembed)
          })
        })
      }
    })
    }

    // Command : unmute User
    if (args[0].toLowerCase() === "unmute"){
      let user = msg.mentions.users.first();
      db.all(`SELECT uid, username, infractions FROM infractions WHERE uid = ${user.id}`, function(err, rows) {
        rows.forEach((row) => {
          // Setting infractions to 0
          db.run(`UPDATE infractions SET infractions = 0 WHERE uid = ${user.id}`);

          // Logging to console
          output = `User ${user.username}(${user.id}) exists. Updated infractions to 0.`;
          console.log(output);
          
          // Replying success message to discord
          msg.reply(`User ${user} has been unmuted.`);

          // Removing muted role
          user = msg.guild.member(user);
          user.roles
          .remove(config.mutedRole)
          .catch(console.error);
        });
      });
    };
  }
  
  // Remove Word from bannedWord List
  if(args[0].toLowerCase() === "removeword"){
    db.all(`SELECT word FROM bannedwords WHERE word = ("${msg.content.split(' ')[1]}")`, (err, rows) => {
      if (!rows.length == 0) {

        // Delete Word from bannedWords Database
        db.run(`DELETE FROM bannedwords WHERE word = ("${msg.content.split(' ')[1]}")`);
        let word = "`"+msg.content.split(' ')[1]+"`"
        // Replying sucess message to Discord
        msg.reply(`${word} has been successfully removed from the banned words list.`);
      } else {
        // Word is not existent in the current Database
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
        output = `User ${msg.author.username}(${msg.author.id}) doesn't exist, creating entry.`;
        console.log(output);

      } else {
        rows.forEach((row) => {
          // Parse infractions to Integer
          let infractions = parseInt(row.infractions);

          // Update infractions in database
          db.run(`UPDATE infractions SET infractions = ${infractions + 1} WHERE uid = ${msg.author.id}`)

          // Log to console
          output = `User ${msg.author.username}(${msg.author.id}) exists. Updated infractions from ${infractions} to ${infractions + 1}.`;
          console.log(output);

          // Check if infractions > 3
          if (infractions +1 >= 3) {
            // Add user to muted role
            let user = msg.author;
            user = msg.guild.member(user);
            user.roles
              .add(config.mutedRole)
              .then(msg.reply(`You have been muted due to exceeding infraction limit (3).`))
              .catch(console.error);
            let date = new Date().toLocaleString()
            let textembed = new Discord.MessageEmbed()
              .setTitle(`${msg.author.username}`)
              .setColor(15105570)
              .setDescription(`${msg.author} got muted \n ${date}`)
              
            channel.send(textembed)
          } else {
            // Reply to user
            msg.reply(`please refrain from asking for features. (Warning #${infractions +1})`)
            .then(msg => console.log(`Replied to ${msg.author.username}`))
            .catch(console.error); 
          }
        });
      }

      let date = new Date().toLocaleString()
      let textembed = new Discord.MessageEmbed()
        .setTitle(`Deleted Message by ${msg.author.username}`)
        .setColor(10038562)
        .setDescription(`Message from ${msg.author} got deleted \n Message contained: ${msg.content} \n ${date}`)
      // Delete message
      msg.delete({ timeout: 1000 })
      .then(msg => console.log(`Deleted message from ${msg.author.username} after 1 seconds`))
      .then(channel.send(textembed))
      .catch(console.error);
    });
  }
});

// Check if User is verified on forums
function check_for_verified_users(msg)
{
  const channel = client.channels.cache.get(config.channelName);
  let guild = client.guilds.cache.get(config.guild);
  let members = guild.members.fetch()
  let memberListall = guild.members
  // List all members of server
  memberListall.cache.each( async m => {
    // if user doesnt have registered role
    if(!m.roles.cache.has(config.registeredRole)) {
      kickedUsers.push(m.user.tag)
      m.kick("Not verified on forums")
          .then(() => {
            msg.reply(`Successfully kicked ${m.user.username}`)
          })
          .catch(err => {
            msg.reply("I was unable to kick the member");
            console.error(err);
          })
    }
  })
  let date = new Date().toLocaleString()
  let textembed = new Discord.MessageEmbed()
      .setTitle(`Kicked Users:`)
      .setColor(15158332)
      .setDescription(`Checked for non verified User\nThe following Users got kicked: ${kickedUsers} `)
  channel.send(textembed)
}
