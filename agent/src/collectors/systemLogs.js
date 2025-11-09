import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * System Logs Collector
 * Collects logs from journalctl (systemd) or syslog
 */

// Track last timestamp to avoid duplicates
let lastTimestamp = null;

/**
 * Get recent system logs from journalctl
 * @param {number} minutes - Number of minutes to look back (default: 5)
 * @param {number} maxLines - Maximum number of log lines (default: 100)
 * @returns {Promise<Array<Object>>} Array of log entries
 */
export async function collectSystemLogs(minutes = 5, maxLines = 100) {
  try {
    // Check if journalctl is available
    const isJournalctl = await checkJournalctl();

    if (isJournalctl) {
      return await collectFromJournalctl(minutes, maxLines);
    } else {
      // Fallback to syslog if journalctl not available
      return await collectFromSyslog(minutes, maxLines);
    }
  } catch (error) {
    console.error('Error collecting system logs:', error.message);
    return [];
  }
}

/**
 * Check if journalctl is available
 * @returns {Promise<boolean>}
 */
async function checkJournalctl() {
  try {
    await execAsync('which journalctl');
    return true;
  } catch {
    return false;
  }
}

/**
 * Collect logs from journalctl
 * @param {number} minutes
 * @param {number} maxLines
 * @returns {Promise<Array<Object>>}
 */
async function collectFromJournalctl(minutes, maxLines) {
  try {
    // Get logs from last N minutes in JSON format
    const since = lastTimestamp || `${minutes} minutes ago`;
    const cmd = `journalctl --since="${since}" -o json -n ${maxLines} --no-pager`;

    const { stdout } = await execAsync(cmd);

    if (!stdout.trim()) {
      return [];
    }

    const logs = [];
    const lines = stdout.trim().split('\n');

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        // Extract relevant fields
        const level = mapJournalPriority(entry.PRIORITY);
        const message = entry.MESSAGE || '';
        const timestamp = entry.__REALTIME_TIMESTAMP
          ? new Date(parseInt(entry.__REALTIME_TIMESTAMP) / 1000)
          : new Date();

        // Skip if empty message
        if (!message.trim()) continue;

        // Update last timestamp
        if (!lastTimestamp || timestamp > new Date(lastTimestamp)) {
          lastTimestamp = timestamp.toISOString();
        }

        logs.push({
          level,
          source: 'system',
          message: message.substring(0, 1000), // Limit message length
          metadata: {
            unit: entry._SYSTEMD_UNIT || entry.SYSLOG_IDENTIFIER || 'unknown',
            pid: entry._PID || entry.SYSLOG_PID,
            hostname: entry._HOSTNAME,
          },
        });
      } catch (parseError) {
        // Skip malformed JSON lines
        continue;
      }
    }

    return logs;
  } catch (error) {
    console.error('Error collecting journalctl logs:', error.message);
    return [];
  }
}

/**
 * Collect logs from syslog (fallback)
 * @param {number} minutes
 * @param {number} maxLines
 * @returns {Promise<Array<Object>>}
 */
async function collectFromSyslog(minutes, maxLines) {
  try {
    // Try to read from common syslog locations
    const syslogPaths = [
      '/var/log/syslog',
      '/var/log/messages',
      '/var/log/system.log',
    ];

    let cmd = null;
    for (const path of syslogPaths) {
      try {
        await execAsync(`test -f ${path}`);
        cmd = `tail -n ${maxLines} ${path}`;
        break;
      } catch {
        continue;
      }
    }

    if (!cmd) {
      return []; // No syslog file found
    }

    const { stdout } = await execAsync(cmd);

    if (!stdout.trim()) {
      return [];
    }

    const logs = [];
    const lines = stdout.trim().split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // Basic syslog parsing (very simplified)
      const level = extractSyslogLevel(line);
      const message = line.substring(0, 1000); // Limit message length

      logs.push({
        level,
        source: 'system',
        message,
        metadata: {
          raw: true, // Indicate this is unparsed syslog
        },
      });
    }

    return logs;
  } catch (error) {
    console.error('Error collecting syslog:', error.message);
    return [];
  }
}

/**
 * Map journalctl priority to log level
 * @param {string} priority - Journalctl priority (0-7)
 * @returns {string} Log level
 */
function mapJournalPriority(priority) {
  const p = parseInt(priority || '6', 10);

  // Syslog priority levels:
  // 0 emerg, 1 alert, 2 crit, 3 err, 4 warning, 5 notice, 6 info, 7 debug
  if (p <= 3) return 'error';
  if (p === 4) return 'warning';
  if (p === 7) return 'debug';
  return 'info';
}

/**
 * Extract log level from syslog line
 * @param {string} line - Syslog line
 * @returns {string} Log level
 */
function extractSyslogLevel(line) {
  const lowerLine = line.toLowerCase();

  if (lowerLine.includes('error') || lowerLine.includes('err') || lowerLine.includes('fatal')) {
    return 'error';
  }
  if (lowerLine.includes('warn')) {
    return 'warning';
  }
  if (lowerLine.includes('debug')) {
    return 'debug';
  }
  return 'info';
}

/**
 * Reset the last timestamp (useful for testing or manual resets)
 */
export function resetTimestamp() {
  lastTimestamp = null;
}
