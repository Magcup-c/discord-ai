const applicationId = process.env.DISCORD_APPLICATION_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!applicationId || !botToken) {
  console.error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN before registering commands.");
  process.exit(1);
}

const stringOption = (name, description, required = true, extra = {}) => ({
  type: 3, name, description, required, ...extra
});
const choiceOption = (name, description, choices, required = true) => ({
  type: 3, name, description, required, choices
});

const commands = [
  { name: "help", description: "コマンド一覧と使い方を表示します" },
  {
    name: "connect",
    description: "外部サービスの個人アカウントを連携します",
    options: [
      choiceOption("provider", "連携するサービス", [
        { name: "Google", value: "google" }
      ])
    ]
  },
  {
    name: "connections",
    description: "自分の外部サービス連携状況を確認します"
  },
  {
    name: "disconnect",
    description: "外部サービスとの個人連携を解除します",
    options: [
      choiceOption("provider", "切断するサービス", [
        { name: "Google", value: "google" }
      ])
    ]
  },
  {
    name: "ask",
    description: "AIアシスタントに質問します",
    options: [
      stringOption("prompt", "質問や依頼", true, { max_length: 1500 }),
      { type: 11, name: "image", description: "解析する画像（JPEG・PNG・WebP、10MB以下）", required: false }
    ]
  },
  {
    name: "gas",
    description: "Google Apps Script連携を管理します",
    options: [
      {
        type: 1, name: "connect", description: "個人用GASを接続します",
        options: [stringOption("endpoint", "GAS WebアプリURL", true, { max_length: 500 })]
      },
      { type: 1, name: "disconnect", description: "個人用GAS接続を解除します" },
      { type: 1, name: "connections", description: "個人用・共有GASの接続状態を表示します" },
      {
        type: 1, name: "test", description: "GAS接続テストを実行します",
        options: [choiceOption("scope", "テスト対象", [
          { name: "個人用", value: "personal" },
          { name: "共有", value: "shared" }
        ], false)]
      }
    ]
  },
  { name: "forget", description: "このチャンネルで自分の会話履歴を削除します" },
  {
    name: "memory",
    description: "AIの記憶を確認・管理します",
    options: [
      { type: 1, name: "view", description: "保存されている記憶を一覧表示します" },
      {
        type: 1, name: "add", description: "新しい記憶を保存します",
        options: [
          stringOption("key", "記憶の名前", true, { max_length: 64 }),
          stringOption("value", "保存する内容", true, { max_length: 500 })
        ]
      },
      {
        type: 1, name: "delete", description: "指定した記憶を削除します",
        options: [stringOption("key", "削除する記憶の名前", true, { max_length: 64 })]
      },
      { type: 1, name: "clear", description: "保存されている記憶をすべて削除します" }
    ]
  },
  {
    name: "function",
    description: "登録済みの標準関数を確認・実行します",
    options: [
      { type: 1, name: "list", description: "使用可能な関数一覧を表示します" },
      {
        type: 1, name: "info", description: "関数の説明と引数を表示します",
        options: [choiceOption("function", "確認する関数", [
          { name: "計算", value: "calculate" },
          { name: "割合計算", value: "percentage" },
          { name: "統計", value: "statistics" },
          { name: "単位変換", value: "unit_convert" },
          { name: "JSON整形", value: "json_format" },
          { name: "JSON検証", value: "json_validate" },
          { name: "CSV解析", value: "csv_parse" },
          { name: "CSVからJSON", value: "csv_to_json" },
          { name: "日付差分", value: "date_difference" }
        ])]
      },
      {
        type: 1, name: "run", description: "標準関数を実行します",
        options: [
          choiceOption("function", "実行する関数", [
            { name: "計算", value: "calculate" },
            { name: "割合計算", value: "percentage" },
            { name: "統計", value: "statistics" },
            { name: "単位変換", value: "unit_convert" },
            { name: "JSON整形", value: "json_format" },
            { name: "JSON検証", value: "json_validate" },
            { name: "CSV解析", value: "csv_parse" },
            { name: "CSVからJSON", value: "csv_to_json" },
            { name: "日付差分", value: "date_difference" }
          ]),
          stringOption("arguments", "引数をJSON形式で指定（例：{\"value\":100,\"percent\":15}）", false, { max_length: 1500 })
        ]
      }
    ]
  },
  { name: "tools", description: "現在使用可能なツール一覧を表示します" },
  {
    name: "search",
    description: "Web検索を実行します",
    options: [stringOption("query", "検索キーワード", true, { max_length: 300 })]
  },
  {
    name: "settings",
    description: "個人設定を確認・変更します",
    options: [
      { type: 1, name: "view", description: "現在の設定を表示します" },
      {
        type: 1, name: "language", description: "応答言語を変更します",
        options: [choiceOption("value", "応答言語", [
          { name: "日本語", value: "ja" }, { name: "English", value: "en" }
        ])]
      },
      {
        type: 1, name: "style", description: "応答の詳しさを変更します",
        options: [choiceOption("value", "応答スタイル", [
          { name: "簡潔", value: "concise" },
          { name: "標準", value: "balanced" },
          { name: "詳しい", value: "detailed" }
        ])]
      },
      {
        type: 1, name: "memory", description: "AIが保存した記憶を回答に使うか設定します",
        options: [{ type: 5, name: "enabled", description: "記憶機能を有効にする", required: true }]
      }
    ]
  },
  {
    name: "usage",
    description: "API使用量を確認します",
    options: [
      choiceOption("period", "集計期間", [
        { name: "過去7日", value: "7" },
        { name: "過去30日", value: "30" },
        { name: "過去90日", value: "90" }
      ], false)
    ]
  }
];

const response = await fetch(
  `https://discord.com/api/v10/applications/${applicationId}/commands`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands)
  }
);

const body = await response.text();
if (!response.ok) {
  console.error("Command registration failed:", response.status, body);
  process.exit(1);
}
console.log("Discord slash commands registered:", body);
