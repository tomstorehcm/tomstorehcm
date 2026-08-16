const db = require('../db');

async function getDefaultPolicies() {
  const defaultGroup = await db('policy_groups').where('is_default', true).first();
  if (!defaultGroup) return [];
  return db('policies').where('group_id', defaultGroup.id).orderBy('sort_order');
}

async function getPoliciesForProduct(product) {
  if (product.policy_group_id) {
    return db('policies').where('group_id', product.policy_group_id).orderBy('sort_order');
  }

  const individual = await db('product_policies')
    .join('policies', 'product_policies.policy_id', 'policies.id')
    .where('product_policies.product_id', product.id)
    .select('policies.*')
    .orderBy('policies.sort_order');

  if (individual.length > 0) return individual;

  return getDefaultPolicies();
}

module.exports = { getDefaultPolicies, getPoliciesForProduct };
