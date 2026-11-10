import { readFileSync } from 'node:fs';
import { matrizesDeJson, validarAba } from '<raiz-do-repositório>/src/domain/sheet.js';
const t=Date.now(); const r = matrizesDeJson(JSON.parse(readFileSync('provas-seguranca/gigante.json','utf8')));
const v = validarAba('cities', r.matrizes.cities);
console.log('linhas', r.matrizes.cities.length, 'itens', v.itens.length, 'ms', Date.now()-t, 'heapMB', Math.round(process.memoryUsage().heapUsed/1e6));
