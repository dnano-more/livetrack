/**
 * Socket Broadcast Consumer  (Consumer Group: socket-broadcaster)
 *
 * This consumer receives location events from Kafka and broadcasts
 * them to all connected Socket.IO clients in real time.
 *
 * Consumer group isolation:
 *   - This group ("socket-broadcaster") only handles broadcast logic
 *   - The DB consumer ("db-persister") independently handles persistence
 *   - Both consume the same topic partition independently (fan-out)
 *   - If broadcast fails, DB writes are unaffected and vice-versa
 */

import { getKafkaInstance } from './producer.js';
import { getSocketIO } from '../socket/socketServer.js';

const TOPIC       = process.env.KAFKA_TOPIC_LOCATION   || 'location-updates';
const GROUP_ID    = process.env.KAFKA_CONSUMER_GROUP_SOCKET || 'socket-broadcaster';

let consumer = null;

export async function startSocketConsumer() {
  const kafka   = getKafkaInstance();
  consumer      = kafka.consumer({ groupId: GROUP_ID });

  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  console.log(`✅ Socket consumer started [group: ${GROUP_ID}]`);

  await consumer.run({
    // eachBatch gives us more control (batched ack, pause/resume)
    eachBatchAutoResolve: true,
    eachBatch: async ({ batch, heartbeat }) => {
      const io = getSocketIO();

      for (const message of batch.messages) {
        try {
          const event = JSON.parse(message.value.toString());
          const { userId, userName, lat, lng, accuracy, timestamp } = event;

          // Basic duplicate / stale check: drop events older than 30 s
          if (Date.now() - timestamp > 30_000) {
            console.debug(`[socket-consumer] Dropping stale event for ${userId}`);
            continue;
          }

          // Broadcast to all authenticated connected clients
          io.emit('location:update', { userId, userName, lat, lng, accuracy, timestamp });

        } catch (err) {
          console.error('[socket-consumer] Bad message:', err.message);
        }

        await heartbeat(); // Prevent consumer timeout on large batches
      }
    },
  });

  return consumer;
}

export async function stopSocketConsumer() {
  if (consumer) await consumer.disconnect();
}
