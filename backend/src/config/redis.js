import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Redis client configuration
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  console.log('✓ Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Cache helper functions
export const cacheGet = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
};

export const cacheSet = async (key, value, expirationSeconds = 3600) => {
  try {
    await redis.setex(key, expirationSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Redis set error:', error);
    return false;
  }
};

export const cacheDel = async (key) => {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Redis delete error:', error);
    return false;
  }
};

export const cacheFlush = async () => {
  try {
    await redis.flushdb();
    return true;
  } catch (error) {
    console.error('Redis flush error:', error);
    return false;
  }
};

export default redis;
