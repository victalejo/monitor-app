import net from 'net';

/**
 * Database Service Monitor
 * Checks health of database services (PostgreSQL, MySQL, MongoDB)
 * Uses TCP connection checks to avoid requiring database drivers
 */

/**
 * Check if a TCP port is open and responding
 * @param {string} host - Hostname or IP
 * @param {number} port - Port number
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Object>} Connection result
 */
function checkTcpConnection(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      socket.destroy();
      resolve({
        connected: false,
        responseTime: Date.now() - startTime,
        error: 'Connection timeout',
      });
    }, timeout);

    socket.on('connect', () => {
      clearTimeout(timer);
      const responseTime = Date.now() - startTime;
      socket.destroy();
      resolve({
        connected: true,
        responseTime,
        error: null,
      });
    });

    socket.on('error', (err) => {
      if (!timedOut) {
        clearTimeout(timer);
        socket.destroy();
        resolve({
          connected: false,
          responseTime: Date.now() - startTime,
          error: err.message,
        });
      }
    });

    socket.connect(port, host);
  });
}

/**
 * Parse database endpoint into host and port
 * @param {string} endpoint - Database connection string
 * @param {string} serviceType - Type of database service
 * @returns {Object} Parsed connection info
 */
function parseEndpoint(endpoint, serviceType) {
  // Default ports for different database types
  const defaultPorts = {
    postgresql: 5432,
    mysql: 3306,
    mongodb: 27017,
  };

  // Handle different formats:
  // - host:port
  // - host
  // - postgresql://host:port/db
  // - mysql://host:port/db
  // - mongodb://host:port/db

  let host, port;

  // Remove protocol if present
  const withoutProtocol = endpoint.replace(/^[a-z]+:\/\//, '');

  // Remove database name if present (everything after /)
  const hostPort = withoutProtocol.split('/')[0];

  // Remove credentials if present (everything before @)
  const cleanHostPort = hostPort.includes('@')
    ? hostPort.split('@')[1]
    : hostPort;

  if (cleanHostPort.includes(':')) {
    [host, port] = cleanHostPort.split(':');
    port = parseInt(port, 10);
  } else {
    host = cleanHostPort;
    port = defaultPorts[serviceType] || 3306;
  }

  return { host, port };
}

/**
 * Check a single database service
 * @param {Object} service - Service configuration
 * @param {number} service.id - Service ID
 * @param {string} service.service_type - Type: postgresql, mysql, mongodb
 * @param {string} service.endpoint - Connection string
 * @param {number} service.timeout - Request timeout in seconds
 * @returns {Promise<Object>} Check result
 */
export async function checkDatabaseService(service) {
  const { host, port } = parseEndpoint(service.endpoint, service.service_type);
  const timeoutMs = (service.timeout || 10) * 1000;

  const result = await checkTcpConnection(host, port, timeoutMs);

  let status, statusCode, errorMessage;

  if (result.connected) {
    status = 'up';
    statusCode = 1; // Custom code: 1 = connected
    errorMessage = null;
  } else {
    status = 'down';
    statusCode = 0; // Custom code: 0 = not connected
    errorMessage = result.error;
  }

  return {
    serviceId: service.id,
    status,
    responseTime: result.responseTime,
    statusCode,
    errorMessage,
  };
}

/**
 * Check multiple database services
 * @param {Array<Object>} services - Array of service configurations
 * @returns {Promise<Array<Object>>} Array of check results
 */
export async function checkDatabaseServices(services) {
  const results = [];

  // Check services in parallel
  const promises = services.map(service => checkDatabaseService(service));
  const settled = await Promise.allSettled(promises);

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      // If check itself failed, report as down
      results.push({
        serviceId: services[index].id,
        status: 'down',
        responseTime: 0,
        statusCode: 0,
        errorMessage: `Check failed: ${result.reason.message}`,
      });
    }
  });

  return results;
}
