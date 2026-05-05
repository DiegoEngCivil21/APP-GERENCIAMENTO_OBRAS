fetch('http://localhost:3000/api/composicoes/6/subitens?estado=DF&data_referencia=2026-05')
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
