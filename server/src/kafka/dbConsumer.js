/**
 * Database Persistence Consumer  (Consumer Group: db-persister)
 *
 * Independently consumes location events and writes them to SQLite.
 *
 * Why a separate consumer group?
 * ─────────────────────────────────────────────────────────────────
 * Kafka tracks each consumer group's offset independently.  If the DB
 * is slow, it doesn't block the socket broadcaster.  If the broadcaster
 * crashes, DB writes continue uninterrupted.  Each group processes every
 * message — this is Kafka's fan-out model.
 *
 * In a production system you might:
 *  - Batch writes every N messages or T milliseconds
 *  - Use a time-series DB (InfluxDB, TimescaleDB) for geo-queries
 *  - Back-pressure the consumer by pausing partitions when DB is behind
 */

import { getKafkaInstance } from './producer.js';
import { saveLocationEvent, upsertActiveUser } from '../db/database.js';

const TOPIC       = process.env.KAFKA_TOPIC_LOCATION || 'location-updates';
const GROUP_ID    = process.env.KAFKA_CONSUMER_GROUP_DB || 'db-persister';

// Batch write buffer: flush every BATCH_SIZE messages or FLUSH_MS milliseconds
const BATCH_SIZE  = 20;
const FLUSH_MS    = 2000;

let consumer      = null;
let writeBuffer   = [];
let flushTimer    = null;

async function flushBuffer() {
  if (writeBuffer.length === 0) return;
  const batch = writeBuffer.splice(0, writeBuffer.length);
  try {
    for (const event of batch) {
      await saveLocationEvent(event);
      await upsertActiveUser(event);
    }
    console.debug(`[db-consumer] Persisted ${batch.length} events`);
  } catch (err) {
    console.error('[db-consumer] Batch write failed:', err.message);
    // On failure push back to buffer (simple retry; prod should use DLQ)
    writeBuffer.unshift(...batch);
  }
}

export async function startDbConsumer() {
  const kafka  = getKafkaInstance();
  consumer     = kafka.consumer({ groupId: GROUP_ID });

  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  // Periodic flush timer
  flushTimer = setInterval(flushBuffer, FLUSH_MS);

  console.log(`✅ DB consumer started [group: ${GROUP_ID}]`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value.toString());

        // Drop events with invalid coordinates
        const { userId, lat, lng, timestamp } = event;
        if (!userId || typeof lat !== 'number' || typeof lng !== 'number') return;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180)             return;

        writeBuffer.push(event);

        if (writeBuffer.length >= BATCH_SIZE) {
          clearInterval(flushTimer);
          await flushBuffer();
          flushTimer = setInterval(flushBuffer, FLUSH_MS);
        }
      } catch (err) {
        console.error('[db-consumer] Parse error:', err.message);
      }
    },
  });

  return consumer;
}

export async function stopDbConsumer() {
  if (flushTimer) clearInterval(flushTimer);
  await flushBuffer(); // Drain remaining buffer on shutdown
  if (consumer) await consumer.disconnect();
}
