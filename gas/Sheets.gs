function sheetsRead_(p) {
  var id = requireString_(p.spreadsheetId, "spreadsheetId", 300);
  var range = requireString_(p.range, "range", 300);
  var values = SpreadsheetApp.openById(id).getRange(range).getValues();
  if (values.length > 500 || (values[0] && values[0].length > 100)) throw new Error("Range too large");
  return { range: range, values: values };
}

function sheetsInfo_(p) {
  var ss = SpreadsheetApp.openById(requireString_(p.spreadsheetId, "spreadsheetId", 300));
  return {
    spreadsheetId: ss.getId(),
    name: ss.getName(),
    url: ss.getUrl(),
    sheets: ss.getSheets().map(function(s) {
      return { name: s.getName(), sheetId: s.getSheetId(), rows: s.getLastRow(), columns: s.getLastColumn() };
    })
  };
}

function sheetsSearch_(p) {
  var ss = SpreadsheetApp.openById(requireString_(p.spreadsheetId, "spreadsheetId", 300));
  var query = requireString_(p.query, "query", 500).toLowerCase();
  var targetSheets = p.range ? [ss.getRange(p.range).getSheet()] : ss.getSheets();
  var hits = [];
  var scanned = 0;
  targetSheets.forEach(function(sheet) {
    var range = p.range ? ss.getRange(p.range) : sheet.getDataRange();
    var values = range.getDisplayValues();
    for (var r = 0; r < values.length; r++) {
      for (var c = 0; c < values[r].length; c++) {
        scanned++;
        if (scanned > 100000) return;
        var value = values[r][c];
        if (value && value.toLowerCase().indexOf(query) !== -1) {
          hits.push({ sheet: sheet.getName(), row: range.getRow() + r, column: range.getColumn() + c, value: value });
          if (hits.length >= 200) return;
        }
      }
    }
  });
  return { query: p.query, hits: hits, scannedCells: scanned, truncated: scanned >= 100000 || hits.length >= 200 };
}
