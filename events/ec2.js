'use strict';

const AWS = require('aws-sdk');
const HTTPS = require('https');
const FS = require('fs');

function format(msg, obj) {
  return msg.replace(/\{([\w|\||_|-]+)\}/g, function (m, k) {
    let rt = obj[k] || '';
    k.split('|').some(function(key) {
      if (key && obj[key]) { rt = obj[key]; return true; }
    });
    return rt;
  });
}

const EC2_URL = "https://{region}.console.aws.amazon.com/ec2/v2/home#Instances:instanceId={instanceId}";

module.exports.handler = function(event, context) {

  // event detail => template params
  var templateParams = {};
  Object.keys(event.detail).forEach(function(key) {
    templateParams[key] = this[key];
  }, event.detail);
  
  var instanceId = templateParams['instance-id'];

  var ec2 = new AWS.EC2();
  var tagName = process.env['tag_name'];
  var params = {
    InstanceIds: [ `${instanceId}` ],
    Filters: [{Name: `tag:${tagName}`, Values: ['ON', 'On', 'on', 'TRUE', 'True', 'true', '1']}]
  };

  ec2.describeInstances(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      if (!data.Reservations.length) return;
      // tags => template params
      data.Reservations[0].Instances[0].Tags.forEach(function(h) {
        templateParams[h.Key] = h.Value;
      });
      templateParams['url'] = format(EC2_URL, {region: event.region, instanceId: instanceId});
      console.log(templateParams);
      
      // Slack Message
      let message = JSON.stringify(
        {
          "text": format(FS.readFileSync(process.env['template_path'], {encoding: "utf-8"}), templateParams).trim(),
          "parse": "none"
        }
      );

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
  });
};
