const fs = require('fs');
const path = require('path');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');

const {
    Boom
} = require('@hapi/boom');

const pino =
    require('pino');

const NodeCache =
    require('node-cache');

const {
    createMessageHandler
} = require('./messageHandler');

const {
    CREATOR_NAME
} = require('./config');


const SESSIONS_FILE =
    path.join(
        __dirname,
        '..',
        'sessions.json'
    );

const AUTH_ROOT =
    path.join(
        __dirname,
        '..',
        'auth_info'
    );


const activeSessions =
    new Map();

const startingSessions =
    new Map();


// ============================================================
// FILE HELPERS
// ============================================================

function ensureDirectory(
    dir
) {
    try {
        if (
            !fs.existsSync(dir)
        ) {
            fs.mkdirSync(
                dir,
                {
                    recursive: true
                }
            );
        }

    } catch (error) {
        console.error(
            '🔥 [SESSION] Failed creating directory:',
            error.message
        );
    }
}


function loadSessionRegistry() {
    if (
        !fs.existsSync(
            SESSIONS_FILE
        )
    ) {
        return {};
    }

    try {
        const parsed =
            JSON.parse(
                fs.readFileSync(
                    SESSIONS_FILE,
                    'utf8'
                ) || '{}'
            );

        return (
            parsed &&
            typeof parsed ===
                'object'
        )
            ? parsed
            : {};

    } catch (error) {
        console.error(
            '⚠️ [SESSION REGISTRY] Invalid sessions.json. Starting empty registry.'
        );

        return {};
    }
}


function saveSessionRegistry(
    registry
) {
    try {
        ensureDirectory(
            path.dirname(
                SESSIONS_FILE
            )
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
            registry[
                sessionId
            ]?.addedAt ||
            Date.now(),

        updatedAt:
            Date.now()
    };

    saveSessionRegistry(
        registry
    );
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
        delete registry[
            sessionId
        ];

        saveSessionRegistry(
            registry
        );

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


// ============================================================
// READ CREDENTIALS
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
        !fs.existsSync(
            authPath
        ) ||
        !fs.existsSync(
            credsPath
        )
    ) {
        return {
            exists:
                false,

            registered:
                false,

            valid:
                false
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
                exists:
                    true,

                registered:
                    false,

                valid:
                    false
            };
        }

        const creds =
            JSON.parse(
                raw
            );

        return {
            exists:
                true,

            registered:
                creds.registered ===
                true,

            valid:
                true,

            creds
        };

    } catch (error) {
        return {
            exists:
                true,

            registered:
                false,

            valid:
                false
        };
    }
}


// ============================================================
// DELETE AUTH
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
        if (
            fs.existsSync(
                authPath
            )
        ) {
            fs.rmSync(
                authPath,
                {
                    recursive:
                        true,

                    force:
                        true
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


// ============================================================
// STALE SESSION
// ============================================================

function cleanupStaleSession(
    sessionId,
    isMain = false
) {
    if (
        activeSessions.has(
            sessionId
        )
    ) {
        return false;
    }

    const auth =
        readCredentials(
            sessionId,
            isMain
        );

    if (
        !auth.exists ||
        !auth.valid ||
        !auth.registered
    ) {
        deleteAuthFolder(
            sessionId,
            isMain
        );

        removeSessionFromRegistry(
            sessionId
        );

        return true;
    }

    return false;
}


// ============================================================
// SESSION EXISTS
// ============================================================

function sessionExists(
    sessionId
) {
    if (
        activeSessions.has(
            sessionId
        )
    ) {
        return true;
    }

    const registry =
        loadSessionRegistry();

    if (
        !registry[sessionId]
    ) {
        return false;
    }

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
// REMOVE SESSION
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
            /*
             * IMPORTANT:
             * Prevent the connection.close handler
             * from automatically reconnecting after
             * the user deliberately clears the session.
             */
            active.manualRemoval =
                true;

            active.sock?.end?.(
                new Error(
                    'Session removed'
                )
            );

        } catch (error) {}

        activeSessions.delete(
            sessionId
        );
    }

    startingSessions.delete(
        sessionId
    );

    if (
        removeRegistry
    ) {
        removeSessionFromRegistry(
            sessionId
        );
    }

    if (
        removeAuth
    ) {
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
    if (
        activeSessions.has(
            sessionId
        )
    ) {
        return activeSessions.get(
            sessionId
        ).sock;
    }

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
            let sock =
                null;

            let groupMetadataCache =
                null;

            let userDevicesCache =
                null;

            let pairingRequested =
                false;

            let pairingRetryTimer =
                null;

            let bannerSent =
                false;

            /*
             * THIS IS THE IMPORTANT FIX.
             *
             * We do not request a pairing code
             * after an arbitrary 2.5 seconds.
             *
             * We wait until WhatsApp reports
             * connection === 'open'.
             */
            let connectionOpened =
                false;

            try {
                const authPath =
                    getAuthPath(
                        sessionId,
                        isMain
                    );

                ensureDirectory(
                    AUTH_ROOT
                );

                const auth =
                    readCredentials(
                        sessionId,
                        isMain
                    );

                if (
                    auth.exists &&
                    (
                        !auth.valid ||
                        !auth.registered
                    )
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


                // ====================================================
                // AUTH STATE
                // ====================================================

                const {
                    state,
                    saveCreds
                } =
                    await useMultiFileAuthState(
                        authPath
                    );


                // ====================================================
                // CACHES
                // ====================================================

                groupMetadataCache =
                    new Map();

                userDevicesCache =
                    new NodeCache({
                        stdTTL:
                            600,

                        checkperiod:
                            120,

                        useClones:
                            false
                    });


                // ====================================================
                // SOCKET
                // ====================================================

                sock =
                    makeWASocket({
                        logger:
                            pino({
                                level:
                                    'silent'
                            }),

                        auth:
                            state,

                        printQRInTerminal:
                            false,

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

                        defaultQueryTimeoutMs:
                            300000,

                        keepAliveIntervalMs:
                            25000,

                        userDevicesCache,

                        cachedGroupMetadata:
                            async jid =>
                                groupMetadataCache.get(
                                    jid
                                )
                    });


                sock.commands =
                    commandsMap;

                sock.sessionId =
                    sessionId;


                const sessionData = {
                    sock,

                    ownerNumber,

                    isMain,

                    manualRemoval:
                        false
                };


                activeSessions.set(
                    sessionId,
                    sessionData
                );


                // ====================================================
                // GROUP METADATA
                // ====================================================

                const refreshGroupMetadata =
                    async groupJid => {
                        if (
                            !groupJid ||
                            !groupJid.endsWith(
                                '@g.us'
                            )
                        ) {
                            return null;
                        }

                        try {
                            const metadata =
                                await sock.groupMetadata(
                                    groupJid
                                );

                            if (
                                metadata?.participants &&
                                Array.isArray(
                                    metadata.participants
                                )
                            ) {
                                groupMetadataCache.set(
                                    groupJid,
                                    metadata
                                );

                                return metadata;
                            }

                        } catch (error) {
                            console.error(
                                `⚠️ [GROUP CACHE] Failed loading ${groupJid}:`,
                                error?.message ||
                                error
                            );
                        }

                        return null;
                    };


                // ====================================================
                // PAIRING CODE
                // ====================================================

                const requestPairing =
                    async () => {
                        if (
                            pairingRequested
                        ) {
                            return;
                        }

                        if (
                            state.creds.registered
                        ) {
                            return;
                        }

                        if (
                            !ownerNumber
                        ) {
                            const error =
                                new Error(
                                    'No phone number provided.'
                                );

                            if (
                                onPairingCode
                            ) {
                                await onPairingCode(
                                    null,
                                    error.message
                                );
                            }

                            return;
                        }

                        /*
                         * DO NOT REQUEST THE CODE
                         * UNTIL WHATSAPP IS CONNECTED.
                         */
                        if (
                            !connectionOpened
                        ) {
                            console.log(
                                `⏳ [SESSION ${sessionId}] Waiting for WhatsApp connection before requesting pairing code...`
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

                            console.log(
                                `📱 [SESSION ${sessionId}] Requesting pairing code for +${cleanNumber}...`
                            );

                            const code =
                                await sock.requestPairingCode(
                                    cleanNumber
                                );

                            if (!code) {
                                throw new Error(
                                    'WhatsApp returned an empty pairing code.'
                                );
                            }

                            console.log(
                                `✨ [SESSION ${sessionId}] PAIRING CODE GENERATED.`
                            );

                            if (
                                onPairingCode
                            ) {
                                await onPairingCode(
                                    code
                                );
                            }

                        } catch (
                            pairError
                        ) {
                            pairingRequested =
                                false;

                            console.error(
                                `🔥 [SESSION ${sessionId}] PAIRING ERROR:`,
                                pairError?.message ||
                                pairError
                            );

                            if (
                                onPairingCode
                            ) {
                                try {
                                    await onPairingCode(
                                        null,
                                        pairError?.message ||
                                        'Unknown pairing error'
                                    );
                                } catch (
                                    callbackError
                                ) {}
                            }
                        }
                    };


                // ====================================================
                // CONNECTION UPDATE
                // ====================================================

                sock.ev.on(
                    'connection.update',
                    async update => {
                        const {
                            connection,
                            lastDisconnect
                        } = update;


                        // ==================================================
                        // OPEN
                        // ==================================================

                        if (
                            connection ===
                            'open'
                        ) {
                            connectionOpened =
                                true;

                            console.log(
                                `--- [SESSION ${sessionId}] CONNECTED ---`
                            );


                            /*
                             * IMPORTANT:
                             *
                             * Request pairing code only now,
                             * after WhatsApp is actually open.
                             */
                            if (
                                !state.creds.registered &&
                                !pairingRequested
                            ) {
                                if (
                                    pairingRetryTimer
                                ) {
                                    clearTimeout(
                                        pairingRetryTimer
                                    );
                                }

                                pairingRetryTimer =
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
                                        1500
                                    );
                            }


                            // ==============================================
                            // GROUP CACHE
                            // ==============================================

                            try {
                                const groups =
                                    await sock.groupFetchAllParticipating();

                                let cachedCount =
                                    0;

                                for (
                                    const [
                                        jid,
                                        metadata
                                    ] of Object.entries(
                                        groups ||
                                        {}
                                    )
                                ) {
                                    if (
                                        metadata?.participants &&
                                        Array.isArray(
                                            metadata.participants
                                        )
                                    ) {
                                        groupMetadataCache.set(
                                            jid,
                                            metadata
                                        );

                                        cachedCount++;
                                    }
                                }

                                console.log(
                                    `📦 [GROUP CACHE] Preloaded ${cachedCount} group(s) for session ${sessionId}`
                                );

                            } catch (
                                error
                            ) {
                                console.error(
                                    `⚠️ [GROUP CACHE] Preload failed for session ${sessionId}:`,
                                    error?.message ||
                                    error
                                );
                            }


                            // ==============================================
                            // REGISTER
                            // ==============================================

                            if (
                                !isMain
                            ) {
                                registerSession(
                                    sessionId,
                                    ownerNumber
                                );
                            }


                            // ==============================================
                            // CALLBACK
                            // ==============================================

                            if (
                                onConnected
                            ) {
                                try {
                                    await onConnected({
                                        sessionId,

                                        ownerNumber,

                                        isMain
                                    });

                                } catch (
                                    error
                                ) {
                                    console.error(
                                        `🔥 [SESSION ${sessionId}] onConnected error:`,
                                        error.message
                                    );
                                }
                            }


                            // ==============================================
                            // BANNER
                            // ==============================================

                            if (
                                !bannerSent &&
                                sock.user
                            ) {
                                bannerSent =
                                    true;

                                try {
                                    const botJid =
                                        `${sock.user.id?.split(':')[0]}@s.whatsapp.net`;

                                    await sock.sendMessage(
                                        botJid,
                                        {
                                            text:
                                                `👑 *${CREATOR_NAME}* is now connected and active on this number!\n\nType *!menu* to see all commands.`
                                        }
                                    );

                                } catch (
                                    error
                                ) {}
                            }

                            return;
                        }


                        // ==================================================
                        // CLOSED
                        // ==================================================

                        if (
                            connection !==
                            'close'
                        ) {
                            return;
                        }

                        connectionOpened =
                            false;

                        if (
                            pairingRetryTimer
                        ) {
                            clearTimeout(
                                pairingRetryTimer
                            );

                            pairingRetryTimer =
                                null;
                        }


                        const statusCode =
                            new Boom(
                                lastDisconnect?.error
                            )?.output
                                ?.statusCode;


                        const current =
                            activeSessions.get(
                                sessionId
                            );

                        const manualRemoval =
                            current?.manualRemoval ===
                            true;


                        console.error(
                            `🔥 [SESSION ${sessionId}] CONNECTION CLOSED. Status: ${statusCode}`,

                            lastDisconnect?.error ||
                            'Unknown disconnect reason'
                        );


                        activeSessions.delete(
                            sessionId
                        );


                        groupMetadataCache.clear();

                        userDevicesCache.flushAll();


                        /*
                         * User deliberately removed it.
                         * DO NOT reconnect.
                         */
                        if (
                            manualRemoval
                        ) {
                            return;
                        }


                        // ==============================================
                        // LOGGED OUT
                        // ==============================================

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


                        // ==============================================
                        // BAD SESSION
                        // ==============================================

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


                        // ==============================================
                        // RECONNECT
                        // ==============================================

                        console.log(
                            `🔄 [SESSION ${sessionId}] Reconnecting in 3 seconds...`
                        );

                        setTimeout(
                            async () => {
                                try {
                                    await startSession({
                                        sessionId,

                                        ownerNumber,

                                        isMain,

                                        commandsMap,

                                        onPairingCode,

                                        onConnected
                                    });

                                } catch (
                                    error
                                ) {
                                    console.error(
                                        `🔥 [SESSION ${sessionId}] Reconnect failed:`,
                                        error
                                    );
                                }
                            },
                            3000
                        );
                    }
                );


                // ====================================================
                // GROUP UPDATES
                // ====================================================

                sock.ev.on(
                    'groups.update',
                    async events => {
                        if (
                            !Array.isArray(
                                events
                            )
                        ) {
                            return;
                        }

                        for (
                            const event of events
                        ) {
                            if (
                                event?.id
                            ) {
                                await refreshGroupMetadata(
                                    event.id
                                );
                            }
                        }
                    }
                );


                // ====================================================
                // GROUP PARTICIPANT UPDATES
                // ====================================================

                sock.ev.on(
                    'group-participants.update',
                    async event => {
                        if (
                            event?.id
                        ) {
                            await refreshGroupMetadata(
                                event.id
                            );
                        }
                    }
                );


                // ====================================================
                // SAVE CREDENTIALS
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
                if (
                    pairingRetryTimer
                ) {
                    clearTimeout(
                        pairingRetryTimer
                    );
                }

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
        (
            [
                sessionId,
                data
            ]
        ) => ({
            sessionId,

            ownerNumber:
                data.ownerNumber,

            isMain:
                data.isMain,

            connected:
                !!(
                    data.sock &&
                    data.sock.user
                ),

            registered:
                !!data.sock?.user
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
        Object.keys(
            registry
        );

    if (
        !sessionIds.length
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

        const ownerNumber =
            registry[
                sessionId
            ]?.ownerNumber;

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

                isMain:
                    false,

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
