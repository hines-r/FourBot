const Discord = require('discord.js');
const { TOKEN, PREFIX, GOOGLE_API_KEY, DEJA_VU, BEYOND } = require('./config');
const ytdl = require('ytdl-core');
const YouTube = require('simple-youtube-api');

const client = new Discord.Client();
const youtube = new YouTube(GOOGLE_API_KEY);
const queue = new Map();

const coin = [
    'Heads',
    'Tails'
];

// TODO: perhaps move this to a separate file and change the switch statement to use it
const commands = [
    'play',
    'skip',
    'stop',
    'volume',
    'repeat',
    'np',
    'queue',
    'pause',
    'resume',
    'flip',
    'choose'
];

const maxVolume = 10;
const defaultVolume = 5;

client.on('warn', console.warn);

client.on('error', console.error);

client.on('ready', () => {
    console.log(`${client.user.username} is online!`);
    client.user.setActivity(`${PREFIX}`); // Sets currently playing text
});

client.on('disconnect', () => console.log('Disconnected!'));

client.on('reconnecting', () => console.log('Reconnecting!'));

client.on('message', async message => {
    // Won't respond to itself
    if (message.author.bot) return;

    // Won't respond to commands without a prefix
    if (!message.content.startsWith(PREFIX)) return;

    // 4
    if (message.content == PREFIX) return message.channel.send('4');

    const args = message.content.substring(PREFIX.length).split(' ');
    const serverQueue = queue.get(message.guild.id);

    var searchString = args.slice(1).join(' ');

    switch (args[0].toLowerCase()) {
        case 'play': {
            const voiceChannel = message.member.voiceChannel;
            if (!voiceChannel) return message.channel.send('You need to be in a voice channel!');

            const permissions = voiceChannel.permissionsFor(message.client.user);
            if (!permissions.has('CONNECT')) return message.channel.send('Cannot connect due to permissions!');
            if (!permissions.has('SPEAK')) return message.channel.send('Cannot speak due to permissions!');

            if (!args[1]) return message.channel.send('Please input a valid search or url!');

            // As specified by config.js, sets the search string to preset URL
            if (searchString.toLowerCase() == 'dejavu') {
                searchString = DEJA_VU;
            }
            else if (searchString.toLowerCase() == 'beyond') {
                searchString = BEYOND;
            }

            // Tries to get the first video search result on YouTube
            try {
                var video = await youtube.getVideo(searchString);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 1); // Gets first search result
                    var video = await youtube.getVideoByID(videos[0].id);
                } catch (error) {
                    console.error(error);
                    return message.channel.send(`No search results found... :()`)
                }
            }

            const song = {
                id: video.id,
                title: video.title,
                url: `https://www.youtube.com/watch?v=${video.id}` // Generic URL to pass in video id
            };

            if (!serverQueue) {
                const queueConstruct = {
                    textChannel: message.channel,
                    voiceChannel: voiceChannel,
                    connection: null,
                    songs: [],
                    volume: defaultVolume,
                    playing: true,
                    repeat: false
                };

                queue.set(message.guild.id, queueConstruct);
                queueConstruct.songs.push(song);

                try {
                    let connection = await voiceChannel.join();
                    queueConstruct.connection = connection;
                    play(message.guild, queueConstruct.songs[0]);
                } catch (error) {
                    console.error(error);
                    queue.delete(message.guild.id);
                    return message.channel.send('Error connecting!');
                }
            }
            else {
                serverQueue.songs.push(song);
                console.log(serverQueue.songs);
                return message.channel.send(`**${song.title}** has been added to the queue!`)
            }
            break;
        }
        case 'skip': {
            if (!message.member.voiceChannel) return message.channel.send('You are not in a voice channel!');
            if (!serverQueue) return message.channel.send('There is nothing playing to skip!');

            serverQueue.repeat = false;
            serverQueue.connection.dispatcher.end('Skip command used');
            break;
        }
        case 'stop': {
            if (!message.member.voiceChannel) return message.channel.send('You are not in a voice channel!');
            if (!serverQueue) return message.channel.send('There is nothing playing to stop!');

            serverQueue.repeat = false;
            serverQueue.songs = []; // Clears all songs in the queue before stopping
            serverQueue.connection.dispatcher.end('Stop command used');
            break;
        }
        case 'volume': {
            if (!message.member.voiceChannel) return message.channel.send('You are not in a voice channel!');
            if (!serverQueue) return message.channel.send('There is nothing playing!');
            if (!args[1]) return message.channel.send(`The current volume is: **${serverQueue.volume}**`);
            
            if (args[1].toString().toLowerCase() == "max") {
                setVolume(message.guild, maxVolume);
                return;
            }
            else if (args[1].toString().toLowerCase() == "min") {
                setVolume(message.guild, 1);
                return;
            }

            const volInput = parseInt(args[1]); // Attempts to convert the input to an integer value

            // Checks to see if the conversion was successful and if the value is between 0 and maxVolume
            if (isNaN(volInput) || volInput < 0 || volInput > maxVolume) {
                return message.channel.send('Please enter a value between 1 and 10!')
            }

            setVolume(message.guild, volInput);
            break;
        }
        case 'repeat': {
            if (!message.member.voiceChannel) return message.channel.send('You are not in a voice channel!');
            if (!serverQueue) return message.channel.send('There is nothing playing!');
            if (!args[1]) return message.channel.send(`Repeat is set to: **${serverQueue.repeat}**`);

            const input = args[1].toLowerCase().trim();
            
            if (input == 'true' || input == 't') {
                serverQueue.repeat = true;
                message.channel.send(`Repeat has been set to: **${serverQueue.repeat}**`)
            }
            else if (input == 'false' || input == 'f') {
                serverQueue.repeat = false;
                message.channel.send(`Repeat has been set to: **${serverQueue.repeat}**`)
            }
            else {
                message.channel.send(`Unknown parameter! Please enter true or false after **${PREFIX}repeat**!`)
            }

            break;
        }
        case 'np': {
            if (!serverQueue) return message.channel.send('There is nothing playing!');

            message.channel.send(`Now playing: **${serverQueue.songs[0].title}**`)
            break;
        }
        case 'queue': {
            if (!serverQueue) return message.channel.send('There is nothing playing!');

            const embed = new Discord.RichEmbed()
                .setColor(randomColor())
                .addField('**Song queue:**', `${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}`)
                .setFooter(`Now playing: ${serverQueue.songs[0].title}`);

            message.channel.send(embed);
            break;
        }
        case 'pause': {
            if (serverQueue && serverQueue.playing) {
                serverQueue.playing = false;
                serverQueue.connection.dispatcher.pause();
                return message.channel.send('Music paused!');
            }

            message.channel.send('There is nothing playing!');
            break;
        }
        case 'resume': {
            if (serverQueue && !serverQueue.playing) {
                serverQueue.playing = true;
                serverQueue.connection.dispatcher.resume();
                return message.channel.send('Music resumed!');
            }

            message.channel.send('There is nothing playing!');
            break;
        }
        case 'flip': {
            const result = flipCoin();
            message.channel.send(`The coin landed on **${result}**!`);
            break;
        }
        case 'choose': {
            if (!args[1]) return message.channel.send(`Please type anything after **${PREFIX}choose** separated by commas!`)

            let itemString = '';

            // Gets all arguments after the first element
            for (let i = 1; i < args.length; i++) {
                itemString += ' ' + args[i];
            }

             // Gets all items separated by a comma and places them in an array
             // Also trims each item to get rid of leading and trailing white space
            const items = itemString.split(',').map(string => string.trim());

            const result = items[randomRoll(0, items.length - 1)];
            message.channel.send(`I choose **${result}**!`)          
            break;
        }
        case 'help': {
            const embed = new Discord.RichEmbed()
                .setColor(randomColor())
                .addField('**Command list**', `${commands.map(command => `**-** ${PREFIX}${command}`).join('\n')}`);
                
            message.channel.send(embed);
            break;
        }
        default: {
            message.channel.send(`Unknown command! Type **${PREFIX}help** to see full list!`);
        }
    }
});

// Streams a song by passing in a YouTube url 
function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    // If no song is available, leaves the voice channel and deletes the queue for the server
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    console.log(serverQueue.songs);

    // Plays the song through audio stream
    const dispatcher = serverQueue.connection.playStream(ytdl(song.url), {filter: 'audioonly'});

    dispatcher.on('end', reason => {
        console.log(reason);

        // Doesn't shift array if repeat is enabled
        if (!serverQueue.repeat) {
            serverQueue.songs.shift(); // Removes first element in queue
        }

        play(guild, serverQueue.songs[0]); // Plays first song in queue
    });

    dispatcher.on('error', error => {
        console.error(error);
    });

    dispatcher.setVolumeLogarithmic(serverQueue.volume / maxVolume);

    serverQueue.textChannel.send(`Start playing: **${song.title}**`);
}

function setVolume(guild, volInput) {
    const serverQueue = queue.get(guild.id);

    serverQueue.volume = volInput;
    serverQueue.connection.dispatcher.setVolumeLogarithmic(volInput / maxVolume);
    serverQueue.textChannel.send(`Set volume to: **${serverQueue.volume}**`);
}

// Returns a random whole number between a min and max value
function randomRoll(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function flipCoin() {
    return coin[randomRoll(0, coin.length - 1)]
}

// Returns a random RGB color in the form of [r, g, b]
function randomColor() {
    const maxRange = 255;
    
    // Assigns a random color value to RGB values
    const r = randomRoll(0, maxRange);
    const g = randomRoll(0, maxRange);
    const b = randomRoll(0, maxRange);

    const color = [r, g, b];

    return color;
}

client.login(TOKEN);