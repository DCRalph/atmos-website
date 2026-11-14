import { CONTRACT_FORM_ID } from "~/lib/contracts";

/**
 * The contract form on the page as the object its schema expects: flat
 * fields, with the equipment list's `items.<row>.<column>` inputs gathered
 * into rows. Read by whatever saves, sends or signs the contract.
 */
export function readContractForm(): Record<string, unknown> {
  const form = document.getElementById(CONTRACT_FORM_ID);
  if (!(form instanceof HTMLFormElement)) return {};

  const fields: Record<string, string> = {};
  const items: Record<string, string>[] = [];
  for (const [name, value] of new FormData(form)) {
    if (typeof value !== "string") continue;
    const [list, row, column] = name.split(".");
    if (list === "items" && row && column) {
      (items[Number(row)] ??= {})[column] = value;
    } else {
      fields[name] = value;
    }
  }
  return { ...fields, items };
}
