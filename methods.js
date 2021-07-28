// All functions seperated from the main .js

const config = require("./config.json");
const sqlite3 = require("sqlite3").verbose();
const prefix = require("discord-prefix");
const Discord = require("discord.js");

module.exports = {checkForBannedWords, banword, muteUser, tempmute, removeWordFromBannedWordList, unmuteUser, check_for_verified_users } ;

function checkForBannedWords(client, msg, db, bannedWords) {
    const channel = client.channels.cache.get(config.channelID);
    if (bannedWords.some((v) => msg.content.toLowerCase().includes(v))) {
        db.all(
            `SELECT uid, username, infractions
             FROM infractions
             WHERE uid = ${msg.author.id}`,
            function (err, rows) {
                let output;
                if (rows.length == 0) {
                    // Insert user into database and set infractions to 1
                    db.run(`INSERT INTO infractions (uid, username, infractions)
                            VALUES (${msg.author.id}, '${msg.author.username}', 1)`);

                    // Log to console
                    output = `User ${msg.author.username}(${msg.author.id}) doesn't exist, creating entry.`;
                    console.log(output);
                } else {
                    rows.forEach((row) => {
                        // Parse infractions to Integer
                        let infractions = parseInt(row.infractions);

                        // Update infractions in database
                        db.run(`UPDATE infractions
                                SET infractions = ${infractions + 1}
                                WHERE uid = ${msg.author.id}`);

                        // Log to console
                        output = `User ${msg.author.username}(${
                            msg.author.id
                        }) exists. Updated infractions from ${infractions} to ${
                            infractions + 1
                        }.`;
                        console.log(output);

                        // Check if infractions > 3
                        if (infractions + 1 >= 3) {
                            // Add user to muted role
                            let user = msg.author;
                            user = msg.guild.member(user);
                            user.roles
                                .add(config.mutedRole)
                                .then(
                                    msg.reply(
                                        `You have been muted due to exceeding infraction limit (3).`
                                    )
                                )
                                .catch(console.error);
                            let date = new Date().toLocaleString();
                            let textembed = new Discord.MessageEmbed()
                                .setTitle(`${msg.author.username}`)
                                .setColor(15105570)
                                .setDescription(`${msg.author} got muted \n ${date}`);

                            channel.send(textembed);
                        } else {
                            // Reply to user
                            msg
                                .reply(
                                    `please refrain from asking for features. (Warning #${
                                        infractions + 1
                                    })`
                                )
                                .then((msg) => console.log(`Replied to ${msg.author.username}`))
                                .catch(console.error);
                        }
                    });
                }

                let date = new Date().toLocaleString();
                let textembed = new Discord.MessageEmbed()
                    .setTitle(`Deleted Message by ${msg.author.username}`)
                    .setColor(10038562)
                    .setDescription(
                        `Message from ${msg.author} got deleted \n Message contained: ${msg.content} \n ${date}`
                    );
                // Delete message
                msg
                    .delete({ timeout: 1000 })
                    .then((msg) =>
                        console.log(
                            `Deleted message from ${msg.author.username} after 1 seconds`
                        )
                    )
                    .then(channel.send(textembed))
                    .catch(console.error);
            }
        );
    }
}

function banword(client, msg, db, bannedWords){
    db.all(
        `SELECT word
           FROM bannedwords
           WHERE word = ("${msg.content.split(" ")[1]}")`,
        (err, rows) => {
            let word = "`" + msg.content.split(" ")[1] + "`";
            if (!rows.length == 0) {
                // Word already exists
                msg.reply(`Word:  ${word}  already exists.`);
            } else {
                // Word is not existent in the current Database
                db.run(`INSERT INTO bannedwords (word)
                      VALUES ("${msg.content.split(" ")[1]}")`);

                // Replying sucess message to Discord
                msg.reply(`Successfully added  ${word}  to the banned word list.`);
            }
        }
    );
}

function tempmute(client, msg, db) {
    let args = msg.content.slice(config.prefix.length).split(" ");
    const channel = client.channels.cache.get(config.channelID);
    let user = msg.mentions.users.first();
    // Getting the second argument of the message( Time in Minutes)
    let time = args[2].toLowerCase();
    if (user === undefined) return;
    console.log(user.id);
    db.all(
        `SELECT uid, username, infractions
           FROM infractions
           WHERE uid = ${user.id}`,
        function (err, rows) {
            if (rows.length === 0) {
                // Insert user into database and set infractions to 1
                addMutedUserToDB();

            } else {
                db.all(
                    `SELECT uid, username, infractions
                   FROM infractions
                   WHERE uid = ${user.id}`,
                    function (err, rows) {
                        rows.forEach((row) => {
                            // Setting infractions for mentioned user to 3
                            db.run(`UPDATE infractions
                              SET infractions = 3
                              WHERE uid = ${row.uid}`);
                            console.log(`Updated Infractions to 3 for ${user.id}`);

                            let date = new Date().toLocaleString();
                            let textembed = new Discord.MessageEmbed()
                                .setTitle(`${msg.author.username} muted ${user.username}`)
                                .setColor(15105570)
                                .setDescription(
                                    `${user} got muted for ${time} minute(s) \n ${date}`
                                );
                            channel.send(textembed);
                            // Setting Muted Role to user
                            user = msg.guild.member(user);
                            user.roles
                                .add(config.mutedRole)
                                .then(msg.reply(`Muted ${user} for ${time} minute(s)`))
                                .catch(console.error);
                        });
                    }
                );
            }
            setTimeout(() => {
                let user = msg.mentions.users.first();
                let date = new Date().toLocaleString();
                let textembed = new Discord.MessageEmbed()
                    .setTitle(`${user.username} got unmuted`)
                    .setColor(15105570)
                    .setDescription(
                        `${user} got unmuted \n Temporary mute of ${time} minute(s) expired \n ${date}`
                    );
                channel.send(textembed);
                // Setting Muted Role to user
                user = msg.guild.member(user);
                user.roles.remove(config.mutedRole, `Temporary mute expired.`);
            }, time * 60000); // time in ms)
        }
    );
}

function muteUser(client, msg, db) {
    const channel = client.channels.cache.get(config.channelID);
    let user = msg.mentions.users.first();
    if (user === undefined) return;
    console.log(user.id);
    db.all(
        `SELECT uid, username, infractions
         FROM infractions
         WHERE uid = ${user.id}`,
        function (err, rows) {
            if (rows.length == 0) {
                // Insert user into database and set infractions to 1
                addMutedUserToDB()
            } else {
                db.all(
                    `SELECT uid, username, infractions
                     FROM infractions
                     WHERE uid = ${user.id}`,
                    function (err, rows) {
                        rows.forEach((row) => {
                            // Setting infractions for mentioned user to 3
                            db.run(`UPDATE infractions
                                    SET infractions = 3
                                    WHERE uid = ${row.uid}`);
                            console.log(`Updated Infractions to 3 for ${user.id}`);

                            let date = new Date().toLocaleString();
                            let textembed = new Discord.MessageEmbed()
                                .setTitle(`${msg.author.username} muted ${user.username}`)
                                .setColor(15105570)
                                .setDescription(`${user} got muted \n ${date}`);
                            channel.send(textembed);
                            // Setting Muted Role to user
                            user = msg.guild.member(user);
                            user.roles
                                .add(config.mutedRole)
                                .then(msg.reply(`Muted ${user}`))
                                .catch(console.error);
                        });
                    }
                );
            }
        }
    );
}

function unmuteUser(client, msg, db) {
    let user = msg.mentions.users.first();
    const channel = client.channels.cache.get(config.channelID);
    db.all(
        `SELECT uid, username, infractions
         FROM infractions
         WHERE uid = ${user.id}`,
        function (err, rows) {
            rows.forEach((row) => {
                // Setting infractions to 0
                db.run(`UPDATE infractions
                        SET infractions = 0
                        WHERE uid = ${user.id}`);

                // Logging to console
                output = `User ${user.username}(${user.id}) exists. Updated infractions to 0.`;
                console.log(output);

                // Replying success message to discord
                msg.reply(`User ${user} has been unmuted.`);

                // Removing muted role
                let date = new Date().toLocaleString();
                let textembed = new Discord.MessageEmbed()
                    .setTitle(
                        `${user.username} got unmuted by ${msg.author.username}`
                    )
                    .setColor(15105570)
                    .setDescription(`${user} got unmuted\n ${date}`);
                channel.send(textembed);
                user = msg.guild.member(user);
                user.roles.remove(config.mutedRole).catch(console.error);
            });
        }
    );
}

function removeWordFromBannedWordList(client, msg, db, bannedWords) {
    db.all(
        `SELECT word
         FROM bannedwords
         WHERE word = ("${msg.content.split(" ")[1]}")`,
        (err, rows) => {
            if (!rows.length == 0) {
                // Delete Word from bannedWords Database
                db.run(`DELETE
                        FROM bannedwords
                        WHERE word = ("${msg.content.split(" ")[1]}")`);
                let word = "`" + msg.content.split(" ")[1] + "`";
                // Replying sucess message to Discord
                msg.reply(
                    `${word} has been successfully removed from the banned words list.`
                );
            } else {
                // Word is not existent in the current Database
                let word = "`" + msg.content.split(" ")[1] + "`";
                msg.reply(
                    `${word} couldn't be removed as it's not in the banned words list.`
                );
            }
        }
    );
}

function addMutedUserToDB(){

    db.run(`INSERT INTO infractions (uid, username, infractions)
            VALUES (${user.id}, '${user.username}', 3)`);
    user = msg.guild.member(user);
    user.roles
        .add(config.mutedRole)
        .then(msg.reply(`Muted ${user.username}`))
        .catch(console.error);
    let date = new Date().toLocaleString();
    let textembed = new Discord.MessageEmbed()
        .setTitle(`${user} got muted`)
        .setColor(15105570)
        .setDescription(`${user} got muted \n ${date}`);
    channel.send(textembed);

    // Log to console
    output = `User ${user.username}(${user.id}) doesn't exist, creating entry.`;
    console.log(output);

}

function check_for_verified_users(client, msg) {
    let kickedUsers = [];
    const channel = client.channels.cache.get(config.channelID);
    let guild = client.guilds.cache.get(config.guild);
    let kickedaUsers = false;

    guild.members.fetch()
        .then(members => {

            members.forEach(member => {

                if (!member.roles.cache.has(config.registeredRole)) {
                    kickedUsers.push(member.user.tag)
                    kickedaUsers = true;
                    member.kick("Not verified on forums")
                        .catch((err) => {
                            msg.reply("I was unable to kick the member");
                            console.error(err);
                        });
                }

            });
            if (kickedaUsers) {
                let date = new Date().toLocaleString();
                let textembed = new Discord.MessageEmbed()
                    .setTitle(`Kicked Users:`)
                    .setColor(15158332)
                    .setDescription(
                        `Checked for non verified User\nThe following Users got kicked: ${kickedUsers} `
                    );
                channel.send(textembed);
            } else {
                let date = new Date().toLocaleString();
                let textembed = new Discord.MessageEmbed()
                    .setTitle(`Kicked Users:`)
                    .setColor(3066993)
                    .setDescription(
                        `No unverified Users found.`
                    );
                channel.send(textembed);
            }
        })
}
