'use strict';

const template = require("./../utils/template");
const slack = require("./../utils/slack");

const AWS = require('aws-sdk');
const FS = require('fs');

const URL = "https://{region}.console.aws.amazon.com/codesuite/codebuild/projects/{projectName}/build/{buildId}/log"

module.exports.handler = function(event, context) {

  var templateParams = {};

  // process.env
  Object.keys(process.env).forEach(function(key) {
    templateParams[key] = this[key];
  }, process.env);

  // event.detail
  Object.keys(event.detail).forEach(function(key) {
    templateParams[key] = this[key];
    if (key == "build-status") templateParams["is_" + this[key]] = 1;
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
      templateParams['url'] = template.format(URL, {
        region: event.region,
        projectName: projectName,
        buildId: templateParams['build-id'].split('/')[1]
      });

      console.log(templateParams);
      
      slack.request({
        text: template.format(FS.readFileSync(process.env['template_path'], {encoding: "utf-8"}), templateParams).trim(),
        parse: "none"
      });
    }
  });
};
