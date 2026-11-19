/** Explicit action allow-list. This bridge intentionally exposes read-only actions. */
function routeAction_(action, payload) {
  var routes = {
    "system.ping": function() { return { service: "discord-ai-gas-bridge", time: new Date().toISOString() }; },
    "sheets.read": function() { return sheetsRead_(payload); },
    "sheets.search": function() { return sheetsSearch_(payload); },
    "sheets.info": function() { return sheetsInfo_(payload); },
    "drive.search": function() { return driveSearch_(payload); },
    "drive.info": function() { return driveInfo_(payload); },
    "drive.read": function() { return driveRead_(payload); },
    "calendar.list": function() { return calendarList_(payload); },
    "calendar.search": function() { return calendarSearch_(payload); }
  };
  if (!Object.prototype.hasOwnProperty.call(routes, action)) throw new Error("Action not allowed");
  return routes[action]();
}
