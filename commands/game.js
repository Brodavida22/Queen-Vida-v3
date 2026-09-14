module.exports = {
    name: 'game',
    description: 'Start or stop group games',

    async execute(sock, m, from, args, isOwner) {
        // Must be used in a group
        if (!from.endsWith('@g.us')) {
            return sock.sendMessage(
                from,
                {
                    text: '❌ This command can only be used inside groups!'
                },
                { quoted: m }
            );
        }

        // Get sender
        const sender =
            m.key.participant ||
            m.key.remoteJid;

        // Check group permissions
        let metadata;

        try {
            metadata = await sock.groupMetadata(from);
        } catch (error) {
            console.error('❌ Failed to get group metadata:', error);

            return sock.sendMessage(
                from,
                {
                    text: '❌ Unable to get group information.'
                },
                { quoted: m }
            );
        }

        const participant =
            metadata.participants.find(
                p =>
                    p.id === sender ||
                    p.jid === sender
            );

        const isGroupAdmin =
            participant?.admin === 'admin' ||
            participant?.admin === 'superadmin';

        if (!isOwner && !isGroupAdmin) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ Only group admins can start or stop games!'
                },
                { quoted: m }
            );
        }

        const action =
            String(args[0] || '').toLowerCase();

        /* =========================
           HELP
        ========================= */

        if (!action || action === 'help') {
            return sock.sendMessage(
                from,
                {
                    text:
`🎮 *QUEEN VIDA GAME CENTER*

*Available Games:*
🎯 Trivia
🧠 Quiz
🔀 Scramble
🔤 Guess

*Start a game:*
.game start trivia 10
.game start quiz 10
.game start scramble 10
.game start guess 10

*With difficulty:*
.game start trivia easy 10
.game start trivia medium 10
.game start trivia hard 10

.game start quiz easy 10
.game start quiz medium 10
.game start quiz hard 10

*Stop game:*
.game stop

🎯 Difficulty:
• Easy
• Medium
• Hard`
                },
                { quoted: m }
            );
        }

        /* =========================
           STOP GAME
        ========================= */

        if (action === 'stop') {
            const {
                stopGame
            } = require('../utils/gameManager');

            return stopGame(sock, from);
        }

        /* =========================
           START GAME
        ========================= */

        if (action !== 'start') {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ Invalid action.\n\nUse *.game help* to see the available commands.'
                },
                { quoted: m }
            );
        }

        const gameType =
            String(args[1] || '').toLowerCase();

        const validGames = [
            'trivia',
            'quiz',
            'scramble',
            'guess'
        ];

        if (!validGames.includes(gameType)) {
            return sock.sendMessage(
                from,
                {
                    text:
`❌ Invalid game!

Available games:
🎯 trivia
🧠 quiz
🔀 scramble
🔤 guess

Example:
*.game start trivia 10*`
                },
                { quoted: m }
            );
        }

        /*
         * Supported formats:
         *
         * .game start trivia 10
         * .game start trivia easy 10
         * .game start trivia medium 10
         * .game start trivia hard 10
         */

        let difficulty = null;
        let roundsArg;

        const possibleDifficulty =
            String(args[2] || '').toLowerCase();

        if (
            ['easy', 'medium', 'hard'].includes(
                possibleDifficulty
            )
        ) {
            difficulty = possibleDifficulty;
            roundsArg = args[3];
        } else {
            roundsArg = args[2];
        }

        let rounds =
            Number(roundsArg || 10);

        if (
            !Number.isInteger(rounds) ||
            rounds < 5
        ) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ Number of rounds must be at least *5*.\n\nExample:\n*.game start quiz easy 10*'
                },
                { quoted: m }
            );
        }

        if (rounds > 100) {
            return sock.sendMessage(
                from,
                {
                    text:
                        '❌ Maximum number of rounds is *100*.'
                },
                { quoted: m }
            );
        }

        const {
            startGame
        } = require('../utils/gameManager');

        await startGame(
            sock,
            from,
            gameType,
            rounds,
            difficulty
        );
    }
};
