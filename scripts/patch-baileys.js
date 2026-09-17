const fs = require('fs');
const path = require('path');


// ============================================================
// FIND BAILEYS
// ============================================================

const candidates = [
    path.join(
        __dirname,
        '..',
        'node_modules',
        '@innovatorssoft',
        'baileys',
        'lib',
        'Socket',
        'messages-send.js'
    ),

    path.join(
        __dirname,
        '..',
        'node_modules',
        '@whiskeysockets',
        'baileys',
        'lib',
        'Socket',
        'messages-send.js'
    )
];

const file =
    candidates.find(
        candidate =>
            fs.existsSync(candidate)
    );


if (!file) {
    console.log(
        '[BAILEYS PATCH] messages-send.js was not found.'
    );

    console.log(
        '[BAILEYS PATCH] Run this after npm install.'
    );

    process.exit(0);
}


console.log(
    `[BAILEYS PATCH] Target: ${file}`
);


let source =
    fs.readFileSync(
        file,
        'utf8'
    );


// ============================================================
// ALREADY PATCHED?
// ============================================================

if (
    source.includes(
        'getUSyncDevicesChunked'
    )
) {
    console.log(
        '[BAILEYS PATCH] Already patched.'
    );

    process.exit(0);
}


// ============================================================
// CHUNKED DEVICE RESOLUTION HELPER
// ============================================================

const helper = `

/**
 * QUEEN VIDA LARGE GROUP STATUS PATCH
 *
 * Large WhatsApp groups can contain hundreds of
 * participants. Resolving all participant devices
 * in one USync request can time out.
 *
 * Resolve them in smaller sequential batches instead.
 */
const getUSyncDevicesChunked = async (
    jids,
    useCache,
    ignoreZeroDevices,
    chunkSize = 40
) => {
    const uniqueJids = [
        ...new Set(
            (jids || []).filter(Boolean)
        )
    ];

    const results = [];

    for (
        let index = 0;
        index < uniqueJids.length;
        index += chunkSize
    ) {
        const chunk =
            uniqueJids.slice(
                index,
                index + chunkSize
            );

        if (!chunk.length) {
            continue;
        }

        const chunkResults =
            await getUSyncDevices(
                chunk,
                useCache,
                ignoreZeroDevices
            );

        if (
            Array.isArray(
                chunkResults
            )
        ) {
            results.push(
                ...chunkResults
            );
        }
    }

    return results;
};

`;


// ============================================================
// INSERT HELPER BEFORE RELAY MESSAGE
// ============================================================

const relayMarker =
    'const relayMessage = async (';

if (
    !source.includes(
        relayMarker
    )
) {
    console.error(
        '[BAILEYS PATCH] relayMessage marker was not found.'
    );

    process.exit(1);
}

source =
    source.replace(
        relayMarker,
        helper +
            '\n' +
            relayMarker
    );


// ============================================================
// REPLACE LARGE DEVICE QUERY
// ============================================================

const originalCallRegex =
    /const additionalDevices\s*=\s*await\s+getUSyncDevices\s*\(\s*participantsList\s*,\s*!!useUserDevicesCache\s*,\s*false\s*\)/m;

if (
    !originalCallRegex.test(
        source
    )
) {
    console.error(
        '[BAILEYS PATCH] Target getUSyncDevices(participantsList, ...) call was not found.'
    );

    console.error(
        '[BAILEYS PATCH] Your installed Baileys source may have changed.'
    );

    process.exit(1);
}


const replacement =
`const additionalDevices =
                await getUSyncDevicesChunked(
                    participantsList,
                    !!useUserDevicesCache,
                    false,
                    40
                )`;


source =
    source.replace(
        originalCallRegex,
        replacement
    );


// ============================================================
// WRITE PATCH
// ============================================================

fs.writeFileSync(
    file,
    source,
    'utf8'
);


console.log(
    '[BAILEYS PATCH] Large-group USync batching patch applied successfully.'
);

console.log(
    '[BAILEYS PATCH] Device resolution is now processed in batches of 40.'
);
