async function test() {
  const res = await fetch('http://localhost:3000/api/insumos?descricao=cimento');
  const data = await res.json();
  console.log(data.slice(0, 3));
}
test();
