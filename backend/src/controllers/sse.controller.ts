/**
 * GARUDA — Server-Sent Events Controller
 * 
 * Provides real-time dashboard updates via SSE.
 * Clients connect and receive live updates when data changes.
 */
import { Request, Response } from 'express';

// Store active SSE connections
const clients: Map<string, Response> = new Map();
let clientIdCounter = 0;

/**
 * SSE endpoint: clients connect here to receive real-time updates.
 */
export const sseConnect = (req: Request, res: Response) => {
  const clientId = `client_${++clientIdCounter}`;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Store the connection
  clients.set(clientId, res);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
    console.log(`SSE client disconnected: ${clientId}`);
  });

  console.log(`SSE client connected: ${clientId} (total: ${clients.size})`);
};

/**
 * Broadcast an event to all connected SSE clients.
 * Call this from controllers when data changes.
 */
export function broadcastEvent(eventType: string, data: any) {
  const payload = JSON.stringify({
    type: eventType,
    data,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((client, clientId) => {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (err) {
      // Client disconnected, clean up
      clients.delete(clientId);
    }
  });
}

/**
 * Get the number of connected clients (for health checks).
 */
export function getConnectedClientCount(): number {
  return clients.size;
}
