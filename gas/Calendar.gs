function calendarList_(p) {
  var calendarId = p.calendarId || "primary";
  var calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error("Not found");
  var start = parseDateOrDefault_(p.timeMin, new Date());
  var end = parseDateOrDefault_(p.timeMax, new Date(start.getTime() + 30 * 86400000));
  if (end <= start) throw new Error("Invalid date");
  var max = Math.max(1, Math.min(50, Number(p.maxResults) || 20));
  return { calendarId: calendarId, events: calendar.getEvents(start, end).slice(0, max).map(eventSummary_) };
}

function calendarSearch_(p) {
  var query = requireString_(p.query, "query", 500);
  var calendarId = p.calendarId || "primary";
  var calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error("Not found");
  var start = parseDateOrDefault_(p.timeMin, new Date());
  var end = parseDateOrDefault_(p.timeMax, new Date(start.getTime() + 90 * 86400000));
  if (end <= start) throw new Error("Invalid date");
  var max = Math.max(1, Math.min(50, Number(p.maxResults) || 20));
  return { query: query, events: calendar.getEvents(start, end, { search: query }).slice(0, max).map(eventSummary_) };
}

function parseDateOrDefault_(value, fallback) {
  if (!value) return fallback;
  var d = new Date(value);
  if (isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

function eventSummary_(event) {
  return {
    id: event.getId(), title: event.getTitle(), description: event.getDescription().slice(0, 2000),
    location: event.getLocation(), start: event.getStartTime().toISOString(),
    end: event.getEndTime().toISOString(), url: event.getHtmlLink()
  };
}
