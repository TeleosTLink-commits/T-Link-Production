// Simple script to make Cloudinary files public using curl/https
const https = require('https');
const querystring = require('querystring');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'di7yyu1mx';
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const AUTH = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

async function updateResource(publicId) {
  return new Promise((resolve) => {
    const data = querystring.stringify({
      access_control: JSON.stringify([{ access_type: 'public' }])
    });

    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUD_NAME}/resources/image/upload/${publicId}`,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${AUTH}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        console.log(`${ok ? '✓' : '✗'} ${publicId}: ${res.statusCode}`);
        resolve(ok);
      });
    });

    req.on('error', (e) => {
      console.log(`✗ ${publicId}: ${e.message}`);
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  const publicIds = [
    'tlink/samples/coa/file-1767654726339-78493610_eifb0n',
    'tlink/samples/coa/file-1767656405204-117923934_b1mzoe',
    'tlink/samples/coa/file-1767654697569-456700434_b3m6e2',
    'tlink/samples/sds/file-1767654172662-912846261_xmujyx',
    'tlink/samples/sds/file-1767650034841-615227318_i5i55s',
    'tlink/samples/sds/file-1767650643260-823494725_dw6d40',
    'tlink/samples/sds/file-1767653674384-451772952_rqecy',
    'tlink/samples/sds/file-1767653973049-574798339_uxtaep',
    'tlink/samples/sds/file-1767656472618-657104555_dgawk4'
  ];

  console.log(`Making ${publicIds.length} files public...\n`);
  
  let updated = 0;
  for (const id of publicIds) {
    if (await updateResource(id)) updated++;
    await new Promise(r => setTimeout(r, 500)); // Rate limiting
  }

  console.log(`\nSuccess: ${updated}/${publicIds.length} files updated`);
  process.exit(updated === publicIds.length ? 0 : 1);
}

main();
