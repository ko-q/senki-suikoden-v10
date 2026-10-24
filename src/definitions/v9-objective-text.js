/** Convert the fixed V9 objective markup for textContent-based views. */
export function formatV9ObjectiveText(text) {
  return text.replaceAll("<br>", "\n").replace(/<\/?b>/g, "");
}
