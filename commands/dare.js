module.exports = {
    name: 'dare',
    description: 'Give a random dare',

    async execute(sock, m, from) {
        const dares = [
            "Send the last photo in your gallery to the group 😂",
            "Change your profile picture for 10 minutes.",
            "Send a voice note saying 'I am the problem' 😂",
            "Tag someone and tell them they are your favorite person.",
            "Send a completely random emoji and explain it.",
            "Put 'I need help' as your status for 5 minutes.",
            "Send a voice note singing your favorite song.",
            "Let the group choose your profile picture for 10 minutes.",
            "Type your next message with your eyes closed.",
            "Send a funny selfie to the group.",
            "Tag your crush if you're brave enough 👀",
            "Send 'I miss you' to the last person you chatted with.",
            "Write a sentence using only emojis.",
            "Send a voice note laughing for 10 seconds.",
            "Let someone in the group give you a nickname."
        ];

        const dare = dares[Math.floor(Math.random() * dares.length)];

        await sock.sendMessage(from, {
            text: `╭━━━〔 😈 DARE 〕━━━╮
┃
┃ 🎯 ${dare}
┃
╰━━━━━━━━━━━━━━━━━━╯

🔥 Don't chicken out!`
        });
    }
};
