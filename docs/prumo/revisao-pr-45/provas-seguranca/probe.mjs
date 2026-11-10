import { readFileSync } from 'node:fs';
import { matrizesDeJson, validarAba } from '<raiz-do-repositório>/src/domain/sheet.js';
const f = process.argv[2];
const r = matrizesDeJson(JSON.parse(readFileSync(f,'utf8')));
for (const [k,m] of Object.entries(r.matrizes)) { try { const v = validarAba(k,m); console.log(k, 'itens', v.itens.length, 'erros', v.erros.length); v.itens.slice(0,12).forEach(i=>console.log('  ', JSON.stringify(i).slice(0,160))); } catch(e) { console.log(k,'THROW',e.constructor.name, e.message); } }
console.log('proto poluido?', ({}).polui, Object.prototype.polui);
