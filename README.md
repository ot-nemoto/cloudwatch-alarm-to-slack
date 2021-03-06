# cloudwatch-alarm-to-slack

## 概要

- 各サービスのステータスが変わった際にSlackへ通知を行う。
- デフォルトのリージョンは東京（ap-northeast-1）。
- 各サービスの通知対象
  - EC2: EC2 Instance State-change Notification (`running`, `stopped`)
  - CodeBuild: CodeBuild Build State Change (`FAILED`, `IN_PROGRESS`, `STOPPED`, `SUCCEEDED`)
  - ECS: ECS Task State Change
  - CodePipeline: CodePipeline Pipeline Execution State Change (`CANCELED`, `FAILED`, `RESUMED`, `STARTED`, `SUCCEEDED`, `SUPERSEDED`)

## 使い方

### 通知対象を設定

#### EC2

- EC2 > インスタンス > `Instance` > タグ
- `cloudwatch-alarm-to-slack-isenabled` タグを設定。
- タグの値には `ON`, `TRUE`, `1` の何れかを設定。

#### CodeBuild

- CodeBuild > ビルドプロジェクト > `Build Project` > ビルドの詳細 > プロジェクトの設定 > 編集
- `cloudwatch-alarm-to-slack-isenabled` タグを設定。
- タグの値には `ON`, `TRUE`, `1` の何れかを設定。

#### CodePipeline

- 現時点でタグの設定がないため、全てのCodePipelineイベントを拾う

#### ECS

- ECS > クラスター > `cluster` > Tags
- `cloudwatch-alarm-to-slack-isenabled` タグを設定。
- タグの値には `ON`, `TRUE`, `1` の何れかを設定。

---

- 通知対象から外したい場合はタグを削除。またはタグの値に上記以外を設定。

### 通知先のSlackの設定

- 通知したいSlackでIncoming-webhookを有効にし、*Webhook URL* を発行。
- 発行した *Webhook URL* を config.yml を作成し、`slack_path` に *Webhook URL* のホスト名以降（`/services/***/***/***`）の値を設定。

```sh
echo 'slack_path: /services/***/***/***' > config.yml
```

### デプロイ

*serverless*
```sh
(cd layer/nodejs; npm install)
serverless deploy
```

## その他

### Slackへの通知内容を変更したい

- `templates/events/` 配下のテンプレートファイルを修正します。
- `{}` でEC2インスタンス内の値に置換出来ます。
- `{}` で指定できる値
  - EC2: `instance-id`, `state`, `url`, `is_<state>` + Tags + Process.env
  - CodeBuild: `build-status`, `project-name`, `build-id`, `url`, `is_<build-status>` + Tags + Process.env
  - ECS: `clusterArn`, `cluster`, `lastStatus`, `taskArn`, `task`, `taskDefinitionArn`, `taskDefinition`, `task_url`, `task_definition_url`, `is_<lastStatus>` + Tags + Process.env
  - CodePipeline: `pipeline`, `execution-id`, `state`, `url`, `flow`, `is_<state>` + Process.env
- `{aaa|bbb}` のようにパイプで区切ると、aaa がなければ bbb を参照。
- `{!aaa|bbb}` のように感嘆符が先頭にある場合、aaa が存在すれば bbb を参照。
