export type SwipeGesture = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  viewportWidth: number;
  drawerOpen: boolean;
  startedInDrawer: boolean;
};

export function resolveSwipeAction(gesture: SwipeGesture): "open-menu" | "close-menu" | null {
  const deltaX = gesture.endX - gesture.startX;
  const deltaY = gesture.endY - gesture.startY;
  if (
    gesture.viewportWidth > 700 ||
    Math.abs(deltaX) < 72 ||
    Math.abs(deltaX) < Math.abs(deltaY) * 1.25
  )
    return null;
  if (gesture.drawerOpen && gesture.startedInDrawer && deltaX <= -72) return "close-menu";
  if (!gesture.drawerOpen && gesture.startX <= 24 && deltaX >= 72) return "open-menu";
  return null;
}
