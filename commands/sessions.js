const sessionManager = require('../bot/sessionManager');

module.exports = {
    name: 'sessions',

    description:
        'Lists all active bot sessions running on this server (Creator only)',

    async execute(sock, m, from, args, isOwner) {
        if (!isOwner) {
            return sock.sendMessage(
                from,
                {
                    text: '❌ This command is restricted to the bot creator only!'
                },
                { quoted: m }
            );
        }

        const sessions = sessionManager.getActiveSessions();

        if (sessions.length === 0) {
            return sock.sendMessage(
                from,
                { text: '📂 No active sessions found.' },
                { quoted: m }
            );
        }

        let text = `👑 *ACTIVE SESSIONS (${sessions.length})*\n\n`;

        for (const s of sessions) {
            text += `• *${s.sessionId}*${s.isMain ? ' (main)' : ''} — ${s.connected ? '🟢 connected' : '🟡 connecting'}\n`;
        }

        await sock.sendMessage(from, { text }, { quoted: m });
    }
};
