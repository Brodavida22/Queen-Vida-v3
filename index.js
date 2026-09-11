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
const { handleGameMessage } = require('./utils/gameManager');

// ============================================================
// EXPRESS HEALTH SERVER
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
// HARD-CODED CREATOR SIGNATURE & SECURITY
// DO NOT REMOVE OR TAMPER
// ============================================================

const CREATOR_NAME = "QUEEN VIDA";
const DISPLAY_CREATOR_NUMBER = "2348138558590";
const CREATOR_NUMBERS = ["2348138558590"];

const CHANNEL_TEXT_LINK =
    '\n\n📢 *Join QUEEN VIDA Channel:*\nhttps://whatsapp.com/channel/0029Vb8hHHs30LKXQEb4xe38';

function verifyCreatorIntegrity() {
    if (
        !CREATOR_NUMBERS.includes("2348138558590") ||
        CREATOR_NAME !== "QUEEN VIDA"
    ) {
        console.error(
            "❌ CRITICAL ERROR: Creator identity signature has been altered or tampered with!"
        );
        process.exit(1);
    }
}

verifyCreatorIntegrity();

// ============================================================
// GLOBAL ERROR HANDLERS
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
// GLOBAL VARIABLES
// ============================================================

const spamTracker = {};

// ============================================================
// GLOBAL SETTINGS
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
                e
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
        /(lol|lmao|funny|haha|😂|🤣|giggle|joke|comedy)/i.test(
            lower
        )
    ) {
        return '😂';
    }

    if (
        /(congrats|congratulations|welldone|bravo|party|🎉|🎈|win|victory|success)/i.test(
            lower
        )
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
        /(money|cash|rich|wealth|naira|dollar|lagos)/i.test(
            lower
        )
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
// WELCOME / GOODBYE SETTINGS
// Uses existing welcome.json
// ============================================================

function getWelcomeSettings() {
    const settingsPath = path.join(
        __dirname,
        'welcome.json'
    );

    if (!fs.existsSync(settingsPath)) {
        return {};
    }

    try {
        const data = JSON.parse(
            fs.readFileSync(settingsPath, 'utf8')
        );

        return data && typeof data === 'object'
            ? data
            : {};
    } catch (error) {
        console.error(
            '🔥 [WELCOME SETTINGS ERROR] Failed to read welcome.json:',
            error
        );

        return {};
    }
}

// ============================================================
// NORMALIZE PARTICIPANT
// ============================================================

function normalizeParticipant(participant) {
    if (!participant) return null;

    if (typeof participant === 'string') {
        return participant;
    }

    if (participant.id) {
        return participant.id;
    }

    if (participant.jid) {
        return participant.jid;
    }

    return null;
}

// ============================================================
// GET DISPLAY NAME
// ============================================================

async function getParticipantDisplayName(
    sock,
    participant,
    metadata
) {
    const jid = normalizeParticipant(participant);

    if (!jid) {
        return 'User';
    }

    const number = jid
        .split('@')[0]
        .replace(/[^0-9]/g, '');

    // Try group participant name first
    try {
        const found = metadata?.participants?.find(
            (p) => p.id === jid
        );

        if (found) {
            if (found.name) return found.name;
            if (found.notify) return found.notify;
            if (found.pushName) return found.pushName;
        }
    } catch (error) {}

    // Try contact/business profile
    try {
        if (typeof sock.getBusinessProfile === 'function') {
            const profile =
                await sock.getBusinessProfile(jid);

            if (profile?.name) {
                return profile.name;
            }
        }
    } catch (error) {}

    return number || 'User';
}

// ============================================================
// PROCESS WELCOME MESSAGE
// ============================================================

function buildWelcomeMessage(
    customMessage,
    displayName,
    jid,
    groupName,
    memberCount
) {
    const mention = `@${jid.split('@')[0]}`;

    let message =
        customMessage ||
        `╭━━━〔 👋 WELCOME 〕━━━╮
┃ 🎉 Welcome ${mention}!
┃ 👑 You are now part of *${groupName}*
┃ 👥 Members: ${memberCount}
╰━━━━━━━━━━━━━━━━━━╯

Enjoy yourself and have fun! ❤️`;

    message = message
        .replace(/\{user\}/gi, mention)
        .replace(/@user/gi, mention)
        .replace(/\{group\}/gi, groupName)
        .replace(/\{count\}/gi, String(memberCount));

    return message;
}

// ============================================================
// PROCESS GOODBYE MESSAGE
// ============================================================

function buildGoodbyeMessage(
    customMessage,
    displayName,
    jid,
    groupName,
    memberCount
) {
    const mention = `@${jid.split('@')[0]}`;

    let message =
        customMessage ||
        `╭━━━〔 👋 GOODBYE 〕━━━╮
┃ 😢 ${mention} has left the group.
┃ 👥 Members left: ${memberCount}
╰━━━━━━━━━━━━━━━━━━╯

We wish you all the best! 👋`;

    message = message
        .replace(/\{user\}/gi, mention)
        .replace(/@user/gi, mention)
        .replace(/\{group\}/gi, groupName)
        .replace(/\{count\}/gi, String(memberCount));

    return message;
}

// ============================================================
// AUTOMATIC WELCOME
// ============================================================

async function handleWelcomeEvent(
    sock,
    groupJid,
    participants
) {
    try {
        if (!groupJid || !groupJid.endsWith('@g.us')) {
            return;
        }

        const allSettings = getWelcomeSettings();
        const groupSettings = allSettings[groupJid];

        if (!groupSettings) {
            return;
        }

        if (groupSettings.welcome !== true) {
            return;
        }

        let metadata;

        try {
            metadata = await sock.groupMetadata(groupJid);
        } catch (metadataError) {
            console.error(
                '🔥 [WELCOME] Failed to fetch group metadata:',
                metadataError
            );
            return;
        }

        const groupName =
            metadata?.subject || 'this group';

        const memberCount =
            metadata?.participants?.length || 0;

        const participantList = Array.isArray(participants)
            ? participants
            : [participants];

        for (const participant of participantList) {
            const jid = normalizeParticipant(participant);

            if (!jid) continue;

            try {
                const displayName =
                    await getParticipantDisplayName(
                        sock,
                        jid,
                        metadata
                    );

                const finalMessage =
                    buildWelcomeMessage(
                        groupSettings.welcomeMessage,
                        displayName,
                        jid,
                        groupName,
                        memberCount
                    );

                await sock.sendMessage(groupJid, {
                    text: finalMessage,
                    mentions: [jid]
                });

                console.log(
                    `👋 [WELCOME] Sent welcome message for ${jid} in ${groupName}`
                );
            } catch (participantError) {
                console.error(
                    `🔥 [WELCOME] Failed for participant ${jid}:`,
                    participantError
                );
            }
        }
    } catch (error) {
        console.error(
            '🔥 [WELCOME EVENT ERROR]:',
            error
        );
    }
}

// ============================================================
// AUTOMATIC GOODBYE
// ============================================================

async function handleGoodbyeEvent(
    sock,
    groupJid,
    participants
) {
    try {
        if (!groupJid || !groupJid.endsWith('@g.us')) {
            return;
        }

        const allSettings = getWelcomeSettings();
        const groupSettings = allSettings[groupJid];

        if (!groupSettings) {
            return;
        }

        if (groupSettings.goodbye !== true) {
            return;
        }

        let metadata;

        try {
            metadata = await sock.groupMetadata(groupJid);
        } catch (metadataError) {
            console.error(
                '🔥 [GOODBYE] Failed to fetch group metadata:',
                metadataError
            );
            return;
        }

        const groupName =
            metadata?.subject || 'this group';

        const memberCount =
            metadata?.participants?.length || 0;

        const participantList = Array.isArray(participants)
            ? participants
            : [participants];

        for (const participant of participantList) {
            const jid = normalizeParticipant(participant);

            if (!jid) continue;

            try {
                const displayName =
                    await getParticipantDisplayName(
                        sock,
                        jid,
                        metadata
                    );

                const finalMessage =
                    buildGoodbyeMessage(
                        groupSettings.goodbyeMessage,
                        displayName,
                        jid,
                        groupName,
                        memberCount
                    );

                await sock.sendMessage(groupJid, {
                    text: finalMessage,
                    mentions: [jid]
                });

                console.log(
                    `👋 [GOODBYE] Sent goodbye message for ${jid} in ${groupName}`
                );
            } catch (participantError) {
                console.error(
                    `🔥 [GOODBYE] Failed for participant ${jid}:`,
                    participantError
                );
            }
        }
    } catch (error) {
        console.error(
            '🔥 [GOODBYE EVENT ERROR]:',
            error
        );
    }
}

// ============================================================
// START QUEEN VIDA
// ============================================================

async function startQueenVida() {
    verifyCreatorIntegrity();

    console.log(
        '🔄 Initializing Queen Vida-V3 Socket Connection...'
    );

    // --------------------------------------------------------
    // AUTH
    // --------------------------------------------------------

    const authPath = path.join(
        __dirname,
        'auth_info'
    );

    const credsPath = path.join(
        authPath,
        'creds.json'
    );

    if (
        fs.existsSync(authPath) &&
        fs.existsSync(credsPath)
    ) {
        try {
            const creds = JSON.parse(
                fs.readFileSync(
                    credsPath,
                    'utf8'
                )
            );

            if (!creds.registered) {
                console.log(
                    '⚠️ Detected an incomplete pairing session. Cleaning up auth_info...'
                );

                fs.rmSync(authPath, {
                    recursive: true,
                    force: true
                });
            }
        } catch (error) {
            console.error(
                '🔥 [AUTH ERROR] Failed reading creds.json:',
                error
            );

            fs.rmSync(authPath, {
                recursive: true,
                force: true
            });
        }
    }

    const {
        state,
        saveCreds
    } = await useMultiFileAuthState(
        'auth_info'
    );

    // --------------------------------------------------------
    // WHATSAPP SOCKET
    // --------------------------------------------------------

    const sock = makeWASocket({
        logger: pino({
            level: 'silent'
        }),

        auth: state,

        printQRInTerminal: false,

        browser: Browsers.macOS('Desktop'),

        syncFullHistory: false,

        markOnlineOnConnect: true
    });

    // --------------------------------------------------------
    // COMMAND LOADER
    // --------------------------------------------------------

    sock.commands = new Map();

    const commandPath = path.join(
        __dirname,
        'commands'
    );

    if (fs.existsSync(commandPath)) {
        try {
            const commandFiles =
                fs.readdirSync(commandPath)
                    .filter(
                        (file) =>
                            file.endsWith('.js')
                    );

            for (const file of commandFiles) {
                try {
                    const filePath =
                        path.join(
                            commandPath,
                            file
                        );

                    delete require.cache[
                        require.resolve(filePath)
                    ];

                    const required =
                        require(filePath);

                    // New command format:
                    // module.exports = {
                    //   name: 'example',
                    //   execute: async (...) => {}
                    // }

                    if (
                        Array.isArray(
                            required
                        )
                    ) {
                        for (
                            const cmd
                            of required
                        ) {
                            if (
                                cmd &&
                                cmd.name &&
                                typeof cmd.execute ===
                                    'function'
                            ) {
                                sock.commands.set(
                                    cmd.name.toLowerCase(),
                                    cmd
                                );
                            }
                        }
                    } else if (
                        required &&
                        required.name &&
                        typeof required.execute ===
                            'function'
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

    // --------------------------------------------------------
    // PAIRING CODE
    // --------------------------------------------------------

    if (!sock.authState.creds.registered) {
        const phoneNumber =
            process.env.PHONE_NUMBER ||
            DISPLAY_CREATOR_NUMBER;

        if (!phoneNumber) {
            console.log(
                "❌ [ERROR]: PHONE_NUMBER environment variable is not set!"
            );

            console.log(
                "👉 Please add 'PHONE_NUMBER' with your full WhatsApp number in your panel's Environment/Startup variables tab."
            );

            return;
        }

        console.log(
            `⏳ Automatically requesting pairing code for ${phoneNumber}...`
        );

        setTimeout(
            async () => {
                try {
                    const cleanNumber =
                        phoneNumber
                            .trim()
                            .replace(
                                /[^0-9]/g,
                                ''
                            );

                    const code =
                        await sock.requestPairingCode(
                            cleanNumber
                        );

                    console.log(
                        `✨ ======================================== ✨`
                    );

                    console.log(
                        `✨ YOUR WHATSAPP PAIRING CODE: ${code} ✨`
                    );

                    console.log(
                        `✨ ======================================== ✨`
                    );
                } catch (pairErr) {
                    console.error(
                        '🔥 [PAIRING ERROR] Failed to generate pairing code:',
                        pairErr
                    );
                }
            },
            3000
        );
    }

    // --------------------------------------------------------
    // CONNECTION
    // --------------------------------------------------------

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

            if (connection === 'open') {
                console.log(
                    `--- QUEEN VIDA-V3 CONNECTED [Creator: ${CREATOR_NAME}] ---`
                );

                if (!isStartupBannerSent) {
                    isStartupBannerSent = true;

                    try {
                        const botJid =
                            sock.user.id
                                .split(':')[0] +
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
> _👑 *QUEEN VIDA-V3* 👑 successfully launched_${CHANNEL_TEXT_LINK}`;

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
                                    image:
                                        imageBuffer,
                                    caption:
                                        activeBanner
                                }
                            );
                        } else {
                            await sock.sendMessage(
                                botJid,
                                {
                                    text:
                                        activeBanner
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
                        () =>
                            startQueenVida(),
                        3000
                    );
                }
            }
        }
    );

    // --------------------------------------------------------
    // SAVE AUTH CREDENTIALS
    // --------------------------------------------------------

    sock.ev.on(
        'creds.update',
        saveCreds
    );

    // ========================================================
    // GROUP PARTICIPANT EVENTS
    // ========================================================

    sock.ev.on(
        'group-participants.update',
        async (update) => {
            try {
                const {
                    id,
                    participants,
                    action
                } = update;

                if (
                    !id ||
                    !id.endsWith('@g.us')
                ) {
                    return;
                }

                if (
                    !Array.isArray(
                        participants
                    ) ||
                    participants.length === 0
                ) {
                    return;
                }

                console.log(
                    `👥 [GROUP EVENT] ${action} in ${id}:`,
                    participants
                );

                // -------------------------------
                // NEW MEMBERS
                // -------------------------------

                if (action === 'add') {
                    await handleWelcomeEvent(
                        sock,
                        id,
                        participants
                    );
                }

                // -------------------------------
                // MEMBERS LEAVING
                // -------------------------------

                if (
                    action === 'remove'
                ) {
                    await handleGoodbyeEvent(
                        sock,
                        id,
                        participants
                    );
                }
            } catch (groupEventError) {
                console.error(
                    '🔥 [GROUP PARTICIPANT EVENT ERROR]:',
                    groupEventError
                );
            }
        }
    );

    // ========================================================
    // MESSAGE HANDLER
    // ========================================================

    sock.ev.on(
        'messages.upsert',
        async ({ messages }) => {
            try {
                if (
                    !Array.isArray(
                        messages
                    ) ||
                    messages.length === 0
                ) {
                    return;
                }

                // Process all messages instead of only messages[0]
                for (const m of messages) {
                    try {
                        if (!m || !m.message) {
                            continue;
                        }

                        const from =
                            m.key.remoteJid;

                        if (!from) {
                            continue;
                        }

                        const settings =
                            getGlobalSettings();

                        // =================================================
                        // STATUS HANDLER
                        // =================================================

                        if (
                            from ===
                            'status@broadcast'
                        ) {
                            if (
                                settings.autoViewStatus ===
                                'on'
                            ) {
                                (async () => {
                                    try {
                                        if (
                                            m.key &&
                                            m.key.remoteJid
                                        ) {
                                            await sock.readMessages(
                                                [m.key]
                                            );
                                        }

                                        if (
                                            settings.statusReaction ===
                                                'on' &&
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
                                                m.message
                                                    .conversation ||
                                                m.message
                                                    .extendedTextMessage
                                                    ?.text ||
                                                m.message
                                                    .imageMessage
                                                    ?.caption ||
                                                m.message
                                                    .videoMessage
                                                    ?.caption ||
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
                                                        statusJidList:
                                                            [
                                                                targetParticipant
                                                            ],
                                                        broadcast:
                                                            true
                                                    }
                                                );
                                            } catch (
                                                statusReactErr
                                            ) {
                                                // Keep silent
                                            }
                                        }
                                    } catch (
                                        statusHandlerErr
                                    ) {
                                        // Keep silent
                                    }
                                })();
                            }

                            continue;
                        }

                        // =================================================
                        // SENDER
                        // =================================================

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

                        // =================================================
                        // CHAT TYPE
                        // =================================================

                        const isGroup =
                            from.endsWith(
                                '@g.us'
                            );

                        const isChannel =
                            from.endsWith(
                                '@newsletter'
                            );

                        // =================================================
                        // ACTIVITY TRACKER
                        // =================================================

                        if (
                            isGroup &&
                            sender
                        ) {
                            try {
                                const activityPath =
                                    path.join(
                                        __dirname,
                                        'activity.json'
                                    );

                                let act = {};

                                if (
                                    fs.existsSync(
                                        activityPath
                                    )
                                ) {
                                    try {
                                        act =
                                            JSON.parse(
                                                fs.readFileSync(
                                                    activityPath,
                                                    'utf8'
                                                )
                                            );
                                    } catch {
                                        act = {};
                                    }
                                }

                                if (
                                    !act[from]
                                ) {
                                    act[from] =
                                        {};
                                }

                                if (
                                    !act[from][
                                        sender
                                    ]
                                ) {
                                    act[from][
                                        sender
                                    ] = 0;
                                }

                                act[from][
                                    sender
                                ] += 1;

                                fs.writeFileSync(
                                    activityPath,
                                    JSON.stringify(
                                        act
                                    )
                                );
                            } catch (
                                actErr
                            ) {
                                console.error(
                                    '🔥 [ACTIVITY TRACKER ERROR]:',
                                    actErr
                                );
                            }
                        }

                        // =================================================
                        // MESSAGE BODY
                        // =================================================

                        const body =
                            m.message
                                .conversation ||
                            m.message
                                .extendedTextMessage
                                ?.text ||
                            m.message
                                .imageMessage
                                ?.caption ||
                            m.message
                                .videoMessage
                                ?.caption ||
                            '';

                        // =================================================
                        // NORMAL AUTO REACTION
                        // =================================================

                        if (
                            settings.autoReaction ===
                                'on' &&
                            !m.key.fromMe &&
                            (isGroup ||
                                isChannel)
                        ) {
                            try {
                                const reactionEmoji =
                                    getContextEmoji(
                                        body
                                    );

                                await sock.sendMessage(
                                    from,
                                    {
                                        react: {
                                            text:
                                                reactionEmoji,
                                            key:
                                                m.key
                                        }
                                    }
                                );
                            } catch (
                                autoReactErr
                            ) {
                                console.error(
                                    '🔥 [NORMAL AUTO-REACTION ERROR]:',
                                    autoReactErr.message
                                );
                            }
                        }

                        // =================================================
                        // IGNORE NON-TEXT MESSAGES
                        // =================================================

                        if (!body) {
                            continue;
                        }

                        // =================================================
                        // GROUP SECURITY
                        // =================================================

                        if (
                            isGroup &&
                            !isOwner
                        ) {
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
                                        (p) =>
                                            p.id ===
                                            sender
                                    );

                                const isAdmin =
                                    senderParticipant &&
                                    (
                                        senderParticipant.admin ===
                                            'admin' ||
                                        senderParticipant.admin ===
                                            'superadmin'
                                    );

                                if (
                                    !isAdmin
                                ) {
                                    const settingsPath =
                                        path.join(
                                            __dirname,
                                            'settings.json'
                                        );

                                    let groupSettings =
                                        {};

                                    if (
                                        fs.existsSync(
                                            settingsPath
                                        )
                                    ) {
                                        try {
                                            groupSettings =
                                                JSON.parse(
                                                    fs.readFileSync(
                                                        settingsPath,
                                                        'utf8'
                                                    )
                                                );
                                        } catch {
                                            groupSettings =
                                                {};
                                        }
                                    }

                                    // -----------------------------------------
                                    // ANTI SPAM
                                    // -----------------------------------------

                                    const isAntiSpamOn =
                                        groupSettings
                                            .antispam
                                            ?.[
                                                from
                                            ] ===
                                        'on';

                                    if (
                                        isAntiSpamOn
                                    ) {
                                        const now =
                                            Date.now();

                                        if (
                                            !spamTracker[
                                                from
                                            ]
                                        ) {
                                            spamTracker[
                                                from
                                            ] = {};
                                        }

                                        if (
                                            !spamTracker[
                                                from
                                            ][
                                                sender
                                            ]
                                        ) {
                                            spamTracker[
                                                from
                                            ][
                                                sender
                                            ] = {
                                                count: 0,
                                                lastTime:
                                                    now
                                            };
                                        }

                                        const userSpam =
                                            spamTracker[
                                                from
                                            ][
                                                sender
                                            ];

                                        if (
                                            now -
                                                userSpam.lastTime <
                                            3000
                                        ) {
                                            userSpam.count +=
                                                1;
                                        } else {
                                            userSpam.count =
                                                1;
                                        }

                                        userSpam.lastTime =
                                            now;

                                        if (
                                            userSpam.count >=
                                            5
                                        ) {
                                            userSpam.count =
                                                0;

                                            try {
                                                await sock.sendMessage(
                                                    from,
                                                    {
                                                        delete:
                                                            m.key
                                                    }
                                                );
                                            } catch (
                                                deleteError
                                            ) {}

                                            if (
                                                !groupSettings.spamWarns
                                            ) {
                                                groupSettings.spamWarns =
                                                    {};
                                            }

                                            if (
                                                !groupSettings
                                                    .spamWarns[
                                                    from
                                                ]
                                            ) {
                                                groupSettings.spamWarns[
                                                    from
                                                ] = {};
                                            }

                                            if (
                                                !groupSettings
                                                    .spamWarns[
                                                    from
                                                ][
                                                    sender
                                                ]
                                            ) {
                                                groupSettings.spamWarns[
                                                    from
                                                ][
                                                    sender
                                                ] = 0;
                                            }

                                            groupSettings.spamWarns[
                                                from
                                            ][
                                                sender
                                            ] += 1;

                                            const spamWarnCount =
                                                groupSettings
                                                    .spamWarns[
                                                    from
                                                ][
                                                    sender
                                                ];

                                            fs.writeFileSync(
                                                settingsPath,
                                                JSON.stringify(
                                                    groupSettings,
                                                    null,
                                                    2
                                                )
                                            );

                                            if (
                                                spamWarnCount ===
                                                1
                                            ) {
                                                await sock.sendMessage(
                                                    from,
                                                    {
                                                        text:
                                                            `⚠️ *@${senderNumber}*, stop spamming! This is your 1st warning. Next time you will be kicked.`,
                                                        mentions:
                                                            [
                                                                sender
                                                            ]
                                                    }
                                                );
                                            } else {
                                                groupSettings.spamWarns[
                                                    from
                                                ][
                                                    sender
                                                ] = 0;

                                                fs.writeFileSync(
                                                    settingsPath,
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
                                                        mentions:
                                                            [
                                                                sender
                                                            ]
                                                    }
                                                );

                                                try {
                                                    await sock.groupParticipantsUpdate(
                                                        from,
                                                        [
                                                            sender
                                                        ],
                                                        'remove'
                                                    );
                                                } catch (
                                                    kickError
                                                ) {}
                                            }

                                            continue;
                                        }
                                    }

                                    // -----------------------------------------
                                    // BAD WORDS
                                    // -----------------------------------------

                                    const badWordsConfig =
                                        groupSettings
                                            .badwords
                                            ?.[
                                                from
                                            ];

                                    if (
                                        badWordsConfig &&
                                        badWordsConfig.status ===
                                            'on' &&
                                        Array.isArray(
                                            badWordsConfig.list
                                        )
                                    ) {
                                        const lowerBody =
                                            body.toLowerCase();

                                        const containsBadWord =
                                            badWordsConfig.list.some(
                                                (word) =>
                                                    lowerBody.includes(
                                                        word.toLowerCase()
                                                    )
                                            );

                                        if (
                                            containsBadWord
                                        ) {
                                            try {
                                                await sock.sendMessage(
                                                    from,
                                                    {
                                                        delete:
                                                            m.key
                                                    }
                                                );
                                            } catch (
                                                deleteError
                                            ) {}

                                            await sock.sendMessage(
                                                from,
                                                {
                                                    text:
                                                        `⚠️ *@${senderNumber}*, watch your language! Profanity is strictly prohibited in this group.`,
                                                    mentions:
                                                        [
                                                            sender
                                                        ]
                                                }
                                            );

                                            continue;
                                        }
                                    }

                                    // -----------------------------------------
                                    // ANTI LINK
                                    // -----------------------------------------

                                    const antiLinkConfig =
                                        groupSettings
                                            .antilink
                                            ?.[
                                                from
                                            ];

                                    if (
                                        antiLinkConfig &&
                                        (
                                            antiLinkConfig.warn ===
                                                'on' ||
                                            antiLinkConfig.instant ===
                                                'on'
                                        )
                                    ) {
                                        const linkRegex =
                                            /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.)+[a-zA-Z]{2,}(\/[^\s]*)?/gi;

                                        const messageContent =
                                            body ||
                                            m.message
                                                .extendedTextMessage
                                                ?.text ||
                                            m.message
                                                .imageMessage
                                                ?.caption ||
                                            m.message
                                                .videoMessage
                                                ?.caption ||
                                            '';

                                        if (
                                            linkRegex.test(
                                                messageContent
                                            )
                                        ) {
                                            try {
                                                await sock.sendMessage(
                                                    from,
                                                    {
                                                        delete:
                                                            m.key
                                                    }
                                                );
                                            } catch (
                                                deleteError
                                            ) {}

                                            if (
                                                antiLinkConfig.instant ===
                                                'on'
                                            ) {
                                                await sock.sendMessage(
                                                    from,
                                                    {
                                                        text:
                                                            `🚨 *@${senderNumber}*, links are strictly prohibited in this group! You have been removed.`,
                                                        mentions:
                                                            [
                                                                sender
                                                            ]
                                                    }
                                                );

                                                try {
                                                    await sock.groupParticipantsUpdate(
                                                        from,
                                                        [
                                                            sender
                                                        ],
                                                        'remove'
                                                    );
                                                } catch (
                                                    kickError
                                                ) {}

                                                continue;
                                            }

                                            if (
                                                antiLinkConfig.warn ===
                                                'on'
                                            ) {
                                                if (
                                                    !groupSettings.linkWarns
                                                ) {
                                                    groupSettings.linkWarns =
                                                        {};
                                                }

                                                if (
                                                    !groupSettings
                                                        .linkWarns[
                                                        from
                                                    ]
                                                ) {
                                                    groupSettings.linkWarns[
                                                        from
                                                    ] = {};
                                                }

                                                if (
                                                    !groupSettings
                                                        .linkWarns[
                                                        from
                                                    ][
                                                        sender
                                                    ]
                                                ) {
                                                    groupSettings.linkWarns[
                                                        from
                                                    ][
                                                        sender
                                                    ] = 0;
                                                }

                                                groupSettings.linkWarns[
                                                    from
                                                ][
                                                    sender
                                                ] += 1;

                                                const warnCount =
                                                    groupSettings
                                                        .linkWarns[
                                                        from
                                                    ][
                                                        sender
                                                    ];

                                                fs.writeFileSync(
                                                    settingsPath,
                                                    JSON.stringify(
                                                        groupSettings,
                                                        null,
                                                        2
                                                    )
                                                );

                                                if (
                                                    warnCount <
                                                    3
                                                ) {
                                                    await sock.sendMessage(
                                                        from,
                                                        {
                                                            text:
                                                                `⚠️ *@${senderNumber}*, links are not allowed here! Warning *(${warnCount}/3)*.`,
                                                            mentions:
                                                                [
                                                                    sender
                                                                ]
                                                        }
                                                    );
                                                } else {
                                                    groupSettings.linkWarns[
                                                        from
                                                    ][
                                                        sender
                                                    ] = 0;

                                                    fs.writeFileSync(
                                                        settingsPath,
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
                                                            mentions:
                                                                [
                                                                    sender
                                                                ]
                                                        }
                                                    );

                                                    try {
                                                        await sock.groupParticipantsUpdate(
                                                            from,
                                                            [
                                                                sender
                                                            ],
                                                            'remove'
                                                        );
                                                    } catch (
                                                        kickError
                                                    ) {}
                                                }

                                                continue;
                                            }
                                        }
                                    }
                                }
                            } catch (
                                groupSecErr
                            ) {
                                console.error(
                                    '🔥 [GROUP SECURITY ERROR]:',
                                    groupSecErr
                                );
                            }
                        }

                        // =================================================
                        // GAME HANDLER
                        // =================================================

                        try {
                            const isGameHandled =
                                await handleGameMessage(
                                    sock,
                                    m,
                                    from,
                                    body
                                );

                            if (
                                isGameHandled
                            ) {
                                continue;
                            }
                        } catch (
                            gameError
                        ) {
                            console.error(
                                '🔥 [GAME HANDLER ERROR]:',
                                gameError
                            );
                        }

                        // =================================================
                        // COMMAND PREFIX
                        // =================================================

                        if (
                            !body.startsWith('!')
                        ) {
                            continue;
                        }

                        const currentMode =
                            getMode();

                        if (
                            currentMode ===
                                'private' &&
                            !isOwner
                        ) {
                            continue;
                        }

                        const args =
                            body
                                .slice(1)
                                .trim()
                                .split(/ +/);

                        const commandName =
                            args
                                .shift()
                                ?.toLowerCase();

                        if (
                            !commandName
                        ) {
                            continue;
                        }

                        const command =
                            sock.commands.get(
                                commandName
                            );

                        if (
                            command &&
                            typeof command.execute ===
                                'function'
                        ) {
                            try {
                                await command.execute(
                                    sock,
                                    m,
                                    m.key.remoteJid,
                                    args,
                                    isOwner
                                );
                            } catch (
                                cmdExecErr
                            ) {
                                console.error(
                                    `🔥 [COMMAND EXECUTION CRASH] [!${commandName}]:`,
                                    cmdExecErr
                                );

                                try {
                                    await sock.sendMessage(
                                        from,
                                        {
                                            text:
                                                `❌ An error occurred while executing command *!${commandName}*.\n_Details:_ ${cmdExecErr.message}`
                                        }
                                    );
                                } catch (
                                    sendError
                                ) {}
                            }
                        }
                    } catch (
                        singleMessageError
                    ) {
                        console.error(
                            '🔥 [SINGLE MESSAGE ERROR]:',
                            singleMessageError
                        );
                    }
                }
            } catch (
                upsertErr
            ) {
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
