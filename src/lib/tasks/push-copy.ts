/** Leave room for title and routing data within Expo/APNs' payload limit, including emoji. */
export function taskPushBody(text: string) {
  const characters = Array.from(text);
  return characters.length > 600
    ? `${characters.slice(0, 599).join("")}…`
    : text;
}
