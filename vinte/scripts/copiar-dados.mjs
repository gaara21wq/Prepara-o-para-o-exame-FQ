// Copia o banco de questões e as figuras da raiz do projeto para public/,
// para haver uma só fonte de verdade (../questoes.json, ../questoes-mat.json, ../img).
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..');
const pub = join(aqui, '..', 'public');

mkdirSync(join(pub, 'data'), { recursive: true });
cpSync(join(raiz, 'questoes.json'), join(pub, 'data', 'fq.json'));
cpSync(join(raiz, 'questoes-mat.json'), join(pub, 'data', 'mat.json'));
rmSync(join(pub, 'img'), { recursive: true, force: true });
cpSync(join(raiz, 'img'), join(pub, 'img'), { recursive: true });
console.log('Dados copiados para public/ (fq.json, mat.json, img/)');
