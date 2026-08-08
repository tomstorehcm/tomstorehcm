const METHODS = {
  cod: {
    key: 'cod',
    label: 'Thanh toán khi nhận hàng (COD)'
  },
  bank_transfer: {
    key: 'bank_transfer',
    label: 'Chuyển khoản ngân hàng'
  }
};

function listMethods() {
  return Object.values(METHODS);
}

function getInstructions(order) {
  if (order.payment_method === 'bank_transfer') {
    return {
      title: 'Thông tin chuyển khoản',
      lines: [
        `Ngân hàng: ${process.env.BANK_NAME || ''}`,
        `Chủ tài khoản: ${process.env.BANK_ACCOUNT_NAME || ''}`,
        `Số tài khoản: ${process.env.BANK_ACCOUNT_NUMBER || ''}`,
        `Nội dung chuyển khoản: ${order.order_code}`,
        `Số tiền: cần chuyển đủ tổng đơn hàng`
      ]
    };
  }

  return {
    title: 'Thanh toán khi nhận hàng',
    lines: [
      'Vui lòng chuẩn bị đúng số tiền khi shipper giao hàng.',
      `Mã đơn hàng: ${order.order_code}`
    ]
  };
}

module.exports = { listMethods, getInstructions };
