const http = require("http");
const fs = require("fs");
const path = require("path");

const port = process.env.PORT || 8080;
const root = __dirname;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

http.createServer((req, res) => {
  let filePath = req.url === "/" ? "/WEMOweb-C33.html" : req.url;
  filePath = path.join(root, decodeURIComponent(filePath.split("?")[0]));

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}).listen(port, () => console.log(`Static server on http://localhost:${port}`));
