export class MemoryStorage {
  constructor(initialValues = {}) {
    this.values = new Map(Object.entries(initialValues));
    this.ignoredSetKeys = new Set();
    this.throwingSetKeys = new Set();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.throwingSetKeys.has(key)) {
      throw new Error("TEST_STORAGE_WRITE_FAILED");
    }
    if (this.ignoredSetKeys.has(key)) {
      return;
    }
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  get length() {
    return this.values.size;
  }
}
