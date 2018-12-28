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

const CODEPIPELINE_URL = "https://{region}.console.aws.amazon.com/codepipeline/home#/view/{pipeline}";
const GITHUB_URL = "https://github.com/{owner}/{repo}/tree/{branch}";
const CODEBUILD_URL = "https://{region}.console.aws.amazon.com/codebuild/home#/projects/{projectName}/view";
const ECS_URL = "https://{region}.console.aws.amazon.com/ecs/home#/clusters/{clusterName}/services/{serviceName}/details";

module.exports.handler = function(event, context) {

  // event detail => template params
  var templateParams = {};
  Object.keys(event.detail).forEach(function(key) {
    templateParams[key] = this[key];
  }, event.detail);
  templateParams['url'] = format(CODEPIPELINE_URL, { region: event.region, pipeline: templateParams['pipeline'] });

  var codepipeline = new AWS.CodePipeline();
  
  codepipeline.getPipeline({ name: templateParams['pipeline'], version: templateParams['version'] }, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      var stages = [];
      data.pipeline.stages.forEach(function(stage) {
        var actions = [];
        stage.actions.forEach(function(action) {
          switch (action.actionTypeId.provider){
            case 'GitHub':
              actions.push(format("<{url}|GitHub>", {
                url: format(GITHUB_URL, {
                  owner: action.configuration['Owner'],
                  repo: action.configuration['Repo'],
                  branch: action.configuration['Branch']
                })
              }));
              break;
            case 'CodeBuild':
              actions.push(format("<{url}|CodeBuild>", {
                url: format(CODEBUILD_URL, {
                  region: event.region,
                  projectName: action.configuration['ProjectName']
                })
              }));
              break;
            case 'ECS':
              actions.push(format("<{url}|ECS>", {
                url: format(ECS_URL, {
                  region: event.region,
                  clusterName: action.configuration['ClusterName'],
                  serviceName: action.configuration['ServiceName']
                })
              }));
              break;
          }
        });
        stages.push(format("_{name}_ ( {actions} )", {
          name: stage.name,
          actions: actions.join(" | ")
        }));
      });
      templateParams['flow'] = stages.join(" :arrow_right: ");
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
