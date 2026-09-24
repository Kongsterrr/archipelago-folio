export function syncInteractionMarkers(markers, activeAction, {frozen = false, walking = false} = {}) {
  for (const entry of markers) {
    entry.marker.visible = !frozen && !walking && !!activeAction && entry.action === activeAction;
  }
}
