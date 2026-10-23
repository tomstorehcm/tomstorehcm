const db = require('../db');

// Ghi lai lich su chinh sua thong tin (yeu cau sua chua, yeu cau thu cu doi
// moi, khach mua hang...) de admin biet AI/LUC NAO da doi gi -- dung chung 1
// bang admin_edit_logs cho moi loai, phan biet nhau qua entityType +
// entityId (vd 'repair_request' + id). Chi so sanh CAC TRUONG duoc liet ke
// trong fieldLabels, va chi luu 1 dong log neu THUC SU co truong nao doi
// (bam "Luu thay doi" ma khong sua gi thi khong ghi rac vao lich su).
async function logFieldChanges(entityType, entityId, entityLabel, oldRow, newValues, fieldLabels) {
  const changes = [];
  Object.keys(fieldLabels).forEach((field) => {
    const oldVal = oldRow[field] === null || oldRow[field] === undefined ? '' : String(oldRow[field]);
    const newVal = newValues[field] === null || newValues[field] === undefined ? '' : String(newValues[field]);
    if (oldVal !== newVal) {
      changes.push({ field, label: fieldLabels[field], old: oldVal, new: newVal });
    }
  });
  if (changes.length === 0) return;
  await db('admin_edit_logs').insert({
    entity_type: entityType,
    entity_id: entityId,
    entity_label: entityLabel || null,
    changes: JSON.stringify(changes)
  });
}

// Lay lich su chinh sua cua 1 doi tuong, moi nhat hien truoc, da JSON.parse
// san cot `changes` de view dung thang (array cac {field, label, old, new}).
async function getEditHistory(entityType, entityId) {
  const rows = await db('admin_edit_logs')
    .where({ entity_type: entityType, entity_id: entityId })
    .orderBy('created_at', 'desc');
  return rows.map((r) => {
    let changes = [];
    try {
      changes = JSON.parse(r.changes);
    } catch (e) {
      changes = [];
    }
    return { ...r, changes };
  });
}

module.exports = { logFieldChanges, getEditHistory };
