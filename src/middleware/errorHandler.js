function notFoundHandler(req, res) {
  res.status(404).render('error', {
    title: 'Không tìm thấy trang',
    statusCode: 404,
    message: 'Trang bạn tìm không tồn tại hoặc đã bị gỡ bỏ.'
  });
}

function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(err.status || 500).render('error', {
    title: 'Đã có lỗi xảy ra',
    statusCode: err.status || 500,
    message: err.publicMessage || 'Hệ thống đang gặp sự cố, vui lòng thử lại sau.'
  });
}

module.exports = { notFoundHandler, errorHandler };
