// Company and fund names arrive in many styles: "NVIDIA Corporation" from SnapTrade and
// "NVIDIA CORP" from a fund file are one company, so both must read the same on screen.

// Words that normal capitalization gets wrong. Matched case-insensitively.
const WORD_SPELLINGS: Record<string, string> = Object.fromEntries(
  [
    "AbbVie", "ASE", "ASML", "AstraZeneca", "BHP", "EAFE", "ETF", "ExxonMobil", "HDFC", "HSBC", "ICICI", "IMI", "iShares",
    "JPMorgan", "MediaTek", "MSCI", "NVIDIA", "S&P/TSX", "SAP", "SK", "SPDR", "TC", "TotalEnergies", "TSX", "U.S.", "UBS",
    "UFJ",
  ].map((word) => [word.toLowerCase(), word]),
);

// Fund files cut long names off.
const FULL_NAMES: Record<string, string> = {
  "INDUSTRIAL AND COMMERCIAL BANK OF": "Industrial and Commercial Bank of China",
};

// Fund files shout: "APPLE INC" reads better as "Apple Inc". Names already in
// mixed case, from SnapTrade or our own groups, keep their capitalization.
export function displayName(name: string): string {
  const spaced = FULL_NAMES[name] ?? name.trim().replace(/\s+/g, " ");
  const cased =
    spaced === spaced.toUpperCase()
      ? spaced
          .toLowerCase()
          .replace(/ \+ /g, " & ") // SPDR's file writes "ELI LILLY + CO".
          .replace(/(^|[ &-])([a-z])/g, (_, before, letter) => before + letter.toUpperCase())
          .replace(/ (Of|And|The)(?= )/g, (word) => word.toLowerCase())
      : spaced;
  return cased
    .split(" ")
    .map((word) => WORD_SPELLINGS[word.toLowerCase()] ?? word)
    .join(" ");
}

// Legal endings and share classes aren't part of what people call a company:
// "Microsoft Corporation Common Stock" is just Microsoft.
const NAME_ENDINGS =
  /[\s,]+(common stock|ordinary shares|class [a-z]( shares)?|cl [a-z]|corporation|incorporated|(corp|inc|ltd)\.?( [a-z])?|holdings?|limited|plc|sa|ag|n|& co\.?|co\.?|ps par|pref|non voting pre|subordinate voting)$/i;

export function shortName(name: string): string {
  let short = displayName(name).replace(/\/the$/i, "");
  let previous;
  do {
    previous = short;
    short = short.replace(NAME_ENDINGS, "");
  } while (short !== previous);
  return short || name;
}
