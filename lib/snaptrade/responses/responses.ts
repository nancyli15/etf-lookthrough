// The parts of SnapTrade's responses this app reads, as TypeScript types.
//
// Every field is optional and typed `unknown`, not `string` or `number`: this is
// outside data, so a field can be missing, or a different type than the docs say
// (positions send numbers as strings, for example). TypeScript won't let code use
// an `unknown` value until it checks it, with toText, toNumber or currencyCodeOf.
// That's the difference from `any`, which would skip the checks silently.
//
// Only the fields the app reads are listed. SnapTrade sends many more.

// One item from /accounts.
export type SnapTradeAccount = {
  id?: unknown;
  name?: unknown; // "Wealthsimple Trade TFSA"
  institution_name?: unknown;
  brokerage_authorization?: unknown; // The ID of the connection it belongs to.
  balance?: { total?: { amount?: unknown; currency?: unknown } }; // SnapTrade's own total for the account.
  sync_status?: {
    holdings?: { last_successful_sync?: unknown }; // When SnapTrade last read holdings from the brokerage.
    transactions?: { first_transaction_date?: unknown }; // How far back activity goes.
  };
};

// One item from /accounts/{id}/positions/all (inside its { results: [...] }).
export type SnapTradePosition = {
  instrument?: {
    symbol?: unknown;
    raw_symbol?: unknown; // The brokerage's own spelling, like "XEQT.TO".
    description?: unknown; // The security's name.
    kind?: unknown; // "stock", "etf", "crypto", ...
    exchange?: unknown;
    currency?: unknown;
    figi_instrument?: { figi_code?: unknown }; // A global ID for the security.
  };
  units?: unknown; // Sent as a string, like "5".
  price?: unknown; // Sent as a string, like "180.5".
  currency?: unknown;
  cash_equivalent?: unknown; // true for a money market fund already counted in cash.
};

// One item from /accounts/{id}/balances: one per currency.
export type SnapTradeBalance = {
  cash?: unknown;
  currency?: unknown; // { code: "CAD" } or "CAD".
};

// One item from /accounts/{id}/activities (inside its { data: [...] }).
export type SnapTradeActivity = {
  type?: unknown; // "BUY", "SELL", "DIVIDEND", ...
  symbol?: { symbol?: unknown; raw_symbol?: unknown };
  trade_date?: unknown;
  units?: unknown; // Negative for a sell.
  price?: unknown;
  amount?: unknown; // Negative for a buy.
  currency?: unknown;
};

// One item from /authorizations: a brokerage connection.
export type SnapTradeConnection = {
  id?: unknown;
  name?: unknown;
  disabled?: unknown;
  brokerage?: { display_name?: unknown; name?: unknown };
};

// The body of /accounts/{id}/balanceHistory (beta).
export type SnapTradeBalanceHistory = {
  currency?: unknown;
  history?: unknown; // A list of SnapTradeBalanceHistoryDay.
};

export type SnapTradeBalanceHistoryDay = {
  date?: unknown; // "2026-11-04", or a full timestamp.
  total_value?: unknown; // Sent as a string.
};

// The list in a response: the response itself if it's a list, or the list inside a
// wrapper like { results: [...] } or { data: [...] }. Anything else gives [].
// Items are typed T, but each could still be anything (even null), so every field
// is read with `?.` and checked before use.
export function rowsIn<T>(data: unknown, wrapperKey?: "results" | "data"): T[] {
  if (Array.isArray(data)) return data;
  const wrapped = wrapperKey ? (data as Record<string, unknown> | null)?.[wrapperKey] : undefined;
  return Array.isArray(wrapped) ? wrapped : [];
}
