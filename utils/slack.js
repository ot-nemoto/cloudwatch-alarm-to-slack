const HTTPS = require('https');

function request (messageParams) {
  let message = JSON.stringify(messageParams);

  let options = {
    hostname: 'hooks.slack.com',
    port: 443,
    path: process.env['slack_path'],
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(message)
    }
  };

  let req = HTTPS.request(options, (res) => {
    console.log('statusCode:', res.statusCode);
    console.log('headers:', res.headers);
    res.setEncoding('utf8');
    res.on('data', (d) => {
      console.log(d);
    });
  });

  req.on('error', (e) => {
    console.error(e)
  ;});

  req.write(message);
  req.end();
}

exports.request = request;
