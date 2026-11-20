// Copia as figuras da raiz do projeto (../img) para public/img.
// As perguntas já não vão no site: são servidas pelo Supabase (tabela questoes), só a quem tem licença.
import { cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..');
const pub = join(aqui, '..', 'public');

rmSync(join(pub, 'img'), { recursive: true, force: true });
rmSync(join(pub, 'data'), { recursive: true, force: true }); // versões antigas
cpSync(join(raiz, 'img'), join(pub, 'img'), { recursive: true });
console.log('Figuras copiadas para public/img');
