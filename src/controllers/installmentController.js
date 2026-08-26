const db = require('../db');

async function showInstallmentPage(req, res, next) {
  try {
    const sections = await db('installment_sections').orderBy('id');
    const tinDung = sections.find((s) => s.section_key === 'tin_dung');
    const nganHang = sections.find((s) => s.section_key === 'ngan_hang');

    res.render('installment', {
      title: 'Trả góp linh động - TOMSTORE',
      tinDung,
      nganHang
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showInstallmentPage };
