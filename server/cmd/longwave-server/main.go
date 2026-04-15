package main

import (
	"errors"
	"log"
	"net/http"

	"longwave/server"
)

func main() {
	config, err := server.ConfigFromEnv()
	if err != nil {
		log.Fatalf("invalid configuration: %v", err)
	}

	app, err := server.New(config)
	if err != nil {
		log.Fatalf("failed to initialize longwave server: %v", err)
	}
	defer func() {
		if closeErr := app.Close(); closeErr != nil {
			log.Printf("failed to close longwave server cleanly: %v", closeErr)
		}
	}()

	log.Printf("longwave server listening on %s", config.Addr)
	if err := app.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("longwave server exited with error: %v", err)
	}
}
