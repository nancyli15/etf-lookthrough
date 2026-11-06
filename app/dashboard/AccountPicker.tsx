"use client";
// Chooses which accounts the page adds up: all of them (the default), one, or
// any mix. Grouped by brokerage connection, each with SnapTrade's own total in
// the account's own currency. Only shown when there's more than one account.
import type { AccountGroup } from "../../lib/accounts";

type Props = {
  groups: AccountGroup[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  money: (value: number, currency: string) => string;
};

export default function AccountPicker({ groups, selected, onChange, money }: Props) {
  const all = groups.flatMap((group) => group.accounts.map((account) => account.id));
  if (all.length < 2) return null;

  // Unticking everything is allowed: the page then says "No account chosen".
  function set(ids: string[], on: boolean) {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange(next);
  }

  const label = selected.size === all.length ? `All ${all.length}` : `${selected.size} of ${all.length}`;

  return (
    <details className="picker">
      <summary className="button secondary">Accounts: {label} ▾</summary>
      <div className="picker-menu card">
        <label className="picker-row picker-all">
          <input
            type="checkbox"
            checked={selected.size === all.length}
            onChange={(event) => onChange(event.target.checked ? new Set(all) : new Set())}
          />
          All accounts
        </label>
        {groups.map((group) => {
          const ids = group.accounts.map((account) => account.id);
          const allInGroup = ids.every((id) => selected.has(id));
          return (
            <div key={group.id} className="picker-group">
              <label className="picker-row picker-brokerage">
                <input type="checkbox" checked={allInGroup} onChange={(event) => set(ids, event.target.checked)} />
                {group.name}
              </label>
              {group.accounts.map((account) => (
                <label key={account.id} className="picker-row picker-account">
                  <input
                    type="checkbox"
                    checked={selected.has(account.id)}
                    onChange={(event) => set([account.id], event.target.checked)}
                  />
                  <span>{account.name}</span>
                  <span className="muted num">{account.total ? money(account.total.amount, account.total.currency) : ""}</span>
                </label>
              ))}
            </div>
          );
        })}
        <p className="muted small">Totals are SnapTrade's, in each account's own currency.</p>
      </div>
    </details>
  );
}
