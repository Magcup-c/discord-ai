import { registerTool } from "../core/tool-registry.js";
import { getWeather } from "./weather.js";
import { searchWeb } from "./web-search.js";
import { calculate } from "./calculator.js";
import { googleSearch } from "./google-search.js";
import {
  percentage, statistics, unitConvert, jsonFormat, jsonValidate,
  csvParse, csvToJson, dateDifference
} from "./standard-functions.js";

registerTool({
  type: "function",
  function: {
    name: "get_weather",
    description: "指定した都市の現在の天気を取得します。",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "都市名。例: Osaka, Tokyo" }
      },
      required: ["city"],
      additionalProperties: false
    }
  }
}, getWeather);

registerTool({
  type: "function",
  function: {
    name: "web_search",
    description: "ウェブ検索を行い、検索結果を返します。各結果のcitation_indexを回答中の出典番号として引用してください。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "検索したい内容" }
      },
      required: ["query"],
      additionalProperties: false
    }
  }
}, searchWeb);

registerTool({
  type: "function",
  function: {
    name: "calculate",
    description: "四則演算、括弧、べき乗を含む数式を計算します。",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string", description: "計算する数式。例: (12 + 5) * 3" }
      },
      required: ["expression"],
      additionalProperties: false
    }
  }
}, calculate);

registerTool({
  type: "function",
  function: {
    name: "google_search",
    description: "ユーザー本人が連携したGoogle DriveまたはGoogle Calendarを読み取り検索します。Google未連携の場合は利用できません。",
    parameters: {
      type: "object",
      properties: {
        service: { type: "string", enum: ["drive", "calendar"], description: "検索対象のGoogleサービス" },
        query: { type: "string", minLength: 1, maxLength: 200, description: "検索語" }
      },
      required: ["service", "query"],
      additionalProperties: false
    }
  }
}, googleSearch);


registerTool({
  type: "function",
  function: {
    name: "percentage",
    description: "数値の指定した割合を計算します。",
    parameters: {
      type: "object",
      properties: {
        value: { type: "number", description: "元の数値" },
        percent: { type: "number", description: "割合（パーセント）" }
      },
      required: ["value", "percent"],
      additionalProperties: false
    }
  }
}, percentage);

registerTool({
  type: "function",
  function: {
    name: "statistics",
    description: "数値配列の合計・平均・中央値・最小値・最大値・母標準偏差を計算します。",
    parameters: {
      type: "object",
      properties: {
        values: {
          type: "array",
          items: { type: "number" },
          description: "集計する数値（1〜1000個）"
        }
      },
      required: ["values"],
      additionalProperties: false
    }
  }
}, statistics);

registerTool({
  type: "function",
  function: {
    name: "unit_convert",
    description: "長さ・質量・体積・温度の単位を変換します。",
    parameters: {
      type: "object",
      properties: {
        value: { type: "number", description: "変換する値" },
        from: { type: "string", enum: ["mm", "cm", "m", "km", "mg", "g", "kg", "ml", "l", "c", "f", "k"] },
        to: { type: "string", enum: ["mm", "cm", "m", "km", "mg", "g", "kg", "ml", "l", "c", "f", "k"] }
      },
      required: ["value", "from", "to"],
      additionalProperties: false
    }
  }
}, unitConvert);

registerTool({
  type: "function",
  function: {
    name: "json_format",
    description: "JSON文字列を検証して整形します。",
    parameters: {
      type: "object",
      properties: {
        json: { type: "string", minLength: 1, maxLength: 12000 },
        indent: { type: "integer", minimum: 0, maximum: 4, description: "インデント幅（既定値2）" }
      },
      required: ["json"],
      additionalProperties: false
    }
  }
}, jsonFormat);

registerTool({
  type: "function",
  function: {
    name: "json_validate",
    description: "JSON文字列が正しい形式か検証します。",
    parameters: {
      type: "object",
      properties: {
        json: { type: "string", minLength: 1, maxLength: 12000 }
      },
      required: ["json"],
      additionalProperties: false
    }
  }
}, jsonValidate);

registerTool({
  type: "function",
  function: {
    name: "csv_parse",
    description: "CSVをヘッダー付きのJSONオブジェクト配列に変換します。",
    parameters: {
      type: "object",
      properties: {
        csv: { type: "string", minLength: 1, maxLength: 20000 },
        delimiter: { type: "string", minLength: 1, maxLength: 1, description: "区切り文字（既定値はカンマ）" }
      },
      required: ["csv"],
      additionalProperties: false
    }
  }
}, csvParse);

registerTool({
  type: "function",
  function: {
    name: "csv_to_json",
    description: "CSVをJSON文字列に変換します。",
    parameters: {
      type: "object",
      properties: {
        csv: { type: "string", minLength: 1, maxLength: 20000 },
        delimiter: { type: "string", minLength: 1, maxLength: 1 }
      },
      required: ["csv"],
      additionalProperties: false
    }
  }
}, csvToJson);

registerTool({
  type: "function",
  function: {
    name: "date_difference",
    description: "2つの日付・日時の差をミリ秒・時間・日数で計算します。",
    parameters: {
      type: "object",
      properties: {
        start: { type: "string", minLength: 1, maxLength: 40 },
        end: { type: "string", minLength: 1, maxLength: 40 }
      },
      required: ["start", "end"],
      additionalProperties: false
    }
  }
}, dateDifference);
