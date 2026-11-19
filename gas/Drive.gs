function driveSearch_(p) {
  var query = requireString_(p.query, "query", 500).replace(/["\\]/g, " ");
  var pageSize = Math.max(1, Math.min(20, Number(p.pageSize) || 10));
  var files = DriveApp.searchFiles("fullText contains '" + query.replace(/'/g, "\\'") + "' and trashed = false");
  var results = [];
  while (files.hasNext() && results.length < pageSize) {
    var f = files.next();
    results.push(fileSummary_(f));
  }
  return { query: p.query, files: results };
}

function driveInfo_(p) {
  var file = DriveApp.getFileById(requireString_(p.fileId, "fileId", 300));
  return fileSummary_(file);
}

function fileSummary_(file) {
  return {
    id: file.getId(), name: file.getName(), mimeType: file.getMimeType(),
    modifiedTime: file.getLastUpdated().toISOString(), size: file.getSize(),
    url: file.getUrl()
  };
}

function driveRead_(p) {
  var file = DriveApp.getFileById(requireString_(p.fileId, "fileId", 300));
  var maxChars = Math.max(500, Math.min(12000, Number(p.maxChars) || 8000));
  var mime = file.getMimeType();
  var text = "";
  if (mime === MimeType.GOOGLE_DOCS) {
    text = DocumentApp.openById(file.getId()).getBody().getText();
  } else if (mime === MimeType.GOOGLE_SHEETS) {
    var ss = SpreadsheetApp.openById(file.getId());
    text = ss.getSheets().map(function(sheet) {
      return "[" + sheet.getName() + "]\n" + sheet.getDataRange().getDisplayValues()
        .map(function(row) { return row.join("\t"); }).join("\n");
    }).join("\n\n");
  } else if (mime === MimeType.PLAIN_TEXT || mime === "text/csv" || mime === "application/json") {
    text = file.getBlob().getDataAsString("UTF-8");
  } else {
    throw new Error("Unsupported file type");
  }
  return { file: fileSummary_(file), text: text.slice(0, maxChars), truncated: text.length > maxChars };
}
