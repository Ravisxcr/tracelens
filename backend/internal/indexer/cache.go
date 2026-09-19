package indexer

import (
	"container/list"
	"sync"
	"time"
)

// cacheEntry wraps a key, value, and optional expiration for LRU/TTL tracking.
type cacheEntry struct {
	key       string
	value     *CallGraphResponse
	expiresAt time.Time
}

// CallGraphCache provides a concurrent-safe in-memory cache featuring both
// bounded LRU eviction (like Ristretto) and optional TTL expiration (like go-cache/FreeCache),
// without any external dependencies or serialization overhead.
type CallGraphCache struct {
	mu        sync.RWMutex
	capacity  int
	items     map[string]*list.Element
	evictList *list.List
}

// NewCallGraphCache creates a new LRU cache with the specified capacity.
func NewCallGraphCache(capacity int) *CallGraphCache {
	if capacity <= 0 {
		capacity = 512
	}
	return &CallGraphCache{
		capacity:  capacity,
		items:     make(map[string]*list.Element),
		evictList: list.New(),
	}
}

// Get retrieves a cached CallGraphResponse if present and not expired.
func (c *CallGraphCache) Get(key string) (*CallGraphResponse, bool) {
	if c == nil {
		return nil, false
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, found := c.items[key]; found {
		entry := elem.Value.(*cacheEntry)
		// Check TTL expiration
		if !entry.expiresAt.IsZero() && time.Now().After(entry.expiresAt) {
			c.evictList.Remove(elem)
			delete(c.items, key)
			return nil, false
		}

		c.evictList.MoveToFront(elem)
		return entry.value, true
	}
	return nil, false
}

// Put stores a CallGraphResponse in the cache without TTL expiration.
func (c *CallGraphCache) Put(key string, val *CallGraphResponse) {
	c.PutWithTTL(key, val, 0)
}

// PutWithTTL stores a CallGraphResponse with an optional Time-To-Live (TTL).
func (c *CallGraphCache) PutWithTTL(key string, val *CallGraphResponse, ttl time.Duration) {
	if c == nil || val == nil {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	var expiresAt time.Time
	if ttl > 0 {
		expiresAt = time.Now().Add(ttl)
	}

	// Update existing
	if elem, found := c.items[key]; found {
		c.evictList.MoveToFront(elem)
		entry := elem.Value.(*cacheEntry)
		entry.value = val
		entry.expiresAt = expiresAt
		return
	}

	// Add new entry
	entry := &cacheEntry{key: key, value: val, expiresAt: expiresAt}
	elem := c.evictList.PushFront(entry)
	c.items[key] = elem

	// Evict oldest if capacity exceeded
	if c.evictList.Len() > c.capacity {
		oldest := c.evictList.Back()
		if oldest != nil {
			c.evictList.Remove(oldest)
			kv := oldest.Value.(*cacheEntry)
			delete(c.items, kv.key)
		}
	}
}

// Clear removes all entries from the cache (e.g. on workspace re-index).
func (c *CallGraphCache) Clear() {
	if c == nil {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	c.items = make(map[string]*list.Element)
	c.evictList.Init()
}

// Len returns the current number of cached items.
func (c *CallGraphCache) Len() int {
	if c == nil {
		return 0
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.items)
}
