module.exports = {
    name: 'owner',
    description: 'Show the bot creator information',

    async execute(sock, m, from, args, isOwner) {
        const creatorName = 'QUEEN VIDA';
        const creatorNumber = '2348138558590';

        const text = `╭━━━━━━━━━━━━━━━━━━━━━━╮
┃      👑 *QUEEN VIDA* 👑
┃         *CREATOR*
╰━━━━━━━━━━━━━━━━━━━━━━╯

👑 *BOT CREATOR*

◈ Name   : *${creatorName}*
◈ Number : *@${creatorNumber}*

━━━━━━━━━━━━━━━━━━━━━━

🤖 *BOT*
◈ Name   : *QUEEN VIDA-V3*
◈ Version: *V3 • MD*

━━━━━━━━━━━━━━━━━━━━━━

👑 *Royal Chambers Edition*`;

        await sock.sendMessage(
            from,
            {
                text,
                mentions: [`${creatorNumber}@s.whatsapp.net`]
            },
            { quoted: m }
        );
    }
};
