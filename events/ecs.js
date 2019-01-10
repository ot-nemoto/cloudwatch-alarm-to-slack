'use strict';

const template = require("./../utils/template");
const slack = require("./../utils/slack");

const AWS = require('aws-sdk');
const FS = require('fs');

const TASK_DEFINITION_URL = "https://{region}.console.aws.amazon.com/ecs/home#/taskDefinitions/{taskDefinitionName}/{revision}";
const TASK_URL = "https://{region}.console.aws.amazon.com/ecs/home#/clusters/{clusterName}/tasks/{taskId}/details";

const enabledValues = ['ON', 'On', 'on', 'TRUE', 'True', 'true', '1'];

module.exports.handler = function(event, context) {

  console.log(JSON.stringify(event));

  if (event.detail.lastStatus != event.detail.desiredStatus) return;

  var ecs = new AWS.ECS();
  var templateParams = {};

  // process.env
  Object.keys(process.env).forEach(function(key) {
    templateParams[key] = this[key];
  }, process.env);

  // event.detail
  Object.keys(event.detail).forEach(function(key) {
    templateParams[key] = this[key];
    if (key.match(/.+Arn$/)) {
      var arnValue = this[key].split(`${event.account}:`).pop();
      templateParams[arnValue.split("/")[0]] = arnValue.split("/")[1];
    }
    if (key == "lastStatus") templateParams["is_" + this[key]] = 1;
  }, event.detail);

  var params = {clusters: [ templateParams.cluster ]};

  ecs.describeClusters(params, function(err, data) {
    if (err) { console.log(err, err.stack); return; }

    ecs.listTagsForResource({ resourceArn: data.clusters[0].clusterArn }, function(err, data) {
      if (err) { console.log(err, err.stack); return; }

      // tags
      data.tags.forEach(function(h) {
        templateParams[h.key] = h.value;
      });
      if (!templateParams[templateParams.tag_name] || !enabledValues.includes(templateParams[templateParams.tag_name])) return;

      // task_url
      templateParams['task_url'] = template.format(TASK_URL, {
        region: event.region,
        clusterName: templateParams.cluster,
        taskId: templateParams['task']
      });

      // task_definition_url
      templateParams['task_definition_url'] = template.format(TASK_DEFINITION_URL, {
        region: event.region,
        taskDefinitionName: templateParams['task-definition'].split(':')[0],
        revision: templateParams['task-definition'].split(':')[1]
      });

      console.log(templateParams);

      slack.request({
        text: template.format(FS.readFileSync(process.env['template_path'], {encoding: "utf-8"}), templateParams).trim(),
        parse: "none"
      });
    });
  });
};
