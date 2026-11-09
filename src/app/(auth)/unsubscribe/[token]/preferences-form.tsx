"use client";

import { useState } from "react";

import { api } from "~/trpc/react";
import { Switch } from "~/components/ui/switch";
import type { Preferences } from "~/server/mailouts/preferences";

/**
 * Each list with a switch, and one button to leave everything. Switches save
 * as they are flipped; there is no form to submit.
 */
export function PreferencesForm({
  token,
  initial,
}: {
  token: string;
  initial: Preferences;
}) {
  const [lists, setLists] = useState(initial.lists);
  const [error, setError] = useState<string | null>(null);
  const setPreference = api.newsletter.setPreference.useMutation();
  const unsubscribeAll = api.newsletter.unsubscribeAll.useMutation();

  const from = lists.filter((list) => initial.fromListIds.includes(list.id));
  const subscribed = lists.filter((list) => list.subscribed);

  const toggle = async (listId: string, next: boolean) => {
    const before = lists;
    setError(null);
    setLists((current) =>
      current.map((list) =>
        list.id === listId ? { ...list, subscribed: next } : list,
      ),
    );
    try {
      await setPreference.mutateAsync({ token, listId, subscribed: next });
    } catch {
      setLists(before);
      setError("That did not save. Try again.");
    }
  };

  const leaveAll = async () => {
    const before = lists;
    setError(null);
    setLists((current) =>
      current.map((list) => ({ ...list, subscribed: false })),
    );
    try {
      await unsubscribeAll.mutateAsync({ token });
    } catch {
      setLists(before);
      setError("That did not save. Try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Email preferences</h1>
        <p className="text-sm text-white/60">
          For <span className="break-all">{initial.email}</span>
          {from.length > 0 &&
            `. The email you came from went to ${from.map((list) => list.name).join(" and ")}.`}
        </p>
      </div>

      <ul className="divide-y divide-white/10 border-y border-white/10">
        {lists.map((list) => (
          <li
            key={list.id}
            className="flex items-start justify-between gap-4 py-4"
          >
            <label htmlFor={`list-${list.id}`} className="min-w-0">
              <span className="block font-medium">{list.name}</span>
              {list.description && (
                <span className="block text-sm text-white/60">
                  {list.description}
                </span>
              )}
            </label>
            <Switch
              id={`list-${list.id}`}
              checked={list.subscribed}
              onCheckedChange={(next) => void toggle(list.id, next)}
            />
          </li>
        ))}
      </ul>

      {subscribed.length > 0 ? (
        <button
          type="button"
          onClick={() => void leaveAll()}
          disabled={unsubscribeAll.isPending}
          className="w-full rounded-full border border-white/25 px-5 py-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
        >
          Unsubscribe from everything
        </button>
      ) : (
        <p role="status" className="text-sm text-white/60">
          You will not get any more marketing email from Atmos. Ticket emails
          for anything you buy still come as usual.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
