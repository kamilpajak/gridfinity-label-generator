/**
 * Simple LRU (Least Recently Used) Cache implementation
 */
export class LRUCache<K, V> {
	private maxSize: number;
	private cache: Map<K, V>;

	constructor(maxSize: number = 50) {
		this.maxSize = maxSize;
		this.cache = new Map();
	}

	/**
	 * Get a value from the cache
	 * Moves the item to the end (most recently used)
	 */
	get(key: K): V | undefined {
		if (!this.cache.has(key)) {
			return undefined;
		}

		// Remove and re-add to move to end
		const value = this.cache.get(key)!;
		this.cache.delete(key);
		this.cache.set(key, value);

		return value;
	}

	/**
	 * Set a value in the cache
	 * Removes least recently used item if cache is full
	 */
	set(key: K, value: V): void {
		// If key exists, remove it first
		if (this.cache.has(key)) {
			this.cache.delete(key);
		}
		// If cache is full, remove the least recently used item (first item)
		else if (this.cache.size >= this.maxSize) {
			const firstKey = this.cache.keys().next().value;
			this.cache.delete(firstKey);
		}

		// Add the new item to the end (most recently used)
		this.cache.set(key, value);
	}

	/**
	 * Check if a key exists in the cache
	 */
	has(key: K): boolean {
		return this.cache.has(key);
	}

	/**
	 * Clear all items from the cache
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Get the current size of the cache
	 */
	get size(): number {
		return this.cache.size;
	}
}
