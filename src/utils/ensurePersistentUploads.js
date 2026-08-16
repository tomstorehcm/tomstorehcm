const fs = require('fs');
const path = require('path');

// Hostinger's Horizons hosting deploys each push into a brand-new
// hbuilds/versions/<id>/nodejs folder -- anything an admin uploads to
// public/images/uploads/ lives only in that folder and is gone on the next
// deploy. This finds the stable ancestor directory (the parent of "hbuilds",
// which never changes across deploys), moves any uploads there once, and
// replaces public/images/uploads with a symlink into it -- so uploaded
// images survive every future deploy automatically.

function findHbuildsParent(startDir) {
  let dir = startDir;
  let prev = null;
  while (dir !== prev) {
    if (path.basename(dir) === 'hbuilds') return path.dirname(dir);
    prev = dir;
    dir = path.dirname(dir);
  }
  return null;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function ensurePersistentUploads() {
  if (process.env.NODE_ENV !== 'production') return;

  const uploadsDir = path.join(__dirname, '..', '..', 'public', 'images', 'uploads');
  const hbuildsParent = findHbuildsParent(__dirname);
  const persistentDir = process.env.PERSISTENT_UPLOADS_DIR
    || (hbuildsParent ? path.join(hbuildsParent, 'persistent-uploads') : null);

  if (!persistentDir) {
    console.error('ensurePersistentUploads: could not determine a persistent uploads path, skipping.');
    return;
  }

  try {
    let stat = null;
    try {
      stat = fs.lstatSync(uploadsDir);
    } catch (e) {
      stat = null;
    }

    if (stat && stat.isSymbolicLink()) return; // already set up on a previous boot

    fs.mkdirSync(persistentDir, { recursive: true });
    if (stat && stat.isDirectory()) {
      copyDirRecursive(uploadsDir, persistentDir);
    }

    // Prove the symlink can actually be created before touching the original
    // directory -- if this throws (e.g. no permission), leave everything as
    // it was rather than deleting real uploads with no replacement in place.
    const tmpLink = uploadsDir + '.tmp-symlink';
    fs.rmSync(tmpLink, { recursive: true, force: true });
    fs.symlinkSync(persistentDir, tmpLink, 'dir');

    if (stat && stat.isDirectory()) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.dirname(uploadsDir), { recursive: true });
    fs.renameSync(tmpLink, uploadsDir);
    console.log('Persistent uploads ready:', uploadsDir, '->', persistentDir);
  } catch (err) {
    console.error('ensurePersistentUploads failed, uploads stay local to this build:', err.message);
  }
}

module.exports = { ensurePersistentUploads };
