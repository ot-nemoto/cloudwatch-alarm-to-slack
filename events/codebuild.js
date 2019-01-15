'use strict';

const template = require("./../utils/template");
const slack = require("./../utils/slack");

const AWS = require('aws-sdk');
const FS = require('fs');

const URL = "https://{region}.console.aws.amazon.com/codesuite/codebuild/projects/{projectName}/build/{buildId}/log";

const enabledValues = ['ON', 'On', 'on', 'TRUE', 'True', 'true', '1'];

module.exports.handler = function(event, context) {

  console.log(JSON.stringify(event));

  var codebuild = new AWS.CodeBuild();
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

  var params = {names: [ templateParams['project-name'] ]};

  codebuild.batchGetProjects(params, function(err, data) {
    if (err) { console.log(err, err.stack); return; }
    if (!data.projects.length) return;

    // tags
    data.projects[0].tags.forEach(function(h) {
      templateParams[h.key] = h.value;
    });
    if (!templateParams[templateParams.tag_name] || !enabledValues.includes(templateParams[templateParams.tag_name])) return;

    // url
    templateParams['url'] = template.format(URL, {
      region: event.region,
      projectName: templateParams['project-name'],
      buildId: templateParams['build-id'].split('/')[1]
    });

    console.log(JSON.stringify(templateParams));

    slack.request({
      text: template.format(FS.readFileSync(process.env['template_path'], {encoding: "utf-8"}), templateParams).trim(),
      parse: "none"
    });
  });
};
