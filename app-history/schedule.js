const { execSync } = require('child_process');
const path = require('path');

// Quarterly: runs on the 1st of Jan, Apr, Jul, Oct at 9am
const CRON_SCHEDULE = '0 9 1 1,4,7,10 *';
const LABEL = 'com.app-history.quarterly-capture';
const CAPTURE_SCRIPT = path.join(__dirname, 'capture.js');
const LOG_FILE = path.join(__dirname, 'capture.log');
const PLIST_PATH = path.join(process.env.HOME, `Library/LaunchAgents/${LABEL}.plist`);

const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${process.execPath}</string>
        <string>${CAPTURE_SCRIPT}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${__dirname}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:${path.dirname(process.execPath)}</string>
    </dict>
    <key>StartCalendarInterval</key>
    <array>
        <dict>
            <key>Month</key><integer>1</integer>
            <key>Day</key><integer>1</integer>
            <key>Hour</key><integer>9</integer>
            <key>Minute</key><integer>0</integer>
        </dict>
        <dict>
            <key>Month</key><integer>4</integer>
            <key>Day</key><integer>1</integer>
            <key>Hour</key><integer>9</integer>
            <key>Minute</key><integer>0</integer>
        </dict>
        <dict>
            <key>Month</key><integer>7</integer>
            <key>Day</key><integer>1</integer>
            <key>Hour</key><integer>9</integer>
            <key>Minute</key><integer>0</integer>
        </dict>
        <dict>
            <key>Month</key><integer>10</integer>
            <key>Day</key><integer>1</integer>
            <key>Hour</key><integer>9</integer>
            <key>Minute</key><integer>0</integer>
        </dict>
    </array>
    <key>StandardOutPath</key>
    <string>${LOG_FILE}</string>
    <key>StandardErrorPath</key>
    <string>${LOG_FILE}</string>
</dict>
</plist>`;

const arg = process.argv[2];

if (arg === '--install') {
  const fs = require('fs');
  fs.writeFileSync(PLIST_PATH, plistContent);
  try { execSync(`launchctl unload ${PLIST_PATH} 2>/dev/null`); } catch {}
  execSync(`launchctl load ${PLIST_PATH}`);
  console.log('Quarterly schedule installed.');
  console.log(`  Schedule: 1st of Jan, Apr, Jul, Oct at 9:00 AM`);
  console.log(`  Plist: ${PLIST_PATH}`);
  console.log(`  Log: ${LOG_FILE}`);
} else if (arg === '--remove') {
  try {
    execSync(`launchctl unload ${PLIST_PATH}`);
    require('fs').unlinkSync(PLIST_PATH);
    console.log('Schedule removed.');
  } catch {
    console.log('No schedule found to remove.');
  }
} else if (arg === '--status') {
  try {
    const result = execSync(`launchctl list | grep ${LABEL}`, { encoding: 'utf-8' });
    console.log('Schedule is active:');
    console.log(`  ${result.trim()}`);
    console.log(`  Next runs: Jan 1, Apr 1, Jul 1, Oct 1 at 9:00 AM`);
  } catch {
    console.log('Schedule is not installed. Run: npm run schedule:install');
  }
} else {
  console.log('Usage:');
  console.log('  npm run schedule:install   Install quarterly launchd schedule');
  console.log('  npm run schedule:remove    Remove the schedule');
  console.log('  npm run schedule:status    Check if schedule is active');
}
