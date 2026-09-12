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
const PORT = process.env.PORT || 3000;
let isExpressRunning = false;

function startExpressServer(commandsMap) {
    if (isExpressRunning) return;

    const app = express();
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));

    app.get('/', (req, res) => {
        res.send('Queen Vida-V3 Bot is Running Active!');
    });

    app.post('/api/pair', async (req, res) => {
        const rawNumber = req.body && req.body.number;

        if (!rawNumber) {
            return res.status(400).json({ error: 'Phone number is required.' });
        }

        const cleanNumber = String(rawNumber).trim().replace(/[^0-9]/g, '');

        if (!cleanNumber) {
            return res.status(400).json({ error: 'Invalid phone number.' });
        }

        const sessionId = `web-${cleanNumber}`;
        let responded = false;

        try {
            await sessionManager.startSession({
                sessionId,
                ownerNumber: cleanNumber,
                isMain: false,
                commandsMap,
                onPairingCode: (code, errMsg) => {
                    if (responded) return;
                    responded = true;

                    if (code) {
                        res.json({ code });
                    } else {
                        res.status(500).json({ error: errMsg || 'Pairing failed.' });
                    }
                }
            });
        } catch (err) {
            if (!responded) {
                responded = true;
                res.status(500).json({ error: err.message || 'Failed to start session.' });
            }
        }

        setTimeout(() => {
            if (!responded) {
                responded = true;
                res.status(504).json({ error: 'Timed out waiting for pairing code.' });
            }
        }, 20000);
    });

    app.listen(PORT, () => {
        isExpressRunning = true;
        console.log(`🌐 Express server (site + health-check) listening on port ${PORT}`);
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

async function bootstrap() {
    verifyCreatorIntegrity();

    console.log('🔄 Initializing Queen Vida-V3 Multi-Session Bot...');

    const commandsMap = loadCommands();

    startExpressServer(commandsMap);

    const mainPhoneNumber = DISPLAY_CREATOR_NUMBER;

    await sessionManager.startSession({
        sessionId: 'main',
        ownerNumber: mainPhoneNumber,
        isMain: true,
        commandsMap
    });

    await sessionManager.restoreSessions(commandsMap);
}

bootstrap().catch(err => {
    console.error('🔥 [BOOTSTRAP ERROR]:', err);
});
