const db = require('../../db');
const { ICON_LABELS } = require('../../utils/policyIcons');

async function listPolicies(req, res, next) {
  try {
    const groups = await db('policy_groups').orderBy('sort_order');
    const allPolicies = await db('policies').orderBy('sort_order');

    const groupSections = groups.map((group) => ({
      group,
      policies: allPolicies.filter((p) => p.group_id === group.id)
    }));
    const ungrouped = allPolicies.filter((p) => !p.group_id);

    res.render('admin/policies', {
      title: 'Chính sách bảo hành - TOMSTORE Admin',
      groupSections,
      ungrouped,
      iconLabels: ICON_LABELS,
      errors: []
    });
  } catch (err) {
    next(err);
  }
}

async function createGroup(req, res, next) {
  try {
    const name = (req.body.name || '').trim();
    if (name) {
      const maxRow = await db('policy_groups').max('sort_order as m').first();
      const nextOrder = (maxRow && maxRow.m !== null ? maxRow.m : -1) + 1;
      await db('policy_groups').insert({ name, sort_order: nextOrder });
    }
    res.redirect('/admin/chinh-sach');
  } catch (err) {
    next(err);
  }
}

async function renameGroup(req, res, next) {
  try {
    const name = (req.body.name || '').trim();
    if (name) {
      await db('policy_groups').where('id', req.params.id).update({ name });
    }
    res.redirect('/admin/chinh-sach');
  } catch (err) {
    next(err);
  }
}

async function setDefaultGroup(req, res, next) {
  try {
    await db('policy_groups').update({ is_default: false });
    await db('policy_groups').where('id', req.params.id).update({ is_default: true });
    res.redirect('/admin/chinh-sach');
  } catch (err) {
    next(err);
  }
}

async function deleteGroup(req, res, next) {
  try {
    const group = await db('policy_groups').where('id', req.params.id).first();
    if (group && !group.is_default) {
      await db('policy_groups').where('id', req.params.id).del();
    }
    res.redirect('/admin/chinh-sach');
  } catch (err) {
    next(err);
  }
}

async function createPolicy(req, res, next) {
  try {
    const title = (req.body.title || '').trim();
    if (title) {
      const groupId = req.body.groupId ? Number(req.body.groupId) : null;
      const maxRow = await db('policies')
        .where('group_id', groupId)
        .max('sort_order as m')
        .first();
      const nextOrder = (maxRow && maxRow.m !== null ? maxRow.m : -1) + 1;
      await db('policies').insert({
        group_id: groupId,
        title,
        description: (req.body.description || '').trim() || null,
        icon: req.body.icon || 'shield',
        sort_order: nextOrder
      });
    }
    res.redirect('/admin/chinh-sach');
  } catch (err) {
    next(err);
  }
}

async function editPolicyForm(req, res, next) {
  try {
    const policy = await db('policies').where('id', req.params.id).first();
    if (!policy) return res.redirect('/admin/chinh-sach');

    const groups = await db('policy_groups').orderBy('sort_order');
    res.render('admin/policy-edit', {
      title: 'Sửa chính sách - TOMSTORE Admin',
      policy,
      groups,
      iconLabels: ICON_LABELS,
      errors: []
    });
  } catch (err) {
    next(err);
  }
}

async function updatePolicy(req, res, next) {
  try {
    const title = (req.body.title || '').trim();
    if (!title) return res.redirect('/admin/chinh-sach/' + req.params.id + '/sua');

    await db('policies')
      .where('id', req.params.id)
      .update({
        group_id: req.body.groupId ? Number(req.body.groupId) : null,
        title,
        description: (req.body.description || '').trim() || null,
        icon: req.body.icon || 'shield'
      });
    res.redirect('/admin/chinh-sach');
  } catch (err) {
    next(err);
  }
}

async function deletePolicy(req, res, next) {
  try {
    await db('policies').where('id', req.params.id).del();
    res.redirect('/admin/chinh-sach');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPolicies,
  createGroup,
  renameGroup,
  setDefaultGroup,
  deleteGroup,
  createPolicy,
  editPolicyForm,
  updatePolicy,
  deletePolicy
};
