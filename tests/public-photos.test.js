const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const logic = require(path.join(root, 'site', 'app.js'));

const driveId = '1AbCdEfGhIjKlMnOpQrStUvWxYz';
assert.equal(logic.googleDriveFileId(`https://drive.google.com/file/d/${driveId}/view?usp=sharing`), driveId);
assert.equal(logic.googleDriveFileId(`https://drive.google.com/open?id=${driveId}`), driveId);
assert.equal(logic.googleDriveFileId('https://example.com/photo.jpg'), '');
assert.equal(logic.googleDriveFileId('not-a-url'), '');

assert.deepEqual(logic.photoUrls(`https://drive.google.com/file/d/${driveId}/view?usp=sharing`), {
  imageUrl: `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`,
  sourceUrl: `https://drive.google.com/file/d/${driveId}/view`
});
assert.deepEqual(logic.photoUrls('https://cdn.example.com/photo.jpg'), {
  imageUrl: 'https://cdn.example.com/photo.jpg',
  sourceUrl: 'https://cdn.example.com/photo.jpg'
});
assert.deepEqual(logic.photoUrls('javascript:alert(1)'), { imageUrl: '', sourceUrl: '' });
assert.deepEqual(logic.photoUrls('https://drive.google.com/drive/folders/1234567890abcdef'), { imageUrl: '', sourceUrl: '' });

const photos = [
  { id: 'P1', date: '2026-10-09' },
  { id: 'P3', date: '' },
  { id: 'P2', date: '2026-10-11' }
].sort(logic.comparePhotos);
assert.deepEqual(photos.map((photo) => photo.id), ['P2', 'P1', 'P3']);

const html = fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8');
assert.match(html, /data-tab="photos"/);
assert.match(html, /id="photos-content"/);
assert.match(html, /id="photo-dialog"/);

const setup = fs.readFileSync(path.join(root, 'apps-script', 'Setup.gs'), 'utf8');
const publisher = fs.readFileSync(path.join(root, 'apps-script', 'Publisher.gs'), 'utf8');
assert.match(setup, /requireTextIsUrl\(\)/);
assert.match(publisher, /validateUniqueIds_\(photos, 'ID photo'/);
assert.match(publisher, /une URL HTTPS est obligatoire/);

console.log('Public photo tests passed.');
