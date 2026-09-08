const db = require('../db');

async function showWarrantyPolicyPage(req, res, next) {
  try {
    // Admin can add/remove/rename sections (mục) freely, so the public page
    // just loops over however many rows exist -- no fixed section count/keys.
    const sections = await db('warranty_policy_sections').orderBy('id');

    res.render('warranty-policy', {
      title: 'Chính Sách Bảo Hành - TOMSTORE',
      sections
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showWarrantyPolicyPage };
