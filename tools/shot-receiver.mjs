// weapon-shots.html이 렌더한 dataURL을 받아 PNG로 떨어뜨리는 일회용 수신기.
// 캡처는 브라우저에서만 가능한데(WebGL), 결과를 파일로 옮기려면 통로가 필요해서 둔다.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const PORT = 5199;
const OUT_DIR = 'game/public/images/weapons';

fs.mkdirSync(OUT_DIR, { recursive: true });

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const { id, dataUrl } = JSON.parse(body);
      if (!/^[a-z0-9_-]+$/i.test(id)) throw new Error(`unsafe id: ${id}`);
      const base64 = dataUrl.split(',')[1];
      const file = path.join(OUT_DIR, `${id}.png`);
      fs.writeFileSync(file, Buffer.from(base64, 'base64'));
      console.log(`wrote ${file} (${fs.statSync(file).size} bytes)`);
      res.writeHead(200).end('ok');
    } catch (error) {
      console.error(`failed: ${error.message}`);
      res.writeHead(400).end(error.message);
    }
  });
});

server.listen(PORT, () => console.log(`shot receiver listening on ${PORT}`));
