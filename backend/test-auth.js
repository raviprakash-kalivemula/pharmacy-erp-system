const http = require('http');

const postData = JSON.stringify({
  username: 'admin',
  password: 'Admin@123'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing POST /auth/login...');
console.log('Request Body:', postData);

const req = http.request(options, (res) => {
  let data = '';
  
  console.log(`\nStatus: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  res.on('data', (chunk) => { 
    data += chunk; 
  });
  
  res.on('end', () => {
    console.log('\nResponse Body:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request Error:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();

// Timeout after 5 seconds
setTimeout(() => {
  console.error('\n❌ Request timeout');
  process.exit(1);
}, 5000);
