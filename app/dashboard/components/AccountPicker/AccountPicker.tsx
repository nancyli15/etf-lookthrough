"use client";
// Chooses which accounts the page adds up: all of them (the default), one, or
// any mix. Grouped by brokerage connection, each with SnapTrade's own total in
// the account's own currency. Only shown when there's more than one account.
import { useCallback, useRef } from "react";
import type { AccountGroup } from "@/lib/portfolio/accounts/accounts";
import { useDismiss } from "../../hooks/useDismiss";
import "./AccountPicker.css";

type Props = {
  groups: AccountGroup[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  money: (value: number, currency: string) => string;
};

export default function AccountPicker({ groups, selected, onChange, money }: Props) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  // A <details> opens and closes itself; closing it from outside means setting `open` to false.
  // useCallback keeps the same function between renders, so the hook doesn't re-subscribe each time.
  const closeMenu = useCallback((reason: "outside" | "escape") => {
    const menu = menuRef.current;
    if (!menu?.open) return;
    menu.open = false;
    // Back on the button, so keyboard users don't lose their place.
    if (reason === "escape") menu.querySelector("summary")?.focus();
  }, []);
  useDismiss(menuRef, closeMenu);

  const allIds = groups.flatMap((group) => group.accounts.map((account) => account.id));
  if (allIds.length < 2) return null;

  // Ticks or unticks several accounts at once, like a whole brokerage.
  // Unticking everything is allowed: the page then says "No account chosen".
  function setChecked(ids: string[], checked: boolean) {
    const next = new Set(selected);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    onChange(next);
  }

  const label = selected.size === allIds.length ? `All ${allIds.length}` : `${selected.size} of ${allIds.length}`;

  return (
    <details className="picker" ref={menuRef}>
      <summary className="button">Accounts: {label} ▾</summary>
      <div className="picker-menu card">
        <label className="picker-row picker-all">
          <input
            type="checkbox"
            checked={selected.size === allIds.length}
            onChange={(event) => onChange(event.target.checked ? new Set(allIds) : new Set())}
          />
          All accounts
        </label>
        {groups.map((group) => {
          const groupIds = group.accounts.map((account) => account.id);
          const wholeGroupChecked = groupIds.every((id) => selected.has(id));
          return (
            <div key={group.id} className="picker-group">
              <label className="picker-row picker-brokerage">
                <input type="checkbox" checked={wholeGroupChecked} onChange={(event) => setChecked(groupIds, event.target.checked)} />
                {group.name}
              </label>
              {group.accounts.map((account) => (
                <label key={account.id} className="picker-row picker-account">
                  <input
                    type="checkbox"
                    checked={selected.has(account.id)}
                    onChange={(event) => setChecked([account.id], event.target.checked)}
                  />
                  <span>{account.name}</span>
                  <span className="muted num">{account.total ? money(account.total.amount, account.total.currency) : ""}</span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </details>
  );
}
