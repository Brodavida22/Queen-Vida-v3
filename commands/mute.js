const CREATOR_NUMBERS = [
    "2348138558590"
];

const {
    getSenderJid,
    findParticipant,
    isAdminParticipant,
    isOwnerParticipant
} = require('../utils/groupParticipants');

module.exports = {
    name: 'mute',

    description:
        'Locks the group so only admins can send messages',

    async execute(
        sock,
        m,
        from
    ) {
        // ========================================================
        // GROUP CHECK
        // ========================================================

        if (
            !from ||
            !from.endsWith('@g.us')
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ This command can only be used inside groups!'
                },
                {
                    quoted: m
                }
            );
        }


        // ========================================================
        // SENDER
        // ========================================================

        const sender =
            getSenderJid(m);

        const senderNumber =
            String(sender)
                .replace(/[^0-9]/g, '');


        let participant = null;

        const isOwner =
            CREATOR_NUMBERS.includes(
                senderNumber
            ) ||
            m?.key?.fromMe === true;


        // ========================================================
        // ADMIN CHECK
        // ========================================================

        let isAdmin = false;

        if (!isOwner) {
            try {
                const metadata =
                    await sock.groupMetadata(
                        from
                    );

                participant =
                    findParticipant(
                        metadata,
                        sender
                    );

                isAdmin =
                    isAdminParticipant(
                        participant
                    ) ||
                    isOwnerParticipant(
                        participant,
                        CREATOR_NUMBERS
                    );

            } catch (error) {
                console.error(
                    '🔥 [MUTE] Admin check failed:',
                    error?.message ||
                        error
                );
            }
        }


        // ========================================================
        // PERMISSION
        // ========================================================

        if (
            !isOwner &&
            !isAdmin
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ *Access Denied:*\nOnly group admins and the bot creator can mute the group.'
                },
                {
                    quoted: m
                }
            );
        }


        // ========================================================
        // LOCK GROUP
        // ========================================================

        try {
            await sock.groupSettingUpdate(
                from,
                'announcement'
            );

            console.log(
                `🔒 [MUTE] Group locked successfully: ${from}`
            );

        } catch (error) {
            console.error(
                '🔥 [MUTE] Failed to lock group:',
                error
            );

            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ Failed to mute the group.\n\nMake sure the bot is an admin.'
                },
                {
                    quoted: m
                }
            ).catch(() => {});
        }


        // ========================================================
        // CONFIRMATION MESSAGE
        // ========================================================

        try {
            await sock.sendMessage(
                from,
                {
                    text:
                        '🔒 *Group Locked*\n\nOnly admins can now send messages.'
                },
                {
                    quoted: m
                }
            );

        } catch (error) {
            /*
             * IMPORTANT:
             *
             * The group is already locked at this point.
             * Do NOT try to lock it again.
             */
            console.error(
                '⚠️ [MUTE] Group locked but confirmation message failed:',
                error?.message ||
                    error
            );
        }
    }
};
