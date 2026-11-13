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
      choiceOption("action", "実行する操作", [
        { name: "確認", value: "view" }, { name: "追加", value: "add" },
        { name: "削除", value: "delete" }, { name: "すべて削除", value: "clear" }
      ]),
      stringOption("key", "記憶の名前（追加・削除時）", false, { max_length: 64 }),
      stringOption("value", "保存する内容（追加時）", false, { max_length: 500 })
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
      choiceOption("action", "実行する操作", [
        { name: "確認", value: "view" }, { name: "変更", value: "set" }
      ]),
      choiceOption("key", "変更する設定", [
        { name: "言語", value: "language" },
        { name: "応答スタイル", value: "response_style" },
        { name: "記憶機能", value: "memory_enabled" }
      ], false),
      stringOption("value", "設定値（例：ja / concise / true）", false, { max_length: 30 })
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
