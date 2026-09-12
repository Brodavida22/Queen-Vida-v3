const fs = require('fs');
const path = require('path');
require('dotenv').config();

const express = require('express');

const {
    CREATOR_NAME,
    CREATOR_NUMBERS,
    DISPLAY_CREATOR_NUMBER
} = require('./bot/config');

const sessionManager = require('./bot/sessionManager');

// --- CONDITIONAL CLOUD PORT SERVER CONFIGURATION ---
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

// --- GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => {
    console.error('🔥 [CRASH REPORT - UNCAUGHT EXCEPTION]:', err);

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

// --- COMMAND LOADER (shared by every session) ---
function loadCommands() {
    const commandsMap = new Map();
    const commandPath = path.join(__dirname, 'commands');

    if (!fs.existsSync(commandPath)) {
        return commandsMap;
    }

    try {
        const commandFiles = fs
            .readdirSync(commandPath)
            .filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            try {
                const filePath = path.join(commandPath, file);

                delete require.cache[require.resolve(filePath)];

                const required = require(filePath);

                if (Array.isArray(required)) {
                    for (const cmd of required) {
                        if (cmd.name) {
                            commandsMap.set(cmd.name, cmd);
                        }
                    }
                } else if (required && required.name) {
                    commandsMap.set(required.name, required);
                }
            } catch (cmdLoadErr) {
                console.error(
                    `🔥 [COMMAND LOAD ERROR] File ${file}:`,
                    cmdLoadErr
                );
            }
        }

        console.log(`📂 Loaded ${commandsMap.size} commands successfully.`);
    } catch (dirErr) {
        console.error('🔥 [COMMAND DIR ERROR]:', dirErr);
    }

    return commandsMap;
}

// --- BOOTSTRAP ---
async function bootstrap() {
    verifyCreatorIntegrity();

    console.log('🔄 Initializing Queen Vida-V3 Multi-Session Bot...');

    const commandsMap = loadCommands();

    // Main session — the original bot number (from PHONE_NUMBER env var)
    const mainPhoneNumber = DISPLAY_CREATOR_NUMBER;

    await sessionManager.startSession({
        sessionId: 'main',
        ownerNumber: mainPhoneNumber,
        isMain: true,
        commandsMap
    });

    // Restore every previously deployed user session so they
    // reconnect automatically after a server restart.
    await sessionManager.restoreSessions(commandsMap);
}

// =====================================================
// START BOT
// =====================================================

startExpressServer();

bootstrap().catch(err => {
    console.error('🔥 [BOOTSTRAP ERROR]:', err);
});
