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

const TASK_DEFINITION_URL = "https://{region}.console.aws.amazon.com/ecs/home#/taskDefinitions/{taskDefinitionName}/{revision}";
const TASK_URL = "https://{region}.console.aws.amazon.com/ecs/home#/clusters/{clusterName}/tasks/{taskId}/details";

module.exports.handler = function(event, context) {

  if (event.detail.lastStatus != event.detail.desiredStatus) return;

  // event detail => template params
  var templateParams = {};
  Object.keys(event.detail).forEach(function(key) {
    templateParams[key] = this[key];
    if (key.match(/.+Arn$/)) {
      var arnValue = this[key].split(`${event.account}:`).pop();
      templateParams[arnValue.split("/")[0]] = arnValue.split("/")[1];
    }
  }, event.detail);

  var taskDefinition = templateParams['task-definition'];

  var ecs = new AWS.ECS();
  var tagName = process.env['tag_name'];
  var enabledValues = ['ON', 'On', 'on', 'TRUE', 'True', 'true', '1'];
  var params = {
    taskDefinition: `${taskDefinition}`,
    include: [ "TAGS" ]
  };

  ecs.describeTaskDefinition(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      data.tags.forEach(function(h) {
        templateParams[h.key] = h.value;
      });
      if (!templateParams[tagName] || !enabledValues.includes(templateParams[tagName])) return;

      // service url
      templateParams['task_url'] = format(TASK_URL, {
        region: event.region,
        clusterName: templateParams['cluster'],
        taskId: templateParams['task']
      });
      templateParams['task_definition_url'] = format(TASK_DEFINITION_URL, {
        region: event.region,
        taskDefinitionName: templateParams['task-definition'].split(':')[0],
        revision: templateParams['task-definition'].split(':')[1]
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
