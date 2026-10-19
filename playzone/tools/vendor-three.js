// Copie Three.js depuis node_modules vers vendor/ : le client n'a besoin d'aucune étape de compilation
// et ne dépend d'aucun CDN (le jeu marche hors ligne et sur n'importe quel hébergement statique).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'three');
const out = join(root, 'vendor');
mkdirSync(out, { recursive: true });
for (const f of ['three.module.min.js', 'three.core.min.js']) copyFileSync(join(src, 'build', f), join(out, f));
copyFileSync(join(src, 'LICENSE'), join(out, 'THREE-LICENSE.txt'));
const { version } = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8'));
writeFileSync(join(out, 'VERSION.txt'), `three ${version}\n`);
console.log(`three ${version} copié dans vendor/`);
