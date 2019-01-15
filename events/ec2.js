'use strict';

const template = require("./../utils/template");
const slack = require("./../utils/slack");

const AWS = require('aws-sdk');
const FS = require('fs');

const URL = "https://{region}.console.aws.amazon.com/ec2/v2/home#Instances:instanceId={instanceId}";

const enabledValues = ['ON', 'On', 'on', 'TRUE', 'True', 'true', '1'];

module.exports.handler = function(event, context) {

  console.log(JSON.stringify(event));

  var ec2 = new AWS.EC2();
  var templateParams = {};

  // process.env
  Object.keys(process.env).forEach(function(key) {
    templateParams[key] = this[key];
  }, process.env);

  // event.detail
  Object.keys(event.detail).forEach(function(key) {
    templateParams[key] = this[key];
    if (key == "state") templateParams["is_" + this[key]] = 1;
  }, event.detail);

  var params = {
    InstanceIds: [ templateParams['instance-id'] ],
    Filters: [{ Name: `tag:${templateParams.tag_name}`, Values: enabledValues }]
  };

  ec2.describeInstances(params, function(err, data) {
    if (err) { console.log(err, err.stack); return }
    if (!data.Reservations.length) return;

    // tags
    data.Reservations[0].Instances[0].Tags.forEach(function(h) {
      templateParams[h.Key] = h.Value;
    });
    // url
    templateParams['url'] = template.format(URL, {
      region: event.region,
      instanceId: templateParams['instance-id']
    });

    console.log(JSON.stringify(templateParams));

    slack.request({
      text: template.format(FS.readFileSync(process.env['template_path'], {encoding: "utf-8"}), templateParams).trim(),
      parse: "none"
    });
  });
};
