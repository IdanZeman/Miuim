
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = process.cwd();
const clientDir = path.join(rootDir, 'client');

if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir);
}

const items = fs.readdirSync(rootDir);

items.forEach(item => {
    if (item === '.git' || item === 'client' || item === '.gemini' || item === 'move_script.js' || item === '.agent') {
        // Skipping .agent as well just in case, though it's usually safe to move.
        // Actually .agent contains workflows, maybe should move?
        // The user said "move existing content to client".
        // .env.local should move.
        return;
    }

    const sourcePath = path.join(rootDir, item);
    const destPath = path.join(clientDir, item);

    try {
        // Check if source is locked or busy
        fs.renameSync(sourcePath, destPath);
        console.log(`Moved ${item} to client/${item}`);
    } catch (err) {
        console.error(`Failed to move ${item}: ${err.message}`);
    }
});
