const sessionManager = require('../bot/sessionManager');

module.exports = {
    name: 'deploy',

    description:
        'Get your own QUEEN VIDA bot instance by pairing your own WhatsApp number',

    async execute(sock, m, from, args) {
        if (sock.sessionId !== 'main') {
            return sock.sendMessage(
                from,
                {
                    text: '❌ !deploy is only available on the main QUEEN VIDA bot number, not on deployed sub-bots.'
                },
                { quoted: m }
            );
        }

        const rawNumber = (args[0] || '').trim();

        if (!rawNumber) {
            return sock.sendMessage(
                from,
                {
                    text:
`👑 *QUEEN VIDA — GET YOUR OWN BOT*

Send your WhatsApp number *with country code, no + or spaces*.

📖 *Usage:*
!deploy 234812345678

You'll get a pairing code back here. Open WhatsApp on the number above → Linked Devices → Link a Device → Link with phone number instead → enter the code.`
                },
                { quoted: m }
            );
        }

        const cleanNumber = rawNumber.replace(/[^0-9]/g, '');

        if (cleanNumber.length < 10 || cleanNumber.length > 15) {
            return sock.sendMessage(
                from,
                {
                    text: '❌ That doesn\'t look like a valid phone number. Include the country code, digits only (e.g. 234812345678).'
                },
                { quoted: m }
            );
        }

        if (sessionManager.sessionExists(cleanNumber)) {
            return sock.sendMessage(
                from,
                {
                    text: '⚠️ A bot session for that number already exists and is either running or was previously deployed.'
                },
                { quoted: m }
            );
        }

        await sock.sendMessage(
            from,
            {
                text: `⏳ Setting up your bot for *${cleanNumber}*...\nYour pairing code will arrive here in a few seconds.`
            },
            { quoted: m }
        );

        try {
            await sessionManager.startSession({
                sessionId: cleanNumber,
                ownerNumber: cleanNumber,
                isMain: false,
                commandsMap: sock.commands,
                onPairingCode: async (code, errorMessage) => {
                    if (code) {
                        await sock.sendMessage(
                            from,
                            {
                                text:
`✅ *Your Pairing Code:* ${code}

📱 Open WhatsApp on *${cleanNumber}* → Linked Devices → Link a Device → Link with phone number instead → enter this code.

Once linked, your own QUEEN VIDA bot will be live on that number!`
                            },
                            { quoted: m }
                        );
                    } else {
                        await sock.sendMessage(
                            from,
                            {
                                text: `❌ Failed to generate a pairing code for *${cleanNumber}*.\n_Reason:_ ${errorMessage || 'Unknown error'}\n\nPlease try again.`
                            },
                            { quoted: m }
                        );
                    }
                }
            });
        } catch (error) {
            console.error('🔥 [DEPLOY COMMAND ERROR]:', error);

            await sock.sendMessage(
                from,
                {
                    text: `❌ Something went wrong setting up your session.\n_Details:_ ${error.message}`
                },
                { quoted: m }
            );
        }
    }
};
