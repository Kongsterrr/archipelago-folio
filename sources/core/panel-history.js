const MAX_PREDECESSORS = 40;

// Session-only navigation state. Views remain mutable so the panel can save
// scroll and focus before navigating; rendering belongs to the panel itself.
export class PanelHistory {
  current = null;
  stack = [];

  get canGoBack() {
    return this.stack.length > 0;
  }

  visit(view, {replace = false} = {}) {
    if (!replace && this.current && this.current.key !== view.key) {
      this.stack.push(this.current);
      if (this.stack.length > MAX_PREDECESSORS) {
        this.stack.splice(0, this.stack.length - MAX_PREDECESSORS);
      }
    }
    this.current = view;
  }

  back() {
    if (!this.canGoBack) return null;
    this.current = this.stack.pop();
    return this.current;
  }

  clear() {
    this.current = null;
    this.stack = [];
  }
}
