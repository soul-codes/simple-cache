export interface LinkedListItem<Item extends object> {
  parent: LinkedList<Item>;
  item: Item;
  closer: LinkedListItem<Item> | null;
  further: LinkedListItem<Item> | null;
}

export class LinkedList<Item extends object> {
  constructor() {}

  insertAtHead(item: Item) {
    let linkedListItem = this._lookup.get(item);
    if (linkedListItem) {
      this._remove(linkedListItem);
    } else {
      const head = this._head;
      linkedListItem = {
        parent: this,
        further: head,
        closer: null,
        item: item
      };
      this._lookup.set(item, linkedListItem);
    }

    if (this._head) {
      this._head.closer = linkedListItem;
    } else {
      this._tail = linkedListItem;
    }
    this._head = linkedListItem;
    this._length++;
  }

  private _remove(linkedListItem: LinkedListItem<Item>) {
    const { closer, further } = linkedListItem;
    if (closer) {
      closer.further = further;
    } else {
      this._head = further;
    }
    if (further) {
      further.closer = closer;
    } else {
      this._tail = closer;
    }
    linkedListItem.closer = linkedListItem.further = null;
    this._length--;
  }

  remove(item: Item) {
    const linkedListItem = this._lookup.get(item);
    if (!linkedListItem) return;
    this._remove(linkedListItem);
    this._lookup.delete(item);
  }

  get length() {
    return this._length;
  }

  get tail() {
    return this._tail && this._tail.item;
  }

  private _lookup = new WeakMap<Item, LinkedListItem<Item>>();
  private _length = 0;
  private _head: LinkedListItem<Item> | null = null;
  private _tail: LinkedListItem<Item> | null = null;
}
