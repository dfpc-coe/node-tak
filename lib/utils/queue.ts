// A fixed-size Ring Buffer (Circular Queue) for zero-allocation operations.
export class Queue<T> {
    private buffer: (T | undefined)[];
    private capacity: number;
    private head: number;
    private tail: number;
    private _length: number;

    constructor(capacity: number = 10000) {
        this.capacity = capacity;
        this.buffer = new Array(capacity);
        this.head = 0;
        this.tail = 0;
        this._length = 0;
    }

    // Add item to the queue. Returns false if full.
    push(item: T): boolean {
        if (this._length >= this.capacity) {
            return false;
        }

        this.buffer[this.tail] = item;
        this.tail = (this.tail + 1) % this.capacity;
        this._length++;
        return true;
    }

    // Peek at the next item
    peek(): T | undefined {
        if (this._length === 0) return undefined;
        return this.buffer[this.head];
    }

    pop(): T | undefined {
        if (this._length === 0) return undefined;

        const item = this.buffer[this.head];
        this.buffer[this.head] = undefined; // Clear reference for GC
        this.head = (this.head + 1) % this.capacity;
        this._length--;

        return item;
    }

    get length(): number {
        return this._length;
    }

    get isFull(): boolean {
        return this._length === this.capacity;
    }
}
