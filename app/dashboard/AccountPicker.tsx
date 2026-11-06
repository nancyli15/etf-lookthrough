"use client";
// Chooses which accounts the page adds up: all of them (the default), one, or
// any mix. Grouped by brokerage connection, each with SnapTrade's own total in
// the account's own currency. Only shown when there's more than one account.
import { useEffect, useRef } from "react";
import type { AccountGroup } from "../../lib/accounts";

type Props = {
  groups: AccountGroup[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  money: (value: number, currency: string) => string;
};

export default function AccountPicker({ groups, selected, onChange, money }: Props) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  // <details> stays open until its button is clicked again. A dropdown should also
  // close on a click anywhere else, or on Esc. Clicks inside, like ticking boxes,
  // leave it open so several accounts can be changed in one go.
  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      const menu = menuRef.current;
      if (event.key === "Escape" && menu?.open) {
        menu.open = false;
        // Back on the button, so keyboard users don't lose their place.
        menu.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

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
    <details className="picker" ref={menuRef}>
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
      </div>
    </details>
  );
}
