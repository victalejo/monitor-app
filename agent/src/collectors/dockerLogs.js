import Docker from 'dockerode';

/**
 * Docker Logs Collector
 * Collects logs from Docker containers
 */

let docker = null;
let dockerAvailable = false;

// Track last timestamps per container to avoid duplicates
const lastTimestamps = new Map();

/**
 * Initialize Docker connection
 */
function initDocker() {
  if (docker) return;

  try {
    docker = new Docker({ socketPath: '/var/run/docker.sock' });
    dockerAvailable = true;
  } catch (error) {
    console.error('Docker not available:', error.message);
    dockerAvailable = false;
  }
}

/**
 * Collect logs from all running Docker containers
 * @param {number} maxLinesPerContainer - Max log lines per container (default: 50)
 * @returns {Promise<Array<Object>>} Array of log entries
 */
export async function collectDockerLogs(maxLinesPerContainer = 50) {
  initDocker();

  if (!dockerAvailable) {
    return [];
  }

  try {
    const containers = await docker.listContainers();
    const logs = [];

    // Collect logs from each container in parallel
    const promises = containers.map(containerInfo =>
      collectContainerLogs(containerInfo, maxLinesPerContainer)
    );

    const results = await Promise.allSettled(promises);

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        logs.push(...result.value);
      }
    });

    return logs;
  } catch (error) {
    console.error('Error collecting Docker logs:', error.message);
    return [];
  }
}

/**
 * Collect logs from a single container
 * @param {Object} containerInfo - Container info from listContainers
 * @param {number} maxLines - Maximum number of log lines
 * @returns {Promise<Array<Object>>} Array of log entries
 */
async function collectContainerLogs(containerInfo, maxLines) {
  try {
    const container = docker.getContainer(containerInfo.Id);
    const containerId = containerInfo.Id.substring(0, 12); // Short ID
    const containerName = containerInfo.Names[0].replace(/^\//, ''); // Remove leading /

    // Get last timestamp for this container
    const since = lastTimestamps.get(containerId) || Math.floor(Date.now() / 1000) - 300; // Default: last 5 minutes

    // Get logs
    const logStream = await container.logs({
      stdout: true,
      stderr: true,
      since,
      tail: maxLines,
      timestamps: true,
    });

    // Docker logs format: 8 bytes header + message
    const logs = parseDockerLogs(logStream, containerId, containerName);

    // Update last timestamp
    if (logs.length > 0) {
      const latestLog = logs[logs.length - 1];
      if (latestLog.metadata && latestLog.metadata.timestamp) {
        lastTimestamps.set(containerId, Math.floor(latestLog.metadata.timestamp / 1000));
      }
    }

    return logs;
  } catch (error) {
    console.error(`Error collecting logs from container ${containerInfo.Names[0]}:`, error.message);
    return [];
  }
}

/**
 * Parse Docker logs stream
 * @param {Buffer} stream - Docker logs stream
 * @param {string} containerId - Container short ID
 * @param {string} containerName - Container name
 * @returns {Array<Object>} Parsed log entries
 */
function parseDockerLogs(stream, containerId, containerName) {
  const logs = [];
  let offset = 0;

  while (offset < stream.length) {
    // Docker log format:
    // Byte 0: stream type (0=stdin, 1=stdout, 2=stderr)
    // Bytes 1-3: padding
    // Bytes 4-7: frame size (big-endian)
    // Bytes 8+: log message

    if (offset + 8 > stream.length) break;

    const streamType = stream[offset];
    const frameSize = stream.readUInt32BE(offset + 4);

    if (offset + 8 + frameSize > stream.length) break;

    const message = stream.toString('utf8', offset + 8, offset + 8 + frameSize).trim();

    if (message) {
      // Parse timestamp if present (format: 2024-01-01T12:00:00.000000000Z message)
      const timestampMatch = message.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);

      let timestamp, actualMessage;
      if (timestampMatch) {
        timestamp = new Date(timestampMatch[1]);
        actualMessage = timestampMatch[2];
      } else {
        timestamp = new Date();
        actualMessage = message;
      }

      // Determine log level from stream type and message content
      const level = determineLogLevel(streamType, actualMessage);

      logs.push({
        level,
        source: 'docker',
        message: actualMessage.substring(0, 1000), // Limit message length
        metadata: {
          containerId,
          containerName,
          streamType: streamType === 1 ? 'stdout' : 'stderr',
          timestamp: timestamp.getTime(),
        },
      });
    }

    offset += 8 + frameSize;
  }

  return logs;
}

/**
 * Determine log level from stream type and message content
 * @param {number} streamType - 1=stdout, 2=stderr
 * @param {string} message - Log message
 * @returns {string} Log level
 */
function determineLogLevel(streamType, message) {
  const lowerMessage = message.toLowerCase();

  // Check message content first
  if (lowerMessage.includes('fatal') || lowerMessage.includes('panic')) {
    return 'error';
  }
  if (lowerMessage.includes('error') || lowerMessage.includes(' err ') || lowerMessage.includes('[err]')) {
    return 'error';
  }
  if (lowerMessage.includes('warn') || lowerMessage.includes('[warn]')) {
    return 'warning';
  }
  if (lowerMessage.includes('debug') || lowerMessage.includes('[debug]')) {
    return 'debug';
  }

  // Default based on stream type
  return streamType === 2 ? 'error' : 'info';
}

/**
 * Reset timestamps (useful for testing or manual resets)
 */
export function resetTimestamps() {
  lastTimestamps.clear();
}
