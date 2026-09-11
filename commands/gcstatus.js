module.exports = {
    name: 'gcstatus',

    description:
        'Show detailed group status and information',

    async execute(sock, m, from, args, isOwner) {

        try {

            // GROUP ONLY
            if (!from.endsWith('@g.us')) {

                return sock.sendMessage(
                    from,
                    {
                        text:
`❌ *GROUP ONLY*

The gcstatus command can only be used inside a WhatsApp group.`
                    },
                    { quoted: m }
                );
            }

            const metadata =
                await sock.groupMetadata(from);

            const participants =
                metadata.participants || [];

            const admins =
                participants.filter(
                    p =>
                        p.admin === 'admin' ||
                        p.admin === 'superadmin'
                );

            const members =
                participants.length;

            const groupName =
                metadata.subject ||
                'Unknown Group';

            const description =
                metadata.desc ||
                'No group description has been set.';

            const createdAt =
                metadata.creation
                    ? new Date(
                        metadata.creation * 1000
                    ).toLocaleString('en-NG', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Africa/Lagos'
                    })
                    : 'Unknown';

            const owner =
                metadata.owner ||
                metadata.subjectOwner ||
                null;

            let ownerText =
                'Unknown';

            let ownerMention = [];

            if (owner) {

                ownerText =
                    `@${owner.split('@')[0]}`;

                ownerMention = [owner];
            }

            const groupStatus =
`╭━━━━━━━━━━━━━━━━━━━━━━╮
┃   👑 *QUEEN VIDA* 👑
┃      *GROUP STATUS*
╰━━━━━━━━━━━━━━━━━━━━━━╯

🏰 *GROUP INFORMATION*

◈ Name      : *${groupName}*
◈ Members   : *${members}*
◈ Admins    : *${admins.length}*
◈ Created   : *${createdAt}*

━━━━━━━━━━━━━━━━━━━━━━

📜 *DESCRIPTION*

${description}

━━━━━━━━━━━━━━━━━━━━━━

👑 *GROUP OWNER*

${ownerText}

━━━━━━━━━━━━━━━━━━━━━━

🟢 *BOT STATUS*

◈ Queen Vida : *ONLINE* 🟢
◈ Group      : *ACTIVE*
◈ Group ID   :
${from}

━━━━━━━━━━━━━━━━━━━━━━

📊 *GROUP SUMMARY*

◈ Total Members : *${members}*
◈ Total Admins  : *${admins.length}*

━━━━━━━━━━━━━━━━━━━━━━

👑 *QUEEN VIDA-V3*
*Royal Chambers Edition*`;

            await sock.sendMessage(
                from,
                {
                    text: groupStatus,
                    mentions: ownerMention
                },
                { quoted: m }
            );

        } catch (error) {

            console.error(
                '❌ GCSTATUS ERROR:',
                error
            );

            await sock.sendMessage(
                from,
                {
                    text:
`❌ *GCSTATUS ERROR*

I couldn't retrieve the group information right now.

Please try again in a few seconds.`
                },
                { quoted: m }
            );
        }
    }
};
