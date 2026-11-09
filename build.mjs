// Firefox paketi ve Chrome Web Mağazası paketi üretir: node build.mjs
// Kök klasör Chrome kaynağıdır (Chrome doğrudan bu klasörden yüklenir). Bu betik dist/firefox altına
// aynı dosyaları kopyalar ve manifest'i Firefox'a uyarlar:
//   - "key" alanı kaldırılır (Chrome'a özel sabit kimlik; Firefox tanımaz)
//   - "favicon" izni kaldırılır (Chrome'a özel; Firefox'ta simgeler DuckDuckGo'dan gelir)
//   - browser_specific_settings.gecko eklenir: sabit eklenti kimliği (storage.sync ve imza için gerekli),
//     en düşük Firefox sürümü ve Mozilla'nın istediği veri aktarımı beyanı
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'dist', 'firefox');
const FILES = ['newtab.html', 'newtab.css', 'newtab.js', 'widgets.js', 'manage.js', 'settings.js', 'markets.js', 'calendar.js', 'news.js', 'pomodoro.js', 'background.js', 'icons'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of FILES) cpSync(join(root, f), join(out, f), { recursive: true });

const m = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
delete m.key;
// Firefox MV3 arka planı service worker değil, arka plan betiği olarak çalıştırır.
m.background = { scripts: [m.background.service_worker] };
m.permissions = m.permissions.filter((p) => p !== 'favicon');
m.browser_specific_settings = {
  gecko: {
    id: 'newtab@kotilo.dev',
    strict_min_version: '142.0',
    // Dışarı giden veri: hava durumu için konum (Open-Meteo, BigDataCloud) ve site simgeleri için yer imlerinin alan adları (DuckDuckGo).
    data_collection_permissions: { required: ['locationInfo', 'bookmarksInfo'] },
  },
};
writeFileSync(join(out, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
console.log('Firefox paketi hazır:', out, '· sürüm', m.version);

// Chrome Web Mağazası paketi: mağaza eklentiye kendi kimliğini verir, bu yüzden "key" alanı çıkarılır.
// Kök klasör (paketlenmemiş geliştirme kurulumu) key ile kalır.
const store = join(root, 'dist', 'chrome-store');
rmSync(store, { recursive: true, force: true });
mkdirSync(store, { recursive: true });
for (const f of FILES) cpSync(join(root, f), join(store, f), { recursive: true });
const c = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
delete c.key;
writeFileSync(join(store, 'manifest.json'), JSON.stringify(c, null, 2) + '\n');
const zip = join(root, 'dist', `kotilo-newtab-${c.version}-chrome-store.zip`);
rmSync(zip, { force: true });
// Windows'un kendi tar'ı (bsdtar) -a ile zip yazar; diğer sistemlerde zip komutu.
if (process.platform === 'win32') execFileSync('C:\\Windows\\System32\\tar.exe', ['-a', '-cf', zip, '-C', store, ...readdirSync(store)]);
else execFileSync('zip', ['-qr', zip, ...readdirSync(store)], { cwd: store });
console.log('Chrome Web Mağazası paketi hazır:', zip);
