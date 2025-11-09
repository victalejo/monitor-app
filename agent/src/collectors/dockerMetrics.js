import Docker from 'dockerode';

let docker = null;

// Initialize Docker client
try {
  docker = new Docker({ socketPath: '/var/run/docker.sock' });
} catch (error) {
  console.warn('Docker not available:', error.message);
}

export const collectDockerMetrics = async () => {
  if (!docker) {
    return { containers: [], metrics: [] };
  }

  try {
    const containers = await docker.listContainers({ all: true });
    const metrics = [];
    const containerInfo = [];

    for (const containerData of containers) {
      const container = docker.getContainer(containerData.Id);

      containerInfo.push({
        containerId: containerData.Id,
        containerName: containerData.Names[0].replace('/', ''),
        image: containerData.Image,
        status: containerData.State,
        created: containerData.Created,
      });

      // Get container stats if running
      if (containerData.State === 'running') {
        try {
          const stats = await container.stats({ stream: false });

          // Calculate CPU percentage
          const cpuDelta = stats.cpu_stats.cpu_usage.total_usage -
                          (stats.precpu_stats.cpu_usage?.total_usage || 0);
          const systemDelta = stats.cpu_stats.system_cpu_usage -
                             (stats.precpu_stats.system_cpu_usage || 0);
          const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;

          // Calculate memory percentage
          const memoryUsage = stats.memory_stats.usage || 0;
          const memoryLimit = stats.memory_stats.limit || 1;
          const memoryPercent = (memoryUsage / memoryLimit) * 100;

          metrics.push({
            metricType: 'docker_cpu',
            value: cpuPercent,
            metadata: {
              containerId: containerData.Id,
              containerName: containerData.Names[0].replace('/', ''),
            },
          });

          metrics.push({
            metricType: 'docker_memory',
            value: memoryPercent,
            metadata: {
              containerId: containerData.Id,
              containerName: containerData.Names[0].replace('/', ''),
              usage: memoryUsage,
              limit: memoryLimit,
            },
          });
        } catch (statsError) {
          console.error(`Error getting stats for container ${containerData.Id}:`, statsError.message);
        }
      }
    }

    return { containers: containerInfo, metrics };
  } catch (error) {
    console.error('Error collecting Docker metrics:', error);
    return { containers: [], metrics: [] };
  }
};

export const getDockerInfo = async () => {
  if (!docker) {
    return null;
  }

  try {
    const info = await docker.info();
    return {
      containers: info.Containers,
      containersRunning: info.ContainersRunning,
      containersPaused: info.ContainersPaused,
      containersStopped: info.ContainersStopped,
      images: info.Images,
      serverVersion: info.ServerVersion,
    };
  } catch (error) {
    console.error('Error getting Docker info:', error);
    return null;
  }
};
