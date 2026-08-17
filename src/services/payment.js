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
  // Bank transfer is no longer offered at checkout -- COD only, with staff
  // following up by phone. getInstructions() below still handles bank_transfer
  // for historical orders that were already placed that way.
  return [METHODS.cod];
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
    title: 'Đặt hàng thành công',
    lines: [
      `Mã đơn hàng: ${order.order_code}`,
      'Sẽ có nhân viên liên hệ tư vấn và hỗ trợ thêm cho quý khách.',
      'Cảm ơn khách hàng đã đặt hàng!'
    ]
  };
}

module.exports = { listMethods, getInstructions };
