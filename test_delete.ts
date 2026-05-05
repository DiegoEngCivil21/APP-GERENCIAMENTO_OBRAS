fetch('http://localhost:3000/api/composicoes/6/subitens/1?estado=DF&data_referencia=2026-05', {
  method: 'DELETE',
})
  .then(res => res.json().then(j => ({status: res.status, body: j})))
  .then(console.log)
  .catch(console.error);
