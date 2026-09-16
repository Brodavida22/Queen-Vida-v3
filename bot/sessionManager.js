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

const SESSIONS_FILE = path.join(
    __dirname,
    '..',
    'sessions.json'
);

const AUTH_ROOT = path.join(
    __dirname,
    '..',
    'auth_info'
);

// sessionId -> { sock, ownerNumber, isMain }
const activeSessions = new Map();

// Prevent two startSession() calls from creating
// two sockets for the same session.
const startingSessions = new Map();


// ============================================================
// FILE HELPERS
// ============================================================

function ensureDirectory(dir) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {
                recursive: true
            });
        }
    } catch (error) {
        console.error(
            '🔥 [SESSION] Failed creating directory:',
            error.message
        );
    }
}

function loadSessionRegistry() {
    if (!fs.existsSync(SESSIONS_FILE)) {
        return {};
    }

    try {
        const data = fs.readFileSync(
            SESSIONS_FILE,
            'utf8'
        );

        if (!data.trim()) {
            return {};
        }

        const parsed = JSON.parse(data);

        return parsed &&
            typeof parsed === 'object'
            ? parsed
            : {};
    } catch (error) {
        console.error(
            '⚠️ [SESSION REGISTRY] Invalid sessions.json. Starting with empty registry.'
        );

        return {};
    }
}

function saveSessionRegistry(registry) {
    try {
        ensureDirectory(
            path.dirname(SESSIONS_FILE)
        );

        fs.writeFileSync(
            SESSIONS_FILE,
            JSON.stringify(
                registry,
                null,
                2
            )
        );

        return true;
    } catch (error) {
        console.error(
            '🔥 [SESSION REGISTRY] Failed to save:',
            error.message
        );

        return false;
    }
}

function registerSession(
    sessionId,
    ownerNumber
) {
    const registry =
        loadSessionRegistry();

    registry[sessionId] = {
        ownerNumber,
        addedAt:
            registry[sessionId]?.addedAt ||
            Date.now(),
        updatedAt: Date.now()
    };

    saveSessionRegistry(registry);
}

function removeSessionFromRegistry(
    sessionId
) {
    const registry =
        loadSessionRegistry();

    if (
        Object.prototype.hasOwnProperty.call(
            registry,
            sessionId
        )
    ) {
        delete registry[sessionId];

        saveSessionRegistry(registry);

        console.log(
            `🧹 [SESSION] Removed ${sessionId} from sessions.json`
        );
    }
}


// ============================================================
// AUTH PATH
// ============================================================

function getAuthPath(
    sessionId,
    isMain = false
) {
    return isMain
        ? AUTH_ROOT
        : path.join(
            AUTH_ROOT,
            sessionId
        );
}

function getCredsPath(
    sessionId,
    isMain = false
) {
    return path.join(
        getAuthPath(
            sessionId,
            isMain
        ),
        'creds.json'
    );
}


// ============================================================
// AUTH STATE CHECKS
// ============================================================

function readCredentials(
    sessionId,
    isMain = false
) {
    const authPath =
        getAuthPath(
            sessionId,
            isMain
        );

    const credsPath =
        path.join(
            authPath,
            'creds.json'
        );

    if (
        !fs.existsSync(authPath) ||
        !fs.existsSync(credsPath)
    ) {
        return {
            exists: false,
            registered: false,
            valid: false
        };
    }

    try {
        const raw =
            fs.readFileSync(
                credsPath,
                'utf8'
            );

        if (!raw.trim()) {
            return {
                exists: true,
                registered: false,
                valid: false
            };
        }

        const creds =
            JSON.parse(raw);

        return {
            exists: true,
            registered:
                creds.registered === true,
            valid: true,
            creds
        };
    } catch (error) {
        return {
            exists: true,
            registered: false,
            valid: false
        };
    }
}


// ============================================================
// STALE SESSION CLEANUP
// ============================================================

function deleteAuthFolder(
    sessionId,
    isMain = false
) {
    const authPath =
        getAuthPath(
            sessionId,
            isMain
        );

    try {
        if (fs.existsSync(authPath)) {
            fs.rmSync(
                authPath,
                {
                    recursive: true,
                    force: true
                }
            );

            console.log(
                `🧹 [SESSION] Deleted auth folder for ${sessionId}`
            );
        }
    } catch (error) {
        console.error(
            `🔥 [SESSION] Failed deleting auth folder for ${sessionId}:`,
            error.message
        );
    }
}

function cleanupStaleSession(
    sessionId,
    isMain = false
) {
    // Never destroy a currently active session.
    if (activeSessions.has(sessionId)) {
        return false;
    }

    const auth =
        readCredentials(
            sessionId,
            isMain
        );

    /*
     * No auth directory:
     *
     * If the registry says it exists but there is
     * no auth state, the registry entry is stale.
     */
    if (!auth.exists) {
        removeSessionFromRegistry(
            sessionId
        );

        return true;
    }

    /*
     * Broken creds.json.
     */
    if (!auth.valid) {
        deleteAuthFolder(
            sessionId,
            isMain
        );

        removeSessionFromRegistry(
            sessionId
        );

        return true;
    }

    /*
     * An unregistered auth state means pairing
     * never completed.
     *
     * This is exactly the situation that caused:
     *
     * "A session for this WhatsApp number already
     * exists or is being restored."
     */
    if (!auth.registered) {
        deleteAuthFolder(
            sessionId,
            isMain
        );

        removeSessionFromRegistry(
            sessionId
        );

        return true;
    }

    /*
     * Registered credentials are NOT stale.
     */
    return false;
}


// ============================================================
// SESSION STATUS
// ============================================================

function sessionExists(
    sessionId
) {
    if (activeSessions.has(sessionId)) {
        return true;
    }

    const registry =
        loadSessionRegistry();

    if (!registry[sessionId]) {
        return false;
    }

    /*
     * If the registry exists but auth is gone,
     * automatically remove the stale entry.
     */
    const auth =
        readCredentials(
            sessionId,
            false
        );

    if (
        !auth.exists ||
        !auth.valid
    ) {
        removeSessionFromRegistry(
            sessionId
        );

        return false;
    }

    /*
     * Unregistered sessions are incomplete
     * pairing attempts, so clean them.
     */
    if (!auth.registered) {
        deleteAuthFolder(
            sessionId,
            false
        );

        removeSessionFromRegistry(
            sessionId
        );

        return false;
    }

    return true;
}


// ============================================================
// FORCE CLEAN SESSION
// ============================================================

async function removeSession(
    sessionId,
    options = {}
) {
    const {
        removeAuth = true,
        removeRegistry = true
    } = options;

    const active =
        activeSessions.get(
            sessionId
        );

    if (active) {
        try {
            active.sock?.end?.(
                new Error(
                    'Session removed'
                )
            );
        } catch (e) {}

        activeSessions.delete(
            sessionId
        );
    }

    startingSessions.delete(
        sessionId
    );

    if (removeRegistry) {
        removeSessionFromRegistry(
            sessionId
        );
    }

    if (removeAuth) {
        deleteAuthFolder(
            sessionId,
            false
        );
    }

    return true;
}


// ============================================================
// START SESSION
// ============================================================

async function startSession({
    sessionId,
    ownerNumber,
    isMain = false,
    commandsMap,
    onPairingCode = null,
    onConnected = null
}) {
    // Existing active socket.
    if (
        activeSessions.has(
            sessionId
        )
    ) {
        return activeSessions.get(
            sessionId
        ).sock;
    }

    // Existing start operation.
    if (
        startingSessions.has(
            sessionId
        )
    ) {
        return startingSessions.get(
            sessionId
        );
    }

    const startPromise =
        (async () => {
            try {
                const authPath =
                    getAuthPath(
                        sessionId,
                        isMain
                    );

                ensureDirectory(
                    AUTH_ROOT
                );

                /*
                 * Clean incomplete pairing state.
                 *
                 * IMPORTANT:
                 * Only clean an unregistered session.
                 * Never delete a valid registered account.
                 */
                const auth =
                    readCredentials(
                        sessionId,
                        isMain
                    );

                if (
                    auth.exists &&
                    (!auth.valid ||
                        !auth.registered)
                ) {
                    deleteAuthFolder(
                        sessionId,
                        isMain
                    );

                    if (!isMain) {
                        removeSessionFromRegistry(
                            sessionId
                        );
                    }
                }

                const {
                    state,
                    saveCreds
                } =
                    await useMultiFileAuthState(
                        authPath
                    );

                const sock =
                    makeWASocket({
                        logger: pino({
                            level: 'silent'
                        }),

                        auth: state,

                        printQRInTerminal: false,

                        browser:
                            Browsers.macOS(
                                'Chrome'
                            ),

                        syncFullHistory:
                            false,

                        markOnlineOnConnect:
                            true,

                        connectTimeoutMs:
                            60000,

                        keepAliveIntervalMs:
                            25000
                    });

                sock.commands =
                    commandsMap;

                sock.sessionId =
                    sessionId;

                activeSessions.set(
                    sessionId,
                    {
                        sock,
                        ownerNumber,
                        isMain
                    }
                );

                let pairingRequested =
                    false;

                let bannerSent =
                    false;

                // ====================================================
                // PAIRING
                // ====================================================

                const requestPairing =
                    async () => {
                        if (
                            pairingRequested
                        ) {
                            return;
                        }

                        if (
                            sock.authState?.creds
                                ?.registered
                        ) {
                            return;
                        }

                        if (
                            !ownerNumber
                        ) {
                            console.error(
                                `❌ [SESSION ${sessionId}] No phone number provided.`
                            );

                            return;
                        }

                        pairingRequested =
                            true;

                        try {
                            const cleanNumber =
                                String(
                                    ownerNumber
                                )
                                    .trim()
                                    .replace(
                                        /[^0-9]/g,
                                        ''
                                    );

                            if (
                                cleanNumber.length <
                                    10 ||
                                cleanNumber.length >
                                    15
                            ) {
                                throw new Error(
                                    'Invalid phone number.'
                                );
                            }

                            const code =
                                await sock.requestPairingCode(
                                    cleanNumber
                                );

                            console.log(
                                `✨ [SESSION ${sessionId}] PAIRING CODE: ${code}`
                            );

                            if (
                                onPairingCode
                            ) {
                                await onPairingCode(
                                    code
                                );
                            }
                        } catch (pairError) {
                            pairingRequested =
                                false;

                            console.error(
                                `🔥 [SESSION ${sessionId}] PAIRING ERROR:`,
                                pairError
                            );

                            if (
                                onPairingCode
                            ) {
                                try {
                                    await onPairingCode(
                                        null,
                                        pairError
                                            ?.message ||
                                            'Unknown pairing error'
                                    );
                                } catch (callbackError) {}
                            }
                        }
                    };

                /*
                 * Wait briefly for the socket to initialize.
                 *
                 * Pairing code requests are tied to the
                 * socket connection lifecycle.
                 */
                if (
                    !state.creds
                        .registered
                ) {
                    setTimeout(
                        () => {
                            requestPairing()
                                .catch(
                                    error =>
                                        console.error(
                                            `🔥 [SESSION ${sessionId}] Pairing request failed:`,
                                            error
                                        )
                                );
                        },
                        2500
                    );
                }

                // ====================================================
                // CONNECTION
                // ====================================================

                sock.ev.on(
                    'connection.update',
                    async update => {
                        const {
                            connection,
                            lastDisconnect
                        } = update;

                        // ============================================
                        // OPEN
                        // ============================================

                        if (
                            connection ===
                            'open'
                        ) {
                            console.log(
                                `--- [SESSION ${sessionId}] CONNECTED ---`
                            );

                            if (
                                !isMain
                            ) {
                                registerSession(
                                    sessionId,
                                    ownerNumber
                                );
                            }

                            if (
                                onConnected
                            ) {
                                try {
                                    await onConnected(
                                        {
                                            sessionId,
                                            ownerNumber,
                                            isMain
                                        }
                                    );
                                } catch (
                                    callbackError
                                ) {
                                    console.error(
                                        `🔥 [SESSION ${sessionId}] onConnected error:`,
                                        callbackError.message
                                    );
                                }
                            }

                            if (
                                !bannerSent
                            ) {
                                bannerSent =
                                    true;

                                try {
                                    const botJid =
                                        sock.user?.id
                                            ?.split(
                                                ':'
                                            )[0] +
                                        '@s.whatsapp.net';

                                    if (
                                        sock.user
                                    ) {
                                        await sock.sendMessage(
                                            botJid,
                                            {
                                                text:
                                                    `👑 *${CREATOR_NAME}* is now connected and active on this number!\n\n` +
                                                    `Type *!menu* to see all commands.`
                                            }
                                        );
                                    }
                                } catch (
                                    bannerError
                                ) {}
                            }
                        }

                        // ============================================
                        // CLOSE
                        // ============================================

                        if (
                            connection !==
                            'close'
                        ) {
                            return;
                        }

                        const statusCode =
                            new Boom(
                                lastDisconnect?.error
                            )?.output
                                ?.statusCode;

                        console.error(
                            `🔥 [SESSION ${sessionId}] CONNECTION CLOSED. Status: ${statusCode}`,
                            lastDisconnect?.error ||
                                'Unknown disconnect reason'
                        );

                        activeSessions.delete(
                            sessionId
                        );

                        /*
                         * LOGGED OUT
                         *
                         * Credentials are no longer valid.
                         * Remove everything so /pair can start
                         * a completely fresh session.
                         */
                        if (
                            statusCode ===
                            DisconnectReason.loggedOut
                        ) {
                            console.log(
                                `🧹 [SESSION ${sessionId}] Logged out. Cleaning session.`
                            );

                            removeSessionFromRegistry(
                                sessionId
                            );

                            deleteAuthFolder(
                                sessionId,
                                isMain
                            );

                            return;
                        }

                        /*
                         * BAD SESSION / AUTH FAILURE
                         *
                         * 401 can mean the saved auth is no
                         * longer usable.
                         */
                        if (
                            statusCode ===
                                401 ||
                            statusCode ===
                                DisconnectReason.badSession
                        ) {
                            console.log(
                                `🧹 [SESSION ${sessionId}] Invalid session. Cleaning auth.`
                            );

                            if (
                                !isMain
                            ) {
                                removeSessionFromRegistry(
                                    sessionId
                                );
                            }

                            deleteAuthFolder(
                                sessionId,
                                isMain
                            );

                            return;
                        }

                        /*
                         * TEMPORARY DISCONNECT
                         *
                         * Keep registered credentials and
                         * reconnect.
                         *
                         * IMPORTANT:
                         * Preserve callbacks so a pairing
                         * attempt doesn't become orphaned.
                         */
                        console.log(
                            `🔄 [SESSION ${sessionId}] Reconnecting in 3 seconds...`
                        );

                        setTimeout(
                            async () => {
                                try {
                                    await startSession(
                                        {
                                            sessionId,
                                            ownerNumber,
                                            isMain,
                                            commandsMap,
                                            onPairingCode,
                                            onConnected
                                        }
                                    );
                                } catch (
                                    reconnectError
                                ) {
                                    console.error(
                                        `🔥 [SESSION ${sessionId}] Reconnect failed:`,
                                        reconnectError
                                    );
                                }
                            },
                            3000
                        );
                    }
                );

                // ====================================================
                // SAVE CREDS
                // ====================================================

                sock.ev.on(
                    'creds.update',
                    saveCreds
                );

                // ====================================================
                // MESSAGE HANDLER
                // ====================================================

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

            } catch (error) {
                activeSessions.delete(
                    sessionId
                );

                console.error(
                    `🔥 [SESSION ${sessionId}] Failed to start:`,
                    error
                );

                throw error;
            }
        })();

    startingSessions.set(
        sessionId,
        startPromise
    );

    try {
        return await startPromise;
    } finally {
        startingSessions.delete(
            sessionId
        );
    }
}


// ============================================================
// ACTIVE SESSIONS
// ============================================================

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
            ),
            registered: !!(
                data.sock?.authState
                    ?.creds?.registered
            )
        })
    );
}


// ============================================================
// RESTORE SAVED SESSIONS
// ============================================================

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

        const saved =
            registry[
                sessionId
            ];

        const ownerNumber =
            saved?.ownerNumber;

        /*
         * Automatically remove broken registry
         * entries before attempting restoration.
         */
        const auth =
            readCredentials(
                sessionId,
                false
            );

        if (
            !auth.exists ||
            !auth.valid ||
            !auth.registered
        ) {
            console.log(
                `🧹 [RESTORE] Removing stale session: ${sessionId}`
            );

            deleteAuthFolder(
                sessionId,
                false
            );

            removeSessionFromRegistry(
                sessionId
            );

            continue;
        }

        try {
            await startSession({
                sessionId,
                ownerNumber,
                isMain: false,
                commandsMap
            });
        } catch (error) {
            console.error(
                `🔥 Failed to restore session ${sessionId}:`,
                error.message
            );
        }
    }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    startSession,
    getActiveSessions,
    restoreSessions,
    sessionExists,
    removeSession,
    cleanupStaleSession,
    activeSessions
};
