import http from 'http';

http.get('http://localhost:3000/api/obras/undefined/cronograma-config', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("Status:", res.statusCode);
        console.log("Headers:", res.headers['content-type']);
        console.log("Response:", data.substring(0, 100));
    });
}).on('error', err => {
    console.error(err);
});
