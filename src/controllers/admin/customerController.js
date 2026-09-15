const { body, validationResult } = require('express-validator');
const db = require('../../db');
const { TRANSACTION_TYPES, TRANSACTION_TYPE_KEYS, transactionTypeLabel } = require('../../utils/purchaseTypes');
const { toDateInputValue } = require('../../utils/format');
const { WARRANTY_ISSUE_TYPES, issueKeysFromBody, warrantyIssueLabel } = require('../../utils/warrantyIssueTypes');

const PHONE_RE = /^(0\d{9}|\+84\d{9})$/;

const customerValidators = [
  body('name').trim().notEmpty().withMessage('Vui lòng nhập họ tên').isLength({ max: 150 }),
  body('phone').trim().matches(PHONE_RE).withMessage('Số điện thoại không hợp lệ')
];

// Form "+ Thêm khách mua hàng" / "+ Thêm sản phẩm mới" co 2 che do chon o
// dau form (nut "Sản phẩm mua mới" / "Mang tới bảo hành", xem entry-mode-*
// trong customer-form.ejs va customer-detail.ejs), gui kem 1 field an
// `mode`. Che do 'warranty' bat buoc phai co `issue` (tinh trang/loi mang
// toi) va se tu tao them 1 dong purchase_warranty_visits ngay khi luu --
// xem createCustomer/addPurchase.
const purchaseValidators = [
  body('productName').trim().notEmpty().withMessage('Vui lòng nhập tên sản phẩm').isLength({ max: 255 }),
  body('purchaseDate').notEmpty().withMessage('Vui lòng chọn ngày').isISO8601().withMessage('Ngày không hợp lệ'),
  body('price')
    .optional({ checkFalsy: true })
    .customSanitizer((v) => String(v).replace(/[^\d]/g, ''))
    .isInt({ min: 0 })
    .withMessage('Giá/chi phí không hợp lệ'),
  body('warrantyExpiresAt').optional({ checkFalsy: true }).isISO8601().withMessage('Hạn bảo hành không hợp lệ'),
  // "issue" gio la nhom checkbox (name="issue" lap lai nhieu o) thay vi 1
  // textarea -- xem warrantyIssueTypes.js. Custom validator vi express-validator
  // khong co san .notEmpty() cho mang.
  body('issue').custom((value, { req }) => {
    if (req.body.mode !== 'warranty') return true;
    if (issueKeysFromBody(req.body).length === 0) {
      throw new Error('Vui lòng chọn ít nhất 1 tình trạng / lỗi mang tới');
    }
    return true;
  })
];

// Lich su cac lan khach mang san pham (da mua o day hoac mua noi khac, cung
// dung chung 1 dong customer_purchases) toi bao hanh -- xem "Log tinh nang"
// trong deploy-notes.md de biet ly do tach bang rieng thay vi de trong o
// ghi chu cua purchase.
const warrantyVisitValidators = [
  body('visitDate').notEmpty().withMessage('Vui lòng chọn ngày bảo hành').isISO8601().withMessage('Ngày bảo hành không hợp lệ'),
  body('issue').custom((value, { req }) => {
    if (issueKeysFromBody(req.body).length === 0) {
      throw new Error('Vui lòng chọn ít nhất 1 tình trạng / lỗi mang tới');
    }
    return true;
  }),
  body('resolution').optional({ checkFalsy: true }).isLength({ max: 1000 }),
  body('cost')
    .optional({ checkFalsy: true })
    .customSanitizer((v) => String(v).replace(/[^\d]/g, ''))
    .isInt({ min: 0 })
    .withMessage('Chi phí không hợp lệ')
];

function purchaseFieldsFromBody(body) {
  // Che do "Mang tới bảo hành" khong hien o dropdown "Hinh thuc giao dich"
  // (client an, server luon ep cung 'bao_hanh_ngoai') nhung VAN giu o "Han
  // bao hanh" -- 1 san pham mang toi bao hanh co the co nhieu linh kien
  // duoc bao hanh voi han khac nhau, nen khong duoc tu dong xoa gia tri nay.
  const isWarranty = body.mode === 'warranty';
  return {
    product_name: body.productName.trim(),
    imei: (body.imei || '').trim() || null,
    purchase_date: body.purchaseDate,
    price: body.price ? Number(String(body.price).replace(/[^\d]/g, '')) : null,
    warranty_expires_at: body.warrantyExpiresAt || null,
    transaction_type: isWarranty ? 'bao_hanh_ngoai' : (TRANSACTION_TYPE_KEYS.includes(body.transactionType) ? body.transactionType : 'mua_moi'),
    note: (body.purchaseNote || '').trim() || null
  };
}

// Che do "Mang tới bảo hành" gop lam 1 buoc: vua tao dong customer_purchases
// (qua purchaseFieldsFromBody o tren) vua tao luon dong purchase_warranty_visits
// dau tien cho no, khoi phai bam sang trang "Bảo hành" rieng ngay sau khi luu.
function warrantyVisitFieldsFromPurchaseBody(body) {
  return {
    visit_date: body.purchaseDate,
    issue: issueKeysFromBody(body).join(','),
    resolution: null,
    cost: body.price ? Number(String(body.price).replace(/[^\d]/g, '')) : null,
    note: (body.purchaseNote || '').trim() || null
  };
}

function warrantyVisitFieldsFromBody(body) {
  return {
    visit_date: body.visitDate,
    issue: issueKeysFromBody(body).join(','),
    resolution: (body.resolution || '').trim() || null,
    cost: body.cost ? Number(String(body.cost).replace(/[^\d]/g, '')) : null,
    note: (body.note || '').trim() || null
  };
}

// Lay toan bo cac lan bao hanh (khong chi dem so luong) theo tung purchase_id
// -- dung de nhung san luon "Lich su bao hanh" vao popup "Chi tiết" o
// customer-detail.ejs, khoi phai bam sang trang /bao-hanh rieng moi xem duoc.
async function warrantyVisitsByPurchase(purchaseIds) {
  if (purchaseIds.length === 0) return {};
  const rows = await db('purchase_warranty_visits')
    .whereIn('purchase_id', purchaseIds)
    .orderBy('visit_date', 'desc');
  const map = {};
  rows.forEach((r) => {
    if (!map[r.purchase_id]) map[r.purchase_id] = [];
    map[r.purchase_id].push(r);
  });
  return map;
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
    transactionTypes: TRANSACTION_TYPES,
    warrantyIssueTypes: WARRANTY_ISSUE_TYPES
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
        formData: { ...req.body, issueKeys: issueKeysFromBody(req.body) },
        errors: errors.array(),
        transactionTypes: TRANSACTION_TYPES,
        warrantyIssueTypes: WARRANTY_ISSUE_TYPES
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

    const [purchaseInsertedRaw] = await db('customer_purchases').insert({
      customer_id: customer.id,
      ...purchaseFieldsFromBody(req.body)
    });
    const purchaseId = purchaseInsertedRaw && purchaseInsertedRaw.id ? purchaseInsertedRaw.id : purchaseInsertedRaw;

    if (req.body.mode === 'warranty') {
      await db('purchase_warranty_visits').insert({
        purchase_id: purchaseId,
        ...warrantyVisitFieldsFromPurchaseBody(req.body)
      });
    }

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
    const visitsByPurchase = await warrantyVisitsByPurchase(purchases.map((p) => p.id));
    const purchasesWithVisits = purchases.map((p) => ({
      ...p,
      warrantyVisits: visitsByPurchase[p.id] || [],
      warrantyVisitCount: (visitsByPurchase[p.id] || []).length
    }));

    res.render('admin/customer-detail', {
      title: `${customer.name} - Khách mua hàng - TOMSTORE Admin`,
      customer,
      purchases: purchasesWithVisits,
      transactionTypes: TRANSACTION_TYPES,
      transactionTypeLabel,
      warrantyIssueTypes: WARRANTY_ISSUE_TYPES,
      warrantyIssueLabel,
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
      const visitsByPurchase = await warrantyVisitsByPurchase(purchases.map((p) => p.id));
      const purchasesWithVisits = purchases.map((p) => ({
        ...p,
        warrantyVisits: visitsByPurchase[p.id] || [],
        warrantyVisitCount: (visitsByPurchase[p.id] || []).length
      }));
      return res.status(400).render('admin/customer-detail', {
        title: `${customer.name} - Khách mua hàng - TOMSTORE Admin`,
        customer,
        purchases: purchasesWithVisits,
        transactionTypes: TRANSACTION_TYPES,
        transactionTypeLabel,
        warrantyIssueTypes: WARRANTY_ISSUE_TYPES,
        warrantyIssueLabel,
        errors: errors.array(),
        purchaseForm: { ...req.body, issueKeys: issueKeysFromBody(req.body) }
      });
    }

    const [purchaseInsertedRaw] = await db('customer_purchases').insert({
      customer_id: customer.id,
      ...purchaseFieldsFromBody(req.body)
    });
    const purchaseId = purchaseInsertedRaw && purchaseInsertedRaw.id ? purchaseInsertedRaw.id : purchaseInsertedRaw;

    if (req.body.mode === 'warranty') {
      await db('purchase_warranty_visits').insert({
        purchase_id: purchaseId,
        ...warrantyVisitFieldsFromPurchaseBody(req.body)
      });
    }

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
      purchase: {
        ...purchase,
        purchase_date: toDateInputValue(purchase.purchase_date),
        warranty_expires_at: toDateInputValue(purchase.warranty_expires_at)
      },
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

// customer + purchase phai duoc tim cung luc va khop nhau (purchase.customer_id
// == customer.id) de tranh truong hop sua URL doi purchaseId sang cua khach
// khac ma van duoc chap nhan.
async function loadCustomerAndPurchase(req) {
  const customer = await db('customers').where('id', req.params.id).first();
  if (!customer) return {};
  const purchase = await db('customer_purchases').where({ id: req.params.purchaseId, customer_id: customer.id }).first();
  return { customer, purchase };
}

async function listWarrantyVisits(req, res, next) {
  try {
    const { customer, purchase } = await loadCustomerAndPurchase(req);
    if (!customer || !purchase) return res.redirect('/admin/khach-hang');

    const visits = await db('purchase_warranty_visits').where('purchase_id', purchase.id).orderBy('visit_date', 'desc');

    res.render('admin/warranty-visits', {
      title: `Bảo hành ${purchase.product_name} - ${customer.name} - TOMSTORE Admin`,
      customer,
      purchase,
      visits,
      warrantyIssueTypes: WARRANTY_ISSUE_TYPES,
      warrantyIssueLabel,
      errors: [],
      visitForm: {}
    });
  } catch (err) {
    next(err);
  }
}

async function addWarrantyVisit(req, res, next) {
  try {
    const { customer, purchase } = await loadCustomerAndPurchase(req);
    if (!customer || !purchase) return res.redirect('/admin/khach-hang');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const visits = await db('purchase_warranty_visits').where('purchase_id', purchase.id).orderBy('visit_date', 'desc');
      return res.status(400).render('admin/warranty-visits', {
        title: `Bảo hành ${purchase.product_name} - ${customer.name} - TOMSTORE Admin`,
        customer,
        purchase,
        visits,
        warrantyIssueTypes: WARRANTY_ISSUE_TYPES,
        warrantyIssueLabel,
        errors: errors.array(),
        visitForm: { ...req.body, issueKeys: issueKeysFromBody(req.body) }
      });
    }

    await db('purchase_warranty_visits').insert({
      purchase_id: purchase.id,
      ...warrantyVisitFieldsFromBody(req.body)
    });

    res.redirect(`/admin/khach-hang/${customer.id}/san-pham/${purchase.id}/bao-hanh`);
  } catch (err) {
    next(err);
  }
}

async function editWarrantyVisitForm(req, res, next) {
  try {
    const { customer, purchase } = await loadCustomerAndPurchase(req);
    if (!customer || !purchase) return res.redirect('/admin/khach-hang');
    const visit = await db('purchase_warranty_visits').where({ id: req.params.visitId, purchase_id: purchase.id }).first();
    if (!visit) return res.redirect(`/admin/khach-hang/${customer.id}/san-pham/${purchase.id}/bao-hanh`);

    res.render('admin/warranty-visit-edit', {
      title: `Sửa lần bảo hành - ${customer.name} - TOMSTORE Admin`,
      customer,
      purchase,
      visit: {
        ...visit,
        visit_date: toDateInputValue(visit.visit_date),
        issueKeys: (visit.issue || '').split(',').map((s) => s.trim()).filter(Boolean)
      },
      warrantyIssueTypes: WARRANTY_ISSUE_TYPES,
      errors: []
    });
  } catch (err) {
    next(err);
  }
}

async function updateWarrantyVisit(req, res, next) {
  try {
    const { customer, purchase } = await loadCustomerAndPurchase(req);
    if (!customer || !purchase) return res.redirect('/admin/khach-hang');
    const visit = await db('purchase_warranty_visits').where({ id: req.params.visitId, purchase_id: purchase.id }).first();
    if (!visit) return res.redirect(`/admin/khach-hang/${customer.id}/san-pham/${purchase.id}/bao-hanh`);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('admin/warranty-visit-edit', {
        title: `Sửa lần bảo hành - ${customer.name} - TOMSTORE Admin`,
        customer,
        purchase,
        visit: { ...visit, ...req.body, issueKeys: issueKeysFromBody(req.body) },
        warrantyIssueTypes: WARRANTY_ISSUE_TYPES,
        errors: errors.array()
      });
    }

    await db('purchase_warranty_visits').where('id', visit.id).update(warrantyVisitFieldsFromBody(req.body));

    res.redirect(`/admin/khach-hang/${customer.id}/san-pham/${purchase.id}/bao-hanh`);
  } catch (err) {
    next(err);
  }
}

async function deleteWarrantyVisit(req, res, next) {
  try {
    await db('purchase_warranty_visits').where({ id: req.params.visitId, purchase_id: req.params.purchaseId }).del();
    res.redirect(`/admin/khach-hang/${req.params.id}/san-pham/${req.params.purchaseId}/bao-hanh`);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  customerValidators,
  purchaseValidators,
  warrantyVisitValidators,
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
  deletePurchase,
  listWarrantyVisits,
  addWarrantyVisit,
  editWarrantyVisitForm,
  updateWarrantyVisit,
  deleteWarrantyVisit
};
