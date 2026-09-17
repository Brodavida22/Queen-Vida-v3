const fs = require('fs');
const path = require('path');

const file = path.join(
    __dirname,
    '..',
    'node_modules',
    '@innovatorssoft',
    'baileys',
    'lib',
    'Socket',
    'messages-send.js'
);

if (!fs.existsSync(file)) {
    console.log('[BAILEYS PATCH] messages-send.js not found. Skipping.');
    process.exit(0);
}

let source = fs.readFileSync(file, 'utf8');

const oldCode = `const additionalDevices = await getUSyncDevices(
                participantsList,
                !!useUserDevicesCache,
                false
            )`;

const newCode = `const additionalDevices =
                isStatus && statusJidList?.some(jid => jid.endsWith('@g.us'))
                    ? []
                    : await getUSyncDevices(
                        participantsList,
                        !!useUserDevicesCache,
                        false
                    )`;

if (source.includes(newCode)) {
    console.log('[BAILEYS PATCH] Already patched.');
    process.exit(0);
}

if (!source.includes(oldCode)) {
    console.log(
        '[BAILEYS PATCH] Target code was not found. ' +
        'Baileys version may have changed.'
    );
    process.exit(0);
}

source = source.replace(oldCode, newCode);

fs.writeFileSync(file, source, 'utf8');

console.log(
    '[BAILEYS PATCH] Group Status device-resolution patch applied successfully.'
);
