import { registerTool } from "../core/tool-registry.js";
import { getWeather } from "./weather.js";
import { searchWeb } from "./web-search.js";
import { calculate } from "./calculator.js";

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
    description: "ウェブ検索を行い、検索結果の概要を取得します。",
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
