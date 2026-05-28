const { execSync } = require('child_process');

const port = String(process.env.API_PORT || 3000);

try {
  const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
  const pids = new Set();

  for (const line of output.split(/\r?\n/)) {
    if (!line.includes('LISTENING')) {
      continue;
    }

    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') {
      pids.add(pid);
    }
  }

  if (!pids.size) {
    console.log(`[API] Puerto ${port} libre.`);
    process.exit(0);
  }

  for (const pid of pids) {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
    console.log(`[API] Proceso ${pid} finalizado.`);
  }
} catch (error) {
  if (String(error.stdout || '').trim() === '' && String(error.message).includes('findstr')) {
    console.log(`[API] Puerto ${port} libre.`);
    process.exit(0);
  }

  console.error('[API] No se pudo liberar el puerto:', error.message);
  process.exit(1);
}
