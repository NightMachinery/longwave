package server

import "sync"

type RoomHub struct {
	mu          sync.RWMutex
	subscribers map[string]map[chan struct{}]struct{}
}

func NewRoomHub() *RoomHub {
	return &RoomHub{subscribers: map[string]map[chan struct{}]struct{}{}}
}

func (hub *RoomHub) Subscribe(roomID string) (<-chan struct{}, func()) {
	events := make(chan struct{}, 8)
	hub.mu.Lock()
	if hub.subscribers[roomID] == nil {
		hub.subscribers[roomID] = map[chan struct{}]struct{}{}
	}
	hub.subscribers[roomID][events] = struct{}{}
	hub.mu.Unlock()
	return events, func() { hub.unsubscribe(roomID, events) }
}

func (hub *RoomHub) Broadcast(roomID string) {
	hub.mu.RLock()
	defer hub.mu.RUnlock()
	for events := range hub.subscribers[roomID] {
		select {
		case events <- struct{}{}:
		default:
			select {
			case <-events:
			default:
			}
			select {
			case events <- struct{}{}:
			default:
			}
		}
	}
}

func (hub *RoomHub) Close() {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	for roomID, roomSubscribers := range hub.subscribers {
		for events := range roomSubscribers {
			delete(roomSubscribers, events)
			close(events)
		}
		delete(hub.subscribers, roomID)
	}
}

func (hub *RoomHub) unsubscribe(roomID string, events chan struct{}) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	roomSubscribers := hub.subscribers[roomID]
	if roomSubscribers == nil {
		return
	}
	if _, exists := roomSubscribers[events]; !exists {
		return
	}
	delete(roomSubscribers, events)
	if len(roomSubscribers) == 0 {
		delete(hub.subscribers, roomID)
	}
	close(events)
}
