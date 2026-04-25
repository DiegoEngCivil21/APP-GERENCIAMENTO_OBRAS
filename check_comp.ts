import Database from 'better-sqlite3';

const db = new Database('obras.db');

const comp = db.prepare("SELECT * FROM v2_itens WHERE codigo = '88404'").get() as any;
console.log("Composicao:", comp.codigo);

const precoSalvo = db.prepare(`
  SELECT preco_unitario FROM v2_precos 
  WHERE item_id = ? AND tipo_desoneracao = 'Não Desonerado'
  ORDER BY data_referencia DESC LIMIT 1
`).get(comp.id) as any;
console.log(`Preco Salvo no DB para ${comp.codigo}: ${precoSalvo ? precoSalvo.preco_unitario : 'N/A'}`);
