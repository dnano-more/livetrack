/**
 * Kafka Producer
 *
 * Why Kafka here instead of direct DB writes?
 * ─────────────────────────────────────────────
 * In a high-frequency location system (e.g. 1000 riders sending GPS every 3 s)
 * you'd get ~20k writes/minute hitting a single DB.  Kafka acts as a buffer:
 *
 *  Socket → Kafka → [Consumer A] → Socket broadcast (low latency, stateless)
 *                 → [Consumer B] → DB batch writes  (durable, can be delayed)
 *
 * Consumer groups allow independent scaling of broadcast vs persistence.
 */

import { Kafka, Partitioners, CompressionTypes } from 'kafkajs';

const TOPIC    = process.env.KAFKA_TOPIC_LOCATION || 'location-updates';
const BROKERS  = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const CLIENT   = process.env.KAFKA_CLIENT_ID      || 'livetrack-server';

let producer = null;
let kafka    = null;

export async function initKafkaProducer() {
try {
    kafka = new Kafka({
      clientId: CLIENT,
      brokers:  BROKERS,
      retry: { initialRetryTime: 300, retries: 5 },
    });
  
    producer = kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
      allowAutoTopicCreation: true,
    });
  
    await producer.connect();
    console.log(`✅ Kafka producer connected → brokers: ${BROKERS.join(', ')}`);
    return producer;
} catch (error) {
    console.warn('⚠️  Kafka unavailable — location events will not be published');
    console.warn('   Start Kafka or set KAFKA_BROKERS correctly');
    // Don't throw — let server start without Kafka
}
}

/**
 * Publish a location event to Kafka.
 *
 * @param {object} event
 * @param {string} event.userId
 * @param {string} event.userName
 * @param {number} event.lat
 * @param {number} event.lng
 * @param {number} event.accuracy   GPS accuracy in metres
 * @param {number} event.timestamp  Unix ms
 */
export async function publishLocationEvent(event) {
    if (!producer) {
    console.warn('[kafka] Producer not ready, skipping event');
    return; // Don't throw
  }

  // Validate event before publishing
  const { userId, lat, lng, timestamp } = event;
  if (!userId || typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error(`Invalid location event: ${JSON.stringify(event)}`);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(`Out-of-range coordinates: lat=${lat} lng=${lng}`);
  }

  await producer.send({
    topic: TOPIC,
    compression: CompressionTypes.GZIP,
    messages: [
      {
        // Partition by userId so all events from the same user land on the same partition
        // This guarantees ordered processing per user without global ordering overhead
        key:   userId,
        value: JSON.stringify({ ...event, timestamp: timestamp || Date.now() }),
      },
    ],
  });
}

export function getKafkaInstance() {
  return kafka;
}

export async function disconnectProducer() {
  if (producer) await producer.disconnect();
}
