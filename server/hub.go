package server

import "sync"

type RoomHub struct {
	mu          sync.RWMutex
	subscribers map[string]map[chan []byte]struct{}
}

func NewRoomHub() *RoomHub {
	return &RoomHub{
		subscribers: map[string]map[chan []byte]struct{}{},
	}
}

func (hub *RoomHub) Subscribe(roomID string) (<-chan []byte, func()) {
	events := make(chan []byte, 8)

	hub.mu.Lock()
	if hub.subscribers[roomID] == nil {
		hub.subscribers[roomID] = map[chan []byte]struct{}{}
	}
	hub.subscribers[roomID][events] = struct{}{}
	hub.mu.Unlock()

	return events, func() {
		hub.unsubscribe(roomID, events)
	}
}

func (hub *RoomHub) Broadcast(roomID string, payload []byte) {
	hub.mu.RLock()
	defer hub.mu.RUnlock()

	roomSubscribers := hub.subscribers[roomID]
	for events := range roomSubscribers {
		clonedPayload := append([]byte(nil), payload...)

		select {
		case events <- clonedPayload:
		default:
			select {
			case <-events:
			default:
			}
			select {
			case events <- clonedPayload:
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

func (hub *RoomHub) unsubscribe(roomID string, events chan []byte) {
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
