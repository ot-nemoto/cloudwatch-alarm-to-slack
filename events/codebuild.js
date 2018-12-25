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

const URL = "https://{region}.console.aws.amazon.com/codesuite/codebuild/projects/{projectName}/build/{buildId}/log"

module.exports.handler = function(event, context) {

  // event detail => template params
  var templateParams = {};
  Object.keys(event.detail).forEach(function(key) {
    templateParams[key] = this[key];
  }, event.detail);

  var projectName = templateParams['project-name'];

  var codebuild = new AWS.CodeBuild();
  var tagName = process.env['tag_name'];
  var enabledValues = ['ON', 'On', 'on', 'TRUE', 'True', 'true', '1'];
  var params = {names: [ `${projectName}` ]};

  codebuild.batchGetProjects(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      if (!data.projects.length) return;
      // tags => template params
      data.projects[0].tags.forEach(function(h) {
        templateParams[h.key] = h.value;
      });
      if (!templateParams[tagName] || !enabledValues.includes(templateParams[tagName])) return;
      // service url
      templateParams['url'] = format(URL, {
        region: event.region,
        projectName: projectName,
        buildId: templateParams['build-id'].split('/')[1]
      });
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
