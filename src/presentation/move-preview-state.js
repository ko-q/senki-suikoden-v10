/** Uncommitted movement only. Never owns or changes a unit, map, or random state. */
export class MovePreviewState {
  #destination = null;
  #paths = Object.freeze([]);
  #index = 0;

  get destination() { return this.#destination; }
  get paths() { return this.#paths; }
  get index() { return this.#index; }
  get path() { return this.#paths[this.#index] ?? Object.freeze([]); }

  set(destination, paths) {
    // Query results and rendered snapshots cannot mutate each other's paths.
    this.#paths = Object.freeze(paths.map((path) => Object.freeze([...path])));
    this.#destination = destination;
    this.#index = 0;
  }

  nextPath() {
    if (this.#paths.length > 1) this.#index = (this.#index + 1) % this.#paths.length;
  }

  clear() {
    this.#destination = null;
    this.#paths = Object.freeze([]);
    this.#index = 0;
  }
}
