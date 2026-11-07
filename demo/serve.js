// Tiny static server for the exported web build (dist/) plus the demo recording frame.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'dist');
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf' };
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/__frame') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return fs.createReadStream(path.join(__dirname, 'frame.html')).pipe(res);
  }
  let p = path.join(root, url);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(8081, () => console.log('http://localhost:8081'));
