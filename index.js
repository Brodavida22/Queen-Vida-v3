const fs = require('fs');
const path = require('path');
require('dotenv').config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const pino = require('pino');
const express = require('express');

const { getMode } = require('./utils/mode');
const {
    getPrefix,
    getAllowedPrefixes
} = require('./utils/prefix');

const { handleGameMessage } = require('./utils/gameManager');


// ============================================================
// EXPRESS / CLOUD SERVER
// ============================================================

const PORT = process.env.PORT;
let isExpressRunning = false;

function startExpressServer() {
    if (!PORT) return;
    if (isExpressRunning) return;

    const app = express();

    app.get('/', (req, res) => {
        res.send('Queen Vida-V3 Bot is Running Active!');
    });

    app.listen(PORT, () => {
        isExpressRunning = true;
        console.log(`🌐 Express health-check server listening on port ${PORT}`);
    });
}


// ============================================================
// CREATOR INFORMATION
// ============================================================

const CREATOR_NAME = 'QUEEN VIDA';
const DISPLAY_CREATOR_NUMBER = '2348138558590';
const CREATOR_NUMBERS = ['2348138558590'];

const CHANNEL_TEXT_LINK =
    '\n\n📢 *Join QUEEN VIDA Channel:*\nhttps://whatsapp.com/channel/0029Vb8hHHs30LKXQEb4xe38';


function verifyCreatorIntegrity() {
    if (
        !CREATOR_NUMBERS.includes('2348138558590') ||
        CREATOR_NAME !== 'QUEEN VIDA'
    ) {
        console.error(
            '❌ CRITICAL ERROR: Creator identity signature has been altered or tampered with!'
        );

        process.exit(1);
    }
}

verifyCreatorIntegrity();


// ============================================================
// ERROR HANDLERS
// ============================================================

process.on('uncaughtException', (err) => {
    console.error(
        '🔥 [CRASH REPORT - UNCAUGHT EXCEPTION]:',
        err
    );

    if (err && err.stack) {
        console.error(err.stack);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(
        '🔥 [CRASH REPORT - UNHANDLED REJECTION] At Promise:',
        promise,
        'Reason:',
        reason
    );
});


// ============================================================
// SPAM TRACKER
// ============================================================

const spamTracker = {};


// ============================================================
// SETTINGS
// ============================================================

function getGlobalSettings() {
    const settingsPath = path.join(__dirname, 'settings.json');

    if (fs.existsSync(settingsPath)) {
        try {
            const data = JSON.parse(
                fs.readFileSync(settingsPath, 'utf8')
            );

            return {
                autoViewStatus:
                    data.autoViewStatus !== undefined
                        ? data.autoViewStatus
                        : 'on',

                autoReaction:
                    data.autoReaction !== undefined
                        ? data.autoReaction
                        : 'on',

                statusReaction:
                    data.statusReaction !== undefined
                        ? data.statusReaction
                        : 'off'
            };

        } catch (e) {
            console.error(
                '🔥 [SETTINGS ERROR] Failed to parse settings.json:',
                e.message
            );
        }
    }

    return {
        autoViewStatus: 'on',
        autoReaction: 'on',
        statusReaction: 'off'
    };
}


// ============================================================
// CONTEXT EMOJI
// ============================================================

function getContextEmoji(text = '') {
    const lower = text.toLowerCase();

    if (
        /(lol|lmao|funny|haha|😂|🤣|giggle|joke|comedy)/i.test(lower)
    ) {
        return '😂';
    }

    if (
        /(congrats|congratulations|welldone|bravo|party|🎉|🎈|win|victory|success)/i.test(lower)
    ) {
        return '🥳';
    }

    if (
        /(sad|sorry|rip|pain|crying|😭|😢|pity)/i.test(lower)
    ) {
        return '😢';
    }

    if (
        /(love|heart|babe|sweet|❤️|😍|kiss)/i.test(lower)
    ) {
        return '❤️';
    }

    if (
        /(fire|lit|amazing|cool|🔥|awesome|best)/i.test(lower)
    ) {
        return '🔥';
    }

    if (
        /(wow|omg|shock|damn|surprised|😮)/i.test(lower)
    ) {
        return '😮';
    }

    if (
        /(money|cash|rich|wealth|naira|dollar|lagos)/i.test(lower)
    ) {
        return '💰';
    }

    const defaults = [
        '👍',
        '🔥',
        '❤️',
        '👏',
        '🙌',
        '💯'
    ];

    return defaults[
        Math.floor(Math.random() * defaults.length)
    ];
}


// ============================================================
// START BOT
// ============================================================

async function startQueenVida() {

    verifyCreatorIntegrity();

    console.log(
        '🔄 Initializing Queen Vida-V3 Socket Connection...'
    );


    // ========================================================
    // AUTH
    // ========================================================

    const authPath = path.join(__dirname, 'auth_info');
    const credsPath = path.join(authPath, 'creds.json');

    if (
        fs.existsSync(authPath) &&
        fs.existsSync(credsPath)
    ) {
        try {

            const creds = JSON.parse(
                fs.readFileSync(credsPath, 'utf8')
            );

            if (!creds.registered) {

                console.log(
                    '⚠️ Detected an incomplete pairing session. Cleaning up auth_info...'
                );

                fs.rmSync(
                    authPath,
                    {
                        recursive: true,
                        force: true
                    }
                );
            }

        } catch (e) {

            console.error(
                '🔥 [AUTH ERROR] Failed reading creds.json:',
                e.message
            );

            fs.rmSync(
                authPath,
                {
                    recursive: true,
                    force: true
                }
            );
        }
    }


    const {
        state,
        saveCreds
    } = await useMultiFileAuthState('auth_info');


    // ========================================================
    // WHATSAPP SOCKET
    // ========================================================

    const sock = makeWASocket({

        logger: pino({
            level: 'silent'
        }),

        auth: state,

        printQRInTerminal: false,

        // Chrome browser identity
        browser: Browsers.macOS('Chrome'),

        syncFullHistory: false,

        markOnlineOnConnect: true
    });


    // ========================================================
    // COMMAND LOADER
    // ========================================================

    sock.commands = new Map();

    const commandPath = path.join(
        __dirname,
        'commands'
    );


    if (fs.existsSync(commandPath)) {

        try {

            const commandFiles =
                fs.readdirSync(commandPath)
                    .filter(file => file.endsWith('.js'));


            for (const file of commandFiles) {

                try {

                    const filePath =
                        path.join(commandPath, file);

                    delete require.cache[
                        require.resolve(filePath)
                    ];


                    const required =
                        require(filePath);


                    if (Array.isArray(required)) {

                        for (const cmd of required) {

                            if (cmd && cmd.name) {

                                sock.commands.set(
                                    cmd.name.toLowerCase(),
                                    cmd
                                );
                            }
                        }

                    } else if (
                        required &&
                        required.name
                    ) {

                        sock.commands.set(
                            required.name.toLowerCase(),
                            required
                        );
                    }

                } catch (cmdLoadErr) {

                    console.error(
                        `🔥 [COMMAND LOAD ERROR] File ${file}:`,
                        cmdLoadErr
                    );
                }
            }


            console.log(
                `📂 Loaded ${sock.commands.size} commands successfully.`
            );

        } catch (dirErr) {

            console.error(
                '🔥 [COMMAND DIR ERROR]:',
                dirErr
            );
        }
    }


// ========================================================
// PAIRING CODE
// ========================================================

    if (!sock.authState.creds.registered) {

        const phoneNumber =
            DISPLAY_CREATOR_NUMBER;


        if (!phoneNumber) {

            console.log(
                '❌ [ERROR]: PHONE_NUMBER environment variable is not set!'
            );

            return;
        }


        console.log(
            `⏳ Automatically requesting pairing code for ${phoneNumber}...`
        );


        setTimeout(async () => {

            try {

                const cleanNumber =
                    phoneNumber
                        .trim()
                        .replace(/[^0-9]/g, '');


                const code =
                    await sock.requestPairingCode(
                        cleanNumber
                    );


                console.log(
                    '✨ ======================================== ✨'
                );

                console.log(
                    `✨ YOUR WHATSAPP PAIRING CODE: ${code} ✨`
                );

                console.log(
                    '✨ ======================================== ✨'
                );

            } catch (pairErr) {

                console.error(
                    '🔥 [PAIRING ERROR] Failed to generate pairing code:',
                    pairErr
                );
            }

        }, 3000);
    }


    // ========================================================
    // STARTUP BANNER
    // ========================================================

    let isStartupBannerSent = false;


    sock.ev.on(
        'connection.update',
        async (update) => {

            const {
                connection,
                lastDisconnect
            } = update;


            if (connection) {

                console.log(
                    `📡 Connection Status Changed: --> ${connection.toUpperCase()} <--`
                );
            }


            // ------------------------------------------------
            // CONNECTED
            // ------------------------------------------------

            if (connection === 'open') {

                console.log(
                    `--- QUEEN VIDA-V3 CONNECTED [Creator: ${CREATOR_NAME}] ---`
                );


                if (!isStartupBannerSent) {

                    isStartupBannerSent = true;


                    try {

                        const botJid =
                            sock.user.id.split(':')[0] +
                            '@s.whatsapp.net';


                        const serverTime =
                            new Date().toLocaleString();


                        const activeBanner =
`┏━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┓
┃ Status: *V3 ONLINE & ACTIVE* ✅
┣━━━━━━━━━━━━━━━━━━━━━━━
┃ 🤖 *Bot Name:* QUEEN VIDA-V3
┃ ⚙️ *Version:* v3.0.0
┃ 👤 *Creator:* ${CREATOR_NAME}
┃ 👨‍💻 *Developer Contact:* https://wa.me/${DISPLAY_CREATOR_NUMBER}
┃ ⏱️ *Server Time:* ${serverTime}
┗━━━ 👑 *QUEEN VIDA-V3* 👑 ━━━┛
> _👑 *QUEEN VIDA-V3* 👑 successfully launched_`
+
CHANNEL_TEXT_LINK;


                        const bannerImagePath =
                            path.join(
                                __dirname,
                                'banner.png'
                            );


                        if (
                            fs.existsSync(
                                bannerImagePath
                            )
                        ) {

                            const imageBuffer =
                                fs.readFileSync(
                                    bannerImagePath
                                );


                            await sock.sendMessage(
                                botJid,
                                {
                                    image: imageBuffer,
                                    caption: activeBanner
                                }
                            );

                        } else {

                            await sock.sendMessage(
                                botJid,
                                {
                                    text: activeBanner
                                }
                            );
                        }

                    } catch (bannerErr) {

                        console.error(
                            '🔥 [BANNER ERROR] Failed sending startup banner:',
                            bannerErr
                        );
                    }
                }
            }


            // ------------------------------------------------
            // CONNECTION CLOSED
            // ------------------------------------------------

            else if (
                connection === 'close'
            ) {

                const statusCode =
                    new Boom(
                        lastDisconnect?.error
                    )?.output?.statusCode;


                console.error(
                    `🔥 [CONNECTION CLOSED] Status Code: ${statusCode}`,
                    lastDisconnect?.error ||
                    'Unknown disconnect reason'
                );


                if (
                    statusCode ===
                    DisconnectReason.loggedOut
                ) {

                    console.log(
                        '⚠️ Device logged out from WhatsApp session. Clear auth_info folder and re-link.'
                    );

                } else {

                    console.log(
                        '🔄 Connection closed/dropped, attempting automatic reconnection in 3 seconds...'
                    );


                    setTimeout(
                        () => startQueenVida(),
                        3000
                    );
                }
            }
        }
    );


    // ========================================================
    // SAVE CREDENTIALS
    // ========================================================

    sock.ev.on(
        'creds.update',
        saveCreds
    );


    // ========================================================
    // MESSAGE HANDLER
    // ========================================================

    sock.ev.on(
        'messages.upsert',
        async ({ messages }) => {

            try {

                const m = messages[0];


                if (!m || !m.message) {
                    return;
                }


                const from =
                    m.key.remoteJid;


                if (!from) {
                    return;
                }


                const settings =
                    getGlobalSettings();


                // ====================================================
                // STATUS HANDLER
                // ====================================================

                if (
                    from ===
                    'status@broadcast'
                ) {

                    if (
                        settings.autoViewStatus === 'on'
                    ) {

                        (async () => {

                            try {

                                if (
                                    m.key &&
                                    m.key.remoteJid
                                ) {

                                    await sock.readMessages([
                                        m.key
                                    ]);
                                }


                                if (
                                    settings.statusReaction === 'on' &&
                                    m.message
                                ) {

                                    const targetParticipant =
                                        m.key.participant ||
                                        m.participant;


                                    if (
                                        !targetParticipant ||
                                        !targetParticipant.endsWith(
                                            '@s.whatsapp.net'
                                        )
                                    ) {
                                        return;
                                    }


                                    const statusText =
                                        m.message.conversation ||
                                        m.message.extendedTextMessage?.text ||
                                        m.message.imageMessage?.caption ||
                                        m.message.videoMessage?.caption ||
                                        '';


                                    const emoji =
                                        getContextEmoji(
                                            statusText
                                        );


                                    try {

                                        await sock.sendMessage(
                                            'status@broadcast',
                                            {
                                                react: {
                                                    text: emoji,
                                                    key: m.key
                                                }
                                            },
                                            {
                                                statusJidList: [
                                                    targetParticipant
                                                ],
                                                broadcast: true
                                            }
                                        );

                                    } catch (statusReactErr) {
                                        // Silent
                                    }
                                }

                            } catch (statusHandlerErr) {
                                // Silent
                            }

                        })();
                    }


                    return;
                }


                // ====================================================
                // SENDER
                // ====================================================

                const sender =
                    m.key.participant ||
                    m.key.remoteJid;


                const senderNumber =
                    sender
                        ? sender.replace(
                            /[^0-9]/g,
                            ''
                        )
                        : '';


                const isOwner =
                    CREATOR_NUMBERS.includes(
                        senderNumber
                    ) ||
                    m.key.fromMe;


                const isGroup =
                    from.endsWith('@g.us');


                const isChannel =
                    from.endsWith('@newsletter');


                // ====================================================
                // ACTIVITY TRACKER
                // ====================================================

                if (
                    isGroup &&
                    sender
                ) {

                    try {

                        let act =
                            fs.existsSync(
                                'activity.json'
                            )
                                ? JSON.parse(
                                    fs.readFileSync(
                                        'activity.json',
                                        'utf8'
                                    )
                                )
                                : {};


                        if (!act[from]) {
                            act[from] = {};
                        }


                        if (!act[from][sender]) {
                            act[from][sender] = 0;
                        }


                        act[from][sender] += 1;


                        fs.writeFileSync(
                            'activity.json',
                            JSON.stringify(
                                act,
                                null,
                                2
                            )
                        );

                    } catch (actErr) {

                        console.error(
                            '🔥 [ACTIVITY TRACKER ERROR]:',
                            actErr.message
                        );
                    }
                }


                // ====================================================
                // MESSAGE BODY
                // ====================================================

                const body =
                    m.message.conversation ||
                    m.message.extendedTextMessage?.text ||
                    '';


                // ====================================================
                // AUTO REACTION
                // ====================================================

                if (
                    settings.autoReaction === 'on' &&
                    !m.key.fromMe &&
                    (isGroup || isChannel) &&
                    body
                ) {

                    try {

                        const reactionEmoji =
                            getContextEmoji(body);


                        await sock.sendMessage(
                            from,
                            {
                                react: {
                                    text: reactionEmoji,
                                    key: m.key
                                }
                            }
                        );

                    } catch (autoReactErr) {

                        console.error(
                            '🔥 [NORMAL AUTO-REACTION ERROR]:',
                            autoReactErr.message
                        );
                    }
                }


                // ====================================================
                // GROUP SECURITY
                // ====================================================

                if (isGroup) {

                    try {

                        const groupMetadata =
                            await sock.groupMetadata(
                                from
                            );


                        const participants =
                            groupMetadata.participants ||
                            [];


                        const senderParticipant =
                            participants.find(
                                p => p.id === sender
                            );


                        const isAdmin =
                            senderParticipant &&
                            (
                                senderParticipant.admin === 'admin' ||
                                senderParticipant.admin === 'superadmin'
                            );


                        // ------------------------------------------------
                        // LOAD GROUP SETTINGS
                        // ------------------------------------------------

                        let groupSettings =
                            fs.existsSync(
                                'settings.json'
                            )
                                ? JSON.parse(
                                    fs.readFileSync(
                                        'settings.json',
                                        'utf8'
                                    )
                                )
                                : {};


                        // ====================================================
                        // ANTISTICKER
                        // ====================================================

                        const antiStickerEnabled =
                            groupSettings.antisticker?.[from] === 'on';


                        const isSticker =
                            Boolean(
                                m.message.stickerMessage
                            );


                        /*
                         * Only normal members are affected.
                         * Owner and group admins are ignored.
                         */

                        if (
                            antiStickerEnabled &&
                            isSticker &&
                            !isOwner &&
                            !isAdmin
                        ) {

                            try {

                                await sock.sendMessage(
                                    from,
                                    {
                                        delete: m.key
                                    }
                                );


                                console.log(
                                    `🧹 [ANTISTICKER] Deleted sticker from ${senderNumber}`
                                );

                            } catch (deleteErr) {

                                console.error(
                                    '🔥 [ANTISTICKER DELETE ERROR]:',
                                    deleteErr.message
                                );
                            }


                            return;
                        }


                        // ====================================================
                        // NORMAL MEMBER SECURITY
                        // ====================================================

                        if (
                            !isOwner &&
                            !isAdmin
                        ) {

                            // ------------------------------------------------
                            // ANTISPAM
                            // ------------------------------------------------

                            const isAntiSpamOn =
                                groupSettings.antispam?.[from] === 'on';


                            if (isAntiSpamOn) {

                                const now =
                                    Date.now();


                                if (!spamTracker[from]) {
                                    spamTracker[from] = {};
                                }


                                if (
                                    !spamTracker[from][sender]
                                ) {

                                    spamTracker[from][sender] = {
                                        count: 0,
                                        lastTime: now
                                    };
                                }


                                const userSpam =
                                    spamTracker[from][sender];


                                if (
                                    now -
                                    userSpam.lastTime <
                                    3000
                                ) {

                                    userSpam.count += 1;

                                } else {

                                    userSpam.count = 1;
                                }


                                userSpam.lastTime =
                                    now;


                                if (
                                    userSpam.count >= 5
                                ) {

                                    userSpam.count = 0;


                                    try {

                                        await sock.sendMessage(
                                            from,
                                            {
                                                delete: m.key
                                            }
                                        );

                                    } catch (e) {}


                                    if (
                                        !groupSettings.spamWarns
                                    ) {
                                        groupSettings.spamWarns = {};
                                    }


                                    if (
                                        !groupSettings.spamWarns[from]
                                    ) {
                                        groupSettings.spamWarns[from] = {};
                                    }


                                    if (
                                        !groupSettings.spamWarns[from][sender]
                                    ) {

                                        groupSettings.spamWarns[from][sender] = 0;
                                    }


                                    groupSettings.spamWarns[from][sender] += 1;


                                    const spamWarnCount =
                                        groupSettings.spamWarns[from][sender];


                                    fs.writeFileSync(
                                        'settings.json',
                                        JSON.stringify(
                                            groupSettings,
                                            null,
                                            2
                                        )
                                    );


                                    if (
                                        spamWarnCount === 1
                                    ) {

                                        await sock.sendMessage(
                                            from,
                                            {
                                                text:
                                                    `⚠️ *@${senderNumber}*, stop spamming! This is your 1st warning. Next time you will be kicked.`,
                                                mentions: [
                                                    sender
                                                ]
                                            }
                                        );

                                    } else {

                                        groupSettings.spamWarns[from][sender] = 0;


                                        fs.writeFileSync(
                                            'settings.json',
                                            JSON.stringify(
                                                groupSettings,
                                                null,
                                                2
                                            )
                                        );


                                        await sock.sendMessage(
                                            from,
                                            {
                                                text:
                                                    `🚨 *@${senderNumber}* continued spamming after warning and has been kicked!`,
                                                mentions: [
                                                    sender
                                                ]
                                            }
                                        );


                                        try {

                                            await sock.groupParticipantsUpdate(
                                                from,
                                                [sender],
                                                'remove'
                                            );

                                        } catch (e) {}
                                    }


                                    return;
                                }
                            }


                            // ====================================================
                            // BADWORDS
                            // ====================================================

                            const badWordsConfig =
                                groupSettings.badwords?.[from];


                            if (
                                body &&
                                badWordsConfig &&
                                badWordsConfig.status === 'on' &&
                                Array.isArray(
                                    badWordsConfig.list
                                )
                            ) {

                                const lowerBody =
                                    body.toLowerCase();


                                const containsBadWord =
                                    badWordsConfig.list.some(
                                        word =>
                                            lowerBody.includes(
                                                word.toLowerCase()
                                            )
                                    );


                                if (containsBadWord) {

                                    try {

                                        await sock.sendMessage(
                                            from,
                                            {
                                                delete: m.key
                                            }
                                        );

                                    } catch (e) {}


                                    await sock.sendMessage(
                                        from,
                                        {
                                            text:
                                                `⚠️ *@${senderNumber}*, watch your language! Profanity is strictly prohibited in this group.`,
                                            mentions: [
                                                sender
                                            ]
                                        }
                                    );


                                    return;
                                }
                            }


                            // ====================================================
                            // ANTILINK
                            // ====================================================

                            const antiLinkConfig =
                                groupSettings.antilink?.[from];


                            if (
                                antiLinkConfig &&
                                (
                                    antiLinkConfig.warn === 'on' ||
                                    antiLinkConfig.instant === 'on'
                                )
                            ) {

                                const linkRegex =
                                    /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.)+[a-zA-Z]{2,}(\/[^\s]*)?/gi;


                                const messageContent =
                                    body ||
                                    m.message.extendedTextMessage?.text ||
                                    m.message.imageMessage?.caption ||
                                    m.message.videoMessage?.caption ||
                                    '';


                                if (
                                    messageContent &&
                                    linkRegex.test(
                                        messageContent
                                    )
                                ) {

                                    try {

                                        await sock.sendMessage(
                                            from,
                                            {
                                                delete: m.key
                                            }
                                        );

                                    } catch (e) {}


                                    if (
                                        antiLinkConfig.instant === 'on'
                                    ) {

                                        await sock.sendMessage(
                                            from,
                                            {
                                                text:
                                                    `🚨 *@${senderNumber}*, links are strictly prohibited in this group! You have been removed.`,
                                                mentions: [
                                                    sender
                                                ]
                                            }
                                        );


                                        try {

                                            await sock.groupParticipantsUpdate(
                                                from,
                                                [sender],
                                                'remove'
                                            );

                                        } catch (e) {}


                                        return;
                                    }


                                    if (
                                        antiLinkConfig.warn === 'on'
                                    ) {

                                        if (
                                            !groupSettings.linkWarns
                                        ) {
                                            groupSettings.linkWarns = {};
                                        }


                                        if (
                                            !groupSettings.linkWarns[from]
                                        ) {
                                            groupSettings.linkWarns[from] = {};
                                        }


                                        if (
                                            !groupSettings.linkWarns[from][sender]
                                        ) {
                                            groupSettings.linkWarns[from][sender] = 0;
                                        }


                                        groupSettings.linkWarns[from][sender] += 1;


                                        const warnCount =
                                            groupSettings.linkWarns[from][sender];


                                        fs.writeFileSync(
                                            'settings.json',
                                            JSON.stringify(
                                                groupSettings,
                                                null,
                                                2
                                            )
                                        );


                                        if (
                                            warnCount < 3
                                        ) {

                                            await sock.sendMessage(
                                                from,
                                                {
                                                    text:
                                                        `⚠️ *@${senderNumber}*, links are not allowed here! Warning *(${warnCount}/3)*.`,
                                                    mentions: [
                                                        sender
                                                    ]
                                                }
                                            );

                                        } else {

                                            groupSettings.linkWarns[from][sender] = 0;


                                            fs.writeFileSync(
                                                'settings.json',
                                                JSON.stringify(
                                                    groupSettings,
                                                    null,
                                                    2
                                                )
                                            );


                                            await sock.sendMessage(
                                                from,
                                                {
                                                    text:
                                                        `🚨 *@${senderNumber}* reached 3 link warnings and has been kicked from the group!`,
                                                    mentions: [
                                                        sender
                                                    ]
                                                }
                                            );


                                            try {

                                                await sock.groupParticipantsUpdate(
                                                    from,
                                                    [sender],
                                                    'remove'
                                                );

                                            } catch (e) {}
                                        }


                                        return;
                                    }
                                }
                            }
                        }

                    } catch (groupSecErr) {

                        console.error(
                            '🔥 [GROUP SECURITY ERROR]:',
                            groupSecErr
                        );
                    }
                }


                // ====================================================
                // EMPTY MESSAGE CHECK
                // ====================================================

                /*
                 * This comes AFTER AntiSticker so stickers can be
                 * detected even though they don't contain text.
                 */

                if (!body) {
                    return;
                }


                // ====================================================
                // GAME HANDLER
                // ====================================================

                const isGameHandled =
                    await handleGameMessage(
                        sock,
                        m,
                        from,
                        body
                    );


                if (isGameHandled) {
                    return;
                }


                // ====================================================
                // PREFIX SYSTEM
                // ====================================================

                const currentPrefix =
                    getPrefix();


                const supportedPrefixes =
                    getAllowedPrefixes();


                const messagePrefix =
                    supportedPrefixes.find(
                        prefix =>
                            body.startsWith(prefix)
                    );


                if (!messagePrefix) {
                    return;
                }


                const commandText =
                    body
                        .slice(messagePrefix.length)
                        .trim();


                if (!commandText) {
                    return;
                }


                const commandParts =
                    commandText.split(/\s+/);


                const commandName =
                    commandParts
                        .shift()
                        .toLowerCase();


                // ====================================================
                // PREFIX COMMAND EXCEPTION
                // ====================================================

                /*
                 * Normally commands must use the current prefix.
                 *
                 * The "prefix" command can use any supported prefix
                 * so the creator can recover/change the prefix.
                 */

                if (
                    messagePrefix !== currentPrefix &&
                    commandName !== 'prefix'
                ) {
                    return;
                }


                // ====================================================
                // BOT MODE
                // ====================================================

                const currentMode =
                    getMode();


                if (
                    currentMode === 'private' &&
                    !isOwner
                ) {
                    return;
                }


                const args =
                    commandParts;


                const command =
                    sock.commands.get(
                        commandName
                    );


                // ====================================================
                // EXECUTE COMMAND
                // ====================================================

                if (command) {

                    try {

                        await command.execute(
                            sock,
                            m,
                            from,
                            args,
                            isOwner
                        );

                    } catch (cmdExecErr) {

                        console.error(
                            `🔥 [COMMAND EXECUTION CRASH] [${messagePrefix}${commandName}]:`,
                            cmdExecErr
                        );


                        await sock.sendMessage(
                            from,
                            {
                                text:
                                    `❌ An error occurred while executing command *${messagePrefix}${commandName}*.\n_Details:_ ${cmdExecErr.message}`
                            }
                        ).catch(() => {});
                    }
                }

            } catch (upsertErr) {

                console.error(
                    '🔥 [CRITICAL MESSAGES UPSERT ERROR]:',
                    upsertErr
                );
            }
        }
    );
}


// ============================================================
// START BOT
// ============================================================

startExpressServer();

startQueenVida();
