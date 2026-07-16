const { exec } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const HOSTS_PATH = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
const BLOCK_MARKER = '# [remote-control]';

function lockScreen() {
  if (process.platform === 'win32') {
    exec('rundll32.exe user32.dll,LockWorkStation');
  }
}

// Unlocking a locked Windows session programmatically is not possible
// without the user's credentials. This is intentional OS-level security.
function unlockScreen() {
  console.log('[unlock_screen] Cannot unlock screen programmatically — requires user credentials.');
}

function assertHostsReadable(tag) {
  try {
    fs.accessSync(HOSTS_PATH, fs.constants.R_OK);
    return true;
  } catch (err) {
    console.error(`[${tag}] Cannot read hosts file at ${HOSTS_PATH}: ${err.code} ${err.message}`);
    return false;
  }
}

// Runs a PowerShell script with UAC elevation (triggers a prompt unless already
// running as admin). The script is staged in a temp .ps1 to avoid the
// double-escaping required by Start-Process -ArgumentList.
function runElevated(psScript, tag) {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `rc-hosts-${process.pid}-${Date.now()}.ps1`);
    try {
      fs.writeFileSync(tmp, psScript, { encoding: 'utf8' });
    } catch (err) {
      reject(new Error(`failed to stage elevation script: ${err.message}`));
      return;
    }

    const launcher =
      `try { ` +
      `Start-Process -FilePath 'powershell.exe' ` +
      `-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${tmp}' ` +
      `-Verb RunAs -Wait -WindowStyle Hidden ` +
      `} catch { Write-Error $_.Exception.Message; exit 1 }`;

    exec(
      `powershell -NoProfile -NonInteractive -Command "${launcher}"`,
      (err, stdout, stderr) => {
        try { fs.unlinkSync(tmp); } catch { /* ignore */ }
        if (err) {
          const msg = stderr?.trim() || err.message;
          console.error(`[${tag}] UAC elevation failed: ${msg}`);
          reject(err);
          return;
        }
        resolve();
      },
    );
  });
}

// Reduce any user input — full URL, bare host, with/without www or port — to a
// canonical registrable host. 'https://www.facebook.com/foo' → 'facebook.com'.
function normalizeDomain(input) {
  if (!input) return '';
  let host = String(input).trim().toLowerCase();
  host = host.replace(/^[*.\s]+/, '');
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  host = host.split(/[/?#]/)[0];
  host = host.replace(/:\d+$/, '');
  host = host.replace(/^\*\./, '');
  host = host.replace(/^www\./, '');
  host = host.replace(/[^a-z0-9.-]/g, '');
  host = host.replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '');
  if (!host) return '';
  if (!host.includes('.')) host = `${host}.com`;
  if (!/^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(host)) return '';
  return host;
}

function baseDomain(host) {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  return parts.slice(-2).join('.');
}

// The hosts file blocks by hostname (protocol-independent, so http/https are
// both covered), but it does NOT wildcard subdomains — so we emit both the bare
// domain and its www. variant to catch the common cases.
function expandHosts(domains) {
  const hosts = new Set();
  for (const d of domains) {
    const normalized = normalizeDomain(d);
    if (!normalized) continue;
    const bare = baseDomain(normalized);
    hosts.add(normalized);
    hosts.add(bare);
    hosts.add(`www.${bare}`);
    hosts.add(`m.${bare}`);
    hosts.add(`mobile.${bare}`);
  }
  return [...hosts];
}

async function filterSites({ domains = [] } = {}) {
  if (!domains.length) {
    console.log('[filter_sites] No domains provided, skipping.');
    return;
  }
  if (!assertHostsReadable('filter_sites')) return;

  const hosts = expandHosts(domains);
  if (!hosts.length) {
    console.log('[filter_sites] No valid domains after normalization, skipping.');
    return;
  }

  const entries = hosts.map((d) => `127.0.0.1 ${d}   ${BLOCK_MARKER}`).join(os.EOL);
  const block = os.EOL + entries + os.EOL;
  console.log(`[filter_sites] Blocking ${hosts.length} host(s): ${hosts.join(', ')}`);

  try {
    fs.appendFileSync(HOSTS_PATH, block, 'utf8');
    console.log('[filter_sites] Done (direct write — admin context).');
    return;
  } catch (err) {
    if (err.code !== 'EACCES' && err.code !== 'EPERM') {
      console.error(`[filter_sites] Unexpected write error: ${err.code} ${err.message}`);
      return;
    }
    console.warn(`[filter_sites] Not running as admin (${err.code}), requesting UAC elevation…`);
  }

  const psEntries = entries.replace(/'/g, "''");
  const script = `Add-Content -Path '${HOSTS_PATH}' -Value '${psEntries}' -Encoding UTF8`;
  try {
    await runElevated(script, 'filter_sites');
    console.log('[filter_sites] Done via UAC elevation.');
  } catch {
    console.error('[filter_sites] Aborted — user may have denied the UAC prompt.');
  }
}

async function clearFilters() {
  if (!assertHostsReadable('clear_filters')) return;

  let original;
  try {
    original = fs.readFileSync(HOSTS_PATH, 'utf8');
  } catch (err) {
    console.error(`[clear_filters] Read failed: ${err.code} ${err.message}`);
    return;
  }

  const lines = original.split(/\r?\n/);
  const remaining = lines.filter((l) => !l.includes(BLOCK_MARKER));
  const removed = lines.length - remaining.length;
  if (removed === 0) {
    console.log('[clear_filters] No marker lines found, nothing to do.');
    return;
  }
  console.log(`[clear_filters] Removing ${removed} marker line(s).`);

  try {
    fs.writeFileSync(HOSTS_PATH, remaining.join(os.EOL), 'utf8');
    console.log('[clear_filters] Done (direct write — admin context).');
    return;
  } catch (err) {
    if (err.code !== 'EACCES' && err.code !== 'EPERM') {
      console.error(`[clear_filters] Unexpected write error: ${err.code} ${err.message}`);
      return;
    }
    console.warn(`[clear_filters] Not running as admin (${err.code}), requesting UAC elevation…`);
  }

  const script =
    `$lines = Get-Content -LiteralPath '${HOSTS_PATH}'\r\n` +
    `$filtered = $lines | Where-Object { $_ -notmatch [regex]::Escape('${BLOCK_MARKER}') }\r\n` +
    `$filtered | Set-Content -LiteralPath '${HOSTS_PATH}' -Encoding UTF8\r\n`;
  try {
    await runElevated(script, 'clear_filters');
    console.log('[clear_filters] Done via UAC elevation.');
  } catch {
    console.error('[clear_filters] Aborted — user may have denied the UAC prompt.');
  }
}

module.exports = { lockScreen, unlockScreen, filterSites, clearFilters };
