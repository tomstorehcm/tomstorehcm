const { body, validationResult } = require('express-validator');
const db = require('../../db');
const { TRANSACTION_TYPES, TRANSACTION_TYPE_KEYS, transactionTypeLabel } = require('../../utils/purchaseTypes');

const PHONE_RE = /^(0\d{9}|\+84\d{9})$/;

const customerValidators = [
  body('name').trim().notEmpty().withMessage('Vui lòng nhập họ tên').isLength({ max: 150 }),
  body('phone').trim().matches(PHONE_RE).withMessage('Số điện thoại không hợp lệ')
];

const purchaseValidators = [
  body('productName').trim().notEmpty().withMessage('Vui lòng nhập tên sản phẩm').isLength({ max: 255 }),
  body('purchaseDate').notEmpty().withMessage('Vui lòng chọn ngày mua').isISO8601().withMessage('Ngày mua không hợp lệ'),
  body('price')
    .optional({ checkFalsy: true })
    .customSanitizer((v) => String(v).replace(/[^\d]/g, ''))
    .isInt({ min: 0 })
    .withMessage('Giá không hợp lệ'),
  body('warrantyExpiresAt').optional({ checkFalsy: true }).isISO8601().withMessage('Hạn bảo hành không hợp lệ')
];

function purchaseFieldsFromBody(body) {
  return {
    product_name: body.productName.trim(),
    imei: (body.imei || '').trim() || null,
    purchase_date: body.purchaseDate,
    price: body.price ? Number(String(body.price).replace(/[^\d]/g, '')) : null,
    warranty_expires_at: body.warrantyExpiresAt || null,
    transaction_type: TRANSACTION_TYPE_KEYS.includes(body.transactionType) ? body.transactionType : 'mua_moi',
    note: (body.purchaseNote || '').trim() || null
  };
}

async function listCustomers(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    let query = db('customers').orderBy('created_at', 'desc');
    if (q) {
      query = query.where(function () {
        this.where('name', 'like', `%${q}%`).orWhere('phone', 'like', `%${q}%`);
      });
    }
    const customers = await query;

    const ids = customers.map((c) => c.id);
    const purchasesByCustomer = {};
    if (ids.length > 0) {
      const purchases = await db('customer_purchases').whereIn('customer_id', ids).orderBy('purchase_date', 'desc');
      purchases.forEach((p) => {
        if (!purchasesByCustomer[p.customer_id]) purchasesByCustomer[p.customer_id] = [];
        purchasesByCustomer[p.customer_id].push(p);
      });
    }

    const rows = customers.map((c) => {
      const list = purchasesByCustomer[c.id] || [];
      return {
        ...c,
        purchaseCount: list.length,
        lastPurchaseDate: list.length > 0 ? list[0].purchase_date : null
      };
    });

    res.render('admin/customers', {
      title: 'Khách mua hàng - TOMSTORE Admin',
      customers: rows,
      q
    });
  } catch (err) {
    next(err);
  }
}

function newCustomerForm(req, res) {
  res.render('admin/customer-form', {
    title: 'Thêm khách mua hàng - TOMSTORE Admin',
    formData: {},
    errors: [],
    transactionTypes: TRANSACTION_TYPES
  });
}

// If the phone number already belongs to a customer, the "new" purchase is
// appended to that existing customer instead of creating a duplicate --
// this is how a returning buyer gets a second product added to their record.
async function createCustomer(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('admin/customer-form', {
        title: 'Thêm khách mua hàng - TOMSTORE Admin',
        formData: req.body,
        errors: errors.array(),
        transactionTypes: TRANSACTION_TYPES
      });
    }

    const phone = req.body.phone.trim();
    let customer = await db('customers').where('phone', phone).first();

    if (!customer) {
      const [insertedRaw] = await db('customers').insert({
        name: req.body.name.trim(),
        phone,
        address: (req.body.address || '').trim() || null,
        note: (req.body.note || '').trim() || null
      });
      const customerId = insertedRaw && insertedRaw.id ? insertedRaw.id : insertedRaw;
      customer = await db('customers').where('id', customerId).first();
    }

    await db('customer_purchases').insert({
      customer_id: customer.id,
      ...purchaseFieldsFromBody(req.body)
    });

    res.redirect('/admin/khach-hang/' + customer.id);
  } catch (err) {
    next(err);
  }
}

async function showCustomer(req, res, next) {
  try {
    const customer = await db('customers').where('id', req.params.id).first();
    if (!customer) return res.redirect('/admin/khach-hang');

    const purchases = await db('customer_purchases').where('customer_id', customer.id).orderBy('purchase_date', 'desc');

    res.render('admin/customer-detail', {
      title: `${customer.name} - Khách mua hàng - TOMSTORE Admin`,
      customer,
      purchases,
      transactionTypes: TRANSACTION_TYPES,
      transactionTypeLabel,
      errors: [],
      purchaseForm: {}
    });
  } catch (err) {
    next(err);
  }
}

async function editCustomerForm(req, res, next) {
  try {
    const customer = await db('customers').where('id', req.params.id).first();
    if (!customer) return res.redirect('/admin/khach-hang');
    res.render('admin/customer-edit', {
      title: 'Sửa thông tin khách hàng - TOMSTORE Admin',
      customer,
      errors: []
    });
  } catch (err) {
    next(err);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const customer = await db('customers').where('id', req.params.id).first();
    if (!customer) return res.redirect('/admin/khach-hang');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('admin/customer-edit', {
        title: 'Sửa thông tin khách hàng - TOMSTORE Admin',
        customer: { ...customer, ...req.body },
        errors: errors.array()
      });
    }

    await db('customers').where('id', customer.id).update({
      name: req.body.name.trim(),
      phone: req.body.phone.trim(),
      address: (req.body.address || '').trim() || null,
      note: (req.body.note || '').trim() || null
    });

    res.redirect('/admin/khach-hang/' + customer.id);
  } catch (err) {
    next(err);
  }
}

async function deleteCustomer(req, res, next) {
  try {
    await db('customers').where('id', req.params.id).del();
    res.redirect('/admin/khach-hang');
  } catch (err) {
    next(err);
  }
}

async function addPurchase(req, res, next) {
  try {
    const customer = await db('customers').where('id', req.params.id).first();
    if (!customer) return res.redirect('/admin/khach-hang');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const purchases = await db('customer_purchases').where('customer_id', customer.id).orderBy('purchase_date', 'desc');
      return res.status(400).render('admin/customer-detail', {
        title: `${customer.name} - Khách mua hàng - TOMSTORE Admin`,
        customer,
        purchases,
        transactionTypes: TRANSACTION_TYPES,
        transactionTypeLabel,
        errors: errors.array(),
        purchaseForm: req.body
      });
    }

    await db('customer_purchases').insert({
      customer_id: customer.id,
      ...purchaseFieldsFromBody(req.body)
    });

    res.redirect('/admin/khach-hang/' + customer.id);
  } catch (err) {
    next(err);
  }
}

async function editPurchaseForm(req, res, next) {
  try {
    const customer = await db('customers').where('id', req.params.id).first();
    const purchase = await db('customer_purchases').where({ id: req.params.purchaseId, customer_id: req.params.id }).first();
    if (!customer || !purchase) return res.redirect('/admin/khach-hang');

    res.render('admin/purchase-edit', {
      title: 'Sửa thông tin lần mua - TOMSTORE Admin',
      customer,
      purchase,
      transactionTypes: TRANSACTION_TYPES,
      errors: []
    });
  } catch (err) {
    next(err);
  }
}

async function updatePurchase(req, res, next) {
  try {
    const customer = await db('customers').where('id', req.params.id).first();
    const purchase = await db('customer_purchases').where({ id: req.params.purchaseId, customer_id: req.params.id }).first();
    if (!customer || !purchase) return res.redirect('/admin/khach-hang');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('admin/purchase-edit', {
        title: 'Sửa thông tin lần mua - TOMSTORE Admin',
        customer,
        purchase: { ...purchase, ...req.body },
        transactionTypes: TRANSACTION_TYPES,
        errors: errors.array()
      });
    }

    await db('customer_purchases').where('id', purchase.id).update(purchaseFieldsFromBody(req.body));

    res.redirect('/admin/khach-hang/' + customer.id);
  } catch (err) {
    next(err);
  }
}

async function deletePurchase(req, res, next) {
  try {
    await db('customer_purchases').where({ id: req.params.purchaseId, customer_id: req.params.id }).del();
    res.redirect('/admin/khach-hang/' + req.params.id);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  customerValidators,
  purchaseValidators,
  listCustomers,
  newCustomerForm,
  createCustomer,
  showCustomer,
  editCustomerForm,
  updateCustomer,
  deleteCustomer,
  addPurchase,
  editPurchaseForm,
  updatePurchase,
  deletePurchase
};
