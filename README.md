# cloudwatch-alarm-to-slack

### 概要

- 各サービスのステータスが変わった際にSlackへ通知を行う。
- デフォルトのリージョンは東京（ap-northeast-1）。
- EC2で通知対象となるステータスは起動時(running)と停止時(stopped)。
- CodeBuildで通知対象となるステータスは FAILED, IN_PROGRESS, STOPPED, SUCCEEDED。

### 使い方

- 通知対象のEC2インスタンスに `cloudwatch-alarm-to-slack-isenabled` タグを付与。
- タグの値には `ON`, `TRUE`, `1` の何れかを設定。
- CodeBuildは現時点でマネージドコンソールからタグを付ける方法が不明なため、aws-cli で設定
```sh
aws codebuild update-project --name <projectName> --tags key=cloudwatch-alarm-to-slack-isenabled,value=1
```
- 通知対象から外したい場合はタグを削除。またはタグの値に上記以外を設定。
- 通知したいSlackでIncoming-webhookを有効にし、*Webhook URL* を発行。
- 発行した *Webhook URL* を serverless.yml の `slack_path` に *Webhook URL* のホスト名以降（`/services/***/***/***`）の値を設定。
- デプロイ

*serverless*
```sh
serverless deploy
```

### Slackへの通知内容を変更したい

- `templates/events/` 配下のテンプレートファイルを修正します。
- `{}` でEC2インスタンス内の値に置換出来ます。
- `{}` で指定できる値は、CloudWatchLogs で発行しているサンプルイベントの detail 以下の値。`url`。サービスに紐づくタグの値が指定可能。
- `{}` に指定できる文字は半角英数＋アンスコ＋ハイフン。
- `{aaa|bbb}` のようにパイプで区切ると、aaa がなければ bbb を参照。
