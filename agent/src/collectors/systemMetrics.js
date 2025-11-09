import si from 'systeminformation';

export const collectSystemMetrics = async () => {
  try {
    const metrics = [];

    // CPU metrics
    const cpuLoad = await si.currentLoad();
    metrics.push({
      metricType: 'cpu',
      value: cpuLoad.currentLoad,
      metadata: {
        cores: cpuLoad.cpus.map((cpu) => cpu.load),
        avgLoad: cpuLoad.avgLoad,
      },
    });

    // Memory metrics
    const memory = await si.mem();
    const memoryUsedPercent = (memory.used / memory.total) * 100;
    metrics.push({
      metricType: 'memory',
      value: memoryUsedPercent,
      metadata: {
        total: memory.total,
        used: memory.used,
        free: memory.free,
        available: memory.available,
      },
    });

    // Disk metrics
    const disks = await si.fsSize();
    for (const disk of disks) {
      const diskUsedPercent = disk.use;
      metrics.push({
        metricType: 'disk',
        value: diskUsedPercent,
        metadata: {
          mount: disk.mount,
          fs: disk.fs,
          type: disk.type,
          size: disk.size,
          used: disk.used,
          available: disk.available,
        },
      });
    }

    // Network metrics
    const networkStats = await si.networkStats();
    for (const iface of networkStats) {
      // Calculate transfer rate (bytes per second)
      metrics.push({
        metricType: 'network_rx',
        value: iface.rx_sec || 0,
        metadata: {
          interface: iface.iface,
          operstate: iface.operstate,
        },
      });

      metrics.push({
        metricType: 'network_tx',
        value: iface.tx_sec || 0,
        metadata: {
          interface: iface.iface,
          operstate: iface.operstate,
        },
      });
    }

    return metrics;
  } catch (error) {
    console.error('Error collecting system metrics:', error);
    return [];
  }
};

export const getSystemInfo = async () => {
  try {
    const [cpu, mem, os, system] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
      si.system(),
    ]);

    return {
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed,
      },
      memory: {
        total: mem.total,
      },
      os: {
        platform: os.platform,
        distro: os.distro,
        release: os.release,
        kernel: os.kernel,
        arch: os.arch,
      },
      system: {
        manufacturer: system.manufacturer,
        model: system.model,
      },
    };
  } catch (error) {
    console.error('Error getting system info:', error);
    return null;
  }
};
