import http from 'http';

http.get('http://localhost:3000/api/obras/1/cronograma-config', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        console.log("Response:", data.substring(0, 100));
    });
}).on('error', err => {
    console.error(err);
});
