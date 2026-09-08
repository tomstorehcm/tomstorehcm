const { body, validationResult } = require('express-validator');
const db = require('../../db');

async function listLeads(req, res, next) {
  try {
    const leads = await db('customer_leads').orderBy('created_at', 'desc');
    res.render('admin/customer-leads', {
      title: 'Thông tin khách hàng - TOMSTORE Admin',
      leads
    });
  } catch (err) {
    next(err);
  }
}

function newLeadForm(req, res) {
  res.render('admin/customer-lead-form', {
    title: 'Thêm khách hàng - TOMSTORE Admin',
    lead: {},
    errors: [],
    isEdit: false
  });
}

const leadValidators = [
  body('customerName').trim().notEmpty().withMessage('Vui lòng nhập họ tên').isLength({ max: 150 }),
  body('phone').trim().matches(/^(0\d{9}|\+84\d{9})$/).withMessage('Số điện thoại không hợp lệ')
];

async function createLead(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('admin/customer-lead-form', {
        title: 'Thêm khách hàng - TOMSTORE Admin',
        lead: req.body,
        errors: errors.array(),
        isEdit: false
      });
    }

    await db('customer_leads').insert({
      customer_name: req.body.customerName.trim(),
      phone: req.body.phone.trim(),
      interest: (req.body.interest || '').trim() || null,
      note: (req.body.note || '').trim() || null,
      source: (req.body.source || '').trim() || null
    });

    res.redirect('/admin/khach-hang');
  } catch (err) {
    next(err);
  }
}

async function editLeadForm(req, res, next) {
  try {
    const lead = await db('customer_leads').where('id', req.params.id).first();
    if (!lead) return res.redirect('/admin/khach-hang');

    res.render('admin/customer-lead-form', {
      title: 'Sửa thông tin khách hàng - TOMSTORE Admin',
      lead: {
        id: lead.id,
        customerName: lead.customer_name,
        phone: lead.phone,
        interest: lead.interest,
        note: lead.note,
        source: lead.source
      },
      errors: [],
      isEdit: true
    });
  } catch (err) {
    next(err);
  }
}

async function updateLead(req, res, next) {
  try {
    const lead = await db('customer_leads').where('id', req.params.id).first();
    if (!lead) return res.redirect('/admin/khach-hang');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('admin/customer-lead-form', {
        title: 'Sửa thông tin khách hàng - TOMSTORE Admin',
        lead: { ...req.body, id: lead.id },
        errors: errors.array(),
        isEdit: true
      });
    }

    await db('customer_leads').where('id', lead.id).update({
      customer_name: req.body.customerName.trim(),
      phone: req.body.phone.trim(),
      interest: (req.body.interest || '').trim() || null,
      note: (req.body.note || '').trim() || null,
      source: (req.body.source || '').trim() || null,
      updated_at: new Date()
    });

    res.redirect('/admin/khach-hang');
  } catch (err) {
    next(err);
  }
}

async function deleteLead(req, res, next) {
  try {
    await db('customer_leads').where('id', req.params.id).del();
    res.redirect('/admin/khach-hang');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listLeads,
  newLeadForm,
  leadValidators,
  createLead,
  editLeadForm,
  updateLead,
  deleteLead
};
