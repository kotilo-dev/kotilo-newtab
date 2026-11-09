'use strict';
/* Yer imi yönetimi: sağ tık menüsü, ekleme/düzenleme/silme penceresi ve sürükle-bırakla taşıma.
   Tüm değişiklikler doğrudan Chrome yer imlerine (ext.bookmarks) yazılır; sayfa, newtab.js'teki
   ext.bookmarks.on* dinleyicileri sayesinde kendini yeniler. Tarayıcının kendi onay pencereleri
   (confirm/prompt) kullanılmaz, çünkü sayfayı kilitlerler. newtab.js'ten sonra yüklenir. */

const canManage = isExt && !!ext.bookmarks;

/* ---------------------------------------------------------
   Sayfanın kendi penceresi (dialog)
   --------------------------------------------------------- */
// fields: [{key, label, value, placeholder}]; danger: kırmızı onay düğmesi. Sonuç: değerler nesnesi ya da null (vazgeçildi).
function openDialog({ title, message, fields = [], okText = 'Save', danger = false }) {
  return new Promise((resolve) => {
    const dlg = $('dlg');
    const inputs = fields.map((f) => el('input', { id: 'dlg-' + f.key, value: f.value || '', placeholder: f.placeholder || '', autocomplete: 'off', spellcheck: 'false' }));
    const ok = el('button', { type: 'submit', class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), text: okText });
    const cancel = el('button', { type: 'button', class: 'btn', text: 'Cancel' });
    const form = el('form', { class: 'dlg-box', method: 'dialog' },
      el('h3', { text: title }),
      message ? el('p', { class: 'dlg-msg', text: message }) : null,
      ...fields.map((f, i) => el('label', { class: 'dlg-field' }, el('span', { text: f.label }), inputs[i])),
      el('div', { class: 'dlg-actions' }, cancel, ok));
    dlg.replaceChildren(form);
    const done = (val) => { dlg.close(); resolve(val); };
    cancel.addEventListener('click', () => done(null));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      done(Object.fromEntries(fields.map((f, i) => [f.key, inputs[i].value.trim()])));
    });
    dlg.addEventListener('cancel', () => resolve(null), { once: true }); // Esc
    dlg.showModal();
    (inputs[0] || ok).focus();
    if (inputs[0]) inputs[0].select();
  });
}

// "sap.com" → "https://sap.com"; javascript: gibi tehlikeli adresler reddedilir.
function normalizeUrl(u) {
  if (!u) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  if (/^(javascript|data):/i.test(u)) return null;
  try { new URL(u); return u; } catch { return null; }
}

/* ---------------------------------------------------------
   İşlemler
   --------------------------------------------------------- */
async function addBookmark(parentId) {
  const v = await openDialog({ title: 'Add bookmark', fields: [
    { key: 'title', label: 'Name', placeholder: 'e.g. Wikipedia' },
    { key: 'url', label: 'URL', placeholder: 'https://…' }] });
  if (!v) return;
  const url = normalizeUrl(v.url);
  if (!url) return openDialog({ title: 'Invalid URL', message: 'Please enter a valid web address.', okText: 'OK' });
  await ext.bookmarks.create({ parentId, title: v.title || hostOf(url), url });
}
async function addFolder(parentId) {
  const v = await openDialog({ title: 'New folder', fields: [{ key: 'title', label: 'Name', placeholder: 'Folder name' }], okText: 'Create' });
  if (!v || !v.title) return;
  await ext.bookmarks.create({ parentId, title: v.title });
}
async function editNode(n) {
  const fields = [{ key: 'title', label: 'Name', value: n.title }];
  if (n.url) fields.push({ key: 'url', label: 'URL', value: n.url });
  const v = await openDialog({ title: n.url ? 'Edit bookmark' : 'Rename folder', fields });
  if (!v) return;
  const changes = { title: v.title };
  if (n.url) {
    const url = normalizeUrl(v.url);
    if (!url) return openDialog({ title: 'Invalid URL', message: 'Please enter a valid web address.', okText: 'OK' });
    changes.url = url;
  }
  await ext.bookmarks.update(n.id, changes);
}
async function deleteNode(n) {
  const count = n.url ? 0 : countLinks(n);
  const msg = n.url ? `“${n.title || n.url}” will be removed from your bookmarks.`
    : `The folder “${n.title}”` + (count ? ` and the ${count} ${count === 1 ? 'link' : 'links'} inside it` : '') + ' will be removed.';
  const v = await openDialog({ title: n.url ? 'Delete bookmark?' : 'Delete folder?', message: msg + ' This cannot be undone here.', okText: 'Delete', danger: true });
  if (!v) return;
  if (n.url) await ext.bookmarks.remove(n.id); else await ext.bookmarks.removeTree(n.id);
}

/* ---------------------------------------------------------
   Sağ tık menüsü
   --------------------------------------------------------- */
function closeMenu() { $('ctx').hidden = true; }
function openMenu(x, y, items) {
  const m = $('ctx');
  m.replaceChildren(...items.map((it) => it === '-' ? el('div', { class: 'ctx-sep' }) : (() => {
    const b = el('button', { class: 'ctx-item' + (it.danger ? ' danger' : ''), role: 'menuitem', text: it.label });
    b.addEventListener('click', () => { closeMenu(); it.run(); });
    return b;
  })()));
  m.hidden = false;
  // Ekran dışına taşmasın.
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  m.querySelector('button').focus();
}
function menuFor(n) {
  const here = currentFolderId();
  const items = [];
  if (n && n.url) {
    items.push({ label: 'Open in new tab', run: () => { trackClick(n.url); window.open(n.url, '_blank'); } });
    items.push('-');
    items.push({ label: 'Edit…', run: () => editNode(n) });
  } else if (n) {
    items.push({ label: 'Open folder', run: () => openFolder(n.id) });
    const links = (n.children || []).filter((c) => c.url);
    // window.open art arda çağrılınca açılır pencere engelleyicisine takılır; ext.tabs.create takılmaz.
    if (links.length) items.push({ label: `Open all (${links.length})`, run: () => links.forEach((c) => ext.tabs.create({ url: c.url, active: false })) });
    items.push('-');
    items.push({ label: 'Rename…', run: () => editNode(n) });
  }
  if (n) items.push({ label: 'Delete…', danger: true, run: () => deleteNode(n) }, '-');
  items.push({ label: 'Add bookmark here…', run: () => addBookmark(here) });
  items.push({ label: 'Add folder here…', run: () => addFolder(here) });
  return items;
}

if (canManage) {
  $('side').addEventListener('contextmenu', (e) => {
    if (!e.target.closest('#paneBm')) return; // Recent / Top sites sekmelerinde tarayıcının kendi menüsü kalsın
    const row = e.target.closest('.side-item[data-id]');
    if (!row && e.target.closest('#frequent')) return; // sık kullanılanlar türetilmiş liste; tarayıcı menüsü kalsın
    e.preventDefault();
    openMenu(e.clientX, e.clientY, menuFor(row ? nodeById.get(row.dataset.id) : null));
  });
  $('sideAdd').addEventListener('click', (e) => {
    if (sideTab === 'news') return addFeed(); // News sekmesinde ＋ RSS kaynağı ekler (news.js)
    const r = e.currentTarget.getBoundingClientRect();
    openMenu(r.left, r.bottom + 4, [
      { label: 'Add bookmark…', run: () => addBookmark(currentFolderId()) },
      { label: 'Add folder…', run: () => addFolder(currentFolderId()) }]);
  });
} else {
  // Yer imi API'si yoksa (önizleme) ＋ yalnızca News sekmesinde çalışır.
  $('sideAdd').addEventListener('click', () => { if (sideTab === 'news') addFeed(); });
}
document.addEventListener('click', (e) => { if (!e.target.closest('#ctx') && !e.target.closest('#sideAdd')) closeMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('ctx').hidden) { e.stopPropagation(); closeMenu(); } }, true);
window.addEventListener('blur', closeMenu);
$('side').addEventListener('scroll', closeMenu);

/* ---------------------------------------------------------
   Sürükle-bırak: satırın üst yarısına bırakmak "önüne", alt yarısına "arkasına" taşır;
   bir klasörün ortasına bırakmak içine taşır; geri düğmesine bırakmak bir üst klasöre taşır.
   --------------------------------------------------------- */
const DND = 'application/x-bookmark-id';
let dragId = null;
function clearDrop() { document.querySelectorAll('.drop-before, .drop-after, .drop-into').forEach((x) => x.classList.remove('drop-before', 'drop-after', 'drop-into')); }
function dropZone(row, e) {
  const r = row.getBoundingClientRect();
  const y = (e.clientY - r.top) / r.height;
  const n = nodeById.get(row.dataset.id);
  if (!n.url && y > 0.25 && y < 0.75) return 'into';
  return y < 0.5 ? 'before' : 'after';
}
// Bırakılan öğe kendi alt klasörüne taşınamaz.
function isInside(childId, ancestorId) {
  for (let n = nodeById.get(childId); n; n = nodeById.get(n.parentId)) if (n.id === ancestorId) return true;
  return false;
}

if (canManage) {
  $('side').addEventListener('dragstart', (e) => {
    const row = e.target.closest('.side-item[data-id]');
    if (!row) return;
    dragId = row.dataset.id;
    e.dataTransfer.setData(DND, dragId);
    e.dataTransfer.effectAllowed = 'move';
    row.classList.add('dragging');
  });
  $('side').addEventListener('dragend', () => { dragId = null; clearDrop(); document.querySelectorAll('.dragging').forEach((x) => x.classList.remove('dragging')); });
  $('side').addEventListener('dragover', (e) => {
    if (!dragId) return;
    const back = e.target.closest('#sideBack');
    const row = e.target.closest('.side-item[data-id]');
    clearDrop();
    if (back && !back.hidden) { e.preventDefault(); back.classList.add('drop-into'); return; }
    if (!row || row.dataset.id === dragId) return;
    const zone = dropZone(row, e);
    if (zone === 'into' && isInside(row.dataset.id, dragId)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    row.classList.add('drop-' + zone);
  });
  $('side').addEventListener('dragleave', (e) => { if (!$('side').contains(e.relatedTarget)) clearDrop(); });
  $('side').addEventListener('drop', async (e) => {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation(); // duvar kâğıdı bırakma işleyicisine gitmesin
    const id = dragId; dragId = null; clearDrop();
    const back = e.target.closest('#sideBack');
    if (back) {
      const parent = navStack.length > 1 ? navStack[navStack.length - 2] : barId;
      return ext.bookmarks.move(id, { parentId: parent });
    }
    const row = e.target.closest('.side-item[data-id]');
    if (!row || row.dataset.id === id) return;
    const target = nodeById.get(row.dataset.id);
    const zone = dropZone(row, e);
    if (zone === 'into') {
      if (isInside(target.id, id)) return;
      return ext.bookmarks.move(id, { parentId: target.id });
    }
    // Chrome'da aynı klasör içinde taşırken index, öğe çıkarılmadan önceki sıraya göre verilir; bu yüzden düz hesap yeterli.
    await ext.bookmarks.move(id, { parentId: target.parentId, index: target.index + (zone === 'after' ? 1 : 0) });
  });
}
