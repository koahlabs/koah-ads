import { waitlistEmailHash } from "../src/lib/waitlist-lead-number.ts";

// Parse RFC 4180 CSV, including quoted commas, quotes, and multiline fields.
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closedQuote = false;
  const source = csv.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (closedQuote && ![",", "\n", "\r"].includes(char)) throw new Error("Invalid CSV quoting.");
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (quoted || field === "") {
        closedQuote = quoted;
        quoted = !quoted;
      } else throw new Error("Invalid CSV quoting.");
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
      closedQuote = false;
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      closedQuote = false;
    } else field += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quote.");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function waitlistHashesFromCsv(csv: string): string[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header) throw new Error("The CSV is empty.");
  const names = header.map((name) => name.trim().toLowerCase().replace(/\s+/g, ""));
  const emailColumn = names.indexOf("email");
  const dateColumn = names.indexOf("muxwaitlistjoinedat");
  if (emailColumn < 0 || dateColumn < 0)
    throw new Error("Export the email and muxWaitlistJoinedAt columns from Loops.");
  const leads = new Map<string, number>();
  for (const row of rows) {
    const joinedAt = row[dateColumn]?.trim();
    if (!joinedAt) continue; // Other Koah contacts are not Sidequest waitlist leads.
    const email = row[emailColumn]?.trim().toLowerCase();
    const joined = Date.parse(joinedAt);
    if (!email || !email.includes("@") || !Number.isFinite(joined))
      throw new Error("The CSV contains an invalid waitlist lead.");
    leads.set(email, Math.min(joined, leads.get(email) ?? joined));
  }
  if (!leads.size)
    throw new Error(
      "The CSV contains no existing Sidequest waitlist leads. The counter was not initialized.",
    );
  return [...leads]
    .toSorted(
      ([emailA, dateA], [emailB, dateB]) =>
        dateA - dateB || (emailA < emailB ? -1 : emailA > emailB ? 1 : 0),
    )
    .map(([email]) => waitlistEmailHash(email));
}
