// Positions a portaled dropdown next to its trigger so the whole menu stays on screen:
// opens below when there's room, flips above when there's more space there, and caps the
// option list's height to the space available (it scrolls inside the menu).

export interface MenuPlacement {
  left: number;
  width: number;
  /** Set when the menu opens below the trigger. */
  top?: number;
  /** Set when the menu opens above the trigger (distance from the viewport bottom). */
  bottom?: number;
  /** Max height for the scrollable option list, in px. */
  listMaxHeight: number;
  above: boolean;
}

const GAP = 8;
const EDGE = 12;
const PREFERRED_LIST = 360;
const MIN_LIST = 96;

/**
 * @param rect   trigger's bounding rect
 * @param width  menu width in px
 * @param chrome height of the menu's non-list parts (header, search, footer) in px
 */
export function placeMenu(rect: DOMRect, width: number, chrome: number): MenuPlacement {
  const left = Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE));
  const spaceBelow = window.innerHeight - rect.bottom - GAP - EDGE;
  const spaceAbove = rect.top - GAP - EDGE;
  const needed = chrome + PREFERRED_LIST;

  const above = spaceBelow < needed && spaceAbove > spaceBelow;
  const space = above ? spaceAbove : spaceBelow;
  const listMaxHeight = Math.max(MIN_LIST, Math.min(PREFERRED_LIST, space - chrome));

  return above
    ? { left, width, bottom: window.innerHeight - rect.top + GAP, listMaxHeight, above }
    : { left, width, top: rect.bottom + GAP, listMaxHeight, above };
}
