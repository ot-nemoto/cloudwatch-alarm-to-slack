'use strict';

const template = require("./../utils/template");
const slack = require("./../utils/slack");

const AWS = require('aws-sdk');
const FS = require('fs');

const URL = "https://{region}.console.aws.amazon.com/ec2/v2/home#Instances:instanceId={instanceId}";

module.exports.handler = function(event, context) {

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
      // service url
      templateParams['url'] = template.format(URL, {
        region: event.region,
        instanceId: instanceId
      });

      console.log(templateParams);

      slack.request({
        text: template.format(FS.readFileSync(process.env['template_path'], {encoding: "utf-8"}), templateParams).trim(),
        parse: "none"
      });
    }
  });
};
