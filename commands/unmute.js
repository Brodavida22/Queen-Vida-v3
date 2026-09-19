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
    name: 'unmute',

    description:
        'Unlocks the group so everyone can send messages',

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
                    '🔥 [UNMUTE] Admin check failed:',
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
                        '❌ *Access Denied:*\nOnly group admins and the bot creator can unmute the group.'
                },
                {
                    quoted: m
                }
            );
        }


        // ========================================================
        // UNLOCK GROUP
        // ========================================================

        try {
            await sock.groupSettingUpdate(
                from,
                'not_announcement'
            );

            console.log(
                `🔓 [UNMUTE] Group unlocked successfully: ${from}`
            );

        } catch (error) {
            console.error(
                '🔥 [UNMUTE] Failed to unlock group:',
                error
            );

            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ Failed to unmute the group.\n\nMake sure the bot is an admin.'
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
                        '🔓 *Group Unlocked*\n\nEveryone can now send messages.'
                },
                {
                    quoted: m
                }
            );

        } catch (error) {
            /*
             * The group has already been unlocked.
             * Do not attempt the setting change again.
             */
            console.error(
                '⚠️ [UNMUTE] Group unlocked but confirmation message failed:',
                error?.message ||
                    error
            );
        }
    }
};
