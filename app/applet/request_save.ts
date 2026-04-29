import http from 'http';

const data = JSON.stringify({
  changes: {
    "1-1": 10 // Assuming medicao 1, orc_item 1
  }
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/obras/1/medicao-itens',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (c) => console.log(c.toString()));
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
