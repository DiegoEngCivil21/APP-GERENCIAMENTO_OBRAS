import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => {
    // Just print the first 100 chars
    process.stdout.write(d.toString().substring(0, 100));
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
});

req.end();
