// Legacy endpoint retained only to retire old Telegram clients cleanly.
// The Telegram webhook is detached; this function performs no bot actions.
Deno.serve(() => new Response(
  JSON.stringify({ error: "Telegram bot retired" }),
  { status: 410, headers: { "Content-Type": "application/json" } },
));
