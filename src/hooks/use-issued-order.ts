"use client";

import { useEffect } from "react";

import { api } from "~/trpc/react";

/**
 * An order, waited on until its tickets exist.
 *
 * Both post-purchase pages land while the order may still be PENDING: the
 * webhook can be seconds behind, and a redirect-based payment method arrives
 * without the browser having confirmed anything. So this polls, and — when the
 * page was reached straight from a payment (`isNew`) — kicks the confirm itself
 * rather than waiting on Stripe's webhook. Both issue paths are idempotent, so
 * whichever gets there first wins and the other does nothing.
 */
export function useIssuedOrder(token: string, isNew: boolean) {
  const utils = api.useUtils();

  const order = api.tickets.byAccessToken.useQuery(
    { accessToken: token },
    {
      enabled: !!token,
      refetchInterval: (query) =>
        query.state.data && !query.state.data.issued ? 2000 : false,
    },
  );

  const confirm = api.ticketCheckout.confirm.useMutation({
    onSuccess: () => void utils.tickets.byAccessToken.invalidate(),
  });

  useEffect(() => {
    if (isNew && order.data && !order.data.issued && !confirm.isPending) {
      confirm.mutate({ accessToken: token });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, order.data?.issued]);

  return {
    order,
    refresh: () => void utils.tickets.byAccessToken.invalidate(),
  };
}
