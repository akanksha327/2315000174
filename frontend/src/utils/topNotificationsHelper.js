import { getPriorityWeight } from "./priorityHelper";

/**
 * Compare two notifications according to the ranking rules:
 * 1. Higher priority weight first (e.g. Placement = 3 > Result = 2 > Event = 1).
 * 2. If priorities are equal, newer timestamp first.
 * 
 * Returns > 0 if a is higher ranking (stronger) than b.
 * Returns < 0 if a is lower ranking (weaker) than b.
 * Returns 0 if equal.
 */
export function compareNotifications(a, b) {
  const typeA = a.notification_type || a.type;
  const typeB = b.notification_type || b.type;
  const weightA = getPriorityWeight(typeA);
  const weightB = getPriorityWeight(typeB);
  
  if (weightA !== weightB) {
    return weightA - weightB;
  }
  
  const timeA = new Date(a.timestamp || a.publishedAt || a.createdAt).getTime();
  const timeB = new Date(b.timestamp || b.publishedAt || b.createdAt).getTime();
  
  return timeA - timeB;
}

/**
 * MIN HEAP APPROACH EXPLANATION:
 * -----------------------------
 * To find and maintain the Top 10 highest-ranking notifications efficiently:
 * 1. We keep a Min Heap of size 10.
 * 2. The root element of this Min Heap holds the *weakest* (lowest ranking) notification in the current Top 10.
 * 3. When inserting a new notification:
 *    - If the heap has less than 10 items, we push it and heapify up. This takes O(log K) where K <= 10, i.e., O(1) time.
 *    - If the heap has exactly 10 items, we compare the new notification with the root of the heap (the weakest item).
 *      - If the new notification is higher ranking (stronger) than the root, it deserves to be in the Top 10.
 *        We replace the root with the new notification and heapify down. This takes O(log K) = O(1) time.
 *      - If it is lower ranking, we simply ignore it (takes O(1) time).
 * 
 * Overall Time Complexity:
 * ------------------------
 * - Building the initial Top 10 from N notifications: O(N log 10) = O(N) linear time.
 * - This is much more efficient than sorting the entire dataset, which takes O(N log N) time.
 */
export class TopTenHeap {
  constructor(initialItems = []) {
    this.heap = [];
    for (const item of initialItems) {
      this.insert(item);
    }
  }

  insert(item) {
    // Prevent duplicate entries in our Top 10 list
    if (this.heap.some((n) => n.id === item.id)) {
      return false;
    }

    if (this.heap.length < 10) {
      this.heap.push(item);
      this.bubbleUp(this.heap.length - 1);
      return true;
    }

    // Compare with root (the current 10th weakest element)
    if (compareNotifications(item, this.heap[0]) > 0) {
      this.heap[0] = item;
      this.sinkDown(0);
      return true;
    }

    return false;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (compareNotifications(this.heap[parentIndex], this.heap[index]) <= 0) {
        break;
      }
      const temp = this.heap[parentIndex];
      this.heap[parentIndex] = this.heap[index];
      this.heap[index] = temp;
      index = parentIndex;
    }
  }

  sinkDown(index) {
    const length = this.heap.length;
    while (true) {
      let leftChildIndex = 2 * index + 1;
      let rightChildIndex = 2 * index + 2;
      let swapIndex = -1;

      if (leftChildIndex < length) {
        if (compareNotifications(this.heap[leftChildIndex], this.heap[index]) < 0) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        if (
          (swapIndex === -1 && compareNotifications(this.heap[rightChildIndex], this.heap[index]) < 0) ||
          (swapIndex !== -1 && compareNotifications(this.heap[rightChildIndex], this.heap[leftChildIndex]) < 0)
        ) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === -1) {
        break;
      }

      const temp = this.heap[index];
      this.heap[index] = this.heap[swapIndex];
      this.heap[swapIndex] = temp;
      index = swapIndex;
    }
  }

  /**
   * Return the items in sorted descending order (strongest first) for UI rendering.
   */
  getSortedItems() {
    return [...this.heap].sort((a, b) => compareNotifications(b, a));
  }
}

/**
 * Utility function to efficiently update the Top 10 list when a new notification arrives
 * without re-sorting the entire dataset.
 * 
 * @param {Array} currentTopTen - Current Top 10 list (sorted descending)
 * @param {Object} newNotification - The newly arrived notification
 * @returns {Array} - The updated Top 10 list (sorted descending)
 */
export function updateTopNotifications(currentTopTen, newNotification) {
  // If it's already in the top 10, do not duplicate
  if (currentTopTen.some((n) => n.id === newNotification.id)) {
    return currentTopTen;
  }

  if (currentTopTen.length < 10) {
    const updated = [...currentTopTen, newNotification];
    return updated.sort((a, b) => compareNotifications(b, a));
  }

  // Compare with the weakest (the last element in the sorted array)
  const weakest = currentTopTen[currentTopTen.length - 1];
  if (compareNotifications(newNotification, weakest) > 0) {
    const updated = [...currentTopTen.slice(0, 9), newNotification];
    return updated.sort((a, b) => compareNotifications(b, a));
  }

  return currentTopTen;
}
