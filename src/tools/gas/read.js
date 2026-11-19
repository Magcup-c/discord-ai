import { getGasConnection } from "../../integrations/gas-connections.js";
import { executeGasAction } from "../../integrations/gas-client.js";

const READ_ACTIONS = new Set([
  "sheets.read", "sheets.search", "sheets.info",
  "drive.search", "drive.info", "drive.read",
  "calendar.list", "calendar.search"
]);

async function callGas(args, context, action, payload) {
  if (!context?.env || !context?.userId) throw new Error("GASを利用するユーザー情報がありません。");
  if (!READ_ACTIONS.has(action)) throw new Error("読み取り専用のGAS操作ではありません。");
  const scope = args.scope || "personal";
  const connection = await getGasConnection(context.env.DB, context.env, context.userId, scope);
  if (!connection) {
    throw new Error(scope === "shared"
      ? "共有GASが設定されていません。管理者に確認してください。"
      : "個人用GASが接続されていません。/gas connect で接続してください。");
  }
  const response = await executeGasAction(connection, action, payload);
  return response.result ?? response.data ?? response;
}

function schema(properties, required = []) {
  return { type: "object", properties, required, additionalProperties: false };
}
const scopeSchema = {
  type: "string", enum: ["personal", "shared"],
  description: "接続先。既定は personal（自分の接続）です。"
};
const idSchema = { type: "string", minLength: 1, maxLength: 300 };
const querySchema = { type: "string", minLength: 1, maxLength: 500 };

export function registerGasReadTools(registerTool) {
  registerTool({
    type: "function",
    function: {
      name: "gas_sheets_read",
      description: "接続されたGASを通じてGoogle Sheetsの指定範囲を読み取ります。読み取り専用。spreadsheetIdとrangeが必要です。",
      parameters: schema({
        scope: scopeSchema,
        spreadsheetId: idSchema,
        range: { type: "string", minLength: 1, maxLength: 300 }
      }, ["spreadsheetId", "range"])
    }
  }, (args, context) => callGas(args, context, "sheets.read", {
    spreadsheetId: args.spreadsheetId, range: args.range
  }));

  registerTool({
    type: "function",
    function: {
      name: "gas_sheets_search",
      description: "Google Sheets内の文字列を検索します。spreadsheetIdと検索語が必要です。読み取り専用。",
      parameters: schema({
        scope: scopeSchema,
        spreadsheetId: idSchema,
        query: querySchema,
        range: { type: "string", maxLength: 300 }
      }, ["spreadsheetId", "query"])
    }
  }, (args, context) => callGas(args, context, "sheets.search", {
    spreadsheetId: args.spreadsheetId, query: args.query, ...(args.range ? { range: args.range } : {})
  }));

  registerTool({
    type: "function",
    function: {
      name: "gas_sheets_info",
      description: "Google Sheetsのシート名や構造などの情報を取得します。読み取り専用。",
      parameters: schema({ scope: scopeSchema, spreadsheetId: idSchema }, ["spreadsheetId"])
    }
  }, (args, context) => callGas(args, context, "sheets.info", {
    spreadsheetId: args.spreadsheetId
  }));

  registerTool({
    type: "function",
    function: {
      name: "gas_drive_search",
      description: "Google Driveのファイルを検索します。読み取り専用。検索語を指定してください。",
      parameters: schema({
        scope: scopeSchema,
        query: querySchema,
        pageSize: { type: "integer", minimum: 1, maximum: 20 }
      }, ["query"])
    }
  }, (args, context) => callGas(args, context, "drive.search", {
    query: args.query, pageSize: args.pageSize ?? 10
  }));

  registerTool({
    type: "function",
    function: {
      name: "gas_drive_info",
      description: "Google Driveファイルの名前、種類、更新日時などの情報を取得します。読み取り専用。",
      parameters: schema({ scope: scopeSchema, fileId: idSchema }, ["fileId"])
    }
  }, (args, context) => callGas(args, context, "drive.info", { fileId: args.fileId }));

  registerTool({
    type: "function",
    function: {
      name: "gas_drive_read",
      description: "Google Drive上の対応ファイルの内容を読み取ります。読み取り専用。fileIdが必要です。",
      parameters: schema({
        scope: scopeSchema,
        fileId: idSchema,
        maxChars: { type: "integer", minimum: 500, maximum: 12000 }
      }, ["fileId"])
    }
  }, (args, context) => callGas(args, context, "drive.read", {
    fileId: args.fileId, maxChars: args.maxChars ?? 8000
  }));

  registerTool({
    type: "function",
    function: {
      name: "gas_calendar_list",
      description: "Google Calendarの予定を期間指定で取得します。読み取り専用。",
      parameters: schema({
        scope: scopeSchema,
        calendarId: { type: "string", maxLength: 300 },
        timeMin: { type: "string", maxLength: 40 },
        timeMax: { type: "string", maxLength: 40 },
        maxResults: { type: "integer", minimum: 1, maximum: 50 }
      })
    }
  }, (args, context) => callGas(args, context, "calendar.list", {
    ...(args.calendarId ? { calendarId: args.calendarId } : {}),
    ...(args.timeMin ? { timeMin: args.timeMin } : {}),
    ...(args.timeMax ? { timeMax: args.timeMax } : {}),
    maxResults: args.maxResults ?? 20
  }));

  registerTool({
    type: "function",
    function: {
      name: "gas_calendar_search",
      description: "Google Calendarの予定をキーワード検索します。読み取り専用。",
      parameters: schema({
        scope: scopeSchema,
        query: querySchema,
        timeMin: { type: "string", maxLength: 40 },
        timeMax: { type: "string", maxLength: 40 },
        maxResults: { type: "integer", minimum: 1, maximum: 50 }
      }, ["query"])
    }
  }, (args, context) => callGas(args, context, "calendar.search", {
    query: args.query,
    ...(args.timeMin ? { timeMin: args.timeMin } : {}),
    ...(args.timeMax ? { timeMax: args.timeMax } : {}),
    maxResults: args.maxResults ?? 20
  }));
}
