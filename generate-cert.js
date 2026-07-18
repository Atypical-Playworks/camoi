// Genera un certificado autofirmado (cert.pem/key.pem) válido para las IPs
// de tu red local, para poder usar HTTPS sin dominio real.
const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

function getLocalIPs() {
  const ifaces = os.networkInterfaces();
  const ips = ['127.0.0.1'];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return [...new Set(ips)];
}

const ips = getLocalIPs();
console.log('IPs locales detectadas:', ips.join(', '));

const altNames = ips.map((ip, i) => `IP.${i + 1} = ${ip}`).join('\n');

const opensslConfig = `
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = iphone-webcam-bridge.local

[v3_req]
keyUsage = keyEncipherment, dataEncipherment, digitalSignature
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
${altNames}
`;

const configPath = path.join(__dirname, 'openssl.cnf');
fs.writeFileSync(configPath, opensslConfig);

execSync(
  `openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 825 -nodes -config openssl.cnf`,
  { cwd: __dirname, stdio: 'inherit' }
);

fs.unlinkSync(configPath);

console.log('\n✅ Certificado generado: cert.pem / key.pem');
console.log('   Válido para:', ips.join(', '));
