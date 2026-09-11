module.exports = {
    name: 'truth',
    description: 'Give a random truth question',

    async execute(sock, m, from, args, isOwner) {
        const truths = [
            "What is the most embarrassing thing you've ever done? 😂",
            "Who was your first crush? 👀",
            "What's one secret you've never told anyone here?",
            "Have you ever lied to your best friend?",
            "Who in this group would you trust with your biggest secret?",
            "What's the biggest lie you've ever told?",
            "Have you ever had a crush on someone in this group? 👀",
            "What's something you're currently hiding from everyone?",
            "Who was the last person you stalked online? 😂",
            "What's your biggest fear?",
            "Have you ever pretended to like someone just to get something?",
            "What's the weirdest thing you've done when you were alone?",
            "Who do you miss right now?",
            "What's your biggest regret?",
            "Have you ever sent a message to the wrong person?",
            "What's the most childish thing you still do?",
            "Who in this group annoys you the most? 😂",
            "Have you ever been caught lying?",
            "What's something you wish you could change about yourself?",
            "What's the craziest thing you've done for love?",
            "Have you ever liked someone who didn't like you back?",
            "What's the last thing you searched on your phone?",
            "Who was your last WhatsApp chat with?",
            "Have you ever secretly read someone's private messages?",
            "What's one thing you would never tell your parents?",
            "Have you ever fallen in love with a friend?",
            "What's the most embarrassing nickname you've ever had?",
            "Who in this group do you think is the funniest?",
            "What's one thing you are ashamed of?",
            "If you could date anyone in this group, who would it be? 👀"
        ];

        const question = truths[Math.floor(Math.random() * truths.length)];

        await sock.sendMessage(from, {
            text: `╭━━━〔 🕵️ TRUTH 〕━━━╮
┃
┃ ❓ ${question}
┃
╰━━━━━━━━━━━━━━━━━━╯

👉 Answer honestly! 😂`
        });
    }
};
