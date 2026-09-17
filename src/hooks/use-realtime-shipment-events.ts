import { useEffect, useRef, useState } from 'react';

import { appConfig } from '@/config/app-config';
import {
  connectRealtimeSession,
  isEncomiendaActualizadaEvent,
  type EncomiendaActualizadaEventData,
  type RealtimeConnectionState,
  type RealtimeEventObservation,
} from '@/services/session-websocket';
import { getSessionToken } from '@/services/session-token-store';

interface UseRealtimeShipmentEventsResult {
  connection: RealtimeConnectionState;
  latestEvent: RealtimeEventObservation | null;
}

/**
 * Connects to the driver realtime session and calls `onEncomiendaActualizada`
 * whenever the backend broadcasts that reduced event, so screens can refetch
 * the affected list/detail instead of only displaying the raw event.
 * A no-op while `appConfig.fixturesEnabled` is true, matching the previous
 * per-screen behavior.
 */
export function useRealtimeShipmentEvents(
  onEncomiendaActualizada?: (data: EncomiendaActualizadaEventData) => void,
): UseRealtimeShipmentEventsResult {
  const [connection, setConnection] = useState<RealtimeConnectionState>({
    status: 'disconnected',
    reconnectAttempt: 0,
  });
  const [latestEvent, setLatestEvent] = useState<RealtimeEventObservation | null>(null);
  const onEncomiendaActualizadaRef = useRef(onEncomiendaActualizada);

  useEffect(() => {
    onEncomiendaActualizadaRef.current = onEncomiendaActualizada;
  });

  useEffect(() => {
    if (appConfig.fixturesEnabled) {
      return;
    }

    let isMounted = true;
    let realtimeConnection: ReturnType<typeof connectRealtimeSession> | null = null;

    void getSessionToken()
      .then((token) => {
        if (!isMounted || !token) {
          return;
        }

        realtimeConnection = connectRealtimeSession({
          token,
          onStateChange: (nextConnection) => {
            if (isMounted) {
              setConnection(nextConnection);
            }
          },
          onEvent: (event) => {
            if (!isMounted) {
              return;
            }

            setLatestEvent(event);

            if (event.event && isEncomiendaActualizadaEvent(event.event)) {
              onEncomiendaActualizadaRef.current?.(event.event.data);
            }
          },
        });
      })
      .catch(() => {
        if (isMounted) {
          setConnection({ status: 'error', reconnectAttempt: 0 });
        }
      });

    return () => {
      isMounted = false;
      realtimeConnection?.disconnect();
    };
  }, []);

  return { connection, latestEvent };
}
