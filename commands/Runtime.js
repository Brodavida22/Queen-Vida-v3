const startTime = Date.now();

function formatRuntime(ms) {
    const seconds = Math.floor(ms / 1000);

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

module.exports = {
    name: 'runtime',
    description: 'Show how long QUEEN VIDA has been online',

    async execute(sock, m, from, args, isOwner) {
        const runtime = formatRuntime(Date.now() - startTime);

        const text = `╭━━━━━━━━━━━━━━━━━━━━━━╮
┃      👑 *QUEEN VIDA* 👑
┃       *SYSTEM RUNTIME*
╰━━━━━━━━━━━━━━━━━━━━━━╯

🟢 *BOT STATUS:* ONLINE

⏱️ *Runtime*
> ${runtime}

🤖 *Bot:* QUEEN VIDA-V3
⚡ *Status:* Running smoothly

━━━━━━━━━━━━━━━━━━━━━━

👑 *Royal Chambers Edition*`;

        await sock.sendMessage(
            from,
            {
                text
            },
            { quoted: m }
        );
    }
};
