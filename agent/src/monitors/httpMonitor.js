import axios from 'axios';

/**
 * HTTP/HTTPS Service Monitor
 * Checks health of HTTP/HTTPS endpoints
 */

/**
 * Check a single HTTP/HTTPS service
 * @param {Object} service - Service configuration
 * @param {number} service.id - Service ID
 * @param {string} service.endpoint - URL to check
 * @param {number} service.expected_status_code - Expected HTTP status code
 * @param {number} service.timeout - Request timeout in seconds
 * @returns {Promise<Object>} Check result
 */
export async function checkHttpService(service) {
  const startTime = Date.now();

  try {
    const response = await axios({
      method: 'GET',
      url: service.endpoint,
      timeout: (service.timeout || 10) * 1000,
      validateStatus: () => true, // Don't throw on any status code
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Monitor-Agent/1.0',
      },
    });

    const responseTime = Date.now() - startTime;
    const expectedStatus = service.expected_status_code || 200;
    const actualStatus = response.status;

    // Determine if service is up based on status code
    let status = 'up';
    let errorMessage = null;

    if (actualStatus !== expectedStatus) {
      status = 'degraded';
      errorMessage = `Expected status ${expectedStatus}, got ${actualStatus}`;
    }

    // Consider 5xx as down
    if (actualStatus >= 500) {
      status = 'down';
      errorMessage = `Server error: ${actualStatus}`;
    }

    return {
      serviceId: service.id,
      status,
      responseTime,
      statusCode: actualStatus,
      errorMessage,
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;

    let errorMessage = error.message;
    let status = 'down';

    // More specific error messages
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'DNS lookup failed';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorMessage = 'Request timeout';
    } else if (error.code === 'CERT_HAS_EXPIRED') {
      errorMessage = 'SSL certificate expired';
    } else if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
      errorMessage = 'Self-signed SSL certificate';
    }

    return {
      serviceId: service.id,
      status,
      responseTime,
      statusCode: null,
      errorMessage,
    };
  }
}

/**
 * Check multiple HTTP/HTTPS services
 * @param {Array<Object>} services - Array of service configurations
 * @returns {Promise<Array<Object>>} Array of check results
 */
export async function checkHttpServices(services) {
  const results = [];

  // Check services in parallel
  const promises = services.map(service => checkHttpService(service));
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
        statusCode: null,
        errorMessage: `Check failed: ${result.reason.message}`,
      });
    }
  });

  return results;
}
