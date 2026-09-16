const fs = require('fs');
const path = require('path');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const pino = require('pino');

const { createMessageHandler } = require('./messageHandler');
const { CREATOR_NAME } = require('./config');

const SESSIONS_FILE = path.join(__dirname, '..', 'sessions.json');
const AUTH_ROOT = path.join(__dirname, '..', 'auth_info');

// sessionId -> { sock, ownerNumber, isMain }
const activeSessions = new Map();

function loadSessionRegistry() {
    if (!fs.existsSync(SESSIONS_FILE)) return {};

    try {
        return JSON.parse(
            fs.readFileSync(SESSIONS_FILE, 'utf8')
        );
    } catch (e) {
        return {};
    }
}

function saveSessionRegistry(registry) {
    try {
        fs.writeFileSync(
            SESSIONS_FILE,
            JSON.stringify(registry, null, 2)
        );
    } catch (e) {
        console.error(
            '🔥 [SESSION REGISTRY] Failed to save:',
            e
        );
    }
}

function registerSession(sessionId, ownerNumber) {
    const registry = loadSessionRegistry();

    registry[sessionId] = {
        ownerNumber,
        addedAt: Date.now()
    };

    saveSessionRegistry(registry);
}

function removeSessionFromRegistry(sessionId) {
    const registry = loadSessionRegistry();

    delete registry[sessionId];

    saveSessionRegistry(registry);
}

function sessionExists(sessionId) {
    if (activeSessions.has(sessionId)) {
        return true;
    }

    const registry = loadSessionRegistry();

    return !!registry[sessionId];
}

/**
 * Starts (or returns an already-running) session.
 *
 * @param {object} params
 * @param {string} params.sessionId
 * @param {string} params.ownerNumber
 * @param {boolean} [params.isMain]
 * @param {Map} params.commandsMap
 * @param {function} [params.onPairingCode]
 * @param {function} [params.onConnected]
 */
async function startSession({
    sessionId,
    ownerNumber,
    isMain = false,
    commandsMap,
    onPairingCode = null,
    onConnected = null
}) {
    if (activeSessions.has(sessionId)) {
        return activeSessions.get(sessionId).sock;
    }

    // Main session keeps using the original auth_info folder.
    const authPath = isMain
        ? AUTH_ROOT
        : path.join(AUTH_ROOT, sessionId);

    const credsPath = path.join(
        authPath,
        'creds.json'
    );

    // Clean incomplete pairing sessions.
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
                fs.rmSync(authPath, {
                    recursive: true,
                    force: true
                });
            }
        } catch (e) {
            fs.rmSync(authPath, {
                recursive: true,
                force: true
            });
        }
    }

    const {
        state,
        saveCreds
    } = await useMultiFileAuthState(authPath);

    const sock = makeWASocket({
        logger: pino({
            level: 'silent'
        }),

        auth: state,

        printQRInTerminal: false,

        browser: Browsers.macOS(
            'Chrome'
        ),

        syncFullHistory: false,

        markOnlineOnConnect: true,

        connectTimeoutMs: 60000,

        keepAliveIntervalMs: 25000
    });

    sock.commands = commandsMap;
    sock.sessionId = sessionId;

    activeSessions.set(
        sessionId,
        {
            sock,
            ownerNumber,
            isMain
        }
    );

    // =====================================================
    // PAIRING
    // =====================================================

    if (!sock.authState.creds.registered) {
        if (!ownerNumber) {
            console.log(
                `❌ [SESSION ${sessionId}] No phone number provided for pairing.`
            );
        } else {
            setTimeout(async () => {
                try {
                    const cleanNumber =
                        ownerNumber
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
                        `✨ [SESSION ${sessionId}] PAIRING CODE GENERATED ✨`
                    );

                    if (onPairingCode) {
                        try {
                            await onPairingCode(
                                code
                            );
                        } catch (e) {}
                    }
                } catch (pairErr) {
                    console.error(
                        `🔥 [SESSION ${sessionId}] PAIRING ERROR:`,
                        pairErr
                    );

                    if (onPairingCode) {
                        try {
                            await onPairingCode(
                                null,
                                pairErr.message ||
                                    'Unknown pairing error'
                            );
                        } catch (e) {}
                    }
                }
            }, 3000);
        }
    }

    let bannerSent = false;

    // =====================================================
    // CONNECTION UPDATE
    // =====================================================

    sock.ev.on(
        'connection.update',
        async update => {
            const {
                connection,
                lastDisconnect
            } = update;

            // =================================================
            // CONNECTED
            // =================================================

            if (connection === 'open') {
                console.log(
                    `--- [SESSION ${sessionId}] CONNECTED ---`
                );

                if (!isMain) {
                    registerSession(
                        sessionId,
                        ownerNumber
                    );
                }

                // Notify Telegram gateway or any other
                // caller that the session is now connected.
                if (onConnected) {
                    try {
                        await onConnected({
                            sessionId,
                            ownerNumber,
                            isMain
                        });
                    } catch (e) {
                        console.error(
                            `🔥 [SESSION ${sessionId}] onConnected callback error:`,
                            e.message
                        );
                    }
                }

                if (!bannerSent) {
                    bannerSent = true;

                    try {
                        const botJid =
                            sock.user.id.split(':')[0] +
                            '@s.whatsapp.net';

                        await sock.sendMessage(
                            botJid,
                            {
                                text:
                                    `👑 *${CREATOR_NAME}* is now connected and active on this number!\n\n` +
                                    `Type *!menu* to see all commands.`
                            }
                        );
                    } catch (e) {}
                }
            }

            // =================================================
            // CONNECTION CLOSED
            // =================================================

            else if (connection === 'close') {
                const statusCode =
                    new Boom(
                        lastDisconnect?.error
                    )?.output?.statusCode;

                console.error(
                    `🔥 [SESSION ${sessionId}] CONNECTION CLOSED. Status: ${statusCode}`,
                    lastDisconnect?.error ||
                        'Unknown disconnect reason'
                );

                // =============================================
                // LOGGED OUT
                // =============================================

                if (
                    statusCode ===
                    DisconnectReason.loggedOut
                ) {
                    console.log(
                        `⚠️ [SESSION ${sessionId}] Logged out. Removing session.`
                    );

                    activeSessions.delete(
                        sessionId
                    );

                    removeSessionFromRegistry(
                        sessionId
                    );

                    try {
                        fs.rmSync(
                            authPath,
                            {
                                recursive: true,
                                force: true
                            }
                        );
                    } catch (e) {}
                }

                // =============================================
                // TEMPORARY DISCONNECT
                // =============================================

                else {
                    console.log(
                        `🔄 [SESSION ${sessionId}] Reconnecting in 3 seconds...`
                    );

                    activeSessions.delete(
                        sessionId
                    );

                    setTimeout(() => {
                        startSession({
                            sessionId,
                            ownerNumber,
                            isMain,
                            commandsMap,
                            onPairingCode: null,
                            onConnected: null
                        }).catch(e =>
                            console.error(
                                `🔥 [SESSION ${sessionId}] Reconnect failed:`,
                                e
                            )
                        );
                    }, 3000);
                }
            }
        }
    );

    // Save WhatsApp credentials.
    sock.ev.on(
        'creds.update',
        saveCreds
    );

    // Existing message handler.
    sock.ev.on(
        'messages.upsert',
        createMessageHandler(
            sock,
            {
                sessionId,
                ownerNumber,
                isMain
            }
        )
    );

    return sock;
}

function getActiveSessions() {
    return Array.from(
        activeSessions.entries()
    ).map(
        ([sessionId, data]) => ({
            sessionId,
            ownerNumber:
                data.ownerNumber,
            isMain: data.isMain,
            connected: !!(
                data.sock &&
                data.sock.user
            )
        })
    );
}

async function restoreSessions(
    commandsMap
) {
    const registry =
        loadSessionRegistry();

    const sessionIds =
        Object.keys(registry);

    if (
        sessionIds.length === 0
    ) {
        return;
    }

    console.log(
        `🔄 Restoring ${sessionIds.length} saved session(s)...`
    );

    for (
        const sessionId of sessionIds
    ) {
        if (
            activeSessions.has(
                sessionId
            )
        ) {
            continue;
        }

        const {
            ownerNumber
        } = registry[
            sessionId
        ];

        try {
            await startSession({
                sessionId,
                ownerNumber,
                isMain: false,
                commandsMap
            });
        } catch (e) {
            console.error(
                `🔥 Failed to restore session ${sessionId}:`,
                e
            );
        }
    }
}

module.exports = {
    startSession,
    getActiveSessions,
    restoreSessions,
    sessionExists,
    activeSessions
};
